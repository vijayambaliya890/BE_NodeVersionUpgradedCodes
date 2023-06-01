// Controller Code Starts here
const mongoose = require('mongoose'),
  Channel = require('../../models/channel'),
  PostCategory = require('../../models/postCategory'),
  PostComment = require('../../models/channelPostComment'),
  SocialWallModel = require('../../models/wall'),
  UserModel = require('../../models/user'),
  BuilderModule = require('../../models/builderModule'),
  ChannelModel = require('../../models/channel'),
  WallCategoryModel = require('../../models/wallCategory'),
  postLogController = require('./postLogController'),
  ReportChennelPost = require('../../models/reportChannelPost'),
  Question = require('../../models/question'),
  QuestionResponse = require('../../models/questionResponse'),
  socialWallPosts = require('../../models/wallPost.js'),
  { parse } = require('json2csv'),
  fs = require('fs-extra'),
  Post = require('../../models/post'),
  moment = require('moment'),
  _ = require('lodash'),
  __ = require('../../../helpers/globalFunctions');
  const { logInfo, logError } = require('../../../helpers/logger.helper');
  const { AssignUserRead } = require('../../../helpers/assinguserread');

class post {
  async uploadFile(req, res) {
    try {
      return res.success({ path: `${req.file.path.split('public')[1]}` });
    } catch (error) {
      return res.error(error);
    }
  }

