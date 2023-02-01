// Controller Code Starts here
const mongoose = require('mongoose'),
  AppliedStaffs = require('../../models/appliedStaff'),
  Shift = require('../../models/shift'),
  StaffLimit = require('../../models/staffLimit'),
  Scheme = require('../../models/scheme'),
  ShiftDetails = require('../../models/shiftDetails'),
  ShiftLog = require('../../models/shiftLog'),
  User = require('../../models/user'),
  ReportingLocation = require('../../models/reportingLocation'),
  staffShiftController = require('../staff/staffShiftController'),
  WeeklyStaffData = require('./weeklyStaffingController'),
  shiftLogController = require('./shiftLogController'),
  assignShiftController = require('./assignShiftController'),
  OtherNotification = require('../../models/otherNotifications'),
  moment = require('moment'),
  FCM = require('../../../helpers/fcm'),
  _ = require('lodash'),
  __ = require('../../../helpers/globalFunctions');
const async = require('async');
const AssignShift = require('../../models/assignShift');
const ObjectId = require('mongoose').Types.ObjectId;
const redisClient = require('../../../helpers/redis.js');
const redisData = require('../../../helpers/redisDataGenerator');
const ShiftHelper = require('../../../helpers/shiftHelper');
const AgendaCron = require('../../../helpers/agendaEventHandler');
const { logInfo, logError } = require('../../../helpers/logger.helper');
class shift {
  async updateRedis(businessUnitId) {
    console.log('before seting redis');
    const r = await redisData.readNewNextPromise(businessUnitId);
    return r;
  }
  getTimeZone() {
    return new Date().toString().match(/([A-Z]+[\+-][0-9]+)/)[1];
  }

  getDateInUTCFormat(date, time, timeZone) {
    let dateSplit = date.split('-');
    date = dateSplit[1] + '-' + dateSplit[0] + '-' + dateSplit[2];
    const dateTime = `${date} ${time} ${timeZone}`;
    console.log('DateTime', dateTime);
    return moment(dateTime, 'DD-MM-YYYY HH:mm:ss Z').utc().format();
  }

  async createStaff(res, userObj, req) {
    console.log(
      '--------------- INSIDE CREATE DAFF FUNCTION -------------------------------',
    );
    return new Promise(async (resolve, reject) => {
      try {
        const { shift, user } = userObj;
        const timeFormat = shift.timeFormat;
        const planBussinessUnitId = await User.findOne(
          { _id: req.user._id },
          { _id: 0, planBussinessUnitId: 1 },
        );
        const planBussinessUnitIdArr =
          planBussinessUnitId.planBussinessUnitId.map(
            (planBu) => planBu && planBu.toString(),
          );
        let shiftDetails = [];
        const csvLength = user.length;
        if (csvLength) {
          delete shift.timeFormat;
          shift.plannedBy = req.user._id;
          for (let userDetail of user) {
            const { staffId, dayDate } = userDetail;
            console.log(dayDate);
            try {
              let userInfo = await User.findOne(
                { staffId },
                {
                  _id: 1,
                  appointmentId: 1,
                  role: 1,
                  subSkillSets: 1,
                  parentBussinessUnitId: 1,
                  schemeId: 1,
                  name: 1,
                },
              ).populate([
                {
                  path: 'schemeId',
                  select: 'shiftSchemeType shiftSetup',
                },
              ]);
              if (userInfo) {
                if (
                  userInfo.schemeId &&
                  (userInfo.schemeId.shiftSchemeType == 2 ||
                    userInfo.schemeId.shiftSchemeType == 3)
                ) {
                  const shiftObj = {};
                  shiftObj.staffId = staffId;
                  shiftObj.businessUnitId = shift.businessUnitId;
                  shiftObj.weekRangeStartsAt = moment(
                    shift.weekRangeStartsAt,
                    'MM-DD-YYYY HH:mm:ss Z',
                  ).format();
                  shiftObj.weekRangeEndsAt = moment(
                    shift.weekRangeEndsAt,
                    'MM-DD-YYYY HH:mm:ss Z',
                  ).format();
                  shiftObj.startTime = this.getDateInUTCFormat(
                    dayDate.startDate,
                    dayDate.startTime,
                    timeFormat,
                  );
                  shiftObj.endTime = this.getDateInUTCFormat(
                    dayDate.endDate,
                    dayDate.endTime,
                    timeFormat,
                  );
                  if (shift.isSplit) {
                    shiftObj.splitStartTime = this.getDateInUTCFormat(
                      dayDate.startDate,
                      dayDate.startTime2,
                      timeFormat,
                    );
                    shiftObj.splitEndTime = this.getDateInUTCFormat(
                      dayDate.endDate,
                      dayDate.endTime2,
                      timeFormat,
                    );
                  }
                  shiftObj.plannedBy = req.user._id;
                  shiftObj.shiftScheme = userInfo.schemeId;
                  shiftObj.staff_id = userInfo._id;
                  shiftObj.name = userInfo.name;
                  shiftObj.staffAppointmentId = userInfo.appointmentId;
                  shiftObj.staffRoleId = userInfo.role;
                  shiftObj.subSkillSets = userInfo.subSkillSets;
                  shiftObj.confirmedStaffs = [];
                  shiftObj.confirmedStaffs[0] = userInfo._id;
                  //     console.log('shiftObj.endTime', shiftObj.endTime, moment(new Date(shiftObj.endTime), 'MM-DD-YYYY HH:mm:ss Z').utc().unix());
                  shiftObj.startTimeInSeconds = moment(
                    new Date(shiftObj.startTime),
                    'MM-DD-YYYY HH:mm:ss Z',
                  )
                    .utc()
                    .unix(); // new Date(shiftObj.startTime).getTime();
                  shiftObj.endTimeInSeconds = moment(
                    new Date(shiftObj.endTime),
                    'MM-DD-YYYY HH:mm:ss Z',
                  )
                    .utc()
                    .unix(); //new Date(shiftObj.endTime).getTime();
                  let dateSplit = dayDate.date.split('-');
                  userInfo.Date =
                    dateSplit[1] + '-' + dateSplit[0] + '-' + dateSplit[2];
                  shiftObj.day =
                    dateSplit[2] + '-' + dateSplit[1] + '-' + dateSplit[0];
                  shiftObj.date = moment(userInfo.Date, 'DD-MM-YYYY HH:mm:ss Z')
                    .utc()
                    .format();
                  shiftObj.weekNumber = __.weekNoStartWithMonday(
                    shift.weekRangeStartsAt,
                  ); //moment(shiftObj.date).format('ww');
                  var startSecond = new Date(shiftObj.startTime).getTime();
                  var endSecond = new Date(shiftObj.endTime).getTime();
                  shiftObj.duration = (endSecond - startSecond) / 3600000;
                  shiftObj.isSplitShift = shift.isSplit;
                  let locationFind = await ReportingLocation.findOne(
                    {
                      name: {
                        $regex: new RegExp(
                          `^${dayDate.reportLocationName}$`,
                          'i',
                        ),
                      },
                      status: 1,
                    },
                    { name: 1, _id: 1 },
                  );
                  if (locationFind) {
                    shiftObj.reportLocationId = locationFind._id;
                    shiftDetails.push({ shiftObj });
                  } else {
                    const createLocation = {
                      name: dayDate.reportLocationName,
                      companyId: '5a9d162b36ab4f444b4271c8',
                      status: 1,
                    };
                    let locationCreate = await new ReportingLocation(
                      createLocation,
                    ).save();
                    shiftObj.reportLocationId = locationCreate._id;
                    shiftDetails.push({ shiftObj });
                  }
                } else {
                  resolve({ code: 0, message: 'User have invalid scheme.' });
                }
              } else {
                resolve({ code: 0, message: 'User not found' });
              }
            } catch (err) {
              __.log(err);
              __.out(res, 500);
            }
          }
          resolve({ code: 1, shiftDetails });
        } else {
          resolve({ code: 0, message: 'User details not found' });
        }
      } catch (e) {
        console.log('Inside catch', e);
        reject(e);
      }
    });
  }

