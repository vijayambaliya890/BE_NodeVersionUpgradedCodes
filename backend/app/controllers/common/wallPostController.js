const mongoose = require("mongoose"),
  moment = require("moment"),
  fs = require("fs"),
  json2csv = require("json2csv"),
  Wall = require("../../models/wall"),
  User = require("../../models/user"),
  WallPost = require("../../models/wallPost"),
  Emoji = require("../../models/emoji"),
  WallPostLike = require("../../models/wallPostLike"),
  WallPostComment = require("../../models/wallPostComment"),
  WallPostAdminResponse = require("../../models/wallPostAdminResponse"),
  Question = require("../../models/question"),
  QuestionResponse = require("../../models/questionResponse"),
  ChallengeModule = require("../common/challengeController"),
  FCM = require("../../../helpers/fcm"),
  __ = require("../../../helpers/globalFunctions");
  const { AssignUserRead } = require('../../../helpers/assinguserread');

class wallPost {
  async createPost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(
        req,
        ["wallId", "category", "title", "description"],
        "wallPost"
      );
      if (requiredResult.status == false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      let isUserAuthorized = __.isUserAuthorized(req, req.body.wallId);
      if (!isUserAuthorized) return __.out(res, 403, "Forbidden Access");

      let wall = await Wall.findOne({
        _id: req.body.wallId,
        status: 1
      }).lean();
      if (!wall) return __.out(res, 403, "Wall not available");

      // check for admin can only nominate
      if (!!wall.nominationOnlyByAdmin && !!req.body.nomineeUsers && !!req.body.nomineeUsers.length) {
        const isAdmin = await Wall.findOne({
          wallId: req.body.wallId,
          companyId: req.user.companyId,
          assignUsers: {
              $elemMatch: {
                  admin: {
                      $in: [req.user._id]
                  }
              }
          }
        });

        if(!isAdmin) {
          return __.out(res, 403, "Wall admin can only create nominations");
        }
      }

      // check for anonymousPost
      if(req.body.anonymousPost) {
        if(!wall.postAnonymously) {
          return __.out(res, 300, "Anonymous post not allowed for this board");
        }
      }

      // check for nomination limit
      if (!!req.body.nomineeUsers && !!req.body.nomineeUsers.length && ((!!wall.maxNomination && !!wall.maxNomination.enabled) || (!!wall.nominationPerUser && !!wall.nominationPerUser.enabled))) {
        const periodMapping = { 1: 1, 2: 3, 3: 6, 4: 12 } // monthly, quarterly, harlfly, annually.
        let searchQuery = {
          wallId: req.body.wallId,
          status: 1,
          "nomineeUsers.0": {
            $exists: true
          },
          author: req.user._id
        }, select = {
          nomineeUsers: 1
        };

        // check and updated createdAt expiry
        const checkAndUpdate = async (input, term) => {
          const createdAt = moment(new Date(input.createdAt)).utc();
          const endDate = createdAt.add(input.submissionPeriod, 'M').utc().toDate();
          const today = moment(new Date()).utc().toDate();
          if (today > endDate) {
            // limit period expired, updating
            if (term === "max") {
              let maxNomination = wall.maxNomination;
              maxNomination.createdAt = endDate;
              var updateData = {
                maxNomination
              }
              wall.maxNomination.createdAt = endDate;
            } else {
              let nominationPerUser = wall.nominationPerUser;
              nominationPerUser.createdAt = endDate;
              updateData = {
                nominationPerUser
              }
              wall.nominationPerUser.createdAt = endDate;
            }
            await Wall.findOneAndUpdate({ _id: wall._id }, updateData);
          }
        }

        // getting wall posts
        const cb = async (createdAt, period) => {
          searchQuery.createdAt = {
            $lte: moment(createdAt).add(periodMapping[period], 'M').utc().toDate(),
            $gte: moment(createdAt).utc().toDate()
          }
          return await WallPost.find(searchQuery, select).lean();
        }
        // get wallposts and check for max nomination
        if (!!wall.maxNomination.enabled) {
          await checkAndUpdate(wall.maxNomination, "max");
          const wallPosts = await cb(wall.maxNomination.createdAt, wall.maxNomination.submissionPeriod);
          const nomineeUsersLength = wallPosts.reduce((x, y) => x + y.nomineeUsers.length, 0);
          if (wall.maxNomination.submissionLimit < (nomineeUsersLength + req.body.nomineeUsers.length)) {
            return __.out(res, 300, "Maximum nomination limit exceeds");
          }
        }
        // get wallposts and check for nomination per user
        if (!!wall.nominationPerUser.enabled) {
          await checkAndUpdate(wall.nominationPerUser, "nomiPerUser");
          const wallPosts = await cb(wall.nominationPerUser.createdAt, wall.nominationPerUser.submissionPeriod);
          const nomineeUsersArr = wallPosts.reduce((x, y) => [...x, ...y.nomineeUsers.map(user => user.toString())], []);
          const limitExceeds = req.body.nomineeUsers.find(nUser => 
            wall.nominationPerUser.submissionLimit === nomineeUsersArr.filter(user => user === nUser).length
          );
          if (!!limitExceeds) {
            return __.out(res, 300, "Maximum nomination per user limit exceeds");
          }
        }
      }

      let category = req.body.category;
      if (!Array.isArray(req.body.category)) {
        category = [req.body.category];
      }
      let insertPost = {
        wallId: req.body.wallId,
        category: category,
        title: req.body.title,
        description: req.body.description || "",
        attachments: req.body.attachments || [],
        author: req.user._id,
        taskList: req.body.taskList || [],
        assignedToList: req.body.assignedToList || [],
        nomineeUsers: req.body.nomineeUsers || [],
        assignedEmojis: req.body.assignedEmojis || [],
        moduleIncluded: !!req.body.moduleIncluded,
        anonymousPost: !!req.body.anonymousPost,
        status: 1
      };
      if (req.body.moduleIncluded == true) {
        insertPost.moduleId = req.body.moduleId;
      }
      if (req.body.taskDueDate) {
        insertPost.taskDueDate = moment(req.body.taskDueDate)
          .endOf("day")
          .utc()
          .format();
      }

      // If admin means add priority date
      if (req.body.priorityDate)
        insertPost.priorityDate = moment(req.body.priorityDate)
          .utc()
          .format();

      // Add created at and user
      insertPost.taskList = insertPost.taskList.map(v => {
        v.createdBy = req.user._id;
        v.createdAt = moment()
          .utc()
          .format();
        return v;
      });

      let newPost = await new WallPost(insertPost).save();

      if (newPost._id) {
        await ChallengeModule.triggerChallenge(
          res,
          req.user._id,
          newPost._id,
          "wall",
          4
        );
      }
      // trigger challenge for nominated user
      if (!!newPost.nomineeUsers && !!newPost.nomineeUsers.length) {
        await ChallengeModule.triggerChallenge(
          res,
          newPost.nomineeUsers,
          newPost._id,
          "wall",
          8
        );
      }
      if (!newPost) return __.out(res, 300, "Error while creating post");
      // Send Assignes Push
      newPost.body = newPost.title;
      this.sendAssignNotification(newPost, req.body.assignedToList);
      // send push notification for nominated users
      if(!!req.body.nomineeUsers && !!req.body.nomineeUsers.length) {
        newPost.body = `You have been nominated! Check out the post on ${wall.wallName}`;
        newPost._id = `${newPost._id}_nomi`;
        this.sendAssignNotification(newPost, req.body.nomineeUsers);
      }

      return __.out(res, 201, "Post created successfully!");
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  // Upload Atachments
  async uploadFiles(req, res) {
    try {
      // Delete File
      if (req.body.deleteFile == "true" && req.body.filePath) {
        let filePath = `public/${req.body.filePath}`;
        if (fs.existsSync(filePath)) {
          __.log(`file exists`);
          await fs.unlink(filePath, data => { });
        }
        return __.out(res, 201, `Attachment deleted`);
      }

      if (!req.file) __.out(res, 300, `No File is Uploaded`);

      __.out(res, 201, {
        filePath: `uploads/wall/${req.file.filename}`
      });
      const result = await __.scanFile(
        req.file.filename,
        `public/uploads/wall/${req.file.filename}`
      );
      if (!!result) {
        // return __.out(res, 300, result);
      }
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  // update the user's post
  async updatePost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      // Check required fields
      let requiredResult = await __.checkRequiredFields(
        req,
        ["wallId", "postId", "category", "title", "description"],
        "wallPost"
      );
      if (requiredResult.status == false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      // Get Wall Verification
      let wallData = await Wall.findOne({
        _id: req.body.wallId,
        status: 1
      }).lean();
      if (!wallData) {
        return __.out(res, 300, `Wall not found`);
      }
      // Check user is in this wall
      let userWalls = await AssignUserRead.getUserInAssignedUser(req.user, Wall)
      if (userWalls.indexOf(wallData._id) == -1) {
        // return __.out(res, 300, `Permission denied`);
      }

      let isUserAuthorized = __.isUserAuthorized(req, req.body.wallId);
      if (!isUserAuthorized) return __.out(res, 403, "Forbidden Access");

      let where = {
        _id: req.body.postId,
        wallId: req.body.wallId,
        status: 1
      };
      var isAvail = await WallPost.findOne(where).lean();
      // if(isAvail.nomineeUsers && req.body.nomineeUsers){
      //     isAvail.nomineeUsers =[...isAvail.nomineeUsers,...req.body.nomineeUsers]
      //  } else if(req.body.nomineeUsers){
      isAvail.nomineeUsers = req.body.nomineeUsers || [];
      // }
      // Add created at and user
      let isTaskCompleted = true;
      let newTaskAdded = false;
      req.body.taskList = req.body.taskList || [];
      req.body.taskList = req.body.taskList.map(v => {
        if (!v._id) {
          newTaskAdded = true;
          v.createdBy = req.user._id;
          v.createdAt = moment()
            .utc()
            .format();
        }

        if (!v.status || v.status == 0) {
          isTaskCompleted = false;
        }
        return v;
      });
      let category = req.body.category
      if (!Array.isArray(req.body.category)) {
        category = [req.body.category];
      }
      let updatedData = {
        wallId: req.body.wallId,
        category: category,
        title: req.body.title,
        taskList: req.body.taskList || [],
        description: req.body.description,
        assignedToList: req.body.assignedToList || [],
        nomineeUsers: isAvail.nomineeUsers || [],
        priorityDate: moment(req.body.priorityDate)
          .utc()
          .format(),
        attachments: req.body.attachments || [],
        assignedEmojis: req.body.assignedEmojis || [],
        author: req.user._id,
        isTaskCompleted: isTaskCompleted,
        lastUpdated: moment()
          .utc()
          .format()
      };
      // End of day
      if (req.body.taskDueDate) {
        updatedData.taskDueDate = moment(req.body.taskDueDate)
          .endOf("day")
          .utc()
          .format();
      }

      var isUpdates = await WallPost.findOneAndUpdate(
        where,
        {
          $set: updatedData
        },
        {
          new: true
        }
      ).lean();

      if (!isUpdates) return __.out(res, 300, "Error while updating");

      // Send Assignes Push
      if (newTaskAdded == true) {
        isUpdates.body = isUpdates.title;
        this.sendAssignNotification(isUpdates, req.body.assignedToList);
      }
      return __.out(res, 201, "Updated Successfully!");
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async deletePost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, ["postId"]);
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      let wallPost = await WallPost.findOne({
        _id: req.body.postId,
        status: 0 || 1 || 2
      });
      if (!wallPost) return __.out(res, 300, "Invalid PostId");

      wallPost.status = 3;
      await wallPost.save();
      return __.out(res, 201, `Post deleted`);
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async likePost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      // Check required fields
      let requiredResult = await __.checkRequiredFields(
        req,
        ["postId", "isLiked"],
        "wallPostLike"
      );
      if (requiredResult.status == false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      //Post Data availability verification
      let postData = await WallPost.findOne({
        _id: req.body.postId,
        status: 1
      }).lean();
      if (!postData) return __.out(res, 300, "No Post Found");

      // Getting the wall record
      let wallData = postData.wallId;
      if (!wallData) return __.out(res, 300, "No Wall Found");

      //Getting user Record
      let userData = req.user;
      if (!userData) return __.out(res, 300, "No User Found");

      let isUserAuthorized = __.isUserAuthorized(req, wallData._id);
      if (!isUserAuthorized) return __.out(res, 403, "Forbidden Access");

      var query = {
        postId: postData._id,
        userId: req.user,
        postId: req.body.postId,
        wallId: wallData,
        status: 1
      },
        update = {
          isLiked: req.body.isLiked
        },
        options = {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        };

      let isAlreadyLiked = await WallPostLike.findOne({
        postId: postData._id,
        userId: req.user,
        wallId: wallData,
        status: 1,
        isLiked: true
      });

      if (isAlreadyLiked && req.body.isLiked) {
        return __.out(res, 201, "This post is already Liked");
      } else {
        let isLikedPost = await WallPostLike.findOneAndUpdate(
          query,
          update,
          options
        );

        if (isLikedPost) {
          var isCountUpdated = await WallPost.findOneAndUpdate(
            {
              _id: postData._id
            },
            {
              $inc: {
                likesCount: 1
              },
              likedBy: req.user._id
            },
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert: true
            }
          );

          if (!isCountUpdated)
            return __.out(res, 300, "Error while updating like count");

          return __.out(res, 201, "Liked Successfully");
        } else return __.out(res, 300, "Error while performing like");
      }
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  async commentPost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      // Check required fields
      let requiredResult = await __.checkRequiredFields(
        req,
        ["postId"],
        "wallPostComment"
      );
      if (requiredResult.status == false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      //Post Data availability verification
      let postData = await WallPost.findOne({
        _id: req.body.postId,
        status: 1
      }).lean();

      if (!postData) return __.out(res, 300, "No Post Found");

      // Getting the wall record
      let wallData = postData.wallId;
      if (!wallData) return __.out(res, 300, "No Wall Found");

      let isUserAuthorized = __.isUserAuthorized(req, wallData._id);
      if (!isUserAuthorized) return __.out(res, 403, "Forbidden Access");

      //Getting user Record
      let userData = req.user;
      if (!userData) return __.out(res, 300, "No User Found");

      if (req.body.commentId) {
        var query = {
          _id: req.body.commentId
        },
          update = {
            comment: req.body.comment || "",
            attachment: req.body.attachment || {},
            userId: req.user._id,
            wallId: wallData._id,
            postId: postData._id
          },
          options = {
            upsert: false,
            new: false,
            setDefaultsOnInsert: false
          };

        let commentUpdatedData = await WallPostComment.findOneAndUpdate(
          query,
          update,
          options
        );
        if (!commentUpdatedData)
          return __.out(res, 300, "Oops something went wrong");

        return __.out(res, 201, "Comment updated successfully");
      } else {
        let addComment = await WallPostComment.create({
          postId: postData._id,
          userId: userData._id,
          wallId: wallData,
          comment: req.body.comment || "",
          attachment: req.body.attachment || {},
          status: 1
        });

        if (!addComment) return __.out(res, 300, "Oops something went wrong");
        var isCountUpdated = await WallPost.findOneAndUpdate(
          {
            _id: postData._id
          },
          {
            $inc: {
              commentCount: 1
            }
          },
          {
            upsert: true,
            new: true
          }
        );
        if (!isCountUpdated)
          return __.out(res, 300, "Error while updating comment count");

        return __.out(res, 201, "Comment created successfully");
      }
    } catch (error) {
      __.log(error);
      __.out(res, 500);
    }
  }

  async sharePost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        "postId",
        "shareTo"
      ]);

