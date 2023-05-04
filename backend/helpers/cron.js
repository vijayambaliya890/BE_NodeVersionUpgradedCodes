const schedule = require('node-schedule'),
  moment = require('moment'),
  mongoose = require('mongoose'),
  fs = require('fs'),
  fetch = require('node-fetch'),
  Roles = require("../app/models/role"),
  SubSection = require("../app/models/subSection"),
  Appointment = require("../app/models/appointment"),
  cs = require('node-csv').createParser(),
  SkillSet = require('../app/models/skillSet'),
  Role = require('../app/models/role'),
  SubSkillSet = require('../app/models/subSkillSet'),
  PrivilegeCategory = require('../app/models/privilegeCategory'),
  nodemailer = require("nodemailer"),
  smtpTransport = require("nodemailer-smtp-transport"),
  path = require('path'),
  ABSPATH = path.dirname(process.mainModule.filename),
  Notification = require('../app/models/notification'),
  Post = require('../app/models/post'),
  json2csv = require('json2csv'),
  spawn = require('child_process').spawn,
  Channel = require('../app/models/channel'),
  Company = require('../app/models/company'),
  Forms = require('../app/models/company'),
  BUTemplate = require('../app/models/buTemplate'),
  companyController = require('../app/controllers/company/companyController'),
  departmentController = require('../app/controllers/company/departmentController'),
  sectionController = require('../app/controllers/company/sectionController'),
  Department = require("../app/models/department"),
  Section = require("../app/models/section"),
  PostCategory = require('../app/models/postCategory'),
  Integration = require('../app/models/integration'),
  User = require('../app/models/user'),
  UserField = require("../app/models/userField"),
  Wall = require('../app/models/wall'),
  WallPost = require('../app/models/wallPost'),
  WallCategory = require('../app/models/wallCategory'),
  PageSettingModel = require('../app/models/pageSetting'),
  LeaveGroupModel = require('../app/models/leaveGroup'),
  FCM = require('./fcm'),
  mailer = require('./mailFunctions'),
  csv = require('csv-parser'),
  unzip = require('unzip'),
  ftpClient = require('ssh2-sftp-client'),
  bcrypt = require("bcrypt-nodejs"),
  Challenge = require("../app/models/challenge"),
  //UserUpdate = require('./userUpdate'),
  _ = require('lodash'),
  __ = require('./globalFunctions'),
  csvToArray = require('csv-to-array')
staffLeave = require('../app/models/staffLeave')
LeaveType = require('../app/models/leaveType')
LeaveApplied = require('../app/models/leaveApplied');
LeaveGroup = require('../app/models/leaveGroup');
const createStaffLeave = async (data) => {
  const leaveGroupData = await LeaveGroup.findOne({
    _id: data.leaveGroupId
  }).populate([{
    path: "leaveType.leaveTypeId",
    match: {
      isActive: true
    },
  },]);

  function monthDiff(d1, d2) {
    var months;
    months = (d2.getFullYear() - d1.getFullYear()) * 12;
    months -= d1.getMonth();
    months += d2.getMonth();
    return months <= 0 ? 0 : months;
  }

  function diff_years(dt2, dt1) {
    var diff = (dt2.getTime() - dt1.getTime()) / 1000;
    diff /= 60 * 60 * 24;
    return Math.abs(Math.round(diff / 365.25));
  }

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const prevYear = currentYear - 1;
  const yearArr = [prevYear, currentYear, nextYear];

  let leaveDetails = [];
  for (let i = 0; i < 3; i++) {
    const yearValue = yearArr[i];
    let month = 0;
    let year = 0;
    if (data.doj) {
      month = monthDiff(new Date(data.doj), new Date(new Date().setFullYear(yearValue)));
      year = diff_years(new Date(data.doj), new Date(new Date().setFullYear(yearValue)));
    }
    leaveGroupData.leaveType.forEach((leave) => {
      if (leave.leaveTypeId) {
        let quota = leave.quota;
        if (month > 0) {
          leave.proRate.forEach((mo) => {
            if (mo.fromMonth <= month && mo.toMonth >= month && quota < mo.quota) {
              quota = mo.quota;
            }
          });
        }
        if (year > 0) {
          leave.seniority.forEach((mo) => {
            if (mo.year <= year && quota < mo.quota) {
              quota = mo.quota;
            }
          });
        }

        let leaveObj = {
          leaveTypeId: leave.leaveTypeId._id,
          quota,
          planQuota: quota,
          planDymanicQuota: quota,
          total: quota,
          year: yearValue,
        };
        leaveDetails.push(leaveObj);
      }
    });
  }

  const obj = {
    userId: data._id,
    leaveGroupId: data.leaveGroupId,
    businessUnitId: data.parentBussinessUnitId,
    leaveDetails: leaveDetails,
  };
  const post = new staffLeave(obj);
  await post.save();
}

const updateStaffLeave = async (data) => {
  const leaveGroupData = await LeaveGroup.findOne({
    _id: data.leaveGroupId
  }).populate([{
    path: "leaveType.leaveTypeId",
    match: {
      isActive: true
    },
  },]);

  function monthDiff(d1, d2) {
    var months;
    months = (d2.getFullYear() - d1.getFullYear()) * 12;
    months -= d1.getMonth();
    months += d2.getMonth();
    return months <= 0 ? 0 : months;
  }

  function diff_years(dt2, dt1) {
    var diff = (dt2.getTime() - dt1.getTime()) / 1000;
    diff /= 60 * 60 * 24;
    return Math.abs(Math.round(diff / 365.25));
  }
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const prevYear = currentYear - 1;
  const yearArr = [prevYear, currentYear, nextYear];

  let leaveDetails = [];
  for (let i = 0; i < yearArr.length; i++) {
    const yearValue = yearArr[i];
    let month = 0;
    let year = 0;
    if (data.doj) {
      month = monthDiff(new Date(data.doj), new Date(new Date().setFullYear(yearValue)));
      year = diff_years(new Date(data.doj), new Date(new Date().setFullYear(yearValue)));
    }
    if (leaveGroupData) {
      leaveGroupData.leaveType.forEach((leave) => {
        if (leave.leaveTypeId) {
          let quota = leave.quota;
          if (month > 0) {
            leave.proRate.forEach((mo) => {
              if (mo.fromMonth <= month && mo.toMonth >= month && quota < mo.quota) {
                quota = mo.quota;
              }
            });
          }
          if (year > 0) {
            leave.seniority.forEach((mo) => {
              if (mo.year <= year && quota < mo.quota) {
                quota = mo.quota;
              }
            });
          }
          let leaveObj = {
            leaveTypeId: leave.leaveTypeId._id,
            quota,
            planQuota: quota,
            planDymanicQuota: quota,
            total: quota,
            year: yearValue,
          };
          leaveDetails.push(leaveObj);
        }
      });
    }
  }

  let staffLeaveData = await staffLeave.findOne({
    userId: data._id
  });

  if (staffLeaveData) {
    for (let i = 0; i < leaveDetails.length; i++) {
      let leaveType = leaveDetails[i];
      let staffLeaveType = staffLeaveData.leaveDetails.filter((lt) => {
        return lt.leaveTypeId.toString() == leaveType.leaveTypeId.toString() && lt.year == leaveType.year;
      });
      if (staffLeaveType && staffLeaveType.length > 0) {
        staffLeaveType = staffLeaveType[0];
        //1000 - 20 => 980
        //20+980 =>
        //15+980 = 995
        //20-1000 => -980
        let totalLeaveIncrease = leaveType.total - staffLeaveType.total;
        let quotaIncrease = staffLeaveType.quota + totalLeaveIncrease;
        let planIncrease = staffLeaveType.planQuota + totalLeaveIncrease;
        leaveDetails[i].quota = quotaIncrease > 0 ? quotaIncrease : 0;
        leaveDetails[i].planQuota = planIncrease > 0 ? planIncrease : 0;
      }
    }
    let obj = {
      userId: data._id,
      //updatedBy: req.user._id,
      leaveGroupId: data.leaveGroupId,
      businessUnitId: data.parentBussinessUnitId,
      // companyId: req.user.companyId,
      leaveDetails: leaveDetails,
    };

    await staffLeave.findOneAndUpdate({
      userId: obj.userId
    }, {
      $set: {
        leaveDetails: obj.leaveDetails,
        updatedBy: obj.updatedBy,
        leaveGroupId: obj.leaveGroupId,
        isActive: true
      }
    });

  }
}