  async insertStaffDetail(res, userDetails, req) {
    return new Promise(async (resolve, reject) => {
      try {
        let counter = 0;
        for (let item of userDetails) {
          if (item) {
            const weekStart = __.weekNoStartWithMonday(
              item.shiftObj.weekRangeStartsAt,
            );
            const weekDate = __.weekNoStartWithMonday(item.shiftObj.date);
            const weekEnd = __.weekNoStartWithMonday(
              item.shiftObj.weekRangeEndsAt,
            );
            if (
              weekStart == weekDate ||
              weekDate == weekEnd ||
              (new Date(item.shiftObj.weekRangeStartsAt).getTime() <=
                new Date(item.shiftObj.date).getTime() &&
                new Date(item.shiftObj.weekRangeEndsAt).getTime() >=
                  new Date(item.shiftObj.date).getTime())
            ) {
              try {
                let shiftResult = await AssignShift.find({
                  staffId: item.shiftObj.staffId,
                  date: item.shiftObj.date,
                });
                if (shiftResult && shiftResult.length) {
                  console.log(
                    '-------------------------------INSIDE IF---------------------------',
                  );
                  const shiftAlreadyPresent = shiftResult.filter((shiftAl) => {
                    return (
                      new Date(shiftAl.startTime).getTime() ===
                        new Date(item.shiftObj.startTime).getTime() &&
                      new Date(shiftAl.endTime).getTime() ===
                        new Date(item.shiftObj.endTime).getTime()
                    );
                  });
                  if (shiftAlreadyPresent && shiftAlreadyPresent.length > 0) {
                    resolve({ code: 0, message: 'Shift already present' });
                  }
                  let shiftOverlapping = [];
                  if (shiftAlreadyPresent.length === 0) {
                    shiftOverlapping = shiftResult.filter((shiftOverl) => {
                      return (
                        (new Date(shiftOverl.startTime).getTime() <=
                          new Date(item.shiftObj.startTime).getTime() &&
                          new Date(shiftOverl.endTime).getTime() >=
                            new Date(item.shiftObj.startTime).getTime()) ||
                        (new Date(shiftOverl.startTime).getTime() <=
                          new Date(item.shiftObj.endTime).getTime() &&
                          new Date(shiftOverl.endTime).getTime() >=
                            new Date(item.shiftObj.endTime).getTime())
                      );
                    });
                    if (shiftOverlapping && shiftOverlapping.length)
                      resolve({ code: 0, message: 'Shift is overlapping' });
                  }
                  if (
                    shiftOverlapping.length === 0 &&
                    shiftAlreadyPresent.length === 0
                  ) {
                    console.log(
                      '===================Validation successfull=======================',
                    );
                    const isLimit = await assignShiftController.checkLimit(
                      item.shiftObj,
                    );
                    let isSave = true;
                    if (isLimit.limit) {
                      isLimitExceed = true;
                      if (isLimit.details.disallow) {
                        isSave = false;
                      } else if (isLimit.details.alert) {
                        resolve({
                          code: 0,
                          message: 'Staff timing limit is crossing for a',
                        });
                      }
                    }
                    if (isSave) {
                      delete item.shiftObj.shiftScheme;
                      console.log(
                        '---------------------------SAVING ASSINGED SHIFT----------------------------',
                      );
                      await new AssignShift(item.shiftObj).save();
                      counter++;
                    } else {
                      item.shiftObj.isLimit = true;
                    }
                  } else {
                    resolve({
                      code: 0,
                      message: 'Shift is overlapping or Time exceeding.',
                    });
                  }
                } else {
                  console.log(
                    '-------------------------------INSIDE ELSE---------------------------',
                  );
                  const isLimit = await assignShiftController.checkLimit(
                    item.shiftObj,
                  );
                  let isSave = true;
                  if (isLimit.limit) {
                    if (isLimit.details.disallow) {
                      isSave = false;
                    } else if (isLimit.details.alert) {
                      console.log('line248');
                      item.shiftObj.isLimit = true;
                    }
                  }
                  if (isSave) {
                    console.log('SAVING ASSIGN SHIFT');
                    delete item.shiftObj.shiftScheme;
                    console.log('LINE NO 277 SAVING ASSINGED SHIFT');
                    counter++;
                    await new AssignShift(item.shiftObj).save();
                    console.log(
                      '-----------------SAVED SUCCESSFULLY----------------',
                      item.shiftObj.date,
                    );
                  } else {
                    console.log('line265');
                    resolve({ code: 0, message: 'Shift is already present.' });
                  }
                }
              } catch (err) {
                __.log(err);
                __.out(res, 500);
              }
            } else {
              resolve({
                code: 0,
                message: 'Shift is not between the week',
              });
            }
          }
        }
        if (counter === userDetails.length) {
          resolve({ code: 1, message: 'Assigned shift saved successfully' });
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  async create(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let staffDetail = [];
      const {
        staffId,
        shiftType,
        isSplitShift,
        assignShiftDetails,
        weekRangeStartsAt,
        weekRangeEndsAt,
        businessUnitId,
      } = req.body;
      let shiftExecution = shiftType === 'Assign Shift' ? false : true;
      if (shiftType === 'Assign Shift') {
        const shiftDetails = {
          businessUnitId,
          weekRangeStartsAt,
          weekRangeEndsAt,
          weekNumber: moment(new Date().getMonth() + 1, 'MM-DD-YYYY').week(),
          plannedBy: '5a99744236ab4f444b42718e',
          isSplit: isSplitShift,
          timeFormat: this.getTimeZone(),
        };
        const finalObj = {
          shift: shiftDetails,
          user: assignShiftDetails,
        };
        try {
          const response = await this.createStaff(res, finalObj, req);
          // console.log(response.shiftDetails)
          if (response.code) {
            //calling other to insert user details
            const response2 = await this.insertStaffDetail(
              res,
              response.shiftDetails,
              req,
            );
            if (response2.code) {
              let userInfo = await User.findOne(
                { staffId },
                {
                  _id: 1,
                  appointmentId: 1,
                  role: 1,
                  subSkillSets: 1,
                  parentBussinessUnitId: 1,
                  schemeId: 1,
                  name: 1,
                },
              );
              if (userInfo) {
                staffDetail.push(userInfo._id);
                shiftExecution = true;
              }
            } else {
              await this.updateRedis(businessUnitId);
              return __.out(res, 300, response2.message);
            }
          } else {
            await this.updateRedis(businessUnitId);
            return __.out(res, 300, response.message);
          }
        } catch (e) {
          await this.updateRedis(businessUnitId);
          return __.out(res, 500, e.message);
        }
      }

      if (shiftExecution) {
        console.log(
          '---------------------Finally create shift-------------------',
        );
        let requiredResult1 = await __.checkRequiredFields(
          req,
          [
            'businessUnitId',
            'isTemplate',
            'weekRangeStartsAt',
            'weekRangeEndsAt',
            'shifts',
          ],
          'shift',
        );
        if (requiredResult1.status === false) {
          __.out(res, 400, requiredResult1.missingFields);
        } else {
          // Formatting Shift based on below functionalities
          let shiftsNewFormat = [];
          let isSplitShift = false;
          let separateShiftPerDay = function () {
            for (let elementData of req.body.shifts) {
              for (let elem of elementData.dayDate) {
                const randomShiftId = new mongoose.Types.ObjectId();
                let shiftSeparated = {
                  subSkillSets: elementData.subSkillSets,
                  mainSkillSets: elementData.mainSkillSets,
                  skillSetTierType: elementData.skillSetTierType,
                  staffNeedCount: elementData.staffNeedCount,
                  backUpStaffNeedCount: elementData.backUpStaffNeedCount || 0,
                  date: elem.date,
                  day: elem.day,
                  startTime: elem.startTime,
                  endTime: elem.endTime,
                  reportLocationId: elementData.reportLocationId,
                  status: elementData.status,
                  isSplitShift: elem.isSplitShift ? true : false,
                  isParent: elem.isSplitShift ? 1 : null,
                  randomShiftId: elem.isSplitShift ? randomShiftId : null,
                  geoReportingLocation: elementData.geoReportingLocation,
                };

                shiftsNewFormat.push(shiftSeparated);
                if (elem.isSplitShift) {
                  shiftsNewFormat.push({
                    subSkillSets: elementData.subSkillSets,
                    mainSkillSets: elementData.mainSkillSets,
                    skillSetTierType: elementData.skillSetTierType,
                    staffNeedCount: elementData.staffNeedCount,
                    backUpStaffNeedCount: elementData.backUpStaffNeedCount || 0,
                    date: elem.date,
                    day: elem.day,
                    startTime: elem.splitStartTime,
                    endTime: elem.splitEndTime,
                    reportLocationId: elementData.reportLocationId,
                    geoReportingLocation: elementData.geoReportingLocation,
                    status: elementData.status,
                    isSplitShift: elem.isSplitShift ? true : false,
                    isParent: 2,
                    randomShiftId,
                  });
                }
                if (shiftSeparated.isSplitShift) {
                  isSplitShift = true;
                }
              }
            }
            //  return res.json({shiftsNewFormat})
            req.body.shifts = shiftsNewFormat;
          };
          if (req.body.platform && req.body.platform == 'web') {
            separateShiftPerDay();
          }
          __.log(req.body.shifts, 'req.body.shifts');
          // End Formatting Shift based on below functionalities
          /*check required fields in shifts array of objects */
          let requiredResult2;
          if (req.body.skillSetTierType != 1) {
            requiredResult2 = await __.customCheckRequiredFields(
              req.body.shifts,
              [
                'subSkillSets',
                'staffNeedCount',
                'date',
                'startTime',
                'endTime',
                'reportLocationId',
                'status',
              ],
              'shiftDetails',
            );
          } else {
            requiredResult2 = await __.customCheckRequiredFields(
              req.body.shifts,
              [
                'mainSkillSets',
                'staffNeedCount',
                'date',
                'startTime',
                'endTime',
                'reportLocationId',
                'status',
              ],
              'shiftDetails',
            );
          }
          // 'backUpStaffNeedCount',
          if (requiredResult2.status === false) {
            __.out(res, 400, requiredResult2.missingFields);
          } else {
            /* Validate start and end time of shifts */
            for (let thisShift of req.body.shifts) {
              if (
                moment(thisShift.startTime, 'MM-DD-YYYY HH:mm:ss Z').isAfter(
                  moment(thisShift.startTime, 'MM-DD-YYYY HH:mm:ss Z'),
                )
              ) {
                __.out(res, 300, 'Invalid startTime or endTime');
                return;
              }
            }
            /* end of start and end time validation */
            var weeksStartsAtForPush = moment(
              req.body.weekRangeStartsAt,
              'MM-DD-YYYY HH:mm:ss Z',
            )
              .utc()
              .unix();
            var weeksEndsAtForPush = moment(
              req.body.weekRangeStartsAt,
              'MM-DD-YYYY HH:mm:ss Z',
            )
              .add(6, 'days')
              .add(23, 'hours')
              .add(59, 'minutes')
              .add(59, 'seconds')
              .utc()
              .unix();
            req.body.weekRangeEndsAt = moment(
              req.body.weekRangeStartsAt,
              'MM-DD-YYYY HH:mm:ss Z',
            )
              .add(6, 'days')
              .add(23, 'hours')
              .add(59, 'minutes')
              .add(59, 'seconds')
              .utc()
              .format();
            req.body.weekRangeStartsAt = moment(
              req.body.weekRangeStartsAt,
              'MM-DD-YYYY HH:mm:ss Z',
            )
              .utc()
              .format();
            req.body.weekNumber = await __.weekNoStartWithMonday(
              req.body.weekRangeStartsAt,
            );
            let insert = _.omit(req.body, [
              'shifts',
            ]); /*insert data except shifts */
            insert.plannedBy = req.user._id;
            insert.isSplitShift = isSplitShift;
            //create new model
            let insertedShift = await new Shift(insert).save(),
              insertedShiftId = insertedShift._id;
            let insertedShiftDetailsIdArray = [];

            for (let shiftObj of req.body.shifts) {
              //iteration function
              /*converting to utc time */
              shiftObj.startTimeInSeconds = moment(
                shiftObj.startTime,
                'MM-DD-YYYY HH:mm:ss Z',
              )
                .utc()
                .unix();
              shiftObj.endTimeInSeconds = moment(
                shiftObj.endTime,
                'MM-DD-YYYY HH:mm:ss Z',
              )
                .utc()
                .unix();
              const start = shiftObj.date;
              let formDate = start.split('-');
              console.log('date  ', start, formDate);
              const month = formDate[0];
              const day = formDate[1];
              const year = formDate[2].split(' ')[0];
              const dayfull = `${year}-${month}-${day}`;
              console.log('dayfull', dayfull);
              shiftObj.day = dayfull;
              let timeZoneArr = shiftObj.date.split('+');
              console.log('timeZoneArr', timeZoneArr);
              if (timeZoneArr.length === 2) {
                shiftObj.timeZone = '+' + timeZoneArr[1];
              } else {
                timeZoneArr = shiftObj.date.split('-')[1];
                console.log('timeZoneArr--', timeZoneArr);
                shiftObj.timeZone = '-' + timeZoneArr;
              }
              console.log(' shiftObj.timeZone', shiftObj.timeZone);
              shiftObj.date = moment(shiftObj.date, 'MM-DD-YYYY HH:mm:ss Z')
                .utc()
                .format();
              shiftObj.startTime = moment(
                shiftObj.startTime,
                'MM-DD-YYYY HH:mm:ss Z',
              )
                .utc()
                .format();
              shiftObj.endTime = moment(
                shiftObj.endTime,
                'MM-DD-YYYY HH:mm:ss Z',
              )
                .utc()
                .format();
              //shiftObj.day = `${new Date(shiftObj.startTime}`
              // const start = shiftObj.startTime;
              // let formDate = start.split('-');
              // console.log(start, formDate);
              // const year= formDate[0];
              // const month= formDate[1];
              // const day = formDate[2].split('T')[0];
              // const dayfull= `${year}-${month}-${day}`;
              // console.log(dayfull);
              // shiftObj.day = dayfull;
              // console.log(shiftObj.date, moment(shiftObj.startTime).format('HH:mm:ss Z'));
              // console.log('tome', shiftObj.startTime);
              // shiftObj.day = __.getDay(shiftObj.date);
              //const startTime = shiftObj.startTime.split('T')[1];
              // let d = moment.utc(shiftObj.date, "YYYY-MM-DD");
              // shiftObj.date = d.format("YYYY-MM-DD");
              // shiftObj.day = d.format("YYYY-MM-DD");
              //shiftObj.date = `${shiftObj.date}T${startTime}`;
              //shiftObj.date = moment(shiftObj.date, 'MM-DD-YYYY HH:mm:ss Z');
              //   console.log('shiftObj.dayshiftObj.day', shiftObj.date);
              shiftObj.duration = __.getDurationInHours(
                shiftObj.startTime,
                shiftObj.endTime,
              );
              shiftObj.shiftId = insertedShiftId;
              shiftObj.backUpStaffNeedCount =
                shiftObj.backUpStaffNeedCount || 0;
              shiftObj.totalStaffNeedCount =
                Number(shiftObj.staffNeedCount) +
                Number(shiftObj.backUpStaffNeedCount);
              shiftObj.isAssignShift =
                req.body.shiftType === 'Assign Shift' ? true : false;
              shiftObj.confirmedStaffs =
                req.body.shiftType === 'Assign Shift' ? staffDetail : [];
              console.log(shiftObj);
              let insertedShiftDetails = await new ShiftDetails(
                  shiftObj,
                ).save(),
                insertedShiftDetailsId = insertedShiftDetails._id;
              insertedShiftDetailsIdArray.push(
                mongoose.Types.ObjectId(insertedShiftDetailsId),
              );
              AgendaCron.addEvent(shiftObj.startTime, {
                shiftDetailId: insertedShiftDetailsId,
                type: 'BackupStaffRemoval',
              }, true).then((jobResult)=>{
                logInfo('Job added', jobResult)
              }).catch((jobError)=>{
                logError('Job add error', jobError)
              });
            }
            await Shift.findOneAndUpdate(
              {
                _id: insertedShiftId,
              },
              {
                $set: {
                  shiftDetails: insertedShiftDetailsIdArray,
                },
              },
            );
            var statusLogData = {
              userId: req.user._id,
              weekNumber: req.body.weekNumber,
              weekRangeStartsAt: req.body.weekRangeStartsAt,
              weekRangeEndsAt: req.body.weekRangeEndsAt,
              status: 1,
              /* shift created */
              businessUnitId: req.body.businessUnitId,
              shiftId: insertedShiftId,
            };

            var usersDeviceTokens = [];
            const { deviceTokens } = req.body;
            if (req.body.shiftType && req.body.shiftType === 'Assign Shift') {
              usersDeviceTokens = deviceTokens != null ? deviceTokens : [];
            } else
              usersDeviceTokens = await this.matchingStaffs(
                req.body.shifts,
                res,
              );
            if (usersDeviceTokens.length > 0) {
              /*   usersDeviceTokens = [...new Set(usersDeviceTokens)]; //removes duplicate*/
              var pushData = {
                  title: 'Book Now!',
                  body: 'shifts available',
                  bodyText: 'XXX - XXX shifts available',
                  bodyTime: [weeksStartsAtForPush, weeksEndsAtForPush],
                  bodyTimeFormat: ['dd MMM', 'dd MMM'],
                },
                collapseKey =
                  insertedShiftId; /*unique id for this particular shift */
              FCM.push(usersDeviceTokens, pushData, collapseKey);
            }
            this.updateRedis(businessUnitId);
            await shiftLogController.create(statusLogData, res);
            __.out(res, 201, 'Shift created sucessfully');
          }
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async createRestOff(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult1 = await __.checkRequiredFields(
        req,
        [
          'shiftDetailId',
          'startTime',
          'endTime',
          'reportLocationId',
          'isOffed',
          'isRested',
        ],
        'shift',
      );
      if (requiredResult1.status === false) {
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        let shiftObj = req.body;
        shiftObj.startTimeInSeconds = moment(
          shiftObj.startTime,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .unix();
        shiftObj.endTimeInSeconds = moment(
          shiftObj.endTime,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .unix();
        shiftObj.startTime = moment(shiftObj.startTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
        shiftObj.endTime = moment(shiftObj.endTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
        if (req.body.isSplitShift) {
          shiftObj.startTimeInSecondsSplit = moment(
            shiftObj.splitStartTime,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .unix();
          shiftObj.endTimeInSecondsSplit = moment(
            shiftObj.splitEndTime,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .unix();
          shiftObj.startTimeSplit = moment(
            shiftObj.splitStartTime,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .format();
          shiftObj.endTimeSplit = moment(
            shiftObj.splitEndTime,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .format();
          shiftObj.durationSplit = __.getDurationInHours(
            shiftObj.startTimeSplit,
            shiftObj.endTimeSplit,
          );
        }
        if (new Date().getTime() > new Date(shiftObj.startTime)) {
          return res.json({
            success: false,
            message: 'You can not create past date time shift',
          });
        }
        var shiftDetail = await ShiftDetails.findOne({
          _id: req.body.shiftDetailId,
        });
        // var isCross = await this.checkTimingCross(res, shiftDetail,shiftObj.startTime,shiftObj.endTime,shiftObj.userId);
        // if(isCross){
        //     return res.json({success: false,message:'Shift is overlapping'});
        // }
        // starttime, endtime,shiftDetails,userid
        console.log('shiftObj.startTime', shiftObj.startTime);
        shiftObj.duration = __.getDurationInHours(
          shiftObj.startTime,
          shiftObj.endTime,
        );
        var data = await ShiftDetails.findOneAndUpdate(
          { _id: req.body.shiftDetailId },
          {
            $set: {
              startTime: shiftObj.startTime,
              endTime: shiftObj.endTime,
              duration: shiftObj.duration,
              startTimeInSeconds: shiftObj.startTimeInSeconds,
              endTimeInSeconds: shiftObj.endTimeInSeconds,
              reportLocationId: shiftObj.reportLocationId,
              mainSkillSets: shiftObj.mainSkillSets,
              subSkillSets: shiftObj.subSkillSets,
              isRecalled: true,
              isSplitShift: req.body.isSplitShift,
            },
          },
          { new: true },
        );
        console.log('old data', data.startTime);
        if (req.body.isSplitShift) {
          data = JSON.parse(JSON.stringify(data));
          delete data._id;
          data.startTime = shiftObj.startTimeSplit;
          data.endTime = shiftObj.endTimeSplit;
          data.duration = shiftObj.durationSplit;
          data.startTimeInSeconds = shiftObj.startTimeInSecondsSplit;
          data.endTimeInSeconds = shiftObj.endTimeInSecondsSplit;
          console.log('data', data.startTime);
          const splitData = await ShiftDetails.create(data);
          const shiftUpdate = await Shift.findOneAndUpdate(
            { _id: splitData.shiftId },
            { $push: { shiftDetails: splitData._id } },
          );
          console.log('splitData', splitData._id);
        }
        var assignUpdate = await AssignShift.findOneAndUpdate(
          { _id: req.body.assignShiftId },
          {
            $set: {
              reportLocationId: shiftObj.reportLocationId,
              duration: shiftObj.duration,
              startTimeInSeconds: shiftObj.startTimeInSeconds,
              endTimeInSeconds: shiftObj.endTimeInSeconds,
              startTime: shiftObj.startTime,
              endTime: shiftObj.endTime,
              mainSkillSets: shiftObj.mainSkillSets,
              subSkillSets: shiftObj.subSkillSets,
              isRecalled: true,
              isRecallAccepted: 1,
            },
          },
        );
        if (req.body.isSplitShift) {
          var assignUpdate = await AssignShift.findOneAndUpdate(
            { _id: req.body.assignShiftId },
            {
              $inc: { duration: shiftObj.durationSplit },
              $set: {
                splitStartTimeInSeconds: shiftObj.startTimeInSecondsSplit,
                splitEndTimeInSeconds: shiftObj.endTimeInSecondsSplit,
                splitStartTime: shiftObj.startTimeSplit,
                splitEndTime: shiftObj.endTimeSplit,
                isSplitShift: true,
              },
            },
          );
        }
        if (data) {
          await this.updateRedis(assignUpdate.businessUnitId);
          var deviceToken = await User.findOne(
            { _id: req.body.userId },
            { _id: 0, deviceToken: 1 },
          );
          var arrDeviceToken = [deviceToken.deviceToken];
          console.log('arrDeviceToken', arrDeviceToken);
          var text = 'Off';
          if (data.isRest) {
            text = 'Rest';
          }
          var pushData = {
              title: 'Recall Request',
              body: `You have been recalled on ${text} day, please check shift details`,
              bodyText: 'XXX - XXX shifts available',
              bodyTime: [shiftObj.startTime, shiftObj.endTime],
              bodyTimeFormat: ['dd MMM', 'dd MMM'],
            },
            collapseKey =
              req.body.shiftDetailId; /*unique id for this particular shift */
          FCM.push(arrDeviceToken, pushData, collapseKey);
          Shift.findById(data.shiftId).then((shiftInfo) => {
            console.log('shiftInfo', shiftInfo);
            let statusLogData = {
              userId: req.body.userId,
              status: 15,
              /* shift created */
              shiftId: data.shiftId,
              weekRangeStartsAt: shiftInfo.weekRangeStartsAt,
              weekRangeEndsAt: shiftInfo.weekRangeEndsAt,
              weekNumber: shiftInfo.weekNumber,
              newTiming: {
                start: req.body.startTime,
                end: req.body.endTime,
              },
              businessUnitId: shiftInfo.businessUnitId,
              existingShift: data._id,
              isOff: data.isOff,
              isRest: data.isRest,
            };
            shiftLogController.create(statusLogData, res);
          });
          return res.json({
            success: true,
            message: 'Shift Created Successfully',
            data,
          });
        } else {
          return res.json({ success: false, message: 'Shift Not Found' });
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async splitShift(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult1 = await __.checkRequiredFields(
        req,
        [
          'businessUnitId',
          'isTemplate',
          'weekRangeStartsAt',
          'weekRangeEndsAt',
          'shifts',
        ],
        'shift',
      );
      if (requiredResult1.status === false) {
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        // Formatting Shift based on below functionalities
        let shiftsNewFormat = [];
        const buIdRedis = req.body.businessUnitId;
        let separateShiftPerDay = function () {
          for (let elementData of req.body.shifts) {
            for (let elem of elementData.dayDate) {
              console.log('ddddare', elem.date);
              let shiftSeparated = {
                subSkillSets: elementData.subSkillSets,
                staffNeedCount: elementData.staffNeedCount,
                backUpStaffNeedCount: elementData.backUpStaffNeedCount || 0,
                date: elem.date,
                day: elem.day,
                startTime: elem.startTime,
                endTime: elem.endTime,
                reportLocationId: elementData.reportLocationId,
                status: elementData.status,
                isSplitShift: req.body.isSplitShift,
              };
              shiftsNewFormat.push(shiftSeparated);
            }
          }
          req.body.shifts = shiftsNewFormat;
        };
        if (req.body.platform && req.body.platform == 'web') {
          separateShiftPerDay();
        }
        __.log(req.body.shifts, 'req.body.shifts');
        // End Formatting Shift based on below functionalities
        /*check required fields in shifts array of objects */
        let requiredResult2 = await __.customCheckRequiredFields(
          req.body.shifts,
          [
            'subSkillSets',
            'staffNeedCount',
            'date',
            'startTime',
            'endTime',
            'reportLocationId',
            'status',
          ],
          'shiftDetails',
        );
        // 'backUpStaffNeedCount',
        if (requiredResult2.status === false) {
          __.out(res, 400, requiredResult2.missingFields);
        } else {
          /* Validate start and end time of shifts */
          for (let thisShift of req.body.shifts) {
            if (
              moment(thisShift.startTime, 'MM-DD-YYYY HH:mm:ss Z').isAfter(
                moment(thisShift.startTime, 'MM-DD-YYYY HH:mm:ss Z'),
              )
            ) {
              __.out(res, 300, 'Invalid startTime or endTime');
              return;
            }
          }
          /* end of start and end time validation */
          var weeksStartsAtForPush = moment(
            req.body.weekRangeStartsAt,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .unix();
          var weeksEndsAtForPush = moment(
            req.body.weekRangeStartsAt,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .add(6, 'days')
            .add(23, 'hours')
            .add(59, 'minutes')
            .add(59, 'seconds')
            .utc()
            .unix();
          req.body.weekRangeEndsAt = moment(
            req.body.weekRangeStartsAt,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .add(6, 'days')
            .add(23, 'hours')
            .add(59, 'minutes')
            .add(59, 'seconds')
            .utc()
            .format();
          req.body.weekRangeStartsAt = moment(
            req.body.weekRangeStartsAt,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .format();
          req.body.weekNumber = await __.weekNoStartWithMonday(
            req.body.weekRangeStartsAt,
          );
          let insert = _.omit(req.body, [
            'shifts',
          ]); /*insert data except shifts */
          insert.plannedBy = req.user._id;
          //create new model
          let insertedShift = await new Shift(insert).save(),
            insertedShiftId = insertedShift._id,
            insertedShiftDetailsIdArray = [];
          //console.log('req.body.shiftsreq.body.shifts', req.body.shifts);
          for (let shiftObj of req.body.shifts) {
            //iteration function
            /*converting to utc time */
            shiftObj.startTimeInSeconds = moment(
              shiftObj.startTime,
              'MM-DD-YYYY HH:mm:ss Z',
            )
              .utc()
              .unix();
            shiftObj.endTimeInSeconds = moment(
              shiftObj.endTime,
              'MM-DD-YYYY HH:mm:ss Z',
            )
              .utc()
              .unix();
            shiftObj.date = moment(shiftObj.date, 'MM-DD-YYYY HH:mm:ss Z')
              .add(1, 'days')
              .utc()
              .format();
            shiftObj.startTime = moment(
              shiftObj.startTime,
              'MM-DD-YYYY HH:mm:ss Z',
            )
              .utc()
              .format();
            shiftObj.endTime = moment(shiftObj.endTime, 'MM-DD-YYYY HH:mm:ss Z')
              .utc()
              .format();
            // console.log(shiftObj.date, moment(shiftObj.startTime).format('HH:mm:ss Z'));
            // console.log('tome', shiftObj.startTime);
            // shiftObj.day = __.getDay(shiftObj.date);
            const startTime = shiftObj.startTime.split('T')[1];
            let d = moment.utc(shiftObj.date, 'YYYY-MM-DD');
            shiftObj.date = d.format('YYYY-MM-DD');
            shiftObj.day = d.format('YYYY-MM-DD');
            //shiftObj.date = `${shiftObj.date}T${startTime}`;
            console.log('shiftObj.dayshiftObj.day', shiftObj.date);
            //shiftObj.date = moment(shiftObj.date, 'MM-DD-YYYY HH:mm:ss Z');
            //   console.log('shiftObj.dayshiftObj.day', shiftObj.date);
            shiftObj.duration = __.getDurationInHours(
              shiftObj.startTime,
              shiftObj.endTime,
            );
            shiftObj.shiftId = insertedShiftId;
            shiftObj.backUpStaffNeedCount = shiftObj.backUpStaffNeedCount || 0;
            shiftObj.totalStaffNeedCount =
              Number(shiftObj.staffNeedCount) +
              Number(shiftObj.backUpStaffNeedCount);
            shiftObj.isAssignShift =
              req.body.shiftType === 'Assign Shift' ? true : false;
            let insertedShiftDetails = await new ShiftDetails(shiftObj).save(),
              insertedShiftDetailsId = insertedShiftDetails._id;
            insertedShiftDetailsIdArray.push(
              mongoose.Types.ObjectId(insertedShiftDetailsId),
            );
          }
          await Shift.findOneAndUpdate(
            {
              _id: insertedShiftId,
            },
            {
              $set: {
                shiftDetails: insertedShiftDetailsIdArray,
              },
            },
          );
          var statusLogData = {
            userId: req.user._id,
            weekNumber: req.body.weekNumber,
            weekRangeStartsAt: req.body.weekRangeStartsAt,
            weekRangeEndsAt: req.body.weekRangeEndsAt,
            status: 1,
            /* shift created */
            businessUnitId: req.body.businessUnitId,
            shiftId: insertedShiftId,
          };
          var usersDeviceTokens = [];
          if (req.body.shiftType && req.body.shiftType === 'Assign Shift') {
            usersDeviceTokens = req.body.deviceTokens;
          } else
            usersDeviceTokens = await this.matchingStaffs(req.body.shifts, res);
          if (usersDeviceTokens.length > 0) {
            /*   usersDeviceTokens = [...new Set(usersDeviceTokens)]; //removes duplicate*/
            var pushData = {
                title: 'Book Now!',
                body: 'shifts available',
                bodyText: 'XXX - XXX shifts available',
                bodyTime: [weeksStartsAtForPush, weeksEndsAtForPush],
                bodyTimeFormat: ['dd MMM', 'dd MMM'],
              },
              collapseKey =
                insertedShiftId; /*unique id for this particular shift */
            FCM.push(usersDeviceTokens, pushData, collapseKey);
          }
          shiftLogController.create(statusLogData, res);
          await this.updateRedis(buIdRedis);
          __.out(res, 201, 'Shift created sucessfully');
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async read(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult1 = await __.checkRequiredFields(req, [
        'businessUnitId',
        'startDate',
      ]);
      if (requiredResult1.status === false) {
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        var where = {
            status: 1,
          },
          findOrFindOne;
        var timeZone = moment
            .parseZone(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .format('Z'),
          startDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format(),
          endDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .add(6, 'days')
            .add(23, 'hours')
            .add(59, 'minutes')
            .add(59, 'seconds')
            .utc()
            .format(); //86399 => add 23:59:59
        const aa = new Date(startDate).setUTCHours(0, 0, 0, 0);
        const bb = new Date(endDate).setUTCHours(23, 59, 59, 0);
        startDate = new Date(aa);
        endDate = new Date(bb);
        var startUnixDateTime = moment(startDate).unix(),
          endUnixDateTime = moment(endDate).unix();
        var weekNumber = await __.weekNoStartWithMonday(startDate);
        where.date = {
          $gte: startDate,
          $lte: endDate,
        };
        //where.weekNumber = weekNumber;
        // Show Cancelled Shifts Also
        if (req.body.cancelledShifts && req.body.cancelledShifts === true) {
          where.status = {
            $in: [1, 2],
          };
        }
        if (req.body.shiftDetailsId) {
          where._id = req.body.shiftDetailsId;
          findOrFindOne = ShiftDetails.findOne(where);
        } else findOrFindOne = ShiftDetails.find(where);

        let shifts = await findOrFindOne
          .populate([
            {
              path: 'draftId',
              select:
                'shiftRead shiftChangeRequestStatus shiftChangeRequestMessage',
            },
            {
              path: 'shiftId',
              select: '-shiftDetails',
              match: {
                businessUnitId: req.body.businessUnitId,
              },
              populate: [
                {
                  path: 'plannedBy',
                  select: 'name staffId',
                },
                {
                  path: 'businessUnitId',
                  select:
                    'name adminEmail techEmail shiftCancelHours cancelShiftPermission standByShiftPermission status',
                  match: {
                    status: 1,
                  },
                  populate: {
                    path: 'sectionId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                    populate: {
                      path: 'departmentId',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'companyId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                  },
                },
              ],
            },
            {
              path: 'reportLocationId',
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
              path: 'confirmedStaffs',
              select:
                'name email contactNumber profilePicture subSkillSets status,schemeId',
              populate: [
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
                  path: 'schemeId',
                  select: 'shiftSetup',
                  match: {
                    status: true,
                  },
                },
              ],
            },
            {
              path: 'backUpStaffs',
              select:
                'name email contactNumber profilePicture subSkillSets status,schemeId',
              populate: [
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
                  path: 'schemeId',
                  select: 'shiftSetup',
                  match: {
                    status: true,
                  },
                },
              ],
            },
            {
              path: 'requestedShifts',
            },
            {
              path: 'currentReqShift',
              populate: {
                path: 'reportLocationId',
                select: 'name status',
                match: {
                  status: 1,
                },
              },
            },
            {
              path: 'requestedUsers.userId',
              match: {
                status: 1,
              },
              populate: {
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
            },
          ])
          .sort({
            startTime: 1,
          });

        if (!req.body.shiftDetailsId) {
          var listData = {},
            graphData = {},
            graphDataWeb = {},
            dashboardGraphData = {
              plannedFlexiHours: 0,
              plannedFlexiShifts: 0,
              bookedFlexiHours: 0,
              bookedFlexiShifts: 0,
            },
            customShiftDetails = [];
          //  return res.json({shifts});
          await shifts.forEach((element) => {
            if (
              (element.subSkillSets &&
                element.subSkillSets.length &&
                element.reportLocationId &&
                element.shiftId &&
                element.shiftId.businessUnitId) ||
              element.isAssignShift
            ) {
              let tz = element.timeZone;
              if (!tz) {
                tz = '+0800';
              }
              var key = __.getDateStringFormat(element.date, tz);
              // Remove Cancelled Shifts on Calculation
              if (element.status == 1) {
                /*dashboard graph data starts*/
                var confirmedStaffsCount = element.confirmedStaffs.length;
                dashboardGraphData.plannedFlexiHours +=
                  element.staffNeedCount * element.duration;
                dashboardGraphData.plannedFlexiShifts += element.staffNeedCount;
                dashboardGraphData.bookedFlexiHours +=
                  confirmedStaffsCount * element.duration;
                dashboardGraphData.bookedFlexiShifts += confirmedStaffsCount;
              }
              /*dashboard graph data ends */
              // Remove Cancelled Shifts on Calculation
              if (listData[key]) {
                /*if date already keyed in array */
                listData[key].push(element);
                // Add Hours in calculation only it is active shift
                console.log('element.isAssignShift', element.isAssignShift);
                if (element.status == 1 && !element.isAssignShift) {
                  graphData[key].totalHours +=
                    element.duration * element.staffNeedCount;
                  graphData[key].totalShifts += element.staffNeedCount;
                  graphDataWeb[key].totalHours.need +=
                    element.duration * element.staffNeedCount;
                  graphDataWeb[key].totalHours.booked +=
                    element.duration * element.confirmedStaffs.length;
                  graphDataWeb[key].numberOfShifts.need +=
                    element.staffNeedCount;
                  graphDataWeb[key].numberOfShifts.booked +=
                    element.confirmedStaffs.length;
                }
              } else {
                /*else create a new key by date in array */
                listData[key] = [];
                listData[key].push(element);
                graphData[key] = {};
                graphData[key].totalHours = 0;
                graphData[key].totalShifts = 0;
                graphData[key].totalHoursAssign = 0;
                graphData[key].totalShiftsAssign = 0;
                graphDataWeb[key] = {
                  totalHours: {
                    need: 0,
                    booked: 0,
                    needAssign: 0,
                  },
                  numberOfShifts: {
                    need: 0,
                    booked: 0,
                    needAssign: 0,
                  },
                };
                // Add Hours in calculation only it is active shift
                console.log('element.isAssignShift', element.isAssignShift);
                if (element.status == 1 && !element.isAssignShift) {
                  graphData[key].totalHours =
                    element.duration * element.staffNeedCount;
                  graphData[key].totalShifts = element.staffNeedCount;
                  graphDataWeb[key] = {
                    totalHours: {
                      need: element.duration * element.staffNeedCount,
                      booked: element.duration * element.confirmedStaffs.length,
                    },
                    numberOfShifts: {
                      need: element.staffNeedCount,
                      booked: element.confirmedStaffs.length,
                    },
                  };
                }
              }
              var customElement = _.omit(element, [
                'shiftId',
                'reportLocationId',
                'subSkillSets',
              ]);
              customShiftDetails.push(customElement);
            }
          });
          /*weeklyGraph starts */
          var staffNeedWeekdaysObj = {
              monday: {},
              tuesday: {},
              wednesday: {},
              thursday: {},
              friday: {},
              saturday: {},
              sunday: {},
            },
            staffAppliedWeekdaysObj = _.cloneDeep(staffNeedWeekdaysObj);
          for (var i = startUnixDateTime; i <= endUnixDateTime; i += 1800) {
            var dateTimeUnix = i * 1000;
            await customShiftDetails.forEach(async (element) => {
              var weekDay = __.getDayStringFormatFromUnix(i, timeZone),
                staffNeedCount = 0,
                appliedStaffCount = 0;
              if (
                i >= element.startTimeInSeconds &&
                i <= element.endTimeInSeconds
              ) {
                /*shift matches the time then it will take the count else it will assign 0 by default */
                staffNeedCount = element.staffNeedCount;
                appliedStaffCount = element.confirmedStaffs.length;
              }
              if (
                typeof staffNeedWeekdaysObj[weekDay][dateTimeUnix] !=
                'undefined'
              ) {
                /*dont change to if condition bcoz it may be zero so it fails in it*/
                staffNeedWeekdaysObj[weekDay][dateTimeUnix] += staffNeedCount;
              } else {
                staffNeedWeekdaysObj[weekDay][dateTimeUnix] = staffNeedCount;
              }
              if (
                typeof staffAppliedWeekdaysObj[weekDay][dateTimeUnix] !=
                'undefined'
              ) {
                /*dont change to if condition bcoz it may be zero so it fails in it*/ staffAppliedWeekdaysObj[
                  weekDay
                ][dateTimeUnix] += appliedStaffCount;
              } else {
                staffAppliedWeekdaysObj[weekDay][dateTimeUnix] =
                  appliedStaffCount;
              }
            });
          }
          // deleteMany
          /*FORMAT THE RESPONSE (for both need and applied datas) AS {'monday':[[1514223000000,2],[1514223000000,2]],'tuesday':[[1514223000000,2],[1514223000000,2]],....} */
          var formattedAppliedStaffData = {},
            formattedNeedStaffData = {};
          for (var appliedElement in staffAppliedWeekdaysObj) {
            formattedAppliedStaffData[appliedElement] = [];
            for (var time in staffAppliedWeekdaysObj[appliedElement]) {
              var array = [
                Number(time),
                Number(staffAppliedWeekdaysObj[appliedElement][time]),
              ];
              formattedAppliedStaffData[appliedElement].push(array);
            }
          }
          for (var needElement in staffNeedWeekdaysObj) {
            formattedNeedStaffData[needElement] = [];
            for (var time in staffNeedWeekdaysObj[needElement]) {
              var array = [
                Number(time),
                Number(staffNeedWeekdaysObj[needElement][time]),
              ];
              formattedNeedStaffData[needElement].push(array);
            }
          }

          var data = {
              businessUnitId: req.body.businessUnitId,
              weekNumber: weekNumber,
            },
            clientWeeklyStaffData = await WeeklyStaffData.weeklyStaffingData(
              data,
              res,
            ),
            weeklyStaffGraphData = {
              clientFlexiStaffData: {},
              clientStaffData: {},
              staffNeedData: formattedNeedStaffData,
              staffAppliedData: formattedAppliedStaffData,
            };

          if (clientWeeklyStaffData) {
            if (clientWeeklyStaffData.flexiStaffData)
              weeklyStaffGraphData.clientFlexiStaffData =
                clientWeeklyStaffData.flexiStaffData;
            if (clientWeeklyStaffData.staffData)
              weeklyStaffGraphData.clientStaffData =
                clientWeeklyStaffData.staffData;
          }

          /*weeklyGraph ends */
          var updatedDashboardGraphData = {};
          for (let each in dashboardGraphData) {
            updatedDashboardGraphData[each] =
              dashboardGraphData[each].toFixed(2);
          }
          __.log(req.body, 'shift/read params');
          // __.log(listData)
          var templistData = JSON.stringify(listData);
          listData = JSON.parse(templistData);
          for (let date in listData) {
            listData[date].forEach((item, index) => {
              if (item.isExtendedShift) {
                //console.log('present');
                if (item.extendedStaff) {
                  item.extendedStaff.forEach((extendedStaffItem) => {
                    if (item.confirmedStaffs) {
                      item.confirmedStaffs.forEach((confirmedStaffsItem) => {
                        // console.log(typeof confirmedStaffs._id, confirmedStaffs._id,extendedStaff.userId )
                        if (
                          confirmedStaffsItem._id.toString() ===
                          extendedStaffItem.userId.toString()
                        ) {
                          confirmedStaffsItem.confirmStatus =
                            extendedStaffItem.confirmStatus;
                          confirmedStaffsItem.endDateTime =
                            extendedStaffItem.endDateTime;
                          confirmedStaffsItem.startDateTime =
                            extendedStaffItem.startDateTime;
                          console.log('match');
                        }
                      });
                    }
                  });
                }
              }
              if (item.isSplitShift) {
                listData[date].forEach((splitItem, splitIndex) => {
                  if (splitIndex !== index) {
                    if (
                      splitItem.isSplitShift &&
                      new Date(splitItem.date).getTime() ===
                        new Date(item.date).getTime() &&
                      splitItem.shiftId._id === item.shiftId._id
                    ) {
                      item.splitShiftStartTime = splitItem.startTime;
                      item.splitShiftEndTime = splitItem.endTime;
                      item.splitShiftId = splitItem._id;
                      listData[date].splice(splitIndex, 1);
                    }
                  }
                });
              }
            });
          }
          __.out(res, 201, {
            list: listData,
            graph: graphData,
            graphDataWeb: graphDataWeb,
            dashboardGraphData: updatedDashboardGraphData,
            weeklyStaffGraphData: weeklyStaffGraphData,
          });
        } else {
          __.out(res, 201, {
            shifts: shifts,
          });
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  setRedisData(key, data) {
    redisClient.set(key, JSON.stringify(data), 'EX', 10 * 60, (err) => {
      //cache for 10mins
      //other operations will go here
      //probably respond back to the request
    });
  }
  async readNew(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      console.log('callee');
      let requiredResult1 = await __.checkRequiredFields(req, [
        'businessUnitId',
        'startDate',
      ]);
      if (requiredResult1.status === false) {
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        var where = {
            status: 1,
          },
          findOrFindOne;
        console.log(req.body);
        const currentDateR = req.body.startDate.split(' ')[0];
        const redisKey = `shiftR${req.body.businessUnitId}${currentDateR}`;
        console.log('read API KEY redisKey', redisKey);
        // const redisData = await redisClient.get(`${redisKey}`);
        // if (redisData) {
        //     console.log("DATATATATATA Present")
        //     return __.out(res, 201, JSON.parse(redisData));
        // }
        var timeZone = moment
            .parseZone(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .format('Z'),
          startDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format(), //.add(1,'days') remove to get monday shift
          endDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .add(5, 'days')
            .add(23, 'hours')
            .add(60, 'minutes')
            .add(59, 'seconds')
            .utc()
            .format(); //86399 => add 23:59:59
        console.log('startDate11', startDate);
        console.log('endsdhhd', endDate);
        console.log('timeZonetimeZone', timeZone);
        const aa = new Date(startDate).setUTCHours(0, 0, 0, 0);
        const bb = new Date(endDate).setUTCHours(24, 0, 0, 0);
        startDate = new Date(aa);
        endDate = new Date(bb);
        console.log('startDate', startDate);
        console.log('endddd', endDate);
        var startUnixDateTime = moment(startDate).unix(),
          endUnixDateTime = moment(endDate).unix();
        const ddd = moment(new Date(req.body.startDate))
          .utc()
          .format('MM-DD-YYYY HH:mm:ss Z');
        const year = new Date(ddd).getFullYear();
        const month = new Date(ddd).getMonth() + 1;
        const day = new Date(ddd).getDate(); //-1; // remove comment for local
        console.log('yy', year, month, day);
        const whereShift = {
          //  staff_id:{$in: usersOfBu},
          businessUnitId: req.body.businessUnitId,
          status: 1,
          $and: [
            { $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, year] } },
            { $expr: { $eq: [{ $month: '$weekRangeStartsAt' }, month] } },
            { $expr: { $eq: [{ $dayOfMonth: '$weekRangeStartsAt' }, day] } },
          ],
        };
        var shift = await Shift.find(whereShift).select('shiftDetails').lean();
        console.log('shofttttt', shift.length);
        function plucker(prop) {
          return function (o) {
            return o[prop];
          };
        }
        var shiftDetailsArray = shift.map(plucker('shiftDetails'));
        shiftDetailsArray = _.flatten(shiftDetailsArray);
        shiftDetailsArray = Array.from(new Set(shiftDetailsArray));
        // return res.json({shiftDetailsArray})
        var weekNumber = await __.weekNoStartWithMonday(startDate);
        where = {
          status: 1,
          _id: {
            $in: shiftDetailsArray,
          },
        };
        where.date = {
          $gte: startDate,
          $lte: endDate,
        };
        //where.weekNumber = weekNumber;
        // Show Cancelled Shifts Also
        if (req.body.cancelledShifts && req.body.cancelledShifts === true) {
          where.status = {
            $in: [1, 2],
          };
        }
        if (req.body.shiftDetailsId) {
          where._id = req.body.shiftDetailsId;
          findOrFindOne = ShiftDetails.findOne(where);
        } else findOrFindOne = ShiftDetails.find(where);
        // console.log(findOrFindOne)
        // return res.send(findOrFindOne)
        let shifts = await findOrFindOne
          .populate([
            { path: 'appliedStaffs' },
            {
              path: 'draftId',
              select:
                'shiftRead shiftChangeRequestStatus shiftChangeRequestMessage',
            },
            {
              path: 'shiftId',
              select: '-shiftDetails',
              match: {
                businessUnitId: mongoose.Types.ObjectId(
                  req.body.businessUnitId,
                ),
              },
              populate: [
                {
                  path: 'plannedBy',
                  select: 'name staffId',
                },
                {
                  path: 'businessUnitId',
                  select:
                    'name adminEmail techEmail shiftCancelHours cancelShiftPermission standByShiftPermission status',
                  match: {
                    status: 1,
                  },
                  populate: {
                    path: 'sectionId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                    populate: {
                      path: 'departmentId',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'companyId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                  },
                },
              ],
            },
            {
              path: 'reportLocationId',
              select: 'name status',
              match: {
                status: 1,
              },
            },
            {
              path: 'geoReportingLocation',
              select: 'name status',
              match: {
                status: 'active',
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
              path: 'mainSkillSets',
              select: 'name status',
              match: {
                status: 1,
              },
            },
            {
              path: 'confirmedStaffs',
              select:
                'name email contactNumber profilePicture subSkillSets mainSkillSets status,schemeId staffId',
              populate: [
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
                  path: 'mainSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
                {
                  path: 'schemeId',
                  select: 'shiftSetup ',
                  match: {
                    status: true,
                  },
                },
              ],
            },
            {
              path: 'backUpStaffs',
              select:
                'name email contactNumber profilePicture mainSkillSets subSkillSets status,schemeId staffId',
              populate: [
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
                  path: 'mainSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
                {
                  path: 'schemeId',
                  select: 'shiftSetup',
                  match: {
                    status: true,
                  },
                },
              ],
            },
            {
              path: 'requestedShifts',
            },
            {
              path: 'currentReqShift',
              populate: {
                path: 'reportLocationId',
                select: 'name status',
                match: {
                  status: 1,
                },
              },
            },
            {
              path: 'requestedUsers.userId',
              match: {
                status: 1,
              },
              populate: [
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
                  path: 'mainSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
              ],
            },
          ])
          .sort({
            startTime: -1,
          });
        console.log(' req.body.from', req.body.from);
        if (!req.body.shiftDetailsId) {
          var listData = {},
            graphData = {},
            graphDataWeb = {},
            dashboardGraphData = {
              plannedFlexiHours: 0,
              plannedFlexiShifts: 0,
              bookedFlexiHours: 0,
              bookedFlexiShifts: 0,
              assignFlexiHours: 0,
              assignFlexiShifts: 0,
              assignFlexiStaff: 0,
            },
            customShiftDetails = [];
          shifts = shifts.filter((iii) => {
            return iii.shiftId;
          });
          //return res.json({shifts});
          await shifts.forEach((element) => {
            element = JSON.parse(JSON.stringify(element));
            //console.log('element', element.isAssignShift)
            let totalExtension = 0;
            let totalExtensionHrs = 0;
            if (
              (element.shiftId && element.shiftId.businessUnitId) ||
              element.isAssignShift
            ) {
              let tz = element.timeZone;
              if (!tz) {
                tz = '+0800';
              }
              var key = __.getDateStringFormat(element.date, tz);
              for (let ki = 0; ki < element.confirmedStaffs.length; ki++) {
                // console.log("I am here in comfired")
                const uCI = element.confirmedStaffs[ki];
                let startDI = element.startTime;
                let endDI = element.endTime;
                if (element.isExtendedShift) {
                  const uCIResult = element.extendedStaff.filter((uI) => {
                    return uI.userId.toString() == uCI._id;
                  });
                  if (uCIResult.length > 0) {
                    if (uCIResult[0]) {
                      totalExtension = totalExtension + 1;
                      totalExtensionHrs =
                        totalExtensionHrs + uCIResult[0].duration;
                    }
                    startDI = uCIResult[0].startDateTime;
                    endDI = uCIResult[0].endDateTime;
                  }
                }
                element.confirmedStaffs[ki].startTime = moment(
                  new Date(startDI),
                )
                  .utcOffset(timeZone)
                  .format('HH:mm');
                element.confirmedStaffs[ki].endTime = moment(new Date(endDI))
                  .utcOffset(timeZone)
                  .format('HH:mm');
                element.confirmedStaffs[ki].startDate = moment(
                  new Date(startDI),
                )
                  .utcOffset(timeZone)
                  .format('DD-MM-YYYY');
                element.confirmedStaffs[ki].endDate = moment(new Date(endDI))
                  .utcOffset(timeZone)
                  .format('DD-MM-YYYY');
              }
              if (element.status == 1) {
                /*dashboard graph data starts*/
                //console.log('element.isAssignShift', element.isAssignShift)
                if (!element.isAssignShift) {
                  var confirmedStaffsCount = element.confirmedStaffs.length;
                  dashboardGraphData.plannedFlexiHours +=
                    (element.staffNeedCount - totalExtension) *
                      element.duration +
                    totalExtensionHrs;
                  dashboardGraphData.plannedFlexiShifts +=
                    element.staffNeedCount;
                  dashboardGraphData.bookedFlexiHours +=
                    (confirmedStaffsCount - totalExtension) * element.duration +
                    totalExtensionHrs;
                  dashboardGraphData.bookedFlexiShifts += confirmedStaffsCount;
                } else {
                  var isRecalled =
                    element.isRest || element.isOff ? true : false;
                  if (
                    (!isRecalled ||
                      (isRecalled && element.isRecallAccepted == 2)) &&
                    req.body.from != 'viewbooking'
                  ) {
                    var confirmedStaffsCount = element.confirmedStaffs.length;
                    if (element.isExtendedShift) {
                      const extendStaff = element.extendedStaff[0];
                      var hours =
                        Math.abs(
                          new Date(extendStaff.startDateTime).getTime() -
                            new Date(extendStaff.endDateTime).getTime(),
                        ) / 36e5;
                      dashboardGraphData.assignFlexiHours += hours;
                    } else {
                      dashboardGraphData.assignFlexiHours +=
                        element.staffNeedCount * element.duration;
                    }
                    dashboardGraphData.assignFlexiShifts +=
                      element.staffNeedCount;
                    dashboardGraphData.assignFlexiStaff +=
                      element.staffNeedCount;
                  }
                }
              }
              /*dashboard graph data ends */
              // Remove Cancelled Shifts on Calculation
              if (listData[key]) {
                /*if date already keyed in array */
                listData[key].push(element);
                // Add Hours in calculation only it is active shift
                if (element.status == 1 && !element.isAssignShift) {
                  //console.log('1', key);
                  graphData[key].totalHours +=
                    element.duration *
                      (element.staffNeedCount - totalExtension) +
                    totalExtensionHrs;
                  graphData[key].totalShifts += element.staffNeedCount;
                  graphDataWeb[key].totalHours.need +=
                    element.duration *
                      (element.staffNeedCount - totalExtension) +
                    totalExtensionHrs;
                  graphDataWeb[key].totalHours.booked +=
                    element.duration *
                      (element.confirmedStaffs.length - totalExtension) +
                    totalExtensionHrs;
                  graphDataWeb[key].numberOfShifts.need +=
                    element.staffNeedCount;
                  graphDataWeb[key].numberOfShifts.booked +=
                    element.confirmedStaffs.length;
                  graphDataWeb[key].totalHours.needAssign += 0;
                  graphDataWeb[key].numberOfShifts.needAssign += 0;
                  graphData[key].totalHoursAssign += 0;
                  graphData[key].totalShiftsAssign += 0;
                  graphData[key].assignFlexiStaff += 0;
                } else {
                  if (element.status == 1) {
                    var isRecalled =
                      element.isRest || element.isOff ? true : false;
                    if (
                      (!isRecalled ||
                        (isRecalled && element.isRecallAccepted == 2)) &&
                      req.body.from != 'viewbooking'
                    ) {
                      console.log('11', key);
                      graphData[key].totalHoursAssign +=
                        element.duration * element.staffNeedCount;
                      graphData[key].totalShiftsAssign +=
                        element.staffNeedCount;
                      graphData[key].assignFlexiStaff += element.staffNeedCount;
                      graphDataWeb[key].totalHours.needAssign +=
                        element.duration * element.staffNeedCount;
                      graphDataWeb[key].numberOfShifts.needAssign +=
                        element.staffNeedCount;
                      graphData[key].totalHours += 0;
                      graphData[key].totalShifts += 0;
                      graphDataWeb[key].totalHours.need += 0;
                      graphDataWeb[key].totalHours.booked += 0;
                      graphDataWeb[key].numberOfShifts.need += 0;
                      graphDataWeb[key].numberOfShifts.booked += 0;
                    }
                  }
                }
              } else {
                /*else create a new key by date in array */
                listData[key] = [];
                listData[key].push(element);
                graphData[key] = {};
                graphData[key].totalHours = 0;
                graphData[key].totalShifts = 0;
                graphData[key].totalHoursAssign = 0;
                graphData[key].totalShiftsAssign = 0;
                graphData[key].assignFlexiStaff = 0;
                graphDataWeb[key] = {
                  totalHours: {
                    need: 0,
                    booked: 0,
                    needAssign: 0,
                  },
                  numberOfShifts: {
                    need: 0,
                    booked: 0,
                    needAssign: 0,
                  },
                };
                // Add Hours in calculation only it is active shift
                if (element.status == 1 && !element.isAssignShift) {
                  graphData[key].totalHours =
                    element.duration *
                      (element.staffNeedCount - totalExtension) +
                    totalExtensionHrs;
                  graphData[key].totalShifts = element.staffNeedCount;
                  graphDataWeb[key] = {
                    totalHours: {
                      need:
                        element.duration *
                          (element.staffNeedCount - totalExtension) +
                        totalExtensionHrs,
                      booked:
                        element.duration *
                          (element.confirmedStaffs.length - totalExtension) +
                        totalExtensionHrs,
                      needAssign: 0,
                    },
                    numberOfShifts: {
                      need: element.staffNeedCount,
                      booked: element.confirmedStaffs.length,
                      needAssign: 0,
                    },
                  };
                  graphData[key].totalHoursAssign = 0;
                  graphData[key].totalShiftsAssign = 0;
                  graphData[key].assignFlexiStaff = 0;
                } else {
                  var isRecalled =
                    element.isRest || element.isOff ? true : false;
                  if (
                    element.status == 1 &&
                    (!isRecalled ||
                      (isRecalled && element.isRecallAccepted == 2)) &&
                    req.body.from != 'viewbooking'
                  ) {
                    console.log('all here');
                    console.log('11**************', JSON.stringify(element));
                    graphData[key].totalHoursAssign =
                      element.duration * element.staffNeedCount;
                    graphData[key].totalShiftsAssign = element.staffNeedCount;
                    graphData[key].assignFlexiStaff = element.staffNeedCount;
                    graphDataWeb[key] = {
                      totalHours: {
                        needAssign: element.duration * element.staffNeedCount,
                      },
                      numberOfShifts: {
                        needAssign: element.staffNeedCount,
                      },
                    };
                    graphData[key].totalHours = 0;
                    graphData[key].totalShifts = 0;
                    graphDataWeb[key].totalHours.need = 0;
                    graphDataWeb[key].totalHours.booked = 0;
                    graphDataWeb[key].numberOfShifts.need = 0;
                    graphDataWeb[key].numberOfShifts.booked = 0;
                  }
                }
              }
              var customElement = _.omit(element, [
                'shiftId',
                'reportLocationId',
                'subSkillSets',
                'mainSkillSets',
              ]);
              customShiftDetails.push(customElement);
            }
          });
          /*weeklyGraph starts */
          var staffNeedWeekdaysObj = {
              monday: {},
              tuesday: {},
              wednesday: {},
              thursday: {},
              friday: {},
              saturday: {},
              sunday: {},
            },
            staffAppliedWeekdaysObj = _.cloneDeep(staffNeedWeekdaysObj);
          var staffNeedWeekdaysObjAssign = {
              monday: {},
              tuesday: {},
              wednesday: {},
              thursday: {},
              friday: {},
              saturday: {},
              sunday: {},
            },
            staffAppliedWeekdaysObjAssign = _.cloneDeep(
              staffNeedWeekdaysObjAssign,
            );

          startUnixDateTime += 86400;
          endUnixDateTime += 86400;
          for (var i = startUnixDateTime; i < endUnixDateTime; i += 1800) {
            var dateTimeUnix = i * 1000;
            customShiftDetails = JSON.parse(JSON.stringify(customShiftDetails));
            await customShiftDetails.forEach(async (element) => {
              var weekDay = __.getDayStringFormatFromUnix(i, 'GMT+0000'),
                staffNeedCount = 0,
                appliedStaffCount = 0,
                staffNeedCountAssign = 0,
                appliedStaffCountAssing = 0;
              // if(element.isAssignShift){
              //     console.log('aaaaaaaaaa');
              //     console.log(i, element.startTimeInSeconds)
              //     element.startTimeInSeconds = element.startTimeInSeconds/1000;
              //     element.endTimeInSeconds = element.endTimeInSeconds/1000;
              //     console.log(i, element.startTimeInSeconds)
              // }
              //   console.log(i, element.startTimeInSeconds)
              if (
                i >= element.startTimeInSeconds &&
                i <= element.endTimeInSeconds
              ) {
                /*shift matches the time then it will take the count else it will assign 0 by default */
                if (!element.isAssignShift) {
                  // console.log('inthis')
                  staffNeedCount = element.staffNeedCount;
                  appliedStaffCount = element.confirmedStaffs.length;
                } else {
                  var isRecalled =
                    element.isRest || element.isOff ? true : false;
                  if (
                    (!isRecalled ||
                      (isRecalled && element.isRecallAccepted == 2)) &&
                    req.body.from != 'viewbooking'
                  ) {
                    staffNeedCountAssign = element.staffNeedCount;
                    appliedStaffCountAssing = element.confirmedStaffs.length;
                  }
                }
              }
              //if(!element.isAssignShift){
              if (
                typeof staffNeedWeekdaysObj[weekDay][dateTimeUnix] !=
                'undefined'
              ) {
                /*dont change to if condition bcoz it may be zero so it fails in it*/
                staffNeedWeekdaysObj[weekDay][dateTimeUnix] += staffNeedCount;
              } else {
                staffNeedWeekdaysObj[weekDay][dateTimeUnix] = staffNeedCount;
              }
              if (
                typeof staffAppliedWeekdaysObj[weekDay][dateTimeUnix] !=
                'undefined'
              ) {
                /*dont change to if condition bcoz it may be zero so it fails in it*/ staffAppliedWeekdaysObj[
                  weekDay
                ][dateTimeUnix] += appliedStaffCount;
              } else {
                staffAppliedWeekdaysObj[weekDay][dateTimeUnix] =
                  appliedStaffCount;
              }
              // }else {
              // assign code
              if (
                typeof staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] !=
                'undefined'
              ) {
                /*dont change to if condition bcoz it may be zero so it fails in it*/
                staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] +=
                  staffNeedCountAssign;
              } else {
                staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] =
                  staffNeedCountAssign;
              }
              if (
                typeof staffAppliedWeekdaysObjAssign[weekDay][dateTimeUnix] !=
                'undefined'
              ) {
                /*dont change to if condition bcoz it may be zero so it fails in it*/ staffAppliedWeekdaysObjAssign[
                  weekDay
                ][dateTimeUnix] += appliedStaffCountAssing;
              } else {
                staffAppliedWeekdaysObjAssign[weekDay][dateTimeUnix] =
                  appliedStaffCountAssing;
              }
              // }
            });
          }

          // deleteMany
          /*FORMAT THE RESPONSE (for both need and applied datas) AS {'monday':[[1514223000000,2],[1514223000000,2]],'tuesday':[[1514223000000,2],[1514223000000,2]],....} */
          var formattedAppliedStaffData = {},
            formattedNeedStaffData = {};
          var formattedAppliedStaffDataAssign = {},
            formattedNeedStaffDataAssing = {};
          for (var appliedElement in staffAppliedWeekdaysObj) {
            formattedAppliedStaffData[appliedElement] = [];
            for (var time in staffAppliedWeekdaysObj[appliedElement]) {
              var array = [
                Number(time),
                Number(staffAppliedWeekdaysObj[appliedElement][time]),
              ];
              if (formattedAppliedStaffData[appliedElement].length < 48) {
                formattedAppliedStaffData[appliedElement].push(array);
              }
            }
          }
          for (var needElement in staffNeedWeekdaysObj) {
            formattedNeedStaffData[needElement] = [];
            for (var time in staffNeedWeekdaysObj[needElement]) {
              var array = [
                Number(time),
                Number(staffNeedWeekdaysObj[needElement][time]),
              ];
              if (formattedNeedStaffData[needElement].length < 48) {
                formattedNeedStaffData[needElement].push(array);
              }
            }
          }
          // assign code
          for (var appliedElement in staffAppliedWeekdaysObjAssign) {
            formattedAppliedStaffDataAssign[appliedElement] = [];
            for (var time in staffAppliedWeekdaysObjAssign[appliedElement]) {
              var array = [
                Number(time),
                Number(staffAppliedWeekdaysObjAssign[appliedElement][time]),
              ];
              if (formattedAppliedStaffDataAssign[appliedElement].length < 48) {
                formattedAppliedStaffDataAssign[appliedElement].push(array);
              }
            }
          }
          for (var needElement in staffNeedWeekdaysObjAssign) {
            formattedNeedStaffDataAssing[needElement] = [];
            for (var time in staffNeedWeekdaysObjAssign[needElement]) {
              var array = [
                Number(time),
                Number(staffNeedWeekdaysObjAssign[needElement][time]),
              ];
              if (formattedNeedStaffDataAssing[needElement].length < 48) {
                formattedNeedStaffDataAssing[needElement].push(array);
              }
            }
          }

          var data = {
              businessUnitId: req.body.businessUnitId,
              weekNumber: weekNumber,
            },
            clientWeeklyStaffData = await WeeklyStaffData.weeklyStaffingData(
              data,
              res,
            ),
            weeklyStaffGraphData = {
              clientFlexiStaffData: {},
              clientStaffData: {},
              staffNeedData: formattedNeedStaffData,
              staffAppliedData: formattedAppliedStaffData,
              staffNeedDataAssing: formattedNeedStaffDataAssing,
              staffAppliedDataAssing: formattedAppliedStaffDataAssign,
            };
          if (clientWeeklyStaffData) {
            if (clientWeeklyStaffData.flexiStaffData)
              weeklyStaffGraphData.clientFlexiStaffData =
                clientWeeklyStaffData.flexiStaffData;

            if (clientWeeklyStaffData.staffData)
              weeklyStaffGraphData.clientStaffData =
                clientWeeklyStaffData.staffData;
          }
          /*weeklyGraph ends */
          var updatedDashboardGraphData = {};
          for (let each in dashboardGraphData) {
            updatedDashboardGraphData[each] =
              dashboardGraphData[each].toFixed(2);
          }
          __.log(req.body, 'shift/read params');
          // __.log(listData)
          var templistData = JSON.stringify(listData);
          listData = JSON.parse(templistData);
          for (let date in listData) {
            listData[date].forEach((item, index) => {
              if (item.isLimit) {
                const isLimitedStaff = item.appliedStaffs.filter((limit) => {
                  return limit.status == 1 && limit.isLimit;
                });
                if (isLimitedStaff.length > 0) {
                  for (let kk = 0; kk < item.confirmedStaffs.length; kk++) {
                    const staffCheck = item.confirmedStaffs[kk];
                    let isLimitStaffId = isLimitedStaff.filter((limit) => {
                      return limit.flexiStaff == staffCheck._id;
                    });
                    if (isLimitStaffId.length > 0) {
                      item.confirmedStaffs[kk].isLimit = true;
                    }
                  }
                }
              }
              if (item.isExtendedShift) {
                //console.log('present');
                if (item.extendedStaff) {
                  item.extendedStaff.forEach((extendedStaffItem) => {
                    if (item.confirmedStaffs) {
                      item.confirmedStaffs.forEach((confirmedStaffsItem) => {
                        // console.log(typeof confirmedStaffs._id, confirmedStaffs._id,extendedStaff.userId )
                        if (
                          confirmedStaffsItem._id.toString() ===
                          extendedStaffItem.userId.toString()
                        ) {
                          confirmedStaffsItem.confirmStatus =
                            extendedStaffItem.confirmStatus;
                          confirmedStaffsItem.endDateTime =
                            extendedStaffItem.endDateTime;
                          confirmedStaffsItem.startDateTime =
                            extendedStaffItem.startDateTime;
                          confirmedStaffsItem.isLimit =
                            extendedStaffItem.isLimit;
                          console.log('match');
                        }
                      });
                    }
                  });
                }
              }
              if (item.isSplitShift) {
                listData[date].forEach((splitItem, splitIndex) => {
                  if (splitIndex !== index) {
                    if (
                      item.randomShiftId &&
                      splitItem.randomShiftId &&
                      splitItem.isSplitShift &&
                      new Date(splitItem.date).getTime() ===
                        new Date(item.date).getTime() &&
                      splitItem.randomShiftId.toString() ===
                        item.randomShiftId.toString()
                    ) {
                      if (splitItem.isParent === 2) {
                        item.splitShiftStartTime = splitItem.startTime;
                        item.splitShiftEndTime = splitItem.endTime;
                        item.splitShiftId = splitItem._id;
                        listData[date].splice(splitIndex, 1);
                      } else {
                        const splitShiftStartTime = item.startTime;
                        const splitShiftEndTime = item.endTime;
                        const splitShiftId = item._id;
                        item.startTime = splitItem.startTime;
                        item.endTime = splitItem.endTime;
                        item._id = splitItem._id;
                        item.splitShiftStartTime = splitShiftStartTime;
                        item.splitShiftEndTime = splitShiftEndTime;
                        item.splitShiftId = splitShiftId;
                        listData[date].splice(splitIndex, 1);
                      }
                    }
                  }
                });
              }
            });
          }
          for (var prop in graphData) {
            if (Object.prototype.hasOwnProperty.call(graphData, prop)) {
              // do stuff
              if (
                graphData[prop].totalHours % 1 != 0 &&
                graphData[prop].totalHours > 0
              )
                graphData[prop].totalHours = parseFloat(
                  graphData[prop].totalHours.toFixed(2),
                );
            }
          }
          for (var prop in graphDataWeb) {
            if (Object.prototype.hasOwnProperty.call(graphDataWeb, prop)) {
              // do stuff
              if (
                graphDataWeb[prop].totalHours.need % 1 != 0 &&
                graphDataWeb[prop].totalHours.need
              )
                graphDataWeb[prop].totalHours.need = parseFloat(
                  graphDataWeb[prop].totalHours.need.toFixed(2),
                );
              if (
                graphDataWeb[prop].totalHours.booked % 1 != 0 &&
                graphDataWeb[prop].totalHours.booked
              )
                graphDataWeb[prop].totalHours.booked = parseFloat(
                  graphDataWeb[prop].totalHours.booked.toFixed(2),
                );
            }
          }

          function sortObject(obj) {
            return Object.keys(obj)
              .sort(function (a, b) {
                obj[a].sort(
                  (firstItem, secondItem) =>
                    moment(firstItem.startTime) - moment(secondItem.startTime),
                );
                obj[b].sort(
                  (firstItem, secondItem) =>
                    moment(firstItem.startTime) - moment(secondItem.startTime),
                );
                return (
                  moment(a, 'DD/MM/YYYY').toDate() -
                  moment(b, 'DD/MM/YYYY').toDate()
                );
              })
              .reduce(function (result, key) {
                result[key] = obj[key];
                return result;
              }, {});
          }

          listData = sortObject(listData);
          const finalDataResult = {
            list: listData,
            graph: graphData,
            graphDataWeb: graphDataWeb,
            dashboardGraphData: updatedDashboardGraphData,
            weeklyStaffGraphData: weeklyStaffGraphData,
          };
          this.setRedisData(redisKey, finalDataResult);
          __.out(res, 201, {
            list: listData,
            graph: graphData,
            graphDataWeb: graphDataWeb,
            dashboardGraphData: updatedDashboardGraphData,
            weeklyStaffGraphData: weeklyStaffGraphData,
          });
        } else {
          __.out(res, 201, {
            shifts: shifts,
          });
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  //------------------------------------ END READ SHIFT ------------------------------------------------
  async delete(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'businessUnitId',
        'weekRangeStartsAt',
        'weekRangeEndsAt',
      ]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        /*compose the date variables */
        const buIdRedis = req.body.businessUnitId;
        var weekRangeStartsAt = moment(
            req.body.weekRangeStartsAt,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .format(),
          weekRangeEndsAt = moment(
            req.body.weekRangeStartsAt,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .add(6, 'days')
            .add(23, 'hours')
            .add(59, 'minutes')
            .add(59, 'seconds')
            .utc()
            .format(),
          weekNumber = await __.weekNoStartWithMonday(
            req.body.weekRangeStartsAt,
          );
        var statusLogData = {
          userId: req.user._id,
          weekNumber: weekNumber,
          weekRangeStartsAt: weekRangeStartsAt,
          weekRangeEndsAt: weekRangeEndsAt,
          status: 2,
          /*shift deleted */
          businessUnitId: req.body.businessUnitId,
        };
        var result = await this.log(statusLogData, res);
        __.out(res, 201, result);
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async log(data, res) {
    try {
      var description = '';
      if (data.status == 1) description = 'Planning';
      else if (data.status == 2) description = 'Deleted';
      else if (data.status == 3) description = 'New Template Saved';
      else if (data.status == 4) description = 'Template Edited';

      let insert = {
        userId: data.userId,
        businessUnitId: data.businessUnitId,
        status: data.status,
        description: description,
        weekNumber: data.weekNumber,
        weekRangeStartsAt: data.weekRangeStartsAt,
        weekRangeEndsAt: data.weekRangeEndsAt,
      };
      insert.shiftId = data.shiftId;
      var result = await new ShiftLog(insert).save();
      var reqData = {
        shiftLogId: result._id,
      };
      this.logList(reqData, res);
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async logList(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      var findOrFindOne;
      if (req.shiftLogId) findOrFindOne = ShiftLog.findById(req.shiftLogId);
      else if (req.body.businessUnitId && req.body.weekRangeStartsAt) {
        req.body.weekRangeStartsAt = moment(
          req.body.weekRangeStartsAt,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .startOf('day')
          .utc()
          .format();
        console.log('req.body.weekRangeStartsAt', req.body.weekRangeStartsAt);
        const yearOfWeek = new Date(req.body.weekRangeStartsAt).getFullYear();
        console.log('eeee', yearOfWeek);
        var weekNumber = await __.weekNoStartWithMonday(
          req.body.weekRangeStartsAt,
        );
        //"$expr": { "$eq": [{ "$year": "$weekRangeStartsAt" }, yearOfWeek] }
        findOrFindOne = ShiftLog.find({
          businessUnitId: req.body.businessUnitId,
          weekNumber: weekNumber,
          $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, yearOfWeek] },
        });
      } else findOrFindOne = ShiftLog.find();
      var result = await findOrFindOne
        .select(
          'createdAt userId status description weekNumber weekRangeStartsAt weekRangeEndsAt shiftId',
        )
        .sort({
          createdAt: -1,
        })
        .populate([
          {
            path: 'userId',
            select: 'name staffId',
          },
          {
            path: 'businessUnitId',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'sectionId',
              select: 'name status',
              match: {
                status: 1,
              },
              populate: {
                path: 'departmentId',
                select: 'name status',
                match: {
                  status: 1,
                },
                populate: {
                  path: 'companyId',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
              },
            },
          },
        ])
        .lean();
      // result.forEach((item)=>{
      //     var myJSONString = JSON.stringify(item.shiftId);
      //     var myEscapedJSONString = myJSONString.replace(/\\n/g, "\\n")
      //         .replace(/\\'/g, "\\'")
      //         .replace(/\\"/g, '\\"')
      //         .replace(/\\&/g, "\\&")
      //         .replace(/\\r/g, "\\r")
      //         .replace(/\\t/g, "\\t")
      //         .replace(/\\b/g, "\\b")
      //         .replace(/\\f/g, "\\f");
      //    item.shiftId = JSON.parse(myEscapedJSONString)
      // });
      __.out(res, 201, result);
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async viewBookingsOld(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      __.log(req.body, 'shift/viewBooking params');
      let requiredResult1 = await __.checkRequiredFields(req, [
        'businessUnitId',
        'startDate',
      ]);
      if (requiredResult1.status === false) {
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        var timeZone = moment
            .parseZone(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .format('Z'),
          startDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format(),
          endDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .add(5, 'days')
            .add(23, 'hours')
            .add(60, 'minutes')
            .add(59, 'seconds')
            .utc()
            .format(),
          weekNumber = await __.weekNoStartWithMonday(startDate);
        console.log('weekNumber', weekNumber, startDate, endDate);
        __.log(timeZone, req.body, startDate, 'timeZone');

        //use in future if giving problem
        const ddd = moment(new Date(req.body.startDate))
          .utc()
          .format('MM-DD-YYYY HH:mm:ss Z');
        const year = new Date(ddd).getFullYear();
        const month = new Date(ddd).getMonth() + 1;
        const day = new Date(ddd).getDate(); //-1; // remove comment for local
        console.log('yy', year, month, day);
        const whereShift = {
          //  staff_id:{$in: usersOfBu},
          businessUnitId: req.body.businessUnitId,
          status: 1,
          $and: [
            { $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, year] } },
            { $expr: { $eq: [{ $month: '$weekRangeStartsAt' }, month] } },
            { $expr: { $eq: [{ $dayOfMonth: '$weekRangeStartsAt' }, day] } },
          ],
        };
        var shift = await Shift.find(whereShift).select('shiftDetails').lean();
        console.log('shofttttt', shift.length);
        function plucker(prop) {
          return function (o) {
            return o[prop];
          };
        }
        var shiftDetailsArray = shift.map(plucker('shiftDetails'));
        shiftDetailsArray = _.flatten(shiftDetailsArray);
        shiftDetailsArray = Array.from(new Set(shiftDetailsArray));
        if (shiftDetailsArray.length == 0) {
          __.out(res, 201, shiftDetailsArray);
        } else {
          var where = {
            status: 1,
            _id: {
              $in: shiftDetailsArray,
            },
            'appliedStaffs.0': {
              $exists: true,
            },
            isAssignShift: false,
          };
          where.date = {
            $gte: startDate,
            $lte: endDate,
          };
          // __.log(moment(endDate).endOf('day').utc().format(), moment(startDate).startOf('day').utc().format(), 'formatIssues')
          // Show Cancelled Shifts Also
          if (req.body.cancelledShifts && req.body.cancelledShifts === true) {
            where.status = {
              $in: [1, 2],
            };
          }
          var shifts = await ShiftDetails.find(where).select('appliedStaffs');
          var appliedStaffsArray = shifts.map(plucker('appliedStaffs'));
          console.log('appliedStaffsArray', appliedStaffsArray);
          appliedStaffsArray = _.flatten(appliedStaffsArray);
          console.log('appliedStaffsArray fff', appliedStaffsArray);
          appliedStaffsArray = Array.from(new Set(appliedStaffsArray));
          if (appliedStaffsArray.length == 0) {
            __.out(res, 201, appliedStaffsArray);
          } else {
            var staffsShifts = await AppliedStaffs.find({
              _id: {
                $in: appliedStaffsArray,
              },
              status: {
                $in: [1, 2] /*only confirmed and standby slots */,
              },
            })
              .populate({
                path: 'flexiStaff',
                select: 'name staffId email contactNumber profilePicture',
                populate: [
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
                ],
              })
              .populate({
                path: 'shiftDetailsId',
                populate: [
                  {
                    path: 'reportLocationId',
                    select: 'name status',
                  },
                  {
                    path: 'subSkillSets',
                    select: 'name status',
                    populate: {
                      path: 'skillSetId',
                      select: 'name status',
                    },
                  },
                  {
                    path: 'mainSkillSets',
                    select: 'name',
                  },
                  {
                    path: 'requestedShifts',
                    match: {
                      status: {
                        $in: [0, 2],
                      },
                    },
                    populate: {
                      path: 'reportLocationId',
                      select: 'name status',
                    },
                  },
                ],
              })
              .populate({
                path: 'shiftId',
                select: 'businessUnitId plannedBy',
                populate: [
                  {
                    path: 'plannedBy',
                    select: 'name staffId',
                  },
                  {
                    path: 'businessUnitId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                    populate: {
                      path: 'sectionId',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'departmentId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                        populate: {
                          path: 'companyId',
                          select: 'name status',
                          match: {
                            status: 1,
                          },
                        },
                      },
                    },
                  },
                ],
              })
              .lean();
            //   console.log('staffsShifts', staffsShifts);
            staffsShifts = await _.orderBy(
              staffsShifts,
              ['shiftDetailsId.startTime'],
              ['asc'],
            );

            var listData = {},
              graphData = {};
            staffsShifts.forEach((element) => {
              // console.log('daaaa',element.shiftDetailsId.date, element.shiftDetailsId.timeZone)
              var key = __.getDateStringFormat(
                element.shiftDetailsId.date,
                element.shiftDetailsId.timeZone,
              );
              if (listData[key]) {
                /*if date already keyed in array */
                listData[key].push(element);
                // Check shift is cancelled or not
                if (element.shiftDetailsId.status == 1) {
                  graphData[key].totalHours += element.shiftDetailsId.duration;
                  if (element.status == 1) {
                    graphData[key].confirmedHours +=
                      element.shiftDetailsId.duration;
                  } else if (element.status == 2) {
                    graphData[key].standByHours +=
                      element.shiftDetailsId.duration;
                  }
                }
              } else {
                /*else create a new key by date in array */
                listData[key] = [];
                graphData[key] = {
                  totalHours: 0,
                  confirmedHours: 0,
                  standByHours: 0,
                };
                listData[key].push(element);
                // Check shift is cancelled or not
                if (element.shiftDetailsId.status == 1) {
                  graphData[key].totalHours = element.shiftDetailsId.duration;
                  if (element.status == 1) {
                    graphData[key].confirmedHours =
                      element.shiftDetailsId.duration;
                    graphData[key].standByHours = 0;
                  } else if (element.status == 2) {
                    graphData[key].confirmedHours = 0;
                    graphData[key].standByHours =
                      element.shiftDetailsId.duration;
                  }
                }
              }
            });
            // __.log(graphData, "graphData");
            let newListData = JSON.stringify(listData);
            newListData = JSON.parse(newListData);
            for (let date in newListData) {
              newListData[date].forEach((item, index) => {
                if (item.shiftDetailsId.isExtendedShift) {
                  // console.log('aaa');
                  if (item.flexiStaff) {
                    if (item.shiftDetailsId.extendedStaff) {
                      const flexId = item.flexiStaff._id.toString();
                      const extendObj =
                        item.shiftDetailsId.extendedStaff.filter((extendS) => {
                          return extendS.userId.toString() === flexId;
                        });
                      if (extendObj.length > 0) {
                        item.shiftDetailsId.extendedStaff = extendObj;
                        // console.log(extendObj)
                        item.flexiStaff.confirmStatus =
                          extendObj[0].confirmStatus;
                        if (extendObj[0].confirmStatus == 2) {
                          console.log('I am here');
                          item.flexiStaff.startDateTime =
                            extendObj[0].startDateTime;
                          item.flexiStaff.endDateTime =
                            extendObj[0].endDateTime;
                        }
                      }
                    }
                  }
                }
                if (item.shiftDetailsId.isSplitShift) {
                  console.log('aaaa');
                  newListData[date].forEach((splitItem, splitIndex) => {
                    if (splitIndex !== index) {
                      console.log('aabb');
                      if (
                        splitItem.shiftDetailsId.isSplitShift &&
                        new Date(splitItem.shiftDetailsId.date).getTime() ===
                          new Date(item.shiftDetailsId.date).getTime() &&
                        splitItem.shiftDetailsId.shiftId ===
                          item.shiftDetailsId.shiftId
                      ) {
                        item.shiftDetailsId.splitShiftStartTime =
                          splitItem.shiftDetailsId.startTime;
                        item.shiftDetailsId.splitShiftEndTime =
                          splitItem.shiftDetailsId.endTime;
                        item.shiftDetailsId.splitShiftId =
                          splitItem.shiftDetailsId._id;
                        newListData[date].splice(splitIndex, 1);
                      }
                    }
                  });
                }
              });
            }
            __.out(res, 201, {
              list: newListData,
              graph: graphData,
            });
          }
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async viewBookings(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      console.log('heheheh');
      __.log(req.body, 'shift/viewBooking params');
      let requiredResult1 = await __.checkRequiredFields(req, [
        'businessUnitId',
        'startDate',
      ]);
      if (requiredResult1.status === false) {
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        const currentDateR = req.body.startDate.split(' ')[0];
        const redisKey = `ViewBooking${req.body.businessUnitId}${currentDateR}`;
        console.log('read API KEY redisKey', redisKey);
        const redisData = await redisClient.get(`${redisKey}`);
        if (redisData) {
          console.log('DATATATATATA Present');
          return __.out(res, 201, JSON.parse(redisData));
        }
        var timeZone = moment
            .parseZone(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .format('Z'),
          startDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format(),
          endDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .add(5, 'days')
            .add(23, 'hours')
            .add(60, 'minutes')
            .add(59, 'seconds')
            .utc()
            .format(),
          weekNumber = await __.weekNoStartWithMonday(startDate);
        console.log('weekNumber', weekNumber, startDate, endDate);
        __.log(timeZone, req.body, startDate, 'timeZone');
        var startUnixDateTime = moment(startDate).unix(),
          endUnixDateTime = moment(endDate).unix();
        //use in future if giving problem
        const ddd = moment(new Date(req.body.startDate))
          .utc()
          .format('MM-DD-YYYY HH:mm:ss Z');
        const year = new Date(ddd).getFullYear();
        const month = new Date(ddd).getMonth() + 1;
        const day = new Date(ddd).getDate(); //-1; // remove comment for local
        console.log('yy', year, month, day);
        const whereShift = {
          //  staff_id:{$in: usersOfBu},
          businessUnitId: req.body.businessUnitId,
          status: 1,
          $and: [
            { $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, year] } },
            { $expr: { $eq: [{ $month: '$weekRangeStartsAt' }, month] } },
            { $expr: { $eq: [{ $dayOfMonth: '$weekRangeStartsAt' }, day] } },
          ],
        };
        var shift = await Shift.find(whereShift).select('shiftDetails').lean();
        console.log('shofttttt', shift.length);
        function plucker(prop) {
          return function (o) {
            return o[prop];
          };
        }
        var shiftDetailsArray = shift.map(plucker('shiftDetails'));
        shiftDetailsArray = _.flatten(shiftDetailsArray);
        shiftDetailsArray = Array.from(new Set(shiftDetailsArray));
        //  return res.json({shiftDetailsArray})
        if (shiftDetailsArray.length == 0) {
          __.out(res, 201, shiftDetailsArray);
        } else {
          var where = {
            status: 1,
            _id: {
              $in: shiftDetailsArray,
            },
            'appliedStaffs.0': {
              $exists: true,
            },
            isAssignShift: false,
          };
          where.date = {
            $gte: startDate,
            $lte: endDate,
          };
          // __.log(moment(endDate).endOf('day').utc().format(), moment(startDate).startOf('day').utc().format(), 'formatIssues')
          // Show Cancelled Shifts Also
          if (req.body.cancelledShifts && req.body.cancelledShifts === true) {
            where.status = {
              $in: [1, 2],
            };
          }

          var findOrFindOne = ShiftDetails.find(where); //.select('appliedStaffs');
          let shifts = await findOrFindOne
            .populate([
              { path: 'appliedStaffs' },
              {
                path: 'draftId',
                select:
                  'shiftRead shiftChangeRequestStatus shiftChangeRequestMessage',
              },
              {
                path: 'shiftId',
                select: '-shiftDetails',
                match: {
                  businessUnitId: mongoose.Types.ObjectId(
                    req.body.businessUnitId,
                  ),
                },
                populate: [
                  {
                    path: 'plannedBy',
                    select: 'name staffId',
                  },
                  {
                    path: 'businessUnitId',
                    select:
                      'name adminEmail techEmail shiftCancelHours cancelShiftPermission standByShiftPermission status',
                    match: {
                      status: 1,
                    },
                    populate: {
                      path: 'sectionId',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'departmentId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                        populate: {
                          path: 'companyId',
                          select: 'name status',
                          match: {
                            status: 1,
                          },
                        },
                      },
                    },
                  },
                ],
              },
              {
                path: 'reportLocationId',
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
                path: 'mainSkillSets',
                select: 'name status',
                match: {
                  status: 1,
                },
              },
              {
                path: 'confirmedStaffs',
                select:
                  'name email contactNumber profilePicture subSkillSets mainSkillSets status,schemeId staffId',
                populate: [
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
                    path: 'mainSkillSets',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                  },
                  {
                    path: 'schemeId',
                    select: 'shiftSetup ',
                    match: {
                      status: true,
                    },
                  },
                ],
              },
              {
                path: 'backUpStaffs',
                select:
                  'name email contactNumber profilePicture mainSkillSets subSkillSets status,schemeId staffId',
                populate: [
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
                    path: 'mainSkillSets',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                  },
                  {
                    path: 'schemeId',
                    select: 'shiftSetup',
                    match: {
                      status: true,
                    },
                  },
                ],
              },
              {
                path: 'requestedShifts',
              },
              {
                path: 'currentReqShift',
                populate: {
                  path: 'reportLocationId',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
              },
              {
                path: 'requestedUsers.userId',
                match: {
                  status: 1,
                },
                populate: [
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
                    path: 'mainSkillSets',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                  },
                ],
              },
            ])
            .sort({
              startTime: 1,
            });
          //  return res.json({shifts})
          console.log(' req.body.from', req.body.from);
          if (!req.body.shiftDetailsId) {
            var listData = {},
              graphData = {},
              graphDataWeb = {},
              dashboardGraphData = {
                plannedFlexiHours: 0,
                plannedFlexiShifts: 0,
                bookedFlexiHours: 0,
                bookedFlexiShifts: 0,
                assignFlexiHours: 0,
                assignFlexiShifts: 0,
                assignFlexiStaff: 0,
              },
              customShiftDetails = [];
            shifts = shifts.filter((iii) => {
              return iii.shiftId;
            });
            //return res.json({shifts});
            await shifts.forEach((element) => {
              console.log('element', element.isAssignShift);
              if (
                (((element.mainSkillSets && element.mainSkillSets.length) ||
                  (element.subSkillSets && element.subSkillSets.length)) &&
                  element.reportLocationId &&
                  element.shiftId &&
                  element.shiftId.businessUnitId) ||
                element.isAssignShift
              ) {
                let tz = element.timeZone;
                if (!tz) {
                  tz = '+0800';
                }
                var key = __.getDateStringFormat(element.date, tz);
                // Remove Cancelled Shifts on Calculation
                if (element.status == 1) {
                  /*dashboard graph data starts*/
                  console.log('element.isAssignShift', element.isAssignShift);
                  if (!element.isAssignShift) {
                    var confirmedStaffsCount = element.confirmedStaffs.length;
                    dashboardGraphData.plannedFlexiHours +=
                      element.staffNeedCount * element.duration;
                    dashboardGraphData.plannedFlexiShifts +=
                      element.staffNeedCount;
                    //backUpStaffs.length
                    dashboardGraphData.bookedFlexiHours +=
                      confirmedStaffsCount * element.duration;
                    dashboardGraphData.bookedFlexiShifts +=
                      confirmedStaffsCount;
                  } else {
                    var isRecalled =
                      element.isRest || element.isOff ? true : false;
                    if (
                      (!isRecalled ||
                        (isRecalled && element.isRecallAccepted == 2)) &&
                      req.body.from != 'viewbooking'
                    ) {
                      var confirmedStaffsCount = element.confirmedStaffs.length;
                      if (element.isExtendedShift) {
                        const extendStaff = element.extendedStaff[0];
                        var hours =
                          Math.abs(
                            new Date(extendStaff.startDateTime).getTime() -
                              new Date(extendStaff.endDateTime).getTime(),
                          ) / 36e5;
                        dashboardGraphData.assignFlexiHours += hours;
                      } else {
                        dashboardGraphData.assignFlexiHours +=
                          element.staffNeedCount * element.duration;
                      }
                      dashboardGraphData.assignFlexiShifts +=
                        element.staffNeedCount;
                      dashboardGraphData.assignFlexiStaff +=
                        element.staffNeedCount;
                    }
                  }
                }
                /*dashboard graph data ends */
                // Remove Cancelled Shifts on Calculation
                if (listData[key]) {
                  /*if date already keyed in array */
                  listData[key].push(element);
                  // Add Hours in calculation only it is active shift
                  if (element.status == 1 && !element.isAssignShift) {
                    console.log('1', key);
                    graphData[key].totalHours +=
                      element.duration * element.staffNeedCount;
                    graphData[key].confirmedHours +=
                      element.duration * element.confirmedStaffs.length;
                    graphData[key].standByHours +=
                      element.duration * element.backUpStaffs.length;
                    graphData[key].totalShifts += element.staffNeedCount;
                    graphDataWeb[key].totalHours.need +=
                      element.duration * element.staffNeedCount;
                    graphDataWeb[key].totalHours.booked +=
                      element.duration * element.confirmedStaffs.length;
                    graphDataWeb[key].numberOfShifts.need +=
                      element.staffNeedCount;
                    graphDataWeb[key].numberOfShifts.booked +=
                      element.confirmedStaffs.length;
                    graphDataWeb[key].totalHours.needAssign += 0;
                    graphDataWeb[key].numberOfShifts.needAssign += 0;
                    graphData[key].totalHoursAssign += 0;
                    graphData[key].totalShiftsAssign += 0;
                    graphData[key].assignFlexiStaff += 0;
                  } else {
                    if (element.status == 1) {
                      var isRecalled =
                        element.isRest || element.isOff ? true : false;
                      if (
                        (!isRecalled ||
                          (isRecalled && element.isRecallAccepted == 2)) &&
                        req.body.from != 'viewbooking'
                      ) {
                        console.log('11', key);
                        graphData[key].totalHoursAssign +=
                          element.duration * element.staffNeedCount;
                        graphData[key].totalShiftsAssign +=
                          element.staffNeedCount;
                        graphData[key].assignFlexiStaff +=
                          element.staffNeedCount;
                        graphDataWeb[key].totalHours.needAssign +=
                          element.duration * element.staffNeedCount;
                        graphDataWeb[key].numberOfShifts.needAssign +=
                          element.staffNeedCount;
                        graphData[key].totalHours += 0;
                        graphData[key].totalShifts += 0;
                        graphDataWeb[key].totalHours.need += 0;
                        graphDataWeb[key].totalHours.booked += 0;
                        graphDataWeb[key].numberOfShifts.need += 0;
                        graphDataWeb[key].numberOfShifts.booked += 0;
                      }
                    }
                  }
                } else {
                  /*else create a new key by date in array */
                  listData[key] = [];
                  listData[key].push(element);
                  graphData[key] = {};
                  graphData[key].totalHours = 0;
                  graphData[key].totalShifts = 0;
                  graphData[key].confirmedHours = 0;
                  graphData[key].standByHours = 0;
                  graphData[key].totalHoursAssign = 0;
                  graphData[key].totalShiftsAssign = 0;
                  graphData[key].assignFlexiStaff = 0;
                  graphDataWeb[key] = {
                    totalHours: {
                      need: 0,
                      booked: 0,
                      needAssign: 0,
                    },
                    numberOfShifts: {
                      need: 0,
                      booked: 0,
                      needAssign: 0,
                    },
                  };
                  // Add Hours in calculation only it is active shift
                  if (element.status == 1 && !element.isAssignShift) {
                    graphData[key].totalHours =
                      element.duration * element.staffNeedCount;
                    graphData[key].confirmedHours +=
                      element.duration * element.confirmedStaffs.length;
                    graphData[key].standByHours +=
                      element.duration * element.backUpStaffs.length;
                    graphData[key].totalShifts = element.staffNeedCount;
                    graphDataWeb[key] = {
                      totalHours: {
                        need: element.duration * element.staffNeedCount,
                        booked:
                          element.duration * element.confirmedStaffs.length,
                        needAssign: 0,
                      },
                      numberOfShifts: {
                        need: element.staffNeedCount,
                        booked: element.confirmedStaffs.length,
                        needAssign: 0,
                      },
                    };
                    graphData[key].totalHoursAssign = 0;
                    graphData[key].totalShiftsAssign = 0;
                    graphData[key].assignFlexiStaff = 0;
                  } else {
                    var isRecalled =
                      element.isRest || element.isOff ? true : false;
                    console.log('isRecalled', isRecalled, req.body.from);
                    if (
                      element.status == 1 &&
                      (!isRecalled ||
                        (isRecalled && element.isRecallAccepted == 2)) &&
                      req.body.from != 'viewbooking'
                    ) {
                      console.log('all here');
                      graphData[key].totalHoursAssign =
                        element.duration * element.staffNeedCount;
                      graphData[key].totalShiftsAssign = element.staffNeedCount;
                      graphData[key].assignFlexiStaff = element.staffNeedCount;
                      graphDataWeb[key] = {
                        totalHours: {
                          needAssign: element.duration * element.staffNeedCount,
                        },
                        numberOfShifts: {
                          needAssign: element.staffNeedCount,
                        },
                      };
                      graphData[key].totalHours = 0;
                      graphData[key].totalShifts = 0;
                      graphDataWeb[key].totalHours.need = 0;
                      graphDataWeb[key].totalHours.booked = 0;
                      graphDataWeb[key].numberOfShifts.need = 0;
                      graphDataWeb[key].numberOfShifts.booked = 0;
                    }
                  }
                }
                var customElement = _.omit(element, [
                  'shiftId',
                  'reportLocationId',
                  'subSkillSets',
                  'mainSkillSets',
                ]);
                customShiftDetails.push(customElement);
              }
            });
            /*weeklyGraph starts */
            var staffNeedWeekdaysObj = {
                monday: {},
                tuesday: {},
                wednesday: {},
                thursday: {},
                friday: {},
                saturday: {},
                sunday: {},
              },
              staffAppliedWeekdaysObj = _.cloneDeep(staffNeedWeekdaysObj);
            var staffNeedWeekdaysObjAssign = {
                monday: {},
                tuesday: {},
                wednesday: {},
                thursday: {},
                friday: {},
                saturday: {},
                sunday: {},
              },
              staffAppliedWeekdaysObjAssign = _.cloneDeep(
                staffNeedWeekdaysObjAssign,
              );
            //return res.json({staffAppliedWeekdaysObj,customShiftDetails })
            for (var i = startUnixDateTime; i <= endUnixDateTime; i += 1800) {
              var dateTimeUnix = i * 1000;
              customShiftDetails = JSON.parse(
                JSON.stringify(customShiftDetails),
              );
              await customShiftDetails.forEach(async (element) => {
                var weekDay = __.getDayStringFormatFromUnix(i, timeZone),
                  staffNeedCount = 0,
                  appliedStaffCount = 0,
                  staffNeedCountAssign = 0,
                  appliedStaffCountAssing = 0;
                // if(element.isAssignShift){
                //     console.log('aaaaaaaaaa');
                //     console.log(i, element.startTimeInSeconds)
                //     element.startTimeInSeconds = element.startTimeInSeconds/1000;
                //     element.endTimeInSeconds = element.endTimeInSeconds/1000;
                //     console.log(i, element.startTimeInSeconds)
                // }
                //   console.log(i, element.startTimeInSeconds)
                if (
                  i >= element.startTimeInSeconds &&
                  i <= element.endTimeInSeconds
                ) {
                  /*shift matches the time then it will take the count else it will assign 0 by default */
                  if (!element.isAssignShift) {
                    // console.log('inthis')
                    staffNeedCount = element.staffNeedCount;
                    appliedStaffCount = element.confirmedStaffs.length;
                  } else {
                    var isRecalled =
                      element.isRest || element.isOff ? true : false;
                    if (
                      (!isRecalled ||
                        (isRecalled && element.isRecallAccepted == 2)) &&
                      req.body.from != 'viewbooking'
                    ) {
                      staffNeedCountAssign = element.staffNeedCount;
                      appliedStaffCountAssing = element.confirmedStaffs.length;
                    }
                  }
                }
                //if(!element.isAssignShift){
                if (
                  typeof staffNeedWeekdaysObj[weekDay][dateTimeUnix] !=
                  'undefined'
                ) {
                  /*dont change to if condition bcoz it may be zero so it fails in it*/
                  staffNeedWeekdaysObj[weekDay][dateTimeUnix] += staffNeedCount;
                } else {
                  staffNeedWeekdaysObj[weekDay][dateTimeUnix] = staffNeedCount;
                }

                if (
                  typeof staffAppliedWeekdaysObj[weekDay][dateTimeUnix] !=
                  'undefined'
                ) {
                  /*dont change to if condition bcoz it may be zero so it fails in it*/ staffAppliedWeekdaysObj[
                    weekDay
                  ][dateTimeUnix] += appliedStaffCount;
                } else {
                  staffAppliedWeekdaysObj[weekDay][dateTimeUnix] =
                    appliedStaffCount;
                }
                // }else {
                // assign code
                if (
                  typeof staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] !=
                  'undefined'
                ) {
                  /*dont change to if condition bcoz it may be zero so it fails in it*/
                  staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] +=
                    staffNeedCountAssign;
                } else {
                  staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] =
                    staffNeedCountAssign;
                }

                if (
                  typeof staffAppliedWeekdaysObjAssign[weekDay][dateTimeUnix] !=
                  'undefined'
                ) {
                  /*dont change to if condition bcoz it may be zero so it fails in it*/ staffAppliedWeekdaysObjAssign[
                    weekDay
                  ][dateTimeUnix] += appliedStaffCountAssing;
                } else {
                  staffAppliedWeekdaysObjAssign[weekDay][dateTimeUnix] =
                    appliedStaffCountAssing;
                }
                // }
              });
            }

            // deleteMany
            /*FORMAT THE RESPONSE (for both need and applied datas) AS {'monday':[[1514223000000,2],[1514223000000,2]],'tuesday':[[1514223000000,2],[1514223000000,2]],....} */
            var formattedAppliedStaffData = {},
              formattedNeedStaffData = {};
            var formattedAppliedStaffDataAssign = {},
              formattedNeedStaffDataAssing = {};

            for (var appliedElement in staffAppliedWeekdaysObj) {
              formattedAppliedStaffData[appliedElement] = [];
              for (var time in staffAppliedWeekdaysObj[appliedElement]) {
                var array = [
                  Number(time),
                  Number(staffAppliedWeekdaysObj[appliedElement][time]),
                ];
                formattedAppliedStaffData[appliedElement].push(array);
              }
            }
            for (var needElement in staffNeedWeekdaysObj) {
              formattedNeedStaffData[needElement] = [];
              for (var time in staffNeedWeekdaysObj[needElement]) {
                var array = [
                  Number(time),
                  Number(staffNeedWeekdaysObj[needElement][time]),
                ];
                formattedNeedStaffData[needElement].push(array);
              }
            }
            // assign code
            for (var appliedElement in staffAppliedWeekdaysObjAssign) {
              formattedAppliedStaffDataAssign[appliedElement] = [];
              for (var time in staffAppliedWeekdaysObjAssign[appliedElement]) {
                var array = [
                  Number(time),
                  Number(staffAppliedWeekdaysObjAssign[appliedElement][time]),
                ];
                formattedAppliedStaffDataAssign[appliedElement].push(array);
              }
            }
            for (var needElement in staffNeedWeekdaysObjAssign) {
              formattedNeedStaffDataAssing[needElement] = [];
              for (var time in staffNeedWeekdaysObjAssign[needElement]) {
                var array = [
                  Number(time),
                  Number(staffNeedWeekdaysObjAssign[needElement][time]),
                ];
                formattedNeedStaffDataAssing[needElement].push(array);
              }
            }

            var data = {
                businessUnitId: req.body.businessUnitId,
                weekNumber: weekNumber,
              },
              clientWeeklyStaffData = await WeeklyStaffData.weeklyStaffingData(
                data,
                res,
              ),
              weeklyStaffGraphData = {
                clientFlexiStaffData: {},
                clientStaffData: {},
                staffNeedData: formattedNeedStaffData,
                staffAppliedData: formattedAppliedStaffData,
                staffNeedDataAssing: formattedNeedStaffDataAssing,
                staffAppliedDataAssing: formattedAppliedStaffDataAssign,
              };

            if (clientWeeklyStaffData) {
              if (clientWeeklyStaffData.flexiStaffData)
                weeklyStaffGraphData.clientFlexiStaffData =
                  clientWeeklyStaffData.flexiStaffData;
              if (clientWeeklyStaffData.staffData)
                weeklyStaffGraphData.clientStaffData =
                  clientWeeklyStaffData.staffData;
            }

            /*weeklyGraph ends */
            var updatedDashboardGraphData = {};
            for (let each in dashboardGraphData) {
              updatedDashboardGraphData[each] =
                dashboardGraphData[each].toFixed(2);
            }
            __.log(req.body, 'shift/read params');
            // __.log(listData)
            var templistData = JSON.stringify(listData);
            listData = JSON.parse(templistData);
            for (let date in listData) {
              listData[date].forEach((item, index) => {
                if (item.isLimit) {
                  const isLimitedStaff = item.appliedStaffs.filter((limit) => {
                    return limit.status == 1 && limit.isLimit;
                  });
                  if (isLimitedStaff.length > 0) {
                    for (let kk = 0; kk < item.confirmedStaffs.length; kk++) {
                      const staffCheck = item.confirmedStaffs[kk];
                      let isLimitStaffId = isLimitedStaff.filter((limit) => {
                        return limit.flexiStaff == staffCheck._id;
                      });
                      if (isLimitStaffId.length > 0) {
                        item.confirmedStaffs[kk].isLimit = true;
                      }
                    }
                  }
                }
                if (item.isExtendedShift) {
                  //console.log('present');
                  if (item.extendedStaff) {
                    item.extendedStaff.forEach((extendedStaffItem) => {
                      if (item.confirmedStaffs) {
                        item.confirmedStaffs.forEach((confirmedStaffsItem) => {
                          // console.log(typeof confirmedStaffs._id, confirmedStaffs._id,extendedStaff.userId )
                          if (
                            confirmedStaffsItem._id.toString() ===
                            extendedStaffItem.userId.toString()
                          ) {
                            confirmedStaffsItem.confirmStatus =
                              extendedStaffItem.confirmStatus;
                            confirmedStaffsItem.endDateTime =
                              extendedStaffItem.endDateTime;
                            confirmedStaffsItem.startDateTime =
                              extendedStaffItem.startDateTime;
                            confirmedStaffsItem.isLimit =
                              extendedStaffItem.isLimit;
                            console.log('match');
                          }
                        });
                      }
                    });
                  }
                }
                if (item.isSplitShift) {
                  listData[date].forEach((splitItem, splitIndex) => {
                    if (splitIndex !== index) {
                      if (
                        splitItem.isSplitShift &&
                        new Date(splitItem.date).getTime() ===
                          new Date(item.date).getTime() &&
                        splitItem.shiftId._id === item.shiftId._id
                      ) {
                        item.splitShiftStartTime = splitItem.startTime;
                        item.splitShiftEndTime = splitItem.endTime;
                        item.splitShiftId = splitItem._id;
                        listData[date].splice(splitIndex, 1);
                      }
                    }
                  });
                }
              });
            }

            for (var prop in graphData) {
              if (Object.prototype.hasOwnProperty.call(graphData, prop)) {
                // do stuff
                if (
                  graphData[prop].totalHours % 1 != 0 &&
                  graphData[prop].totalHours > 0
                )
                  graphData[prop].totalHours = parseFloat(
                    graphData[prop].totalHours.toFixed(2),
                  );
              }
            }
            for (var prop in graphDataWeb) {
              if (Object.prototype.hasOwnProperty.call(graphDataWeb, prop)) {
                // do stuff
                if (
                  graphDataWeb[prop].totalHours.need % 1 != 0 &&
                  graphDataWeb[prop].totalHours.need
                )
                  graphDataWeb[prop].totalHours.need = parseFloat(
                    graphDataWeb[prop].totalHours.need.toFixed(2),
                  );
                if (
                  graphDataWeb[prop].totalHours.booked % 1 != 0 &&
                  graphDataWeb[prop].totalHours.booked
                )
                  graphDataWeb[prop].totalHours.booked = parseFloat(
                    graphDataWeb[prop].totalHours.booked.toFixed(2),
                  );
              }
            }
            var templistData = JSON.stringify(listData);
            listData = JSON.parse(templistData);
            var newListData = {};
            for (let date in listData) {
              newListData[date] = [];
              listData[date].forEach((item, index) => {
                item.confirmedStaffs.forEach((staf) => {
                  var temp = JSON.parse(JSON.stringify(item));
                  if (temp.isExtendedShift) {
                    temp.extendedStaff = temp.extendedStaff.filter(
                      (extStaff) =>
                        extStaff.userId == staf._id &&
                        extStaff.confirmStatus == 2,
                    );
                    if (temp.extendedStaff.length == 0) {
                      temp.isExtendedShift = false;
                    }
                  }
                  temp.confirmedStaffs = staf;
                  newListData[date].push(temp);
                });
              });
            }
            __.out(res, 201, {
              list: newListData,
              graph: graphData,
            });
          } else {
            __.out(res, 201, {
              shifts: shifts,
            });
          }
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async readNewPlanShift(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      __.log(req.body, 'shift/viewBooking params');
      let requiredResult1 = await __.checkRequiredFields(req, [
        'businessUnitId',
        'startDate',
      ]);

      if (requiredResult1.status === false) {
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        var timeZone = moment
            .parseZone(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .format('Z'),
          startDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format(),
          endDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .add(5, 'days')
            .add(23, 'hours')
            .add(60, 'minutes')
            .add(59, 'seconds')
            .utc()
            .format(), //86399 => add 23:59:59
          weekNumber = await __.weekNoStartWithMonday(startDate);
        console.log('startDate11', startDate);
        console.log('endsdhhd', endDate);
        const aa = new Date(startDate).setUTCHours(0, 0, 0, 0);
        const bb = new Date(endDate).setUTCHours(24, 0, 0, 0);
        startDate = new Date(aa);
        endDate = new Date(bb);
        __.log(timeZone, req.body, startDate, 'timeZone');
        var shift = await Shift.find({
          businessUnitId: req.body.businessUnitId,
          status: 1,
          weekNumber: weekNumber,
        })
          .select('shiftDetails')
          .lean();
        //return res.json({weekNumber})
        function plucker(prop) {
          return function (o) {
            return o[prop];
          };
        }
        var shiftDetailsArray = shift.map(plucker('shiftDetails'));
        shiftDetailsArray = _.flatten(shiftDetailsArray);
        shiftDetailsArray = Array.from(new Set(shiftDetailsArray));
        if (shiftDetailsArray.length == 0) {
          __.out(res, 201, shiftDetailsArray);
        } else {
          var where = {
            status: 1,
            isAssignShift: false,
            _id: {
              $in: shiftDetailsArray,
            },
            'appliedStaffs.0': {
              $exists: true,
            },
          };
          where.date = {
            $gte: startDate,
            $lte: endDate,
          };
          // __.log(moment(endDate).endOf('day').utc().format(), moment(startDate).startOf('day').utc().format(), 'formatIssues')
          // Show Cancelled Shifts Also
          if (req.body.cancelledShifts && req.body.cancelledShifts === true) {
            where.status = {
              $in: [1, 2],
            };
          }
          var shifts = await ShiftDetails.find(where)
            .select('appliedStaffs')
            .lean();
          var appliedStaffsArray = shifts.map(plucker('appliedStaffs'));
          console.log('appliedStaffsArray', appliedStaffsArray);
          appliedStaffsArray = _.flatten(appliedStaffsArray);
          console.log('appliedStaffsArray fff', appliedStaffsArray);
          appliedStaffsArray = Array.from(new Set(appliedStaffsArray));
          if (appliedStaffsArray.length == 0) {
            __.out(res, 201, appliedStaffsArray);
          } else {
            var staffsShifts = await AppliedStaffs.find({
              _id: {
                $in: appliedStaffsArray,
              },
              status: {
                $in: [1, 2] /*only confirmed and standby slots */,
              },
            })
              .populate({
                path: 'flexiStaff',
                select: 'name staffId email contactNumber profilePicture',
                populate: {
                  path: 'subSkillSets',
                  select: 'name',
                  populate: {
                    path: 'skillSetId',
                    select: 'name',
                  },
                },
              })
              .populate({
                path: 'shiftDetailsId',
                populate: [
                  {
                    path: 'reportLocationId',
                    select: 'name status',
                  },
                  {
                    path: 'subSkillSets',
                    select: 'name status',
                    populate: {
                      path: 'skillSetId',
                      select: 'name status',
                    },
                  },
                  {
                    path: 'requestedShifts',
                    match: {
                      status: {
                        $in: [0, 2],
                      },
                    },
                    populate: {
                      path: 'reportLocationId',
                      select: 'name status',
                    },
                  },
                ],
              })
              .populate({
                path: 'shiftId',
                select: 'businessUnitId plannedBy',
                populate: [
                  {
                    path: 'plannedBy',
                    select: 'name staffId',
                  },
                  {
                    path: 'businessUnitId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                    populate: {
                      path: 'sectionId',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'departmentId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                        populate: {
                          path: 'companyId',
                          select: 'name status',
                          match: {
                            status: 1,
                          },
                        },
                      },
                    },
                  },
                ],
              })
              .lean();
            //   console.log('staffsShifts', staffsShifts);
            staffsShifts = await _.orderBy(
              staffsShifts,
              ['shiftDetailsId.startTime'],
              ['asc'],
            );
            var listData = {},
              graphData = {};
            //return res.json({staffsShifts})
            staffsShifts.forEach((element) => {
              var key = __.getDateStringFormat(
                element.shiftDetailsId.date,
                element.shiftDetailsId.timeZone,
              );
              if (listData[key]) {
                /*if date already keyed in array */
                listData[key].push(element);
                // Check shift is cancelled or not
                if (element.shiftDetailsId.status == 1) {
                  graphData[key].totalHours += element.shiftDetailsId.duration;
                  if (element.status == 1) {
                    graphData[key].confirmedHours +=
                      element.shiftDetailsId.duration;
                  } else if (element.status == 2) {
                    graphData[key].standByHours +=
                      element.shiftDetailsId.duration;
                  }
                }
              } else {
                /*else create a new key by date in array */
                listData[key] = [];
                graphData[key] = {
                  totalHours: 0,
                  confirmedHours: 0,
                  standByHours: 0,
                };
                listData[key].push(element);
                // Check shift is cancelled or not
                if (element.shiftDetailsId.status == 1) {
                  graphData[key].totalHours = element.shiftDetailsId.duration;
                  if (element.status == 1) {
                    graphData[key].confirmedHours =
                      element.shiftDetailsId.duration;
                    graphData[key].standByHours = 0;
                  } else if (element.status == 2) {
                    graphData[key].confirmedHours = 0;
                    graphData[key].standByHours =
                      element.shiftDetailsId.duration;
                  }
                }
              }
            });
            // __.log(graphData, "graphData");
            let newListData = JSON.stringify(listData);
            newListData = JSON.parse(newListData);
            for (let date in newListData) {
              newListData[date].forEach((item, index) => {
                if (item.shiftDetailsId.isExtendedShift) {
                  // console.log('aaa');
                  if (item.flexiStaff) {
                    if (item.shiftDetailsId.extendedStaff) {
                      const flexId = item.flexiStaff._id.toString();
                      const extendObj =
                        item.shiftDetailsId.extendedStaff.filter((extendS) => {
                          return extendS.userId.toString() === flexId;
                        });
                      if (extendObj.length > 0) {
                        // console.log(extendObj)
                        item.shiftDetailsId.extendedStaff = extendObj;
                        item.flexiStaff.confirmStatus =
                          extendObj[0].confirmStatus;
                        item.flexiStaff.startDateTime =
                          extendObj[0].startDateTime;
                        item.flexiStaff.endDateTime = extendObj[0].endDateTime;
                      }
                    }
                  }
                }
                if (item.shiftDetailsId.isSplitShift) {
                  console.log('aaaa');
                  newListData[date].forEach((splitItem, splitIndex) => {
                    if (splitIndex !== index) {
                      console.log('aabb');
                      if (
                        splitItem.shiftDetailsId.isSplitShift &&
                        new Date(splitItem.shiftDetailsId.date).getTime() ===
                          new Date(item.shiftDetailsId.date).getTime() &&
                        splitItem.shiftDetailsId.shiftId ===
                          item.shiftDetailsId.shiftId
                      ) {
                        item.shiftDetailsId.splitShiftStartTime =
                          splitItem.shiftDetailsId.startTime;
                        item.shiftDetailsId.splitShiftEndTime =
                          splitItem.shiftDetailsId.endTime;
                        item.shiftDetailsId.splitShiftId =
                          splitItem.shiftDetailsId._id;
                        newListData[date].splice(splitIndex, 1);
                      }
                    }
                  });
                }
              });
            }
            __.out(res, 201, {
              list: newListData,
              graph: graphData,
            });
          }
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async readNewPlanShift(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      __.log(req.body, 'shift/viewBooking params');
      let requiredResult1 = await __.checkRequiredFields(req, [
        'businessUnitId',
        'startDate',
      ]);
      if (requiredResult1.status === false) {
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        var timeZone = moment
            .parseZone(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .format('Z'),
          startDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format(),
          endDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .add(5, 'days')
            .add(23, 'hours')
            .add(60, 'minutes')
            .add(59, 'seconds')
            .utc()
            .format(), //86399 => add 23:59:59
          weekNumber = await __.weekNoStartWithMonday(startDate);
        console.log('startDate11', startDate);
        console.log('endsdhhd', endDate);
        const aa = new Date(startDate).setUTCHours(0, 0, 0, 0);
        const bb = new Date(endDate).setUTCHours(24, 0, 0, 0);
        startDate = new Date(aa);
        endDate = new Date(bb);
        __.log(timeZone, req.body, startDate, 'timeZone');
        var shift = await Shift.find({
          businessUnitId: req.body.businessUnitId,
          status: 1,
          weekNumber: weekNumber,
        })
          .select('shiftDetails')
          .lean();
        //return res.json({weekNumber})
        function plucker(prop) {
          return function (o) {
            return o[prop];
          };
        }
        var shiftDetailsArray = shift.map(plucker('shiftDetails'));
        shiftDetailsArray = _.flatten(shiftDetailsArray);
        shiftDetailsArray = Array.from(new Set(shiftDetailsArray));
        if (shiftDetailsArray.length == 0) {
          __.out(res, 201, shiftDetailsArray);
        } else {
          var where = {
            status: 1,
            isAssignShift: false,
            _id: {
              $in: shiftDetailsArray,
            },
            'appliedStaffs.0': {
              $exists: true,
            },
          };
          where.date = {
            $gte: startDate,
            $lte: endDate,
          };

          // __.log(moment(endDate).endOf('day').utc().format(), moment(startDate).startOf('day').utc().format(), 'formatIssues')
          // Show Cancelled Shifts Also
          if (req.body.cancelledShifts && req.body.cancelledShifts === true) {
            where.status = {
              $in: [1, 2],
            };
          }
          var shifts = await ShiftDetails.find(where)
            .select('appliedStaffs')
            .lean();
          //return res.json({shifts})
          var appliedStaffsArray = shifts.map(plucker('appliedStaffs'));
          //console.log('appliedStaffsArray', appliedStaffsArray);
          appliedStaffsArray = _.flatten(appliedStaffsArray);
          // console.log('appliedStaffsArray fff', appliedStaffsArray);
          appliedStaffsArray = Array.from(new Set(appliedStaffsArray));
          if (appliedStaffsArray.length == 0) {
            __.out(res, 201, appliedStaffsArray);
          } else {
            var staffsShifts = await AppliedStaffs.find({
              _id: {
                $in: appliedStaffsArray,
              },
              status: {
                $in: [1, 2] /*only confirmed and standby slots */,
              },
            })
              .populate({
                path: 'flexiStaff',
                select: 'name staffId email contactNumber profilePicture',
                populate: {
                  path: 'subSkillSets',
                  select: 'name',
                  populate: {
                    path: 'skillSetId',
                    select: 'name',
                  },
                },
              })
              .populate({
                path: 'shiftDetailsId',
                populate: [
                  {
                    path: 'reportLocationId',
                    select: 'name status',
                  },
                  {
                    path: 'subSkillSets',
                    select: 'name status',
                    populate: {
                      path: 'skillSetId',
                      select: 'name status',
                    },
                  },
                  {
                    path: 'requestedShifts',
                    match: {
                      status: {
                        $in: [0, 2],
                      },
                    },
                    populate: {
                      path: 'reportLocationId',
                      select: 'name status',
                    },
                  },
                ],
              })
              .populate({
                path: 'shiftId',
                select: 'businessUnitId plannedBy',
                populate: [
                  {
                    path: 'plannedBy',
                    select: 'name staffId',
                  },
                  {
                    path: 'businessUnitId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                    populate: {
                      path: 'sectionId',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'departmentId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                        populate: {
                          path: 'companyId',
                          select: 'name status',
                          match: {
                            status: 1,
                          },
                        },
                      },
                    },
                  },
                ],
              })
              .lean();
            //   console.log('staffsShifts', staffsShifts);
            staffsShifts = await _.orderBy(
              staffsShifts,
              ['shiftDetailsId.startTime'],
              ['asc'],
            );
            var listData = {},
              graphData = {};
            //return res.json({staffsShifts})
            staffsShifts.forEach((element) => {
              var key = __.getDateStringFormat(
                element.shiftDetailsId.date,
                element.shiftDetailsId.timeZone,
              );
              if (listData[key]) {
                /*if date already keyed in array */
                listData[key].push(element);
                // Check shift is cancelled or not
                if (element.shiftDetailsId.status == 1) {
                  graphData[key].totalHours += element.shiftDetailsId.duration;
                  if (element.status == 1) {
                    graphData[key].confirmedHours +=
                      element.shiftDetailsId.duration;
                  } else if (element.status == 2) {
                    graphData[key].standByHours +=
                      element.shiftDetailsId.duration;
                  }
                }
              } else {
                /*else create a new key by date in array */
                listData[key] = [];
                graphData[key] = {
                  totalHours: 0,
                  confirmedHours: 0,
                  standByHours: 0,
                };
                listData[key].push(element);
                // Check shift is cancelled or not
                if (element.shiftDetailsId.status == 1) {
                  graphData[key].totalHours = element.shiftDetailsId.duration;
                  if (element.status == 1) {
                    graphData[key].confirmedHours =
                      element.shiftDetailsId.duration;
                    graphData[key].standByHours = 0;
                  } else if (element.status == 2) {
                    graphData[key].confirmedHours = 0;
                    graphData[key].standByHours =
                      element.shiftDetailsId.duration;
                  }
                }
              }
            });
            // __.log(graphData, "graphData");
            let newListData = JSON.stringify(listData);
            newListData = JSON.parse(newListData);
            for (let date in newListData) {
              newListData[date].forEach((item, index) => {
                if (item.shiftDetailsId.isExtendedShift) {
                  // console.log('aaa');
                  if (item.flexiStaff) {
                    if (item.shiftDetailsId.extendedStaff) {
                      const flexId = item.flexiStaff._id.toString();
                      const extendObj =
                        item.shiftDetailsId.extendedStaff.filter((extendS) => {
                          return extendS.userId.toString() === flexId;
                        });
                      if (extendObj.length > 0) {
                        // console.log(extendObj)
                        item.shiftDetailsId.extendedStaff = extendObj;
                        item.flexiStaff.confirmStatus =
                          extendObj[0].confirmStatus;
                        item.flexiStaff.startDateTime =
                          extendObj[0].startDateTime;
                        item.flexiStaff.endDateTime = extendObj[0].endDateTime;
                      }
                    }
                  }
                }
                if (item.shiftDetailsId.isSplitShift) {
                  console.log('aaaa');
                  newListData[date].forEach((splitItem, splitIndex) => {
                    if (splitIndex !== index) {
                      console.log('aabb');
                      if (
                        splitItem.shiftDetailsId.isSplitShift &&
                        new Date(splitItem.shiftDetailsId.date).getTime() ===
                          new Date(item.shiftDetailsId.date).getTime() &&
                        splitItem.shiftDetailsId.shiftId ===
                          item.shiftDetailsId.shiftId
                      ) {
                        item.shiftDetailsId.splitShiftStartTime =
                          splitItem.shiftDetailsId.startTime;
                        item.shiftDetailsId.splitShiftEndTime =
                          splitItem.shiftDetailsId.endTime;
                        item.shiftDetailsId.splitShiftId =
                          splitItem.shiftDetailsId._id;
                        newListData[date].splice(splitIndex, 1);
                      }
                    }
                  });
                }
              });
            }
            __.out(res, 201, {
              list: newListData,
              graph: graphData,
            });
          }
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async userBookings(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult1 = await __.checkRequiredFields(req, [
        'userId',
        'date',
      ]);
      if (requiredResult1.status === false) {
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        var timeZone = moment
          .parseZone(req.body.date, 'MM-DD-YYYY HH:mm:ss Z')
          .format('Z');
        var where = {
          status: 1,
          $or: [
            {
              confirmedStaffs: req.body.userId,
            },
            {
              backUpStaffs: req.body.userId,
            },
          ],
        };
        where.userId = req.body.userId;
        var userShiftDetails = await staffShiftController.shiftDetails(
          where,
          res,
        );
        var groupByDate = function (o) {
          return __.getDateStringFormat(o.date, timeZone); //dd-mm-yyy
        };
        var matchingResults = await _.chain(userShiftDetails)
          .groupBy(groupByDate)
          .orderBy('date', 'asc')
          .value();
        __.out(res, 201, matchingResults);
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async matchingStaffs(shiftDetails, res) {
    try {
      __.log('am here in matchingStaffs ');
      var orArray = [],
        userIdsToSkip = [];

      if (!Array.isArray(shiftDetails)) {
        userIdsToSkip = [
          ...shiftDetails.confirmedStaffs,
          ...shiftDetails.backUpStaffs,
        ];
        shiftDetails = [shiftDetails];
      }
      shiftDetails.forEach((shift) => {
        console.log('shift.skillSetTierType', shift.skillSetTierType);
        /*or condition for any of the shift skill set matches the user */
        if (shift.skillSetTierType != 1) {
          orArray.push({
            subSkillSets: {
              $all: shift.subSkillSets,
            },
          });
        } else {
          orArray.push({
            mainSkillSets: {
              $all: shift.mainSkillSets,
            },
          });
        }
      });

      var users = await User.find({
        _id: {
          $nin: userIdsToSkip,
        },
        $or: orArray,
        $and: [
          {
            deviceToken: {
              $exists: true,
            },
          },
          {
            deviceToken: {
              $ne: '',
            },
          },
        ],
      })
        .populate({
          path: 'role',
          match: {
            status: 1,
            isFlexiStaff: 1,
          },
          select: 'name isFlexiStaff',
        })
        .lean();
      var deviceTokens = [];
      // __.log('matchging staffs', users)
      for (let x of users) {
        if (x.role && x.role.isFlexiStaff == 1)
          /*only flexistaff */
          deviceTokens.push(x.deviceToken);
      }
      return deviceTokens;
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async adjust(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      if (!req.body.isSplitShift) {
        try {
          let requiredResult = await __.checkRequiredFields(req, [
            'shiftDetailsId',
            'staffNeedCount',
          ]);
          if (requiredResult.status === false) {
            __.out(res, 400, requiredResult.missingFields);
          } else {
            if (mongoose.Types.ObjectId.isValid(req.body.shiftDetailsId)) {
              var shiftDetails = await ShiftDetails.findOne({
                _id: req.body.shiftDetailsId,
                status: 1,
                startTime: {
                  $gt: moment().utc().format(),
                },
              }).populate([
                {
                  path: 'shiftId',
                  select:
                    'businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
                },
                {
                  path: 'appliedStaffs',
                  match: {
                    status: 2,
                  },
                  options: {
                    sort: {
                      createdAt: 1,
                    },
                  },
                  populate: [
                    {
                      path: 'flexiStaff',
                      select: 'deviceToken',
                    },
                    {
                      path: 'shiftId',
                      select:
                        'businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
                    },
                    // ,
                    // {
                    //     path: 'shiftId',
                    //     select: 'businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
                    //     populate: {
                    //         path: 'businessUnitId',
                    //     }
                    // }
                  ],
                },
              ]);
              if (
                shiftDetails &&
                shiftDetails.shiftId &&
                shiftDetails.shiftId.businessUnitId
              ) {
                // return res.json({ shiftDetails })
                const redisBuId = shiftDetails.shiftId.businessUnitId;
                if (
                  shiftDetails.activeStatus &&
                  shiftDetails.activeStatus === true
                ) {
                  return __.out(
                    res,
                    300,
                    'Previous Request Change is in process',
                  );
                }
                // Save Existing Confirmed Count
                let previousStaffNeedCount = shiftDetails.staffNeedCount;
                // Get Shift Main Details ( Shift Collection )
                let shiftMainDetails = await Shift.findOne({
                  _id: shiftDetails.shiftId,
                })
                  .populate({
                    path: 'businessUnitId',
                  })
                  .lean();
                // __.log(shiftMainDetails, "shiftDetails.shiftId")

                var clonedShiftDetails = _.cloneDeep(shiftDetails);
                if (
                  req.body.staffNeedCount >=
                    shiftDetails.confirmedStaffs.length &&
                  req.body.staffNeedCount != 0
                ) {
                  var staffIncreasedBy =
                    req.body.staffNeedCount - shiftDetails.staffNeedCount;
                  /****** these vars are meant for logs******* */
                  let oldCount = shiftDetails.staffNeedCount;
                  let newCount = req.body.staffNeedCount;
                  /******************************************* */
                  shiftDetails.staffNeedCount = req.body.staffNeedCount;
                  shiftDetails.totalStaffNeedCount =
                    shiftDetails.totalStaffNeedCount + staffIncreasedBy;
                  await shiftDetails.save();
                  var weeksStartsAtForPush = moment(
                    shiftDetails.startTime,
                  ).unix();
                  var weeksEndsAtForPush = moment(shiftDetails.endTime).unix(),
                    toConfirmDeviceTokens = [];
                  // delete req.body.shiftDetailsId;
                  var shiftStartsWithIn = await __.getDurationInHours(
                    moment().utc().format(),
                    shiftDetails.startTime,
                  ); /*in hours */
                  var shiftStartsWithInMinutes = (
                    shiftStartsWithIn * 60
                  ).toFixed(2); /*in minutes */
                  /*notification starts */
                  if (shiftDetails.appliedStaffs.length > 0) {
                    let shiftCancelHours =
                      process.env.CANCELLATION_SHIFT_CHECK_HOURS;
                    if (shiftMainDetails.businessUnitId.shiftCancelHours) {
                      shiftCancelHours =
                        shiftMainDetails.businessUnitId.shiftCancelHours;
                    }
                    if (Number(shiftStartsWithIn) >= Number(shiftCancelHours)) {
                      __.log('am greater than 12 hr');
                      /*if shift start time greater or equal to custom number then confirm the stand by staff who applied first*/
                      var i = 0,
                        appliedStaffsArray = [],
                        flexiStaffs = [],
                        deviceTokens = [];
                      for (let eachStaff of shiftDetails.appliedStaffs) {
                        i++;
                        if (i > staffIncreasedBy) {
                          break;
                        }
                        appliedStaffsArray.push(eachStaff._id);
                        flexiStaffs.push(eachStaff.flexiStaff._id);
                        deviceTokens.push(eachStaff.flexiStaff.deviceToken);
                      }
                      await AppliedStaffs.update(
                        {
                          _id: {
                            $in: appliedStaffsArray,
                          },
                        },
                        {
                          $set: {
                            status: 1,
                          },
                        },
                        {
                          multi: true,
                        },
                      );
                      var pulledBackupedStaffs =
                        shiftDetails.backUpStaffs.reduce((acc, x) => {
                          var chk = flexiStaffs.findIndex((y) =>
                            _.isEqual(
                              mongoose.Types.ObjectId(y),
                              mongoose.Types.ObjectId(x),
                            ),
                          );
                          if (chk == -1) {
                            acc.push(x);
                          }
                          return acc;
                        }, []);
                      await ShiftDetails.update(
                        {
                          _id: req.body.shiftDetailsId,
                        },
                        {
                          $set: {
                            backUpStaffs: pulledBackupedStaffs,
                            confirmedStaffs: [
                              ...shiftDetails.confirmedStaffs,
                              ...flexiStaffs,
                            ], //concat two arrays
                          },
                        },
                      );

                      if (deviceTokens.length > 0) {
                        var pushData = {
                            title: 'You are activated!',
                            body: `Standby shift has been activated`,
                            bodyText: `Standby shift on XXX to XXX has been activated`,
                            bodyTime: [
                              shiftDetails.startTimeInSeconds,
                              shiftDetails.endTimeInSeconds,
                            ],
                            bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                          },
                          collapseKey =
                            req.body
                              .shiftDetailsId; /*unique id for this particular shift */
                        FCM.push(deviceTokens, pushData, collapseKey);
                      }
                      if (appliedStaffsArray.length < staffIncreasedBy) {
                        /*still more staff needed  */
                        toConfirmDeviceTokens = await this.matchingStaffs(
                          clonedShiftDetails,
                          res,
                        );
                      }
                    } else {
                      /*if shift start time less than custom number then send notification to all standby staffs to confirm */
                      __.log('am lesser than 12 hr');
                      await ShiftDetails.update(
                        {
                          _id: req.body.shiftDetailsId,
                        },
                        {
                          $set: {
                            isShortTimeAdjust: 1,
                            shortTimeAdjustRequestRecjectedFlexistaffs: [],
                          },
                        },
                      );

                      var appliedStaffsArray = [],
                        flexiStaffs = [],
                        deviceTokens = [];
                      for (let eachStaff of shiftDetails.appliedStaffs) {
                        deviceTokens.push(eachStaff.flexiStaff.deviceToken);
                      }

                      if (deviceTokens.length > 0) {
                        var pushData = {
                            title: 'Confirm your standby shift now!',
                            body: `Standby shift is available for confirmation`,
                            bodyText: `Standby shift on XXX to XXX is available for confirmation`,
                            bodyTime: [
                              shiftDetails.startTimeInSeconds,
                              shiftDetails.endTimeInSeconds,
                            ],
                            bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                          },
                          collapseKey =
                            req.body
                              .shiftDetailsId; /*unique id for this particular shift */
                        FCM.push(deviceTokens, pushData, collapseKey);
                      }
                      toConfirmDeviceTokens = await this.matchingStaffs(
                        clonedShiftDetails,
                        res,
                      );
                    }
                  } else {
                    toConfirmDeviceTokens = await this.matchingStaffs(
                      clonedShiftDetails,
                      res,
                    );
                  }
                  if (toConfirmDeviceTokens.length > 0) {
                    // Check Adjuste Count is higher that previous
                    if (req.body.staffNeedCount > previousStaffNeedCount) {
                      var pushData = {
                          title: 'Immediate shift for Booking!',
                          body: `Shift is available for booking`,
                          bodyText: `Shift on XXX to XXX is available for booking`,
                          bodyTime: [
                            shiftDetails.startTimeInSeconds,
                            shiftDetails.endTimeInSeconds,
                          ],
                          bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                        },
                        collapseKey =
                          req.body
                            .shiftDetailsId; /*unique id for this particular shift */
                      FCM.push(toConfirmDeviceTokens, pushData, collapseKey);
                    }
                  }

                  /*notification ends */
                  /*data for report (adjust user log) starts */
                  await ShiftDetails.update(
                    {
                      _id: req.body.shiftDetailsId,
                    },
                    {
                      $push: {
                        adjustedBy: {
                          increasedStaffCount: staffIncreasedBy,
                          adjustedUserId: req.user._id,
                          minutesToShiftStartTime: shiftStartsWithInMinutes,
                        },
                      },
                    },
                  );
                  /*data for report (adjust user log) ends */
                  let adjustedShift = req.body.shiftDetailsId;
                  delete req.body.shiftDetailsId;

                  let logMetaData = await Shift.findOne({
                    _id: clonedShiftDetails.shiftId,
                  })
                    .select(
                      'shiftId businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
                    )
                    .lean();
                  /* Add to log */
                  let statusLogData = {
                    userId: req.user._id,
                    status: 5,
                    /* shift created */
                    shiftId: clonedShiftDetails.shiftId,
                    weekRangeStartsAt: logMetaData.weekRangeStartsAt,
                    weekRangeEndsAt: logMetaData.weekRangeEndsAt,
                    weekNumber: logMetaData.weekNumber,
                    businessUnitId: logMetaData.businessUnitId,
                    adjustedShift: adjustedShift,
                    oldCount: oldCount,
                    newCount: newCount,
                  };
                  // const callTwoAtaTime = await Promise.all([
                  // shiftLogController.create(statusLogData, res),
                  // this.updateRedis(redisBuId),
                  // ]);
                  // console.log('callTwoAtaTime', callTwoAtaTime);
                  await shiftLogController.create(statusLogData, res);
                  // await this.updateRedis(redisBuId)
                  console.log('In adjust after setting');
                  if (req.body.businessUnitId && req.body.startDate)
                    this.readNew(req, res); /*for web */
                  /*for mobile */ else
                    __.out(res, 201, 'Shift has been updated successfully');
                } else {
                  __.out(res, 300, 'Invalid Staff Adjusted Count');
                }
              } else {
                __.out(res, 300, 'Invalid Shift / Shift expired');
              }
            } else {
              __.out(res, 300, 'Invalid Shift Id');
            }
          }
        } catch (err) {
          __.log(err);
          __.out(res, 500);
        }
      } else {
        try {
          await this.adjustSplitShift(req, res);
        } catch (err) {
          __.log(err);
          __.out(res, 500);
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async adjustSplitShift(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'staffNeedCount',
      ]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        if (mongoose.Types.ObjectId.isValid(req.body.shiftDetailsId)) {
          var shiftDetails = await ShiftDetails.findOne({
            _id: req.body.shiftDetailsId,
            status: 1,
            startTime: {
              $gt: moment().utc().format(),
            },
          }).populate({
            path: 'appliedStaffs',
            match: {
              status: 2,
            },
            options: {
              sort: {
                createdAt: 1,
              },
            },
            populate: [
              {
                path: 'flexiStaff',
                select: 'deviceToken',
              },
              {
                path: 'shiftId',
                select:
                  'businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
              },
              // ,
              // {
              //     path: 'shiftId',
              //     select: 'businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
              //     populate: {
              //         path: 'businessUnitId',
              //     }
              // }
            ],
          });
          if (shiftDetails) {
            if (
              shiftDetails.activeStatus &&
              shiftDetails.activeStatus === true
            ) {
              return __.out(res, 300, 'Previous Request Change is in process');
            }
            // Save Existing Confirmed Count
            let previousStaffNeedCount = shiftDetails.staffNeedCount;
            // Get Shift Main Details ( Shift Collection )
            let shiftMainDetails = await Shift.findOne({
              _id: shiftDetails.shiftId,
            })
              .populate({
                path: 'businessUnitId',
              })
              .lean();
            __.log(shiftMainDetails, 'shiftDetails.shiftId');
            var clonedShiftDetails = _.cloneDeep(shiftDetails);
            if (
              req.body.staffNeedCount >= shiftDetails.confirmedStaffs.length &&
              req.body.staffNeedCount != 0
            ) {
              var staffIncreasedBy =
                req.body.staffNeedCount - shiftDetails.staffNeedCount;
              /****** these vars are meant for logs******* */
              let oldCount = shiftDetails.staffNeedCount;
              let newCount = req.body.staffNeedCount;
              /******************************************* */
              shiftDetails.staffNeedCount = req.body.staffNeedCount;
              shiftDetails.totalStaffNeedCount =
                shiftDetails.totalStaffNeedCount + staffIncreasedBy;
              await shiftDetails.save();
              // const splitShiftUpdate = await ShiftDetails.update({_id:req.body.splitShiftId}, {$set:{staffNeedCount: req.body.staffNeedCount,
              //         totalStaffNeedCount: shiftDetails.totalStaffNeedCount}},
              //     {upsert: true}).lean();
              var weeksStartsAtForPush = moment(shiftDetails.startTime).unix();
              var weeksEndsAtForPush = moment(shiftDetails.endTime).unix(),
                toConfirmDeviceTokens = [];
              // delete req.body.shiftDetailsId;
              var shiftStartsWithIn = await __.getDurationInHours(
                moment().utc().format(),
                shiftDetails.startTime,
              ); /*in hours */
              var shiftStartsWithInMinutes = (shiftStartsWithIn * 60).toFixed(
                2,
              ); /*in minutes */
              /*notification starts */
              if (shiftDetails.appliedStaffs.length > 0) {
                let shiftCancelHours =
                  process.env.CANCELLATION_SHIFT_CHECK_HOURS;
                if (shiftMainDetails.businessUnitId.shiftCancelHours) {
                  shiftCancelHours =
                    shiftMainDetails.businessUnitId.shiftCancelHours;
                }
                if (Number(shiftStartsWithIn) >= Number(shiftCancelHours)) {
                  __.log('am greater than 12 hr');
                  /*if shift start time greater or equal to custom number then confirm the stand by staff who applied first*/
                  var i = 0,
                    appliedStaffsArray = [],
                    flexiStaffs = [],
                    deviceTokens = [];
                  for (let eachStaff of shiftDetails.appliedStaffs) {
                    i++;
                    if (i > staffIncreasedBy) {
                      break;
                    }
                    appliedStaffsArray.push(eachStaff._id);
                    flexiStaffs.push(eachStaff.flexiStaff._id);
                    deviceTokens.push(eachStaff.flexiStaff.deviceToken);
                  }

                  await AppliedStaffs.update(
                    {
                      _id: {
                        $in: appliedStaffsArray,
                      },
                    },
                    {
                      $set: {
                        status: 1,
                      },
                    },
                    {
                      multi: true,
                    },
                  );
                  var pulledBackupedStaffs = shiftDetails.backUpStaffs.reduce(
                    (acc, x) => {
                      var chk = flexiStaffs.findIndex((y) =>
                        _.isEqual(
                          mongoose.Types.ObjectId(y),
                          mongoose.Types.ObjectId(x),
                        ),
                      );
                      if (chk == -1) {
                        acc.push(x);
                      }
                      return acc;
                    },
                    [],
                  );

                  await ShiftDetails.update(
                    {
                      _id: req.body.shiftDetailsId,
                    },
                    {
                      $set: {
                        backUpStaffs: pulledBackupedStaffs,
                        confirmedStaffs: [
                          ...shiftDetails.confirmedStaffs,
                          ...flexiStaffs,
                        ], //concat two arrays
                      },
                    },
                  );
                  if (deviceTokens.length > 0) {
                    var pushData = {
                        title: 'You are activated!',
                        body: `Standby shift has been activated`,
                        bodyText: `Standby shift on XXX to XXX has been activated`,
                        bodyTime: [
                          shiftDetails.startTimeInSeconds,
                          shiftDetails.endTimeInSeconds,
                        ],
                        bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                      },
                      collapseKey =
                        req.body
                          .shiftDetailsId; /*unique id for this particular shift */
                    FCM.push(deviceTokens, pushData, collapseKey);
                  }
                  if (appliedStaffsArray.length < staffIncreasedBy) {
                    /*still more staff needed  */
                    toConfirmDeviceTokens = await this.matchingStaffs(
                      clonedShiftDetails,
                      res,
                    );
                  }
                } else {
                  /*if shift start time less than custom number then send notification to all standby staffs to confirm */
                  __.log('am lesser than 12 hr');
                  await ShiftDetails.update(
                    {
                      _id: req.body.shiftDetailsId,
                    },
                    {
                      $set: {
                        isShortTimeAdjust: 1,
                        shortTimeAdjustRequestRecjectedFlexistaffs: [],
                      },
                    },
                  );
                  var appliedStaffsArray = [],
                    flexiStaffs = [],
                    deviceTokens = [];
                  for (let eachStaff of shiftDetails.appliedStaffs) {
                    deviceTokens.push(eachStaff.flexiStaff.deviceToken);
                  }
                  if (deviceTokens.length > 0) {
                    var pushData = {
                        title: 'Confirm your standby shift now!',
                        body: `Standby shift is available for confirmation`,
                        bodyText: `Standby shift on XXX to XXX is available for confirmation`,
                        bodyTime: [
                          shiftDetails.startTimeInSeconds,
                          shiftDetails.endTimeInSeconds,
                        ],
                        bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                      },
                      collapseKey =
                        req.body
                          .shiftDetailsId; /*unique id for this particular shift */
                    FCM.push(deviceTokens, pushData, collapseKey);
                  }
                  toConfirmDeviceTokens = await this.matchingStaffs(
                    clonedShiftDetails,
                    res,
                  );
                }
              } else {
                toConfirmDeviceTokens = await this.matchingStaffs(
                  clonedShiftDetails,
                  res,
                );
              }
              if (toConfirmDeviceTokens.length > 0) {
                // Check Adjuste Count is higher that previous
                if (req.body.staffNeedCount > previousStaffNeedCount) {
                  var pushData = {
                      title: 'Immediate shift for Booking!',
                      body: `Shift is available for booking`,
                      bodyText: `Shift on XXX to XXX is available for booking`,
                      bodyTime: [
                        shiftDetails.startTimeInSeconds,
                        shiftDetails.endTimeInSeconds,
                      ],
                      bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                    },
                    collapseKey =
                      req.body
                        .shiftDetailsId; /*unique id for this particular shift */
                  FCM.push(toConfirmDeviceTokens, pushData, collapseKey);
                }
              }
              /*notification ends */
              /*data for report (adjust user log) starts */
              await ShiftDetails.update(
                {
                  _id: req.body.shiftDetailsId,
                },
                {
                  $push: {
                    adjustedBy: {
                      increasedStaffCount: staffIncreasedBy,
                      adjustedUserId: req.user._id,
                      minutesToShiftStartTime: shiftStartsWithInMinutes,
                    },
                  },
                },
              );
              /*data for report (adjust user log) ends */
              let adjustedShift = req.body.shiftDetailsId;
              delete req.body.shiftDetailsId;

              let logMetaData = await Shift.findOne({
                _id: clonedShiftDetails.shiftId,
              })
                .select(
                  'shiftId businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
                )
                .lean();
              /* Add to log */
              let statusLogData = {
                userId: req.user._id,
                status: 5,
                /* shift created */
                shiftId: clonedShiftDetails.shiftId,
                weekRangeStartsAt: logMetaData.weekRangeStartsAt,
                weekRangeEndsAt: logMetaData.weekRangeEndsAt,
                weekNumber: logMetaData.weekNumber,
                businessUnitId: logMetaData.businessUnitId,
                adjustedShift: adjustedShift,
                oldCount: oldCount,
                newCount: newCount,
              };
              shiftLogController.create(statusLogData, res);
              await this.updateRedis(logMetaData.businessUnitId);
              if (req.body.businessUnitId && req.body.startDate)
                this.readNew(req, res); /*for web */
              /*for mobile */ else
                __.out(res, 201, 'Shift has been updated successfully');
            } else {
              __.out(res, 300, 'Invalid Staff Adjusted Count');
            }
          } else {
            __.out(res, 300, 'Invalid Shift / Shift expired');
          }
        } else {
          __.out(res, 300, 'Invalid Shift Id');
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async request(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'startTime',
        'endTime',
        'reportLocationId',
        'flexiStaffId',
      ]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        var existingShiftDetails = await ShiftDetails.findOne({
          _id: req.body.shiftDetailsId,
          confirmedStaffs: req.body.flexiStaffId,
          startTime: {
            $gt: moment().utc().format(),
          },
        })
          .populate([
            {
              path: 'confirmedStaffs',
              match: {
                _id: req.body.flexiStaffId,
              },
              select: 'deviceToken',
            },
            {
              path: 'shiftId',
              select:
                'businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
            },
          ])
          .lean();
        if (existingShiftDetails) {
          /* Check if given shift start time is lesser than the current time */
          let requestStartTime = moment(
              req.body.startTime,
              'MM-DD-YYYY HH:mm:ss Z',
            ).utc(),
            currentTime = moment().utc();
          if (moment(currentTime).isAfter(requestStartTime)) {
            __.out(
              res,
              300,
              'Shift start time cannot be lesser than the current time!',
            );
            return;
          }
          /* End of start time validate */
          let shiftBusinessUnit = existingShiftDetails.shiftId.businessUnitId;
          let shiftWeekNumber = existingShiftDetails.shiftId.weekNumber;
          let shiftWeekRangeStartsAt =
            existingShiftDetails.shiftId.weekRangeStartsAt;
          let shiftWeekRangeEndsAt =
            existingShiftDetails.shiftId.weekRangeEndsAt;
          var shiftObj = {};
          shiftObj.startTime = requestStartTime.format();
          shiftObj.endTime = moment(req.body.endTime, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format();
          var data = {
            startTime: shiftObj.startTime,
            endTime: shiftObj.endTime,
            flexiStaffId: req.body.flexiStaffId,
            shiftDetailsId: req.body.shiftDetailsId,
          };
          var checkStaffAvailableInGivenTime =
            await staffShiftController.checkStaffAvailableInGivenTime(
              data,
              res,
            );
          if (checkStaffAvailableInGivenTime) {
            var dateForPush = moment(
              req.body.startTime,
              'MM-DD-YYYY HH:mm:ss Z',
            )
              .utc()
              .format('DD MMM');
            var weeksStartsAtForPush = moment(
              req.body.startTime,
              'MM-DD-YYYY HH:mm:ss Z',
            )
              .utc()
              .format('HHmm');
            var weeksEndsAtForPush = moment(
              req.body.endTime,
              'MM-DD-YYYY HH:mm:ss Z',
            )
              .utc()
              .format('HHmm');
            shiftObj.shiftId = existingShiftDetails.shiftId;
            shiftObj.subSkillSets = existingShiftDetails.subSkillSets;
            shiftObj.staffNeedCount = 1;
            shiftObj.totalStaffNeedCount = 1;
            shiftObj.reportLocationId = req.body.reportLocationId;
            shiftObj.date = existingShiftDetails.date;
            shiftObj.startTimeInSeconds = moment(
              req.body.startTime,
              'MM-DD-YYYY HH:mm:ss Z',
            )
              .utc()
              .unix();
            shiftObj.endTimeInSeconds = moment(
              req.body.endTime,
              'MM-DD-YYYY HH:mm:ss Z',
            )
              .utc()
              .unix();
            shiftObj.day = existingShiftDetails.day;
            shiftObj.duration = __.getDurationInHours(
              shiftObj.startTime,
              shiftObj.endTime,
            );
            shiftObj.dedicatedRequestTo = req.body.flexiStaffId;
            shiftObj.referenceShiftDetailsId = req.body.shiftDetailsId;
            shiftObj.status = 0;
            /*insert new shift details */
            let insertedShiftDetails = await new ShiftDetails(shiftObj).save(),
              insertedShiftDetailsId = insertedShiftDetails._id;
            /*set the reference for new shiftDetailsId(newly inserted) to the existing shift id*/
            await ShiftDetails.update(
              {
                _id: req.body.shiftDetailsId,
              },
              {
                $addToSet: {
                  requestedShifts: insertedShiftDetailsId,
                },
              },
            );
            /*update shift by shiftdetails inserted id */
            await Shift.update(
              {
                _id: req.body.shiftId,
              },
              {
                $addToSet: {
                  shiftDetails: insertedShiftDetailsId,
                },
              },
            );
            /*push notification to user */
            var userDeviceToken = false;
            if (
              existingShiftDetails.confirmedStaffs[0].deviceToken &&
              existingShiftDetails.confirmedStaffs[0].deviceToken != ''
            ) {
              userDeviceToken =
                existingShiftDetails.confirmedStaffs[0].deviceToken;
            }
            if (userDeviceToken) {
              var pushData = {
                  title: 'Shift Change Request!',
                  body: 'Shift Change Request',
                  bodyText: 'Shift on XXX, change to XXX - XXX',
                  bodyTime: [
                    insertedShiftDetails.startTimeInSeconds,
                    insertedShiftDetails.startTimeInSeconds,
                    insertedShiftDetails.endTimeInSeconds,
                  ],
                  bodyTimeFormat: ['dd MMM', 'HHmm', 'HHmm'],
                },
                collapseKey =
                  req.body.shiftId; /*unique id for this particular shift */
              FCM.push([userDeviceToken], pushData, collapseKey);
            }
            /* Add to log */
            let statusLogData = {
              userId: req.user._id,
              status: 6,
              weekRangeStartsAt: shiftWeekRangeStartsAt,
              weekRangeEndsAt: shiftWeekRangeEndsAt,
              weekNumber: shiftWeekNumber,
              /* shift created */
              businessUnitId: shiftBusinessUnit,
              shiftId: shiftObj.shiftId,
              pendingShift: insertedShiftDetailsId,
              existingShift: req.body.shiftDetailsId,
            };
            shiftLogController.create(statusLogData, res);
            await this.updateRedis(shiftBusinessUnit);
            __.out(
              res,
              201,
              'Shift request has been successfully sent to the user',
            );
          } else {
            __.out(
              res,
              300,
              'Flexistaff already have a shift(s) between this time range',
            );
          }
        } else {
          __.out(res, 300, 'Invalid Shift / Shift expired');
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async updateDate(req, res) {
    try {
      var shifts = await ShiftDetails.find({});
      shifts.forEach(async (element) => {
        await ShiftDetails.findOneAndUpdate(
          {
            _id: element._id,
          },
          {
            $set: {
              startTimeInSeconds: +new Date(element.startTime) / 1000,
              endTimeInSeconds: +new Date(element.endTime) / 1000,
            },
          },
        );
      });
      __.out(res, 200);
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async profileNotifications(req, res) {
    try {
      let notificationData = await OtherNotification.find({
        user: req.user._id,
      })
        .select('-fromUser -__v')
        .sort({
          createdAt: -1,
        })
        .lean();

      __.out(res, 201, {
        data: notificationData,
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  /**
   * Change Shift for all users
   */
  async requestChange(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      __.log(req.body, 'requestChange');
      __.log(
        moment(req.body.startTime, 'MM-DD-YYYY HH:mm:ss Z').utc().format(),
        'asdasd',
      );
      __.log(
        moment(req.body.endTime, 'MM-DD-YYYY HH:mm:ss Z').utc().format(),
        'end',
      );
      let requiredResult1 = await __.checkRequiredFields(req, [
        'shiftId',
        'shiftDetailsId',
      ]);
      if (requiredResult1.status === false) {
        return __.out(res, 400, requiredResult1.missingFields);
      }
      // Get Confirmed/ Backup Users of this shift
      let shiftDetailsData = await ShiftDetails.findOne({
        _id: req.body.shiftDetailsId,
        shiftId: req.body.shiftId,
        startTime: {
          $gt: moment().utc().format(),
        },
      })
        .populate({
          path: 'shiftId',
        })
        .populate({
          path: 'confirmedStaffs',
          select: '_id deviceToken',
        });

      if (!shiftDetailsData) {
        return __.out(res, 300, 'Invalid Shift Id/Shift Expired');
      }
      const redisBuId = shiftDetailsData.shiftId.businessUnitId;
      if (shiftDetailsData.activeStatus === true) {
        return __.out(res, 300, 'Previous Request Change is in process');
      }
      if (req.body.staffNeedCount < 1) {
        return __.out(res, 300, 'Staff need Count Should be greater than 0');
      }
      const startTimeInSeconds = moment(
        req.body.startTime,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .unix();
      const endTimeInSeconds = moment(req.body.endTime, 'MM-DD-YYYY HH:mm:ss Z')
        .utc()
        .unix();
      let insertNewShift = {
        shiftId: shiftDetailsData.shiftId,
        subSkillSets: shiftDetailsData.subSkillSets,
        totalStaffNeedCount: req.body.staffNeedCount,
        staffNeedCount: req.body.staffNeedCount,
        backUpStaffNeedCount: 0,
        date: shiftDetailsData.date,
        day: shiftDetailsData.day,
        startTime: moment(req.body.startTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format(),
        endTime: moment(req.body.endTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format(),
        startTimeInSeconds: moment(req.body.startTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .unix(),
        endTimeInSeconds: moment(req.body.endTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .unix(),
        duration: ((endTimeInSeconds - startTimeInSeconds) / 3600).toFixed(2),
        reportLocationId: req.body.reportLocationId,
        isRequested: true,
        requestedBy: req.user._id,
        referenceShiftDetailsId: req.body.shiftDetailsId,
        appliedStaffs: [],
        status: 0,
      };
      let newShiftData = await new ShiftDetails(insertNewShift).save();
      let requestuserTokens = [];
      let requestedUsers = [];
      for (let userData of shiftDetailsData.confirmedStaffs) {
        // Log Users
        let insert = {
          userId: userData._id,
          shiftDetailsId: newShiftData._id,
          status: 0,
        };
        requestedUsers.push(insert);
        // Send Push
        if (userData.deviceToken) {
          requestuserTokens.push(userData.deviceToken);
        }
        // Insert in Applied Staff
        let appliedData = {
          flexiStaff: userData._id,
          shiftId: newShiftData.shiftId,
          shiftDetailsId: newShiftData._id,
          status: 0,
        };
        let appliedStaff = await new AppliedStaffs(appliedData).save();
        newShiftData.appliedStaffs.push(appliedStaff._id);
      }

      // Update Parent Shift
      shiftDetailsData.requestedUsers = shiftDetailsData.requestedUsers || [];
      shiftDetailsData.requestedUsers = [
        ...shiftDetailsData.requestedUsers,
        ...requestedUsers,
      ];
      shiftDetailsData.activeStatus = true;
      __.log(newShiftData, 'newShiftData');
      shiftDetailsData.currentReqShift = newShiftData._id;
      shiftDetailsData.requestedShifts = shiftDetailsData.requestedShifts || [];
      shiftDetailsData.requestedShifts.push(newShiftData._id);
      await shiftDetailsData.save();
      await newShiftData.save();

      // Request Change Shift Notification
      if (requestuserTokens.length > 0) {
        var pushRequestData = {
            title: 'Shift Change Request',
            body: 'You have a shift change request',
            bodyText: 'XXX - XXX shift is on request change',
            bodyTime: [
              shiftDetailsData.shiftId.weeksStartsAtForPush,
              shiftDetailsData.shiftId.weeksEndsAtForPush,
            ],
            bodyTimeFormat: ['dd MMM', 'dd MMM'],
          },
          collapseKey =
            newShiftData._id; /*unique id for this particular shift */
        FCM.push(requestuserTokens, pushRequestData, collapseKey);
      }

      /* Insert New Shift Details in Shift */
      // console.log(newShiftData, 'newShiftData')
      await Shift.findOneAndUpdate(
        {
          _id: shiftDetailsData.shiftId,
        },
        {
          $addToSet: {
            shiftDetails: newShiftData._id,
          },
        },
        {
          multi: false,
        },
      );

      /* Create Shift Log */
      let logMetaData = await Shift.findOne({
        _id: shiftDetailsData.shiftId,
      })
        .select(
          'shiftId businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
        )
        .lean();

      /* Add to log */
      let statusLogData = {
        userId: req.user._id,
        status: 9,
        /* shift created */
        shiftId: shiftDetailsData.shiftId,
        weekRangeStartsAt: logMetaData.weekRangeStartsAt,
        weekRangeEndsAt: logMetaData.weekRangeEndsAt,
        weekNumber: logMetaData.weekNumber,
        businessUnitId: logMetaData.businessUnitId,
        requestedShift: newShiftData._id,
        existingShift: shiftDetailsData._id,
      };
      shiftLogController.create(statusLogData, res);
      await this.updateRedis(redisBuId);
      return __.out(res, 201, 'Requested Shift Changed sucessfully');
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async reduceLimitCancel(res, userId, shiftDetails, from = 1) {
    try {
      let schemeDetails = await User.findOne({ _id: userId }).populate([
        {
          path: 'schemeId',
        },
      ]);
      schemeDetails = schemeDetails.schemeId;
      if (!from) {
        shiftDetails = await ShiftDetails.findOne({ _id: shiftDetails })
          .populate([
            {
              path: 'shiftId',
              select: 'weekNumber businessUnitId',
            },
          ])
          .lean();
      }
      let otDuration = 0;
      let normalDuration = 0;
      if (
        schemeDetails.shiftSetup.openShift &&
        schemeDetails.shiftSetup.openShift.normal
      ) {
        normalDuration = -1 * shiftDetails.duration;
        // normalDuration = shiftDetails.isSplitShift ? 0 : -1 * shiftDetails.duration;
      } else {
        otDuration = -1 * shiftDetails.duration;
      }
      console.log('aaaaa', normalDuration, otDuration);
      console.log('aaaaa is spilit', shiftDetails.isSplitShift);
      console.log('shiftDetails._id', shiftDetails._id);
      const value = await StaffLimit.update(
        { userId: userId, shiftDetailId: shiftDetails._id },
        { $set: { normalDuration: 0, otDuration: otDuration } },
      );
      console.log('valuevalue', value);
      return value;
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async cancel(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      __.log(req.body);
      let requiredResult = await __.checkRequiredFields(req, [
        'shiftId',
        'shiftDetailsId',
      ]);
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Get Confirmed/ Backup Users of this shift
      let shiftDetailsData = await ShiftDetails.findOne({
        _id: req.body.shiftDetailsId,
        shiftId: req.body.shiftId,
        startTime: {
          $gt: moment().utc().format(),
        },
      })
        .populate({
          path: 'shiftId',
          select: '_id plannedBy',
          match: {
            plannedBy: req.user._id,
          },
          populate: {
            path: 'businessUnitId',
          },
        })
        .populate({
          path: 'confirmedStaffs',
          select: '_id deviceToken',
        })
        .populate({
          path: 'backUpStaffs',
          select: '_id deviceToken',
        });

      if (!shiftDetailsData) {
        return __.out(res, 300, 'Invalid Shift/Shift Expired');
      }
      if (shiftDetailsData.shiftId == null) {
        return __.out(res, 300, 'Invalid Shift Id');
      }
      if (
        !shiftDetailsData.shiftId.businessUnitId ||
        shiftDetailsData.shiftId.businessUnitId.cancelShiftPermission == false
      ) {
        return __.out(res, 300, 'Permission Denied to cancel shift');
      }
      if (shiftDetailsData.activeStatus === true) {
        return __.out(res, 300, 'Previous Request Change is in process');
      }
      // return res.json({shiftDetailsData})
      shiftDetailsData.status = 2;
      await shiftDetailsData.save();

      AgendaCron.removeEvent({ 'data.shiftDetailId': req.body.shiftDetailsId })
        .then((removeEventResult) => {
          logInfo('remove shift cancelled', removeEventResult);
        })
        .catch((removeEventResultError) => {
          logError('remove shift cancelled', removeEventResultError);
        });
      let usersDeviceTokens = [];
      // Loop all shiftdetails
      for (let elemConfirm of shiftDetailsData.confirmedStaffs) {
        await this.reduceLimitCancel(res, elemConfirm._id, shiftDetailsData);
        if (elemConfirm.deviceToken != null) {
          usersDeviceTokens.push(elemConfirm.deviceToken);
        }
      }
      for (let elemBackup of shiftDetailsData.backUpStaffs) {
        if (elemBackup.deviceToken != null) {
          usersDeviceTokens.push(elemBackup.deviceToken);
        }
      }
      __.log(usersDeviceTokens, 'usersDeviceTokens');
      if (usersDeviceTokens.length > 0) {
        var pushData = {
            title: 'Shift Cancelled',
            body: 'Your Booked Shift Has been Cancelled',
          },
          collapseKey =
            req.body.shiftDetailsId; /*unique id for this particular shift */
        FCM.push(usersDeviceTokens, pushData, collapseKey);
      }

      /* Create Shift Log */
      let logMetaData = await Shift.findOne({
        _id: shiftDetailsData.shiftId,
      })
        .select(
          'shiftId businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
        )
        .lean();

      /* Add to log */
      let statusLogData = {
        userId: req.user._id,
        status: 11,
        /* shift created */
        shiftId: shiftDetailsData.shiftId,
        weekRangeStartsAt: logMetaData.weekRangeStartsAt,
        weekRangeEndsAt: logMetaData.weekRangeEndsAt,
        weekNumber: logMetaData.weekNumber,
        businessUnitId: logMetaData.businessUnitId,
        existingShift: shiftDetailsData._id,
      };
      await shiftLogController.create(statusLogData, res);
      // await this.updateRedis(logMetaData.businessUnitId);
      return __.out(res, 201, 'Shift Cancelled Successfully');
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async cancelIndividualShift(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      __.log(req.body);
      let requiredResult = await __.checkRequiredFields(req, [
        'shiftId',
        'shiftDetailsId',
      ]);
      if (
        requiredResult.status === false ||
        req.body.userId === '' ||
        req.body.userId === undefined ||
        req.body.userId === null
      ) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      let [shiftDetails, staffInfo] = await Promise.all([
        ShiftDetails.findOne({
          _id: req.body.shiftDetailsId,
          shiftId: req.body.shiftId,
          startTime: {
            $gt: moment().utc().format(),
          },
        }).populate({
          path: 'shiftId',
          select:
            '_id plannedBy businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
          populate: {
            path: 'businessUnitId',
          },
        }),
        User.findOne({ _id: req.body.userId }, { deviceToken: 1 }).lean(),
      ]);

      if (!shiftDetails) {
        return __.out(res, 300, 'Invalid Shift/Shift Expired');
      }

      if (!staffInfo) {
        return __.out(res, 300, 'Staff not found');
      }
      if (shiftDetails.shiftId == null) {
        return __.out(res, 300, 'Invalid Shift Id');
      }
      if (
        !shiftDetails.shiftId.businessUnitId ||
        shiftDetails.shiftId.businessUnitId.cancelShiftPermission == false
      ) {
        return __.out(res, 300, 'Permission Denied to cancel shift');
      }
      // why this required?
      if (shiftDetails.activeStatus === true) {
        return __.out(res, 300, 'Previous Request Change is in process');
      }
      if (!shiftDetails.confirmedStaffs.length) {
        return __.out(res, 300, 'No confirmed staff');
      }

      let splitShift = null;
      if (shiftDetails.isSplitShift) {
        splitShift = await ShiftDetails.findOne({
          _id: req.body.splitShiftId,
          shiftId: req.body.shiftId,
          startTime: {
            $gt: moment().utc().format(),
          },
        });
        if (!splitShift) {
          return __.out(res, 300, 'Invalid Shift/Shift Expired');
        }
      }

      let actualConfirmedStaffs = null;
      let filteredConfirmedStaffs = [];
      const operation = [];
      shiftDetails.confirmedStaffs.forEach((staff) => {
        if (staff.toString() != req.body.userId) {
          filteredConfirmedStaffs.push(staff);
        } else {
          actualConfirmedStaffs = staff;
          shiftDetails.cancelledStaffs.push(staff);
        }
      });
      if (!actualConfirmedStaffs) {
        return __.out(res, 300, 'confirmed staff not found');
      }
      shiftDetails.confirmedStaffs = filteredConfirmedStaffs;
      await shiftDetails.save();
      if (splitShift) {
        const filteredConfirmedStaffsSplit = [];
        splitShift.confirmedStaffs.forEach((staff) => {
          if (staff.toString() != req.body.userId) {
            filteredConfirmedStaffsSplit.push(staff);
          }
        });
        splitShift.cancelledStaffs.push(req.body.userId);
        splitShift.confirmedStaffs = filteredConfirmedStaffsSplit;
        operation.push(splitShift.save());
        shiftDetails.duration += splitShift.duration;
      }
      let usersDeviceTokens = [];
      if (staffInfo.deviceToken) {
        usersDeviceTokens.push(staffInfo.deviceToken);
      }
      operation.push(this.reduceLimitCancel(res, staffInfo._id, shiftDetails));
      __.log(usersDeviceTokens, 'usersDeviceTokens');
      if (usersDeviceTokens.length > 0) {
        var pushData = {
            title: 'Shift Cancelled',
            body: 'Your Confirmed Booking has been Cancelled.',
          },
          collapseKey =
            req.body.shiftDetailsId; /*unique id for this particular shift */
        FCM.push(usersDeviceTokens, pushData, collapseKey);
      }

      /* Add to log */
      let statusLogData = {
        userId: req.user._id,
        status: 11,
        /* shift created */
        shiftId: shiftDetails.shiftId._id,
        weekRangeStartsAt: shiftDetails.shiftId.weekRangeStartsAt,
        weekRangeEndsAt: shiftDetails.shiftId.weekRangeEndsAt,
        weekNumber: shiftDetails.shiftId.weekNumber,
        businessUnitId: shiftDetails.shiftId.businessUnitId._id,
        existingShift: shiftDetails._id,
      };
      operation.push(shiftLogController.create(statusLogData, res));
      await Promise.all(operation);
      this.updateRedis(statusLogData.businessUnitId)
        .then((redisRes) => {
          console.log('redis result', redisRes);
        })
        .catch((er) => {
          console.log('redis error', er);
        });
      return __.out(
        res,
        201,
        'The Confimed Booking of this User has been Cancelled Successfully.',
      );
    } catch (err) {
      console.log('errerr', err);
      __.log(err);
      return __.out(res, 500);
    }
  }

  async bookedStaffDetails(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let where = {
        _id: req.params.staffId,
        status: {
          $ne: 3 /* $ne => not equal*/,
        },
      };
      let users = await User.findOne(where)
        .select('-password')
        .populate([
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
          },
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
          {
            path: 'planBussinessUnitId',
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
          {
            path: 'viewBussinessUnitId',
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
        .lean();

      if (!users) {
        return __.out(res, 300, 'Invalid Staff Id');
      }
      var privilegeFlags = await __.getUserPrivilegeObject(
        users.role.privileges,
      );
      users.userId = users._id;
      users.privilegeFlags = privilegeFlags;
      delete users.role.privileges;
      __.out(res, 201, {
        data: users,
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }

  async stopRequesting(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'shiftId',
        'shiftDetailsId',
      ]);
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Get Confirmed/ Backup Users of this shift
      let shiftDetailsData = await ShiftDetails.findOne({
        _id: req.body.shiftDetailsId,
        shiftId: req.body.shiftId,
        startTime: {
          $gt: moment().utc().format(),
        },
      })
        .populate({
          path: 'shiftId',
          select: '_id plannedBy',
          populate: {
            path: 'businessUnitId',
          },
        })
        .populate({
          path: 'confirmedStaffs',
          select: '_id deviceToken',
        })
        .populate({
          path: 'backUpStaffs',
          select: '_id deviceToken',
        })
        .populate({
          path: 'currentReqShift',
          select: 'requestedBy',
          populate: {
            path: 'requestedBy',
            select: '_id name deviceToken',
          },
        });

      if (!shiftDetailsData) {
        return __.out(res, 300, 'Invalid Shift / Shift Expired');
      }
      if (shiftDetailsData.shiftId == null) {
        return __.out(res, 300, 'Invalid Shift Id');
      }
      if (
        !shiftDetailsData.currentReqShift.requestedBy._id.equals(req.user._id)
      ) {
        return __.out(
          res,
          300,
          `You don't have permission to stop this shift request`,
        );
      }

      let currentReqShift = shiftDetailsData.currentReqShift._id;
      shiftDetailsData.activeStatus = false;
      shiftDetailsData.currentReqShift = null;
      await shiftDetailsData.save();

      /* Create Shift Log */
      let logMetaData = await Shift.findOne({
        _id: shiftDetailsData.shiftId,
      })
        .select(
          'shiftId businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
        )
        .lean();

      /* Add to log */
      let statusLogData = {
        userId: req.user._id,
        status: 10,
        /* shift created */
        shiftId: shiftDetailsData.shiftId,
        weekRangeStartsAt: logMetaData.weekRangeStartsAt,
        weekRangeEndsAt: logMetaData.weekRangeEndsAt,
        weekNumber: logMetaData.weekNumber,
        businessUnitId: logMetaData.businessUnitId,
        requestedShift: currentReqShift,
        existingShift: shiftDetailsData._id,
      };
      await shiftLogController.create(statusLogData, res);
      await this.updateRedis(logMetaData.businessUnitId);
      return __.out(res, 201, 'Shift requesting is stopped');
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async getHourType(res, schemeDetails, shiftDetails, isShiftExtented) {
    try {
      if (shiftDetails.isAssignShift) {
        if (
          schemeDetails.shiftSchemeType == 2 ||
          schemeDetails.shiftSchemeType == 3
        ) {
          if (isShiftExtented) {
            if (
              schemeDetails.shiftSetup.assignShift &&
              schemeDetails.shiftSetup.assignShift.allowShiftExtension.normal
            ) {
              return { valid: true, isOtHour: false };
            } else {
              return { valid: true, isOtHour: true };
            }
          } else {
            if (
              schemeDetails.shiftSetup.assignShift &&
              schemeDetails.shiftSetup.assignShift.normal
            ) {
              return { valid: true, isOtHour: false };
            } else {
              return { valid: true, isOtHour: true };
            }
          }
        }
        return { valid: false };
      } else {
        //console.log('schemeDetails',schemeDetails);
        if (
          schemeDetails.shiftSchemeType == 1 ||
          schemeDetails.shiftSchemeType == 3
        ) {
          if (isShiftExtented) {
            if (
              schemeDetails.shiftSetup.openShift &&
              schemeDetails.shiftSetup.openShift.allowShiftExtension.normal
            ) {
              return { valid: true, isOtHour: false };
            } else {
              return { valid: true, isOtHour: true };
            }
          } else {
            if (
              schemeDetails.shiftSetup.openShift &&
              schemeDetails.shiftSetup.openShift.normal
            ) {
              return { valid: true, isOtHour: false };
            } else {
              return { valid: true, isOtHour: true };
            }
          }
        }
        return { valid: false };
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async checkLimit(res, userId, shiftDetails, isShiftExtented = false) {
    try {
      let schemeDetails = await User.findById(userId, {
        schemeId: 1,
        _id: 0,
      }).populate([
        {
          path: 'schemeId',
          match: {
            status: true,
          },
        },
      ]);
      if (schemeDetails.schemeId) {
        schemeDetails = schemeDetails.schemeId;
        var hourTypeData = await this.getHourType(
          res,
          schemeDetails,
          shiftDetails,
          isShiftExtented,
        );
        console.log('hourTypeData', hourTypeData);
        console.log('shiftDetails.duration', shiftDetails.duration);
        if (hourTypeData.valid) {
          let otDuration = 0;
          let normalDuration = 0;

          if (!hourTypeData.isOtHour) {
            normalDuration = shiftDetails.duration;
          } else {
            otDuration = shiftDetails.duration;
          }
          console.log('otDuration', otDuration);
          if (shiftDetails.isExtendedShift) {
            let extendedStaff = shiftDetails.extendedStaff.filter((item) => {
              return item.userId.toString() == userId.toString();
            });
            if (extendedStaff.length > 0) {
              extendedStaff = extendedStaff[0];
              if (
                schemeDetails.shiftSetup.openShift &&
                schemeDetails.shiftSetup.openShift.normal
              ) {
                normalDuration = extendedStaff.duration;
              } else {
                otDuration = extendedStaff.duration;
              }
            }
          }
          var date = new Date(shiftDetails.date),
            y = date.getFullYear(),
            m = date.getMonth();
          var firstDay = new Date(y, m, 1);
          var lastDay = new Date(y, m + 1, 0);
          //console.log('fir', firstDay, lastDay)
          //console.log('date', new Date(date))
          const data = await StaffLimit.find({
            userId: userId,
            shiftDetailId: { $exists: true },
            date: {
              $lte: new Date(new Date(lastDay).toISOString()),
              $gte: new Date(new Date(firstDay).toISOString()),
            },
          }).lean();
          // console.log('data', data);
          let dailyDuration = shiftDetails.duration;
          let weeklyDuration = shiftDetails.duration;
          let monthlyDuration = shiftDetails.duration;
          let weekNumber = shiftDetails.shiftId.weekNumber;
          let dailyOverall = dailyDuration;
          let weekLlyOverall = dailyDuration;
          let monthlyOverall = dailyDuration;
          // console.log('data', data.length)
          let isPresent = false;
          console.log('firstt after', dailyDuration);
          let staffLimitPresentData = {};
          if (!hourTypeData.isOtHour) {
            data.forEach((item) => {
              // console.log('new Date(item.date)', new Date(item.date))
              if (new Date(item.date).getDate() == new Date(date).getDate()) {
                if (
                  item.shiftDetailId.toString() == shiftDetails._id.toString()
                ) {
                  isPresent = true;
                  staffLimitPresentData = item;
                }
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
              //     console.log('item.weekNo', item.weekNumber);
              //    console.log('sss', weekNumber)
              if (item.weekNumber == weekNumber) {
                weeklyDuration += item.normalDuration;
                weekLlyOverall += item.normalDuration;
                weekLlyOverall += item.otDuration;
              }
            });
          } else {
            // ot hr
            console.log('dailyOverall', data);
            data.forEach((item) => {
              // console.log('new Date(item.date)', new Date(item.date))
              if (new Date(item.date).getDate() == new Date(date).getDate()) {
                console.log(
                  'item.shiftDetailId',
                  item.shiftDetailId,
                  shiftDetails._id,
                );
                if (
                  item.shiftDetailId.toString() == shiftDetails._id.toString()
                ) {
                  isPresent = true;
                  staffLimitPresentData = item;
                }
                console.log('ottttt', dailyDuration);
                dailyDuration += item.otDuration;
                dailyOverall += item.otDuration;
                dailyOverall += item.normalDuration;
                console.log('ottttt after', dailyDuration);
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
          let isLimitExceed = false;
          let dayLimit = schemeDetails.shiftSetup.limits.normalHr.day;
          let weekLimit = schemeDetails.shiftSetup.limits.normalHr.week;
          let monthLimit = schemeDetails.shiftSetup.limits.normalHr.month;
          let dayOverallLimit = schemeDetails.shiftSetup.limits.dayOverall;
          let weekOverallLimit = schemeDetails.shiftSetup.limits.weekOverall;
          let monthOverallLimit = schemeDetails.shiftSetup.limits.monthOverall;
          let isAllow = dayLimit.alert;
          let disallow = dayLimit.disallow;
          console.log('shiftDetails.isAssignShift', shiftDetails.isAssignShift);
          if (shiftDetails.isAssignShift) {
            isAllow = !schemeDetails.shiftSetup.limits.otHr.day.alert;
            disallow = !schemeDetails.shiftSetup.limits.otHr.day.disallow;
            // if(schemeDetails.shiftSchemeType == 3){
            //     disallow = !disallow;
            //     isAllow = !isAllow;
            // }
          }
          console.log('isAllow', isAllow);
          if (hourTypeData.isOtHour) {
            dayLimit = schemeDetails.shiftSetup.limits.otHr.day;
            console.log('dayLimit1111', dayLimit);
            weekLimit = schemeDetails.shiftSetup.limits.otHr.week;
            monthLimit = schemeDetails.shiftSetup.limits.otHr.month;
          }
          //let isAllow = false;
          // if(isAllow){
          console.log('isPresent', isPresent);
          console.log('aaaaaaaaaaaaaaaaaaaaa', normalDuration, otDuration);
          // add data to staff Limit
          if (!isPresent) {
            console.log('aaaaaaaaaaaaaaaaaaaaa', normalDuration, otDuration);
            const obj = {
              userId: userId,
              shiftId: shiftDetails.shiftId._id,
              shiftDetailId: shiftDetails._id,
              date: shiftDetails.date,
              normalDuration: normalDuration,
              otDuration: otDuration,
              weekNumber: weekNumber,
              businessUnitId: shiftDetails.shiftId.businessUnitId,
            };
            var insertAppliedStaffs = await new StaffLimit(obj).save();
            //console.log('dddd', insertAppliedStaffs)
            // add new
          } else {
            // update
            console.log('staffLimitPresentData._id', staffLimitPresentData._id);
            const upppp = await StaffLimit.findByIdAndUpdate(
              staffLimitPresentData._id,
              {
                $inc: {
                  normalDuration: normalDuration,
                  otDuration: otDuration,
                },
              },
            );
            console.log('upppp', upppp);
          }
          // }
          console.log('shift extension');
          console.log('dayLimit', dayLimit.value, dailyDuration);
          console.log(
            'dayLimit',
            typeof parseInt(dayLimit.value),
            typeof dailyDuration,
          );
          console.log('weekLimit', weekLimit.value, weeklyDuration);
          console.log('monthLimit', monthLimit.value, monthlyDuration);
          console.log('dayOverallLimit', dayOverallLimit, dailyOverall);
          console.log('weekOverallLimit', weekOverallLimit, weekLlyOverall);
          console.log(
            'monthOverallLimit',
            monthOverallLimit,
            monthOverallLimit,
          );
          if (
            parseInt(dayLimit.value) &&
            parseInt(dayLimit.value) < parseInt(dailyDuration)
          ) {
            if (!isAllow) {
              await this.reduceLimit(
                res,
                userId,
                shiftDetails,
                1,
                hourTypeData.isOtHour,
              );
            }
            return {
              limit: true,
              message: 'Exceeds Daily limit',
              flag: 'day',
              details: dayLimit,
              status: disallow ? 0 : 1,
            }; //dayLimit.disallow?0:1
          } else if (
            parseInt(weekLimit.value) &&
            parseInt(weekLimit.value) < parseInt(weeklyDuration)
          ) {
            if (!isAllow) {
              await this.reduceLimit(
                res,
                userId,
                shiftDetails,
                1,
                hourTypeData.isOtHour,
              );
            }
            return {
              limit: true,
              message: 'Exceeds Weekly limit',
              flag: 'week',
              details: weekLimit,
              status: disallow ? 0 : 1,
            };
          } else if (
            parseInt(monthLimit.value) &&
            parseInt(monthLimit.value) < parseInt(monthlyDuration)
          ) {
            if (!isAllow) {
              await this.reduceLimit(
                res,
                userId,
                shiftDetails,
                1,
                hourTypeData.isOtHour,
              );
            }
            return {
              limit: true,
              message: 'Exceeds Monthly limit',
              flag: 'month',
              details: monthLimit,
              status: disallow ? 0 : 1,
            };
          } else if (
            parseInt(dayOverallLimit) &&
            parseInt(dayOverallLimit) < parseInt(dailyOverall)
          ) {
            if (!isAllow) {
              await this.reduceLimit(
                res,
                userId,
                shiftDetails,
                1,
                hourTypeData.isOtHour,
              );
            }
            return {
              limit: true,
              message: 'Exceeds Daily Overall limit',
              flag: 'dayoverall',
              details: monthLimit,
              status: disallow ? 0 : 1,
            };
          } else if (
            parseInt(weekOverallLimit) &&
            parseInt(weekOverallLimit) < parseInt(weekLlyOverall)
          ) {
            if (!isAllow) {
              await this.reduceLimit(
                res,
                userId,
                shiftDetails,
                1,
                hourTypeData.isOtHour,
              );
            }
            return {
              limit: true,
              message: 'Exceeds Weekly Overall limit',
              flag: 'weekoverall',
              details: monthLimit,
              status: disallow ? 0 : 1,
            };
          } else if (
            parseInt(monthOverallLimit) &&
            parseInt(monthOverallLimit) < parseInt(monthlyOverall)
          ) {
            if (!isAllow) {
              await this.reduceLimit(
                res,
                userId,
                shiftDetails,
                1,
                hourTypeData.isOtHour,
              );
            }
            return {
              limit: true,
              message: 'Exceeds Monthly Overall limit',
              flag: 'monthoverall',
              details: monthLimit,
              status: disallow ? 0 : 1,
            };
          }
          return { limit: false, status: 1, message: '' };
        } else {
          return {
            limit: true,
            status: 0,
            message: "You don't have open shift scheme assign",
          }; // status 0 not allowed to create, 1 allowed to create
        }
      } else {
        return {
          limit: true,
          status: 0,
          message: "You don't have open shift scheme assign",
        }; // status 0 not allowed to create, 1 allowed to create
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async checkTimingCross(res, shiftDetails, startTime, endTime, userId) {
    try {
      console.log('shiftDetails', shiftDetails);
      const shiftData = await ShiftDetails.findOne({
        confirmedStaffs: userId,
        date: shiftDetails.date,
        _id: { $ne: shiftDetails._id },
      });
      console.log('shiftData', shiftData);
      if (shiftData) {
        if (
          new Date(startTime).getTime() <
            new Date(shiftData.endTime).getTime() &&
          new Date(shiftData.startTime).getTime() < new Date(endTime).getTime()
        ) {
          return true;
        }
      }

      const assingShiftData = await AssignShift.findOne({
        staff_id: userId,
        date: shiftDetails.date,
        _id: { $ne: shiftDetails.draftId },
      });
      if (assingShiftData) {
        if (
          new Date(startTime).getTime() <
            new Date(assingShiftData.endTime).getTime() &&
          new Date(assingShiftData.startTime).getTime() <
            new Date(endTime).getTime()
        ) {
          return true;
        }
      }
      return false;
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async shiftExtension(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      console.log('shift extension');
      //console.log(req.body);
      var shiftDetailId = req.body.shiftDetailId;
      if (!shiftDetailId) {
        shiftDetailId = req.body.shiftDetailsId;
      }
      delete req.body.shiftDetailsId;
      console.log('shiftDetailId', shiftDetailId);
      //req.user._id = mongoose.Types.ObjectId("5a99737036ab4f444b42718a");
      const userId = req.body.userId;
      const shiftDetailsData = await ShiftDetails.findOne({
        _id: mongoose.Types.ObjectId(shiftDetailId),
      }).populate([
        {
          path: 'shiftId',
          select: 'businessUnitId weekNumber',
        },
      ]);

      console.log('req.body.startDateTime', req.body.startDateTime);
      req.body.startDateTime = moment(
        req.body.startDateTime,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      req.body.endDateTime = moment(
        req.body.endDateTime,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      console.log('req.body.startDateTime', req.body.startDateTime);
      var duration = __.getDurationInHours(
        req.body.startDateTime,
        req.body.endDateTime,
      );
      console.log('duration', duration);
      // console.log('req.body.startDateTime', new Date(req.body.startDateTime));
      // console.log('endTIme', new Date(req.body.endDateTime));
      var limitData = {
        status: 1,
        isLimit: false,
      };
      console.log('shiftDetailsData.duration', shiftDetailsData.duration);
      var aaa = duration - shiftDetailsData.duration;
      console.log('aaa', aaa);
      shiftDetailsData.duration = aaa;
      //limitData = await this.checkLimit(userId,shiftDetailsData,true);
      if (limitData.status == 1) {
        var limit = shiftDetailsData.isLimit;
        if (limitData.limit) {
          limit = limitData.limit;
        }
        ShiftDetails.findOneAndUpdate(
          {
            _id: mongoose.Types.ObjectId(shiftDetailId),
            confirmedStaffs: {
              $in: [mongoose.Types.ObjectId(req.body.userId)],
            },
            'extendedStaff.userId': {
              $ne: mongoose.Types.ObjectId(req.body.userId),
            },
          },
          {
            $set: { isExtendedShift: true, isLimit: limit },
            $push: {
              extendedStaff: {
                userId: req.body.userId,
                startDateTime: req.body.startDateTime,
                endDateTime: req.body.endDateTime,
                duration: duration,
                isLimit: limit,
              },
            },
          },
          { new: true },
        )
          .then(async (result) => {
            console.log('updated result', result);
            if (result) {
              const obj = {
                confirmStatus: 1,
              };
              await this.updateRedis(shiftDetailsData.shiftId.businessUnitId);
              User.findById(mongoose.Types.ObjectId(req.body.userId), {
                deviceToken: 1,
                _id: 0,
              }).then((userInfo) => {
                if (userInfo) {
                  let deviceTokens = [];
                  deviceTokens.push(userInfo.deviceToken);
                  //  console.log('dee', deviceTokens);
                  if (deviceTokens && deviceTokens.length > 0) {
                    var pushData = {
                        title: 'Shift extension Request',
                        body: `You have a shift extension request`,
                        bodyText: `New Shift time is XXX to XXX`,
                        bodyTime: [
                          new Date(req.body.startDateTime).getTime(),
                          new Date(req.body.endDateTime).getTime(),
                        ],
                        bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                      },
                      collapseKey =
                        result._id; /*unique id for this particular shift */
                    FCM.push(deviceTokens, pushData, collapseKey);
                    console.log('SENT');
                  }
                }
              });
              // add to log
              Shift.findById(result.shiftId).then((shiftInfo) => {
                console.log('shiftInfo', shiftInfo);
                let statusLogData = {
                  userId: req.body.userId,
                  status: 12,
                  /* shift created */
                  shiftId: result.shiftId,
                  weekRangeStartsAt: shiftInfo.weekRangeStartsAt,
                  weekRangeEndsAt: shiftInfo.weekRangeEndsAt,
                  weekNumber: shiftInfo.weekNumber,
                  newTiming: {
                    start: req.body.startDateTime,
                    end: req.body.endDateTime,
                  },
                  businessUnitId: shiftInfo.businessUnitId,
                  existingShift: result._id,
                };
                shiftLogController.create(statusLogData, res);
              });
              return res.json({
                status: true,
                message: 'Shift Extended Successfully',
                data: obj,
                result,
                isLimit: limit,
              });
            } else {
              return res.json({
                status: false,
                message: 'Shift Not Found',
                data: null,
              });
            }
          })
          .catch((err) => {
            return res.json({
              status: false,
              message: 'Something went wrong',
              data: null,
              err,
            });
          });
      } else {
        return res.json({
          status: false,
          message: limitData.message,
          data: null,
        });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async shiftExtensionAgain(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      console.log('shift extension again');
      //console.log(req.body);
      var shiftDetailId = req.body.shiftDetailId;
      if (!shiftDetailId) {
        shiftDetailId = req.body.shiftDetailsId;
      }
      delete req.body.shiftDetailsId;
      console.log('shiftDetailId', shiftDetailId);
      //req.user._id = mongoose.Types.ObjectId("5a99737036ab4f444b42718a");
      const userId = req.body.userId;
      const shiftDetailsData = await ShiftDetails.findOne({
        _id: mongoose.Types.ObjectId(shiftDetailId),
      }).populate([
        {
          path: 'shiftId',
          select: 'businessUnitId weekNumber',
        },
      ]);

      const oldShift = shiftDetailsData.extendedStaff.filter((oldShift) => {
        return (
          oldShift.userId.toString() === req.body.userId &&
          oldShift.confirmStatus !== 1
        );
      });
      if (oldShift && oldShift.length === 0) {
        return res.json({
          status: false,
          message:
            'Old shift extension required is not found or either it is pending',
          data: null,
        });
      }
      shiftDetailsData.extendedStaff = shiftDetailsData.extendedStaff.filter(
        (oldShift) => {
          return oldShift.userId.toString() !== req.body.userId;
        },
      );
      const updatedShiftExtension = await shiftDetailsData.save();
      console.log('req.body.startDateTime', req.body.startDateTime);
      req.body.startDateTime = moment(
        req.body.startDateTime,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      req.body.endDateTime = moment(
        req.body.endDateTime,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();

      console.log('req.body.startDateTime', req.body.startDateTime);
      var duration = __.getDurationInHours(
        req.body.startDateTime,
        req.body.endDateTime,
      );
      console.log('duration', duration);
      // console.log('req.body.startDateTime', new Date(req.body.startDateTime));
      // console.log('endTIme', new Date(req.body.endDateTime));
      var limitData = {
        status: 1,
        isLimit: false,
      };
      console.log('shiftDetailsData.duration', shiftDetailsData.duration);
      var aaa = duration - shiftDetailsData.duration;
      console.log('aaa', aaa);
      shiftDetailsData.duration = aaa;
      //limitData = await this.checkLimit(userId,shiftDetailsData,true);
      if (limitData.status == 1) {
        var limit = shiftDetailsData.isLimit;
        if (limitData.limit) {
          limit = limitData.limit;
        }
        ShiftDetails.findOneAndUpdate(
          {
            _id: mongoose.Types.ObjectId(shiftDetailId),
            confirmedStaffs: {
              $in: [mongoose.Types.ObjectId(req.body.userId)],
            },
            'extendedStaff.userId': {
              $ne: mongoose.Types.ObjectId(req.body.userId),
            },
          },
          {
            $set: { isExtendedShift: true, isLimit: limit },
            $push: {
              extendedStaff: {
                userId: req.body.userId,
                startDateTime: req.body.startDateTime,
                endDateTime: req.body.endDateTime,
                duration: duration,
                isLimit: limit,
              },
            },
          },
          { new: true },
        )
          .then(async (result) => {
            console.log('updated result', result);
            if (result) {
              const obj = {
                confirmStatus: 1,
              };
              await this.updateRedis(shiftDetailsData.shiftId.businessUnitId);
              User.findById(mongoose.Types.ObjectId(req.body.userId), {
                deviceToken: 1,
                _id: 0,
              }).then((userInfo) => {
                if (userInfo) {
                  let deviceTokens = [];
                  deviceTokens.push(userInfo.deviceToken);
                  //  console.log('dee', deviceTokens);
                  if (deviceTokens && deviceTokens.length > 0) {
                    var pushData = {
                        title: 'Shift extension Request',
                        body: `You have a shift extension request`,
                        bodyText: `New Shift time is XXX to XXX`,
                        bodyTime: [
                          new Date(req.body.startDateTime).getTime(),
                          new Date(req.body.endDateTime).getTime(),
                        ],
                        bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                      },
                      collapseKey =
                        result._id; /*unique id for this particular shift */
                    FCM.push(deviceTokens, pushData, collapseKey);
                    console.log('SENT');
                  }
                }
              });
              // add to log
              Shift.findById(result.shiftId).then((shiftInfo) => {
                console.log('shiftInfo', shiftInfo);
                let statusLogData = {
                  userId: req.body.userId,
                  status: 12,
                  /* shift created */
                  shiftId: result.shiftId,
                  weekRangeStartsAt: shiftInfo.weekRangeStartsAt,
                  weekRangeEndsAt: shiftInfo.weekRangeEndsAt,
                  weekNumber: shiftInfo.weekNumber,
                  newTiming: {
                    start: req.body.startDateTime,
                    end: req.body.endDateTime,
                  },
                  businessUnitId: shiftInfo.businessUnitId,
                  existingShift: result._id,
                };
                shiftLogController.create(statusLogData, res);
              });
              return res.json({
                status: true,
                message: 'Shift Extension Request sent again successfully',
                data: obj,
                result,
                isLimit: limit,
              });
            } else {
              return res.json({
                status: false,
                message: 'Shift Not Found',
                data: null,
              });
            }
          })
          .catch((err) => {
            return res.json({
              status: false,
              message: 'Something went wrong',
              data: null,
              err,
            });
          });
      } else {
        return res.json({
          status: false,
          message: limitData.message,
          data: null,
        });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async shiftExtensionStop(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      var shiftDetailId = req.body.shiftDetailId;
      var userId = req.body.userId;
      const shiftDetailsData = await ShiftDetails.findOne({
        _id: mongoose.Types.ObjectId(shiftDetailId),
      }).populate([
        {
          path: 'shiftId',
          select: 'businessUnitId weekNumber',
        },
      ]);
      const oldShift = shiftDetailsData.extendedStaff.filter((oldShift) => {
        return (
          oldShift.userId.toString() === userId && oldShift.confirmStatus == 1
        );
      });
      if (oldShift && oldShift.length === 0) {
        return res.json({
          status: false,
          message:
            'shift extension required is not found or either it is not in pending state',
          data: null,
        });
      }
      const reduceLimitData = this.reduceLimitAfterDeny(
        res,
        userId,
        shiftDetailsData,
        true,
      );
      shiftDetailsData.extendedStaff = shiftDetailsData.extendedStaff.filter(
        (oldShift) => {
          return oldShift.userId.toString() !== userId;
        },
      );
      if (shiftDetailsData.extendedStaff.length == 0) {
        shiftDetailsData.isExtendedShift = false;
      }
      const shNew = await shiftDetailsData.save();
      const udateRedis = await this.updateRedis(
        shiftDetailsData.shiftId.businessUnitId,
      );
      return res.json({
        status: true,
        message: 'Shift Extension Request is successfully stopped',
        data: { new: shNew, old: shiftDetailsData, oldShift },
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async shiftConfirmation(req, res) {
    try {
      // console.log(req.body);
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const shiftDetailId = req.body.shiftDetailId;
      delete req.body.shiftDetailId;
      //    const shiftDetailsData = await ShiftDetails.findOne({_id: mongoose.Types.ObjectId(shiftDetailId),
      //         "extendedStaff.userId":mongoose.Types.ObjectId(req.body.userId)
      //     }).populate([{
      //         path:'shiftId',
      //         select:'businessUnitId weekNumber'
      //     }]);
      // req.user._id = mongoose.Types.ObjectId("5a99737036ab4f444b42718a");
      const userId = req.body.userId;
      let limitData = {
        status: 1,
      };
      if (req.body.status == 2) {
        let schemeDetails = await User.findById(userId, {
          schemeId: 1,
          _id: 0,
        }).populate([
          {
            path: 'schemeId',
            match: {
              status: true,
            },
          },
        ]);
        schemeDetails = schemeDetails.schemeId;
        if (schemeDetails.isShiftInterval) {
          const shiftDetail = await ShiftDetails.findOneAndUpdate({
            _id: mongoose.Types.ObjectId(shiftDetailId),
            'extendedStaff.userId': mongoose.Types.ObjectId(req.body.userId),
          });
          if (!shiftDetail) {
            return __.out(res, 300, 'Shift extension not found');
          }
          const shiftExtensionInfo = shiftDetail.extendedStaff.filter((ii) => {
            return ii.userId.toString() == req.body.userId.toString();
          })[0];
          const intervalRequireTime = schemeDetails.shiftIntervalTotal - 1;
          const intervalResult = await ShiftHelper.checkShiftInterval(
            userId,
            shiftExtensionInfo.startDateTime,
            shiftExtensionInfo.endDateTime,
            intervalRequireTime,
            shiftDetailId,
          );
          if (intervalResult) {
            return __.out(
              res,
              300,
              'Minimum interval between shift is not met. Kindly choose another shift with required interval.',
            );
          }
        }
        //    limitData = await this.checkLimit(userId, shiftDetailsData);
      }
      console.log('isLimit', limitData);
      //return res.json({limitData});
      if (limitData.status == 1) {
        var isLimit = false;
        if (limitData.limit) {
          isLimit = true;
        }
        ShiftDetails.findOneAndUpdate(
          {
            _id: mongoose.Types.ObjectId(shiftDetailId),
            'extendedStaff.userId': mongoose.Types.ObjectId(req.body.userId),
          },
          {
            $set: { 'extendedStaff.$.confirmStatus': req.body.status }, // "extendedStaff.$.isLimit": isLimit, isLimit: isLimit
          },
          { new: true },
        )
          .then(async (result) => {
            if (result) {
              if (req.body.status == 3) {
                const reduceLimitData = this.reduceLimitAfterDeny(
                  res,
                  userId,
                  result,
                  true,
                );
              }
              const shiftExtensionObj = result.extendedStaff.filter((ii) => {
                return ii.userId.toString() == req.body.userId.toString();
              })[0];
              console.log('shiftExtensionObj', shiftExtensionObj);
              const shiftInfo = await Shift.findById(result.shiftId);
              //console.log('shiftInfo', shiftInfo);
              await this.updateRedis(shiftInfo.businessUnitId);
              let statusLogData = {
                userId: req.body.userId,
                status: req.body.status == 2 ? 13 : 14,
                /* shift created */
                shiftId: result.shiftId,
                weekRangeStartsAt: shiftInfo.weekRangeStartsAt,
                weekRangeEndsAt: shiftInfo.weekRangeEndsAt,
                weekNumber: shiftInfo.weekNumber,
                newTiming: {
                  start: shiftExtensionObj.startDateTime,
                  end: shiftExtensionObj.endDateTime,
                },
                isAccepted: req.body.status == 2 ? true : false,
                businessUnitId: shiftInfo.businessUnitId,
                existingShift: result._id,
              };
              await shiftLogController.create(statusLogData, res);
              return res.json({
                status: 1,
                message: 'Shift Extended Successfully',
                data: result,
              });
            } else {
              return res.json({
                status: 2,
                message: 'Shift Not Found',
                data: null,
              });
            }
          })
          .catch((err) => {
            return res.json({
              status: 3,
              message: 'Something went wrong',
              data: null,
              err,
            });
          });
      } else {
        return res.json({ status: 2, message: limitData.message, data: null });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async checkLimitBeforeBooking(req, res) {
    try {
      let userId;
      if (req.body.userId) {
        userId = req.body.userId;
      } else {
        userId = req.user._id;
      } //req.user._id;
      // var from  = req.url;
      // console.log('from', from);
      let shiftDetailId = req.body.shiftDetailsId;
      //let isConfirmed = req.body.isConfirmed;
      let isOt = false;
      let shiftDetails = await ShiftDetails.findOne({ _id: shiftDetailId })
        .populate([
          {
            path: 'shiftId',
            select: 'weekNumber businessUnitId',
          },
        ])
        .lean();
      // let schemeDetails = await User.findById(userId,{schemeId:1, _id:0}).populate([{
      //     path : 'schemeId'
      // }
      // ]);
      if (req.body.from.toLowerCase() == 'shiftextension') {
        var startDateTimeA = moment(
          req.body.startDateTime,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
        var endDateTimeA = moment(req.body.endDateTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
        // var isCross = await this.checkTimingCross(res, shiftDetails,startDateTimeA,endDateTimeA,userId);
        // if(isCross){
        //     return res.json({status: false, message: 'Shift is overlapping with other shift', data: null});
        // }
      } else if (req.body.from.toLowerCase() == 'shiftextensionagain') {
        const staffExten = shiftDetails.extendedStaff.filter((exSt) => {
          return userId === exSt.userId.toString() && exSt.confirmStatus != 1;
        });
        if (staffExten.length === 0) {
          return res.json({ success: false, message: 'staff Not found' });
        }
        let durationExten = staffExten[0].duration;
        shiftDetails.duration = durationExten;
      }
      let limitData = {
        status: 1,
        limit: false,
      };
      var duration = __.getDurationInHours(
        req.body.startDateTime,
        req.body.endDateTime,
      );
      //console.log('shiftDetailsData.duration', shiftDetails.duration);
      var aaa = parseInt(duration) - shiftDetails.duration;
      shiftDetails.duration = aaa;
      limitData = await this.checkLimit(res, userId, shiftDetails, true);
      if (limitData.limit) {
        if (!limitData.status) {
          return res.json({
            limit: true,
            status: 0,
            message: limitData.message,
            duration: shiftDetails.duration,
          });
        } else {
          return res.json({
            limit: true,
            status: 1,
            message: limitData.message,
            duration: shiftDetails.duration,
          });
        }
      } else {
        if (req.body.from == 'makebooking') {
          return this.makeBooking(req, res);
        } else if (req.body.from.toLowerCase() == 'shiftextension') {
          req.body.shiftDetailId = shiftDetailId;
          return this.shiftExtension(req, res);
        } else if (
          req.body.from.toLowerCase() == 'responseconfirmslotrequestafteradjust'
        ) {
          return this.responseConfirmSlotRequestAfterAdjust(req, res);
        } else if (
          req.body.from.toLowerCase() == 'responsefornewshiftrequest'
        ) {
          return this.responseForNewShiftRequest(req, res);
        } else if (req.body.from.toLowerCase() == 'shiftextensionagain') {
          req.body.shiftDetailId = shiftDetailId;
          return this.shiftExtensionAgain(req, res);
        } else {
          return res.json({ limit: true, message: 'missing paramter from' });
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async reduceLimitAfterAlert(req, res) {
    try {
      let userId;
      if (req.body.userId) {
        userId = req.body.userId;
      } else {
        userId = req.user._id;
      } //req.user._id;
      let shiftDetailId = req.body.shiftDetailsId;
      let shiftDetails = await ShiftDetails.findOne({ _id: shiftDetailId })
        .populate([
          {
            path: 'shiftId',
            select: 'weekNumber businessUnitId',
          },
        ])
        .lean();
      const value = await this.reduceLimitAfterDeny(
        res,
        userId,
        shiftDetails,
        true,
        req.body.duration,
        'alert',
      );
      return res.json({
        success: true,
        message: 'Successfully updated',
        value,
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async reduceLimit(res, userId, shiftDetails, from = 1, isOt = false) {
    try {
      let schemeDetails = await User.findOne({ _id: userId }).populate([
        {
          path: 'schemeId',
        },
      ]);
      schemeDetails = schemeDetails.schemeId;
      if (!from) {
        shiftDetails = await ShiftDetails.findOne({ _id: shiftDetails })
          .populate([
            {
              path: 'shiftId',
              select: 'weekNumber businessUnitId',
            },
          ])
          .lean();
      }
      let otDuration = 0;
      let normalDuration = 0;
      if (!isOt) {
        normalDuration = -1 * shiftDetails.duration;
      } else {
        otDuration = -1 * shiftDetails.duration;
      }
      console.log('aaaaa', normalDuration, otDuration);
      const value = await StaffLimit.update(
        { userId: userId, shiftDetailId: shiftDetails._id },
        { $inc: { normalDuration: normalDuration, otDuration: otDuration } },
      );
      return value;
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async reduceLimitAfterDeny(
    res,
    userId,
    shiftDetails,
    isShiftExtented = true,
    durationO = 0,
    from = 'deny',
  ) {
    try {
      let schemeDetails = await User.findOne({ _id: userId }).populate([
        {
          path: 'schemeId',
        },
      ]);
      schemeDetails = schemeDetails.schemeId;
      //schemeDetails = schemeDetails.schemeId;
      var hourTypeData = await this.getHourType(
        res,
        schemeDetails,
        shiftDetails,
        isShiftExtented,
      );
      console.log('hourTypeData', hourTypeData);
      // if(!from){
      //     shiftDetails = await ShiftDetails.findOne({_id:shiftDetails}).populate([{
      //         path:'shiftId',
      //         select:'weekNumber businessUnitId'
      //     }]).lean();
      // }
      var extendedDuration = 0;
      if (shiftDetails.isExtendedShift) {
        let extendedStaff = shiftDetails.extendedStaff.filter((item) => {
          return item.userId.toString() == userId.toString();
        });
        if (extendedStaff.length > 0) {
          extendedStaff = extendedStaff[0];
          extendedDuration = extendedStaff.duration - shiftDetails.duration;
        }
      }
      if (from == 'alert') {
        extendedDuration = durationO;
      }
      let otDuration = 0;
      let normalDuration = 0;
      // !hourTypeData.isOtHour
      if (!hourTypeData.isOtHour) {
        normalDuration = -1 * extendedDuration;
      } else {
        otDuration = -1 * extendedDuration;
      }
      console.log('aaaaa', normalDuration, otDuration);
      const value = await StaffLimit.update(
        { userId: userId, shiftDetailId: shiftDetails._id },
        { $inc: { normalDuration: normalDuration, otDuration: otDuration } },
      );
      console.log('valuevalue', value);
      return value;
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async shiftCheck(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const shiftDetailId = req.params.shiftDetailId;
      delete req.body.shiftDetailId;
      ShiftDetails.findOne({
        _id: mongoose.Types.ObjectId(shiftDetailId),
        isExtendedShift: true,
        'extendedStaff.userId': mongoose.Types.ObjectId(req.params.userId),
      })
        .then((result) => {
          if (result) {
            const obj = result.extendedStaff.filter((item) => {
              return item.userId.toString() === req.params.userId;
            });
            if (obj.length > 0) {
              result.extendedStaff = [];
              result.extendedStaff[0] = obj[0];
            }
            return res.json({
              status: 1,
              message: 'Shift is Extended',
              data: result,
            });
          } else {
            return res.json({
              status: 2,
              message: 'Shift is not extended',
              data: null,
            });
          }
        })
        .catch((err) => {
          return res.json({
            status: 3,
            message: 'Something went wrong',
            data: null,
            err,
          });
        });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }

  async staffLimit(req, res) {
    try {
      var weekStartDate = req.body.weekStartDate;
      if (!weekStartDate) {
        return res.send('Date is missing');
      }
      weekStartDate = new Date(weekStartDate);
      var weekEndDate = new Date(weekStartDate);
      weekEndDate = new Date(weekEndDate.setDate(weekEndDate.getDate() + 6));
      console.log('weekStartDate', weekStartDate, weekEndDate);
      // Each shift limit entry = 1 row.
      // Fields required = Shift BU, Shift date, Shift Start time, Shift End time, Shift type: Confirm or Standby, Staff ID, Shift limit duration
      // If possible, shift date, shift time are to be based in UTC+8.
      // We need to ensure ALL shift limits of the staff within the date range is extracted.
      const data = await StaffLimit.aggregate([
        {
          $match: {
            date: {
              $gte: weekStartDate,
              $lte: weekEndDate,
            },
          },
        },
        {
          $lookup: {
            from: 'shiftdetails',
            localField: 'shiftDetailId',
            foreignField: '_id',
            as: 'shiftDetail',
          },
        },
        {
          $unwind: '$shiftDetail',
        },
        {
          $lookup: {
            from: 'shifts',
            localField: 'shiftDetail.shiftId',
            foreignField: '_id',
            as: 'shift',
          },
        },
        {
          $unwind: '$shift',
        },
        {
          $lookup: {
            from: 'subsections',
            localField: 'shift.businessUnitId',
            foreignField: '_id',
            as: 'bu',
          },
        },
        {
          $unwind: '$bu',
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'staff',
          },
        },
        {
          $unwind: '$staff',
        },
        {
          $project: {
            userId: 1,
            weekNumber: 1,
            normalDuration: 1,
            otDuration: 1,
            startTime: '$shiftDetail.startTime',
            timeZone: '$shiftDetail.timeZone',
            endTime: '$shiftDetail.endTime',
            shiftDuration: '$shiftDetail.duration',
            backUpStaffs: '$shiftDetail.backUpStaffs',
            confirmedStaffs: '$shiftDetail.confirmedStaffs',
            weekRangeStartsAt: '$shift.weekRangeStartsAt',
            weekRangeEndsAt: '$shift.weekRangeEndsAt',
            buName: '$bu.orgName',
            staffId: '$staff.staffId',
            name: '$staff.name',
          },
        },
        {
          $addFields: {
            isConfirm: {
              $in: ['$userId', '$confirmedStaffs'],
            },
            isBackup: {
              $in: ['$userId', '$backUpStaffs'],
            },
          },
        },
        {
          $addFields: {
            isValid: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$isConfirm', true] },
                    { $eq: ['$isBackup', true] },
                    {
                      $and: [
                        { $eq: ['$normalDuration', 0] },
                        { $eq: ['$otDuration', 0] },
                      ],
                    },
                  ],
                },
                'Yes',
                'No',
              ],
            },
          },
        },
        {
          $project: {
            backUpStaffs: 0,
            confirmedStaffs: 0,
          },
        },
      ]);
      data.forEach((record) => {
        const a = record.timeZone;
        const hr = a[1] + a[2];
        const min = a[3] + a[4];
        var min1 = parseInt(hr) * 60 + parseInt(min);
        record.startTime = moment(record.startTime).add(min1, 'minutes');
        record.endTime = moment(record.endTime).add(min1, 'minutes');
        record.weekRangeStartsAt = moment(record.weekRangeStartsAt).add(
          min1,
          'minutes',
        );
        record.weekRangeEndsAt = moment(record.weekRangeEndsAt).add(
          min1,
          'minutes',
        );
      });
      return res.json(data);
    } catch (e) {
      console.log('staffLimit as error', e);
      console.log('staffLimit as error', e.stack);
      return res.send('Something went wrong');
    }
  }
}
// setInterval(async () => {
//   try {
//     console.log('caled');
//     // const shiftDetailsData = await ShiftDetails.find({ $where: 'this.backUpStaffs.length > 0', startTime: { $lte: new Date().toISOString() } });
//     let lastTime = new Date();
//     lastTime.setHours(lastTime.getHours() - 1);
//     lastTime = new Date(lastTime);
//     const shiftDetailsData = await ShiftDetails.find({
//       $where: 'this.backUpStaffs.length > 0',

//       $and: [
//         { startTime: { $lte: new Date().toISOString() } },
//         { startTime: { $gt: new Date(lastTime).toISOString() } },
//       ],
//     });
//     console.log('shiftDetailsData', shiftDetailsData.length);
//     for (let i = 0; i < shiftDetailsData.length; i++) {
//       console.log('_iddd', shiftDetailsData[i]._id);
//       if (shiftDetailsData[i].backUpStaffs.length > 0) {
//         const update = await ShiftDetails.findOneAndUpdate(
//           {
//             _id: shiftDetailsData[i]._id,
//             $where: 'this.backUpStaffs.length > 0',
//           },
//           {
//             $set: {
//               backUpStaffs: [],
//               backUpStaffsLog: shiftDetailsData[i].backUpStaffs,
//               backUpStaffNeedCountLog: shiftDetailsData[i].backUpStaffNeedCount,
//               backUpStaffNeedCount: 0,
//             },
//           },
//         );
//         const backupStaff = shiftDetailsData[i].backUpStaffs;
//         const shiftDetailIdId = shiftDetailsData[i]._id;
//         for (let j = 0; j < backupStaff.length; j++) {
//           const userId = backupStaff[j];
//           const appliedUpdate = await AppliedStaffs.findOneAndUpdate(
//             { flexiStaff: userId, shiftDetailsId: shiftDetailIdId },
//             { status: 0 },
//           );
//         }
//         console.log('update', update._id);
//       }
//     }
//   } catch (err) {
//     __.log(err);
//     __.out(res, 500, err);
//   }
//   // console.log('called after 1 min', shiftDetailsData.length)
// }, 60000);

module.exports = new shift();
