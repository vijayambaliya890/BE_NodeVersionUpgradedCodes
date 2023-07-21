// Controller Code Starts here
const User = require("../app/models/user"),
    Roles = require("../app/models/role"),
    SubSection = require("../app/models/subSection"),
    Appointment = require("../app/models/appointment"),
    SkillSet = require('../app/models/skillSet'),
    SubSkillSet = require('../app/models/subSkillSet'),
    PrivilegeCategory = require('../app/models/privilegeCategory'),
    nodemailer = require("nodemailer"),
    bcrypt = require("bcrypt-nodejs"),
    smtpTransport = require("nodemailer-smtp-transport"),
    fs = require("fs"),
    path = require("path"),
    util = require("util"),
    crypto = require("crypto"),
    hbs = require("nodemailer-express-handlebars"),
    notification = require("../app/controllers/company/notificationController"),
    Company = require("../app/models/company"),
    Role = require("../app/models/role"),
    UserField = require("../app/models/userField"),
    OtherNotification = require("../app/models/otherNotifications"),
    moment = require("moment"),
    _ = require("lodash"),
    __ = require("./globalFunctions"),
    mongoose = require("mongoose"),
    mailer = require("./mailFunctions"),
    xlsx = require('node-xlsx'),
    FCM = require("./fcm");

/* Email Credentials */
const transporter = nodemailer.createTransport(
    smtpTransport({
        service: "gmail",
        host: "smtpout.secureserver.net",
        port: 465,
        secure: true,
        auth: {
            user: process.env.NODEMAILER_EMAIL,
            pass: process.env.NODEMAILER_PASSWORD
        }
    })
);

const options = {
    viewEngine: {
        extname: ".hbs",
        layoutsDir: "../../public/email/"
    },
    viewPath: "public/email/",
    extName: ".hbs"
};

class user {

    //=======================>>>>>>>>>>>>>>>>>>Bulk file upload<<<<<<<<<<<<<<<<<<<<<<<===========================================

