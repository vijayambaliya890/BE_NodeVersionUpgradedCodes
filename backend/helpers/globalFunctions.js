const _ = require('lodash'),
  moment = require('moment'),
  os = require('os'),
  fs = require('fs'),
  dotenv = require('dotenv').config(),
  mongoose = require('mongoose'),
  htmlparser = require('htmlparser'),
  pdf = require('html-pdf'),
  ejs = require('ejs'),
  path = require('path'),
  concat = require('concat-stream'),
  NodeClam = require('clamscan'),
  XRegExp = require('xregexp'),
  file_path = process.env.FILE_PATH;

// DB Modals
const Section = require('../app/models/section'),
  User = require('../app/models/user'),
  Department = require('../app/models/department'),
  SubSection = require('../app/models/subSection'),
  // Shift = require("../app/models/shift"),
  Notification = require('../app/models/notification'),
  Wall = require('../app/models/wall'),
  Channel = require('../app/models/channel'),
  ChannelPost = require('../app/models/post'),
  WallPost = require('../app/models/wallPost'),
  WallModel = require('../app/models/wall'),
  PageSetting = require('../app/models/pageSetting'),
  Company = require('../app/models/company'),
  CustomForm = require('../app/models/customForms'),
  BuilderModule = require('../app/models/builderModule'),
  Shift = require('../app/models/shift'),
  request = require('request');  
  const { AssignUserRead } = require('../helpers/assinguserread');

class globalFunctions {
  async writePdfToCustomForm(payload) {
    const options = {
      format: 'Letter', // allowed units: A3, A4, A5, Legal, Letter, Tabloid
      orientation: 'portrait', // portrait or landscape
      //"border": "0",             // default is 0, units: mm, cm, in, px
      border: {
        top: '5mm', // default is 0, units: mm, cm, in, px
        right: '5mm',
        bottom: '5mm',
        left: '6mm',
      },
      type: 'pdf',
    };
    payload.welComeAttachement = payload.url + '/' + payload.welComeAttachement;
    const htmlFilePath = path.join(__dirname, 'customFormQuestions.ejs');
    let html = await ejs.renderFile(htmlFilePath, { payload: payload });
    return await new Promise((resolve, reject) => {
      pdf.create(html, options).toStream(async function (err, stream) {
        if (err) {
          reject(err);
          return false;
        }
        stream.pipe(
          fs.createWriteStream(
            `./public/uploads/customFormExport/${payload.manageForm}.pdf`,
          ),
        );
        resolve(true);
      });
    }).then((success) => {
      return true;
    });
  }
  async checkRequiredFields(req, requiredFields, source = false) {
    if (source == 'shift' && req.body.shifts && req.body.shifts.length === 0) {
      delete req.body.shifts;
    }
    if (source == 'updateLocation') {
      if (
        (req.body.locations && req.body.locations.length == 0) ||
        req.body.locations == ''
      ) {
        delete req.body.locations;
      }
    }
    if (source == 'updateSkillSet') {
      if (
        (req.body.subSkillSets && req.body.subSkillSets.length == 0) ||
        req.body.subSkillSets == ''
      ) {
        delete req.body.subSkillSets;
      }
    }
    if (source == 'updateSkillSetAndLocation') {
      if (
        (req.body.subSkillSets && req.body.subSkillSets.length == 0) ||
        req.body.subSkillSets == ''
      ) {
        delete req.body.subSkillSets;
      }
      if (
        (req.body.subCategories && req.body.subCategories.length == 0) ||
        req.body.subCategories == ''
      ) {
        delete req.body.subCategories;
      }
      if (
        (req.body.locations && req.body.locations.length == 0) ||
        req.body.locations == ''
      ) {
        delete req.body.locations;
      }
    }
    if (source == 'subSection') {
      if (req.body.name) {
        requiredFields.push('sectionId');
      }
    }
    if (source == 'post') {
      if (req.body.postType && req.body.postType == 'events') {
        requiredFields.push('eventDetails');
      }
    }

    if (source == 'user') {
      if (req.body.isFlexiStaff == 0) {
        requiredFields.push(
          'parentBussinessUnitId',
          'planBussinessUnitId',
          'viewBussinessUnitId',
        );
        /* Validate creation based on Plan business unit of the planner */

        if (req.body.parentBussinessUnitId) {
          let diffArray = await _.differenceWith(
            [mongoose.Types.ObjectId(req.body.parentBussinessUnitId)],
            req.user.planBussinessUnitId,
            _.isEqual,
          );
          if (diffArray.length) {
            requiredFields.push('Invalid parentBussinessUnitId');
          }
        }

        if (req.body.planBussinessUnitId) {
          let objectIDs = eval(req.body.planBussinessUnitId).map((x) =>
            mongoose.Types.ObjectId(x),
          );
          let diffArray = await _.differenceWith(
            objectIDs,
            req.user.planBussinessUnitId,
            _.isEqual,
          );
          if (diffArray.length) {
            requiredFields.push('Invalid planBussinessUnitId');
          }
        }

        if (req.body.viewBussinessUnitId) {
          let objectIDs = eval(req.body.viewBussinessUnitId).map((x) =>
            mongoose.Types.ObjectId(x),
          );
          let diffArray = await _.differenceWith(
            objectIDs,
            req.user.planBussinessUnitId,
            _.isEqual,
          );
          if (diffArray.length) {
            requiredFields.push('Invalid viewBussinessUnitId');
          }
        }

        /* end of business unit validation */

        delete req.body.subSkillSet;
      } else {
        requiredFields.push('parentBussinessUnitId');

        if (req.body.parentBussinessUnitId) {
          let diffArray = await _.differenceWith(
            [mongoose.Types.ObjectId(req.body.parentBussinessUnitId)],
            req.user.planBussinessUnitId,
            _.isEqual,
          );
          if (diffArray.length) {
            requiredFields.push('Invalid parentBussinessUnitId');
          }
        }

        if (req.body.subSkillSets && req.body.subSkillSets.length == 0)
          delete req.body.subSkillSets;
        else {
          //this.log(req.body.subSkillSets);
          // this.log(eval(req.body.subSkillSets));
          req.body.subSkillSets = eval(req.body.subSkillSets);
        }

        delete req.body.planBussinessUnitId;
        delete req.body.viewBussinessUnitId;
      }
    }
    if (source == 'weeklyStaff') {
      if (!req.file || (req.file && req.file.length == 0)) {
        delete req.body.weeklyStaffCsvData;
        requiredFields.push('weeklyStaffCsvData');
      }
    }
    // if (source == 'notification') {
    //     if (!req.file || (req.file && req.file.length == 0)) {
    //         delete req.body.notificationAttachment;
    //         requiredFields.push('notificationAttachment');
    //     }
    // }

    if (source == 'userUpdate') {
      if (req.body.parentBussinessUnitId) {
        let diffArray = await _.differenceWith(
          [mongoose.Types.ObjectId(req.body.parentBussinessUnitId)],
          req.user.planBussinessUnitId,
          _.isEqual,
        );
        if (diffArray.length) {
          requiredFields.push('Invalid parentBussinessUnitId');
        }
      }

      if (req.body.planBussinessUnitId && req.body.isFlexiStaff == 0) {
        let objectIDs = eval(req.body.planBussinessUnitId).map((x) =>
          mongoose.Types.ObjectId(x),
        );
        let diffArray = await _.differenceWith(
          objectIDs,
          req.user.planBussinessUnitId,
          _.isEqual,
        );
        if (diffArray.length) {
          requiredFields.push('Invalid planBussinessUnitId');
        }
      }

      if (req.body.viewBussinessUnitId && req.body.isFlexiStaff == 0) {
        let objectIDs = eval(req.body.viewBussinessUnitId).map((x) =>
          mongoose.Types.ObjectId(x),
        );
        let diffArray = await _.differenceWith(
          objectIDs,
          req.user.planBussinessUnitId,
          _.isEqual,
        );
        if (diffArray.length) {
          requiredFields.push('Invalid viewBussinessUnitId');
        }
      }
    }

    //req.body = _.pickBy(req.body, _.identity); //remove empty string("") , null, undefined properties
    let noMissingFields = _.reduce(
      requiredFields,
      (result, item) => result && item in req.body,
      true,
    );
    if (!noMissingFields) {
      let missingFields = this.getMissingFields(req.body, requiredFields);

      return {
        status: false,
        missingFields: missingFields,
      };
    } else {
      return {
        status: true,
      };
    }
  }

