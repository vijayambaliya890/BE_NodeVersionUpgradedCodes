const mongoose = require('mongoose'),
  Shift = require('../../models/shift'),
  ShiftDetails = require('../../models/shiftDetails'),
  ShiftLog = require('../../models/shiftLog'),
  User = require('../../models/user'),
  Attendance = require('../../models/attendance'),
  AttendanceLog = require('../../models/attendanceLog'),
  FacialData = require('../../models/facialData'),
  SubSection = require('../../models/subSection');
var moment = require('moment');
const redisData = require('../../../helpers/redisDataGenerator');
const CronJob = require('cron').CronJob;
const __ = require('../../../helpers/globalFunctions');
class attendanceController {
  async updateRedis(businessUnitId, from) {
    if (from !== 'add') {
      redisData.history(businessUnitId);
      redisData.readModifyAshish(businessUnitId);
      redisData.timesheetData(businessUnitId);
    }
  }
  async updateRedisSingle(res, businessUnitId, shiftDetailId) {
    try {
      // redisData.history(businessUnitId)
      console.log('before redis setting data');
      const ree = await Promise.all(
        [
          redisData.readModifyAshishSingleShift(businessUnitId, shiftDetailId),
          redisData.historySingle(businessUnitId, shiftDetailId),
        ],
        redisData.history(businessUnitId),
      );
      // const r = await redisData.readModifyAshishSingleShift(businessUnitId, shiftDetailId);
      // const p = await redisData.timesheetDataSingleShift(businessUnitId, shiftDetailId);
      console.log('after redis setting data', ree);
      return ree;
      // redisData.timesheetData(businessUnitId)
    } catch (err) {
      __.log(err);
      __.out(res, 500);
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
  async getLogs(req, res) {
    try {
      let data = await AttendanceLog.find(
        { businessUnitId: req.body.businessUnitId },
        {
          createdAt: 1,
          shiftDetailId: 1,
          attendanceMode: 1,
          status: 1,
          userId: 1,
          businessUnitId: 1,
        },
      ).populate([
        {
          path: 'userId',
          select: 'staffId name',
        },
        {
          path: 'businessUnitId',
          select: 'name sectionId',
          populate: {
            path: 'sectionId',
            select: 'name departmentId',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name status',
              },
            },
          },
        },
        {
          path: 'shiftDetailId',
          select: 'startTime endTime',
          populate: {
            path: 'reportLocationId',
            select: 'name',
          },
        },
      ]);
      const dataFormat = [];
      let timeZone = req.body.timeZone;
      data = JSON.parse(JSON.stringify(data));
      let keys = [];
      for (let i = 0; i < data.length; i++) {
        let item = data[i];
        item.name = item.userId.name;
        item.staffId = item.userId.staffId;
        item.buName =
          item.businessUnitId.sectionId.departmentId.companyId.name +
          ' > ' +
          item.businessUnitId.sectionId.departmentId.name +
          ' > ' +
          item.businessUnitId.sectionId.name +
          '> ' +
          item.businessUnitId.name;
        item.reportLocation = item.shiftDetailId.reportLocationId.name;
        item.shiftStartTime = this.getDateFormat(
          item.shiftDetailId.startTime,
          timeZone,
        ); // item.shiftDetailId.startTime;
        item.shiftEndTime = this.getDateFormat(
          item.shiftDetailId.endTime,
          timeZone,
        ); // item.shiftDetailId.endTime;
        item.createdAt = this.getDateFormat(item.createdAt, timeZone);
        delete item.shiftDetailId;
        delete item.businessUnitId;
        delete item.userId;
        delete item._id;
        delete item.status;
        if (i == 0) {
          keys = Object.keys(item);
        }
        dataFormat.push(item);
      }
      if (keys.length > 0) {
        json2csv({ data: dataFormat, fields: keys }, function (err, csv) {
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
            'attachment; filename=attendancelog.csv',
          );
          res.set('Content-Type', 'application/csv');
          res.status(200).json({ csv, noData: true });
        });
      } else {
        return res.json({ data: [] });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async add(req, res) {
    try {
      console.log(new Date());
      let endDate = new Date();
      let startDate = new Date();
      console.log('date', endDate);
      endDate = endDate.setHours(endDate.getHours() + 12);
      endDate = new Date(endDate);
      startDate = startDate.setHours(startDate.getHours() - 12);
      startDate = new Date(startDate);
      const shiftData = await Shift.findOne({ _id: req.body.shiftId });
      ShiftDetails.findOne(
        {
          confirmedStaffs: { $in: [mongoose.Types.ObjectId(req.body.userId)] },
          _id: mongoose.Types.ObjectId(req.body.shiftDetailId),
          shiftId: mongoose.Types.ObjectId(req.body.shiftId),
        },
        { date: 1, startTime: 1, endTime: 1, shiftId: 1, duration: 1 },
      )
        .then((shiftDetail) => {
          if (shiftDetail) {
            let shfitStartTime = new Date(shiftDetail.startTime);
            shfitStartTime = shfitStartTime.setDate(
              new Date(shfitStartTime).getDate() - 1,
            );
            console.log('shfitEndTime', new Date(shfitStartTime));
            var diff = new Date(shfitStartTime) - new Date();
            let min = Math.floor(diff / 1000 / 60);
            console.log('min1', min);
            if (shiftDetail.isExtendedShift) {
              const shiftExtendedObj = shiftDetail.extendedStaff.filter((i) => {
                return i.userId.toString() === req.body.userId;
              });
              if (shiftExtendedObj.length > 0) {
                let exshfitStartTime = new Date(
                  shiftExtendedObj[0].startDateTime,
                );
                var diff = new Date(exshfitStartTime) - new Date();
                min = Math.floor(diff / 1000 / 60);
              }
            }
            console.log('min2', min);
            //min < 60
            if (true) {
              Attendance.find({
                shiftDetailId: mongoose.Types.ObjectId(req.body.shiftDetailId),
                shiftId: mongoose.Types.ObjectId(req.body.shiftId),
                userId: mongoose.Types.ObjectId(req.body.userId),
              })
                .then(async (attendanceResult) => {
                  console.log(attendanceResult, 'attendanceResult');
                  if (attendanceResult.length === 0) {
                    if (req.body.attendanceMode === 'Facial Failed') {
                      req.body.status = 4;
                    } else if (req.body.attendanceMode === 'QR Failed') {
                      req.body.status = 5;
                    } else {
                      req.body.clockInDateTime = new Date();
                    }
                    console.log(
                      'req.body.clockInDateTime',
                      req.body.clockInDateTime,
                    );
                    delete req.body.breakTime;
                    new AttendanceLog(req.body)
                      .save()
                      .then((log) => {})
                      .catch((e) => {
                        console.log('eeee', e);
                      });
                    new Attendance(req.body).save().then(async (result) => {
                      console.log('clocking done ***************');
                      const rR = await this.updateRedisSingle(
                        res,
                        shiftData.businessUnitId,
                        req.body.shiftDetailId,
                      );
                      console.log('rR', rR);
                      console.log('after redis');
                      this.updateRedis(shiftData.businessUnitId, 'add');
                      if (req.body.status === 4) {
                        return res.json({
                          status: 4,
                          data: result,
                          message: req.body.attendanceMode,
                        });
                      }
                      return res.json({
                        status: 1,
                        data: result,
                        message: 'Attendance clock in',
                      });
                    });
                  } else {
                    return res.json({
                      status: 3,
                      data: null,
                      message: 'Something went wrong',
                    });
                    //return res.json({status:2, data: null, message: "Attendance already clock in"});
                  }
                })
                .catch((err) => {
                  return res.json({
                    status: 3,
                    data: null,
                    message: 'Something went wrong2',
                    err,
                  });
                });
            } else {
            }
          } else {
            return res.json({
              status: 2,
              data: null,
              message: 'Shift Not found',
            });
          }
        })
        .catch((err) => {
          return res.json({
            status: 3,
            data: null,
            message: 'Something went wrong1',
            err,
          });
        });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async autoApprove(req, res) {
    try {
      console.log('aa');
      let today = new Date();
      today = new Date(today.setHours(0, 0, 0, 0));
      let today1 = new Date();
      today1 = new Date(today1.setHours(0, 0, 0, 0));
      let yestrday = today1;
      today1 = new Date();
      today1 = new Date(today1.setHours(0, 0, 0, 0));
      let tommrow = today1;
      yestrday = new Date(yestrday.setDate(yestrday.getDate() - 1));
      tommrow = new Date(tommrow.setDate(tommrow.getDate() + 1));
      // status:2
      let attendanceData = await Attendance.find({ _id: req.body.id })
        .populate([
          {
            path: 'shiftDetailId',
            select: 'startTime endTime duration isExtendedShift extendedStaff',
          },
        ])
        .lean();
      attendanceData = JSON.parse(JSON.stringify(attendanceData));
      //return res.json({attendanceData})
      let buDataArr = [];
      const len = attendanceData.length;
      console.log('len', len);
      const approveAttandanceData = [];
      const otHr = 0;
      for (let ii = 0; ii < len; ii++) {
        let data = attendanceData[ii];
        // clocking after shift time
        const buId = data.businessUnitId;
        let buInfo = {};
        let buData = [];
        buData = buDataArr.filter((item) => {
          return item._id.toString() == buId.toString();
        });
        if (buData.length === 0) {
          console.log('aaaa');
          buInfo = await SubSection.findOne(
            { _id: buId },
            {
              breakInMinutes: 1,
              shiftTimeInMinutes: 1,
              isBreakTime: 1,
              shiftBreak: 1,
            },
          );
          buDataArr.push(buInfo);
        } else {
          buInfo = buData[0];
        }

        buInfo.breakInMinutes = 0;
        buInfo.shiftBreak.sort(function (a, b) {
          return a.shiftHour - b.shiftHour;
        });
        const breakTimeShiftBreak = buInfo.shiftBreak.filter((shiftB) => {
          return shiftB.shiftHour >= data.shiftDetailId.duration;
        });
        if (breakTimeShiftBreak.length > 0) {
          buInfo.breakInMinutes = breakTimeShiftBreak[0].breakInMinutes;
        }
        if (data.shiftDetailId.isExtendedShift) {
          const isStaffPresent = data.shiftDetailId.extendedStaff.filter(
            (isStaff) => {
              return isStaff.userId == data.userId;
            },
          );
          if (isStaffPresent.length > 0) {
            console.log('present hai');
            const normalHr =
              (new Date(data.shiftDetailId.endTime) -
                new Date(data.shiftDetailId.startTime)) /
              (1000 * 60 * 60);
            const normalHrOT =
              (new Date(isStaffPresent[0].endDateTime) -
                new Date(isStaffPresent[0].startDateTime)) /
              (1000 * 60 * 60);
            otHr = normalHrOT - normalHr;
            if (otHr < 0) {
              otHr = 0;
            }
            data.shiftDetailId.startTime = isStaffPresent[0].startDateTime;
            data.shiftDetailId.endTime = isStaffPresent[0].endDateTime;
          }
        }
        //if(new Date(data.clockInDateTime).getTime()> new Date(data.shiftDetailId.startTime).getTime()){
        var diff =
          new Date(data.clockInDateTime).getTime() -
          new Date(data.shiftDetailId.startTime).getTime();
        const diffMin = diff / 60000;
        let clockinDiff = diffMin;
        if (diffMin < 0) {
          clockinDiff = -1 * diffMin;
        }
        let clockoutDiff =
          new Date(data.clockOutDateTime).getTime() -
          new Date(data.shiftDetailId.endTime).getTime();
        clockoutDiff = clockoutDiff / 60000;
        let clockShiftDuration =
          new Date(data.clockOutDateTime).getTime() -
          new Date(data.clockInDateTime).getTime();
        clockShiftDuration = clockShiftDuration / 60000;
        let shiftDuration =
          new Date(data.shiftDetailId.endTime).getTime() -
          new Date(data.shiftDetailId.startTime).getTime();
        shiftDuration = shiftDuration / 60000;
        console.log('buInfo', buInfo.breakInMinutes, data.totalBreakDuration);
        console.log('clockoutDiff', clockoutDiff);
        console.log('clockin', clockinDiff);
        let shiftShortDuration = diffMin - clockoutDiff;
        console.log('shiftShortDuration', shiftShortDuration);
        // if(clockinDiff<=15&& shiftShortDuration<=15){
        if (clockoutDiff < 0) {
          clockoutDiff = -1 * clockoutDiff;
        }
        if (
          clockinDiff <= buInfo.shiftTimeInMinutes &&
          clockoutDiff <= buInfo.shiftTimeInMinutes &&
          (!buInfo.isBreakTime ||
            data.totalBreakDuration >= buInfo.breakInMinutes)
        ) {
          const breakTime = data.breakTime;
          breakTime.forEach((item) => {
            item.duration = item.duration / 60;
          });
          const obj = {
            attendanceId: data._id,
            otDuration: otHr,
            approval: {
              breakTime,
              totalBreakDuration: data.totalBreakDuration / 60,
              neither: false,
              clocked: false,
              isAutoApprove: true,
              shift: false,
              approveClockInTime: new Date(
                data.shiftDetailId.startTime,
              ).toISOString(),
              approveClockOutTime: new Date(
                data.shiftDetailId.endTime,
              ).toISOString(),
              duration: shiftDuration / 60, // in hr
              neitherMessage: '',
            },
          };
          console.log('aaaiiiii');
          //   const updateAtt = await Attendance.findOneAndUpdate({_id: mongoose.Types.ObjectId(data._id)}, {
          //         $set: {
          //             approval: obj.approval,
          //             status: 3,
          //             isAutoApprove: true
          //         }
          //     })
          approveAttandanceData.push(obj);
        }
      }
      return res.json({ buDataArr, attendanceData, approveAttandanceData });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async update(req, res) {
    try {
      console.log(req.body);
      delete req.body.userId;
      delete req.body.shiftDetailId;
      delete req.body._id;
      delete req.body.shiftId;
      const obj = req.body;
      if (req.body.attendanceMode === 'Facial Failed') {
        obj.status = 5;
      } else if (req.body.attendanceMode === 'Qr Failed') {
        obj.status = 6;
      } else {
        obj.status = 2;
        obj.clockOutDateTime = new Date();
      }
      Attendance.findById(req.body.attendanceId).then((attendanceInfo) => {
        let duration = null;
        if (obj.status === 2)
          duration =
            (new Date() - attendanceInfo.clockInDateTime) / (1000 * 60 * 60);
        Attendance.findOneAndUpdate(
          { _id: mongoose.Types.ObjectId(req.body.attendanceId) },
          {
            $set: {
              clockOutDateTime: obj.clockOutDateTime,
              status: obj.status,
              duration,
            },
          },
          { new: true },
        )
          .then(async (result) => {
            console.log('result', result);
            if (result) {
              let logs = JSON.parse(JSON.stringify(result));
              delete logs._id;
              console.log('##################################### beofre redis');
              const re = await this.updateRedisSingle(
                res,
                result.businessUnitId,
                result.shiftDetailId,
              );
              console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$ after redis', re);
              this.updateRedis(result.businessUnitId, 'add');
              new AttendanceLog(logs)
                .save()
                .then((log) => {
                  // console.log("logss", log);
                })
                .catch((e) => {
                  console.log('eeee', e);
                });
              if (obj.status === 2)
                return res.json({
                  status: 1,
                  data: result,
                  message: 'Attendance clock out successfully',
                });
              else
                return res.json({
                  status: obj.status,
                  data: result,
                  message: 'Attendance clock out failed',
                });
            } else
              return res.json({
                status: 2,
                data: null,
                message: 'No Clock in attendance found',
              });
          })
          .catch((err) => {
            return res.json({
              status: 3,
              data: null,
              message: 'something went wrong',
            });
          });
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async updateBreakTime(req, res) {
    try {
      //console.log(req.body);
      const obj = req.body;
      // let currentDate = new Date();
      // const enddd = new Date();
      // const startTime = obj.startTime.split(':');
      // const endTime = obj.endTime.split(':');
      var timeZone = moment
          .parseZone(req.body.startTime, 'MM-DD-YYYY HH:mm:ss Z')
          .format('Z'),
        startTimeDate = moment(req.body.startTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format(),
        endTimeDate = moment(req.body.endTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
      console.log(startTimeDate, endTimeDate);
      var diff = Math.abs(new Date(startTimeDate) - new Date(endTimeDate));
      const min = Math.floor(diff / 1000 / 60);
      console.log('min', min);
      ShiftDetails.findById(mongoose.Types.ObjectId(req.body.shiftDetailId), {
        extendedStaff: 1,
        isExtendedShift: 1,
        confirmedStaffs: 1,
        startTime: 1,
        endTime: 1,
      })
        .then((shiftInfo) => {
          // console.log(shiftInfo);
          let shfitEndTime = new Date(shiftInfo.endTime);
          shfitEndTime = shfitEndTime.setDate(new Date(shfitEndTime).getDate());
          console.log('shfitEndTime', new Date(shfitEndTime));
          // shfitEndTime = shfitEndTime.getTime();
          //const shfitStartTime = new Date(shiftInfo.startTime).getTime();
          let shfitStartTime = new Date(shiftInfo.startTime);
          shfitStartTime = shfitStartTime.setDate(
            new Date(shfitStartTime).getDate() - 1,
          );
          //  shfitStartTime = shfitStartTime.getTime();
          console.log('shfitStartTime', shfitStartTime);
          const shiftBreakStartTime = new Date(startTimeDate).getTime();
          const shiftBreakEndTime = new Date(endTimeDate).getTime();
          console.log('shfitEndTime', new Date(shfitEndTime));
          console.log('shiftBreakStartTime', new Date(shiftBreakStartTime));
          console.log('shiftBreakEndTime', new Date(shiftBreakEndTime));
          console.log('shfitStartTime', new Date(shfitStartTime));
          if (shiftInfo.isExtendedShift) {
            const shiftExtendedObj = shiftInfo.extendedStaff.filter((i) => {
              return (
                i.userId.toString() === req.body.userId && i.confirmStatus === 2
              );
            });
            if (shiftExtendedObj.length > 0) {
              let exshfitEndTime = new Date(shiftExtendedObj[0].endDateTime);
              //  exshfitEndTime = exshfitEndTime.setDate(new Date(exshfitEndTime).getDate()-1);
              exshfitEndTime = new Date(exshfitEndTime).getTime();
              let exshfitStartTime = new Date(
                shiftExtendedObj[0].startDateTime,
              ).getTime();

              //  exshfitStartTime = exshfitStartTime.setDate(new Date(exshfitStartTime).getDate()-1);
              exshfitStartTime = new Date(exshfitStartTime).getTime();
              console.log('exshfitEndTime', exshfitEndTime);
              console.log('shiftBreakStartTime', shiftBreakStartTime);
              console.log('exshfitStartTime', exshfitStartTime);
              console.log('shiftBreakEndTime', shiftBreakEndTime);
              if (
                minutesOfDay(exshfitEndTime) >=
                  minutesOfDay(shiftBreakStartTime) &&
                minutesOfDay(shiftBreakStartTime) >=
                  minutesOfDay(exshfitStartTime) &&
                minutesOfDay(exshfitEndTime) >=
                  minutesOfDay(shiftBreakEndTime) &&
                minutesOfDay(shiftBreakEndTime) >=
                  minutesOfDay(exshfitStartTime)
              ) {
                markBreakTime();
              } else {
                // markBreakTime()
                res.json({
                  status: 4,
                  message: 'Break Time should be between shift time',
                  data: null,
                });
              }
            } else {
              console.log('aaa');
              console.log('shfitEndTime', new Date(shfitEndTime));
              console.log('shiftBreakStartTime', new Date(shiftBreakStartTime));
              console.log('shiftBreakEndTime', new Date(shiftBreakEndTime));
              console.log('shfitStartTime', new Date(shfitStartTime));
              //return res.json({a:new Date(shfitEndTime), b:new Date(shiftBreakStartTime),c:new Date(shfitStartTime),d:new Date(shiftBreakEndTime) })
              if (
                minutesOfDay(shfitEndTime) >=
                  minutesOfDay(shiftBreakStartTime) &&
                minutesOfDay(shiftBreakStartTime) >=
                  minutesOfDay(shfitStartTime) &&
                minutesOfDay(shfitEndTime) >= minutesOfDay(shiftBreakEndTime) &&
                minutesOfDay(shiftBreakEndTime) >= minutesOfDay(shfitStartTime)
              ) {
                // return res.send('hey');
                markBreakTime();
              } else {
                //return res.send('hey1');
                //markBreakTime();
                res.json({
                  status: 4,
                  message: 'Break Time should be between shift time',
                  data: null,
                });
              }
            }
          } else {
            console.log('bbbb');
            console.log('shfitEndTime', minutesOfDay(shfitEndTime));
            console.log(
              'shiftBreakStartTime',
              minutesOfDay(shiftBreakStartTime),
            );
            console.log('shiftBreakEndTime', minutesOfDay(shiftBreakEndTime));
            console.log('shfitStartTime', minutesOfDay(shfitStartTime));
            if (
              minutesOfDay(shfitEndTime) >= minutesOfDay(shiftBreakStartTime) &&
              minutesOfDay(shiftBreakStartTime) >=
                minutesOfDay(shfitStartTime) &&
              minutesOfDay(shfitEndTime) >= minutesOfDay(shiftBreakEndTime) &&
              minutesOfDay(shiftBreakEndTime) >= minutesOfDay(shfitStartTime)
            ) {
              markBreakTime();
            } else {
              //markBreakTime()
              res.json({
                status: 4,
                message: 'Break Time should be between shift time',
                data: null,
              });
            }
          }
        })
        .catch((err) => {
          res.send(err);
        });

      function minutesOfDay(m) {
        //console.log(m);
        return new Date(m).getMinutes() + new Date(m).getHours() * 60;
      }
      function markBreakTime() {
        //        ,
        //         status: {$in:[1,3,4]}
        Attendance.findOne({
          userId: mongoose.Types.ObjectId(req.body.userId),
          shiftDetailId: mongoose.Types.ObjectId(req.body.shiftDetailId),
        })
          .then((attendanceData) => {
            if (attendanceData) {
              let isBreakTimeOverLap = false;
              if (
                attendanceData.breakTime &&
                attendanceData.breakTime.length > 0
              ) {
                attendanceData.breakTime.forEach((bt) => {
                  if (
                    (new Date(startTimeDate).getTime() >=
                      new Date(bt.startTime).getTime() &&
                      new Date(startTimeDate).getTime() <
                        new Date(bt.endTime).getTime()) ||
                    (new Date(endTimeDate).getTime() >=
                      new Date(bt.startTime).getTime() &&
                      new Date(endTimeDate).getTime() <=
                        new Date(bt.endTime).getTime())
                  ) {
                    isBreakTimeOverLap = true;
                  }
                });
              }
              if (!isBreakTimeOverLap) {
                Attendance.findOneAndUpdate(
                  {
                    userId: mongoose.Types.ObjectId(req.body.userId),
                    shiftDetailId: mongoose.Types.ObjectId(
                      req.body.shiftDetailId,
                    ),
                  },
                  {
                    $push: {
                      breakTime: {
                        startTime: new Date(startTimeDate),
                        endTime: endTimeDate,
                        duration: min,
                      },
                    },
                    $inc: { totalBreakDuration: min },
                  },
                  { new: true },
                )
                  .then(async (result) => {
                    //console.log('result', result);
                    if (result) {
                      await updateRedisSingle(
                        res,
                        result.businessUnitId,
                        result.shiftDetailId,
                      );
                      updateRedis(attendanceData.businessUnitId, 'add');
                      return res.json({
                        status: 1,
                        data: result,
                        message: 'Break Time Updated successfully',
                      });
                    } else
                      return res.json({
                        status: 2,
                        data: null,
                        message: 'No Clock in attendance found',
                      });
                  })
                  .catch((err) => {
                    return res.json({
                      status: 3,
                      data: null,
                      message: 'something went wrong',
                    });
                  });
              } else {
                return res.json({
                  status: 10,
                  data: null,
                  message: 'Break Time is overlapping',
                });
              }
            } else {
              return res.json({
                status: 2,
                data: null,
                message: 'No Clock in attendance found',
              });
            }
          })
          .catch((e) => {
            return res.json({
              status: 3,
              data: null,
              message: 'something went wrong',
            });
          });
        console.log('startTimeDate', startTimeDate, endTimeDate);
      }
      async function updateRedis(businessUnitId, from) {
        redisData.history(businessUnitId);
        if (from !== 'add') {
          redisData.readModifyAshish(businessUnitId);
          redisData.timesheetData(businessUnitId);
        }
      }
      async function updateRedisSingle(res, businessUnitId, shiftDetailId) {
        try {
          // redisData.history(businessUnitId)
          console.log('before redis setting data');
          const ree = await Promise.all([
            redisData.readModifyAshishSingleShift(
              businessUnitId,
              shiftDetailId,
            ),
            redisData.timesheetDataSingleShift(businessUnitId, shiftDetailId),
          ]);
          // const r = await redisData.readModifyAshishSingleShift(businessUnitId, shiftDetailId);
          // const p = await redisData.timesheetDataSingleShift(businessUnitId, shiftDetailId);
          console.log('after redis setting data', ree);
          return ree;
          // redisData.timesheetData(businessUnitId)
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
  async check(req, res) {
    try {
      Attendance.find(
        {
          userId: mongoose.Types.ObjectId(req.params.userId),
          shiftDetailId: mongoose.Types.ObjectId(req.params.shiftDetailId),
        },
        { status: 1, attendanceMode: 1 },
      )
        .then((result) => {
          console.log('res', result);
          if (result.length > 0) {
            return res.json({
              status: 1,
              data: result[0],
              message: 'Attendance Found Successfully',
            });
          } else {
            return res.json({
              status: 2,
              data: result,
              message: 'No Record found',
            });
          }
        })
        .catch((err) => {
          return res.json({
            status: 3,
            data: null,
            message: 'something went wrong',
          });
        });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  getShiftDetails(shiftId, shiftDetailId, userId) {
    return new Promise((resolve, reject) => {
      Shift.aggregate([
        {
          $match: {
            _id: mongoose.Types.ObjectId(shiftId),
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
            'shiftDetails._id': mongoose.Types.ObjectId(shiftDetailId),
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
        { $match: { 'userInfo._id': mongoose.Types.ObjectId(userId) } },
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
            'shiftDetails.startTime': 1,
            'shiftDetails.endTime': 1,
            'shiftDetails.day': 1,
            'shiftDetails.date': 1,
            'shiftDetails._id': 1,
            'shiftDetails.shiftId': 1,
            'shiftDetails.duration': 1,
            'shiftDetails.confirmedStaffs': 1,
            'shiftDetails.isExtendedShift': 1,
            'shiftDetails.isSplitShift': 1,
            'shiftDetails.isAssignShift': 1,
            'shiftDetails.extendedStaff': 1,
            'schemeInfo.shiftSetup': 1,
          },
        },
      ])
        .then((results) => {
          resolve(results);
        })
        .catch((err) => {
          resolve([]);
        });
    });
  }
  getDuration(time) {
    if (time) {
      time = parseFloat(time);
      time = time * 1000 * 3600;
      const date = new Date(time);
      let hh = date.getUTCHours();
      let min = '';
      if (date.getUTCMinutes() === 59) {
        min = 0;
        hh = hh + 1;
      } else {
        min = date.getUTCMinutes();
      }
      return '' + hh + 'h:' + min + 'min';
    } else {
      return '0';
    }
  }
  async getStaffAddendance(req, res) {
    try {
      console.log('here');
      let results = await this.getShiftDetails(
        req.params.shiftId,
        req.params.shiftDetailId,
        req.params.userId,
      );
      let resultSplit = [];
      if (req.params.splitShiftId !== '0') {
        resultSplit = await this.getShiftDetails(
          req.params.shiftId,
          req.params.splitShiftId,
          req.params.userId,
        );
      }
      if (results.length > 0) {
        results = results[0];
        Attendance.findOne({
          userId: results.userInfo._id,
          shiftDetailId: results.shiftDetails._id,
        })
          .then((attendance) => {
            if (results.shiftDetails.extendedStaff.length > 0) {
              results.shiftDetails.extendedStaff =
                results.shiftDetails.extendedStaff.filter((item) => {
                  return (
                    item.userId.toString() === req.params.userId &&
                    (item.confirmStatus == 1 || item.confirmStatus == 2)
                  );
                });
            }
            var otDuration = 0;
            var normalDuration = 0;
            results.attendance = attendance;
            if (
              results &&
              results.attendance &&
              (results.attendance.approval.neither ||
                results.attendance.approval.shift ||
                results.attendance.approval.clocked)
            ) {
              otDuration = results.attendance.otDuration;
              normalDuration =
                results.attendance.approval.duration - otDuration;
            }
            otDuration = this.getDuration(otDuration);
            normalDuration = this.getDuration(normalDuration);
            if (req.params.splitShiftId === '0') {
              return res.json({
                status: 1,
                message: 'Data Found',
                data: results,
                otDuration,
                normalDuration,
              });
            } else {
              results.splitShiftDetails = {};
              results.splitattendance = {};
              if (resultSplit.length > 0) {
                results.splitShiftDetails = resultSplit[0].shiftDetails;
                Attendance.findOne({
                  userId: results.userInfo._id,
                  shiftDetailId: results.splitShiftDetails._id,
                }).then((attendance1) => {
                  if (results.splitShiftDetails.extendedStaff.length > 0) {
                    results.splitShiftDetails.extendedStaff =
                      results.splitShiftDetails.extendedStaff.filter((item) => {
                        return item.userId.toString() === req.params.userId;
                      });
                  }
                  results.splitattendance = attendance1;
                  return res.json({
                    status: 1,
                    message: 'Data Found',
                    data: results,
                    otDuration,
                    normalDuration,
                  });
                });
              } else {
                var otDuration = 0;
                var normalDuration = 0;
                if (
                  results &&
                  results.attendance &&
                  (results.attendance.approval.neither ||
                    results.attendance.approval.shift ||
                    results.attendance.approval.clocked)
                ) {
                  otDuration = results.attendance.otDuration;
                  normalDuration =
                    results.attendance.approval.duration - otDuration;
                }
                otDuration = this.getDuration(otDuration);
                normalDuration = this.getDuration(normalDuration);
                return res.json({
                  status: 1,
                  message: 'Data Found',
                  data: results,
                  otDuration,
                  normalDuration,
                });
              }
              //return res.json({status: 1, message: 'Data Found Spplit', data: results});
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
        return res.json({ status: 2, message: 'Data Not Found', data: null });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async getBreakTime(req, res) {
    try {
      const shiftId = [];
      shiftId.push(req.params.shiftDetailId);
      console.log('req.params.splitShiftId', req.params.splitShiftId);
      if (req.params.splitShiftId !== '0') {
        shiftId.push(req.params.splitShiftId);
      }
      Attendance.find(
        {
          userId: mongoose.Types.ObjectId(req.params.userId),
          shiftDetailId: { $in: shiftId },
        },
        {
          status: 1,
          attendanceMode: 1,
          approval: 1,
          breakTime: 1,
          totalBreakDuration: 1,
          duration: 1,
        },
      )
        .then((result) => {
          console.log('res', result);
          if (result.length > 0) {
            //console.log(result[0].breakTime);
            //console.log(result[1].breakTime)
            if (result[1]) {
              result[0].breakTime = result[0].breakTime.concat(
                result[1].breakTime,
              );
            }
            return res.json({
              status: 1,
              data: result[0],
              message: 'Attendance Found Successfully',
            });
          } else {
            return res.json({
              status: 2,
              data: result,
              message: 'No Record found',
            });
          }
        })
        .catch((err) => {
          return res.json({
            status: 3,
            data: null,
            message: 'something went wrong',
          });
        });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async deleteBreakTime(req, res) {
    try {
      console.log(req.body);
      Attendance.findOne({
        _id: req.body.attendanceId,
        breakTime: { $elemMatch: { _id: req.body.breakId } },
      }).then((attendanceObj) => {
        if (attendanceObj && attendanceObj.status === 1) {
          let matchBreakTime = {};
          const breakTimeArr = attendanceObj.breakTime.filter((item) => {
            if (item._id.toString() === req.body.breakId) {
              matchBreakTime = item;
            }
            return item._id.toString() !== req.body.breakId;
          });
          attendanceObj.totalBreakDuration -= matchBreakTime.duration;
          attendanceObj.breakTime = breakTimeArr;
          Attendance.replaceOne(
            { _id: req.body.attendanceId },
            attendanceObj,
          ).then((result) => {
            res.json({ success: true, message: 'Break Delete Successfully' });
          });
        } else {
          res.json({
            success: false,
            message: 'Break time not found or attendance already clock out',
          });
        }
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async updateBreakTimeSplit(req, res) {
    try {
      const obj = req.body;
      console.log('sss', req.body.startTime);
      var timeZone = moment
          .parseZone(req.body.startTime, 'MM-DD-YYYY HH:mm:ss Z')
          .format('Z'),
        startTimeDate = moment(req.body.startTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format(),
        endTimeDate = moment(req.body.endTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
      console.log(startTimeDate, endTimeDate);
      let startDate = moment(req.body.startTime, 'MM-DD-YYYY HH:mm:ss Z')
        .utc()
        .format();
      console.log('startDate before', startDate);
      startDate = new Date(startDate).setHours(0, 0, 0, 0);
      console.log('startDate after', new Date(startDate));
      var diff = Math.abs(new Date(startTimeDate) - new Date(endTimeDate));
      const min = Math.floor(diff / 1000 / 60);
      console.log('min', min);
      ShiftDetails.find(
        { _id: { $in: req.body.shiftIds }, confirmedStaffs: req.body.userId },
        {
          extendedStaff: 1,
          isExtendedShift: 1,
          confirmedStaffs: 1,
          startTime: 1,
          endTime: 1,
        },
      )
        .then((shiftInfo) => {
          console.log('shiftinfo', shiftInfo);
          if (shiftInfo.length > 0) {
            let shiftStartDate = new Date(shiftInfo[0].startTime).setHours(
              0,
              0,
              0,
              0,
            );
            console.log(
              'startDate11',
              shiftStartDate,
              new Date(shiftStartDate),
            );
            //  if(startDate === shiftStartDate) {
            if (
              shiftInfo[0] &&
              minutesOfDay(shiftInfo[0].endTime) >=
                minutesOfDay(startTimeDate) &&
              minutesOfDay(startTimeDate) >=
                minutesOfDay(shiftInfo[0].startTime) &&
              minutesOfDay(shiftInfo[0].endTime) >= minutesOfDay(endTimeDate) &&
              minutesOfDay(endTimeDate) >= minutesOfDay(shiftInfo[0].startTime)
            ) {
              markBreakTime(shiftInfo[0]._id);
              console.log('infirst shift');
            } else if (
              shiftInfo[1] &&
              minutesOfDay(shiftInfo[1].endTime) >=
                minutesOfDay(startTimeDate) &&
              minutesOfDay(startTimeDate) >=
                minutesOfDay(shiftInfo[1].startTime) &&
              minutesOfDay(shiftInfo[1].endTime) >= minutesOfDay(endTimeDate) &&
              minutesOfDay(endTimeDate) >= minutesOfDay(shiftInfo[1].startTime)
            ) {
              markBreakTime(shiftInfo[1]._id);
              console.log('in second shift');
            } else {
              res.json({
                status: false,
                message: 'Break Time is Not between shift',
              });
            }
            //res.send(shiftInfo);
            // } else {
            //     res.json({status: false, message: 'Break Time is Not between shift2'})
            // }
          } else {
            res.json({
              status: false,
              message: 'No Shift Found with this staff',
            });
          }
        })
        .catch((err) => {
          res.send(err);
        });

      function minutesOfDay(m) {
        //console.log(m);
        return new Date(m).getMinutes() + new Date(m).getHours() * 60;
      }
      function markBreakTime(shiftDetailId) {
        //        ,
        //         status: {$in:[1,3,4]}
        Attendance.findOneAndUpdate(
          {
            userId: mongoose.Types.ObjectId(req.body.userId),
            shiftDetailId: mongoose.Types.ObjectId(shiftDetailId),
          },
          {
            $push: {
              breakTime: {
                startTime: new Date(startTimeDate),
                endTime: endTimeDate,
                duration: min,
              },
            },
            $inc: { totalBreakDuration: min },
          },
          { new: true },
        )
          .then(async (result) => {
            console.log('result', result);
            if (result) {
              await this.updateRedisSingle(
                res,
                result.businessUnitId,
                result.shiftDetailId,
              );
              this.updateRedis(result.businessUnitId, 'add');
              return res.json({
                status: 1,
                data: result,
                message: 'Break Time Updated successfully',
              });
            } else
              return res.json({
                status: 2,
                data: null,
                message: 'No Clock in attendance found for this shift',
              });
          })
          .catch((err) => {
            return res.json({
              status: 3,
              data: null,
              message: 'something went wrong',
            });
          });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
}
async function autoApproveCron() {
  try {
    console.log('aa');
    let today = new Date();
    let otHr = '';
    today = new Date(today.setHours(0, 0, 0, 0));
    let today1 = new Date();
    today1 = new Date(today1.setHours(0, 0, 0, 0));
    let yestrday = today1;
    today1 = new Date();
    today1 = new Date(today1.setHours(0, 0, 0, 0));
    let tommrow = today1;
    yestrday = new Date(yestrday.setDate(yestrday.getDate() - 1));
    tommrow = new Date(tommrow.setDate(tommrow.getDate() + 1));
    // status:2
    let attendanceData = await Attendance.find({
      status: 2,
      createdAt: { $gte: yestrday, $lte: tommrow },
    })
      .populate([
        {
          path: 'shiftDetailId',
          select: 'startTime endTime duration isExtendedShift extendedStaff',
        },
      ])
      .lean();
    attendanceData = JSON.parse(JSON.stringify(attendanceData));
    let buDataArr = [];
    const len = attendanceData.length;
    console.log('len', len);
    const approveAttandanceData = [];
    for (let ii = 0; ii < len; ii++) {
      const data = attendanceData[ii];
      // clocking after shift time
      const buId = data.businessUnitId;
      let buInfo = {};
      let buData = [];
      buData = buDataArr.filter((item) => {
        return item._id.toString() == buId.toString();
      });
      if (buData.length === 0) {
        console.log('aaaa');
        buInfo = await SubSection.findOne(
          { _id: buId },
          {
            breakInMinutes: 1,
            shiftTimeInMinutes: 1,
            isBreakTime: 1,
            shiftBreak: 1,
          },
        );
        buDataArr.push(buInfo);
      } else {
        buInfo = buData[0];
      }

      buInfo.breakInMinutes = 0;
      buInfo.shiftBreak.sort(function (a, b) {
        return a.shiftHour - b.shiftHour;
      });
      const breakTimeShiftBreak = buInfo.shiftBreak.filter((shiftB) => {
        return shiftB.shiftHour >= data.shiftDetailId.duration;
      });
      if (breakTimeShiftBreak.length > 0) {
        buInfo.breakInMinutes = breakTimeShiftBreak[0].breakInMinutes;
      }
      if (data.shiftDetailId.isExtendedShift) {
        const isStaffPresent = data.shiftDetailId.extendedStaff.filter(
          (isStaff) => {
            return isStaff.userId == data.userId;
          },
        );
        if (isStaffPresent.length > 0) {
          console.log('present hai');
          const normalHr =
            (new Date(data.shiftDetailId.endTime) -
              new Date(data.shiftDetailId.startTime)) /
            (1000 * 60 * 60);
          const normalHrOT =
            (new Date(isStaffPresent[0].endDateTime) -
              new Date(isStaffPresent[0].startDateTime)) /
            (1000 * 60 * 60);
          otHr = normalHrOT - normalHr;
          if (otHr < 0) {
            otHr = 0;
          }
          data.shiftDetailId.startTime = isStaffPresent[0].startDateTime;
          data.shiftDetailId.endTime = isStaffPresent[0].endDateTime;
        }
      }
      //if(new Date(data.clockInDateTime).getTime()> new Date(data.shiftDetailId.startTime).getTime()){
      var diff =
        new Date(data.clockInDateTime).getTime() -
        new Date(data.shiftDetailId.startTime).getTime();
      const diffMin = diff / 60000;
      let clockinDiff = diffMin;
      if (diffMin < 0) {
        clockinDiff = -1 * diffMin;
      }
      let clockoutDiff =
        new Date(data.clockOutDateTime).getTime() -
        new Date(data.shiftDetailId.endTime).getTime();
      clockoutDiff = clockoutDiff / 60000;
      let clockShiftDuration =
        new Date(data.clockOutDateTime).getTime() -
        new Date(data.clockInDateTime).getTime();
      clockShiftDuration = clockShiftDuration / 60000;
      let shiftDuration =
        new Date(data.shiftDetailId.endTime).getTime() -
        new Date(data.shiftDetailId.startTime).getTime();
      shiftDuration = shiftDuration / 60000;
      let shiftShortDuration = diffMin - clockoutDiff;
      // if(clockinDiff<=15&& shiftShortDuration<=15){
      if (clockoutDiff < 0) {
        clockoutDiff = -1 * clockoutDiff;
      }
      if (
        clockinDiff <= buInfo.shiftTimeInMinutes &&
        clockoutDiff <= buInfo.shiftTimeInMinutes &&
        (!buInfo.isBreakTime ||
          data.totalBreakDuration >= buInfo.breakInMinutes)
      ) {
        const breakTime = data.breakTime;
        breakTime.forEach((item) => {
          item.duration = item.duration / 60;
        });
        const obj = {
          attendanceId: data._id,
          otDuration: otHr,
          approval: {
            breakTime,
            totalBreakDuration: data.totalBreakDuration / 60,
            neither: false,
            clocked: false,
            isAutoApprove: true,
            shift: false,
            approveClockInTime: new Date(
              data.shiftDetailId.startTime,
            ).toISOString(),
            approveClockOutTime: new Date(
              data.shiftDetailId.endTime,
            ).toISOString(),
            duration: shiftDuration / 60, // in hr
            neitherMessage: '',
          },
        };
        console.log('aaaiiiii');
        const updateAtt = await Attendance.findOneAndUpdate(
          { _id: mongoose.Types.ObjectId(data._id) },
          {
            $set: {
              approval: obj.approval,
              otDuration: otHr,
              status: 3,
              isAutoApprove: true,
            },
          },
        );
        approveAttandanceData.push(obj);
      }
    }
    return { buDataArr, attendanceData, approveAttandanceData };
  } catch (err) {
    __.log(err);
  }
}
new CronJob({
  cronTime: '0 */3 * * * * ',
  onTick: function () {
    console.log('attend yuup');
    autoApproveCron();
    //Your code that is to be executed on every midnight
  },
  start: true,
  runOnInit: false,
});
attendanceController = new attendanceController();
module.exports = attendanceController;