      if (requiredResult.status == false)
        return __.out(res, 400, requiredResult.missingFields);

      var postData = await WallPost.findOne({
        _id: req.body.postId
      }).lean();
      __.log(postData);

      if (!postData) return __.out(res, 300, "Invalid post data");

      var wallData = await Wall.findOne({
        _id: postData.wallId
      }).lean();

      if (!wallData) return __.out(res, 300, "Invalid wall data");
      let isUserAuthorized = __.isUserAuthorized(req, wallData._id);

      if (!isUserAuthorized) return __.out(res, 403, "Forbidden Access");

      let incShare = 0;
      for (let elem of req.body.shareTo) {
        let category = postData.category;
        if (!Array.isArray(postData.category)) {
          category = [category];
        }
        var insert = {
          wallId: elem,
          category: postData.category || [],
          title: postData.title,
          description: postData.description,
          attachments: postData.attachments,
          author: postData.author,
          sharedBy: req.user._id,
          status: postData.status,
          isShared: true,
          sharedType: 1,
          fromWall: postData.wallId,
          fromWallPost: postData._id
        };

        let sharePost = await new WallPost(insert).save();
        incShare++;
      }

      var isCountUpdated = await WallPost.findOneAndUpdate(
        {
          _id: postData._id
        },
        {
          $inc: {
            sharedCount: incShare
          }
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      );

      if (!isCountUpdated)
        return __.out(res, 300, "Error while updating comment count");

      return __.out(res, 201, "Shared successfully");
    } catch (error) {
      __.log(error);
      __.out(res, 500, error);
    }
  }

  async deleteComment(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, ["commentId"]);
      if (requiredResult.status == false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      var query = {
        _id: req.body.commentId
      },
        update = {
          status: 3
        },
        options = {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        };

      let isSoftDeleted = await WallPostComment.findOneAndUpdate(
        query,
        update,
        options
      );
      if (!isSoftDeleted)
        return __.out(res, 300, "Error while updating comment");

      var isCountUpdated = await WallPost.findOneAndUpdate(
        {
          _id: isSoftDeleted.postId
        },
        {
          $inc: {
            commentCount: -1
          }
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      );

      if (!isCountUpdated)
        return __.out(res, 300, "Error while updating comment count");

      return __.out(res, 201, "Comment deleted successfully");
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  async addEmoji(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      // Check required fields
      let requiredResult = await __.checkRequiredFields(req, [
        "postId",
        "emojiId"
      ]);
      if (requiredResult.status == false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      //Post Data availability verification
      let postData = await WallPost.findOne({
        _id: req.body.postId,
        status: 1
      }).lean();
      if (!postData) return __.out(res, 300, "No Post Found");

      let emojiData = await Emoji.findOne({
        _id: req.body.emojiId,
        status: 1
      }).lean();
      if (!emojiData) return __.out(res, 300, "Emoji not found");

      var query = {
        _id: req.body.postId,
        status: 1
      },
        update = {
          emoji: req.body.emojiId
        },
        options = {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        };

      let isLikedPost = await WallPost.findOneAndUpdate(query, update, options);
      if (!isLikedPost) return __.out(res, 300, "Error while adding Emoji");

      return __.out(res, 201, "Emoji added successfully");
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  async addTask(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      // Check required fields
      let requiredResult = await __.checkRequiredFields(req, [
        "postId",
        "taskList"
      ]);
      if (requiredResult.status == false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      //Post Data availability verification
      let postData = await WallPost.findOne({
        _id: req.body.postId,
        status: 1
      });

      if (!postData) return __.out(res, 300, "No Post Found");
      /// let userWalls = await __.getUserWalls(req.user);
      // if (userWalls.indexOf(postData.wallId) == -1) {
      //     return __.out(res, 300, 'Un authorized wall');
      // }
      // Add created at and user
      postData.isTaskCompleted = true;
      req.body.taskList = req.body.taskList.map(v => {
        if (!v._id) {
          v.createdBy = req.user._id;
          v.createdAt = moment()
            .utc()
            .format();
        }

        if (!v.status || v.status == 0) {
          postData.isTaskCompleted = false;
        }

        return v;
      });

      postData.taskList = req.body.taskList;
      if (req.body.taskDueDate) {
        postData.taskDueDate = moment(req.body.taskDueDate)
          .utc()
          .format();
      }
      if (req.body.assignedToList) {
        postData.assignedToList = req.body.assignedToList;
      }
      await postData.save();

      return __.out(res, 201, "Task updated successfully");
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  // Send Push to Assigned Users
  async sendAssignNotification(post, usersList) {
    try {
      usersList = usersList || [];
      if (usersList.length == 0) {
        return;
      }
      let users = await User.find({ _id: { $in: usersList }, status: 1 }).select("deviceToken").lean();
      let deviceTokens = users.map(v => v.deviceToken).filter(Boolean);
      if (deviceTokens.length > 0) {
        const pushData = {
          title: post.title,
          body: post.body,
          redirect: "wallpost"
        },
          collapseKey = post._id;
        FCM.push(deviceTokens, pushData, collapseKey);
      }
    } catch (error) {
      __.log(error);
      return __.out(error, 500);
    }
  }

  // Export the Wallpost..

  async exportWallPost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      var wallPostDetails = await WallPost.findById(req.body._id)
        .select("title description moduleIncluded moduleId wallId")
        .lean();
      let wallData = await Wall.findOne({
        _id: wallPostDetails.wallId
      });
      let userId = await AssignUserRead.read(wallData.assignUsers, null, wallData.createdBy);
      userId = userId.users;      
      if (wallPostDetails) {
        let questionField = [];
        let questionList = {};
        if (wallPostDetails.moduleIncluded) {
          // Question Options
          let questionData = await Question.find({
            moduleId: wallPostDetails.moduleId,
            status: 1
          })
            .select("options type")
            .sort({
              indexNum: 1
            })
            .lean();

          let int = 1;
          for (let elem of questionData) {
            /**
             *
             * questionList = {
             *    questionId: {
             *      title:Q-1,Q-2,
             *      type:1,2,3,4,
             *      options:{
             *              optionId:{ _id:'', value:'' },
             *              optionId:{ _id:'', value:'' }
             *            };
             *    };
             * };
             *
             * questionField = [Q-1, Q-2, Q-3];
             *
             */
            questionField.push(`Q-${int}`);
            questionList[elem._id] = {
              title: `Q-${int}`,
              type: elem.type
            };
            // MCQ,trueFalse,Polling
            if ([2, 3, 4, 5].indexOf(elem.type) > -1) {
              questionList[elem._id]["options"] = {};
              for (let optionData of elem.options) {
                questionList[elem._id]["options"][optionData._id] = optionData;
              }
            }
            int++;
          }
        }

        var jsonArray = [],
          title = wallPostDetails.title,
          description = wallPostDetails.description,
          wallIdCount = userId.length,
          wallId = userId;
        // unread = wallPostDetails.notifyUnreadUsers,
        // unreadCount = (wallPostDetails.notifyUnreadUsers).length,
        // acknowledged = wallPostDetails.notifyAcknowledgedUsers,
        // acknowledgedCount = (wallPostDetails.notifyAcknowledgedUsers).length,
        // userAcknowledgedAt = wallPostDetails.userAcknowledgedAt,
        // timeZone = moment.parseZone(req.body.date, 'MM-DD-YYYY HH:mm:ss Z').format('Z');

        async function processAcknowledgedArray() {
          for (var i = 0; i < wallIdCount; i++) {
            var userDetails = await User.findOne(wallId[i]).lean();
            var json = {};
            json.title = title;
            json.description = description;
            json.StaffName = userDetails.name ? userDetails.name : "";
            json.StaffID = (userDetails.staffId ? userDetails.staffId : "").toString();
            json.StaffAppointment = userDetails.appointmentId ? userDetails.appointmentId.name : "";
            // json.NotificationStatus = 'Acknowledged';
            // json.DateOfAcknowledgement = (userAcknowledgedAt[i]) ? (moment.utc(userAcknowledgedAt[i]).utcOffset(`${timeZone}`).format('DD-MM-YYYY HH:mm:ss')) : '';
            // Get Qns Res
            let resData = await QuestionResponse.find({
              wallPostId: wallPostDetails._id,
              userId: wallId[i],
              status: 1
            }).lean();
            // Iterate Res Qns & Push to Qnsdata
            for (let elem of resData) {
              let qnsData = questionList[elem.questionId];
              if (qnsData != undefined) {
                if ([2, 3, 4, 5].indexOf(qnsData.type) > -1) {
                  let optData = qnsData["options"][elem.option];
                  if (optData) {
                    if (json[qnsData.title]) {
                      json[qnsData.title] =
                        `${json[qnsData.title]},${optData.value}` || "";
                    } else {
                      json[qnsData.title] = optData.value;
                    }
                  }
                } else {
                  json[qnsData.title] = qnsData.value || "";
                }
              }
            }

            await jsonArray.push(json);
          }
        }
        // async function processUnreadArray() {
        //     for (var j = 0; j < unreadCount; j++) {
        //         var json1 = {};
        //         json1.title = title;
        //        // json1.subTitle = subTitle;
        //         json1.description = description;
        //         json1.StaffName = (unread[j].name) ? unread[j].name : '';
        //         json1.StaffID = ((unread[j].staffId) ? unread[j].staffId : '').toString();
        //         json1.StaffAppointment = (unread[j].appointmentId) ? unread[j].appointmentId.name : '';
        //         json1.NotificationStatus = 'Unread';
        //         json1.DateOfAcknowledgement = ' ';
        //         await jsonArray.push(json1);
        //     }
        // }
        await processAcknowledgedArray();
        // await processUnreadArray();

        var csvLink = "",
          fieldsArray = [
            "title",
            "description",
            "StaffName",
            "StaffID",
            "StaffAppointment"
          ];
        fieldsArray = [...fieldsArray, ...questionField];

        if (jsonArray.length !== 0) {
          var csv = json2csv({
            data: jsonArray,
            fields: fieldsArray
          });
          let fileName = Math.random()
            .toString(36)
            .substr(2, 10);
          fs.writeFile(
            `./public/uploads/wallPostExports/${fileName}.csv`,
            csv,
            err => {
              if (err) {
                __.log("json2csv err" + err);
                __.out(res, 500);
              } else {
                csvLink = `uploads/wallPostExports/${fileName}.csv`;
                __.out(res, 201, {
                  csvLink: csvLink
                });
              }
            }
          );
        } else {
          __.out(res, 201, {
            csvLink: csvLink
          });
        }
      } else __.out(res, 300, "Invalid wallpost");
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  // Add Nominee ..

  async addNominees(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      // Check required fields
      let requiredResult = await __.checkRequiredFields(req, [
        "postId",
        "nomineeUsers"
      ]);
      if (requiredResult.status == false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      let where = {
        _id: req.body.postId,
        status: 1
      };

      var isUpdates = await WallPost.findOne(where);
      if (isUpdates.nomineeUsers) {
        isUpdates.nomineeUsers = [
          ...isUpdates.nomineeUsers,
          ...req.body.nomineeUsers
        ];
        isUpdates.nomineeUsers = [...new Set(isUpdates.nomineeUsers)];
      }

      await isUpdates.save();
      if (!isUpdates) {
        return __.out(res, 300, "Error while updating");
      }

      return __.out(res, 201, "Nominees updated successfully");
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  async adminResponse(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      // Check required fields
      let requiredResult = await __.checkRequiredFields(
        req,
        req.body._id ? ["adminResponse"] : ["postId", "adminResponse"],
        "wallPostAdminResponse"
      );
      if (requiredResult.status == false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      if(req.body._id) {
        const adminResponse = await WallPostAdminResponse.findOne({
          _id: req.body._id,
          userId: req.user._id,
          status: 1
        });
        if (!adminResponse) return __.out(res, 300, "No Admin Response Found");
        req.body.postId = adminResponse.postId;
      }
      //Post Data availability verification
      const postData = await WallPost.findOne({
        _id: req.body.postId,
        status: 1
      }).populate({
        path: 'wallId',
        select: { adminResponse: 1, assignUsers: 1 }
      }).lean();

      if (!postData) return __.out(res, 300, "No Post Found");

      // Getting the wall record
      const wallData = postData.wallId;
      if (!wallData || !wallData._id) return __.out(res, 300, "No Wall Found");

      // check admin response enabled for board
      if (!wallData.adminResponse) return __.out(res, 300, "Admin Respones not enabled for this board");

      // check current user, admin or author of post
      const eligibleUsers = wallData.assignUsers.reduce((final, au) => [...final, ...au.admin.map(ad => ad.toString())], [postData.author.toString()]);
      if (!eligibleUsers.includes(req.user._id.toString())) {
        return __.out(res, 300, "Board admins can only create admin response");
      }

      if (!!req.body._id) { // update admin response
        var query = { _id: req.body._id, postId: req.body.postId, userId: req.user._id },
          update = {
            adminResponse: req.body.adminResponse || "",
            attachment: req.body.attachment || {},
            privateResponse: req.body.privateResponse
          };

        let commentUpdatedData = await WallPostAdminResponse.findOneAndUpdate(query, update);

        if (!commentUpdatedData)
          return __.out(res, 300, "Oops something went wrong");

        return __.out(res, 201, "Admin Response updated successfully");
      } else {
        // create admin response
        const addComment = await WallPostAdminResponse.create({
          postId: postData._id,
          userId: req.user._id,
          wallId: wallData._id,
          adminResponse: req.body.adminResponse || "",
          privateResponse: !!req.body.privateResponse,
          attachment: req.body.attachment || {},
          status: 1
        });
  
        // sending push notification to admins of board
        const pushData = {
          _id: postData._id,
          title: postData.title,
          body: `An admin response was posted`
        };
        let userIds = [...new Set(eligibleUsers)]; // ids of post created user and admins of board
        userIds.splice(userIds.findIndex(id => id.toString() === req.user._id), 1);
        this.sendAssignNotification(pushData, userIds);

        if (!addComment) return __.out(res, 300, "Oops something went wrong");
      }
      return __.out(res, 201, "Admin Response created succussfully");
    } catch (error) {
      __.out(res, 500);
    }
  }

  async deleteAdminResponse(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, ["responseId"]);
      if (requiredResult.status == false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      let adminResponse = await WallPostAdminResponse.findOne({
        _id: req.body.responseId,
        userId: req.user._id
      });
      if (!adminResponse) {
        return __.out(res, 300, "This admin response not belong to you / not found");
      }

      adminResponse.status = 3;
      await adminResponse.save();

      return __.out(res, 201, "Admin response deleted successfully");
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }
}

wallPost = new wallPost();
module.exports = wallPost;