const integration = async (resDaily, req, res) => {
  try {
    const serverFile = `./public/${resDaily}`,
      columns = ["SNo", "EmployeeNumber", "SamAccountName", "DisplayName", "GivenName", "Surname", "EmailAddress", "Company", "Department", "Title", "Reporting Officer", "MobilePhone", "OfficePhone", "Office", "UserAccountControl", "Password"],
      staticFields = ["EmployeeNumber", "DisplayName", "EmailAddress", "Company", "Department", "Title", "Tech", "MobilePhone", "UserAccountControl", "Password"];
    let companyData = null;
    const getCompanyData = async elem => {
      const pathName = elem.EmployeeNumber.includes('MySATS') ? 'sats' : '';
      companyData = await Company.findOne({
        pathName: pathName
      }).lean();
      return !!companyData;
    }
    let results = [];
    const leaveGroupData = await LeaveGroupModel.findOne({
      name: 'SATS Standard'
    }).lean();
    try {
      if (fs.existsSync(serverFile)) { } else {
        // Hariharan
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: 'Integration main - file not exists',
          date: new Date()
        }));
        await new Integration({
          newUsers: [],
          status: 'Success',
          sourcePath: null,
          errorFilePath: null,
          updatedUsers: [],
          errorMessage: 'integration file not exists... :' + serverFile
        }).save();
        return;
      }
    } catch (err) {
      // Hariharan
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: 'Integration main - error file log',
        date: new Date(),
        detail: `${err}`
      }));
      console.error(err)
    }
    fs.createReadStream(serverFile)
      .pipe(csv(columns))
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let logData = {
          newUsers: [],
          status: 'Success',
          sourcePath: null,
          errorFilePath: null,
          updatedUsers: [],
          errorMessage: ''
        };
        let excelData = results || [];
        let nonUpdated = [];
        if (excelData.length) {
          // Hariharan
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: 'Integration main - file data available',
            date: new Date()
          }));
          let company = await getCompanyData(excelData[0])
          if (!company) {
            return;
          }
          const companyId = companyData._id;
          logData.companyId = companyId;
          let businessUnitsIds = await __.getCompanyBU(companyData._id, "subsection", 1);
          let buQuery = __.buQuery('sectionId');
          let businessUnitsData = await SubSection.find({
            _id: {
              $in: businessUnitsIds
            }
          }).populate(buQuery).lean();
          const categoryData = await PrivilegeCategory.findOne({
            name: "System Admin"
          }).select('privileges').lean();
          //const systemAdminRoles = await Role.find({ companyId: companyId, privileges: { $all: categoryData.privileges } }).select('_id').lean();
          const systemAdminRoles = await Role.find({
            companyId: companyId,
            name: "System Admin"
          }).select('_id').lean();
          const systemAdminRolesIds = systemAdminRoles.map(v => v._id);
          // Hariharan
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: 'Integration main - file data iteration starts',
            date: new Date()
          }));
          for (const elem of excelData) {
            if (elem.EmployeeNumber === "dailyMySATS" || elem.SNo === "99") {
              continue;
            }
            let appointment = !!elem.Title ? `${elem.Title}` : `${"__"}`;
            let status = elem.UserAccountControl == "512" || elem.UserAccountControl == "66048" ? 1 : elem.UserAccountControl == "546" ? 2 : 0;
            companyData.name = companyData.name.toUpperCase();
            elem.Company = elem.Company ? elem.Company.trim().toUpperCase() : elem.Company;
            elem.Department = !!elem.Department ? elem.Department.toUpperCase() : null;
            let bu = !!elem.Department ? `${companyData.name}>${elem.Company}>${elem.Department}>${"__"}` : `${companyData.name}>${elem.Company}>${"__"}>${"__"}`;
            let user = {
              "name": elem.DisplayName,
              "staffId": elem.EmployeeNumber.toLowerCase(),
              "contactNumber": elem.MobilePhone,
              "email": elem.EmailAddress || "mysats@net-roc.com",
              "status": status,
              "role": null,
              "roleFind": false,
              "appointmentId": null,
              "appointFind": false,
              "parentBussinessUnitId": null,
              "parentBuFind": false
            };
            let businessUnitId = businessUnitsData.find(elem => {
              return `${elem.sectionId.departmentId.companyId.name}>${elem.sectionId.departmentId.name}>${elem.sectionId.name}>${elem.name}`.toUpperCase() === bu;
            });
            if (!!businessUnitId) {
              user.parentBuFind = true;
              user.parentBussinessUnitId = businessUnitId._id;
            }

            let reasons = [];
            if (!(!!elem.Company)) {
              reasons[reasons.length] = "Company Name Missing";
            }
            if (!(!!elem.EmployeeNumber)) {
              reasons[reasons.length] = "Employee Number MisMatch";
            }
            if (!(!!elem.DisplayName)) {
              reasons[reasons.length] = "Staff Name MisMatch";
            }

            let name = ''
            try {
              appointment = appointment.replace(/\\/g, ",");
              name = new RegExp(`^${appointment}$`, 'i');
            } catch (error) {
              if (appointment.includes('(')) {
                appointment = `${appointment})`
                name = new RegExp(`^${appointment}$`, 'i');
              } else {
                reasons[reasons.length] = "Incorrect data in the csv file";
              }
            }

            if (reasons.length) {
              nonUpdated[nonUpdated.length] = {
                "EmployeeNumber": elem.EmployeeNumber,
                "DisplayName": elem.DisplayName,
                "MobilePhone": elem.MobilePhone,
                "EmailAddress": elem.EmailAddress,
                "Reason": reasons.join(`, `)
              };
              continue;
            }

            //            appointment = appointment.replace(/\\/g, ",");
            //Appointment Exist or Not...
            let appointmentsData = await Appointment.findOne({
              companyId: companyData._id,
              name, //: new RegExp(`^${appointment}$`, 'i'),
              status: 1
            }).select('name').lean();
            if (!!appointmentsData) {
              user.appointmentId = appointmentsData._id;
            } else {
              let insertedDoc = await new Appointment({
                "name": appointment,
                "status": 1,
                "companyId": companyId
              }).save();
              user.appointmentId = insertedDoc._id;
            }
            let pageSetting = await PageSettingModel.findOne({
              companyId: companyId
            }).populate({
              path: 'buTemplateId'
            }).lean();
            let findActiveBuTemplate = pageSetting.buTemplateId;
            let newBu = false;
            if (!(!!user.parentBussinessUnitId)) {
              // find department..
              let departmentIds = await Department.find({
                companyId: companyId,
                name: elem.Company, //new RegExp(`^${elem.Company}$`, 'i'),
                status: {
                  $in: status
                }
              }).select("_id").lean();
              let departmentId = null;
              if (departmentIds.length) {
                departmentId = departmentIds[0]._id;
              } else {
                const insertedDepartment = await new Department({
                  "companyId": companyId,
                  "name": elem.Company,
                  "status": 1
                }).save();
                departmentId = insertedDepartment._id;
              }
              const cmpy = await Company.findOneAndUpdate({
                _id: companyId
              }, {
                $addToSet: {
                  departments: departmentId
                }
              });

              /** Find Section */
              let sectionIds = await Section.find({
                departmentId: {
                  $in: [departmentId]
                },
                name: elem.Department, //new RegExp(`^${elem.Department}$`, 'i'),
                status: {
                  $in: [status]
                }
              }).select("_id").lean();
              let sectionId = null;
              if (sectionIds.length) {
                sectionId = sectionIds[0]._id;
              } else {
                let insertedSection = await new Section({
                  "departmentId": departmentId,
                  "name": elem.Department || "__",
                  "status": 1
                }).save();
                sectionId = insertedSection._id;
              }
              await Department.update({
                _id: departmentId
              }, {
                $addToSet: {
                  sections: sectionId
                }
              });
              // Sub Section
              let subSectionIds = await SubSection.find({
                sectionId: {
                  $in: [sectionId]
                },
                name: "__",
                status: {
                  $in: [status]
                }
              }).select("_id").lean();

              //create new model
              let subsectionId = null;
              if (subSectionIds.length) {
                subsectionId = subSectionIds[0]._id;
              } else {
                const {
                  subSkillSets,
                  subCategories,
                  techEmail,
                  adminEmail,
                  notificRemindHours,
                  notificRemindDays,
                  cancelShiftPermission,
                  standByShiftPermission,
                  reportingLocation
                } = findActiveBuTemplate;
                let insertedSubSection = await new SubSection({
                  name: "__",
                  sectionId: sectionId,
                  appointments: [user.appointmentId],
                  subCategories,
                  techEmail,
                  adminEmail,
                  notificRemindHours,
                  notificRemindDays,
                  cancelShiftPermission,
                  standByShiftPermission,
                  reportingLocation,
                  status: 1,
                  orgName: `${cmpy.name} > ${elem.Company} > ${elem.Department || '___'} > __`
                  // orgName: `${company.name} > ${elem.Company} > ${elem.Department || '___'} > __`
                }).save();
                subsectionId = insertedSubSection._id;
              }
              await Section.update({
                _id: sectionId
              }, {
                $addToSet: {
                  subSections: subsectionId
                }
              });
              user.parentBussinessUnitId = subsectionId;
              newBu = true;
              businessUnitsData = await SubSection.find({
                _id: {
                  $in: businessUnitsIds
                }
              }).populate(buQuery).lean();
            } else {
              await SubSection.update({
                _id: user.parentBussinessUnitId
              }, {
                $addToSet: {
                  appointments: user.appointmentId
                }
              });
            }

            if (typeof user.staffId == "number") {
              user.staffId = user.staffId.toString();
            }

            const addToSystemAdmin = async () => {
              // await User.update({ role: { $in: systemAdminRolesIds }, companyId: companyId }, {
              await User.update({
                $or: [{
                  role: {
                    $in: systemAdminRolesIds
                  }
                },
                {
                  allBUAccess: 1
                }
                ],
                companyId: companyId
              }, { // changed from systemadmin to allBUAccess users
                $addToSet: {
                  planBussinessUnitId: user.parentBussinessUnitId,
                  viewBussinessUnitId: user.parentBussinessUnitId
                }
              }, {
                multi: true
              });
            }

            let userDe = await User.findOne({
              companyId: companyId,
              staffId: user.staffId.toLowerCase()
            }).select('staffId role subSkillSets leaveGroupId').lean();
            user.name = user.name.replace(/\\/g, ",");
            let updatedUserData;
            let newUser = false;
            if (userDe) {
              user.role = userDe.role;
              user.subSkillSets = userDe.subSkillSets;
              if (elem.Password) {
                var userNew = new User();
                user.password = userNew.generateHash(elem.Password);
              }
              // adding leave group to new user
              if (!userDe.leaveGroupId && (leaveGroupData && leaveGroupData._id)) {
                user.leaveGroupId = leaveGroupData._id;
                const requestBody = {
                  ...user,
                  ...userDe
                };
                await updateStaffLeave(requestBody);
              }
              updatedUserData = await User.findOneAndUpdate({
                companyId: companyId,
                staffId: user.staffId.toLowerCase()
              }, {
                $set: user
              }, {
                setDefaultsOnInsert: true
              }).lean();
              logData.updatedUsers[logData.updatedUsers.length] = user.staffId;
              if (newBu) {
                /* add created business unit to System admin's plan business unit */
                await addToSystemAdmin();
              }
              const getAllBuTokensByUserID = async (userData) => {
                const userId = userData._id,
                  condition = {
                    createdBy: userId,
                    "assignUsers.allBuToken": true
                  };
                const channels = await Channel.find({
                  createdBy: userId,
                  "userDetails.allBuToken": true
                });
                const boards = await Wall.find(condition);
                const notifications = await Notification.find(condition);
                const forms = await Forms.find(condition);
                if (channels) {
                  for (const channel of channels) {
                    channel.userDetails[0].businessUnits = userData.planBussinessUnitId;
                    await Channel.findOneAndUpdate({
                      _id: channel._id
                    }, {
                      userDetails: channel.userDetails
                    });
                  }
                }
                if (boards) {
                  for (const board of boards) {
                    board.assignUsers[0].businessUnits = userData.planBussinessUnitId
                    await Wall.findOneAndUpdate({
                      _id: board._id
                    }, {
                      assignUsers: board.assignUsers
                    });
                  }
                }
                if (notifications) {
                  for (const notification of notifications) {
                    notification.assignUsers[0].businessUnits = userData.planBussinessUnitId
                    await Notification.findOneAndUpdate({
                      _id: notification._id
                    }, {
                      assignUsers: notification.assignUsers
                    });
                  }
                }
                if (forms) {
                  for (const form of forms) {
                    form.assignUsers[0].businessUnits = userData.planBussinessUnitId
                    await Forms.findOneAndUpdate({
                      _id: form._id
                    }, {
                      assignUsers: form.assignUsers
                    });
                  }
                }
              }
              await getAllBuTokensByUserID(updatedUserData);
            } else {
              newUsers = true;
              let generatedPassword = await __.makePwd(8);
              user.role = findActiveBuTemplate.role;
              user.subSkillSets = findActiveBuTemplate.subSkillSets;
              var userNew = new User();
              if (pageSetting.pwdSettings.status === 1) {
                if (pageSetting.pwdSettings.passwordType === 2) {
                  generatedPassword = pageSetting.pwdSettings.defaultPassword;
                  user.password = userNew.generateHash(generatedPassword);
                } else {
                  user.password = userNew.generateHash(generatedPassword);
                }
              } else {
                user.password = userNew.generateHash(generatedPassword);
              }
              user.companyId = companyId;
              user.staffId = user.staffId.toLowerCase();
              user.companyData = companyData;
              logData.newUsers[logData.newUsers.length] = user.staffId;
              // adding leave group to new user
              if (leaveGroupData && leaveGroupData._id) {
                user.leaveGroupId = leaveGroupData._id;
                updatedUserData = await User(user).save();
                if (updatedUserData && updatedUserData._id) {
                  user._id = updatedUserData._id;
                  await createStaffLeave(user);
                }
              }


              // For Mail
              user.password = generatedPassword;
              var response = await mailer.newCompanyUser(user);
              /* add created business unit to System admin's plan business unit */
              await addToSystemAdmin();
            }
            /**  */
            for (let singleField of columns) {
              if (singleField == "SamAccountName" || singleField == "SNo") {
                continue;
              }
              if (!staticFields.includes(singleField)) {
                let userFieldId = await UserField.findOne({
                  fieldName: singleField,
                  companyId: companyId,
                  status: 1
                }).lean();
                /** Field exists */
                if (userFieldId) {
                  // let existField = false;
                  let int = 0;
                  // Update if exists
                  elem[singleField] = elem[singleField].replace(/\\/g, ",");
                  let existField = await User.update({
                    _id: updatedUserData._id,
                    "otherFields.fieldId": userFieldId._id.toString()
                  }, {
                    $set: {
                      "otherFields.$.value": elem[singleField],
                      "otherFields.$.type": userFieldId.type
                    }
                  });

                  let existOrNot = await User.findOne({
                    _id: updatedUserData._id,
                    "otherFields.fieldId": userFieldId._id.toString()
                  }).lean();

                  // Add if not exists
                  if (!existOrNot) {
                    let newFieldData = {
                      "fieldId": userFieldId._id.toString(),
                      "fieldName": userFieldId.fieldName,
                      "indexNum": userFieldId.indexNum,
                      "required": userFieldId.required,
                      "type": userFieldId.type,
                      "value": elem[singleField]
                    };
                    await User.update({
                      _id: updatedUserData._id
                    }, {
                      $addToSet: {
                        otherFields: newFieldData
                      }
                    });
                  }
                } else {
                  let insertField = {
                    fieldName: singleField,
                    companyId: companyId,
                    type: "text",
                    indexNum: 1,
                    editable: false
                  };
                  if (insertField.type == 'dropdown') {
                    let optionArray = elem[singleField];
                    insertField.options = optionArray;
                  }

                  let newField = await new UserField(insertField).save();
                  if (newField) {
                    newField.options = newField.options.replace(/\\/g, ",");
                    let newFieldData = {
                      "fieldId": newField._id.toString(),
                      "fieldName": newField.fieldName,
                      "indexNum": newField.indexNum,
                      "required": newField.required,
                      "type": newField.type,
                      "value": elem[singleField],
                    };
                    await User.update({
                      _id: updatedUserData._id
                    }, {
                      $addToSet: {
                        otherFields: newFieldData
                      }
                    }, {
                      new: true
                    });
                  }
                }
              }
            }

          }

        } else {
          // Hariharan
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: 'Integration main - no records in file',
            date: new Date()
          }));
          logData.errorMessage = logData.errorMessage + `
                No record found`;
        }
        let csvLink = '',
          fieldsArray = ["EmployeeNumber", "DisplayName", "EmailAddress", "MobilePhone", "Reason"];
        logData.nonUpdatedUsers = nonUpdated.map(v => v.Reason);
        logData.sourcePath = resDaily;
        if (nonUpdated.length) {
          // Hariharan
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: 'Integration main - non updated users available',
            date: new Date()
          }));
          let fileName = `NonUpdatedData${moment().format('YYYYMMDD')}`;
          logData.errorFilePath = `uploads/${fileName}.csv`;
          logData.status = 'Partially completed';
          var csv = json2csv({
            data: nonUpdated,
            fields: fieldsArray
          });
          await fs.writeFile(`./public/uploads/${fileName}.csv`, csv, async (err) => {
            if (err) {
              // Hariharan
              await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
                message: 'Integration main - error while create non update user file',
                date: new Date(),
                detail: `${err}`
              }));
              __.log('json2csv err' + err);
            } else {
              csvLink = `uploads/${fileName}.csv`;
              logData.errorFilePath = csvLink;
              let fileLocation = `./public/${csvLink}`;
              const transporter = nodemailer.createTransport(
                smtpTransport({
                  service: "Office365",
                  host: "smtp.office365.com",
                  port: 587,
                  secure: false,
                  requireTLS: true,
                  auth: {
                    user: process.env.NODEMAILER_EMAIL,
                    pass: process.env.NODEMAILER_PASSWORD,
                  },
                })
              );
              fs.readFile(fileLocation, function (err, data) {
                transporter.sendMail({
                  sender: process.env.NODEMAILER_EMAIL,
                  to: 'siangju@net-roc.com', //process.env.NODEMAILER_EMAIL,
                  subject: 'Attachment!',
                  body: 'mail content...',
                  attachments: [{
                    'filename': 'attachment.csv',
                    'content': data
                  }]
                }),
                  function (err, success) { }
              });
            }
          });
        }
        // Hariharan
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: 'Integration main - creating integration log',
          date: new Date()
        }));
        await new Integration(logData).save();
        // Hariharan
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: 'Integration main - creating integration log done',
          date: new Date()
        }));
      });
  } catch (error) {
    // Hariharan
    await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
      message: 'Integration main - error in core',
      date: new Date(),
      detail: `${error}`
    }));
    __.log(error)
  }
}


