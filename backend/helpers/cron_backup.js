const schedule = require('node-schedule'),
  moment = require('moment'),
  fs = require('fs'),
  fetch = require('node-fetch'),
  Roles = require('../app/models/role'),
  SubSection = require('../app/models/subSection'),
  Appointment = require('../app/models/appointment'),
  cs = require('node-csv').createParser(),
  SkillSet = require('../app/models/skillSet'),
  SubSkillSet = require('../app/models/subSkillSet'),
  PrivilegeCategory = require('../app/models/privilegeCategory'),
  nodemailer = require('nodemailer'),
  path = require('path'),
  ABSPATH = path.dirname(process.mainModule.filename),
  Notification = require('../app/models/notification'),
  Post = require('../app/models/post'),
  json2csv = require('json2csv').parse,
  spawn = require('child_process').spawn,
  Channel = require('../app/models/channel'),
  Company = require('../app/models/company'),
  BUTemplate = require('../app/models/buTemplate'),
  companyController = require('../app/controllers/company/companyController'),
  departmentController = require('../app/controllers/company/departmentController'),
  sectionController = require('../app/controllers/company/sectionController'),
  Department = require('../app/models/department'),
  Section = require('../app/models/section'),
  PostCategory = require('../app/models/postCategory'),
  User = require('../app/models/user'),
  UserField = require('../app/models/userField'),
  Wall = require('../app/models/wall'),
  WallPost = require('../app/models/wallPost'),
  WallCategory = require('../app/models/wallCategory'),
  PageSettingModel = require('../app/models/pageSetting'),
  FCM = require('./fcm'),
  mailer = require('./mailFunctions'),
  csv = require('csv-parser'),
  unzip = require('unzip'),
  ftpClient = require('ssh2-sftp-client'),
  bcrypt = require('bcrypt-nodejs'),
  //UserUpdate = require('./userUpdate'),
  _ = require('lodash'),
  __ = require('./globalFunctions');

class cron {
  async notification() {
    var notificationDetails = await Notification.find({
      activeFrom: moment().utc().format(),
      status: 1,
      isSent: 0,
    })
      .populate({
        path: 'notifyOverAllUsers',
        select: 'deviceToken',
        match: {
          status: 1,
          deviceToken: {
            $ne: '',
          },
        },
      })
      .lean();

    for (let eachNotification of notificationDetails) {
      let usersDeviceTokens = await Array.from(
        eachNotification.notifyOverAllUsers,
        (x) => x.deviceToken,
      );

      if (usersDeviceTokens.length > 0) {
        await Notification.update(
          {
            _id: eachNotification._id,
          },
          {
            $set: {
              isSent: 1,
            },
          },
        );

        var pushData = {
            title: eachNotification.title,
            body: eachNotification.subTitle,
            redirect: 'notifications',
          },
          collapseKey = eachNotification._id;

        FCM.push(usersDeviceTokens, pushData, collapseKey);
      }
    }
    __.log('notification called');
  }

  // News/Event Publishing
  async publishingPost() {
    let activeChannels = [];
    let channelUsers = {};

    // Active Channel
    let channelList = await Channel.find({
      status: 1,
    }).lean();

    // Make Object for Users list for corresponding channel
    /**
          channelUsers = {
                "channeId":[ 'array of usersTokens' ],
                "channeId":[ 'array of usersTokens' ]
          }  
        */
    for (let channel of channelList) {
      let userTokens = [];
      for (let userDetails of channel.userDetails) {
        let userIds = await __.channelUsersList(channel);

        if (userIds.length > 0) {
          let userData = await User.find({
            _id: {
              $in: userIds,
            },
          }).lean();
          for (let singleUser of userData) {
            if (singleUser.deviceToken && singleUser.deviceToken !== '') {
              userTokens.push(singleUser.deviceToken);
            }
          }
        }
      }
      channelUsers[channel._id] = userTokens;
      activeChannels.push(channel._id);
    }

    // Get Posts
    let searchQuery = {
      channelId: {
        $in: activeChannels,
      },
      status: 1,
      'publishing.startDate': {
        $lte: moment().utc().format(),
      },
      'publishing.endDate': {
        $gte: moment().utc().format(),
      },
      notifiedSent: false,
    };
    var postList = await Post.find(searchQuery)
      .populate({
        path: 'authorId',
        select: '_id name',
      })
      .populate({
        path: 'channelId',
        select: '_id name',
        match: {
          status: 1,
        },
      })
      .populate({
        path: 'categoryId',
        select: '_id name',
        match: {
          status: 1,
        },
      })
      .sort({
        createdAt: 1,
      })
      .lean();

    for (let post of postList) {
      // Active Categories && Channels
      if (post.channelId != null && post.categoryId != null) {
        var pushData = {
            title: __.toTitleCase(post.postType),
            body: post.content.title.replace(/<(.|\n)*?>/g, ''),
            redirect: 'post',
          },
          collapseKey = post._id;

        if (channelUsers[post.channelId._id] != undefined) {
          if (channelUsers[post.channelId._id].length > 0) {
            // remove duplicate device tokens
            let channeluserTokens = [
              ...new Set(channelUsers[post.channelId._id]),
            ];

            FCM.push(channeluserTokens, pushData, collapseKey);
          }
        }
      }
      // Update Post Notification Already Sent
      await Post.update(
        {
          _id: post._id,
        },
        {
          $set: {
            notifiedSent: true,
          },
        },
      );
    }
    __.log('Push for News && Event');
  }

