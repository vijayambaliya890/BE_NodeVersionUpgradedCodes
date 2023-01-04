// Controller Code Starts here
const { resolve } = require('bluebird');
const User = require('../../models/user'),
  Roles = require('../../models/role'),
  UserLog = require('../../models/userLog'),
  SubSection = require('../../models/subSection'),
  Appointment = require('../../models/appointment'),
  SkillSet = require('../../models/skillSet'),
  SubSkillSet = require('../../models/subSkillSet'),
  PrivilegeCategory = require('../../models/privilegeCategory'),
  nodemailer = require('nodemailer'),
  bcrypt = require('bcrypt-nodejs'),
  smtpTransport = require('nodemailer-smtp-transport'),
  fs = require('fs'),
  path = require('path'),
  util = require('util'),
  crypto = require('crypto'),
  hbs = require('nodemailer-express-handlebars'),
  notification = require('./notificationController'),
  json2csv = require('json2csv').parse,
  Company = require('../../models/company'),
  Pagesettings = require('../../models/pageSetting'),
  Role = require('../../models/role'),
  UserField = require('../../models/userField'),
  OpsGroup = require('../../models/ops'),
  OtherNotification = require('../../models/otherNotifications'),
  moment = require('moment'),
  _ = require('lodash'),
  __ = require('../../../helpers/globalFunctions'),
  mongoose = require('mongoose'),
  mailer = require('../../../helpers/mailFunctions'),
  xlsx = require('node-xlsx'),
  FCM = require('../../../helpers/fcm'),
  LeaveGroup = require('../../models/leaveGroup'),
  StaffLeave = require('../../models/staffLeave'),
  Scheme = require('../../models/scheme');

/* Email Credentials */
const transporter = nodemailer.createTransport(
  smtpTransport({
    service: 'gmail',
    host: 'smtpout.secureserver.net',
    port: 465,
    secure: true,
    auth: {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PASSWORD,
    },
  }),
);

const options = {
  viewEngine: {
    extname: '.hbs',
    layoutsDir: '../../public/email/',
  },
  viewPath: 'public/email/',
  extName: '.hbs',
};