class cron {
  async challengeNotification() {
    try {
      let challenges = await Challenge.find({
        status: 1,
        criteriaType: {
          $nin: [3, 4, 5]
        },
        isNotified: false,
        publishStart: {
          $lte: new Date()
        }
      }).select({
        _id: 1,
        title: 1,
        description: 1,
        selectedChannel: 1,
        selectedWall: 1,
        criteriaType: 1
      }).lean();

      challenges = challenges || [];
      const sendNotification = async (challenge, users) => {
        const collapseKey = challenge._id;
        const usersWithToken = await User.find({
          _id: {
            $in: users || []
          }
        }).select('deviceToken').lean();
        const pushData = {
          title: challenge.title,
          body: challenge.description,
          redirect: 'challenges'
        };
        const deviceTokens = usersWithToken.map(user => user.deviceToken).filter(Boolean);
        if (deviceTokens.length) {
          await FCM.push(deviceTokens, pushData, collapseKey);
        }
      }
      if (challenges.length) {
        for (const challenge of challenges) {
          let users = [];
          /** get the users for wall/channal */
          if (!!challenge.selectedChannel && 1 === challenge.criteriaType) {
            const channel = await Channel.findOne({
              _id: challenge.selectedChannel
            }).select('userDetails createdBy').lean();
            users = await __.channelUsersList(channel);
          } else if (!!challenge.selectedWall && 2 === challenge.criteriaType) {
            const wall = await Wall.findOne({
              _id: challenge.selectedWall
            }).select('assignUsers createdBy').lean();
            users = await __.wallUsersList(wall);
          }
          if (users.length) {
            await sendNotification(challenge, users);
          }
          await Challenge.findByIdAndUpdate(challenge._id, {
            isNotified: true
          });
        }
      }
    } catch (error) {
      __.log(error);
    }
  }
  async notification() {
    var notificationDetails = await Notification.find({
      activeFrom: {
        $lte: moment().utc().format()
      },
      status: 1,
      isSent: 0,
      notifyOverAllUsers: {
        $ne: []
      }
    }).populate({
      path: 'notifyOverAllUsers',
      select: 'deviceToken',
      match: {
        status: 1,
        deviceToken: {
          $ne: ''
        }
      }
    }).lean();
    for (let eachNotification of notificationDetails) {
      let usersDeviceTokens = eachNotification.notifyOverAllUsers.map(x => x.deviceToken).filter(Boolean);
      if (usersDeviceTokens.length > 0) {
        await Notification.update({
          _id: eachNotification._id
        }, {
          $set: {
            isSent: 1
          }
        });
        var pushData = {
          title: eachNotification.title,
          body: eachNotification.subTitle,
          redirect: 'notifications'
        },
          collapseKey = eachNotification._id;

        FCM.push(usersDeviceTokens, pushData, collapseKey);
      }
    }
  }

  // News/Event Publishing
  async publishingPost() {

    /*let activeChannels = [];
    let channelUsers = {};

    // Active Channel
    let channelList = await Channel.find({
        status: 1
    }).lean();*/

    // Make Object for Users list for corresponding channel
    /**
      channelUsers = {
            "channeId":[ 'array of usersTokens' ],
            "channeId":[ 'array of usersTokens' ]
      }  
    */
    /*for (let channel of channelList) {
        let userTokens = [];
        let userIds = await __.channelUsersList(channel);
        if (userIds.length > 0) {
            let userData = await User.find({
                _id: {
                    $in: userIds
                }
            }).lean();
            for (let singleUser of userData) {
                if (singleUser.deviceToken && singleUser.deviceToken !== '') {
                    userTokens.push(singleUser.deviceToken);
                }
            }
        }
        channelUsers[channel._id] = userTokens;
        activeChannels.push(channel._id);
    }*/

    // Get Posts
    let searchQuery = {
      // channelId: {
      //     $in: activeChannels
      // },
      status: 1,
      "publishing.startDate": {
        $lte: moment().utc().format()
      },
      "publishing.endDate": {
        $gte: moment().utc().format()
      },
      notifiedSent: false
    };
  console.log("-----searchQuery---------", searchQuery)
    var postList = await Post.find(searchQuery).populate({
      path: "authorId",
      select: "_id name"
    }).populate({
      path: "channelId",
      select: "_id name",
      match: {
        status: 1
      }
    }).populate({
      path: "categoryId",
      select: "_id name",
      match: {
        status: 1
      }
    }).sort({
      "createdAt": 1
    }).lean();
    for (let post of postList) {
      // Active Categories && Channels
      if (post.channelId != null && post.categoryId != null) {
        const parser = require('html-to-text');
        const decodedString = parser.convert(post.content.title, {
          wordwrap: 130
        });
        //let dom = parser.parseFromString(post.content.title), decodedString = dom.body.textContent;
        var pushData = {
          title: __.toTitleCase(post.postType),
          body: decodedString,
          redirect: 'post'
        },
          collapseKey = post._id;
        let channel = await Channel.findOne({
          _id: post.channelId._id,
          status: 1
        }).select('userDetails').lean();
        if (channel) {
          let userIds = await __.channelUsersList(channel, false);
          const deviceTokens = userIds.filter(v => !!v.deviceToken).map(v => v.deviceToken);
          if (deviceTokens.length) {
            let channeluserTokens = deviceTokens;
            FCM.push(channeluserTokens, pushData, collapseKey);
            await Post.update({
              _id: post._id
            }, {
              $set: {
                notifiedSent: true
              }
            });
          }
        }
      }
      // Update Post Notification Already Sent
    }

  }

  // Notification Reminder - If user not yet read within particular BU timing
  async notificationReminder() {
    try {
      // Get all Active Companies
      let companyList = await Company.find({
        status: 1
      }).select("name email logo").lean();

      for (let companyData of companyList) {

        // Get all active BU
        let bussinessUnitIds = await __.getCompanyBU(companyData._id, 'subsection', [1]);

        // Get all Notifications
        let matchQuery = {
          businessUnitId: {
            $in: bussinessUnitIds
          },
          activeFrom: {
            $lt: moment().utc().format()
          },
          activeTo: {
            $gt: moment().utc().format()
          },
          lastNotified: {
            $lt: moment().utc().format()
          },
          notifyUnreadUsers: {
            $gt: []
          },
          isSent: 1,
          status: 1
        };
        var notificationList = await Notification.find(matchQuery).populate({
          path: "businessUnitId",
          select: "notificRemindDays notificRemindHours"
        }).populate({
          path: 'notifyUnreadUsers',
          select: 'staffId email deviceToken',
          match: {
            status: 1,
            deviceToken: {
              $ne: ''
            }
          }
        }).select("title subTitle notifyUnreadUsers activeFrom activeTo businessUnitId lastNotified").lean();

        for (let notificationData of notificationList) {

          let notificationId = notificationData._id;
          let activeFrom = moment(notificationData.activeFrom).format();
          let remindHours = notificationData.businessUnitId.notificRemindHours || 5;
          let remindDays = notificationData.businessUnitId.notificRemindDays || 5;
          let firstNotificAt = moment(activeFrom).add(remindDays, 'days').format();
          let lastNotified = moment(notificationData.lastNotified).format() || activeFrom;
          let nextNotified = moment(lastNotified).add(remindHours, 'hours').format();

          /* 1. If 1st Notification Reminder Period Passed
          2. If next estimated reminder time passed */
          if (moment().isAfter(firstNotificAt) && moment().isAfter(nextNotified)) {

            // Update Last Updated Time
            await Notification.findOneAndUpdate({
              "_id": notificationId
            }, {
              $set: {
                "lastNotified": moment().utc().format()
              }
            });

            /** Push to unread user in a single call */
            let userTokens = [];
            for (let userData of notificationData.notifyUnreadUsers) {
              userTokens.push(userData.deviceToken);
            }
            var pushData = {
              title: notificationData.title,
              body: notificationData.subTitle,
              redirect: 'notifications'
            },
              collapseKey = notificationData._id;
            if (userTokens.length > 0) {
              FCM.push(userTokens, pushData, collapseKey);
            }

            /** Mail to unread user */
            for (let userData of notificationData.notifyUnreadUsers) {
              let mailData = {
                notificationData: notificationData,
                userData: userData,
                companyData: companyData
              };
              mailer.notificReminder(mailData);
            }

          }

        } // notification iteration
      } // company iteration
    } catch (err) {
      __.log(err)
    }
  }

  // In complete Task notification - In last 3 Hours
  async taskNotification() {
    // Get Active Walls
    let wallList = await Wall.find({
      status: 1
    }).lean();

    let wallIds = wallList.map(v => {
      return v._id;
    });

    // Get Active Category
    let categoryIds = await WallCategory.find({
      wallId: {
        $in: wallIds
      },
      status: 1
    });
    categoryIds = categoryIds.map(v => v._id);

    // If no active categorys , then stop execution
    if (categoryIds.length == 0) {
      return true;
    }

    var postList = await WallPost.find({
      category: {
        $in: categoryIds
      },
      taskDueDate: {
        $gte: moment().add(3, 'hours').utc()
      },
      taskList: {
        $gt: []
      },
      isTaskCompleted: false,
      isTaskNotified: false,
      status: 1
    }).populate({
      path: 'assignedToList',
      select: 'name deviceToken'
    }).lean();
    for (let elem of postList) {
      let usersDeviceTokens = await Array.from(elem.assignedToList, x => x.deviceToken);
      if (usersDeviceTokens.length > 0) {
        await WallPost.update({
          _id: elem._id
        }, {
          $set: {
            isTaskNotified: true
          }
        });
        var pushData = {
          title: elem.title,
          body: elem.title,
          redirect: 'notifications'
        },
          collapseKey = elem._id;
        FCM.push(usersDeviceTokens, pushData, collapseKey);
      }
    }
  }

