const _ = require('lodash'),
    os = require('os'),
    mongoose = require('mongoose'),
    dotenv = require('dotenv').config(),
    User = require('../../models/user'),
    fs = require('fs'),
    AdminUser = require('../../models/adminUser'),
    Company = require('../../models/company'),
    UserField = require('../../models/userField'),
    Appointment = require('../../models/appointment'),
    Role = require('../../models/role'),
    PageSetting = require('../../models/pageSetting'),
    Privilege = require('../../models/privilege'),
    PrivilegeCategory = require('../../models/privilegeCategory'),
    jwt = require('jsonwebtoken'),
    smtpTransport = require("nodemailer-smtp-transport"),
    mailer = require('../../../helpers/mailFunctions'),
    __ = require('../../../helpers/globalFunctions');

//Native Login
class company {

    async createCompany(req, res) {

        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['name', 'email']);
            if (requiredResult.status === false) {
                return __.out(res, 400, requiredResult.missingFields);
            }

            // Check Email Exists
            let existCompany = await Company.findOne({
                $or: [{
                    name: req.body.name
                }],
                status: {
                    $ne: 3
                }
            }).lean();

            if (existCompany) {
                return __.out(res, 300, "Company Name already exists");
            }

            __.log(req.body);
            let pathName = req.body.name.replace(/\s/g, "_").toLowerCase();
            let logoPath = "";
            if (req.file) {
                logoPath = "uploads/companyLogos/" + req.file.filename;
            }

            let insertData = {
                name: req.body.name,
                email: req.body.email,
                pathName: pathName,
                logo: logoPath,
                status: 1
            };

            let companyData = await new Company(insertData).save();
            /* Add Custom User Fields */
            if (req.body.userFields) {
                let userFields = JSON.parse(req.body.userFields);
                let createFields = async function () {
                    for (let field of userFields) {
                        let insertData = {
                            fieldName: field.fieldName,
                            type: field.type,
                            companyId: companyData._id,
                            indexNum: field.indexNum
                        };
                        if (field.type == 'dropdown') {
                            let optionArray = [...new Set(field.options)];
                            insertData.options = optionArray;
                        }
                        //  __.log(insertData)
                        await new UserField(insertData).save();
                    }
                };
                await createFields();
            }
            /* End Add Custom User Fields */

            /*Create Admin User Company */
            let adminData = await this.createAdmin(companyData);
            /* End Create Admin User Company */
            // Create Page Setting
            await this.createPageSetting(companyData);

