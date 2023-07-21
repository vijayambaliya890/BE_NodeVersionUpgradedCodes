const mongoose = require('mongoose'),
  LeaveType = require('../../models/leaveType'),
  LeaveGroup = require('../../models/leaveGroup'),
  StaffLeave = require('../../models/staffLeave'),
  staffLeave = require('../../models/staffLeave'),
  OpsGroup = require('../../models/ops'),
  LeaveApplied = require('../../models/leaveApplied');
const __ = require('../../../helpers/globalFunctions');
const moment = require('moment');
const { use } = require('passport');
const User = require('../../models/user');
const ops = require('../../models/ops');
const opsTeam = require('../../models/opsTeam');
const SwapLog = require('../../models/swapLog');
const PageSetting = require('../../models/pageSetting');
// const { from } = require("clamscan/NodeClamTransform");
const FCM = require('../../../helpers/fcm');
moment.suppressDeprecationWarnings = true;
class swappingController {
  async readLeaveConfiguration(companyId) {
    const pageData = await PageSetting.findOne({ companyId: companyId });
    if (
      pageData &&
      pageData.opsGroup &&
      pageData.opsGroup.blockLeaveConfiguration
    ) {
      if (pageData.opsGroup.blockLeaveConfiguration == 1) {
        return { total: 5, restOff: 2 };
      } else if (pageData.opsGroup.blockLeaveConfiguration == 2) {
        return { total: 6, restOff: 1 };
      } else {
        return { total: 7, restOff: 0 };
      }
    }
    return { total: 5, restOff: 2 };
  }
  // swap/apply
  async checkBalance(res, toUser, fromUser, startYear) {
    try {
      let toTotalDeducated = fromUser.totalDeducated - toUser.totalDeducated;
      let fromTotalDeducated = toUser.totalDeducated - fromUser.totalDeducated;
      const leaveTypeId = toUser.leaveTypeId.toString();
      if (toTotalDeducated > 0) {
        const toStaffLeaveData = await staffLeave.findOne({
          userId: toUser.userId,
        });
        const toLeaveTypeData = toStaffLeaveData.leaveDetails.filter((item) => {
          return (
            item.leaveTypeId.toString() == leaveTypeId && item.year == startYear
          );
        })[0];
        let isPlanQuota = toLeaveTypeData.planQuota - toTotalDeducated;
        return isPlanQuota >= 0
          ? { success: true }
          : {
              success: false,
              message:
                'Plan quota is not sufficient at receiver to swap the leaves, please check',
            };
      } else if (fromTotalDeducated > 0) {
        const fromStaffLeaveData = await staffLeave.findOne({
          userId: fromUser.userId,
        });
        const fromLeaveTypeData = fromStaffLeaveData.leaveDetails.filter(
          (item) => {
            return (
              item.leaveTypeId.toString() == leaveTypeId &&
              item.year == startYear
            );
          },
        )[0];
        let isPlanQuota = fromLeaveTypeData.planQuota - fromTotalDeducated;
        return isPlanQuota >= 0
          ? { success: true }
          : {
              success: false,
              message:
                'Plan quota is not sufficient to swap the leaves, please check',
            };
      } else {
        return { success: true };
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async checkLeaveConfig(res, leaveTypeId, fromUser, toUser, startYear) {
    try {
      const leaveTypeData = await LeaveType.findOne({ _id: leaveTypeId });
      let toLeaveTypeData;
      let fromLeaveTypeData;
      if (leaveTypeData.isQuotaExceed) {
        return true;
      } else {
        const toStaffLeaveData = await staffLeave.findOne({
          userId: toUser.userId,
        });
        toLeaveTypeData = toStaffLeaveData.leaveDetails.filter((item) => {
          return (
            item.leaveTypeId.toString() == leaveTypeId && item.year == startYear
          );
        })[0];
        const fromStaffLeaveData = await staffLeave.findOne({
          userId: fromUser.userId,
        });
        fromLeaveTypeData = fromStaffLeaveData.leaveDetails.filter((item) => {
          return (
            item.leaveTypeId.toString() == leaveTypeId && item.year == startYear
          );
        })[0];
      }
      if (
        toLeaveTypeData &&
        toLeaveTypeData.total == 0 &&
        fromLeaveTypeData &&
        fromLeaveTypeData.total == 0
      ) {
        return true;
      }
      return false;
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async swapApply(req, res) {
    try {
      // "fromAppliedLeaveId": "5f50b11ebd201c7d99941f81", sender
      // "toAppliedLeaveId": "5f50b11ebd201c7d99941f81", reciver
      // "toUserId":"",
      const body = req.body;
      const toAppliedLeaveData = await LeaveApplied.findOne({
        _id: body.toAppliedLeaveId,
      });
      const fromAppliedLeaveData = await LeaveApplied.findOne({
        _id: body.fromAppliedLeaveId,
      });
      if (
        (toAppliedLeaveData.isSwapRequestReceived ||
          toAppliedLeaveData.isSwapRequestSent) &&
        toAppliedLeaveData.isSwapAccepted == 0
      ) {
        //const isAllowed = checkIsPresent(toAppliedLeaveData);
        return res.json({
          success: false,
          message:
            'The slot you have requested is pending another swap request.',
        });
      }
      const toTotalDeducated = toAppliedLeaveData.totalDeducated;
      const fromTotalDeducated = fromAppliedLeaveData.totalDeducated;
      const startYear = new Date(toAppliedLeaveData.startDate).getFullYear();
      const toUser = {
        totalDeducated: toTotalDeducated,
        userId: toAppliedLeaveData.userId,
        leaveTypeId: toAppliedLeaveData.leaveTypeId,
      };
      const fromUser = {
        totalDeducated: fromTotalDeducated,
        userId: fromAppliedLeaveData.userId,
        leaveTypeId: fromAppliedLeaveData.leaveTypeId,
      };
      // check balance vice versa
      let isFine = await this.checkBalance(res, toUser, fromUser, startYear);
      const isQuotaCheck = await this.checkLeaveConfig(
        res,
        toAppliedLeaveData.leaveTypeId,
        fromUser,
        toUser,
        startYear,
      );
      if (isFine.success || isQuotaCheck) {
        // add entry to SwapLog
        let swapLogObj = {
          appliedLeaveFrom: fromAppliedLeaveData._id,
          appliedLeaveTo: toAppliedLeaveData._id,
          fromUserId: fromAppliedLeaveData.userId,
          toUserId: toAppliedLeaveData.userId,
          leaveTypeId: fromAppliedLeaveData.leaveTypeId,
          from: fromAppliedLeaveData,
          to: toAppliedLeaveData,
        };
        const swapLogInsert = new SwapLog(swapLogObj);
        const swapData = await swapLogInsert.save();
        // update leaves
        toAppliedLeaveData.isSwapRequestReceived = true;
        let idd = [];
        if (
          toAppliedLeaveData.swapLogId &&
          toAppliedLeaveData.swapLogId.length > 0
        ) {
          idd = toAppliedLeaveData.swapLogId;
        }
        idd.push(swapData._id);
        toAppliedLeaveData.isSwapAccepted = 0;
        toAppliedLeaveData.swapLogId = idd;
        toAppliedLeaveData.isReceiver = 1;
        const toData = await toAppliedLeaveData.save();
        fromAppliedLeaveData.isSwapAccepted = 0;
        fromAppliedLeaveData.isSwapRequestSent = true;
        let iddd = [];
        if (
          fromAppliedLeaveData.swapLogId &&
          fromAppliedLeaveData.swapLogId.length > 0
        ) {
          iddd = fromAppliedLeaveData.swapLogId;
        }
        iddd.push(swapData._id);
        fromAppliedLeaveData.swapLogId = iddd;
        //fromAppliedLeaveData.swapLogId.push(swapData._id);
        fromAppliedLeaveData.isSender = 1;
        fromAppliedLeaveData.sentSwapLogId = swapData._id;
        const fromData = await fromAppliedLeaveData.save();
        const userDetails = await User.findOne(
          { _id: toUser.userId },
          { deviceToken: 1 },
        );
        const tm = fromAppliedLeaveData.timeZone
          ? fromAppliedLeaveData.timeZone
          : '+08:00';
        const startDateN = moment(fromAppliedLeaveData.startDate)
          .utcOffset(tm)
          .format('DD-MM-YYYY');
        const endDateN = moment(fromAppliedLeaveData.endDate)
          .utcOffset(tm)
          .format('DD-MM-YYYY');
        const token = [userDetails.deviceToken];
        const pushData = {
            title: 'You have a swap request for',
            body:
              'You have a swap request for"' +
              startDateN +
              '" to "' +
              endDateN +
              '" from ' +
              req.user.staffId,
            bodyTime: new Date(),
            bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
          },
          collapseKey =
            fromAppliedLeaveData._id; /*unique id for this particular ballot */
        FCM.push(token, pushData, collapseKey);
        return res.json({
          success: true,
          message: 'Swap request sent successfully',
        });
      } else {
        return res.json({ success: false, message: isFine.message });
      }
    } catch (err) {
      __.log(err);
      return res
        .status(500)
        .json({ message: 'something went wrong', success: false });
    }
  }
  ordinal_suffix_of(i) {
    var j = i % 10,
      k = i % 100;
    if (j == 1 && k != 11) {
      return i + 'st';
    }
    if (j == 2 && k != 12) {
      return i + 'nd';
    }
    if (j == 3 && k != 13) {
      return i + 'rd';
    }
    return i + 'th';
  }
  async getStaffList(req, res) {
    try {
      console.log('gettttt');
      const userId = req.user._id;
      console.log('req.user._id', req.user._id);
      const body = req.body;
      const isSwapAvailable = await this.checkIsSwapAvailable(res, userId);
      console.log('isSwapAvailable', isSwapAvailable);
      if (isSwapAvailable.success) {
        const userIdArr = [];
        isSwapAvailable.userId.forEach((u) => {
          if (u._id.toString() != req.user._id) {
            userIdArr.push(u._id);
          }
        });
        // const startdate = moment(new Date(body.startDate)).utc(body.timeZone).format();
        //  const enddate = moment(new Date(body.enddate)).utc(body.timeZone).format();
        /*  userId: { $in: userIdArr },
        leaveTypeId: body.leaveTypeId,
        isSwappable: 1,
        status: { $in: [0, 3, 4] },*/
        let leaves = await LeaveApplied.find({
          $expr: { $eq: [{ $year: '$startDate' }, body.year] },
          userId: { $in: userIdArr },
          leaveTypeId: body.leaveTypeId,
          isSwappable: 1,
          $or: [
            {
              submittedFrom: { $in: [3, 4] },
              status: { $nin: [0, 1, 2, 5] },
            },
            { submittedFrom: 2, status: 1 },
          ],
        }).populate({
          path: 'userId',
          select: 'name staffId _id',
        });
        if (leaves && leaves.length > 0) {
          leaves = JSON.parse(JSON.stringify(leaves));
          const dateArr = [];
          const leaveObj = {};
          for (let i = 0; i < leaves.length; i++) {
            let date = '';
            const item = leaves[i];
            //moment(new Date(body.date)).utc(body.timeZone).format("DD-MM-YYYY");
            const endYear = moment(new Date(item.endDate))
              .utc(body.timeZone)
              .format('YYYY');
            const startMonth = moment(new Date(item.startDate))
              .utc(body.timeZone)
              .format('MMM');
            const startDay = moment(new Date(item.startDate))
              .utc(body.timeZone)
              .format('DD');
            const endMonth = moment(new Date(item.endDate))
              .utc(body.timeZone)
              .format('MMM');
            const endDay = moment(new Date(item.endDate))
              .utc(body.timeZone)
              .format('DD');
            date = `${this.ordinal_suffix_of(
              startDay,
            )} ${startMonth} to ${this.ordinal_suffix_of(
              endDay,
            )} ${endMonth} ${endYear} (${item.totalDay} Days)`;
            if (leaveObj[date] && leaveObj[date].length > 0) {
              leaveObj[date].push(item);
            } else {
              leaveObj[date] = [];
              leaveObj[date].push(item);
              dateArr.push({
                key: date,
                value: { startDate: item.startDate, endDate: item.endDate },
              });
            }
            // leaves[i].stEt =
          }
          return res.json({
            success: true,
            slotPresent: dateArr,
            leaves: leaveObj,
          });
        } else {
          return res.json({
            success: false,
            slotPresent: [],
            leaves: {},
            message: 'No leave present',
          });
        }
      } else {
        return res.json({ success: false, message: 'No swap available' });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async checkIsSwapAvailable(res, userId) {
    try {
      console.log('userId', userId);
      const opsGroupData = await ops
        .findOne(
          { userId, isDelete: false },
          { noOfTeam: 1, swopSetup: 1, userId: 1, opsGroupName: 1 },
        )
        .populate([
          {
            path: 'userId',
            select: 'isLeaveSwapAllowed',
            match: { isLeaveSwapAllowed: { $ne: true }, _id: { $ne: userId } },
          },
        ]);
      console.log('opsGroupData', opsGroupData);
      const userData = await User.findOne(
        { _id: userId },
        { isLeaveSwapAllowed: 1 },
      );
      // console.log('opsGroupData', opsGroupData.swopSetup)
      if (
        opsGroupData &&
        opsGroupData.swopSetup != 0 &&
        !userData.isLeaveSwapAllowed
      ) {
        let opsGroupDetails = {
          opsGroupName: opsGroupData.opsGroupName,
        };
        if (opsGroupData.swopSetup == 1) {
          // ops group level
          console.log('iiiii', opsGroupData.noOfTeam);
          if (opsGroupData.noOfTeam != 0) {
            const opsTeamData = await opsTeam.findOne(
              { userId, isDeleted: false },
              { userId: 1, name: 1 },
            );
            opsGroupDetails.opsTeamName = opsTeamData.name;
          }
          return {
            success: true,
            userId: opsGroupData.userId,
            opsGroupDetails,
          };
        } else {
          console.log('*******************');
          const opsTeamData = await opsTeam
            .findOne({ userId, isDeleted: false }, { userId: 1, name: 1 })
            .populate([
              {
                path: 'userId',
                select: 'isLeaveSwapAllowed',
                match: {
                  isLeaveSwapAllowed: { $ne: true },
                  _id: { $ne: userId },
                },
              },
            ]);
          opsGroupDetails.opsTeamName = opsTeamData.name;
          return { success: true, userId: opsTeamData.userId, opsGroupDetails };
          // ops team level
        }
      } else {
        return { success: false };
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async getSentSwapRequest(req, res) {
    try {
      const body = req.body;
      const swapId = body.swapId;
      const fromUserId = req.user._id;
      const swapData = await SwapLog.find({ _id: swapId, fromUserId }).populate(
        [
          {
            path: 'toUserId',
            select: 'name staffId',
            populate: [
              {
                path: 'appointmentId',
                select: 'name',
              },
              {
                path: 'parentBussinessUnitId',
                select: 'name',
                populate: {
                  path: 'sectionId',
                  select: 'name',
                  populate: {
                    path: 'departmentId',
                    select: 'name status',
                    populate: {
                      path: 'companyId',
                      select: 'name status',
                    },
                  },
                },
              },
            ],
          },
          {
            path: 'leaveTypeId',
            select: 'name',
          },
        ],
      );
      if (swapData && swapData.length > 0) {
        const opsGroupName = await this.getOpsGroupName(
          res,
          swapData[0].toUserId._id,
        );
        return res.json({ success: true, swapData, opsGroupName });
      } else {
        return res.json({ success: false, message: 'No Swap Data found' });
      }
    } catch (error) {
      return res.json({ success: false, message: 'No Swap Data found' });
    }
  }
  async getOpsGroupName(res, userId) {
    try {
      const opsGroupData = await ops.findOne(
        { userId, isDelete: false },
        { opsGroupName: 1 },
      );
      return opsGroupData ? opsGroupData.opsGroupName : '';
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async getReceivedSwapRequest(req, res) {
    try {
      const body = req.body;
      console.log('heheheh', body);
      const appliedLeaveTo = body.appliedLeaveId;
      let swapLogData = await SwapLog.find({
        appliedLeaveTo,
        status: { $ne: 3 },
      }).populate([
        {
          path: 'fromUserId',
          select: 'name staffId',
          populate: [
            {
              path: 'appointmentId',
              select: 'name',
            },
            {
              path: 'parentBussinessUnitId',
              select: 'name',
              populate: {
                path: 'sectionId',
                select: 'name',
                populate: {
                  path: 'departmentId',
                  select: 'name status',
                  populate: {
                    path: 'companyId',
                    select: 'name status',
                  },
                },
              },
            },
          ],
        },
        {
          path: 'leaveTypeId',
          select: 'name',
        },
      ]);
      if (swapLogData && swapLogData.length > 0) {
        swapLogData = JSON.parse(JSON.stringify(swapLogData));
        for (let i = 0; i < swapLogData.length; i++) {
          const opsGroupName = await this.getOpsGroupName(
            res,
            swapLogData[i].fromUserId._id,
          );
          swapLogData[i].opsGroupName = opsGroupName;
        }
        return res.json({ success: true, data: swapLogData });
      } else {
        return res.json({ success: false, message: 'No data present' });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async checkIfSenderHaveDate(req, res) {
    try {
      const body = req.body;
      const userId = req.user._id;
      console.log('userId', userId);
      const startDate = moment(new Date(body.startDate))
        .utc(body.timeZone)
        .format();
      const endDate = moment(new Date(body.endDate))
        .utc(body.timeZone)
        .format();
      console.log('startDate', startDate, endDate);
      const leaveData = await LeaveApplied.find({ userId, startDate, endDate });
      if (leaveData && leaveData.length > 0) {
        return res.json({
          success: false,
          message: 'You already have these dates',
        });
      } else {
        return res.json({
          success: true,
          message: "You don't have these dates",
        });
      }
    } catch (error) {
      return res.json({ success: false, message: 'Something went wrong' });
    }
  }
  async checkIfReceiverHaveDate(req, res) {
    try {
      const body = req.body;
      const userId = body.userId;
      const startDate = moment(new Date(body.startDate))
        .utc(body.timeZone)
        .format();
      const endDate = moment(new Date(body.endDate))
        .utc(body.timeZone)
        .format();
      console.log(startDate, endDate);
      const leaveData = await LeaveApplied.find({ userId, startDate, endDate });
      if (leaveData && leaveData.length > 0) {
        return res.json({
          success: false,
          message: 'This staff already has these dates',
        });
      } else {
        return res.json({
          success: true,
          message: "This staff don't has these dates",
        });
      }
    } catch (error) {
      return res.json({ success: true, message: 'Something went wrong' });
    }
  }
  async cancelSwapRequest(req, res) {
    try {
      const swapId = req.body.swapId;
      const swapUpdate = await SwapLog.findOneAndUpdate(
        { _id: swapId, status: 0 },
        { $set: { status: 3 } },
      );
      if (swapUpdate) {
        const leaveAppliedData = await LeaveApplied.update(
          { swapLogId: swapId },
          {
            $set: {
              isSwapAccepted: false,
              sentSwapLogId: null,
              isSender: 0,
              isReceiver: 0,
              isSwapRequestReceived: false,
              isSwapRequestSent: false,
            },
            $pull: {
              swapLogId: swapId,
            },
          },
          { multi: true },
        );
        return res.json({
          success: true,
          message: 'Swap request successfully cancelled',
        });
      } else {
        return res.json({
          success: false,
          message: 'Something went wrong, please try again later',
        });
      }
    } catch (e) {
      return res.json({ success: false, message: 'Something went wrong' });
    }
  }
  async swapDate(res, swapData, swapIdLog) {
    try {
      const toLeave = swapData.to;
      const fromLeave = swapData.from;
      const startYear = new Date(toLeave.startDate).getFullYear();
      const toTotalDeducated =
        fromLeave.totalDeducated - toLeave.totalDeducated;
      const fromTotalDeducated =
        toLeave.totalDeducated - fromLeave.totalDeducated;
      let toIndex = -1;
      let leaveTypeId = toLeave.leaveTypeId;
      const toStaffLeaveData = await staffLeave.findOne({
        userId: toLeave.userId,
      });
      const toLeaveTypeData = toStaffLeaveData.leaveDetails.filter(
        (item, index) => {
          if (
            item.leaveTypeId.toString() == leaveTypeId &&
            item.year == startYear
          )
            toIndex = index;
          return (
            item.leaveTypeId.toString() == leaveTypeId && item.year == startYear
          );
        },
      )[0];
      const fromStaffLeaveData = await staffLeave.findOne({
        userId: fromLeave.userId,
      });
      let fromIndex = -1;
      const fromLeaveTypeData = fromStaffLeaveData.leaveDetails.filter(
        (item, index) => {
          if (
            item.leaveTypeId.toString() == leaveTypeId &&
            item.year == startYear
          )
            fromIndex = index;
          return (
            item.leaveTypeId.toString() == leaveTypeId && item.year == startYear
          );
        },
      )[0];
      const leaveTypeData = await LeaveType.findOne({
        _id: toLeave.leaveTypeId,
      });
      const toPlanQuota = toLeaveTypeData.planQuota - toTotalDeducated;
      const fromPlanQuota = fromLeaveTypeData.planQuota - fromTotalDeducated;
      if (
        fromLeave.totalDeducated <= toLeave.totalDeducated ||
        (fromLeave.totalDeducated > toLeave.totalDeducated &&
          (leaveTypeData.isQuotaExceed ||
            (fromLeaveTypeData.total == 0 && toLeave.total == 0) ||
            (toPlanQuota >= 0 && fromPlanQuota >= 0)))
      ) {
        toStaffLeaveData.leaveDetails[toIndex].planQuota = toPlanQuota;
        fromStaffLeaveData.leaveDetails[fromIndex].planQuota = fromPlanQuota;
        let toLeaveAppliedData = await LeaveApplied.findOne({
          _id: toLeave._id,
        });
        let fromLeaveAppliedData = await LeaveApplied.findOne({
          _id: fromLeave._id,
        });
        toLeaveAppliedData.totalRestOff = fromLeave.totalRestOff;
        toLeaveAppliedData.totalDeducated = fromLeave.totalDeducated;
        toLeaveAppliedData.totalDay = fromLeave.totalDay;
        toLeaveAppliedData.oldDates = {
          startDate: toLeaveAppliedData.startDate,
          endDate: toLeaveAppliedData.endDate,
          startAt: toLeaveAppliedData.startAt,
          endAt: toLeaveAppliedData.endAt,
        };
        toLeaveAppliedData.endAt = fromLeave.endAt;
        toLeaveAppliedData.startAt = fromLeave.startAt;
        toLeaveAppliedData.endDate = fromLeave.endDate;
        toLeaveAppliedData.startDate = fromLeave.startDate;
        toLeaveAppliedData.isSwapAccepted = 1;
        toLeaveAppliedData.isSwapRequestReceived = false;
        toLeaveAppliedData.isReceiver = 0;
        toLeaveAppliedData.lastSwapId = swapIdLog;
        //toLeaveAppliedData.swapLogId = [];
        //toLeaveAppliedData.swapLogId.push(swapIdLog)
        fromLeaveAppliedData.totalRestOff = toLeave.totalRestOff;
        fromLeaveAppliedData.totalDeducated = toLeave.totalDeducated;
        fromLeaveAppliedData.totalDay = toLeave.totalDay;
        fromLeaveAppliedData.oldDates = {
          startDate: fromLeaveAppliedData.startDate,
          endDate: fromLeaveAppliedData.endDate,
          startAt: fromLeaveAppliedData.startAt,
          endAt: fromLeaveAppliedData.endAt,
        };
        //fromLeaveAppliedData.swapLogId = [];
        //fromLeaveAppliedData.swapLogId.push(swapIdLog)
        // isSwapRequestSent:false, isSwapRequestReceived:false,
        //lastSwapId:ss, isSender: 0, isReceiver: 0
        fromLeaveAppliedData.endAt = toLeave.endAt;
        fromLeaveAppliedData.startAt = toLeave.startAt;
        fromLeaveAppliedData.endDate = toLeave.endDate;
        fromLeaveAppliedData.startDate = toLeave.startDate;
        fromLeaveAppliedData.isSwapAccepted = 1;
        fromLeaveAppliedData.lastSwapId = swapIdLog;
        fromLeaveAppliedData.isSwapRequestSent = false;
        fromLeaveAppliedData.isSender = 0;
        toStaffLeaveData.save();
        fromStaffLeaveData.save();
        const updateTo = await toLeaveAppliedData.save();
        const updateFrom = await fromLeaveAppliedData.save();
        // totalRestOff
        // totalDeducated
        // totalDay
        // endAt
        // startAt
        // endDate
        // startDate
        return { success: true, message: '' };
      } else {
        return { success: false, message: 'No Quota to perfrom swap' };
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async updateSwapRequest(req, res) {
    try {
      const body = req.body;
      const swapId = body.swapId;
      const status = body.status;
      let swapUpdate = await SwapLog.findOne({ _id: swapId });
      // notification
      const userDetailsTo = await User.findOne(
        { _id: swapUpdate.toUserId },
        { staffId: 1 },
      );
      const userDetailsFrom = await User.findOne(
        { _id: swapUpdate.fromUserId },
        { staffId: 1, deviceToken: 1 },
      );
      const tm = swapUpdate.from.timeZone ? swapUpdate.from.timeZone : '+08:00';
      const startDateN = moment(swapUpdate.from.startDate)
        .utcOffset(tm)
        .format('DD-MM-YYYY');
      const endDateN = moment(swapUpdate.from.endDate)
        .utcOffset(tm)
        .format('DD-MM-YYYY');
      const token = [userDetailsFrom.deviceToken];
      const pushData = {
          title: 'Your swap request updated',
          body: `${userDetailsTo.staffId} has ${
            status == 1 ? 'accepted' : 'rejected'
          } your swap request for ${startDateN} to ${endDateN}`,
          bodyTime: new Date(),
          bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
        },
        collapseKey = swapUpdate._id; /*unique id for this particular ballot */
      if (status == 1) {
        const swapDateResult = await this.swapDate(res, swapUpdate, swapId);
        if (swapDateResult.success) {
          swapUpdate.status = 1;
          const swapAccc = await swapUpdate.save();
          // auto cancel pending other request that received this staff
          let toUserId = swapUpdate.toUserId;
          let appliedLeaveTo = swapUpdate.appliedLeaveTo;
          let swapResult = await SwapLog.find({
            toUserId,
            appliedLeaveTo,
            status: 0,
          });
          if (swapResult && swapResult.length > 0) {
            let swapIdArr = [];
            swapResult.forEach((item) => {
              swapIdArr.push(item._id);
            });
            const swapUpdateAll = await SwapLog.update(
              { toUserId, appliedLeaveTo, status: 0 },
              { $set: { status: 2 } },
              { multi: true },
            );
            for (let i = 0; i < swapIdArr.length; i++) {
              let ss = swapIdArr[i];
              let leaveAppliedDataUpdate = await LeaveApplied.update(
                { swapLogId: ss },
                {
                  $set: {
                    isSwapAccepted: 0,
                    isSwapRequestSent: false,
                    isSwapRequestReceived: false,
                    lastSwapId: ss,
                    isSender: 0,
                    isReceiver: 0,
                  },
                },
                { multi: true },
              );
            }
          }
          FCM.push(token, pushData, collapseKey);
          return res.json({
            success: true,
            message: 'Swap request successfully accepted',
          });
        } else {
          return res.json({ success: false, message: swapDateResult.message });
        }
      } else {
        // update that leave
        swapUpdate.status = 2;
        const swapAccc = await swapUpdate.save();
        //const leaveAppliedData1 = await LeaveApplied.findOneAndUpdate({ swapLogId: swapId }, { $set: { isSwapAccepted: 0, isSwapRequestSent:false,lastSwapId:swapId } });
        const leaveAppliedData = await LeaveApplied.update(
          { swapLogId: swapId },
          {
            $set: {
              isSwapAccepted: 0,
              isSwapRequestSent: false,
              lastSwapId: swapId,
              isSwapRequestReceived: false,
              isSender: 0,
              isReceiver: 0,
            },
          },
          { multi: true },
        );
        FCM.push(token, pushData, collapseKey);
        return res.json({
          success: true,
          message: 'Swap request successfully rejected',
        });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async swapLog(req, res) {
    try {
      const userId = req.user._id;
      const swapData = await SwapLog.find({
        $or: [{ fromUserId: userId }, { toUserId: userId }],
      });
      return res.json({ success: true, data: swapData });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  checkIsPresent(data) {}
}
module.exports = new swappingController();