  // Password Rechange Reminder - In last  10 days
  async passwordChangeNotification() {

    try {

      let companyList = await PageSettingModel.find({
        "pwdSettings.status": 1,
        "pwdSettings.pwdDuration": {
          $gt: 10
        },
        status: 1
      }).populate({
        path: "companyId",
        select: "name status",
        match: {
          status: 1
        }
      }).select('pwdSettings').lean();

      for (let companyData of companyList) {

        // Active Companies
        if (companyData.companyId == null) {
          continue;
        }
        // notifiedAt
        let previousUpdated = moment().substract(companyData.pwdSettings.pwdDuration - 10, "days").utc().format();
        let lastNotified = moment().substract(1, "days").utc().format();
        // Get all Notifications
        let matchQuery = {
          companyId: companyData.companyId._id,
          status: 1,
          "pwdManage.pwdUpdatedAt": {
            $lt: previousUpdated
          },
          "pwdManage.notifiedAt": {
            $lt: lastNotified
          }
        };
        var userList = await User.find(matchQuery).select("staffId email deviceToken").lean();

        let usersDeviceTokens = userList.map(v => {
          return v.deviceToken;
        }).filter(Boolean);

        let userIds = userList.map(v => {
          return v._id;
        }).filter(Boolean);

        // update the user to last notified
        await User.update({
          _id: {
            $in: userIds
          }
        }, {
          "pwdManage.notifiedAt": moment().utc().format()
        });

        var pushData = {
          title: `Password Notification`,
          body: `Password Notification`,
          redirect: 'notifications'
        },
          collapseKey = elem._id;
        FCM.push(usersDeviceTokens, pushData, collapseKey);

      } // company iteration
      __.log('password reminder called');

    } catch (err) {
      __.log(err)
    }
  }

  // Password Rechange Reminder - on daily basis from 7 days before.
  async passwordChangeNotificationRemainder() {
    try {

      let companyList = await PageSettingModel.find({
        "pwdSettings.status": 1,
        "pwdSettings.pwdDuration": {
          $gt: 7
        },
        status: 1
      }).populate({
        path: "companyId",
        select: "name status",
        match: {
          status: 1
        }
      }).select('pwdSettings').lean();

      for (let companyData of companyList) {

        // Active Companies
        if (companyData.companyId == null) {
          continue;
        }
        let previousUpdated = moment().subtract((+companyData.pwdSettings.pwdDuration) - 7, "days").utc().format();
        let expireDate = moment().subtract((+companyData.pwdSettings.pwdDuration), "days").utc().format();
        // let lastNotified = moment().subtract(1, "days").utc().format();
        // Get all Notifications
        let matchQuery = {
          companyId: companyData.companyId._id,
          status: 1,
          "pwdManage.pwdUpdatedAt": {
            $lt: previousUpdated,
            $gt: expireDate
          },
          // $or: [
          //     { "pwdManage.notifiedAt": { $exists:false } },
          //     { "pwdManage.notifiedAt": {
          //         $lt: lastNotified
          //     }}
          // ]
        };
        var userList = await User.find(matchQuery).select("staffId email deviceToken pwdManage").lean();

        let usersDeviceTokens = userList.map(v => {
          return v.deviceToken;
        }).filter(Boolean);
        const staffDetailswithDeviceToken = userList.map(v => {
          return ({
            staffId: v.staffId,
            deviceToken: v.deviceToken
          });
        }).filter(v => v.deviceToken);

        // let userIds = userList.map(v => {
        //     return v._id;
        // }).filter(Boolean);

        // update the user to last notified
        // await User.update({
        //     _id: {
        //         $in: userIds
        //     }
        // }, {
        //     "pwdManage.notifiedAt": moment().utc().format()
        // });

        if (usersDeviceTokens.length) {
          var pushData = {
            title: `Password-Notification`,
            body: `You are requested to change your account password`,
            redirect: 'notifications'
          },
            collapseKey = Math.random() * 10000000 + "";
          FCM.push(usersDeviceTokens, pushData, collapseKey, staffDetailswithDeviceToken);
        }

      } // company iteration
      // __.log('password reminder called');

    } catch (err) {
      __.log(err)
    }
  }


