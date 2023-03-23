
// Controller Code Starts here
const mongoose = require('mongoose'),
  AppliedStaffs = require('../../models/appliedStaff'),
  AssignShift = require('../../models/assignShift'),
  Shift = require('../../models/shift'),
  ShiftDetails = require('../../models/shiftDetails'),
  OtherNotification = require('../../models/otherNotifications'),
  shiftLogController = require('../company//shiftLogController'),
  Subsection = require('../../models/subSection'),
  Scheme = require('../../models/scheme'),
  StaffLimit = require('../../models/staffLimit'),
  User = require('../../models/user'),
  moment = require('moment'),
  FCM = require('../../../helpers/fcm'),
  PageSettingModel = require('../../models/pageSetting'),
  Attendance = require('../../models/attendance'),
  _ = require('lodash'),
  __ = require('../../../helpers/globalFunctions');
const company = require('../../models/company');
// const redisClient = require('../../../helpers/redis.js');
// const redisData = require('../../../helpers/redisDataGenerator');
const ShiftHelper = require('../../../helpers/shiftHelper');
const SubSection = require('../../models/subSection');
let shiftCheckId = [];

class staffShift {
  // async updateRedis(businessUnitId) {
  //   await redisData.readNewNext(businessUnitId);
  // }
  async recalledShiftConfirmation(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult1 = await __.checkRequiredFields(req, [
        'shiftDetailId',
        'isRecallAccepted',
      ]);
      if (requiredResult1.status === false) {
        return __.out(res, 400, requiredResult1.missingFields);
      } else {
        var isRecalled = true;
        if (req.body.isRecallAccepted == 3) {
          isRecalled = false;
        }
        const data = await ShiftDetails.findOneAndUpdate(
          { _id: req.body.shiftDetailId, isAssignShift: true },
          { $set: { isRecallAccepted: req.body.isRecallAccepted, isRecalled } },
        );
        if (data) {
          console.log('data.draftId', data.draftId);
          const assingShiftData = await AssignShift.findOneAndUpdate(
            { _id: data.draftId },
            {
              isRecallAccepted: req.body.isRecallAccepted,
            },
          );
          // await this.updateRedis(assingShiftData.businessUnitId);
          Shift.findById(data.shiftId).then((shiftInfo) => {
            console.log('shiftInfo', shiftInfo);
            let statusLogData = {
              userId: req.user._id,
              status: 16,
              /* shift created */
              shiftId: data.shiftId,
              weekRangeStartsAt: shiftInfo.weekRangeStartsAt,
              weekRangeEndsAt: shiftInfo.weekRangeEndsAt,
              weekNumber: shiftInfo.weekNumber,
              newTiming: {
                start: data.startTime,
                end: data.endTime,
              },
              businessUnitId: shiftInfo.businessUnitId,
              existingShift: data._id,
              isOff: data.isOff,
              isRest: data.isRest,
              isRecallAccepted: req.body.isRecallAccepted,
            };
            shiftLogController.create(statusLogData, res);
          });
          return __.out(res, 200, 'Shift Updated Successfully');
        }
        return __.out(res, 300, 'Shift not found');
      }
    } catch (e) {
      console.log(e);
      __.out(res, 500);
    }
  }
  async matchingShifts(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let where = {
        status: 1,
        confirmedStaffs: {
          $nin: [req.user._id],
        },
        backUpStaffs: {
          $nin: [req.user._id],
        },
        startTime: {
          $gt: moment().utc().format(),
        },
      };
      var findOrFindOne;
      /*if ID given then it acts as findOne which gives object else find which gives array of object*/
      if (req.body.shiftId) {
        where._id = req.body.shiftId;
        findOrFindOne = ShiftDetails.findOne(where);
      } else findOrFindOne = ShiftDetails.find(where);

      let shifts = await findOrFindOne
        .populate([
          {
            path: 'shiftId',
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
          },
          {
            path: 'mainSkillSets',
            select: 'name status',
            match: {
              status: 1,
            },
          },
          {
            path: 'skillSetId',
            select: 'name status',
            match: {
              status: 1,
            },
          },
        ])
        .lean();
      //return res.json({shifts})
      let pageSettingData = await PageSettingModel.findOne(
        {
          companyId: req.user.companyId,
          status: 1,
        },
        { opsGroup: 1 },
      );
      const tierType = pageSettingData.opsGroup.tierType;
      /*To remove null parents (since parents may get disabled) */
      shifts = await _.filter(shifts, function (o) {
        /*check all skill set matching  */
        let shiftSkillSets = [];
        let notMatchingSkillsArray = [];
        if (tierType == 2) {
          shiftSkillSets = o.subSkillSets.map((x) => x._id);
          notMatchingSkillsArray = _.differenceWith(
            shiftSkillSets,
            req.user.subSkillSets,
            _.isEqual,
          );
        } else {
          shiftSkillSets = o.mainSkillSets.map((x) => x._id);
          notMatchingSkillsArray = _.differenceWith(
            shiftSkillSets,
            req.user.mainSkillSets,
            _.isEqual,
          );
        }
        /*_.map(o.subSkillSets, function (s) {
                    return s._id;
                });*/

        return (
          shiftSkillSets.length != 0 &&
          (req.user.subSkillSets.length != 0 ||
            req.user.mainSkillSets.length != 0) &&
          notMatchingSkillsArray.length == 0 &&
          ((o.confirmedStaffs && o.confirmedStaffs.length < o.staffNeedCount) ||
            (o.backUpStaffs && o.backUpStaffs.length < o.backUpStaffNeedCount))
        );
      });

      /* get other notifications */

      let shiftNotifications = shifts.map((x) => {
        x.type = 0;
        return x;
      });

      let notificationData = await OtherNotification.find({
        user: req.user._id,
      })
        .select('-fromUser -__v')
        .lean();

      let combinedNotifications = [...shiftNotifications, ...notificationData];

      let sorted = combinedNotifications.sort(__.sortByDate);

      __.out(res, 201, {
        //shifts: shifts,
        data: sorted,
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async bookingsList(req, res) {
    try {
      console.log('aaaaa');
      // console.log(req.body)
      let requiredResult1 = await __.checkRequiredFields(req, [
        'startDate',
        'type',
      ]);
      if (requiredResult1.status === false) {
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        // start date filter
        var utcOff = moment
          .parseZone(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
          .utcOffset();
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
            .format();
        // console.log('startDatestartDate',new Date(startDate), utcOff)
        // startDate = new Date(new Date(startDate).getTime()+ utcOff*60000);
        // const aa = new Date(startDate).setUTCHours(0, 0, 0, 0);
        // const bb = new Date(endDate).setUTCHours(24, 0, 0, 0);
        // startDate = new Date(aa);
        // console.log('startDate',startDate)
        // endDate = new Date(bb);
        //req.user._id = req.body.userId;
        let pageSettingData = await PageSettingModel.findOne(
          {
            companyId: req.user.companyId,
            status: 1,
          },
          { opsGroup: 1 },
        );
        const companyData = req.user.company;
        const tierType = pageSettingData.opsGroup.tierType;
        // return res.json({user:req.user})
        var requestData = {
          userId: req.user._id,
          timeZone: timeZone,
          startDate: startDate,
          endDate: endDate,
          userSubSkillSets: req.user.subSkillSets,
          userMainSkillSets: req.user.mainSkillSets,
          tierType: tierType,
          schemeType: req.user.schemeId ? req.user.schemeId.shiftSchemeType : 0,
        };
        if (requestData.schemeType == 0) {
          return __.out(res, 400, 'scheme not found for staff');
        }
        //  return res.json({user:req.user});
        // console.log('req.user.mainSkillSets', req.user.mainSkillSets, requestData.userMainSkillSets)
        if (req.body.shiftDetailsId)
          requestData.shiftDetailsId = req.body.shiftDetailsId;

        // Show Cancelled Shifts Also
        if (req.body.cancelledShifts && req.body.cancelledShifts === true) {
          requestData.cancelledShifts = true;
        }

        //my Bookings
        function sortObject(obj) {
          console.log('obj', obj);
          // return Object.keys(obj).sort().reduce(function (result, key) {
          //     result[key] = obj[key];
          //     return result;
          // }, {});
          return Object.keys(obj)
            .sort(function (a, b) {
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
        if (req.body.type == 'myBookings') {
          var myBookings = await this.myBookings(
            requestData,
            res,
            'myBookings',
          );
          //console.log('req.user._id',req.user._id);
          var timeZone = myBookings.timeZone;
          let newMyBookingData = JSON.stringify(myBookings);
          newMyBookingData = JSON.parse(newMyBookingData);
          var oneDay = 24 * 3600 * 1000;
          var currentDateFormatArray = [];
          for (var i = 0; i < 7; i++) {
            var d = new Date(req.body.startDate).getTime() + i * oneDay;
            currentDateFormatArray.push(
              moment(new Date(d), 'DD-MM-YYYY')
                .utcOffset(`${timeZone}`)
                .format('DD-MM-YYYY'),
            );
          }
          console.log(currentDateFormatArray);
          var dateData = [];

          for (let date in newMyBookingData.list) {
            dateData.push(date);
            newMyBookingData.list[date].forEach((item, index) => {
              item.companyData = companyData;
              if (item.isExtendedShift) {
                console.log('aaa');
                const obj = item.extendedStaff.filter((extendedS) => {
                  return (
                    extendedS.userId.toString() === req.user._id.toString()
                  );
                });
                //console.log(obj);
                if (obj.length > 0) {
                  //  console.log('inside')
                  item.extendedStaff = {};
                  if (obj[0].confirmStatus == 1 || obj[0].confirmStatus == 2) {
                    item.extendedStaff = obj[0];
                  }
                }
              }
              if (item.isSplitShift) {
                newMyBookingData.list[date].forEach((splitItem, splitIndex) => {
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
                        item.duration += splitItem.duration;
                        newMyBookingData.list[date].splice(splitIndex, 1);
                      } else {
                        const splitShiftStartTime = item.startTime;
                        const splitShiftEndTime = item.endTime;
                        const splitShiftId = item._id;
                        item.startTime = splitItem.startTime;
                        item.endTime = splitItem.endTime;
                        item._id = splitItem._id;
                        item.duration += splitItem.duration;
                        item.splitShiftStartTime = splitShiftStartTime;
                        item.splitShiftEndTime = splitShiftEndTime;
                        item.splitShiftId = splitShiftId;
                        newMyBookingData.list[date].splice(splitIndex, 1);
                      }
                    }
                  }
                });
              }
            });
          }
          console.log('currentDateFormatArray', currentDateFormatArray);
          var missingDateData = currentDateFormatArray.filter(function (obj) {
            return dateData.indexOf(obj) == -1;
          });
          for (var i = 0; i < missingDateData.length; i++) {
            newMyBookingData.list[missingDateData[i]] = [];
          }

          newMyBookingData.list = sortObject(newMyBookingData.list);
          __.out(res, 201, newMyBookingData);
        } else {
          Promise.all([
            this.myBookings(requestData, res, 'none'),
            this.availableShifts(requestData, res),
          ]).then((values) => {
            let newMyBookingData = JSON.stringify(values[0]);
            // console.log('newMyBookingData', newMyBookingData)
            newMyBookingData = JSON.parse(newMyBookingData);
            var oneDay = 24 * 3600 * 1000;
            var timeZone = newMyBookingData.timeZone;
            var currentDateFormatArray = [];
            for (var i = 0; i < 7; i++) {
              var d = new Date(req.body.startDate).getTime() + i * oneDay;
              currentDateFormatArray.push(
                moment(new Date(d), 'DD-MM-YYYY')
                  .utcOffset(`${timeZone}`)
                  .format('DD-MM-YYYY'),
              );
            }
            // console.log(currentDateFormatArray);
            var dateData = [];
            for (let date in newMyBookingData.list) {
              dateData.push(date);
              newMyBookingData.list[date].forEach((item, index) => {
                item.companyData = companyData;
                if (item.isExtendedShift) {
                  console.log('aaa');
                  const obj = item.extendedStaff.filter((extendedS) => {
                    return (
                      extendedS.userId.toString() === req.user._id.toString()
                    );
                  });
                  //   console.log(obj);
                  if (obj.length > 0) {
                    console.log('inside');
                    item.extendedStaff = {};
                    if (
                      obj[0].confirmStatus == 1 ||
                      obj[0].confirmStatus == 2
                    ) {
                      item.extendedStaff = obj[0];
                    }
                  }
                }
                if (item.isSplitShift) {
                  newMyBookingData.list[date].forEach(
                    (splitItem, splitIndex) => {
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
                            item.duration += splitItem.duration;
                            newMyBookingData.list[date].splice(splitIndex, 1);
                          } else {
                            const splitShiftStartTime = item.startTime;
                            const splitShiftEndTime = item.endTime;
                            const splitShiftId = item._id;
                            item.startTime = splitItem.startTime;
                            item.endTime = splitItem.endTime;
                            item._id = splitItem._id;
                            item.duration += splitItem.duration;
                            item.splitShiftStartTime = splitShiftStartTime;
                            item.splitShiftEndTime = splitShiftEndTime;
                            item.splitShiftId = splitShiftId;
                            newMyBookingData.list[date].splice(splitIndex, 1);
                          }
                        }
                      }
                    },
                  );
                }
              });
            }
            var missingDateData = currentDateFormatArray.filter(function (obj) {
              return dateData.indexOf(obj) == -1;
            });
            //console.log(missingDateData)
            for (var i = 0; i < missingDateData.length; i++) {
              newMyBookingData.list[missingDateData[i]] = [];
            }
            newMyBookingData.list = sortObject(newMyBookingData.list);
            const availableData = values[1];
            for (let date in availableData) {
              availableData[date].forEach((item, index) => {
                item.companyData = companyData;
                if (item.isExtendedShift) {
                  //console.log('aaa');
                  const obj = item.extendedStaff.filter((extendedS) => {
                    return (
                      extendedS.userId.toString() === req.user._id.toString()
                    );
                  });
                  //console.log(obj);
                  if (obj.length > 0) {
                    //  console.log('inside')
                    item.extendedStaff = {};
                    if (
                      obj[0].confirmStatus == 1 ||
                      obj[0].confirmStatus == 2
                    ) {
                      item.extendedStaff = obj[0];
                    }
                  }
                }
                if (item.isSplitShift) {
                  availableData[date].forEach((splitItem, splitIndex) => {
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
                          item.duration += splitItem.duration;
                          availableData[date].splice(splitIndex, 1);
                        } else {
                          const splitShiftStartTime = item.startTime;
                          const splitShiftEndTime = item.endTime;
                          const splitShiftId = item._id;
                          item.startTime = splitItem.startTime;
                          item.endTime = splitItem.endTime;
                          item._id = splitItem._id;
                          item.duration += splitItem.duration;
                          item.splitShiftStartTime = splitShiftStartTime;
                          item.splitShiftEndTime = splitShiftEndTime;
                          item.splitShiftId = splitShiftId;
                          availableData[date].splice(splitIndex, 1);
                        }
                      }
                    }
                  });
                }
              });
            }
            __.out(res, 201, {
              myBookings: newMyBookingData,
              availableShifts: availableData,
            });
          });
        }
      }
    } catch (err) {
      console.log(err);
      __.log(err);
      __.out(res, 500);
    }
  }

  async availableShifts(reqestData, res) {
    try {
      if (reqestData.schemeType == 2) {
        return {};
      }
      var where = {
        status: 1,
        confirmedStaffs: {
          $nin: [reqestData.userId],
        },
        backUpStaffs: {
          $nin: [reqestData.userId],
        },
        date: {
          $gte: moment(reqestData.startDate).utc().format(),
          $lte: moment(reqestData.endDate).utc().format(),
        },
      };
      where.userId = reqestData.userId;
      var listData = {};
      var shifts = await this.shiftDetails(where, res); //getting shift details
      await shifts.forEach((element) => {
        // console.log('eeee', element.date, reqestData.timeZone)
        var key = __.getDateStringFormat(element.date, element.timeZone);
        // console.log('key', key)
        let shiftSkillSets = [];
        let notMatchingSkillsArray = [];
        /*check all skill set matching  */
        // console.log('reqestData.tierType == 1', reqestData.tierType)
        if (reqestData.tierType == 1) {
          //  console.log('element.mainSkillSets', element.mainSkillSets)
          if (element.mainSkillSets) {
            shiftSkillSets = Array.from(element.mainSkillSets, (x) => x._id);
            //console.log("shiftSkillSets", shiftSkillSets, reqestData.userMainSkillSets)
            /*check diff btwn user skill set and shift skill set and list skillsets that not match with user*/
            reqestData.userSubSkillSets = [];
            notMatchingSkillsArray = _.differenceWith(
              shiftSkillSets,
              reqestData.userMainSkillSets,
              _.isEqual,
            );
            // console.log("notMatchingSkillsArray", notMatchingSkillsArray)
          }
        } else {
          if (element.subSkillSets) {
            shiftSkillSets = Array.from(element.subSkillSets, (x) => x._id);
            /*check diff btwn user skill set and shift skill set and list skillsets that not match with user*/
            reqestData.userMainSkillSets = [];
            notMatchingSkillsArray = _.differenceWith(
              shiftSkillSets,
              reqestData.userSubSkillSets,
              _.isEqual,
            );
          }
        }

        if (
          shiftSkillSets.length != 0 &&
          (reqestData.userSubSkillSets.length != 0 ||
            reqestData.userMainSkillSets.length != 0) &&
          notMatchingSkillsArray.length == 0
        ) {
          /*only if all shift skillset match with user */
          if (
            !element.confirmedStaffs ||
            (element.confirmedStaffs &&
              element.confirmedStaffs.length < element.staffNeedCount)
          ) {
            /*check the confirm slots available */
            element.isConfirmed = 1;
          } else if (
            !element.backUpStaffs ||
            (element.backUpStaffs &&
              element.backUpStaffs.length < element.backUpStaffNeedCount)
          ) {
            /*else check the stand by slots available */
            element.isConfirmed = 0;
          } else {
            /*booking full (both confirm & backup slots so skip it) */
            return; /*skip this iteration */
          }
          if (!listData[key]) {
            /*create a new key by date in array */
            listData[key] = [];
          }
          listData[key].push(element);
        }
      });

      return listData;
      // var availableStaffCountCheck = function (o) {
      //     /*check all skill set matching  */
      //     let shiftSkillSets = _.map(o.subSkillSets, function (s) {
      //         return s._id;
      //     });
      //     let notMatchingSkillsArray = _.differenceWith(shiftSkillSets, reqestData.userSubSkillSets, _.isEqual);
      //     if (notMatchingSkillsArray.length == 0 && (!(o.confirmedStaffs) || (o.confirmedStaffs && o.confirmedStaffs.length < o.staffNeedCount))) {
      //         o.isConfirmed = 1;
      //         return o;
      //     } else if (notMatchingSkillsArray.length == 0 && (!(o.backUpStaffs) || (o.backUpStaffs && o.backUpStaffs.length < o.backUpStaffNeedCount))) {
      //         o.isConfirmed = 0;
      //         return o;
      //     }
      // };
      // var groupByDate = function (o) {
      //     return __.getDateStringFormat(o.date); //dd-mm-yyy
      // };
      // var matchingResults = _.chain(shifts)
      //     .filter(availableStaffCountCheck)
      //     .groupBy(groupByDate)
      //     .orderBy('date', 'asc')
      //     .value();
      // var matchingResultArray = [];
      // //set date as key for group array
      // for (let matchingResult of matchingResults) {
      //     var key = __.getDateStringFormat(matchingResult[0].date),
      //         obj = {};
      //     obj[key] = matchingResult;
      //     matchingResultArray.push(obj);
      // }
      // return matchingResultArray; //final result
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async getAttendanceTotal(res, shifts, userId) {
    try {
      var totalApprovedDuration = 0;
      for (let i = 0; i < shifts.length; i++) {
        var element = shifts[i];
        const attendanceData = await Attendance.findOne(
          { userId: userId, shiftDetailId: element._id },
          { approval: 1 },
        );
        var duration = 0;
        if (
          attendanceData &&
          (attendanceData.approval.neither ||
            attendanceData.approval.clocked ||
            attendanceData.approval.shift)
        ) {
          duration = attendanceData.approval.duration;
        }
        console.log('hiiiiii');
        totalApprovedDuration += duration;
      }
      return totalApprovedDuration;
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async myBookings(requestData, res, from) {
    //'status': 1,
    try {
      var where = {
        date: {
          $gte: moment(requestData.startDate).utc().format(),
          $lte: moment(requestData.endDate).utc().format(),
        },
        $or: [
          {
            confirmedStaffs: requestData.userId,
          },
          {
            backUpStaffs: requestData.userId,
          },
        ],
      };
      console.log('where', where);
      where.userId = requestData.userId;
      if (from != 'myBookings') {
        where.isRest = false;
        where.isOff = false;
      }
      // Show Cancelled Shifts Also
      if (requestData.cancelledShifts && requestData.cancelledShifts === true) {
        where.status = {
          $in: [1, 2],
        };
      }
      var timeZone = '+0800';
      if (requestData.shiftDetailsId) where._id = requestData.shiftDetailsId;

      var shifts = await this.shiftDetails(where, res);
      var totalApprovedDuration = await this.getAttendanceTotal(
        res,
        shifts,
        requestData.userId,
      );
      console.log('totalApprovedDuration', totalApprovedDuration);
      var listData = {};
      await shifts.forEach((element) => {
        timeZone = element.timeZone;
        if (!element.appliedStaffs[0]) return;
        if (element.isExtendedShift) {
          let extendedStaff = element.extendedStaff.filter((item) => {
            return item.userId.toString() == requestData.userId.toString();
          });
          if (extendedStaff.length > 0) {
            extendedStaff = extendedStaff[0];
            if (extendedStaff.confirmStatus == 2) {
              element.duration = extendedStaff.duration;
            }
          }
        }
        if (element.isAssignShift && (element.isRest || element.isOff)) {
          if (element.isRecallAccepted != 2) {
            element.duration = 0;
          }
        }
        var key = __.getDateStringFormat(element.date, element.timeZone);
        if (listData[key]) {
          /*if date already keyed in array */
          listData[key].push(element);
        } else {
          /*else create a new key by date in array */
          listData[key] = [];
          listData[key].push(element);
        }
      });
      return {
        list: listData,
        timeZone,
        totalApprovedDuration: await this.getDuration(totalApprovedDuration),
      };
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async getDuration(time) {
    if (time) {
      time = parseFloat(time);
      time = time * 60;
      var hours = Math.floor(time / 60);
      var minutes = Math.round(time % 60);
      return '' + hours + 'h:' + minutes + 'min';
    } else {
      return '0';
    }
  }
  async shiftDetails(where, res) {
    try {
      var findOrFindOne,
        userId = where.userId;
      delete where.userId;
      if (where._id) findOrFindOne = ShiftDetails.findOne(where);
      else findOrFindOne = ShiftDetails.find(where);

      var shiftDetails = await findOrFindOne
        .select('-__v -createdAt -updatedAt')
        .populate([
          {
            path: 'draftId',
            select:
              'shiftRead shiftChangeRequestStatus shiftChangeRequestMessage',
          },
          {
            path: 'shiftId',
            select: '-__v -shiftDetails -createdAt -updatedAt',
            populate: [
              {
                path: 'plannedBy',
                select: 'name staffId',
              },
              {
                path: 'businessUnitId',
                select: 'name status shiftTimeInMinutes',
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
            path: 'appliedStaffs',
            select: 'status',
            match: {
              flexiStaff: userId,
              status: {
                $in: [1, 2] /*only confirmed and stanby slots */,
              },
            },
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
            select: '_id name',
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
            path: 'requestedShifts',
            match: {
              status: 0,
              dedicatedRequestTo: userId,
            },
          },
        ])
        .sort({
          startTime: 1,
        })
        .lean();
      return shiftDetails; //final result
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async makeBooking(req, res) {
    try {
      let requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'isConfirmed',
      ]);
      if (
        requiredResult.status === false ||
        (req.body.isSplitShift && req.body.splitShiftDetailsId === '')
      ) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let userId = req.user._id;
        let updateObj = {};
        if (req.body.isConfirmed) {
          updateObj = {
            $push: {
              confirmedStaffs: req.user._id,
            },
          };
        } else {
          updateObj = {
            $push: {
              backUpStaffs: req.user._id,
            },
          };
        }
        var currentShiftDetails = await ShiftDetails.findOneAndUpdate(
          {
            _id: req.body.shiftDetailsId,
            status: 1,
            startTime: {
              $gt: moment().utc().format(),
            },
          },
          updateObj,
        ).populate([
          {
            path: 'shiftId',
            select: 'weekNumber businessUnitId',
          },
        ]);
        if (!currentShiftDetails) {
          await this.reduceLimit(res, userId, req.body.shiftDetailsId);
          __.out(res, 300, 'Invalid Shift / Shift Expired');
        }
        // return res.json(currentShiftDetails)
        var currentShiftDetailsSplit = null;
        if (req.body.isSplitShift) {
          currentShiftDetailsSplit = await ShiftDetails.findOneAndUpdate(
            {
              _id: req.body.splitShiftDetailsId,
              status: 1,
              startTime: {
                $gt: moment().utc().format(),
              },
            },
            updateObj,
          ).populate([
            {
              path: 'shiftId',
              select: 'businessUnitId weekNumber',
            },
          ]);
          currentShiftDetails.duration += currentShiftDetailsSplit.duration;
        }
        console.log('currentShiftDetailsSplit', currentShiftDetailsSplit);
        if (
          !currentShiftDetails ||
          (req.body.isSplitShift && !currentShiftDetailsSplit)
        ) {
          if (req.body.isConfirmed) {
            await ShiftDetails.update(
              { _id: req.body.shiftDetailsId },
              { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
            );
            if (req.body.isSplitShift) {
              await ShiftDetails.update(
                { _id: req.body.splitShiftDetailsId },
                { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
              );
            }
          } else {
            await ShiftDetails.update(
              { _id: req.body.shiftDetailsId },
              { $pull: { backUpStaffs: { $in: [req.user._id] } } },
            );
            if (req.body.isSplitShift) {
              await ShiftDetails.update(
                { _id: req.body.splitShiftDetailsId },
                { $pull: { backUpStaffs: { $in: [req.user._id] } } },
              );
            }
          }
          await this.reduceLimit(res, userId, currentShiftDetails);
          __.out(res, 300, 'Invalid Shift / Shift Expired');
        } else {
          const redisBuId = currentShiftDetails.shiftId.businessUnitId;
          var staffNeedCount = currentShiftDetails.staffNeedCount,
            backUpStaffNeedCount = currentShiftDetails.backUpStaffNeedCount,
            confirmedStaffsLength = currentShiftDetails.confirmedStaffs.length,
            backUpStaffsLength = currentShiftDetails.backUpStaffs.length,
            isConfirmed = req.body.isConfirmed;
          if (
            (isConfirmed == 1 && staffNeedCount > confirmedStaffsLength) ||
            (isConfirmed == 0 && backUpStaffNeedCount > backUpStaffsLength)
          ) {
            // check staff available time
            var data = {
              startTime: currentShiftDetails.startTime,
              endTime: currentShiftDetails.endTime,
              flexiStaffId: req.user._id,
              shiftId: req.body.shiftDetailsId,
            };
            var checkStaffAvailableInGivenTime =
              await this.checkStaffAvailableInGivenTime(data, res);
            var checkStaffAvailableInGivenTimeSplit = false;
            if (req.body.isSplitShift) {
              var newData = {
                startTime: currentShiftDetailsSplit.startTime,
                endTime: currentShiftDetailsSplit.endTime,
                flexiStaffId: req.user._id,
                shiftId: req.body.splitShiftDetailsId,
              };
              checkStaffAvailableInGivenTimeSplit =
                await this.checkStaffAvailableInGivenTime(newData, res);
            }
            // let staffRequested = await this.shiftingStaffs(req, res);

            if (
              checkStaffAvailableInGivenTime &&
              (!req.body.isSplitShift ||
                (req.body.isSplitShift && checkStaffAvailableInGivenTimeSplit))
            ) {
              var addTosetObj = {},
                set = {},
                status,
                statusString = '';
              if (staffNeedCount > confirmedStaffsLength) {
                //addTosetObj.confirmedStaffs = req.user._id;
                status = 1;
                if (staffNeedCount >= confirmedStaffsLength + 1) {
                  __.log('am here both are equal');
                  set.isShortTimeCancel = 0;
                }
                statusString = `You have booked a confirmed shift.
                            
              Note that any last minute cancellation of booking or no - show will be penalized.`;
              } else if (
                isConfirmed == 0 &&
                backUpStaffNeedCount >= backUpStaffsLength + 1
              ) {
                //addTosetObj.backUpStaffs = req.user._id;
                status = 2;
                statusString = `You have booked a standby shift.
                            
                You shall be notified and automatically upgraded in the event of an available confirmed slot.`;
              } else if (isConfirmed == 1) {
                /* tried for confirm but confirm slot filled */

                await ShiftDetails.update(
                  { _id: req.body.shiftDetailsId },
                  { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
                );
                if (req.body.isSplitShift) {
                  await ShiftDetails.update(
                    { _id: req.body.splitShiftDetailsId },
                    { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
                  );
                }
                //await this.reduceLimit(userId,currentShiftDetails)
                __.out(
                  res,
                  300,
                  'Your booking is unsuccessful as the confirm slot has been assigned.Please try for standby slot.',
                );
                // this.updateRedis(redisBuId)
                //   .then((uRedisResult) => {
                //     console.log('updateRedis', uRedisResult);
                //   })
                //   .catch((eRedisResult) => {
                //     console.log('updateRedis error', eRedisResult);
                //   });
                return;
              } else {
                /* tried for standby but standby slot filled */
                await ShiftDetails.update(
                  { _id: req.body.shiftDetailsId },
                  { $pull: { backUpStaffs: { $in: [req.user._id] } } },
                );
                if (req.body.isSplitShift) {
                  await ShiftDetails.update(
                    { _id: req.body.splitShiftDetailsId },
                    { $pull: { backUpStaffs: { $in: [req.user._id] } } },
                  );
                }
                __.out(
                  res,
                  300,
                  'Your booking is unsuccessful as the standby slot has been assigned.',
                );
                // this.updateRedis(redisBuId)
                //   .then((uRedisResult) => {
                //     console.log('updateRedis', uRedisResult);
                //   })
                //   .catch((eRedisResult) => {
                //     console.log('updateRedis error', eRedisResult);
                //   });
                return;
              }

              var limitData = {
                status: 1,
                isLimit: false,
              };
              console.log('limitDatalimitData', limitData);
              if (limitData.status == 1) {
                // check confirmed staff here as well
                var insertAppliedStaffs = await new AppliedStaffs({
                  shiftId: currentShiftDetails.shiftId,
                  shiftDetailsId: currentShiftDetails._id,
                  flexiStaff: req.user._id,
                  status: status,
                  isLimit: limitData.isLimit, //req.body.limit,
                  //  limitMessage: ''//req.body.limitMessage
                }).save();
                var insertAppliedStaffId = insertAppliedStaffs._id;
                addTosetObj.appliedStaffs = insertAppliedStaffId;
                if (limitData.isLimit) {
                  set.isLimit = true;
                }
                var updateShiftDetails = await ShiftDetails.update(
                  {
                    _id: currentShiftDetails._id,
                  },
                  {
                    $addToSet: addTosetObj,
                    $set: set,
                  },
                  {
                    new: true,
                  },
                );
                // added by ashish
                if (req.body.isSplitShift) {
                  var insertAppliedStaffs = await new AppliedStaffs({
                    shiftId: currentShiftDetails.shiftId,
                    shiftDetailsId: req.body.splitShiftDetailsId,
                    flexiStaff: req.user._id,
                    status: status,
                  }).save();
                  var insertAppliedStaffId = insertAppliedStaffs._id;

                  addTosetObj.appliedStaffs = insertAppliedStaffId;

                  var updateShiftDetails = await ShiftDetails.update(
                    {
                      _id: req.body.splitShiftDetailsId,
                    },
                    {
                      $addToSet: addTosetObj,
                      $set: set,
                    },
                    {
                      new: true,
                    },
                  );
                }

                // this.updateRedis(redisBuId)
                //   .then((uRedisResult) => {
                //     console.log('updateRedis', uRedisResult);
                //   })
                //   .catch((eRedisResult) => {
                //     console.log('updateRedis error', eRedisResult);
                //   });
                __.out(res, 201, statusString); //+' \n'+limitData.message
              } else {
                if (req.body.isConfirmed) {
                  await ShiftDetails.update(
                    { _id: req.body.shiftDetailsId },
                    { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
                  );
                  if (req.body.isSplitShift) {
                    await ShiftDetails.update(
                      { _id: req.body.splitShiftDetailsId },
                      { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
                    );
                  }
                } else {
                  await ShiftDetails.update(
                    { _id: req.body.shiftDetailsId },
                    { $pull: { backUpStaffs: { $in: [req.user._id] } } },
                  );
                  if (req.body.isSplitShift) {
                    await ShiftDetails.update(
                      { _id: req.body.splitShiftDetailsId },
                      { $pull: { backUpStaffs: { $in: [req.user._id] } } },
                    );
                  }
                }
                // this.updateRedis(redisBuId)
                //   .then((uRedisResult) => {
                //     console.log('updateRedis', uRedisResult);
                //   })
                //   .catch((eRedisResult) => {
                //     console.log('updateRedis error', eRedisResult);
                //   });
                __.out(res, 300, limitData.message);
              }
            } else {
              // if staff has overlap booking
              if (req.body.isConfirmed) {
                await this.reduceLimit(res, userId, currentShiftDetails);
                await ShiftDetails.update(
                  { _id: req.body.shiftDetailsId },
                  { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
                );
                if (req.body.isSplitShift) {
                  await ShiftDetails.update(
                    { _id: req.body.splitShiftDetailsId },
                    { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
                  );
                }
              } else {
                await ShiftDetails.update(
                  { _id: req.body.shiftDetailsId },
                  { $pull: { backUpStaffs: { $in: [req.user._id] } } },
                );
                if (req.body.isSplitShift) {
                  await ShiftDetails.update(
                    { _id: req.body.splitShiftDetailsId },
                    { $pull: { backUpStaffs: { $in: [req.user._id] } } },
                  );
                }
              }
              // this.updateRedis(redisBuId)
              //   .then((uRedisResult) => {
              //     console.log('updateRedis', uRedisResult);
              //   })
              //   .catch((eRedisResult) => {
              //     console.log('updateRedis error', eRedisResult);
              //   });
              __.out(res, 300, 'You have another shift at the same time.');
            }
          } else {
            var statusString = '';
            if (req.body.isConfirmed) {
              await ShiftDetails.update(
                { _id: req.body.shiftDetailsId },
                { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
              );
              if (req.body.isSplitShift) {
                await ShiftDetails.update(
                  { _id: req.body.splitShiftDetailsId },
                  { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
                );
              }
            } else {
              await ShiftDetails.update(
                { _id: req.body.shiftDetailsId },
                { $pull: { backUpStaffs: { $in: [req.user._id] } } },
              );
              if (req.body.isSplitShift) {
                await ShiftDetails.update(
                  { _id: req.body.splitShiftDetailsId },
                  { $pull: { backUpStaffs: { $in: [req.user._id] } } },
                );
              }
            }
            if (isConfirmed == 1) {
              await this.reduceLimit(res, userId, currentShiftDetails);
              statusString =
                'Your booking is unsuccessful as the slot has been assigned.Please view other available shifts.'; //'Confirm slots are fully booked.Now you can book backup slots if available';
            } else {
              statusString =
                'Your booking is unsuccessful as the slot has been assigned.Please view other available shifts.'; //'Standby slots are fully booked.Currently no slots available to book.';
            }
            // this.updateRedis(redisBuId)
            //   .then((uRedisResult) => {
            //     console.log('updateRedis', uRedisResult);
            //   })
            //   .catch((eRedisResult) => {
            //     console.log('updateRedis error', eRedisResult);
            //   });
            __.out(res, 300, statusString);
          }
        }
      }
    } catch (err) {
      __.log(err);
      try {
        if (req.body.isConfirmed) {
          await ShiftDetails.update(
            { _id: req.body.shiftDetailsId },
            { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
          );
          if (req.body.isSplitShift) {
            await ShiftDetails.update(
              { _id: req.body.splitShiftDetailsId },
              { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
            );
          }
          await this.reduceLimit(res, req.user._id, req.body.shiftDetailsId, 0);
        } else {
          await ShiftDetails.update(
            { _id: req.body.shiftDetailsId },
            { $pull: { backUpStaffs: { $in: [req.user._id] } } },
          );
          if (req.body.isSplitShift) {
            await ShiftDetails.update(
              { _id: req.body.splitShiftDetailsId },
              { $pull: { backUpStaffs: { $in: [req.user._id] } } },
            );
          }
        }
      } catch (error) {
        __.out(error, 500);
      }
      __.out(res, 500);
    }
  }

  async makeBookingNew(req, res) {
    try {
      let requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'isConfirmed',
      ]);
      if (
        requiredResult.status === false ||
        (req.body.isSplitShift && req.body.splitShiftDetailsId === '')
      ) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      let userId = req.user._id;
      let updateObj = {};
      let pullObj = {};
      let where = {
        _id: req.body.shiftDetailsId,
        status: 1,
        startTime: {
          $gt: moment().utc().format(),
        },
      };
      if (req.body.isConfirmed) {
        updateObj = {
          $push: {
            confirmedStaffs: userId,
          },
        };
        pullObj = {
          $pull: {
            confirmedStaffs: userId,
          },
        };
        where.confirmedStaffs = { $ne: userId };
      } else {
        updateObj = {
          $push: {
            backUpStaffs: userId,
          },
        };
        pullObj = {
          $pull: {
            backUpStaffs: userId,
          },
        };
        where.backUpStaffs = { $ne: userId };
      }
      // in new code we can remove populate by adding buId, weekNumber inside shiftDetails
      var currentShiftDetails = await ShiftDetails.findOneAndUpdate(
        where,
        updateObj,
      ).populate([
        {
          path: 'shiftId',
          select: 'weekNumber businessUnitId',
        },
      ]);
      if (!currentShiftDetails) {
        return __.out(res, 300, 'Invalid Shift / Shift Expired');
      }
      var currentShiftDetailsSplit = null;
      if (req.body.isSplitShift) {
        currentShiftDetailsSplit = await ShiftDetails.findOneAndUpdate(
          {
            _id: req.body.splitShiftDetailsId,
            status: 1,
            startTime: {
              $gt: moment().utc().format(),
            },
          },
          updateObj,
        );
        if (!currentShiftDetailsSplit) {
          return __.out(res, 300, 'Invalid Shift / Shift Expired');
        }
        currentShiftDetails.duration += currentShiftDetailsSplit.duration;
      }
      const redisBuId = currentShiftDetails.shiftId.businessUnitId;
      var staffNeedCount = currentShiftDetails.staffNeedCount,
        backUpStaffNeedCount = currentShiftDetails.backUpStaffNeedCount,
        confirmedStaffsLength = currentShiftDetails.confirmedStaffs.length,
        backUpStaffsLength = currentShiftDetails.backUpStaffs.length,
        isConfirmed = req.body.isConfirmed;
      console.log('isConfirmed', isConfirmed, confirmedStaffsLength);
      console.log('staffNeedCount', staffNeedCount);
      // check confirmedStaffs is getting add now or not;
      if (
        !(isConfirmed == 1 && staffNeedCount > confirmedStaffsLength) &&
        !(isConfirmed == 0 && backUpStaffNeedCount > backUpStaffsLength)
      ) {
        // if slot is already full remove push data.
        var statusString =
          'Your booking is unsuccessful as the slot has been assigned.Please view other available shifts';
        await ShiftDetails.updateOne({ _id: req.body.shiftDetailsId }, pullObj);
        if (req.body.isSplitShift) {
          await ShiftDetails.updateOne(
            { _id: req.body.splitShiftDetailsId },
            pullObj,
          );
        }
        return __.out(res, 300, statusString);
      }

      // check staff available time
      var data = {
        startTime: currentShiftDetails.startTime,
        endTime: currentShiftDetails.endTime,
        flexiStaffId: userId,
        shiftId: req.body.shiftDetailsId,
      };
      // if present getting false value
      var checkStaffAvailableInGivenTime =
        await this.checkStaffAvailableInGivenTime(data, res);
      var checkStaffAvailableInGivenTimeSplit = false;
      if (req.body.isSplitShift) {
        var newData = {
          startTime: currentShiftDetailsSplit.startTime,
          endTime: currentShiftDetailsSplit.endTime,
          flexiStaffId: userId,
          shiftId: req.body.splitShiftDetailsId,
        };
        checkStaffAvailableInGivenTimeSplit =
          await this.checkStaffAvailableInGivenTime(newData, res);
      }
      // check below condition is working for split shift or not
      if (
        !checkStaffAvailableInGivenTime ||
        (req.body.isSplitShift && !checkStaffAvailableInGivenTimeSplit)
      ) {
        // if staff has overlap booking
        await ShiftDetails.updateOne({ _id: req.body.shiftDetailsId }, pullObj);
        if (req.body.isSplitShift) {
          await ShiftDetails.updateOne(
            { _id: req.body.splitShiftDetailsId },
            pullObj,
          );
        }
        return __.out(res, 300, 'You have another shift at the same time.');
      }
      var addTosetObj = {},
        set = {},
        status,
        statusString = '';
      if (staffNeedCount > confirmedStaffsLength && isConfirmed == 1) {
        status = 1;
        if (staffNeedCount >= confirmedStaffsLength + 1) {
          __.log('am here both are equal');
          set.isShortTimeCancel = 0;
        }
        statusString = `You have booked a confirmed shift. Note that any last minute cancellation of booking or no - show will be penalized.`;
      } else if (
        isConfirmed == 0 &&
        backUpStaffNeedCount >= backUpStaffsLength + 1
      ) {
        status = 2;
        statusString = `You have booked a standby shift. You shall be notified and automatically upgraded in the event of an available confirmed slot.`;
      } else {
        /* tried for standby but standby slot filled */
        await ShiftDetails.updateOne({ _id: req.body.shiftDetailsId }, pullObj);
        if (req.body.isSplitShift) {
          await ShiftDetails.updateOne(
            { _id: req.body.splitShiftDetailsId },
            pullObj,
          );
        }
        const msg =
          isConfirmed == 1
            ? 'Your booking is unsuccessful as the confirm slot has been assigned.Please try for standby slot.'
            : 'Your booking is unsuccessful as the standby slot has been assigned.';
        return __.out(res, 300, msg);
      }
      let limitData = {
        status: 1,
        limit: false,
      };
      limitData = await this.checkLimitNew(
        res,
        userId,
        currentShiftDetails,
        true,
        currentShiftDetailsSplit,
      );
      if (limitData.limit) {
        await ShiftDetails.updateOne({ _id: req.body.shiftDetailsId }, pullObj);
        if (req.body.isSplitShift) {
          await ShiftDetails.updateOne(
            { _id: req.body.splitShiftDetailsId },
            pullObj,
          );
        }
        return res
          .status(201)
          .json({ limit: true, status: 0, message: limitData.message });
      }
      // check interval and limit
      // check confirmed staff here as well
      var insertAppliedStaffs = await new AppliedStaffs({
        shiftId: currentShiftDetails.shiftId,
        shiftDetailsId: currentShiftDetails._id,
        flexiStaff: userId,
        status: status,
      }).save();
      var insertAppliedStaffId = insertAppliedStaffs._id;
      addTosetObj.appliedStaffs = insertAppliedStaffId;
      var updObj = {
        $addToSet: addTosetObj,
      };
      if (!_.isEmpty(set)) {
        updObj = {
          $addToSet: addTosetObj,
          $set: set,
        };
      }
      var updateShiftDetails = await ShiftDetails.updateOne(
        {
          _id: currentShiftDetails._id,
        },
        updObj,
        {
          new: true,
        },
      );

      if (req.body.isSplitShift) {
        var insertAppliedStaffs = await new AppliedStaffs({
          shiftId: currentShiftDetails.shiftId,
          shiftDetailsId: req.body.splitShiftDetailsId,
          flexiStaff: userId,
          status: status,
        }).save();
        var insertAppliedStaffId = insertAppliedStaffs._id;

        addTosetObj.appliedStaffs = insertAppliedStaffId;
        var updObj = {
          $addToSet: addTosetObj,
        };
        if (!_.isEmpty(set)) {
          updObj = {
            $addToSet: addTosetObj,
            $set: set,
          };
        }
        var updateShiftDetails = await ShiftDetails.updateOne(
          {
            _id: req.body.splitShiftDetailsId,
          },
          updObj,
          {
            new: true,
          },
        );
      }

      // this.updateRedis(redisBuId)
      //   .then((uRedisResult) => {
      //     console.log('updateRedis', uRedisResult);
      //   })
      //   .catch((eRedisResult) => {
      //     console.log('updateRedis error', eRedisResult);
      //   });
      return __.out(res, 201, statusString);
    } catch (err) {
      __.log(err);
      try {
        if (req.body.isConfirmed) {
          await ShiftDetails.updateOne(
            { _id: req.body.shiftDetailsId },
            { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
          );
          if (req.body.isSplitShift) {
            await ShiftDetails.updateOne(
              { _id: req.body.splitShiftDetailsId },
              { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
            );
          }
        } else {
          await ShiftDetails.updateOne(
            { _id: req.body.shiftDetailsId },
            { $pull: { backUpStaffs: { $in: [req.user._id] } } },
          );
          if (req.body.isSplitShift) {
            await ShiftDetails.updateOne(
              { _id: req.body.splitShiftDetailsId },
              { $pull: { backUpStaffs: { $in: [req.user._id] } } },
            );
          }
        }
      } catch (error) {
        return __.out(error, 500);
      }
      __.out(res, 500);
    }
  }

  async checkLimitNew(
    res,
    userId,
    shiftDetails,
    bookNewShift = false,
    currentShiftDetailsSplit,
  ) {
    try {
      // check if we can remove this query
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

        // check cutOffDaysForBookingAndCancelling
        var subSectionForBU = await SubSection.findOne({
          _id: shiftDetails.shiftId.businessUnitId,
        }).lean();
        if (!!subSectionForBU.cutOffDaysForBookingAndCancelling) {
          if (subSectionForBU.cutOffDaysForBookingAndCancelling > 0) {
            const a = shiftDetails.timeZone;
            const hr = a[1] + a[2];
            const min = a[3] + a[4];
            var min1 = parseInt(hr) * 60 + parseInt(min);
            var newStartTime = moment(shiftDetails.startTime).add(
              min1,
              'minutes',
            );
            var currTime = moment().add(min1, 'minutes');
            var shiftStartTime = moment(newStartTime).format('LL');
            var currentTime = moment(currTime).format('LL');
            console.log('shiftStartTime =', shiftStartTime);
            console.log('currentTime =', currentTime);

            var hoursLeftToStartShift = __.getDurationInHours(
              currentTime,
              shiftStartTime,
            );
            console.log('hoursLeftToStartShift =', hoursLeftToStartShift);
            var days = (hoursLeftToStartShift / 24).toFixed(0); // in days
            console.log('days =', days);

            var shiftExactStartTime = moment(shiftDetails.startTime);
            var currentExactTime = moment();
            console.log('currentExactTime =', shiftExactStartTime);
            console.log('currentExactTime =', currentExactTime);
            var exactHoursLeftToStartShift = __.getDurationInHours(
              currentExactTime,
              shiftExactStartTime,
            );
            console.log(
              'exactHoursLeftToStartShift =',
              exactHoursLeftToStartShift,
            );

            if (
              subSectionForBU.cutOffDaysForBookingAndCancelling >
                parseInt(days) &&
              parseInt(exactHoursLeftToStartShift) > 0
            ) {
              console.log(
                'subSectionForBU.cutOffDaysForBookingAndCancelling = ',
                subSectionForBU.cutOffDaysForBookingAndCancelling,
              );
              console.log(
                'cutOffDaysForBookingAndCancelling is not met = parseInt(days) = ',
                days,
              );

              return {
                limit: true,
                status: 0,
                message:
                  'You cannot book this shift as it falls within the cut-off time.',
              };
            }
          }
          console.log(
            'subSectionForBU.cutOffDaysForBookingAndCancelling is 0 or less than zero = ',
            subSectionForBU.cutOffDaysForBookingAndCancelling,
          );
        }

        // check if shift interval is require
        if (schemeDetails.isShiftInterval) {
          const intervalRequireTime = schemeDetails.shiftIntervalTotal - 1; // shiftIntervalTotal is in min
          const intervalResult = await ShiftHelper.checkShiftInterval(
            userId,
            shiftDetails.startTime,
            shiftDetails.endTime,
            intervalRequireTime,
            shiftDetails._id,
          );
          var isSplitInterval = false;
          if (currentShiftDetailsSplit) {
            isSplitInterval = await ShiftHelper.checkShiftInterval(
              userId,
              currentShiftDetailsSplit.startTime,
              currentShiftDetailsSplit.endTime,
              intervalRequireTime,
              shiftDetails._id,
              currentShiftDetailsSplit._id,
            );
          }
          if (intervalResult || isSplitInterval) {
            return {
              limit: true,
              status: 0,
              message:
                'Minimum interval between shift is not met. Kindly choose another shift with required interval.',
            };
          }
        }

        var isOt = false;
        if (
          schemeDetails.shiftSchemeType == 1 ||
          schemeDetails.shiftSchemeType == 3
        ) {
          let otDuration = 0;
          let normalDuration = 0;
          if (
            schemeDetails.shiftSetup.openShift &&
            schemeDetails.shiftSetup.openShift.normal
          ) {
            normalDuration = parseInt(shiftDetails.duration);
          } else {
            isOt = true;
            otDuration = parseInt(shiftDetails.duration);
          }
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
          let weekNumber = shiftDetails.shiftId.weekNumber;
          var date = new Date(shiftDetails.date),
            y = date.getFullYear(),
            m = date.getMonth();
          const weekDays = {
            monday: 6,
            tuesday: 5,
            wednesday: 4,
            thursday: 3,
            friday: 2,
            saturday: 1,
            sunday: 0,
          };
          const startWeek = moment(`'${y}'`)
            .add(weekNumber, 'weeks')
            .startOf('isoweek');
          var firstDay = new Date(y, m, 1);
          var lastDay = new Date(y, m + 1, 0);
          const weekDay = moment(lastDay).format('dddd');
          lastDay = moment(lastDay)
            .add(weekDays[weekDay.toLowerCase()], 'days')
            .format('YYYY-MM-DDT23:59:59.000+00:00');
          if (!moment(firstDay).isBefore(startWeek)) {
            var inverseOffset = moment(startWeek).utcOffset() * -1;
            firstDay = moment().utcOffset(inverseOffset);
          }
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
          let dailyOverall = dailyDuration;
          let weekLlyOverall = dailyDuration;
          let monthlyOverall = dailyDuration;
          console.log('data', weekLlyOverall);
          let isPresent = false;
          let shiftDuration = 0;
          let staffLimitPresentData = {};
          //res.json({data});
          if (!isOt) {
            data.forEach((item) => {
              // console.log('new Date(item.date)', new Date(item.date))
              // daily calculation
              if (new Date(item.date).getDate() == new Date(date).getDate()) {
                if (
                  item.shiftDetailId.toString() == shiftDetails._id.toString()
                ) {
                  shiftDuration = item.normalDuration;
                  isPresent = true;
                  staffLimitPresentData = item;
                }
                console.log('item.normalDuration', item.normalDuration);
                dailyDuration += item.normalDuration;
                dailyOverall += item.normalDuration;
                dailyOverall += item.otDuration;
              }
              // month calculation
              if (new Date(item.date).getMonth() == new Date(date).getMonth()) {
                monthlyDuration += item.normalDuration;
                monthlyOverall += item.normalDuration;
                monthlyOverall += item.otDuration;
              }
              console.log('item.weekNo', item.weekNumber);
              console.log('sss', weekNumber);
              // week calculation
              if (item.weekNumber == weekNumber) {
                weeklyDuration += item.normalDuration;
                weekLlyOverall += item.normalDuration;
                weekLlyOverall += item.otDuration;
              }
            });
          } else {
            // ot hr
            data.forEach((item) => {
              // console.log('new Date(item.date)', new Date(item.date))
              if (new Date(item.date).getDate() == new Date(date).getDate()) {
                if (
                  item.shiftDetailId.toString() == shiftDetails._id.toString()
                ) {
                  isPresent = true;
                  shiftDuration = item.otDuration + item.normalDuration;
                  staffLimitPresentData = item;
                }
                dailyDuration += item.otDuration;
                dailyOverall += item.otDuration;
                dailyOverall += item.normalDuration;
              }
              if (new Date(item.date).getMonth() == new Date(date).getMonth()) {
                monthlyDuration += item.otDuration;
                monthlyOverall += item.otDuration;
                monthlyOverall += item.normalDuration;
              }
              console.log('item.weekNo', item.weekNumber);
              console.log('sss', weekNumber);
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
          if (shiftDetails.isAssignShift) {
            isAllow = !schemeDetails.shiftSetup.limits.otHr.day.alert;
            disallow = !schemeDetails.shiftSetup.limits.otHr.day.disallow;
            // if(schemeDetails.shiftSchemeType == 3){
            //     disallow = !disallow;
            //     isAllow = !isAllow;
            // }
          }
          if (isOt) {
            dayLimit = schemeDetails.shiftSetup.limits.otHr.day;
            weekLimit = schemeDetails.shiftSetup.limits.otHr.week;
            monthLimit = schemeDetails.shiftSetup.limits.otHr.month;
          }
          // if(isAllow){
          console.log('isPresent', isPresent);
          console.log('aaaaaaaaaaaaaaaaaaaaa', normalDuration, otDuration);
          // add data to staff Limit
          // }
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
            return {
              limit: true,
              message: 'Exceeds Monthly Overall limit',
              flag: 'monthoverall',
              details: monthLimit,
              status: disallow ? 0 : 1,
            };
          }

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
            if ((bookNewShift && shiftDuration == 0) || !bookNewShift) {
              const upppp = await StaffLimit.findByIdAndUpdate(
                staffLimitPresentData._id,
                {
                  $inc: {
                    normalDuration: normalDuration,
                    otDuration: otDuration,
                  },
                },
              );
            } else {
              return { message: 'Shift Already Booked', booked: true };
            }
            // console.log('upppp', upppp);
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
    } catch (error) {
      console.log('check limit error', error);
      return {
        limit: true,
        status: 0,
        message: 'Something went wrong',
      };
    }
  }

  // async checkLimit(userId, shiftDetails){
  //     let schemeDetails = await User.findById(userId,{schemeId:1, _id:0}).populate([{
  //         path : 'schemeId'
  //     }
  //     ]);
  //     if(schemeDetails.schemeId){
  //     schemeDetails = schemeDetails.schemeId;
  //     if(schemeDetails.shiftSchemeType == 1 || schemeDetails.shiftSchemeType ==3){
  //         let otDuration=0;
  //         let normalDuration = 0;
  //         if(schemeDetails.shiftSetup.openShift && schemeDetails.shiftSetup.openShift.normal){
  //             normalDuration = shiftDetails.duration;
  //         }else {
  //             otDuration = shiftDetails.duration;
  //         }
  //         var date = new Date(shiftDetails.date),
  //         y = date.getFullYear(),
  //          m = date.getMonth();
  //         var firstDay = new Date(y, m, 1);
  //         var lastDay = new Date(y, m + 1, 0);
  //         //console.log('fir', firstDay, lastDay)
  //         //console.log('date', new Date(date))
  //         const data = await StaffLimit.find({userId: userId,
  //             date: { $lte: new Date(new Date(lastDay).toISOString()),$gte: new Date(new Date(firstDay).toISOString()) },
  //            }).lean();
  //           // console.log('data', data);
  //         let dailyDuration = shiftDetails.duration;
  //         let weeklyDuration = shiftDetails.duration;
  //         let monthlyDuration = shiftDetails.duration;
  //         let weekNumber = shiftDetails.shiftId.weekNumber;
  //         console.log('data', data.length)
  //         let isPresent = false;
  //         let staffLimitPresentData = {};
  //         if(schemeDetails.shiftSetup.openShift && schemeDetails.shiftSetup.openShift.normal){
  //         data.forEach((item)=>{
  //            // console.log('new Date(item.date)', new Date(item.date))
  //             if(new Date(item.date).getDate() == new Date(date).getDate()){
  //                 isPresent = true
  //                 staffLimitPresentData = item;
  //                 console.log('item.normalDuration', item.normalDuration)
  //                 dailyDuration+=item.normalDuration;
  //             }
  //             if(new Date(item.date).getMonth() == new Date(date).getMonth()){
  //                 monthlyDuration+= item.normalDuration;
  //             }
  //             console.log('item.weekNo', item.weekNumber);
  //             console.log('sss', weekNumber)
  //             if(item.weekNumber == weekNumber){
  //                 weeklyDuration+= item.normalDuration;
  //             }
  //         });
  //     }else {
  //         // ot hr
  //         data.forEach((item)=>{
  //             // console.log('new Date(item.date)', new Date(item.date))
  //              if(new Date(item.date).getDate() == new Date(date).getDate()){
  //                  isPresent = true
  //                  staffLimitPresentData = item;
  //                  dailyDuration+=item.otDuration;
  //              }
  //              if(new Date(item.date).getMonth() == new Date(date).getMonth()){
  //                  monthlyDuration+= item.otDuration;
  //              }
  //              console.log('item.weekNo', item.weekNumber);
  //              console.log('sss', weekNumber)
  //              if(item.weekNumber == weekNumber){
  //                  weeklyDuration+= item.otDuration;
  //              }
  //          });
  //     }
  //         let isLimitExceed = false;
  //         let dayLimit = schemeDetails.shiftSetup.limits.normalHr.day;
  //         let weekLimit = schemeDetails.shiftSetup.limits.normalHr.week;;
  //         let monthLimit = schemeDetails.shiftSetup.limits.normalHr.month;
  //         let isAllow = false;
  //        // if(isAllow){
  //             console.log('isPresent', isPresent)
  //             console.log('aaaaaaaaaaaaaaaaaaaaa',normalDuration, otDuration)
  //             // add data to staff Limit
  //             if(!isPresent){
  //                 console.log('aaaaaaaaaaaaaaaaaaaaa',normalDuration, otDuration)
  //                 const obj = {
  //                     userId: userId,
  //                     shiftId: shiftDetails.shiftId._id,
  //                     shiftDetailId:shiftDetails._id,
  //                     date:shiftDetails.date,
  //                     normalDuration:normalDuration,
  //                     otDuration:otDuration,
  //                     weekNumber:weekNumber,
  //                     businessUnitId:shiftDetails.shiftId.businessUnitId
  //                 }
  //                 var insertAppliedStaffs = await new StaffLimit(obj).save();
  //                 //console.log('dddd', insertAppliedStaffs)
  //                 // add new
  //             }else {
  //                 // update
  //                 const upppp = await StaffLimit.findByIdAndUpdate(staffLimitPresentData._id, {$inc:{normalDuration:normalDuration, otDuration:otDuration}});
  //                // console.log('upppp', upppp);
  //             }
  //        // }
  //         console.log('dayLimit', dayLimit, dailyDuration)
  //         if(parseInt(dayLimit.value)<dailyDuration){
  //             if(!isAllow){
  //                 await this.reduceLimit(userId,shiftDetails)
  //             }
  //             return {limit: true, message: 'Day limit excedds', flag:'day', details:dayLimit, status:0} //dayLimit.disallow?0:1
  //         }
  //         if(parseInt(weekLimit.value)<weeklyDuration){
  //             if(!isAllow){
  //                 await this.reduceLimit(userId,shiftDetails)
  //             }
  //             return {limit: true, message: 'Week limit excedds', flag:'week', details:weekLimit, status:0}
  //         }
  //         if(parseInt(monthLimit.value)<monthlyDuration){
  //             if(!isAllow){
  //                 await this.reduceLimit(userId,shiftDetails)
  //             }
  //             return {limit: true, message: 'Month limit excedds', flag:'month', details:monthLimit, status:0}
  //         }
  //         return {limit:false, status:1, message:''}
  //     }else {
  //         return {limit:true, status:0, message: 'You don\'t have open shift scheme assign' }   // status 0 not allowed to create, 1 allowed to create
  //     }
  // }else {
  //     return {limit:true, status:0, message: 'You don\'t have open shift scheme assign' }   // status 0 not allowed to create, 1 allowed to create
  // }
  // }
  async checkLimit(
    res,
    userId,
    shiftDetails,
    bookNewShift = false,
    currentShiftDetailsSplit,
  ) {
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

        // check cutOffDaysForBookingAndCancelling
        var subSectionForBU = await SubSection.findOne({
          _id: shiftDetails.shiftId.businessUnitId,
        }).lean();
        console.log(
          'shiftDetails.shiftId.businessUnitId = ',
          shiftDetails.shiftId.businessUnitId,
        );
        if (!!subSectionForBU.cutOffDaysForBookingAndCancelling) {
          if (subSectionForBU.cutOffDaysForBookingAndCancelling > 0) {
            const a = shiftDetails.timeZone;
            const hr = a[1] + a[2];
            const min = a[3] + a[4];
            var min1 = parseInt(hr) * 60 + parseInt(min);
            var newStartTime = moment(shiftDetails.startTime).add(
              min1,
              'minutes',
            );
            var currTime = moment().add(min1, 'minutes');
            var shiftStartTime = moment(newStartTime).format('LL');
            var currentTime = moment(currTime).format('LL');
            console.log('shiftStartTime =', shiftStartTime);
            console.log('currentTime =', currentTime);

            var hoursLeftToStartShift = __.getDurationInHours(
              currentTime,
              shiftStartTime,
            );
            console.log('hoursLeftToStartShift =', hoursLeftToStartShift);
            var days = (hoursLeftToStartShift / 24).toFixed(0); // in days
            console.log('days =', days);

            var shiftExactStartTime = moment(newStartTime);
            var currentExactTime = moment();
            console.log('currentExactTime =', shiftExactStartTime);
            console.log('currentExactTime =', currentExactTime);
            var exactHoursLeftToStartShift = __.getDurationInHours(
              currentExactTime,
              shiftExactStartTime,
            );
            console.log(
              'exactHoursLeftToStartShift =',
              exactHoursLeftToStartShift,
            );

            if (
              subSectionForBU.cutOffDaysForBookingAndCancelling >
                parseInt(days) &&
              parseInt(exactHoursLeftToStartShift) > 0
            ) {
              console.log(
                'subSectionForBU.cutOffDaysForBookingAndCancelling = ',
                subSectionForBU.cutOffDaysForBookingAndCancelling,
              );
              console.log(
                'cutOffDaysForBookingAndCancelling is not met = parseInt(days) = ',
                parseInt(days),
              );

              return {
                limit: true,
                status: 0,
                message:
                  'You cannot book this shift as it falls within the cut-off time.',
              };
            }
          }
          console.log(
            'subSectionForBU.cutOffDaysForBookingAndCancelling is 0 or less than zero = ',
            subSectionForBU.cutOffDaysForBookingAndCancelling,
          );
        }

        // check if shift interval is require
        if (schemeDetails.isShiftInterval) {
          const intervalRequireTime = schemeDetails.shiftIntervalTotal - 1;
          const intervalResult = await ShiftHelper.checkShiftInterval(
            userId,
            shiftDetails.startTime,
            shiftDetails.endTime,
            intervalRequireTime,
          );
          var isSplitInterval = false;
          if (currentShiftDetailsSplit) {
            isSplitInterval = await ShiftHelper.checkShiftInterval(
              userId,
              currentShiftDetailsSplit.startTime,
              currentShiftDetailsSplit.endTime,
              intervalRequireTime,
            );
          }
          if (intervalResult || isSplitInterval) {
            return { isInterval: true };
          }
        }
        var isOt = false;
        if (
          schemeDetails.shiftSchemeType == 1 ||
          schemeDetails.shiftSchemeType == 3
        ) {
          let otDuration = 0;
          let normalDuration = 0;
          if (
            schemeDetails.shiftSetup.openShift &&
            schemeDetails.shiftSetup.openShift.normal
          ) {
            normalDuration = parseInt(shiftDetails.duration);
          } else {
            isOt = true;
            otDuration = parseInt(shiftDetails.duration);
          }
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
          let weekNumber = shiftDetails.shiftId.weekNumber;
          var date = new Date(shiftDetails.date),
            y = date.getFullYear(),
            m = date.getMonth();
          const weekDays = {
            monday: 6,
            tuesday: 5,
            wednesday: 4,
            thursday: 3,
            friday: 2,
            saturday: 1,
            sunday: 0,
          };
          const startWeek = moment(`'${y}'`)
            .add(weekNumber, 'weeks')
            .startOf('isoweek');
          var firstDay = new Date(y, m, 1);
          var lastDay = new Date(y, m + 1, 0);
          const weekDay = moment(lastDay).format('dddd');
          lastDay = moment(lastDay)
            .add(weekDays[weekDay.toLowerCase()], 'days')
            .format('YYYY-MM-DDT23:59:59.000+00:00');
          if (!moment(firstDay).isBefore(startWeek)) {
            var inverseOffset = moment(startWeek).utcOffset() * -1;
            firstDay = moment().utcOffset(inverseOffset);
          }
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
          let dailyOverall = dailyDuration;
          let weekLlyOverall = dailyDuration;
          let monthlyOverall = dailyDuration;
          console.log('data', weekLlyOverall);
          let isPresent = false;
          let shiftDuration = 0;
          let staffLimitPresentData = {};
          //res.json({data});
          if (!isOt) {
            data.forEach((item) => {
              // console.log('new Date(item.date)', new Date(item.date))
              if (new Date(item.date).getDate() == new Date(date).getDate()) {
                if (
                  item.shiftDetailId.toString() == shiftDetails._id.toString()
                ) {
                  shiftDuration = item.normalDuration;
                  isPresent = true;
                  staffLimitPresentData = item;
                }
                console.log('item.normalDuration', item.normalDuration);
                dailyDuration += item.normalDuration;
                dailyOverall += item.normalDuration;
                dailyOverall += item.otDuration;
              }
              if (new Date(item.date).getMonth() == new Date(date).getMonth()) {
                monthlyDuration += item.normalDuration;
                monthlyOverall += item.normalDuration;
                monthlyOverall += item.otDuration;
              }
              console.log('item.weekNo', item.weekNumber);
              console.log('sss', weekNumber);
              if (item.weekNumber == weekNumber) {
                weeklyDuration += item.normalDuration;
                weekLlyOverall += item.normalDuration;
                weekLlyOverall += item.otDuration;
              }
            });
          } else {
            // ot hr
            data.forEach((item) => {
              // console.log('new Date(item.date)', new Date(item.date))
              if (new Date(item.date).getDate() == new Date(date).getDate()) {
                if (
                  item.shiftDetailId.toString() == shiftDetails._id.toString()
                ) {
                  isPresent = true;
                  shiftDuration = item.otDuration + item.normalDuration;
                  staffLimitPresentData = item;
                }
                dailyDuration += item.otDuration;
                dailyOverall += item.otDuration;
                dailyOverall += item.normalDuration;
              }
              if (new Date(item.date).getMonth() == new Date(date).getMonth()) {
                monthlyDuration += item.otDuration;
                monthlyOverall += item.otDuration;
                monthlyOverall += item.normalDuration;
              }
              console.log('item.weekNo', item.weekNumber);
              console.log('sss', weekNumber);
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
          if (shiftDetails.isAssignShift) {
            isAllow = !schemeDetails.shiftSetup.limits.otHr.day.alert;
            disallow = !schemeDetails.shiftSetup.limits.otHr.day.disallow;
            // if(schemeDetails.shiftSchemeType == 3){
            //     disallow = !disallow;
            //     isAllow = !isAllow;
            // }
          }
          if (isOt) {
            dayLimit = schemeDetails.shiftSetup.limits.otHr.day;
            weekLimit = schemeDetails.shiftSetup.limits.otHr.week;
            monthLimit = schemeDetails.shiftSetup.limits.otHr.month;
          }
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
            if ((bookNewShift && shiftDuration == 0) || !bookNewShift) {
              const upppp = await StaffLimit.findByIdAndUpdate(
                staffLimitPresentData._id,
                {
                  $inc: {
                    normalDuration: normalDuration,
                    otDuration: otDuration,
                  },
                },
              );
            } else {
              return { message: 'Shift Already Booked', booked: true };
            }
            // console.log('upppp', upppp);
          }
          // }
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
              await this.reduceLimit(res, userId, shiftDetails);
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
              await this.reduceLimit(res, userId, shiftDetails);
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
              await this.reduceLimit(res, userId, shiftDetails);
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
              await this.reduceLimit(res, userId, shiftDetails);
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
              await this.reduceLimit(res, userId, shiftDetails);
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
              await this.reduceLimit(res, userId, shiftDetails);
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
    } catch (error) {
      __.out(res, 300, 'Something went wrong');
    }
  }

  async checkLimitBeforeBooking(req, res) {
    try {
      console.log('aaaayyyyy');
      if (req.body.from == 'makebooking') {
        return this.makeBookingNew(req, res);
      }
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
      if (!shiftDetails) {
        return res
          .status(201)
          .json({ limit: true, message: 'Shift Not found' });
      }
      var currentShiftDetailsSplit = null;
      if (req.body.isSplitShift) {
        currentShiftDetailsSplit = await ShiftDetails.findOne({
          _id: req.body.splitShiftDetailsId,
          status: 1,
          startTime: {
            $gt: moment().utc().format(),
          },
        }).lean();
        if (!currentShiftDetailsSplit) {
          return res
            .status(201)
            .json({ limit: true, message: 'Shift Not found' });
        }
        shiftDetails.duration += currentShiftDetailsSplit.duration;
      }
      // let schemeDetails = await User.findById(userId,{schemeId:1, _id:0}).populate([{
      //     path : 'schemeId'
      // }
      // ]);
      let limitData = {
        status: 1,
        limit: false,
      };
      limitData = await this.checkLimit(
        res,
        userId,
        shiftDetails,
        true,
        currentShiftDetailsSplit,
      );
      if (limitData && limitData.isInterval) {
        return __.out(
          res,
          300,
          'Minimum interval between shift is not met. Kindly choose another shift with required interval.',
        );
      }
      if (limitData.limit) {
        if (!limitData.status) {
          return res
            .status(201)
            .json({ limit: true, status: 0, message: limitData.message });
        } else {
          return res
            .status(201)
            .json({ limit: true, status: 1, message: limitData.message });
        }
      } else {
        if (req.body.from == 'makebooking' && !limitData.booked) {
          return this.makeBooking(req, res);
        } else if (req.body.from == 'makebooking' && limitData.booked) {
          return res.status(201).json({
            limit: true,
            message: 'You have already booked this shift.',
          });
        } else if (
          req.body.from.toLowerCase() == 'responseconfirmslotrequestaftercancel'
        ) {
          return this.responseConfirmSlotRequestAfterCancel(req, res);
        } else if (
          req.body.from.toLowerCase() == 'responseconfirmslotrequestafteradjust'
        ) {
          return this.responseConfirmSlotRequestAfterAdjust(req, res);
        } else if (
          req.body.from.toLowerCase() == 'responsefornewshiftrequest'
        ) {
          return this.responseForNewShiftRequest(req, res);
        } else {
          return res
            .status(201)
            .json({ limit: true, message: 'missing parameter from' });
        }
      }
    } catch (e) {
      console.log('================================================================================================ ', e)
      __.out(res, 500, 'Something went wrong');
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
      // let schemeDetails = await User.findOne({_id: userId}).populate([{
      //     path:'schemeId'
      // }]);
      const value = await this.reduceLimit(res, userId, shiftDetails);
      return res
        .status(201)
        .json({ success: true, message: 'Successfully updated', value });
    } catch (error) {
      __.out(res, 500, 'Something went wrong');
    }
  }
  async cancel(req, res) {
    try {
      console.log('req', req.body, !req.body.isSplitShift);
      if (req.body.isSplitShift) {
        return this.cancelSplitShift(req, res);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
      ]);
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      //req.user._id = mongoose.Types.ObjectId("5a99737036ab4f444b42718a");
      console.log('Inside else', req.user._id);
      var userId = req.user._id;
      if (!mongoose.Types.ObjectId.isValid(req.body.shiftDetailsId)) {
        return __.out(res, 300, 'Invalid Shift Id');
      }
      var shiftDetails = await ShiftDetails.findOne({
        _id: req.body.shiftDetailsId,
        status: 1,
        startTime: {
          $gt: moment().utc().format(),
        },
        $or: [
          {
            confirmedStaffs: req.user._id,
          },
          {
            backUpStaffs: req.user._id,
          },
        ],
      }).populate([
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
          populate: {
            path: 'flexiStaff',
            select: 'deviceToken',
          },
        },
        {
          path: 'shiftId',
          select: 'weekNumber businessUnitId',
        },
      ]);
      console.log('========== SHIFT DETAILS DATA ==============');
      // console.log('Is Requested shift ==> ', shiftDetails['isRequested']);
      if (!shiftDetails) {
        return __.out(res, 300, 'Invalid Shift / Shift Expired');
      }
      console.log(
        '< === Here Shift Details found === >',
        new Date().toDateString(),
      );

      // check cutOffDaysForBookingAndCancelling
      var subSectionForBU = await SubSection.findOne({
        _id: shiftDetails.shiftId.businessUnitId,
      }).lean();
      console.log(
        'shiftDetails.shiftId.businessUnitId = ',
        shiftDetails.shiftId.businessUnitId,
      );
      if (!!subSectionForBU.cutOffDaysForBookingAndCancelling) {
        if (subSectionForBU.cutOffDaysForBookingAndCancelling > 0) {
          const a = shiftDetails.timeZone;
          const hr = a[1] + a[2];
          const min = a[3] + a[4];
          var min1 = parseInt(hr) * 60 + parseInt(min);
          var newStartTime = moment(shiftDetails.startTime).add(
            min1,
            'minutes',
          );
          var currTime = moment().add(min1, 'minutes');
          var shiftStartTime = moment(newStartTime).format('LL');
          var currentTime = moment(currTime).format('LL');
          console.log('shiftStartTime =', shiftStartTime);
          console.log('currentTime =', currentTime);

          var hoursLeftToStartShift = __.getDurationInHours(
            currentTime,
            shiftStartTime,
          );
          console.log('hoursLeftToStartShift =', hoursLeftToStartShift);
          var days = (hoursLeftToStartShift / 24).toFixed(0); // in days
          console.log('days =', days);

          if (
            subSectionForBU.cutOffDaysForBookingAndCancelling > parseInt(days)
          ) {
            console.log(
              'subSectionForBU.cutOffDaysForBookingAndCancelling = ',
              subSectionForBU.cutOffDaysForBookingAndCancelling,
            );
            console.log(
              'cutOffDaysForBookingAndCancelling is not met = parseInt(days) = ',
              parseInt(days),
            );

            return __.out(
              res,
              300,
              'You cannot cancel this shift as it falls within the cut-off time.',
            );
          }
        }
        console.log(
          'subSectionForBU.cutOffDaysForBookingAndCancelling is 0 or less than zero = ',
          subSectionForBU.cutOffDaysForBookingAndCancelling,
        );
      }

      // reduce duration
      const redisBuId = shiftDetails.shiftId.businessUnitId;
      // Get Shift Main Details ( Shift Collection )
      let shiftMainDetails = await Shift.findOne({
        _id: shiftDetails.shiftId,
      })
        .populate({
          path: 'businessUnitId',
        })
        .lean();

      console.log('< === Here Shift found === >', new Date().toDateString());
      var shiftStartsWithInMinutes = (
        __.getDurationInHours(moment().utc().format(), shiftDetails.startTime) *
        60
      ).toFixed(2);
      var updateJson = {
        // $addToSet: {
        //     cancelledStaffs: req.user._id
        // }
        $push: {
          cancelledBy: {
            //   isMedicalReason: req.body.isMedicalReason,
            otherReason: req.body.otherReason,
            cancelledUserId: req.user._id,
            minutesToShiftStartTime: shiftStartsWithInMinutes,
            createdAt: moment().utc().format(),
          },
        },
      };
      if (
        shiftDetails.confirmedStaffs.some((x) => x == req.user._id.toString())
      ) {
        /*includes like in_array */ //const reduceLimitValue = await this.reduceLimit(userId, shiftDetails)
        console.log(
          '< === Here Calling for reducing limit === >',
          new Date().toDateString(),
        );
        // const reduceLimitValue = await this.reduceLimit(res, userId, shiftDetails)
        // console.log('reduceLimitValue', reduceLimitValue);
        /*set cancel user flag in applied staff  */
        console.log(
          '< === Here finding applied staff === >',
          new Date().toDateString(),
        );
        // var appliedStaffIdToRemove = await AppliedStaffs.findOneAndDelete({
        //     flexiStaff: req.user._id,
        //     shiftDetailsId: req.body.shiftDetailsId
        // }).lean();
        var [reduceLimitValue, appliedStaffIdToRemove] = await Promise.all([
          this.reduceLimit(res, userId, shiftDetails),
          AppliedStaffs.findOneAndRemove({
            flexiStaff: req.user._id,
            shiftDetailsId: req.body.shiftDetailsId,
          }).lean(),
        ]);
        if (!appliedStaffIdToRemove) {
          __.out(res, 300, 'Invalid Shift Id');
          return;
        }
        console.log(
          '< === Here Removing staff id === >',
          new Date().toDateString(),
        );

        updateJson.$pull = {
          confirmedStaffs: req.user._id,
          appliedStaffs: appliedStaffIdToRemove._id,
        };
        if (shiftDetails.isExtendedShift) {
          updateJson.$pull = {
            extendedStaff: { userId: req.user._id },
            confirmedStaffs: req.user._id,
            appliedStaffs: appliedStaffIdToRemove._id,
          };
        }
        // await AppliedStaffs.remove({
        //     _id: appliedStaffIdToRemove._id
        // });
        var clonedShiftDetails = _.cloneDeep(shiftDetails),
          deviceTokens = [];

        if (shiftDetails.appliedStaffs.length > 0) {
          var shiftStartsWithIn = __.getDurationInHours(
            moment().utc().format(),
            shiftDetails.startTime,
          );
          let shiftCancelHours = process.env.CANCELLATION_SHIFT_CHECK_HOURS;
          if (shiftMainDetails.businessUnitId.shiftCancelHours) {
            shiftCancelHours = shiftMainDetails.businessUnitId.shiftCancelHours;
          }

          if (Number(shiftStartsWithIn) >= Number(shiftCancelHours)) {
            __.log('am greater than 12 hr');
            /*if shift start time greater or equal to custom number then confirm the stand by staff who applied first*/
            // here apply limit logic
            var appliedStaffId = shiftDetails.appliedStaffs[0]._id;
            var firstStandByUserId =
              shiftDetails.appliedStaffs[0].flexiStaff._id;
            if (firstStandByUserId) {
              //const limitData = await this.checkLimit(firstStandByUserId,shiftDetails);
              // if(limitData.status == 1){
              updateJson.$pull.backUpStaffs =
                mongoose.Types.ObjectId(firstStandByUserId);
              deviceTokens = [
                shiftDetails.appliedStaffs[0].flexiStaff.deviceToken,
              ];
              await Promise.all([
                AppliedStaffs.update(
                  {
                    _id: appliedStaffId,
                  },
                  {
                    $set: {
                      status: 1,
                    },
                  },
                ),
                ShiftDetails.findOneAndUpdate(
                  {
                    _id: req.body.shiftDetailsId,
                  },
                  {
                    $addToSet: {
                      confirmedStaffs: firstStandByUserId,
                    },
                  },
                ),
              ]);
              // await AppliedStaffs.update({
              //     _id: appliedStaffId
              // }, {
              //     $set: {
              //         status: 1,
              //     }
              // });

              // await ShiftDetails.findOneAndUpdate({
              //     _id: req.body.shiftDetailsId
              // }, {
              //     $addToSet: {
              //         confirmedStaffs: firstStandByUserId
              //     }
              // });

              /*push notification for newly confirmed user */
              if (deviceTokens && deviceTokens.length > 0) {
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
                deviceTokens = [];
              }
            }
          } else {
            /*if shift start time less than custom number then send notification to all standby staffs to confirm */
            __.log('am lesser than 12 hr');
            // no need to check limit as confirmation is required
            updateJson.$set = {
              isShortTimeCancel: 1,
              shortTimeRequestRecjectedFlexistaffs: [],
            };

            deviceTokens = shiftDetails.appliedStaffs.map(
              (a) => a.flexiStaff.deviceToken,
            );
            if (deviceTokens && deviceTokens.length > 0) {
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
              deviceTokens = [];
            }
          }
        } else {
          __.log('clonedShiftDetails', clonedShiftDetails);
          // no need to check limit as confirmation is required
          let pageSettingData = await PageSettingModel.findOne(
            {
              companyId: req.user.companyId,
              status: 1,
            },
            { opsGroup: 1 },
          );
          const tierType = pageSettingData.opsGroup.tierType;
          this.matchingStaffs(clonedShiftDetails, res, tierType)
            .then((deviceTokensR) => {
              deviceTokens = deviceTokensR;
              if (deviceTokens && deviceTokens.length > 0) {
                var pushData = {
                    title: 'Immediate shift for Booking!',
                    body: `Shift is available for booking`,
                    bodyText: `Standby shift on XXX to XXX is available for booking`,
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
                deviceTokens = [];
              }
            })
            .catch((deviceTokensError) => {
              console.log('deviceTokensError', deviceTokensError);
            });
        }
        console.log(
          '========================== UPDATING SHIFT DETAILS  ===============',
        );
        console.log(updateJson);
        console.log(
          '================================================================',
        );
        await ShiftDetails.findOneAndUpdate(
          { _id: req.body.shiftDetailsId },
          updateJson,
        );
        // this.updateRedis(redisBuId)
        //   .then((uRedisResult) => {
        //     console.log('updateRedis', uRedisResult);
        //   })
        //   .catch((eRedisResult) => {
        //     console.log('updateRedis error', eRedisResult);
        //   });
        __.out(res, 201, 'Booking (confirmed) has been cancelled successfully');
      } else if (
        shiftDetails.backUpStaffs.some((x) => x == req.user._id.toString())
      ) {
        /*if backup staff us there (take the one who applied first by date) */
        // no need to check limit as we are cancelling standby
        /*set cancel user flag in applied staff  */
        var [appliedStaffIdToRemove] = await Promise.all([
          AppliedStaffs.findOneAndRemove({
            flexiStaff: req.user._id,
            shiftDetailsId: req.body.shiftDetailsId,
          }).lean(),
          this.reduceLimit(res, userId, shiftDetails),
        ]);
        updateJson.$pull = {
          backUpStaffs: req.user._id,
          appliedStaffs: appliedStaffIdToRemove._id,
        };
        await ShiftDetails.findOneAndUpdate(
          { _id: req.body.shiftDetailsId },
          updateJson,
        );
        // this.updateRedis(redisBuId)
        //   .then((uRedisResult) => {
        //     console.log('updateRedis', uRedisResult);
        //   })
        //   .catch((eRedisResult) => {
        //     console.log('updateRedis error', eRedisResult);
        //   });
        return __.out(
          res,
          201,
          'Booking (standby) has been cancelled successfully',
        );
      } else {
        /*user id not found either in confirmed staff or backuped staff */
        return __.out(res, 300, 'Something went wrong');
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async reduceLimit(res, userId, shiftDetails, from = 1) {
    try {
      console.log(
        '< === Here Reduce limit found === >',
        new Date().toDateString(),
      );
      console.log('Is Requested shift ==> ', shiftDetails['isRequested']);
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
        normalDuration = 0;
      } else {
        otDuration = 0;
      }
      console.log('aaaaa', normalDuration, otDuration);
      console.log('shiftDetails._id', shiftDetails._id);
      // console.log(user)
      let value;
      if (shiftDetails['isRequested']) {
        value = await StaffLimit.findOneAndUpdate(
          { userId, childShiftId: shiftDetails._id },
          { normalDuration: normalDuration, otDuration: otDuration },
        );
      } else
        value = await StaffLimit.findOneAndUpdate(
          { userId: userId, shiftDetailId: shiftDetails._id },
          { normalDuration: normalDuration, otDuration: otDuration },
        );

      console.log(
        '< === STAFF LIMIT UPDATION COMPLETE === >',
        new Date().toDateString(),
        userId,
        shiftDetails._id,
      );
      console.log('valuevalue', value);
      return value;
    } catch (error) {
      __.log(error);
      __.out(error, 500);
    }
  }
  async cancelSplitShift(req, res) {
    try {
      console.log('here');
      let requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'isMedicalReason',
        'otherReason',
      ]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        if (
          mongoose.Types.ObjectId.isValid(req.body.shiftDetailsId) &&
          mongoose.Types.ObjectId.isValid(req.body.splitShiftDetailsId)
        ) {
          var userId = req.user._id;
          var shiftDetails = await ShiftDetails.findOne({
            _id: req.body.shiftDetailsId,
            status: 1,
            startTime: {
              $gt: moment().utc().format(),
            },
            $or: [
              {
                confirmedStaffs: req.user._id,
              },
              {
                backUpStaffs: req.user._id,
              },
            ],
          })
            // .populate({
            //   path: 'appliedStaffs',
            //   match: {
            //     status: 2,
            //   },
            //   options: {
            //     sort: {
            //       createdAt: 1,
            //     },
            //   },
            //   populate: {
            //     path: 'flexiStaff',
            //     select: 'deviceToken',
            //   },
            // })
            .populate([
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
                populate: {
                  path: 'flexiStaff',
                  select: 'deviceToken',
                },
              },
              {
                path: 'shiftId',
                select: 'weekNumber businessUnitId',
              },
            ])
            .lean();

          var shiftDetailsSplit = await ShiftDetails.findOne({
            _id: req.body.splitShiftDetailsId,
            status: 1,
            startTime: {
              $gt: moment().utc().format(),
            },
            $or: [
              {
                confirmedStaffs: req.user._id,
              },
              {
                backUpStaffs: req.user._id,
              },
            ],
          })
            .populate({
              path: 'appliedStaffs',
              match: {
                status: 2,
              },
              options: {
                sort: {
                  createdAt: 1,
                },
              },
              populate: {
                path: 'flexiStaff',
                select: 'deviceToken',
              },
            })
            .lean();

          if (shiftDetails && shiftDetailsSplit) {
            // check cutOffDaysForBookingAndCancelling
            var subSectionForBU = await SubSection.findOne({
              _id: shiftDetails.shiftId.businessUnitId,
            }).lean();
            console.log(
              'shiftDetails.shiftId.businessUnitId = ',
              shiftDetails.shiftId.businessUnitId,
            );
            if (!!subSectionForBU.cutOffDaysForBookingAndCancelling) {
              if (subSectionForBU.cutOffDaysForBookingAndCancelling > 0) {
                const a = shiftDetails.timeZone;
                const hr = a[1] + a[2];
                const min = a[3] + a[4];
                var min1 = parseInt(hr) * 60 + parseInt(min);
                var newStartTime = moment(shiftDetails.startTime).add(
                  min1,
                  'minutes',
                );
                var currTime = moment().add(min1, 'minutes');
                var shiftStartTime = moment(newStartTime).format('LL');
                var currentTime = moment(currTime).format('LL');
                console.log('shiftStartTime =', shiftStartTime);
                console.log('currentTime =', currentTime);

                var hoursLeftToStartShift = __.getDurationInHours(
                  currentTime,
                  shiftStartTime,
                );
                console.log('hoursLeftToStartShift =', hoursLeftToStartShift);
                var days = (hoursLeftToStartShift / 24).toFixed(0); // in days
                console.log('days =', days);

                if (
                  subSectionForBU.cutOffDaysForBookingAndCancelling >
                  parseInt(days)
                ) {
                  console.log(
                    'subSectionForBU.cutOffDaysForBookingAndCancelling = ',
                    subSectionForBU.cutOffDaysForBookingAndCancelling,
                  );
                  console.log(
                    'cutOffDaysForBookingAndCancelling is not met = parseInt(days) = ',
                    parseInt(days),
                  );

                  return __.out(
                    res,
                    300,
                    'You cannot cancel this shift as it falls within the cut-off time.',
                  );
                }
              }
              console.log(
                'subSectionForBU.cutOffDaysForBookingAndCancelling is 0 or less than zero = ',
                subSectionForBU.cutOffDaysForBookingAndCancelling,
              );
            }

            // Get Shift Main Details ( Shift Collection )
            shiftDetails.duration += shiftDetailsSplit.duration;
            let shiftMainDetails = await Shift.findOne({
              _id: shiftDetails.shiftId,
            })
              .populate({
                path: 'businessUnitId',
              })
              .lean();
            __.log(shiftMainDetails, 'shiftDetails.shiftId');

            var shiftStartsWithInMinutes = await (
              __.getDurationInHours(
                moment().utc().format(),
                shiftDetails.startTime,
              ) * 60
            ).toFixed(2);

            var updateJson = {
              // $addToSet: {
              //     cancelledStaffs: req.user._id
              // }
              $push: {
                cancelledBy: {
                  //  isMedicalReason: req.body.isMedicalReason,
                  otherReason: req.body.otherReason,
                  cancelledUserId: req.user._id,
                  minutesToShiftStartTime: shiftStartsWithInMinutes,
                  createdAt: moment().utc().format(),
                },
              },
            };
            var updateJsonSplit = {
              // $addToSet: {
              //     cancelledStaffs: req.user._id
              // }
              $push: {
                cancelledBy: {
                  isMedicalReason: req.body.isMedicalReason,
                  otherReason: req.body.otherReason,
                  cancelledUserId: req.user._id,
                  minutesToShiftStartTime: shiftStartsWithInMinutes,
                  createdAt: moment().utc().format(),
                },
              },
            };
            if (
              shiftDetails.confirmedStaffs.some(
                (x) => x == req.user._id.toString(),
              )
            ) {
              /*includes like in_array */ /*set cancel user flag in applied staff  */
              await this.reduceLimit(res, userId, shiftDetails);
              var appliedStaffIdToRemove = await AppliedStaffs.findOne({
                flexiStaff: req.user._id,
                shiftDetailsId: req.body.shiftDetailsId,
              }).lean();
              var appliedStaffIdToRemoveSplit = await AppliedStaffs.findOne({
                flexiStaff: req.user._id,
                shiftDetailsId: req.body.splitShiftDetailsId,
              }).lean();
              console.log(
                '==================== Applied staff Id To Remove ======',
              );
              console.log(appliedStaffIdToRemove);
              console.log('====================================');
              console.log(appliedStaffIdToRemoveSplit);
              console.log(
                '=====================================================',
              );
              if (appliedStaffIdToRemove && appliedStaffIdToRemoveSplit) {
                updateJson.$pull = {
                  confirmedStaffs: req.user._id,
                  appliedStaffs: appliedStaffIdToRemove._id,
                };
                updateJsonSplit.$pull = {
                  confirmedStaffs: req.user._id,
                  appliedStaffs: appliedStaffIdToRemoveSplit._id,
                };
                await AppliedStaffs.remove({
                  _id: appliedStaffIdToRemove._id,
                });
                await AppliedStaffs.remove({
                  _id: appliedStaffIdToRemoveSplit._id,
                });
              } else {
                __.out(res, 300, 'Invalid Shift Id');
                return;
              }
              var startTimeForPush = moment(shiftDetails.startTime).format(
                'DD MMM, HHmm',
              );
              var endTimeForPush = moment(shiftDetails.endTime).format(
                'DD MMM, HHmm',
              );
              var clonedShiftDetails = _.cloneDeep(shiftDetails),
                deviceTokens = [];

              if (shiftDetails.appliedStaffs.length > 0) {
                var shiftStartsWithIn = __.getDurationInHours(
                  moment().utc().format(),
                  shiftDetails.startTime,
                );
                let shiftCancelHours =
                  process.env.CANCELLATION_SHIFT_CHECK_HOURS;
                if (shiftMainDetails.businessUnitId.shiftCancelHours) {
                  shiftCancelHours =
                    shiftMainDetails.businessUnitId.shiftCancelHours;
                }

                if (Number(shiftStartsWithIn) >= Number(shiftCancelHours)) {
                  __.log('am greater than 12 hr');
                  /*if shift start time greater or equal to custom number then confirm the stand by staff who applied first*/
                  var appliedStaffId = shiftDetails.appliedStaffs[0]._id;
                  var appliedStaffIdSplit =
                    shiftDetailsSplit.appliedStaffs[0]._id;
                  var firstStandByUserId =
                    shiftDetails.appliedStaffs[0].flexiStaff._id;
                  var firstStandByUserIdSplit =
                    shiftDetailsSplit.appliedStaffs[0].flexiStaff._id;
                  if (firstStandByUserId) {
                    updateJson.$pull.backUpStaffs =
                      mongoose.Types.ObjectId(firstStandByUserId);
                    updateJsonSplit.$pull.backUpStaffs =
                      mongoose.Types.ObjectId(firstStandByUserIdSplit);
                    deviceTokens = [
                      shiftDetails.appliedStaffs[0].flexiStaff.deviceToken,
                    ];
                    await AppliedStaffs.update(
                      {
                        _id: appliedStaffId,
                      },
                      {
                        $set: {
                          status: 1,
                        },
                      },
                    );
                    await AppliedStaffs.update(
                      {
                        _id: appliedStaffIdSplit,
                      },
                      {
                        $set: {
                          status: 1,
                        },
                      },
                    );

                    /*seperate update operation since we cant push and pull for same property at same time */
                    await ShiftDetails.update(
                      {
                        _id: req.body.shiftDetailsId,
                      },
                      {
                        $addToSet: {
                          confirmedStaffs: firstStandByUserId,
                        },
                      },
                    );
                    await ShiftDetails.update(
                      {
                        _id: req.body.splitShiftDetailsId,
                      },
                      {
                        $addToSet: {
                          confirmedStaffs: firstStandByUserIdSplit,
                        },
                      },
                    );

                    /*push notification for newly confirmed user */
                    if (deviceTokens && deviceTokens.length > 0) {
                      var pushData = {
                          title: 'You are activated!',
                          body: `Standby Split shift has been activated`,
                          bodyText: `Standby shift on XXX to XXX has been activated`,
                          bodyTime: [
                            shiftDetails.startTimeInSeconds,
                            shiftDetailsSplit.endTimeInSeconds,
                          ],
                          bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                        },
                        collapseKey =
                          req.body
                            .shiftDetailsId; /*unique id for this particular shift */
                      FCM.push(deviceTokens, pushData, collapseKey);
                      deviceTokens = [];
                    }
                  }
                } else {
                  /*if shift start time less than custom number then send notification to all standby staffs to confirm */
                  __.log('am lesser than 12 hr');
                  updateJson.$set = {
                    isShortTimeCancel: 1,
                    shortTimeRequestRecjectedFlexistaffs: [],
                  };
                  updateJsonSplit.$set = {
                    isShortTimeCancel: 1,
                    shortTimeRequestRecjectedFlexistaffs: [],
                  };

                  deviceTokens = shiftDetails.appliedStaffs.map(
                    (a) => a.flexiStaff.deviceToken,
                  );
                  if (deviceTokens && deviceTokens.length > 0) {
                    var pushData = {
                        title: 'Confirm your standby split shift now!',
                        body: `Standby Split shift is available for confirmation`,
                        bodyText: `Standby split shift on XXX to XXX is available for confirmation`,
                        bodyTime: [
                          shiftDetails.startTimeInSeconds,
                          shiftDetailsSplit.endTimeInSeconds,
                        ],
                        bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                      },
                      collapseKey =
                        req.body
                          .shiftDetailsId; /*unique id for this particular shift */
                    FCM.push(deviceTokens, pushData, collapseKey);
                    deviceTokens = [];
                  }
                }
              } else {
                __.log('clonedShiftDetails', clonedShiftDetails);
                let pageSettingData = await PageSettingModel.findOne(
                  {
                    companyId: req.user.companyId,
                    status: 1,
                  },
                  { opsGroup: 1 },
                );
                const tierType = pageSettingData.opsGroup.tierType;
                deviceTokens = await this.matchingStaffs(
                  clonedShiftDetails,
                  res,
                  tierType,
                );
                if (deviceTokens && deviceTokens.length > 0) {
                  var pushData = {
                      title: 'Immediate shift for Booking!',
                      body: `Shift is available for booking`,
                      bodyText: `Standby shift on XXX to XXX is available for booking`,
                      bodyTime: [
                        shiftDetails.startTimeInSeconds,
                        shiftDetails.endTimeInSeconds,
                      ],
                      bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                    },
                    collapseKey =
                      req.body
                        .shiftDetailsId; /*unique id for this particular shift */
                  await FCM.push(deviceTokens, pushData, collapseKey);
                  deviceTokens = [];
                }
              }
              await ShiftDetails.update(
                {
                  _id: req.body.shiftDetailsId,
                },
                updateJson,
              );
              await ShiftDetails.update(
                {
                  _id: req.body.splitShiftDetailsId,
                },
                updateJsonSplit,
              );
              // console.log('updateJsonupdateJsonupdateJson', updateJson);
              // console.log('updateJsonSplit', updateJsonSplit);
              __.out(
                res,
                201,
                'Booking (confirmed) has been cancelled successfully',
              );
            } else if (
              shiftDetails.backUpStaffs.some(
                (x) => x == req.user._id.toString(),
              )
            ) {
              /*if backup staff us there (take the one who applied first by date) */
              /*set cancel user flag in applied staff  */
              await this.reduceLimit(res, userId, shiftDetails);
              var appliedStaffIdToRemove = await AppliedStaffs.findOne({
                flexiStaff: req.user._id,
                shiftDetailsId: req.body.shiftDetailsId,
              }).lean();
              var appliedStaffIdToRemoveSplit = await AppliedStaffs.findOne({
                flexiStaff: req.user._id,
                shiftDetailsId: req.body.splitShiftDetailsId,
              }).lean();

              updateJson.$pull = {
                backUpStaffs: req.user._id,
                appliedStaffs: appliedStaffIdToRemove._id,
              };
              updateJsonSplit.$pull = {
                backUpStaffs: req.user._id,
                appliedStaffs: appliedStaffIdToRemoveSplit._id,
              };
              await AppliedStaffs.remove({
                _id: appliedStaffIdToRemove._id,
              });
              await AppliedStaffs.remove({
                _id: appliedStaffIdToRemoveSplit._id,
              });
              await ShiftDetails.update(
                {
                  _id: req.body.shiftDetailsId,
                },
                updateJson,
              );
              await ShiftDetails.update(
                {
                  _id: req.body.splitShiftDetailsId,
                },
                updateJsonSplit,
              );
              //console.log('appliedStaffIdToRemoveSplit', updateJson);
              //console.log('appliedStaffIdToRemoveSplit split', updateJsonSplit);
              __.out(
                res,
                201,
                'Booking (standby) has been cancelled successfully',
              );
            } else {
              /*user id not found either in confirmed staff or backuped staff */
              __.out(res, 300, 'Something went wrong');
            }
          } else {
            __.out(res, 300, 'Invalid Shift / Shift Expired');
          }
        } else {
          __.out(res, 300, 'Invalid Shift Id');
        }
      }
    } catch (e) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async responseConfirmSlotRequestAfterCancel(req, res) {
    try {
      __.log('responseConfirmSlotRequestAfterCancel api', req.body);
      let requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'isAccepted',
      ]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        const userId = req.user._id;
        var shiftDetails = await ShiftDetails.findOne({
          _id: req.body.shiftDetailsId,
          status: 1,
          startTime: {
            $gt: moment().utc().format(),
          },
          backUpStaffs: req.user._id,
        })
          .populate([
            {
              path: 'shiftId',
              select: 'businessUnitId weekNumber',
            },
          ])
          .lean();

        if (shiftDetails) {
          const redisBuId = shiftDetails.shiftId.businessUnitId;
          if (req.body.isAccepted == 1) {
            if (
              shiftDetails.isShortTimeCancel == 1 &&
              shiftDetails.staffNeedCount > shiftDetails.confirmedStaffs.length
            ) {
              var limitData = {
                status: 1,
                isLimit: false,
              };
              //limitData = await this.checkLimit(userId,shiftDetails);
              if (limitData.status == 1) {
                let limit = shiftDetails.isLimit;
                if (limitData.limit) {
                  limit = true;
                }
                var updateJson = {
                  $addToSet: {
                    confirmedStaffs: req.user._id,
                  },
                  $pull: {
                    backUpStaffs: req.user._id,
                  },
                  // ,
                  // $set:{
                  //     isLimit: limit
                  // }
                };
                // ,
                // updateJsonPull = {
                //     $pull: {
                //         backUpStaffs: req.user._id
                //     },
                // };

                if (
                  shiftDetails.staffNeedCount ==
                  shiftDetails.confirmedStaffs.length + 1
                ) {
                  /*check after this update confirmed staffs slot was filled or not. if  so set isShortTimeCancel =0 */
                  updateJson.$set = {
                    isShortTimeCancel: 0,
                  };
                }

                // await ShiftDetails.update({
                //     _id: req.body.shiftDetailsId
                // }, updateJsonPull);

                await ShiftDetails.update(
                  {
                    _id: req.body.shiftDetailsId,
                  },
                  updateJson,
                );

                await AppliedStaffs.update(
                  {
                    flexiStaff: req.user._id,
                    shiftDetailsId: req.body.shiftDetailsId,
                  },
                  {
                    $set: {
                      status: 1,
                      /*change the status to confirmed */
                      isLimit: limit,
                      message: limitData.message,
                    },
                  },
                );
                __.out(res, 201, 'Booked in confirmed slot ');
                // await this.updateRedis(redisBuId); //+limitData.message
              } else {
                __.out(res, 300, limitData.message);
                // await this.updateRedis(redisBuId);
              }
            } else {
              this.reduceLimit(res, userId, shiftDetails);
              __.out(res, 300, 'This confirmed slot has already been filled');
              // await this.updateRedis(redisBuId);
            }
          } else {
            /*push flexistaff id who rejects the request */
            await ShiftDetails.update(
              {
                _id: req.body.shiftDetailsId,
              },
              {
                $addToSet: {
                  shortTimeRequestRecjectedFlexistaffs: req.user._id,
                },
              },
            );
            __.out(res, 201, 'Request has been rejected successfully');
            // await this.updateRedis(redisBuId);
          }
        } else {
          // checked ******
          this.reduceLimit(res, userId, shiftDetails);
          __.out(res, 300, 'Invalid shift / Shift expired');
        }
      }
    } catch (err) {
      __.log(err);
      try {
        await this.reduceLimit(res, req.user._id, req.body.shiftDetailsId, 0);
      } catch (error) {
        __.out(res, 500);
      }
      __.out(res, 500);
    }
  }
  async responseConfirmSlotRequestAfterAdjust(req, res) {
    try {
      let requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'isAccepted',
      ]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        var userId = req.user._id;
        var shiftDetails = await ShiftDetails.findOne({
          _id: req.body.shiftDetailsId,
          status: 1,
          startTime: {
            $gt: moment().utc().format(),
          },
          backUpStaffs: req.user._id,
        })
          .populate([
            {
              path: 'shiftId',
              select: 'businessUnitId weekNumber',
            },
          ])
          .lean();

        if (shiftDetails) {
          if (req.body.isAccepted == 1) {
            if (
              shiftDetails.isShortTimeAdjust == 1 &&
              shiftDetails.staffNeedCount > shiftDetails.confirmedStaffs.length
            ) {
              var limitData = {
                status: 1,
                isLimit: false,
              };
              // limitData = await this.checkLimit(userId,shiftDetails);
              let limit = shiftDetails.isLimit;
              if (limitData.limit) {
                limit = true;
              }
              if (limitData.status == 1) {
                var updateJson = {
                  $addToSet: {
                    confirmedStaffs: req.user._id,
                  },
                  $pull: {
                    backUpStaffs: req.user._id,
                  },
                };
                // ,
                // updateJsonPull = {
                //     $pull: {
                //         backUpStaffs: req.user._id
                //     }
                // };

                if (
                  shiftDetails.staffNeedCount ==
                  shiftDetails.confirmedStaffs.length + 1
                ) {
                  /*check after this update confirmed staffs slot was filled or not. if  so set isShortTimeCancel =0 */
                  updateJson.$set = {
                    isShortTimeAdjust: 0,
                  };
                }

                await ShiftDetails.update(
                  {
                    _id: req.body.shiftDetailsId,
                  },
                  updateJson,
                );

                // await ShiftDetails.update({
                //     _id: req.body.shiftDetailsId
                // }, updateJsonPull);

                await AppliedStaffs.update(
                  {
                    flexiStaff: req.user._id,
                    shiftDetailsId: req.body.shiftDetailsId,
                  },
                  {
                    $set: {
                      status: 1 /*change the status to confirmed */,
                    },
                  },
                );
                __.out(res, 201, 'Booked in confirmed slot');
              } else {
                __.out(res, 300, limitData.message);
              }
            } else {
              await this.reduceLimit(res, userId, shiftDetails);
              __.out(res, 300, 'This confirmed slot has already been filled');
            }
          } else {
            /*push flexistaff id who rejects the request */
            await ShiftDetails.update(
              {
                _id: req.body.shiftDetailsId,
              },
              {
                $addToSet: {
                  shortTimeAdjustRequestRecjectedFlexistaffs: req.user._id,
                },
              },
            );
            __.out(res, 201, 'Request has been rejected successfully');
          }
        } else {
          // checked ******
          if (req.body.isAccepted == 1) {
            await this.reduceLimit(res, userId, shiftDetails);
          }
          __.out(res, 300, 'Invalid shift / Shift expired');
        }
      }
    } catch (err) {
      __.log(err);
      if (req.body.isAccepted == 1) {
        try {
          await this.reduceLimit(res, req.user._id, req.body.shiftDetailsId, 0);
        } catch (error) {
          __.out(res, 500);
        }
      }
      __.out(res, 500);
    }
  }
  async responseForNewShiftRequest(req, res) {
    try {
      let requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'isAccepted',
      ]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        var userId = req.user._id;
        var shiftDetails = await ShiftDetails.findOne({
          _id: req.body.shiftDetailsId,
          dedicatedRequestTo: req.user._id,
          status: 0,
          startTime: {
            $gt: moment().utc().format(),
          },
        })
          .populate({
            path: 'shiftId',
            select:
              'plannedBy businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
            populate: {
              path: 'plannedBy',
              select: 'name deviceToken',
            },
          })
          .lean();

        if (!shiftDetails) {
          if (req.body.isAccepted == 1) {
            this.reduceLimit(res, userId, shiftDetails);
          }
          return __.out(res, 300, 'Shift Expired.');
        } else {
          var userDeviceToken = false;
          let shiftIdforMetaData = shiftDetails.shiftId;
          if (shiftDetails) {
            const redisBuId = shiftDetails.shiftId.businessUnitId;
            if (
              shiftDetails.shiftId &&
              shiftDetails.shiftId.plannedBy &&
              shiftDetails.shiftId.plannedBy.deviceToken &&
              shiftDetails.shiftId.plannedBy.deviceToken != ''
            ) {
              userDeviceToken = shiftDetails.shiftId.plannedBy.deviceToken;
              __.log(
                'userdevixeToken',
                shiftDetails.shiftId.plannedBy,
                userDeviceToken,
              );

              var dateForPush = shiftDetails.startTimeInSeconds;
            } else __.log('userdevice toekn else called ');

            if (req.body.isAccepted == 1) {
              /*accept the request */
              var data = {
                startTime: shiftDetails.startTime,
                endTime: shiftDetails.endTime,
                flexiStaffId: req.user._id,
                shiftDetailsId: shiftDetails.referenceShiftDetailsId,
              };
              var checkStaffAvailableInGivenTime =
                await this.checkStaffAvailableInGivenTime(data, res);
              if (checkStaffAvailableInGivenTime) {
                var limitData = {
                  status: 1,
                  isLimit: false,
                };
                // limitData = await this.checkLimit(userId,shiftDetails);
                let limit = shiftDetails.isLimit;
                if (limitData.limit) {
                  limit = true;
                }
                if (limitData.status == 1) {
                  var appliedStaffDetails = await AppliedStaffs.findOne({
                    shiftDetailsId: shiftDetails.referenceShiftDetailsId,
                    flexiStaff: req.user._id,
                  });

                  if (appliedStaffDetails) {
                    appliedStaffDetails.shiftDetailsId = shiftDetails._id;
                    await appliedStaffDetails.save();
                    await ShiftDetails.update(
                      {
                        _id: req.body.shiftDetailsId,
                      },
                      {
                        $addToSet: {
                          confirmedStaffs: req.user._id,
                          appliedStaffs: appliedStaffDetails._id,
                        },
                        $set: {
                          status: 1,
                        },
                      },
                    );

                    /*remove the user from existing shift */
                    await ShiftDetails.update(
                      {
                        _id: shiftDetails.referenceShiftDetailsId,
                      },
                      {
                        $inc: {
                          staffNeedCount: -1,
                          totalStaffNeedCount: -1,
                        },
                        $pull: {
                          confirmedStaffs: req.user._id,
                          appliedStaffs: appliedStaffDetails._id,
                        },
                      },
                    );
                    /*push new shift details id in shift document */
                    let updatedShift = await Shift.findOneAndUpdate(
                      {
                        _id: shiftDetails.shiftId,
                      },
                      {
                        $addToSet: {
                          shiftDetails: req.body.shiftDetailsId,
                        },
                      },
                      {
                        new: true,
                      },
                    ).lean();

                    if (userDeviceToken) {
                      var pushData = {
                          title: 'Accepted Shift Change!',
                          body: `${req.user.name} accepted shift change`,
                          bodyText: `${req.user.name} accepted shift change for XXX shift`,
                          bodyTime: [dateForPush],
                          bodyTimeFormat: ['dd MMM'],
                        },
                        collapseKey =
                          req.body
                            .shiftDetailsId; /*unique id for this particular shift */
                      FCM.push([userDeviceToken], pushData, collapseKey);
                    }

                    /* Add to log */

                    let logMetaData = await Shift.findOne({
                      _id: shiftIdforMetaData,
                    })
                      .select(
                        'businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
                      )
                      .lean();

                    let statusLogData = {
                      userId: req.user._id,
                      status: 7,
                      businessUnitId: logMetaData.businessUnitId,
                      weekNumber: logMetaData.weekNumber,
                      weekRangeStartsAt: logMetaData.weekRangeStartsAt,
                      weekRangeEndsAt: logMetaData.weekRangeEndsAt,
                      shiftId: shiftIdforMetaData,
                      acceptedShift: req.body.shiftDetailsId,
                      existingShift: shiftDetails.referenceShiftDetailsId,
                    };

                    await shiftLogController.create(statusLogData, res);

                    // this.updateRedis(redisBuId);
                    __.out(
                      res,
                      201,
                      'Request shift has been accepted successfully',
                    );
                  } else {
                    if (req.body.isAccepted == 1) {
                      this.reduceLimit(res, userId, shiftDetails);
                    }
                    //this.reduceLimit(userId, shiftDetails);
                    __.out(res, 300, 'Something went wrong');
                  }
                } else {
                  __.out(res, 300, limitData.message);
                }
              } else {
                if (req.body.isAccepted == 1) {
                  this.reduceLimit(res, userId, shiftDetails);
                }
                // this.reduceLimit(userId, shiftDetails);
                // this.updateRedis(redisBuId);
                __.out(res, 300, 'You have another shift at the same time.');
              }
            } else {
              /*reject the request */
              let updatedShift = await ShiftDetails.findOneAndUpdate(
                {
                  _id: req.body.shiftDetailsId,
                },
                {
                  $set: {
                    status: 2,
                  },
                },
                {
                  new: true,
                },
              )
                .populate({
                  path: 'shiftId',
                  select: 'businessUnitId',
                })
                .lean();

              if (userDeviceToken) {
                var pushData = {
                    title: 'Rejected Shift Change!',
                    body: `${req.user.name} rejected shift change`,
                    bodyText: `${req.user.name} rejected shift change for XXX shift`,
                    bodyTime: [dateForPush],
                    bodyTimeFormat: ['dd MMM'],
                  },
                  collapseKey =
                    req.body
                      .shiftDetailsId; /*unique id for this particular shift */
                FCM.push([userDeviceToken], pushData, collapseKey);
              }
              /* Add to log */

              let logMetaData = await Shift.findOne({
                _id: shiftIdforMetaData,
              })
                .select(
                  'businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
                )
                .lean();

              let statusLogData = {
                userId: req.user._id,
                status: 8,
                businessUnitId: logMetaData.businessUnitId,
                weekNumber: logMetaData.weekNumber,
                weekRangeStartsAt: logMetaData.weekRangeStartsAt,
                weekRangeEndsAt: logMetaData.weekRangeEndsAt,
                shiftId: shiftIdforMetaData,
                acceptedShift: req.body.shiftDetailsId,
                existingShift: shiftDetails.referenceShiftDetailsId,
              };

              await shiftLogController.create(statusLogData, res);
              // this.updateRedis(redisBuId);
              __.out(res, 201, 'Request shift has been rejected successfully');
            }
          } else {
            // checked ******
            //this.reduceLimit(userId, shiftDetails);
            if (req.body.isAccepted == 1) {
              this.reduceLimit(res, userId, shiftDetails);
            }
            __.out(res, 300, 'Invalid shift / Shift expired');
          }
        }
      }
    } catch (err) {
      __.log(err);
      if (req.body.isAccepted == 1) {
        try {
          await this.reduceLimit(res, req.user._id, req.body.shiftDetailsId, 0);
        } catch (error) {
          __.out(res, 500);
        }
      }
      __.out(res, 500);
    }
  }
  async checkStaffAvailableInGivenTime(data, res) {
    try {
      var where = {
        $or: [
          {
            _id: { $ne: data.shiftId },
            confirmedStaffs: data.flexiStaffId,
            startTime: {
              $lt: moment(data.endTime).utc().format(),
            },
            endTime: {
              $gt: moment(data.startTime).utc().format(),
            },
            status: 1,
          },
          {
            _id: { $ne: data.shiftId },
            backUpStaffs: data.flexiStaffId,
            startTime: {
              $lt: moment(data.endTime).utc().format(),
            },
            endTime: {
              $gt: moment(data.startTime).utc().format(),
            },
            status: 1,
          },
        ],
      };
      if (data.shiftDetailsId) {
        /*only for request shift (to avoid the current shift) */
        where.$or[0]._id = { $ne: data.shiftDetailsId };
        where.$or[1]._id = { $ne: data.shiftDetailsId };
      }
      var checkAnyShiftAlreadyExists = await ShiftDetails.findOne(where).lean();
      return checkAnyShiftAlreadyExists ? false : true;
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async matchingStaffs(shiftDetails, res, tierType = 2) {
    try {
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
        /*or condition for any of the shift skill set matches the user */
        if (tierType == 2) {
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
          select: 'name',
        })
        .select('role deviceToken')
        .lean();
      var deviceTokens = [];
      for (let x of users) {
        if (x.role) /*only flexistaff */ deviceTokens.push(x.deviceToken);
      }
      return deviceTokens;
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async resRequestShiftChange(req, res) {
    try {
      __.log(req.body, 'resRequestShiftChange');
      let requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'isAccepted',
      ]);
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Get Current Shift Details
      var requestedShiftDetails = await ShiftDetails.findOne({
        _id: req.body.shiftDetailsId,
        status: {
          $in: [0, 1],
        },
        startTime: {
          $gt: moment().utc().format(),
        },
      }).populate({
        path: 'requestedBy',
        select: 'name deviceToken',
      });
      let setStatus = req.body.isAccepted ? parseInt(req.body.isAccepted) : 2;
      if (!requestedShiftDetails) {
        if (setStatus == 1) {
          //this.reduceLimit(userId, requestedShiftDetails);
        }
        return __.out(res, 300, 'Invalid shift / Shift expired');
      }
      // Get Current Shift Details
      var parentShiftDetails = await ShiftDetails.findOne({
        _id: requestedShiftDetails.referenceShiftDetailsId,
        status: {
          $in: [0, 1],
        },
        startTime: {
          $gt: moment().utc().format(),
        },
      }).populate({
        path: 'requestUsers',
        select: 'name deviceToken',
      });
      let userId = req.user._id;
      if (!parentShiftDetails) {
        if (setStatus == 1) {
          //this.reduceLimit(userId, requestedShiftDetails);
        }
        return __.out(res, 300, 'Invalid Parent shift / Shift expired');
      }
      if (
        requestedShiftDetails.confirmedStaffs.length ==
        requestedShiftDetails.staffNeedCount
      ) {
        if (setStatus == 1) {
          //this.reduceLimit(userId, requestedShiftDetails);
        }
        return __.out(res, 300, 'Shift Confirmed Slot is already filled');
      }
      if (parentShiftDetails.activeStatus == false) {
        if (setStatus == 1) {
          //this.reduceLimit(userId, requestedShiftDetails);
        }
        return __.out(res, 300, 'Request change has been manually stopped');
      }

      var dateForPush = requestedShiftDetails.startTimeInSeconds;
      let currentUserData = {};
      // Check Staff has another shift this time
      var newShiftTimings = {
        startTime: requestedShiftDetails.startTime,
        endTime: requestedShiftDetails.endTime,
        flexiStaffId: req.user._id,
        shiftDetailsId: parentShiftDetails._id,
      };
      var checkStaffAvailableInGivenTime =
        await this.checkStaffAvailableInGivenTime(newShiftTimings, res);
      if (setStatus == 1) {
        if (!checkStaffAvailableInGivenTime) {
          if (setStatus == 1) {
            this.reduceLimit(res, userId, requestedShiftDetails);
          }
          return __.out(res, 300, 'You have another shift at the same time.');
        }
      }

      // Set in Parent Shift
      let int = 0;
      let checkAllReplied = true;
      parentShiftDetails.requestedUsers =
        parentShiftDetails.requestedUsers || [];
      for (let elem of parentShiftDetails.requestedUsers) {
        if (
          req.user._id.equals(elem.userId) &&
          requestedShiftDetails._id.equals(elem.shiftDetailsId)
        ) {
          // Change Status in
          parentShiftDetails.requestedUsers[int].status = setStatus;
          currentUserData = elem;
        }
        if (
          parentShiftDetails.requestedUsers[int].status == 0 &&
          requestedShiftDetails._id.equals(elem.shiftDetailsId)
        ) {
          checkAllReplied = false;
        }
        int++;
      }

      // Set Status on Applied Staffs
      await AppliedStaffs.findOneAndUpdate(
        {
          flexiStaff: req.user._id,
          shiftDetailsId: req.body.shiftDetailsId,
        },
        {
          status: setStatus,
        },
      );

      /* Create Shift Log */
      let logMetaData = await Shift.findOne({
        _id: parentShiftDetails.shiftId,
      })
        .select(
          'shiftId businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
        )
        .lean();
      /* Add to log */
      let statusLogData = {
        userId: req.user._id,
        shiftId: parentShiftDetails.shiftId,
        weekRangeStartsAt: logMetaData.weekRangeStartsAt,
        weekRangeEndsAt: logMetaData.weekRangeEndsAt,
        weekNumber: logMetaData.weekNumber,
        businessUnitId: logMetaData.businessUnitId,
        existingShift: parentShiftDetails._id,
      };
      const redisBuId = logMetaData.businessUnitId;
      // Accept
      if (setStatus == 1) {
        // Add in requested shift confirmed
        requestedShiftDetails.confirmedStaffs =
          requestedShiftDetails.confirmedStaffs || [];
        let isFirstStaff = true;
        if (requestedShiftDetails.confirmedStaffs.length > 0) {
          isFirstStaff = false;
        }
        requestedShiftDetails.confirmedStaffs.push(req.user._id);
        requestedShiftDetails.status = 1;
        await requestedShiftDetails.save();

        // Stop Requesting If confirmed slot is filled
        if (
          requestedShiftDetails.confirmedStaffs.length ==
          requestedShiftDetails.staffNeedCount
        ) {
          parentShiftDetails.activeStatus = false;
          parentShiftDetails.currentReqShift = null;
        }
        // Stop Request Change if all responded
        if (checkAllReplied == true) {
          parentShiftDetails.activeStatus = false;
          parentShiftDetails.currentReqShift = null;
        }

        // Remove user parent shift confirmed
        let userIndex = parentShiftDetails.confirmedStaffs.indexOf(
          req.user._id,
        );
        parentShiftDetails.confirmedStaffs.splice(userIndex, 1);
        if (isFirstStaff) {
          parentShiftDetails.staffNeedCount =
            parentShiftDetails.staffNeedCount -
            requestedShiftDetails.staffNeedCount;
        }
        await parentShiftDetails.save();

        // Remove from Parent Shift
        await AppliedStaffs.findOneAndUpdate(
          {
            flexiStaff: req.user._id,
            shiftDetailsId: parentShiftDetails._id,
          },
          {
            status: 3,
          },
        );

        if (requestedShiftDetails.requestedBy.deviceToken) {
          var pushData = {
              title: 'Accepted Shift Change!',
              body: `${req.user.name} accepted shift change`,
              bodyText: `${req.user.name} accepted shift change for XXX shift`,
              bodyTime: [dateForPush],
              bodyTimeFormat: ['dd MMM'],
            },
            collapseKey =
              requestedShiftDetails._id.toString(); /*unique id for this particular shift */
          __.log(
            'pushSent',
            [requestedShiftDetails.requestedBy.deviceToken],
            pushData,
            collapseKey,
          );
          FCM.push(
            [requestedShiftDetails.requestedBy.deviceToken],
            pushData,
            collapseKey,
          );
        }

        // Log Created
        statusLogData.status = 7;
        statusLogData.acceptedShift = requestedShiftDetails._id;
        // await this.updateRedis(redisBuId);
        await shiftLogController.create(statusLogData, res);
        return __.out(
          res,
          201,
          'Request shift change has been accepted successfully',
        );
      }
      // Reject
      if (setStatus == 2) {
        // Stop Request Change if all responded
        if (checkAllReplied == true) {
          parentShiftDetails.activeStatus = false;
          parentShiftDetails.currentReqShift = null;
        }

        await parentShiftDetails.save();
        if (requestedShiftDetails.requestedBy.deviceToken) {
          var pushData = {
              title: 'Rejected Shift Change!',
              body: `${req.user.name} rejected shift change`,
              bodyText: `${req.user.name} rejected shift change for XXX shift`,
              bodyTime: [dateForPush],
              bodyTimeFormat: ['dd MMM'],
            },
            collapseKey =
              requestedShiftDetails._id.toString(); /*unique id for this particular shift */
          __.log(
            'pushSent',
            [requestedShiftDetails.requestedBy.deviceToken],
            pushData,
            collapseKey,
          );
          FCM.push(
            [requestedShiftDetails.requestedBy.deviceToken],
            pushData,
            collapseKey,
          );
        }

        // Log Created
        statusLogData.status = 8;
        statusLogData.rejectedShift = requestedShiftDetails._id;
        await shiftLogController.create(statusLogData, res);
        // await this.updateRedis(redisBuId);
        return __.out(
          res,
          201,
          'Request shift change has been rejected successfully',
        );
      }
    } catch (err) {
      __.log(err);
      if (setStatus == 1) {
        //this.reduceLimit(req.user._id, req.body.shiftDetailsId, 0);
      }
      return __.out(res, 500);
    }
  }
  async checkLimitRequestShiftChange(req, res) {
    try {
      let userId = req.user._id;
      if (req.body.userId) {
        userId = req.body.userId;
      }
      let shiftDetailId = req.body.shiftDetailsId;
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
      let shiftDetails = await ShiftDetails.findOne({ _id: shiftDetailId })
        .populate([
          {
            path: 'shiftId',
            select: 'weekNumber businessUnitId',
          },
        ])
        .lean();
      if (shiftDetails) {
        let referenceShiftDetails = await ShiftDetails.findOne({
          _id: shiftDetails.referenceShiftDetailsId,
        });
        if (referenceShiftDetails && schemeDetails.schemeId) {
          schemeDetails = schemeDetails.schemeId;
          if (schemeDetails.isShiftInterval) {
            const intervalRequireTime = schemeDetails.shiftIntervalTotal - 1;
            const intervalResult = await ShiftHelper.checkShiftInterval(
              userId,
              shiftDetails.startTime,
              shiftDetails.endTime,
              intervalRequireTime,
              referenceShiftDetails._id,
            );
            if (intervalResult) {
              return __.out(
                res,
                300,
                'Minimum interval between shift is not met. Kindly choose another shift with required interval.',
              );
            }
          }
          var isOt = false;
          let durationChange =
            shiftDetails.duration - referenceShiftDetails.duration;
          console.log('durationChange', durationChange);
          if (
            schemeDetails.shiftSchemeType == 1 ||
            schemeDetails.shiftSchemeType == 3
          ) {
            let otDuration = 0;
            let normalDuration = 0;
            if (
              schemeDetails.shiftSetup.openShift &&
              schemeDetails.shiftSetup.openShift.normal
            ) {
              normalDuration = parseInt(durationChange);
            } else {
              isOt = true;
              otDuration = parseInt(durationChange);
            }
            /* if (shiftDetails.isExtendedShift) {
                            let extendedStaff = shiftDetails.extendedStaff.filter((item) => {
                                return item.userId.toString() == userId.toString();
                            });
                            if (extendedStaff.length > 0) {
                                extendedStaff = extendedStaff[0];
                                if (schemeDetails.shiftSetup.openShift && schemeDetails.shiftSetup.openShift.normal) {
                                    normalDuration = extendedStaff.duration;
                                } else {
                                    otDuration = extendedStaff.duration;
                                }
                            }
                        }*/
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
            let dailyDuration = durationChange;
            let weeklyDuration = durationChange;
            let monthlyDuration = durationChange;
            let weekNumber = shiftDetails.shiftId.weekNumber;
            let dailyOverall = dailyDuration;
            let weekLlyOverall = dailyDuration;
            let monthlyOverall = dailyDuration;
            console.log('data', weekLlyOverall);
            let isPresent = false;
            let staffLimitPresentData = {};
            //res.json({data});
            if (!isOt) {
              data.forEach((item) => {
                // console.log('new Date(item.date)', new Date(item.date))
                if (new Date(item.date).getDate() == new Date(date).getDate()) {
                  if (
                    item.shiftDetailId.toString() ==
                    shiftDetails.referenceShiftDetailsId.toString()
                  ) {
                    isPresent = true;
                    staffLimitPresentData = item;
                  }
                  console.log('item.normalDuration', item.normalDuration);
                  dailyDuration += item.normalDuration;
                  dailyOverall += item.normalDuration;
                  dailyOverall += item.otDuration;
                }
                if (
                  new Date(item.date).getMonth() == new Date(date).getMonth()
                ) {
                  monthlyDuration += item.normalDuration;
                  monthlyOverall += item.normalDuration;
                  monthlyOverall += item.otDuration;
                }
                console.log('item.weekNo', item.weekNumber);
                console.log('sss', weekNumber);
                if (item.weekNumber == weekNumber) {
                  weeklyDuration += item.normalDuration;
                  weekLlyOverall += item.normalDuration;
                  weekLlyOverall += item.otDuration;
                }
              });
            } else {
              // ot hr
              data.forEach((item) => {
                // console.log('new Date(item.date)', new Date(item.date))
                if (new Date(item.date).getDate() == new Date(date).getDate()) {
                  if (
                    item.shiftDetailId.toString() ==
                    shiftDetails.referenceShiftDetailsId.toString()
                  ) {
                    (isPresent = true), (staffLimitPresentData = item);
                  }
                  dailyDuration += item.otDuration;
                  dailyOverall += item.otDuration;
                  dailyOverall += item.normalDuration;
                }
                if (
                  new Date(item.date).getMonth() == new Date(date).getMonth()
                ) {
                  monthlyDuration += item.otDuration;
                  monthlyOverall += item.otDuration;
                  monthlyOverall += item.normalDuration;
                }
                console.log('item.weekNo', item.weekNumber);
                console.log('sss', weekNumber);
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
            let monthOverallLimit =
              schemeDetails.shiftSetup.limits.monthOverall;
            let isAllow = dayLimit.alert;
            let disallow = dayLimit.disallow;
            if (shiftDetails.isAssignShift) {
              isAllow = !schemeDetails.shiftSetup.limits.otHr.day.alert;
              disallow = !schemeDetails.shiftSetup.limits.otHr.day.disallow;
              // if(schemeDetails.shiftSchemeType == 3){
              //     disallow = !disallow;
              //     isAllow = !isAllow;
              // }
            }
            if (isOt) {
              dayLimit = schemeDetails.shiftSetup.limits.otHr.day;
              weekLimit = schemeDetails.shiftSetup.limits.otHr.week;
              monthLimit = schemeDetails.shiftSetup.limits.otHr.month;
            }
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
              const upppp = await StaffLimit.findByIdAndUpdate(
                staffLimitPresentData._id,
                {
                  $inc: {
                    normalDuration: normalDuration,
                    otDuration: otDuration,
                  },
                  $set: { childShiftId: shiftDetails._id },
                },
              );
              // console.log('upppp', upppp);
            }
            // }
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
                await this.reduceLimitRequestShiftChange(
                  res,
                  userId,
                  shiftDetails,
                );
              }
              return res.status(201).json({
                limit: true,
                message: 'Exceeds Daily limit',
                flag: 'day',
                details: dayLimit,
                status: disallow ? 0 : 1,
              }); //dayLimit.disallow?0:1
            } else if (
              parseInt(weekLimit.value) &&
              parseInt(weekLimit.value) < parseInt(weeklyDuration)
            ) {
              if (!isAllow) {
                await this.reduceLimitRequestShiftChange(
                  res,
                  userId,
                  shiftDetails,
                );
              }
              return res.status(201).json({
                limit: true,
                message: 'Exceeds Weekly limit',
                flag: 'week',
                details: weekLimit,
                status: disallow ? 0 : 1,
              });
            } else if (
              parseInt(monthLimit.value) &&
              parseInt(monthLimit.value) < parseInt(monthlyDuration)
            ) {
              if (!isAllow) {
                await this.reduceLimitRequestShiftChange(
                  res,
                  userId,
                  shiftDetails,
                );
              }
              return res.status(201).json({
                limit: true,
                message: 'Exceeds Monthly limit',
                flag: 'month',
                details: monthLimit,
                status: disallow ? 0 : 1,
              });
            } else if (
              parseInt(dayOverallLimit) &&
              parseInt(dayOverallLimit) < parseInt(dailyOverall)
            ) {
              if (!isAllow) {
                await this.reduceLimitRequestShiftChange(
                  res,
                  userId,
                  shiftDetails,
                );
              }
              return res.status(201).json({
                limit: true,
                message: 'Exceeds Daily Overall limit',
                flag: 'dayoverall',
                details: monthLimit,
                status: disallow ? 0 : 1,
              });
            } else if (
              parseInt(weekOverallLimit) &&
              parseInt(weekOverallLimit) < parseInt(weekLlyOverall)
            ) {
              if (!isAllow) {
                await this.reduceLimitRequestShiftChange(
                  res,
                  userId,
                  shiftDetails,
                );
              }
              return res.status(201).json({
                limit: true,
                message: 'Exceeds Weekly Overall limit',
                flag: 'weekoverall',
                details: monthLimit,
                status: disallow ? 0 : 1,
              });
            } else if (
              parseInt(monthOverallLimit) &&
              parseInt(monthOverallLimit) < parseInt(monthlyOverall)
            ) {
              if (!isAllow) {
                await this.reduceLimitRequestShiftChange(
                  res,
                  userId,
                  shiftDetails,
                );
              }
              return res.status(201).json({
                limit: true,
                message: 'Exceeds Monthly Overall limit',
                flag: 'monthoverall',
                details: monthLimit,
                status: disallow ? 0 : 1,
              });
            }
            // call method from here
            this.resRequestShiftChange(req, res);
            // return res.json({ limit: false, status: 1, message: '' })
          } else {
            return res.status(201).json({
              limit: true,
              status: 0,
              message: "You don't have open shift scheme assign",
            }); // status 0 not allowed to create, 1 allowed to create
          }
        } else {
          return res.status(201).json({
            limit: true,
            status: 0,
            message: "You don't have open shift scheme assign",
          }); // status 0 not allowed to create, 1 allowed to create
        }
      }
    } catch (error) {
      return __.out(res, 500);
    }
  }
  async reduceLimitRequestShiftChange(res, userId, shiftDetails, from = 1) {
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
      let referenceShiftDetails = await ShiftDetails.findOne({
        _id: shiftDetails.referenceShiftDetailsId,
      });
      let changeDuration =
        shiftDetails.duration - referenceShiftDetails.duration;
      let otDuration = 0;
      let normalDuration = 0;
      if (
        schemeDetails.shiftSetup.openShift &&
        schemeDetails.shiftSetup.openShift.normal
      ) {
        normalDuration = -1 * changeDuration;
      } else {
        otDuration = -1 * changeDuration;
      }
      console.log('aaaaa', normalDuration, otDuration);
      console.log('shiftDetails._id', shiftDetails._id);
      const value = await StaffLimit.update(
        { userId: userId, shiftDetailId: shiftDetails.referenceShiftDetailsId },
        { $inc: { normalDuration: normalDuration, otDuration: otDuration } },
      );
      console.log('valuevalue', value);
      return value;
    } catch (error) {
      return __.out(res, 500);
    }
  }
  async reduceLimitRSC(req, res) {
    try {
      let userId = req.user._id;
      let shiftDetailId = req.body.shiftDetailsId;
      if (req.body.userId) {
        userId = req.body.userId;
      }
      let shiftDetails = await ShiftDetails.findOne({ _id: shiftDetailId });
      let result = await this.reduceLimitRequestShiftChange(
        res,
        userId,
        shiftDetails,
      );
      return res
        .status(201)
        .json({ status: true, message: 'Successfully Proceed' });
    } catch (error) {
      return __.out(res, 500);
    }
  }
}
staffShift = new staffShift();
module.exports = staffShift;
