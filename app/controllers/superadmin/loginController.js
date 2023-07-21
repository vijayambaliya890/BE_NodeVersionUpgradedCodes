const _ = require('lodash'),
    os = require('os'),
    mongoose = require('mongoose'),
    dotenv = require('dotenv').config(),
    AdminUser = require('../../models/adminUser'),
    jwt = require('jsonwebtoken'),
    nodemailer = require('nodemailer'),
    smtpTransport = require('nodemailer-smtp-transport'),
    hbs = require('nodemailer-express-handlebars'),
    mailer = require('../../../helpers/mailFunctions'),
    __ = require('../../../helpers/globalFunctions');

//Native Login
class adminAuth {

    async createAdminUser(req, res) {
        // let insert = new AdminUser();
        // insert.name = "Super Admin";
        // insert.userName = "admin";
        // insert.password = insert.generateHash('test123');
        // insert.role = "superadmin";
        // insert.email = "janen@askpundit.com";
        // insert.contactNumber = "9551705709";
        // console.log(insert)
        // let insertedDoc = await insert.save();
        // console.log(insertedDoc)
        // res.send('ok');
    }

    async login(req, res) {

        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['userName', 'password']);
            if (requiredResult.status === false) {
                return __.out(res, 400, requiredResult.missingFields);
            } else {

                let userData = await AdminUser.findOne({
                    userName: req.body.userName,
                    status: {
                        $ne: 3
                    }
                });
                if (userData === null) {
                    return __.out(res, 300, 'User not found');
                } else if (userData !== null) {
                    if (userData.status != 1) {
                        return __.out(res, 300, 'Authentication failed.Inactive account.');
                    } else {
                        let userInfo = async () => {
                            userData.loggedIn = Date.now();
                            if (req.body.deviceToken)
                                userData.deviceToken = req.body.deviceToken;
                            let updatedData = await userData.save(),
                                doc = updatedData.toObject(),
                                user = {
                                    id: doc._id,
                                    loggedIn: doc.loggedIn,
                                    role: doc.role,
                                    flexiController: "superadmin"
                                },
                                token = jwt.sign(user, process.env.API_KEY),
                                newUserData = doc;

                            newUserData.userId = userData._id;
                            newUserData.flexiController = "superadmin";
                            delete newUserData._id;
                            return __.out(res, 201, {
                                data: newUserData,
                                token: "Bearer " + token
                            });
                        };
                        let validPassword = userData.validPassword(req.body.password);
                        if (!validPassword) {
                            return __.out(res, 300, 'Authentication failed. Wrong password.');
                        } else {
                            userInfo();
                        }
                    }
                }

            }
        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }

    }

    test(req, res) {
        __.out(res, 200);
    }

    async logout(req, res) {
        try {
            __.log(req.user);

            var updated = await AdminUser.findOneAndUpdate({
                _id: req.user._id
            }, {
                    $set: {
                        loggedIn: new Date()
                    }
                });
            __.log('updated', updated)
            __.out(res, 201, 'You have been logged out successfully');

        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }

    async forgotPassword(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['staffId', 'email']);
            if (requiredResult.status === false) {
                return __.out(res, 400, requiredResult.missingFields);
            } else {

                let userData = await User.findOne({
                    staffId: req.body.staffId.toLowerCase(),
                    status: 1
                }).lean();
                if (userData != null) {
                    if (userData.email.toLowerCase().trim() != req.body.email.toLowerCase().trim()) {
                        __.out(res, 300, 'Invalid email');
                        return;
                    }

                    let emailToken = jwt.sign({
                        _id: userData._id,
                        loggedIn: userData.loggedIn
                    }, process.env.API_KEY, {
                            expiresIn: '2h'
                        }),
                        mailData = {
                            userName: userData.name,
                            userEmail: userData.email,
                            staffId: userData.staffId,
                            emailToken: emailToken
                        };

                    await mailer.forgotPassword(mailData);

                    return res.status(200).json({
                        message: 'Please check your registered email account to reset your password.',
                        data: {
                            staffId: userData.staffId
                        }
                    });


                } else {
                    __.out(res, 300, 'Invalid StaffId');
                }
            }

        } catch (err) {
            __.log(err);
            return __.out(res, 500)
        }
    }
    async checkTokenForForgotPassword(req, res) {
        try {
            if (!__.checkHtmlContent(req.params)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let parsedToken = jwt.verify(req.params.token, process.env.API_KEY);
            let userData = await User.findOne({
                _id: parsedToken._id,
                loggedIn: parsedToken.loggedIn
            }).lean();

            if (userData != null) {

                __.out(res, 201, {
                    data: {
                        userId: parsedToken._id,
                    },
                    message: 'Link verified successfully',
                });

            } else {
                __.out(res, 300, 'Invalid link / Link has already been used');
            }

        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    message: 'Your link has expired'
                });
            }
            __.log(err);
            __.out(res, 500)
        }
    }

    async resetPassword(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = __.checkRequiredFields(req, ['userId', 'password']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
                return;
            }

            let userData = await User.find({
                _id: req.body.userId,
                status: 1
            });

            if (userData === null) {
                __.out(res, 300, 'Invalid staffId');
                return;
            } else {
                const {
                    generateHash
                } = new User()
                const hashVal = generateHash(req.body.password);
                let updatedUser = await User.findOneAndUpdate({
                    _id: req.body.userId,
                }, {
                        $set: {
                            password: hashVal
                        }
                    }).lean();

                __.out(res, 201, `Password updated successfully`)
            }



        } catch (err) {
            __.log(err);
            __.out(res, 500)
        }
    }


}

adminAuth = new adminAuth();
module.exports = adminAuth;