  async customCheckRequiredFields(req, requiredFields, source = false) {
    /*by req not by req.body */

    //req = _.pickBy(req, _.identity); //remove empty string("") , null, undefined properties

    var missingFields = [];
    await req.forEach((element) => {
      if (source == 'shiftDetails') {
        if (element.subSkillSets && element.subSkillSets.length == 0) {
          delete element.subSkillSets;
        }
      }
      let noMissingFields = _.reduce(
        requiredFields,
        (result, item) => result && item in element,
        true,
      );

      if (!noMissingFields) {
        missingFields.push.apply(
          missingFields,
          this.getMissingFields(element, requiredFields),
        );
      }
    });

    if (missingFields.length != 0) {
      return {
        status: false,
        missingFields: [...new Set(missingFields)] /*remove duplicates */,
      };
    } else {
      return {
        status: true,
      };
    }
  }

  log() {
    if (os.hostname().indexOf('doodlews-67') > -1) {
      /*localhost*/ for (let i in arguments) {
        console.log(arguments[i]);
      }
    } else {
      for (let i in arguments) {
        console.log(arguments[i]);
      }
    }
  }
  makePwd(length) {
    let string = 'qwertyupasdfghjkzxcvbnm23456789QWERTYUPASDFGHJKZXCVBNM';
    var index = (Math.random() * (string.length - 1)).toFixed(0);
    return length > 0 ? string[index] + this.makePwd(length - 1) : '';
    //return randomstring.generate(length);
    //return 'password';
  }
  getMissingFields(requestedJsonInput, requiredFields) {
    let missingFields;
    missingFields = requiredFields.map(function (value, index) {
      if (!(value in requestedJsonInput)) return value;
    });

    function removeUndefined(value) {
      return value !== undefined;
    }

    return missingFields.filter(removeUndefined);
  }
  out(res, statusCode, resultData = null) {
    if (statusCode === 401) {
      res.status(statusCode).json({
        error: 'Unauthorized user',
      });
    } else if (statusCode === 500) {
      res.status(statusCode).json({
        error: 'Internal server error Or Invalid data',
      });
    } else if (statusCode === 400) {
      res.status(statusCode).json({
        error: 'Required fields missing',
        fields: resultData,
      });
    } else if (statusCode === 201) {
      res.status(statusCode).json({
        data: resultData,
      });
    } else if (statusCode === 300) {
      res.status(statusCode).json({
        message: resultData,
      });
    } else {
      /*200*/
      res.status(statusCode).json({
        message: resultData != null ? resultData : 'success',
      });
    }
  }
  getDateStringFormat(fullDate = '', timeZone) {
    return moment.utc(fullDate).utcOffset(`${timeZone}`).format('DD-MM-YYYY');
    // var d = new Date(fullDateTrimmed);
    // var date = ("0" + d.getDate()).slice(-2), //to make double digit
    //     month = ("0" + (d.getMonth() + 1)).slice(-2), //to make double digit
    //     year = (d.getYear() + 1900); // getYear () + 1900 = current year (i.e:2017)
    // return date + '-' + month + '-' + year;
  }
  getDayStringFormat(fullDate = '', timeZone) {
    return moment
      .utc(fullDate)
      .utcOffset(`${timeZone}`)
      .format('dddd')
      .toLowerCase();
  }
  getDayStringFormatFromUnix(unix = '', timeZone) {
    return moment
      .unix(unix)
      .utcOffset(`${timeZone}`)
      .format('dddd')
      .toLowerCase();
  }
  getDay(date = '') {
    // var d = new Date(date),
    //     weekday = new Array(7);
    // weekday[0] = "Sunday";
    // weekday[1] = "Monday";
    // weekday[2] = "Tuesday";
    // weekday[3] = "Wednesday";
    // weekday[4] = "Thursday";
    // weekday[5] = "Friday";
    // weekday[6] = "Saturday";

    return moment(date, 'MM-DD-YYYY HH:mm:ss Z').utc().format('dddd');
  }
  getDurationInHours(startDateTime, endDateTime) {
    var start = moment(startDateTime).utc().unix() * 1000,
      end = moment(endDateTime).utc().unix() * 1000;

    return ((end - start) / 3600000).toFixed(2); //durationInHours
  }
  weekNoStartWithMonday(dt) {
    dt = new Date(dt);
    return Math.ceil(
      (dt - new Date(dt.getFullYear(), 0, 1)) / (3600000 * 24 * 7),
    );
  }
  serverBaseUrl() {
    this.log(process.env.LOCAL_SERVER_BASEURL, process.env.LIVE_SERVER_BASEURL);
    if (
      os.hostname().indexOf('doodlews-67') > -1 ||
      os.hostname().indexOf('doodlews-39') > -1 ||
      os.hostname().indexOf('doodlews-70') > -1 ||
      os.hostname().indexOf('doodlews116') > -1
    ) {
      /*localhost*/ return process.env.LOCAL_SERVER_BASEURL;
    } else if (os.hostname().indexOf('doodledev') == 0) {
      /*staging*/ return process.env.STAGING_SERVER_BASEURL;
    } /*live*/ else {
      return process.env.LIVE_SERVER_BASEURL;
    }
  }
  clientBaseUrl() {
    if (
      os.hostname().indexOf('doodlews-67') > -1 ||
      os.hostname().indexOf('doodlews-39') > -1 ||
      os.hostname().indexOf('doodlews-70') > -1
    ) {
      /*localhost*/ return process.env.LOCAL_CLIENT_BASEURL;
    } else if (os.hostname().indexOf('doodledev') == 0) {
      /*staging*/ return process.env.STAGING_CLIENT_BASEURL;
    } /*live*/ else {
      return process.env.LIVE_CLIENT_BASEURL;
    }
  }
  async getUserPrivilegeObject(privileges) {
    var preDefinedPrivileges = {
      createUser: false,
      editUser: false,
      viewUser: false,
      skillSetSetup: false,
      businessUserSetup: false,
      roleSetup: false,
      setTemplate: false,
      inputWeeklyStaffing: false,
      planShift: false,
      viewShift: false,
      adjustShift: false,
      makeShiftBooking: false,
      myBooking: false,
      viewBooking: false,
      requestBooking: false,
      inputNotification: false,
      viewNotification: false,
      reports: false,
      submitFeedback: false,
      userProfile: false,
      channelSetup: false,
      cancelShift: false,
      manageNews: false,
      manageEvents: false,
      newsAndEvents: false,
      centralBuilder: false,
      externalLink: false,
      manageWall: false,
      myBoards: false,
      lockedAccount: false,
      myForm: false,
      setUpForm: false,
      resetPassword: false,
      myRewards: false,
      redemptionList: false,
      challenges: false,
      challengesWeb: false,
      myPage: false,
      timesheet: false,
      integration: false,
      schemeSetup: false,
      staffView: false,
      approveTimesheet: false,
      viewTimesheet: false,
      editTimesheetAfterLock: false,
      shiftExtension: false,
      facialCreation: false,
      employeeDirectory: false,
      userShiftScheme: false,
      leavePlannerApprover: false,
      leavePlannerMobile: false,
      leavePlannerAdditionalViewMobileApp: false,
    };
    if (!privileges || !privileges.length) {
      return preDefinedPrivileges;
    } else {
      for (let eachPrivilege of privileges) {
        if (eachPrivilege.privilegeCategoryId) {
          await Object.assign(
            preDefinedPrivileges,
            _.pickBy(eachPrivilege.flags, _.identity),
          ); /*pickby return only privileges that set to true  */
        }
      }
      return preDefinedPrivileges;
    }
  }
  sortByDate(a, b) {
    if (moment(a.createdAt).isSame(b.createdAt)) {
      return 0;
    } else {
      return moment(a.createdAt).isAfter(b.createdAt) ? -1 : 1;
    }
  }

  camelToSpace(str) {
    return str.replace(/([A-Z])/g, ' $1').toLowerCase();
  }

  compareArray(a, b) {
    let arr1 = a.sort(),
      arr2 = b.sort();
    return _.isEqual(arr1, arr2);
  }

