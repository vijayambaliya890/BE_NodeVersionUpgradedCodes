// Controller Code Starts here
const mongoose = require('mongoose'),
  moment = require('moment'),
  htmlparser = require('htmlparser'),
  Channel = require('../../models/channel'),
  PostCategory = require('../../models/postCategory'),
  Post = require('../../models/post'),
  PostLike = require('../../models/channelPostLike'),
  PostView = require('../../models/wallPostView'),
  PostComment = require('../../models/channelPostComment'),
  ChallengeModule = require('../common/challengeController'),
  Wall = require('../../models/wall'),
  WallPost = require('../../models/wallPost'),
  _ = require('lodash'),
  __ = require('../../../helpers/globalFunctions');

class post {
  async readOne(req, res) {
    try {
      // Get Assigned Channel Ids
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      req.body.internalApi = true;
      let channelList = await this.getUserChannels(req, res);
      let assignedChannelIds = [];
      for (let elem of channelList) {
        assignedChannelIds.push(elem._id);
      }

      let where = {
        _id: req.params.postId,
        channelId: {
          $in: assignedChannelIds,
        },
        status: {
          $nin: [3],
        },
      };

      var postData = await Post.findOne(where)
        .populate({
          path: 'authorId',
          select: '_id name profilePicture',
        })
        .populate({
          path: 'channelId',
          select: '_id name logo',
        })
        .populate({
          path: 'categoryId',
          select: '_id name',
        })
        .populate({
          path: 'moduleId',
          select: '_id moduleName',
        })
        .populate({
          path: 'wallId',
          populate: {
            path: 'category',
            select: 'categoryName',
          },
        })
        .lean();
      if (!postData) {
        return __.out(res, 300, 'News/Event Not Found');
      }
      if (postData.postType === 'news') {
        await ChallengeModule.triggerChallenge(
          res,
          req.user._id,
          req.params.postId,
          'channel',
          1,
        );
      }

      // get all video src in this html content
      postData.videoUrls = __.getHTMLValues(
        postData.content.content,
        'video',
        'src',
      );

      // get all iframe src in this html content
      postData.videoUrls = [
        ...postData.videoUrls,
        ...__.getHTMLValues(postData.content.content, 'iframe', 'src'),
      ];

      // get all document src in this html content
      postData.fileUrl = __.getHTMLValues(
        postData.content.content,
        'a',
        'href',
      );

      const video = postData.content.content.replace(
        /<video.*>.*?<\/video>/gi,
        '',
      );

      const iframe = video.replace(/<iframe.*>.*?<\/iframe>/gi, '');
      postData.content.content = iframe.replace(/<a.*>.*?<\/a>/gi, '');
      // Wall Details
      if (postData.wallId) {
        let wallData = postData.wallId;
        // Get All user List and admin lists
        let adminList = [];
        let userList = [];
        for (let elem of wallData.assignUsers) {
          adminList = [...adminList, ...elem.admin];
          userList = [...userList, ...elem.user];
        }
        wallData.adminList = adminList;
        wallData.userList = userList;
        delete wallData.assignUsers;
        postData.wallId = wallData;
      }
      /** update viewHistory in postview and update count post object */
      if (postData) {
        //** it will create new document if not exist with the current user */
        const resultUp = await PostView.findOneAndUpdate(
          {
            channelId: postData.channelId._id,
            postId: postData._id,
            userId: req.user._id,
            postType: 'channel',
          },
          {
            $push: {
              viewHistory: moment().utc().format(),
            },
          },
          {
            new: true,
            lean: true,
            upsert: true,
          },
        );
        if (!resultUp) {
          return __.out(res, 300, 'Not updated');
        }
        /** Get count of current post */
        let viewCount = await PostView.find({ postId: postData._id }).count();
        /** updating count in current post document */
        const viewCountUpdate = await Post.findByIdAndUpdate(postData._id, {
          viewCount,
        });

        if (!viewCountUpdate) {
          return __.out(res, 300, 'Not updated');
        }
      }
      /** update code end */
      // Check user liked this post or not
      postData.userLiked = false;
      let likeData = await PostLike.findOne({
        userId: req.user._id,
        postId: postData._id,
        status: 1,
      }).lean();
      if (likeData) postData.userLiked = likeData.isLiked || false;
      return __.out(res, 201, postData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async read(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let pageNum = req.body.pageNum ? parseInt(req.body.pageNum) : 1;
      let limit = req.body.limit ? parseInt(req.body.limit) : 10;
      let skip = req.body.skip
        ? parseInt(req.body.skip)
        : (pageNum - 1) * limit;
      const search = req.body.search;
      // Get Assigned Channel Ids
      req.body.internalApi = true;
      let channelList = await this.getUserChannels(req, res);
      let assignedChannelIds = [];
      for (let elem of channelList) {
        assignedChannelIds.push(elem._id);
      }

      // Get Active Category
      req.body.channelIds = assignedChannelIds;
      let catList = await this.getUserCategories(req, res);
      let categoryIds = [];
      for (let elem of catList) {
        categoryIds.push(elem._id);
      }
      // Get Posts
      let where = {
        channelId: {
          $in: assignedChannelIds,
        },
        categoryId: {
          $in: categoryIds,
        },
        status: 1,
        'publishing.startDate': {
          $lte: moment().utc(),
        },
        'publishing.endDate': {
          $gte: moment().utc(),
        },
      };
      if (req.body.postType) {
        where.postType = req.body.postType;
      }
      if (req.body.channelId) {
        where.channelId = req.body.channelId;
      }
      if (req.body.categoryId) {
        where.categoryId = req.body.categoryId;
      }

      if(search){
        where['teaser.title'] = {
          $regex: search,
          $options: 'i',
        }
      }
      //__.log(where, "where")
      // Get Posts Lists
      var totalPost = await Post.count(where);
      var postList = await Post.find(where)
        .populate({
          path: 'authorId',
          select: '_id name profilePicture',
        })
        .populate({
          path: 'channelId',
          select: '_id name',
        })
        .populate({
          path: 'categoryId',
          select: '_id name',
        })
        .populate({
          path: 'wallId',
          select: '_id eventWallStartDate eventWallEndDate',
        })
        .sort({
          'publishing.startDate': -1,
        })
        .skip(skip)
        .limit(limit)
        .lean();
      let postLists = [];
      const currentDate = moment(moment().utc()).format('MM-DD-YYYY HH:mm:ss');
      for (let data of postList) {
        const content = data.content.content;
        if (data.wallId) {
          data.wallId.eventWallStartDate = moment(
            data.wallId.eventWallStartDate,
          ).format('MM-DD-YYYY HH:mm:ss');
          data.wallId.eventWallEndDate = moment(
            data.wallId.eventWallEndDate,
          ).format('MM-DD-YYYY HH:mm:ss');
          //console.log('data.wallId.eventWallStartDate',data.wallId.eventWallStartDate);
          //console.log(currentDate);
          // console.log(data.wallId.eventWallEndDate )
          if (
            new Date(data.wallId.eventWallStartDate).getTime() <=
              new Date(currentDate).getTime() &&
            new Date(currentDate).getTime() <=
              new Date(data.wallId.eventWallEndDate).getTime()
          ) {
            data.isWall = true;
          } else {
            data.isWall = false;
          }
          data.wallId = data.wallId._id;
          //delete data.wallId;
        } else {
          data.isWall = false;
        }
        data.videoUrls = __.getHTMLValues(data.content.content, 'video', 'src');
        // get all iframe src in this html content
        data.videoUrls = [
          ...data.videoUrls,
          ...__.getHTMLValues(data.content.content, 'iframe', 'src'),
        ];
        const video = content.replace(/<video.*>.*?<\/video>/gi, '');
        data.content.content = video.replace(/<iframe.*>.*?<\/iframe>/gi, '');
        postLists.push(data);
      }

      return __.out(res, 201, {
        total: totalPost,
        postList: postLists,
        catList: catList,
        channelList: channelList,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }
  async readNew(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      console.log('started');
      let pageNum = req.body.pageNum ? parseInt(req.body.pageNum) : 1;
      let limit = req.body.limit ? parseInt(req.body.limit) : 10;
      let skip = req.body.skip
        ? parseInt(req.body.skip)
        : (pageNum - 1) * limit;

      // Get Assigned Channel Ids
      req.body.internalApi = true;
      let channelList = await this.getUserChannels(req, res);
      let assignedChannelIds = [];
      for (let elem of channelList) {
        assignedChannelIds.push(elem._id);
      }

      // Get Active Category
      req.body.channelIds = assignedChannelIds;
      // let catList = await this.getUserCategories(req, res);
      // let categoryIds = [];
      // for (let elem of catList) {
      //   categoryIds.push(elem._id);
      // }
      // Get Posts
      let where = {
        channelId: {
          $in: assignedChannelIds,
        },
        status: 1,
        'publishing.startDate': {
          $lte: moment().utc(),
        },
        'publishing.endDate': {
          $gte: moment().utc(),
        },
      };
      if (req.body.postType) {
        where.postType = req.body.postType;
      }
      if (req.body.channelId) {
        where.channelId = req.body.channelId;
      }
      if (req.body.categoryId) {
        where.categoryId = req.body.categoryId;
      }
      //__.log(where, "where")
      // Get Posts Lists
      var totalPost = await Post.count(where);
      var postList = await Post.find(where)
        .populate({
          path: 'authorId',
          select: '_id name profilePicture',
        })
        .populate({
          path: 'channelId',
          select: '_id name',
        })
        .populate({
          path: 'categoryId',
          select: '_id name',
        })
        .populate({
          path: 'wallId',
          select: '_id eventWallStartDate eventWallEndDate',
        })
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean();
      let postLists = [];
      const currentDate = moment(moment().utc()).format('MM-DD-YYYY HH:mm:ss');
      for (let data of postList) {
        const content = data.content.content;
        data.channelName = data.channelId.name;
        if (data.wallId) {
          data.wallId.eventWallStartDate = moment(
            data.wallId.eventWallStartDate,
          ).format('MM-DD-YYYY HH:mm:ss');
          data.wallId.eventWallEndDate = moment(
            data.wallId.eventWallEndDate,
          ).format('MM-DD-YYYY HH:mm:ss');
          //console.log('data.wallId.eventWallStartDate',data.wallId.eventWallStartDate);
          //console.log(currentDate);
          // console.log(data.wallId.eventWallEndDate )
          if (
            new Date(data.wallId.eventWallStartDate).getTime() <=
              new Date(currentDate).getTime() &&
            new Date(currentDate).getTime() <=
              new Date(data.wallId.eventWallEndDate).getTime()
          ) {
            data.isWall = true;
          } else {
            data.isWall = false;
          }
          data.wallId = data.wallId._id;
          //delete data.wallId;
        } else {
          data.isWall = false;
        }
        data.videoUrls = __.getHTMLValues(data.content.content, 'video', 'src');
        // get all iframe src in this html content
        data.videoUrls = [
          ...data.videoUrls,
          ...__.getHTMLValues(data.content.content, 'iframe', 'src'),
        ];
        const video = content.replace(/<video.*>.*?<\/video>/gi, '');
        data.content.content = video.replace(/<iframe.*>.*?<\/iframe>/gi, '');
        postLists.push(data);
      }

      const finalDataArr = [];
      if (postLists.length > 0) {
        const finalData = groupBy(postLists, 'channelName');
        function groupBy(xs, key) {
          return xs.reduce(function (rv, x) {
            (rv[x[key]] = rv[x[key]] || []).push(x);
            return rv;
          }, {});
        }
        const keys = Object.keys(finalData);
        for (let i = 0; i < keys.length; i++) {
          const o = keys[i];
          const obj = {
            [o]: finalData[keys[i]],
          };
          finalDataArr.push(obj);
        }
      }
      return __.out(res, 201, {
        total: totalPost,
        postList: finalDataArr,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }
  async getUserCategories(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let where = {
        status: 1,
      };

      if (req.body.channelId) {
        where.channelId = req.body.channelId;
      } else if (req.body.channelIds) {
        where.channelId = {
          $in: req.body.channelIds,
        };
      } else {
        // Get Assigned Channel Ids
        req.body.internalApi = true;
        let channelList = await this.getUserChannels(req, res);
        var assignedChannelIds = [];
        for (let elem of channelList) {
          assignedChannelIds.push(elem._id);
        }
        where.channelId = {
          $in: assignedChannelIds,
        };
      }

      // Get Active Category List
      var catList = await PostCategory.find(where).select('_id name').lean();

      // Internal Api Call
      if (req.body.internalApi === true) {
        return catList;
      }

      return __.out(res, 201, catList);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getUserChannels(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let channelIds = await __.getUserChannel(req.user);
      var channelList = await Channel.find({
        _id: {
          $in: channelIds,
        },
      })
        .sort({
          updatedAt: -1,
        })
        .select('_id name')
        .lean();

      // Getting only user channels
      if (req.body.internalApi === true) {
        return channelList;
      }

      // Make Category Inside Channel
      let getCat = async function () {
        let count = 0;
        for (let elem of channelList) {
          let cat = await PostCategory.find({
            channelId: elem._id,
            status: 1,
          })
            .select('_id name')
            .lean();
          channelList[count].categoryList = cat;
          count++;
        }
      };
      await getCat();
      return __.out(res, 201, channelList);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  // Post Like function
  async likePost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      // Check required fields
      let requiredResult = await __.checkRequiredFields(
        req,
        ['postId', 'isLiked'],
        'postLike',
      );
      if (requiredResult.status == false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      //Post Data availability verification
      let postData = await Post.findOne({
        _id: req.body.postId,
        status: 1,
      }).lean();
      if (!postData) return __.out(res, 300, 'No Post Found');

      // Getting the wall record
      let channelData = postData.channelId;
      if (!channelData) return __.out(res, 300, 'No channel Found');

      //Getting user Record
      let userData = req.user;
      if (!userData) return __.out(res, 300, 'No User Found');

      var query = {
          postId: postData._id,
          userId: req.user,
          postId: req.body.postId,
          channelId: channelData,
          status: 1,
        },
        update = {
          isLiked: req.body.isLiked,
        },
        options = {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        };

      let isAlreadyLiked = await PostLike.findOne({
        postId: postData._id,
        userId: req.user,
        channelId: channelData,
        status: 1,
        isLiked: true,
      });

      if (isAlreadyLiked && req.body.isLiked) {
        return __.out(res, 201, 'This post is already Liked');
      }

      let isLikedPost = await PostLike.findOneAndUpdate(query, update, options);
      if (isLikedPost) {
        var isCountUpdated = await Post.findOneAndUpdate(
          {
            _id: postData._id,
          },
          {
            $inc: {
              likesCount: 1,
            },
            likedBy: req.user._id,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        );

        if (!isCountUpdated)
          return __.out(res, 300, 'Error while updating like count');

        return __.out(res, 201, 'Liked Successfully');
      }
      return __.out(res, 300, 'Error while performing like');
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
        ['postId'],
        'postComment',
      );
      if (requiredResult.status == false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      //Post Data availability verification
      let postData = await Post.findOne({
        _id: req.body.postId,
        status: 1,
      }).lean();

      if (!postData) return __.out(res, 300, 'No Post Found');

      // Getting the channel record
      let channelData = postData.channelId;
      if (!channelData) return __.out(res, 300, 'No Channel Found');

      //Getting user Record
      let userData = req.user;
      if (!userData) return __.out(res, 300, 'No User Found');

      if (req.body.commentId) {
        var query = {
            _id: req.body.commentId,
          },
          update = {
            comment: req.body.comment || '',
            attachment: req.body.attachment || {},
            userId: req.user._id,
            channelId: channelData._id,
            postId: postData._id,
          },
          options = {
            upsert: false,
            new: false,
            setDefaultsOnInsert: false,
          };

        let commentUpdatedData = await PostComment.findOneAndUpdate(
          query,
          update,
          options,
        );

        if (!commentUpdatedData)
          return __.out(res, 300, 'Oops something went wrong');

        return __.out(res, 201, 'Comment updated successfully');
      } else {
        let addComment = await PostComment.create({
          postId: postData._id,
          userId: userData._id,
          channelId: channelData._id,
          comment: req.body.comment || '',
          attachment: req.body.attachment || {},
          status: 1,
        });

        if (!addComment) return __.out(res, 300, 'Oops something went wrong');
        var isCountUpdated = await Post.findOneAndUpdate(
          {
            _id: postData._id,
          },
          {
            $inc: {
              commentCount: 1,
            },
          },
          {
            upsert: true,
            new: true,
          },
        );

        if (!isCountUpdated)
          return __.out(res, 300, 'Error while updating comment count');

        return __.out(res, 201, 'Comment created successfully');
      }
    } catch (error) {
      __.log(error);
      __.out(res, 500);
    }
  }

  // Post comment delete
  async deleteComment(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, ['commentId']);

      if (requiredResult.status == false)
        return __.out(res, 400, requiredResult.missingFields);

      var query = {
          _id: req.body.commentId,
        },
        update = {
          status: 3,
        },
        options = {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        };

      let isSoftDeleted = await PostComment.findOneAndUpdate(
        query,
        update,
        options,
      );

      if (!isSoftDeleted)
        return __.out(res, 300, 'Error while updating comment');

      var isCountUpdated = await Post.findOneAndUpdate(
        {
          _id: isSoftDeleted.postId,
        },
        {
          $inc: {
            commentCount: -1,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      if (!isCountUpdated)
        return __.out(res, 300, 'Error while updating comment count in post');

      return __.out(res, 201, 'Comment deleted successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  // Get all Posts - wall base
  async viewComments(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let searchQuery = {
        postId: req.params.postId,
        status: 1,
      };

      let postComments = await PostComment.find(searchQuery)
        .populate({
          path: 'userId',
          select: 'name userName profilePicture',
        })
        .sort({
          createdAt: -1,
        })
        .lean();

      return __.out(res, 201, {
        data: postComments,
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async sharePost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'postId',
        'wallId',
        'category',
      ]);

      if (requiredResult.status == false)
        return __.out(res, 400, requiredResult.missingFields);

      var postData = await Post.findOne({
        _id: req.body.postId,
      }).lean();

      if (!postData) return __.out(res, 300, 'Invalid post data');

      var wallData = await Wall.findOne({
        _id: req.body.wallId,
      }).lean();

      if (!wallData) return __.out(res, 300, 'Invalid wall data');
      let isUserAuthorized = await __.isUserAuthorized(req, wallData._id);
      if (!isUserAuthorized) return __.out(res, 403, 'Forbidden Access');

      // Parse HTML
      postData.content.title = postData.content.title.replace(
        /<(.|\n)*?>/g,
        ' ',
      );
      postData.content.content = postData.content.content.replace(
        /<(.|\n)*?>/g,
        ' ',
      );

      var insert = {
        wallId: req.body.wallId,
        category: req.body.category,
        title: postData.content.title,
        description: postData.content.content,
        attachments: [],
        author: postData.authorId,
        sharedBy: req.user._id,
        status: 1,
        isShared: true,
        sharedType: 2,
        fromChannel: postData.wallId,
        fromPost: postData._id,
      };

      let sharePost = await new WallPost(insert).save();
      // Update Share Count
      var isCountUpdated = await Post.findOneAndUpdate(
        {
          _id: postData._id,
        },
        {
          $inc: {
            sharedCount: 1,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      return __.out(res, 201, 'Shared successfully');
    } catch (error) {
      __.log(error);
      __.out(res, 500, error);
    }
  }

  async reportComment(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(
        req,
        ['commentId', 'postId'],
        'reportPost',
      );
      if (requiredResult.status == false)
        return __.out(res, 400, requiredResult.missingFields);

      // Check Comment
      let commentData = await PostComment.findOne({
        _id: req.body.commentId,
        postId: req.body.postId,
        status: 1,
      }).populate({
        path: 'postId',
        select: 'channelId',
      });

      if (!commentData) {
        return __.out(res, 300, 'Comment not found');
      }
      // Check Post
      if (req.body.postId !== commentData.postId._id.toString()) {
        return __.out(res, 300, 'Post not found');
      }

      commentData.reportList = commentData.reportList || [];
      // Check Already Reported
      let taskIndex = commentData.reportList.findIndex(
        (x) => x.reportedBy.toString() == req.user._id,
      );
      if (taskIndex > -1) {
        return __.out(res, 300, 'You have already reported this comment');
      }
      // Add Report
      commentData.reportList = [
        ...commentData.reportList,
        ...[
          {
            reportedBy: req.user._id,
          },
        ],
      ];

      await commentData.save();
      return __.out(res, 201, 'Reported successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
}
post = new post();
module.exports = post;
