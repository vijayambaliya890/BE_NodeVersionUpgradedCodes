// Controller Code Starts here
const mongoose = require('mongoose'),
  moment = require('moment'),
  path = require('path'),
  QuestionModuleController = require('../common/questionModuleController'),
  Notification = require('../../models/notification'),
  BuilderModule = require('../../models/builderModule'),
  Question = require('../../models/question'),
  QuestionResponse = require('../../models/questionResponse'),
  TrackedQuestion = require('../../models/trackUserQns'),
  User = require('../../models/user'),
  FCM = require('../../../helpers/fcm'),
  json2csv = require('json2csv').parse,
  mime = require('mime-types'),
  fs = require('fs-extra'),
  _ = require('lodash'),
  __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class notification {
  async create(req, res) {
    try {
      __.log(req.body);
      // let reqFields = ['businessUnitId', 'subCategoryId', 'effectiveFrom', 'activeFrom', 'activeTo', 'title', 'subTitle', 'description', 'isDynamic', 'status'];
      let reqFields = ['title'];
      let requiredResult = await __.checkRequiredFields(
        req,
        reqFields,
        'notification',
      );
      if (!__.checkSpecialCharacters(req.body, 'notification')) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        var insert = req.body;
        insert.createdBy = req.user._id;
        // Remove the keys while updating
        var unSetKeys = [];
        insert.subTitle = insert.subTitle || '';
        insert.description = insert.description || '';
        if (insert.activeFrom) {
          insert.activeFrom = moment(insert.activeFrom, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format();
        } else {
          unSetKeys.push('activeFrom');
        }
        if (insert.activeTo) {
          insert.activeTo = moment(insert.activeTo, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format();
        } else {
          unSetKeys.push('activeTo');
        }
        if (insert.effectiveFrom) {
          insert.effectiveFrom = moment(
            insert.effectiveFrom,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .format();
        }
        // else {
        //     unSetKeys.push("effectiveFrom");
        // }
        if (insert.effectiveTo) {
          insert.effectiveTo = moment(
            insert.effectiveTo,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .format();
        } else {
          unSetKeys.push('effectiveTo');
        }

        if (req.file) {
          insert.notificationAttachment = req.file.path.substring(6);
        }

        insert.assignUsers = insert.assignUsers || [];
        let userIds = await __.notificUsersList(insert);
        if (userIds.length == 0 && insert.status == 1) {
          return __.out(res, 300, `No users found to send this notification`);
        }
        insert.notifyOverAllUsers = userIds;
        insert.notifyUnreadUsers = userIds;
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

          // Check module is already linked
          if (insert.status == 1 && req.body.notificationId) {
            let moduleLinked = await Notification.findOne({
              _id: {
                $nin: [req.body.notificationId],
              },
              moduleId: req.body.moduleId,
              status: 1,
            }).lean();
            if (moduleLinked) {
              return __.out(res, 300, `Module is already Linked !`);
            }
          }
          insert.moduleIncluded = true;
          insert.moduleId = req.body.moduleId;
        } else {
          insert.moduleIncluded = false;
          delete insert.moduleId;
          unSetKeys.push('moduleId');
        }
        // Update draft
        if (req.body.notificationId) {
          // Remove the existing values
          let updateNoti = {
            $set: insert,
          };
          if (unSetKeys.length > 0) {
            let unsetQuery = {};
            for (let key of unSetKeys) {
              unsetQuery[key] = 1;
            }
            updateNoti['$unset'] = unsetQuery;
          }
          await Notification.findOneAndUpdate(
            {
              _id: insert.notificationId,
            },
            updateNoti,
          );
        } else {
          var insertedNotification = await new Notification(insert).save();
        }
        __.out(
          res,
          201,
          `Notification has been created successfully for ${
            userIds.length || ''
          } users`,
        );
        if (req.file) {
          const output = /*await*/ __.scanFile(
            req.file.filename,
            `public/uploads/notificationAttachment/${req.file.filename}`,
          );
          if (!!output) {
            // return __.out(res, 300, output);
          }
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async read(req, res) {
    try {
      logInfo('read notification called');
      let requiredResult1 = await __.checkRequiredFields(req, [
        'businessUnitId',
      ]);
      if (requiredResult1.status === false) {
        return __.out(res, 400, requiredResult1.missingFields);
      }
      var whereData = {
        businessUnitId: req.body.businessUnitId,
      };
      logInfo('read notification called', whereData);
      var notificationDetails = await this.getNotificationDetails(
        whereData,
        req.query,
      );
      return __.out(res, 201, notificationDetails);
    } catch (err) {
      logError('read notification has error', err);
      logError('read notification has error.stack', err.stack);
      return __.out(res, 500);
    }
  }
  async update(req, res) {
    try {
      // let reqFields = ['businessUnitId', 'subCategoryId', 'effectiveFrom', 'activeFrom', 'activeTo', 'title', 'subTitle', 'description', 'isDynamic', 'status'];
      let reqFields = ['notificationId'];
      let requiredResult = await __.checkRequiredFields(
        req,
        reqFields,
        'notification',
      );
      if (!__.checkSpecialCharacters(req.body, 'notification')) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        var insert = req.body;
        insert.createdBy = req.user._id;
        insert.isSent = 0;
        // Remove the keys while updating
        var unSetKeys = [];
        // insert.subTitle = insert.subTitle || '';
        // insert.description = insert.description || '';
        if (insert.activeFrom) {
          insert.activeFrom = moment(insert.activeFrom, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format();
        } else {
          unSetKeys.push('activeFrom');
        }
        if (insert.activeTo) {
          insert.activeTo = moment(insert.activeTo, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format();
        } else {
          unSetKeys.push('activeTo');
        }
        // if (insert.effectiveFrom) {
        //     insert.effectiveFrom = moment(insert.effectiveFrom, 'MM-DD-YYYY HH:mm:ss Z').utc().format();
        // } else {
        //     unSetKeys.push("effectiveFrom");
        // }
        // if (insert.effectiveTo) {
        //     insert.effectiveTo = moment(insert.effectiveTo, 'MM-DD-YYYY HH:mm:ss Z').utc().format();
        // } else {
        //     unSetKeys.push("effectiveTo");
        // }
        if (req.file) {
          insert.notificationAttachment = req.file.path.substring(6);
        }
        insert.assignUsers = insert.assignUsers || [];
        let userIds = await __.notificUsersList(insert);
        insert.notifyOverAllUsers = userIds;
        insert.notifyUnreadUsers = userIds;
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

          if (insert.status == 1) {
            let moduleLinked = await Notification.findOne({
              _id: {
                $nin: [req.body.notificationId],
              },
              moduleId: req.body.moduleId,
              status: 1,
            }).lean();
            if (moduleLinked) {
              return __.out(res, 300, `Module is already Linked !`);
            }
          }
          insert.moduleIncluded = true;
          insert.moduleId = req.body.moduleId;
        } else {
          insert.moduleIncluded = false;
          unSetKeys.push('moduleId');
        }

        // Remove the existing values
        let updateNoti = {
          $set: insert,
        };
        if (unSetKeys.length > 0) {
          let unsetQuery = {};
          for (let key of unSetKeys) {
            unsetQuery[key] = 1;
          }
          updateNoti['$unset'] = unsetQuery;
        }

        await Notification.findOneAndUpdate(
          {
            _id: insert.notificationId,
          },
          updateNoti,
        );

        __.out(
          res,
          201,
          `Notification has been Updated successfully for ${
            userIds.length || ''
          } users`,
        );
        if (req.file) {
          const output = /*await*/ __.scanFile(
            req.file.filename,
            `public/uploads/notificationAttachment/${req.file.filename}`,
          );
          if (!!output) {
            // return __.out(res, 300, output);
          }
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async myNotifications(req, res) {
    try {
      logInfo('myNotifications has called', req.user._id);
      var data = {
        userId: req.user._id,
      };
      var myNotifications = await this.userNotifications(data, res);
      __.out(res, 201, myNotifications);
    } catch (err) {
      logError('myNotifications has error', err);
      __.out(res, 500);
    }
  }

  async unReadNotifications(req, res) {
    try {
      var data = {
        userId: req.user._id,
      };
      var results = await this.myNotificationsRead(data, new Date(), req.query);

      // Add Mimetype for attached files
      for (let index in results.data) {
        if (results.data[index].notificationAttachment) {
          let attachMimeType = await mime.contentType(
            path.extname(results.data[index].notificationAttachment),
          );
          results.data[index].mimeType = attachMimeType;
        }
      }

      return res.success(results);
    } catch (error) {
      return res.error(error);
    }
  }

  async myNotificationsRead(
    condition,
    date,
    { page, limit, search, sortBy, sortWith },
  ) {
    const searchCondition = !!search
      ? { title: { $regex: search, $options: 'i' } }
      : {};
    const [{ metadata, data }] = await Notification.aggregate([
      {
        $match: {
          status: 1,
          notifyOverAllUsers: mongoose.Types.ObjectId(condition.userId),
          activeFrom: {
            $lte: new Date(),
          },
          activeTo: {
            $gte: new Date(),
          },
          ...searchCondition,
        },
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subCategoryId',
          foreignField: '_id',
          as: 'subCategory',
        },
      },
      {
        $unwind: '$subCategory',
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'subCategory.categoryId',
          foreignField: '_id',
          as: 'subCategory.categoryId',
        },
      },
      {
        $unwind: '$subCategory.categoryId',
      },
      {
        $project: {
          effectiveFrom: 1,
          effectiveTo: 1,
          activeFrom: 1,
          activeTo: 1,
          title: 1,
          subTitle: 1,
          description: 1,
          notificationAttachment: 1,
          subCategory: 1,
          isAcknowledged: {
            $setIsSubset: [
              [mongoose.Types.ObjectId(condition.userId)],
              '$notifyAcknowledgedUsers',
            ],
          },
          moduleIncluded: 1,
          moduleId: 1,
          viewOnly: 1,
        },
      },
      {
        $sort: { [sortWith]: sortBy === 'desc' ? -1 : 1 },
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            {
              $skip: (Number(page) - 1) * Number(limit),
            },
            {
              $limit: Number(limit),
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

  async acknowledgedNotifications(req, res) {
    try {
      var data = {
        userId: req.user._id,
      };
      var results = await this.acknowledgedNotificationsRead(
        data,
        new Date(),
        req.query,
      );

      // Add Mimetype for attached files
      for (let index in results) {
        if (results[index].notificationAttachment) {
          let attachMimeType = mime.contentType(
            path.extname(results[index].notificationAttachment),
          );
          results[index].mimeType = attachMimeType;
        }
      }

      return res.success(results);
    } catch (error) {
      return res.error(error);
    }
  }

  async acknowledgedNotificationsRead(
    condition,
    date,
    { page, limit, search, sortBy, sortWith },
  ) {
    const searchCondition = !!search
      ? { title: { $regex: search, $options: 'i' } }
      : {};

    const [{ metadata, data }] = await Notification.aggregate([
      {
        $match: {
          status: 1,
          notifyOverAllUsers: mongoose.Types.ObjectId(condition.userId),
          activeFrom: {
            $lte: date,
          },
          activeTo: {
            $gte: date,
          },
          notifyAcknowledgedUsers: {
            $in: [condition.userId],
          },
          ...searchCondition,
        },
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subCategoryId',
          foreignField: '_id',
          as: 'subCategory',
        },
      },
      {
        $unwind: '$subCategory',
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'subCategory.categoryId',
          foreignField: '_id',
          as: 'subCategory.categoryId',
        },
      },
      {
        $unwind: '$subCategory.categoryId',
      },
      {
        $project: {
          effectiveFrom: 1,
          effectiveTo: 1,
          activeFrom: 1,
          activeTo: 1,
          title: 1,
          subTitle: 1,
          description: 1,
          notificationAttachment: 1,
          subCategory: 1,
          isAcknowledged: {
            $setIsSubset: [
              [mongoose.Types.ObjectId(condition.userId)],
              '$notifyAcknowledgedUsers',
            ],
          },
          moduleIncluded: 1,
          moduleId: 1,
          viewOnly: 1,
        },
      },
      {
        $sort: { [sortWith]: sortBy === 'desc' ? -1 : 1 },
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            {
              $skip: (Number(page) - 1) * 10,
            },
            {
              $limit: Number(limit),
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

  async userNotifications(data, res) {
    try {
      logInfo('userNotifications has called', data);
      var results = await Notification.aggregate([
        {
          $match: {
            status: 1,
            notifyOverAllUsers: mongoose.Types.ObjectId(data.userId),
            activeFrom: {
              $lte: new Date(),
            },
            activeTo: {
              $gte: new Date(),
            },
          },
        },
        {
          $lookup: {
            from: 'subcategories',
            localField: 'subCategoryId',
            foreignField: '_id',
            as: 'subCategory',
          },
        },
        {
          $unwind: '$subCategory',
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'subCategory.categoryId',
            foreignField: '_id',
            as: 'subCategory.categoryId',
          },
        },
        {
          $unwind: '$subCategory.categoryId',
        },
        {
          $project: {
            _id: 1,
            effectiveFrom: 1,
            effectiveTo: 1,
            activeFrom: 1,
            activeTo: 1,
            title: 1,
            subTitle: 1,
            description: 1,
            notificationAttachment: 1,
            subCategory: 1,
            isAcknowledged: {
              $setIsSubset: [
                [mongoose.Types.ObjectId(data.userId)],
                '$notifyAcknowledgedUsers',
              ],
            },
            moduleIncluded: 1,
            moduleId: 1,
            viewOnly: 1,
          },
        },
      ]);

      // Add Mimetype for attached files
      for (let index in results) {
        if (results[index].notificationAttachment) {
          let attachMimeType = mime.contentType(
            path.extname(results[index].notificationAttachment),
          );
          results[index].mimeType = attachMimeType;
        }
        if (!results[index].moduleIncluded) {
          results[index].questionsCompleted = true;
        } else if (results[index].moduleIncluded && !!results[index].moduleId) {
          results[index].questionsCompleted = await this.allTrackedAnswered(
            res,
            {
              userId: data.userId,
              notificationId: results[index]._id,
            },
          );
        }
      }
      return results;
    } catch (e) {
      logError('userNotifications has error', e);
      logError('userNotifications has error', e.stack);
      return [];
    }
  }

  async viewAllNotification(req, res) {
    try {
      var condition = { businessUnitId: req.params.businessUnitId };
      var notificationDetails = await this.getAllNotifications(
        condition,
        req.query,
      );
      return res.success(notificationDetails);
    } catch (error) {
      return res.error(error);
    }
  }
  async getAllNotifications(
    condition,
    { page, limit, sortBy, sortWith, search },
  ) {
    let searchCondition = {};
    if (search) {
      searchCondition['title'] = new RegExp(search, 'i');
    }

    const count = await Notification.countDocuments({
      ...condition,
      ...searchCondition,
    });

    const data = await Notification.find({
      ...condition,
      ...searchCondition,
    })
      .populate([
        {
          path: 'subCategoryId',
          select: 'name categoryId',
          populate: {
            path: 'categoryId',
            select: 'name',
          },
        },
        {
          path: 'businessUnitId',
          select: 'name status orgName',
          match: {
            status: 1,
          },
          populate: {
            path: 'sectionId',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'departmentId',
              select: 'name status companyName',
              match: {
                status: 1,
              },
            },
          },
        },
        {
          path: 'notifyOverAllUsers',
          select: 'name staffId',
        },
        {
          path: 'notifyAcknowledgedUsers',
          select: 'name staffId',
        },
        {
          path: 'notifyUnreadUsers',
          select: 'name staffId',
        },
        {
          path: 'assignUsers.businessUnits',
          select: 'name status sectionId orgName',
          populate: {
            path: 'sectionId',
            select: 'name status departmentId',
            populate: {
              path: 'departmentId',
              select: 'name status companyName',
            },
          },
        },
        {
          path: 'assignUsers.appointments',
          select: 'name',
        },
        {
          path: 'assignUsers.user',
          select: 'name staffId',
        },
      ])
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ [sortWith]: sortBy === 'desc' ? -1 : 1 })
      .lean();

    return { count, data };
  }

  async getNotificationDetails(whereData, query) {
    try {
      logInfo('read getNotificationDetails called', whereData);
      let { sortBy, sortWith, page, limit, search } = query;
      const pageNum = !!page ? parseInt(page) : 0;
      limit = !!limit ? parseInt(limit) : 10;
      const skip = (pageNum - 1) / limit;
      if (search) {
        whereData.title = {
          $regex: search,
          $options: 'ixs',
        };
      }
      const [data, count] = await Promise.all([
        Notification.find(whereData)
          .sort({ [sortWith]: sortBy === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(limit)
          .populate([
            {
              path: 'subCategoryId',
              select: 'name categoryId',
              populate: {
                path: 'categoryId',
                select: 'name',
              },
            },
            {
              path: 'businessUnitId',
              select: 'name status orgName',
              match: {
                status: 1,
              },
              // populate: {
              //   path: 'sectionId',
              //   select: 'name status',
              //   match: {
              //     status: 1,
              //   },
              //   populate: {
              //     path: 'departmentId',
              //     select: 'name status',
              //     match: {
              //       status: 1,
              //     },
              //     populate: {
              //       path: 'companyId',
              //       select: 'name status',
              //       match: {
              //         status: 1,
              //       },
              //     },
              //   },
              // },
            },
            {
              path: 'notifyByBusinessUnits',
              strictPopulate: false,
              select: 'name status',
              match: {
                status: 1,
              },
              populate: {
                path: 'sectionId',
                select: 'name status',
                match: {
                  status: 1,
                },
                populate: {
                  path: 'departmentId',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                  populate: {
                    path: 'companyId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                  },
                },
              },
            },
            {
              path: 'notifyBySubSkillSets',
              select: 'name status',
              strictPopulate: false,
              match: {
                status: 1,
              },
              populate: {
                path: 'skillSetId',
                select: 'name status',
                match: {
                  status: 1,
                },
              },
            },
            {
              path: 'notifyByAppointments',
              select: 'name status',
              strictPopulate: false,
              match: {
                status: 1,
              },
            },
            {
              path: 'notifyByUsers',
              strictPopulate: false,
              select: 'name staffId',
            },
            {
              path: 'notifyOverAllUsers',
              select: 'name staffId',
              match: { status: 1 },
            },
            {
              path: 'notifyAcknowledgedUsers',
              select: 'name staffId',
              match: { status: 1 },
            },
            {
              path: 'notifyUnreadUsers',
              select: 'name staffId',
              match: { status: 1 },
            },
            {
              path: 'assignUsers.businessUnits',
              select: 'name status sectionId orgName',
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
            {
              path: 'assignUsers.appointments',
              select: 'name',
            },
            {
              path: 'assignUsers.subSkillSets',
              select: 'name status',
              match: {
                status: 1,
              },
              populate: {
                path: 'skillSetId',
                select: 'name status',
                match: {
                  status: 1,
                },
              },
            },
            {
              path: 'assignUsers.user',
              select: 'name staffId',
            },
          ])
          .lean(),
        Notification.countDocuments(whereData),
      ]);
      return { data, count };
    } catch (e) {
      logError('getNotificationDetails has error', e);
      logError('getNotificationDetails has error.stack', e.stack);
      return [];
    }
  }
  async addUserToDynamicNotifications(data, res) {
    let notificationIds = await __.getUserNotification(data.userData);
    // If no notifications found
    if (notificationIds.length == 0) {
      return true;
    }
    var matchedNotifications = await Notification.find({
      // notifyOverAllUsers: {
      //     $ne: data.userId
      // },
      _id: {
        $in: notificationIds,
      },
      status: 1,
      isDynamic: 1,
      activeTo: {
        $gte: moment().utc().format(),
      },
    }).lean();

    var matchedNotificationsIds = matchedNotifications.map((x) => x._id);
    var update = await Notification.update(
      {
        _id: {
          $in: matchedNotificationsIds,
        },
      },
      {
        $addToSet: {
          notifyOverAllUsers: data.userId,
          notifyUnreadUsers: data.userId,
        },
      },
      {
        multi: true,
      },
    );

    if (data.deviceToken) {
      for (let eachNotification of matchedNotifications) {
        var pushData = {
            title: eachNotification.title,
            body: eachNotification.description,
            redirect: 'notifications',
          },
          collapseKey = eachNotification._id;
        FCM.push(data.deviceToken, pushData, collapseKey);
      }
    }
    return true;
  }
  async acknowledge(req, res) {
    try {
      logInfo('acknowledge API has called');
      let requiredResult = await __.checkRequiredFields(req, [
        'notificationId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      var data = {
        userId: req.user._id,
        notificationId: req.body.notificationId,
      };
      logInfo('acknowledge API has called by', data);
      if (req.body.qnsresponses) {
        data.user = req.user;
        data.qnsresponses = req.qnsresponses;
      }
      this.userAcknowledge(data, res);
    } catch (err) {
      logError('acknowledge API has error', err);
      logError('acknowledge API has error.stack', err.stack);
      return __.out(res, 500);
    }
  }
  async userAcknowledge(data, res) {
    try {
      logInfo('userAcknowledge has called', data);
      var notificationDetails = await Notification.findOne({
        _id: data.notificationId,
        status: 1,
      });
      if (!notificationDetails) {
        return __.out(res, 300, 'Invalid notification');
      }
      var isValidUser = await notificationDetails.notifyOverAllUsers.some(
        (x) => {
          let y = _.isEqual(x, data.userId);
          return y;
        },
      );
      if (!isValidUser) {
        return __.out(res, 300, 'Invalid user');
      }
      var isAcknowledged =
        await notificationDetails.notifyAcknowledgedUsers.some((x) => {
          let y = _.isEqual(x, data.userId);
          return y;
        });

      if (isAcknowledged) {
        return __.out(res, 300, 'Already acknowledged to this notification');
      }

      await Notification.updateOne(
        {
          _id: data.notificationId,
        },
        {
          $addToSet: {
            notifyAcknowledgedUsers: data.userId,
          },
          $push: {
            userAcknowledgedAt: moment().utc().format(),
          },
          $pull: {
            notifyUnreadUsers: data.userId,
          },
        },
      );
      return __.out(
        res,
        201,
        'Notification has been successfully acknowledged',
      );
    } catch (err) {
      logError('userAcknowledge has error', err);
      logError('userAcknowledge has error.stack', err.stack);
      return __.out(res, 500);
    }
  }
  async download(req, res) {
    try {
      let requiredResult = await __.checkRequiredFields(req, [
        'notificationId',
        'date',
      ]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        var notificationDetails = await Notification.findById(
          req.body.notificationId,
        )
          .populate([
            {
              path: 'notifyAcknowledgedUsers',
              select:
                'name staffId  appointmentId status parentBussinessUnitId',
              match: { status: 1 },
              populate: {
                path: 'appointmentId',
                select: 'name',
              },
              populate: {
                path: 'parentBussinessUnitId sectionId',
                select: 'name',
                populate: {
                  path: 'sectionId departmentId',
                  select: 'name',
                  populate: {
                    path: 'departmentId companyId',
                    select: 'name',
                    populate: {
                      path: 'companyId',
                      select: 'name',
                    },
                  },
                },
              },
            },
            {
              path: 'notifyUnreadUsers',
              select: 'name staffId appointmentId status parentBussinessUnitId',
              match: { status: 1 },
              populate: {
                path: 'appointmentId',
                select: 'name',
              },
              populate: {
                path: 'parentBussinessUnitId sectionId',
                select: 'name',
                populate: {
                  path: 'sectionId departmentId',
                  select: 'name',
                  populate: {
                    path: 'departmentId companyId',
                    select: 'name',
                    populate: {
                      path: 'companyId',
                      select: 'name',
                    },
                  },
                },
              },
            },
          ])
          .select(
            'title subTitle description notifyUnreadUsers notifyAcknowledgedUsers userAcknowledgedAt moduleId moduleIncluded',
          )
          .lean();
        if (!!notificationDetails) {
          var jsonArray = [],
            title = notificationDetails.title,
            subTitle = notificationDetails.subTitle,
            description = notificationDetails.description,
            unread = notificationDetails.notifyUnreadUsers,
            unreadCount = notificationDetails.notifyUnreadUsers.length,
            acknowledged = notificationDetails.notifyAcknowledgedUsers,
            timeZone = moment
              .parseZone(req.body.date, 'MM-DD-YYYY HH:mm:ss Z')
              .format('Z'),
            questionTitles = [];

          async function processAcknowledgedArray() {
            // getting all notification answers
            let notificationAnswers = await QuestionResponse.find({
              notificationId: notificationDetails._id,
            }).lean();
            notificationAnswers = JSON.parse(
              JSON.stringify(notificationAnswers),
            );

            // Question Options
            const questions = !!notificationDetails.moduleId
              ? await Question.find({
                  moduleId: notificationDetails.moduleId,
                  status: 1,
                })
                  .select('options type')
                  .sort({
                    indexNum: 1,
                  })
                  .lean()
              : [];
            questionTitles = questions.map((v, i) => `Q${i + 1}`);

            acknowledged.forEach((ackUser, i) => {
              var json = {};
              json.title = title;
              json.subTitle = subTitle;
              json.description = description;
              json.StaffName = ackUser.name ? ackUser.name : '';
              json.StaffID = (
                ackUser.staffId ? ackUser.staffId : ''
              ).toString();
              json.StaffAppointment = ackUser.appointmentId
                ? ackUser.appointmentId.name
                : '';
              json.NotificationStatus = 'Acknowledged';
              json.DateOfAcknowledgement = notificationDetails
                .userAcknowledgedAt[i]
                ? moment
                    .utc(notificationDetails.userAcknowledgedAt[i])
                    .utcOffset(`${timeZone}`)
                    .format('DD-MM-YYYY HH:mm:ss')
                : '';
              json[
                'Staff Parent Business Unit'
              ] = `${ackUser.parentBussinessUnitId.sectionId.departmentId.companyId.name} > ${ackUser.parentBussinessUnitId.sectionId.departmentId.name} > ${ackUser.parentBussinessUnitId.sectionId.name} > ${ackUser.parentBussinessUnitId.name}`;

              if (!!questions && !!notificationAnswers.length) {
                const isObject = (obj) =>
                  (typeof obj === 'object' && obj !== null) ||
                  typeof obj === 'function';
                const formatTime = (time) => {
                  if (`${time}`.includes('-')) {
                    return time;
                  } else if (time) {
                    return moment(time, 'HH:mm:ss').format('hh-mm-A');
                  }
                };
                const manageQuesitons = notificationAnswers.filter(
                  (answer) =>
                    answer.userId.toString() === ackUser._id.toString(),
                );
                questions.forEach((question, i) => {
                  const manageQuesiton = manageQuesitons.find(
                    (v) => v.questionId.toString() === question._id.toString(),
                  );
                  let answer = null;
                  if (!!manageQuesiton) {
                    switch (question.type) {
                      case 1:
                      case 8:
                      case 9:
                      case 11:
                      case 13:
                        answer = manageQuesiton.answer || '--';
                        break;
                      case 2:
                      case 3:
                      case 4:
                        answer = Array.isArray(manageQuesiton.answer)
                          ? manageQuesiton.answer[0].value || '--'
                          : manageQuesiton.answer.value || '--';
                        break;
                      case 11:
                        answer = isObject(manageQuesiton.answer)
                          ? manageQuesiton.answer.value
                          : manageQuesiton.answer;
                        break;
                      case 5:
                      case 15:
                        answer =
                          manageQuesiton.answer
                            .map((a) => a.value)
                            .join(', ') || '--';
                        break;
                      case 10:
                        answer =
                          (manageQuesiton.answer.date || '') +
                          ' ' +
                          (formatTime(manageQuesiton.answer.time) || '');
                        break;
                      case 12:
                        answer = manageQuesiton.answer.name || '--';
                        break;
                      case 14:
                        answer =
                          manageQuesiton && manageQuesiton.answer.length
                            ? manageQuesiton.answer
                                .map((v) => (!!v.text ? v.text : v.name))
                                .join(', ')
                            : '--';
                        break;
                      case 16:
                        answer =
                          manageQuesiton && manageQuesiton.answer.length
                            ? manageQuesiton.answer
                                .map((v) => v.value)
                                .join(', ')
                            : '--';
                        break;
                      default:
                        answer = '--';
                        break;
                    }
                  }
                  json[`Q${i + 1}`] = !manageQuesiton ? '--' : answer;
                });
              }
              jsonArray.push(json);
            });
          }
          async function processUnreadArray() {
            for (var j = 0; j < unreadCount; j++) {
              var json1 = {};
              json1.title = title;
              json1.subTitle = subTitle;
              json1.description = description;
              json1.StaffName = unread[j].name ? unread[j].name : '';
              json1.StaffID = (
                unread[j].staffId ? unread[j].staffId : ''
              ).toString();
              json1.StaffAppointment = unread[j].appointmentId
                ? unread[j].appointmentId.name
                : '';
              json1.NotificationStatus = 'Unread';
              json1.DateOfAcknowledgement = ' ';
              json1[
                'Staff Parent Business Unit'
              ] = `${unread[j].parentBussinessUnitId.sectionId.departmentId.companyId.name} > ${unread[j].parentBussinessUnitId.sectionId.departmentId.name} > ${unread[j].parentBussinessUnitId.sectionId.name} > ${unread[j].parentBussinessUnitId.name}`;
              await jsonArray.push(json1);
            }
          }
          await processAcknowledgedArray();
          await processUnreadArray();
          var csvLink = '',
            fieldsArray = [
              'title',
              'subTitle',
              'description',
              'StaffName',
              'StaffID',
              'StaffAppointment',
              'NotificationStatus',
              'DateOfAcknowledgement',
              'Staff Parent Business Unit',
            ];
          fieldsArray = [...fieldsArray, ...questionTitles];
          if (jsonArray.length !== 0) {
            var csv = json2csv({
              data: jsonArray,
              fields: fieldsArray,
            });
            let fileName = Math.random().toString(36).substr(2, 10);
            fs.writeFile(
              `./public/uploads/notificationExports/${fileName}.csv`,
              csv,
              (err) => {
                if (err) {
                  __.log('json2csv err' + err);
                  __.out(res, 500);
                } else {
                  csvLink = `uploads/notificationExports/${fileName}.csv`;

                  __.out(res, 201, {
                    csvLink: csvLink,
                  });
                }
              },
            );
          } else {
            __.out(res, 201, {
              csvLink: csvLink,
            });
          }
        } else __.out(res, 300, 'Invalid notification');
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async uploadContentFiles(req, res) {
    try {
      if (!req.file) {
        return __.out(res, 300, `No File is Uploaded`);
      }
      __.log(req.file, 'fileName');
      let storePath = `uploads/notificationAttachment/${req.file.filename}`;
      let filePath = `${__.serverBaseUrl()}${storePath}`;
      res.status(201).send({
        link: filePath,
        filePath: storePath,
      });
      const result = /*await*/ __.scanFile(
        req.file.filename,
        `public/uploads/notificationAttachment/${req.file.filename}`,
      );
      if (!!result) {
        //return __.out(res, 300, result);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async allTrackedAnswered(res, input) {
    try {
      let condition = {
        userId: input.userId,
        notificationId: input.notificationId,
      };
      logInfo('allTrackedAnswered has called', condition);
      const [trackedQuestions, questionResponses] = await Promise.all([
        TrackedQuestion.findOne(condition)
          .select({ questions: 1, questionAnswered: 1, _id: 0 })
          .lean(),
        QuestionResponse.find(condition)
          .select({ questionId: 1, option: 1, answer: 1, _id: 0 })
          .lean(),
      ]);

      if (!trackedQuestions || !questionResponses[0]) {
        return false;
      }
      // If all tracked questions answered
      if (
        !!trackedQuestions.questionAnswered ||
        trackedQuestions.questions.length === questionResponses.length
      ) {
        return true;
      }
      // get tracked question details
      const questions = await Question.find({
        _id: { $in: trackedQuestions.questions },
      }).lean();
      const nonConditionalQuestions = questions.filter(
        (q) => !q.conditionalQuestions.length,
      );
      // const conditionalQuestions = questions.filter(q => !!q.conditionalQuestions.length);
      // not even all non conditional questions answered
      if (
        !!nonConditionalQuestions.filter(
          (q) =>
            !questionResponses.find(
              (qr) => qr.questionId.toString() === q._id.toString(),
            ),
        ).length
      ) {
        return false;
      }
      return false;
    } catch (err) {
      logError('allTrackedAnswered has error', err);
      logError('allTrackedAnswered has error', err.stack);
      return __.out(res, 500, err);
    }
  }

  async allQuestionAnswered(req, res) {
    try {
      const { notificationId } = req.body;
      if (!notificationId) {
        return __.out(
          res,
          300,
          `Please provide required fields: notificationId`,
        );
      }
      let condition = {
        userId: req.user._id,
        notificationId,
      };
      const updated = await TrackedQuestion.findOneAndUpdate(condition, {
        $set: { questionAnswered: true },
      });
      if (!!updated) {
        __.out(res, 201, `Updated successfully...`);
      }
    } catch (err) {
      console.log('>>> errorr :', err);
      return __.out(res, 500, err);
    }
  }
}
notification = new notification();
module.exports = notification;
