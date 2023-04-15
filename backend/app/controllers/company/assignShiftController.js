// Controller Code Starts here
const Shift = require('../../models/shift'),
  mongoose = require('mongoose'),
  ShiftDetails = require('../../models/shiftDetails'),
  ShiftLog = require('../../models/shiftLog'),
  StaffLimit = require('../../models/staffLimit'),
  SkillSet = require('../../models/skillSet'),
  SubSkillSet = require('../../models/subSkillSet'),
  AppliedStaff = require('../../models/appliedStaff'),
  Appointment = require('../../models/appointment'),
  AssignShiftLog = require('../../models/assignShiftLog'),
  Attendance = require('../../models/attendance'),
  SubSection = require('../../models/subSection'),
  User = require('../../models/user'),
  ReportingLocation = require('../../models/reportingLocation'),
  Role = require('../../models/role'),
  __ = require('../../../helpers/globalFunctions');
const OpsGroup = require('../../models/ops');
const AssignShift = require('../../models/assignShift');
const _ = require('lodash');
const FCM = require('../../../helpers/fcm');
var multiparty = require('multiparty');
const async = require('async');
const moment = require('moment');
const json2csv = require('json2csv').parse;
const fs = require('fs');
const csv = require('csvtojson');
const { isNull } = require('lodash');
const pageSetting = require('../../models/pageSetting');
const { logInfo, logError } = require('../../../helpers/logger.helper');

