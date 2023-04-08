// Controller Code Starts here
const mongoose = require('mongoose'),
  AppliedStaffs = require('../../models/appliedStaff'),
  Shift = require('../../models/shift'),
  ShiftDetails = require('../../models/shiftDetails'),
  ShiftLog = require('../../models/shiftLog'),
  User = require('../../models/user'),
  staffShiftController = require('../staff/staffShiftController'),
  WeeklyStaffData = require('./weeklyStaffingController'),
  moment = require('moment'),
  FCM = require('../../../helpers/fcm'),
  _ = require('lodash'),
  __ = require('../../../helpers/globalFunctions');
const async = require('async');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class shiftLog {
  async create(data, res) {
    try {
      let insert = {
        userId: data.userId,
        businessUnitId: data.businessUnitId,
        status: data.status,
        weekNumber: data.weekNumber,
        weekRangeStartsAt: data.weekRangeStartsAt,
        weekRangeEndsAt: data.weekRangeEndsAt,
        newTiming: data.newTiming,
      };
      if (data.status === 1) {
        insert.shiftId = await this.getStringifiedShiftData(data.shiftId, true);
        insert.description = `Planning`;
      }
      if (data.status === 3) {
        insert.description = `New Template Saved`;
      }
      if (data.status === 4) {
        insert.description = `Template Edited`;
      }
      if (data.status === 5) {
        insert.shiftId = await this.getStringifiedShiftData(data.shiftId, true);
        insert.adjustedShift = await this.getStringifiedShiftData(
          data.adjustedShift,
          false,
        );
        insert.description = `${data.oldCount} adjusted to ${data.newCount}`;
      }
      if (data.status === 6) {
        insert.shiftId = await this.getStringifiedShiftData(data.shiftId, true);
        insert.pendingShift = await this.getStringifiedShiftData(
          data.pendingShift,
          false,
        );
        insert.existingShift = await this.getStringifiedShiftData(
          data.existingShift,
          false,
        );
        insert.description = `Pending Acceptance`;
      }
      if (data.status === 7) {
        insert.shiftId = await this.getStringifiedShiftData(data.shiftId, true);
        insert.acceptedShift = await this.getStringifiedShiftData(
          data.acceptedShift,
          false,
        );
        insert.existingShift = await this.getStringifiedShiftData(
          data.existingShift,
          false,
        );
        insert.description = `Request change - Accepted`;
      }
      if (data.status === 8) {
        insert.shiftId = await this.getStringifiedShiftData(data.shiftId, true);
        insert.rejectedShift = await this.getStringifiedShiftData(
          data.rejectedShift,
          false,
        );
        insert.existingShift = await this.getStringifiedShiftData(
          data.existingShift,
          false,
        );
        insert.description = `Request change - Rejected`;
      }
      if (data.status === 9) {
        insert.shiftId = await this.getStringifiedShiftData(data.shiftId, true);
        insert.requestedShift = await this.getStringifiedShiftData(
          data.requestedShift,
          false,
        );
        insert.existingShift = await this.getStringifiedShiftData(
          data.existingShift,
          false,
        );
        insert.description = `Shift Request change`;
      }
      if (data.status === 10) {
        insert.shiftId = await this.getStringifiedShiftData(data.shiftId, true);
        insert.requestedShift = await this.getStringifiedShiftData(
          data.requestedShift,
          false,
        );
        insert.existingShift = await this.getStringifiedShiftData(
          data.existingShift,
          false,
        );
        insert.description = `Shift Request change Stopped`;
      }
      if (data.status === 11) {
        insert.shiftId = await this.getStringifiedShiftData(data.shiftId, true);
        insert.existingShift = await this.getStringifiedShiftData(
          data.existingShift,
          false,
        );
        insert.description = `Shift Cancelled`;
      }
      if (data.status === 12) {
        insert.shiftId = await this.getStringifiedShiftData(data.shiftId, true);
        //insert.existingShift = await this.getStringifiedShiftData(data.existingShift, false);
        insert.description = `Shift Extended`;
        insert.existingShift = await this.getStringifiedShiftData(
          data.existingShift,
          false,
        );
      }
      if (data.status === 13) {
        insert.shiftId = await this.getStringifiedShiftData(data.shiftId, true);
        //insert.existingShift = await this.getStringifiedShiftData(data.existingShift, false);
        insert.description = `Shift Extension - Accepted`;
        insert.existingShift = await this.getStringifiedShiftData(
          data.existingShift,
          false,
        );
      }
      if (data.status === 14) {
        insert.shiftId = await this.getStringifiedShiftData(data.shiftId, true);
        //insert.existingShift = await this.getStringifiedShiftData(data.existingShift, false);
        insert.description = `Shift Extension - Declined`;

        insert.existingShift = await this.getStringifiedShiftData(
          data.existingShift,
          false,
        );
      }
      if (data.status === 15) {
        insert.shiftId = await this.getStringifiedShiftData(data.shiftId, true);
        insert.existingShift = await this.getStringifiedShiftData(
          data.existingShift,
          false,
        );
        var st = 'On Rest Day';
        if (data.isOff) {
          st = 'On Off Day';
        }
        insert.description = `Recall request sent - ${st}`;
        insert.existingShift = await this.getStringifiedShiftData(
          data.existingShift,
          false,
        );
      }
      if (data.status === 16) {
        insert.shiftId = await this.getStringifiedShiftData(data.shiftId, true);
        insert.existingShift = await this.getStringifiedShiftData(
          data.existingShift,
          false,
        );
        var st = 'On Rest Day';
        if (data.isOff) {
          st = 'On Off Day';
        }
        var isAs = 'accepted';
        if (data.isRecallAccepted == 3) {
          isAs = 'declined';
        }
        insert.description = `Recall request ${isAs} - ${st} `;
        insert.existingShift = await this.getStringifiedShiftData(
          data.existingShift,
          false,
        );
      }
      var result = await new ShiftLog(insert).save();
      __.log('Log created successfully');
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  /* Returns stringified shift data for logs */
  async getStringifiedShiftData(id, list) {
    /* True for shiftList and false for shiftDetails */
    try {
      if (list) {
        let data = await Shift.findOne({
          _id: id,
        })
          .populate([
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
            {
              path: 'shiftDetails',
              populate: [
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
              ],
            },
          ])
          .lean();
        return JSON.stringify(data);
      } else {
        let data = await ShiftDetails.findOne({
          _id: id,
        })
          .populate([
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
              path: 'dedicatedRequestTo',
              select: 'name',
            },
          ])
          .lean();
        return JSON.stringify(data);
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async read(req, res) {
    try {
      let pageNum = req.query.start ? parseInt(req.query.start) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum * limit) / limit;
      var findOrFindOne;
      if (req.body.shiftLogId) {
        findOrFindOne = ShiftLog.findById(req.body.shiftLogId);
      } else {
        let requiredResult = await __.checkRequiredFields(req, [
          'businessUnitId',
          'startDate',
          'status',
        ]);
        if (requiredResult.status === false) {
          logError(`shiftLog\read API, Required fields missing `, requiredResult.missingFields);
          logError(`shiftLog\read API, request payload `, req.body);
          return __.out(res, 400, requiredResult.missingFields);
        }
        let status;
        if (Number(req.body.status) >= 5) {
          status = {
            $gte: 5,
          };
        } else {
          status = Number(req.body.status);
        }
        let startDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
        let weekNumber = await __.weekNoStartWithMonday(startDate);
        const yearOfWeek = new Date(req.body.startDate).getFullYear();
        findOrFindOne = ShiftLog.find({
          status: status,
          businessUnitId: req.body.businessUnitId,
          weekNumber: weekNumber,
          $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, yearOfWeek] },
        });
      }
      var result = await findOrFindOne
        .sort({
          createdAt: -1,
        })
        .populate([
          {
            path: 'userId',
            select: 'name staffId',
          },
        ]);
      var isResponseSend = false;
      //.skip(skip).limit(limit).lean();
      //   console.log('result', result);
      if (result.length > 0) {
        // return res.send(result)
        if (Number(req.body.status) >= 5) {
          const resultLength = result.length;
          console.log(resultLength);
          if (Number(req.body.status) === 5) {
            async.eachSeries(result, (item, next) => {
              let goNext = true;
              const index = result.indexOf(item) + 1;
              console.log('i', index);
              let adjustedShift = {};
              let from = 0;
              if (item.adjustedShift) {
                console.log('1', index);
                adjustedShift = JSON.parse(item.adjustedShift);
                from = 1;
              } else if (item.existingShift) {
                console.log('2', index);
                adjustedShift = JSON.parse(item.existingShift);
                from = 2;
                //next();
              } else {
                console.log('3', index);
                //index++;
                goNext = false;
                next();
              }
              console.log('hereee');
              if (goNext) {
                if (adjustedShift && adjustedShift.isSplitShift) {
                  console.log('I am here');
                  ShiftDetails.findOne({
                    shiftId: adjustedShift.shiftId,
                    isSplitShift: true,
                    day: adjustedShift.day,
                    _id: { $ne: adjustedShift._id },
                  })
                    .then((splitShift) => {
                      console.log('1');
                      if (splitShift) {
                        console.log('found');
                        adjustedShift.splitShiftStartTime =
                          splitShift.startTime;
                        adjustedShift.splitShiftEndTime = splitShift.endTime;
                        adjustedShift.splitShiftId = splitShift._id;
                        if (from === 1) {
                          item.adjustedShift = JSON.stringify(adjustedShift);
                        } else if (from === 2) {
                          item.existingShift = JSON.stringify(adjustedShift);
                        }
                      }
                      console.log('2');
                      if (resultLength === index) {
                        console.log('aaa');
                        __.out(res, 201, result);
                      } else {
                        next();
                      }
                    })
                    .catch((err) => {
                      logError(`shiftLog\read API, there is an error `, err.toString());
                      if (resultLength === index) {
                        console.log('aaa');
                        __.out(res, 201, result);
                      } else {
                        next();
                      }
                    });
                } else {
                  if (resultLength === index) {
                    console.log('aaa');
                    isResponseSend = true;
                    __.out(res, 201, result);
                  } else {
                    next();
                  }
                }
              }
            });
            if (!isResponseSend) {
              __.out(res, 201, result);
            }
          } else {
            console.log('aaa');
            __.out(res, 201, result);
          }
        } else {
          console.log('here');
          //return res.json({value: JSON.parse(result[0].shiftId)});
          result.forEach((item, index) => {
            item.shiftId = JSON.parse(item.shiftId);
            //console.log('item.shiftId.shiftDetails', item.shiftId.shiftDetails.length);
            if (item.shiftId.shiftDetails) {
              item.shiftId.shiftDetails.forEach(
                (splitShift, splitShiftIndex) => {
                  if (splitShift.isSplitShift) {
                    item.shiftId.shiftDetails.forEach(
                      (splitShiftNew, splitShiftIndexNew) => {
                        if (
                          splitShiftNew.isSplitShift &&
                          splitShiftIndex !== splitShiftIndexNew &&
                          new Date(splitShift.date).getTime() ===
                          new Date(splitShiftNew.date).getTime() &&
                          splitShift.shiftId === splitShiftNew.shiftId
                        ) {
                          splitShift.splitShiftStartTime =
                            splitShiftNew.startTime;
                          splitShift.splitShiftEndTime = splitShiftNew.endTime;
                          splitShift.splitShiftId = splitShiftNew._id;
                          item.shiftId.shiftDetails.splice(
                            splitShiftIndexNew,
                            1,
                          );
                        }
                      },
                    );
                  }
                },
              );
            }
            item.shiftId = JSON.stringify(item.shiftId);
          });
          //console.log('aaa', result);
          if (result && result.length > 0) {
            __.out(res, 201, result);
          } else {
            __.out(res, 201, []);
          }
        }
      } else {
        __.out(res, 201, result);
      }
    } catch (err) {
      logError(`shiftLog\read API, there is an error `, err.toString());
      __.log(err);
      __.out(res, 500);
    }
  }

  // async read(req, res) {
  //     try {
  //         console.log('I am here')
  //         let pageNum = (req.query.start) ? parseInt(req.query.start) : 0;
  //         let limit = (req.query.length) ? parseInt(req.query.length) : 10;
  //         let skip = (req.query.skip) ? parseInt(req.query.skip) : ((pageNum) * limit) / limit;
  //         var findOrFindOne;
  //         if (req.body.shiftLogId) {
  //             findOrFindOne = ShiftLog.findById(req.body.shiftLogId);
  //         } else {
  //             let requiredResult = await __.checkRequiredFields(req, ['businessUnitId', 'startDate', 'status']);
  //             if (requiredResult.status === false) {
  //                 __.out(res, 400, requiredResult.missingFields);
  //                 return;
  //             }
  //             let status;
  //             if (Number(req.body.status) >= 5) {
  //                 status = {
  //                     $gte: 5
  //                 };
  //             } else {
  //                 status = Number(req.body.status);
  //             }
  //             let startDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z').utc().format();
  //             console.log('iammamam')
  //             let weekNumber = await __.weekNoStartWithMonday(startDate);
  //             const yearOfWeek = new Date(req.body.startDate).getFullYear();
  //             findOrFindOne = ShiftLog.find({
  //                 status: status,
  //                 businessUnitId: req.body.businessUnitId,
  //                 weekNumber: weekNumber,
  //                 "$expr": { "$eq": [{ "$year": "$weekRangeStartsAt" }, yearOfWeek] }
  //             });
  //         }
  //         var result = await findOrFindOne.sort({
  //             'createdAt': -1
  //         }).populate([{
  //             path: 'userId',
  //             select: 'name staffId'
  //         }])
  //         //.skip(skip).limit(limit).lean();
  //        //console.log('result', result);
  //         if(result.length > 0) {
  //            // return res.send(result)
  //             if (Number(req.body.status) >= 5) {
  //                 const resultLength = result.length;
  //                 console.log(resultLength);
  //                 if (Number(req.body.status) === 5) {
  //                     async.eachSeries(
  //                         result, (item, next) => {
  //                             let goNext = true;
  //                             const index = result.indexOf(item) + 1;
  //                             console.log('i', index);
  //                             let adjustedShift = {};
  //                             let from = 0;
  //                             if (item.adjustedShift) {
  //                                 console.log('1', index);
  //                                 adjustedShift = JSON.parse(item.adjustedShift);
  //                                 from = 1;
  //                             } else if (item.existingShift) {
  //                                 console.log('2', index, resultLength);
  //                                 adjustedShift = JSON.parse(item.existingShift);
  //                                 from = 2;
  //                                 next();
  //                             } else {
  //                                 console.log('3', index);
  //                                 //index++;
  //                                 goNext = false;
  //                                 next();
  //                             }
  //                             console.log('hereee', goNext);
  //                             if (goNext) {
  //                                 if (adjustedShift && adjustedShift.isSplitShift) {
  //                                 console.log('I am here');
  //                                 ShiftDetails.findOne({
  //                                     shiftId: adjustedShift.shiftId, isSplitShift: true, day: adjustedShift.day
  //                                     , _id: {$ne: adjustedShift._id}
  //                                 }).then((splitShift) => {
  //                                     console.log('1');
  //                                     if (splitShift) {
  //                                         console.log('found');
  //                                         adjustedShift.splitShiftStartTime = splitShift.startTime;
  //                                         adjustedShift.splitShiftEndTime = splitShift.endTime;
  //                                         adjustedShift.splitShiftId = splitShift._id;
  //                                         if (from === 1) {
  //                                             item.adjustedShift = JSON.stringify(adjustedShift);
  //                                         } else if (from === 2) {
  //                                             item.existingShift = JSON.stringify(adjustedShift);
  //                                         }
  //                                     }
  //                                     console.log('2');
  //                                     if (resultLength === index) {
  //                                         console.log('aaa');
  //                                         __.out(res, 201, result);
  //                                     } else {
  //                                         next();
  //                                     }
  //                                 }).catch((err) => {
  //                                     if (resultLength === index) {
  //                                         console.log('aaa');
  //                                         __.out(res, 201, result);
  //                                     } else {
  //                                         next();
  //                                     }
  //                                 });
  //                             } else {
  //                                 console.log('immm')
  //                                 if (resultLength === index) {
  //                                     console.log('aaa');
  //                                     __.out(res, 201, result);
  //                                 } else {
  //                                    next();
  //                                 }
  //                             }
  //                         }
  //                         });
  //                 } else {
  //                     console.log('aaa');
  //                     __.out(res, 201, result);
  //                 }
  //             } else {
  //                 console.log('here');
  //                 //return res.json({value: JSON.parse(result[0].shiftId)});
  //                 result.forEach((item, index) => {
  //                     item.shiftId = JSON.parse(item.shiftId);
  //                     console.log('item.shiftId.shiftDetails', item.shiftId.shiftDetails.length);
  //                     item.shiftId.shiftDetails.forEach((splitShift, splitShiftIndex) => {
  //                         if (splitShift.isSplitShift) {
  //                             item.shiftId.shiftDetails.forEach((splitShiftNew, splitShiftIndexNew) => {
  //                                 if (splitShiftNew.isSplitShift && splitShiftIndex !== splitShiftIndexNew &&
  //                                     new Date(splitShift.date).getTime() === new Date(splitShiftNew.date).getTime()
  //                                     && splitShift.shiftId === splitShiftNew.shiftId) {
  //                                     splitShift.splitShiftStartTime = splitShiftNew.startTime;
  //                                     splitShift.splitShiftEndTime = splitShiftNew.endTime;
  //                                     splitShift.splitShiftId = splitShiftNew._id;
  //                                     item.shiftId.shiftDetails.splice(splitShiftIndexNew, 1);
  //                                 }
  //                             });
  //                         }
  //                     });
  //                     item.shiftId = JSON.stringify(item.shiftId);
  //                 });
  //                 //console.log('aaa', result);
  //                 if (result && result.length > 0) {
  //                     __.out(res, 201, result);
  //                 } else {
  //                     __.out(res, 201, []);
  //                 }
  //             }
  //         }else {
  //             __.out(res, 201, result);
  //         }
  //     } catch (err) {
  //         __.log(err);
  //         __.out(res, 500);
  //     }
  // }
}

module.exports = new shiftLog();
