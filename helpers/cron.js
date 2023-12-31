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
    csvToArray = require('csv-to-array');

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
        require("csv-to-array")({
            file: serverFile,
            columns: columns
        }, async function (err, array) {            
            let logData = {
                newUsers: [],
                status: 'Success',
                sourcePath: null,
                errorFilePath: null,
                updatedUsers: [],
                errorMessage: ''
            };
            if (err) {
                logData.status = 'File not found';
                logData.errorMessage = logData.errorMessage + `File not found
                ${JSON.stringify(err)}
                `;
            }
            let excelData = array || [];
            let nonUpdated = [];
            if (excelData.length) {
                let company = await getCompanyData(excelData[0])
                if (!company) {
                    return;
                }
                const companyId = companyData._id;
                logData.companyId = companyId;
                let businessUnitsIds = await __.getCompanyBU(companyData._id, "subsection", 1);
                let buQuery = __.buQuery('sectionId');
                let businessUnitsData = await SubSection.find({ _id: { $in: businessUnitsIds } }).populate(buQuery).lean();
                const categoryData = await PrivilegeCategory.findOne({ name: "System Admin" }).select('privileges').lean();
                //const systemAdminRoles = await Role.find({ companyId: companyId, privileges: { $all: categoryData.privileges } }).select('_id').lean();
                const systemAdminRoles = await Role.find({ companyId: companyId, name: "System Admin" }).select('_id').lean();
                const systemAdminRolesIds = systemAdminRoles.map(v => v._id);
                for (const elem of excelData) {
                    if (elem.EmployeeNumber === "dailyMySATS" || elem.SNo === "99") {
                        continue;
                    }
                    let appointment = !!elem.Title ? `${"__"}` : `${elem.Title}`;
                    let status = elem.UserAccountControl == "512" || elem.UserAccountControl == "66048" ? 1 : elem.UserAccountControl == "546" ? 2 : 0;
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
                        return `${elem.sectionId.departmentId.companyId.name}>${elem.sectionId.departmentId.name}>${elem.sectionId.name}>${elem.name}` === bu;
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

                    appointment = appointment.replace(/\\/g, ",");
                    //Appointment Exist or Not...
                    let appointmentsData = await Appointment.findOne({ companyId: companyData._id, name: appointment, status: 1 }).select('name').lean();
                    if (!!appointmentsData) {
                        user.appointmentId = appointmentsData._id;
                    } else {
                        let insertedDoc = await new Appointment({ "name": appointment, "status": 1, "companyId": companyId }).save();
                        user.appointmentId = insertedDoc._id;
                    }
                    let pageSetting = await PageSettingModel.findOne({ companyId: companyId }).populate({ path: 'buTemplateId' }).select('buTemplateId').lean();
                    let findActiveBuTemplate = pageSetting.buTemplateId;
                    let newBu = false;
                    if (!(!!user.parentBussinessUnitId)) {
                        // find department..
                        let departmentIds = await Department.find({ companyId: companyId, name: elem.Company, status: { $in: status } }).select("_id").lean();
                        let departmentId = null;
                        if (departmentIds.length) {
                            departmentId = departmentIds[0]._id;
                        } else {
                            const insertedDepartment = await new Department({ "companyId": companyId, "name": elem.Company, "status": 1 }).save();
                            departmentId = insertedDepartment._id;
                        }
                        await Company.findOneAndUpdate({ _id: companyId }, { $addToSet: { departments: departmentId } });

                        /** Find Section */
                        let sectionIds = await Section.find({
                            departmentId: {
                                $in: [departmentId]
                            },
                            name: elem.Department,
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
                        await Department.update({ _id: departmentId }, { $addToSet: { sections: sectionId } });
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
                            const { subSkillSets, subCategories, techEmail, adminEmail, notificRemindHours, notificRemindDays, cancelShiftPermission, standByShiftPermission, reportingLocation } = findActiveBuTemplate;
                            let insertedSubSection = await new SubSection({
                                name: "__",
                                sectionId: sectionId,
                                appointments: [user.appointmentId],
                                subSkillSets,
                                subCategories,
                                techEmail,
                                adminEmail,
                                notificRemindHours,
                                notificRemindDays,
                                cancelShiftPermission,
                                standByShiftPermission,
                                reportingLocation,
                                status: 1
                            }).save();
                            subsectionId = insertedSubSection._id;
                        }
                        await Section.update({ _id: sectionId }, { $addToSet: { subSections: subsectionId } });
                        user.parentBussinessUnitId = subsectionId;
                        newBu = true;
                    } else {
                        await SubSection.update({ _id: user.parentBussinessUnitId }, { $addToSet: { appointments: user.appointmentId } });
                    }

                    if (typeof user.staffId == "number") {
                        user.staffId = user.staffId.toString();
                    }

                    const addToSystemAdmin = async () => {
                        await User.update({ role: { $in: systemAdminRolesIds }, companyId: companyId }, {
                            $addToSet: {
                                planBussinessUnitId: user.parentBussinessUnitId,
                                viewBussinessUnitId: user.parentBussinessUnitId
                            }
                        }, {
                                multi: true
                            });
                    }

                    let userDe = await User.findOne({ companyId: companyId, staffId: user.staffId.toLowerCase() }).select('staffId role subSkillSets').lean();
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
                        updatedUserData = await User.findOneAndUpdate({ companyId: companyId, staffId: user.staffId.toLowerCase() }, { $set: user }, { setDefaultsOnInsert: true }).lean();
                        logData.updatedUsers[logData.updatedUsers.length] = user.staffId;
                        if (newBu) {
                            /* add created business unit to System admin's plan business unit */
                            await addToSystemAdmin();
                        }
                        const getAllBuTokensByUserID = async (userData) => {
                            const userId = userData._id, condition = {
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
                                    await Channel.findOneAndUpdate({ _id: channel._id }, {
                                        userDetails: channel.userDetails
                                    });
                                }
                            }
                            if (boards) {
                                for (const board of boards) {
                                    board.assignUsers[0].businessUnits = userData.planBussinessUnitId
                                    await Wall.findOneAndUpdate({ _id: board._id }, {
                                        assignUsers: board.assignUsers
                                    });
                                }
                            }
                            if (notifications) {
                                for (const notification of notifications) {
                                    notification.assignUsers[0].businessUnits = userData.planBussinessUnitId
                                    await Notification.findOneAndUpdate({ _id: notification._id }, {
                                        assignUsers: notification.assignUsers
                                    });
                                }
                            }
                            if (forms) {
                                for (const form of forms) {
                                    form.assignUsers[0].businessUnits = userData.planBussinessUnitId
                                    await Forms.findOneAndUpdate({ _id: form._id }, {
                                        assignUsers: form.assignUsers
                                    });
                                }
                            }
                        }
                        await getAllBuTokensByUserID(updatedUserData);
                    } else {
                        newUsers = true;
                        let generatedPassword;
                        user.role = findActiveBuTemplate.role;
                        user.subSkillSets = findActiveBuTemplate.subSkillSets;
                        var userNew = new User();
                        if (elem.Password) {
                            user.password = userNew.generateHash(elem.Password);
                        } else {
                            generatedPassword = await __.makePwd(8); // as of now default password
                            user.password = userNew.generateHash(generatedPassword);
                        }
                        user.companyId = companyId;
                        user.staffId = user.staffId.toLowerCase();
                        user.companyData = companyData;
                        logData.newUsers[logData.newUsers.length] = user.staffId;
                        updatedUserData = await User(user).save();
                        // For Mail
                        if (!elem.Password) {
                            user.password = generatedPassword;
                            //var response = await mailer.newCompanyUser(user);
                        }
                        /* add created business unit to System admin's plan business unit */
                        await addToSystemAdmin();
                    }
                    /**  */
                    for (let singleField of columns) {
                        if (singleField == "SamAccountName" || singleField == "SNo") {
                            continue;
                        }
                        if (!staticFields.includes(singleField)) {
                            let userFieldId = await UserField.findOne({ fieldName: singleField, companyId: companyId, status: 1 }).lean();
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

                                let existOrNot = await User.findOne({ _id: updatedUserData._id, "otherFields.fieldId": userFieldId._id.toString() }).lean();

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
                                    await User.update({ _id: updatedUserData._id }, { $addToSet: { otherFields: newFieldData } });
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
                                    await User.update({ _id: updatedUserData._id }, { $addToSet: { otherFields: newFieldData } }, { new: true });
                                } else {
                                    console.log('problem with new field');
                                }
                            }
                        }
                    }

                }

            } else {
                logData.errorMessage = logData.errorMessage + `
                No record found`;
            }
            let csvLink = '', fieldsArray = ["EmployeeNumber", "DisplayName", "EmailAddress", "MobilePhone", "Reason"];
            logData.nonUpdatedUsers = nonUpdated.map(v => v.Reason);
            logData.sourcePath = resDaily;            
            if (nonUpdated.length) {
                let fileName = `NonUpdatedData${moment().format('YYYYMMDD')}`;
                logData.errorFilePath = `uploads/${fileName}.csv`;
                logData.status = 'Partially completed';
                var csv = json2csv({
                    data: nonUpdated,
                    fields: fieldsArray
                });
                await fs.writeFile(`./public/uploads/${fileName}.csv`, csv, (err) => {
                    if (err) {
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
                                to: 'siangju@net-roc.com',//process.env.NODEMAILER_EMAIL,
                                subject: 'Attachment!',
                                body: 'mail content...',
                                attachments: [{ 'filename': 'attachment.csv', 'content': data }]
                            }), function (err, success) {
                                if (err) {
                                    console.log(error)
                                }
                            }
                        });
                    }
                });
            }
            await new Integration(logData).save();
        });
    } catch (error) {
        __.log(error)
    }
}