let uploadFilePath = '';
class assignShift {
  getDayName(dateString) {
    var days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    var d = new Date(dateString);
    var dayName = days[d.getDay()];
    return dayName;
  }
  async createStaffListing(req, res) {
    try {
      logInfo(`assginshift/stafflisting API Start!`, { name: req.user.name, staffId: req.user.staffId });
      var bodyData = req.body;
      var weekStart = moment(
        bodyData.weekRangeStartsAt,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      var weekEnd = moment(bodyData.weekRangeEndsAt, 'MM-DD-YYYY HH:mm:ss Z')
        .utc()
        .format();
      var wholeWeekData = [];
      var weekNumber = __.weekNoStartWithMonday(weekStart);
      var userData = await User.findOne({ _id: bodyData.userId });
      const year = new Date(weekStart).getFullYear();
      let redisBuId;
      let mondayDate;
      let redisTimeZone;
      var assignShiftDataPresent = await AssignShift.find({
        weekNumber: weekNumber,
        staff_id: userData._id,
        $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, year] },
      });

      if (assignShiftDataPresent.length == 0) {
        for (var i = 0; i < 7; i++) {
          var date = moment(new Date(weekStart)).add('days', i);
          var day = moment(new Date(weekStart))
            .utcOffset(bodyData.timeFormat)
            .add('days', i);
          var obj = {
            staffId: userData.staffId,
            businessUnitId: bodyData.businessUnitId,
            staff_id: userData._id,
            staffRoleId: userData.role,
            staffAppointmentId: userData.appointmentId,
            timeZone: bodyData.timeFormat,
            weekNumber: weekNumber,
            weekRangeStartsAt: weekStart,
            weekRangeEndsAt: weekEnd,
            plannedBy: bodyData.plannedBy,
            confirmedStaffs: [userData._id],
            date: date,
            day: moment(day).format('YYYY-MM-DD'),
            isEmpty: true,
          };
          wholeWeekData.push(obj);
        }
        const insert = await AssignShift.insertMany(wholeWeekData);
        var dayWiseData = [];
        for (let i = 0; i < insert.length; i++) {
          var item = insert[i];
          if (i === 0) {
            redisBuId = item.businessUnitId;
            mondayDate = this.getMondayDate(item.weekRangeStartsAt);
            redisTimeZone = item.timeZone ? item.timeZone : 'GMT+0800';
          }
          var obj = {
            day: this.getDayName(item.date),
            assginShiftId: item._id,
            date: item.day,
          };
          dayWiseData.push(obj);
        }
      } else {
        var dayWiseData = [];
        for (let i = 0; i < assignShiftDataPresent.length; i++) {
          var item = assignShiftDataPresent[i];
          if (i === 0) {
            redisBuId = item.businessUnitId;
            mondayDate = this.getMondayDate(item.weekRangeStartsAt);
            redisTimeZone = item.timeZone ? item.timeZone : 'GMT+0800';
          }
          var obj = {
            day: this.getDayName(item.date),
            assginShiftId: item._id,
            date: item.day,
          };
          dayWiseData.push(obj);
        }
      }
      logInfo(`assginshift/stafflisting API ends here!`, { name: req.user.name, staffId: req.user.staffId });
      return res.status(200).json({
        success: true,
        msg: 'shift list created successfully',
        dayWiseData,
      });
    } catch (error) {
      logError(`assginshift/stafflisting API, there is an error`, error.toString());
      return res
        .status(200)
        .json({ success: false, msg: 'something went wrong', error });
    }
  }
  async createEmptyShift(data, req) {
    try {
      var shift = data.shift;
      const companyId = req.user.companyId;
      var shiftDetails = data.shiftDetails;
      var wholeWeekData = [];
      var staffId = new Set();
      var weekNumber = __.weekNoStartWithMonday(shift.weekRangeStartsAt);
      const yearE = new Date(shift.weekRangeStartsAt).getFullYear();
      console.log('weekNumber', weekNumber);
      for (var i = 0; i < shiftDetails.length; i++) {
        if (shiftDetails[i] && shiftDetails[i].staffId)
          staffId.add(shiftDetails[i].staffId);
      }
      staffId = Array.from(staffId);
      console.log('staffId', staffId);
      for (var j = 0; j < staffId.length; j++) {
        var userData = await User.findOne(
          { staffId: staffId[j], companyId },
          { _id: 1, role: 1, staffId: 1, appointmentId: 1 },
        );
        console.log('userData', userData._id);
        var isAssignShiftPresent = await AssignShift.deleteMany({
          staff_id: userData._id,
          weekNumber: weekNumber,
          $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, yearE] },
        });
        console.log('isAssignShiftPresent', isAssignShiftPresent.result.n);
        if (isAssignShiftPresent.length == 0 || true) {
          console.log('hereeeereetrfyujy');
          for (var i = 0; i < 7; i++) {
            var date = moment(new Date(shift.weekRangeStartsAt)).add('days', i);
            console.log('date', date);
            var day = moment(new Date(shift.weekRangeStartsAt))
              .utc(shift.timeFormat)
              .add('days', i);
            console.log('day', day);
            var obj = {
              staffId: userData.staffId,
              businessUnitId: shift.businessUnitId,
              staff_id: userData._id,
              staffRoleId: userData.role,
              staffAppointmentId: userData.appointmentId,
              timeZone: shift.timeFormat,
              weekNumber: weekNumber,
              weekRangeStartsAt: shift.weekRangeStartsAt,
              weekRangeEndsAt: shift.weekRangeEndsAt,
              plannedBy: shift.plannedBy,
              confirmedStaffs: [userData._id],
              date: date,
              day: moment(day).format('YYYY-MM-DD'),
              isEmpty: true,
            };
            wholeWeekData.push(obj);
          }
        }
      }
      // return wholeWeekData;
      if (wholeWeekData.length > 0) {
        const insert = await AssignShift.insertMany(wholeWeekData);
      }
      return;
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  async create(req, res) {
    try {
      const bodyData = await this.getBodyData(res, req);
      const jsonArray = bodyData.shiftDetails;
      const fieldsArray = Object.keys(jsonArray[0]);
      // return res.json({ fieldsArray, jsonArray })
      const csvDD = await json2csv({
        data: jsonArray,
        fields: fieldsArray,
      });
      let fileName = `assignshift_import_${moment().format(
        'DD-MM-YYYY HH-mm',
      )}`;
      let filePath = `/public/uploads/assingshift/${fileName}.csv`;
      uploadFilePath = filePath;
      fs.writeFile(
        `./public/uploads/assingshift/${fileName}.csv`,
        csvDD,
        (err) => {
          if (err) {
            //return __.out(res, 300, 'Something went wrong try later');
          } else {
            //  return __.out(res, 201, { csvLink: `/uploads/reportsDownloads/${fileName}.csv` });
          }
        },
      );
      // return res.json(bodyData)
      console.log('here');
      //return res.json(bodyData)
      if (bodyData) {
        //const shiftId = await this.createShift(bodyData.shift);
        const csvLength = bodyData.shiftDetails.length;
        bodyData.shift.weekRangeStartsAt = moment(
          bodyData.shift.weekRangeStartsAt,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
        bodyData.shift.weekRangeEndsAt = moment(
          bodyData.shift.weekRangeEndsAt,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
        const timeFormat = bodyData.shift.timeFormat;
        const failedShift = [];
        const createdShift = [];
        const reportLocation = [];
        bodyData.shift.plannedBy = req.user._id;
        const planBussinessUnitId = await User.findOne(
          { _id: req.user._id },
          { _id: 0, planBussinessUnitId: 1 },
        );
        //  const planBussinessUnitIdArr = planBussinessUnitId.planBussinessUnitId;
        const planBussinessUnitIdArr = [];
        planBussinessUnitId.planBussinessUnitId.map((planBu) => {
          planBussinessUnitIdArr.push(planBu.toString());
        });
        console.log('eee', req.user._id);
        await this.createEmptyShift(bodyData, req);
        console.log('hereee');
        delete bodyData.shift.timeFormat;
        req.body.data = {};
        req.body.data = bodyData.shift;
        req.body.shift = bodyData.shift;
        const selectedBuID = bodyData.shift.businessUnitId;
        //console.log('bodyData.shift', bodyData.shift)
        // for(let i =0; i< csvLength; i++ ){
        //     bodyData.shiftDetails[i]= {...bodyData.shift, ...bodyData.shiftDetails[i]}
        // }
        let asyncIndex = 0;
        //console.log('b');
        const companySetup = await pageSetting.findOne(
          { companyId: req.user.companyId },
          { opsGroup: 1 },
        );
        const tierSetup = companySetup.opsGroup.tierType;
        const formatDataCreateArr = [];
        for (let i = 0; i < bodyData.shiftDetails.length; i++) {
          const item = bodyData.shiftDetails[i];
          if (item) {
            formatDataCreateArr.push(
              this.formatDataCreate(
                res,
                bodyData,
                item,
                planBussinessUnitIdArr,
                req,
                tierSetup,
                timeFormat,
                selectedBuID,
              ),
            );
          }
        }
        const formatDataCreateResult = await Promise.all(formatDataCreateArr);
        bodyData.shiftDetails = [];
        const fail = [];
        const valid = [];
        let redisObj = {};
        for (let i = 0; i < formatDataCreateResult.length; i++) {
          if (formatDataCreateResult[i].success) {
            valid.push(formatDataCreateResult[i].validShift[0]);
            redisObj = formatDataCreateResult[i].redisObj;
          } else {
            fail.push(formatDataCreateResult[i].failedShift[0]);
          }
          bodyData.shiftDetails.push(formatDataCreateResult[i].bodyDataObj);
          if (formatDataCreateResult[i].failedShift.length > 0) {
            fail.push(formatDataCreateResult[i].failedShift[0]);
          }
        }
        console.log('redisObj', redisObj);
        if (valid.length > 0) {
          // const updateResult = await this.updateRedis(
          //   redisObj.redisBuId,
          //   true,
          //   redisObj.mondayDate,
          //   redisObj.redisTimeZone,
          // );
          this.failedShiftInsert(res, fail, req, valid, 0);
          return res.json({
            status: true,
            code: 1,
            message: 'Successfully uploaded',
          });
        } else {
          this.failedShiftInsert(res, fail, req, valid, 0);
          return res.json({
            status: false,
            code: 1,
            message: 'there was some problem in upload',
          });
        }
      } else {
        res.json({ status: false, code: 1, message: 'Something went wrong' });
      }
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  async formatDataCreate(
    res,
    bodyData,
    item,
    planBussinessUnitIdArr,
    req,
    tierSetup,
    timeFormat,
    selectedBuID,
  ) {
    try {
      let bodyDataObj = {};
      let failedShift = [];
      return new Promise(async (resolve, reject) => {
        if (item.staffId) {
          bodyDataObj = { ...bodyData.shift, ...item };
          item.startTime = this.getDateInUTCFormatNew(
            item.StartDate,
            item.StartTime,
            timeFormat,
          );
          item.endTime = this.getDateInUTCFormatNew(
            item.EndDate,
            item.EndTime,
            timeFormat,
          );
          const userInfo = await User.findOne(
            { staffId: item.staffId, companyId: req.user.companyId },
            {
              _id: 1,
              appointmentId: 1,
              role: 1,
              mainSkillSets: 1,
              subSkillSets: 1,
              schemeId: 1,
              parentBussinessUnitId: 1,
              name: 1,
            },
          ).populate([
            {
              path: 'schemeId',
              select: 'shiftSchemeType shiftSetup',
            },
            {
              path: 'subSkillSets',
              select: 'name',
              populate: {
                path: 'skillSetId',
                select: 'name',
              },
            },
            {
              path: 'mainSkillSets',
              select: 'name',
            },
          ]);
          if (userInfo) {
            if (
              planBussinessUnitIdArr.includes(
                userInfo.parentBussinessUnitId.toString(),
              )
            ) {
              if (
                userInfo.schemeId &&
                (userInfo.schemeId.shiftSchemeType == 2 ||
                  userInfo.schemeId.shiftSchemeType == 3)
              ) {
                bodyDataObj.staff_id = userInfo._id;
                bodyDataObj.selectedBuID = selectedBuID;
                bodyDataObj.name = userInfo.name;
                bodyDataObj.shiftScheme = userInfo.schemeId;
                bodyDataObj.staffAppointmentId = userInfo.appointmentId;
                bodyDataObj.confirmedStaffs = [];
                bodyDataObj.confirmedStaffs[0] = userInfo._id;
                bodyDataObj.staffRoleId = userInfo.role;
                let dateSplit = item.Date.split('/');
                item.Date =
                  dateSplit[1] + '-' + dateSplit[0] + '-' + dateSplit[2];
                const twoMonth =
                  dateSplit[1].length == 2 ? dateSplit[1] : '0' + dateSplit[1];
                const twoDate =
                  dateSplit[0].length == 2 ? dateSplit[0] : '0' + dateSplit[0];
                // bodyDataObj.day = dateSplit[2] + '-' + dateSplit[1] + '-' + dateSplit[0];
                bodyDataObj.day = dateSplit[2] + '-' + twoMonth + '-' + twoDate;
                bodyDataObj.date = moment(item.Date, 'MM-DD-YYYY HH:mm:ss Z')
                  .utc()
                  .format();
                bodyDataObj.weekNumber = __.weekNoStartWithMonday(
                  bodyData.shift.weekRangeStartsAt,
                ); //moment(bodyData.shiftDetails[asyncIndex].date).format('ww');

                bodyDataObj.isOff = false;
                bodyDataObj.isRest = false;
                var isOffRest = item['OFF_REST'].trim();
                if (!isOffRest) {
                  var isSkillSet = false;
                  var subSkillArr = [];
                  if (tierSetup == 2) {
                    var skill1 = false;
                    var skill2 = false;
                    var skill3 = false;
                    if (item['speciality1'].trim()) {
                      isSkillSet = false;
                      skill1 = true;
                      for (var k = 0; k < userInfo.subSkillSets.length; k++) {
                        var subSkill = userInfo.subSkillSets[k];
                        if (
                          subSkill.name == item['speciality1'] &&
                          subSkill.skillSetId &&
                          subSkill.skillSetId.name == item['Skillsets1']
                        ) {
                          isSkillSet = true;
                          subSkillArr.push(subSkill._id);
                          break;
                        }
                      }
                    }
                    if (item['speciality2'].trim()) {
                      isSkillSet = false;
                      skill2 = true;
                      for (var k = 0; k < userInfo.subSkillSets.length; k++) {
                        var subSkill = userInfo.subSkillSets[k];
                        if (
                          subSkill.name == item['speciality2'] &&
                          subSkill.skillSetId &&
                          subSkill.skillSetId.name == item['Skillsets2']
                        ) {
                          isSkillSet = true;
                          subSkillArr.push(subSkill._id);
                          break;
                        }
                      }
                    }
                    if (item['speciality3'].trim()) {
                      isSkillSet = false;
                      skill3 = true;
                      for (var k = 0; k < userInfo.subSkillSets.length; k++) {
                        var subSkill = userInfo.subSkillSets[k];
                        if (
                          subSkill.name == item['speciality3'] &&
                          subSkill.skillSetId &&
                          subSkill.skillSetId.name == item['Skillsets3']
                        ) {
                          isSkillSet = true;
                          subSkillArr.push(subSkill._id);
                          break;
                        }
                      }
                    }
                  } else {
                    // tier 1 logic
                    if (item['Skillsets1'].trim()) {
                      isSkillSet = false;
                      for (var k = 0; k < userInfo.mainSkillSets.length; k++) {
                        var subSkill = userInfo.mainSkillSets[k];
                        if (subSkill.name == item['Skillsets1'].trim()) {
                          isSkillSet = true;
                          subSkillArr.push(subSkill._id);
                          break;
                        }
                      }
                    }
                    if (item['Skillsets2'].trim()) {
                      isSkillSet = false;
                      for (var k = 0; k < userInfo.mainSkillSets.length; k++) {
                        var subSkill = userInfo.mainSkillSets[k];
                        if (subSkill.name == item['Skillsets2'].trim()) {
                          isSkillSet = true;
                          subSkillArr.push(subSkill._id);
                          break;
                        }
                      }
                    }
                    if (item['Skillsets3'].trim()) {
                      isSkillSet = false;
                      for (var k = 0; k < userInfo.mainSkillSets.length; k++) {
                        var subSkill = userInfo.mainSkillSets[k];
                        if (subSkill.name == item['Skillsets3'].trim()) {
                          isSkillSet = true;
                          subSkillArr.push(subSkill._id);
                          break;
                        }
                      }
                    }
                  }
                  if (isSkillSet) {
                    if (tierSetup == 2) {
                      bodyDataObj.subSkillSets = subSkillArr;
                      bodyDataObj.skillSetTierType = 2;
                      bodyDataObj.mainSkillSets = [];
                    } else {
                      bodyDataObj.subSkillSets = [];
                      bodyDataObj.skillSetTierType = 1;
                      bodyDataObj.mainSkillSets = subSkillArr;
                    }
                    bodyDataObj.timeZone = timeFormat;
                    const startTimeArrSplit = item.StartTime.split(':');
                    if (startTimeArrSplit.length <= 2) {
                      item.StartTime = item.StartTime + ':00';
                    }
                    const endTimeArrSplit = item.EndTime.split(':');
                    if (endTimeArrSplit.length <= 2) {
                      item.EndTime = item.EndTime + ':00';
                    }
                    bodyDataObj.startTime = this.getDateInUTCFormatNew(
                      item.StartDate,
                      item.StartTime,
                      timeFormat,
                    );
                    bodyDataObj.endTime = this.getDateInUTCFormatNew(
                      item.EndDate,
                      item.EndTime,
                      timeFormat,
                    );
                    bodyDataObj.startTimeInSeconds = moment(
                      new Date(bodyDataObj.startTime),
                      'MM-DD-YYYY HH:mm:ss Z',
                    )
                      .utc()
                      .unix(); // new Date(bodyData.shiftDetails[asyncIndex].startTime).getTime();
                    bodyDataObj.endTimeInSeconds = moment(
                      new Date(bodyDataObj.endTime),
                      'MM-DD-YYYY HH:mm:ss Z',
                    )
                      .utc()
                      .unix(); //new Date(bodyData.shiftDetails[asyncIndex].endTime).getTime();
                    var startSecond = new Date(bodyDataObj.startTime).getTime();
                    var endSecond = new Date(bodyDataObj.endTime).getTime();
                    bodyDataObj.duration = (endSecond - startSecond) / 3600000;
                    var isSplitShift = item.SplitStartDate.trim()
                      ? true
                      : false;
                    if (isSplitShift) {
                      console.log('item.splitEndTime', item.splitEndTime);
                      bodyDataObj.splitStartTime = this.getDateInUTCFormatNew(
                        item.SplitStartDate,
                        item.SplitStartTime,
                        timeFormat,
                      );
                      bodyDataObj.splitEndTime = this.getDateInUTCFormatNew(
                        item.SplitEndDate,
                        item.SplitEndTime,
                        timeFormat,
                      );
                      bodyDataObj.splitStartTimeInSeconds = moment(
                        new Date(bodyDataObj.splitStartTime),
                        'MM-DD-YYYY HH:mm:ss Z',
                      )
                        .utc()
                        .unix(); // new Date(bodyData.shiftDetails[asyncIndex].startTime).getTime();
                      bodyDataObj.splitEndTimeInSeconds = moment(
                        new Date(bodyDataObj.splitEndTime),
                        'MM-DD-YYYY HH:mm:ss Z',
                      )
                        .utc()
                        .unix(); //new Date(bodyData.shiftDetails[asyncIndex].endTime).getTime();
                      var startSecondSplit = new Date(
                        bodyDataObj.splitStartTime,
                      ).getTime();
                      var endSecondSplit = new Date(
                        bodyDataObj.splitEndTime,
                      ).getTime();
                      bodyDataObj.duration +=
                        (endSecondSplit - startSecondSplit) / 3600000;
                      bodyDataObj.isSplitShift = true;
                    }

                    const location = await ReportingLocation.findOne(
                      {
                        name: {
                          $regex: new RegExp(
                            `^${item.reportLocationName}$`,
                            'i',
                          ),
                        },
                        status: 1,
                      },
                      { name: 1, _id: 1 },
                    );
                    if (location) {
                      bodyDataObj.reportLocationId = location._id;
                    } else {
                      const createLocation = {
                        name: item.reportLocationName,
                        companyId: req.user.companyId,
                        status: 1,
                      };
                      const locationCreate = await new ReportingLocation(
                        createLocation,
                      ).save();
                      this.updateBu(res, locationCreate._id, selectedBuID);
                      bodyDataObj.reportLocationId = locationCreate._id;
                    }
                  } else {
                    // skill error
                    console.log('skill error');
                    item.faildMessage =
                      'Skillsets are not matching, please enter exact  Skillsets of the staff'; //'User Not Belong to Plan Business Unit';
                    item.status = 0;
                    item.name = userInfo.name;
                    failedShift.push(item);
                    bodyDataObj = null;
                  }
                } else {
                  // off rest
                  bodyDataObj.endTime = null;
                  bodyDataObj.startTime = null;
                  bodyDataObj.reportLocationId = null;
                  bodyDataObj.alertMessage = null;
                  bodyDataObj.schemeId = null;
                  if (isOffRest.toUpperCase() == 'OFF') {
                    bodyDataObj.isOff = true;
                  } else {
                    bodyDataObj.isRest = true;
                  }
                }
              } else {
                item.faildMessage = 'User Does not have valid scheme'; //'User Not Belong to Plan Business Unit';
                item.status = 0;
                item.name = userInfo.name;
                failedShift.push(item);
                bodyDataObj = null;
              }
            } else {
              // plan BU not
              item.faildMessage = 'User Not Belong to Plan Business Unit'; //'User Not Belong to Plan Business Unit';
              item.status = 0;
              item.name = userInfo.name;
              failedShift.push(item);
              bodyDataObj = null;
            }
          } else {
            item.faildMessage = 'Staff ID not Found'; //'User Not Belong to Plan Business Unit';
            item.status = 0;
            failedShift.push(item);
            bodyDataObj = null;
          }
        } else {
          bodyDataObj = null;
        }
        if (failedShift.length > 0 || !bodyDataObj) {
          resolve({ success: false, failedShift });
        } else {
          const finalResult = await this.insertSendResponse(res, bodyDataObj);
          if (finalResult.failedShift.length > 0) {
            resolve({ success: false, failedShift: finalResult.failedShift });
          } else {
            resolve({
              success: true,
              validShift: finalResult.validShift,
              redisObj: finalResult.redis,
              failedShift: [],
            });
          }
        }
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  getDateInUTCFormatNew(date, time, timeZone) {
    let dateSplit = date.split('/');
    date = dateSplit[1] + '-' + dateSplit[0] + '-' + dateSplit[2];
    const dateTime = `${date} ${time} ${timeZone}`;
    // console.log('datetime11111111111', dateTime);
    return moment(dateTime, 'MM-DD-YYYY HH:mm:ss Z').utc().format();
  }
  updateBu(res, locationData, bu) {
    try {
      console.log('updateBu', locationData, bu);
      SubSection.update(
        { _id: bu },
        { $push: { reportingLocation: locationData } },
      )
        .then((sub) => {
          console.log('updateBuupdateBu', sub);
          return true;
        })
        .catch((e) => {
          console.log('updateBu', e);
          return true;
        });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  async createStaff(req, res) {
    try {
      const bodyData = await this.getBodyDataStaff(res, req);
      //  return res.json({bodyData})
      const companySetup = await pageSetting.findOne(
        { companyId: req.user.companyId },
        { opsGroup: 1 },
      );
      const tierSetup = companySetup.opsGroup.tierType;
      console.log('here');
      const isMobile = req.body.shift.isMobile;
      //console.log('req.body', req.body);
      //  const bodyData = [];
      const planBussinessUnitId = await User.findOne(
        { _id: req.user._id },
        { _id: 0, planBussinessUnitId: 1 },
      );
      //  const planBussinessUnitIdArr = planBussinessUnitId.planBussinessUnitId;
      const planBussinessUnitIdArr = [];
      planBussinessUnitId.planBussinessUnitId.map((planBu) => {
        planBussinessUnitIdArr.push(planBu.toString());
      });
      //return res.json({s:'a'})
      if (bodyData) {
        //const shiftId = await this.createShift(bodyData.shift);
        const csvLength = bodyData.shiftDetails.length;
        bodyData.shift.weekRangeStartsAt = moment(
          bodyData.shift.weekRangeStartsAt,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
        bodyData.shift.weekRangeEndsAt = moment(
          bodyData.shift.weekRangeEndsAt,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
        const timeFormat = bodyData.shift.timeFormat;
        delete bodyData.shift.timeFormat;
        const failedShift = [];
        const createdShift = [];
        const reportLocation = [];
        bodyData.shift.plannedBy = req.user._id;
        req.body.data = {};
        req.body.data = bodyData.shift;
        //console.log('bodyData.shift', bodyData.shift)
        // for(let i =0; i< csvLength; i++ ){
        //     bodyData.shiftDetails[i]= {...bodyData.shift, ...bodyData.shiftDetails[i]}
        // }
        let asyncIndex = 0;
        //console.log('b');
        await async.eachSeries(bodyData.shiftDetails, (item, next) => {
          console.log('a', asyncIndex);
          bodyData.shiftDetails[asyncIndex] = { ...bodyData.shift, ...item };
          item.startTime = this.getDateInUTCFormat(
            item.StartDate,
            item.StartTime,
            timeFormat,
          );
          item.endTime = this.getDateInUTCFormat(
            item.EndDate,
            item.EndTime,
            timeFormat,
          );
          // if(item.isSplitShift){
          //     item.splitstartTime = this.getDateInUTCFormat(item.StartDate, item.splitStartTime, timeFormat);
          //     item.splitendTime = this.getDateInUTCFormat(item.EndDate, item.splitEndTime, timeFormat);
          // }
          // asyncIndex++;
          // next();
          // console.log('reportLocation',reportLocation);
          // console.log('failedShift', failedShift)
          User.findOne(
            { staffId: item.staffId, companyId: req.user.companyId },
            {
              _id: 1,
              appointmentId: 1,
              role: 1,
              subSkillSets: 1,
              parentBussinessUnitId: 1,
              schemeId: 1,
              name: 1,
            },
          )
            .populate([
              {
                path: 'schemeId',
                select: 'shiftSchemeType shiftSetup',
              },
            ])
            .then((userInfo) => {
              //console.log('gg')
              if (userInfo) {
                //console.log(userInfo);
                if (
                  userInfo.schemeId &&
                  (userInfo.schemeId.shiftSchemeType == 2 ||
                    userInfo.schemeId.shiftSchemeType == 3)
                ) {
                  bodyData.shiftDetails[asyncIndex].shiftScheme =
                    userInfo.schemeId;
                  bodyData.shiftDetails[asyncIndex].staff_id = userInfo._id;
                  bodyData.shiftDetails[asyncIndex].name = userInfo.name;
                  bodyData.shiftDetails[asyncIndex].staffAppointmentId =
                    userInfo.appointmentId;
                  bodyData.shiftDetails[asyncIndex].staffRoleId = userInfo.role;
                  bodyData.shiftDetails[asyncIndex].subSkillSets =
                    item.subSkillSets;
                  bodyData.shiftDetails[asyncIndex].confirmedStaffs = [];
                  bodyData.shiftDetails[asyncIndex].confirmedStaffs[0] =
                    userInfo._id;
                  bodyData.shiftDetails[asyncIndex].startTime =
                    this.getDateInUTCFormat(
                      item.StartDate,
                      item.StartTime,
                      timeFormat,
                    );
                  bodyData.shiftDetails[asyncIndex].endTime =
                    this.getDateInUTCFormat(
                      item.EndDate,
                      item.EndTime,
                      timeFormat,
                    );
                  // console.log('bodyData.shiftDetails[asyncIndex].endTime', bodyData.shiftDetails[asyncIndex].endTime, moment(new Date(bodyData.shiftDetails[asyncIndex].endTime), 'MM-DD-YYYY HH:mm:ss Z').utc().unix());
                  bodyData.shiftDetails[asyncIndex].startTimeInSeconds = moment(
                    new Date(bodyData.shiftDetails[asyncIndex].startTime),
                    'MM-DD-YYYY HH:mm:ss Z',
                  )
                    .utc()
                    .unix(); // new Date(bodyData.shiftDetails[asyncIndex].startTime).getTime();
                  bodyData.shiftDetails[asyncIndex].endTimeInSeconds = moment(
                    new Date(bodyData.shiftDetails[asyncIndex].endTime),
                    'MM-DD-YYYY HH:mm:ss Z',
                  )
                    .utc()
                    .unix(); //new Date(bodyData.shiftDetails[asyncIndex].endTime).getTime();
                  var startSecond = new Date(
                    bodyData.shiftDetails[asyncIndex].startTime,
                  ).getTime();
                  var endSecond = new Date(
                    bodyData.shiftDetails[asyncIndex].endTime,
                  ).getTime();
                  bodyData.shiftDetails[asyncIndex].duration =
                    (endSecond - startSecond) / 3600000;
                  if (item.isSplitShift) {
                    console.log('item.splitEndTime', item.splitEndTime);
                    bodyData.shiftDetails[asyncIndex].splitStartTime =
                      this.getDateInUTCFormat(
                        item.StartDate,
                        item.splitStartTime,
                        timeFormat,
                      );
                    bodyData.shiftDetails[asyncIndex].splitEndTime =
                      this.getDateInUTCFormat(
                        item.EndDate,
                        item.splitEndTime,
                        timeFormat,
                      );
                    console.log(
                      'bodyData.shiftDetails[asyncIndex].splitStartTime',
                      bodyData.shiftDetails[asyncIndex].splitStartTime,
                    );
                    console.log(
                      'enndd',
                      bodyData.shiftDetails[asyncIndex].splitEndTime,
                    );
                    bodyData.shiftDetails[asyncIndex].splitStartTimeInSeconds =
                      moment(
                        new Date(
                          bodyData.shiftDetails[asyncIndex].splitStartTime,
                        ),
                        'MM-DD-YYYY HH:mm:ss Z',
                      )
                        .utc()
                        .unix(); // new Date(bodyData.shiftDetails[asyncIndex].startTime).getTime();
                    bodyData.shiftDetails[asyncIndex].splitEndTimeInSeconds =
                      moment(
                        new Date(
                          bodyData.shiftDetails[asyncIndex].splitEndTime,
                        ),
                        'MM-DD-YYYY HH:mm:ss Z',
                      )
                        .utc()
                        .unix(); //new Date(bodyData.shiftDetails[asyncIndex].endTime).getTime();
                    var startSecondSplit = new Date(
                      bodyData.shiftDetails[asyncIndex].splitStartTime,
                    ).getTime();
                    var endSecondSplit = new Date(
                      bodyData.shiftDetails[asyncIndex].splitEndTime,
                    ).getTime();
                    bodyData.shiftDetails[asyncIndex].duration +=
                      (endSecondSplit - startSecondSplit) / 3600000;
                  }
                  let dateSplit = item.Date.split('-');
                  item.Date =
                    dateSplit[1] + '-' + dateSplit[0] + '-' + dateSplit[2];
                  const twoMonth =
                    dateSplit[1].length == 2
                      ? dateSplit[1]
                      : '0' + dateSplit[1];
                  const twoDate =
                    dateSplit[0].length == 2
                      ? dateSplit[0]
                      : '0' + dateSplit[0];
                  bodyData.shiftDetails[asyncIndex].day =
                    dateSplit[2] + '-' + twoMonth + '-' + twoDate;
                  bodyData.shiftDetails[asyncIndex].date = moment(
                    item.Date,
                    'MM-DD-YYYY HH:mm:ss Z',
                  )
                    .utc()
                    .format();
                  bodyData.shiftDetails[asyncIndex].weekNumber =
                    __.weekNoStartWithMonday(bodyData.shift.weekRangeStartsAt); //moment(bodyData.shiftDetails[asyncIndex].date).format('ww');
                  //bodyData.shiftDetails[asyncIndex].confirmedStaffs = userInfo._id;
                  //await ReportingLocation.findOne({name: `/${item.reportLocationName}/i`}).lean();
                  //console.log('/item.reportLocationName/i','/'+item.reportLocationName+'/i');
                  const locationFind = reportLocation.find((locationItem) => {
                    return (
                      locationItem.name.toLowerCase() ===
                      item.reportLocationName.toLowerCase()
                    );
                  });
                  if (locationFind) {
                    bodyData.shiftDetails[asyncIndex].reportLocationId =
                      locationFind._id;
                    asyncIndex++;
                    if (asyncIndex === csvLength) {
                      this.sendResponse(
                        bodyData.shiftDetails,
                        res,
                        failedShift,
                        req,
                        0,
                      );
                    }
                    next();
                  } else {
                    ReportingLocation.findOne(
                      {
                        name: {
                          $regex: new RegExp(
                            `^${item.reportLocationName}$`,
                            'i',
                          ),
                        },
                        status: 1,
                      },
                      { name: 1, _id: 1 },
                    )
                      .then((location) => {
                        if (location) {
                          //  console.log('locationfound');
                          reportLocation.push(location);
                          bodyData.shiftDetails[asyncIndex].reportLocationId =
                            location._id;
                          asyncIndex++;
                          if (asyncIndex === csvLength) {
                            this.sendResponse(
                              bodyData.shiftDetails,
                              res,
                              failedShift,
                              req,
                              0,
                            );
                          }
                          next();
                        } else {
                          //  console.log('locationfoundnot');
                          const createLocation = {
                            name: item.reportLocationName,
                            companyId: '5a9d162b36ab4f444b4271c8',
                            status: 1,
                          };
                          new ReportingLocation(createLocation)
                            .save()
                            .then((locationCreate) => {
                              console.log('locationfoundinsert');
                              reportLocation.push(locationCreate);
                              bodyData.shiftDetails[
                                asyncIndex
                              ].reportLocationId = locationCreate._id;
                              asyncIndex++;
                              if (asyncIndex === csvLength) {
                                this.sendResponse(
                                  bodyData.shiftDetails,
                                  res,
                                  failedShift,
                                  req,
                                  0,
                                );
                              }
                              next();
                            })
                            .catch((errlocation) => {
                              console.log('errlocation', errlocation);
                              item.faildMessage = 'Location create Error';
                              item.status = 0;
                              item.name = userInfo.name;
                              failedShift.push(item);
                              bodyData.shiftDetails[asyncIndex] = null;
                              // bodyData.shiftDetails.splice(asyncIndex, 1);
                              asyncIndex++;
                              if (asyncIndex === csvLength) {
                                this.sendResponse(
                                  bodyData.shiftDetails,
                                  res,
                                  failedShift,
                                  req,
                                  0,
                                );
                              }
                              next();
                            });
                        }
                      })
                      .catch((er) => {
                        console.log('er', er);
                        // bodyData.shiftDetails.splice(asyncIndex, 1);
                        bodyData.shiftDetails[asyncIndex] = null;
                        asyncIndex++;
                        item.faildMessage = 'Location Error';
                        item.status = 0;
                        item.name = userInfo.name;
                        failedShift.push(item);
                        if (asyncIndex === csvLength) {
                          this.sendResponse(
                            bodyData.shiftDetails,
                            res,
                            failedShift,
                            req,
                            0,
                          );
                        }
                        next();
                      });
                  }
                } else {
                  item.faildMessage = 'User Does not have valid scheme'; //'User Not Belong to Plan Business Unit';
                  item.status = 0;
                  item.name = userInfo.name;
                  failedShift.push(item);
                  // bodyData.shiftDetails.splice(asyncIndex, 1);
                  bodyData.shiftDetails[asyncIndex] = null;
                  asyncIndex++;
                  if (asyncIndex === csvLength) {
                    this.sendResponse(
                      bodyData.shiftDetails,
                      res,
                      failedShift,
                      req,
                      0,
                    );
                  }
                  next();
                }
              } else {
                console.log('usernot');
                item.faildMessage = 'UserNotfound';
                item.status = 0;
                failedShift.push(item);
                // bodyData.shiftDetails.splice(asyncIndex, 1);
                bodyData.shiftDetails[asyncIndex] = null;
                asyncIndex++;
                if (asyncIndex === csvLength) {
                  this.sendResponse(
                    bodyData.shiftDetails,
                    res,
                    failedShift,
                    req,
                    0,
                  );
                }
                next();
              }
            })
            .catch((err) => {
              console.log('err', err);
              item.faildMessage = 'Error';
              item.status = 0;
              failedShift.push(item);
              //bodyData.shiftDetails.splice(asyncIndex, 1);
              bodyData.shiftDetails[asyncIndex] = null;
              asyncIndex++;
              if (asyncIndex === csvLength) {
                this.sendResponse(
                  bodyData.shiftDetails,
                  res,
                  failedShift,
                  req,
                  0,
                );
              }
              next();
            });
        });
        //console.log('c');
      } else {
        res.json({ status: false, code: 1, message: 'Something went wrong' });
      }
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  async createStaffAsRestOrOff(req, res) {
    try {
      const bodyData = await this.getBodyDataStaff(res, req);
      //  return res.json({bodyData})
      console.log('here');
      //console.log('req.body', req.body);
      //  const bodyData = [];
      const planBussinessUnitId = await User.findOne(
        { _id: req.user._id },
        { _id: 0, planBussinessUnitId: 1 },
      );
      //  const planBussinessUnitIdArr = planBussinessUnitId.planBussinessUnitId;
      const planBussinessUnitIdArr = [];
      planBussinessUnitId.planBussinessUnitId.map((planBu) => {
        planBussinessUnitIdArr.push(planBu.toString());
      });
      //return res.json({s:'a'})
      if (bodyData) {
        //const shiftId = await this.createShift(bodyData.shift);
        const csvLength = bodyData.shiftDetails.length;
        bodyData.shift.weekRangeStartsAt = moment(
          bodyData.shift.weekRangeStartsAt,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
        bodyData.shift.weekRangeEndsAt = moment(
          bodyData.shift.weekRangeEndsAt,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
        const timeFormat = bodyData.shift.timeFormat;
        delete bodyData.shift.timeFormat;
        const failedShift = [];
        const createdShift = [];
        const reportLocation = [];
        bodyData.shift.plannedBy = req.user._id;
        req.body.data = {};
        req.body.data = bodyData.shift;
        //console.log('bodyData.shift', bodyData.shift)
        // for(let i =0; i< csvLength; i++ ){
        //     bodyData.shiftDetails[i]= {...bodyData.shift, ...bodyData.shiftDetails[i]}
        // }
        let asyncIndex = 0;
        //console.log('b');
        await async.eachSeries(bodyData.shiftDetails, (item, next) => {
          console.log('a', asyncIndex);
          bodyData.shiftDetails[asyncIndex] = { ...bodyData.shift, ...item };
          // as start
          //   item.startTime = this.getDateInUTCFormat(item.StartDate, item.StartTime, timeFormat);
          //   item.endTime = this.getDateInUTCFormat(item.EndDate, item.EndTime, timeFormat);
          // as end
          // asyncIndex++;
          // next();
          // console.log('reportLocation',reportLocation);
          // console.log('failedShift', failedShift)
          User.findOne(
            { staffId: item.staffId, companyId: req.user.companyId },
            {
              _id: 1,
              appointmentId: 1,
              role: 1,
              subSkillSets: 1,
              parentBussinessUnitId: 1,
              schemeId: 1,
              name: 1,
            },
          )
            .populate([
              {
                path: 'schemeId',
                select: 'shiftSchemeType shiftSetup',
              },
            ])
            .then((userInfo) => {
              //console.log('gg')
              if (userInfo) {
                //console.log(userInfo);
                if (
                  userInfo.schemeId &&
                  (userInfo.schemeId.shiftSchemeType == 2 ||
                    userInfo.schemeId.shiftSchemeType == 3)
                ) {
                  bodyData.shiftDetails[asyncIndex].shiftScheme =
                    userInfo.schemeId;
                  bodyData.shiftDetails[asyncIndex].staff_id = userInfo._id;
                  bodyData.shiftDetails[asyncIndex].name = userInfo.name;
                  bodyData.shiftDetails[asyncIndex].staffAppointmentId =
                    userInfo.appointmentId;
                  bodyData.shiftDetails[asyncIndex].staffRoleId = userInfo.role;
                  bodyData.shiftDetails[asyncIndex].subSkillSets =
                    userInfo.subSkillSets;
                  bodyData.shiftDetails[asyncIndex].confirmedStaffs = [];
                  bodyData.shiftDetails[asyncIndex].confirmedStaffs[0] =
                    userInfo._id;
                  bodyData.shiftDetails[asyncIndex].startTime = null; //this.getDateInUTCFormat(item.StartDate, item.StartTime, timeFormat);
                  bodyData.shiftDetails[asyncIndex].endTime = null; //this.getDateInUTCFormat(item.EndDate, item.EndTime, timeFormat);
                  // console.log('bodyData.shiftDetails[asyncIndex].endTime', bodyData.shiftDetails[asyncIndex].endTime, moment(new Date(bodyData.shiftDetails[asyncIndex].endTime), 'MM-DD-YYYY HH:mm:ss Z').utc().unix());
                  bodyData.shiftDetails[asyncIndex].startTimeInSeconds = null; //moment(new Date(bodyData.shiftDetails[asyncIndex].startTime), 'MM-DD-YYYY HH:mm:ss Z').utc().unix();// new Date(bodyData.shiftDetails[asyncIndex].startTime).getTime();
                  bodyData.shiftDetails[asyncIndex].endTimeInSeconds = null; //moment(new Date(bodyData.shiftDetails[asyncIndex].endTime), 'MM-DD-YYYY HH:mm:ss Z').utc().unix();//new Date(bodyData.shiftDetails[asyncIndex].endTime).getTime();
                  let dateSplit = item.Date.split('-');
                  item.Date =
                    dateSplit[1] + '-' + dateSplit[0] + '-' + dateSplit[2];
                  bodyData.shiftDetails[asyncIndex].day =
                    dateSplit[2] + '-' + dateSplit[1] + '-' + dateSplit[0];
                  bodyData.shiftDetails[asyncIndex].date = moment(
                    item.Date,
                    'MM-DD-YYYY HH:mm:ss Z',
                  )
                    .utc()
                    .format();
                  bodyData.shiftDetails[asyncIndex].weekNumber =
                    __.weekNoStartWithMonday(bodyData.shift.weekRangeStartsAt); //moment(bodyData.shiftDetails[asyncIndex].date).format('ww');
                  // as start
                  //   var startSecond = new Date(bodyData.shiftDetails[asyncIndex].startTime).getTime();
                  //   var endSecond = new Date(bodyData.shiftDetails[asyncIndex].endTime).getTime()
                  // as end
                  bodyData.shiftDetails[asyncIndex].duration = 0;
                  //bodyData.shiftDetails[asyncIndex].confirmedStaffs = userInfo._id;
                  //await ReportingLocation.findOne({name: `/${item.reportLocationName}/i`}).lean();
                  //console.log('/item.reportLocationName/i','/'+item.reportLocationName+'/i');
                  const locationFind = reportLocation.find((locationItem) => {
                    return (
                      locationItem.name.toLowerCase() ===
                      item.reportLocationName.toLowerCase()
                    );
                  });
                  if (locationFind) {
                    bodyData.shiftDetails[asyncIndex].reportLocationId =
                      locationFind._id;
                    asyncIndex++;
                    if (asyncIndex === csvLength) {
                      this.sendResponseAsRestOrOff(
                        bodyData.shiftDetails,
                        res,
                        failedShift,
                        req,
                        0,
                      );
                    }
                    next();
                  } else {
                    ReportingLocation.findOne(
                      {
                        name: {
                          $regex: new RegExp(
                            `^${item.reportLocationName}$`,
                            'i',
                          ),
                        },
                        status: 1,
                      },
                      { name: 1, _id: 1 },
                    )
                      .then((location) => {
                        if (location) {
                          //  console.log('locationfound');
                          reportLocation.push(location);
                          bodyData.shiftDetails[asyncIndex].reportLocationId =
                            location._id;
                          asyncIndex++;
                          if (asyncIndex === csvLength) {
                            this.sendResponseAsRestOrOff(
                              bodyData.shiftDetails,
                              res,
                              failedShift,
                              req,
                              0,
                            );
                          }
                          next();
                        } else {
                          //  console.log('locationfoundnot');
                          const createLocation = {
                            name: item.reportLocationName,
                            companyId: '5a9d162b36ab4f444b4271c8',
                            status: 1,
                          };
                          new ReportingLocation(createLocation)
                            .save()
                            .then((locationCreate) => {
                              console.log('locationfoundinsert');
                              reportLocation.push(locationCreate);
                              bodyData.shiftDetails[
                                asyncIndex
                              ].reportLocationId = locationCreate._id;
                              asyncIndex++;
                              if (asyncIndex === csvLength) {
                                this.sendResponseAsRestOrOff(
                                  bodyData.shiftDetails,
                                  res,
                                  failedShift,
                                  req,
                                  0,
                                );
                              }
                              next();
                            })
                            .catch((errlocation) => {
                              console.log('errlocation', errlocation);
                              item.faildMessage = 'Location create Error';
                              item.status = 0;
                              item.name = userInfo.name;
                              failedShift.push(item);
                              bodyData.shiftDetails[asyncIndex] = null;
                              // bodyData.shiftDetails.splice(asyncIndex, 1);
                              asyncIndex++;
                              if (asyncIndex === csvLength) {
                                this.sendResponseAsRestOrOff(
                                  bodyData.shiftDetails,
                                  res,
                                  failedShift,
                                  req,
                                  0,
                                );
                              }
                              next();
                            });
                        }
                      })
                      .catch((er) => {
                        console.log('er', er);
                        // bodyData.shiftDetails.splice(asyncIndex, 1);
                        bodyData.shiftDetails[asyncIndex] = null;
                        asyncIndex++;
                        item.faildMessage = 'Location Error';
                        item.status = 0;
                        item.name = userInfo.name;
                        failedShift.push(item);
                        if (asyncIndex === csvLength) {
                          this.sendResponseAsRestOrOff(
                            bodyData.shiftDetails,
                            res,
                            failedShift,
                            req,
                            0,
                          );
                        }
                        next();
                      });
                  }
                } else {
                  item.faildMessage = 'User Does not have valid scheme'; //'User Not Belong to Plan Business Unit';
                  item.status = 0;
                  item.name = userInfo.name;
                  failedShift.push(item);
                  // bodyData.shiftDetails.splice(asyncIndex, 1);
                  bodyData.shiftDetails[asyncIndex] = null;
                  asyncIndex++;
                  if (asyncIndex === csvLength) {
                    this.sendResponseAsRestOrOff(
                      bodyData.shiftDetails,
                      res,
                      failedShift,
                      req,
                      0,
                    );
                  }
                  next();
                }
              } else {
                console.log('usernot');
                item.faildMessage = 'UserNotfound';
                item.status = 0;
                failedShift.push(item);
                // bodyData.shiftDetails.splice(asyncIndex, 1);
                bodyData.shiftDetails[asyncIndex] = null;
                asyncIndex++;
                if (asyncIndex === csvLength) {
                  this.sendResponseAsRestOrOff(
                    bodyData.shiftDetails,
                    res,
                    failedShift,
                    req,
                    0,
                  );
                }
                next();
              }
            })
            .catch((err) => {
              console.log('err', err);
              item.faildMessage = 'Error';
              item.status = 0;
              failedShift.push(item);
              //bodyData.shiftDetails.splice(asyncIndex, 1);
              bodyData.shiftDetails[asyncIndex] = null;
              asyncIndex++;
              if (asyncIndex === csvLength) {
                this.sendResponseAsRestOrOff(
                  bodyData.shiftDetails,
                  res,
                  failedShift,
                  req,
                  0,
                );
              }
              next();
            });
        });
        //console.log('c');
      } else {
        res.json({ status: false, code: 1, message: 'Something went wrong' });
      }
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  getDateInUTCFormat(date, time, timeZone) {
    let dateSplit = date.split('-');
    date = dateSplit[1] + '-' + dateSplit[0] + '-' + dateSplit[2];
    const dateTime = `${date} ${time} ${timeZone}`;
    console.log('datetime', dateTime);
    return moment(dateTime, 'MM-DD-YYYY HH:mm:ss Z').utc().format();
  }
  async insertSendResponse(res, item) {
    try {
      let validShift = [];
      let failedShift = [];
      let isLimitExceed = false;
      let isAlert = false;
      let redisBuId;
      let mondayDate;
      let redisTimeZone;
      let assignShiftIdArr = [];
      return new Promise(async (resolve, reject) => {
        if (item && item.staffId) {
          // ignore failed shift
          console.log(item.date);
          item.isLimit = false;
          item.isAlert = false;
          const weekStart = __.weekNoStartWithMonday(item.weekRangeStartsAt);
          const weekDate = __.weekNoStartWithMonday(item.date);
          const weekEnd = __.weekNoStartWithMonday(item.weekRangeEndsAt);
          if (
            weekStart == weekDate ||
            weekDate == weekEnd ||
            (new Date(item.weekRangeStartsAt).getTime() <=
              new Date(item.date).getTime() &&
              new Date(item.weekRangeEndsAt).getTime() >=
              new Date(item.date).getTime())
          ) {
            const shiftResult = await AssignShift.find({
              staff_id: item.staff_id,
              date: item.date,
              isEmpty: false,
            });
            const shiftDetailsF = await ShiftDetails.find({
              $or: [
                { confirmedStaffs: item.staff_id },
                { backUpStaffs: item.staff_id },
              ],
              date: item.date,
            });
            var dttt = new Date(item.date); //moment(new Date(item.date),'MM-DD-YYYY HH:mm:ss Z').utc(item.timeZone).format();       // moment(item.date).utc(item.timeZone).format();
            var dtNew = moment(item.date).utcOffset(-330).format();
            const yearDt = parseInt(
              moment(item.date).utcOffset(-330).format('YYYY'),
            );
            const monthDt = parseInt(
              moment(item.date).utcOffset(-330).format('MM'),
            );
            const dayDt = parseInt(
              moment(item.date).utcOffset(-330).format('DD'),
            );
            const whereDt = {
              //  staff_id:{$in: usersOfBu},
              staff_id: item.staff_id,
              isEmpty: true,
              $and: [
                { $expr: { $eq: [{ $year: '$date' }, yearDt] } },
                { $expr: { $eq: [{ $month: '$date' }, monthDt] } },
                { $expr: { $eq: [{ $dayOfMonth: '$date' }, dayDt] } },
              ],
            };
            AssignShift.deleteMany(whereDt).then((de) => {
              console.log('deeeeeeeee', de.result.n);
            });
            if (
              (shiftResult && shiftResult.length > 0) ||
              (shiftDetailsF && shiftDetailsF.length > 0)
            ) {
              const shiftAlreadyPresent = shiftResult.filter((shiftAl) => {
                return (
                  new Date(shiftAl.startTime).getTime() ===
                  new Date(item.startTime).getTime() &&
                  new Date(shiftAl.endTime).getTime() ===
                  new Date(item.endTime).getTime()
                );
              });
              const shiftAlreadyPresentDetails = shiftDetailsF.filter(
                (shiftAl) => {
                  return (
                    new Date(shiftAl.startTime).getTime() ===
                    new Date(item.startTime).getTime() &&
                    new Date(shiftAl.endTime).getTime() ===
                    new Date(item.endTime).getTime()
                  );
                },
              );
              if (
                (shiftAlreadyPresent && shiftAlreadyPresent.length > 0) ||
                (shiftAlreadyPresentDetails &&
                  shiftAlreadyPresentDetails.length > 0)
              ) {
                item.faildMessage = 'Shift Already Present';
                item.status = 0;
                failedShift.push(item);
              }
              let shiftOverlapping = [];
              let shiftOverlappingDetails = [];
              if (
                shiftAlreadyPresent.length === 0 &&
                shiftAlreadyPresentDetails.length == 0
              ) {
                shiftOverlapping = shiftResult.filter((shiftOverl) => {
                  return (
                    (new Date(shiftOverl.startTime).getTime() <=
                      new Date(item.startTime).getTime() &&
                      new Date(shiftOverl.endTime).getTime() >=
                      new Date(item.startTime).getTime()) ||
                    (new Date(shiftOverl.startTime).getTime() <=
                      new Date(item.endTime).getTime() &&
                      new Date(shiftOverl.endTime).getTime() >=
                      new Date(item.endTime).getTime())
                  );
                });
                shiftOverlappingDetails = shiftDetailsF.filter((shiftOverl) => {
                  return (
                    (new Date(shiftOverl.startTime).getTime() <=
                      new Date(item.startTime).getTime() &&
                      new Date(shiftOverl.endTime).getTime() >=
                      new Date(item.startTime).getTime()) ||
                    (new Date(shiftOverl.startTime).getTime() <=
                      new Date(item.endTime).getTime() &&
                      new Date(shiftOverl.endTime).getTime() >=
                      new Date(item.endTime).getTime())
                  );
                });
                // console.log('overlap');
                if (
                  (shiftOverlapping && shiftOverlapping.length > 0) ||
                  (shiftOverlappingDetails &&
                    shiftOverlappingDetails.length > 0)
                ) {
                  item.faildMessage = 'Shift is Overlapping';
                  item.status = 0;
                  failedShift.push(item);
                }
              }
              if (
                shiftOverlapping.length === 0 &&
                shiftAlreadyPresent.length === 0 &&
                shiftAlreadyPresentDetails.length === 0
              ) {
                const isLimit = await this.checkLimit(res, item);
                console.log('isLimit', isLimit);
                let isSave = true;
                if (isLimit.limit) {
                  isLimitExceed = true;
                  item.isAllowPublish = false;
                  item.alertMessage = isLimit.message;
                  item.isLimit = true;
                  item.schemeDetails = isLimit.details;
                  item.isAlert = false;
                  if (isLimit.status) {
                    isSave = true;
                    item.isAlert = true;
                  }
                }
                if (isSave) {
                  delete item.shiftScheme;
                  item.isMobile = isMobile;
                  const saveShift = await new AssignShift(item).save();
                  redisBuId = saveShift.businessUnitId;
                  mondayDate = this.getMondayDate(saveShift.weekRangeStartsAt);
                  redisTimeZone = saveShift.timeZone
                    ? saveShift.timeZone
                    : 'GMT+0800';

                  isLimit.staffLimitData.assignShiftId = saveShift._id;
                  new StaffLimit(isLimit.staffLimitData).save();
                  assignShiftIdArr.push(saveShift._id);
                  validShift.push(item);
                } else {
                  // limit don't save
                  item.faildMessage =
                    'Staff timing limit is crossing for a ' + isLimit.flag;
                  item.status = 0;
                  failedShift.push(item);
                }
              }
            } else {
              const isLimit = await this.checkLimit(res, item);
              let isSave = true;
              if (isLimit.limit) {
                isLimitExceed = true;
                item.isAllowPublish = false;
                item.alertMessage = isLimit.message;
                item.isLimit = true;
                item.schemeDetails = isLimit.details;
                item.isAlert = false;
                if (isLimit.status) {
                  isSave = true;
                  item.isAlert = true;
                }
              }
              if (isSave) {
                delete item.shiftScheme;
                const saveShift = await new AssignShift(item).save();
                redisBuId = saveShift.businessUnitId;
                mondayDate = this.getMondayDate(saveShift.weekRangeStartsAt);
                redisTimeZone = saveShift.timeZone
                  ? saveShift.timeZone
                  : 'GMT+0800';

                isLimit.staffLimitData.assignShiftId = saveShift._id;
                assignShiftIdArr.push(saveShift._id);
                new StaffLimit(isLimit.staffLimitData).save();
                item.status = 1;
                validShift.push(item);
              } else {
                // limit don't save
                item.faildMessage =
                  'Staff timing limit is crossing for a ' + isLimit.flag;
                item.status = 0;
                failedShift.push(item);
              }
            }
          } else {
            item.faildMessage = 'Shift is not between the week';
            item.status = 0;
            failedShift.push(item);
          }
        }
        resolve({
          redis: { redisBuId, mondayDate, redisTimeZone },
          failedShift,
          validShift,
        });
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  async sendResponse(bodyData, res, failedShift, req, from = 1) {
    //return res.json(bodyData)
    // console.log('###########', bodyData);
    let isFailed = false;
    let isLimitExceed = false;
    let isAlert = false;
    let redisBuId;
    let mondayDate;
    let redisTimeZone;
    bodyData = bodyData.filter((stf) => stf && stf.staffId);
    // return res.json(bodyData)
    let isMobile = req.body.shift.isMobile;
    const assignShiftIdArr = [];
    try {
      const totalShift = bodyData.length;
      let i = 0;
      const validShift = [];
      // let redisBuId = bodyData[0].selectedBuID;
      async.eachSeries(bodyData, async (item, next) => {
        i++;
        isLimitExceed = false;
        isAlert = false;
        if (item && item.staffId) {
          // ignore failed shift
          console.log('item.weekRangeStartsAt', item.weekRangeStartsAt);
          console.log(item.date);
          item.isLimit = false;
          item.isAlert = false;
          console.log(item.weekRangeEndsAt);
          console.log(
            '#######',
            __.weekNoStartWithMonday(item.date),
            __.weekNoStartWithMonday(item.weekRangeStartsAt),
            __.weekNoStartWithMonday(item.weekRangeEndsAt),
          );
          const weekStart = __.weekNoStartWithMonday(item.weekRangeStartsAt);
          const weekDate = __.weekNoStartWithMonday(item.date);
          const weekEnd = __.weekNoStartWithMonday(item.weekRangeEndsAt);
          if (
            weekStart == weekDate ||
            weekDate == weekEnd ||
            (new Date(item.weekRangeStartsAt).getTime() <=
              new Date(item.date).getTime() &&
              new Date(item.weekRangeEndsAt).getTime() >=
              new Date(item.date).getTime())
          ) {
            console.log('hereeee');
            AssignShift.find({
              staff_id: item.staff_id,
              date: item.date,
              isEmpty: false,
            })
              .then(async (shiftResult) => {
                //console.log('shiftResult', shiftResult.length)
                console.log('*************************************' + i);
                console.log(
                  'item.staffId',
                  item.date,
                  item.staffId,
                  moment(item.date).utcOffset(-330).format(),
                  item.day,
                );
                var dttt = new Date(item.date); //moment(new Date(item.date),'MM-DD-YYYY HH:mm:ss Z').utc(item.timeZone).format();       // moment(item.date).utc(item.timeZone).format();
                console.log('dttt', dttt);
                var dtNew = moment(item.date).utcOffset(-330).format();
                const yearDt = parseInt(
                  moment(item.date).utcOffset(-330).format('YYYY'),
                );
                const monthDt = parseInt(
                  moment(item.date).utcOffset(-330).format('MM'),
                );
                const dayDt = parseInt(
                  moment(item.date).utcOffset(-330).format('DD'),
                );
                console.log('yearDt', typeof yearDt, monthDt, dayDt);
                const whereDt = {
                  //  staff_id:{$in: usersOfBu},
                  staff_id: item.staff_id,
                  isEmpty: true,
                  $and: [
                    { $expr: { $eq: [{ $year: '$date' }, yearDt] } },
                    { $expr: { $eq: [{ $month: '$date' }, monthDt] } },
                    { $expr: { $eq: [{ $dayOfMonth: '$date' }, dayDt] } },
                  ],
                };
                AssignShift.deleteMany(whereDt).then((de) => {
                  console.log('deeeeeeeee', de.result.n);
                });
                if (shiftResult && shiftResult.length > 0) {
                  const shiftAlreadyPresent = shiftResult.filter((shiftAl) => {
                    return (
                      new Date(shiftAl.startTime).getTime() ===
                      new Date(item.startTime).getTime() &&
                      new Date(shiftAl.endTime).getTime() ===
                      new Date(item.endTime).getTime()
                    );
                  });
                  //console.log('filter');
                  if (shiftAlreadyPresent && shiftAlreadyPresent.length > 0) {
                    item.faildMessage = 'Shift Already Present';
                    item.status = 0;
                    failedShift.push(item);
                  }
                  let shiftOverlapping = [];
                  if (shiftAlreadyPresent.length === 0) {
                    shiftOverlapping = shiftResult.filter((shiftOverl) => {
                      return (
                        (new Date(shiftOverl.startTime).getTime() <=
                          new Date(item.startTime).getTime() &&
                          new Date(shiftOverl.endTime).getTime() >=
                          new Date(item.startTime).getTime()) ||
                        (new Date(shiftOverl.startTime).getTime() <=
                          new Date(item.endTime).getTime() &&
                          new Date(shiftOverl.endTime).getTime() >=
                          new Date(item.endTime).getTime())
                      );
                    });
                    // console.log('overlap');
                    if (shiftOverlapping && shiftOverlapping.length > 0) {
                      item.faildMessage = 'Shift is Overlapping';
                      item.status = 0;
                      failedShift.push(item);
                    }
                  }
                  console.log(
                    'shiftOverlapping.length',
                    shiftOverlapping.length,
                    shiftAlreadyPresent.length,
                  );
                  if (
                    shiftOverlapping.length === 0 &&
                    shiftAlreadyPresent.length === 0
                  ) {
                    const isLimit = await this.checkLimit(res, item);
                    console.log('isLimit', isLimit);
                    let isSave = true;
                    if (isLimit.limit) {
                      isLimitExceed = true;
                      item.isAllowPublish = false;
                      item.alertMessage = isLimit.message;
                      item.isLimit = true;
                      item.schemeDetails = isLimit.details;
                      item.isAlert = false;
                      if (isLimit.status) {
                        isSave = true;
                        item.isAlert = true;
                      }
                      // }else{
                      //     isAlert = true;
                      //     item.alertMessage = "Staff timing limit is crossing for a "+isLimit.flag;
                      //     item.isLimit = true;
                      //     item.schemeDetails = isLimit.details;
                      // }
                    }
                    console.log('áfteetetetet', item.splitEndTime);
                    if (isSave) {
                      delete item.shiftScheme;
                      item.isMobile = isMobile;
                      new AssignShift(item).save().then(async (saveShift) => {
                        if (i == 1) {
                          redisBuId = saveShift.businessUnitId;
                          mondayDate = this.getMondayDate(
                            saveShift.weekRangeStartsAt,
                          );
                          redisTimeZone = saveShift.timeZone
                            ? saveShift.timeZone
                            : 'GMT+0800';
                        }
                        isLimit.staffLimitData.assignShiftId = saveShift._id;
                        new StaffLimit(isLimit.staffLimitData).save();
                        console.log('staffLimitData', isLimit.staffLimitData);
                        assignShiftIdArr.push(saveShift._id);
                        validShift.push(item);
                        console.log('aaaaaaaaa', i, totalShift);
                        if (i === totalShift) {
                          this.failedShiftInsert(
                            res,
                            failedShift,
                            req,
                            validShift,
                            0,
                          );
                          if (failedShift.length > 0 && !from) {
                            isFailed = true;
                          }
                          // publishshift assignShiftIdArr
                          if (isMobile) {
                            this.publishAllFromMobile(res, assignShiftIdArr);
                          }
                          // const updateResult = await this.updateRedis(
                          //   redisBuId,
                          //   true,
                          //   mondayDate,
                          //   redisTimeZone,
                          // );
                          res.json({
                            isAlert,
                            isLimitExceed,
                            isFailed,
                            status: true,
                            code: 1,
                            message: 'shift draft created successfully',
                          });
                        }
                        next();
                      });
                    } else {
                      // limit don't save
                      item.faildMessage =
                        'Staff timing limit is crossing for a ' + isLimit.flag;
                      item.status = 0;
                      failedShift.push(item);
                      if (i === totalShift) {
                        // const updateResult = await this.updateRedis(
                        //   redisBuId,
                        //   true,
                        //   mondayDate,
                        //   redisTimeZone,
                        // );
                        this.failedShiftInsert(
                          res,
                          failedShift,
                          req,
                          validShift,
                          0,
                        );
                        if (failedShift.length > 0 && !from) {
                          isFailed = true;
                        }
                        // publishshift assignShiftIdArr
                        if (isMobile) {
                          this.publishAllFromMobile(res, assignShiftIdArr);
                        }
                        res.json({
                          isAlert,
                          isLimitExceed,
                          isFailed,
                          status: true,
                          code: 1,
                          message: 'shift draft created successfully',
                        });
                      }
                    }
                  } else {
                    if (i === totalShift) {
                      // const updateResult = await this.updateRedis(
                      //   redisBuId,
                      //   true,
                      //   mondayDate,
                      //   redisTimeZone,
                      // );
                      console.log('hereeeee', validShift.length);
                      this.failedShiftInsert(
                        res,
                        failedShift,
                        req,
                        validShift,
                        0,
                      );
                      if (failedShift.length > 0 && !from) {
                        isFailed = true;
                      }
                      // publishshift assignShiftIdArr
                      if (isMobile) {
                        this.publishAllFromMobile(res, assignShiftIdArr);
                      }
                      res.json({
                        isAlert,
                        isLimitExceed,
                        isFailed,
                        status: true,
                        code: 1,
                        message: 'shift draft created successfully',
                      });
                    }
                    next();
                  }
                } else {
                  const isLimit = await this.checkLimit(res, item);
                  console.log('else limit', isLimit);
                  let isSave = true;
                  if (isLimit.limit) {
                    isLimitExceed = true;
                    item.isAllowPublish = false;
                    item.alertMessage = isLimit.message;
                    item.isLimit = true;
                    item.schemeDetails = isLimit.details;
                    item.isAlert = false;
                    if (isLimit.status) {
                      isSave = true;
                      item.isAlert = true;
                    }
                    // if(!isLimit.status){
                    //     isSave = false;
                    // }else{
                    //     isAlert = true;
                    //     item.alertMessage = "Staff timing limit is crossing for a "+isLimit.flag;
                    //     item.isLimit = true;
                    //     item.schemeDetails = isLimit.details;
                    // }
                  }
                  if (isSave) {
                    console.log(
                      'áfteetetetessssssssssst',
                      item.splitStartTime,
                      item.splitEndTime,
                    );
                    delete item.shiftScheme;
                    new AssignShift(item).save().then(async (saveShift) => {
                      if (i == 1) {
                        redisBuId = saveShift.businessUnitId;
                        mondayDate = this.getMondayDate(
                          saveShift.weekRangeStartsAt,
                        );
                        redisTimeZone = saveShift.timeZone
                          ? saveShift.timeZone
                          : 'GMT+0800';
                      }
                      isLimit.staffLimitData.assignShiftId = saveShift._id;
                      assignShiftIdArr.push(saveShift._id);
                      new StaffLimit(isLimit.staffLimitData).save();
                      console.log('staffLimitData', isLimit.staffLimitData);
                      item.status = 1;
                      console.log('bbbbbbb', i, totalShift);
                      validShift.push(item);
                      if (i === totalShift) {
                        // const updateResult = await this.updateRedis(
                        //   redisBuId,
                        //   true,
                        //   mondayDate,
                        //   redisTimeZone,
                        // );
                        this.failedShiftInsert(
                          res,
                          failedShift,
                          req,
                          validShift,
                          0,
                        );
                        if (failedShift.length > 0 && !from) {
                          isFailed = true;
                        }
                        // publishshift assignShiftIdArr
                        if (isMobile) {
                          this.publishAllFromMobile(res, assignShiftIdArr);
                        }
                        res.json({
                          isAlert,
                          isFailed,
                          isLimitExceed,
                          status: true,
                          code: 1,
                          message: 'shift draft created successfully',
                        });
                        //res.json({status: false, code: 1, message:'Something went wrong'});
                        // res.json({validShift, failedShift});
                      }
                      next();
                    });
                  } else {
                    // limit don't save
                    item.faildMessage =
                      'Staff timing limit is crossing for a ' + isLimit.flag;
                    item.status = 0;
                    failedShift.push(item);
                    if (i === totalShift) {
                      // const updateResult = await this.updateRedis(
                      //   redisBuId,
                      //   true,
                      //   mondayDate,
                      //   redisTimeZone,
                      // );
                      this.failedShiftInsert(
                        res,
                        failedShift,
                        req,
                        validShift,
                        0,
                      );
                      if (failedShift.length > 0 && !from) {
                        isFailed = true;
                      }
                      // publishshift assignShiftIdArr
                      if (isMobile) {
                        this.publishAllFromMobile(res, assignShiftIdArr);
                      }
                      res.json({
                        isAlert,
                        isFailed,
                        isLimitExceed,
                        status: true,
                        code: 1,
                        message: 'shift draft created successfully',
                      });
                    }
                  }
                }
              })
              .catch(async (err) => {
                console.log(err);
                if (i === totalShift) {
                  // const updateResult = await this.updateRedis(
                  //   redisBuId,
                  //   true,
                  //   mondayDate,
                  //   redisTimeZone,
                  // );
                  this.failedShiftInsert(res, failedShift, req, validShift, 0);
                  if (failedShift.length > 0 && !from) {
                    isFailed = true;
                  }
                  // publishshift assignShiftIdArr
                  if (isMobile) {
                    this.publishAllFromMobile(res, assignShiftIdArr);
                  }
                  res.json({
                    isAlert,
                    isFailed,
                    isLimitExceed,
                    status: true,
                    code: 1,
                    message: 'shift draft created successfully',
                  });
                }
                next();
              });
          } else {
            item.faildMessage = 'Shift is not between the week';
            item.status = 0;
            failedShift.push(item);
            if (i === totalShift) {
              // const updateResult = await this.updateRedis(
              //   redisBuId,
              //   true,
              //   mondayDate,
              //   redisTimeZone,
              // );
              if (failedShift.length > 0 && !from) {
                isFailed = true;
              }
              this.failedShiftInsert(res, failedShift, req, validShift, 0);
              // publishshift assignShiftIdArr
              if (isMobile) {
                this.publishAllFromMobile(res, assignShiftIdArr);
              }
              res.json({
                isAlert,
                isFailed,
                isLimitExceed,
                status: true,
                code: 1,
                message: 'shift draft created successfully',
              });
              //res.json({validShift, failedShift});
            }
            next();
          }
        } else {
          if (i === totalShift) {
            // const updateResult = await this.updateRedis(
            //   redisBuId,
            //   true,
            //   mondayDate,
            //   redisTimeZone,
            // );
            this.failedShiftInsert(res, failedShift, req, validShift, 0);
            if (failedShift.length > 0 && !from) {
              isFailed = true;
            }
            // publishshift assignShiftIdArr
            if (isMobile) {
              this.publishAllFromMobile(res, assignShiftIdArr);
            }
            res.json({
              isAlert,
              isFailed,
              isLimitExceed,
              status: true,
              code: 1,
              message: 'shift draft created successfully',
            });
            //res.json({validShift, failedShift});
          }
          next();
          //console.log('nul')
        }
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  async sendResponseAsRestOrOff(bodyData, res, failedShift, req, from = 1) {
    //return res.json(bodyData)
    // console.log('###########', bodyData);
    let isFailed = false;
    let isLimitExceed = false;
    let isAlert = false;
    try {
      const totalShift = bodyData.length;
      let i = 0;
      const validShift = [];
      async.eachSeries(bodyData, (item, next) => {
        i++;
        isLimitExceed = false;
        isAlert = false;
        if (item && item.staffId) {
          // ignore failed shift
          console.log('item.weekRangeStartsAt', item.weekRangeStartsAt);
          console.log(item.date);
          item.isLimit = false;
          item.isAlert = false;
          console.log(item.weekRangeEndsAt);
          console.log(
            '#######',
            __.weekNoStartWithMonday(item.date),
            __.weekNoStartWithMonday(item.weekRangeStartsAt),
            __.weekNoStartWithMonday(item.weekRangeEndsAt),
          );
          const weekStart = __.weekNoStartWithMonday(item.weekRangeStartsAt);
          const weekDate = __.weekNoStartWithMonday(item.date);
          const weekEnd = __.weekNoStartWithMonday(item.weekRangeEndsAt);
          if (
            weekStart == weekDate ||
            weekDate == weekEnd ||
            (new Date(item.weekRangeStartsAt).getTime() <=
              new Date(item.date).getTime() &&
              new Date(item.weekRangeEndsAt).getTime() >=
              new Date(item.date).getTime())
          ) {
            AssignShift.find({ staff_id: item.staff_id, date: item.date })
              .then(async (shiftResult) => {
                //console.log('shiftResult', shiftResult.length)
                if (shiftResult && shiftResult.length > 0) {
                  const shiftAlreadyPresent = shiftResult.filter((shiftAl) => {
                    return (
                      new Date(shiftAl.startTime).getTime() ===
                      new Date(item.startTime).getTime() &&
                      new Date(shiftAl.endTime).getTime() ===
                      new Date(item.endTime).getTime()
                    );
                  });
                  //console.log('filter');
                  if (shiftAlreadyPresent && shiftAlreadyPresent.length > 0) {
                    item.faildMessage = 'Shift Already Present';
                    item.status = 0;
                    failedShift.push(item);
                  }
                  let shiftOverlapping = [];
                  if (shiftAlreadyPresent.length === 0) {
                    shiftOverlapping = shiftResult.filter((shiftOverl) => {
                      return (
                        (new Date(shiftOverl.startTime).getTime() <=
                          new Date(item.startTime).getTime() &&
                          new Date(shiftOverl.endTime).getTime() >=
                          new Date(item.startTime).getTime()) ||
                        (new Date(shiftOverl.startTime).getTime() <=
                          new Date(item.endTime).getTime() &&
                          new Date(shiftOverl.endTime).getTime() >=
                          new Date(item.endTime).getTime())
                      );
                    });
                    // console.log('overlap');
                    if (shiftOverlapping && shiftOverlapping.length > 0) {
                      item.faildMessage = 'Shift is Overlapping';
                      item.status = 0;
                      failedShift.push(item);
                    }
                  }
                  if (
                    shiftOverlapping.length === 0 &&
                    shiftAlreadyPresent.length === 0
                  ) {
                    //const isLimit = await this.checkLimit(item);
                    // console.log('isLimit', isLimit);
                    let isSave = true;
                    console.log('áfteetetetet');
                    if (isSave) {
                      delete item.shiftScheme;
                      new AssignShift(item).save().then((saveShift) => {
                        //isLimit.staffLimitData.assignShiftId = saveShift._id;
                        //new StaffLimit(isLimit.staffLimitData).save();
                        //  console.log('staffLimitData', isLimit.staffLimitData)
                        validShift.push(item);
                        if (i === totalShift) {
                          this.failedShiftInsert(
                            res,
                            failedShift,
                            req,
                            validShift,
                            0,
                          );
                          if (failedShift.length > 0 && !from) {
                            isFailed = true;
                          }
                          res.json({
                            isAlert,
                            isLimitExceed,
                            isFailed,
                            status: true,
                            code: 1,
                            message: 'shift draft created successfully',
                          });
                        }
                        next();
                      });
                    } else {
                      // limit don't save
                      item.faildMessage =
                        'Staff timing limit is crossing for a ' + isLimit.flag;
                      item.status = 0;
                      failedShift.push(item);
                      if (i === totalShift) {
                        this.failedShiftInsert(
                          res,
                          failedShift,
                          req,
                          validShift,
                          0,
                        );
                        if (failedShift.length > 0 && !from) {
                          isFailed = true;
                        }
                        res.json({
                          isAlert,
                          isLimitExceed,
                          isFailed,
                          status: true,
                          code: 1,
                          message: 'shift draft created successfully',
                        });
                      }
                    }
                  } else {
                    if (i === totalShift) {
                      this.failedShiftInsert(
                        res,
                        failedShift,
                        req,
                        validShift,
                        0,
                      );
                      if (failedShift.length > 0 && !from) {
                        isFailed = true;
                      }
                      res.json({
                        isAlert,
                        isLimitExceed,
                        isFailed,
                        status: true,
                        code: 1,
                        message: 'shift draft created successfully',
                      });
                    }
                    next();
                  }
                } else {
                  // const isLimit = await this.checkLimit(item);
                  // console.log('else limit', isLimit);
                  let isSave = true;
                  if (isSave) {
                    console.log('áfteetetetet');
                    delete item.shiftScheme;
                    //item.isMobile = isMobile;
                    new AssignShift(item).save().then((saveShift) => {
                      // isLimit.staffLimitData.assignShiftId = saveShift._id;
                      //new StaffLimit(isLimit.staffLimitData).save();
                      // console.log('staffLimitData', isLimit.staffLimitData)
                      item.status = 1;
                      validShift.push(item);
                      if (i === totalShift) {
                        this.failedShiftInsert(
                          res,
                          failedShift,
                          req,
                          validShift,
                          0,
                        );
                        if (failedShift.length > 0 && !from) {
                          isFailed = true;
                        }
                        res.json({
                          isAlert,
                          isFailed,
                          isLimitExceed,
                          status: true,
                          code: 1,
                          message: 'shift draft created successfully',
                        });
                        //res.json({status: false, code: 1, message:'Something went wrong'});
                        // res.json({validShift, failedShift});
                      }
                      next();
                    });
                  } else {
                    // limit don't save
                    item.faildMessage =
                      'Staff timing limit is crossing for a ' + isLimit.flag;
                    item.status = 0;
                    failedShift.push(item);
                    if (i === totalShift) {
                      this.failedShiftInsert(
                        res,
                        failedShift,
                        req,
                        validShift,
                        0,
                      );
                      if (failedShift.length > 0 && !from) {
                        isFailed = true;
                      }
                      res.json({
                        isAlert,
                        isFailed,
                        isLimitExceed,
                        status: true,
                        code: 1,
                        message: 'shift draft created successfully',
                      });
                    }
                  }
                }
              })
              .catch((err) => {
                console.log(err);
                if (i === totalShift) {
                  this.failedShiftInsert(res, failedShift, req, validShift, 0);
                  if (failedShift.length > 0 && !from) {
                    isFailed = true;
                  }
                  res.json({
                    isAlert,
                    isFailed,
                    isLimitExceed,
                    status: true,
                    code: 1,
                    message: 'shift draft created successfully',
                  });
                }
                next();
              });
          } else {
            item.faildMessage = 'Shift is not between the week';
            item.status = 0;
            failedShift.push(item);
            if (i === totalShift) {
              if (failedShift.length > 0 && !from) {
                isFailed = true;
              }
              this.failedShiftInsert(res, failedShift, req, validShift, 0);
              res.json({
                isAlert,
                isFailed,
                isLimitExceed,
                status: true,
                code: 1,
                message: 'shift draft created successfully',
              });
              //res.json({validShift, failedShift});
            }
            next();
          }
        } else {
          if (i === totalShift) {
            this.failedShiftInsert(res, failedShift, req, validShift, 0);
            if (failedShift.length > 0 && !from) {
              isFailed = true;
            }
            res.json({
              isAlert,
              isFailed,
              isLimitExceed,
              status: true,
              code: 1,
              message: 'shift draft created successfully',
            });
            //res.json({validShift, failedShift});
          }
          next();
          //console.log('nul')
        }
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  async getHourType(schemeDetails) {
    if (schemeDetails.shiftSetup.assignShift.normal) {
      return { valid: true, isOtHour: false };
    } else {
      return { valid: true, isOtHour: true };
    }
  }
  async checkLimit(res, details) {
    try {
      //console.log('deeeeeee', details);
      // date duration staff_id
      const schemeDetails = details.shiftScheme;
      var hourTypeData = await this.getHourType(schemeDetails);
      let otDuration = 0;
      let normalDuration = 0;
      if (!hourTypeData.isOtHour) {
        normalDuration = details.duration;
      } else {
        otDuration = details.duration;
      }
      var date = new Date(details.date),
        y = date.getFullYear(),
        m = date.getMonth();
      var firstDay = new Date(y, m, 1);
      var lastDay = new Date(y, m + 1, 0);
      //console.log('fir', firstDay, lastDay)
      //console.log('date', new Date(date))
      const data = await StaffLimit.find({
        userId: details.staff_id,
        isAssignShift: true,
        date: {
          $lte: new Date(new Date(lastDay).toISOString()),
          $gte: new Date(new Date(firstDay).toISOString()),
        },
      }).lean();
      // console.log('data', data);
      let dailyDuration = details.duration;
      let weeklyDuration = details.duration;
      let monthlyDuration = details.duration;
      let weekNumber = details.weekNumber;
      let dailyOverall = dailyDuration;
      let weekLlyOverall = dailyDuration;
      let monthlyOverall = dailyDuration;
      //console.log('data', data.length)
      if (!hourTypeData.isOtHour) {
        data.forEach((item) => {
          // console.log('new Date(item.date)', new Date(item.date))
          if (new Date(item.date).getDate() == new Date(date).getDate()) {
            //  console.log('item.normalDuration', item.normalDuration)
            dailyDuration += item.normalDuration;
            dailyOverall += item.normalDuration;
            dailyOverall += item.otDuration;
          }
          if (new Date(item.date).getMonth() == new Date(date).getMonth()) {
            monthlyDuration += item.normalDuration;
            monthlyOverall += item.normalDuration;
            monthlyOverall += item.otDuration;
          }
          if (item.weekNumber == weekNumber) {
            weeklyDuration += item.normalDuration;
            weekLlyOverall += item.normalDuration;
            weekLlyOverall += item.otDuration;
          }
        });
      } else {
        // ot hr
        console.log('dailyOverall', dailyOverall);
        data.forEach((item) => {
          // console.log('new Date(item.date)', new Date(item.date))
          if (new Date(item.date).getDate() == new Date(date).getDate()) {
            dailyDuration += item.otDuration;
            dailyOverall += item.otDuration;
            dailyOverall += item.normalDuration;
            console.log('dailyOverall', dailyOverall);
          }
          if (new Date(item.date).getMonth() == new Date(date).getMonth()) {
            monthlyDuration += item.otDuration;
            monthlyOverall += item.otDuration;
            monthlyOverall += item.normalDuration;
          }
          // console.log('item.weekNo', item.weekNumber);
          //console.log('sss', weekNumber)
          if (item.weekNumber == weekNumber) {
            weeklyDuration += item.otDuration;
            weekLlyOverall += item.otDuration;
            weekLlyOverall += item.normalDuration;
          }
        });
      }
      //console.log('currentDateData', dailyDuration, monthlyDuration, weeklyDuration);
      // console.log('shify', details)
      let dayLimit = details.shiftScheme.shiftSetup.limits.normalHr.day;
      let weekLimit = details.shiftScheme.shiftSetup.limits.normalHr.week;
      let monthLimit = details.shiftScheme.shiftSetup.limits.normalHr.month;
      console.log(details.shiftScheme.shiftSetup.limits.otHr.day);
      console.log(
        'details.shiftScheme.shiftSetup.limits.otHr.day.disallow',
        details.shiftScheme.shiftSetup.limits.otHr.day.disallow,
      );
      var disallow = !details.shiftScheme.shiftSetup.limits.otHr.day.disallow;
      // if(schemeDetails.shiftSchemeType == 3){
      //     disallow = !disallow;
      // }
      console.log('disallow', disallow);
      if (hourTypeData.isOtHour) {
        dayLimit = details.shiftScheme.shiftSetup.limits.otHr.day;
        weekLimit = details.shiftScheme.shiftSetup.limits.otHr.week;
        monthLimit = details.shiftScheme.shiftSetup.limits.otHr.month;
      }
      let dayOverallLimit = schemeDetails.shiftSetup.limits.dayOverall;
      let weekOverallLimit = schemeDetails.shiftSetup.limits.weekOverall;
      let monthOverallLimit = schemeDetails.shiftSetup.limits.monthOverall;
      //console.log('dayLimit', dayLimit)
      let staffLimitData = {
        normalDuration,
        otDuration,
        isAssignShift: true,
        userId: details.staff_id,
        date: details.date,
        weekNumber: weekNumber,
        businessUnitId: details.businessUnitId,
      };
      //console.log('dayLimit', dayLimit);
      if (
        parseInt(dayLimit.value) &&
        parseInt(dayLimit.value) < parseInt(dailyDuration)
      ) {
        return {
          limit: true,
          message: 'Exceeds Daily limit',
          flag: 'day',
          details: dayLimit,
          status: disallow ? 0 : 1,
          staffLimitData,
        }; //dayLimit.disallow?0:1
      } else if (
        parseInt(weekLimit.value) &&
        parseInt(weekLimit.value) < parseInt(weeklyDuration)
      ) {
        return {
          limit: true,
          message: 'Exceeds Weekly limit',
          flag: 'week',
          details: weekLimit,
          status: disallow ? 0 : 1,
          staffLimitData,
        };
      } else if (
        parseInt(monthLimit.value) &&
        parseInt(monthLimit.value) < parseInt(monthlyDuration)
      ) {
        return {
          limit: true,
          message: 'Exceeds Monthly limit',
          flag: 'month',
          details: monthLimit,
          status: disallow ? 0 : 1,
          staffLimitData,
        };
      } else if (
        parseInt(dayOverallLimit) &&
        parseInt(dayOverallLimit) < parseInt(dailyOverall)
      ) {
        return {
          limit: true,
          message: 'Exceeds Daily Overall limit',
          flag: 'dayoverall',
          details: monthLimit,
          status: disallow ? 0 : 1,
          staffLimitData,
        };
      } else if (
        parseInt(weekOverallLimit) &&
        parseInt(weekOverallLimit) < parseInt(weekLlyOverall)
      ) {
        return {
          limit: true,
          message: 'Exceeds Weekly Overall limit',
          flag: 'weekoverall',
          details: monthLimit,
          status: disallow ? 0 : 1,
          staffLimitData,
        };
      } else if (
        parseInt(monthOverallLimit) &&
        parseInt(monthOverallLimit) < parseInt(monthlyOverall)
      ) {
        return {
          limit: true,
          message: 'Exceeds Monthly Overall limit',
          flag: 'monthoverall',
          details: monthLimit,
          status: disallow ? 0 : 1,
          staffLimitData,
        };
      }
      return { limit: false, staffLimitData };
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  failedShiftInsert(res, failed, user, success = [], status = 0) {
    try {
      // console.log('falaid',failed);
      let d = {};
      let description = 'Uploading CSV for Draft';
      let staff_id;
      if (status === 1) {
        d = user.body;
        user.body.data = {};
        user.body.data = d;
        staff_id = user.user._id;
        description = 'Publishing Shift';
      } else {
        staff_id = user.body.data.plannedBy;
      }
      // console.log('user111',user.body);
      const obj = {
        filePath: uploadFilePath,
        businessUnitId: user.body.data.businessUnitId,
        staff_id,
        weekRangeEndsAt: user.body.data.weekRangeEndsAt,
        weekRangeStartsAt: user.body.data.weekRangeStartsAt,
        weekNumber: user.body.data.weekNumber,
        failedShift: failed,
        status,
        successShift: success,
        description,
      };
      new AssignShiftLog(obj).save().then((saveShift) => {
        // console.log(saveShift);
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  getBodyDataStaff(res, req) {
    try {
      return new Promise((resolve, reject) => {
        const dataRequiredObj = {
          shift: req.body.shift,
          shiftDetails: Array.isArray(req.body.user)
            ? req.body.user
            : [req.body.user],
        };
        resolve(dataRequiredObj);
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  getBodyData(res, req) {
    try {
      return new Promise((resolve, reject) => {
        var form = new multiparty.Form();
        form.parse(req, function (err, fields, files) {
          // fields fields fields
          // console.log('fi', JSON.parse(fields.shift[0]));
          // console.log('file', files);
          const pathCSV = files.ff[0].path;
          csv()
            .fromFile(pathCSV)
            .then((jsonObj) => {
              const dataRequiredObj = {
                shift: JSON.parse(fields.shift[0]),
                shiftDetails: jsonObj,
              };
              resolve(dataRequiredObj);
            })
            .catch((err) => {
              reject(null);
            });
        });
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  createShift(shift) {
    return new Promise((resolve, reject) => {
      //  console.log('shift', shift)
      new Shift(shift)
        .save()
        .then((insertedShift) => {
          resolve(insertedShift._id);
        })
        .catch((err) => {
          reject(null);
        });
    });
  }
  async updateStaffAsRestOrOff(req, res) {
    try {
      const data = await AssignShift.findOneAndUpdate(
        { _id: req.body.assignShiftId },
        {
          $set: {
            isOff: req.body.isOff,
            isRest: req.body.isRest,
            duration: 0,
            startTime: null,
            endTime: null,
            startTimeInSeconds: null,
            endTimeInSeconds: null,
            isEmpty: false,
          },
        },
      );
      if (data) {
        // notificationStart
        var userId = [];
        if (data && data.shiftDetailId) {
          const shiftDetailData = await ShiftDetails.findOneAndUpdate(
            { _id: data.shiftDetailId },
            {
              $set: {
                isOff: req.body.isOff,
                isRest: req.body.isRest,
                duration: 0,
                startTime: null,
                endTime: null,
                startTimeInSeconds: null,
                endTimeInSeconds: null,
                isRecalled: false,
                isRecallAccepted: 1,
              },
            },
          );
        }
        userId.push(data.staff_id);
        var collapseKey = data._id;
        let redisBuId = data.businessUnitId;
        let mondayDate = this.getMondayDate(data.weekRangeStartsAt);
        let redisTimeZone = data.timeZone ? data.timeZone : 'GMT+0800';
        // const updateResult = await this.updateRedis(
        //   redisBuId,
        //   true,
        //   mondayDate,
        //   redisTimeZone,
        // );
        const weekStart = moment(data.weekRangeStartsAt, 'DD MMM')
          .utc(data.timeZone)
          .format('DD MMMM');
        console.log('weekStart', weekStart);
        const weekEnd = moment(data.weekRangeEndsAt, 'DD MMM')
          .utc(data.timeZone)
          .format('DD MMMM');
        console.log('weekStart', weekEnd);
        var notificationObj = {
          title: `Hi!`,
          body: ` Your shifts for ${weekStart} to ${weekEnd} has been updated.`,
          bodyTime: data.date,
          bodyTimeFormat: ['DD-MMM-YYYY'],
        };
        //this.sendNotification(userId, notificationObj, collapseKey);
        return res.json({ success: true, msg: 'Assign Shift updated' });
      } else {
        return res.json({ success: false, msg: 'Assign Shift not found' });
      }
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  async updateStaffShift(req, res) {
    try {
      logInfo(`assginshift/staff/update API Start!`, { name: req.user.name, staffId: req.user.staffId });
      if (!__.checkHtmlContent(req.body)) {
        logError(`assginshift/staff/update entered malicious input `, req.body);
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, ['user']);
      if (requiredResult.status === false) {
        logError(`assginshift/staff/update API, Required fields missing `, requiredResult1.missingFields);
        logError(`assginshift/staff/update API, request payload `, req.body);
        return res.json({
          success: false,
          msg: 'missing fields ' + requiredResult.missingFields.toString(),
        });
      } else {
        const user = req.body.user;
        const companySetup = await pageSetting.findOne(
          { companyId: req.user.companyId },
          { opsGroup: 1 },
        );
        const tierSetup = companySetup.opsGroup.tierType;
        const callResultArr = [];
        for (let i = 0; i < user.length; i++) {
          var item = user[i];
          console.log('Item is' + item);
          callResultArr.push(this.createDayWiseShift(res, item, tierSetup));
        }
        const callResult = await Promise.all(callResultArr);
        const obj = callResult[0];
        if (obj.success) {
          logInfo(`assginshift/staff/update API 'Shift is Overlapping' ends here!`, { name: req.user.name, staffId: req.user.staffId });
          return res.json({ success: false, message: 'Shift is Overlapping' });
        }
        logInfo(`assginshift/staff/update API ends here!`, { name: req.user.name, staffId: req.user.staffId });
        return res.json({ success: true, msg: 'Assign Shift updated' });
      }
    } catch (err) {
      logError(`assginshift/staff/update API, there is an error`, err.toString());
      return res.json({ success: false, msg: 'Something went wrong' });
    }
  }
  async createDayWiseShift(res, item, tierSetup) {
    try {
      return new Promise(async (resolve, reject) => {
        var successUpdate = [];
        var failedUpdate = [];
        var publishArr = [];
        const timeFormat = item.timeFormat;
        var startTime = this.getDateInUTCFormat(
          item.StartDate,
          item.StartTime,
          timeFormat,
        );
        var endTime = this.getDateInUTCFormat(
          item.EndDate,
          item.EndTime,
          timeFormat,
        );
        var startTimeInSeconds = moment(
          new Date(startTime),
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .unix();
        var endTimeInSeconds = moment(
          new Date(endTime),
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .unix();
        var duration = (endTimeInSeconds - startTimeInSeconds) / 3600;
        var splitStartTime = null;
        var splitEndTime = null;
        var splitStartTimeInSeconds = null;
        var splitEndTimeInSeconds = null;

        if (item.isSplitShift) {
          console.log('item.splitEndTime', item.splitEndTime);
          splitStartTime = this.getDateInUTCFormat(
            item.StartDate,
            item.splitStartTime,
            timeFormat,
          );
          splitEndTime = this.getDateInUTCFormat(
            item.EndDate,
            item.splitEndTime,
            timeFormat,
          );
          splitStartTimeInSeconds = moment(
            new Date(splitStartTime),
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .unix(); // new Date(bodyData.shiftDetails[asyncIndex].startTime).getTime();
          splitEndTimeInSeconds = moment(
            new Date(splitEndTime),
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .unix(); //new Date(bodyData.shiftDetails[asyncIndex].endTime).getTime();
          var startSecondSplit = new Date(splitStartTime).getTime();
          var endSecondSplit = new Date(splitEndTime).getTime();
          duration += (endSecondSplit - startSecondSplit) / 3600000;
        }
        console.log('duration', duration);
        const details = await AssignShift.findOne({ _id: item.assignShiftId });
        // console.log("details.date", details.date)
        let b_start = new Date(startTime).getTime();
        let b_end = new Date(endTime).getTime();
        const shiftDetails = await ShiftDetails.find({
          $or: [
            { confirmedStaffs: details.staff_id },
            { backUpStaffs: details.staff_id },
          ],
          date: details.date,
          isAssignShift: false,
        });
        const shiftOverlappingDetails = shiftDetails.filter((shiftOverl) => {
          // return (new Date(shiftOverl.startTime).getTime() <= new Date(endTime).getTime() &&
          //     new Date(shiftOverl.endTime).getTime() >= new Date(startTime).getTime()
          // ) || (new Date(shiftOverl.startTime).getTime() <= new Date(endTime).getTime() &&
          //     new Date(shiftOverl.endTime).getTime() >= new Date(startTime).getTime()
          //     )
          let a_start = new Date(shiftOverl.startTime).getTime();
          let a_end = new Date(shiftOverl.endTime).getTime();
          if (a_start <= b_start && b_start <= a_end) return true; // b starts in a
          if (a_start <= b_end && b_end <= a_end) return true; // b ends in a
          if (b_start < a_start && a_end < b_end) return true; // a in b
          return false;
        });
        // resolve({ shiftDetails, shiftOverlappingDetails, startTime, endTime })
        if (shiftOverlappingDetails && shiftOverlappingDetails.length > 0) {
          return resolve({ success: true, message: 'Shift is Overlapping' });
        }
        let redisBuId;
        let mondayDate;
        let redisTimeZone;
        redisBuId = details.businessUnitId;
        mondayDate = this.getMondayDate(details.weekRangeStartsAt);
        redisTimeZone = details.timeZone ? details.timeZone : 'GMT+0800';
        // const redisBuId = details.businessUnitId;
        const limitData = await this.checkLimitDuringTime(
          res,
          details,
          duration,
        );
        //console.log('detailsdetails', limitData)
        var isLimit = limitData.limit;
        var schemeDetails = limitData.details;
        var alertMessage = limitData.message;
        var isAlert = false;
        if (limitData.status) {
          isAlert = true;
        }
        console.log("item======", item);
        const data = await AssignShift.findOneAndUpdate(
          { _id: item.assignShiftId },
          {
            $set: {
              startTime,
              endTime,
              startTimeInSeconds,
              endTimeInSeconds,
              duration,
              subSkillSets: item.subSkillSets,
              reportLocationId: item.reportLocationId,
              isOff: false,
              mainSkillSets: item.mainSkillSets,
              skillSetTierType: tierSetup,
              isRest: false,
              isLimit: isLimit,
              schemeDetails: schemeDetails,
              alertMessage: alertMessage,
              isAlert: isAlert,
              isEmpty: false,
              isRecallAccepted: 1,
              isRecalled: false,
              isMobile: item.isMobile ? true : false,
              isSplitShift: item.isSplitShift,
              splitStartTime,
              splitEndTime,
              splitStartTimeInSeconds,
              splitEndTimeInSeconds,
              geoReportingLocation: item.geoReportingLocation,
              isProximityEnabled: item.isProximityEnabled,
              isCheckInEnabled: item.isCheckInEnabled,
              proximity: item.proximity
            },
          },
        );

        if (data) {
          // notificationStart
          if (data && data.shiftDetailId) {
            if (!details.isSplitShift && item.isSplitShift) {
              const shiftDetailData = await ShiftDetails.findOne({
                _id: data.shiftDetailId,
              });
              const shiftId = shiftDetailData.shiftId;
              const shiftDetailData1 = await ShiftDetails.deleteMany({
                _id: data.shiftDetailId,
              });
              const shiftData = await Shift.deleteMany({ _id: shiftId });
              publishArr.push(data._id);
              // before it was not split but now it is split
            } else if (details.isSplitShift && !item.isSplitShift) {
              const shiftDetailData = await ShiftDetails.findOne({
                _id: data.shiftDetailId,
              });
              const shiftId = shiftDetailData.shiftId;
              const shiftData = await Shift.deleteMany({ _id: shiftId });
              const splitDelete = await ShiftDetails.deleteMany({
                draftId: data._id,
              });
              publishArr.push(data._id);
              // it was split but now it is not split
            } else if (details.isSplitShift && item.isSplitShift) {
              const shiftDetailData = await ShiftDetails.findOne({
                _id: data.shiftDetailId,
              });
              const shiftId = shiftDetailData.shiftId;
              const shiftData = await Shift.deleteMany({ _id: shiftId });
              const splitDelete = await ShiftDetails.deleteMany({
                draftId: data._id,
              });
              publishArr.push(data._id);
              item.isMobile = true;
              // it was split and now it is split
            } else {
              const shiftDetailData = await ShiftDetails.findOneAndUpdate(
                { _id: data.shiftDetailId },
                {
                  startTime,
                  endTime,
                  startTimeInSeconds,
                  endTimeInSeconds,
                  duration,
                  subSkillSets: item.subSkillSets,
                  mainSkillSets: item.mainSkillSets,
                  skillSetTierType: tierSetup,
                  reportLocationId: item.reportLocationId,
                  isOff: false,
                  isRest: false,
                  isLimit: isLimit,
                  isAlert: isAlert,
                  isEmpty: false,
                  isRecallAccepted: 1,
                  isRecalled: false,
                },
              );
            }
          }

          if (item.isMobile) {
            publishArr.push(data._id);
          }

          var userId = [];
          userId.push(data.staff_id);
          var collapseKey = data._id;
          const weekStart = moment(data.weekRangeStartsAt, 'DD MMM')
            .utc(data.timeZone)
            .format('DD MMMM');
          console.log('weekStart', weekStart);
          const weekEnd = moment(data.weekRangeEndsAt, 'DD MMM')
            .utc(data.timeZone)
            .format('DD MMMM');
          console.log('weekStart', weekEnd);
          var notificationObj = {
            title: `Hi! Your shifts for ${weekStart} to ${weekEnd} has been updated.`,
            bodyTime: data.date,
            bodyTimeFormat: ['DD-MMM-YYYY'],
          };

          data.msg = 'Assign Shift Updated';
          successUpdate.push(data);
        } else {
          item.msg = 'Assign Shift Not Found';
          failedUpdate.push(item);
          // return res.json({success: false,msg:'Assign Shift not found'})
        }
        if (publishArr.length > 0) {
          console.log('hereree in publish');
          await this.publishAllFromMobile(res, publishArr);
        }
        resolve({ redisBuId, redisTimeZone, mondayDate });
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  async updateStaffShiftRestOff(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'assignShiftId',
        'StartTime',
        'EndTime',
        'reportLocationId',
      ]);
      if (requiredResult.status === false) {
        return res.json({
          success: false,
          msg: 'missing fields ' + requiredResult.missingFields.toString(),
        });
      } else {
        const item = req.body;
        const timeFormat = item.timeFormat;
        var startTime = this.getDateInUTCFormat(
          item.StartDate,
          item.StartTime,
          timeFormat,
        );
        var endTime = this.getDateInUTCFormat(
          item.EndDate,
          item.EndTime,
          timeFormat,
        );
        var startTimeInSeconds = moment(
          new Date(startTime),
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .unix();
        var endTimeInSeconds = moment(
          new Date(endTime),
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .unix();
        var duration = (endTimeInSeconds - startTimeInSeconds) / 3600;
        console.log('duration', duration);
        const data = await AssignShift.findOneAndUpdate(
          { _id: item.assignShiftId },
          {
            $set: {
              startTime,
              endTime,
              startTimeInSeconds,
              endTimeInSeconds,
              duration,
              subSkillSets: item.subSkillSets,
              reportLocationId: item.reportLocationId,
            },
          },
        );
        if (data) {
          let redisBuId;
          let mondayDate;
          let redisTimeZone;
          redisBuId = data.businessUnitId;
          mondayDate = this.getMondayDate(data.weekRangeStartsAt);
          redisTimeZone = data.timeZone ? data.timeZone : 'GMT+0800';
          // const updateResult = await this.updateRedis(
          //   redisBuId,
          //   true,
          //   mondayDate,
          //   redisTimeZone,
          // );
          if (data.shiftDetailId) {
            const updateShift = await ShiftDetails.findOneAndUpdate(
              { _id: data.shiftDetailId },
              {
                $set: {
                  startTime,
                  endTime,
                  startTimeInSeconds,
                  endTimeInSeconds,
                  duration,
                  subSkillSets: item.subSkillSets,
                  reportLocationId: item.reportLocationId,
                },
              },
            );
            if (updateShift) {
              return res.json({
                success: true,
                msg: 'Assign Shift and Open shift updated',
              });
            }
            return res.json({ success: true, msg: 'Assign Shift updated' });
          }
          return res.json({ success: true, msg: 'Assign Shift updated' });
        } else {
          return res.json({ success: false, msg: 'Assign Shift not found' });
        }
      }
    } catch (e) {
      return res.json({ success: false, msg: 'Something went wrong' });
    }
  }
  async read(req, res) {
    try {
      logInfo(`assginshift/read API Start!`, { name: req.user.name, staffId: req.user.staffId });
      const usersOfBu = await User.find(
        {
          $or: [
            { parentBussinessUnitId: req.body.businessUnitId },
            { viewBussinessUnitId: req.body.businessUnitId },
            { planBussinessUnitId: req.body.businessUnitId },
          ],
        },
        { _id: 1 },
      );
      const currentDateR = req.body.weekRangeStartsAt.split(' ')[0];
      const ddd = moment(new Date(req.body.weekRangeStartsAt))
        .utc()
        .format('MM-DD-YYYY HH:mm:ss Z');
      const end = moment(new Date(req.body.weekRangeStartsAt))
        .utcOffset(480)
        .format('MM-DD-YYYY HH:mm:ss Z');
      const year = new Date(ddd).getFullYear();
      const month = new Date(ddd).getMonth() + 1;
      const day = new Date(ddd).getDate() - 1; //comment out for local
      const where = {
        businessUnitId: req.body.businessUnitId,
        $and: [
          { $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, year] } },
          { $expr: { $eq: [{ $month: '$weekRangeStartsAt' }, month] } },
          { $expr: { $eq: [{ $dayOfMonth: '$weekRangeStartsAt' }, day] } },
        ],
      };
      const findOrFindOne = AssignShift.find(where);
      let shifts1 = await findOrFindOne
        .select(
          'staffId staff_id staffAppointmentId staffRoleId _id date reportLocationId startTime endTime day status ' +
          'shiftChangeRequestStatus subSkillSets shiftRead draftStatus shiftChangeRequestMessage duration shiftDetailId schemeDetails alertMessage isLimit isAlert isAllowPublish isOff isRest splitStartTime splitEndTime isSplitShift isRecalled isRecallAccepted isEmpty mainSkillSets skillSetTierType geoReportingLocation proximity isCheckInEnabled isProximityEnabled',
        )
        .populate([
          {
            path: 'staff_id',
            select:
              'name contactNumber email profilePicture staffId schemeId subSkillSets mainSkillSets',
            populate: [
              {
                path: 'schemeId',
                select: 'schemeName',
              },
              {
                path: 'mainSkillSets',
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
            path: 'shiftDetailId',
            select: 'isExtendedShift extendedStaff',
          },
          {
            path: 'mainSkillSets',
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
          {
            path: 'reportLocationId',
            select: '_id name',
            match: {
              status: 1,
            },
          },
          {
            path: 'geoReportingLocation',
            select: '_id name'
          },
        ])
        .sort({ staffId: -1 });

      let shifts = JSON.stringify(shifts1);
      shifts = JSON.parse(shifts);
      if (shifts.length > 0) {
        var days = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];
        for (let i = 0; i <= shifts.length - 1; i++) {
          let item = shifts[i];
          let ops = await OpsGroup.findOne(
            { userId: item.staff_id._id },
            { _id: 1, opsGroupName: 1 },
          );
          let user = await User.findOne(
            { _id: item.staff_id._id },
            { _id: 0, role: 1, appointmentId: 1 },
          ).populate([
            {
              path: 'role',
              select: 'name',
            },
            { path: 'appointmentId', select: 'name' },
          ]);
          let attendance = await Attendance.findOne({
            shiftDetailId: item.shiftDetailId,
            userId: item.staff_id,
          });
          if (attendance) {
            item.attendance = attendance;
          } else {
            item.attendance = null;
          }
          if (user) {
            item.staffAppointmentId = user.appointmentId;
            item.staffRoleId = user.role;
          }

          var d = moment(new Date(item.date))
            .utcOffset(req.body.timeZone)
            .format('MM-DD-YYYY'); //new Date(item.startTime);
          const date = moment(d, 'MM-DD-YYYY');
          const dow = date.day();
          var dayName = days[dow];
          item.dayName = dayName;
          if (item.shiftDetailId && item.shiftDetailId.isExtendedShift) {
            item.startTime = item.shiftDetailId.extendedStaff[0].startDateTime;
            item.endTime = item.shiftDetailId.extendedStaff[0].endDateTime;
            item.isExtendedShift = item.shiftDetailId.isExtendedShift;
            item.shiftDetailId = item.shiftDetailId._id;
          }
          if (ops) {
            item.staff_id['opsGroupName'] = ops.opsGroupName;
          }
        }

        shifts = _.mapValues(_.groupBy(shifts, 'dayName'));
        var newShifts = {
          Monday: shifts.Monday,
          Tuesday: shifts.Tuesday,
          Wednesday: shifts.Wednesday,
          Thursday: shifts.Thursday,
          Friday: shifts.Friday,
          Saturday: shifts.Saturday,
          Sunday: shifts.Sunday,
        };
        logInfo(`assginshift/read API ends here!`, { name: req.user.name, staffId: req.user.staffId });
        res.json({ status: true, shifts: newShifts, message: 'Week Data' });
      } else {
        logInfo(`assginshift/read API ends here!`, { name: req.user.name, staffId: req.user.staffId });
        res.json({ status: false, shifts: [], message: 'No Week Data Found' });
      }
    } catch (error) {
      logError(`assginshift/read API, there is an error`, error.toString());
      return __.out(res, 500, error);
    }
  }
  async shiftView(req, res) {
    try {
      console.log(req.body);
      const result = await AssignShift.updateMany(
        { _id: { $in: req.body.assignShiftIds } },
        { shiftRead: 1 },
      );
      res.json({ status: true, message: 'Shift Read Successfully' });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  async changeRequest(req, res) {
    try {
      console.log(req.body);
      const result = await AssignShift.updateMany(
        { _id: req.body.assignShiftId },
        {
          shiftRead: 1,
          shiftChangeRequestMessage: req.body.message,
          shiftChangeRequestStatus: 1,
        },
      );
      const redisBuId = result.businessUnitId;
      // await this.updateRedis(redisBuId)
      let mondayDate = this.getMondayDate(result.weekRangeStartsAt);
      let redisTimeZone = result.timeZone ? result.timeZone : 'GMT+0800';
      // const updateResult = await this.updateRedis(
      //   redisBuId,
      //   true,
      //   mondayDate,
      //   redisTimeZone,
      // );
      res.json({ status: true, message: 'Requested Successfully' });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  async approveRequest(req, res) {
    try {
      console.log(req.body);
      if (req.body.isApprove) {
        AssignShift.findOneAndUpdate(
          { _id: req.body.assignShiftId },
          {
            shiftRead: 0,
            shiftChangeRequestStatus: 2,
          },
          { upsert: true },
        ).then((result) => {
          if (result) {
            const redisBuId = result.businessUnitId;
            // this.updateRedis(redisBuId);
            //const shiftDetailId = result.
            res.json(result);
          } else {
            res.json({ status: 1, message: 'Assign Shift Not Found' });
          }
        });
      } else {
        const result = await AssignShift.updateMany(
          { _id: req.body.assignShiftId },
          {
            shiftRead: 0,
            shiftChangeRequestStatus: 3,
          },
        );
      }
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  getDateInUTCFormat1(date, time, timeZone) {
    const dateTime = `${date} ${time} ${timeZone}`;
    // console.log('datetime', dateTime);
    return moment(dateTime, 'MM-DD-YYYY HH:mm:ss Z').utc().format();
  }
  async reduceLimit(res, schemeDetails, details, from = 0, limitData = null) {
    try {
      var hourTypeData = await this.getHourType(schemeDetails);
      var otDuration = 0;
      var normalDuration = 0;
      if (from == 0) {
        if (hourTypeData.isOtHour) {
          otDuration = -1 * details.duration;
        } else {
          normalDuration = -1 * details.duration;
        }
      } else {
        if (hourTypeData.isOtHour) {
          otDuration = 1 * details.duration;
        } else {
          normalDuration = 1 * details.duration;
        }
      }
      console.log('details.staff_id', details.staff_id, details._id);
      const value = await StaffLimit.update(
        { userId: details.staff_id, assignShiftId: details._id },
        { $inc: { normalDuration: normalDuration, otDuration: otDuration } },
      );
      console.log('value***************', value);
      if (value.n == 0 && from == 1 && limitData) {
        console.log('Insert new limit', limitData.staffLimitData);
        let obj = limitData.staffLimitData;
        obj.assignShiftId = details._id;
        await new StaffLimit(obj).save();
        //limitData
      }
      return value;
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  async reduceLimitDelete(res, schemeDetails, details) {
    try {
      const value = await StaffLimit.deleteMany({
        userId: details.staff_id,
        assignShiftId: details._id,
      });
      return value;
    } catch (error) {
      __.log(error);
      logError(`reduceLimitDelete function, there is an error`, error.toString());
      return __.out(res, 500, error);
    }
  }
  async checkLimitDuringTime(res, details, duration) {
    try {
      var schemeDetails = await User.findOne({
        _id: details.staff_id,
      }).populate([
        {
          path: 'schemeId',
        },
      ]);
      schemeDetails = schemeDetails.schemeId;
      //console.log('schemeDetails', schemeDetails);
      // decrease duration to zero
      var reduceData = await this.reduceLimit(res, schemeDetails, details, 0);
      // check limit with this duration
      console.log('duration change', details.duration, duration);
      details.duration = duration;
      details.shiftScheme = schemeDetails;
      var limitData = await this.checkLimit(res, details);
      console.log(limitData);
      // add this duration to that
      var addData = await this.reduceLimit(
        res,
        schemeDetails,
        details,
        1,
        limitData,
      );
      console.log(details.duration, duration);
      return limitData;
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  async alertAction(req, res) {
    try {
      logInfo(`assginshift/alertaction API Start!`, { name: req.user.name, staffId: req.user.staffId });
      if (req.body.from == 'yes') {
        var aa = await AssignShift.findOneAndUpdate(
          { _id: req.body.assignShiftId },
          { isAllowPublish: true, isLimit: false, isAlert: false },
        );
        const redisBuId = aa.businessUnitId;
        let mondayDate = this.getMondayDate(new Date(aa.weekRangeStartsAt));
        let redisTimeZone = aa.timeZone;
        logInfo(`assginshift/alertaction API ends here!`, { name: req.user.name, staffId: req.user.staffId });
        return res.json({
          status: true,
          message: 'You have selected to proceed',
        });
      } else {
        var aa = await AssignShift.findOneAndUpdate(
          { _id: req.body.assignShiftId },
          {
            isAllowPublish: false,
            draftStatus: 1,
            isLimit: true,
            isAlert: true,
          },
        );
        const redisBuId = aa.businessUnitId;
        let mondayDate = this.getMondayDate(new Date(aa.weekRangeStartsAt));
        let redisTimeZone = aa.timeZone;
        logInfo(`assginshift/alertaction API ends here!`, { name: req.user.name, staffId: req.user.staffId });
        return res.json({
          status: true,
          message: 'You have selected not to proceed',
        });
      }
    } catch (error) {
      logError(`assginshift/alertaction API, there is an error`, error.toString());
      return __.out(res, 500, error);
    }
  }
  async changeShiftTime(req, res) {
    try {
      //  console.log(req.body);
      //console.log('req.body.startDateTime', req.body.startDateTime.split('GMT'))
      let dateSplit = req.body.startDateTime.split('GMT');
      let timeZone = dateSplit[1];
      timeZone = timeZone.substr(1);
      let timeFormatSign = dateSplit[1][0] == '+' ? '-' : '+';
      console.log('ti', timeFormatSign);
      // dateSplit[1][0] = timeFormatSign;
      let newDate = dateSplit[0] + 'GMT' + timeFormatSign + timeZone;
      console.log('newww', newDate);
      console.log(new Date(req.body.startDateTime), new Date());

      if (
        new Date(req.body.startDateTime).getTime() >=
        new Date(req.body.endDateTime).getTime()
      ) {
        return res.json({
          status: false,
          message: 'Assign Shift start time is grater then end time',
        });
      }
      if (new Date().getTime() > new Date(newDate).getTime()) {
        return res.json({ status: false, message: 'Assign Shift was ended' });
      }
      const result = await AssignShift.findOne({ _id: req.body.assignShiftId });
      if (result) {
        const redisBuId = result.businessUnitId;
        var startSecond = new Date(req.body.startDateTime).getTime();
        var endSecond = new Date(req.body.endDateTime).getTime();
        var newDuration = (endSecond - startSecond) / 3600000;
        var limitData = await this.checkLimitDuringTime(
          res,
          result,
          newDuration,
        );
        var isLimit = result.isLimit;
        var isAlert = result.isAlert;
        var alertMessage = result.alertMessage;
        var schemeDetails = result.schemeDetails;
        var isAllowPublish = result.isAllowPublish;
        if (limitData.limit) {
          isLimit = true;
          isAllowPublish = false;
          //isAllowPublish
          schemeDetails = limitData.details;
          alertMessage = limitData.message;
          if (limitData.status) {
            isAlert = true;
          } else {
            isAlert = false;
          }
        } else {
          isAllowPublish = true;
          isLimit = false;
          isAlert = false;
          alertMessage = '';
        }
        console.log('updated', result.startTime, req.body.startDateTime);
        console.log(
          'updated date',
          new Date(result.startTime),
          new Date(req.body.startDateTime),
        );
        // if(new Date(result.startTime).getTime()> new Date(req.body.startDateTime).getTime()){
        AssignShift.findOneAndUpdate(
          { _id: req.body.assignShiftId },
          {
            shiftRead: 0,
            startTime: req.body.startDateTime,
            startTimeInSeconds: new Date(req.body.startDateTime).getTime(),
            endTimeInSeconds: new Date(req.body.endDateTime).getTime(),
            endTime: req.body.endDateTime,
            duration: newDuration,
            isLimit,
            isAlert,
            alertMessage,
            schemeDetails,
            isAllowPublish,
          },
          { new: true },
        ).then(async (resultNew) => {
          if (!result.draftStatus) {
            // this.updateRedis(redisBuId);
            return res.json({
              status: true,
              message: 'Assign Shift updated.',
              result,
            });
          } else {
            const shiftUpdate = await ShiftDetails.findOneAndUpdate(
              { _id: result.shiftDetailId },
              {
                startTime: req.body.startDateTime,
                duration: newDuration,
                startTimeInSeconds: new Date(req.body.startDateTime).getTime(),
                endTimeInSeconds: new Date(req.body.endDateTime).getTime(),
                endTime: req.body.endDateTime,
              },
            );
            // this.updateRedis(redisBuId);
            return res.json({
              status: true,
              message: 'Assign Shift updated.',
              result,
            });
          }
        });
        // }else {
        //     return res.json({status: false, message: "Assign Shift is already started", result});
        // }
        var userId = [];
        userId.push(result.staff_id);
        var collapseKey = req.body.assignShiftId;
        let notificationObj = {
          title: 'Hi!',
          body: 'Your assigned shift timings have been updated.',
          bodyTime: req.body.startDateTime,
          bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
        };
        this.sendNotification(res, userId, notificationObj, collapseKey);
        //const shiftDetailId = result.
      } else {
        res.json({ status: false, message: 'Assign Shift Not Found' });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async publishAll(req, res) {
    try {
      logInfo(`assginshift/publishAll API Start!`, { name: req.user.name, staffId: req.user.staffId });
      const failPublish = [];
      const insertedShift = [];
      let notificationObj = {};
      let colKey = null;
      const userIdForNotification = [];
      let redisBuId;
      let redisTimeZone;
      const allShifts = await this.getAllDraftShift(req.body.assignShiftIds);
      if (allShifts && allShifts.length > 0) {
        redisBuId = allShifts[0].businessUnitId;
        const weekStart = moment(allShifts[0].weekRangeStartsAt, 'DD MMM')
          .utcOffset(allShifts[0].timeZone)
          .format('DD MMMM');
        let mondayDate = this.getMondayDate(
          new Date(allShifts[0].weekRangeStartsAt),
        );
        const weekEnd = moment(allShifts[0].weekRangeEndsAt, 'DD MMM')
          .utcOffset(allShifts[0].timeZone)
          .format('DD MMMM');
        redisTimeZone = allShifts[0].timeZone;
        notificationObj = {
          body: `Your shifts for ${weekStart} to ${weekEnd} has been updated.`,
          title: `Hi!`,
          bodyTime: allShifts[0].date,
          bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
        };
        for (let i = 0; i < allShifts.length; i++) {
          const item = allShifts[i];
          const insertShift = await this.addShift(item);
          if (insertShift) {
            const randomShiftId = new mongoose.Types.ObjectId();
            item['randomShiftId'] = randomShiftId;
            let insertShiftDetail = await this.addShiftDetail(
              item,
              insertShift,
            );
            let insertShiftDetailSplit;
            if (item.isSplitShift) {
              insertShiftDetailSplit = await this.addShiftDetailSplit(
                item,
                insertShift,
              );
            }
            if (insertShiftDetail) {
              const appliedStaff = await this.addAppliedStaff(
                insertShift._id,
                insertShiftDetail._id,
                item.staff_id,
              );
              let appliedStaffSplit;
              if (item.isSplitShift) {
                appliedStaffSplit = await this.addAppliedStaff(
                  insertShift._id,
                  insertShiftDetailSplit._id,
                  item.staff_id,
                );
              }
              if (appliedStaff) {
                const updateInsertShift = await this.updateShift(
                  insertShift._id,
                  insertShiftDetail._id,
                );
                let updateInsertShiftSplit;
                if (item.isSplitShift) {
                  updateInsertShiftSplit = await this.updateShift(
                    insertShift._id,
                    insertShiftDetailSplit._id,
                    true,
                  );
                }
                const updateInsertShiftDetail = await this.updateShiftDetail(
                  appliedStaff._id,
                  insertShiftDetail._id,
                );
                if (item.isSplitShift) {
                  const updateInsertShiftDetailSplit =
                    await this.updateShiftDetail(
                      appliedStaffSplit._id,
                      insertShiftDetailSplit._id,
                    );
                }
                const updateInsertAssignShift = await this.updateAssignShift(
                  insertShiftDetail._id,
                  item._id,
                );
                insertShiftDetail = JSON.stringify(insertShiftDetail);
                insertShiftDetail = JSON.parse(insertShiftDetail);
                insertShiftDetail.status = 1;
                const staffLimitUpdate = await StaffLimit.updateOne(
                  { assignShiftId: item._id },
                  {
                    $set: {
                      shiftDetailId: insertShiftDetail._id,
                      shiftId: insertShift._id,
                    },
                  },
                );
                insertShiftDetail.reportLocationName = item.reportLocationName;
                insertShiftDetail.faildMessage = 'Shift Publish Successfully';
                colKey = item._id;
                userIdForNotification.push(item.staff_id);
                insertedShift.push(insertShiftDetail);
              } else {
                logError(`assginshift/publishAll API, there is an error`, 'Applying error');
                item.faildMessage = 'Applying error';
                item.status = 0;
                failPublish.push(item);
              }
            }
          } else {
            logError(`assginshift/publishAll API, there is an error`, 'Shift Adding Error');
            item.faildMessage = 'Shift Adding Error';
            item.status = 0;
            failPublish.push(item);
          }
        }
        this.failedShiftInsert(res, failPublish, req, insertedShift, 1);
        if (colKey) {
          this.sendNotification(
            res,
            userIdForNotification,
            notificationObj,
            colKey,
          );
        }
        logInfo(`assginshift/publishAll API ends here!`, { name: req.user.name, staffId: req.user.staffId });
        res.json({
          status: true,
          message: 'Published Succesfully',
          code: 1,
          data: allShifts,
          insertedShift,
        });
      } else {
        logError(`assginshift/publishAll API, there is an error`, 'Something went wrong');
        res.json({ status: false, message: 'Something went wrong', code: 0 });
      }
    } catch (err) {
      logError(`assginshift/publishAll API, there is an error`, err.toString());
      __.out(res, 500, err);
    }
  }
  getMondayDate(mondayDate) {
    mondayDate = new Date(mondayDate);
    if (mondayDate.getDay() !== 1) {
      const addD = (1 + 7 - mondayDate.getDay()) % 7;
      let finalAdd = addD;
      if (addD !== 1) {
        finalAdd = addD - 7;
      }
      mondayDate = new Date(
        mondayDate.setDate(mondayDate.getDate() + finalAdd),
      );
    }
    return mondayDate;
  }
  async publishAllFromMobile(res, assignShiftIds) {
    try {
      //console.log(req.body.);
      const failPublish = [];
      const insertedShift = [];
      let notificationObj = {};
      const publishUserId = [];
      const allShifts = await this.getAllDraftShift(assignShiftIds);
      console.log('1');
      if (allShifts && allShifts.length > 0) {
        const weekStart = moment(allShifts[0].weekRangeStartsAt, 'DD MMM')
          .utcOffset(allShifts[0].timeZone)
          .format('DD MMMM');
        console.log('weekStart', weekStart);
        const weekEnd = moment(allShifts[0].weekRangeEndsAt, 'DD MMM')
          .utcOffset(allShifts[0].timeZone)
          .format('DD MMMM');
        console.log('weekStart', weekEnd);
        notificationObj = {
          title: 'Hi!',
          body: `Your shifts for ${weekStart} to ${weekEnd} has been updated.`,
          bodyTime: allShifts[0].date,
          bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
        };
        for (let i = 0; i < allShifts.length; i++) {
          console.log('2');
          const item = allShifts[i];
          const insertShift = await this.addShift(item);
          console.log('3');
          if (insertShift) {
            let insertShiftDetail = await this.addShiftDetail(
              item,
              insertShift,
            );
            let insertShiftDetailSplit;
            if (item.isSplitShift) {
              insertShiftDetailSplit = await this.addShiftDetailSplit(
                item,
                insertShift,
              );
            }
            if (insertShiftDetail) {
              // update shift
              // applied
              const appliedStaff = await this.addAppliedStaff(
                insertShift._id,
                insertShiftDetail._id,
                item.staff_id,
              );
              let appliedStaffSplit;
              if (item.isSplitShift) {
                appliedStaffSplit = await this.addAppliedStaff(
                  insertShift._id,
                  insertShiftDetailSplit._id,
                  item.staff_id,
                );
              }
              if (appliedStaff) {
                // updateShift
                const updateInsertShift = await this.updateShift(
                  insertShift._id,
                  insertShiftDetail._id,
                );
                let updateInsertShiftSplit;
                if (item.isSplitShift) {
                  updateInsertShiftSplit = await this.updateShift(
                    insertShift._id,
                    insertShiftDetailSplit._id,
                    true,
                  );
                }
                // updateShiftdetails
                const updateInsertShiftDetail = await this.updateShiftDetail(
                  appliedStaff._id,
                  insertShiftDetail._id,
                );
                if (item.isSplitShift) {
                  const updateInsertShiftDetailSplit =
                    await this.updateShiftDetail(
                      appliedStaffSplit._id,
                      insertShiftDetailSplit._id,
                    );
                }
                const updateInsertAssignShift = await this.updateAssignShift(
                  insertShiftDetail._id,
                  item._id,
                );
                insertShiftDetail = JSON.stringify(insertShiftDetail);
                insertShiftDetail = JSON.parse(insertShiftDetail);
                insertShiftDetail.status = 1;
                console.log('itemitemitem', item.reportLocationName);
                const staffLimitUpdate = await StaffLimit.updateOne(
                  { assignShiftId: item._id },
                  {
                    $set: {
                      shiftDetailId: insertShiftDetail._id,
                      shiftId: insertShift._id,
                    },
                  },
                );
                console.log('staffLimitUpdate', staffLimitUpdate);
                insertShiftDetail.reportLocationName = item.reportLocationName;
                insertShiftDetail.faildMessage = 'Shift Published Successfully';
                publishUserId.push(item.staff_id);
                insertedShift.push(insertShiftDetail);
              } else {
                item.faildMessage = 'Applying error';
                item.status = 0;
                failPublish.push(item);
                // delete inserted shift addShift
              }
            } else {
            }
          } else {
            item.faildMessage = 'Shift Adding Error';
            item.status = 0;
            failPublish.push(item);
          }
        }
        console.log('4');
        // newashish
        //this.failedShiftInsert(failPublish, req, insertedShift, 1)
        this.sendNotification(res, publishUserId, notificationObj, 1);
        return;
      } else {
        return; // res.json({ status: false, message: 'Something went wrong', code: 0 });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async sendNotification(res, userId, obj, collapsekey) {
    try {
      const unAssignUser = await User.find({ _id: { $in: userId } })
        .select('_id deviceToken')
        .lean();

      const usersDeviceTokens = [];
      for (let j = 0; j <= unAssignUser.length - 1; j++) {
        let token = unAssignUser[j];
        if (token.deviceToken) {
          usersDeviceTokens.push(token.deviceToken);
        }
      }
      let collapseKey = collapsekey;
      console.log(usersDeviceTokens, collapseKey);
      FCM.push(usersDeviceTokens, obj, collapseKey);
      // let collapseKey = 1; /*unique id for this particular ballot */
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }

  async dateList(req, res) {
    try {
      //console.log(req.body);
      const obj = {};
      obj.weekRangeStartsAt = moment(
        req.body.weekRangeStartsAt,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      obj.weekRangeEndsAt = moment(
        req.body.weekRangeEndsAt,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      obj.businessUnitId = req.body.businessUnitId;
      obj.userId = req.body.userId;
      const startDate = new Date(obj.weekRangeStartsAt);
      const endDate = new Date(obj.weekRangeEndsAt);
      const dateArray = getDates(startDate, endDate);
      function getDates(startDate, stopDate) {
        var dateArray = [];
        var currentDate = moment(startDate);
        var stopDate = moment(stopDate);
        while (currentDate <= stopDate) {
          dateArray.push(moment(currentDate).format('MM-DD-YYYY'));
          currentDate = moment(currentDate).add(1, 'days');
        }
        return dateArray;
      }
      AssignShift.find(
        {
          staff_id: obj.userId,
          businessUnitId: obj.businessUnitId,
          weekRangeStartsAt: obj.weekRangeStartsAt,
          weekRangeEndsAt: obj.weekRangeEndsAt,
        },
        { day: 1, _id: 0 },
      ).then((result) => {
        const userDate = [];
        result.forEach((item) => {
          if (!userDate.includes(item.day)) {
            userDate.push(item.day);
          }
        });
        Array.prototype.diff = function (a) {
          return this.filter(function (i) {
            return a.indexOf(i) < 0;
          });
        };
        const shiftNotPresent = dateArray.diff(userDate);
        res.json({ data: result, dateArray, userDate, shiftNotPresent });
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async getRole(req, res) {
    try {
      let where = {
        companyId: req.user.companyId,
        status: {
          $ne: 3 /* $ne => not equal*/,
        },
      };
      let findOrFindOne;
      /*if ID given then it acts as findOne which gives object else find which gives array of object*/
      if (req.body.roleId) {
        where._id = req.body.roleId;
        findOrFindOne = Appointment.findOne(where);
      } else findOrFindOne = Appointment.find(where);

      let roles = await findOrFindOne.lean();
      __.out(res, 201, {
        roles: roles,
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async readLog(req, res) {
    try {
      logInfo(`assginshift/log API Start!`, { name: req.user.name, staffId: req.user.staffId });
      const where = {
        businessUnitId: req.body.businessUnitId,
      };
      const data = await AssignShiftLog.find(where)
        .populate([
          {
            path: 'staff_id',
            select: 'name staffId',
          },
        ])
        .sort({ _id: -1 });
      logInfo(`assginshift/log API ends here!`, { name: req.user.name, staffId: req.user.staffId });
      return res.json({ status: true, data });
    } catch (err) {
      logError(`assginshift/log API, there is an error`, err.toString());
      __.out(res, 500, err);
    }
  }
  updateAssignShift(shiftDetailId, assginShiftId) {
    return new Promise(async (resolve, reject) => {
      const insertedShiftDetailsIdArray = [];
      insertedShiftDetailsIdArray.push(shiftDetailId);
      AssignShift.updateOne(
        {
          _id: assginShiftId,
        },
        {
          $set: {
            shiftDetailId: shiftDetailId,
            draftStatus: 1,
          },
        },
      )
        .then((result) => {
          //  console.log('updateshift', result);

          resolve(result);
        })
        .catch((err) => {
          reject(null);
        });
    });
  }
  getAllDraftShift(shiftId) {
    return new Promise((resolve, reject) => {
      AssignShift.find({ _id: { $in: shiftId } })
        .then((data) => {
          resolve(data);
        })
        .catch((err) => {
          reject(null);
        });
    });
  }
  addAppliedStaff(shiftId, shiftDetailsId, flexiStaff) {
    return new Promise((resolve, reject) => {
      const obj = {
        shiftId,
        shiftDetailsId,
        flexiStaff,
        status: 1,
      };
      new AppliedStaff(obj)
        .save()
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(null);
        });
    });
  }
  addShift(shift) {
    return new Promise((resolve, reject) => {
      const shiftObj = {
        businessUnitId: shift.businessUnitId,
        weekRangeStartsAt: shift.weekRangeStartsAt,
        weekRangeEndsAt: shift.weekRangeEndsAt,
        weekNumber: shift.weekNumber,
        plannedBy: shift.plannedBy,
        status: 1,
      };
      new Shift(shiftObj)
        .save()
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(null);
        });
    });
  }
  updateShift(shiftId, shiftDetailId, isSplitShift = false) {
    return new Promise((resolve, reject) => {
      if (!isSplitShift) {
        const insertedShiftDetailsIdArray = [];
        insertedShiftDetailsIdArray.push(shiftDetailId);
        Shift.updateOne(
          {
            _id: shiftId,
          },
          {
            $set: {
              shiftDetails: insertedShiftDetailsIdArray,
            },
          },
        )
          .then((result) => {
            //console.log('updateshift', result);
            resolve(result);
          })
          .catch((err) => {
            reject(null);
          });
      } else {
        Shift.updateOne(
          {
            _id: shiftId,
          },
          {
            $push: {
              shiftDetails: shiftDetailId,
            },
          },
        )
          .then((result) => {
            //console.log('updateshift', result);
            resolve(result);
          })
          .catch((err) => {
            reject(null);
          });
      }
    });
  }
  addShiftDetail(shiftDetail, shift) {
    return new Promise((resolve, reject) => {
      const shiftObj = {
        date: shiftDetail.date,
        startTime: shiftDetail.startTime,
        endTime: shiftDetail.endTime,
        reportLocationId: shiftDetail.reportLocationId,
        startTimeInSeconds: shiftDetail.startTimeInSeconds,
        endTimeInSeconds: shiftDetail.endTimeInSeconds,
        shiftId: shift._id,
        duration: shiftDetail.duration,
        day: shiftDetail.day,
        confirmedStaffs: shiftDetail.confirmedStaffs,
        subSkillSets: shiftDetail.subSkillSets,
        mainSkillSets: shiftDetail.mainSkillSets,
        skillSetTierType: shiftDetail.skillSetTierType,
        isAssignShift: true,
        draftId: shiftDetail._id,
        backUpStaffNeedCount: 0,
        staffNeedCount: 1,
        totalStaffNeedCount: 1,
        status: 1,
        isOff: shiftDetail.isOff,
        isRest: shiftDetail.isRest,
        isSplitShift: shiftDetail.isSplitShift,
        geoReportingLocation: shiftDetail.geoReportingLocation,
        proximity: shiftDetail.proximity,
        isCheckInEnabled: shiftDetail.isCheckInEnabled,
        isProximityEnabled: shiftDetail.isProximityEnabled,
        isParent: shiftDetail.isSplitShift ? 1 : null,
        randomShiftId: shiftDetail.isSplitShift ? shiftDetail.randomShiftId : null,
      };
      new ShiftDetails(shiftObj)
        .save()
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(null);
        });
    });
  }
  addShiftDetailSplit(shiftDetail, shift) {
    return new Promise((resolve, reject) => {
      const shiftObj = {
        date: shiftDetail.date,
        startTime: shiftDetail.splitStartTime,
        endTime: shiftDetail.splitEndTime,
        reportLocationId: shiftDetail.reportLocationId,
        startTimeInSeconds: shiftDetail.splitStartTimeInSeconds,
        endTimeInSeconds: shiftDetail.splitEndTimeInSeconds,
        shiftId: shift._id,
        duration: shiftDetail.duration,
        day: shiftDetail.day,
        confirmedStaffs: shiftDetail.confirmedStaffs,
        subSkillSets: shiftDetail.subSkillSets,
        mainSkillSets: shiftDetail.mainSkillSets,
        skillSetTierType: shiftDetail.skillSetTierType,
        isAssignShift: true,
        draftId: shiftDetail._id,
        backUpStaffNeedCount: 0,
        staffNeedCount: 1,
        totalStaffNeedCount: 1,
        status: 1,
        isOff: shiftDetail.isOff,
        isRest: shiftDetail.isRest,
        isSplitShift: true,
        isParent: 2,
        randomShiftId: shiftDetail.randomShiftId
      };
      new ShiftDetails(shiftObj)
        .save()
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(null);
        });
    });
  }
  updateShiftDetail(appliedId, shiftDetailId) {
    return new Promise((resolve, reject) => {
      const insertedShiftDetailsIdArray = [];
      insertedShiftDetailsIdArray.push(appliedId);
      ShiftDetails.updateOne(
        {
          _id: shiftDetailId,
        },
        {
          $set: {
            appliedStaffs: insertedShiftDetailsIdArray,
          },
        },
      )
        .then((result) => {
          //console.log('updateshift', result);
          resolve(result);
        })
        .catch((err) => {
          reject(null);
        });
    });
  }
  async getStaffById(req, res) {
    try {
      logInfo(`assginshift/stafflist/:staffId API Start!`, { name: req.user.name, staffId: req.user.staffId });
      let user = await User.findOne(
        {
          staffId: req.params.staffId,
          companyId: req.user.companyId,
          status: 1,
        },
        {
          _id: 1,
          mainSkillSets: 1,
          subSkillSets: 1,
        },
      ).populate([
        { path: 'mainSkillSets', select: 'name' },
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
      ]);
      const companySetup = await pageSetting.findOne(
        { companyId: req.user.companyId },
        { opsGroup: 1 },
      );
      const tierSetup = companySetup.opsGroup.tierType;
      user = JSON.parse(JSON.stringify(user));
      if (tierSetup == 1) {
        delete user.subSkillSets;
      } else {
        delete user.mainSkillSets;
      }

      logInfo(`assginshift/stafflist/:staffId API ends here!`, { name: req.user.name, staffId: req.user.staffId });
      res.json({
        status: true,
        isScheme: true,
        user,
        message: 'Week Data',
      });
    } catch (err) {
      logError(`assginshift/stafflist/:staffId API, there is an error`, err.toString());
      __.out(res, 500, err);
    }
  }
  async deleteShift(req, res) {
    try {
      logInfo(`assginshift/staff/delete API Start!`, { name: req.user.name, staffId: req.user.staffId });
      const assignShiftId = req.body.assignShiftId;
      if (assignShiftId.length == 1) {
        this.deleteShiftSingle(req, res);
      } else {
        const userId = req.body.userId;
        let shiftId = [];
        var schemeDetails = await User.findOne({ _id: userId }).populate([
          {
            path: 'schemeId',
          },
        ]);
        let shiftDetailsId = [];
        let redisBuId;
        let mondayDate;
        let redisTimeZone;
        const deleleResultArr = [];
        for (let i = 0; i < assignShiftId.length; i++) {
          const id = assignShiftId[i];
          deleleResultArr.push(
            this.deleteMultiple(res, id, userId, i, schemeDetails),
          );
        }
        const deleteResult = await Promise.all(deleleResultArr);
        logInfo(`assginshift/staff/delete API ends here!`, { name: req.user.name, staffId: req.user.staffId });
        return res
          .status(200)
          .json({ success: true, msg: 'Deleted Successfully' });
      }
    } catch (err) {
      logError(`assginshift/staff/delete API, there is an error`, err.toString());
      return res
        .status(500)
        .json({ success: false, msg: 'Something went wrong' });
    }
  }
  async deleteMultiple(res, id, userId, i, schemeDetails) {
    return new Promise(async (resolve, reject) => {
      const assignShiftData = await AssignShift.findOneAndRemove({
        _id: id,
        staff_id: userId,
      });
      console.log('assignShiftData', assignShiftData.businessUnitId, i);
      // if (assignShiftData) {
      //     this.updateRedis(assignShiftData.businessUnitId)
      // }
      if (
        assignShiftData &&
        !assignShiftData.isEmpty &&
        assignShiftData.duration != 0
      ) {
        const reduceData = await this.reduceLimitDelete(
          res,
          schemeDetails.schemeId,
          assignShiftData,
        );
      }
      if (assignShiftData && assignShiftData.shiftDetailId) {
        const shiftDetailData = await ShiftDetails.findOneAndRemove({
          _id: assignShiftData.shiftDetailId,
        });
        if (shiftDetailData) {
          const shiftData = await Shift.findOneAndRemove({
            _id: shiftDetailData.shiftId,
          });
        }
      }
      // if (i == 0) {
      let redisBuId = assignShiftData.businessUnitId;
      let mondayDate = this.getMondayDate(assignShiftData.weekRangeStartsAt);
      let redisTimeZone = assignShiftData.timeZone
        ? assignShiftData.timeZone
        : 'GMT+0800';
      resolve({ redisBuId, mondayDate, redisTimeZone });
    });
  }
  async deleteShiftSingle(req, res) {
    try {
      logInfo(`assginshift/staff/delete/single API Start!`, { name: req.user.name, staffId: req.user.staffId });
      const assignShiftId = req.body.assignShiftId;
      const userId = req.body.userId;
      var schemeDetails = await User.findOne({ _id: userId }).populate([
        {
          path: 'schemeId',
        },
      ]);
      let shiftId = [];
      let shiftDetailsId = [];
      let redisBuId;
      let mondayDate;
      let redisTimeZone;
      let i = 0;
      const id = assignShiftId[0];

      const assignShiftData = await AssignShift.findOneAndUpdate(
        { _id: id, staff_id: userId },
        {
          startTime: null,
          endTime: null,
          startTimeInSeconds: null,
          endTimeInSeconds: null,
          duration: 0,
          subSkillSets: [],
          reportLocationId: null,
          isOff: false,
          isRest: false,
          isLimit: null,
          schemeDetails: null,
          alertMessage: null,
          isAlert: null,
          isEmpty: true,
          draftStatus: 0,
        },
      );
      if (i == 0) {
        redisBuId = assignShiftData.businessUnitId;
        mondayDate = this.getMondayDate(assignShiftData.weekRangeStartsAt);
        redisTimeZone = assignShiftData.timeZone
          ? assignShiftData.timeZone
          : 'GMT+0800';
      }
      if (
        assignShiftData &&
        !assignShiftData.isEmpty &&
        assignShiftData.duration != 0
      ) {
        const reduceData = await this.reduceLimitDelete(
          res,
          schemeDetails.schemeId,
          assignShiftData,
        );
      }
      if (assignShiftData && assignShiftData.shiftDetailId) {
        const shiftDetailData = await ShiftDetails.findOneAndRemove({
          _id: assignShiftData.shiftDetailId,
        });
        if (shiftDetailData) {
          const shiftData = await Shift.findOneAndRemove({
            _id: shiftDetailData.shiftId,
          });
        }
      }
      logInfo(`assginshift/staff/delete/single API ends here!`, { name: req.user.name, staffId: req.user.staffId });
      return res
        .status(200)
        .json({ success: true, msg: 'Deleted Single Shift Successfully' });
    } catch (err) {
      logError(`assginshift/staff/delete/single API, there is an error`, err.toString());
      return res
        .status(500)
        .json({ success: false, msg: 'Something went wrong' });
    }
  }
  async readTierSetup(req, res) {
    try {
      let pageSettingData = await pageSetting.findOne(
        {
          companyId: req.user.companyId,
          status: 1,
        },
        { opsGroup: 1 },
      );
      const tierType = pageSettingData.opsGroup.tierType;
      return res.status(200).json({ tierType });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}
/* */
assignShift = new assignShift();
module.exports = assignShift;