  async sftpIntegraionAt04(req, res) {
    // retry logic starts
    const currentFolder = "./public/";
    const files = await fs.readdirSync(currentFolder);

    const today = moment().add(1, 'days').format('YYYYMMDD');
    const currentDate = `${today}07`;
    const myFiles = files.filter(v => -1 !== v.indexOf(currentDate) && v.includes('.csv'));
    if (!!myFiles.length) {
      // Hariharan
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: 'SFTP Integration 04 file already exists. retry cancel.',
        date: new Date()
      }));
      return;
    }
    // Hariharan
    await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
      message: 'SFTP Integration 04 file not exists. retry begins.',
      date: new Date()
    }));
    // retry logic ends

    let Client = require('ssh2-sftp-client');
    let sftp = new Client();
    // const today = moment().add(1, 'days').format('YYYYMMDD');
    // let timeStamp = `${today}07`;
    await sftp.connect({
      host: 'ftp.sats.com.sg',
      port: '22',
      username: 'MySATS_AD_PRD',
      password: 'mySatsprd!23',
      readyTimeout: 40000, // timeout increased to 40 seconds, previously its 20 seconds
      algorithms: {
        kex: ['diffie-hellman-group14-sha1']
      }
    }).then(() => {
      return sftp.list('/ADDailyExtractPRD');
    }).then(async (data) => {
      // Hariharan
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: 'SFTP Integration 04 starts',
        date: new Date()
      }));
      data = data || [];
      const filteredData = data.filter(v => -1 !== v.name.indexOf(`dailyMySATS${currentDate}`));
      for (const d of filteredData) {
        // Hariharan
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: 'SFTP Integration 04 log 1',
          date: new Date()
        }));
        let daily = d.name;
        await sftp.get(`/ADDailyExtractPRD/${daily}`).then(async (fileData) => {
          // Hariharan
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: 'SFTP Integration 04 log 2',
            date: new Date()
          }));
          let writtenFileData = await fs.writeFileSync(`public/${daily}`, fileData);
          await spawn('unzip', ['-P', 'Daily@dm1n!', '-d', './public/', `./public/${daily}`]);
          const resDaily = daily.split('.')[0] + '.csv';
          // Hariharan
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: 'SFTP Integration 04 ends',
            date: new Date()
          }));
          //await integration(resDaily, req, res);
        }, async (error) => {
          // Hariharan
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: 'SFTP Integration 04 ends with error',
            date: new Date(),
            detail: `${error}`
          }));
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify(error));
        });
      }
    }).catch(async (error) => {
      // Hariharan
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: 'SFTP Integration 04 error before starts',
        date: new Date(),
        detail: `${error}`
      }));
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify(error));
    });
  }
  async sftpIntegraionAt13(req, res) {
    // retry logic starts
    const currentFolder = "./public/";
    const files = await fs.readdirSync(currentFolder);

    const currentDate = moment().format('YYYYMMDD') + '13';
    const myFiles = files.filter(v => -1 !== v.indexOf(currentDate) && v.includes('.csv'));
    if (!!myFiles.length) {
      // Hariharan
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: 'SFTP Integration 13 file already exists. retry cancel.',
        date: new Date()
      }));
      return;
    }
    // Hariharan
    await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
      message: 'SFTP Integration 13 file not exists. retry begins.',
      date: new Date()
    }));
    // retry logic ends

    let Client = require('ssh2-sftp-client');
    let sftp = new Client();
    let timeStamp = `${moment().format('YYYYMMDD')}13`;
    await sftp.connect({
      host: 'ftp.sats.com.sg',
      port: '22',
      username: 'MySATS_AD_PRD',
      password: 'mySatsprd!23',
      readyTimeout: 40000, // timeout increased to 40 seconds, previously its 20 seconds
      algorithms: {
        kex: ['diffie-hellman-group14-sha1']
      }
    }).then(() => {
      return sftp.list('/ADDailyExtractPRD');
    }).then(async (data) => {
      // Hariharan
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: 'SFTP Integration 13 starts',
        date: new Date()
      }));
      data = data || [];
      const filteredData = data.filter(v => -1 !== v.name.indexOf(`dailyMySATS${timeStamp}`));
      for (const d of filteredData) {
        // Hariharan
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: 'SFTP Integration 13 log 1',
          date: new Date()
        }));
        let daily = d.name;
        await sftp.get(`/ADDailyExtractPRD/${daily}`).then(async (fileData) => {
          // Hariharan
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: 'SFTP Integration 13 log 2',
            date: new Date()
          }));
          let writtenFileData = await fs.writeFileSync(`public/${daily}`, fileData);
          await spawn('unzip', ['-P', 'Daily@dm1n!', '-d', './public/', `./public/${daily}`]);
          // Hariharan
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: 'SFTP Integration 13 ends',
            date: new Date()
          }));
          //const resDaily = daily.split('.')[0] + '.csv';
          //await integration(resDaily, req, res);
        }, async (error) => {
          // Hariharan
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: 'SFTP Integration 13 ends with error',
            date: new Date(),
            detail: `${error}`
          }));
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify(error));
        });
      }
    }).catch(async (error) => {
      // Hariharan
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: 'SFTP Integration 13 error before starts',
        date: new Date(),
        detail: `${error}`
      }));
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify(error));
    });
  }
  async integrateNow13(req, res) {
    const currentFolder = "./public/";
    await fs.readdir(currentFolder, async (err, files) => {
      // Hariharan
      if (!!err) {
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: 'Integration 13 error',
          date: new Date(),
          detail: `${err}`
        }));
      }
      // Hariharan
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: 'Integration 13 starts',
        date: new Date()
      }));
      const currentDate = moment().format('YYYYMMDD') + '13';
      const myFiles = files.filter(v => -1 !== v.indexOf(currentDate) && v.includes('.csv'));
      if (myFiles.length) {
        // Hariharan
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: 'Integration 13 file exists length : ' + myFiles.length,
          date: new Date()
        }));
        for (const myFile of myFiles) {
          let resDaily = myFile.split('.')[0] + '.csv';
          await integration(resDaily, req, res);
        }
      } else {
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: 'File Not found',
          date: new Date()
        }));
      }
    });
  }
  async integrateNow04(req, res) {
    const currentFolder = "./public/";
    await fs.readdir(currentFolder, async (err, files) => {
      // Hariharan
      if (!!err) {
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: 'Integration 04 error',
          date: new Date(),
          detail: `${err}`
        }));
      }
      // Hariharan
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: 'Integration 04 starts',
        date: new Date()
      }));
      const today = moment().add(1, 'days').format('YYYYMMDD');
      const currentDate = `${today}07`;
      //const currentDate = moment().format('YYYYMMDD') + '04';
      const myFiles = files.filter(v => -1 !== v.indexOf(currentDate) && v.includes('.csv'));
      if (myFiles.length) {
        // Hariharan
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: 'Integration 04 file exists length : ' + myFiles.length,
          date: new Date()
        }));
        for (const myFile of myFiles) {
          let resDaily = myFile.split('.')[0] + '.csv';
          await integration(resDaily, req, res);
        }
      } else {
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: 'File Not found',
          date: new Date()
        }));
      }
    });
  }
  async integrateNow(req, res) {
    try {
      await integration('dailyMySATS20190924042020.csv', req, res);
    } catch (error) {
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: 'an error occurs',
        error: JSON.stringify(error),
        date: new Date()
      }));
    }
  }

  async updateLeaveQuota(resDaily, req, res) {
    let Client = require('ssh2-sftp-client');
    let sftp = new Client();
    let timeStamp = `${moment().add('days', 1).format('YYYYMMDD')}`;
    //let timeStamp = `${moment().format('YYYYMMDD')}`;

    let daily = '';
    const finalData = [];
    const failedData = [];
    const successData = [];
    await sftp.connect({
      host: 'ftp.sats.com.sg',
      port: '22',
      username: 'ftp_LBS_SF_MYSATS',
      password: 'YUyJ3JjcJG8uVT@@',
      readyTimeout: 720000,
      algorithms: {
        kex: ['diffie-hellman-group14-sha1']
      }
    }).then(() => {
      return sftp.list(`./O001/LBSQuota${timeStamp}.csv`);
    }).then(async (data) => {
      data = data || [];
      const filteredData = data.filter(v => -1 !== v.name.indexOf(`LBSQuota${timeStamp}.csv`));
      for (const d of filteredData) {
        daily = d.name;
        await sftp.get(`./O001/${daily}`).then(async (fileData) => {
          let writtenFileData = await fs.writeFileSync(`./public/${daily}`, fileData);
          await spawn('unzip', ['-P', 'Daily@dm1n!', '-d', './public/', `./O001/${daily}`]);
        }, async (error) => {
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify(error));
        });
        var resDaily = daily.split('.')[0];
        let serverFile = `./public/${daily}`;
        var columns = ["StaffID", "LeaveDataType", "Year", "Value"];
        require("csv-to-array")({
          file: serverFile,
          columns: columns
        }, async (err, userList) => {
          const companyData = await Company.findOne({
            pathName: 'sats'
          }).lean().select('_id');

          const lt = ['CFAL_SGP', 'Annual Leave']
          const leaveTypeDetails = await LeaveType.find({
            name: lt,
            companyId: companyData._id
          }).select('_id name');
          const ltDetails = {
            'AL _SGP': leaveTypeDetails.find(leave => leave.name === 'Annual Leave')._id,
            'CFAL_SGP': leaveTypeDetails.find(leave => leave.name === 'CFAL_SGP')._id
          };

          let logData = {
            newUsers: [],
            status: 'Success',
            sourcePath: 'Quota',
            errorFilePath: null,
            updatedUsers: [],
            errorMessage: '',
            companyId: companyData._id
          };
          if (err) {
            logData.status = 'File not found';
            logData.errorMessage = `File not found ${JSON.stringify(err)}`;
          }
          if (userList && userList.length !== 0) {

            userList.shift();
            const currentYear = moment().format('YYYY');
            const invalidDataList = [];
            const previousCurrentNextYear = [parseInt(currentYear) - 1, parseInt(currentYear), parseInt(currentYear) + 1];
            for (const user of userList) {
              let userData = '';
              const year = parseInt(user.Year) || 0;
              if (user.LeaveDataType !== 'AL _SGP' && user.LeaveDataType !== 'CFAL_SGP') {
                user.Reason = 'LeaveDataType is not matching';
                invalidDataList.push(user);
              } else if (!previousCurrentNextYear.includes(year)) {
                user.Reason = 'The year is neither Current, Previous nor Next year.';
                invalidDataList.push(user);
              } else if (parseInt(user.Value) < 0) {
                user.Reason = 'Levae value can not be negative';
                invalidDataList.push(user);
              } else {
                userData = await User.findOne({
                  staffId: user['StaffID']
                }, {
                  leaveGroupId: 1
                }).populate([{
                  path: "leaveGroupId",
                  match: {
                    isActive: true
                  },
                  select: "leaveType leaveTypeId",
                  populate: [{
                    path: 'leaveType leaveTypeId',
                    match: {
                      isActive: true,
                      name: user['Leave Type']
                    },
                    select: 'name'
                  }]
                }]);
                if (userData && userData.leaveGroupId && userData.leaveGroupId.leaveType) {
                  if (userData.leaveGroupId.leaveType && userData.leaveGroupId.leaveType.length > 0) {
                    let leaveType = userData.leaveGroupId.leaveType.filter((leave) => {
                      return leave && leave.leaveTypeId; // && leave.leaveTypeId.name == 'Annual Leave'
                    });
                    if (leaveType && leaveType.length > 0) {
                      const obj = {};
                      leaveType = leaveType[0];
                      obj.userId = userData._id;
                      obj.leaveGroupId = userData.leaveGroupId._id;
                      obj.leaveTypeId = ltDetails[user.LeaveDataType];
                      obj.quota = Number(user.Value);
                      obj.year = parseInt(user.Year);
                      const staffLeaveData = await staffLeave.findOne({
                        userId: obj.userId
                      });

                      let index = 0;
                      if (staffLeaveData) {
                        index = staffLeaveData.leaveDetails.findIndex((le) => {
                          return le.leaveTypeId.toString() == obj.leaveTypeId && le.year == obj.year;
                        });
                      }
                      let leaveDetails = {};
                      if (index != -1 && staffLeaveData && staffLeaveData.leaveDetails.length !== 0) {
                        leaveDetails = staffLeaveData.leaveDetails[index];
                        const inc = obj.quota - leaveDetails.total;
                        staffLeaveData.leaveDetails[index].total = obj.quota;
                        staffLeaveData.leaveDetails[index].request += inc;
                        staffLeaveData.leaveDetails[index].taken += inc;
                        staffLeaveData.leaveDetails[index].planDymanicQuota += inc;
                        staffLeaveData.leaveDetails[index].quota += inc;
                        staffLeaveData.leaveDetails[index].planQuota += inc;
                        const saveDD = await staffLeaveData.save()
                      } else {
                        leaveDetails = {
                          leaveTypeId: obj.leaveTypeId,
                          request: 0,
                          taken: 0,
                          total: obj.quota,
                          planDymanicQuota: obj.quota,
                          planQuota: obj.quota,
                          quota: obj.quota,
                          year: obj.year
                        }

                        if (staffLeaveData && staffLeaveData.leaveDetails) {
                          var newArray = staffLeaveData.leaveDetails.concat([leaveDetails])
                          staffLeaveData.leaveDetails = newArray
                          const saveDD1 = await staffLeaveData.save();
                          user.Reason = '';
                          successData.push(obj);
                          user.Reason = ''
                          successData.push(obj);
                        } else {
                          user.Reason = 'Leave Group is not updated for this user in our DB';
                          invalidDataList.push(user);
                        }
                      }
                    } else {
                      user.message = 'Something went wrong';
                      invalidDataList.push(user);
                      failedData.push(user);
                    }
                  } else {
                    user.message = 'Leave Type not found';
                    failedData.push(user);
                  }
                } else {
                  user.Reason = 'Staff ID is not matching with our DB';
                  if (userData && !userData.leaveGroupId) {
                    user.Reason = 'This user does not belong to any Leave Group';
                  }
                  invalidDataList.push(user);
                }
              }
            }
            if (invalidDataList.length !== 0) {
              const updatedUsers = [];
              const nonUpdatedUsers = [];
              userList.forEach(user => {
                if (user.Reason) {
                  nonUpdatedUsers.push(user.Reason);
                } else {
                  updatedUsers.push(user.StaffID)
                }
              });
              var columns = ['StaffID', 'LeaveDataType', 'Year', 'Value', 'Reason'];
              let fileName = `NonUpdatedQuotaData${moment().add('days', 1).format('YYYYMMDD')}`;
              logData.updatedUsers = updatedUsers;
              logData.nonUpdatedUsers = nonUpdatedUsers;
              logData.status = 'Partially completed';
              logData.errorFilePath = `/LBSQuota/${fileName}.csv`;
              logData.companyId = companyData._id;

              var csv = json2csv({
                data: invalidDataList,
                fields: columns
              });
              await fs.writeFile(`./public/LBSQuota/${fileName}.csv`, csv, (err) => {
                if (err) {
                  __.log('json2csv err' + err);
                }
              });

              const response = await new Integration(logData).save();
            } else {
              const updatedUsers = [];
              const nonUpdatedUsers = [];
              userList.forEach((user, index) => {
                if (user.Reason) {
                  nonUpdatedUsers.push(user.Reason);
                } else {
                  updatedUsers.push(user.StaffID)
                }
              });
              var columns = ['StaffID', 'LeaveDataType', 'Year', 'Value', 'Reason'];
              let fileName = `NonUpdatedQuotaData${moment().add('days', 1).format('YYYYMMDD')}`;
              logData.updatedUsers = updatedUsers;
              logData.nonUpdatedUsers = nonUpdatedUsers;
              logData.status = 'Success';
              var csv = json2csv({
                data: invalidDataList,
                fields: columns
              });
              await fs.writeFile(`./public/LBSQuota/${fileName}.csv`, csv, (err) => {
                if (err) {
                  __.log('json2csv err' + err);
                }
              });
              await new Integration(logData).save();
              await fs.appendFileSync('./public/integration/integration.log', JSON.stringify(logData));
            }
          }
        });
      }
    });
  }

  async uploadLBSPlanCSV(req, res) {
    try {
      const startDate = `${moment().format('YYYY-MM-DD')}T00:00:00.000Z`;
      const endDate = `${moment().add('days', 28).format('YYYY-MM-DD')}T00:00:00.0000Z`;
      let leaveList = await LeaveApplied.find({
        $and: [{
          startDate: {
            $gte: startDate
          }
        }, {
          startDate: {
            $lte: endDate
          }
        }, {
          flag: {
            $ne: true
          }
        }],
        $or: [{
          submittedFrom: {
            $in: [3, 4]
          }
        },
        {
          submittedFrom: 2,
          status: {
            $in: [1, 7, 8, 9]
          }
        },
        ]
      })
        .populate([{
          path: "userId",
          select: "staffId companyId"
        }]).select('startDate endDate');
      const preparePladDataCSV = [];

      if (leaveList && leaveList.length !== 0) {
        const prepareDataForCSV = [];
        for (const leave of leaveList) {
          if (leave && leave.userId && leave.userId.companyId == '5a9d162b36ab4f444b4271c8') {
            prepareDataForCSV.push({
              StaffID: leave.userId.staffId,
              MySATS_TxID: leave._id,
              LeaveStartDate: moment(leave.startDate).format('YYYYMMDD'),
              LeaveEndDate: moment(leave.endDate).format('YYYYMMDD')
            });
          }
        }
        const columns = ['StaffID', 'MySATS_TxID', 'LeaveStartDate', 'LeaveEndDate'];
        const csv = json2csv({
          data: prepareDataForCSV,
          fields: columns
        });
        const fileName = `./I001/LBSPlan${moment().add('days', 1).format('YYYYMMDD')}.csv`;
        const Client = require('ssh2-sftp-client');
        const sftp = new Client();
        await sftp.connect({
          host: 'ftp.sats.com.sg',
          port: '22',
          username: 'ftp_LBS_SF_MYSATS',
          password: 'YUyJ3JjcJG8uVT@@',
          readyTimeout: 180000,
          algorithms: {
            kex: ['diffie-hellman-group14-sha1']
          }
        })

          .then(async () => {
            for (const leave of prepareDataForCSV) {
              await LeaveApplied.findOneAndUpdate({
                _id: leave.MySATS_TxID
              }, {
                $set: {
                  flag: true
                }
              });
            }
            return sftp.put(Buffer.from(csv), fileName);
          })
          .then(async () => {
            //      await LeaveApplied.findOneAndUpdate({ _id: prepareDataForCSV.map(leave => leave.MySATS_TxID) },{ $set: { flag: true }});
            return sftp.end();
          })
          .catch(err => { });
      } else {

        const columns = ['StaffID', 'MySATS_TxID', 'LeaveStartDate', 'LeaveEndDate'];
        const csv = json2csv({
          data: [],
          fields: columns
        });
        const fileName = `./I001/LBSPlan${moment().add('days', 1).format('YYYYMMDD')}.csv`;
        const Client = require('ssh2-sftp-client');
        const sftp = new Client();
        await sftp.connect({
          host: 'ftp.sats.com.sg',
          port: '22',
          username: 'ftp_LBS_SF_MYSATS',
          password: 'YUyJ3JjcJG8uVT@@',
          algorithms: {
            kex: ['diffie-hellman-group14-sha1']
          }
        })
          .then((data) => {
            return sftp.put(Buffer.from(csv), fileName);
          })
          .then(async (fileUploaded) => {
            return sftp.end();
          })
          .catch(err => { });
      }

    } catch (error) { }
  }

  async sftpLBSApproveToUploadFileLocally() {
    const currentFolder = "./public/approve/";
    const files = await fs.readdirSync(currentFolder);
    const fileName = `lbsApprove${moment().add('days', 1).format('YYYYMMDD')}.csv`;

    // const fileName = `lbsApprove${moment().format('YYYYMMDD')}.csv`;
    const myFiles = files.filter(v => -1 !== v.indexOf(fileName) && v.includes('.csv'));
    // If file exist then return the function
    if (myFiles.length) {
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: `SFTP Approve file already exists. retry cancel for fileName: ${fileName}`,
        date: new Date()
      }));
      return;
    }
    // If file doesn't exist then try again
    await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
      message: `SFTP Approve file Start, fileName: ${fileName}`,
      date: new Date()
    }));

    let Client = require('ssh2-sftp-client');
    let sftp = new Client();
    // let timeStamp = `${moment().format('YYYYMMDD')}`;
    let timeStamp = `${moment().add('days', 1).format('YYYYMMDD')}`;
    const start = new Date();

    await sftp.connect({
      host: 'ftp.sats.com.sg',
      port: '22',
      username: 'ftp_LBS_SF_MYSATS',
      password: 'YUyJ3JjcJG8uVT@@',
      readyTimeout: 180000,
      algorithms: {
        kex: ['diffie-hellman-group14-sha1']
      }
    }).then(() => {
      return sftp.list(`O002/LBSApproved${timeStamp}.csv`);
    }).then(async (data) => {
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: `SFTP LBSApprove starts, timeStamp: ${timeStamp}`,
        date: new Date()
      }));
      data = data || [];
      const filteredData = data.filter(v => -1 !== v.name.indexOf(`LBSApproved${timeStamp}`));

      for (const d of filteredData) {
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: `SFTP LBSApprove log 1, timeStamp: ${timeStamp}`,
          date: new Date()
        }));
        let daily = d.name;
        await sftp.get(`./O002/${daily}`).then(async (fileData) => {
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: `SFTP LBSApprove log 2, timeStamp: ${timeStamp}`,
            date: new Date()
          }));

          await spawn('unzip', ['-P', 'Daily@dm1n!', '-d', './public/', `./public/${daily}`]);
          await fs.writeFileSync(`public/approve/lbsApprove${timeStamp}.csv`, fileData);
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: `SFTP LBSApprove ends: timeStamp ${timeStamp}`,
            date: new Date()
          }));
        }, async (error) => {
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: `SFTP LBSApprove ends with error ${fileName}`,
            date: new Date(),
            detail: `${error}`
          }));
        });
      }
    }).catch(async (error) => {
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: 'SFTP LBSApprove error before starts',
        date: new Date(),
        detail: `${error}`
      }));
    });
  }

  async lbsApproveProccessCSV() {
    try {
      const timeStamp = moment().add('days', 1).format('YYYYMMDD');
      //const timeStamp = moment().format('YYYYMMDD');
      const serverFile = `./public/approve/lbsApprove${timeStamp}.csv`;
      let companyData = null;

      const columns = ['StaffID', 'SF_TxID', 'AbsencesType', 'AbsenceStartDate', 'AbsenceStartTime', 'AbsenceEndDate', 'AbsenceDuration', 'Status', 'MySATS_TxID'];

      let results = [];
      try {
        if (fs.existsSync(serverFile)) {
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: `LBSApprove file exist, timeStamp: ${timeStamp}`,
            date: new Date()
          }));
        } else {
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: `LBSApprove file does not exist, timeStamp: ${timeStamp}`,
            date: new Date()
          }));
          return;
        }
      } catch (error) {
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: `Caught an error in first catch block  timeStamp: ${timeStamp}, error: ${error}`,
          date: new Date()
        }));
      }
      const start = new Date();
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: `LBSApprove file reading start!, timeStamp: ${timeStamp}`,
        date: new Date()
      }));
      fs.createReadStream(serverFile)
        .pipe(csv(columns))
        .on('data', (data) => results.push(data))
        .on('end', async () => {

          require("csv-to-array")({
            file: serverFile,
            columns: columns
          }, async (err, userData) => {
            if (err) {
              return false;
            }

            let approvalUser = await User.findOne({
              staffId: {
                $in: 'admin001'
              }
            }, {
              staffId: 1,
              name: 1
            });

            const companyData = await Company.findOne({
              pathName: 'sats'
            }).lean().select('_id');

            let logData = {
              newUsers: [],
              status: 'Success',
              sourcePath: 'Approve',
              errorFilePath: null,
              updatedUsers: [],
              nonUpdatedUsers: [],
              errorMessage: '',
              companyId: companyData._id
            };

            let userList = JSON.parse(JSON.stringify(userData));
            if (userList && userList.length > 1) {
              //Removed Excel Headers
              userList = userList.splice(1, userList.length - 1);
              //Conver and get all the leave names
              const leaveTypesFromExcel = [...new Set(userList.map(e => e.AbsencesType === "AALV" ? "Annual Leave" : e.AbsencesType))]
              //Get Leave IDs.
              const leaveTypeData = await LeaveType.find({
                name: {
                  $in: leaveTypesFromExcel
                },
                companyId: mongoose.Types.ObjectId("5a9d162b36ab4f444b4271c8")
              }, {
                name: 1
              })
              //Get all staffIds from Excel
              const staffIds = [...new Set(userList.map(e => e.StaffID))]
              //Get records of user row by row from excel
              let userData = await User.find({
                staffId: {
                  $in: staffIds
                },
                companyId: mongoose.Types.ObjectId("5a9d162b36ab4f444b4271c8")
              }, {
                staffId: 1,
                parentBussinessUnitId: 1,
                leaveGroupId: 1
              })
              const SF_TxIDFromExcel = [...new Set(userList.map(e => e.SF_TxID))]
              //Check SF_TxID present or not
              let checkForSF_TxIDInDb = await LeaveApplied.find({
                SF_TxID: {
                  $in: SF_TxIDFromExcel
                }
              }, {
                SF_TxID: 1
              });
              const dataToBeAdded = [];

              const invalidUserEntry = [];
              const createUserEntry = [];
              const updateUserEntry = [];
              let count = 0;
              for (const user of userList) {
                const startDate = moment(user.AbsenceStartDate, 'YYYYMMDD');
                const endDate = moment(user.AbsenceEndDate, 'YYYYMMDD');
                if (endDate.diff(startDate, 'days') < 0) {
                  user.Reason = 'Leave Start date is later than Leave End date';
                  invalidUserEntry.push(user);
                } else {
                  user.status = user.status || user.Status;
                  let leaveTypeName = user.AbsencesType === "AALV" ? "Annual Leave" : user.AbsencesType;
                  let foundUser = await User.findOne({
                    staffId: user.StaffID,
                    companyId: mongoose.Types.ObjectId("5a9d162b36ab4f444b4271c8")
                  }, {
                    staffId: 1,
                    leaveGroupId: 1
                  })

                  const csvStatus = user.status ? user.status.toLowerCase() : userStatus;
                  let isSFTxIDExist = ''
                  if (csvStatus == 'cancelled') {
                    isSFTxIDExist = await LeaveApplied.findOne({ SF_TxID: user.SF_TxID }, { SF_TxID: 1 });
                  }
                  
                  if (!foundUser || Object.keys(foundUser).length === 0 || leaveTypeData.length === 0) {
                    user.Reason = 'StaffID is not matching';
                    invalidUserEntry.push(user);
                  } else if (csvStatus == 'cancelled' && (!isSFTxIDExist)) {
                    // Skip if SF_TxID is not found in DB and status is cancelled
                    console.log("========== Skip if SF_TxID is not found in DB and status is cancelled ===========");
                    user.Reason = 'No previous leave record found for this cancelled leave.';
                    invalidUserEntry.push(user);
                  } else {
                    //Check user in DB if not found then no operation will be performed.
                    if (foundUser.staffId === user.StaffID) {
                      //Create new Record if MySATS_TxID And SF_TxID are not present in excel
                      const temp = checkForSF_TxIDInDb.some(e => e.SF_TxID === user.SF_TxID)
                      if (!user.MySATS_TxID && user.StaffID && !checkForSF_TxIDInDb.some(e => e.SF_TxID === user.SF_TxID)) {
                        //Create new Record if MySATS_TxID And SF_TxID are not present in excel
                        // if (!checkForSF_TxIDInDb.some(e => e.SF_TxID === user.SF_TxID)) {
                        const checkUser = await staffLeave.findOne({
                          userId: mongoose.Types.ObjectId(foundUser._id)
                        }, {
                          _id: 1
                        });
                        if (checkUser) {
                          let obj = {}
                          obj.SF_TxID = user.SF_TxID;
                          const leaveTypeId = leaveTypeData.find(e => e.name === leaveTypeName);
                          const leaveIdd = leaveTypeId && Object.keys(leaveTypeId).length ? mongoose.Types.ObjectId(leaveTypeId._id) : "";
                          const parsedYear = parseInt(user.AbsenceStartDate.substr(0, 4));
                          const quotaValue = parseFloat(user.AbsenceDuration);
                          obj.leaveTypeId = leaveTypeId && Object.keys(leaveTypeId).length ? leaveTypeId._id : ""
                          obj.leaveGroupId = userData.find(e => e.staffId === user.StaffID)['leaveGroupId']
                          obj.userId = userData.find(e => e.staffId === user.StaffID)['_id']
                          obj.startDate = moment(user.AbsenceStartDate.substr(0, 4) + '-' + user.AbsenceStartDate.substr(4, 2) + '-' + user.AbsenceStartDate.substr(6, 2), "YYYY-MM-DD HH:mm:ss Z").utc().format();
                          obj.endDate = moment(user.AbsenceEndDate.substr(0, 4) + '-' + user.AbsenceEndDate.substr(4, 2) + '-' + user.AbsenceEndDate.substr(6, 2), "YYYY-MM-DD HH:mm:ss Z").utc().format();

                          obj.AbsenceStartTime = user.AbsenceStartTime
                          obj.totalDay = user.AbsenceDuration
                          obj.totalDeducated = user.AbsenceDuration
                          obj.timeZone = "+0530"
                          obj.submittedFrom = 1
                          obj.businessUnitId = userData.find(e => e.staffId === user.StaffID)['parentBussinessUnitId']
                          obj.status = user.status.toLowerCase() === 'cancelled' ? 5 : user.status.toLowerCase() === 'approved' ? 1 : 0;
                          if (user.status.toLowerCase() === 'cancelled') {
                            obj.cancelledBy = mongoose.Types.ObjectId(approvalUser._id)
                            obj.cancelledDateTime = moment().utc().format()
                          } else {
                            obj.approvalHistory = [{
                              "approvalBy": mongoose.Types.ObjectId(approvalUser._id),
                              "status": 1,
                              "approvalFrom": 1,
                              "approvalRemark": "System Approved",
                              "approvalDateTime": moment().utc().format(),
                              "name": approvalUser.name
                            }]
                          }

                          if (leaveTypeData.find(e => e.name === leaveTypeName)) {
                            try {
                              await staffLeave.update({
                                userId: mongoose.Types.ObjectId(foundUser._id),
                                leaveDetails: {
                                  $elemMatch: {
                                    leaveTypeId: leaveIdd,
                                    year: parsedYear
                                  }
                                }
                              }, {
                                $inc: {
                                  "leaveDetails.$.planQuota": -(quotaValue),
                                  "leaveDetails.$.quota": -(quotaValue)
                                }
                              }, {
                                safe: true,
                                upsert: true
                              });
                              dataToBeAdded.push(obj);
                              createUserEntry.push(user);
                            } catch (error) {
                              user.Reason = 'This Leave type is not present for this year for this user.';
                              invalidUserEntry.push(user);
                            }
                          } else {
                            user.Reason = 'Leave group not assigned to this user';
                            invalidUserEntry.push(user);
                          }
                        } else {
                          user.Reason = 'Leave group not assigned to this user';
                          invalidUserEntry.push(user);
                        }
                      } else {
                        if (checkForSF_TxIDInDb.length && !checkForSF_TxIDInDb.some(e => e.SF_TxID === user.SF_TxID) && user.status.toLowerCase() === 'cancelled') {
                          user.Reason = 'This leave record is not present in our DB for this user';
                          invalidUserEntry.push(user);
                        } else {
                          const userDetail = await User.findOne({
                            staffId: user['StaffID']
                          });
                          if (userDetail && userDetail.leaveGroupId) {
                            let cancelledBy;
                            let approvalHistory = [];
                            let cancelledDateTime = moment().utc().format();

                            if (user.status.toLowerCase() === 'cancelled') {
                              cancelledBy = mongoose.Types.ObjectId(approvalUser._id)
                            } else {
                              approvalHistory = [{
                                "approvalBy": mongoose.Types.ObjectId(approvalUser._id),
                                "status": 1,
                                "approvalFrom": 1,
                                "approvalRemark": "System Approved",
                                "approvalDateTime": moment().utc().format(),
                                "name": approvalUser.name
                              }]
                            }
                            const status = user.status.toLowerCase() === 'approved' ? 1 : 5;
                            const startDate = `${moment(user.AbsenceStartDate).format('YYYY-MM-DD')}T00:00:00.000Z`;
                            const endDate = `${moment(user.AbsenceEndDate).format('YYYY-MM-DD')}T00:00:00.000Z`;
                            const leaveTypeId = leaveTypeData.find(e => e.name === leaveTypeName);
                            const leaveIdd = leaveTypeId && Object.keys(leaveTypeId).length ? mongoose.Types.ObjectId(leaveTypeId._id) : "";
                            const parsedYear = parseInt(user.AbsenceStartDate.substr(0, 4));
                            let quotaValue = parseFloat(user.AbsenceDuration);
                            const checkUser = await staffLeave.findOne({
                              userId: mongoose.Types.ObjectId(foundUser._id)
                            }, {
                              _id: 1
                            });

                            if (checkUser) {
                              if (leaveTypeData.find(e => e.name === leaveTypeName)) {
                                //Update for Approved
                                if (approvalHistory.length) {
                                  let checkForMySATS_TxID;
                                  //Check if MySATS_TxID is presendt in Excel
                                  if (user.MySATS_TxID.length) {
                                    await LeaveApplied.update({
                                      _id: mongoose.Types.ObjectId(user.MySATS_TxID)
                                    }, {
                                      $set: {
                                        status: status,
                                        SF_TxID: user.SF_TxID,
                                        submittedFrom: 1,
                                        approvalHistory: approvalHistory,
                                        startDate: startDate,
                                        endDate: endDate,
                                        totalDay: user.AbsenceDuration,
                                        totalDeducated: user.AbsenceDuration
                                      }
                                    }, {
                                      new: true
                                    });
                                    try {
                                      await staffLeave.update({
                                        userId: mongoose.Types.ObjectId(foundUser._id),
                                        leaveDetails: {
                                          $elemMatch: {
                                            leaveTypeId: leaveIdd,
                                            year: parsedYear
                                          }
                                        }
                                      }, {
                                        $inc: {
                                          "leaveDetails.$.planQuota": -(quotaValue),
                                          "leaveDetails.$.quota": -(quotaValue)
                                        }
                                      }, {
                                        safe: true,
                                        upsert: true
                                      });
                                    } catch (error) {
                                      user.Reason = 'This Leave type is not present for this year for this user.';
                                      invalidUserEntry.push(user);
                                    }
                                  } else {
                                    //Check if SF_TxID present in DB for Approved
                                    checkForMySATS_TxID = await LeaveApplied.find({
                                      SF_TxID: user.SF_TxID
                                    }, {
                                      _id: 1,
                                      startDate: 1,
                                      endDate: 1
                                    });

                                    if (checkForMySATS_TxID) {
                                      // Database leave startDate and endDate
                                      const leave = checkForMySATS_TxID[0]
                                      const start = moment(leave.startDate);
                                      const end = moment(leave.endDate);
                                      // Difference between startDate and endDate 
                                      const dif = end.diff(start, 'days') + 1;

                                      // If difference between database duration and csv duration or not same then will calculate quotaValue else quotaValue will be 0
                                      if (dif !== user.AbsenceDuration) {
                                        if (dif < user.AbsenceDuration) {
                                          quotaValue = user.AbsenceDuration - dif;
                                        } else {
                                          quotaValue = dif - user.AbsenceDuration;
                                          quotaValue = -quotaValue;
                                        }
                                      } else {
                                        quotaValue = 0
                                      }

                                      await LeaveApplied.update({
                                        SF_TxID: user.SF_TxID
                                      }, {
                                        $set: {
                                          status: status,
                                          SF_TxID: user.SF_TxID,
                                          submittedFrom: 1,
                                          approvalHistory: approvalHistory,
                                          startDate: startDate,
                                          endDate: endDate,
                                          totalDay: user.AbsenceDuration,
                                          totalDeducated: user.AbsenceDuration
                                        }
                                      }, {
                                        new: true
                                      });
                                      try {

                                        await staffLeave.update({
                                          userId: mongoose.Types.ObjectId(foundUser._id),
                                          leaveDetails: {
                                            $elemMatch: {
                                              leaveTypeId: leaveIdd,
                                              year: parsedYear
                                            }
                                          }
                                        }, {
                                          $inc: {
                                            "leaveDetails.$.planQuota": -(quotaValue),
                                            "leaveDetails.$.quota": -(quotaValue)
                                          }
                                        }, {
                                          safe: true,
                                          upsert: true
                                        });

                                        updateUserEntry.push(user);
                                      } catch (error) {
                                        user.Reason = 'This Leave type is not present for this year for this user.';
                                        invalidUserEntry.push(user);
                                      }
                                    } else {
                                      user.Reason = 'SF_TxID is not present so ignoring for Approved';
                                      invalidUserEntry.push(user);
                                    }
                                  }
                                } else {
                                  //Update for Cancelled
                                  let checkForMySATS_TxID;
                                  if (user.MySATS_TxID.length) {
                                    await LeaveApplied.update({
                                      _id: mongoose.Types.ObjectId(user.MySATS_TxID)
                                    }, {
                                      $set: {
                                        status: status,
                                        SF_TxID: user.SF_TxID,
                                        submittedFrom: 1,
                                        cancelledBy: cancelledBy,
                                        cancelledDateTime: cancelledDateTime,
                                        startDate: startDate,
                                        endDate: endDate,
                                        totalDay: user.AbsenceDuration,
                                        totalDeducated: user.AbsenceDuration
                                      }
                                    }, {
                                      new: true
                                    });
                                    try {
                                      await staffLeave.update({
                                        userId: mongoose.Types.ObjectId(foundUser._id),
                                        leaveDetails: {
                                          $elemMatch: {
                                            leaveTypeId: leaveIdd,
                                            year: parsedYear
                                          }
                                        }
                                      }, {
                                        $inc: {
                                          "leaveDetails.$.planQuota": quotaValue,
                                          "leaveDetails.$.quota": quotaValue
                                        }
                                      }, {
                                        safe: true,
                                        upsert: true
                                      });
                                    } catch (error) {
                                      user.Reason = 'This Leave type is not present for this year for this user.';
                                      invalidUserEntry.push(user);
                                    }
                                  } else {
                                    //Check SF_TxID in DB for cancelled
                                    checkForMySATS_TxID = await LeaveApplied({
                                      SF_TxID: user.SF_TxID
                                    }, {
                                      _id: 1
                                    });
                                    if (checkForMySATS_TxID) {
                                      await LeaveApplied.update({
                                        SF_TxID: user.SF_TxID
                                      }, {
                                        $set: {
                                          status: status,
                                          SF_TxID: user.SF_TxID,
                                          submittedFrom: 1,
                                          cancelledBy: cancelledBy,
                                          cancelledDateTime: cancelledDateTime,
                                          startDate: startDate,
                                          endDate: endDate,
                                          totalDay: user.AbsenceDuration,
                                          totalDeducated: user.AbsenceDuration
                                        }
                                      }, {
                                        new: true
                                      });
                                      try {
                                        await staffLeave.update({
                                          userId: mongoose.Types.ObjectId(foundUser._id),
                                          leaveDetails: {
                                            $elemMatch: {
                                              leaveTypeId: leaveIdd,
                                              year: parsedYear
                                            }
                                          }
                                        }, {
                                          $inc: {
                                            "leaveDetails.$.planQuota": quotaValue,
                                            "leaveDetails.$.quota": quotaValue
                                          }
                                        }, {
                                          safe: true,
                                          upsert: true
                                        });
                                        updateUserEntry.push(user);
                                      } catch (error) {
                                        user.Reason = 'This Leave type is not present for this year for this user.';
                                        invalidUserEntry.push(user);
                                      }
                                    } else {
                                      user.Reason = 'SF_TxID is not present so ignoring for cancelled.';
                                      invalidUserEntry.push(user);
                                    }
                                  }
                                }
                              } else {
                                user.Reason = 'This Leave Type is not present';
                                invalidUserEntry.push(user);
                              }
                            } else {
                              user.Reason = "This leave Type is not present";
                              invalidUserEntry.push(user);
                            }
                          } else {
                            user.Reason = 'Leave group not assigned to this user.';
                            invalidUserEntry.push(user);
                          }
                        }
                      }
                    } else {
                      user.Reason = 'StaffId not found';
                      invalidUserEntry.push(user);
                    }
                  }
                }
              }

              const end = new Date();
              await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
                message: `LBSApprove file reading End!, timeStamp: ${timeStamp}`,
                date: new Date()
              }));

              await LeaveApplied.insertMany(dataToBeAdded)
              var columns = ['StaffID', 'SF_TxID', 'AbsencesType', 'AbsenceStartDate', 'AbsenceStartTime', 'AbsenceEndDate', 'AbsenceDuration', 'Status', 'MySATS_TxID', 'Reason'];
              const createdUser = [];
              const updatedUser = [];
              const failedUser = [];

              createUserEntry.forEach(user => {
                updatedUser.push(user.StaffID);
              });
              updateUserEntry.forEach(user => {
                updatedUser.push(user.StaffID);
              });
              invalidUserEntry.forEach(user => {
                failedUser.push(user.Reason);
              });

              //const fileName = `NonUpdatedApprovedData${moment().format('YYYYMMDD')}`;
              const fileName = `NonUpdatedApprovedData${moment().add('days', 1).format('YYYYMMDD')}`;
              if (invalidUserEntry.length !== 0) {
                logData.updatedUsers = updatedUser;
                logData.nonUpdatedUsers = failedUser;
                logData.status = 'Partially completed';
                logData.errorFilePath = `/LBSQuota/${fileName}.csv`;
                logData.noOfNewUsers = createdUser;
                var csv = json2csv({
                  data: invalidUserEntry,
                  fields: columns
                });
                await fs.writeFile(`./public/LBSQuota/${fileName}.csv`, csv, (err) => {
                  if (err) {
                    __.log('json2csv err' + err);
                  }
                });

                await new Integration(logData).save();
              } else {
                logData.failedUpdateUsers = failedUser;
                logData.updatedUsers = updatedUser;
                logData.nonUpdatedUsers = invalidUserEntry;
                logData.status = 'SUCCESS';
                logData.noOfNewUsers = createdUser;
                logData.errorFilePath = `/LBSQuota/${fileName}.csv`;
                var csv = json2csv({
                  data: [],
                  fields: []
                });
                await fs.writeFile(`./public/LBSQuota/${fileName}.csv`, csv, (err) => {
                  if (err) {
                    __.log('json2csv err' + err);
                  }
                });
                await fs.appendFileSync('./public/integration/integration.log', JSON.stringify(logData));
                await new Integration(logData).save();
              }
            }
          });
        });
    } catch (error) {
      __.log(error)
    }
  }

  async sftpLBSQuotaToUploadFileLocally() {
    const currentFolder = "./public/quota/";
    const files = await fs.readdirSync(currentFolder);
    const fileName = `lbsQuota${moment().add('days', 1).format('YYYYMMDD')}.csv`;

    // const fileName = `LBSQuota${moment().format('YYYYMMDD')}.csv`;
    const myFiles = files.filter(v => -1 !== v.indexOf(fileName) && v.includes('.csv'));
    // If file exist then return the function
    if (myFiles.length) {
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: `SFTP Quota file already exists. retry cancel for fileName: ${fileName}`,
        date: new Date()
      }));
      return;
    }

    // If file doesn't exist then try again
    await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
      message: `SFTP Quota file Start, fileName: ${fileName}`,
      date: new Date()
    }));

    let Client = require('ssh2-sftp-client');
    let sftp = new Client();
    // let timeStamp = `${moment().format('YYYYMMDD')}`;
    let timeStamp = `${moment().add('days', 1).format('YYYYMMDD')}`;
    const start = new Date();

    await sftp.connect({
      host: 'ftp.sats.com.sg',
      port: '22',
      username: 'ftp_LBS_SF_MYSATS',
      password: 'YUyJ3JjcJG8uVT@@',
      readyTimeout: 720000,
      algorithms: {
        kex: ['diffie-hellman-group14-sha1']
      }
    }).then(() => {
      return sftp.list(`O001/LBSQuota${timeStamp}.csv`);
    }).then(async (data) => {
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: `SFTP LBSQuota starts, timeStamp: ${timeStamp}`,
        date: new Date()
      }));
      data = data || [];
      const filteredData = data.filter(v => -1 !== v.name.indexOf(`LBSQuota${timeStamp}`));
      for (const d of filteredData) {
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: `SFTP LBSQuota log 1, timeStamp: ${timeStamp}`,
          date: new Date()
        }));
        let daily = d.name;
        await sftp.get(`./O001/${daily}`).then(async (fileData) => {
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: `SFTP LBSQuota log 2, timeStamp: ${timeStamp}`,
            date: new Date()
          }));

          await spawn('unzip', ['-P', 'Daily@dm1n!', '-d', './public/', `./public/${daily}`]);
          await fs.writeFileSync(`public/quota/LBSQuota${timeStamp}.csv`, fileData);

          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: `SFTP LBSQuota ends: timeStamp ${timeStamp}`,
            date: new Date()
          }));
          const end = new Date()
        }, async (error) => {
          await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
            message: `SFTP LBSQuota ends with error ${fileName}`,
            date: new Date(),
            detail: `${error}`
          }));
        });
      }
    }).catch(async (error) => {
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: 'SFTP LBSQuota error before starts',
        date: new Date(),
        detail: `${error}`
      }));
    });
  }

  async lbsQuotaProccessCSV() {
    let timeStamp = `${moment().add('days', 1).format('YYYYMMDD')}`;
    //let timeStamp = `${moment().format('YYYYMMDD')}`;
    const serverFile = `./public/quota/LBSQuota${timeStamp}.csv`;
    var columns = ["StaffID", "LeaveDataType", "Year", "Value"];
    let daily = '';
    const finalData = [];
    const failedData = [];
    const successData = [];
    let results = [];
    try {
      if (fs.existsSync(serverFile)) {
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: `LBSQuota file exist, timeStamp: ${timeStamp}`,
          date: new Date()
        }));
      } else {
        await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
          message: `LBSQuota file does not exist, timeStamp: ${timeStamp}`,
          date: new Date()
        }));
        return;
      }
    } catch (error) {
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: `Caught an error in first catch block  timeStamp: ${timeStamp}, error: ${error}`,
        date: new Date()
      }));
    }
    try {
      const start = new Date();
      await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({
        message: `LBSQuota file reading start!, timeStamp: ${timeStamp}`,
        date: new Date()
      }));
      //data = data || [];
      //const filteredData = data.filter(v => -1 !== v.name.indexOf(`LBSQuota${timeStamp}.csv`));

      fs.createReadStream(serverFile)
        .pipe(csv(columns))
        .on('data', (data) => results.push(data))

        .on('end', async () => {
          require("csv-to-array")({
            file: serverFile,
            columns: columns
          }, async (err, userData) => {

            const companyData = await Company.findOne({
              pathName: 'sats'
            }).lean().select('_id');

            const lt = ['CFAL_SGP', 'Annual Leave']
            const leaveTypeDetails = await LeaveType.find({
              name: lt,
              companyId: companyData._id
            }).select('_id name');
            const ltDetails = {
              'AL _SGP': leaveTypeDetails.find(leave => leave.name === 'Annual Leave')._id,
              'CFAL_SGP': leaveTypeDetails.find(leave => leave.name === 'CFAL_SGP')._id
            };

            let logData = {
              newUsers: [],
              status: 'Success',
              sourcePath: 'Quota',
              errorFilePath: null,
              updatedUsers: [],
              errorMessage: '',
              companyId: companyData._id
            };

            let userList = results

            if (err) {
              logData.status = 'File not found';
              logData.errorMessage = `File not found ${JSON.stringify(err)}`;
            }
            if (userList && userList.length !== 0) {
              userList.shift();
              const currentYear = moment().format('YYYY');
              const invalidDataList = [];
              const previousCurrentNextYear = [parseInt(currentYear) - 1, parseInt(currentYear), parseInt(currentYear) + 1];
              let count = 0
              for (const user of userList) {
                let userData = '';
                const year = parseInt(user.Year) || 0;
                if (user.LeaveDataType !== 'AL _SGP' && user.LeaveDataType !== 'CFAL_SGP') {
                  user.Reason = 'LeaveDataType is not matching';
                  invalidDataList.push(user);
                } else if (!previousCurrentNextYear.includes(year)) {
                  user.Reason = 'The year is neither Current, Previous nor Next year.';
                  invalidDataList.push(user);
                } else if (parseInt(user.Value) < 0) {
                  user.Reason = 'Levae value can not be negative';
                  invalidDataList.push(user);
                } else {
                  userData = await User.findOne({
                    staffId: user['StaffID']
                  }, {
                    leaveGroupId: 1
                  }).populate([{
                    path: "leaveGroupId",
                    match: {
                      isActive: true
                    },
                    select: "leaveType leaveTypeId",
                    populate: [{
                      path: 'leaveType leaveTypeId',
                      match: {
                        isActive: true,
                        name: user['Leave Type']
                      },
                      select: 'name'
                    }]
                  }]);
                  if (userData && userData.leaveGroupId && userData.leaveGroupId.leaveType) {
                    if (userData.leaveGroupId.leaveType && userData.leaveGroupId.leaveType.length > 0) {
                      let leaveType = userData.leaveGroupId.leaveType.filter((leave) => {
                        return leave && leave.leaveTypeId; // && leave.leaveTypeId.name == 'Annual Leave'
                      });
                      if (leaveType && leaveType.length > 0) {
                        const obj = {};
                        leaveType = leaveType[0];
                        obj.userId = userData._id;
                        obj.leaveGroupId = userData.leaveGroupId._id;
                        obj.leaveTypeId = ltDetails[user.LeaveDataType];
                        obj.quota = Number(user.Value);
                        obj.year = parseInt(user.Year);
                        const staffLeaveData = await staffLeave.findOne({
                          userId: obj.userId
                        });

                        let index = 0;
                        if (staffLeaveData) {
                          index = staffLeaveData.leaveDetails.findIndex((le) => {
                            return le.leaveTypeId.toString() == obj.leaveTypeId && le.year == obj.year;
                          });
                        }
                        let leaveDetails = {};
                        if (index != -1 && staffLeaveData && staffLeaveData.leaveDetails.length !== 0) {
                          leaveDetails = staffLeaveData.leaveDetails[index];
                          const inc = obj.quota - leaveDetails.total;
                          staffLeaveData.leaveDetails[index].total = obj.quota;
                          staffLeaveData.leaveDetails[index].request += inc;
                          staffLeaveData.leaveDetails[index].taken += inc;
                          staffLeaveData.leaveDetails[index].planDymanicQuota += inc;
                          staffLeaveData.leaveDetails[index].quota += inc;
                          staffLeaveData.leaveDetails[index].planQuota += inc;
                          const saveDD = await staffLeaveData.save()
                        } else {
                          leaveDetails = {
                            leaveTypeId: obj.leaveTypeId,
                            request: 0,
                            taken: 0,
                            total: obj.quota,
                            planDymanicQuota: obj.quota,
                            planQuota: obj.quota,
                            quota: obj.quota,
                            year: obj.year
                          }

                          if (staffLeaveData && staffLeaveData.leaveDetails) {
                            var newArray = staffLeaveData.leaveDetails.concat([leaveDetails])
                            staffLeaveData.leaveDetails = newArray
                            const saveDD1 = await staffLeaveData.save();
                            user.Reason = '';
                            successData.push(obj);
                            user.Reason = ''
                            successData.push(obj);
                          } else {
                            user.Reason = 'Leave Group is not updated for this user in our DB';
                            invalidDataList.push(user);
                          }
                        }
                      } else {
                        user.message = 'Something went wrong';
                        invalidDataList.push(user);
                        failedData.push(user);
                      }
                    } else {
                      user.message = 'Leave Type not found';
                      failedData.push(user);
                    }
                  } else {
                    user.Reason = 'Staff ID is not matching with our DB';
                    if (userData && !userData.leaveGroupId) {
                      user.Reason = 'This user does not belong to any Leave Group';
                    }
                    invalidDataList.push(user);
                  }
                }
              }
              if (invalidDataList.length !== 0) {
                const updatedUsers = [];
                const nonUpdatedUsers = [];
                userList.forEach(user => {
                  if (user.Reason) {
                    nonUpdatedUsers.push(user.Reason);
                  } else {
                    updatedUsers.push(user.StaffID)
                  }
                });
                var columns = ['StaffID', 'LeaveDataType', 'Year', 'Value', 'Reason'];
                let fileName = `NonUpdatedQuotaData${moment().add('days', 1).format('YYYYMMDD')}`;
                logData.updatedUsers = updatedUsers;
                logData.nonUpdatedUsers = nonUpdatedUsers;
                logData.status = 'Partially completed';
                logData.errorFilePath = `/LBSQuota/${fileName}.csv`;
                logData.companyId = companyData._id;

                var csv = json2csv({
                  data: invalidDataList,
                  fields: columns
                });
                await fs.writeFile(`./public/LBSQuota/${fileName}.csv`, csv, (err) => {
                  if (err) {
                    __.log('json2csv err' + err);
                  }
                });

                const response = await new Integration(logData).save();
              } else {
                const updatedUsers = [];
                const nonUpdatedUsers = [];
                userList.forEach((user, index) => {
                  if (user.Reason) {
                    nonUpdatedUsers.push(user.Reason);
                  } else {
                    updatedUsers.push(user.StaffID)
                  }
                });
                var columns = ['StaffID', 'LeaveDataType', 'Year', 'Value', 'Reason'];
                let fileName = `NonUpdatedQuotaData${moment().add('days', 1).format('YYYYMMDD')}`;
                logData.updatedUsers = updatedUsers;
                logData.nonUpdatedUsers = nonUpdatedUsers;
                logData.status = 'Success';
                var csv = json2csv({
                  data: invalidDataList,
                  fields: columns
                });
                await fs.writeFile(`./public/LBSQuota/${fileName}.csv`, csv, (err) => {
                  if (err) {
                    __.log('json2csv err' + err);
                  } else {
                  }
                });
                await new Integration(logData).save();
                await fs.appendFileSync('./public/integration/integration.log', JSON.stringify(logData));
              }
            }
          });
        });
    } catch (error) {
      __.log(error)
    }
  }
}