    async uploadBulkUsers(req, res) {
        try {

            if (!req.file) {
                return __.out(res, 300, `No File is Uploaded`);
            }

            // Get Company Data
            let companyData = await Company.findOne({
                _id: req.user.companyId
            }).lean();

            let excelData = xlsx.parse(req.file.path); // parses a file

            if (excelData.length > 0) {

                let userData = excelData[0].data; // get the 1st sheet only

                // Get index of Known keys from the header row
                let titleIndex = {};

                // set all unknown keys - custom fields
                let allTitles = [];
                for (let elem of userData[0]) {
                    titleIndex[elem] = userData[0].indexOf(elem);
                    allTitles.push(elem);
                }

                // Remove the first title && Add header
                let nonUpdatedUser = [userData[0]];
                userData.shift();

                // Get all roles/appoint/businessunit list
                let rolesData = await Roles.find({
                    companyId: req.user.companyId,
                    status: 1
                }).select('name').lean();
                let appointmentsData = await Appointment.find({
                    companyId: req.user.companyId,
                    status: 1
                }).select('name').lean();
                let skillSetsData = await SkillSet.find({
                    companyId: req.user.companyId,
                    status: 1
                }).populate({
                    path: 'subSkillSets',
                    match: {
                        status: 1
                    }
                }).select('name').lean();
                let businessUnitsIds = await __.getCompanyBU(req.user.companyId, "subsection", 1);
                let businessUnitsData = await SubSection.find({
                    _id: {
                        $in: businessUnitsIds
                    }
                }).populate({
                    path: 'sectionId',
                    select: 'name',
                    match: {
                        status: 1
                    },
                    populate: {
                        path: 'departmentId',
                        select: 'name',
                        match: {
                            status: 1
                        },
                        populate: {
                            path: 'companyId',
                            select: 'name',
                            match: {
                                status: 1
                            }
                        }
                    }
                }).lean();

                let staticFields = ["staffName", "staffId", "appointment", "contact", "email", "role", "businessUnitParent", "skillSets", "businessUnitPlan", "businessUnitView"];

                for (let elem of userData) {

                    // user Data with static fields
                    let user = {
                        "name": elem[titleIndex["staffName"]],
                        "staffId": elem[titleIndex["staffId"]],
                        "appointmentId": elem[titleIndex["appointment"]],
                        "appointFind": false,
                        "contactNumber": elem[titleIndex["contact"]] || '',
                        "email": elem[titleIndex["email"]],
                        "role": elem[titleIndex["role"]],
                        "roleFind": false,
                        "parentBussinessUnit": elem[titleIndex["businessUnitParent"]],
                        "parentBuFind": false,
                        "skillSets": (elem[titleIndex["skillSets"]]) ? elem[titleIndex["skillSets"]].split(',') : [],
                        "subSkillSets": [],
                        "businessUnitPlan": (elem[titleIndex["businessUnitPlan"]]) ? elem[titleIndex["businessUnitPlan"]].split(',') : [],
                        "businessUnitView": (elem[titleIndex["businessUnitView"]]) ? elem[titleIndex["businessUnitView"]].split(',') : []
                    };

                    // convert role/appoint/bu name to id
                    for (let elem of rolesData) {
                        if (elem.name == user.role) {
                            user.roleFind = true;
                            user.role = elem._id;
                        }
                    }
                    for (let elem of appointmentsData) {
                        if (elem.name == user.appointmentId) {
                            user.appointFind = true;
                            user.appointmentId = elem._id;
                        }
                    }

                    // Sub Skill Set
                    for (let elem of skillSetsData) {
                        for (let elem1 of elem.subSkillSets) {
                            if (elem1) {
                                // skkill set 1 > test sub skill set 3
                                let fullString = `${elem.name}>${elem1.name}`;

                                if (user.skillSets.indexOf(fullString) > -1) {
                                    user.subSkillSets.push(elem1._id);
                                }
                            }
                        }
                    }

                    for (let elem of businessUnitsData) {

                        // SATS >> Security >> Aviation >> test 9
                        let fullBU = `${elem.sectionId.departmentId.companyId.name}>${elem.sectionId.departmentId.name}>${elem.sectionId.name}>${elem.name}`;

                        if (fullBU == user.parentBussinessUnit) {
                            user.parentBuFind = true;
                            user.parentBussinessUnitId = elem._id;
                        }

                    }

                    let convertNametoBuId = function (namesList) {

                        let idList = [];

                        for (let elem of businessUnitsData) {
                            // SATS >> Security >> Aviation >> test 9
                            let fullBU = `${elem.sectionId.departmentId.companyId.name}>${elem.sectionId.departmentId.name}>${elem.sectionId.name}>${elem.name}`;

                            if (namesList.indexOf(fullBU) > -1) {
                                user.parentBussinessUnitId = elem._id;
                                idList.push(elem._id);
                            }

                        }

                        return idList;
                    };

                    // Convert array bu names into object ids
                    user.planBussinessUnitId = convertNametoBuId(user.businessUnitPlan);
                    user.viewBussinessUnitId = convertNametoBuId(user.businessUnitView);

                    // Validate mail id
                    let emailRegexp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
                    if (!emailRegexp.test(user.email)) {
                        nonUpdatedUser.push(elem);
                        continue;
                    }

                    // Validate Staff Id/Parent BU/Role/Appointment
                    if (!user.parentBuFind || !user.roleFind || !user.appointFind || !user.staffId) {
                        nonUpdatedUser.push(elem);
                        continue;
                    }

                    // Convert number to string
                    if (typeof user.staffId == "number") {
                        user.staffId = user.staffId.toString();
                    }

                    // Update
                    let updatedUserData = await User.findOneAndUpdate({
                        companyId: req.user.companyId,
                        staffId: user.staffId.toLowerCase()
                    }, {
                        $set: user
                    });

                    // New User
                    if (!updatedUserData) {

                        // let generatedPassword = await __.makePwd(8);
                        let generatedPassword = "password"; // as of now default password

                        user.password = bcrypt.hashSync(generatedPassword, bcrypt.genSaltSync(8), null);;
                        user.status = 1;
                        user.companyId = req.user.companyId;
                        user.staffId = user.staffId.toLowerCase();

                        updatedUserData = await new User(user).save();
                        /* sending mail */
                        let mailDoc = {
                            email: updatedUserData.email,
                            userName: updatedUserData.name,
                            staffId: updatedUserData.staffId,
                            password: generatedPassword,
                            companyData: companyData
                        };
                        __.log(companyData)
                        // mailer.newCompanyUser(mailDoc);
                    }

                    // Update Custom Fields
                    for (let singleField of allTitles) {

                        // Check Custom Field or not
                        if (staticFields.indexOf(singleField) == -1) {

                            let userFieldId = await UserField.findOne({
                                fieldName: singleField,
                                companyId: req.user.companyId,
                                status: 1
                            }).lean();

                            if (userFieldId) {

                                // let existField = false;
                                let int = 0;

                                // Update if exists
                                let existField = await User.update({
                                    _id: updatedUserData._id,
                                    "otherFields.fieldId": userFieldId._id.toString()
                                }, {
                                    $set: {
                                        "otherFields.$.value": elem[titleIndex[singleField]]
                                    }
                                });

                                // Add if not exists
                                if (existField.nModified == 0) {

                                    let newFieldData = {
                                        "fieldId": userFieldId._id.toString(),
                                        "fieldName": userFieldId.fieldName,
                                        "indexNum": userFieldId.indexNum,
                                        "options": userFieldId.options,
                                        "required": userFieldId.required,
                                        "type": userFieldId.type,
                                        "value": elem[titleIndex[singleField]]
                                    };

                                    let returnedData = await User.findOneAndUpdate({
                                        _id: updatedUserData._id
                                    }, {
                                        $addToSet: {
                                            otherFields: newFieldData
                                        }
                                    }, {
                                        new: true
                                    });

                                    __.log(userFieldId, returnedData)
                                }

                            }

                        }

                    }

                } // End Up for of loop

                await fs.unlink(req.file.path);

                // If missing users exists
                nonUpdatedUser = nonUpdatedUser.filter(function (x) {
                    return x.length
                });
                __.log(nonUpdatedUser)
                if (nonUpdatedUser.length > 1) {

                    var buffer = xlsx.build([{
                        name: "Non Updated Users",
                        data: nonUpdatedUser
                    }]); // Returns a buffer

                    let writeXls = util.promisify(fs.writeFile);
                    // Random file name
                    let fileName = crypto.randomBytes(8).toString('hex');
                    await writeXls(`public/uploads/bulkUpload/${fileName}.xlsx`, buffer);

                    return __.out(res, 201, {
                        nonUpdated: true,
                        fileLink: `uploads/bulkUpload/${fileName}.xlsx`
                    });

                }

                return __.out(res, 201, {
                    nonUpdated: false
                });
            }

        } catch (error) {
            __.log(error);
            return __.out(res, 500, error);
        };
    }


    // Check this user is admin or not
    async isAdmin(userData) {

        let categoryData = await PrivilegeCategory.findOne({
            name: "System Admin"
        }).select('privileges').lean();

        let {
            privileges
        } = categoryData;

        let systemAdminRoles = await Role.find({
            companyId: userData.companyId,
            privileges: {
                $all: privileges
            }
        }).lean();
        __.log(systemAdminRoles, ">>>>>>>>>>>.")
        let systemAdminRolesId = systemAdminRoles.map(x => x._id.toString());

        let result = false;
        if (systemAdminRolesId.indexOf(userData.role._id.toString()) > -1) {
            result = true;
        }

        return result

    }


}
user = new user();
module.exports = user;