  // Notification Reminder - If user not yet read within particular BU timing
  async notificationReminder() {
    try {
      // Get all Active Companies
      let companyList = await Company.find({
        status: 1,
      })
        .select('name email logo')
        .lean();

      for (let companyData of companyList) {
        // Get all active BU
        let bussinessUnitIds = await __.getCompanyBU(
          companyData._id,
          'subsection',
          [1],
        );

        // Get all Notifications
        let matchQuery = {
          businessUnitId: {
            $in: bussinessUnitIds,
          },
          activeFrom: {
            $lt: moment().utc().format(),
          },
          activeTo: {
            $gt: moment().utc().format(),
          },
          lastNotified: {
            $lt: moment().utc().format(),
          },
          notifyUnreadUsers: {
            $gt: [],
          },
          isSent: 1,
          status: 1,
        };
        var notificationList = await Notification.find(matchQuery)
          .populate({
            path: 'businessUnitId',
            select: 'notificRemindDays notificRemindHours',
          })
          .populate({
            path: 'notifyUnreadUsers',
            select: 'staffId email deviceToken',
            match: {
              status: 1,
              deviceToken: {
                $ne: '',
              },
            },
          })
          .select(
            'title subTitle notifyUnreadUsers activeFrom activeTo businessUnitId lastNotified',
          )
          .lean();

        for (let notificationData of notificationList) {
          let notificationId = notificationData._id;
          let activeFrom = moment(notificationData.activeFrom).format();
          let remindHours =
            notificationData.businessUnitId.notificRemindHours || 5;
          let remindDays =
            notificationData.businessUnitId.notificRemindDays || 5;
          let firstNotificAt = moment(activeFrom)
            .add(remindDays, 'days')
            .format();
          let lastNotified =
            moment(notificationData.lastNotified).format() || activeFrom;
          let nextNotified = moment(lastNotified)
            .add(remindHours, 'hours')
            .format();

          /* 1. If 1st Notification Reminder Period Passed
                    2. If next estimated reminder time passed */
          if (
            moment().isAfter(firstNotificAt) &&
            moment().isAfter(nextNotified)
          ) {
            // Update Last Updated Time
            await Notification.findOneAndUpdate(
              {
                _id: notificationId,
              },
              {
                $set: {
                  lastNotified: moment().utc().format(),
                },
              },
            );

            /** Push to unread user in a single call */
            let userTokens = [];
            for (let userData of notificationData.notifyUnreadUsers) {
              userTokens.push(userData.deviceToken);
            }
            var pushData = {
                title: notificationData.title,
                body: notificationData.subTitle,
                redirect: 'notifications',
              },
              collapseKey = notificationData._id;
            if (userTokens.length > 0) {
              FCM.push(userTokens, pushData, collapseKey);
            }

            /** Mail to unread user */
            for (let userData of notificationData.notifyUnreadUsers) {
              __.log(companyData, 'companyData');
              let mailData = {
                notificationData: notificationData,
                userData: userData,
                companyData: companyData,
              };

              mailer.notificReminder(mailData);
            }
          }
        } // notification iteration
      } // company iteration
      __.log('notification reminder called');
    } catch (err) {
      __.log(err);
    }
  }

