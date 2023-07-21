const mongoose = require('mongoose'),
  WallPostModel = require('../../models/wallPost'),
  WallCommentModel = require('../../models/wallPostComment'),
  WallModel = require('../../models/wall'),
  ReportCommentModel = require('../../models/reportComment'),
  ReportPostModel = require('../../models/reportPost'),
  // News & Events
  PostComment = require('../../models/channelPostComment'),
  Post = require('../../models/post'),
  Channel = require('../../models/channel'),
  ReportChannelPost = require('../../models/reportChannelPost');

class ReportPost {
  async reportPost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(
        req,
        ['postId'],
        'reportPost',
      );
      if (requiredResult.status == false)
        return __.out(res, 400, requiredResult.missingFields);

      let wallData = await WallPostModel.findOne({
        _id: req.body.postId,
      })
        .populate({
          path: 'wallId',
          select: '_id name',
        })
        .lean();

      if (!wallData) return __.out(res, 300, 'Invalid Wall record');

      let insertReport = {
        postId: req.body.postId,
        userId: req.user._id,
      };

      let isAlreadyReported = await ReportPostModel.find(insertReport).lean();
      if (isAlreadyReported.length > 0) {
        return __.out(res, 300, 'You already reported this post');
      }
      let newReport = await new ReportPostModel(insertReport).save();
      if (!newReport) return __.out(res, 300, 'Error while reporting post');
      var query = {
          _id: req.body.postId,
        },
        update = {
          $inc: {
            reportCount: 1,
          },
        },
        options = {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        };

      // If user is the admin of this wall
      if (req.body.isWallAdmin && req.body.isWallAdmin == true) {
        update.status = 2;
      }

      let isCountUpdated = await WallPostModel.findOneAndUpdate(
        query,
        update,
        options,
      );
      if (!isCountUpdated)
        return __.out(res, 300, 'Error while updating report count');
      return __.out(res, 201, 'Reported successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async reportCommment(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(
        req,
        ['commentId'],
        'reportPost',
      );
      if (requiredResult.status == false)
        return __.out(res, 400, requiredResult.missingFields);

      var query = {
          _id: req.body.commentId,
        },
        update = {
          $inc: {
            reportCount: 1,
          },
        },
        options = {
          upsert: false,
          multi: true,
          new: true,
          setDefaultsOnInsert: true,
        };

      // If user is the admin of this wall
      if (req.body.isWallAdmin && req.body.isWallAdmin == true) {
        update.status = 2;
      }
      let isCountUpdated = await WallCommentModel.findOneAndUpdate(
        query,
        update,
        options,
      );
      if (!isCountUpdated)
        return __.out(res, 300, 'Error while updating report count');

      let insertComment = {
        commentId: isCountUpdated._id,
        userId: req.user._id,
      };

      let isAlreadyReported = await ReportCommentModel.find(
        insertComment,
      ).lean();
      if (isAlreadyReported.length > 0)
        return __.out(res, 300, 'You already reported this comment');

      let newReport = await new ReportCommentModel(insertComment).save();
      if (!newReport) return __.out(res, 300, 'Error while reporting post');

      return __.out(res, 201, 'Reported successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  // Reporting News/Events Comments - Not in use
  async reportChannelComment(req, res) {
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
      __.log(commentData);
      // Check Post
      if (req.body.postId !== commentData.postId._id.toString()) {
        return __.out(res, 300, 'Post not found');
      }

      commentData.reportList = commentData.reportList || [];
      // Check Already Reported
      let reportIndex = commentData.reportList.findIndex(
        (x) => x.reportedBy.toString() == req.user._id,
      );
      if (reportIndex > -1) {
        return __.out(res, 300, 'You have already reported this comment');
      }
      // Add Report
      commentData.reportList.push({
        reportedBy: req.user._id,
      });
      await commentData.save();
      return __.out(res, 201, 'Reported successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  // Report News/Event Post
  async reportChannelPost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(
        req,
        ['postId'],
        'reportPost',
      );

      if (requiredResult.status == false)
        return __.out(res, 400, requiredResult.missingFields);

      let postData = await Post.findOne({
        _id: req.body.postId,
      })
        .populate({
          path: 'channelId',
          select: '_id name',
        })
        .lean();

      if (!postData) return __.out(res, 300, 'Invalid News/Event record');

      let insertReport = {
        postId: req.body.postId,
        userId: req.user._id,
      };
      let isAlreadyReported = await ReportChannelPost.find(insertReport).lean();
      if (isAlreadyReported.length > 0) {
        return __.out(res, 300, 'You already reported this post');
      }

      let newReport = await new ReportChannelPost(insertReport).save();
      if (!newReport) return __.out(res, 300, 'Error while reporting post');

      var query = {
          _id: req.body.postId,
        },
        update = {
          $inc: {
            reportCount: 1,
          },
        },
        options = {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        };

      // If user is the admin of this wall
      if (req.body.isChannelAdmin && req.body.isChannelAdmin == true) {
        update.status = 2;
      }

      let isCountUpdated = await Post.findOneAndUpdate(query, update, options);
      if (!isCountUpdated)
        return __.out(res, 300, 'Error while updating report count');

      return __.out(res, 201, 'Reported successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
}

const reportPost = new ReportPost();
module.exports = reportPost;