  async create(req, res) {
    try {
      let bodyContent = JSON.parse(JSON.stringify(req.body));
      delete bodyContent.teaser;
      delete bodyContent.content;
      delete bodyContent.wallTitle;
      if (!__.checkHtmlContent(bodyContent)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredFields = ['channelId', 'categoryId', 'postType'];

      if (req.body.status !== 2) {
        requiredFields = [
          'channelId',
          'categoryId',
          'teaser',
          'content',
          'publishing',
          'userOptions',
          'postType',
        ];
      }

      let requiredResult = await __.checkRequiredFields(
        req,
        requiredFields,
        'post',
      );
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      if (
        !__.checkSpecialCharacters(
          req.body,
          req.body.postType === 'event' ? 'manageEvent' : 'manageNews',
        )
      ) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }
      /** Parsing Data  */
      if (typeof req.body.teaser === 'string') {
        req.body.teaser = JSON.parse(req.body.teaser);
        req.body.content = JSON.parse(req.body.content);
        req.body.eventDetails = JSON.parse(req.body.eventDetails);
        req.body.publishing = JSON.parse(req.body.publishing);
        req.body.userOptions = JSON.parse(req.body.userOptions);
        if (req.body.postType !== 'news') {
          req.body.wallTitle = JSON.parse(req.body.wallTitle);
        }
      }

      /* Date Conversion */
      if (req.body.publishing.startDate) {
        req.body.publishing.startDate = moment(req.body.publishing.startDate)
          .utc()
          .format();
        req.body.updated = req.body.publishing.startDate;
      }
      if (req.body.publishing.endDate) {
        req.body.publishing.endDate = moment(req.body.publishing.endDate)
          .utc()
          .format();
      }
      if (req.body.eventDetails.startDate) {
        req.body.eventDetails.startDate = moment(
          req.body.eventDetails.startDate,
        )
          .utc()
          .format();
      }
      if (req.body.eventDetails.endDate) {
        req.body.eventDetails.endDate = moment(req.body.eventDetails.endDate)
          .utc()
          .format();
      }
      // Check He has permission to this channel
      req.body.internalApi = true;
      let channelList = await this.getAuthorChannels(req, res);
      let assignedChannelIds = [];
      for (let elem of channelList) {
        assignedChannelIds.push(elem._id);
      }
      if (assignedChannelIds.indexOf(req.body.channelId) == -1) {
        //  return __.out(res, 402, "Unauthorized Channel");
      }
      __.log(req.files, 'req.files');
      // if (req.files && req.files['teaserImage']) {
      //   req.body.teaser['image'] =
      //     'uploads/posts/' + req.files['teaserImage'][0].filename;
      // }
      // if (req.files && req.files['mainImage']) {
      //   req.body.content['image'] =
      //     'uploads/posts/' + req.files['mainImage'][0].filename;
      // }
      req.body.teaser['image'] = req.body.teaserImage || req.body.teaser.image;
      if (req.body.content.isTeaserImage == true) {
        __.log(
          req.body.content.isTeaserImage,
          'req.body.content.isTeaserImage',
        );
        req.body.content['image'] = req.body.teaser['image'];
      } else {
        req.body.content['image'] = req.body.mainImage ||req.body.content.image;
      }
      if (
        req.body.wallTitle &&
        req.body.wallTitle.isTeaserImageForWall == true
      ) {
        __.log(
          req.body.wallTitle.isTeaserImageForWall,
          'req.body.content.isTeaserImageForWall',
        );
        req.body.eventWallLogoImage = req.body.teaser['image'];
      }
      // if (req.files && req.files['eventWallLogoImage']) {
      //   req.body.eventWallLogoImage =
      //     'uploads/posts/' + req.files['eventWallLogoImage'][0].filename;
      // }
      // Create Channel
      let insertPost = {
        channelId: req.body.channelId,
        categoryId: req.body.categoryId,
        teaser: req.body.teaser,
        content: req.body.content,
        eventDetails: req.body.eventDetails,
        publishing: req.body.publishing,
        userOptions: req.body.userOptions,
        postType: req.body.postType,
        status: req.body.status,
        authorId: req.user._id,
        updated: req.body.updated,
      };
      if (req.body.postType == 'event') {
        insertPost.title = req.body.wallTitle.title;
        insertPost.eventWallLogoImage = req.body.eventWallLogoImage;
      }
      // Link Module
      if (req.body.moduleId) {
        let moduleCheck = await BuilderModule.findOne({
          _id: req.body.moduleId,
          createdBy: req.user._id,
          status: 1,
        }).lean();

        if (!moduleCheck) {
          return __.out(res, 300, `Module Not Found`);
        }
        //     // Check module is already linked
        if (1 == insertPost.status) {
          insertPost.notifiedSent = false;
        }
        if (insertPost.status == 1 && req.body.postId) {
          let moduleLinked = await Notification.findOne({
            _id: {
              $nin: [req.body.postId],
            },
            moduleId: req.body.moduleId,
            status: 1,
          }).lean();
          if (moduleLinked) {
            return __.out(res, 300, `Module is already Linked !`);
          }
        }
        insertPost.moduleIncluded = true;
        insertPost.moduleId = req.body.moduleId;
      } else {
        insertPost.moduleIncluded = false;
      }
      let newPost = await new Post(insertPost).save();
      let createEventWall;
      if (req.body.postType == 'event' && req.body.eventCreation == 1) {
        createEventWall = await createWall(insertPost);
        // if (!createEventWall)
        //   return __.out(res, 300, 'Error while creating event wall');

        var newPosupdate = await Post.findOneAndUpdate(
          {
            _id: newPost._id,
          },
          {
            wallId: createEventWall._id,
            wallName: createEventWall.wallName,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        );
        // if (!newPosupdate)
        //   return __.out(res, 300, 'Error while creating event wall');
      }
      let logPost = {
        channelId: req.body.channelId,
        categoryId: req.body.categoryId,
        teaser: req.body.teaser,
        content: req.body.content,
        eventDetails: req.body.eventDetails,
        publishing: req.body.publishing,
        eventBoard: req.body.eventBoard,
        userOptions: req.body.userOptions,
        postType: req.body.postType,
        status: req.body.status,
        authorId: req.user._id,
        logstatus: 1, //created,
        id: newPost._id,
      };

      if (req.body.postType == 'event' && req.body.eventCreation == 1) {
        logPost = {
          ...logPost,
          ...{
            wallId: createEventWall._id,
            wallName: createEventWall.wallName,
          },
        };
      }
      
      await postLogController.create(logPost, res);
      let postType = __.toTitleCase(req.body.postType);
      if (req.files) {
        let output;
        if (req.files['teaserImage']) {
          output = /*await*/ __.scanFile(
            req.files['teaserImage'][0].filename,
            `public/uploads/posts/${req.files['teaserImage'][0].filename}`,
          );
          if (!!output) {
            // return __.out(res, 300, output);
          }
        }
        if (req.files['mainImage']) {
          output = /*await*/ __.scanFile(
            req.files['mainImage'][0].filename,
            `public/uploads/posts/${req.files['mainImage'][0].filename}`,
          );
          if (!!output) {
            // return __.out(res, 300, output);
          }
        }
        if (req.files['eventWallLogoImage']) {
          output = /*await*/ __.scanFile(
            req.files['eventWallLogoImage'][0].filename,
            `public/uploads/posts/${req.files['eventWallLogoImage'][0].filename}`,
          );
          if (!!output) {
            // return __.out(res, 300, output);
          }
        }
      }
      return __.out(res, 201, newPost);
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }

    async function createWall(req) {
      try {
        let channelData = await ChannelModel.findOne({
          _id: req.channelId,
        }).lean();
        if (!channelData) return false;
        // Change author to user key
        channelData.userDetails = channelData.userDetails.map((v) => {
          v.user = v.authors;
          return v;
        });
        // Remove HTML Tags
        var wallTitle = req.title.replace(/<(.|\n)*?>/g, ' ');
        let insertWall = {
          wallName: wallTitle,
          displayType: 1,
          postType: 1,
          isTaskActive: true,
          bannerImage: req.eventWallLogoImage,
          assignUsers: channelData.userDetails,
          companyId: channelData.companyId,
          createdBy: channelData._id,
          eventId: req.content._id,
          wallType: 2,
          status: req.status,
          eventWallStartDate: req.content.eventWallStartDate,
          eventWallEndDate: req.content.eventWallEndDate,
        };
        let newWall = await new SocialWallModel(insertWall).save();
        if (!newWall) {
          return false;
        }
        // Create Category for Wall from the selected event category
        let postCatData = await PostCategory.findOne({
          _id: req.categoryId,
        }).lean();
        let insertWallCat = {
          categoryName: postCatData.name,
          wallId: newWall._id,
        };
        let catId = await new WallCategoryModel(insertWallCat).save();
        newWall.category = [catId._id];
        await newWall.save();
        return newWall;
      } catch (error) {
        return false;
      }
    }
  }

  async update(req, res) {
    try {
      let bodyContent = JSON.parse(JSON.stringify(req.body));
      delete bodyContent.teaser;
      delete bodyContent.content;
      delete bodyContent.wallTitle;
      if (!__.checkHtmlContent(bodyContent)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredFields = ['postId', 'channelId', 'categoryId', 'postType'];
      if (req.body.status != 2) {
        requiredFields = [
          'postId',
          'channelId',
          'categoryId',
          'teaser',
          'content',
          'publishing',
          'userOptions',
          'postType',
        ];
      }
      let requiredResult = await __.checkRequiredFields(
        req,
        requiredFields,
        'post',
      );
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      if (
        !__.checkSpecialCharacters(
          req.body,
          req.body.postType === 'event' ? 'manageEvent' : 'manageNews',
        )
      ) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      /** Parsing Data  */
      if (typeof req.body.teaser === 'string') {
        req.body.teaser = JSON.parse(req.body.teaser);
        req.body.content = JSON.parse(req.body.content);
        req.body.eventDetails = JSON.parse(req.body.eventDetails);
        req.body.publishing = JSON.parse(req.body.publishing);
        req.body.userOptions = JSON.parse(req.body.userOptions);
        if (req.body.postType !== 'news') {
          req.body.wallTitle = JSON.parse(req.body.wallTitle);
        }
      }
      /* Date Conversion */
      __.log(req.body.eventDetails, 'date format');
      if (req.body.publishing.startDate) {
        req.body.publishing.startDate = moment(req.body.publishing.startDate)
          .utc()
          .format();
      }
      if (req.body.publishing.endDate) {
        req.body.publishing.endDate = moment(req.body.publishing.endDate)
          .utc()
          .format();
      }
      if (req.body.eventDetails.startDate) {
        req.body.eventDetails.startDate = moment(
          req.body.eventDetails.startDate,
        )
          .utc()
          .format();
      }
      if (req.body.eventDetails.endDate) {
        req.body.eventDetails.endDate = moment(req.body.eventDetails.endDate)
          .utc()
          .format();
      }

      // Get User's assigned channels
      // let userChannelIds = await __.getUserChannel(req.user);
      let channels = await Channel.find(
        {
          assignUsers: {
            $elemMatch: {
              admin: {
                $in: [req.user._id],
              },
            },
          },
          status: 1,
        },
        {
          _id: 1,
        },
      );

      let userChannelIds = channels.map((c) => c._id);
      let postType = __.toTitleCase(req.body.postType);
      let postData = await Post.findOne({
        _id: req.body.postId,
        channelId: {
          $in: userChannelIds,
        },
        status: {
          $nin: [3],
        },
      });

      if (!postData) {
        return __.out(res, 300, `${postType} Not Found`);
      }

      // if (req.files && req.files['teaserImage']) {
      //   req.body.teaser['image'] =
      //     'uploads/posts/' + req.files['teaserImage'][0].filename;
        req.body.teaser['image'] =req.body.teaserImage || req.body.teaser.image;
        if (req.body.content.isTeaserImage == true) {
          __.log(
            req.body.content.isTeaserImage,
            'req.body.content.isTeaserImage',
          );
          req.body.content['image'] = req.body.teaser['image'];
        } else {
          req.body.content['image'] = req.body.teaser['mainImage'] || req.body.content.image;
        }
        if (
          req.body.wallTitle &&
          req.body.wallTitle.isTeaserImageForWall == true
        ) {
          __.log(
            req.body.wallTitle.isTeaserImageForWall,
            'req.body.content.isTeaserImageForWall',
          );
          req.body.content['eventWallLogoImage'] = req.body.teaser['image'];
        } else {
          req.body.content['eventWallLogoImage'] = req.body.eventWallLogoImage;
        }
      // }
      // if (req.files && req.files['mainImage']) {
      //   req.body.content['image'] =
      //     'uploads/posts/' + req.files['mainImage'][0].filename;
      // }
      // if (req.files && req.files['eventWallLogoImage']) {
      //   req.body.content['eventWallLogoImage'] =
      //     'uploads/posts/' + req.files['eventWallLogoImage'][0].filename;
      //   postData.bannerImage = req.body.content.eventWallLogoImage;
      // }
      // Create Channel
      req.body.teaser.image = req.body.teaser.image || postData.teaser.image;
      req.body.content.image = req.body.content.image || postData.content.image;
      postData.channelId = req.body.channelId;
      postData.categoryId = req.body.categoryId;
      postData.teaser = req.body.teaser;
      postData.content = req.body.content;
      postData.eventDetails = req.body.eventDetails;
      postData.publishing = req.body.publishing;
      postData.userOptions = req.body.userOptions;
      postData.postType = req.body.postType;
      postData.status = req.body.status;
      postData.updated = new Date();
      if (
        !postData.bannerImage &&
        !!req.body.wallTitle &&
        req.body.wallTitle.isTeaserImageForWall == true
      ) {
        console.log('INIT');
        postData.bannerImage = req.body.teaser.image;
      }
      // postData.wallTitle=req.body.wallTitle;
      if (req.body.wallTitle) {
        postData.wallName = req.body.wallTitle.title;
      }
      //  // Link Module
      if (req.body.moduleId) {
        let moduleCheck = await BuilderModule.findOne({
          _id: req.body.moduleId,
          createdBy: req.user._id,
          status: 1,
        }).lean();

        if (!moduleCheck) {
          return __.out(res, 300, `Module Not Found`);
        }
        //     // Check module is already linked
        if (postData.status == 1 && req.body.postId) {
          let moduleLinked = await Post.findOne({
            _id: {
              $nin: [req.body.postId],
            },
            moduleId: req.body.moduleId,
            status: 1,
          }).lean();
          if (moduleLinked) {
            return __.out(res, 300, `Module is already Linked !`);
          }
        }
        postData.moduleIncluded = true;
        postData.moduleId = req.body.moduleId;
      } else {
        postData.moduleIncluded = false;
      }
      if (postData.notifiedSent || bodyContent.isNotifi == 'true') {
        console.log(
          'aaaa',
          typeof bodyContent.isNotifi,
          bodyContent.isNotifi ? false : true,
        );
        postData.notifiedSent = bodyContent.isNotifi == 'true' ? false : true;
      }
      let updatedPost = await postData.save();
      var isWallUpdated;
      if (req.body.postType == 'event') {
        console.log('Ro update Wall here....!');
        isWallUpdated = await updateWall(updatedPost, req.body, postData);
        postData.wallId = isWallUpdated._id;
        postData.save();
      }
      let logPost = {
        channelId: req.body.channelId,
        categoryId: req.body.categoryId,
        teaser: req.body.teaser,
        content: req.body.content,
        eventDetails: req.body.eventDetails,
        publishing: req.body.publishing,
        userOptions: req.body.userOptions,
        postType: req.body.postType,
        status: req.body.status,
        authorId: req.user._id,
        logstatus: 2, //updated
        id:postData._id,
      };
      if (req.body.postType == 'event') {
        logPost = {
          ...logPost,
          ...{
            wallId: updatedPost._id,
            wallName: updatedPost.wallName,
          },
        };
      }

      await postLogController.create(logPost, res);
      if (req.files) {
        let output;
        if (req.files['teaserImage']) {
          output = /*await*/ __.scanFile(
            req.files['teaserImage'][0].filename,
            `public/uploads/posts/${req.files['teaserImage'][0].filename}`,
          );
          if (!!output) {
            // return __.out(res, 300, output);
          }
        }
        if (req.files['mainImage']) {
          output = /*await*/ __.scanFile(
            req.files['mainImage'][0].filename,
            `public/uploads/posts/${req.files['mainImage'][0].filename}`,
          );
          if (!!output) {
            // return __.out(res, 300, output);
          }
        }
        if (req.files['eventWallLogoImage']) {
          output = /*await*/ __.scanFile(
            req.files['eventWallLogoImage'][0].filename,
            `public/uploads/posts/${req.files['eventWallLogoImage'][0].filename}`,
          );
          if (!!output) {
            // return __.out(res, 300, output);
          }
        }
      }
      return __.out(res, 201, updatedPost);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
    // =========>>>>>>>>>>>>>>>>>>>>>>> Update event wall <<<<<<<<<<<<<<<<<<<<<<<<<<<<============

    async function updateWall(req, body, postdata) {
      try {
        let channelData = await ChannelModel.findOne({
          _id: req.channelId,
        }).lean();
        if (!channelData) return false;

        if (req.wallId) {
          console.log('In wall underscore Id');
          // req.wallTitle = req.wallTitle.replace(/<(.|\n)*?>/g, ' ');
          if (!postdata.bannerImage) {
            let newWall = await SocialWallModel.findOneAndUpdate(
              {
                _id: req.wallId,
              },
              {
                $set: {
                  wallName: body.wallTitle.title,
                  isEventWallRequired: body.eventDetails?.isEventWallRequired,
                  // bannerImage: postdata.bannerImage,
                  assignUsers: channelData.userDetails,
                  status: body.status,
                  eventWallStartDate: body.content.eventWallStartDate,
                  eventWallEndDate: body.content.eventWallEndDate,
                },
              },
              {
                new: true,
              },
            );
            return newWall;
          } else {
            let newWall = await SocialWallModel.findOneAndUpdate(
              {
                _id: req.wallId,
              },
              {
                $set: {
                  wallName: body.wallTitle.title,
                  bannerImage: postdata.bannerImage,
                  assignUsers: channelData.userDetails,
                  status: body.status,
                  eventWallStartDate: body.content.eventWallStartDate,
                  eventWallEndDate: body.content.eventWallEndDate,
                  isEventWallRequired: body.eventDetails?.isEventWallRequired,
                },
              },
              {
                new: true,
              },
            );
            return newWall;
          }
        } else {
          let newWall = {
            wallName: body.wallTitle.title,
            bannerImage: postdata.bannerImage,
            assignUsers: channelData.userDetails,
            status: body.status,
            eventWallStartDate: body.content.eventWallStartDate,
            eventWallEndDate: body.content.eventWallEndDate,
            isEventWallRequired: body.eventDetails?.isEventWallRequired,
          };
          let Wall = await new SocialWallModel(newWall).save();
          console.log('NEWWALL: ', Wall);
          return Wall;
        }
      } catch (error) {
        __.log(error);
        return false;
      }
    }
  }

  async remove(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let where = {
        _id: req.params.postId,
        authorId: req.user._id,
        status: {
          $nin: [3],
        },
      };
      var removedPost = await Post.findOne(where);
      if (!removedPost) {
        return __.out(res, 300, 'News/ Event Not Found');
      }
      removedPost.status = 3;
      await removedPost.save();
      return __.out(res, 200, 'News/ Event Deleted');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async readOne(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      let where = {
        _id: req.params.postId,
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
          path: 'categoryId',
          select: '_id name',
        })
        .populate({
          path: 'wallId',
        })
        .lean();

      if (!postData) {
        return __.out(res, 300, 'News/Event Not Found');
      }
      return __.out(res, 201, postData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }
  async getManageNews(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let channelIds = await Channel.find({
        'userDetails.admin': {
          $in: [mongoose.Types.ObjectId(req.user._id)],
        },
      })
        .select('_id')
        .lean();
      let where = {
        status: {
          $nin: [3],
        },
      };
      if (!!channelIds && channelIds.length) {
        where.channelId = {
          $in: channelIds,
        };
      } else {
        return __.out(res, 201, {
          total: 0,
          postList: [],
        });
      }
      if (req.query.postType) {
        where.postType = req.query.postType;
      }
      if (req.query.channelId) {
        where.channelId = req.query.channelId;
      }
      if (req.query.categoryId) {
        where.categoryId = req.query.categoryId;
      }

      // Get Post Filtered List
      var postList = await Post.find(where)
        .populate({
          path: 'authorId',
          select: '_id name parentBussinessUnitId profilePicture',
          populate: {
            path: 'parentBussinessUnitId',
            select: 'name status sectionId',
            populate: {
              path: 'sectionId',
              select: 'name status departmentId',
              populate: {
                path: 'departmentId',
                select: 'name status companyId',
                populate: {
                  path: 'companyId',
                  select: 'name status',
                },
              },
            },
          },
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
          path: 'wallId',
        })
        .sort({
          createdAt: -1,
        })
        .lean();

      postList = postList.filter((post) => {
        return post && post.authorId && post.authorId.name;
      });
      return __.out(res, 201, {
        total: postList.length,
        postList: postList,
      });
    } catch (error) {
      console.log(error);
    }
  }
  async read(req, res) {
    try {
      logInfo('postController::read');
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      // user can manage the
      let channelIds = await AssignUserRead.getUserInAssignedUser(req.user, Channel, 'channel')
      let where = {
        status: {
          $nin: [3],
        },
      };
      // if he is not assigning to any channel return empty
      if (channelIds.length > 0) {
        where.channelId = {
          $in: channelIds,
        };
      } else {
        return __.out(res, 201, {
          total: 0,
          postList: [],
        });
      }

      if (req.query.postType) {
        where.postType = req.query.postType;
      }
      if (req.query.channelId) {
        where.channelId = req.query.channelId;
      }
      if (req.query.categoryId) {
        where.categoryId = req.query.categoryId;
      }

      // Get Post Filtered List
      var postList = await Post.find(where)
        .populate({
          path: 'authorId',
          select: '_id name parentBussinessUnitId profilePicture',
          populate: {
            path: 'parentBussinessUnitId',
            select: 'name status sectionId',
            populate: {
              path: 'sectionId',
              select: 'name status departmentId',
              populate: {
                path: 'departmentId',
                select: 'name status companyId',
                populate: {
                  path: 'companyId',
                  select: 'name status',
                },
              },
            },
          },
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
          path: 'wallId',
        })
        .sort({
          createdAt: -1,
        })
        .lean();

      return __.out(res, 201, {
        total: postList.length,
        postList: postList,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getAuthorChannels(req, res) {
    try {
      let bodyContent = JSON.parse(JSON.stringify(req.body));
      delete bodyContent.teaser;
      delete bodyContent.content;
      delete bodyContent.wallTitle;
      if (!__.checkHtmlContent(bodyContent)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let BussinessUnitIds = await __.getCompanyBU(
        req.user.companyId,
        'subsection',
      );
      let channelIds = await AssignUserRead.getUserInAssignedUser(req.user, Channel, 'channel')
      var channelList = await Channel.find({
        _id: {
          $in: channelIds,
        },
      }).lean();
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
      return __.out(res, 201, {
        total: channelList.length,
        channelList: channelList,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async uploadContentFiles(req, res) {
    try {
      if (!req.file) {
        return __.out(res, 300, `No File is Uploaded`);
      }
      if (
        !req.file.filename.match(
          /\.(tiff|tif|svg|PNG|png|JPEG|jpeg|jpg|gif|txt|pdf|odt|doc|docx|wmv|mpg|mpeg|mp4|avi|3gp|3g2|xlsx|xls|xlr|pptx|ppt|odp|key)$/,
        )
      ) {
        return __.out(
          res,
          300,
          `Please upload this type extension tiff,tif,svg,png,jpeg,jpg,gif,txt,pdf,odt,doc,docx,wmv,mpg,mpeg,mp4,avi,3gp,3g2,xlsx,xls,xlr,pptx,ppt,odp,key `,
        );
      }
      let url = __.serverBaseUrl();
      let filePath = `${url}uploads/posts/${req.file.filename}`;
      const result = /*await*/ __.scanFile(
        req.file.filename,
        `public/uploads/posts/${req.file.filename}`,
      );
      return res.json({
        link: filePath,
        data: { link: filePath },
      });
      // return ({link:filePaths}),__.out(res, 201, {
      //     link: filePath
      // });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  // Get all Posts - Manage Event and Manage News
  async reportedPosts(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let pageNum = req.query.page ? parseInt(req.query.page) : 0;
      let limit = req.query.limit ? parseInt(req.query.limit) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum - 1) * limit;
      // User as admin in chennel
      let searchQuery = {
        companyId: req.user.companyId,
        status: 1,
        userDetails: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      let chennelId = await ChannelModel.find(searchQuery).lean();
      chennelId = chennelId.map((v) => {
        return mongoose.Types.ObjectId(v._id);
      });
      // User as Manage Event and Manage News
      let query = {
        reportCount: {
          $gt: 0,
        },
        'channelId._id': {
          $in: chennelId,
        },
        status: {
          $in: [1, 2],
        },
        postType: req.params.postType,
      };

      var isSearched = false;
      if (req.query.search) {
        isSearched = true;
        query['$or'] = [
          {
            'teaser.title': {
              $regex: `${req.query.search}`,
              $options: 'i',
            },
          },
          {
            'channelId.name': {
              $regex: `${req.query.search}`,
              $options: 'i',
            },
          },
        ];
      }

      let sort = {};
      if (req.query.sortWith) {
        sort[req.query.sortWith] = req.query.sortBy === 'desc' ? -1 : 1;
      }

      let postList = await Post.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'authorId',
            foreignField: '_id',
            as: 'author',
          },
        },
        {
          $unwind: '$author',
        },
        {
          $lookup: {
            from: 'channels',
            localField: 'channelId',
            foreignField: '_id',
            as: 'channelId',
          },
        },
        {
          $unwind: '$channelId',
        },
        {
          $match: query,
        },
        {
          $sort: sort,
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]);

      // Get all post id
      let postIds = postList.map((v) => v._id);
      const reportUsers = await ReportChennelPost.find({
        postId: {
          $in: postIds,
        },
      })
        .populate({
          path: 'userId',
          select: 'name userName profilePicture',
        })
        .lean();
      postList = postList.map((p) => {
        p['userList'] = reportUsers.filter(
          (v) => p._id.toString() == v.postId.toString(),
        );
        return p;
      });
      let totalCount;
      let totalUserCount = await Post.count({
        reportCount: {
          $gt: 0,
        },
        channelId: {
          $in: chennelId,
        },
        status: {
          $in: [1, 2],
        },
      }).lean();
      if (isSearched) {
        totalCount = await Post.aggregate([
          {
            $lookup: {
              from: 'users',
              localField: 'authorId',
              foreignField: '_id',
              as: 'author',
            },
          },
          {
            $unwind: '$author',
          },
          {
            $lookup: {
              from: 'channels',
              localField: 'channelId',
              foreignField: '_id',
              as: 'channelId',
            },
          },
          {
            $unwind: '$channelId',
          },
          {
            $match: query,
          },
        ]);
        totalCount = totalCount.length;
      } else {
        totalCount = totalUserCount;
      }

      let result = {
        draw: req.query.draw || 0,
        recordsTotal: totalUserCount || 0,
        recordsFiltered: totalCount || 0,
        data: postList,
      };
      return res.status(201).json(result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // Get all Posts -
  async reportedComments(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let pageNum = req.query.page ? parseInt(req.query.page) : 0;
      let limit = req.query.limit ? parseInt(req.query.limit) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum - 1) * limit;
      // User as admin in wall
      let searchQuery = {
        companyId: req.user.companyId,
        status: 1,
        userDetails: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      let channelIds = await Channel.find(searchQuery).lean();
      channelIds = channelIds.map((v) => {
        return mongoose.Types.ObjectId(v._id);
      });
      let postIds = await Post.find({
        channelId: {
          $in: channelIds,
        },
        status: 1,
      }).lean();
      postIds = postIds.map((v) => {
        return mongoose.Types.ObjectId(v._id);
      });
      // let query = {
      //   // reportList: {
      //   //     $ne: []
      //   // },
      //   'postId._id': {
      //     $in: postIds,
      //   },
      //   status: {
      //     $in: [1, 2],
      //   },
      // };
      // var isSearched = false;
      // if (req.query.search) {
      //   isSearched = true;
      //   query['$or'] = [
      //     {
      //       comment: {
      //         $regex: `${req.query.search}`,
      //         $options: 'i',
      //       },
      //     },
      //     {
      //       'postId.title': {
      //         $regex: `${req.query.search}`,
      //         $options: 'i',
      //       },
      //     },
      //     {
      //       'wallId.wallName': {
      //         $regex: `${req.query.search}`,
      //         $options: 'i',
      //       },
      //     },
      //   ];
      // }
      // let sort = {};
      // if (req.query.sortWith) {
      //   sort[req.query.sortWith] = req.query.sortBy === 'desc' ? -1 : 1;
      // }

      let resultComment = await this.getComments(postIds, req.query);
      const commentList = resultComment.data.map((v) => {
        let data = {
          _id: v._id,
          comment: v.comment,
          postTitle: v.postId.teaser.title.replace(/<(.|\n)*?>/g, ' '),
          channelName: v.postId.channelId.name,
          reportList: v.reportList.map((j) => {
            return {
              staffId: j['reportedBy'][0].staffId,
              name: j['reportedBy'][0].name,
              reportedAt: j.reportedAt,
            };
          }),
          status: v.status,
        };

        return data;
      });

      let result = {
        draw: req.query.draw || 0,
        recordsTotal: resultComment.count || 0,
        recordsFiltered: resultComment.count || 0,
        data: commentList,
      };
      return res.status(201).json(result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getComments(
    postIds,
    { page, limit, search, sortBy, sortWith, filter },
  ) {
    const searchCondition = search
      ? [
          {
            $match: {
              $or: [
                {
                  comment: { $regex: search, $options: 'i' },
                },
                {
                  'postId.title': { $regex: search, $options: 'i' },
                },
                {
                  'wallId.wallName': { $regex: search, $options: 'i' },
                },
              ],
            },
          },
        ]
      : [];

    const [{ metadata, data }] = await PostComment.aggregate([
      {
        $lookup: {
          from: 'posts',
          localField: 'postId',
          foreignField: '_id',
          as: 'postId',
        },
      },
      {
        $unwind: '$postId',
      },
      {
        $lookup: {
          from: 'channels',
          localField: 'postId.channelId',
          foreignField: '_id',
          as: 'postId.channelId',
        },
      },
      {
        $unwind: '$postId.channelId',
      },
      {
        $unwind: '$reportList',
      },
      {
        $lookup: {
          from: 'users',
          localField: 'reportList.reportedBy',
          foreignField: '_id',
          as: 'reportList.reportedBy',
        },
      },
      {
        $group: {
          _id: '$_id',
          comment: {
            $first: '$comment',
          },
          postId: {
            $first: '$postId',
          },
          reportList: {
            $push: '$reportList',
          },
          status: {
            $first: '$status',
          },
        },
      },
      ...searchCondition,
      {
        $match: {
          'postId._id': {
            $in: postIds,
          },
          status: {
            $in: [1, 2],
          },
        },
      },
      {
        $sort: {
          [sortWith]: sortBy === 'desc' ? -1 : 1,
        },
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            {
              $skip: parseInt(page) - 1,
            },
            {
              $limit: parseInt(limit),
            },
          ],
        },
      },
    ]);

    if (data.length) {
      const [{ total: count }] = metadata;
      return { count, data };
    }
    return { count: 0, data: [] };
  }

  // Get all Update Posts - News and Events
  async updatereviewPost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'postId',
        'status',
      ]);
      if (requiredResult.status == false)
        return __.out(res, 400, requiredResult.missingFields);

      let isUpdated = await Post.update(
        {
          _id: req.body.postId,
        },
        {
          $set: {
            status: req.body.status,
          },
        },
      ).lean();

      if (!isUpdated)
        return __.out(res, 300, 'Oops error while updating status');

      return __.out(res, 201, 'Updated successfully');
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  // Get all Update Posts - News and Events
  async updateCommentStatus(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'postId',
        'status',
      ]);
      if (requiredResult.status == false)
        return __.out(res, 400, requiredResult.missingFields);

      let isUpdated = await PostComment.update(
        {
          _id: req.body.postId,
        },
        {
          $set: {
            status: req.body.status,
          },
        },
      ).lean();
      if (!isUpdated)
        return __.out(res, 300, 'Oops error while updating status');

      return __.out(res, 201, 'Updated successfully');
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async exportPost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      if (!!!req.body._id) {
        return __.out(res, 300, 'Invalid Post');
      }
      const postId = req.body._id;
      const postDetails = await Post.findById(postId)
        .select({
          teaser: 1,
          moduleIncluded: 1,
          moduleId: 1,
          channelId: 1,
        })
        .populate([
          {
            path: 'channelId',
            select: 'userDetails createdBy',
          },
          {
            path: 'moduleId',
            select: 'questions',
            populate: {
              path: 'questions',
            },
          },
        ])
        .lean();
      if (!!!postDetails) {
        return __.out(res, 300, 'Post not found');
      }
      const questionResponses = await QuestionResponse.find({
        postId: postId,
      })
        .populate({
          path: 'userId',
          select:
            'name staffId email appointmentId contactNumber parentBussinessUnitId',
          populate: [
            {
              path: 'appointmentId',
              select: 'name',
            },
            {
              path: 'parentBussinessUnitId',
              select: 'name',
              match: {
                status: 1,
              },
              populate: {
                path: 'sectionId',
                select: 'name',
                populate: {
                  path: 'departmentId',
                  select: 'name',
                  match: {
                    status: 1,
                  },
                  populate: {
                    path: 'companyId',
                    select: 'name',
                    match: {
                      status: 1,
                    },
                  },
                },
              },
            },
          ],
        })
        .lean();
      if (!!questionResponses && questionResponses.length) {
      } else {
        return __.out(res, 300, 'No data found');
      }
      let questions = postDetails.moduleId.questions.map(
        (qestion, i) => `Q-${i}`,
      );
      //postDetails.moduleId.questions
      let rows = [];
      const getOptionValue = (question, response) => {
        if (question.type === 11) {
          return response.answer;
        }
        if (!!response.answer) {
          if (Array.isArray(response.answer)) {
            if (response.answer.length === 1) {
              return response.answer[0].value;
            }
            return response.answer.map((answer) => answer.value).join(',');
          } else {
            return response.answer.value;
          }
        }
        const index = question.options.findIndex(
          (opt) => opt._id.toString() === response.option.toString(),
        );
        if (-1 !== index) {
          return question.options[index].value;
        }
        return '--';
      };
      const getAnswer = (question, response) => {
        let answer = null;
        if (response.answer == '') {
          console.log('kuch nhi');
          switch (question.type) {
            case 1:
            case 8:
            case 9:
            case 13:
              answer = response.answer;
              break;
            case 2:
            case 3:
            case 4:
            case 11:
              answer = getOptionValue(question, response);
              break;
            case 15:
              answer = response.answer.map((a) => a.value).join(', ');
              break;
            case 6:
              answer = '';
              break;
            case 10:
              answer =
                (response.answer.date || '') +
                ' ' +
                (response.answer.time || '');
              break;
            case 12:
              answer = response.answer.name;
              break;
            case 14:
              answer = response.answer.reduce(
                (prev, curr, i) => (prev = prev + ', ' + curr.text),
                '',
              );
              break;
            // response.answer = `${response.answer || ''}`.startsWith(`data:image/png;base64,`) ? response.answer : `data:image/png;base64,${response.answer}`;
            // answer = `<img src="${response.answer}" width="100" height="auto" />`; break;
            default:
              break;
          }
          return !!answer ? answer : '--';
        } else {
          switch (question.type) {
            case 1:
            case 8:
            case 9:
            case 13:
              answer = response.answer;
              break;
            case 2:
            case 3:
            case 4:
            case 11:
              answer = getOptionValue(question, response);
              break;
            case 5:
            case 15:
              answer = response.answer.map((a) => a.value).join(', ');
              break;
            case 6:
              answer = '';
              break;
            case 10:
              answer =
                (response.answer.date || '') +
                ' ' +
                (response.answer.time || '');
              break;
            case 12:
              answer = response.answer.name;
              break;
            case 14:
              answer = response.answer.reduce(
                (prev, curr, i) => (prev = prev + ', ' + curr.text),
                '',
              );
              break;
            // response.answer = `${response.answer || ''}`.startsWith(`data:image/png;base64,`) ? response.answer : `data:image/png;base64,${response.answer}`;
            // answer = `<img src="${response.answer}" width="100" height="auto" />`; break;
            default:
              break;
          }
          return !!answer ? answer : '--';
        }
      };
      //`Q-${i}`
      const userBasesResponses = questionResponses.reduce((prev, curr, i) => {
        prev[curr.userId._id] = prev[curr.userId._id] || [];
        prev[curr.userId._id].push(curr);
        return prev;
      }, {});

      const getQuestionAndAnswer = (userResponse) => {
        if (userResponse.length) {
          let output = postDetails.moduleId.questions.reduce(
            (prev, question, i) => {
              const index = userResponse.findIndex(
                (questionResponse) =>
                  questionResponse.questionId.toString() ===
                  question._id.toString(),
              );
              prev[`Q-${i + 1}`] =
                -1 === index ? '--' : getAnswer(question, userResponse[index]);
              return prev;
            },
            {},
          );
          const user = userResponse[0].userId;
          output['staffId'] = user.staffId;
          output[
            'businessUnit'
          ] = `${user.parentBussinessUnitId.sectionId.departmentId.companyId.name} > ${user.parentBussinessUnitId.sectionId.departmentId.name} > ${user.parentBussinessUnitId.sectionId.name} > ${user.parentBussinessUnitId.name}`;
          const data = postDetails.moduleId.questions.filter(
            (question) => question.type === 7,
          );
          if (data.length) {
            const profile = data[0].profile;
            const internalQuestions = profile.map((iq) =>
              iq.questionName.toLowerCase(),
            );
            internalQuestions.forEach((element) => {
              switch (element) {
                case 'username':
                  output[element] = user.name;
                  questions = [element, ...questions];
                  break;
                case 'appointment':
                  output[element] = user.appointmentId.name;
                  questions = [element, ...questions];
                  break;
                case 'mobile':
                  output[element] = user.contactNumber;
                  questions = [element, ...questions];
                  break;
                case 'email':
                  output[element] = user.email;
                  questions = [element, ...questions];
                  break;
                default:
                  break;
              }
            });
          }
          const set = new Set(['staffId', 'businessUnit', ...questions]);
          questions = Array.from(set);
          return output;
        }
        return {};
      };
      for (const user in userBasesResponses) {
        if (userBasesResponses.hasOwnProperty(user)) {
          const element = userBasesResponses[user];
          rows[rows.length] = getQuestionAndAnswer(element);
        }
      }
      if (rows.length) {
        const fields = questions;
        const opts = { fields };
        var csv = parse(rows, opts);
        fs.writeFile(
          `./public/uploads/Postexport/${postId}.csv`,
          csv,
          (err) => {
            if (err) {
              __.log('json 2 csv err', err);
              return __.out(res, 300, 'Something went wrong try later');
            } else {
              return __.out(res, 201, {
                csvLink: `uploads/Postexport/${postId}.csv`,
              });
            }
          },
        );
      } else {
        return __.out(res, 300, 'Something went wrong try later');
      }
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Export the Wallpost..
  async exportWallData(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      //  let wallsdata =[];
      let jsonArray = [];
      var wallDetails = await SocialWallModel.findById(req.body._id).populate({
        path: 'createdBy',
        select: '_id name staffId',
      });
      const wallPosts = await socialWallPosts
        .find({ wallId: wallDetails._id })
        .select('title description likesCount createdAt author')
        .populate([
          {
            path: 'author',
            select: '_id name staffId',
          },
          {
            path: 'nomineeUsers',
            select: 'name staffId',
          },
        ])
        .lean();
      console.log('wallDetails: ', wallPosts);
      if (wallPosts.length > 0) {
        for (let i = 0; i <= wallPosts.length - 1; i++) {
          var date = moment(wallPosts[i].createdAt).format('D MMM, YYYY');
          let wall = {
            'Date Of creation': date,
            'Created By Staff Id': wallPosts[i].author.staffId,
            'Created By StaffName': wallPosts[i].author.name,
            'Posting Title': wallPosts[i].title,
            'Posting Content': wallPosts[i].description,
            'No of Likes': wallPosts[i].likesCount,
            'Nomination Names': '',
          };
          if (
            wallPosts[i].nomineeUsers &&
            wallPosts[i].nomineeUsers.length > 0
          ) {
            for (let j = 0; j <= wallPosts[i].nomineeUsers.length - 1; j++) {
              if (j == wallPosts[i].nomineeUsers.length - 1) {
                wall['Nomination Names'] =
                  wall['Nomination Names'] +
                  wallPosts[i].nomineeUsers[j].name +
                  ' (' +
                  wallPosts[i].nomineeUsers[j].staffId +
                  ')';
              } else {
                wall['Nomination Names'] =
                  wall['Nomination Names'] +
                  wallPosts[i].nomineeUsers[j].name +
                  ' (' +
                  wallPosts[i].nomineeUsers[j].staffId +
                  ')' +
                  ' , ';
              }
            }
          }
          jsonArray.push(wall);
        }
      }
      //  console.log("wallDetailsWALL: ",wall);
      if (wallDetails == null) {
        return __.out(res, 300, 'Wall not found');
      } else {
        var csvLink = '',
          fieldsArray = [
            'Date Of creation',
            'Created By Staff Id',
            'Created By StaffName',
            'Posting Title',
            'Posting Content',
            'No of Likes',
            'Nomination Names',
          ];

        // fieldsArray = [...fieldsArray, ...wallsdata];
        console.log('FILD:', fieldsArray);
        if (jsonArray.length !== 0) {
          const fields = fieldsArray;
          const opts = { fields };
          var csv = parse(jsonArray, opts);
          let fileName = wallDetails.wallName;
          console.log('FILENAME IS: ', fileName);
          fileName = fileName.split(' ').join('_');
          fs.writeFile(`./public/uploads/wall/${fileName}.csv`, csv, (err) => {
            if (err) {
              __.log('json 2 csv err' + err);
              __.out(res, 500);
            } else {
              csvLink = `uploads/wall/${fileName}.csv`;

              __.out(res, 201, {
                csvLink: csvLink,
              });
            }
          });
        } else {
          // __.out(res, 201, {
          //     csvLink: csvLink
          // });
          __.out(res, 404, {
            status: 0,
            message: 'No posts in Exported Board',
          });
        }
      }
    } catch (e) {
      __.log(e);
      __.out(res, 500);
    }
  }

  async getAllNews(req, res) {
    try {
      let channels = await Channel.find(
        {
          assignUsers: {
            $elemMatch: {
              admin: {
                $in: [req.user._id],
              },
            },
          },
          status: 1,
        },
        {
          _id: 1,
        },
      );

      let channelIds = channels.map((c) => c._id);

      let where = {
        // status: {
        //   $nin: [2],
        // },
      };
      if (!!channelIds && channelIds.length) {
        where.channelId = {
          $in: channelIds,
        };
      } else {
        return res.success({ postList: [] });
      }

      if (req.query.postType) {
        where.postType = req.query.postType;
      }
      if (req.query.channelId) {
        where.channelId = req.query.channelId;
      }
      if (req.query.categoryId) {
        where.categoryId = req.query.categoryId;
      }

      let postList = await this.getPostList(where, req.query);

      return res.success(postList);
    } catch (e) {
      return res.error();
    }
  }
  async getPostList(condition, { page, limit, sortBy, sortWith, search }) {
    if (search) {
      condition['$or'] = [
        {
          'teaser.title': {
            $regex: `${search}`,
            $options: 'i',
          },
        },
        {
          'channelId.name': {
            $regex: `${search}`,
            $options: 'i',
          },
        },
      ];
    }
    const count = await Post.countDocuments(condition);
    const data = await Post.find(condition)
      .populate({
        path: 'authorId',
        select: 'name orgName parentBussinessUnitId profilePicture',
        populate: {
          path: 'parentBussinessUnitId',
          select: 'orgName name status sectionId',
          populate: {
            path: 'sectionId',
            select: 'name status departmentId',
            populate: {
              path: 'departmentId',
              select: 'name status companyName',
            },
          },
        },
      })
      .populate({
        path: 'channelId',
        select: 'name logo',
      })
      .populate({
        path: 'categoryId',
        select: 'name',
      })
      .populate({
        path: 'moduleId',
        select: 'moduleName',
      })
      .populate({
        path: 'wallId',
      })
      .sort({
        createdAt: -1,
      })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .sort({
        [sortWith]: sortBy === 'desc' ? -1 : 1,
      })
      .lean();

    return { count, data };
  }

  async readOnePost(req, res) {
    try {
      const postId = req.params.postId;
      let postData = await this.readPost({
        _id: postId,
      });

      if (!postData) return res.badRequest('News/Event Not Found');

      let adminIds;

      if (postData[0].postType == 'event') {
        adminIds = postData[0].sessions[0]
          ? postData[0].sessions[0].adminIds
          : [];
      }

      // let moduleData
      // if(postData[0].moduleId){
      //     moduleData = postData[0].moduleId
      // }

      let wallData = {};

      console.log(postData[0].wallId);

      if (postData[0].wallId) {
        wallData.endDate = postData[0].wallId.eventWallEndDate;
        wallData.eventWallLogoImage = postData[0].wallId.bannerImage,
        wallData.startDate = postData[0].wallId.eventWallStartDate,
        wallData.wallName = postData[0].wallName;
        wallData.isEventWallRequired = postData[0].wallId.isEventWallRequired;
      }

      const data = {
        _id: postData[0]._id,
        postType: postData[0].postType,
        content: {
          address: postData[0].eventDetails.address,
          content: postData[0].content.content,
          endDate: postData[0].eventDetails.endDate,
          eventType: postData[0].eventDetails.eventType,
          image: postData[0].content.image,
          isTeaserImage: postData[0].content.isTeaserImage,
          organizerName: postData[0].eventDetails.organizerName,
          startDate: postData[0].eventDetails.startDate,
          title: postData[0].content.title,
          isEventWallRequired: postData[0].eventDetails.isEventWallRequired,
        },
        teaser: postData[0].teaser,
        eventBoard: wallData,
        publish: {
          categoryId: postData[0].categoryId,
          channelId: postData[0].channelId,
          moduleId: postData[0].moduleId,
          endDate: postData[0].publishing.endDate,
          isRSVPRequired: postData[0].eventDetails.isRSVPRequired,
          startDate: postData[0].publishing.startDate,
        },
        session: {
          isLimitRequired: postData[0].eventDetails.isLimitRequired,
          isAttendanceRequired: postData[0].eventDetails.isAttendanceRequired,
          totalAttendanceTaking: postData[0].eventDetails.totalAttendanceTaking,
          Rows: postData[0].sessions,
          maxNoRSVP: postData[0].eventDetails.maxNoRSVP,
          isLimitRSVP: postData[0].eventDetails.isLimitRSVP,
        },
        admin: adminIds,
        status: postData[0].status,
        authorId: postData[0].authorId,
      };

      return res.success(data);
    } catch (error) {
      return res.error(error);
    }
  }

  async readPost(condition) {
    return await Post.find({
      ...condition,
    })
      .populate({
        path: 'authorId',
        select: 'name profilePicture parentBussinessUnitId',
        populate: {
          path: 'parentBussinessUnitId',
          select: 'orgName',
        },
      })
      .populate({
        path: 'channelId',
        select: 'name',
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
      .populate({
        path: 'sessions',
        select:
          'startDate startTime endDate endTime attendaceRequiredCount totalParticipantPerSession location status adminIds',
        populate: {
          path: 'adminIds',
          select: 'name',
        },
      })
      .lean();
  }
}
post = new post();
module.exports = post;