  // In complete Task notification - In last 3 Hours
  async taskNotification() {
    __.log('Task Notification');

    // Get Active Walls
    let wallList = await Wall.find({
      status: 1,
    }).lean();

    let wallIds = wallList.map((v) => {
      return v._id;
    });

    // Get Active Category
    let categoryIds = await WallCategory.find({
      wallId: {
        $in: wallIds,
      },
      status: 1,
    });
    categoryIds = categoryIds.map((v) => v._id);

    // If no active categorys , then stop execution
    if (categoryIds.length == 0) {
      return true;
    }

    var postList = await WallPost.find({
      category: {
        $in: categoryIds,
      },
      taskDueDate: {
        $gte: moment().add(3, 'hours').utc(),
      },
      taskList: {
        $gt: [],
      },
      isTaskCompleted: false,
      isTaskNotified: false,
      status: 1,
    })
      .populate({
        path: 'assignedToList',
        select: 'name deviceToken',
      })
      .lean();
    __.log(postList);
    for (let elem of postList) {
      let usersDeviceTokens = await Array.from(
        elem.assignedToList,
        (x) => x.deviceToken,
      );

      if (usersDeviceTokens.length > 0) {
        await WallPost.update(
          {
            _id: elem._id,
          },
          {
            $set: {
              isTaskNotified: true,
            },
          },
        );

        var pushData = {
            title: elem.title,
            body: elem.title,
            redirect: 'notifications',
          },
          collapseKey = elem._id;
        __.log(pushData, 'pushData', usersDeviceTokens);
        FCM.push(usersDeviceTokens, pushData, collapseKey);
      }
    }
    __.log('task Reminder called');
  }

  // Password Rechange Reminder - In last  10 days
  async passwordChangeNotification() {
    try {
      let companyList = await PageSettingModel.find({
        'pwdSettings.status': 1,
        'pwdSettings.pwdDuration': {
          $gt: 10,
        },
        status: 1,
      })
        .populate({
          path: 'companyId',
          select: 'name status',
          match: {
            status: 1,
          },
        })
        .select('pwdSettings')
        .lean();

      for (let companyData of companyList) {
        // Active Companies
        if (companyData.companyId == null) {
          continue;
        }
        // notifiedAt
        let previousUpdated = moment()
          .substract(comanyData.pwdSettings.pwdDuration - 10, 'days')
          .utc()
          .format();
        let lastNotified = moment().substract(1, 'days').utc().format();
        // Get all Notifications
        let matchQuery = {
          companyId: companyData.companyId._id,
          status: 1,
          'pwdManage.pwdUpdatedAt': {
            $lt: previousUpdated,
          },
          'pwdManage.notifiedAt': {
            $lt: lastNotified,
          },
        };
        var userList = await User.find(matchQuery)
          .select('staffId email deviceToken')
          .lean();

        let usersDeviceTokens = userList
          .map((v) => {
            return v.deviceToken;
          })
          .filter(Boolean);

        let userIds = userList
          .map((v) => {
            return v._id;
          })
          .filter(Boolean);

        // update the user to last notified
        await User.update(
          {
            _id: {
              $in: userIds,
            },
          },
          {
            'pwdManage.notifiedAt': moment().utc().format(),
          },
        );

        var pushData = {
            title: `Password Notification`,
            body: `Password Notification`,
            redirect: 'notifications',
          },
          collapseKey = elem._id;
        __.log(pushData, 'pushData', usersDeviceTokens);
        FCM.push(usersDeviceTokens, pushData, collapseKey);
      } // company iteration
      __.log('password reminder called');
    } catch (err) {
      __.log(err);
    }
  }

