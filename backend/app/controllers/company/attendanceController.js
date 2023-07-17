const mongoose = require('mongoose'),
  Shift = require('../../models/shift'),
  ShiftDetails = require('../../models/shiftDetails'),
  ShiftLog = require('../../models/shiftLog'),
  User = require('../../models/user'),
  Attendance = require('../../models/attendance'),
  AttendanceLog = require('../../models/attendanceLog'),
  FacialData = require('../../models/facialData'),
  json2csv = require('json2csv').parse,
  SubSection = require('../../models/subSection');
var moment = require('moment');
// const redisData = require('../../../helpers/redisDataGenerator');
const __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class attendanceController {
  // async updateRedis(businessUnitId, from) {
  //   if (from !== 'add') {
  //     redisData.history(businessUnitId);
  //     redisData.readModifyAshish(businessUnitId);
  //     redisData.timesheetData(businessUnitId);
  //   }
  // }
  // async updateRedisSingle(res, businessUnitId, shiftDetailId) {
  //   try {
  //     // redisData.history(businessUnitId)
  //     const ree = await Promise.all(
  //       [
  //         redisData.readModifyAshishSingleShift(businessUnitId, shiftDetailId),
  //         redisData.historySingle(businessUnitId, shiftDetailId),
  //       ],
  //       redisData.history(businessUnitId),
  //     );
  //     // const r = await redisData.readModifyAshishSingleShift(businessUnitId, shiftDetailId);
  //     // const p = await redisData.timesheetDataSingleShift(businessUnitId, shiftDetailId);
  //     return ree;
  //     // redisData.timesheetData(businessUnitId)
  //   } catch (err) {
  //     __.log(err);
  //     __.out(res, 500);
  //   }
  // }
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
        );
        item.shiftEndTime = this.getDateFormat(
          item.shiftDetailId.endTime,
          timeZone,
        );
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
        const csv = await json2csv(dataFormat, keys);
        const csvType = 'dubbyData';
        res.setHeader('Content-disposition', 'attachment; filename=testing.csv');
        res.set('Content-Type', 'application/csv');
        res.status(200).json({ csv, noData: true });
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
      let endDate = new Date();
      let startDate = new Date();
      endDate = endDate.setHours(endDate.getHours() + 12);
      endDate = new Date(endDate);
      startDate = startDate.setHours(startDate.getHours() - 12);
      startDate = new Date(startDate);

      let { shiftId, shiftDetailId, userId, attandanceTakenBy, businessUnitId, status, clockInDateTime, clockOutDateTime = "", attendanceMode = "", checkInLocation = "", checkOutLocation = "", checkedInDistanceInMeters = 0, checkedOutDistanceInMeters = 0 } = req.body

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
            var diff = new Date(shfitStartTime) - new Date();
            let min = Math.floor(diff / 1000 / 60);
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
            //min < 60
            if (true) {
              Attendance.find({
                shiftDetailId: mongoose.Types.ObjectId(req.body.shiftDetailId),
                shiftId: mongoose.Types.ObjectId(req.body.shiftId),
                userId: mongoose.Types.ObjectId(req.body.userId),
              })
                .then(async (attendanceResult) => {
                  if (req.body.attendanceMode === 'Facial Failed') {
                    req.body.status = 4;
                  } else if (req.body.attendanceMode === 'QR Failed') {
                    req.body.status = 5;
                  } else {
                    if (req.body.status === 1)
                      req.body.clockInDateTime = new Date();
                    else if (req.body.status === 2)
                      req.body.clockOutDateTime = new Date();
                  }
                  let attend = (status === 1) ? { clockInDateTime: req.body.clockInDateTime } : { clockOutDateTime: req.body.clockOutDateTime }

                  if (attendanceResult.length === 0) {

                    delete req.body.breakTime;
                    await AttendanceLog(req.body).save()
                    const result = await Attendance(req.body).save();
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
                    /*
                    new Attendance(req.body).save().then(async (result) => {
                      // const rR = await this.updateRedisSingle(
                      //   res,
                      //   shiftData.businessUnitId,
                      //   req.body.shiftDetailId,
                      // );
                      // this.updateRedis(shiftData.businessUnitId, 'add');
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
                    */
                  } else {
                    let attendanceLog;
                    try {
                      await Attendance.findOneAndUpdate({
                        shiftDetailId: mongoose.Types.ObjectId(shiftDetailId),
                        shiftId: mongoose.Types.ObjectId(shiftId),
                        userId: mongoose.Types.ObjectId(userId)
                      }, {
                        $set: { ... { attendanceMode, status, checkOutLocation }, ...attend },
                      }, { new: true });

                      const attendanceLog = await AttendanceLog.findOneAndUpdate({
                        shiftDetailId: mongoose.Types.ObjectId(shiftDetailId),
                        shiftId: mongoose.Types.ObjectId(shiftId),
                        userId: mongoose.Types.ObjectId(userId),
                      }, {
                        $set: { ... { attendanceMode, status, checkOutLocation }, attend },

                      }, { new: true })
                    } catch (e) {
                    }
                    if (status === 4) {
                      return res.json({
                        status: 4,
                        data: attendanceLog,
                        message: attendanceMode,
                      });
                    }
                    let message = (status == 1) ? 'Attendance Clocked In' : "Attendance Clocked Out"
                    return res.json({
                      status: 1,
                      data: attendanceLog,
                      message,
                    });
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

  async addAttendance(req, res) {
    logInfo(`attendance/add  API Start!`, { name: req.user.name, staffId: req.user.staffId });
    let { shiftId, shiftDetailId, userId, attandanceTakenBy, businessUnitId, status, clockInDateTime, clockOutDateTime = "", attendanceMode = "", checkInLocation = "", checkOutLocation = "", checkedInDistanceInMeters = 0 } = req.body

    let endDate = new Date();
    let startDate = new Date();
    endDate = endDate.setHours(endDate.getHours() + 12);
    endDate = new Date(endDate);
    startDate = startDate.setHours(startDate.getHours() - 12);
    startDate = new Date(startDate);
    try {
      const shiftData = await Shift.findOne({ _id: req.body.shiftId });
      let shiftDetail = await ShiftDetails.findOne(
        {
          confirmedStaffs: { $in: [mongoose.Types.ObjectId(req.body.userId)] },
          _id: mongoose.Types.ObjectId(req.body.shiftDetailId),
          shiftId: mongoose.Types.ObjectId(req.body.shiftId),
        },
        { date: 1, startTime: 1, endTime: 1, shiftId: 1, duration: 1 },
      );


      if (shiftDetail) {
        shiftDetail = JSON.parse(JSON.stringify(shiftDetail))
        let shfitStartTime = new Date(shiftDetail.startTime);
        shfitStartTime = shfitStartTime.setDate(new Date(shfitStartTime).getDate() - 1);
        var diff = (new Date(shfitStartTime) - new Date());
        let min = Math.floor((diff / 1000) / 60);
        if (shiftDetail.isExtendedShift) {
          const shiftExtendedObj = shiftDetail.extendedStaff.filter((i) => {
            return i.userId.toString() === userId;
          });
          if (shiftExtendedObj.length > 0) {
            let exshfitStartTime = new Date(shiftExtendedObj[0].startDateTime);
            var diff = new Date(exshfitStartTime) - new Date();
            min = Math.floor(diff / 1000 / 60);
          }
        }
        if (true) {
          try {
            const attendanceResult = await Attendance.find({
              shiftDetailId: mongoose.Types.ObjectId(req.body.shiftDetailId),
              shiftId: mongoose.Types.ObjectId(req.body.shiftId),
              userId: mongoose.Types.ObjectId(req.body.userId),
            })

            if (attendanceMode === "Facial Failed") {
              status = 4;
            } else if (attendanceMode === "QR Failed") {
              status = 5;
            } else {
              if (status === 1) clockInDateTime = new Date();
              else if (status === 2) clockOutDateTime = new Date();

            }
            let attend = (status === 1) ? { clockInDateTime } : { clockOutDateTime }
            if (attendanceResult && attendanceResult.length) {
              let attendanceResponse;
              try {
                attendanceResponse = await Attendance.findOneAndUpdate({
                  shiftDetailId: mongoose.Types.ObjectId(shiftDetailId),
                  shiftId: mongoose.Types.ObjectId(shiftId),
                  userId: mongoose.Types.ObjectId(userId)
                }, {
                  $set: { ... { attendanceMode, status, checkOutLocation }, ...attend },
                }, { new: true });

                await AttendanceLog.findOneAndUpdate({
                  shiftDetailId: mongoose.Types.ObjectId(shiftDetailId),
                  shiftId: mongoose.Types.ObjectId(shiftId),
                  userId: mongoose.Types.ObjectId(userId),
                }, {
                  $set: { ... { attendanceMode, status, checkOutLocation }, attend },
                }, { new: true });
              } catch (e) {
                logError(`timesheet/history/5bd723a8c1e35a7a250d562a  API, there is an error`, e.toString());
              }
              if (status === 4) {
                return res.json({
                  status: 4,
                  data: attendanceResponse,
                  message: attendanceMode,
                });
              }
              let message = (status == 1) ? 'Attendance Clocked In' : "Attendance Clocked Out"
              return res.json({
                status: 1,
                data: attendanceResponse,
                message,
              });
            } else {
              try {
                if (status === 2) {
                  logError(`timesheet/history/5bd723a8c1e35a7a250d562a  API, 'First you have to Clockin.' `, req.body);
                  return res.send({ status: 5, message: "First you have to Clockin." })
                }
                const result = await Attendance({ userId, shiftId, shiftDetailId, status, attandanceTakenBy, clockInDateTime, businessUnitId, attendanceMode, checkInLocation, checkOutLocation, checkedInDistanceInMeters }).save();
                let logs = JSON.parse(JSON.stringify(result));
                delete logs._id;
                try {
                  const attendanceLog = await AttendanceLog(logs).save();
                } catch (e) {
                  logError(`timesheet/history/5bd723a8c1e35a7a250d562a API, there is an error`, e.toString());
                }
                logInfo(`timesheet/history/5bd723a8c1e35a7a250d562a API ends here!`, { name: req.user.name, staffId: req.user.staffId });
                if (status === 4) {
                  return res.json({
                    status: 4,
                    data: result,
                    message: req.body.attendanceMode,
                  });
                } else if (req.body.status === 5) {
                  return res.json({
                    status: 4,
                    data: result,
                    message: req.body.attendanceMode,
                  });
                }
                let message = (status == 1) ? 'Attendance Clocked In' : "Attendance Clocked Out"
                return res.json({
                  status: 1,
                  data: result,
                  message,
                });
              } catch (err) {
                logError(`timesheet/history/5bd723a8c1e35a7a250d562a  API, there is an error`, err.toString());
                return res.json({
                  status: 3,
                  data: null,
                  message: "Something went wrong3",
                  err
                });
              }
            }
          } catch (err) {
            logError(`timesheet/history/5bd723a8c1e35a7a250d562a  API, there is an error`, err.toString());
            return res.json({
              status: 3,
              data: null,
              message: "Something went wrong2",
              err,
            });
          }
        }
      } else {
        logError(`timesheet/history/5bd723a8c1e35a7a250d562a  API ends here!`, 'Shift Not found');
        return res.json({
          status: 2,
          data: null,
          message: "Shift Not found",
        });
      }
    } catch (err) {
      logError(`timesheet/history/5bd723a8c1e35a7a250d562a  API, there is an error`, err.toString());
      return res.json({
        status: 3,
        data: null,
        message: "Something went wrong1",
        err,
      });
    }
  }

  async autoApprove(req, res) {
    try {
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
      let buDataArr = [];
      const len = attendanceData.length;
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
            if (result) {
              let logs = JSON.parse(JSON.stringify(result));
              delete logs._id;
              // const re = await this.updateRedisSingle(
              //   res,
              //   result.businessUnitId,
              //   result.shiftDetailId,
              // );
              // this.updateRedis(result.businessUnitId, 'add');
              new AttendanceLog(logs)
                .save()
                .then((log) => {
                })
                .catch((e) => {
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
      logInfo('attendance/breakTime API Start!', { name: req.user.name, staffId: req.user.staffId });
      const obj = req.body;
      var timeZone = moment
        .parseZone(req.body.startTime, 'MM-DD-YYYY HH:mm:ss Z')
        .format('Z'),
        startTimeDate = moment(req.body.startTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format(),
        endTimeDate = moment(req.body.endTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
      var diff = Math.abs(new Date(startTimeDate) - new Date(endTimeDate));
      const min = Math.floor(diff / 1000 / 60);
      ShiftDetails.findById(mongoose.Types.ObjectId(req.body.shiftDetailId), {
        extendedStaff: 1,
        isExtendedShift: 1,
        confirmedStaffs: 1,
        startTime: 1,
        endTime: 1,
      })
        .then((shiftInfo) => {
          let shfitEndTime = new Date(shiftInfo.endTime);
          shfitEndTime = shfitEndTime.setDate(new Date(shfitEndTime).getDate());
          let shfitStartTime = new Date(shiftInfo.startTime);
          shfitStartTime = shfitStartTime.setDate(
            new Date(shfitStartTime).getDate() - 1,
          );
          const shiftBreakStartTime = new Date(startTimeDate).getTime();
          const shiftBreakEndTime = new Date(endTimeDate).getTime();
          if (shiftInfo.isExtendedShift) {
            const shiftExtendedObj = shiftInfo.extendedStaff.filter((i) => {
              return (
                i.userId.toString() === req.body.userId && i.confirmStatus === 2
              );
            });
            if (shiftExtendedObj.length > 0) {
              let exshfitEndTime = new Date(shiftExtendedObj[0].endDateTime);
              exshfitEndTime = new Date(exshfitEndTime).getTime();
              let exshfitStartTime = new Date(
                shiftExtendedObj[0].startDateTime,
              ).getTime();

              exshfitStartTime = new Date(exshfitStartTime).getTime();
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
                logInfo(`attendance/breakTime API 'Break Time should be between shift time' ends here!`, { name: req.user.name, staffId: req.user.staffId });
                res.json({
                  status: 4,
                  message: 'Break Time should be between shift time',
                  data: null,
                });
              }
            } else {
              if (
                minutesOfDay(shfitEndTime) >=
                minutesOfDay(shiftBreakStartTime) &&
                minutesOfDay(shiftBreakStartTime) >=
                minutesOfDay(shfitStartTime) &&
                minutesOfDay(shfitEndTime) >= minutesOfDay(shiftBreakEndTime) &&
                minutesOfDay(shiftBreakEndTime) >= minutesOfDay(shfitStartTime)
              ) {
                markBreakTime();
              } else {
                logInfo(`attendance/breakTime API 'Break Time should be between shift time' ends here!`, { name: req.user.name, staffId: req.user.staffId });
                res.json({
                  status: 4,
                  message: 'Break Time should be between shift time',
                  data: null,
                });
              }
            }
          } else {
            if (
              minutesOfDay(shfitEndTime) >= minutesOfDay(shiftBreakStartTime) &&
              minutesOfDay(shiftBreakStartTime) >=
              minutesOfDay(shfitStartTime) &&
              minutesOfDay(shfitEndTime) >= minutesOfDay(shiftBreakEndTime) &&
              minutesOfDay(shiftBreakEndTime) >= minutesOfDay(shfitStartTime)
            ) {
              markBreakTime();
            } else {
              logInfo(`attendance/breakTime API 'Break Time should be between shift time' ends here!`, { name: req.user.name, staffId: req.user.staffId });
              res.json({
                status: 4,
                message: 'Break Time should be between shift time',
                data: null,
              });
            }
          }
        })
        .catch((err) => {
          logError(`attendance/breakTime API, there is an error`, err.toString());
          res.send(err);
        });

      function minutesOfDay(m) {
        return new Date(m).getMinutes() + new Date(m).getHours() * 60;
      }
      function markBreakTime() {
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
                    if (!result) {
                      return res.json({
                        status: 2,
                        data: null,
                        message: 'No Clock in attendance found',
                      });
                    }
                    return res.json({
                      status: 2,
                      message: 'BreakTime Entered Successfully',
                      data: result.breakTime,
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
          if (result.length > 0) {
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
      var timeZone = moment
        .parseZone(req.body.startTime, 'MM-DD-YYYY HH:mm:ss Z')
        .format('Z'),
        startTimeDate = moment(req.body.startTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format(),
        endTimeDate = moment(req.body.endTime, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
      let startDate = moment(req.body.startTime, 'MM-DD-YYYY HH:mm:ss Z')
        .utc()
        .format();
      startDate = new Date(startDate).setHours(0, 0, 0, 0);
      var diff = Math.abs(new Date(startTimeDate) - new Date(endTimeDate));
      const min = Math.floor(diff / 1000 / 60);
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
          if (shiftInfo.length > 0) {
            let shiftStartDate = new Date(shiftInfo[0].startTime).setHours(
              0,
              0,
              0,
              0,
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
            } else {
              res.json({
                status: false,
                message: 'Break Time is Not between shift',
              });
            }
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
        return new Date(m).getMinutes() + new Date(m).getHours() * 60;
      }
      function markBreakTime(shiftDetailId) {
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
            if (result) {
              // await this.updateRedisSingle(
              //   res,
              //   result.businessUnitId,
              //   result.shiftDetailId,
              // );
              // this.updateRedis(result.businessUnitId, 'add');
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
    return false
  }
}

attendanceController = new attendanceController();
module.exports = { attendanceController, autoApproveCron };