            if(req.file) {
                const output = /*await*/ __.scanFile(req.file.filename, `public/uploads/companyLogos/${req.file.filename}`);
                if (!!output) {
                    // return __.out(res, 300, output);
                }
            }
            return __.out(res, 200, "Tier Has Been Created");

        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }

    }

    async companyList(req, res) {

        try {

            let searchQuery = {
                status: {
                    $ne: 3
                }
            };

            let companyList = await Company.find(searchQuery).sort({
                "createdAt": -1
            }).lean()

            return __.out(res, 201, {
                data: companyList
            });

        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }

    async getCompany(req, res) {
        try {
            if (!__.checkHtmlContent(req.params)) {
                return __.out(res, 300, `You've entered malicious input`);
            }            
            let searchQuery = {
                _id: req.params.companyId,
                status: {
                    $ne: 3
                }
            };
            let companyData = await Company.findOne(searchQuery).lean();
            if (!companyData) {
                return __.out(res, 300, 'Company Not Found');
            }

            // User Customisable Fields
            let userFields = await UserField.find({
                companyId: companyData._id,
                status: 1
            }).sort({
                "indexNum": 1
            }).lean();
            __.log(userFields)
            // Get User Fields with assign status
            let getFields = async function () {
                let index = 0;
                for (let field of userFields) {

                    // Check Field is assigned or not
                    let getUser = User.find({
                        "otherFields.fieldId": field._id,
                        "status": {
                            $ne: 3
                        }
                    });

                    // Set Editable Status
                    if (getUser > 0) {
                        userFields[index].editable = false;
                    } else {
                        userFields[index].editable = true;
                    }

                    // Incase Dropdown Field action
                    if (field.type == 'dropdown') {

                        let dropdownArray = async function () {
                            let int = 0;
                            let existingOptions = field['options'];
                            // Giving 2 Params. Options (not yet assigned), nonEditableFields( assigned already)
                            userFields[index].nonEditableFields = [];
                            userFields[index].options = [];
                            for (let elem of existingOptions) {
                                __.log(elem)
                                let fieldData = User.find({
                                    "otherFields.fieldId": field._id,
                                    "otherFields.value": elem,
                                    "status": {
                                        $ne: 3
                                    }
                                });
                                if (fieldData > 0) {
                                    userFields[index].nonEditableFields.push(elem);
                                } else {
                                    userFields[index].options.push(elem);
                                }
                                // Single Option Increment
                                int++;
                            }
                        };
                        await dropdownArray();

                    }
                    // Total Field Increment
                    index++;
                }
                // End for loop
            };
            await getFields();

            /* Testing */
            // userFields[0].editable = false;
            // userFields[3].nonEditableFields.push(userFields[3].options[0]);
            // userFields[3].options.shift();
            // userFields[3].editable = false;
            // __.log(userFields)
            /* Testing */

            companyData.userFields = userFields;

            return __.out(res, 201, companyData);

        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }

    async updateCompany(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            //  __.log(req.body)
            let requiredResult = await __.checkRequiredFields(req, ['companyId', 'name', 'email']);
            if (requiredResult.status === false) {
                return __.out(res, 400, requiredResult.missingFields);
            }

            // Check Email Exists
            let existCompany = await Company.findOne({
                _id: {
                    $ne: req.body.companyId
                },
                $or: [{
                    email: req.body.email
                }, {
                    name: req.body.name
                }],
                status: {
                    $ne: 3
                }
            });
            if (existCompany) {
                if (existCompany.email == req.body.email) {
                    return __.out(res, 300, "Email already exists");
                } else {
                    return __.out(res, 300, "Company Name already exists");
                }
            }

            // Get Company Details
            let companyData = await Company.findOne({
                _id: req.body.companyId,
                status: {
                    $ne: 3
                }
            });
            if (!companyData) {
                return __.out(res, 300, 'Company Not Found');
            }

            // Update Data
            companyData.name = req.body.name;
            companyData.email = req.body.email;
            companyData.pathName = req.body.name.replace(/\s/g, "_").toLowerCase();
            companyData.status = req.body.status;

            if (req.file && req.file != '') {
                __.log('public/' + companyData.logo);
                // if (fs.existsSync('public/' + companyData.logo)) {
                //     // await fs.exists('public/' + companyData.logo, async function (exists) {
                //     //        if (exists && companyData.logo != '') {
                //     __.log('public/' + companyData.logo);
                //     await fs.unlink('public/' + companyData.logo);
                //     //       }
                //     //  });
                // }
                companyData.logo = "uploads/companyLogos/" + req.file.filename;
                __.log(companyData.logo, 'as');
            }
            __.log(req.file)
            await companyData.save();

            /* Add/Update Custom User Fields */
            // __.log(req.body.userFields)
            // if (req.body.userFields) {
            //     let userFields = JSON.parse(req.body.userFields);
            //     let createFields = async function () {
            //         for (let field of userFields) {
            //             // New Fields Doesn't have _id
            //             if (!field.id) {

            //                 let insertData = {
            //                     fieldName: field.fieldName,
            //                     type: field.type,
            //                     companyId: companyData._id,
            //                     indexNum: field.indexNum
            //                 };
            //                 if (field.type == 'dropdown') {
            //                     let optionArray = [...new Set(field.options)];
            //                     insertData.options = field.options;
            //                 }
            //                 await new UserField(insertData).save();

            //             }
            //             // Old Fields Update
            //             else {

            //                 let searchQuery = {
            //                     _id: field.id
            //                 };
            //                 let updateData = {
            //                     indexNum: field.indexNum
            //                 };
            //                 if (field.editable == true) {
            //                     updateData.fieldName = field.fieldName;
            //                     updateData.type = field.type;
            //                 }
            //                 if (field.type == 'dropdown') {
            //                     // Combine new & old options -> update
            //                     let newOptions = [...new Set(field.options)];
            //                     let existOptions = [...new Set(field.nonEditableFields)];
            //                     let optionArray = [...existOptions, ...newOptions];
            //                     updateData = {
            //                         options: optionArray
            //                     };
            //                 }
            //                 if (field.editable == true || field.type == 'dropdown') {
            //                     await UserField.findOneAndUpdate(searchQuery, updateData);
            //                 }
            //             }
            //         }
            //     };
            //     await createFields();
            // }
            /* End Add/Update Custom User Fields */

            return __.out(res, 200, "Company Has Been Updated");

        } catch (err) {
            __.log(err);
            return __.out(res, 500, 'Something Went Wrong !!');
        }
    }

    async deleteCompany(req, res) {
        try {
            if (!__.checkHtmlContent(req.params)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let companyId = req.params.companyId;

            // Get Company Details
            let companyData = await Company.findOne({
                _id: companyId,
                status: {
                    $ne: 3
                }
            });
            if (!companyData) {
                return __.out(res, 300, 'Company Not Found');
            }

            // Update Data
            companyData.status = 3;
            await companyData.save();

            return __.out(res, 200, "Company Has Been Deleted");

        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }

    async createAdmin(companyData) {

        /* Create Password */
        let generatedPassword = await __.makePwd(8);
        /* User Fields */
        let insert = {};
        insert.name = companyData.email.split('@')[0];
        insert.staffId = "admin001";
        insert.email = companyData.email;
        insert.companyId = companyData._id;
        insert.status = 1;

        /* Create Company Role && Add this User */
        // Get All Company Ids
        let privilege = await Privilege.find({
            status: 1
        }).select("_id");
        let privilegeIds = [];
        for (let elem of privilege) {
            privilegeIds.push(elem._id);
        }
        __.log(privilegeIds)
        // Create Appointment
        let insertAppoint = {
            name: "System Admin",
            companyId: companyData._id,
            status: 1
        };
        let appointmentId = await new Appointment(insertAppoint).save();
        insert.appointmentId = appointmentId._id;
        // Create Role with all previleges
        let insertRole = {
            status: 1,
            name: "System Admin",
            description: "System Administrator",
            companyId: companyData._id,
            isFlexiStaff: 0,
            privileges: privilegeIds
        };
        let roleId = await new Role(insertRole).save();
        insert.role = roleId._id;
        __.log(insert)
        //create new model
        var post = await new User(insert);
        post.password = post.generateHash(generatedPassword);

        //save model to MongoDB
        let insertedUser = await post.save();

        /* sending mail */
        let mailDoc = {
            email: insertedUser.email,
            userName: insertedUser.name,
            staffId: insertedUser.staffId,
            password: generatedPassword,
            companyData: companyData
        };
        await mailer.newCompanyUser(mailDoc);

        return true;
    }

    async createPageSetting(companyData, res) {

        try {

            let newData = {
                companyId: companyData._id,
                bannerImages: [],
                quickLinks: [],
                externalLinks: [],
                status: 1
            };
            await new PageSetting(newData).save();

        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }


    async createRole(req, res) {

        return __.out(res, 200, "Under Maintenance");

        // let privilegeList = [{
        //     'name': 'Custom Fields',
        //     'description': 'Create and edit custom fields',
        //     'privilegeCategoryId': '5a60942a8f5c700691f129ce',
        //     "flags": {
        //         'userProfile': true
        //     },
        //     "status": 1
        // }, {
        //     'name': 'Channel setup',
        //     'description': 'Create and edit channels for news and events',
        //     'privilegeCategoryId': '5a60942a8f5c700691f129ce',
        //     "flags": {
        //         'channelSetup': true
        //     },
        //     "status": 1
        // }];

        // let privilegeData = await Privilege.insertMany(privilegeList);
        // console.log(privilegeData, "privilegeList");
        // let adminPrivileges = [];
        // for (let elem of privilegeData) {
        //     adminPrivileges.push(elem._id);
        // }
        // // Then Add this two role in "System Admin"
        // await PrivilegeCategory.update({
        //     _id: mongoose.Types.ObjectId("5a60942a8f5c700691f129ce")
        // }, {
        //     $push: {
        //         privileges: {
        //             $each: adminPrivileges
        //         }
        //     }
        // }, {
        //     upsert: true
        // });

        // /** Next Role */
        // let privilegeList1 = [{
        //     'name': 'Cancel Shift',
        //     'description': 'Allow cancellation of shift created',
        //     'privilegeCategoryId': '5a60943c8f5c700691f129cf',
        //     "flags": {
        //         'cancelShift': true
        //     },
        //     "status": 1
        // }];

        // let privilegeData1 = await Privilege.insertMany(privilegeList1);
        // console.log(privilegeData1, "privilegeList1");
        // let shiftPrivileges = [];
        // for (let elem of privilegeData1) {
        //     shiftPrivileges.push(elem._id);
        // }
        // // Then Add this two role in "Open Shift - Shift Planning"
        // await PrivilegeCategory.update({
        //     _id: mongoose.Types.ObjectId("5a60943c8f5c700691f129cf")
        // }, {
        //     $push: {
        //         privileges: {
        //             $each: shiftPrivileges
        //         }
        //     }
        // }, {
        //     upsert: true
        // });
        // /** Next Role */

        // let newPrivilege = {
        //     "name": "News and Events",
        //     "status": 1
        // };
        // let newData = await PrivilegeCategory(newPrivilege).save();

        // let privilegeList2 = [{
        //     'name': 'Manage News',
        //     'description': 'Create and edit news',
        //     'privilegeCategoryId': newData._id,
        //     "flags": {
        //         'manageNews': true
        //     },
        //     "status": 1
        // }, {
        //     'name': 'Manage Events',
        //     'description': 'Create and edit events',
        //     'privilegeCategoryId': newData._id,
        //     "flags": {
        //         'manageEvents': true
        //     },
        //     "status": 1
        // }, {
        //     'name': 'My news and events',
        //     'description': 'View news and events',
        //     'privilegeCategoryId': newData._id,
        //     "flags": {
        //         'newsAndEvents': true
        //     },
        //     "status": 1
        // }];
        // let newsData = await Privilege.insertMany(privilegeList2);
        // let newsPrivileges = [];
        // for (let elem of newsData) {
        //     newsPrivileges.push(elem._id);
        // }
        // await PrivilegeCategory.update({
        //     _id: newData._id
        // }, {
        //     $push: {
        //         privileges: {
        //             $each: newsPrivileges
        //         }
        //     }
        // }, {
        //     upsert: true
        // });

        // return __.out(res, 200, "Privilege Has Been Created");

    }

}
company = new company();
module.exports = company;