  // User Integration daily
  async userIntegration(req, res) {
    let companyId = '5ac71c1b0b219861d50231df';
    // Get Company Data
    let companyData = await Company.findOne({
      _id: companyId,
    }).lean();

    let excelData = [];
    let nonUpdated = [];

    // var newFile = await spawn('unzip', ['-P', 'P@55word!', '-d', './public/', './public/dailyMySATS20190318000000.zip'])
    let serverFile = `./public/dailyMySATS20190318000000.csv`;
    var columns = [
      'SNo',
      'EmployeeNumber',
      'SamAccountName',
      'DisplayName',
      'GivenName',
      'Surname',
      'EmailAddress',
      'Company',
      'Department',
      'Title',
      'Tech',
      'Reporting Officer',
      'MobilePhone',
      'OfficePhone',
      'Office',
      'UserAccountControl',
    ];

    require('csv-to-array')(
      {
        file: serverFile,
        columns: columns,
      },
      async function (err, array) {
        excelData = array;
        if (excelData.length > 0) {
          let userData = excelData; // get the 1st sheet only

          // Get index of Known keys from the header row
          let titleIndex = {};

          // Role Exist or Not..
          let rolesData = await Roles.find({
            companyId: companyId,
            status: 1,
          })
            .select('name')
            .lean();

          //Appointment Exist or Not...
          let appointmentsData = await Appointment.find({
            companyId: companyId,
            status: 1,
          })
            .select('name')
            .lean();

          let staticFields = [
            'EmployeeNumber',
            'DisplayName',
            'EmailAddress',
            'Company',
            'Department',
            'Title',
            'Tech',
            'MobilePhone',
            'UserAccountControl',
          ];

          for (let elem of userData) {
            let companyName = ['SATS'];
            // first row and last row continue the loop because the first row file details and last one is footer..
            if (elem.EmployeeNumber === 'dailyMySATS' || elem.SNo === '99') {
              continue;
            }

            let appointment = `${elem.Title}${elem.Tech}`;
            let bu = `${companyName}>${elem.Company}>${
              elem.Department
            }>${'__'}`;

            let userControll = elem.UserAccountControl;
            let status = 0;
            if (userControll == '512') {
              status = 1;
            } else if (userControll == '546') {
              status = 2;
            }
            // user Data with static fields
            let user = {
              name: elem.DisplayName,
              staffId: elem.EmployeeNumber,
              contactNumber: elem.MobilePhone,
              email: elem.EmailAddress,
              status: status,
              role: null,
              roleFind: false,
              appointmentId: null,
              appointFind: false,
              parentBussinessUnitId: null,
              parentBuFind: false,
            };

            // bu already exist or not...
            let businessUnitsIds = await __.getCompanyBU(
              companyId,
              'subsection',
              1,
            );
            let businessUnitsData = await SubSection.find({
              _id: {
                $in: businessUnitsIds,
              },
            })
              .populate({
                path: 'sectionId',
                select: 'name',
                match: {
                  status: 1,
                },
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
              })
              .lean();

            for (let elem of businessUnitsData) {
              // SATS >> Security >> Aviation >> test 9
              let fullBU = `${elem.sectionId.departmentId.companyId.name}>${elem.sectionId.departmentId.name}>${elem.sectionId.name}>${elem.name}`;

              if (fullBU == bu) {
                user.parentBuFind = true;
                user.parentBussinessUnitId = elem._id;
              }
            }

            //Missmatch data push to Non Upload array...
            if (
              elem.Company == null ||
              elem.Company == '' ||
              elem.Department == null ||
              elem.Department == '' ||
              elem.DisplayName == null ||
              elem.DisplayName == '' ||
              elem.EmployeeNumber == null ||
              elem.EmployeeNumber == '' ||
              elem.EmailAddress == null ||
              elem.EmailAddress == ''
            ) {
              let userMissedData = {
                EmployeeNumber: elem.EmployeeNumber,
                DisplayName: elem.DisplayName,
                MobilePhone: elem.MobilePhone,
                EmailAddress: elem.EmailAddress,
                Reason: 'Data MissMatch',
              };
              nonUpdated.push(userMissedData);
              continue;
            }

            // new appointment created.
            let appointFlag = false;
            for (let elem of appointmentsData) {
              if (elem.name == appointment) {
                user.appointFind = true;
                user.appointmentId = elem._id;
                appointFlag = true;
              }
            }

            if (appointFlag == false) {
              let insert = {
                name: appointment,
                status: 1,
                companyId: companyId,
              };

              let insertedDoc = await new Appointment(insert).save();
              user.appointmentId = insertedDoc._id;
              appointFlag = false;
            }
            // buTemplate find one..

            let findbuTemplate = await BUTemplate.find({
              companyId: companyId,
            })
              .lean()
              .select('_id');
            findbuTemplate = findbuTemplate.map((v) => {
              return v._id;
            });

            let pageSetting = await PageSettingModel.findOne({
              buTemplateId: { $in: findbuTemplate },
              companyId: companyId,
            })
              .lean()
              .select('buTemplateId');

            let findActiveBuTemplate = await BUTemplate.findOne({
              status: 1,
              companyId: companyId,
              _id: pageSetting.buTemplateId,
            });
            user.role = findActiveBuTemplate.role;
            user.subSkillSets = findActiveBuTemplate.subSkillSets;

            if (user.parentBussinessUnitId === null) {
              // find department..
              let departmentIds;
              departmentIds = await Department.find({
                companyId: companyId,
                name: elem.Company,
                status: {
                  $in: status,
                },
              })
                .select('_id')
                .lean();

              let insert = {
                companyId: companyId,
                name: elem.Company,
                status: 1,
              };
              //create new model
              let insertedDepartment;
              if (0 === departmentIds.length) {
                insertedDepartment = await new Department(insert).save();
              }

              //save model to MongoDB
              let departmentId = insertedDepartment._id || departmentIds;
              let params = {
                departmentId: departmentId,
                companyId: companyId,
              };
              companyController.push(params, res);

              //find section Id

              let sectionIds = await Section.find({
                departmentId: {
                  $in: departmentId,
                },
                name: elem.Department,
                status: {
                  $in: status,
                },
              })
                .select('_id')
                .lean();

              // create section new
              let section = {
                departmentId: departmentId,
                name: elem.Department,
                status: 1,
              };
              //create new model
              let insertedSection;
              if (0 === sectionIds.length) {
                insertedSection = await new Section(section).save();
              }

              //save model to MongoDB
              let sectionId = insertedSection._id || sectionIds;
              let param = {
                sectionId: sectionId,
                departmentId: departmentId,
              };
              departmentController.push(param, res);

              // Sub Section
              let subSectionIds = await SubSection.find({
                sectionId: {
                  $in: sectionId,
                },
                name: '__',
                status: {
                  $in: status,
                },
              })
                .select('_id')
                .lean();

              let subSection = {
                name: '__',
                sectionId: sectionId,
                appointments: user.appointmentId,
                subSkillSets: findActiveBuTemplate.subSkillSets,
                subCategories: findActiveBuTemplate.subCategories,
                techEmail: findActiveBuTemplate.techEmail,
                adminEmail: findActiveBuTemplate.adminEmail,
                notificRemindHours: findActiveBuTemplate.notificRemindHours,
                notificRemindDays: findActiveBuTemplate.notificRemindDays,
                cancelShiftPermission:
                  findActiveBuTemplate.cancelShiftPermission,
                standByShiftPermission:
                  findActiveBuTemplate.standByShiftPermission,
                reportingLocation: findActiveBuTemplate.reportingLocation,
                status: 1,
              };

              //create new model
              let insertedSubSection;
              if (0 === subSectionIds.length) {
                insertedSubSection = await new SubSection(subSection).save();
              }

              //save model to MongoDB
              let subSectionId = insertedSubSection._id || subSectionIds;
              let paramsData = {
                subSectionId: subSectionId,
                sectionId: sectionId,
              };
              sectionController.push(paramsData, res);

              let businessUnitsIds = await __.getCompanyBU(
                companyId,
                'subsection',
                1,
              );
              let businessUnitsData = await SubSection.find({
                _id: {
                  $in: businessUnitsIds,
                },
              })
                .populate({
                  path: 'sectionId',
                  select: 'name',
                  match: {
                    status: 1,
                  },
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
                })
                .lean();

              for (let elem of businessUnitsData) {
                // SATS >> Security >> Aviation >> test 9
                let fullBU = `${elem.sectionId.departmentId.companyId.name}>${elem.sectionId.departmentId.name}>${elem.sectionId.name}>${elem.name}`;

                if (fullBU == bu) {
                  user.parentBuFind = true;
                  user.parentBussinessUnitId = elem._id;
                }
              }
            }

            // Convert number to string
            if (typeof user.staffId == 'number') {
              user.staffId = user.staffId.toString();
            }

            let userDe = await User.findOne({
              companyId: companyId,
              staffId: user.staffId.toLowerCase(),
            })
              .select('staffId')
              .lean();
            let updatedUserData;
            if (userDe) {
              updatedUserData = await User.findOneAndUpdate(
                {
                  companyId: companyId,
                  staffId: user.staffId.toLowerCase(),
                },
                {
                  $set: user,
                },
              ).lean();
            }

            // New User
            if (!userDe) {
              let generatedPassword = 'password'; // as of now default password
              user.password = bcrypt.hashSync(
                generatedPassword,
                bcrypt.genSaltSync(8),
                null,
              );
              user.status = 1;
              user.companyId = companyId;
              user.staffId = user.staffId.toLowerCase();
              updatedUserData = await User(user).save(function (err, data) {});
            }

            // Custom Fields create...
            for (let singleField of columns) {
              if (singleField == 'SamAccountName' || singleField == 'SNo') {
                continue;
              }
              if (!staticFields.includes(singleField)) {
                let userFieldId = await UserField.findOne({
                  fieldName: singleField,
                  companyId: companyId,
                  status: 1,
                }).lean();

                if (userFieldId) {
                  // let existField = false;
                  let int = 0;

                  // Update if exists
                  let existField = await User.update(
                    {
                      _id: updatedUserData._id,
                      'otherFields.fieldId': userFieldId._id.toString(),
                    },
                    {
                      $set: {
                        'otherFields.$.value': elem[singleField],
                      },
                    },
                  );

                  // Add if not exists
                  if (existField.nModified == 0) {
                    let newFieldData = {
                      fieldId: userFieldId._id.toString(),
                      fieldName: userFieldId.fieldName,
                      indexNum: userFieldId.indexNum,
                      required: userFieldId.required,
                      type: userFieldId.type,
                      value: elem[singleField],
                    };

                    let returnedData = User.findOneAndUpdate(
                      {
                        _id: updatedUserData._id,
                      },
                      {
                        $addToSet: {
                          otherFields: newFieldData,
                        },
                      },
                      {
                        new: true,
                      },
                    );
                  }
                } else {
                  let insertField = {
                    fieldName: singleField,
                    companyId: companyId,
                    type: 'dropdown',
                    indexNum: 0,
                    editable: false,
                  };
                  if (insertField.type == 'dropdown') {
                    let optionArray = elem[singleField];
                    insertField.options = optionArray;
                  }

                  let newField = await new UserField(insertField).save(
                    function (err, data) {},
                  );

                  let newFieldData = {
                    fieldId: newField._id.toString(),
                    fieldName: newField.fieldName,
                    indexNum: newField.indexNum,
                    required: newField.required,
                    type: newField.type,
                    value: newField.options,
                  };
                  let returnedData = await User.findOneAndUpdate(
                    {
                      _id: updatedUserData._id,
                    },
                    {
                      $addToSet: {
                        otherFields: newFieldData,
                      },
                    },
                    {
                      new: true,
                    },
                  );
                }
              }
            }
          }
        } // End Up for of loop

        var csvLink = '',
          fieldsArray = [
            'EmployeeNumber',
            'DisplayName',
            'EmailAddress',
            'MobilePhone',
            'Reason',
          ];
        if (nonUpdated.length !== 0) {
          var csv = json2csv({
            data: nonUpdated,
            fields: fieldsArray,
          });

          let fileName = Math.random().toString(36).substr(2, 10);
          await fs.writeFile(`./public/uploads/${fileName}.csv`, csv, (err) => {
            if (err) {
              __.log('json2csv err' + err);
            } else {
              csvLink = `uploads/${fileName}.csv`;
              let fileLocation = `./public/${csvLink}`;
              var transporter = nodemailer.createTransport({
                // Use an app specific password here
                service: 'gmail',
                host: 'smtpout.secureserver.net',
                port: 465,
                secure: true,
                auth: {
                  user: process.env.NODEMAILER_EMAIL,
                  pass: process.env.NODEMAILER_PASSWORD,
                },
              });

              fs.readFile(fileLocation, function (err, data) {
                transporter.sendMail({
                  sender: process.env.NODEMAILER_EMAIL,
                  to: 'ramakrishnan@doodleblue.com',
                  subject: 'Attachment!',
                  body: 'mail content...',
                  attachments: [{ filename: 'attachment.csv', content: data }],
                }),
                  function (err, success) {
                    if (err) {
                      // Handle error
                    }
                  };
              });
            }
          });
        } else {
        }
      },
    );
  }

