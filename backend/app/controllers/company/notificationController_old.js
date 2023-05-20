// Controller Code Starts here
const mongoose = require('mongoose'),
  moment = require('moment'),
  path = require('path'),
  QuestionModuleController = require('../common/questionModuleController'),
  Notification = require('../../models/notification'),
  BuilderModule = require('../../models/builderModule'),
  Question = require('../../models/question'),
  QuestionResponse = require('../../models/questionResponse'),
  User = require('../../models/user'),
  FCM = require('../../../helpers/fcm'),
  json2csv = require('json2csv').parse,
  mime = require('mime-types'),
  fs = require('fs-extra'),
  _ = require('lodash'),
  __ = require('../../../helpers/globalFunctions');
  const { AssignUserRead } = require('../../../helpers/assinguserread');

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
        let userIds = await AssignUserRead.read(insert.assignUsers, null, insert.createdBy);
        userIds = userIds.users;
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
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async read(req, res) {
    try {
      let requiredResult1 = await __.checkRequiredFields(req, [
        'businessUnitId',
      ]);
      if (requiredResult1.status === false) {
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        var whereData = {
          businessUnitId: req.body.businessUnitId,
        };

        var notificationDetails = await this.getNotificationDetails(
          whereData,
          res,
        );

        return __.out(res, 201, notificationDetails);
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
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
        let userIds = await AssignUserRead.read(insert.assignUsers, null, insert.createdBy);
        userIds = userIds.users;
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
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async myNotifications(req, res) {
    var data = {
      userId: req.user._id,
    };
    var myNotifications = await this.userNotifications(data, res);
    __.out(res, 201, myNotifications);
  }
  async userNotifications(data, res) {
    __.log(new Date(), new Date().toGMTString());
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
        let attachMimeType = await mime.contentType(
          path.extname(results[index].notificationAttachment),
        );
        results[index].mimeType = attachMimeType;
      }
    }

    return results;
  }
  async getNotificationDetails(whereData, res) {
    var findOrFindOne;
    if (whereData.notificationId)
      findOrFindOne = Notification.findById(whereData.notificationId);
    else findOrFindOne = Notification.find(whereData);

    return await findOrFindOne
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
          path: 'notifyByBusinessUnits',
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
          match: {
            status: 1,
          },
        },
        {
          path: 'notifyByUsers',
          select: 'name staffId',
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
      ])
      .lean();
  }
  async addUserToDynamicNotifications(data, res) {
    let notificationIds = await AssignUserRead.getUserInAssignedUser(data.userData, Notification)

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

        FCM.push([data.deviceToken], pushData, collapseKey);
      }
    }
    return true;
  }
  async acknowledge(req, res) {
    try {
      let requiredResult = await __.checkRequiredFields(req, [
        'notificationId',
      ]);

      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        var data = {
          userId: req.user._id,
          notificationId: req.body.notificationId,
        };
        if (req.body.qnsresponses) {
          data.user = req.user;
          data.qnsresponses = req.qnsresponses;
        }
        this.userAcknowledge(data, res);
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async userAcknowledge(data, res) {
    try {
      var notificationDetails = await Notification.findOne({
        _id: data.notificationId,
        status: 1,
      });
      if (notificationDetails) {
        var isValidUser = await notificationDetails.notifyOverAllUsers.some(
          (x) => {
            let y = _.isEqual(x, data.userId);
            return y;
          },
        );
        var isAcknowledged =
          await notificationDetails.notifyAcknowledgedUsers.some((x) => {
            let y = _.isEqual(x, data.userId);
            return y;
          });

        if (!isValidUser) {
          __.out(res, 300, 'Invalid user');
        } else if (isAcknowledged) {
          __.out(res, 300, 'Already acknowledged to this notification');
        } else {
          await Notification.update(
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

          __.out(res, 201, 'Notification has been successfully acknowledged');
        }
      } else {
        __.out(res, 300, 'Invalid notification');
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
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
              select: 'name staffId  appointmentId',
              populate: {
                path: 'appointmentId',
                select: 'name',
              },
            },
            {
              path: 'notifyUnreadUsers',
              select: 'name staffId appointmentId',
              populate: {
                path: 'appointmentId',
                select: 'name',
              },
            },
          ])
          .select(
            'title subTitle description notifyUnreadUsers notifyAcknowledgedUsers userAcknowledgedAt moduleId moduleIncluded',
          )
          .lean();
        if (notificationDetails) {
          let questionField = [];
          let questionList = {};
          if (notificationDetails.moduleIncluded) {
            // Question Options
            let questionData = await Question.find({
              moduleId: notificationDetails.moduleId,
              status: 1,
            })
              .select('options type')
              .sort({
                indexNum: 1,
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
                type: elem.type,
              };
              // MCQ,trueFalse,Polling
              if ([2, 3, 4, 5].indexOf(elem.type) > -1) {
                questionList[elem._id]['options'] = {};
                for (let optionData of elem.options) {
                  questionList[elem._id]['options'][optionData._id] =
                    optionData;
                }
              }
              int++;
            }
          }

          var jsonArray = [],
            title = notificationDetails.title,
            subTitle = notificationDetails.subTitle,
            description = notificationDetails.description,
            unread = notificationDetails.notifyUnreadUsers,
            unreadCount = notificationDetails.notifyUnreadUsers.length,
            acknowledged = notificationDetails.notifyAcknowledgedUsers,
            acknowledgedCount =
              notificationDetails.notifyAcknowledgedUsers.length,
            userAcknowledgedAt = notificationDetails.userAcknowledgedAt,
            timeZone = moment
              .parseZone(req.body.date, 'MM-DD-YYYY HH:mm:ss Z')
              .format('Z');

          async function processAcknowledgedArray() {
            for (var i = 0; i < acknowledgedCount; i++) {
              var json = {};
              json.title = title;
              json.subTitle = subTitle;
              json.description = description;
              json.StaffName = acknowledged[i].name ? acknowledged[i].name : '';
              json.StaffID = (
                acknowledged[i].staffId ? acknowledged[i].staffId : ''
              ).toString();
              json.StaffAppointment = acknowledged[i].appointmentId
                ? acknowledged[i].appointmentId.name
                : '';
              json.NotificationStatus = 'Acknowledged';
              json.DateOfAcknowledgement = userAcknowledgedAt[i]
                ? moment
                    .utc(userAcknowledgedAt[i])
                    .utcOffset(`${timeZone}`)
                    .format('DD-MM-YYYY HH:mm:ss')
                : '';

              // Get Qns Res
              let resData = await QuestionResponse.find({
                notificationId: notificationDetails._id,
                userId: acknowledged[i]._id,
                status: 1,
              }).lean();
              // Iterate Res Qns & Push to Qnsdata
              for (let elem of resData) {
                let qnsData = questionList[elem.questionId];
                if (qnsData != undefined) {
                  if ([2, 3, 4, 5].indexOf(qnsData.type) > -1) {
                    let optData = qnsData['options'][elem.option];
                    if (optData) {
                      if (json[qnsData.title]) {
                        json[qnsData.title] =
                          `${json[qnsData.title]},${optData.value}` || '';
                      } else {
                        json[qnsData.title] = optData.value;
                      }
                    }
                  } else {
                    json[qnsData.title] = qnsData.value || '';
                  }
                }
              }

              await jsonArray.push(json);
            }
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
            ];

          fieldsArray = [...fieldsArray, ...questionField];

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

      let storePath = `uploads/notificationAttachment/${req.file.filename}`;
      let filePath = `${__.serverBaseUrl()}${storePath}`;

      return res.status(201).send({
        link: filePath,
        filePath: storePath,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }
}
notification = new notification();
module.exports = notification;