class user {
  async create(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult;
      if (req.body.skillSetTierType != 1) {
        requiredResult = await __.checkRequiredFields(
          req,
          [
            'isFlexiStaff',
            'name',
            'staffId',
            'appointmentId',
            'role',
            'staffPassExpiryDate',
            'status',
            'email',
          ],
          'user',
        );
      } else {
        requiredResult = await __.checkRequiredFields(
          req,
          [
            'isFlexiStaff',
            'name',
            'staffId',
            'appointmentId',
            'role',
            'staffPassExpiryDate',
            'status',
            'email',
          ],
          'user',
        );
      }
      if (!__.checkSpecialCharacters(req.body)) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      // 'parentBussinessUnitId','planBussinessUnitId', 'viewBussinessUnitId'
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        /* check staff ID already exists or not*/
        let doc = await User.findOne({
          staffId: req.body.staffId.toLowerCase(),
          companyId: req.user.companyId,
          status: {
            $ne: 3,
          },
        });

        if (doc === null) {
          /*staffId not exists*/
          let generatedPassword = await __.makePwd(8);
          const pagesettings = await Pagesettings.findOne({
            companyId: req.user.companyId,
          }).lean();
          const { generateHash } = new User();

          if (
            pagesettings.pwdSettings &&
            pagesettings.pwdSettings.status === 1
          ) {
            if (pagesettings.pwdSettings.passwordType === 2) {
              generatedPassword = pagesettings.pwdSettings.defaultPassword;
              user.password = generateHash(generatedPassword);
            } else {
              user.password = generateHash(generatedPassword);
            }
          }

          let insert = req.body;
          insert.staffId = req.body.staffId.toLowerCase();
          insert.companyId = req.user.companyId;
          if (req.body.countryCode) {
            insert.countryCode = req.body.countryCode;
          }
          if (req.file) {
            insert.profilePicture = req.file.path.substring(6);
          }

          // Restrict All Bu access edit
          let userAdmin = await this.isAdmin(req.user, res);
          if (!userAdmin) {
            delete req.body.allBUAccess;
          }

          //create new model
          var post = new User(insert);
          post.password = post.generateHash(generatedPassword);
          //save model to MongoDB
          let insertedUser = await post.save();
          req.body.userId = insertedUser._id;
          // add to staffLeave
          //let doj = new Date();
          req.body.doj = new Date();
          if (req.body.leaveGroupId) {
            await this.createStaffLeave(req.body, req);
          }

          var data = {
            userId: req.body.userId,
            userData: post,
          };

          await notification.addUserToDynamicNotifications(data, res);
          /* sending mail */
          // Get Company Data
          let companyData = await Company.findOne({
            _id: req.user.companyId,
          }).lean();
          let mailDoc = {
            email: req.body.email,
            userName: req.body.name,
            staffId: req.body.staffId,
            password: generatedPassword,
            companyData: companyData,
          };

          await mailer.newCompanyUser(mailDoc);

          if (req.file) {
            const output = /*await*/ __.scanFile(
              req.file.filename,
              `public/uploads/profilePictures/${req.file.filename}`,
            );
            if (!!output) {
              // return __.out(res, 300, output);
            }
          }
          this.read(
            req,
            res,
          ); /*calling read fn with userId(last insert id). it calls findOne fn in read */
        } else {
          /*StaffId already exists */
          return __.out(res, 300, 'StaffId already exists');
        }
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async createStaffLeave(data, req) {
    console.log('Uppppppppp', data.userId);
    const leaveGroupData = await LeaveGroup.findOne({
      _id: data.leaveGroupId,
    }).populate([
      {
        path: 'leaveType.leaveTypeId',
        match: { isActive: true },
      },
    ]);
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
    console.log('data.doj', data.doj);
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
        month = monthDiff(
          new Date(data.doj),
          new Date(new Date().setFullYear(yearValue)),
        );
        year = diff_years(
          new Date(data.doj),
          new Date(new Date().setFullYear(yearValue)),
        );
      }
      console.log('year', year, month);
      leaveGroupData.leaveType.forEach((leave) => {
        if (leave.leaveTypeId) {
          let quota = leave.quota;
          if (month > 0) {
            leave.proRate.forEach((mo) => {
              if (
                mo.fromMonth <= month &&
                mo.toMonth >= month &&
                quota < mo.quota
              ) {
                console.log('in Month', mo.quota);
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
          console.log('quota', quota);
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
    let obj = {
      userId: data.userId,
      plannedBy: req.user._id,
      leaveGroupId: data.leaveGroupId,
      businessUnitId: data.parentBussinessUnitId,
      companyId: req.user.companyId,
      leaveDetails: leaveDetails,
    };
    var post = new StaffLeave(obj);
    let insertedUser = await post.save();
  }
  async updateStaffLeave(data, req) {
    const leaveGroupData = await LeaveGroup.findOne({
      _id: data.leaveGroupId,
    }).populate([
      {
        path: 'leaveType.leaveTypeId',
        match: { isActive: true },
      },
    ]);
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
        month = monthDiff(
          new Date(data.doj),
          new Date(new Date().setFullYear(yearValue)),
        );
        year = diff_years(
          new Date(data.doj),
          new Date(new Date().setFullYear(yearValue)),
        );
      }
      leaveGroupData.leaveType.forEach((leave) => {
        if (leave.leaveTypeId) {
          let quota = leave.quota;
          if (month > 0) {
            leave.proRate.forEach((mo) => {
              if (
                mo.fromMonth <= month &&
                mo.toMonth >= month &&
                quota < mo.quota
              ) {
                console.log('in Month', mo.quota);
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
    let staffLeaveData = await StaffLeave.findOne({ userId: data.userId });
    if (staffLeaveData) {
      for (let i = 0; i < leaveDetails.length; i++) {
        let leaveType = leaveDetails[i];
        let staffLeaveType = staffLeaveData.leaveDetails.filter((lt) => {
          return (
            lt.leaveTypeId.toString() == leaveType.leaveTypeId.toString() &&
            lt.year == leaveType.year
          );
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
        userId: data.userId,
        updatedBy: req.user._id,
        leaveGroupId: data.leaveGroupId,
        businessUnitId: data.parentBussinessUnitId,
        companyId: req.user.companyId,
        leaveDetails: leaveDetails,
      };
      let update = await StaffLeave.findOneAndUpdate(
        { userId: obj.userId },
        {
          $set: {
            leaveDetails: obj.leaveDetails,
            updatedBy: obj.updatedBy,
            leaveGroupId: obj.leaveGroupId,
            isActive: true,
          },
        },
      );
    } else {
      this.createStaffLeave(data, req);
    }
  }
  /* User list for system admin to edit users */
  async editList(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let pageNum = req.query.start ? parseInt(req.query.start) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum * limit) / limit;
      let sort = {};
      const getSort = (val) => (val === 'asc' ? 1 : -1);
      if (req.query.order) {
        const sortData = [`name`, `staffId`, `appointmentId.name`];
        let orderData = req.query.order;
        sort = orderData.reduce((prev, curr, i) => {
          const key = sortData[curr.column];
          prev[key] = getSort(curr.dir);
          return prev;
        }, sort);
      }
      let buarray = req.user.planBussinessUnitId || [];
      if (!!req.query.onlyViewBU) {
        buarray = req.user.viewBussinessUnitId || [];
      }
      let where = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
        status: {
          $ne: 3 /* $ne => not equal*/,
        },
        parentBussinessUnitId: {
          $in: buarray.map((v) => mongoose.Types.ObjectId(v)),
          $exists: true,
        },
        appointmentId: {
          $exists: true,
        },
      };
      let query = [
        {
          path: 'appointmentId',
          select: 'name',
        },
        {
          path: 'parentBussinessUnitId',
          select: 'name _id',
          match: {
            status: 1,
            sectionId: {
              $exists: true,
            },
          },
          populate: {
            path: 'sectionId',
            select: 'name _id',
            match: {
              status: 1,
              departmentId: {
                $exists: true,
              },
            },
            populate: {
              path: 'departmentId',
              select: 'name _id',
              match: {
                status: 1,
                companyId: {
                  $exists: true,
                },
              },
              populate: {
                path: 'companyId',
                select: 'name _id',
                match: {
                  status: 1,
                },
              },
            },
          },
        },
      ];
      const recordsTotal = await User.find(where).populate(query).count();
      let recordsFiltered = recordsTotal;
      if (!!req.query.search && req.query.search.value) {
        const searchQuery = {
          $regex: `${req.query.search.value}`,
          $options: 'ixs',
        };
        where['$or'] = [{ name: searchQuery }, { staffId: searchQuery }];
        recordsFiltered = await User.find(where).populate(query).count();
      }
      let data = await User.find(where)
        .populate(query)
        .select('appointmentId parentBussinessUnitId staffId name')
        .sort(sort)
        .skip(skip)
        .limit(limit);

      data = data.map((v) => {
        let bu = '';
        if (!!v.parentBussinessUnitId) {
          bu = v.parentBussinessUnitId.name;
          if (!!v.parentBussinessUnitId.sectionId) {
            bu = v.parentBussinessUnitId.sectionId.name + ' > ' + bu;
            if (!!v.parentBussinessUnitId.sectionId.departmentId) {
              bu =
                v.parentBussinessUnitId.sectionId.departmentId.name +
                ' > ' +
                bu;
              if (!!v.parentBussinessUnitId.sectionId.departmentId.companyId) {
                bu =
                  v.parentBussinessUnitId.sectionId.departmentId.companyId
                    .name +
                  ' > ' +
                  bu;
              }
            }
          }
        }
        let obj = {
          _id: v._id,
          name: v.name,
          staffId: v.staffId,
          appointment: { name: v.appointmentId.name },
          businessUnit: bu,
          contactNumber: v.contactNumber,
          doj: v.doj,
        };
        return obj;
      });

      let result = {
        draw: req.query.draw || 0,
        recordsTotal,
        recordsFiltered,
        data,
      };
      return res.status(201).json(result);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Somethign went werong');
    }
  }

  async readUserByBU(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const page = !!req.body.page ? parseInt(req.body.page) * 10 : 0;
      let query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
      };
      if (
        Array.isArray(req.body.parentBussinessUnitId) &&
        'parentBussinessUnitId' in req.body
      ) {
        if (-1 === req.body.parentBussinessUnitId.indexOf('all')) {
          query = {
            parentBussinessUnitId: {
              $in: req.body.parentBussinessUnitId.map((val) =>
                mongoose.Types.ObjectId(val),
              ),
            },
          };
        } else {
          query = {
            parentBussinessUnitId: {
              $in: req.user.planBussinessUnitId.map((val) =>
                mongoose.Types.ObjectId(val),
              ),
            },
          };
        }
      } else {
        return __.out(res, 201, { items: [], count_filtered: 0 });
      }
      if (req.body.q !== undefined) {
        query.name = {
          $regex: req.body.q.toString(),
          $options: 'ixs',
        };
      }
      query.status = {
        $nin: [2],
      };
      let users = await User.aggregate([
        {
          $match: query,
        },
        { $skip: page },
        { $limit: 10 },
        { $project: { name: 1, _id: 1, parentBussinessUnitId: 1, staffId: 1 } },
      ]).allowDiskUse(true);

      users.forEach((user) => (user.name = `${user.name} (${user.staffId})`));
      const count_filtered = await User.find(query).count();
      if (!users) {
        return __.out(res, 300, 'No users Found');
      }
      return __.out(res, 201, { items: users, count_filtered });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, error);
    }
  }
  async readUserByPlanBU(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const page = !!req.body.page ? parseInt(req.body.page) * 10 : 0;
      let query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
      };
      let planBu = await User.findOne(
        { _id: req.user._id },
        { _id: 0, planBussinessUnitId: 1 },
      );
      planBu = planBu.planBussinessUnitId;
      req.body.parentBussinessUnitId = planBu;
      if (
        Array.isArray(req.body.parentBussinessUnitId) &&
        'parentBussinessUnitId' in req.body
      ) {
        if (-1 === req.body.parentBussinessUnitId.indexOf('all')) {
          query = {
            parentBussinessUnitId: {
              $in: req.body.parentBussinessUnitId.map((val) =>
                mongoose.Types.ObjectId(val),
              ),
            },
          };
        } else {
          query = {
            parentBussinessUnitId: {
              $in: req.user.planBussinessUnitId.map((val) =>
                mongoose.Types.ObjectId(val),
              ),
            },
          };
        }
      } else {
        return __.out(res, 201, { items: [], count_filtered: 0 });
      }
      if (req.body.q !== undefined && req.body.q.trim()) {
        query = {
          $text: { $search: '"' + req.body.q.toString() + '"' },
        };
      }
      query.status = {
        $nin: [2],
      };
      let users = await User.aggregate([
        {
          $match: query,
        },
        { $skip: page },
        { $limit: 10 },
        { $project: { name: 1, _id: 1, parentBussinessUnitId: 1, staffId: 1 } },
      ]).allowDiskUse(true);

      const count_filtered = await User.find(query).count();
      if (!users) {
        return __.out(res, 300, 'No users Found');
      }
      return __.out(res, 201, { items: users, count_filtered });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, error);
    }
  }
  async readUserByPlanBUForAssignShift(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const page = !!req.body.page ? parseInt(req.body.page) * 10 : 0;
      let query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
      };
      let planBu = await User.findOne(
        { _id: req.user._id },
        { _id: 0, planBussinessUnitId: 1 },
      );
      planBu = planBu.planBussinessUnitId;
      req.body.parentBussinessUnitId = planBu;
      if (
        Array.isArray(req.body.parentBussinessUnitId) &&
        'parentBussinessUnitId' in req.body
      ) {
        if (-1 === req.body.parentBussinessUnitId.indexOf('all')) {
          query = {
            parentBussinessUnitId: {
              $in: req.body.parentBussinessUnitId.map((val) =>
                mongoose.Types.ObjectId(val),
              ),
            },
          };
        } else {
          query = {
            parentBussinessUnitId: {
              $in: req.user.planBussinessUnitId.map((val) =>
                mongoose.Types.ObjectId(val),
              ),
            },
          };
        }
      } else {
        return __.out(res, 201, { items: [], count_filtered: 0 });
      }
      console.log('req.body.q', req.body.q);
      if (req.body.q !== undefined && req.body.q.trim()) {
        query = {
          $or: [
            {
              name: {
                $regex: req.body.q.toString(),
                $options: 'i',
              },
            },
            {
              staffId: {
                $regex: req.body.q.toString(),
                $options: 'i',
              },
            },
          ],
          status: 1,
        };
      }
      query.status = 1;
      var limit = 1;
      let users = await User.aggregate([
        {
          $match: query,
        },
        {
          $lookup: {
            from: 'schemes',
            localField: 'schemeId',
            foreignField: '_id',
            as: 'schemeInfo',
          },
        },
        {
          $unwind: '$schemeInfo',
        },
        {
          $match: {
            'schemeInfo.shiftSchemeType': { $in: [2, 3] },
          },
        },
        { $skip: page },
        { $limit: 10 },
        {
          $project: {
            schemeId: 1,
            'schemeInfo.shiftSchemeType': 1,
            name: 1,
            _id: 1,
            parentBussinessUnitId: 1,
            staffId: 1,
          },
        },
      ]).allowDiskUse(true);

      var count_filtered = await User.aggregate([
        {
          $match: query,
        },
        {
          $lookup: {
            from: 'schemes',
            localField: 'schemeId',
            foreignField: '_id',
            as: 'schemeInfo',
          },
        },
        {
          $unwind: '$schemeInfo',
        },
        {
          $match: {
            'schemeInfo.shiftSchemeType': { $in: [2, 3] },
          },
        },
        {
          $project: {
            schemeId: 1,
            'schemeInfo.shiftSchemeType': 1,
            _id: 1,
            name: 1,
            parentBussinessUnitId: 1,
            staffId: 1,
          },
        },
        {
          $facet: {
            users: [{ $limit: +limit }],
            totalCount: [
              {
                $count: 'count',
              },
            ],
          },
        },
      ]);
      if (!users) {
        return __.out(res, 300, 'No users Found');
      }
      //
      //var users = count_filtered[0].users;
      if (count_filtered[0].users.length > 0) {
        count_filtered = count_filtered[0].totalCount[0].count;
      } else {
        count_filtered = 0;
      }
      // console.log('count_filtered', count_filtered[0].totalCount[0].count)
      return __.out(res, 201, { items: users, count_filtered });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, error);
    }
  }
  async read(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let where = {
        companyId: req.user.companyId,
        status: {
          $ne: 3 /* $ne => not equal*/,
        },
      };
      if (req.body.status) where.status = req.body.status;
      let findOrFindOne,
        populateArray = [
          {
            path: 'subSkillSets',
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
            path: 'appointmentId',
            select: 'name status',
            match: {
              status: 1,
            },
          },
          {
            path: 'mainSkillSets',
            select: 'name status',
            match: {
              status: 1,
            },
          },
          {
            path: 'schemeId',
            select: 'schemeName status',
            match: {
              status: 1,
            },
          },
          {
            path: 'parentBussinessUnitId',
            select: 'name orgName',
            populate: {
              path: 'sectionId',
              select: 'name',
              populate: {
                path: 'departmentId',
                select: 'name',
                populate: {
                  path: 'companyId',
                  select: 'name',
                },
              },
            },
          },
          {
            path: 'planBussinessUnitId',
            select: 'name sectionId appointments subSkillSets orgName',
            match: {
              status: 1,
            },
            populate: [
              {
                path: 'sectionId',
                select: 'name',
                populate: {
                  path: 'departmentId',
                  select: 'name',
                  populate: {
                    path: 'companyId',
                    select: 'name',
                  },
                },
              },
              {
                path: 'appointments',
                select: 'name status',
                match: {
                  status: 1,
                },
              },
              {
                path: 'subSkillSets',
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
            ],
          },
          {
            path: 'viewBussinessUnitId',
            select: 'name orgName',
            match: {
              status: 1,
            },
            populate: {
              path: 'sectionId',
              select: 'name',
              populate: {
                path: 'departmentId',
                select: 'name',
                populate: {
                  path: 'companyId',
                  select: 'name',
                },
              },
            },
          },
        ],
        users = null;

      if (req.body.userId) {
        where._id = req.body.userId;
        users = await User.findOne(where)
          .select('-password -pwdManage -tokenList')
          .populate([
            ...populateArray,
            {
              path: 'role',
              select: 'name description isFlexiStaff privileges',
              populate: {
                path: 'privileges',
                select: 'name description flags privilegeCategoryId',
                populate: {
                  path: 'privilegeCategoryId',
                  select: 'name',
                },
              },
            },
            {
              path: 'schemeId',
              select: 'schemeName',
              match: {
                status: 1,
              },
            },
            {
              path: 'leaveGroupId',
              select: 'name',
              match: {
                isActive: true,
              },
            },
          ])
          .lean();
      } else {
        populateArray.push(
          {
            path: 'role',
            select: 'name description isFlexiStaff privileges',
            populate: {
              path: 'privileges',
              select: 'name description privilegeCategoryId',
              populate: {
                path: 'privilegeCategoryId',
                select: 'name',
              },
            },
          },
          {
            path: 'schemeId',
            select: 'schemeName',
            match: {
              status: 1,
            },
          },
          {
            path: 'leaveGroupId',
            select: 'name',
            match: {
              isActive: true,
            },
          },
        );
        if (req.body.businessUnitId) {
          where.parentBussinessUnitId = mongoose.Types.ObjectId(
            req.body.businessUnitId,
          );
        }
        users = await User.find(where)
          .select('-password -pwdManage -tokenList')
          .populate(populateArray)
          .lean();
      }

      /*let users = await findOrFindOne
              .select("-password -pwdManage")
              .populate(populateArray)
              .lean();*/
      const sortBu = (user) => {
        let plan = user.planBussinessUnitId || [];
        user.planBussinessUnitId = plan
          .map((elem) => {
            if (!!elem.sectionId) {
              if (!!elem.sectionId.departmentId) {
                if (!!elem.sectionId.departmentId.companyId) {
                  elem.fullName = `${elem.sectionId.departmentId.companyId.name}>${elem.sectionId.departmentId.name}>${elem.sectionId.name}>${elem.name}`;
                }
              }
            }
            return elem;
          })
          .sort((a, b) =>
            !!a.fullName ? a.fullName.localeCompare(b.fullName) : '',
          );
        return user;
      };
      if (Array.isArray(users)) {
        users = users.map(sortBu);
      } else {
        users = sortBu(users);
      }
      const userFields = await UserField.find({
        companyId: req.user.companyId,
        status: 1,
      })
        .sort({
          indexNum: 1,
        })
        .lean();
      const userFieldsUpdate = (otherFields) => {
        otherFields = otherFields || [];
        return userFields.reduce((prev, curr, i) => {
          curr.value = curr.value || '';
          const field = otherFields.find((o) =>
            __.isEqualObjectIds(o.fieldId, curr._id),
          );
          if (!!field) {
            curr.value = field.value || '';
          }
          return prev.concat(curr);
        }, []);
      };
      console.log('=========== here  ==========>', req.body.userId);
      if (req.body.userId) {
        console.log('Inside if');
        //return res.json({ users })
        let appointmentIds = await User.find({
          parentBussinessUnitId: {
            $in: users.planBussinessUnitId
              ? users.planBussinessUnitId.map((b) => b._id)
              : [],
          },
        })
          .select('appointmentId')
          .populate([
            {
              path: 'appointmentId',
              select: 'name status',
            },
            {
              path: 'parentBussinessUnitId',
              select: 'status',
            },
          ])
          .lean();
        if (users.planBussinessUnitId) {
          users.planBussinessUnitId.forEach((bu) => {
            bu.appointments = bu.appointments ? bu.appointments : [];
            const buaps = JSON.parse(JSON.stringify(bu.appointments)),
              allaps = appointmentIds
                .filter(
                  (aps) =>
                    aps.parentBussinessUnitId._id.toString() ===
                    bu._id.toString(),
                )
                .map((aps) => aps.appointmentId);
            bu.appointments.push(
              ...allaps.filter(
                (aaps) =>
                  !buaps.find(
                    (bap) => bap._id.toString() === aaps._id.toString(),
                  ),
              ),
            );
          });
        }
        /*findone*/
        var privilegeFlags = await __.getUserPrivilegeObject(
          users.role.privileges,
        );
        users.userId = users._id;
        users.privilegeFlags = privilegeFlags;
        delete users.role.privileges;
        users.otherFields = userFieldsUpdate(users.otherFields);
        if (!!req.body.planBussinessUnitId) {
          await __.updateAllBuToUser(users, true);
        }

        const opsGroup = await OpsGroup.findOne(
          { userId: { $in: [req.body.userId] }, isDelete: false },
          { opsGroupName: 1 },
        );
        console.log('==================== OPS GROUP ===================');
        console.log(opsGroup);
        console.log(
          '===========================================================',
        );
        if (opsGroup && Object.keys(opsGroup).length) {
          users['opsGroupName'] = opsGroup.opsGroupName;
        } else users['opsGroupName'] = '-';

        __.out(res, 201, {
          data: users,
        });
      } else {
        /*find */
        users = users.map((u) => {
          u.otherFields = userFieldsUpdate(u.otherFields);
          return u;
        });
        return __.out(res, 201, {
          data: users,
        });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async readSingle(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let where = {};
      let findOrFindOne,
        populateArray = [
          {
            path: 'subSkillSets',
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
            path: 'appointmentId',
            select: 'name status',
            match: {
              status: 1,
            },
          },
          {
            path: 'mainSkillSets',
            select: 'name status',
            match: {
              status: 1,
            },
          },
          {
            path: 'parentBussinessUnitId',
            select: 'name orgName',
            populate: {
              path: 'sectionId',
              select: 'name',
              populate: {
                path: 'departmentId',
                select: 'name',
                populate: {
                  path: 'companyId',
                  select: 'name',
                },
              },
            },
          },
          {
            path: 'planBussinessUnitId',
            select: 'name sectionId appointments subSkillSets',
            match: {
              status: 1,
            },
            populate: [
              {
                path: 'sectionId',
                select: 'name orgName',
                populate: {
                  path: 'departmentId',
                  select: 'name',
                  populate: {
                    path: 'companyId',
                    select: 'name',
                  },
                },
              },
              {
                path: 'appointments',
                select: 'name status',
                match: {
                  status: 1,
                },
              },
              {
                path: 'subSkillSets',
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
            ],
          },
          {
            path: 'viewBussinessUnitId',
            select: 'name orgName',
            match: {
              status: 1,
            },
            populate: {
              path: 'sectionId',
              select: 'name',
              populate: {
                path: 'departmentId',
                select: 'name',
                populate: {
                  path: 'companyId',
                  select: 'name',
                },
              },
            },
          },
        ],
        users = null;

      if (req.body.userId) {
        where._id = req.body.userId;
        users = await User.findOne(where)
          .select(
            '-password -pwdManage -tokenList -otpSetup -deviceToken -loggedIn -companyId -staffPassExpiryDate',
          )
          .populate([
            ...populateArray,
            {
              path: 'role',
              select: 'name description',
            },
            {
              path: 'schemeId',
              select: 'schemeName',
              match: {
                status: 1,
              },
            },
          ])
          .lean();
      }
      /*let users = await findOrFindOne
              .select("-password -pwdManage")
              .populate(populateArray)
              .lean();*/
      const sortBu = (user) => {
        let plan = user.planBussinessUnitId || [];
        user.planBussinessUnitId = plan
          .map((elem) => {
            if (!!elem.sectionId) {
              if (!!elem.sectionId.departmentId) {
                if (!!elem.sectionId.departmentId.companyId) {
                  elem.fullName = `${elem.sectionId.departmentId.companyId.name}>${elem.sectionId.departmentId.name}>${elem.sectionId.name}>${elem.name}`;
                }
              }
            }
            return elem;
          })
          .sort((a, b) =>
            !!a.fullName ? a.fullName.localeCompare(b.fullName) : '',
          );
        return user;
      };

      users = sortBu(users);
      // const userFields = await UserField.find({
      //   companyId: req.user.companyId,
      //   status: 1,
      // })
      //   .sort({
      //     indexNum: 1,
      //   })
      //   .lean();
      // const userFieldsUpdate = (otherFields) => {
      //   otherFields = otherFields || [];
      //   return userFields.reduce((prev, curr, i) => {
      //     curr.value = curr.value || "";
      //     const field = otherFields.find((o) => __.isEqualObjectIds(o.fieldId, curr._id));
      //     if (!!field) {
      //       curr.value = field.value || "";
      //     }
      //     return prev.concat(curr);
      //   }, []);
      // };
      if (req.body.userId) {
        //return res.json({ users })
        // let appointmentIds = await User.find({ parentBussinessUnitId: { $in: users.planBussinessUnitId ? users.planBussinessUnitId.map(b => b._id) : [] } })
        //   .select("appointmentId").populate([{
        //     path: "appointmentId",
        //     select: "name status"
        //   }, {
        //     path: "parentBussinessUnitId",
        //     select: "status"
        //   }]).lean();
        // if (users.planBussinessUnitId) {
        //   users.planBussinessUnitId.forEach(bu => {
        //     bu.appointments = bu.appointments ? bu.appointments : [];
        //     const buaps = JSON.parse(JSON.stringify(bu.appointments)),
        //       allaps = appointmentIds.filter(aps => aps.parentBussinessUnitId._id.toString() === bu._id.toString()).map(aps => aps.appointmentId);
        //     bu.appointments.push(...allaps.filter(aaps => !buaps.find(bap => bap._id.toString() === aaps._id.toString())))
        //   })
        // }
        /*findone*/

        // var privilegeFlags = await __.getUserPrivilegeObject(users.role.privileges);
        // users.userId = users._id;
        // users.privilegeFlags = privilegeFlags;
        // delete users.role.privileges;
        //  users.otherFields = userFieldsUpdate(users.otherFields);
        __.out(res, 201, {
          data: users,
        });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async getSingleUserData(userId) {
    return new Promise((resolve, reject) => {});
  }
  async update(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(
        req,
        ['userId'],
        'userUpdate',
      );
      if (!__.checkSpecialCharacters(req.body, 'profile update')) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      } else {
        delete req.body.staffId;
        let doc = await User.findOne({
          _id: req.body.userId,
          status: { $ne: 3 },
        });
        if (doc === null) {
          return __.out(res, 300, 'Invalid userId');
        } else {
          /* old data for comparison */
          let oldData = doc.toObject();
          console.log('olddate', oldData.schemeId);
          // Reset Login Attempt if user back to active from inactive
          if (doc.status == 2 && req.body.status == 1) {
            doc.loginAttempt = 0;
          }

          // Restrict All Bu access edit
          let userAdmin = await this.isAdmin(req.user, res);

          if (!userAdmin) {
            delete req.body.allBUAccess;
          }

          // If it is web, update editable access
          let otherFields;
          if (req.body.otherFields) {
            if (typeof req.body.otherFields == 'string') {
              req.body.otherFields = JSON.parse(req.body.otherFields);
            }
            if (req.headers.platform == 'web') {
              otherFields = req.body.otherFields;
            } else {
              // Update Only Accessible Custom Fields
              let companyFields = await UserField.find({
                companyId: req.user.companyId,
                status: {
                  $ne: 3,
                },
              })
                .select('editable')
                .lean();
              __.log(companyFields);
              otherFields = req.body.otherFields
                .map((v) => {
                  let i = companyFields.findIndex(
                    (x) => x._id.toString() == v.fieldId,
                  );
                  // unknown fields
                  if (i == -1) {
                    return false;
                  }
                  /*if (companyFields[i].editable == true) {
                                  return v
                                }
                                return false;*/
                  return v;
                })
                .filter(Boolean);
            }
          }
          if (!!req.body.countryCode) {
            doc.countryCode = req.body.countryCode;
          }

          Object.assign(doc, req.body);
          if (req.body.password) {
            req.body.password = req.body.password.trim();
            doc.password = doc.generateHash(req.body.password);
            // Logout all devices
            doc.tokenList = [];
            const userData = doc;
            let passwordValidation = await __.pwdValidation(
              userData,
              req.body.password,
            );
            if (passwordValidation.status == false) {
              return __.out(res, 300, passwordValidation.message);
            }

            const { generateHash } = new User();
            const hashVal = doc.password;
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
                bcrypt.compareSync(req.body.password, v.password),
              );
              if (pwdExists) {
                return __.out(
                  res,
                  300,
                  `Couldn't use the last ${reUseCount} passwords`,
                );
              }
            }
          }
          if (req.body.subSkillSets)
            doc.subSkillSets = eval(req.body.subSkillSets);
          if (req.body.planBussinessUnitId)
            doc.planBussinessUnitId = eval(req.body.planBussinessUnitId);
          if (req.body.viewBussinessUnitId)
            doc.viewBussinessUnitId = eval(req.body.viewBussinessUnitId);
          if (req.body.otherFields) doc.otherFields = otherFields;
          if (req.file) doc.profilePicture = req.file.path.substring(6);

          // Make Expiry the Token, If user is deactivated
          if (doc.status == 2) {
            doc.loggedIn = Date.now();
          }

          if (req.body.schemeId) {
            doc.schemeId = req.body.schemeId;
          }
          if (
            req.body.leaveGroupId &&
            oldData.leaveGroupId != req.body.leaveGroupId
          ) {
            if (oldData.leaveGroupId) {
              doc.leaveGroupId = req.body.leaveGroupId;
              console.log('updated Leave Group');
              await this.updateStaffLeave(doc, req);
              // update old one
            } else {
              // first time
              console.log('first Leave Group');
              doc.leaveGroupId = req.body.leaveGroupId;
              await this.createStaffLeave(doc, req);
            }
          }
          console.log('req.headers.platform', req.headers.platform);
          if (req.body.from == 'updateUser' && !req.body.leaveGroupId) {
            doc.leaveGroupId = null;
            const leaveGroupRemoved = await StaffLeave.findOneAndRemove({
              userId: req.body.userId,
            });
          }
          let result = await doc.save();

          if (result === null) {
            __.out(res, 300, 'Something went wrong');
          } else {
            /*updated successfully */
            /*add user to dynamic notification if BU or sub skill set matched starts */
            if (req.body.schemeId) {
              console.log('oldddd', oldData.schemeId, req.body.schemeId);
              if (
                oldData.schemeId &&
                oldData.schemeId.toString() !== req.body.schemeId.toString()
              ) {
                // scheme change
                var schemeLog = {
                  updatedBy: req.user._id,
                  oldSchemeId: oldData.schemeId,
                  newSchemeId: req.body.schemeId,
                  userId: req.body.userId,
                  businessUnitId: oldData.parentBussinessUnitId,
                  type: 1,
                };
                //new UserLog.save
                new UserLog(schemeLog).save();
              }
            }
            var data = {
              userId: req.body.userId,
              deviceToken: doc.deviceToken,
              userData: result,
              or: [
                {
                  notifyByBusinessUnits: req.body.parentBussinessUnitId,
                },
                {
                  notifyBySubSkillSets: {
                    $in: doc.subSkillSets,
                  },
                },
                {
                  notifyByAppointments: req.body.appointmentId,
                },
              ],
            };

            await notification.addUserToDynamicNotifications(data, res);
            /*for dynamic notification ends */
            if (doc._id !== req.body.userId) {
              /* push notifications */
              if (doc.deviceToken) {
                let pushNotificationData = {
                    title: 'Profile updated',
                    body: 'Your profile has been updated by the administrator',
                  },
                  collapseKey = req.body.userId;
                let FCMresponse = await FCM.push(
                  [doc.deviceToken],
                  pushNotificationData,
                  collapseKey,
                );
              }

              /* saving to other notification collection */
              let ignore = ['userId', 'isFlexiStaff'];
              let bodyKeys = Object.keys(req.body).filter((x) => {
                if (!ignore.includes(x)) {
                  return x;
                }
              });

              /* checking for input changes and pushing them into changed fields */
              let keysToCheck = _.pick(oldData, bodyKeys);
              let changedFields = [];
              for (let key in keysToCheck) {
                // check eqality for dates
                if (
                  key == 'staffPassExpiryDate' ||
                  key == 'airportPassExpiryDate' ||
                  key == 'doj'
                ) {
                  if (req.body[key]) {
                    // ignore null or "" values
                    let updateDate = new Date(
                      moment(req.body[key], 'MM-DD-YYYY HH:mm:ss Z')
                        .utc()
                        .format(),
                    ).toISOString();
                    if (!moment(keysToCheck[key]).isSame(updateDate)) {
                      changedFields.push(key);
                    }
                  }
                } else {
                  // check equality for primitive and arrays
                  if (
                    key == 'planBussinessUnitId' ||
                    key == 'viewBussinessUnitId' ||
                    key == 'subSkillSets'
                  ) {
                    // deep comparing arrays with ObjectId
                    if (
                      !__.compareArray(
                        eval(req.body[key]).map((x) =>
                          mongoose.Types.ObjectId(x),
                        ),
                        keysToCheck[key],
                      )
                    ) {
                      changedFields.push(key);
                    }
                  } else {
                    // handling primitives
                    if (keysToCheck[key] != req.body[key]) {
                      changedFields.push(key);
                    }
                  }
                }
              }

              if (changedFields.length) {
                __.log(changedFields, 'changedFields');
                changedFields = changedFields
                  .map(__.camelToSpace)
                  .map((x) => x.replace(/\sid/g, ''))
                  .join(', ');
                __.log(changedFields, 'after modification');
                let otherNotificationData = {
                  user: doc._id,
                  fromUser: req.user._id,
                  title: 'Profile Updated',
                  description: `${changedFields} has been updated by administrator`,
                  type: 1,
                };
                let newNotification = new OtherNotification(
                  otherNotificationData,
                );
                let savedOtherNotificationData = await newNotification.save();
              }
            }
            this.read(req, res);
          }
        }
      }
      if (req.file) {
        const output = /*await*/ __.scanFile(
          req.file.filename,
          `public/uploads/profilePictures/${req.file.filename}`,
        );
        if (!!output) {
          // return __.out(res, 300, output);
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async updateOtherFields(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const userId = req.user._id;
      const user = await User.findById(userId).select('otherFields').lean();
      const otherFieldsInput = req.body.otherFields || [];
      let userFields = await UserField.find({
        companyId: req.user.companyId,
        status: 1,
      })
        .sort({
          indexNum: 1,
        })
        .lean();
      const otherFields = userFields.map((v) => {
        const index = user.otherFields.findIndex((o) =>
          __.isEqualObjectIds(o.fieldId, v._id),
        );
        if (-1 !== index) {
          v.value = user.otherFields[index].value;
        }
        const field = otherFieldsInput.find((o) =>
          __.isEqualObjectIds(o._id, v._id),
        );
        if (!!field) {
          v.value = field.value;
        }
        return { fieldId: v._id, value: v.value || null };
      });
      let update = await User.findByIdAndUpdate(userId, {
        $set: {
          otherFields: otherFields,
        },
      });
      return __.out(res, 201, { message: 'Successufully updated' });
    } catch (error) {
      __.log(error);
      return __.out(res, 201, 'Something went wrong try later');
    }
  }

  async statusUpdate(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, ['userId']);
      if (!__.checkSpecialCharacters(req.body)) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let doc = await User.findOne({
          _id: req.body.userId,
          status: {
            $ne: 3,
          },
        });
        if (!!doc) {
          doc.status =
            req.url == '/active'
              ? 1
              : req.url == '/inactive'
              ? 2
              : 3; /*(3 => delete)*/
          if (doc.status == 1) {
            doc.loginAttempt = 0;
            doc.status = 1;
          }
          let result = await doc.save();
          if (!!result) {
            return __.out(res, 201, 'Successfully updated');
          }
          return __.out(res, 300, 'Something went wrong');
        }
        return __.out(res, 300, 'Invalid userId');
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Read Customisable Fields
  async readUserFields(req, res) {
    try {
      let where = {
        companyId: req.user.companyId,
        status: 1,
      };
      let userFields = await UserField.find(where)
        .sort({
          indexNum: 1,
        })
        .lean();

      return __.out(res, 201, userFields);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async test(req, res) {
    if (!__.checkHtmlContent(req.body)) {
      return __.out(res, 300, `You've entered malicious input`);
    }
    if (req.body.deviceToken) var deviceTokens = [req.body.deviceToken];
    else
      var deviceTokens = [
        'cyK4R_7g86Y:APA91bFFbVIBT4XYVQR34QZYJnDWpNV1PpWIWrmYWixDCRk1QttSoanUitjOn3f00bP35N_AUZEQ6IvVH3ipH51PtzCVjjsSE3AePb90Vl0QZZWfL8CraNFKVckI3AuMA9i1ezvdKP29',
      ];

    var pushNotificationData = {
        title: 'notification title',
        body: 'notification sample description',
        bodyText: `Standby shift on XXX to XXX is available for confirmation`,
        bodyTime: [moment().unix(), moment().unix()],
        bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
        //redirect: 'makeBookings'
      },
      collapseKey = 'seconds-' + Math.random();
    var response = await FCM.push(
      deviceTokens,
      pushNotificationData,
      collapseKey,
    );
    __.out(res, 201, response);
  }

  //=======================>>>>>>>>>>>>>>>>>>Bulk file upload<<<<<<<<<<<<<<<<<<<<<<<===========================================
  async uploadBulkUsers(req, res) {
    try {
      const startIntegration = async (
        titleIndex,
        allTitles,
        nonUpdatedUser,
        userData,
      ) => {
        const companyData = await Company.findOne({
          _id: req.user.companyId,
        }).lean();
        // Get all roles/appoint/businessunit list
        let roles = await Roles.find({
          companyId: req.user.companyId,
          status: 1,
        })
          .select('name')
          .lean();
        let appointments = await Appointment.find({
          companyId: req.user.companyId,
          status: 1,
        })
          .select('name')
          .lean();
        let LeaveGroups = await LeaveGroup.find({
          companyId: req.user.companyId,
          isActive: true,
          adminId: req.user._id,
        })
          .select('name')
          .lean();
        let SchemeDetail = await Scheme.find({
          companyID: req.user.companyId,
          status: true,
        })
          .select('schemeName')
          .lean();
        let skillSetsData = await SkillSet.find({
          companyId: req.user.companyId,
          status: 1,
        })
          .populate({ path: 'subSkillSets', match: { status: 1 } })
          .select('name')
          .lean();
        let businessUnitsIds = await __.getCompanyBU(
          req.user.companyId,
          'subsection',
          1,
        );
        let businessUnits = await SubSection.find({
          _id: { $in: businessUnitsIds },
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
        let staticFields = [
          'staffName',
          'staffId',
          'appointment',
          'contact',
          'email',
          'role',
          'shiftSchemeId',
          'businessUnitParent',
          'skillSets',
          'businessUnitPlan',
          'businessUnitView',
          'leaveGroup',
        ];
        let generatedPassword = await __.makePwd(8);
        const pagesettings = await Pagesettings.findOne({
          companyId: req.user.companyId,
        }).lean();

        for (let elem of userData) {
          // user Data with static fields
          const role = roles.find(
            (role) => role.name == elem[titleIndex['role']],
          );
          const appointment = appointments.find(
            (appointment) =>
              appointment.name == elem[titleIndex['appointment']],
          );
          const LeaveGroup = LeaveGroups.find(
            (LeaveGroupp) => LeaveGroupp.name == elem[titleIndex['leaveGroup']],
          );
          let schemeId;
          if (elem[titleIndex['Shift Scheme Name']]) {
            schemeId = SchemeDetail.find(
              (scheme) =>
                scheme.schemeName ==
                elem[titleIndex['Shift Scheme Name']].trim(),
            );
          }
          const getFullBU = (businessUnit) =>
            `${businessUnit.sectionId.departmentId.companyId.name}>${businessUnit.sectionId.departmentId.name}>${businessUnit.sectionId.name}>${businessUnit.name}`;
          const parentBussinessUnit = businessUnits.find((businessUnit) => {
            let fullBU = getFullBU(businessUnit);
            return fullBU == elem[titleIndex['businessUnitParent']];
          });
          const convertNametoBuId = function (namesList) {
            const businessUnitNames = !!namesList ? namesList.split(',') : [];
            return businessUnits.reduce((prev, curr, i) => {
              let fullBU = getFullBU(curr);
              if (-1 != businessUnitNames.indexOf(fullBU)) {
                prev.push(curr._id);
              }
              return prev;
            }, []);
          };
          const staffId = `${elem[titleIndex['staffId']]}`.toLowerCase();
          const emailRegexp = (email) =>
            /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
              email,
            );
          // Validate Staff Id/Parent BU/Role/Appointment
          // Sub Skill Set
          let user = {
            name: elem[titleIndex['staffName']],
            staffId: staffId,
            appointmentId: !!appointment ? appointment._id : null,
            leaveGroupId: !!LeaveGroup ? LeaveGroup._id : null,
            contactNumber: elem[titleIndex['contact']] || '',
            email: emailRegexp(elem[titleIndex['email']])
              ? elem[titleIndex['email']]
              : null,
            role: !!role ? role._id : null,
            parentBussinessUnitId: !!parentBussinessUnit
              ? parentBussinessUnit._id
              : null,
            skillSets: elem[titleIndex['skillSets']]
              ? elem[titleIndex['skillSets']].split(',')
              : [],
            subSkillSets: [],
            planBussinessUnitId: convertNametoBuId(
              elem[titleIndex['businessUnitPlan']],
            ),
            viewBussinessUnitId: convertNametoBuId(
              elem[titleIndex['businessUnitView']],
            ),
            schemeId: schemeId && schemeId._id ? schemeId._id : null,
          };
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
          const isUser = await User.findOne({
            staffId: user.staffId,
            companyId: req.user.companyId,
          }).lean();
          let updatedUserData = null;
          if (!!isUser) {
            for (const key in user) {
              if (user.hasOwnProperty(key)) {
                const element = user[key];
                if (!!element) {
                  if (
                    [
                      'planBussinessUnitId',
                      'viewBussinessUnitId',
                      'subSkillSets',
                    ].includes(key) &&
                    !element.length
                  ) {
                    delete user[key];
                  }
                } else {
                  delete user[key];
                }
              }
            }
            // update leave group
            if (
              user.leaveGroupId &&
              (!isUser.leaveGroupId ||
                isUser.leaveGroupId.toString() != user.leaveGroupId.toString())
            ) {
              user.userId = isUser._id;
              console.log('updatettttttttttttttttt');
              this.updateStaffLeave(user, req);
            }
            updatedUserData = await User.findOneAndUpdate(
              {
                companyId: req.user.companyId,
                staffId: user.staffId.toLowerCase(),
              },
              {
                $set: user,
              },
            );
          } else {
            if (
              !!user.parentBussinessUnitId &&
              !!user.role &&
              !!user.appointmentId &&
              !!user.staffId &&
              !!user.email
            ) {
            } else {
              let reason = '';
              if (user.staffId !== 'undefined') {
                if (!user.staffId) reason = reason + 'staffId Incorrect,';
                if (!user.parentBussinessUnitId)
                  reason = reason + 'Parent BU incorrect,';
                if (!user.role) reason = reason + 'Role incorrect,';
                if (!user.appointmentId)
                  reason = reason + 'Appointment incorrect,';
                if (!user.email) reason = reason + 'Email incorrect';
                // if (!isShiftScheme) reason = reason + 'Shift Scheme Name is not correct';
                const nonupUserData = {
                  staffId: elem[titleIndex['staffId']],
                  parentBussinessUnit: elem[titleIndex['businessUnitParent']],
                  role: elem[titleIndex['role']],
                  // schemeName: elem[titleIndex['Shift Scheme Name']],
                  appointment: elem[titleIndex['appointment']],
                  email: elem[titleIndex['email']],
                  reason,
                };
                nonUpdatedUser.push(nonupUserData);
              }
              continue;
            }
            const { generateHash } = new User();
            if (pagesettings.pwdSettings.status === 1) {
              if (pagesettings.pwdSettings.passwordType === 2) {
                generatedPassword = pagesettings.pwdSettings.defaultPassword;
                user.password = generateHash(generatedPassword);
              } else {
                user.password = generateHash(generatedPassword);
              }
            }
            user.status = 1;
            user.companyId = req.user.companyId;
            user.staffId = user.staffId.toLowerCase();
            updatedUserData = await new User(user).save();
            // called leaveGroup Create
            if (user.leaveGroupId) {
              // const leaveGroupData = JSON.parse(JSON.stringify(user));
              updatedUserData.userId = updatedUserData._id;
              this.createStaffLeave(updatedUserData, req);
            }
            /* sending mail */
            let mailDoc = {
              email: updatedUserData.email,
              userName: updatedUserData.name,
              staffId: updatedUserData.staffId,
              password: generatedPassword,
              companyData: companyData,
            };
            mailer.newCompanyUser(mailDoc);
          }
          for (let singleField of allTitles) {
            // Check Custom Field or not
            if (staticFields.indexOf(singleField) === -1) {
              let userFieldId = await UserField.findOne({
                fieldName: singleField,
                companyId: req.user.companyId,
                status: 1,
              }).lean();
              if (userFieldId) {
                // Update if exists
                let existField = await User.update(
                  {
                    _id: updatedUserData._id,
                    'otherFields.fieldId': userFieldId._id.toString(),
                  },
                  {
                    $set: {
                      'otherFields.$.value': elem[titleIndex[singleField]],
                    },
                  },
                );
                // Add if not exists
                if (existField.nModified == 0) {
                  const newFieldData = {
                    fieldId: userFieldId._id.toString(),
                    fieldName: userFieldId.fieldName,
                    indexNum: userFieldId.indexNum,
                    options: userFieldId.options,
                    required: userFieldId.required,
                    type: userFieldId.type,
                    value: elem[titleIndex[singleField]],
                  };
                  let returnedData = await User.findOneAndUpdate(
                    { _id: updatedUserData._id },
                    { $addToSet: { otherFields: newFieldData } },
                    { new: true },
                  );
                  __.log(userFieldId, returnedData);
                }
              }
            }
          }
        }
        fs.unlink(req.file.path, (data) => {});
        // If missing users exists
        // nonUpdatedUser = nonUpdatedUser.filter((user) => user.length);
        if (!!nonUpdatedUser.length) {
          // var buffer = xlsx.build([{ name: "Non Updated Users", data: nonUpdatedUser }]); // Returns a buffer
          // let writeXls = util.promisify(fs.writeFile);
          // Random file name
          // let fileName = crypto.randomBytes(8).toString("hex");
          let fileName = 'nonUpdated_bulkupload_' + new Date().getTime();
          // await writeXls(`public/uploads/bulkUpload/${fileName}.xlsx`, buffer);
          const titles = [
            'staffId',
            'parentBussinessUnit',
            'role',
            'schemeName',
            'appointment',
            'email',
            'reason',
          ];
          var csv = json2csv({
            data: nonUpdatedUser,
            fields: titles,
          });
          await fs.writeFile(
            `./public/uploads/bulkUpload/${fileName}.csv`,
            csv,
            (err) => {
              return __.out(res, 201, {
                nonUpdated: true,
                fileLink: `uploads/bulkUpload/${fileName}.csv`,
              });
            },
          );
        } else {
          return __.out(res, 201, { nonUpdated: false });
        }
      };
      const getFileData = (xlsFile) => {
        let excelData = xlsx.parse(req.file.path); // parses a file
        if (excelData.length) {
          let userData = excelData[0].data;
          let titleIndex = {},
            allTitles = [],
            // nonUpdatedUser = [userData[0]];
            nonUpdatedUser = [];
          userData[0].forEach((element, index) => {
            titleIndex[element] = index;
            allTitles[allTitles.length] = element;
          });
          userData.splice(0, 1);
          startIntegration(titleIndex, allTitles, nonUpdatedUser, userData);
        }
      };
      if (!!req.file) {
        getFileData(req.file);
      }
      if (req.file) {
        const output = /*await*/ __.scanFile(
          req.file.filename,
          `public/uploads/bulkUpload/${req.file.filename}`,
        );
        if (!!output) {
          // return __.out(res, 300, output);
        }
      }
    } catch (error) {
      console.log(' error : ', error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Check this user is admin or not
  async isAdmin(userData, res) {
    try {
      let categoryData = await PrivilegeCategory.findOne({
        name: 'System Admin',
      })
        .select('privileges')
        .lean();

      let { privileges } = categoryData;
      let systemAdminRoles = await Role.find({
        companyId: userData.companyId,
        privileges: {
          $all: privileges,
        },
      }).lean();
      let systemAdminRolesId = systemAdminRoles.map((x) => x._id.toString());
      let result = false;
      if (systemAdminRolesId.indexOf(userData.role._id.toString()) > -1) {
        result = true;
      }
      return result;
    } catch (error) {
      __.log(err);
      __.out(res, 500);
    }
  }

  // Locked Users
  async lockedUsers(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let pageNum = req.query.start ? parseInt(req.query.start) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum * limit) / limit;
      let where = {
        companyId: req.user.companyId,
        parentBussinessUnitId: {
          $in: req.user.planBussinessUnitId,
        },
        status: 0,
      };
      let recordsTotal = await User.count(where);
      if (!!req.query.search && req.query.search.value) {
        where['$or'] = [
          {
            name: {
              $regex: `${req.query.search.value}`,
              $options: 'ixs',
            },
          },
          {
            staffId: {
              $regex: `${req.query.search.value}`,
              $options: 'ixs',
            },
          },
          {
            contactNumber: {
              $regex: `${req.query.search.value}`,
              $options: 'ixs',
            },
          },
        ];
      }
      const appointmentCondition = { 'appointment.status': 1 };
      if (!!req.query.search && req.query.search.value) {
        appointmentCondition['appointment.name'] = {
          $regex: `${req.query.search.value}`,
          $options: 'ixs',
        };
      }
      let filteredRecords = await User.aggregate([
        { $match: where },
        {
          $lookup: {
            from: 'appointments',
            localField: 'appointmentId',
            foreignField: '_id',
            as: 'appointment',
          },
        },
        {
          $unwind: '$appointment',
        },
        {
          $match: appointmentCondition,
        },
      ]).allowDiskUse(true);
      const recordsFiltered = filteredRecords.length;
      let sort = { updatedAt: -1 };
      const getSort = (val) => (val === 'asc' ? 1 : -1);
      if (req.query.order) {
        const sortData = [`name`, `staffId`, `doj`, `contactNumber`, `name`];
        let orderData = req.query.order;
        sort = orderData.reduce((prev, curr, i) => {
          const key = sortData[curr.column];
          prev[key] = getSort(curr.dir);
          return prev;
        }, sort);
      }
      let users = await User.aggregate([
        { $match: where },
        {
          $lookup: {
            from: 'appointments',
            localField: 'appointmentId',
            foreignField: '_id',
            as: 'appointment',
          },
        },
        {
          $unwind: '$appointment',
        },
        {
          $match: appointmentCondition,
        },
        {
          $lookup: {
            from: 'subsections',
            localField: 'parentBussinessUnitId',
            foreignField: '_id',
            as: 'businessUnit',
          },
        },
        {
          $unwind: '$businessUnit',
        },
        {
          $lookup: {
            from: 'sections',
            localField: 'businessUnit.sectionId',
            foreignField: '_id',
            as: 'section',
          },
        },
        {
          $unwind: '$section',
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'section.departmentId',
            foreignField: '_id',
            as: 'department',
          },
        },
        {
          $unwind: '$department',
        },
        {
          $lookup: {
            from: 'companies',
            localField: 'department.companyId',
            foreignField: '_id',
            as: 'company',
          },
        },
        {
          $unwind: '$company',
        },
        {
          $project: {
            staffId: 1,
            name: 1,
            doj: 1,
            contactNumber: 1,
            'appointment.name': 1,
            'company.name': 1,
            'department.name': 1,
            'section.name': 1,
            'businessUnit.name': 1,
          },
        },
        {
          $sort: sort,
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]).allowDiskUse(true);
      let data = users.map((v) => {
        v[
          'businessUnit'
        ] = `${v.company.name} > ${v.department.name} > ${v.section.name} > ${v.businessUnit.name}`;
        delete v['company'];
        delete v['section'];
        delete v['department'];
        return v;
      });
      let result = {
        draw: req.query.draw || 0,
        recordsTotal,
        recordsFiltered,
        data,
      };
      return res.status(201).json(result);
      /*let populateArray = [{
              path: "subSkillSets",
              select: "name status",
              match: {
                status: 1
              },
              populate: {
                path: "skillSetId",
                select: "name status",
                match: {
                  status: 1
                }
              }
            },
            {
              path: "appointmentId",
              select: "name status",
              match: {
                status: 1
              }
            },
            {
              path: "parentBussinessUnitId",
              select: "name",
              populate: {
                path: "sectionId",
                select: "name",
                populate: {
                  path: "departmentId",
                  select: "name",
                  populate: {
                    path: "companyId",
                    select: "name"
                  }
                }
              }
            }
            ];

            let users = await User.find(where)
              .populate(populateArray)
              .select("name staffId doj email contactNumber")
              .sort(sort)
              .skip(skip)
              .limit(limit)
              .lean();

            users = users.map(v => {
              let parentBu = `${v.parentBussinessUnitId.sectionId.departmentId.companyId.name}>${v.parentBussinessUnitId.sectionId.departmentId.name}>${v.parentBussinessUnitId.sectionId.name}>${v.parentBussinessUnitId.name}`;
              v.parentBu = parentBu;
              return v;
            })

            let totalCount;
            let totalUserCount = await User.count(commonQuery);
            if (isSearched) {
              totalCount = await User.count(where);
            } else {
              totalCount = totalUserCount
            }

            let result = {
              draw: req.query.draw || 0,
              recordsTotal: totalUserCount || 0,
              recordsFiltered: totalCount || 0,
              data: users
            }*/
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }

  async getUserPrivilege(req, res) {
    try {
      let pre = req.user.role.privileges[0];
      let user = await User.findById(req.user._id).populate({
        path: 'role',
        match: {
          status: 1,
        },
        select: 'name description isFlexiStaff privileges',
        populate: {
          path: 'privileges',
          match: {
            status: 1,
          },
          select: 'name description flags privilegeCategoryId',
          populate: {
            path: 'privilegeCategoryId',
            match: {
              status: 1,
            },
            select: 'name',
          },
        },
      });
      const flags = await __.getUserPrivilegeObject(user.role.privileges);
      const profilePic = req.user.profilePicture;
      return __.out(res, 201, { privilegeFlags: flags, profilePic });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
  async employeeDirecotory(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let skip = !!req.query.page ? req.query.page * 10 : 0;
      let query = {
        companyId: req.user.companyId,
        status: 1,
      };
      if (!!req.query.q) {
        query['name'] = {
          $regex: `${req.query.q}`,
          $options: 'is',
        };
      }
      if (!!req.query.appointmentId) {
        query['appointmentId'] = req.query.appointmentId;
      }
      if (!!req.query.parentBussinessUnitId) {
        query['parentBussinessUnitId'] = req.query.parentBussinessUnitId;
      }
      let result = await User.find(query)
        .populate([
          {
            path: 'appointmentId',
            select: 'name status',
            match: {
              status: 1,
            },
          },
          {
            path: 'parentBussinessUnitId',
            select: 'name',
            populate: {
              path: 'sectionId',
              select: 'name',
              populate: {
                path: 'departmentId',
                select: 'name',
                populate: {
                  path: 'companyId',
                  select: 'name',
                },
              },
            },
          },
        ])
        .select({
          staffId: 1,
          name: 1,
          appointmentId: 1,
          otherFields: 1,
          parentBussinessUnitId: 1,
          contactNumber: 1,
          profilePicture: 1,
          email: 1,
          primaryMobileNumber: 1,
          countryCode: 1,
        })
        .sort({
          name: 1,
        })
        .skip(skip)
        .limit(10)
        .lean();
      result = result.map((opt) => {
        return {
          name: opt.name,
          appointment: {
            name: !!opt.appointmentId ? opt.appointmentId.name : '',
          },
          parent_BU: `${opt.parentBussinessUnitId.sectionId.departmentId.companyId.name}>${opt.parentBussinessUnitId.sectionId.departmentId.name}>${opt.parentBussinessUnitId.sectionId.name}>${opt.parentBussinessUnitId.name}`,
          otherFields: opt.otherFields || [],
          // contactNumber: opt.contactNumber || "--",
          contactNumber: '',
          profilePicture: opt.profilePicture || '--',
          email: opt.email || '--',
          staffId: opt.staffId || '--',
        };
      });
      /*
            let query = {
              $match:{
                status: {
                  $in: [1, 2]
                }
              }
            };
            if(!!req.query.q){
              query.$match['name']={
                  '$regex': `${req.query.q}`,
                  '$options': 'is'
                }
            }
            let lookup=[{
              $lookup: {
                from: 'appointments',
                localField: 'appointmentId',
                foreignField: '_id',
                as: 'appointment'
              }
            },{
              $unwind:'$appointment'
            }];
            if(!!req.query.appointmentId){
              lookup = [...lookup, {
                $match:{
                  appointmentId:mongoose.Types.ObjectId(req.query.appointmentId)
                }
              }]
            }
            if(!!req.query.parentBussinessUnitId){
              lookup = [...lookup, {
                $match:{
                  parentBussinessUnitId:mongoose.Types.ObjectId(req.query.parentBussinessUnitId)
                }
              }]
            }
            console.log(lookup);
            let aggregate=[query,...lookup,{
              $project:{
                staffId: 1,
                name: 1,
                'appointment.name':1,
                //'businessUnit.name':1,
                'otherFields.fieldId':1,
                'otherFields.fieldName': 1,
                'otherFields.value': 1,
                contactNumber: 1,
                profilePicture: 1,
                email: 1
              }
            }, {
              $sort:{
                id:-1
              }
            }, {
              $skip:skip
            },{
              $limit:10
            }];
            let result = await User.aggregate(aggregate);*/
      /*const result = await User.find(query).populate([{
              path: "appointmentId",
              select: "name status",
              match: {
                status: 1
              }
            },
            {
              path: "parentBussinessUnitId",
              select: "name",
              populate: {
                path: "sectionId",
                select: "name",
                populate: {
                  path: "departmentId",
                  select: "name",
                  populate: {
                    path: "companyId",
                    select: "name"
                  }
                }
              }
            }]).select({ staffId: 1, name: 1, 'appointmentId.name':1, 'parentBussinessUnitId.name':1, otherFields: 1, 'otherFields.fieldName': 1, 'otherFields.value': 1, contactNumber: 1, profilePicture: 1, email: 1 }).sort({ name: 1 }).skip(skip).limit(10).lean();*/
      return __.out(res, 201, result);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Get role to update and perform frontend UI change
  async checkWithRole(req, res) {
    try {
      const searchQuery = {
        staffId: req.user.staffId,
        companyId: req.user.companyId,
      };
      let userRole = await User.findOne(searchQuery).select('role -_id').lean();
      let response = { role: userRole.role };

      if (!!req.query.getPriv) {
        const doc = await User.findOne(searchQuery).populate([
            {
              path: 'role',
              match: {
                status: 1,
              },
              select: 'privileges',
              populate: {
                path: 'privileges',
                match: {
                  status: 1,
                },
                select: 'name description flags privilegeCategoryId',
                populate: {
                  path: 'privilegeCategoryId',
                  match: {
                    status: 1,
                  },
                  select: 'name',
                },
              },
            },
          ]),
          doc2 = doc.toObject();
        const privilegeFlags = await __.getUserPrivilegeObject(
          doc2.role.privileges,
        );
        response['privileges'] = privilegeFlags;
      }
      return res.status(201).json(response);
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
}
user = new user();
module.exports = user;