cron = new cron();
//cron.sftpIntegraionAt04()
//cron.updateLeaveQuota();
// cron.sftpIntegraionAt13()
//cron.sftpIntegraionAt04();
//cron.integrateNow04();
//cron.integrateNow13()
// cron.lbsQuotaProccessCSV()
//cron.sftpLBSQuotaToUploadFileLocally()
var rule = new schedule.RecurrenceRule();

// rule.minute = new schedule.Range(0, 59, 1);
// schedule.scheduleJob('00 */1 * * * *', cron.notification);
schedule.scheduleJob('00 */1 * * * * ', cron.publishingPost);
// schedule.scheduleJob('00 */1 * * * * ', cron.challengeNotification);
// schedule.scheduleJob('00 */1 * * * * ', cron.notificationReminder);
// schedule.scheduleJob('00 */1 * * * * ', cron.taskNotification);
//schedule.scheduleJob('00 */1 * * * * ', cron.passwordChangeNotification);
//schedule.scheduleJob('00 */30 */10 * * * ', cron.userIntegrationweekly);


//schedule.scheduleJob('00 */5 * * * * ', cron.integrateNow);
//schedule.scheduleJob('30 * * * * * ', cron.downloadFiles);

// schedule.scheduleJob('00 30 5 */1 * * ', cron.sftpIntegraionAt13);
// below are 4 retry statements
// schedule.scheduleJob('00 31 5 */1 * * ', cron.sftpIntegraionAt13);
// schedule.scheduleJob('00 32 5 */1 * * ', cron.sftpIntegraionAt13);
// schedule.scheduleJob('00 33 5 */1 * * ', cron.sftpIntegraionAt13);
// schedule.scheduleJob('00 34 5 */1 * * ', cron.sftpIntegraionAt13);