class cron {
    async challengeNotification() {
        try {
            let challenges = await Challenge.find({
                status: 1,
                criteriaType: {
                    $nin: [3, 4]
                },
                isNotified: false,
                publishStart: {
                    $lte: new Date()
                }
            }).select({ _id: 1, title: 1, description: 1, selectedChannel: 1, selectedWall: 1, criteriaType: 1 }).lean();
            challenges = challenges || [];
            const sendNotification = async (challenge, users) => {
                const collapseKey = challenge._id;
                const usersWithToken = await User.find({
                    _id: {
                        $in: users || []
                    }
                }).select('deviceToken').lean();
                const pushData = { title: challenge.title, body: challenge.description, redirect: 'challenges' };
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
                        const channel = await Channel.findOne({ _id: challenge.selectedChannel }).select('userDetails createdBy').lean();
                        users = await __.channelUsersList(channel);
                    } else if (!!challenge.selectedWall && 2 === challenge.criteriaType) {
                        const wall = await Wall.findOne({ _id: challenge.selectedWall }).select('assignUsers createdBy').lean();
                        users = await __.wallUsersList(wall);
                    }
                    if(users.length){
                        await sendNotification(challenge, users);
                    }
                    await Challenge.findByIdAndUpdate(challenge._id, {
                        isNotified:true
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
                const decodedString = parser.fromString(post.content.title, { wordwrap: 130 });
                //let dom = parser.parseFromString(post.content.title), decodedString = dom.body.textContent;
                var pushData = {
                    title: __.toTitleCase(post.postType),
                    body: decodedString,
                    redirect: 'post'
                },
                    collapseKey = post._id;
                let channel = await Channel.findOne({ _id: post.channelId._id, status: 1 }).select('userDetails').lean();
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

    async sftpIntegraionAt04(req, res) {
        let Client = require('ssh2-sftp-client');
        let sftp = new Client();
        let timeStamp = `${moment().format('YYYYMMDD')}04`;
        await sftp.connect({
            host: 'ftp.sats.com.sg',
            port: '22',
            username: 'MySATS_AD_PRD',
            password: 'mySatsprd!23',
            algorithms: {
                kex: ['diffie-hellman-group14-sha1']
            }
        }).then(() => {
            return sftp.list('/ADDailyExtractPRD');
        }).then(async (data) => {
            data = data || [];
            const filteredData = data.filter(v => -1 !== v.name.indexOf(`dailyMySATS${timeStamp}`));
            for (const d of filteredData) {
                let daily = d.name;
                await sftp.get(`/ADDailyExtractPRD/${daily}`).then(async (fileData) => {
                    let writtenFileData = await fs.writeFileSync(`public/${daily}`, fileData);
                    await spawn('unzip', ['-P', 'Daily@dm1n!', '-d', './public/', `./public/${daily}`]);
                    const resDaily = daily.split('.')[0] + '.csv';
                    //await integration(resDaily, req, res);
                }, async (error) => {
                    await fs.appendFileSync('./public/integration/integration.log', JSON.stringify(error));
                });
            }
        }).catch(async (error) => {
            await fs.appendFileSync('./public/integration/integration.log', JSON.stringify(error));
        });
    }
    async sftpIntegraionAt13(req, res) {
        let Client = require('ssh2-sftp-client');
        let sftp = new Client();
        let timeStamp = `${moment().format('YYYYMMDD')}13`;
        await sftp.connect({
            host: 'ftp.sats.com.sg',
            port: '22',
            username: 'MySATS_AD_PRD',
            password: 'mySatsprd!23',
            algorithms: {
                kex: ['diffie-hellman-group14-sha1']
            }
        }).then(() => {
            return sftp.list('/ADDailyExtractPRD');
        }).then(async (data) => {
            data = data || [];
            const filteredData = data.filter(v => -1 !== v.name.indexOf(`dailyMySATS${timeStamp}`));
            for (const d of filteredData) {
                let daily = d.name;
                await sftp.get(`/ADDailyExtractPRD/${daily}`).then(async (fileData) => {
                    let writtenFileData = await fs.writeFileSync(`public/${daily}`, fileData);
                    await spawn('unzip', ['-P', 'Daily@dm1n!', '-d', './public/', `./public/${daily}`]);
                    //const resDaily = daily.split('.')[0] + '.csv';
                    //await integration(resDaily, req, res);
                }, async (error) => {
                    console.log(error);
                    await fs.appendFileSync('./public/integration/integration.log', JSON.stringify(error));
                });
            }
        }).catch(async (error) => {
            console.log(error);
            await fs.appendFileSync('./public/integration/integration.log', JSON.stringify(error));
        });
    }
    async integrateNow13(req, res) {
        const currentFolder = "./public/";
        await fs.readdir(currentFolder, async (err, files) => {
            const currentDate = moment().format('YYYYMMDD') + '13';
            const myFiles = files.filter(v => -1 !== v.indexOf(currentDate) && v.includes('.csv'));
            if(myFiles.length){
                for (const myFile of myFiles) {
                    let resDaily = myFile.split('.')[0] + '.csv';
                    await integration(resDaily, req, res);
                }
            } else {
                await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({ message: 'File Not found', date: new Date() }));
            }            
        });
    }
    async integrateNow04(req, res) {
        const currentFolder = "./public/";
        await fs.readdir(currentFolder, async (err, files) => {
            const currentDate = moment().format('YYYYMMDD') + '04';
            const myFiles = files.filter(v => -1 !== v.indexOf(currentDate) && v.includes('.csv'));
            if(myFiles.length){
                for (const myFile of myFiles) {
                    let resDaily = myFile.split('.')[0] + '.csv';
                    await integration(resDaily, req, res);
                }
            } else {
                await fs.appendFileSync('./public/integration/integration.log', JSON.stringify({ message: 'File Not found', date: new Date() }));
            }
        });
    }
    async integrateNow(req, res) {
        try {
            console.log('integration started');
            await integration('dailyMySATS20190924040015.csv', req, res);
        } catch (error) {
            console.log(error);
        }
    }
    async downloadFiles(req, res) {
        console.log(moment().toDate());        
    }
}



cron = new cron();


var rule = new schedule.RecurrenceRule();

rule.minute = new schedule.Range(0, 59, 1);
//schedule.scheduleJob('00 */1 * * * *', cron.notification);
//schedule.scheduleJob('00 */1 * * * * ', cron.publishingPost);
//schedule.scheduleJob('00 */1 * * * * ', cron.challengeNotification);
//schedule.scheduleJob('00 */1 * * * * ', cron.notificationReminder);
//schedule.scheduleJob('00 */1 * * * * ', cron.taskNotification);
//schedule.scheduleJob('00 */1 * * * * ', cron.passwordChangeNotification);
//schedule.scheduleJob('00 */30 */10 * * * ', cron.userIntegrationweekly);


//schedule.scheduleJob('00 10 10 */1 * * ', cron.integrateNow);
//schedule.scheduleJob('30 * * * * * ', cron.downloadFiles);

//schedule.scheduleJob('00 30 5 */1 * * ', cron.sftpIntegraionAt13);
//schedule.scheduleJob('00 30 20 */1 * * ', cron.sftpIntegraionAt04);
//schedule.scheduleJob('00 40 20 */1 * * ', cron.integrateNow04);
//schedule.scheduleJob('00 40 5 */1 * * ', cron.integrateNow13);
