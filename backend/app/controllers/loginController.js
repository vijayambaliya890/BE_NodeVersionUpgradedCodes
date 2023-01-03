const staffLeave = require("../models/staffLeave");

const _ = require("lodash"),
  os = require("os"),
  mongoose = require("mongoose"),
  moment = require("moment"),
  bcrypt = require("bcrypt-nodejs"),
  dotenv = require("dotenv").config(),
  User = require("../models/user"),
  Verstion = require("../models/version"),
  uuid = require("node-uuid"),
  Company = require("../models/company"),
  Subsection = require("../models/subSection"),
  Setting = require("../models/setting"),
  PageSetting = require("../models/pageSetting"),
  jwt = require("jsonwebtoken"),
  nodemailer = require("nodemailer"),
  smtpTransport = require("nodemailer-smtp-transport"),
  PageSettingController = require("../controllers/company/pageSettingController.js"),
  CompanyUserController = require("./company/companyUserController"),
  challengeController = require("../controllers/common/challengeController"),
  hbs = require("nodemailer-express-handlebars"),
  mailer = require("../../helpers/mailFunctions"),
  __ = require("../../helpers/globalFunctions");

//Native Login
class nativeAuth {
  async login(req, res) {
    try {
      console.log("login");
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        "staffId",
        "password",
      ]);
      const doc = this;
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      } else {
        let searchQuery = {
          staffId: req.body.staffId.toLowerCase(),
          companyId: "5ac71c1b0b219861d50231df", // Default SATS as Company
          status: {
            $ne: 3,
          },
        };
        // Company Id Based
        if (req.body.companyId) {
          searchQuery.companyId = req.body.companyId;
        }
        // Company Name Based
        if (req.body.companyName) {
          let selectedCompany = await Company.findOne({
            name: {
              $regex: `^${req.body.companyName}$`,
              $options: "i",
            },
            status: 1,
          }).lean();
          if (selectedCompany) {
            searchQuery.companyId = selectedCompany._id;
          } else {
            return __.out(res, 300, "Company Not Found");
          }
        }

        let userData = await User.findOne(searchQuery).populate([
          {
            path: "subSkillSets",
            select: "name status",
            match: {
              status: 1,
            },
            populate: {
              path: "skillSetId",
              select: "name status",
              match: {
                status: 1,
              },
            },
          },
          {
            path: "appointmentId",
            select: "name status",
          },
          {
            path: "role",
            match: {
              status: 1,
            },
            select: "name description isFlexiStaff privileges",
            populate: {
              path: "privileges",
              match: {
                status: 1,
              },
              select: "name description flags privilegeCategoryId",
              populate: {
                path: "privilegeCategoryId",
                match: {
                  status: 1,
                },
                select: "name",
              },
            },
          },
          {
            path: "parentBussinessUnitId",
            select: "name",
            match: {
              status: 1,
            },
            populate: {
              path: "sectionId",
              match: {
                status: 1,
              },
              select: "name",
              populate: {
                path: "departmentId",
                match: {
                  status: 1,
                },
                select: "name",
                populate: {
                  path: "companyId",
                  match: {
                    status: 1,
                  },
                  select: "name",
                },
              },
            },
          },
          {
            path: "planBussinessUnitId",
            select: "name",
            match: {
              status: 1,
            },
            populate: {
              path: "sectionId",
              match: {
                status: 1,
              },
              select: "name",
              populate: {
                path: "departmentId",
                match: {
                  status: 1,
                },
                select: "name",
                populate: {
                  path: "companyId",
                  match: {
                    status: 1,
                  },
                  select: "name",
                },
              },
            },
          },
          {
            path: "viewBussinessUnitId",
            select: "name",
            match: {
              status: 1,
            },
            populate: {
              path: "sectionId",
              match: {
                status: 1,
              },
              select: "name",
              populate: {
                path: "departmentId",
                match: {
                  status: 1,
                },
                select: "name",
                populate: {
                  path: "companyId",
                  match: {
                    status: 1,
                  },
                  select: "name",
                },
              },
            },
          },
          {
            path: "companyId",
            select: "name email logo pathName",
          },
        ]);
        //__.log(userData, "searchQuery")
        if (userData === null) {
          //return __.out(res, 300, 'Authentication failed. Wrong password.');
          return __.out(res, 300, "User ID or Password incorrect.");
        } else if (userData !== null) {
          // let validP = userData.validPassword(req.body.password);
          // if(validP && !('loggedIn' in userData && !!userData.loggedIn)){
          //     const data = {_id: userData._id, otpSentAt: moment().utc().format()}
          //     const token = jwt.sign(data, process.env.API_KEY, {
          //         expiresIn: '2h'
          //     });
          //     return __.out(res, 201, {token, message:'You need to reset your password.', firstLogin:true});
          // } else
          if (userData.status != 1 && userData.status != 0) {
            return __.out(res, 300, "Authentication failed.Inactive account.");
          } else {
            let userInfo = async () => {
              try {
                // Multiple device login
                let tokenId = uuid.v4();
                userData.tokenList = userData.tokenList || [];
                userData.tokenList = [...userData.tokenList, ...[tokenId]]; // since push is not working,this version

                userData.loggedIn = Date.now();
                if (req.body.deviceToken)
                  userData.deviceToken = req.body.deviceToken;
                userData.loginAttempt = 0; // reset login attempt
                let updatedData = await userData.save(),
                  doc = updatedData.toObject(),
                  privilegeFlags = await __.getUserPrivilegeObject(
                    doc.role.privileges
                  ),
                  user = {
                    id: doc._id,
                    loggedIn: doc.loggedIn,
                    roleId: doc.role._id,
                    isFlexiStaff: doc.role.isFlexiStaff,
                    privileges: privilegeFlags,
                    tokenId: tokenId,
                  },
                  token = jwt.sign(user, process.env.API_KEY),
                  newUserData = _.pick(doc, [
                    "_id",
                    "name",
                    "email",
                    "staffId",
                    "appointmentId",
                    "companyId",
                    "profilePicture",
                    "parentBussinessUnitId",
                    "planBussinessUnitId",
                    "viewBussinessUnitId",
                    "doj",
                    "contactNumber",
                    "role",
                    "subSkillSets",
                    "airportPassExpiryDate",
                    "staffPassExpiryDate",
                    "status",
                    "allBUAccess",
                  ]);

                newUserData.privilegeFlags = privilegeFlags;
                newUserData.userId = userData._id;
                delete newUserData._id;
                delete newUserData.role.privileges;

                // Check user is admin or not
                newUserData.isAdmin = await CompanyUserController.isAdmin(
                  newUserData
                );
                const leaveGroupData = await staffLeave.findOne({
                  userId: newUserData.userId,
                });
                newUserData.allBUAccess = newUserData.allBUAccess || 0;
                if (leaveGroupData) {
                  newUserData.leaveGroupId = leaveGroupData.leaveGroupId;
                }
                return __.out(res, 201, {
                  data: newUserData,
                  token: "Bearer " + token,
                });
              } catch (error) {
                __.log(error);
                return __.out(res, 300, "Something went wrong");
              }
            };
            if (
              userData.parentBussinessUnitId &&
              userData.parentBussinessUnitId == null
            ) {
              return __.out(
                res,
                300,
                "Your Parent BussinessUnit is in Inactive."
              );
            }
            let validPassword = userData.validPassword(req.body.password);
            const checkValidInfo = async function () {
              let settingData = await PageSetting.findOne({
                companyId: userData.companyId,
              }).lean();
              if (!userData.pwdManage) {
                userData.pwdManage = {
                  pwdUpdatedAt: moment().utc().format(),
                  pwdList: [],
                };
                await User.findOneAndUpdate(
                  {
                    _id: userData._id,
                  },
                  {
                    $set: {
                      pwdManage: userData.pwdManage,
                    },
                  }
                );
              }

              // Max Login Attempt Try
              if (settingData && settingData.pwdSettings) {
                let pwdManage = settingData.pwdSettings;
                let pwdStatus = pwdManage.status;
                if (pwdStatus == 1 && pwdManage.maxLoginAttempt > 0) {
                  if (userData.loginAttempt >= pwdManage.maxLoginAttempt) {
                    userData.status = 0;
                    userData.tokenList = [];
                    await userData.save();
                    return {
                      code: 300,
                      hint:
                        "Maximum login attempt reached. Account Locked. Contact you administrator",
                    };
                  }
                }
              }
              return null;
            };
            const validationResponse = await checkValidInfo();
            if (!!validationResponse) {
              return __.out(
                res,
                validationResponse.code,
                validationResponse.hint
              );
            }
            if (!validPassword) {
              userData.loginAttempt = userData.loginAttempt
                ? ++userData.loginAttempt
                : 1;
              await userData.save();
              //return __.out(res, 300, 'Authentication failed. Wrong password.');
              return __.out(res, 300, "User ID or Password incorrect.");
            } else if (userData.status === 0) {
              return __.out(
                res,
                300,
                "Account Locked. Contact you administrator"
              );
            } else {
              if (
                req.body.userType &&
                req.body.userType == 2 &&
                userData.role.isFlexiStaff == 1
              ) {
                return __.out(
                  res,
                  300,
                  "Authentication failed. Invalid account."
                );
              } else {
                let settingData = await PageSetting.findOne({
                  companyId: userData.companyId,
                }).lean();
                if (settingData && settingData.pwdSettings) {
                  let pwdManage = settingData.pwdSettings;
                  let pwdStatus = pwdManage.status;
                  if (pwdStatus == 1 && pwdManage.pwdDuration > 0) {
                    let nextUpdated = moment(userData.pwdManage.pwdUpdatedAt)
                      .add(pwdManage.pwdDuration, "days")
                      .utc();
                    let currentDate = moment().utc();

                    if (currentDate.isAfter(nextUpdated)) {
                      const data = {
                        _id: userData._id,
                        otpSentAt: moment().utc().format(),
                      };
                      const token = jwt.sign(data, process.env.API_KEY, {
                        expiresIn: "2h",
                      });
                      return __.out(res, 201, {
                        token,
                        message:
                          "Password expired. please change the password.",
                        passwordExpired: true,
                      });
                    }
                  }
                }
                return userInfo();
              }
            }
          }
        }
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 300, "Something went wrong try later");
    }
  }

  async checkUserRegistration(req, res, settingData) {
    try {
      let user = await User.findById(req.user._id)
        .populate("companyId")
        .select(
          "staffId primaryMobileNumber email otpSetup otherFields companyId optSetup"
        )
        .lean();
      if (
        settingData &&
        settingData.pwdSettings &&
        settingData.pwdSettings.status === 1
      ) {
        settingData.loginFields = settingData.loginFields || [];
        const requiredFields = settingData.loginFields.reduce(
          (prev, curr, i) => {
            if (curr.status === 3) {
              return prev;
            }
            const index = user.otherFields.findIndex((u) =>
              __.isEqualObjectIds(u.fieldId, curr._id)
            );
            return -1 !== index && !!user.otherFields[index].value
              ? prev
              : prev.concat(curr);
          },
          []
        );
        if (requiredFields.length) {
          return {
            customFields: true,
            status: false,
            message: `One more step to Complete your registration`,
            requiredFields,
          };
        }

        const pwdSettings = settingData.pwdSettings;
        const otpSentFor = pwdSettings.otpSentFor;
        if (
          otpSentFor === 2 &&
          !(!!user.primaryMobileNumber || !!user.countryCode)
        ) {
          return {
            registration: true,
            status: false,
            message: "Please register your mobile number here",
            otpSentFor,
          };
        } /* else if (otpSentFor === 1 && !(!!user.otpSetup) && !(!!user.otpSetup.emailVerified)){
                    return { status:false, firstLogin: true, message: `OTP sent to your email ${firstNumber}****${lastNumber}`, otpSentFor };
                }*/
        if (
          otpSentFor === 2 &&
          !(!!user.otpSetup && !!user.otpSetup.mobileVerified)
        ) {
          const data = { _id: user._id, otpSentAt: moment().utc().format() };
          const token = jwt.sign(data, process.env.API_KEY, {
            expiresIn: "2h",
          });
          // return __.out(res, 201, {
          return {
            token,
            message: "You need to reset your password.",
            firstLogin: true,
          };
        }
      }
      return false;
    } catch (error) {
      __.log(error);
      return __.out(res, 300, "Something went wrong try later");
    }
  }

  async verifyOtp(req, res) {
    try {
      const { token, otp, forgotPassword } = req.body;
      let parsedToken = null;
      try {
        parsedToken = jwt.verify(token, process.env.API_KEY);
      } catch (error) {
        return __.out(res, 300, "OTP was expired or Invalid");
      }
      const user = await User.findById(parsedToken._id).lean();
      const b = moment(parsedToken.otpSentAt);
      const a = moment();
      if (
        !!parsedToken &&
        `${parsedToken.otp}` === `${otp}` &&
        a.diff(b, "hours") < 2
      ) {
        if (!!forgotPassword) {
          return __.out(res, 201, "Otp verified");
        }
        let data = {};
        if (!!parsedToken.primaryMobileNumber && !!parsedToken.countryCode) {
          //const otpSetup = { mobileVerified: true };
          data = {
            primaryMobileNumber: parsedToken.primaryMobileNumber,
            countryCode: parsedToken.countryCode,
          };
        } else if (!!parsedToken.email) {
          //const otpSetup = { emailVerified: true };
          data = { email: parsedToken.email };
        }
        await User.findByIdAndUpdate(user._id, {
          $set: data,
        });
        return __.out(res, 201, "Successfully updated");
      }
      return __.out(res, 300, "OTP was expired or Invalid");
    } catch (error) {
      __.log(error);
      return __.out(res, 300, "Something went wrong try later");
    }
  }

  async requestOtp(req, res) {
    try {
      const {
        primaryMobileNumber,
        countryCode,
        email,
        userId,
        staffId,
        pathName
      } = req.body;
      let user = null;
      const condition =
        !!primaryMobileNumber && !!countryCode
          ? { primaryMobileNumber, countryCode }
          : !!email
          ? { email }
          : false;
      if (!condition) {
        return __.out(res, 300, "Please enter all required fields");
      }
      if (!!staffId) {
        const companyId = await Company.findOne({
            pathName: {
                $regex: new RegExp('^'+ pathName + '$', "i") },
                status: 1
            }).select("name").lean();
        let condition2 = {
            staffId: staffId.toLowerCase(),
            companyId: companyId._id,
            ...condition
        }
        user = await User.findOne(condition2)
          .populate({
            path: "companyId",
          })
          .lean();
      } else if (!!userId) {
        user = await User.findById(userId)
          .populate({
            path: "companyId",
          })
          .lean();
      }
      console.log("Otp send for :", {
        primaryMobileNumber,
        countryCode,
        email,
        userId,
        staffId,
      });
      if (!(!!user) && !!primaryMobileNumber && !!countryCode && !!staffId) {
        const userFind = await User.findOne({
          staffId: staffId.toLowerCase(),
        }).lean();
        if (!!userFind)
          return __.out(
            res,
            300,
            "This mobile number not registered with this account"
          );
      }
      if (!(!!user)) {
        return __.out(res, 300, "User not found");
      }
      if ((!!primaryMobileNumber && !!countryCode) || !!email) {
      } else {
        return __.out(res, 300, "Please enter all required fields");
      }
      //let user = await User.findById(userId).lean();
      let data = {};
      const otp = Math.floor(100000 + Math.random() * 900000);
      let firstNumber, lastNumber;
      if (!!primaryMobileNumber && !!countryCode) {
        firstNumber = countryCode;
        lastNumber = primaryMobileNumber.substring(
          primaryMobileNumber.length - 3
        );
        data = { primaryMobileNumber, countryCode, _id: user._id };

        let companyName = await Company.findById(user.companyId._id)
          .select("name")
          .lean();
        // companyName = !!companyName.name.match(/sats/i) ? "MySATS+" : companyName.name;
        let body = `${otp} is your one time password from xForce+ for ${companyName.name}`;

        const isSats = !!companyName.name.match(/sats/i);
        if (isSats) {
          body = `${otp} is your one time MySATS+ password`;
        }
        await __.sendSMS({
          body: body,
          to: `${countryCode}${primaryMobileNumber}`,
          isSats: isSats,
        });
      }
      if (!!email) {
        firstNumber = email.substring(0, 3);
        lastNumber = email.substring(email.length - 6);
        data = { email, _id: user._id };
        const url =
          req.protocol + "://" + req.get("host") + `/${user.companyId.logo}`;
        user.companyLogoUrl = url;
        user.otp = otp;
        await mailer.sendOtp(user);
      }
      data["otp"] = otp;
      data["otpSentAt"] = new Date();
      if (!!user) {
        const token = jwt.sign(data, process.env.API_KEY, {
          expiresIn: "2h",
        });
        return __.out(res, 201, {
          token,
          firstLogin: true,
          message: `OTP sent to ${firstNumber}****${lastNumber}`,
        });
      }
      return __.out(res, 300, "User not found");
    } catch (error) {
      __.log(error);
      return __.out(res, 300, "Something went wrong try later");
    }
  }

  async sendOtp(req, res) {
    try {
      const { primaryMobileNumber, countryCode, email, staffId } = req.body;
      if (
        !(!!staffId && (!!email || (!!countryCode && !!primaryMobileNumber)))
      ) {
        return __.out(res, 300, "Provide all details");
      }
      let query = { staffId: staffId };
      if (!!contactNumber) {
        query.contactNumber = primaryMobileNumber.toString().trim();
      } else if (!!email) {
        query.email = email;
      }
      const users = await User.find(query).lean();
      let message = ``;
      if (users.length) {
        if (!!email) {
          const firstNumber = email.substring(0, 3);
          const lastNumber = email.substring(email.length - 5);
          message = `OTP sent to your email ${firstNumber}****${lastNumber}`;
          users[0].optSetup.emailVerified = false;
          //return __.out(res, 201, {firstLogin:true, userId:users[0]._id, message:`OTP sent to your email ${firstNumber}****${lastNumber}`});
        } else if (!!contactNumber) {
          const firstNumber = contactNumber.split(" ")[0];
          const lastNumber = contactNumber
            .split(" ")[1]
            .substring(contactNumber.split(" ")[1].length - 3);
          users[0].optSetup.mobileVerified = false;
          message = `OTP sent to your mobile ${firstNumber}****${lastNumber}`;
          //return __.out(res, 201, {firstLogin:true, userId:users[0]._id, message:`OTP sent to your mobile ${firstNumber}****${lastNumber}`});
        }
        const otp = Math.floor(100000 + Math.random() * 900000);
        users[0].otpSentAt = new Date();
        users[0].optSetup.otp = `${otp}`;
        await User.findByIdAndUpdate(users[0]._id, {
          $set: {
            optSetup: users[0].optSetup,
          },
        });
        return __.out(res, 201, {
          firstLogin: !!req.body.firstLogin,
          userId: users[0]._id,
          message,
        });
      } else {
        return __.out(res, 300, "Invalid user data");
      }
    } catch (error) {
      __.log(error);
      return __.out(res, 300, "Something went wrong try later");
    }
  }

  async setLatestVersion(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const {
        android,
        ios,
        description,
        playStorePath,
        appleStorePath,
        status,
        app,
      } = req.body;
      let latestVersion = await Verstion({
        android,
        ios,
        description,
        playStorePath,
        appleStorePath,
        status,
        app,
      }).save();
      if (latestVersion) {
        return __.out(res, 201, "Version details successfully inserted");
      }
      return __.out(res, 201, "Version details not inserted successfully");
    } catch (error) {
      return __.out(res, 300, "Something went wrong try later");
    }
  }

  async getLatestVersion(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const version = await Verstion.findOne({ app: req.params.app })
        .sort({ _id: -1 })
        .lean();
      return __.out(res, 201, version);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, "Something went wrong try later");
    }
  }

  test(req, res) {
    __.out(res, 200);
  }

  async logout(req, res) {
    try {
      let updatedData = {
        loggedIn: new Date(),
      };
      if ("web" !== req.headers["platform"]) {
        updatedData.deviceToken = "";
      }
      var updated = await User.findOneAndUpdate(
        {
          _id: req.user._id,
        },
        {
          $set: updatedData,
          $pull: {
            tokenList: req.user.tokenId,
          },
        }
      );
      return __.out(res, 201, "You have been logged out successfully");
    } catch (err) {
      __.log(err);
      __.out(res, 300, "Something went wrong try later");
    }
  }
  async feedback(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        "topic",
        "message",
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      } else {
        let settings = await PageSetting.findOne({
          companyId: req.user.companyId
        })
        .select('adminEmail techEmail')
        .lean();

        if (settings) {
          var toEmail =
              req.body.topic === "admin"
                ? settings.adminEmail
                : settings.techEmail,
            mailData = {
              staffId: req.user.staffId,
              name: req.user.name,
              topic: req.body.topic,
              message: req.body.message,
              adminEmail: toEmail
            };

          console.log("---mailData---", mailData);
          await mailer.feedback(mailData);

          return __.out(
            res,
            201,
            "Your feedback has been successfully submitted."
          );
        } else {
          return __.out(res, 300, "Something went wrong");
        }
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 300, "Someting went wrong try later");
    }
  }
  async forgotPassword(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        "staffId",
        "email",
      ]);
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      } else {
        let userData = await User.findOne({
          staffId: req.body.staffId.toLowerCase(),
          status: 1,
        })
          .populate({
            path: "companyId",
            select: "name email logo pathName",
          })
          .lean();
        if (userData != null) {
          if (
            userData.email.toLowerCase().trim() !=
            req.body.email.toLowerCase().trim()
          ) {
            return __.out(res, 300, "Invalid email");
          }

          let emailToken = jwt.sign(
              {
                _id: userData._id,
                loggedIn: userData.loggedIn,
              },
              process.env.API_KEY,
              {
                expiresIn: "2h",
              }
            ),
            mailData = {
              userName: userData.name,
              userEmail: userData.email,
              staffId: userData.staffId,
              emailToken: emailToken,
              companyData: userData.companyId,
            };

          await mailer.forgotPassword(mailData);

          return res.status(200).json({
            message:
              "Please check your registered email account to reset your password.",
            data: {
              staffId: userData.staffId,
            },
          });
        } else {
          return __.out(res, 300, "Invalid StaffId");
        }
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 300, "Something went wrong");
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
        loggedIn: parsedToken.loggedIn,
      }).lean();

      if (userData != null) {
        return __.out(res, 201, {
          data: {
            userId: parsedToken._id,
          },
          message: "Link verified successfully",
        });
      } else {
        return __.out(res, 300, "Invalid link / Link has already been used");
      }
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "Your link has expired",
        });
      }
      __.log(err);
      return __.out(res, 300, "Something went wrong try later");
    }
  }

  async resetPassword(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = __.checkRequiredFields(req, ["token", "password"]);
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      let parsedToken = jwt.verify(req.body.token, process.env.API_KEY);

      const b = moment(parsedToken.otpSentAt);
      const a = moment();
      if (!!parsedToken && a.diff(b, "hours") < 2) {
        let userData = await User.findOne({
          _id: parsedToken._id,
          status: 1,
        });

        if (userData === null) {
          return __.out(res, 300, "Invalid staffId");
        } else {
          // Validate Password
          let passwordValidation = await __.pwdValidation(
            userData,
            req.body.password
          );
          if (passwordValidation.status == false) {
            return __.out(res, 300, passwordValidation.message);
          }

          const { generateHash } = new User();
          const hashVal = generateHash(req.body.password);

          // Password Reuse Condition
          if (
            passwordValidation.pwdSettings != null &&
            userData.pwdManage &&
            userData.pwdManage.pwdList.length > 0
          ) {
            let reUseCount = passwordValidation.pwdSettings.pwdReUse;
            let pwdList = userData.pwdManage.pwdList;
            // Last Mentions Passwords
            pwdList = pwdList.reverse().slice(0, reUseCount);
            const pwdExists = pwdList.some((v) =>
              bcrypt.compareSync(req.body.password, v.password)
            );
            if (pwdExists) {
              return __.out(
                res,
                300,
                `Couldn't use the last ${reUseCount} passwords`
              );
            }
          }

          // Set Password
          userData.password = hashVal;
          userData.loggedIn = moment().utc().format();

          // Track password
          if (!userData.pwdManage) {
            userData.pwdManage = {
              pwdUpdatedAt: moment().utc().format(),
              pwdList: [
                {
                  password: hashVal,
                  createdAt: moment().utc().format(),
                },
              ],
            };
          } else {
            userData.pwdManage.pwdUpdatedAt = moment().utc().format();
            userData.pwdManage.pwdList = [
              ...userData.pwdManage.pwdList,
              ...[
                {
                  password: hashVal,
                  createdAt: moment().utc().format(),
                },
              ],
            ];
          }
          userData.otpSetup = { mobileVerified: true };

          // Logout all devices
          userData.tokenList = [];

          await userData.save();

          return __.out(res, 201, `Password updated successfully`);
        }
      } else {
        return __.out(res, 300, "Token Expired. Please login again.");
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 300, "Something went wrong try later");
    }
  }

  async sendFeedback(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = __.checkRequiredFields(req, [
        "name",
        "phone",
        "emailId",
        "feedback",
      ]);
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      let mailData = {
        name: req.body.name,
        phone: req.body.phone,
        email: req.body.emailId,
        feedback: req.body.feedback,
      };
      await mailer.userFeedback(mailData);
      return __.out(res, 201, "Your Feedback is Noted");
    } catch (err) {
      __.log(err);
      return __.out(res, 300, "Something went wrong try later");
    }
  }

  async getCompany(req, res) {
    try {
      var companyData = await Company.findOne({
        pathName: { $regex: new RegExp('^'+ req.params.pathName + '$', "i") },
        status: 1,
      })
        .select("-email -departments")
        .lean();

      if (!companyData) {
        return __.out(res, 300, "Company Not Found");
      } else {
        // Get PageSetting Data also
        let req = {
          user: {
            companyId: companyData._id,
          },
          body: {
            internalApi: true,
          },
        };
        companyData.pageSettingData = await PageSettingController.read(req);
        return __.out(res, 201, companyData);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 300, "Something went wrong try later");
    }
  }

  async sendFeedback(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = __.checkRequiredFields(req, ["emailId", "feedback"]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
        return;
      }

      let mailData = {
        email: req.body.emailId,
        feedback: req.body.feedback,
      };
      await mailer.userFeedback(mailData);
      return __.out(res, 201, "Your Feedback is Noted");
    } catch (err) {
      __.log(err);
      return __.out(res, 300, "Something went wrong try later");
    }
  }

  async pwdChangeDuration(req, res) {
    try {
      let returnData = {
        status: true,
      };

      // Get PageSetting Data also
      req.body.internalApi = true;
      let settingData = await PageSettingController.read(req);

      // Set Default password management data
      if (!req.user.pwdManage) {
        req.user.pwdManage = {
          pwdUpdatedAt: moment().utc().format(),
          pwdList: [],
        };
        await User.findOneAndUpdate(
          {
            _id: req.user._id,
          },
          {
            $set: {
              pwdManage: req.user.pwdManage,
            },
          }
        );
      }
      let flag = false;

      // Check Password Change Duration Exceeded
      if (settingData && settingData.pwdSettings) {
        if (!("otpSentFor" in settingData.pwdSettings)) {
          settingData.pwdSettings.otpSentFor = 2;
          settingData.pwdSettings.passwordType = 1;
          await PageSetting.findByIdAndUpdate(settingData._id, {
            $set: {
              pwdSettings: settingData.pwdSettings,
            },
          });
          settingData = await PageSettingController.read(req);
        }
        let pwdManage = settingData.pwdSettings;
        let pwdStatus = pwdManage.status;
        if (pwdStatus == 1 && pwdManage.pwdDuration > 0) {
          let nextUpdated = moment(req.user.pwdManage.pwdUpdatedAt)
            .add(pwdManage.pwdDuration, "days")
            .utc();
          let currentDate = moment().utc();
          flag = currentDate.isAfter(nextUpdated);
          if (flag) {
            flag = true;
            let emailToken = jwt.sign(
              {
                _id: req.user._id,
                loggedIn: req.user.loggedIn,
              },
              process.env.API_KEY,
              {
                expiresIn: "4h",
              }
            );
            returnData.status = false;
            returnData.emailToken = emailToken;
          }
        }
      }

      // From Auth Api
      if (req.body.internalRes == true) {
        return returnData;
      } else {
        if (flag) {
          const data = {
            _id: req.user._id,
            otpSentAt: moment().utc().format(),
          };
          const token = jwt.sign(data, process.env.API_KEY, {
            expiresIn: "2h",
          });
          return __.out(res, 201, {
            token,
            message: "You need to reset your password.",
            firstLogin: true,
          });
          //return __.out(res, 300, {message:'Your session was expired.'});
        }
        const data = await this.checkUserRegistration(req, res, settingData);
        if (!!data) {
          return __.out(res, 201, data);
        }
      }
      return __.out(res, 201, returnData);
    } catch (err) {
      __.log(err);
      return __.out(res, 300, "Something went wrong try later");
    }
  }
}
nativeAuth = new nativeAuth();
module.exports = nativeAuth;