// schedule.scheduleJob('00 30 23 */1 * * ', cron.sftpIntegraionAt04);
// below are 4 retry statements
// schedule.scheduleJob('00 31 23 */1 * * ', cron.sftpIntegraionAt04);
// schedule.scheduleJob('00 32 23 */1 * * ', cron.sftpIntegraionAt04);
// schedule.scheduleJob('00 33 23 */1 * * ', cron.sftpIntegraionAt04);
// schedule.scheduleJob('00 34 23 */1 * * ', cron.sftpIntegraionAt04);

// schedule.scheduleJob('00 40 23 */1 * * ', cron.integrateNow04);
// schedule.scheduleJob('00 40 5 */1 * * ', cron.integrateNow13);

// schedule.scheduleJob({
//   hour: 1,
//   minute: 1,
//   second: 1
// }, cron.passwordChangeNotificationRemainder); // 6:30 - IST, 9:00 - SGT

// Newly added Scheduler

var utcTimeZone = new schedule.RecurrenceRule();
utcTimeZone.tz = 'UTC';
utcTimeZone.second = 0;
utcTimeZone.minute = 15;
utcTimeZone.hour = 18;

// schedule.scheduleJob(utcTimeZone, cron.uploadLBSPlanCSV)

//cron.integrateNow();
/*setTimeout(async () => {
  await cron.integrateNow();
}, 10000);*/

// LBS Approve download file locally at '/public/approve/' path
// schedule.scheduleJob('00 30 19 */1 * *', cron.sftpLBSApproveToUploadFileLocally);
// schedule.scheduleJob('00 40 19 */1 * *', cron.sftpLBSApproveToUploadFileLocally);
// schedule.scheduleJob('00 50 19 */1 * *', cron.sftpLBSApproveToUploadFileLocally);

// LBS Approve proccess downloaded file locally at '/public/approve' path
// schedule.scheduleJob('00 00 20 */1 * *', cron.lbsApproveProccessCSV);
//cron.lbsApproveProccessCSV()
//cron.sftpLBSApproveToUploadFileLocally()

// schedule.scheduleJob('00 40 18 */1 * *', cron.updateLeaveQuota);

// LBS Quota download file locally at '/public/quota/' path
// schedule.scheduleJob('00 30 18 */1 * *', cron.sftpLBSQuotaToUploadFileLocally);
// schedule.scheduleJob('00 35 18 */1 * *', cron.sftpLBSQuotaToUploadFileLocally);

// LBS Quota - proccess the locally downloaded file to update the database
// schedule.scheduleJob('00 40 18 */1 * *', cron.lbsQuotaProccessCSV);