  toTitleCase(str) {
    return str.replace(/\w\S*/g, function (txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }

  getRandomElement(n, arrData) {
    let newArrData = [];

    function getRandom(n) {
      if (n < 1) {
        return;
      }
      let index = Math.round(Math.random() * (arrData.length - 1));
      newArrData.push(arrData[index]);
      arrData.splice(index, 1);
      n -= 1;
      return getRandom(n);
    }
    getRandom(n);
    return newArrData;
  }

  getHTMLValues(htmlString = '', tagName = 'video', attriName = 'src') {
    let reqValues = [];
    // HTML Parser
    let rawHtml = htmlString;
    var contentData;
    let handler = new htmlparser.DefaultHandler(function (error, dom) {
      contentData = dom;
    });
    let parser = new htmlparser.Parser(handler);
    parser.parseComplete(rawHtml);

    // Split wanted Urls in Parsed html Object
    let getTagValues = function (htmlData, tag, attribute) {
      for (let elem of htmlData) {
        if (elem.name == tag) {
          elem.children = elem.children || [];
          for (let data of elem.children) {
            let atag = {
              url: elem.attribs[attribute],
            };
            if (tag == 'a') {
              atag.name = data.raw;
            }
            reqValues.push(atag);
          }
        }
        if (elem.children) {
          getTagValues(elem.children, tag, attribute);
        }
      }
    };

    // Call function with Object
    getTagValues(contentData, tagName, attriName);

    return reqValues;
  }
  isEqualObjectIds(o1, o2) {
    return mongoose.Types.ObjectId(o1).equals(mongoose.Types.ObjectId(o2));
  }
  checkRole(role) {
    const methods = {
      getPrivilege: async (_id, privilege) => {
        let whereClause = {
          _id: _id,
          status: { $ne: 3 /* $ne => not equal*/ },
        };
        let users = await User.findOne(whereClause)
          .populate([
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
          ])
          .lean();
        let userData = await this.getUserPrivilegeObject(users.role.privileges);
        return !!privilege ? userData[privilege] : userData;
      },
      validate: async (req, res, next) => {
        if (req.user.roleUpdate) {
          let flag = await methods.getPrivilege(req.user._id, role);
          if (!flag) {
            return __.out(res, 300, 'This account is not permitted to access');
          }
          next();
        } else {
          let flag = req.user.privileges[role];
          if (!flag) {
            return __.out(res, 300, 'This account is not permitted to access');
          }
          next();
        }
      },
    };
    return Object.freeze(methods);
  }
  async scanFile(uploadedFile, localPath) {
    try {
      const fileName = uploadedFile.toLowerCase(),
        formatError = fileName.match(
          /\.(tiff|tif|svg|PNG|png|JPEG|jpeg|jpg|gif|txt|pdf|odt|doc|docx|wmv|mpg|mpeg|mp4|avi|3gp|3g2|xlsx|xls|xlx|xlr|pptx|ppt|odp|key|csv)$/,
        );
      if (!formatError) {
        return `Please upload this type extension tiff,tif,svg,png,jpeg,jpg,gif,txt,pdf,odt,doc,docx,wmv,mpg,mpeg,mp4,avi,3gp,3g2,xlsx,xls,xlx,xlr,pptx,ppt,odp,key|csv`;
      }
      // if(!/\.(png|jpeg|jpg|gif)/.test(`${fileName}`)){
      const options = {
        remove_infected: true, // Removes files if they are infected
        scan_log: '../public/filelogs/error.log', // You're a detail-oriented security professional.
        debug_mode: false, // This will put some debug info in your js console
        scan_recursively: true, // Choosing false here will save some CPU cycles
        // clamdscan: {
        //   host: "127.0.0.1",
        //   port: 3001
        // },
        preference: 'clamscan', // If clamscan is found and active, it will be used by default
      };
      const clamscan = await new NodeClam().init(options);
      const { fileSelected, isInfected, viruses } = await clamscan.isInfected(
        localPath,
      );
      if (isInfected) {
        return `${fileSelected} is infected with ${viruses.join(', ')}.`;
      }
      // }
    } catch (error) {
      this.log(error);
      return `Something went wrong try later`;
    }
  }

  /* Functions with db */
  // Get user's BU, Department, Sub section
  async getCompanyBU(companyId, type = 'subsection', status = [1, 2]) {
    let returnIds = [];
    // Department
    let departmentIds = await Department.find({
      companyId: companyId,
      status: {
        $in: status,
      },
    })
      .select('_id')
      .lean();

    departmentIds.forEach((val, i) => {
      returnIds.push(val._id);
    });
    if (type == 'department') {
      return returnIds;
    }

    let sectionIds = await Section.find({
      departmentId: {
        $in: returnIds,
      },
      status: {
        $in: status,
      },
    })
      .select('_id')
      .lean();

    returnIds = [];

    sectionIds.forEach((val, i) => {
      returnIds.push(val._id);
    });
    if (type == 'section') {
      return returnIds;
    }
    // Sub Section
    let subSectionIds = await SubSection.find({
      sectionId: {
        $in: returnIds,
      },
      status: {
        $in: status,
      },
    })
      .select('_id')
      .lean();

    returnIds = [];
    subSectionIds.forEach((val, i) => {
      returnIds.push(val._id);
    });
    return returnIds;
  }

  async isUserAuthorized(req, wallId) {
    try {
      if (!wallId) return false;
      var usersWallData = await AssignUserRead.read(req.user, null, null);
      if (!usersWallData) return false;
      return true;
    } catch (error) {
      return false;
    }
  }

  async getUserWalls(userData, reqStatus = [1]) {
    let companyId = userData.companyId;
    let businessUnit = userData.parentBussinessUnitId;
    let appointment = userData.appointmentId;
    let subSkillSets = userData.subSkillSets || [];

    // Custom Field restructure
    let customFields = userData.otherFields || [];
    customFields = customFields.map((v) => {
      return {
        fieldId: v.fieldId,
        value: v.value,
      };
    });

    let searchQuery = {
      companyId: companyId,
      status: {
        $in: reqStatus,
      },
      $or: [],
    };

    let keyFalseCondition = {
      // if no fitler is given
      appointments: [],
      subSkillSets: [],
      customField: [],
      user: [],
    };

    // Create 3 or condition based on 3 filter types
    // 1-> All Users in Selected Business Unit
    let condition1 = {
      assignUsers: {
        $elemMatch: {
          buFilterType: 1,
          $or: [
            keyFalseCondition,
            {
              appointments: {
                $in: [appointment],
              },
            },
            {
              admin: {
                $in: [userData._id],
              },
            },
            {
              businessUnits: {
                $in: [businessUnit],
              },
            },
            {
              allBuToken: true
            },
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition1.assignUsers['$elemMatch']['$or'].push({
        subSkillSets: {
          $in: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition1.assignUsers['$elemMatch']['$or'].push({
        customField: {
          $in: customFields,
        },
      });
    }
    searchQuery['$or'].push(condition1);
    // 2 -> Include only Selected Users from Business Unit
    let condition2 = {
      assignUsers: {
        $elemMatch: {
          buFilterType: 2,
          $or: [
            keyFalseCondition,
            {
              appointments: {
                $in: [appointment],
              },
            },
            {
              user: {
                $in: [userData._id],
              },
            },
            {
              admin: {
                $in: [userData._id],
              },
            },
            {$and:[
            {
              businessUnits: {
                $in: [businessUnit],
              },
            },
            {
              allBuToken: true
            },
          ]}
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition2.assignUsers['$elemMatch']['$or'].push({
        subSkillSets: {
          $in: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition2.assignUsers['$elemMatch']['$or'].push({
        customField: {
          $in: customFields,
        },
      });
    }
    searchQuery['$or'].push(condition2);
    // 3 -> Exclude selected Users from Business Unit
    let condition3 = {
      assignUsers: {
        $elemMatch: {
          buFilterType: 3,
          $or: [
            keyFalseCondition,
            {
              $and: [
                {
                  appointments: {
                    $nin: [appointment],
                  },
                },
                {
                  user: {
                    $nin: [userData._id],
                  },
                },
                {
                  $or: [
                    {
                      businessUnits: {
                        $in: [businessUnit],
                      },
                    },
                    {
                      allBuToken: true,
                    },
                  ],
                },
              ],
            },
            {
              admin: {
                $in: [userData._id],
              },
            },
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition3.assignUsers['$elemMatch']['$or'][1]['$and'].push({
        subSkillSets: {
          $nin: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition3.assignUsers['$elemMatch']['$or'][1]['$and'].push({
        customField: {
          $nin: customFields,
        },
      });
    }

    searchQuery['$or'].push(condition3);

    // this.log(JSON.stringify(searchQuery));
    let wallList = await Wall.find(searchQuery);
    wallList = wallList.map((v) => {
      return v._id;
    });
    return wallList;
  }
  async getUserChannel(userData, reqStatus = [1]) {
    try {
      let customFields = userData.otherFields || [];
      let subSkillSets = userData.subSkillSets || [];
      let includeOnly = [];
      let excludeOnly = { $or: [] };
      for (let singleCustom of customFields) {
        singleCustom.value = singleCustom.value || null;
        excludeOnly['$or'].push({
          'userDetails.customField.fieldId': singleCustom.fieldId,
          'userDetails.customField.value': { $ne: singleCustom.value },
        });
        includeOnly.push({
          'userDetails.customField.fieldId': singleCustom.fieldId,
          'userDetails.customField.value': { $eq: singleCustom.value },
        });
      }
      /*if (!excludeOnly['$or'].length) {
                excludeOnly = {};
            }*/
      let condition = {
        companyId: mongoose.Types.ObjectId(userData.companyId),
        status: {
          $in: reqStatus,
        },
        'userDetails.businessUnits': {
          $in: [mongoose.Types.ObjectId(userData.parentBussinessUnitId)],
        },
        $or: [
          {
            'userDetails.buFilterType': 1,
          },
          {
            'userDetails.buFilterType': 2,
            $or: [
              {
                'userDetails.appointments': {
                  $in: [mongoose.Types.ObjectId(userData.appointmentId)],
                },
              },
              {
                'userDetails.subSkillSets': {
                  $in: subSkillSets.map((v) => mongoose.Types.ObjectId(v)),
                },
              },
              {
                'userDetails.authors': {
                  $in: [mongoose.Types.ObjectId(userData._id)],
                },
              },
              ...includeOnly,
            ],
          },
          {
            'userDetails.buFilterType': 3,
            $and: [
              {
                'userDetails.appointments': {
                  $nin: [mongoose.Types.ObjectId(userData.appointmentId)],
                },
              },
              {
                'userDetails.subSkillSets': {
                  $nin: subSkillSets.map((v) => mongoose.Types.ObjectId(v)),
                },
              },
              {
                'userDetails.authors': {
                  $nin: [mongoose.Types.ObjectId(userData._id)],
                },
              },
            ],
          },
        ],
      };
      let channels = await Channel.aggregate([
        {
          $match: condition,
        },
        {
          $project: { _id: 1, name: 1, userDetails: 1 },
        },
      ]);
      let temp = [];
      channels.forEach((channel, i) => {
        for (const channelUserDetails of channel.userDetails) {
          if (channelUserDetails.buFilterType === 3) {
            let customFieldsInChannel = channelUserDetails.customField || [];
            for (const cus of customFieldsInChannel) {
              const matched = customFields.filter(
                (cusf) =>
                  cusf.fieldId.toString() === cus.fieldId.toString() &&
                  cusf.value === cus.value,
              );
              if (matched.length) {
                temp.push(channel._id);
              }
            }
          }
        }
      });
      temp.forEach((tem) => {
        const index = channels.findIndex((channel) => channel._id === tem);
        if (index !== -1) {
          channels.splice(index, 1);
        }
      });
      channels = channels.map((v) => v._id);
      return channels;
    } catch (error) {
      this.log(error);
      return [];
    }
  }

  async getUserChannel1(userData, reqStatus = [1]) {
    let companyId = userData.companyId;
    let businessUnit = userData.parentBussinessUnitId;
    let appointment = userData.appointmentId;
    let subSkillSets = userData.subSkillSets || [];

    // Custom Field restructure
    let customFields = userData.otherFields || [];
    customFields = customFields.map((v) => {
      return {
        fieldId: v.fieldId,
        value: v.value,
      };
    });

    let searchQuery = {
      companyId: companyId,
      status: {
        $in: reqStatus,
      },
      $or: [],
    };

    let keyFalseCondition = {
      // if no fitler is given
      appointments: [],
      subSkillSets: [],
      customField: [],
      authors: [],
    };

    // Create 3 or condition based on 3 filter types
    // 1-> All Users in Selected Business Unit
    let condition1 = {
      userDetails: {
        $elemMatch: {
          buFilterType: 1,
          businessUnits: {
            $in: [businessUnit],
          },
          $or: [
            keyFalseCondition,
            {
              appointments: {
                $in: [appointment],
              },
            },
            {
              admin: {
                $in: [userData._id],
              },
            },
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition1.userDetails['$elemMatch']['$or'].push({
        subSkillSets: {
          $in: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition1.userDetails['$elemMatch']['$or'].push({
        customField: {
          $in: customFields,
        },
      });
    }
    searchQuery['$or'].push(condition1);
    // 2 -> Include only Selected Users from Business Unit
    let condition2 = {
      userDetails: {
        $elemMatch: {
          buFilterType: 2,
          businessUnits: {
            $in: [businessUnit],
          },
          $or: [
            keyFalseCondition,
            {
              appointments: {
                $in: [appointment],
              },
            },
            {
              authors: {
                $in: [userData._id],
              },
            },
            {
              admin: {
                $in: [userData._id],
              },
            },
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition2.userDetails['$elemMatch']['$or'].push({
        subSkillSets: {
          $in: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition2.userDetails['$elemMatch']['$or'].push({
        customField: {
          $in: customFields,
        },
      });
    }
    searchQuery['$or'].push(condition2);
    // 3 -> Exclude selected Users from Business Unit
    let condition3 = {
      userDetails: {
        $elemMatch: {
          buFilterType: 3,
          businessUnits: {
            $in: [businessUnit],
          },
          $or: [
            keyFalseCondition,
            {
              $and: [
                {
                  appointments: {
                    $nin: [appointment],
                  },
                },
                {
                  authors: {
                    $nin: [userData._id],
                  },
                },
              ],
            },
            {
              admin: {
                $in: [userData._id],
              },
            },
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition3.userDetails['$elemMatch']['$or'][1]['$and'].push({
        subSkillSets: {
          $nin: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition3.userDetails['$elemMatch']['$or'][1]['$and'].push({
        customField: {
          $nin: customFields,
        },
      });
    }

    searchQuery['$or'].push(condition3);

    // console.log(searchQuery, 'channel query')

    let channelList = await Channel.find(searchQuery);
    channelList = channelList.map((v) => {
      return v._id;
    });

    return channelList;
  }

  async getUserNotification(userData) {
    let companyId = userData.companyId;
    let businessUnit = userData.parentBussinessUnitId;
    let appointment = userData.appointmentId;
    let subSkillSets = userData.subSkillSets || [];

    // Custom Field restructure
    let customFields = userData.otherFields || [];
    customFields = customFields.map((v) => {
      return {
        fieldId: v.fieldId,
        value: v.value,
      };
    });

    let searchQuery = {
      // companyId: companyId,
      status: 1,
      $or: [],
    };

    let keyFalseCondition = {
      // if no fitler is given
      appointments: [],
      subSkillSets: [],
      customField: [],
      user: [],
    };

    // Create 3 or condition based on 3 filter types
    // 1-> All Users in Selected Business Unit
    let condition1 = {
      assignUsers: {
        $elemMatch: {
          buFilterType: 1,
          businessUnits: {
            $in: [businessUnit],
          },
          $or: [
            keyFalseCondition,
            {
              appointments: {
                $in: [appointment],
              },
            },
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition1.assignUsers['$elemMatch']['$or'].push({
        subSkillSets: {
          $in: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition1.assignUsers['$elemMatch']['$or'].push({
        customField: {
          $in: customFields,
        },
      });
    }
    searchQuery['$or'].push(condition1);
    // 2 -> Include only Selected Users from Business Unit
    let condition2 = {
      assignUsers: {
        $elemMatch: {
          buFilterType: 2,
          businessUnits: {
            $in: [businessUnit],
          },
          $or: [
            keyFalseCondition,
            {
              appointments: {
                $in: [appointment],
              },
            },
            {
              user: {
                $in: [userData._id],
              },
            },
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition2.assignUsers['$elemMatch']['$or'].push({
        subSkillSets: {
          $in: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition2.assignUsers['$elemMatch']['$or'].push({
        customField: {
          $in: customFields,
        },
      });
    }
    searchQuery['$or'].push(condition2);
    // 3 -> Exclude selected Users from Business Unit
    let condition3 = {
      assignUsers: {
        $elemMatch: {
          buFilterType: 3,
          businessUnits: {
            $in: [businessUnit],
          },
          $or: [
            keyFalseCondition,
            {
              $and: [
                {
                  appointments: {
                    $nin: [appointment],
                  },
                },
                {
                  user: {
                    $nin: [userData._id],
                  },
                },
              ],
            },
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition3.assignUsers['$elemMatch']['$or'][1]['$and'].push({
        subSkillSets: {
          $nin: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition3.assignUsers['$elemMatch']['$or'][1]['$and'].push({
        customField: {
          $nin: customFields,
        },
      });
    }

    searchQuery['$or'].push(condition3);

    let notificationList = await Notification.find(searchQuery);
    notificationList = notificationList.map((v) => {
      return v._id;
    });
    // this.log(notificationList)
    return notificationList;
  }

  async notificUsersList(notificData) {
    notificData.assignUsers = notificData.assignUsers || [];
    let userIds = [];
    for (let elem of notificData.assignUsers) {
      let searchQuery = {
        status: 1,
      };
      // Condition Exclude -> and, nin, Other-> or, in
      let condition = elem.buFilterType == 3 ? '$nin' : '$in';
      let mainCondition = elem.buFilterType == 3 ? '$and' : '$or';
      searchQuery[mainCondition] = [];

      if (elem.businessUnits.length > 0) {
        searchQuery.parentBussinessUnitId = {};
        searchQuery.parentBussinessUnitId['$in'] = elem.businessUnits;
      }
      if (elem.appointments.length > 0) {
        let appointmentId = {};
        appointmentId[condition] = elem.appointments;
        searchQuery[mainCondition].push({
          appointmentId: appointmentId,
        });
      }
      let subSkillSets = {};
      if (elem.subSkillSets && elem.subSkillSets.length > 0) {
        subSkillSets[condition] = elem.subSkillSets;
        searchQuery[mainCondition].push({
          subSkillSets: subSkillSets,
        });
      }
      elem.user = elem.user || [];
      if (elem.user.length > 0) {
        let user = {};
        user[condition] = elem.user;
        searchQuery[mainCondition].push({
          _id: user,
        });
      }
      if (elem.customField.length > 0) {
        for (let singleCustom of elem.customField) {
          searchQuery[mainCondition].push({
            otherFields: {
              $elemMatch: {
                fieldId: singleCustom.fieldId,
                value: {
                  [condition]: [singleCustom.value],
                },
              },
            },
          });
        }
      }

      if (searchQuery[mainCondition].length == 0) {
        delete searchQuery[mainCondition];
      }

      let users = await User.find(searchQuery)
        .select('name staffId deviceToken otherFields')
        .lean();

      users = users.map((v) => {
        return v._id;
      });
      userIds = [...userIds, ...users];
    }
    // this.log(userIds)
    return userIds;
  }

  async userDetails(wallData) {
    const userDetails = wallData.assignUsers;
    let userList = [];
    for (const curr of userDetails) {
      let includeOnly = [];
      let excludeOnly = [];
      if (curr.customField.length) {
        for (const customField of curr.customField) {
          includeOnly.push({
            'otherFields.fieldId': customField.fieldId,
            'otherFields.value': customField.value,
          });
          excludeOnly.push({
            'otherFields.fieldId': customField.fieldId,
            'otherFields.value': {
              $ne: customField.value,
            },
          });
        }
      }
      let businessUnits = curr.businessUnits;
      let condition = {};
      if (1 === curr.buFilterType) {
        if (curr.allBuToken) {
          const userBus = await User.findById(wallData.createdBy)
            .select('planBussinessUnitId')
            .lean();
          if (userBus) {
            businessUnits = userBus.planBussinessUnitId.map((v) =>
              mongoose.Types.ObjectId(v),
            );
          }
        }
        condition['parentBussinessUnitId'] = {
          $in: businessUnits.map((v) => mongoose.Types.ObjectId(v)),
        };
      } else if (2 === curr.buFilterType) {
        condition['parentBussinessUnitId'] = {
          $in: businessUnits.map((v) => mongoose.Types.ObjectId(v)),
        };
        condition['$or'] = [
          {
            appointmentId: {
              $in: curr.appointments.map((v) => mongoose.Types.ObjectId(v)),
            },
          },
          {
            subSkillSets: {
              $in: curr.subSkillSets.map((v) => mongoose.Types.ObjectId(v)),
            },
          },
          {
            _id: {
              $in: curr.user.map((v) => mongoose.Types.ObjectId(v)),
            },
          },
          ...includeOnly,
        ];
      } else if (3 === curr.buFilterType) {
        condition['parentBussinessUnitId'] = {
          $in: businessUnits.map((v) => mongoose.Types.ObjectId(v)),
        };
        condition['$and'] = [
          {
            appointmentId: {
              $nin: curr.appointments.map((v) => mongoose.Types.ObjectId(v)),
            },
          },
          {
            subSkillSets: {
              $nin: curr.subSkillSets.map((v) => mongoose.Types.ObjectId(v)),
            },
          },
          {
            _id: {
              $nin: curr.user.map((v) => mongoose.Types.ObjectId(v)),
            },
          },
          ...excludeOnly,
        ];
      }
      const users = await User.aggregate([
        {
          $match: condition,
        },
        {
          $project: { _id: 1 },
        },
      ]).allowDiskUse(true);
      userList = [...userList, ...users];
    }
    return userList.map((user) => user._id);
  }

  async wallUsersList(wallData, id = true) {
    const ids = await this.userDetails(wallData);
    if (!!id) {
      return ids;
    }
    const users = await User.aggregate([
      {
        $match: {
          _id: {
            $in: ids || [],
          },
        },
      },
      {
        $project: { name: 1, staffId: 1, deviceToken: 1, otherFields: 1 },
      },
    ]).allowDiskUse(true);
    return users || [];
  }

  async getCeraToken(companyId) {
    try {
      const companyData = await Company.findById(companyId)
        .select('ceraToken')
        .lean();
      if (!!companyData && companyData.ceraToken) {
        return {
          Authorization: `Token ${companyData.ceraToken}`,
          'Content-Type': 'application/json',
          'User-Agent': process.env.USER_AGENT,
        };
      } else {
        let token = await this.regenerateCeraToken();
        console.log(token);
        return {
          Authorization: `Token ${companyData.ceraToken}`,
          'Content-Type': 'application/json',
          'User-Agent': process.env.USER_AGENT,
        };
      }
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  async regenerateCeraToken(companyId) {
    try {
      let url = `https://cerrapoints.com/profiles/api/token-auth/`;
      const request = require('request');
      await new Promise((resolve, reject) => {
        request(
          {
            url: url,
            formData: {
              username: process.env.REWARDUSERNAME,
              password: process.env.REWARDPASSWORD,
            },
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': process.env.USER_AGENT,
            },
          },
          function (error, response, body) {
            if (error) {
              reject('Invalid login!');
            }
            try {
              body = JSON.parse(body);
              resolve(body);
            } catch (error) {
              reject(body);
            }
          },
        );
      })
        .then(async (success) => {
          let company = await Company.update(
            {
              _id: companyId,
            },
            {
              ceraToken: success.token,
            },
          );
          return success.token;
        })
        .catch((error) => {
          this.log(error);
          return 'Somthing went wrong try later';
        });
    } catch (err) {
      this.log(err);
      return err;
    }
  }

  buQuery(sectionId) {
    return {
      path: sectionId,
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
    };
  }

  async isModuleIncluded(_id, notIn) {
    try {
      let moduleId = await BuilderModule.findById(_id).select('_id').lean();
      let query = {
        status: 1,
        moduleId: moduleId._id,
      };
      if (!!notIn) {
        query['_id'] = {
          $nin: notIn || [],
        };
      }
      if (!!moduleId) {
        const notificationCount = await Notification.count(query).lean();
        if (notificationCount) {
          return {
            status: false,
            message: 'Module already linked in notification',
          };
        }
        const wallPostCount = await WallPost.count(query).lean();
        if (wallPostCount) {
          return {
            status: false,
            message: 'Module already linked in WallPost',
          };
        }
        const postCount = await ChannelPost.count(query).lean();
        if (postCount) {
          return {
            status: false,
            message: 'Module already linked in Channel Posts',
          };
        }
        const customFromCount = await CustomForm.count(query).lean();
        if (customFromCount) {
          return {
            status: false,
            message: 'Module already linked in Customform',
          };
        }
        return { status: true, message: 'Module not linked anywere' };
      } else {
        return { status: false, message: 'Module Not found' };
      }
    } catch (error) {
      this.log(error, 'isModuleIncluded');
      return { status: false, message: 'Something went wrong' };
    }
  }

  async channelUsersList(channel, responseType = 'id') {
    const userDetails = channel.userDetails || [];
    try {
      let userList = [];
      for (const curr of userDetails) {
        let businessUnits = curr.businessUnits;
        let condition = {};
        if (1 === curr.buFilterType) {
          if (curr.allBuToken) {
            const userBus = await User.findById(channel.createdBy)
              .select('planBussinessUnitId')
              .lean();
            if (userBus) {
              businessUnits = userBus.planBussinessUnitId.map((v) =>
                mongoose.Types.ObjectId(v),
              );
            }
          }
          condition['parentBussinessUnitId'] = {
            $in: businessUnits.map((v) => mongoose.Types.ObjectId(v)),
          };
        } else if (2 === curr.buFilterType) {
          condition['parentBussinessUnitId'] = {
            $in: businessUnits.map((v) => mongoose.Types.ObjectId(v)),
          };
          condition['$or'] = [
            {
              appointmentId: {
                $in: curr.appointments.map((v) => mongoose.Types.ObjectId(v)),
              },
            },
            {
              subSkillSets: {
                $in: curr.subSkillSets.map((v) => mongoose.Types.ObjectId(v)),
              },
            },
            {
              _id: {
                $in: curr.authors.map((v) => mongoose.Types.ObjectId(v)),
              },
            },
          ];
          if (curr.customField.length) {
            condition['$or'] = condition['$or'] || [];
            for (let singleCustom of curr.customField) {
              condition['$or'].push({
                otherFields: {
                  $elemMatch: {
                    fieldId: singleCustom.fieldId,
                    value: {
                      $in: [singleCustom.value],
                    },
                  },
                },
              });
            }
          }
        } else if (3 === curr.buFilterType) {
          condition['parentBussinessUnitId'] = {
            $in: businessUnits.map((v) => mongoose.Types.ObjectId(v)),
          };
          condition['$and'] = [
            {
              appointmentId: {
                $nin: curr.appointments.map((v) => mongoose.Types.ObjectId(v)),
              },
            },
            {
              subSkillSets: {
                $nin: curr.subSkillSets.map((v) => mongoose.Types.ObjectId(v)),
              },
            },
            {
              _id: {
                $nin: curr.authors.map((v) => mongoose.Types.ObjectId(v)),
              },
            },
          ];
          if (curr.customField.length) {
            condition['$and'] = condition['$and'] || [];
            for (let singleCustom of curr.customField) {
              condition['$and'].push({
                'otherFields.fieldId': singleCustom.fieldId,
                'otherFields.value': { $ne: singleCustom.value },
              });
            }
          }
        }
        const users = await User.aggregate([
          {
            $match: condition,
          },
          {
            $project: { name: 1, staffId: 1, deviceToken: 1, otherFields: 1 },
          },
        ]).allowDiskUse(true);

        userList = [...userList, ...users];
      }
      if (responseType == 'id') {
        return userList.map((v) => v._id);
      }
      return userList;
    } catch (error) {
      this.log(error);
      return [];
    }
  }

  htmlTagValidate(data) {
    let values = Object.values(data);
    return /<((?=!\-\-)!\-\-[\s\S]*\-\-|((?=\?)\?[\s\S]*\?|((?=\/)\/[^.\-\d][^\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*|[^.\-\d][^\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*(?:\s[^.\-\d][^\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*(?:=(?:"[^"]*"|'[^']*'|[^'"<\s]*))?)*)\s?\/?))>/gi.test(
      values,
    );
  }

  /**
   * Fixed for No Filter added
   */
  // async wallUsersList(wallData) {

  //     wallData.assignUsers = wallData.assignUsers || [];
  //     let userIds = [];
  //     for (let elem of wallData.assignUsers) {

  //         let searchQuery = {
  //             status: 1,
  //         };
  //         // Condition Exclude -> and, nin, Other-> or, in
  //         let condition = (elem.buFilterType == 3) ? '$nin' : '$in';
  //         let mainCondition = (elem.buFilterType == 3) ? '$and' : '$or';
  //         searchQuery[mainCondition] = [];

  //         if (elem.businessUnits.length > 0) {
  //             searchQuery.parentBussinessUnitId = {};
  //             searchQuery.parentBussinessUnitId['$in'] = elem.businessUnits;
  //         }
  //         if (elem.appointments.length > 0) {
  //             let appointmentId = {};
  //             appointmentId[condition] = elem.appointments;
  //             searchQuery[mainCondition].push({
  //                 appointmentId: appointmentId
  //             });
  //         }
  //         if (elem.subSkillSets.length > 0) {
  //             let subSkillSets = {};
  //             subSkillSets[condition] = elem.subSkillSets;
  //             searchQuery[mainCondition].push({
  //                 subSkillSets: subSkillSets
  //             });
  //         }
  //         elem.user = elem.user || [];
  //         if (elem.user.length > 0) {
  //             let user = {};
  //             user[condition] = elem.user;
  //             searchQuery[mainCondition].push({
  //                 _id: user
  //             });
  //         }
  //         if (elem.customField.length > 0) {

  //             for (let singleCustom of elem.customField) {

  //                 searchQuery[mainCondition].push({
  //                     otherFields: {
  //                         "$elemMatch": {
  //                             "fieldId": singleCustom.fieldId,
  //                             "value": {
  //                                 [condition]: [singleCustom.value]
  //                             }
  //                         }
  //                     }
  //                 });

  //             }

  //         }

  //         if (searchQuery[mainCondition].length == 0) {
  //             delete searchQuery[mainCondition];
  //         }

  //         this.log(searchQuery, "walluserlist")

  //         // Users List
  //         let users = await User.find(searchQuery).select('name staffId deviceToken otherFields').lean();
  //         users = users.map(v => {
  //             return v._id
  //         });
  //         userIds = [...userIds, ...users];

  //         // Admin's List
  //         if (elem.admin && elem.admin.length > 0) {
  //             let admins = await User.find({
  //                 _id: {
  //                     '$in': elem.admin
  //                 }
  //             }).lean()
  //             admins = admins.map(v => {
  //                 return v._id
  //             });
  //             userIds = [...userIds, ...admins];
  //         }

  //     }
  //     this.log(userIds, userIds.length)
  //     return userIds;

  // }

  // Password Validation Company Wise
  async pwdValidation(userData, password) {
    let settingData = await PageSetting.findOne({
      companyId: userData.companyId,
    });

    // Return with messages
    let returnData = {
      status: true,
      message: [],
      pwdSettings: null,
    };

    // No Settings Yet
    if (!settingData) {
      return returnData;
    }

    let pwdSettings = settingData.pwdSettings;

    // Inactive Management
    if (pwdSettings.status) {
      returnData.pwdSettings = settingData.pwdSettings;
    } else {
      return returnData;
    }
    // this.log(pwdSettings)
    // Start Validation as per keys
    // Char Length
    if (password.length < pwdSettings.charLength) {
      returnData.message.push(
        `Atleast ${pwdSettings.charLength} characters required`,
      );
      returnData.status = false;
    }
    // Lowercase
    if (pwdSettings.charTypes.lowerCase && !/[a-z]/.test(password)) {
      returnData.message.push(`Atleast one lowercase letter is required`);
      returnData.status = false;
    }
    // Uppercase
    if (pwdSettings.charTypes.upperCase && !/[A-Z]/.test(password)) {
      returnData.message.push(`Atleast one uppercase letter is required`);
      returnData.status = false;
    }
    // Number
    if (pwdSettings.charTypes.numbers && !/[0-9]/.test(password)) {
      returnData.message.push(`Atleast one numaric letter is required`);
      returnData.status = false;
    }
    // Special Character
    if (
      pwdSettings.charTypes.specialChar &&
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password)
    ) {
      returnData.message.push(`Atleast one special character is required`);
      returnData.status = false;
    }

    return returnData;
  }

  // get My CustomForm..
  async getUserCustomForm(userData, reqStatus = [1]) {
    let companyId = userData.companyId;
    let businessUnit = userData.parentBussinessUnitId;
    let appointment = userData.appointmentId;
    let subSkillSets = userData.subSkillSets || [];

    // Custom Field restructure
    let customFields = userData.otherFields || [];
    customFields = customFields.map((v) => {
      return {
        fieldId: v.fieldId,
        value: v.value,
      };
    });

    let searchQuery = {
      companyId: companyId,
      status: {
        $in: reqStatus,
      },
      $or: [],
    };

    let keyFalseCondition = {
      // if no fitler is given
      appointments: [],
      subSkillSets: [],
      customField: [],
      user: [],
    };

    // Create 3 or condition based on 3 filter types
    // 1-> All Users in Selected Business Unit
    let condition1 = {
      assignUsers: {
        $elemMatch: {
          buFilterType: 1,
          $or: [
            {
              businessUnits: {
                $in: [businessUnit],
              },
            },
            {
              allBuToken: true
            },
          ],
          $or: [
            keyFalseCondition,
            {
              appointments: {
                $in: [appointment],
              },
            },
            {
              admin: {
                $in: [userData._id],
              },
            },
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition1.assignUsers['$elemMatch']['$or'].push({
        subSkillSets: {
          $in: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition1.assignUsers['$elemMatch']['$or'].push({
        customField: {
          $in: customFields,
        },
      });
    }
    searchQuery['$or'].push(condition1);
    // 2 -> Include only Selected Users from Business Unit
    let condition2 = {
      assignUsers: {
        $elemMatch: {
          buFilterType: 2,
          $or: [
            {
              businessUnits: {
                $in: [businessUnit],
              },
            },
            {
              allBuToken: true
            },
          ],
          $or: [
            keyFalseCondition,
            {
              appointments: {
                $in: [appointment],
              },
            },
            {
              user: {
                $in: [userData._id],
              },
            },
            {
              admin: {
                $in: [userData._id],
              },
            },
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition2.assignUsers['$elemMatch']['$or'].push({
        subSkillSets: {
          $in: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition2.assignUsers['$elemMatch']['$or'].push({
        customField: {
          $in: customFields,
        },
      });
    }
    searchQuery['$or'].push(condition2);
    // 3 -> Exclude selected Users from Business Unit
    let condition3 = {
      assignUsers: {
        $elemMatch: {
          buFilterType: 3,
          $or: [
            {
              businessUnits: {
                $in: [businessUnit],
              },
            },
            {
              allBuToken: true
            },
          ],
          $or: [
            keyFalseCondition,
            {
              $and: [
                {
                  appointments: {
                    $nin: [appointment],
                  },
                },
                {
                  user: {
                    $nin: [userData._id],
                  },
                },
              ],
            },
            {
              admin: {
                $in: [userData._id],
              },
            },
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition3.assignUsers['$elemMatch']['$or'][1]['$and'].push({
        subSkillSets: {
          $nin: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition3.assignUsers['$elemMatch']['$or'][1]['$and'].push({
        customField: {
          $nin: customFields,
        },
      });
    }

    searchQuery['$or'].push(condition3);
    searchQuery.isDeployed = 1;
    searchQuery.status = {
      $in: [1],
    };
    let customList = await CustomForm.find(searchQuery).lean();
    // wallList = wallList.map((v) => {
    //     return v._id
    // });
    return customList;
  }

  // get My CustomForm for mobile..
  async getUserCustomFormMobile(userData) {
    let companyId = userData.companyId;
    let businessUnit = userData.parentBussinessUnitId;
    let appointment = userData.appointmentId;
    let subSkillSets = userData.subSkillSets || [];

    // Custom Field restructure
    let customFields = userData.otherFields || [];
    customFields = customFields.map((v) => {
      return {
        fieldId: v.fieldId,
        value: v.value,
      };
    });

    let searchQuery = {
      companyId: companyId,
      status: {
        $in: [1],
      },
      $or: [],
    };

    let keyFalseCondition = {
      // if no fitler is given
      appointments: [],
      subSkillSets: [],
      customField: [],
      user: [],
    };

    // Create 3 or condition based on 3 filter types
    // 1-> All Users in Selected Business Unit
    let condition1 = {
      assignUsers: {
        $elemMatch: {
          buFilterType: 1,
          $or: [
            {
              businessUnits: {
                $in: [businessUnit],
              },
            },
            {
              allBuToken: true
            },
          ],
          $or: [
            keyFalseCondition,
            {
              appointments: {
                $in: [appointment],
              },
            },
            {
              admin: {
                $in: [userData._id],
              },
            },
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition1.assignUsers['$elemMatch']['$or'].push({
        subSkillSets: {
          $in: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition1.assignUsers['$elemMatch']['$or'].push({
        customField: {
          $in: customFields,
        },
      });
    }
    searchQuery['$or'].push(condition1);
    // 2 -> Include only Selected Users from Business Unit
    let condition2 = {
      assignUsers: {
        $elemMatch: {
          buFilterType: 2,
          $or: [
            {
              businessUnits: {
                $in: [businessUnit],
              },
            },
            {
              allBuToken: true
            },
          ],
          $or: [
            keyFalseCondition,
            {
              appointments: {
                $in: [appointment],
              },
            },
            {
              user: {
                $in: [userData._id],
              },
            },
            {
              admin: {
                $in: [userData._id],
              },
            },
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition2.assignUsers['$elemMatch']['$or'].push({
        subSkillSets: {
          $in: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition2.assignUsers['$elemMatch']['$or'].push({
        customField: {
          $in: customFields,
        },
      });
    }
    searchQuery['$or'].push(condition2);
    // 3 -> Exclude selected Users from Business Unit
    let condition3 = {
      assignUsers: {
        $elemMatch: {
          buFilterType: 3,
          $or: [
            {
              businessUnits: {
                $in: [businessUnit],
              },
            },
            {
              allBuToken: true
            },
          ],
          $or: [
            keyFalseCondition,
            {
              $and: [
                {
                  appointments: {
                    $nin: [appointment],
                  },
                },
                {
                  user: {
                    $nin: [userData._id],
                  },
                },
              ],
            },
            {
              admin: {
                $in: [userData._id],
              },
            },
          ],
        },
      },
    };
    if (subSkillSets.length > 0) {
      condition3.assignUsers['$elemMatch']['$or'][1]['$and'].push({
        subSkillSets: {
          $nin: subSkillSets,
        },
      });
    }
    if (customFields.length > 0) {
      condition3.assignUsers['$elemMatch']['$or'][1]['$and'].push({
        customField: {
          $nin: customFields,
        },
      });
    }

    searchQuery['$or'].push(condition3);
    searchQuery['$or'].push({
      workflow: { $exists: true },
      status: {
        $nin: [0, 3],
      },
      workflow: {
        $elemMatch: {
          admin: {
            $in: [userData._id],
          },
        },
      },
    });
    return await CustomForm.find(searchQuery)
      .populate([
        {
          path: 'moduleId',
          select: 'questions',
          populate: {
            path: 'questions',
            select: 'question _id imageSrc ppimageuploadfrom options type',
          },
        },
        {
          path: 'workflow.additionalModuleId',
          populate: {
            path: 'questions',
            select: 'question _id imageSrc ppimageuploadfrom options type',
          },
        },
      ])
      .lean();
  }

  // at manual BU update
  // at user plan BU update
  async updateAllBuToUser(userData, isIndividual) {
    let userId = userData._id,
      condition = {
        createdBy: userId,
        'assignUsers.allBuToken': true,
      };
    let channelFinder = {
      createdBy: userId,
      'userDetails.allBuToken': true,
    };
    if (isIndividual) {
      condition['assignUsers.allBuTokenStaffId'] = userData.staffId;
      channelFinder['userDetails.allBuTokenStaffId'] = userData.staffId;
    }
    let channels = await Channel.find(channelFinder);
    const boards = await Wall.find(condition);
    const notifications = await Notification.find(condition);
    const forms = await CustomForm.find(condition);
    if (channels) {
      for (const channel of channels) {
        // channel.userDetails[0].businessUnits = userData.planBussinessUnitId;
        channel.userDetails.forEach((detail) => {
          if (detail.allBuToken) {
            detail.businessUnits = userData.planBussinessUnitId;
          }
        });
        await Channel.findOneAndUpdate(
          { _id: channel._id },
          {
            userDetails: channel.userDetails,
          },
        );
      }
    }
    if (boards) {
      for (const board of boards) {
        // board.assignUsers[0].businessUnits = userData.planBussinessUnitId
        board.assignUsers.forEach((user) => {
          if (user.allBuToken) {
            user.businessUnits = userData.planBussinessUnitId;
          }
        });
        await Wall.findOneAndUpdate(
          { _id: board._id },
          {
            assignUsers: board.assignUsers,
          },
        );
      }
    }
    if (notifications) {
      for (const notification of notifications) {
        // notification.assignUsers[0].businessUnits = userData.planBussinessUnitId
        notification.assignUsers.forEach((user) => {
          if (user.allBuToken) {
            user.businessUnits = userData.planBussinessUnitId;
          }
        });
        await Notification.findOneAndUpdate(
          { _id: notification._id },
          {
            assignUsers: notification.assignUsers,
          },
        );
      }
    }
    if (forms) {
      for (const form of forms) {
        // form.assignUsers[0].businessUnits = userData.planBussinessUnitId
        form.assignUsers.forEach((user) => {
          if (user.allBuToken) {
            user.businessUnits = userData.planBussinessUnitId;
          }
        });
        await CustomForm.findOneAndUpdate(
          { _id: form._id },
          {
            assignUsers: form.assignUsers,
          },
        );
      }
    }
  }

  // at manual BU update
  async updateAllBuToAccessUsers(companyId) {
    const systemAdminRoles = await Role.find({
        companyId: companyId,
        name: 'System Admin',
      })
        .select('_id')
        .lean(),
      systemAdminRolesIds = systemAdminRoles.map((v) => v._id);
    const planBUUpdatedUsers = await User.find({
      $or: [{ role: { $in: systemAdminRolesIds } }, { allBUAccess: 1 }],
      companyId: companyId,
    }).lean();
    // admins and allBUaccess users created forms, boards,... update
    for (let userData of planBUUpdatedUsers) {
      await this.updateAllBuToUser(userData);
    }
  }

  async getPrivilegeData(userInfo) {
    if(!userInfo.roleUpdate){
      return userInfo.privileges
    }
    let whereClause = {
      _id: userInfo._id,
      status: { $ne: 3 /* $ne => not equal*/ },
    };
    let users = await User.findOne(whereClause)
      .populate([
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
      ])
      .lean();
    let userData = await this.getUserPrivilegeObject(users.role.privileges);
    /*for (const prev in userData) {
            if (userData.hasOwnProperty(prev)) {
                //const current = userData[prev];
                console.log(userData[prev])
                //userData[prev] = true;
            }
        }*/
    //return !!privilege ? true : userData;
    return !!privilege ? userData[privilege] : userData;
  }

  async sendSMS(input) {
    try {
      const xForce = 'xForce+';
      const { body, to, isSats, sendFromNumber } = input;
      const from = isSats
        ? sendFromNumber
          ? process.env.TWILIO_FROM_XFORCE
          : process.env.TWILIO_FROM
        : xForce;
      const twilio = require('twilio');
      let client = new twilio(
        process.env.TWILIO_ACCOUNTSID_XFORCE,
        process.env.TWILIO_AUTHTOKEN_XFORCE,
      );
      if (isSats && !sendFromNumber) {
        client = new twilio(
          process.env.TWILIO_ACCOUNTSID,
          process.env.TWILIO_AUTHTOKEN,
        );
      }
      await client.messages
        .create({
          body: body,
          to: to, // Text this number
          from, // From a valid Twilio number
        })
        .then(
          (data) => {
            this.log('Message sent');
          },
          (error) => {
            this.log(error);
            if (!isSats) {
              input.isSats = true;
              input.sendFromNumber = true;
              this.sendSMS(input);
            }
          },
        );
    } catch (error) {
      console.log(error);
    }
  }

  stripeHtml(html) {
    return html
      .replace(/\<(?!img|br).*?\>/g, '')
      .replace(/\<br\s*[\/]?>/gi, '')
      .replace(/(\r\n|\n|\r)/gm, '')
      .replace(/&nbsp;/g, '');
  }
  checkHtmlContent(body) {
    const checkIfHtml = (input) =>
      /<((?=!\-\-)!\-\-[\s\S]*\-\-|((?=\?)\?[\s\S]*\?|((?=\/)\/[^.\-\d][^\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*|[^.\-\d][^\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*(?:\s[^.\-\d][^\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*(?:=(?:"[^"]*"|'[^']*'|[^'"<\s]*))?)*)\s?\/?))>/.test(
        input,
      );
    const checkInData = (input) => {
      if (Array.isArray(input)) {
        return input.every((v) => checkInData(v));
      } else if (input instanceof Object) {
        return Object.values(input).every((v) => checkInData(v));
      } else if (typeof input === 'string') {
        return !checkIfHtml(input);
      }
      return true;
    };
    return checkInData(JSON.parse(JSON.stringify(body)));
  }
  checkSpecialCharacters(body, action) {
    let regExChars = '';
    // const checkSC = input => new RegExp(`^[a-zA-Z0-9 @,.${regExChars}-]*$`).test(input);
    const rx = new XRegExp(
      '^[-\\w\\p{Hiragana}\\p{Katakana}\\p{Han}0-9 @,.()_/]+$',
    );
    const checkSC = (input) => XRegExp.test(input, rx);
    const checkIsParsed = (input) => {
      try {
        if (action === 'profile update') {
          // input.otherFields = JSON.parse(input.otherFields);
          delete input.otherFields;
          delete input.password;
        }
        if (action === 'page settings') {
          // regExChars = "/:_?=%-";
          delete input.bannerImages;
          input.pwdSettings ? delete input.pwdSettings.defaultPassword : '';
          // input.externalLinks.forEach(link => {
          //     delete link.link;
          //     delete link.icon;
          // });
          delete input.externalLinks;
        }
        if (action === 'wall') {
          delete input.bannerImage;
          delete input.assignUsers;
        }
        if (action === 'manageNews') {
          delete input.teaser;
          delete input.content;
          delete input.teaserImage;
          delete input.publishing;
          if (typeof input.eventDetails === 'string') {
            input.eventDetails = JSON.parse(input.eventDetails);
            input.userOptions = JSON.parse(input.userOptions);
          }
          delete input.eventDetails.startDate;
          delete input.eventDetails.endDate;
        }
        if (action === 'manageEvent') {
          delete input.teaser;
          delete input.content;
          delete input.publishing;
          if (typeof input.eventDetails === 'string') {
            input.eventDetails = JSON.parse(input.eventDetails);
            input.wallTitle = JSON.parse(input.wallTitle);
            input.userOptions = JSON.parse(input.userOptions);
          }
          delete input.eventDetails.startDate;
          delete input.eventDetails.endDate;
        }
        if (action === 'notification') {
          // regExChars = ":+";
          delete input.notificationAttachment;
          delete input.effectiveFrom;
          delete input.effectiveTo;
          delete input.activeFrom;
          delete input.activeTo;
          delete input.userAcknowledgedAt;
          delete input.lastNotified;
        }
        if (action === 'modules') {
          delete input.updatedAt;
          delete input.createdAt;
          delete input.question;
          delete input.welComeMessage;
          delete input.closingMessage;
          delete input.welComeAttachement;
          delete input.submissionImage;
          delete input.imageSrc;
          if (input.options) {
            input.options.forEach((link) => {
              delete link.imageSrc;
            });
          }
          delete input.explanation;
        }
        if (action === 'customforms') {
          delete input.assignUsers;
          delete input.formLogo;
        }
        if (action === 'challenges') {
          delete input.challenge.icon;
          delete input.challenge.publishStart;
          delete input.challenge.publishEnd;
          delete input.challenge.challengeStart;
          delete input.challenge.challengeEnd;
        }
        return input;
      } catch (err) {
        console.log('\n\n>>>> Error in global functions :', err);
        return input;
      }
    };
    const checkInData = (input) => {
      if (Array.isArray(input)) {
        return input.every((v) => checkInData(v));
      } else if (input instanceof Object) {
        return Object.values(input).every((v) => checkInData(v));
      } else if (typeof input === 'string') {
        input = input.split('\n').join('');
        console.log('>>> input :', input);
        input = input == '' ? ' ' : input;
        return checkSC(input);
      }
      return true;
    };
    body = checkIsParsed(JSON.parse(JSON.stringify(body)));
    // return checkInData(body);
    return true;
  }

  /* init point system for a company */
  async initPointSystem(companyId, justReturn = false) {
    const data = [
      {
        icon: `0`,
        title: `Reward points`,
        description: `This is default point system. all other are non rewarded point system.`,
        isEnabled: true,
      },
    ];
    if (justReturn) return data;
    let pageSetting = await PageSetting.findOne({ companyId });
    pageSetting.pointSystems = data;
    await pageSetting.save();
    return data;
  }

  async getUserToken() {
    return await new Promise((resolve, reject) => {
      request(
        {
          url: `${process.env.UNIQ_REWARD_URL}/v2/connect/token`,
          form: {
            client_id: process.env.UNIQ_CLIENT_ID,
            client_secret: process.env.UNIQ_CLIENT_SECRET,
            grant_type: 'client_credentials',
            scope: process.env.UNIQ_SCOPE,
          },
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        (error, response, body) => {
          try {
            if (error) {
              return resolve(null);
            }
            body = JSON.parse(body);
            return resolve(body);
          } catch (error) {
            return reject(null);
          }
        },
      );
    });
  }
}
globalFunctions = new globalFunctions();
module.exports = globalFunctions;