  //user Integration weekly
  async userIntegrationweekly(req, res) {
    try {
      let companyId = '5ac71c1b0b219861d50231df';
      // Get Company Data
      let companyData = await Company.findOne({
        _id: companyId,
      }).lean();

      // var newFile = await spawn('unzip', ['-P', 'P@55word!', '-d', './public/', './public/dailyMySATS20190318000000.zip'])
      let serverFile = `./public/dailyMySATS20190318000000.csv`;
      var columns = [
        'SNo',
        'EmployeeNumber',
        'SamAccountName',
        'DisplayName',
        'GivenName',
        'Surname',
        'EmailAddress',
        'Company',
        'Department',
        'Title',
        'Tech',
        'Reporting Officer',
        'MobilePhone',
        'OfficePhone',
        'Office',
        'UserAccountControl',
      ];
      let nonTerminated = [];
      require('csv-to-array')(
        {
          file: serverFile,
          columns: columns,
        },
        async function (err, array) {
          excelData = array;
          if (excelData.length > 0) {
            let userData = excelData; // get the 1st sheet only
            for (let elem of userData) {
              if (elem.UserAccountControl == '546') {
                let userDe = await User.findOne({
                  companyId: companyId,
                  staffId: elem.EmployeeNumber.toLowerCase(),
                })
                  .remove()
                  .exec();
              } else {
                let userMissedData = {
                  EmployeeNumber: elem.EmployeeNumber,
                  DisplayName: elem.DisplayName,
                  MobilePhone: elem.MobilePhone,
                  EmailAddress: elem.EmailAddress,
                  Reason: 'Data MissMatch',
                };
                nonTerminated.push(userMissedData);
                continue;
              }
            }
          }
        },
      );

      var csvLink = '',
        fieldsArray = [
          'EmployeeNumber',
          'DisplayName',
          'EmailAddress',
          'MobilePhone',
          'Reason',
        ];
      if (nonTerminated.length !== 0) {
        var csv = json2csv({
          data: nonTerminated,
          fields: fieldsArray,
        });

        let fileName = Math.random().toString(36).substr(2, 10);
        await fs.writeFile(`./public/uploads/${fileName}.csv`, csv, (err) => {
          if (err) {
            __.log('json2csv err' + err);
          } else {
            csvLink = `uploads/${fileName}.csv`;
            let fileLocation = `./public/${csvLink}`;
            var transporter = nodemailer.createTransport({
              // Use an app specific password here
              service: 'gmail',
              host: 'smtpout.secureserver.net',
              port: 465,
              secure: true,
              auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
              },
            });

            fs.readFile(fileLocation, function (err, data) {
              transporter.sendMail({
                sender: process.env.NODEMAILER_EMAIL,
                to: 'ramakrishnan@doodleblue.com',
                subject: 'Attachment!',
                body: 'mail content...',
                attachments: [{ filename: 'attachment.csv', content: data }],
              }),
                function (err, success) {
                  if (err) {
                    // Handle error
                  }
                };
            });
          }
        });
      } else {
      }
    } catch (error) {
      __log('error', error);
    }
  }

  async sftpData() {
    let Client = require('ssh2-sftp-client');
    let sftp = new Client();
    sftp
      .connect({
        host: 'ftp.sats.com.sg',
        port: '22',
        username: 'MySATS_AD_UAT',
        password: 'mySatsuat!23',
      })
      .then(() => {
        sftp
          .get('/ADDailyExtractUAT/dailyMySATS20190412140104.zip')
          .then((data) => {
            fs.writeFileSync('/home/ubuntu/backend/public/', data);
          });
      })
      .catch((err) => {
        console.log(err, 'catch error');
      });
  }
}

cron = new cron();

var rule = new schedule.RecurrenceRule();

rule.minute = new schedule.Range(0, 59, 1);
schedule.scheduleJob('00 */1 * * * *', cron.notification);
schedule.scheduleJob('00 */1 * * * * ', cron.publishingPost);
// schedule.scheduleJob('00 */1 * * * * ', cron.notificationReminder);
schedule.scheduleJob('00 */1 * * * * ', cron.taskNotification);
schedule.scheduleJob('00 */1 * * * * ', cron.passwordChangeNotification);
//schedule.scheduleJob('00 */1 * * * * ', cron.userIntegrationweekly);
//schedule.scheduleJob('00 */1 * * * * ', cron.sftpData);
