const json2csv = require('json2csv').parse;
const mongoose = require('mongoose'),
  Shift = require('../../models/shift'),
  ShiftDetails = require('../../models/shiftDetails'),
  ShiftLog = require('../../models/shiftLog'),
  User = require('../../models/user'),
  StaffLimit = require('../../models/staffLimit'),
  QrCode = require('../../models/qrCode'),
  FacialData = require('../../models/facialData'),
  Attendance = require('../../models/attendance'),
  Company = require('../../models/company');
var moment = require('moment');
let striptags = require('striptags');
const async = require('async');
const __ = require('../../../helpers/globalFunctions');
// const redisClient = require('../../../helpers/redis.js');
// const redisData = require('../../../helpers/redisDataGenerator');

class timeSheetController {
  // async updateRedis(businessUnitId, from) {
  //   if (from !== 'add') {
  //     redisData.history(businessUnitId);
  //     redisData.readModifyAshish(businessUnitId);
  //     redisData.timesheetData(businessUnitId);
  //   }
  // }
  // async updateRedisSingle(businessUnitId, shiftDetailId) {
  //   // redisData.history(businessUnitId)
  //   console.log('before redis setting data');
  //   const ree = await Promise.all([
  //     redisData.readModifyAshishSingleShift(businessUnitId, shiftDetailId),
  //     redisData.timesheetDataSingleShift(businessUnitId, shiftDetailId),
  //     redisData.historySingle(businessUnitId, shiftDetailId),
  //   ]);
  //   // const r = await redisData.readModifyAshishSingleShift(businessUnitId, shiftDetailId);
  //   // const p = await redisData.timesheetDataSingleShift(businessUnitId, shiftDetailId);
  //   console.log('after redis setting data', ree);
  //   return ree;
  //   // redisData.timesheetData(businessUnitId)
  // }
  async read(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }
    console.log('in read dashbaor', moment.utc().format());
    let date = new Date(moment.utc().format());
    let currentDateTime = new Date(moment.utc().format());
    let timeZone = req.body.timeZone;
    if (!timeZone) {
      timeZone = '+0800';
    }
    console.log(timeZone, 'aaaa', date);
    //  moment(date).utcOffset(timeZone).format('MM/DD/YYYY HH:mm');
    date = new Date(
      moment(date).utcOffset(timeZone).format('MM/DD/YYYY HH:mm'),
    );
    currentDateTime = new Date(
      moment(currentDateTime).utcOffset(timeZone).format('MM/DD/YYYY HH:mm'),
    );
    console.log('aaaaaaa', date);
    date = new Date(date.setHours(0, 0, 0, 0));
    console.log('ddddd', date);
    //  const startDate = new Date(moment.utc().format());
    //  const endDate = new Date(moment.utc().format());
    let startDateTime = new Date(
      new Date(date).getTime() - 7 * 24 * 60 * 60 * 1000,
    );
    startDateTime = new Date(startDateTime).toUTCString();
    date = new Date(moment.utc().format());
    date = new Date(date.setHours(0, 0, 0, 0));
    // console.log('date',)
    let endDateTime = currentDateTime.setHours(currentDateTime.getHours() + 12);
    endDateTime = new Date(endDateTime).toUTCString();
    console.log(
      'start',
      new Date(startDateTime).toISOString(),
      new Date(endDateTime),
    );
    //  console.log('isoss', new Date().toISOString());
    // return res.json({j:'a'})
    // const datett = new Date();
    // ,
    //     weekRangeStartsAt: { $lte: new Date() },
    //     weekRangeEndsAt: {$gte: new Date()}
    Shift.aggregate([
      {
        $match: {
          businessUnitId: mongoose.Types.ObjectId(req.params.businessUnitId),
          weekRangeStartsAt: {
            $lte: new Date(new Date(endDateTime).toISOString()),
          },
          weekRangeEndsAt: {
            $gte: new Date(new Date(startDateTime).toISOString()),
          },
        },
      },
      {
        $lookup: {
          from: 'shiftdetails',
          localField: '_id',
          foreignField: 'shiftId',
          as: 'shiftDetails',
        },
      },
      {
        $unwind: '$shiftDetails',
      },
      {
        $match: {
          'shiftDetails.status': 1,
          'shiftDetails.startTime': {
            $lte: new Date(new Date(endDateTime).toISOString()),
          },
          'shiftDetails.endTime': {
            $gte: new Date(new Date(startDateTime).toISOString()),
          },
        },
      },
      {
        $unwind: '$shiftDetails.confirmedStaffs',
      },
      {
        $lookup: {
          from: 'users',
          localField: 'shiftDetails.confirmedStaffs',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      {
        $unwind: '$userInfo',
      },
      {
        $lookup: {
          from: 'appointments',
          localField: 'userInfo.appointmentId',
          foreignField: '_id',
          as: 'appointmentInfo',
        },
      },
      {
        $unwind: '$appointmentInfo',
      },
      { $sort: { 'shiftDetails.date': -1 } },
      {
        $project: {
          _id: 1,
          businessUnitId: 1,
          weekRangeStartsAt: 1,
          weekRangeEndsAt: 1,
          'userInfo.name': 1,
          'userInfo._id': 1,
          'userInfo.facialId': 1,
          'userInfo.staffId': 1,
          'userInfo.contactNumber': 1,
          'userInfo.appointmentId': 1,
          'shiftDetails.startTime': 1,
          'shiftDetails.endTime': 1,
          'shiftDetails.day': 1,
          'shiftDetails.date': 1,
          'shiftDetails._id': 1,
          'shiftDetails.confirmedStaffs': 1,
          'shiftDetails.shiftId': 1,
          'shiftDetails.isExtendedShift': 1,
          'shiftDetails.extendedStaff': 1,
          'shiftDetails.isSplitShift': 1,
          'shiftDetails.isAssignShift': 1,
          'appointmentInfo.name': 1,
        },
      },
    ])
      .then((results) => {
        // const dummyData = JSON.stringify(results);
        // results = JSON.parse(dummyData);
        // return res.json(results);
        // console.log('aaaaa',results.length);
        if (results.length > 0) {
          // async.eachSeries(
          //     results, (item, next) => {
          //         if (item.userInfo) {
          //             FacialData.find({ userId: item.userInfo._id }, { _id: 1, facialInfo: 1 }).then((facialInfo) => {
          //                 if (facialInfo.length > 0) {
          //                     //item.userInfo.facialInfo = facialInfo[0].facialInfo;
          //                     item.isFacial = true;
          //                 } else {
          //                     item.isFacial = false;
          //                     item.userInfo.facialInfo = null;
          //                 }
          //                 next();
          //             });
          //         }
          //     });
          async.eachSeries(results, (item, next) => {
            const index = results.indexOf(item);
            if (item.userInfo) {
              item.isFacial = false;
              if (item.userInfo.facialId) {
                item.isFacial = true;
              }
              Attendance.findOne({
                userId: item.userInfo._id,
                shiftDetailId: item.shiftDetails._id,
              })
                .then((attendance) => {
                  //if(attendance.status !== 4){
                  item.attendance = attendance;
                  if (!attendance) {
                    delete item.attendance;
                  }
                  //  }
                  if (index === results.length - 1) {
                    const result = this.filterData(
                      results,
                      startDateTime,
                      endDateTime,
                      res,
                    );
                    //   console.log('result2', result);
                    // return res.json({status: 1, message: 'Data Found', data: result});
                    //__.out(res, 200, results);
                  }
                  next();
                })
                .catch((err) => {
                  if (index === results.length - 1) {
                    const result = this.filterData(
                      results,
                      startDateTime,
                      endDateTime,
                      res,
                    );
                    //  console.log('result1', result);
                    // return res.json({status: 1, message: 'Data Found', data: result});
                    //  __.out(res, 200, results);
                  }
                  next();
                });
            } else {
              if (index === results.length - 1) {
                const result = this.filterData(
                  results,
                  startDateTime,
                  endDateTime,
                  res,
                );
                // console.log('result', result);
                //return res.json({status: 1, message: 'Data Found', data: result});
                //__.out(res, 200, results);
              }
              next();
            }
          });
        } else {
          return res.json({
            status: 2,
            message: 'No Data Found 1',
            data: null,
          });
          //__.out(res,200,"No Data Found");
        }
      })
      .catch((err) => {
        return res.json({
          status: 3,
          message: 'Something Went wrong',
          data: null,
        });
        // __.out(res,500,err);
      });
  }
  async readModifyAshish(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      // redis key businessUnitId+timeDashbaord
      console.log('^^^^^^^^^^^^^^^^^^^^');
      // const redisData = await redisClient.get(
      //   `${req.params.businessUnitId}timeDashboard`,
      // );
      // console.log('*************^^^^^^^^^^', redisData);
      // if (redisData) {
      //   console.log('DATATATATATA Present');
      //   return res.json({
      //     status: 1,
      //     message: 'Data Found',
      //     data: JSON.parse(redisData),
      //   });
      // }
      let date = new Date(moment.utc().format());
      let timeZone = req.body.timeZone;
      if (!timeZone) {
        timeZone = '+0800';
      }
      let currentDateTime = new Date(
        moment(new Date()).utcOffset(timeZone).format('MM/DD/YYYY HH:mm'),
      );
      let currentDateTimeStart = new Date(
        moment(new Date()).utcOffset(timeZone).format('MM/DD/YYYY HH:mm'),
      );
      // console.log(timeZone, 'aaaa', date);
      //  moment(date).utcOffset(timeZone).format('MM/DD/YYYY HH:mm');
      date = new Date(
        moment(date).utcOffset(timeZone).format('MM/DD/YYYY HH:mm'),
      );
      //  currentDateTime = new Date(moment(currentDateTime).utcOffset(timeZone).format('MM/DD/YYYY HH:mm'));
      // console.log('aaaaaaa', date);
      date = new Date(date.setHours(0, 0, 0, 0));
      console.log('ddddd', date);
      let daysBefore = 3;
      let startDateTime = new Date(
        new Date(date).getTime() - daysBefore * 24 * 60 * 60 * 1000,
      );
      startDateTime = new Date(startDateTime).toUTCString();
      date = new Date(moment.utc().format());
      date = new Date(date.setHours(0, 0, 0, 0));
      //   console.log('currentDateTime.getHours()', currentDateTime.getHours())
      let endDateTime = new Date(
        currentDateTime.setHours(currentDateTime.getHours() + 18),
      );
      let newStartTime = new Date(
        currentDateTimeStart.setHours(currentDateTimeStart.getHours() - 18),
      );
      //console.log('start', new Date(newStartTime).toISOString(), new Date(endDateTime).toISOString());
      Shift.aggregate([
        {
          $match: {
            businessUnitId: mongoose.Types.ObjectId(req.params.businessUnitId),
            weekRangeStartsAt: {
              $lte: new Date(new Date(endDateTime).toISOString()),
            },
            weekRangeEndsAt: {
              $gte: new Date(new Date(startDateTime).toISOString()),
            },
          },
        },
        {
          $lookup: {
            from: 'shiftdetails',
            localField: '_id',
            foreignField: 'shiftId',
            as: 'shiftDetails',
          },
        },
        {
          $unwind: '$shiftDetails',
        },
        {
          $match: {
            'shiftDetails.status': 1,
            'shiftDetails.startTime': {
              $lte: new Date(new Date(endDateTime).toISOString()),
            },
            'shiftDetails.endTime': {
              $gte: new Date(new Date(newStartTime).toISOString()),
            },
          },
        },
        {
          $unwind: '$shiftDetails.confirmedStaffs',
        },
        {
          $lookup: {
            from: 'users',
            localField: 'shiftDetails.confirmedStaffs',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        {
          $unwind: '$userInfo',
        },
        {
          $lookup: {
            from: 'appointments',
            localField: 'userInfo.appointmentId',
            foreignField: '_id',
            as: 'appointmentInfo',
          },
        },
        {
          $unwind: '$appointmentInfo',
        },
        {
          $lookup: {
            from: 'reportinglocations',
            localField: 'shiftDetails.reportLocationId',
            foreignField: '_id',
            as: 'reportingLocation',
          },
        },
        {
          $unwind: '$reportingLocation',
        },
        { $sort: { 'shiftDetails.date': -1 } },
        {
          $project: {
            _id: 1,
            businessUnitId: 1,
            weekRangeStartsAt: 1,
            weekRangeEndsAt: 1,
            'userInfo.name': 1,
            'userInfo.facialId': 1,
            'userInfo._id': 1,
            'userInfo.staffId': 1,
            'userInfo.email': 1,
            'userInfo.contactNumber': 1,
            'userInfo.appointmentId': 1,
            'shiftDetails.startTime': 1,
            'shiftDetails.reportLocationId': 1,
            'shiftDetails.endTime': 1,
            'shiftDetails.day': 1,
            'shiftDetails.date': 1,
            'shiftDetails._id': 1,
            'shiftDetails.confirmedStaffs': 1,
            'shiftDetails.shiftId': 1,
            'shiftDetails.isExtendedShift': 1,
            'shiftDetails.extendedStaff': 1,
            'shiftDetails.isSplitShift': 1,
            'shiftDetails.isAssignShift': 1,
            'appointmentInfo.name': 1,
            'reportingLocation.name': 1,
          },
        },
      ])
        .then(async (results) => {
          console.log('total shift found', results.length);
          const hours_6_mili = 60000 * 540;
          if (results.length > 0) {
            const finalResult = [];
            results.forEach((item, index) => {
              let startMili = 0;
              if (item.shiftDetails.startTime) {
                startMili = new Date(item.shiftDetails.startTime).getTime();
              }
              let endMili = 0;
              if (item.shiftDetails.endTime) {
                endMili = new Date(item.shiftDetails.endTime).getTime();
              }
              if (
                startMili - new Date().getTime() <= hours_6_mili &&
                new Date().getTime() - endMili <= hours_6_mili
              ) {
                item.isFacial = false;
                if (item.userInfo.facialId) {
                  item.isFacial = true;
                }
                finalResult.push(
                  this.getAttendanceDataForReadModifyAshish(item),
                );
              }
            });
            results = await Promise.all(finalResult);
            this.filterDataForDashbaord(
              results,
              startDateTime,
              endDateTime,
              res,
              timeZone,
              req,
            );
          } else {
            // this.setRedisData(`${req.params.businessUnitId}timeDashboard`, []);
            return res.json({
              status: 2,
              message: 'No Data Found 1',
              data: null,
            });
            //__.out(res,200,"No Data Found");
          }
        })
        .catch((err) => {
          return res.json({
            status: 3,
            message: 'Something Went wrong',
            data: null,
          });
          // __.out(res,500,err);
        });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  // setRedisData(key, data) {
  //   redisClient.set(key, JSON.stringify(data), 'EX', 10 * 60, (err) => {});
  // }
  async getAttendanceDataForReadModifyAshish(item) {
    return new Promise((resolve, reject) => {
      if (item.userInfo) {
        Attendance.findOne({
          userId: item.userInfo._id,
          shiftDetailId: item.shiftDetails._id,
        })
          .then((attendance) => {
            item.attendance = attendance;
            if (!attendance) {
              delete item.attendance;
            }
            resolve(item);
          })
          .catch((err) => {
            resolve(null);
          });
      } else {
        resolve(null);
      }
    });
  }
  async filterDataForDashbaord(
    results,
    startDateTime,
    endDateTime,
    res,
    timeZone = '+0800',
    req,
  ) {
    const newResult = [];
    results.forEach((item, index) => {
      if (item) {
        const timeZoneP = item.shiftDetails.timeZone
          ? item.shiftDetails.timeZone
          : '+0800';
        const dayP = item.day;
        const dayPN = moment(new Date(item.shiftDetails.date))
          .utcOffset(timeZoneP)
          .format('DD-MM-YYYY');
        item.shiftDetails.day = dayPN;
        if (
          !item.attendance ||
          (item.attendance && item.attendance.status != 2)
        ) {
          newResult.push(item);
        }
      }
    });
    if (newResult.length > 0) {
      newResult.forEach((item, index) => {
        if (item.shiftDetails.isExtendedShift) {
          const userId = item.userInfo._id;
          const extendData = item.shiftDetails.extendedStaff.find(
            (extendData) => {
              return (
                extendData.userId.toString() === userId.toString() &&
                extendData.confirmStatus === 2
              );
            },
          );
          if (extendData) {
            item.shiftDetails.extendedStaff = [];
            item.shiftDetails.extendedStaff[0] = extendData;
            item.shiftDetails.startTime = extendData.startDateTime;
            item.shiftDetails.endTime = extendData.endDateTime;
          } else {
            item.shiftDetails.extendedStaff = [];
          }
        }
        if (item.shiftDetails.isSplitShift) {
          newResult.some((splitItem, splitIndex) => {
            if (
              index !== splitIndex &&
              splitItem.shiftDetails.isSplitShift &&
              item.shiftDetails.shiftId.toString() ==
                splitItem.shiftDetails.shiftId.toString() &&
              new Date(item.shiftDetails.date).getTime() ==
                new Date(splitItem.shiftDetails.date).getTime() &&
              item.shiftDetails.confirmedStaffs.toString() ==
                splitItem.shiftDetails.confirmedStaffs.toString()
            ) {
              if (
                item.shiftDetails.startTime < splitItem.shiftDetails.startTime
              ) {
                console.log(item.shiftDetails.day);
                if (splitItem.attendance) {
                  item.splitAttendance = splitItem.attendance;
                }
                item.shiftDetails.splitShiftObj = splitItem.shiftDetails;
                newResult.splice(splitIndex, 1);
              } else {
                if (item.attendance) {
                  splitItem.splitAttendance = item.attendance;
                }
                splitItem.shiftDetails.splitShiftObj = item.shiftDetails;
                newResult.splice(index, 1);
              }
              return true;
            }
          });
        }
      });
      newResult.sort(function (a, b) {
        return a.shiftDetails.startTime && b.shiftDetails.startTime
          ? a.shiftDetails.startTime.getTime() -
              b.shiftDetails.startTime.getTime()
          : null;
      });
      // this.setRedisData(`${req.params.businessUnitId}timeDashboard`, newResult);
      return res.json({ status: 1, message: 'Data Found', data: newResult });
    } else {
      // this.setRedisData(`${req.params.businessUnitId}timeDashboard`, []);
      return res.json({ status: 2, message: 'No Data Found 11', data: null });
    }
  }
  async readUserForDashboard(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }
    FacialData.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(req.params.userID),
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      {
        $unwind: '$userInfo',
      },
      {
        $lookup: {
          from: 'appointments',
          localField: 'userInfo.appointmentId',
          foreignField: '_id',
          as: 'appointmentInfo',
        },
      },
      {
        $unwind: '$appointmentInfo',
      },
      {
        $project: {
          _id: 1,
          facialInfo: 1,
          userId: 1,
          'userInfo.name': 1,
          'userInfo.staffId': 1,
          'userInfo._id': 1,
          'userInfo.contactNumber': 1,
          'appointmentInfo.name': 1,
          'userInfo.appointmentId': 1,
        },
      },
    ])
      .then((results) => {
        console.log(new Date());
        let endDate = new Date();
        let startDate = new Date();
        let date = new Date(moment.utc().format());
        date = new Date(date.setHours(0, 0, 0, 0));
        console.log('date', endDate);
        endDate = endDate.setHours(date.getHours() + 36);
        endDate = new Date(endDate);
        startDate = startDate.setHours(date.getHours() - 12);
        startDate = new Date(startDate);
        console.log('enddate', endDate);
        console.log('startdate', startDate);
        if (results.length > 0) {
          const data = results[0];
          data.isFacial = true;
          console.log(req.params.shiftDetailId);
          ShiftDetails.aggregate([
            {
              $match: {
                _id: mongoose.Types.ObjectId(req.params.shiftDetailId),
              },
            },
            {
              $project: {
                date: 1,
                startTime: 1,
                endTime: 1,
                shiftId: 1,
                duration: 1,
                attendanceInfo: 1,
                isExtendedShift: 1,
                extendedStaff: 1,
              },
            },
          ])
            .then((shiftDetail) => {
              console.log('shiftDetail', shiftDetail);
              shiftDetail = JSON.stringify(shiftDetail);
              shiftDetail = JSON.parse(shiftDetail);
              let i = 0;
              async.eachSeries(shiftDetail, (item, next) => {
                this.getAttendance(item._id, req.params.userID).then(
                  (attendanceData) => {
                    console.log('aaaaa', attendanceData);
                    if (attendanceData) {
                      console.log('att', attendanceData);
                      item.attendance = attendanceData;
                    } else item.attendance = null;
                    if (shiftDetail.length - 1 === i) {
                      data.shiftDetail = shiftDetail;
                      this.sendReadUser(data, res);
                      //return res.json({status: 1, data: data})
                    }
                    i++;
                    next();
                  },
                );
              });
            })
            .catch((err) => {
              return res.json({
                status: 3,
                data: null,
                msg: 'Something went wrong',
                err,
              });
            });
        } else {
          const data = {};
          data.isFacial = false;
          User.aggregate([
            {
              $match: {
                _id: mongoose.Types.ObjectId(req.params.userID),
              },
            },
            {
              $lookup: {
                from: 'appointments',
                localField: 'appointmentId',
                foreignField: '_id',
                as: 'appointmentInfo',
              },
            },
            {
              $unwind: '$appointmentInfo',
            },
            {
              $project: {
                _id: 1,
                name: 1,
                staffId: 1,
                contactNumber: 1,
                'appointmentInfo.name': 1,
                appointmentId: 1,
              },
            },
          ]).then((userDetails) => {
            data.appointmentInfo = {};
            data.appointmentInfo.name = userDetails[0].appointmentInfo.name;
            delete userDetails[0].appointmentInfo;
            data.userInfo = userDetails[0];
            ShiftDetails.aggregate([
              {
                $match: {
                  _id: mongoose.Types.ObjectId(req.params.shiftDetailId),
                },
              },
              {
                $project: {
                  date: 1,
                  startTime: 1,
                  endTime: 1,
                  shiftId: 1,
                  duration: 1,
                  attendanceInfo: 1,
                },
              },
            ]).then((shiftDetail) => {
              if (shiftDetail.length > 0) {
                let i = 0;
                async.eachSeries(shiftDetail, (item, next) => {
                  this.getAttendance(item._id, req.params.userID).then(
                    (attendanceData) => {
                      if (attendanceData) item.attendance = attendanceData;
                      else item.attendance = null;
                      if (shiftDetail.length - 1 === i) {
                        data.message = 'No facial Info Found';
                        data.shiftDetail = shiftDetail;
                        this.sendReadUser(data, res);
                        //return res.json({status: 1, data:data});
                      }
                      i++;
                      next();
                    },
                  );
                });
              } else {
                data.message = 'No facial Info and Shift Data Found';
                data.shiftDetail = [];
                return res.json({ status: 2, data: data });
              }
            });
          });
        }
      })
      .catch((err) => {
        return res.send(err);
      });
  }
  async readUser(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }
    FacialData.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(req.params.userID),
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      {
        $unwind: '$userInfo',
      },
      {
        $lookup: {
          from: 'appointments',
          localField: 'userInfo.appointmentId',
          foreignField: '_id',
          as: 'appointmentInfo',
        },
      },
      {
        $unwind: '$appointmentInfo',
      },
      {
        $project: {
          _id: 1,
          facialInfo: 1,
          userId: 1,
          'userInfo._id': 1,
          'userInfo.name': 1,
          'userInfo.staffId': 1,
          'userInfo.contactNumber': 1,
          'appointmentInfo.name': 1,
          'userInfo.appointmentId': 1,
        },
      },
    ])
      .then((results) => {
        console.log(new Date());
        let endDate = new Date();
        let startDate = new Date();
        let date = new Date(moment.utc().format());
        date = new Date(date.setHours(0, 0, 0, 0));
        console.log('date', endDate);
        endDate = endDate.setHours(date.getHours() + 36);
        endDate = new Date(endDate);
        startDate = startDate.setHours(date.getHours() - 12);
        startDate = new Date(startDate);
        console.log('enddate', endDate);
        console.log('startdate', startDate);
        if (results.length > 0) {
          const data = results[0];
          data.isFacial = true;
          console.log(req.params.shiftDetailId);
          ShiftDetails.aggregate([
            {
              $match: {
                confirmedStaffs: {
                  $in: [mongoose.Types.ObjectId(req.params.userID)],
                },
                date: { $lte: endDate, $gte: startDate },
              },
            },
            {
              $project: {
                date: 1,
                startTime: 1,
                endTime: 1,
                shiftId: 1,
                duration: 1,
                attendanceInfo: 1,
              },
            },
          ])
            .then((shiftDetail) => {
              console.log('shiftDetail', shiftDetail);
              shiftDetail = JSON.stringify(shiftDetail);
              shiftDetail = JSON.parse(shiftDetail);
              let i = 0;
              async.eachSeries(shiftDetail, (item, next) => {
                this.getAttendance(item._id, req.params.userID).then(
                  (attendanceData) => {
                    if (attendanceData) item.attendance = attendanceData;
                    else item.attendance = null;
                    /* {  userId: null,
                                     shiftId: null,
                                     shiftDetailId: null,
                                     clockInDateTime:null,
                                     clockOutDateTime:null,
                                     attendanceTakenBy:null,
                                     attendanceMode:null,
                                     duration:0,
                                     totalBreakDuration:0,
                                     breakTime:[],
                                     businessUnitId:null,
                                     approval:{
                                         shift: false,
                                         clocked:false,
                                         neither: false,
                                         neitherMessage:null,
                                         approveClockInTime:null,
                                         approveClockOutTime:null,
                                         duration:0,
                                         totalBreakDuration:0,
                                         breakTime:[],
                                     },
                                     status: 0,
                                     IsLock: false
                                 };*/
                    if (shiftDetail.length - 1 === i) {
                      data.shiftDetail = shiftDetail;
                      this.sendReadUser(data, res);
                      //return res.json({status: 1, data: data})
                    }
                    i++;
                    next();
                  },
                );
              });
            })
            .catch((err) => {
              return res.json({
                status: 3,
                data: null,
                msg: 'Something went wrong',
                err,
              });
            });
        } else {
          const data = {};
          data.isFacial = false;
          User.aggregate([
            {
              $match: {
                _id: mongoose.Types.ObjectId(req.params.userID),
              },
            },
            {
              $lookup: {
                from: 'appointments',
                localField: 'appointmentId',
                foreignField: '_id',
                as: 'appointmentInfo',
              },
            },
            {
              $unwind: '$appointmentInfo',
            },
            {
              $project: {
                _id: 1,
                name: 1,
                staffId: 1,
                contactNumber: 1,
                'appointmentInfo.name': 1,
                appointmentId: 1,
              },
            },
          ]).then((userDetails) => {
            data.appointmentInfo = {};
            data.appointmentInfo.name = userDetails[0].appointmentInfo.name;
            delete userDetails[0].appointmentInfo;
            data.userInfo = userDetails[0];
            ShiftDetails.aggregate([
              {
                $match: {
                  confirmedStaffs: {
                    $in: [mongoose.Types.ObjectId(req.params.userID)],
                  },
                  date: { $lte: endDate, $gte: startDate },
                },
              },
              {
                $project: {
                  date: 1,
                  startTime: 1,
                  endTime: 1,
                  shiftId: 1,
                  duration: 1,
                  attendanceInfo: 1,
                },
              },
            ]).then((shiftDetail) => {
              if (shiftDetail.length > 0) {
                let i = 0;
                async.eachSeries(shiftDetail, (item, next) => {
                  this.getAttendance(item._id, req.params.userID).then(
                    (attendanceData) => {
                      if (attendanceData) item.attendance = attendanceData;
                      else item.attendance = null;
                      /*     {  userId: null,
                                                 shiftId: null,
                                                 shiftDetailId: null,
                                                 clockInDateTime:null,
                                                 clockOutDateTime:null,
                                                 attendanceTakenBy:null,
                                                 attendanceMode:null,
                                                 duration:0,
                                                 totalBreakDuration:0,
                                                 breakTime:[],
                                                 businessUnitId:null,
                                                 approval:{
                                                     shift: false,
                                                     clocked:false,
                                                     neither: false,
                                                     neitherMessage:null,
                                                     approveClockInTime:null,
                                                     approveClockOutTime:null,
                                                     duration:0,
                                                     totalBreakDuration:0,
                                                     breakTime:[],
                                                 },
                                                 status: 0,
                                                 IsLock: false
                                             };*/
                      if (shiftDetail.length - 1 === i) {
                        data.message = 'No facial Info Found';
                        data.shiftDetail = shiftDetail;
                        this.sendReadUser(data, res);
                        //return res.json({status: 1, data:data});
                      }
                      i++;
                      next();
                    },
                  );
                });
              } else {
                data.message = 'No facial Info and Shift Data Found';
                data.shiftDetail = [];
                return res.json({ status: 2, data: data });
              }
            });
          });
        }
      })
      .catch((err) => {
        return res.send(err);
      });
  }
  async readUserImage(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }
    const userFaceData = await FacialData.findOne({
      userId: req.params.userID,
    });
    return res.json({ userData: userFaceData });
  }
  async getAttendance(shiftId, userID) {
    return new Promise((resolve, reject) => {
      Attendance.findOne({ shiftDetailId: shiftId, userId: userID }).then(
        (data) => {
          console.log('data', data);
          resolve(data);
        },
      );
    });
  }
  async matchFace(req, res) {
    res.send('hey');
  }
  async qrCode(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }
    console.log(req.params.userId);
    try {
      let doc = await User.findOne({
        _id: mongoose.Types.ObjectId(req.params.userId),
      });
      if (doc === null) {
        __.log('Invalid staff id');
        res.json({ status: 1, message: 'Invalid staff Id', data: null });
        //__.out(res, 200, 'Invalid staff id');
      } else {
        console.log(new Date());
        let endDate = new Date();
        let startDate = new Date();
        console.log('date', endDate);
        endDate = endDate.setHours(endDate.getHours() + 12);
        endDate = new Date(endDate);
        startDate = startDate.setHours(startDate.getHours() - 12);
        startDate = new Date(startDate);
        console.log('date', endDate);
        console.log('start', startDate);
        ShiftDetails.findOne(
          {
            _id: mongoose.Types.ObjectId(req.params.shiftDetailId),
            confirmedStaffs: {
              $in: [mongoose.Types.ObjectId(req.params.userId)],
            },
          },
          { date: 1, startTime: 1, endTime: 1, shiftId: 1, duration: 1 },
        ).then((shiftDetail) => {
          if (shiftDetail) {
            const qrCode = `${req.params.userId}_${shiftDetail._id}_${shiftDetail.shiftId}`;
            const qrCodeObj = {
              qrCode,
              userId: req.params.userId,
              shiftId: shiftDetail.shiftId,
              shiftDetailId: shiftDetail._id,
            };
            console.log('req.params.userId', req.params.userId);
            QrCode.find({
              userId: mongoose.Types.ObjectId(req.params.userId),
              shiftId: mongoose.Types.ObjectId(shiftDetail.shiftId),
              status: 1,
              shiftDetailId: mongoose.Types.ObjectId(qrCodeObj.shiftDetailId),
            }).then((userQrData) => {
              console.log('userQrData', userQrData);
              if (userQrData.length > 0) {
                return res.json({
                  data: {
                    massage: 'QR already Generated',
                  },
                  status: 2,
                });
              }
              const qr = new QrCode(qrCodeObj);
              qr.save(qrCodeObj).then((result) => {});
              return res.json({ status: 1, data: { qrCode } });
            });
          } else {
            return res.json({
              status: 2,
              message: 'No Shift Data Found',
              data: null,
            });
          }
        });
      }
    } catch (err) {
      __.log(err);
      return res.json({ status: 3, shiftDetail: 'Something Went wrong' });
    }
  }
  async checkQrCodeStatus(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }
    QrCode.find({
      userId: mongoose.Types.ObjectId(req.params.userId),
      status: 1,
      shiftDetailId: mongoose.Types.ObjectId(req.params.shiftDetailId),
    })
      .then((result) => {
        if (result.length > 0) {
          return res.json({
            data: {
              qrCodePresent: true,
              message: 'Qr Code is persent',
            },
            status: 1,
          });
        }
        return res.json({
          data: {
            qrCodePresent: false,
            message: 'Qr code is not present',
          },
          status: 2,
        });
      })
      .catch((err) => {
        return res.json({
          data: {
            qrCodePresent: false,
            message: 'Something went wrong',
          },
          status: 3,
        });
      });
  }
  async timesheetData(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }
    // timesheet page businessUnitId+timeTimesheet
    console.log('******************');
    const redisKey = `${req.params.businessUnitId}timeTimesheet`;
    // const redisData = await redisClient.get(`${redisKey}`);
    // if (redisData) {
    //   return res.json({
    //     status: 1,
    //     message: 'Data Found',
    //     data: JSON.parse(redisData),
    //   });
    // }
    console.log('******************');
    let date = new Date(moment.utc().format());
    date = new Date(date.setHours(0, 0, 0, 0));
    let startDateTime = date.setHours(date.getHours() - 19);
    startDateTime = new Date(startDateTime).toUTCString();
    date = new Date(moment.utc().format());
    date = new Date(date.setHours(0, 0, 0, 0));
    let endDateTime = date.setHours(date.getHours() + 43);
    endDateTime = new Date(endDateTime).toUTCString();
    console.log('start', new Date(startDateTime), new Date(endDateTime));
    Shift.aggregate([
      {
        $match: {
          businessUnitId: mongoose.Types.ObjectId(req.params.businessUnitId),
          weekRangeStartsAt: {
            $lte: new Date(new Date(endDateTime).toISOString()),
          },
          weekRangeEndsAt: {
            $gte: new Date(new Date(startDateTime).toISOString()),
          },
        },
      },
      {
        $lookup: {
          from: 'shiftdetails',
          localField: '_id',
          foreignField: 'shiftId',
          as: 'shiftDetails',
        },
      },
      {
        $unwind: '$shiftDetails',
      },
      {
        $match: {
          'shiftDetails.status': 1,
          'shiftDetails.date': {
            $lte: new Date(new Date(endDateTime).toISOString()),
            $gte: new Date(new Date(startDateTime).toISOString()),
          },
          'shiftDetails.startTime': { $ne: null },
        },
      },
      {
        $unwind: '$shiftDetails.confirmedStaffs',
      },
      {
        $lookup: {
          from: 'users',
          localField: 'shiftDetails.confirmedStaffs',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      {
        $unwind: '$userInfo',
      },
      {
        $lookup: {
          from: 'schemes',
          localField: 'userInfo.schemeId',
          foreignField: '_id',
          as: 'schemeInfo',
        },
      },
      {
        $unwind: {
          path: '$schemeInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          businessUnitId: 1,
          weekRangeStartsAt: 1,
          weekRangeEndsAt: 1,
          'userInfo.name': 1,
          'userInfo._id': 1,
          'userInfo.staffId': 1,
          'userInfo.contactNumber': 1,
          'userInfo.appointmentId': 1,
          'userInfo.schemeId': 1,
          'shiftDetails.startTime': 1,
          'shiftDetails.endTime': 1,
          'shiftDetails.day': 1,
          'shiftDetails.date': 1,
          'shiftDetails._id': 1,
          'shiftDetails.shiftId': 1,
          'shiftDetails.duration': 1,
          'shiftDetails.isSplitShift': 1,
          'shiftDetails.confirmedStaffs': 1,
          'shiftDetails.isExtendedShift': 1,
          'shiftDetails.extendedStaff': 1,
          'shiftDetails.isAssignShift': 1,
          'schemeInfo.shiftSetup': 1,
        },
      },
    ])
      .then(async (results) => {
        //return res.json({ results })
        if (results.length > 0) {
          const final = [];
          for (let i = 0; i < results.length; i++) {
            final.push(this.getAttendanceDataForTimesheetData(results[i]));
          }
          const allData = await Promise.all(final);
          // return res.json({ allData })
          this.sendTimesheetData(allData, res, redisKey);
          // async.eachSeries(
          //     results, (item, next) => {
          //         //console.log('index', results.indexOf(item));
          //         const index = results.indexOf(item);
          //         if (item.userInfo) {
          //             Attendance.findOne({
          //                 userId: item.userInfo._id,
          //                 shiftDetailId: item.shiftDetails._id,
          //             }).then((attendance) => {
          //                 attendance = JSON.stringify(attendance);
          //                 attendance = JSON.parse(attendance);
          //                 item.attendance = attendance;
          //                 if (item.attendance.approval.breakTime.length === 0) {
          //                     item.attendance.approval.breakTime = null;
          //                 }
          //                 if (item.attendance.approval.breakTime.length === 1) {

          //                     if (!item.attendance.approval.breakTime[0]) {
          //                         item.attendance.approval.breakTime.length = 0;
          //                         item.attendance.approval.breakTime = null;
          //                     }
          //                 }
          //                 console.log('1');
          //                 if (index === results.length - 1) {
          //                     console.log("ressss", results.length);
          //                     // for(let i=results.length-1; i>=0; i--){
          //                     //    // console.log('infor loop', results[i].attendance);
          //                     //     console.log('iiii', i, results[i].attendance._id);
          //                     //     if(!results[i].attendance) {
          //                     //         console.log('ii', i)
          //                     //         results.splice(i, 1);
          //                     //     }
          //                     //
          //                     // }
          //                     return this.sendTimesheetData(results, res);
          //                     //results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});
          //                     //  return res.json({status: 1, message: 'Data Found', data: results});
          //                     // __.out(res, 200, results);
          //                 }
          //                 next();
          //             }).catch((err) => {
          //                 if (index === results.length - 1) {
          //                     // for(let i=results.length-1; i>=0; i--){
          //                     //   //  console.log('infor loop', results[i].attendance);
          //                     //     if(!results[i].attendance) {
          //                     //         results.splice(i, 1);
          //                     //     }
          //                     //
          //                     // }
          //                     return this.sendTimesheetData(results, res);
          //                     // results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});
          //                     // return res.json({status: 1, message: 'Data Found', data: results});
          //                     //__.out(res, 200, results);
          //                 }
          //                 next();
          //             });
          //         } else {
          //             if (index === results.length - 1) {
          //                 // for(let i=results.length-1; i>=0; i--){
          //                 //    // console.log('infor loop', results[i].attendance);
          //                 //     if(!results[i].attendance) {
          //                 //         results.splice(i, 1);
          //                 //     }
          //                 // }
          //                 return this.sendTimesheetData(results, res);
          //                 // results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});
          //                 //return res.json({status: 1, message: 'Data Found', data: results});
          //                 //__.out(res, 200, results);
          //             }
          //             next();
          //         }
          //     });
          console.log('2');
        } else {
          // this.setRedisData(`${req.params.businessUnitId}timeTimesheet`, []);
          return res.json({ status: 2, message: 'No Data Found', data: null });
        }
      })
      .catch((err) => {
        return res.json({
          status: 3,
          message: 'Something Went Wrong',
          data: null,
        });
      });
  }
  async getAttendanceDataForTimesheetData(item) {
    return new Promise((resolve, reject) => {
      if (item.userInfo) {
        Attendance.findOne({
          userId: item.userInfo._id,
          shiftDetailId: item.shiftDetails._id,
        })
          .then((attendance) => {
            if (attendance) {
              attendance = JSON.stringify(attendance);
              attendance = JSON.parse(attendance);
              item.attendance = attendance;
              if (item.attendance.approval.breakTime.length === 0) {
                item.attendance.approval.breakTime = null;
              }
              if (item.attendance.approval.breakTime.length === 1) {
                if (!item.attendance.approval.breakTime[0]) {
                  item.attendance.approval.breakTime.length = 0;
                  item.attendance.approval.breakTime = null;
                }
              }
              resolve(item);
            } else {
              resolve(item);
            }
          })
          .catch((err) => {
            resolve(null);
          });
      } else {
        resolve(null);
      }
    });
  }
  async sendReadUser(item, res) {
    try {
      if (item.shiftDetail.isExtendedShift) {
        console.log('inside');
        const userId = item.userInfo._id;
        const extendData = item.shiftDetail.extendedStaff.find((extendData) => {
          return (
            extendData.userId.toString() === userId.toString() &&
            extendData.confirmStatus === 2
          );
        });
        if (extendData) {
          item.shiftDetail.startTime = extendData.startDateTime;
          item.shiftDetail.endTime = extendData.endDateTime;
        }
      }
      return res.json({ status: 1, message: 'Data Found', data: item });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async sendTimesheetData(results, res, redisKey) {
    try {
      console.log('aaaher');
      results.sort(function (a, b) {
        return a &&
          a.shiftDetails &&
          a.shiftDetails.date &&
          b &&
          b.shiftDetails &&
          b.shiftDetails.date
          ? a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()
          : null;
      });
      results.sort(function (a, b) {
        return a &&
          a.shiftDetails &&
          a.shiftDetails.startTime &&
          b &&
          b.shiftDetails &&
          b.shiftDetails.startTime
          ? a.shiftDetails.startTime.getTime() -
              b.shiftDetails.startTime.getTime()
          : null;
      });
      const newArrayResult = [];
      results.forEach((item, index) => {
        if (item) {
          if (item.schemeInfo) {
            item.schemeInfo = item.schemeInfo.shiftSetup;
          }
          if (item.shiftDetails.isExtendedShift) {
            console.log('inside');
            const userId = item.userInfo._id;
            const extendData = item.shiftDetails.extendedStaff.find(
              (extendData) => {
                return (
                  extendData.userId.toString() === userId.toString() &&
                  extendData.confirmStatus === 2
                );
              },
            );
            if (extendData) {
              item.shiftDetails.extendedStaff = [];
              item.shiftDetails.extendedStaff[0] = extendData;
              //  item.shiftDetails.startTime = extendData.startDateTime;
              //item.shiftDetails.endTime = extendData.endDateTime;
            } else {
              item.shiftDetails.extendedStaff = [];
            }
          }
          if (!newArrayResult.includes(item)) {
            if (item.shiftDetails.isSplitShift) {
              console.log('aaaaa');
              let isFound = false;
              results.some((splitItem, splitIndex) => {
                if (
                  index !== splitIndex &&
                  splitItem.shiftDetails.isSplitShift &&
                  item.shiftDetails.shiftId.toString() ==
                    splitItem.shiftDetails.shiftId.toString() &&
                  new Date(item.shiftDetails.date).getTime() ==
                    new Date(splitItem.shiftDetails.date).getTime() &&
                  item.shiftDetails.confirmedStaffs.toString() ==
                    splitItem.shiftDetails.confirmedStaffs.toString()
                ) {
                  console.log('insplit');
                  isFound = true;
                  if (
                    item.shiftDetails.startTime <
                    splitItem.shiftDetails.startTime
                  ) {
                    item.position = 1;
                    splitItem.position = 2;
                    newArrayResult.push(item);
                    newArrayResult.push(splitItem);
                  } else {
                    item.position = 2;
                    splitItem.position = 1;
                    newArrayResult.push(splitItem);
                    newArrayResult.push(item);
                  }
                  return true;
                }
              });
              if (!isFound) {
                newArrayResult.push(item);
              }
            } else {
              newArrayResult.push(item);
            }
          }
        }
      });
      // this.setRedisData(`${redisKey}`, newArrayResult);
      return res.json({
        status: 1,
        message: 'Data Found',
        data: newArrayResult,
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async getHourType(schemeDetails, shiftDetails, isShiftExtented) {
    if (shiftDetails.isAssignShift) {
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
  }
  async checkBTLap(btStartTime, shiftObj) {
    if (
      new Date(btStartTime).getTime() > new Date(shiftObj.normalStartTime) &&
      new Date(btStartTime).getTime() < new Date(shiftObj.normalEndTime)
    ) {
      return 'no';
    } else if (
      new Date(btStartTime).getTime() > new Date(shiftObj.extendedStartTime) &&
      new Date(btStartTime).getTime() < new Date(shiftObj.extendedEndTime)
    ) {
      return 'yes';
    }
    return -1;
  }
  async checkLimit(userId, shiftDetails, attendanceObj, isShiftExtentend) {
    if (attendanceObj.breakTime.length > 0) {
      console.log('approve attend', JSON.stringify(attendanceObj));
      let schemeDetails = await User.findById(userId, {
        schemeId: 1,
        _id: 0,
      }).populate([
        {
          path: 'schemeId',
        },
      ]);
      schemeDetails = schemeDetails.schemeId;
      var hourTypeData = this.getHourType(
        schemeDetails,
        shiftDetails,
        isShiftExtentend,
      );
      let otDuration = 0;
      let normalDuration = 0;
      let normalBTDuration = 0;
      let otBTDuration = 0;
      if (isShiftExtentend) {
        let normalStartTime = shiftDetails.startTime;
        let normalEndTime = shiftDetails.endTime;
        let extendedStartTime = null;
        let extendedEndTime = null;
        let extendedStaff = shiftDetails.extendedStaff.filter((item) => {
          return item.userId.toString() == userId.toString();
        });
        if (extendedStaff.length > 0) {
          extendedStaff = extendedStaff[0];
          extendedStartTime = extendedStaff.startDateTime;
          extendedEndTime = extendedStaff.endDateTime;
        }
        let shiftObj = {
          normalStartTime,
          normalEndTime,
          extendedStartTime,
          extendedEndTime,
        };
        for (let i = 0; attendanceObj.breakTime.length; i++) {
          let btObj = attendanceObj.breakTime[i];
          let isExtendted = await this.checkBTLap(btObj.startTime, shiftObj);
          if (isExtendted == 'yes') {
            if (
              schemeDetails.shiftSetup.openShift &&
              schemeDetails.shiftSetup.openShift.allowShiftExtension.normal
            ) {
              normalDuration += btObj.duration; // normal
            } else {
              otDuration += btObj.duration; // ot
            }
          } else if (isExtendted == 'no') {
            if (
              schemeDetails.shiftSetup.openShift &&
              schemeDetails.shiftSetup.openShift.normal
            ) {
              normalDuration += btObj.duration; //normal normalDuration
            } else {
              otDuration += btObj.duration; // ot
            }
          }
        }
      } else {
        if (!hourTypeData.isOtHour) {
          normalDuration = attendanceObj.totalBreakDuration / 60; // in hours;
        } else {
          otDuration = attendanceObj.totalBreakDuration / 60;
        }
        // direct reduce  BT duration from hourtype
      }
      // reduce
      normalDuration = -1 * normalDuration;
      otDuration = -1 * otDuration;
      let va = await StaffLimit.update(
        { userId: userId, shiftDetailId: shiftDetails._id },
        { $inc: { normalDuration: normalDuration, otDuration: otDuration } },
      );
      console.log('ccccccccc ', va);
      {
        /*if(!hourTypeData.isOtHour){
                        normalDuration = shiftDetails.duration;
                    }else {
                        otDuration = shiftDetails.duration;
                    }
                    if(shiftDetails.isExtendedShift){
                        let extendedStaff = shiftDetails.extendedStaff.filter((item)=>{
                            return item.userId.toString() == userId.toString();
                        });
                        if(extendedStaff.length>0){
                            extendedStaff = extendedStaff[0];
                            if(schemeDetails.shiftSetup.openShift && schemeDetails.shiftSetup.openShift.normal){
                                normalDuration = extendedStaff.duration;
                            }else {
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
                    const data = await StaffLimit.find({userId: userId,
                        date: { $lte: new Date(new Date(lastDay).toISOString()),$gte: new Date(new Date(firstDay).toISOString()) },
                       }).lean();
                      // console.log('data', data);
                    let dailyDuration = shiftDetails.duration;
                    let weeklyDuration = shiftDetails.duration;
                    let monthlyDuration = shiftDetails.duration;
                    let weekNumber = shiftDetails.shiftId.weekNumber;
                    console.log('data', data.length)
                    let isPresent = false;
                    let staffLimitPresentData = {};
                    if(schemeDetails.shiftSetup.openShift && schemeDetails.shiftSetup.openShift.normal){
                    data.forEach((item)=>{
                       // console.log('new Date(item.date)', new Date(item.date))
                        if(new Date(item.date).getDate() == new Date(date).getDate()){
                            isPresent = true
                            staffLimitPresentData = item;
                            console.log('item.normalDuration', item.normalDuration)
                            dailyDuration+=item.normalDuration;
                        }
                        if(new Date(item.date).getMonth() == new Date(date).getMonth()){
                            monthlyDuration+= item.normalDuration;
                        }
                        console.log('item.weekNo', item.weekNumber);
                        console.log('sss', weekNumber)
                        if(item.weekNumber == weekNumber){
                            weeklyDuration+= item.normalDuration;
                        }
                    });
                }else {
                    // ot hr
                    data.forEach((item)=>{
                        // console.log('new Date(item.date)', new Date(item.date))
                         if(new Date(item.date).getDate() == new Date(date).getDate()){
                             isPresent = true
                             staffLimitPresentData = item;
                             dailyDuration+=item.otDuration;
                         }
                         if(new Date(item.date).getMonth() == new Date(date).getMonth()){
                             monthlyDuration+= item.otDuration;
                         }
                         console.log('item.weekNo', item.weekNumber);
                         console.log('sss', weekNumber)
                         if(item.weekNumber == weekNumber){
                             weeklyDuration+= item.otDuration;
                         }

                     });
                }
                    let isLimitExceed = false;
                    let dayLimit = schemeDetails.shiftSetup.limits.normalHr.day;
                    let weekLimit = schemeDetails.shiftSetup.limits.normalHr.week;;
                    let monthLimit = schemeDetails.shiftSetup.limits.normalHr.month;
                    let isAllow = monthLimit.alert;
                    if(isAllow){
                        console.log('isPresent', isPresent)
                        console.log('aaaaaaaaaaaaaaaaaaaaa',normalDuration, otDuration)
                        // add data to staff Limit
                        if(!isPresent){
                            console.log('aaaaaaaaaaaaaaaaaaaaa',normalDuration, otDuration)
                            const obj = {
                                userId: userId,
                                shiftId: shiftDetails.shiftId._id,
                                shiftDetailId:shiftDetails._id,
                                date:shiftDetails.date,
                                normalDuration:normalDuration,
                                otDuration:otDuration,
                                weekNumber:weekNumber,
                                businessUnitId:shiftDetails.shiftId.businessUnitId
                            }
                            var insertAppliedStaffs = await new StaffLimit(obj).save();
                            //console.log('dddd', insertAppliedStaffs)

                            // add new
                        }else {
                            // update
                            const upppp = await StaffLimit.findByIdAndUpdate(staffLimitPresentData._id, {$inc:{normalDuration:normalDuration, otDuration:otDuration}});
                           // console.log('upppp', upppp);
                        }
                    }
                    console.log('dayLimit', dayLimit, dailyDuration)
                    if(parseInt(dayLimit.value)<dailyDuration){
                        return {limit: true, message: 'Day limit excedds', flag:'day', details:dayLimit, status:dayLimit.alert?1:0}
                    }
                    if(parseInt(weekLimit.value)<weeklyDuration){
                        return {limit: true, message: 'Week limit excedds', flag:'week', details:weekLimit, status:dayLimit.alert?1:0}
                    }
                    if(parseInt(monthLimit.value)<monthlyDuration){
                        return {limit: true, message: 'Month limit excedds', flag:'month', details:monthLimit, status:dayLimit.alert?1:0}
                    }
                    */
      }
      return { limit: false, status: 1, message: '' };
    } else {
      return { limit: false, status: 1, message: '' };
    }
  }

  async approval(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      console.log(req.body);
      let limitData = {
        status: 1,
      };
      let isAbsent = false;
      if (req.body.isAbsent) {
        isAbsent = req.body.isAbsent;
      }
      let otHr = 0;
      let breakTimeForLimit = [];
      let isShiftExtentend = false;
      if (req.body.userInfo) {
        const body = req.body;
        //  if(body.isOt) {
        if (body.shift) {
          isShiftExtentend = true;
          const normalHr =
            (new Date(body.userInfo.shiftDetails.endTime) -
              new Date(body.userInfo.shiftDetails.startTime)) /
            (1000 * 60 * 60);
          const normalHrOT =
            (new Date(body.userInfo.shiftDetails.extendedStaff[0].endDateTime) -
              new Date(
                body.userInfo.shiftDetails.extendedStaff[0].startDateTime,
              )) /
            (1000 * 60 * 60);
          otHr = normalHrOT - normalHr;
          console.log(normalHr, normalHrOT, otHr);
        } else if (body.clocked) {
          const normalHr =
            (new Date(body.userInfo.shiftDetails.endTime) -
              new Date(body.userInfo.shiftDetails.startTime)) /
            (1000 * 60 * 60);
          const normalHrOT =
            (new Date(body.approveClockOutTime) -
              new Date(body.approveClockInTime)) /
            (1000 * 60 * 60);
          otHr = normalHrOT - normalHr;
          if (otHr < 0) {
            otHr = 0;
          }
        } else {
          // later check absent flag
          if (!body.isAbsent) {
            const normalHr =
              (new Date(body.userInfo.shiftDetails.endTime) -
                new Date(body.userInfo.shiftDetails.startTime)) /
              (1000 * 60 * 60);
            const normalHrOT =
              (new Date(body.approveClockOutTime) -
                new Date(body.approveClockInTime)) /
              (1000 * 60 * 60);
            otHr = normalHrOT - normalHr;
            if (otHr < 0) {
              otHr = 0;
            }
          }
        }
      }
      let status = 2;
      let totalBreakDuration = 0;
      let duration = 0;
      if (req.body.shift || req.body.clocked || req.body.neither) {
        status = 3;
        if (!isAbsent) {
          duration =
            (new Date(req.body.approveClockOutTime) -
              new Date(req.body.approveClockInTime)) /
            (1000 * 60 * 60);
          if (
            req.body.breakTime &&
            req.body.breakTime.length > 0 &&
            req.body.breakTime[0] != 0
          ) {
            req.body.breakTime.forEach((item) => {
              item.duration =
                (new Date(item.endTime) - new Date(item.startTime)) /
                (60 * 60 * 1000);
              totalBreakDuration = totalBreakDuration + item.duration;
            });
            breakTimeForLimit = req.body.breakTime;
          } else {
            req.body.breakTime = [];
            breakTimeForLimit = [];
          }
        }
      } else {
        req.body.neitherMessage = '';
        req.body.breakTime = [];
        req.body.approveClockInTime = '';
        req.body.approveClockOutTime = '';
      }
      console.log('durrr', duration);
      const shiftDetails = await ShiftDetails.findOne({
        _id: req.body.shiftDetailId,
      }).populate([
        {
          path: 'shiftId',
          select: 'businessUnitId',
        },
      ]);
      // const redisBuId = shiftDetails.shiftId.businessUnitId;
      if (req.body._id) {
        let btObj = [];
        let totalBT = 0;
        if (req.body.breakTime && req.body.breakTime.length > 0) {
          const btObjTemp = JSON.parse(JSON.stringify(req.body.breakTime));
          breakTimeForLimit = [];
          console.log('btObjTemp', btObjTemp);
          btObjTemp.forEach((btItem) => {
            // const startTimeDate = moment(btItem.startTime, 'MM-DD-YYYY HH:mm:ss Z').utc().format(),
            //     endTimeDate = moment(btItem.endTime, 'MM-DD-YYYY HH:mm:ss Z').utc().format();
            const startTimeDate = btItem.startTime;
            const endTimeDate = btItem.endTime;
            console.log(startTimeDate, endTimeDate);
            var diff = Math.abs(
              new Date(startTimeDate) - new Date(endTimeDate),
            );
            const min = Math.floor(diff / 1000 / 60); // diffrenece in min
            const duration =
              (new Date(btItem.endTime) - new Date(btItem.startTime)) /
              (60 * 60 * 1000);
            console.log('min', min);
            totalBT = totalBT + min;
            const obj = {
              startTime: new Date(startTimeDate),
              endTime: endTimeDate,
              duration: min,
            };
            btItem.duration = duration;
            breakTimeForLimit.push({ btItem });
            btObj.push(obj);
          });
        }
        console.log('btObjbtObj', btObj);
        // check here
        const attendanceObj = {
          shift: req.body.shift,
          clocked: req.body.clocked,
          neither: req.body.neither,
          neitherMessage: req.body.neitherMessage,
          duration: duration, // approve duration
          breakTime: breakTimeForLimit,
          approveClockInTime: req.body.approveClockInTime,
          approveClockOutTime: req.body.approveClockOutTime,
          status: status,
          otDuration: otHr,
          isAbsent: isAbsent,
          totalBreakDuration: totalBT,
        };
        limitData = await this.checkLimit(
          req.body.userId,
          shiftDetails,
          attendanceObj,
          isShiftExtentend,
        );
        Attendance.findOneAndUpdate(
          { _id: mongoose.Types.ObjectId(req.body._id) },
          {
            $set: {
              'approval.shift': req.body.shift,
              'approval.clocked': req.body.clocked,
              'approval.neither': req.body.neither,
              'approval.neitherMessage': req.body.neitherMessage,
              'approval.duration': duration,
              'approval.breakTime': req.body.breakTime,
              'approval.totalBreakDuration': totalBreakDuration,
              'approval.approveClockInTime': req.body.approveClockInTime,
              'approval.approveClockOutTime': req.body.approveClockOutTime,
              status: status,
              otDuration: otHr,
              isAbsent: isAbsent,
              breakTime: btObj,
              totalBreakDuration: totalBT,
            },
          },
          { new: true },
        )
          .then(async (result) => {
            if (result) {
              // const rR = await this.updateRedisSingle(
              //   result.businessUnitId,
              //   result.shiftDetailId,
              // );
              // console.log('rR', rR);
              // this.updateRedis(result.businessUnitId, 'add');
              return res.json({
                status: 1,
                message: 'Successfully Updated',
                data: result,
              });
              //__.out(res,200,result);
            } else {
              return res.json({
                status: 2,
                message: 'No attendance Found',
                data: null,
              });
              //__.out(res,200,'No attendance found');
            }
          })
          .catch((err) => {
            console.log(err);
            return res.json({
              status: 3,
              message: 'Something went wrong',
              data: null,
              err,
            });
            //__.out(res,500,'something went wrong');
          });
      } else {
        if (!isAbsent) {
          duration =
            (new Date(req.body.approveClockOutTime) -
              new Date(req.body.approveClockInTime)) /
            (1000 * 60 * 60);
        }
        req.body.approval = {
          shift: req.body.shift,
          clocked: req.body.clocked,
          neither: req.body.neither,
          duration,
          neitherMessage: req.body.neitherMessage,
          approveClockInTime: req.body.approveClockInTime,
          approveClockOutTime: req.body.approveClockOutTime,
        };
        req.body.status = status;
        req.body.otDuration = otHr;
        req.body.isAbsent = isAbsent;
        // check here
        const attendanceObj = {
          shift: req.body.shift,
          clocked: req.body.clocked,
          neither: req.body.neither,
          neitherMessage: req.body.neitherMessage,
          duration: duration, // approve duration
          breakTime: breakTimeForLimit,
          totalBreakDuration: totalBreakDuration,
          approveClockInTime: req.body.approveClockInTime,
          approveClockOutTime: req.body.approveClockOutTime,
          status: status,
          otDuration: otHr,
          isAbsent: isAbsent,
        };
        limitData = this.checkLimit(
          req.body.userId,
          shiftDetails,
          attendanceObj,
          isShiftExtentend,
        );
        new Attendance(req.body)
          .save()
          .then(async (re) => {
            // const rR = await this.updateRedisSingle(
            //   re.businessUnitId,
            //   re.shiftDetailId,
            // );
            // console.log('rR', rR);
            // this.updateRedis(re.businessUnitId, 'add');
            return res.json({
              status: 1,
              message: 'Successfully Added',
              data: re,
            });
          })
          .catch((e) => {
            return res.json({
              status: 3,
              message: 'Something went wrong',
              data: null,
              e,
            });
          });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async lock(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const result = await Attendance.findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(req.body._id) },
        {
          $set: {
            IsLock: true,
          },
        },
        { new: true },
      );
      if (result) {
        // const rR = await this.updateRedisSingle(
        //   result.businessUnitId,
        //   result.shiftDetailId,
        // );
        // console.log('rR', rR);
        // this.updateRedis(result.businessUnitId, 'add');
        return res.json({
          status: 1,
          message: 'Successfully Updated',
          data: result,
        });
        //__.out(res,200,result);
      } else {
        return res.json({
          status: 2,
          message: 'No attendance Found',
          data: null,
        });
        //__.out(res,200,'No attendance found');
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async timeSheetLock(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let searchQuery = {
        _id: mongoose.Types.ObjectId(req.body.staffId), // Default SATS as Company
        status: {
          $ne: 3,
        },
      };
      if (req.body.companyName) {
        let selectedCompany = await Company.findOne({
          name: {
            $regex: `^${req.body.companyName}$`,
            $options: 'i',
          },
          status: 1,
        }).lean();
        __.log(selectedCompany, 'selectedCompany');
        if (selectedCompany) {
          searchQuery.companyId = selectedCompany._id;
        } else {
          return __.out(res, 300, 'Company Not Found');
        }
      }
      User.findOne(searchQuery, { password: 1 }).then((userData) => {
        if (userData) {
          let validPassword = userData.validPassword(req.body.password);
          if (validPassword) {
            if (req.params.isLock === '1')
              return res.json({
                status: 1,
                message: 'Timesheet Is in Staff View',
              });
            return res.json({
              status: 2,
              message: 'Timesheet Is in Normal View',
            });
          } else {
            return res.json({ status: 0, message: 'Incorrect Password' });
          }
        } else {
          return res.json({ status: 0, message: 'User Not Found' });
        }
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async history(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      // 5cda857e94827c2775164834+his+2020-12-31+2021-01-06
      // {"startDate":"2020-12-31","endDate":"2021-01-06"}
      const redisKey = `${
        req.params.businessUnitId
      }his${req.body.startDate.replace(/-/g, '_')}${req.body.endDate.replace(
        /-/g,
        '_',
      )}`;
      // const redisData = await redisClient.get(`${redisKey}`);
      // if (redisData && req.body.isDefault) {
      //   console.log('DATATATATATA Present');
      //   return res.json({
      //     status: 1,
      //     message: 'Data Found',
      //     data: JSON.parse(redisData),
      //   });
      // }
      let startDateTime = new Date(req.body.startDate);
      startDateTime = startDateTime.setDate(startDateTime.getDate() - 1);
      startDateTime = new Date(startDateTime);
      let endDateTime = new Date(req.body.endDate);
      endDateTime = endDateTime.setDate(endDateTime.getDate());
      endDateTime = new Date(endDateTime);
      console.log('eee');
      console.log('endDateTime', startDateTime, endDateTime);
      console.log(
        'ISO ',
        new Date(new Date(endDateTime).toISOString()),
        new Date(new Date(startDateTime).toISOString()),
      );
      if (req.body.userId) {
        getDataAsPerUser(this);
      } else {
        const results = await Shift.aggregate([
          {
            $match: {
              businessUnitId: mongoose.Types.ObjectId(
                req.params.businessUnitId,
              ),
              weekRangeStartsAt: {
                $lte: new Date(new Date(endDateTime).toISOString()),
              },
              weekRangeEndsAt: {
                $gte: new Date(new Date(startDateTime).toISOString()),
              },
            },
          },
          {
            $lookup: {
              from: 'shiftdetails',
              localField: '_id',
              foreignField: 'shiftId',
              as: 'shiftDetails',
            },
          },
          {
            $unwind: '$shiftDetails',
          },
          {
            $match: {
              'shiftDetails.status': 1,
              'shiftDetails.date': {
                $lte: new Date(new Date(endDateTime).toISOString()),
                $gte: new Date(new Date(startDateTime).toISOString()),
              },
            },
          },
          {
            $unwind: '$shiftDetails.confirmedStaffs',
          },
          {
            $lookup: {
              from: 'users',
              localField: 'shiftDetails.confirmedStaffs',
              foreignField: '_id',
              as: 'userInfo',
            },
          },
          {
            $unwind: '$userInfo',
          },
          {
            $lookup: {
              from: 'schemes',
              localField: 'userInfo.schemeId',
              foreignField: '_id',
              as: 'schemeInfo',
            },
          },
          {
            $unwind: {
              path: '$schemeInfo',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              businessUnitId: 1,
              weekRangeStartsAt: 1,
              weekRangeEndsAt: 1,
              'userInfo.name': 1,
              'userInfo._id': 1,
              'userInfo.staffId': 1,
              'userInfo.contactNumber': 1,
              'userInfo.appointmentId': 1,
              'userInfo.schemeId': 1,
              'shiftDetails.startTime': 1,
              'shiftDetails.endTime': 1,
              'shiftDetails.day': 1,
              'shiftDetails.date': 1,
              'shiftDetails._id': 1,
              'shiftDetails.shiftId': 1,
              'shiftDetails.duration': 1,
              'shiftDetails.isSplitShift': 1,
              'shiftDetails.confirmedStaffs': 1,
              'shiftDetails.isExtendedShift': 1,
              'shiftDetails.extendedStaff': 1,
              'shiftDetails.isAssignShift': 1,
              'schemeInfo.shiftSetup': 1,
            },
          },
        ]);
        const len = results.length;
        console.log('len', len);
        const getAllData = [];
        if (len > 0) {
          for (let i = 0; i < len; i++) {
            getAllData.push(this.getAttendanceDataTimeSheet(results[i]));
          }
          const resultAll = await Promise.all(getAllData);
          //return res.json({ resultAll })
          this.sendTimesheetData(resultAll, res, redisKey);
        } else {
        }
      }
      function getDataAsPerUser(useThis) {
        console.log('insideuser');
        Shift.aggregate([
          {
            $match: {
              businessUnitId: mongoose.Types.ObjectId(
                req.params.businessUnitId,
              ),
              weekRangeStartsAt: {
                $lte: new Date(new Date(endDateTime).toISOString()),
              },
              weekRangeEndsAt: {
                $gte: new Date(new Date(startDateTime).toISOString()),
              },
            },
          },
          {
            $lookup: {
              from: 'shiftdetails',
              localField: '_id',
              foreignField: 'shiftId',
              as: 'shiftDetails',
            },
          },
          {
            $unwind: '$shiftDetails',
          },
          {
            $match: {
              'shiftDetails.status': 1,
              'shiftDetails.date': {
                $lte: new Date(new Date(endDateTime).toISOString()),
                $gte: new Date(new Date(startDateTime).toISOString()),
              },
            },
          },

          {
            $unwind: '$shiftDetails.confirmedStaffs',
          },
          {
            $match: {
              'shiftDetails.confirmedStaffs': mongoose.Types.ObjectId(
                req.body.userId,
              ),
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'shiftDetails.confirmedStaffs',
              foreignField: '_id',
              as: 'userInfo',
            },
          },
          {
            $unwind: '$userInfo',
          },
          {
            $lookup: {
              from: 'schemes',
              localField: 'userInfo.schemeId',
              foreignField: '_id',
              as: 'schemeInfo',
            },
          },
          {
            $unwind: {
              path: '$schemeInfo',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              businessUnitId: 1,
              weekRangeStartsAt: 1,
              weekRangeEndsAt: 1,
              'userInfo.name': 1,
              'userInfo._id': 1,
              'userInfo.staffId': 1,
              'userInfo.contactNumber': 1,
              'userInfo.appointmentId': 1,
              'userInfo.schemeId': 1,
              'shiftDetails.startTime': 1,
              'shiftDetails.endTime': 1,
              'shiftDetails.day': 1,
              'shiftDetails.date': 1,
              'shiftDetails._id': 1,
              'shiftDetails.shiftId': 1,
              'shiftDetails.duration': 1,
              'shiftDetails.confirmedStaffs': 1,
              'shiftDetails.isExtendedShift': 1,
              'shiftDetails.extendedStaff': 1,
              'shiftDetails.isAssignShift': 1,
              'schemeInfo.shiftSetup': 1,
            },
          },
        ])
          .then((results) => {
            if (results.length > 0) {
              async.eachSeries(results, (item, next) => {
                //console.log('index', results.indexOf(item));
                const index = results.indexOf(item);
                if (item.userInfo) {
                  Attendance.findOne({
                    userId: item.userInfo._id,
                    shiftDetailId: item.shiftDetails._id,
                  })
                    .then((attendance) => {
                      attendance = JSON.stringify(attendance);
                      attendance = JSON.parse(attendance);
                      item.attendance = attendance;
                      if (item.attendance.approval.breakTime.length === 0) {
                        item.attendance.approval.breakTime = null;
                      }
                      if (item.attendance.approval.breakTime.length === 1) {
                        if (!item.attendance.approval.breakTime[0]) {
                          item.attendance.approval.breakTime.length = 0;
                          item.attendance.approval.breakTime = null;
                        }
                      }
                      console.log('1');
                      if (index === results.length - 1) {
                        console.log('ressss', results.length);
                        // for(let i=results.length-1; i>=0; i--){
                        //    // console.log('infor loop', results[i].attendance);
                        //     console.log('iiii', i, results[i].attendance._id);
                        //     if(!results[i].attendance) {
                        //         console.log('ii', i)
                        //         results.splice(i, 1);
                        //     }
                        //
                        // }
                        return useThis.sendTimesheetData(results, res);
                        //results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});
                        //  return res.json({status: 1, message: 'Data Found', data: results});
                        // __.out(res, 200, results);
                      }
                      next();
                    })
                    .catch((err) => {
                      if (index === results.length - 1) {
                        // for(let i=results.length-1; i>=0; i--){
                        //   //  console.log('infor loop', results[i].attendance);
                        //     if(!results[i].attendance) {
                        //         results.splice(i, 1);
                        //     }
                        //
                        // }
                        return useThis.sendTimesheetData(results, res);
                        // results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});
                        // return res.json({status: 1, message: 'Data Found', data: results});
                        //__.out(res, 200, results);
                      }
                      next();
                    });
                } else {
                  if (index === results.length - 1) {
                    // for(let i=results.length-1; i>=0; i--){
                    //    // console.log('infor loop', results[i].attendance);
                    //     if(!results[i].attendance) {
                    //         results.splice(i, 1);
                    //     }
                    // }
                    return useThis.sendTimesheetData(results, res);
                    // results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});
                    //return res.json({status: 1, message: 'Data Found', data: results});
                    //__.out(res, 200, results);
                  }
                  next();
                }
              });
              console.log('2');
            } else {
              return res.json({
                status: 2,
                message: 'No Data Found',
                data: null,
              });
              // __.out(res,200,"No Data Found");
            }
          })
          .catch((err) => {
            return res.json({
              status: 3,
              message: 'Something Went Wrong',
              data: null,
            });
            // __.out(res,500,err);
          });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async getAttendanceDataTimeSheet(item) {
    return new Promise((resolve, reject) => {
      if (item.userInfo) {
        Attendance.findOne({
          userId: item.userInfo._id,
          shiftDetailId: item.shiftDetails._id,
        })
          .then((attendance) => {
            if (attendance) {
              attendance = JSON.stringify(attendance);
              attendance = JSON.parse(attendance);
              item.attendance = attendance;
              if (item.attendance.approval.breakTime.length === 0) {
                item.attendance.approval.breakTime = null;
              }
              if (item.attendance.approval.breakTime.length === 1) {
                if (!item.attendance.approval.breakTime[0]) {
                  item.attendance.approval.breakTime.length = 0;
                  item.attendance.approval.breakTime = null;
                }
              }
              resolve(item);
            } else {
              resolve(item);
            }
          })
          .catch((err) => {
            resolve(item);
          });
      } else {
        resolve(item);
      }
    });
  }
  async play(req, res) {
    /*  console.log(req.body.startDate);
          //moment(shiftObj.startTime, 'MM-DD-YYYY HH:mm:ss Z').utc().unix();
        //  var timeZone = moment.parseZone(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z').format('Z'),
          var    startDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z').utc().format();
          console.log(startDate);
         const d =  new Date('2018-04-22 22:15:00.000Z');
         console.log(d);
          res.json({a:new Date(startDate).getTime(), b: new Date(d).getTime(), startDate});*/
    // var json = [
    //     {
    //         "car": "Audi",
    //         "price": 40000,
    //         "color": "blue"
    //     }, {
    //         "car": "BMW",
    //         "price": 35000,
    //         "color": "black"
    //     }, {
    //         "car": "Porsche",
    //         "price": 60000,
    //         "color": "green"
    //     }
    // ];
    //
    // json2csv({data: json, fields: ['car', 'price', 'color']}, function(err, csv) {
    //     if (err) console.log(err);
    //     console.log(csv);
    //     res.send(csv);
    //     // fs.writeFile('file.csv', csv, function(err) {
    //     //     if (err) throw err;
    //     //     console.log('file saved');
    //     // });
    // });
    const ddd = moment('2019-05-30T04:00:00.000Z').format('MM/DD/YYYY HH:MM');
    res.send(ddd);
  }
  async timesheetDataExport(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      console.log(moment.utc().format());
      console.log();
      let date = new Date(moment.utc().format());
      date = new Date(date.setHours(0, 0, 0, 0));
      const startDate = new Date(moment.utc().format());
      const endDate = new Date(moment.utc().format());
      let startDateTime = date.setHours(date.getHours() - 19);
      startDateTime = new Date(startDateTime).toUTCString();
      date = new Date(moment.utc().format());
      date = new Date(date.setHours(0, 0, 0, 0));
      let endDateTime = date.setHours(date.getHours() + 43);
      endDateTime = new Date(endDateTime).toUTCString();
      console.log('start', new Date(startDateTime), new Date(endDateTime));
      console.log(
        'ISO ',
        new Date(new Date(endDateTime).toISOString()),
        new Date(new Date(startDateTime).toISOString()),
      );
      // ,
      //     weekRangeStartsAt: { $lte: new Date() },
      //     weekRangeEndsAt: {$gte: new Date()}
      Shift.aggregate([
        {
          $match: {
            businessUnitId: mongoose.Types.ObjectId(req.params.businessUnitId),
            weekRangeStartsAt: {
              $lte: new Date(new Date(endDateTime).toISOString()),
            },
            weekRangeEndsAt: {
              $gte: new Date(new Date(startDateTime).toISOString()),
            },
          },
        },
        {
          $lookup: {
            from: 'shiftdetails',
            localField: '_id',
            foreignField: 'shiftId',
            as: 'shiftDetails',
          },
        },
        {
          $unwind: '$shiftDetails',
        },
        {
          $match: {
            'shiftDetails.status': 1,
            'shiftDetails.date': {
              $lte: new Date(new Date(endDateTime).toISOString()),
              $gte: new Date(new Date(startDateTime).toISOString()),
            },
          },
        },

        {
          $unwind: '$shiftDetails.confirmedStaffs',
        },
        {
          $lookup: {
            from: 'users',
            localField: 'shiftDetails.confirmedStaffs',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        {
          $unwind: '$userInfo',
        },
        {
          $lookup: {
            from: 'schemes',
            localField: 'userInfo.schemeId',
            foreignField: '_id',
            as: 'schemeInfo',
          },
        },
        {
          $unwind: {
            path: '$schemeInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            businessUnitId: 1,
            weekRangeStartsAt: 1,
            weekRangeEndsAt: 1,
            'userInfo.name': 1,
            'userInfo._id': 1,
            'userInfo.staffId': 1,
            'userInfo.contactNumber': 1,
            'userInfo.appointmentId': 1,
            'userInfo.schemeId': 1,
            'shiftDetails.startTime': 1,
            'shiftDetails.endTime': 1,
            'shiftDetails.day': 1,
            'shiftDetails.date': 1,
            'shiftDetails._id': 1,
            'shiftDetails.shiftId': 1,
            'shiftDetails.timeZone': 1,
            'shiftDetails.duration': 1,
            'shiftDetails.confirmedStaffs': 1,
            'shiftDetails.isExtendedShift': 1,
            'shiftDetails.extendedStaff': 1,
            'schemeInfo.shiftSetup': 1,
          },
        },
      ])
        .then((results) => {
          if (results.length > 0) {
            async.eachSeries(results, (item, next) => {
              //console.log('index', results.indexOf(item));
              const index = results.indexOf(item);
              if (item.userInfo) {
                Attendance.findOne({
                  userId: item.userInfo._id,
                  shiftDetailId: item.shiftDetails._id,
                })
                  .then((attendance) => {
                    attendance = JSON.stringify(attendance);
                    attendance = JSON.parse(attendance);
                    item.attendance = attendance;
                    if (item.attendance.approval.breakTime.length === 0) {
                      item.attendance.approval.breakTime = null;
                    }
                    if (item.attendance.approval.breakTime.length === 1) {
                      if (!item.attendance.approval.breakTime[0]) {
                        item.attendance.approval.breakTime.length = 0;
                        item.attendance.approval.breakTime = null;
                      }
                    }
                    console.log('1');
                    if (index === results.length - 1) {
                      console.log('ressss', results.length);
                      // for(let i=results.length-1; i>=0; i--){
                      //    // console.log('infor loop', results[i].attendance);
                      //     console.log('iiii', i, results[i].attendance._id);
                      //     if(!results[i].attendance) {
                      //         console.log('ii', i)
                      //         results.splice(i, 1);
                      //     }
                      //
                      // }
                      return this.sendTimesheetDataExport(results, res);
                      //results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});

                      //  return res.json({status: 1, message: 'Data Found', data: results});
                      // __.out(res, 200, results);
                    }
                    next();
                  })
                  .catch((err) => {
                    if (index === results.length - 1) {
                      // for(let i=results.length-1; i>=0; i--){
                      //   //  console.log('infor loop', results[i].attendance);
                      //     if(!results[i].attendance) {
                      //         results.splice(i, 1);
                      //     }
                      //
                      // }
                      return this.sendTimesheetDataExport(results, res);
                      // results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});
                      // return res.json({status: 1, message: 'Data Found', data: results});
                      //__.out(res, 200, results);
                    }
                    next();
                  });
              } else {
                if (index === results.length - 1) {
                  // for(let i=results.length-1; i>=0; i--){
                  //    // console.log('infor loop', results[i].attendance);
                  //     if(!results[i].attendance) {
                  //         results.splice(i, 1);
                  //     }
                  // }
                  return this.sendTimesheetDataExport(results, res);
                  // results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});
                  //return res.json({status: 1, message: 'Data Found', data: results});
                  //__.out(res, 200, results);
                }
                next();
              }
            });
            console.log('2');
          } else {
            return res.json({
              status: 2,
              message: 'No Data Found',
              data: null,
            });
            // __.out(res,200,"No Data Found");
          }
        })
        .catch((err) => {
          return res.json({
            status: 3,
            message: 'Something Went Wrong',
            data: null,
          });
          // __.out(res,500,err);
        });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  getDuration(time) {
    if (time) {
      time = parseFloat(time);
      time = time * 1000 * 3600;
      const date = new Date(time);
      return '' + date.getUTCHours() + ':' + date.getUTCMinutes();
    } else {
      return '0';
    }
  }
  hourMin(date) {
    console.log('dateee', date);
    if (date) {
      const d = new Date(date);
      console.log(d.getHours(), d.getMinutes());
      return `${d.getHours()}:${d.getMinutes()}`;
    } else {
      return '';
    }
  }
  hourMinNew(date, timeZone = '+0800') {
    console.log('dateee', date);
    if (date) {
      return moment(date).utcOffset(timeZone).format('HH:mm');
    } else {
      return '';
    }
  }
  getDateFormat(date, timeZone) {
    if (date) {
      if (!timeZone) {
        timeZone = '+0800';
      }
      return moment(date).utcOffset(timeZone).format('DD/MM/YYYY HH:mm');
    }
    return '';
  }
  //     getDateFormatHrs(date,day) {
  //         if(date) {
  //             console.log("here date is: ",moment(date).format('MM/DD/YYYY  HH:MM'));
  //             let dates=new Date(date);
  //           // var dates= dt.toString();
  //            var DD = ("0" + dates.getDate()).slice(-2);
  // // getMonth returns month from 0
  //            var MM = ("0" + (dates.getMonth() + 1)).slice(-2);
  //            var YYYY = dates.getFullYear();
  //            var hh = ("0" + dates.getHours()).slice(-2);
  //            var mm = ("0" + dates.getMinutes()).slice(-2);
  //            var date1= day+" "+hh+":"+mm;
  //            // return moment(date).format('MM/DD/YYYY  HH:MM');
  //            return date1;
  //         }
  //         return '';
  //     }
  async sendTimesheetDataExport(results, res) {
    try {
      results.forEach((item) => {
        // console.log("item: ",item);
        if (item.schemeInfo) {
          item.schemeInfo = item.schemeInfo.shiftSetup;
        }
        if (item.shiftDetails.isExtendedShift) {
          console.log('inside');
          const userId = item.userInfo._id;
          const extendData = item.shiftDetails.extendedStaff.find(
            (extendData) => {
              return (
                extendData.userId.toString() === userId.toString() &&
                extendData.confirmStatus === 2
              );
            },
          );
          if (extendData) {
            item.shiftDetails.extendedStaff = [];
            item.shiftDetails.extendedStaff[0] = extendData;
            //  item.shiftDetails.startTime = extendData.startDateTime;
            //item.shiftDetails.endTime = extendData.endDateTime;
          } else {
            item.shiftDetails.extendedStaff = [];
          }
        }
      });
      //results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});
      const csvData = [];
      //            'Extended shift start',
      //             'Extended shift End',
      const keys = [
        'Date',
        'StaffId',
        'Staff Name',
        'Shift Start Time',
        'Shift End Time',
        'Extended Start Time',
        'Extended End Time',
        'ClockIn',
        'ClockOut',
        'Break 1 start',
        'Break 1 end',
        'Break 2 start',
        'Break 2 end',
        'Break 3 start',
        'Break 3 end',
        'Total Break Duration',
        'Approve Type',
        'Approve ClockIn',
        'Approve ClockOut',
        'Normal Hours',
        'Ot Hours',
        'Total Hours',
        'Approve Remark',
        'Absent',
      ];
      results.forEach((item) => {
        //console.log('aaa', JSON.stringify(results));
        console.log('date: ', item.shiftDetails.timeZone);
        let timeZone = item.shiftDetails.timeZone;
        if (!timeZone) {
          timeZone = '+0800';
        }
        const obj = {};
        var date = moment(item.shiftDetails.date)
          .utcOffset(timeZone)
          .format('D-MMM');
        obj['Date'] = date;
        obj['StaffId'] = item.userInfo.staffId;
        obj['Staff Name'] = item.userInfo.name;
        // console.log('aaaaa',obj.Date)
        // console.log('this.getDateFormat(item.shiftDetails.startTime)', this.getDateFormat(item.shiftDetails.startTime));
        obj['Shift Start Time'] = this.getDateFormat(
          item.shiftDetails.startTime,
          timeZone,
        );
        obj['Shift End Time'] = this.getDateFormat(
          item.shiftDetails.endTime,
          timeZone,
        );
        if (item.shiftDetails.extendedStaff.length > 0) {
          //console.log('it', item);
          //console.log('this.getDuration(item.attendance.approval.otDuration)',this.getDuration(item.attendance.otDuration));
          obj['Extended Start Time'] = this.getDateFormat(
            item.shiftDetails.extendedStaff[0].startDateTime,
            timeZone,
          );
          obj['Extended End Time'] = this.getDateFormat(
            item.shiftDetails.extendedStaff[0].endDateTime,
            timeZone,
          );
        } else {
          obj['Extended Start Time'] = '';
          obj['Extended End Time'] = '';
        }
        if (item.attendance && !item.attendance.isAbsent) {
          obj['ClockIn'] = this.getDateFormat(
            item.attendance.clockInDateTime,
            timeZone,
          );
          obj['ClockOut'] = this.getDateFormat(
            item.attendance.clockOutDateTime,
            timeZone,
          );
          if (item.attendance.breakTime.length > 0) {
            if (item.attendance.breakTime[0]) {
              obj['Break 1 start'] = this.hourMinNew(
                item.attendance.breakTime[0].startTime,
                timeZone,
              );
              obj['Break 1 end'] = this.hourMinNew(
                item.attendance.breakTime[0].endTime,
                timeZone,
              );
            } else {
              obj['Break 1 start'] = '';
              obj['Break 1 end'] = '';
            }
            if (item.attendance.breakTime[1]) {
              obj['Break 2 start'] = this.hourMinNew(
                item.attendance.breakTime[1].startTime,
                timeZone,
              );
              obj['Break 2 end'] = this.hourMinNew(
                item.attendance.breakTime[1].endTime,
                timeZone,
              );
            } else {
              obj['Break 2 start'] = '';
              obj['Break 2 end'] = '';
            }
            if (item.attendance.breakTime[2]) {
              obj['Break 3 start'] = this.hourMinNew(
                item.attendance.breakTime[2].startTime,
                timeZone,
              );
              obj['Break 3 end'] = this.hourMinNew(
                item.attendance.breakTime[2].endTime,
                timeZone,
              );
            } else {
              obj['Break 3 start'] = '';
              obj['Break 3 end'] = '';
            }
            obj['Total Break Duration'] = item.attendance.totalBreakDuration;
          } else {
            obj['Break 1 start'] = '';
            obj['Break 1 end'] = '';
            obj['Break 2 start'] = '';
            obj['Break 2 end'] = '';
            obj['Break 3 start'] = '';
            obj['Break 3 end'] = '';
            obj['Total Break Duration'] = 0;
          }
          if (
            item.attendance.approval &&
            (item.attendance.approval.neither ||
              item.attendance.approval.clocked ||
              item.attendance.approval.shift)
          ) {
            if (item.attendance.approval.neither) {
              obj['Approve Type'] = 'Neither';
            } else if (item.attendance.approval.clocked) {
              obj['Approve Type'] = 'Clocked';
            } else {
              obj['Approve Type'] = 'Shift';
            }
            obj['Approve ClockIn'] = this.getDateFormat(
              item.attendance.approval.approveClockInTime,
              timeZone,
            );
            obj['Approve ClockOut'] = this.getDateFormat(
              item.attendance.approval.approveClockOutTime,
              timeZone,
            );
            if (
              item.schemeInfo &&
              item.schemeInfo.openShift.allowShiftExtension.ot
            ) {
              obj['Normal Hours'] = this.getDuration(
                item.attendance.approval.duration - item.attendance.otDuration,
              );
              obj['Ot Hours'] = this.getDuration(item.attendance.otDuration);
            } else {
              obj['Normal Hours'] = this.getDuration(
                item.attendance.approval.duration,
              );
              obj['Ot Hours'] = 0;
            }
            obj['Total Hours'] = this.getDuration(
              item.attendance.approval.duration,
            );
            obj['Approve Remark'] = item.attendance.approval.neitherMessage;
          } else {
            obj['Approve Type'] = '';
            obj['Approve ClockIn'] = '';
            obj['Approve ClockOut'] = '';
            obj['Normal Hours'] = '';
            obj['Ot Hours'] = '';
            obj['Total Hours'] = '';
            obj['Approve Remark'] = '';
          }
          if (item.attendance && item.attendance.isAbsent) {
            obj['Absent'] = 'Yes';
          } else {
            obj['Absent'] = 'No';
          }
        } else {
          obj['ClockIn'] = '';
          obj['ClockOut'] = '';
          obj['Break 1 start'] = '';
          obj['Break 1 end'] = '';
          obj['Break 2 start'] = '';
          obj['Break 2 end'] = '';
          obj['Break 3 start'] = '';
          obj['Break 3 end'] = '';
          obj['Total Break Duration'] = 0;
          obj['Approve Type'] = '';
          obj['Approve ClockIn'] = '';
          obj['Approve ClockOut'] = '';
          obj['Normal Hours'] = '';
          obj['Ot Hours'] = '';
          obj['Total Hours'] = '';
          obj['Approve Remark'] = '';
          if (item.attendance && item.attendance.isAbsent) {
            obj['Absent'] = 'Yes';
          } else {
            obj['Absent'] = 'No';
          }
        }
        // console.log(Object.keys(obj));
        csvData.push(obj);
      });
      csvData.sort(function (a, b) {
        // console.log("a['Shift Start Time']",a['Shift Start Time'], moment(b['Shift Start Time'], 'DD/MM/YYYY HH:mm').valueOf()-moment(a['Shift Start Time', 'DD/MM/YYYY HH:mm']).valueOf())
        return (
          moment(a['Shift Start Time'], 'DD/MM/YYYY HH:mm').valueOf() -
          moment(b['Shift Start Time'], 'DD/MM/YYYY HH:mm').valueOf()
        );
      });
      //  return res.json({status: 1, message: 'Data Found', data: csvData});
      json2csv({ data: csvData, fields: keys }, function (err, csv) {
        if (err) console.log(err);
        // console.log(csv);
        //  res.send(csv);
        //  fs.writeFile('file.csv', csv, function(err) {
        //      if (err) throw err;
        //      console.log('file saved');
        //  });
        console.log('ashish file');
        res.setHeader(
          'Content-disposition',
          'attachment; filename=testing.csv',
        );
        res.set('Content-Type', 'application/csv');
        res.status(200).json({ csv, noData: true });
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async historyExport(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let startDateTime = req.body.startDate.split('-');
      startDateTime =
        startDateTime[1] + '-' + startDateTime[0] + '-' + startDateTime[2];
      let endDateTime = req.body.endDate.split('-');
      endDateTime =
        endDateTime[1] + '-' + endDateTime[0] + '-' + endDateTime[2];
      endDateTime = new Date(endDateTime);
      console.log('endDateTime', endDateTime);
      console.log('req', req.body);
      console.log('startDateTime', new Date(startDateTime));
      endDateTime = endDateTime.setDate(endDateTime.getDate() + 1);
      endDateTime = new Date(endDateTime);
      console.log('eee');
      console.log('endDateTime', endDateTime);
      if (req.body.userId) {
        getDataAsPerUser(this);
      } else {
        Shift.aggregate([
          {
            $match: {
              businessUnitId: mongoose.Types.ObjectId(
                req.params.businessUnitId,
              ),
              weekRangeStartsAt: {
                $lte: new Date(new Date(endDateTime).toISOString()),
              },
              weekRangeEndsAt: {
                $gte: new Date(new Date(startDateTime).toISOString()),
              },
            },
          },
          {
            $lookup: {
              from: 'shiftdetails',
              localField: '_id',
              foreignField: 'shiftId',
              as: 'shiftDetails',
            },
          },
          {
            $unwind: '$shiftDetails',
          },
          {
            $match: {
              'shiftDetails.status': 1,
              'shiftDetails.date': {
                $lte: new Date(new Date(endDateTime).toISOString()),
                $gte: new Date(new Date(startDateTime).toISOString()),
              },
            },
          },
          {
            $unwind: '$shiftDetails.confirmedStaffs',
          },
          {
            $lookup: {
              from: 'users',
              localField: 'shiftDetails.confirmedStaffs',
              foreignField: '_id',
              as: 'userInfo',
            },
          },
          {
            $unwind: '$userInfo',
          },
          {
            $lookup: {
              from: 'schemes',
              localField: 'userInfo.schemeId',
              foreignField: '_id',
              as: 'schemeInfo',
            },
          },
          {
            $unwind: {
              path: '$schemeInfo',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              businessUnitId: 1,
              weekRangeStartsAt: 1,
              weekRangeEndsAt: 1,
              'userInfo.name': 1,
              'userInfo._id': 1,
              'userInfo.staffId': 1,
              'userInfo.contactNumber': 1,
              'userInfo.appointmentId': 1,
              'userInfo.schemeId': 1,
              'shiftDetails.startTime': 1,
              'shiftDetails.endTime': 1,
              'shiftDetails.day': 1,
              'shiftDetails.date': 1,
              'shiftDetails._id': 1,
              'shiftDetails.shiftId': 1,
              'shiftDetails.timeZone': 1,
              'shiftDetails.duration': 1,
              'shiftDetails.confirmedStaffs': 1,
              'shiftDetails.isExtendedShift': 1,
              'shiftDetails.extendedStaff': 1,
              'schemeInfo.shiftSetup': 1,
            },
          },
        ])
          .then((results) => {
            if (results.length > 0) {
              async.eachSeries(results, (item, next) => {
                //console.log('index', results.indexOf(item));
                const index = results.indexOf(item);
                if (item.userInfo) {
                  Attendance.findOne({
                    userId: item.userInfo._id,
                    shiftDetailId: item.shiftDetails._id,
                  })
                    .then((attendance) => {
                      attendance = JSON.stringify(attendance);
                      attendance = JSON.parse(attendance);
                      item.attendance = attendance;
                      if (item.attendance.approval.breakTime.length === 0) {
                        item.attendance.approval.breakTime = null;
                      }
                      if (item.attendance.approval.breakTime.length === 1) {
                        if (!item.attendance.approval.breakTime[0]) {
                          item.attendance.approval.breakTime.length = 0;
                          item.attendance.approval.breakTime = null;
                        }
                      }
                      console.log('1');
                      if (index === results.length - 1) {
                        console.log('ressss', results.length);
                        // for(let i=results.length-1; i>=0; i--){
                        //    // console.log('infor loop', results[i].attendance);
                        //     console.log('iiii', i, results[i].attendance._id);
                        //     if(!results[i].attendance) {
                        //         console.log('ii', i)
                        //         results.splice(i, 1);
                        //     }
                        //
                        // }
                        return this.sendTimesheetDataExport(results, res);
                        //results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});
                        //  return res.json({status: 1, message: 'Data Found', data: results});
                        // __.out(res, 200, results);
                      }
                      next();
                    })
                    .catch((err) => {
                      if (index === results.length - 1) {
                        // for(let i=results.length-1; i>=0; i--){
                        //   //  console.log('infor loop', results[i].attendance);
                        //     if(!results[i].attendance) {
                        //         results.splice(i, 1);
                        //     }
                        //
                        // }
                        return this.sendTimesheetDataExport(results, res);
                        // results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});
                        // return res.json({status: 1, message: 'Data Found', data: results});
                        //__.out(res, 200, results);
                      }
                      next();
                    });
                } else {
                  if (index === results.length - 1) {
                    // for(let i=results.length-1; i>=0; i--){
                    //    // console.log('infor loop', results[i].attendance);
                    //     if(!results[i].attendance) {
                    //         results.splice(i, 1);
                    //     }
                    // }
                    return this.sendTimesheetDataExport(results, res);
                    // results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});
                    //return res.json({status: 1, message: 'Data Found', data: results});
                    //__.out(res, 200, results);
                  }
                  next();
                }
              });
              console.log('2');
            } else {
              return res.json({
                status: 2,
                message: 'No Data Found',
                data: null,
              });
              // __.out(res,200,"No Data Found");
            }
          })
          .catch((err) => {
            return res.json({
              status: 3,
              message: 'Something Went Wrong',
              data: null,
            });
            // __.out(res,500,err);
          });
      }

      function getDataAsPerUser(useThis) {
        console.log('insideuser');
        Shift.aggregate([
          {
            $match: {
              businessUnitId: mongoose.Types.ObjectId(
                req.params.businessUnitId,
              ),
              weekRangeStartsAt: {
                $lte: new Date(new Date(endDateTime).toISOString()),
              },
              weekRangeEndsAt: {
                $gte: new Date(new Date(startDateTime).toISOString()),
              },
            },
          },

          {
            $lookup: {
              from: 'shiftdetails',
              localField: '_id',
              foreignField: 'shiftId',
              as: 'shiftDetails',
            },
          },
          {
            $unwind: '$shiftDetails',
          },
          {
            $match: {
              'shiftDetails.date': {
                $lte: new Date(new Date(endDateTime).toISOString()),
                $gte: new Date(new Date(startDateTime).toISOString()),
              },
            },
          },

          {
            $unwind: '$shiftDetails.confirmedStaffs',
          },
          {
            $match: {
              'shiftDetails.confirmedStaffs': mongoose.Types.ObjectId(
                req.body.userId,
              ),
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'shiftDetails.confirmedStaffs',
              foreignField: '_id',
              as: 'userInfo',
            },
          },
          {
            $unwind: '$userInfo',
          },
          {
            $lookup: {
              from: 'schemes',
              localField: 'userInfo.schemeId',
              foreignField: '_id',
              as: 'schemeInfo',
            },
          },
          {
            $unwind: {
              path: '$schemeInfo',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              businessUnitId: 1,
              weekRangeStartsAt: 1,
              weekRangeEndsAt: 1,
              'userInfo.name': 1,
              'userInfo._id': 1,
              'userInfo.staffId': 1,
              'userInfo.contactNumber': 1,
              'userInfo.appointmentId': 1,
              'userInfo.schemeId': 1,
              'shiftDetails.startTime': 1,
              'shiftDetails.endTime': 1,
              'shiftDetails.day': 1,
              'shiftDetails.date': 1,
              'shiftDetails._id': 1,
              'shiftDetails.shiftId': 1,
              'shiftDetails.duration': 1,
              'shiftDetails.confirmedStaffs': 1,
              'shiftDetails.isExtendedShift': 1,
              'shiftDetails.extendedStaff': 1,
              'schemeInfo.shiftSetup': 1,
            },
          },
        ])
          .then((results) => {
            if (results.length > 0) {
              async.eachSeries(results, (item, next) => {
                //console.log('index', results.indexOf(item));
                const index = results.indexOf(item);
                if (item.userInfo) {
                  Attendance.findOne({
                    userId: item.userInfo._id,
                    shiftDetailId: item.shiftDetails._id,
                  })
                    .then((attendance) => {
                      attendance = JSON.stringify(attendance);
                      attendance = JSON.parse(attendance);
                      item.attendance = attendance;
                      if (item.attendance.approval.breakTime.length === 0) {
                        item.attendance.approval.breakTime = null;
                      }
                      if (item.attendance.approval.breakTime.length === 1) {
                        if (!item.attendance.approval.breakTime[0]) {
                          item.attendance.approval.breakTime.length = 0;
                          item.attendance.approval.breakTime = null;
                        }
                      }
                      console.log('1');
                      if (index === results.length - 1) {
                        console.log('ressss', results.length);
                        // for(let i=results.length-1; i>=0; i--){
                        //    // console.log('infor loop', results[i].attendance);
                        //     console.log('iiii', i, results[i].attendance._id);
                        //     if(!results[i].attendance) {
                        //         console.log('ii', i)
                        //         results.splice(i, 1);
                        //     }
                        //
                        // }
                        return useThis.sendTimesheetData(results, res);
                        //results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});

                        //  return res.json({status: 1, message: 'Data Found', data: results});
                        // __.out(res, 200, results);
                      }
                      next();
                    })
                    .catch((err) => {
                      if (index === results.length - 1) {
                        // for(let i=results.length-1; i>=0; i--){
                        //   //  console.log('infor loop', results[i].attendance);
                        //     if(!results[i].attendance) {
                        //         results.splice(i, 1);
                        //     }
                        //
                        // }
                        return useThis.sendTimesheetData(results, res);
                        // results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});
                        // return res.json({status: 1, message: 'Data Found', data: results});
                        //__.out(res, 200, results);
                      }
                      next();
                    });
                } else {
                  if (index === results.length - 1) {
                    // for(let i=results.length-1; i>=0; i--){
                    //    // console.log('infor loop', results[i].attendance);
                    //     if(!results[i].attendance) {
                    //         results.splice(i, 1);
                    //     }
                    // }
                    return useThis.sendTimesheetData(results, res);
                    // results.sort(function(a,b){return a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()});
                    //return res.json({status: 1, message: 'Data Found', data: results});
                    //__.out(res, 200, results);
                  }
                  next();
                }
              });
              console.log('2');
            } else {
              return res.json({
                status: 2,
                message: 'No Data Found',
                data: null,
              });
              // __.out(res,200,"No Data Found");
            }
          })
          .catch((err) => {
            return res.json({
              status: 3,
              message: 'Something Went Wrong',
              data: null,
            });
            // __.out(res,500,err);
          });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }

  async lockAllAtOnce(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let ids = req.body.ids;
      let successfullyLocked = [];
      let failedToLock = [];
      if (ids.length > 0) {
        for (let i = 0; i <= ids.length - 1; ids++) {
          Attendance.findOneAndUpdate(
            { _id: mongoose.Types.ObjectId(ids[i]) },
            {
              $set: {
                IsLock: true,
              },
            },
            { new: true },
          )
            .then((result) => {
              if (result) {
                successfullyLocked.push(result._id);
              } else {
                failedToLock.push(ids[i]);
              }
            })
            .catch((err) => {
              failedToLock.push(ids[i]);
            });
        }
        return res.json({
          status: 1,
          message: 'Successfully Updated',
          data: { success: successfullyLocked, failed: failedToLock },
        });
      } else {
        return res.json({
          status: 3,
          message: `You've entered malicious input`,
          data: null,
        });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
}
module.exports = new timeSheetController();
