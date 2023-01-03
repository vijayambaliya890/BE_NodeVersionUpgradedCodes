const mongoose = require("mongoose"),
  LeaveType = require("../../models/leaveType"),
  LeaveGroup = require("../../models/leaveGroup"),
  StaffLeave = require("../../models/staffLeave"),
  staffLeave = require("../../models/staffLeave"),
  OpsGroup = require("../../models/ops"),
  LeaveApplied = require("../../models/leaveApplied");
const __ = require("../../../helpers/globalFunctions");
const moment = require("moment");
const { use } = require("passport");
const User = require("../../models/user");
const ops = require("../../models/ops");
const opsTeam = require("../../models/opsTeam");
const LeaveLog = require('../../models/leaveLogs');
const PageSetting = require("../../models/pageSetting");
moment.suppressDeprecationWarnings = true;
class leaveManagementController {
  async readLeaveConfiguration(res, companyId) {
    try {
      const pageData = await PageSetting.findOne({ companyId: companyId });
      if (pageData && pageData.opsGroup && pageData.opsGroup.blockLeaveConfiguration) {
        if (pageData.opsGroup.blockLeaveConfiguration == 1) {
          return { total: 5, restOff: 2 };
        } else if (pageData.opsGroup.blockLeaveConfiguration == 2) {
          return { total: 6, restOff: 1 };
        } else {
          return { total: 7, restOff: 0 };
        }
      }
      return { total: 5, restOff: 2 };
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  // /type/leaverequest
  async leaveRequestType(req, res) {
    try {
      let body = req.body;
      if (body && !body.year) {
        body = { year: new Date().getFullYear() }
      }
      //req.user._id = "5a9973ae36ab4f444b42718b";
      const staffLeaveData = await StaffLeave.findOne({
        userId: req.user._id,
      }).populate([
        {
          path: "leaveGroupId",
          match: {
            isActive: true,
          },
          populate: [
            {
              path: "leaveType.leaveTypeId",
              match: {
                isActive: true,
              },
              select: "name",
            },
          ],
        },
      ]);
      let leaveTypeArr = [];
      if (staffLeaveData && staffLeaveData.leaveGroupId) {
        let leaveType = staffLeaveData.leaveGroupId.leaveType;
        for (let i = 0; i < leaveType.length; i++) {
          let leaveTypeObj = leaveType[i];
          if (leaveTypeObj.leavePlanning.isLeaveRequest) {
            //leaveTypeArr.push(leaveTypeObj)
            let leave = staffLeaveData.leaveDetails.filter((l) => {
              return l.leaveTypeId.toString() == leaveTypeObj.leaveTypeId._id.toString() && l.year == body.year;
            });
            if (leave && leave.length > 0) {
              leave = leave[0];
              let obj = {
                leaveTypeId: leave.leaveTypeId,
                name: leaveTypeObj.leaveTypeId.name,
                quota: leave.total,
                planQuota: leave.total,
                year: leave.year,
                requestedQuota: leave.total - leave.planQuota,
                takenQuota: leave.total - leave.quota,
              };
              leaveTypeArr.push(obj);
            }
          }
        }
      }
      res.json({ leaveTypeArr });
    } catch (err) {
      __.log(err);
      return res.status(500).json({ message: "something went wrong", success: false });
    }
  }
  ///type/applyleave
  async applyLeaveType(req, res) {
    try {
      //console.log("inheheh");
      //req.user._id = "5a9973ae36ab4f444b42718b";
      let body = req.body;
      if (body && !body.year) {
        body = { year: new Date().getFullYear() }
      }
      const staffLeaveData = await StaffLeave.findOne({
        userId: req.user._id,
      }).populate([
        {
          path: "leaveGroupId",
          match: {
            isActive: true,
          },
          populate: [
            {
              path: "leaveType.leaveTypeId",
              match: {
                isActive: true,
              },
              select: "name",
            },
          ],
        },
      ]);
      let leaveTypeArr = [];
      if (staffLeaveData && staffLeaveData.leaveGroupId) {
        let leaveType = staffLeaveData.leaveGroupId.leaveType;
        for (let i = 0; i < leaveType.length; i++) {
          let leaveTypeObj = leaveType[i];
          if (leaveTypeObj.leaveApplication.isApplyLeave) {
            //leaveTypeArr.push(leaveTypeObj)
            let leave = staffLeaveData.leaveDetails.filter((l) => {
              return l.leaveTypeId.toString() == leaveTypeObj.leaveTypeId._id.toString() && l.year == body.year;
            });
            if (leave && leave.length > 0) {
              leave = leave[0];
              let obj = {
                leaveTypeId: leave.leaveTypeId,
                name: leaveTypeObj.leaveTypeId.name,
                quota: leave.total,
                year: leave.year,
                planQuota: leave.total,
                requestedQuota: leave.total - leave.planQuota,
                takenQuota: leave.total - leave.quota,
              };
              leaveTypeArr.push(obj);
            }
          }
        }
      }
      res.json({ leaveTypeArr });
    } catch (err) {
      __.log(err);
      return res.status(500).json({ message: "something went wrong", success: false });
    }
  }
  // /type/applyleaveplan
  async applyLeavePlanType(req, res) {
    try {
      console.log("inheheh");
      // req.user._id = "5a9973ae36ab4f444b42718b";
      let body = req.body;
      if (body && !body.year) {
        body = { year: new Date().getFullYear() }
      }
      const staffLeaveData = await StaffLeave.findOne({
        userId: req.user._id,
      }).populate([
        {
          path: "leaveGroupId",
          match: {
            isActive: true,
          },
          populate: [
            {
              path: "leaveType.leaveTypeId",
              match: {
                isActive: true,
              },
              select: "name",
            },
          ],
        },
      ]);
      let leaveTypeArr = [];
      if (staffLeaveData && staffLeaveData.leaveGroupId) {
        let leaveType = staffLeaveData.leaveGroupId.leaveType;
        for (let i = 0; i < leaveType.length; i++) {
          let leaveTypeObj = leaveType[i];
          if (leaveTypeObj.leaveApplication.isApplyLeavePlan) {
            //leaveTypeArr.push(leaveTypeObj)
            let leave = staffLeaveData.leaveDetails.filter((l) => {
              return l.leaveTypeId.toString() == leaveTypeObj.leaveTypeId._id.toString() && l.year == body.year;
            });
            if (leave && leave.length > 0) {
              leave = leave[0];
              let obj = {
                leaveTypeId: leave.leaveTypeId,
                name: leaveTypeObj.leaveTypeId.name,
                quota: leave.total,
                year: leave.year,
                planQuota: leave.total,
                requestedQuota: leave.total - leave.planQuota,
                takenQuota: leave.total - leave.quota,
              };
              leaveTypeArr.push(obj);
            }
          }
        }
      }
      res.json({ leaveTypeArr });
    } catch (err) {
      __.log(err);
      return res.status(500).json({ message: "something went wrong", success: false });
    }
  }
  // /type/leaveAllocation
  async leaveAllocationLeaveType(req, res) {
    try {
      console.log("inheheh");
      let userId = req.body.userId;
      let body = req.body;
      if (body && !body.year) {
        body = { year: new Date().getFullYear() }
      }
      const staffLeaveData = await StaffLeave.findOne({
        userId: userId,
      }).populate([
        {
          path: "leaveGroupId",
          match: {
            isActive: true,
          },
          populate: [
            {
              path: "leaveType.leaveTypeId",
              match: {
                isActive: true,
              },
              select: "name",
            },
          ],
        },
      ]);
      let leaveTypeArr = [];
      if (staffLeaveData && staffLeaveData.leaveGroupId) {
        let leaveType = staffLeaveData.leaveGroupId.leaveType;
        for (let i = 0; i < leaveType.length; i++) {
          let leaveTypeObj = leaveType[i];
          if (leaveTypeObj.leavePlanning.isAdminAllocate) {
            //leaveTypeArr.push(leaveTypeObj)
            let leave = staffLeaveData.leaveDetails.filter((l) => {
              return l.leaveTypeId.toString() == leaveTypeObj.leaveTypeId._id.toString() && l.year == body.year;
            });
            if (leave && leave.length > 0) {
              leave = leave[0];
              let obj = {
                leaveTypeId: leave.leaveTypeId,
                name: leaveTypeObj.leaveTypeId.name,
                quota: leave.total,
                planQuota: leave.total,
                year: leave.year,
                requestedQuota: leave.total - leave.planQuota,
                takenQuota: leave.total - leave.quota,
              };
              leaveTypeArr.push(obj);
            }
          }
        }
      }
      res.json({ leaveTypeArr });
    } catch (err) {
      __.log(err);
      return res.status(500).json({ message: "something went wrong", success: false });
    }
  }
  // /type/allleavetype
  async allLeaveType(req, res) {
    try {
      console.log("inheheh");
      //req.user._id = "5a9973ae36ab4f444b42718b";
      let body = req.body;
      if (body && !body.year) {
        body = { year: new Date().getFullYear() }
      }
      const staffLeaveData = await StaffLeave.findOne({
        userId: req.user._id,
      }).populate([
        {
          path: "leaveGroupId",
          match: {
            isActive: true,
          },
          populate: [
            {
              path: "leaveType.leaveTypeId",
              match: {
                isActive: true,
              },
              select: "name",
            },
          ],
        },
      ]);
      let leaveTypeArr = [];
      if (staffLeaveData && staffLeaveData.leaveGroupId) {
        let leaveType = staffLeaveData.leaveGroupId.leaveType;
        //return res.json({staffLeaveData,leaveType})
        for (let i = 0; i < leaveType.length; i++) {
          let leaveTypeObj = leaveType[i];
          //leaveTypeArr.push(leaveTypeObj)
          if (leaveTypeObj.leaveTypeId) {
            let leave = staffLeaveData.leaveDetails.filter((l) => {
              return l.leaveTypeId.toString() == leaveTypeObj.leaveTypeId._id.toString() && l.year == body.year;
            });
            if (leave && leave.length > 0) {
              leave = leave[0];
              console.log("leaveTypeObj", leave);
              let obj = {
                leaveTypeId: leave.leaveTypeId,
                year: leave.year,
                name: leaveTypeObj.leaveTypeId.name,
                requestedQuota: leave.total - leave.planQuota,
                takenQuota: leave.total - leave.quota,
                quota: leaveTypeObj.displayInMyLeave ? leave.total : "-",
                planQuota: leaveTypeObj.displayInMyLeave ? leave.total : "-",
                displayInMyLeave: leaveTypeObj.displayInMyLeave,
              };
              leaveTypeArr.push(obj);
            }
          }
        }
      }
      res.json({ leaveTypeArr });
    } catch (err) {
      __.log(err);
      return res.status(500).json({ message: "something went wrong", success: false });
    }
  }
  // /leave/apply/leaverequest
  async applyLeaveRequest(req, res) {
    try {
      // req.user._id = "5a9973ae36ab4f444b42718b";
      const userId = req.user._id;
      const body = req.body;
      body.userId = userId;
      body.year = new Date(body.startDate).getFullYear();
      //return res.json({year:body.year})
      const overlapResult = await this.checkIsLeaveOverlapStaff(body);
      if (overlapResult.success) {
        console.log("i am here");
        const staffLeaveData = await staffLeave.findOne({ userId });
        if (staffLeaveData && staffLeaveData.leaveGroupId == body.leaveGroupId) {
          let leaveType = staffLeaveData.leaveDetails.filter((type) => {
            return type.leaveTypeId == body.leaveTypeId && type.year == body.year
          });
          // return res.json({leaveType})
          if (leaveType && leaveType.length > 0) {
            leaveType = leaveType[0];
            console.log('leaveType', leaveType)
            let startDate = moment(body.startDate); //.format('DD-MM-YYYY');
            console.log("startDate", startDate);
            let endDate = moment(body.endDate); //.format('DD-MM-YYYY');
            let diff = endDate.diff(startDate, "days") + 1;
            if (body.startAt.toLowerCase() != body.endAt.toLowerCase()) {
              diff = diff - 0.5;
            }
            let totalDeducated = diff;
            let totalRestOff = 0;
            const leaveConfig = await this.readLeaveConfiguration(res, req.user.companyId);
            if (diff >= 7) {
              totalRestOff = parseInt(diff / 7) * leaveConfig.restOff;
              totalDeducated = totalDeducated - totalRestOff;
            }
            console.log("totalDeducated", totalDeducated);
            let isPlanQuota = leaveType.planQuota - totalDeducated;
            const isQuotaCheck = await this.checkLeaveConfig(res, leaveType);
            if (isPlanQuota >= 0 || isQuotaCheck) {
              const obj = {
                isQuotaCheck: !isQuotaCheck,
                userId,
                startDate,
                endDate,
                leaveTypeId: body.leaveTypeId,
                leaveGroupId: body.leaveGroupId,
                remark: body.remark,
                timeZone: body.timeZone,
                totalDay: diff,
                totalRestOff,
                totalDeducated,
                attachment: body.attachment,
                submittedFrom: body.submittedFrom,
                startAt: body.startAt,
                endAt: body.endAt,
                businessUnitId: req.user.parentBussinessUnitId,
              };
              const saveLeave = new LeaveApplied(obj).save();
              console.log('body.leaveTypeId', body.leaveTypeId, body.year)
              const updateStaffLeave = await staffLeave.findOneAndUpdate(
                { userId, leaveDetails: { "$elemMatch": { "year": body.year, leaveTypeId: body.leaveTypeId } } },
                { $set: { "leaveDetails.$.planQuota": isPlanQuota }, $inc: { "leaveDetails.$.request": totalDeducated } }
              );
              return res.json({
                saveLeave,
                success: true,
                message: "Leave Successfully applied",
              });
            } else {
              return res.json({
                isPlanQuota,
                success: false,
                message: "Plan quota is not sufficient to apply for leaves, please check.",
              });
            }
          } else {
            return res.json({
              success: false,
              message: "Leave type not found for this staff",
            });
          }
        } else {
          return res.json({
            success: false,
            message: "Leave group not found for this staff",
          });
        }
      } else {
        return res.json({
          success: false,
          message: "Leave dates are overlapping, please check.",
        });
      }
    } catch (e) {
      return res.json({ success: false, message: "something went wrong", e });
    }
  }
  // /leave/apply
  async applyLeave(req, res) {
    try {
      //req.user._id = "5a9973ae36ab4f444b42718b";
      const userId = req.user._id;
      const body = req.body;
      body.userId = userId;
      body.year = new Date(body.startDate).getFullYear();
      const overlapResult = await this.checkIsLeaveOverlapStaff(body);
      if (overlapResult.success) {
        const staffLeaveData = await staffLeave.findOne({ userId });
        if (staffLeaveData && staffLeaveData.leaveGroupId == body.leaveGroupId) {
          let leaveType = staffLeaveData.leaveDetails.filter((type) => type.leaveTypeId == body.leaveTypeId && type.year == body.year);
          if (leaveType && leaveType.length > 0) {
            leaveType = leaveType[0];
            let startDate = moment(body.startDate); //.format('DD-MM-YYYY');
            console.log("startDate", startDate);
            let endDate = moment(body.endDate); //.format('DD-MM-YYYY');
            let diff = endDate.diff(startDate, "days") + 1;
            if (body.startAt.toLowerCase() != body.endAt.toLowerCase()) {
              diff = diff - 0.5;
            }
            let totalDeducated = diff;
            let totalRestOff = 0;
            const leaveConfig = await this.readLeaveConfiguration(res, req.user.companyId);
            if (diff >= 7) {
              totalRestOff = parseInt(diff / 7) * leaveConfig.restOff;
              totalDeducated = totalDeducated - totalRestOff;
            }
            // check here from quota not from plan quota
            let isQuota = leaveType.quota - totalDeducated;
            let isPlanQuota = leaveType.planQuota - totalDeducated;
            let isQuotaCheck = await this.checkLeaveConfig(res, leaveType);
            if (isQuota >= 0 || isQuotaCheck) {
              const obj = {
                isQuotaCheck: !isQuotaCheck,
                userId,
                startDate,
                endDate,
                leaveTypeId: body.leaveTypeId,
                leaveGroupId: body.leaveGroupId,
                remark: body.remark,
                timeZone: body.timeZone,
                totalDay: diff,
                totalRestOff,
                totalDeducated,
                attachment: body.attachment,
                submittedFrom: body.submittedFrom,
                startAt: body.startAt,
                endAt: body.endAt,
                businessUnitId: req.user.parentBussinessUnitId,
              };
              const saveLeave = new LeaveApplied(obj).save();
              const updateStaffLeave = await staffLeave.findOneAndUpdate(
                { userId, leaveDetails: { "$elemMatch": { "year": body.year, leaveTypeId: body.leaveTypeId } } },
                {
                  $set: { "leaveDetails.$.quota": isQuota, "leaveDetails.$.planQuota": isPlanQuota },
                  $inc: { "leaveDetails.$.request": totalDeducated, "leaveDetails.$.taken": totalDeducated },
                }
              );
              return res.json({
                saveLeave,
                success: true,
                message: "Leave Successfully applied",
              });
            } else {
              return res.json({
                isPlanQuota,
                success: false,
                message: "Quota is not sufficient to apply for leaves, please check.",
              });
            }
          } else {
            return res.json({
              success: false,
              message: "Leave type not found for this staff",
            });
          }
        } else {
          return res.json({
            success: false,
            message: "Leave group not found for this staff",
          });
        }
      } else {
        return res.json({
          success: false,
          message: "Leave dates are overlapping, please check.",
        });
      }
    } catch (e) {
      return res.json({ success: false, message: "something went wrong", e });
    }
  }
  // /leave/reject
  async applyReject(req, res) {
    try {
      const userId = req.user._id;
      const body = req.body;
      body.userId = userId;
      body.year = new Date(body.startDate).getFullYear();
      const overlapResult = await this.checkIsLeaveOverlapStaff(body);
      if (overlapResult.success) {
        const staffLeaveData = await staffLeave.findOne({ userId });
        if (staffLeaveData && staffLeaveData.leaveGroupId == body.leaveGroupId) {
          let leaveType = staffLeaveData.leaveDetails.filter((type) => type.leaveTypeId == body.leaveTypeId && type.year == body.year);
          if (leaveType && leaveType.length > 0) {
            leaveType = leaveType[0];
            let startDate = moment(body.startDate); //.format('DD-MM-YYYY');
            console.log("startDate", startDate);
            let endDate = moment(body.endDate); //.format('DD-MM-YYYY');
            let diff = endDate.diff(startDate, "days");
            if (body.startAt.toLowerCase() != body.endAt.toLowerCase()) {
              diff = diff - 0.5;
            }
            let totalDeducated = diff;
            let totalRestOff = 0;
            const leaveConfig = await this.readLeaveConfiguration(res, req.user.companyId);
            if (diff >= 7) {
              totalRestOff = parseInt(diff / 7) * leaveConfig.restOff;
              totalDeducated = totalDeducated - totalRestOff;
            }
            let isPlanQuota = leaveType.planQuota - totalDeducated;
            const isQuotaCheck = await this.checkLeaveConfig(res, leaveType);
            if (isPlanQuota >= 0 || isQuotaCheck) {
              const obj = {
                isQuotaCheck: !isQuotaCheck,
                userId,
                startDate,
                endDate,
                leaveTypeId: body.leaveTypeId,
                leaveGroupId: body.leaveGroupId,
                remark: body.remark,
                timeZone: body.timeZone,
                totalDay: diff,
                attachment: body.attachment,
                startAt: body.startAt,
                endAt: body.endAt,
                businessUnitId: req.user.parentBussinessUnitId,
                status: 0,
              };
              const saveLeave = await LeaveApplied.findOneAndUpdate(
                { _id: body.appliedLeaveId, status: 2 },
                {
                  $set: {
                    startDate,
                    endDate,
                    totalDeducated,
                    totalRestOff,
                    startAt: body.startAt,
                    endAt: body.endAt,
                    remark: body.remark,
                    status: 0,
                    totalDay: diff,
                    attachment: body.attachment,
                  },
                }
              );
              const updateStaffLeave = await staffLeave.findOneAndUpdate(
                { userId, leaveDetails: { "$elemMatch": { "year": body.year, leaveTypeId: body.leaveTypeId } } },
                { $set: { "leaveDetails.$.planQuota": isPlanQuota }, $inc: { "leaveDetails.$.request": totalDeducated } }
              );
              return res.json({
                saveLeave,
                success: true,
                message: "Leave Successfully submiteed again",
              });
            } else {
              return res.json({
                success: false,
                message: "Plan quota is not sufficient to apply for leaves, please check.",
              });
            }
          } else {
            return res.json({
              success: false,
              message: "Leave type not found for this staff",
            });
          }
        } else {
          return res.json({
            success: false,
            message: "Leave group not found for this staff",
          });
        }
      } else {
        return res.json({
          success: false,
          message: "Leave dates are overlapping, please check.",
        });
      }
    } catch (e) {
      return res.json({ success: false, message: "something went wrong", e });
    }
  }
  // /appliedLeave
  async getAppliedLeaves(req, res) {
    try {
      console.log("req.user._id", req.user._id);
      const body = req.body;
      const opsGroupData = await OpsGroup.find({ adminId: req.user._id, isDelete: false, isDraft: false }, { userId: 1, opsGroupName: 1 });
      let userId = [];
      opsGroupData.forEach((user) => {
        userId.push(...user.userId);
      });
      // return res.json({opsGroupData})
      let leaveList = await LeaveApplied.find({
        $expr: { $eq: [{ $year: "$startDate" }, body.year] },
        userId: { $in: userId },
      }).populate([
        {
          path: "userId",
          select: "name staffId email contactNumber appointmentId profilePicture",
          populate: [
            {
              path: "appointmentId",
              select: "name",
            },
          ],
        },
        {
          path: "leaveTypeId",
          select: "name",
        },
        {
          path: "leaveGroupId",
          select: "name",
        },
        {
          path: "businessUnitId",
          select: "name status",
          match: {
            status: 1,
          },
          populate: {
            path: "sectionId",
            match: {
              status: 1,
            },
            select: "name",
            populate: {
              path: "departmentId",
              match: {
                status: 1,
              },
              select: "name",
              populate: {
                path: "companyId",
                match: {
                  status: 1,
                },
                select: "name",
              },
            },
          },
        },
        {
          path: "approvalHistory.approvalBy",
          select: "staffId name",
        },
      ]);
      leaveList = JSON.parse(JSON.stringify(leaveList));
      let len = leaveList.length;
      for (let i = 0; i < len; i++) {
        const item = leaveList[i];
        let opsG = opsGroupData.filter((op) => {
          let aa = op.userId.map(String);
          return aa.includes(item.userId._id.toString());
        });
        console.log("opsGopsG", opsG);
        opsG = opsG[0];
        let opsObj = {
          name: opsG.opsGroupName,
          opsGroupId: opsG._id,
        };
        leaveList[i].opsGroup = opsObj;
      }
      return res.json({ data: leaveList, success: true });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    };
  }
  // /appliedLeave/bu
  async getAppliedLeavesFromBu(req, res) {
    const buIds = await User.findOne({ _id: req.user._id }, { parentBussinessUnitId: 1, planBussinessUnitId: 1 });
    let buId = buIds.planBussinessUnitId;
    buId.push(buIds.parentBussinessUnitId);
    const userIds = await User.find({ parentBussinessUnitId: { $in: buId } }, { _id: 1 });
    let userId = userIds.map(user => user._id);
    const opsGroupData = await OpsGroup.find({ userId: { $in: userId }, isDelete: false, isDraft: false }, { opsGroupName: 1, userId: 1 }).sort({
      updatedAt: -1,
    });
    const year = parseInt(req.query.year) || moment().year();
    let leaveList = await LeaveApplied.find({
      $expr: { $eq: [{ $year: "$startDate" }, year] },
      userId: { $in: userId },
      status: { $in: [0] },
    }).populate([
      {
        path: "userId",
        select: "name staffId email contactNumber appointmentId profilePicture",
        populate: [
          {
            path: "appointmentId",
            select: "name",
          },
        ],
      },
      {
        path: "leaveTypeId",
        select: "name",
      },
      {
        path: "leaveGroupId",
        select: "name",
      },
      {
        path: "businessUnitId",
        select: "name status",
        match: {
          status: 1,
        },
        populate: {
          path: "sectionId",
          match: {
            status: 1,
          },
          select: "name",
          populate: {
            path: "departmentId",
            match: {
              status: 1,
            },
            select: "name",
            populate: {
              path: "companyId",
              match: {
                status: 1,
              },
              select: "name",
            },
          },
        },
      },
      {
        path: "approvalHistory.approvalBy",
        select: "staffId name",
      },
      {
        path: "cancelledBy",
        select: "staffId name",
      },
    ]).sort({ createdAt: -1 });
    leaveList = JSON.parse(JSON.stringify(leaveList));
    let len = leaveList.length;
    for (let i = 0; i < len; i++) {
      const item = leaveList[i];
      let opsG = opsGroupData.filter((op) => {
        let aa = op.userId.map(String);
        return aa.includes(item.userId._id.toString());
      });
      if (opsG && opsG.length > 0) {
        leaveList[i].opsGroup = {
          name: opsG[0].opsGroupName,
          opsGroupId: opsG[0]._id,
        };
      }
    }
    return res.json({ data: leaveList, success: true });
  }
  // /staff/appliedLeave
  async getAppliedLeavesForStaff(req, res) {
    try {
      // req.user._id = "5a9973ae36ab4f444b42718b"
      const leaveList = await LeaveApplied.find({
        $expr: { $eq: [{ $year: "$startDate" }, req.body.year] },
        userId: req.user._id,
        submittedFrom: 1,
      }).populate([
        {
          path: "userId",
          select: "name staffId email contactNumber appointmentId profilePicture",
          populate: [
            {
              path: "appointmentId",
              select: "name",
            },
          ],
        },
        {
          path: "leaveTypeId",
          select: "name",
        },
        {
          path: "leaveGroupId",
          select: "name",
        },
        {
          path: "businessUnitId",
          select: "name status",
          match: {
            status: 1,
          },
          populate: {
            path: "sectionId",
            match: {
              status: 1,
            },
            select: "name",
            populate: {
              path: "departmentId",
              match: {
                status: 1,
              },
              select: "name",
              populate: {
                path: "companyId",
                match: {
                  status: 1,
                },
                select: "name",
              },
            },
          },
        },
        {
          path: "approvalHistory.approvalBy",
          select: "staffId name",
        },
        {
          path: "cancelledBy",
          select: "staffId name",
        },
      ]);
      // var grouped = _.mapValues(
      //   _.groupBy(leaveList, "submittedFrom"),
      //   (clist) => clist.map((car) => _.omit(car, "submittedFrom"))
      // );
      return res.json({ data: leaveList, success: true });
    } catch (e) {
      return res.json({ success: false, message: "something went wrong", e });
    }
  }
  // /staff/leaverequest
  async getLeavesRequestForStaff(req, res) {
    try {
      const leaveList = await LeaveApplied.find({
        $expr: { $eq: [{ $year: "$startDate" }, req.body.year] },
        userId: req.user._id,
        submittedFrom: 2,
        status: { $in: [0, 2] },
      }).populate([
        {
          path: "userId",
          select: "name staffId email contactNumber appointmentId",
          populate: [
            {
              path: "appointmentId",
              select: "name",
            },
          ],
        },
        {
          path: "leaveTypeId",
          select: "name",
        },
        {
          path: "leaveGroupId",
          select: "name",
        },
        {
          path: "businessUnitId",
          select: "name status",
          match: {
            status: 1,
          },
          populate: {
            path: "sectionId",
            match: {
              status: 1,
            },
            select: "name",
            populate: {
              path: "departmentId",
              match: {
                status: 1,
              },
              select: "name",
              populate: {
                path: "companyId",
                match: {
                  status: 1,
                },
                select: "name",
              },
            },
          },
        },
        {
          path: "approvalHistory.approvalBy",
          select: "staffId name",
        },
      ]);
      // var grouped = _.mapValues(
      //   _.groupBy(leaveList, "submittedFrom"),
      //   (clist) => clist.map((car) => _.omit(car, "submittedFrom"))
      // );
      return res.json({ data: leaveList, success: true });
    } catch (e) {
      return res.json({ success: false, message: "something went wrong", e });
    }
  }
  getStatus(from) {
    var status = [];
    if (from == "rejected") {
      status = [2, 9];
    } else if (from == "pending") {
      status = [0, 7];
    } else if (from == "approved") {
      status = [1, 8];
    } else if (from == "cancelled") {
      status = [5];
    }
    return status;
  }
  // /leavetype/count
  async leaveTypeCount(req, res) {
    try {
      // get leaves
      // find leave applied on that date
      const body = req.body;
      let leaveType = await LeaveType.find({ companyId: req.user.companyId, isActive: true }, { name: 1 });
      console.log("req.user._id", req.user._id);
      const buIds = await User.findOne({ _id: req.user._id }, { parentBussinessUnitId: 1, planBussinessUnitId: 1 });
      let buId = buIds.planBussinessUnitId;
      if (buId.length > 0) {
        buId.push(buIds.parentBussinessUnitId);
      }
      const userIds = await User.find({ parentBussinessUnitId: { $in: buId } }, { _id: 1 });
      let userId = [];
      userIds.forEach((item) => {
        userId.push(item._id);
      });
      const date = moment(new Date(body.date)).utc(body.timeZone).format();
      console.log("date", date);
      let status = this.getStatus(body.from);
      const leaveApplied = await LeaveApplied.find({
        $expr: { $eq: [{ $year: "$startDate" }, req.body.year] },
        userId: { $in: userId },
        status: { $in: status },
      });
      var grouped = _.mapValues(_.groupBy(leaveApplied, "leaveTypeId"), (clist) => clist.map((leaveApplied) => _.omit(leaveApplied, "leaveTypeId")));
      leaveType = JSON.parse(JSON.stringify(leaveType));
      for (let i = 0; i < leaveType.length; i++) {
        const key = leaveType[i]._id;
        if (grouped[key] && grouped[key].length > 0) {
          let total = grouped[key].length;
          // for (let j = 0; j < grouped[key].length; j++) {
          //   const ll = grouped[key];
          //   total = total + 1;
          // }
          leaveType[i].total = total;
        } else {
          leaveType[i].total = 0;
        }
      }
      return res.json({ leaveType, success: true });
    } catch (err) {
      __.log(err);
      return res.status(500).json({ message: "something went wrong", success: false });
    }
  }
  async getOpsGroup(res, userId) {
    try {
      const opsG = await ops.findOne({ userId, isDelete: false }, { noOfTeam: 1, opsGroupName: 1 });
      const opp = {}
      if (opsG && opsG.noOfTeam != 0) {
        opp.opsGroupName = opsG.opsGroupName;
        const opsTeamT = await opsTeam.findOne({ userId, isDeleted: false }, { name: 1 })
        console.log("opsTeamT", opsTeamT)
        opp.opsTeamName = opsTeamT ? opsTeamT.name : '';
        return { success: true, details: opp }
      } else if (opsG) {
        opp.opsGroupName = opsG.opsGroupName;
        opp.opsTeamName = '';
        return { success: true, details: opp }
      } else {
        return { success: false }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    };
  }
  // /leavetype/appliedleave
  async getLeaveTypeAppliedLeaves(req, res) {
    try {
      // get leaves
      // find leave applied on that date
      const body = req.body;
      // let leaveType = await LeaveType.find(
      //   { companyId: req.user.companyId, isActive: true },
      //   { name: 1 }
      // );
      console.log("req.user._id", req.user.companyId);
      const buIds = await User.findOne({ _id: req.user._id }, { parentBussinessUnitId: 1, planBussinessUnitId: 1 });
      let buId = buIds.planBussinessUnitId;
      if (buId.length > 0) {
        buId.push(buIds.parentBussinessUnitId);
      }
      const userIds = await User.find({ parentBussinessUnitId: { $in: buId } }, { _id: 1 });
      let userId = [];
      userIds.forEach((item) => {
        userId.push(item._id);
      });
      const date = moment(new Date(body.date)).utc(body.timeZone).format();
      console.log("date", date);
      let status = this.getStatus(body.from);
      let leaveApplied = await LeaveApplied.find({
        $expr: { $eq: [{ $year: "$startDate" }, req.body.year] },
        userId: { $in: userId },
        leaveTypeId: body.leaveTypeId,
        status: { $in: status },
      }).populate([
        {
          path: "userId",
          select: "name staffId email contactNumber appointmentId profilePicture",
          populate: [
            {
              path: "appointmentId",
              select: "name",
            },
          ],
        },
        {
          path: "leaveTypeId",
          select: "name",
        },
        {
          path: "leaveGroupId",
          select: "name",
        },
        {
          path: "businessUnitId",
          select: "name status",
          match: {
            status: 1,
          },
          populate: {
            path: "sectionId",
            match: {
              status: 1,
            },
            select: "name",
            populate: {
              path: "departmentId",
              match: {
                status: 1,
              },
              select: "name",
              populate: {
                path: "companyId",
                match: {
                  status: 1,
                },
                select: "name",
              },
            },
          },
        },
        {
          path: "approvalHistory.approvalBy",
          select: "staffId name",
        },
      ]);
      leaveApplied = JSON.parse(JSON.stringify(leaveApplied));
      //return res.json({leaveApplied})

      leaveApplied = leaveApplied.sort((a, b) => {
        return a.startDate - b.startDate;
      });
      const opsGroupDetails = {}
      for (let i = 0; i < leaveApplied.length; i++) {
        const item = leaveApplied[i];
        if (!opsGroupDetails[item.userId._id]) {
          const opsDetails = await this.getOpsGroup(res, item.userId._id);
          if (opsDetails.success) {
            leaveApplied[i].opsDetails = opsDetails.details;
            opsGroupDetails[item.userId._id] = {}
            opsGroupDetails[item.userId._id] = opsDetails;
          } else {
            opsGroupDetails[item.userId._id] = {}
            opsGroupDetails[item.userId._id].details = {
              opsGroupName: '',
              opsTeamName: ""
            }
          }
        } else {
          console.log('*******************')
          leaveApplied[i].opsDetails = opsGroupDetails[item.userId._id].details;
        }
        const monthYear = moment(item.startDate).format("MMM YYYY");
        leaveApplied[i].monthYear = monthYear;
      }
      let orderedDates = {};
      let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      var grouped = _.groupBy(leaveApplied, "monthYear"); // _.mapValues(_.groupBy(leaveApplied, "monthYear"), (clist) => clist.map((leaveApplied) => _.omit(leaveApplied, "monthYear")));
      Object.keys(grouped)
        .sort(function (a, b) {
          // let aM = a.split(" ")[0];
          // let bM = b.split(" ")[0];
          // let aKey = months.indexOf(aM);
          // let bKey = months.indexOf(bM);
          return new Date(grouped[a][0].startDate).getTime() - new Date(grouped[b][0].startDate).getTime();
        })
        .forEach(function (key) {
          console.log(key);
          orderedDates[key] = grouped[key];
        });
      // //grouped = _.sortBy((group) => leaveApplied.indexOf(group[0]));
      return res.json({ leaveType: orderedDates, success: true });
    } catch (err) {
      __.log(err);
      return res.status(500).json({ message: "something went wrong", success: false });
    }
  }
  async approvalHistoryCommon(data) {
    for (let i = 0; i < data.length; i++) {
      const leaveList = await LeaveApplied.find({
        userId: req.user._id,
        submittedFrom: 3,
      }).populate([
        {
          path: "userId",
          select: "name staffId email contactNumber appointmentId profilePicture",
          populate: [
            {
              path: "appointmentId",
              select: "name",
            },
          ],
        },
        {
          path: "leaveTypeId",
          select: "name",
        },
        {
          path: "leaveGroupId",
          select: "name",
        },
        {
          path: "businessUnitId",
          select: "name status",
          match: {
            status: 1,
          },
          populate: {
            path: "sectionId",
            match: {
              status: 1,
            },
            select: "name",
            populate: {
              path: "departmentId",
              match: {
                status: 1,
              },
              select: "name",
              populate: {
                path: "companyId",
                match: {
                  status: 1,
                },
                select: "name",
              },
            },
          },
        },
        {
          path: "approvalHistory.approvalBy",
          select: "staffId name",
        },
      ]);
      // var grouped = _.mapValues(
      //   _.groupBy(leaveList, "submittedFrom"),
      //   (clist) => clist.map((car) => _.omit(car, "submittedFrom"))
      // );
    }
  }
  // staff/allocatedleave
  async getAllocatedBallotedForStaff(req, res) {
    try {
      let userId = req.user._id;
      let leaveList = await LeaveApplied.find({
        $expr: { $eq: [{ $year: "$startDate" }, req.body.year] },
        userId: req.user._id,
        $or: [
          {
            submittedFrom: { $in: [3, 4] },
          },
          { submittedFrom: 2, status: { $in: [1, 7, 8, 9] } },
        ],
      }).populate([
        {
          path: "userId",
          select: "name staffId email contactNumber appointmentId profilePicture parentBussinessUnitId",
          populate: [
            {
              path: "appointmentId",
              select: "name",
            },
            {
              path: "parentBussinessUnitId",
              select: "name",
              populate: {
                path: "sectionId",
                select: "name",
                populate: {
                  path: "departmentId",
                  select: "name status",
                  populate: {
                    path: "companyId",
                    select: "name status",
                  },
                },
              }
            }
          ],
        },
        {
          path: "leaveTypeId",
          select: "name",
        },
        {
          path: "leaveGroupId",
          select: "name leaveType",
        },
        {
          path: "sentSwapLogId"
        },
        {
          path: "swapLogId"
        },
        {
          path: "lastSwapId",
          populate: [{
            path: 'fromUserId',
            select: 'name staffId'
          },
          {
            path: 'toUserId',
            select: 'name staffId'
          }]
        },
        {
          path: "businessUnitId",
          select: "name status",
          match: {
            status: 1,
          },
          populate: {
            path: "sectionId",
            match: {
              status: 1,
            },
            select: "name",
            populate: {
              path: "departmentId",
              match: {
                status: 1,
              },
              select: "name",
              populate: {
                path: "companyId",
                match: {
                  status: 1,
                },
                select: "name",
              },
            },
          },
        },
        {
          path: "approvalHistory.approvalBy",
          select: "staffId name",
        },
        {
          path: "cancelledBy",
          select: "staffId name",
        },
      ]).sort({ startDate: 1 });
      const opsGroupDetails = await ops.findOne({ userId: userId, isDelete: false }, { swopSetup: 1, opsGroupName: 1 });
      const opsTeamName = await opsTeam.findOne({ userId: userId, isDeleted: false }, { name: 1 });
      if (opsGroupDetails) {
        let isSwapAllowed = true;
        if (opsGroupDetails.swopSetup == 0) {
          isSwapAllowed = false;
        }
        if (isSwapAllowed) {
          const userData = await User.findOne({ _id: userId }, { isLeaveSwapAllowed: 1 });
          isSwapAllowed = !userData.isLeaveSwapAllowed;
        }
        const opsDetails = {
          opsGroupName: opsGroupDetails.opsGroupName,
          opsTeamName: opsTeamName ? opsTeamName.name : '-'
        }
        //if (!isSwapAllowed) {
        leaveList = JSON.parse(JSON.stringify(leaveList));
        for (let i = 0; i < leaveList.length; i++) {
          leaveList[i].opsDetails = opsDetails;
          //console.log('leaveList[i].leaveTypeId', leaveList[i].leaveGroupId)
          let leaveDetails = leaveList[i].leaveGroupId.leaveType.filter((item) => {
            return item.leaveTypeId.toString() == leaveList[i].leaveTypeId._id.toString();
          });
          console.log('leaveDetails ', leaveDetails)
          if (leaveDetails && leaveDetails.length > 0) {
            leaveDetails = leaveDetails[0];
            leaveList[i].leaveTypeDetails = leaveDetails
          }
          if (leaveList[i].leaveTypeId.name.toLowerCase() != 'annual leave') {
            leaveList[i].isSwappable = 3;
          } else if (!isSwapAllowed) {
            leaveList[i].isSwappable = 2;
          }
          leaveList[i].businessUnitId = leaveList[i].userId.parentBussinessUnitId
        }
        // const opsDetails = {
        //   opsGroupName:opsGroupDetails.opsGroupName,
        //   opsTeamName: opsTeamName?opsTeamName.name:'-'
        // }
        // var grouped = _.mapValues(
        //   _.groupBy(leaveList, "submittedFrom"),
        //   (clist) => clist.map((car) => _.omit(car, "submittedFrom"))
        // );
        return res.json({ data: leaveList, success: true, opsDetails });
      } else {
        return res.json({ data: [], success: false, message: "No OPS Group" });
      }
    } catch (e) {
      return res.json({ success: false, message: "something went wrong", e });
    }
  }
  async uploadContentFiles(req, res) {
    try {
      if (!req.file) {
        return __.out(res, 300, `No File is Uploaded`);
      }
      __.log(req.file, "fileName");
      let storePath = `uploads/leaveManagementAttachment/${req.file.filename}`;
      let filePath = `${__.serverBaseUrl()}${storePath}`;
      res.status(201).send({
        link: filePath,
        filePath: storePath,
      });
      const result = await __.scanFile(req.file.filename, `public/uploads/leaveManagementAttachment/${req.file.filename}`);
      if (!!result) {
        //return __.out(res, 300, result);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }
  // /leave/status
  async updateLeaveStatus(req, res) {
    try {
      let body = req.body;
      let status = 2;
      if (body.isApprove) {
        status = 1;
      }
      const leaveData = await LeaveApplied.findOne({ _id: body.appliedLeaveId });
      body.year = new Date(leaveData.startDate).getFullYear();
      if (leaveData.submittedFrom == 2 && leaveData.status == 7 && status == 1) {
        // approve
        status = 8;
      } else if (leaveData.submittedFrom == 2 && leaveData.status == 7 && status == 1) {
        // reject
        status = 9;
      }
      const approaval = {
        approvalBy: req.user._id,
        approvalDateTime: new Date(),
        approvalRemark: body.approvalRemark,
        approvalFrom: body.approvalFrom,
        status,
      };
      const leaveList = await LeaveApplied.findOneAndUpdate(
        { _id: body.appliedLeaveId, status: 0 },
        { $set: { status, totalDeducated: body.totalDeducated, totalRestOff: body.totalRestOff }, $push: { approvalHistory: approaval } }
      );
      if (leaveList) {
        if (status == 1 || status == 8) {
          // approve
          const totalDeducated = leaveData.totalDeducated;
          if (body.totalDeducated != totalDeducated) {
            const change = body.totalDeducated - totalDeducated;
            if (leaveData.submittedFrom == 1 && status == 1) {
              const decQuota = await StaffLeave.findOneAndUpdate(
                {
                  userId: leaveData.userId,
                  leaveDetails: { "$elemMatch": { "year": body.year, leaveTypeId: leaveData.leaveTypeId } }
                },
                { $inc: { "leaveDetails.$.planQuota": -change, "leaveDetails.$.quota": -change, "leaveDetails.$.request": -change } }
              );
            } else {
              const decQuota = await StaffLeave.findOneAndUpdate(
                {
                  userId: leaveData.userId,
                  leaveDetails: { "$elemMatch": { "year": body.year, leaveTypeId: leaveData.leaveTypeId } }
                },
                { $inc: { "leaveDetails.$.planQuota": -change, "leaveDetails.$.request": -change } }
              );
            }
          }
        } else {
          // reject
          let totalDays = leaveList.totalDeducated;
          if (leaveData.submittedFrom == 2 && status == 2) {
            // leave request reject at first place
            const decQuota = await StaffLeave.findOneAndUpdate(
              {
                userId: leaveList.userId,
                leaveDetails: { "$elemMatch": { "year": body.year, leaveTypeId: leaveList.leaveTypeId } }
              },
              { $inc: { "leaveDetails.$.planQuota": totalDays, "leaveDetails.$.request": -totalDays } }
            );
          } else if (leaveData.submittedFrom == 1) {
            // direct leave
            const decQuota = await StaffLeave.findOneAndUpdate(
              {
                userId: leaveList.userId,
                leaveDetails: { "$elemMatch": { "year": body.year, leaveTypeId: leaveList.leaveTypeId } }
              },
              {
                $inc: {
                  "leaveDetails.$.planQuota": totalDays,
                  "leaveDetails.$.quota": totalDays,
                  "leaveDetails.$.request": -totalDays,
                  "leaveDetails.$.taken": -totalDays,
                },
              }
            );
          }
          //reject
        }
        return res.json({
          success: true,
          message: "Applied Leave successfully updated",
        });
      } else {
        return res.json({ success: false, message: "Applied Leave not found" });
      }
    } catch (e) {
      return res.json({ success: false, message: "something went wrong", e });
    }
  }
  async checkLeaveConfig(res, leaveType) {
    try {
      if (leaveType.total == 0) {
        return true;
      }
      const leaveTypeData = await LeaveType.findOne({ _id: leaveType.leaveTypeId });
      return leaveTypeData.isQuotaExceed;
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    };
  }
  // /allocatteleave
  async allocateLeave(req, res) {
    try {
      console.log("hhhh");
      const body = req.body;
      const userId = body.userId;
      body.year = new Date(body.startDate).getFullYear();
      const staffLeaveData = await staffLeave.findOne({ userId });
      if (staffLeaveData && staffLeaveData.leaveGroupId == body.leaveGroupId) {
        let leaveType = staffLeaveData.leaveDetails.filter((type) => type.leaveTypeId == body.leaveTypeId && type.year == body.year);
        if (leaveType && leaveType.length > 0) {
          leaveType = leaveType[0];
          let startDate = moment(body.startDate); //.format('DD-MM-YYYY');
          console.log("startDate", startDate);
          let endDate = moment(body.endDate); //.format('DD-MM-YYYY');
          let diff = endDate.diff(startDate, "days") + 1;
          if (body.startAt.toLowerCase() != body.endAt.toLowerCase()) {
            diff = diff - 0.5;
          }
          let totalDeducated = diff;
          let totalRestOff = 0;
          const leaveConfig = await this.readLeaveConfiguration(res, req.user.companyId);
          if (diff >= 7) {
            totalRestOff = parseInt(diff / 7) * leaveConfig.restOff;
            totalDeducated = totalDeducated - totalRestOff;
          }
          let isPlanQuota = 0;
          const isQuotaCheck = await this.checkLeaveConfig(res, leaveType);
          isPlanQuota = leaveType.planQuota - totalDeducated;
          if (isPlanQuota >= 0 || isQuotaCheck) {
            const userData = await User.findOne({ _id: userId }, { parentBussinessUnitId: 1 });
            const obj = {
              isQuotaCheck: !isQuotaCheck,
              userId,
              startDate,
              endDate,
              leaveTypeId: body.leaveTypeId,
              leaveGroupId: body.leaveGroupId,
              remark: body.remark,
              timeZone: body.timeZone,
              totalDeducated,
              totalRestOff,
              totalDay: diff,
              startAt: "AM",
              endAt: "AM",
              attachment: body.attachment,
              submittedFrom: body.submittedFrom,
              businessUnitId: userData.parentBussinessUnitId,
              allocatedBy: req.user._id,
              isSwapable: body.isSwapable ? body.isSwapable : 0,
              isAllocated: true,
              status: 3,
            };
            const saveLeave = new LeaveApplied(obj).save();
            const leaveLog = new LeaveLog(obj).save();
            const updateStaffLeave = await staffLeave.findOneAndUpdate(
              { userId, leaveDetails: { "$elemMatch": { "year": body.year, leaveTypeId: body.leaveTypeId } } },
              { $set: { "leaveDetails.$.planQuota": isPlanQuota }, $inc: { "leaveDetails.$.request": totalDeducated } }
            );
            return res.json({
              saveLeave,
              success: true,
              message: "Leave Successfully allocated",
            });
          } else {
            return res.json({
              isPlanQuota,
              success: false,
              message: "Leave plan exceed Quota",
            });
          }
        } else {
          return res.json({
            success: false,
            message: "Leave type not found for this staff",
          });
        }
      } else {
        return res.json({
          success: false,
          message: "Leave group not found for this staff",
        });
      }
    } catch (e) {
      return res.json({ success: false, message: "something went wrong", e });
    }
  }
  async checkIsLeaveOverlap(req, res) {
    const body = req.body;
    let startDate = moment(body.startDate).utc(body.timeZone); //.format('DD-MM-YYYY');
    console.log("startDate", new Date(startDate));
    let endDate = moment(body.endDate).utc(body.timeZone);
    console.log("startDate", startDate, endDate);
    let leaveAppliedData;
    if (body.leaveAppliedId) {
      leaveAppliedData = await LeaveApplied.find({
        _id: { $ne: body.leaveAppliedId },
        userId: body.userId,
        status: { $nin: [2, 5] },
      });
    } else {
      leaveAppliedData = await LeaveApplied.find({
        userId: body.userId,
        status: { $nin: [2, 5] },
      });
    }
    const isPresent = leaveAppliedData.filter((leave) => {
      // return (
      //     (new Date(leave.startDate).getTime() >= new Date(startDate).getTime() && new Date(leave.startDate).getTime() < new Date(endDate).getTime()) ||
      //     (new Date(leave.endDate).getTime() >= new Date(startDate).getTime() && new Date(leave.endDate).getTime() <= new Date(endDate).getTime())
      // );
      return (
        ((new Date(leave.startDate).getTime() >= new Date(startDate).getTime() && new Date(leave.startDate).getTime() <= new Date(endDate).getTime()) ||
          (new Date(leave.endDate).getTime() >= new Date(startDate).getTime() && new Date(leave.endDate).getTime() <= new Date(endDate).getTime())
          || ((new Date(startDate).getTime() >= new Date(leave.startDate).getTime()) && (new Date(startDate).getTime() <= new Date(leave.endDate).getTime()) &&
            (new Date(endDate).getTime() >= new Date(leave.startDate).getTime()) && (new Date(endDate).getTime() <= new Date(leave.endDate).getTime()))
        )
      );
    });

    if (isPresent && isPresent.length > 0) {
      return res.json({ success: false, message: "Leave is overlapping" });
    }
    return res.json({ success: true, message: "Leave is not overlapping" });
  }
  async checkIsLeaveOverlapStaff(body) {
    //const body = req.body;
    let startDate = moment(body.startDate).utc(body.timeZone); //.format('DD-MM-YYYY');
    console.log("startDate", new Date(startDate));
    let endDate = moment(body.endDate).utc(body.timeZone);
    console.log("startDate", startDate, endDate);
    let leaveAppliedData;
    if (body.leaveAppliedId) {
      leaveAppliedData = await LeaveApplied.find({
        _id: { $ne: body.leaveAppliedId },
        userId: body.userId,
        status: { $nin: [2, 5] },
      });
    } else {
      leaveAppliedData = await LeaveApplied.find({
        userId: body.userId,
        status: { $nin: [2, 5] },
      });
    }
    console.log('body start Date', new Date(startDate), new Date(startDate).getTime())
    console.log('body end date', new Date(endDate), new Date(endDate).getTime())
    const isPresent = leaveAppliedData.filter((leave) => {
      console.log('new Date(leave.startDate)', new Date(leave.startDate), new Date(leave.startDate).getTime());
      console.log('new Date(leave.endDate)', new Date(leave.endDate), new Date(leave.endDate).getTime());
      // 8>= 11 && 8<13 ||
      // 14>= 11 && 14<=13 ||
      // 11>=8 && 11 <= 14 &&
      // 13>=8 && 13<=14
      return (
        ((new Date(leave.startDate).getTime() >= new Date(startDate).getTime() && new Date(leave.startDate).getTime() <= new Date(endDate).getTime()) ||
          (new Date(leave.endDate).getTime() >= new Date(startDate).getTime() && new Date(leave.endDate).getTime() <= new Date(endDate).getTime())
          || ((new Date(startDate).getTime() >= new Date(leave.startDate).getTime()) && (new Date(startDate).getTime() <= new Date(leave.endDate).getTime()) &&
            (new Date(endDate).getTime() >= new Date(leave.startDate).getTime()) && (new Date(endDate).getTime() <= new Date(leave.endDate).getTime()))
        )
      );
    });
    //console.log(isPresent)
    if (isPresent && isPresent.length > 0) {
      return { success: false, message: "Leave is overlapping", leaveAppliedData };
    }
    return { success: true, message: "Leave is not overlapping", leaveAppliedData };
  }
  // /allocateleavechangedate
  async allocateLeaveChangeDate(req, res) {
    try {
      console.log("hhhh");
      let body = req.body;
      const userId = body.userId;
      body.year = new Date(body.startDate).getFullYear();
      const isLeaveOverlap = false;
      const overlapResult = await this.checkIsLeaveOverlapStaff(body);
      //await this.checkIsLeaveOverlap(body);
      //return res.json({userId})
      if (overlapResult.success) {
        const leaveAppliedData = await LeaveApplied.findOne({
          _id: body.leaveAppliedId,
          userId: userId,
        });
        if (leaveAppliedData) {
          const staffLeaveData = await staffLeave.findOne({ userId });
          let leaveType = staffLeaveData.leaveDetails.filter((type) => type.leaveTypeId == leaveAppliedData.leaveTypeId.toString() && type.year == body.year);
          if (leaveType && leaveType.length > 0) {
            leaveType = leaveType[0];
            let startDate = moment(body.startDate); //.format('DD-MM-YYYY');
            console.log("startDate", startDate);
            let endDate = moment(body.endDate); //.format('DD-MM-YYYY');
            let diff = endDate.diff(startDate, "days") + 1;
            if (body.startAt.toLowerCase() != body.endAt.toLowerCase()) {
              diff = diff - 0.5;
            }
            let totalDeducated = diff;
            let totalRestOff = 0;
            const leaveConfig = await this.readLeaveConfiguration(res, req.user.companyId);
            if (diff >= 7) {
              totalRestOff = parseInt(diff / 7) * leaveConfig.restOff;
              totalDeducated = totalDeducated - totalRestOff;
            }
            let isPlanQuota = leaveType.planQuota - totalDeducated + leaveAppliedData.totalDeducated;
            const isQuotaCheck = await this.checkLeaveConfig(res, leaveType);
            if (isPlanQuota >= 0 || isQuotaCheck || leaveAppliedData.totalDay>=diff) {
              const obj = {
                isQuotaCheck: !isQuotaCheck,
                userId,
                startDate,
                endDate,
                totalDeducated,
                totalRestOff,
                startAt: body.startAt,
                endAt: body.endAt,
                remark: body.remark,
                totalDay: diff,
                status: 3,
                isSwapable: body.isSwapable ? body.isSwapable : 0,
              };
              const changeObj = {
                changeBy: req.user._id,
                oldData: {
                  startDate: leaveAppliedData.startDate,
                  endDate: leaveAppliedData.endDate,
                  startAt: leaveAppliedData.startAt,
                  endAt: leaveAppliedData.endAt,
                  totalDay: leaveAppliedData.totalDay,
                  totalDeducated: leaveAppliedData.totalDeducated,
                  totalRestOff: leaveAppliedData.totalRestOff
                },
                changedDateTime: new Date()
              }
              const saveLeave = await LeaveApplied.findOneAndUpdate(
                { _id: body.leaveAppliedId },
                { $set: { startDate, endDate, isChangeDate: true, totalDay: diff, totalDeducated, totalRestOff, startAt: body.startAt, endAt: body.endAt }, $push: { changeDateHistory: changeObj } }
                , { new: true }
              );
              let lLog = JSON.parse(JSON.stringify(saveLeave));
              delete lLog._id;
              lLog.changeDateHistory = [];
              lLog.changeDateHistory.push(changeObj)
              const leaveLog = new LeaveLog(lLog).save();
              const updateStaffLeave = await staffLeave.findOneAndUpdate(
                {
                  userId,
                  leaveDetails: { "$elemMatch": { "year": body.year, leaveTypeId: leaveAppliedData.leaveTypeId } }
                },
                { $set: { "leaveDetails.$.planQuota": isPlanQuota }, $inc: { "leaveDetails.$.request": totalDeducated } }
              );
              return res.json({
                saveLeave,
                success: true,
                message: "Leave Successfully updated",
              });
            } else {
              return res.json({
                isPlanQuota,
                success: false,
                message: "Leave plan exceed Quota",
              });
            }
          } else {
            return res.json({
              success: false,
              message: "Leave type not found for this staff",
            });
          }
        } else {
          return res.json({
            success: false,
            message: "Leave Applied Not found",
          });
        }
      } else {
        return res.json({ success: false, message: "Leave dates are overlapping, please check." });
      }
    } catch (e) {
      return res.json({ success: false, message: "something went wrong", e });
    }
  }
  // /leave/applyallocatedballoted
  async applyAllocatedBallotedLeave(req, res) {
    try {
      const userId = req.user._id;
      const body = req.body;
      body.userId = userId;
      console.log("body", body);
      const leaveAppliedData = await LeaveApplied.findOne({ _id: body.leaveAppliedId });
      const staffLeaveData = await staffLeave.findOne({ userId });
      if (leaveAppliedData) {
        body.year = new Date(leaveAppliedData.startDate).getFullYear();
        let leaveType = staffLeaveData.leaveDetails.filter((type) => {
          return type.leaveTypeId == leaveAppliedData.leaveTypeId.toString() && type.year == body.year;
        });
        if (leaveType && leaveType.length > 0) {
          leaveType = leaveType[0];
          if (body.isSameLeavePeriod) {
            if (leaveAppliedData.submittedFrom == 2) {
              leaveAppliedData.status = 8;
            } else {
              leaveAppliedData.status = 1;
            }
            leaveAppliedData.isAutoApproved = true;
            const quota = leaveType.quota - leaveAppliedData.totalDeducated;
            const leaveAppUpdste = await leaveAppliedData.save();
            const updateStaffLeaveSame = await staffLeave.findOneAndUpdate(
              {
                userId,
                leaveDetails: { "$elemMatch": { "year": body.year, leaveTypeId: leaveAppliedData.leaveTypeId } }
              },
              { $set: { "leaveDetails.$.quota": quota } }
            );
            return res.json({
              success: true,
              message: "Leave successfully applied",
            });
          } else {
            const overlapResult = await this.checkIsLeaveOverlapStaff(body);
            if (overlapResult.success) {
              body.year = new Date(body.startDate).getFullYear();
              let startDate = moment(new Date(body.startDate)); //.format('DD-MM-YYYY');
              console.log("startDate", startDate);
              let endDate = moment(new Date(body.endDate)); //.format('DD-MM-YYYY');
              let diff = endDate.diff(startDate, "days") + 1;
              console.log("diff", diff);
              if (body.startAt.toLowerCase() != body.endAt.toLowerCase()) {
                diff = diff - 0.5;
              }
              let totalDeducated = diff;
              let totalRestOff = 0;
              const leaveConfig = await this.readLeaveConfiguration(res, req.user.companyId);
              if (diff >= 7) {
                totalRestOff = parseInt(diff / 7) * leaveConfig.restOff;
                totalDeducated = totalDeducated - totalRestOff;
              }
              console.log("totalDeducated", totalDeducated, leaveAppliedData.totalDeducated);
              const totalDiff = totalDeducated - leaveAppliedData.totalDeducated;
              console.log("totalDiff", totalDiff, leaveType.planQuota);
              let isPlanQuota = leaveType.planQuota - totalDiff;
              let isQuota = leaveType.quota - totalDeducated;

              let isQuotaCheck = await this.checkLeaveConfig(res, leaveType);
              if (isQuota >= 0 || isQuotaCheck) {
                let newStatus = 0;
                if (leaveAppliedData.submittedFrom == 2) {
                  newStatus = 7;
                }
                const obj = {
                  isQuotaCheck: !isQuotaCheck,
                  startDate,
                  endDate,
                  remark: body.remark,
                  timeZone: body.timeZone,
                  totalDay: diff,
                  totalDeducated,
                  totalRestOff,
                  startAt: body.startAt,
                  endAt: body.endAt,
                  status: newStatus,
                };
                leaveAppliedData.startDate = startDate;
                leaveAppliedData.endDate = endDate;
                leaveAppliedData.startAt = body.startAt;
                leaveAppliedData.endAt = body.endAt;
                leaveAppliedData.totalDeducated = totalDeducated;
                leaveAppliedData.totalRestOff = totalRestOff;
                leaveAppliedData.remark = body.remark;
                leaveAppliedData.timeZone = body.timeZone;
                leaveAppliedData.totalDay = diff;
                leaveAppliedData.status = newStatus;
                const saveLeave = await leaveAppliedData.save();
                const updateStaffLeave = await staffLeave.findOneAndUpdate(
                  {
                    userId,
                    leaveDetails: { "$elemMatch": { "year": body.year, leaveTypeId: leaveAppliedData.leaveTypeId } }
                  },
                  {
                    $set: { "leaveDetails.$.planQuota": isPlanQuota, "leaveDetails.$.quota": isQuota },
                    $inc: { "leaveDetails.$.request": totalDeducated, "leaveDetails.$.taken": totalDeducated },
                  }
                );
                return res.json({
                  saveLeave,
                  success: true,
                  message: "Leave Successfully applied",
                });
              } else {
                return res.json({
                  isPlanQuota,
                  success: false,
                  message: "Plan quota is not sufficient to apply for leaves, please check.",
                });
              }
            } else {
              return res.json({
                success: false,
                message: "Leave dates are overlapping, please check.",
              });
            }
          }
        } else {
          return res.json({
            success: false,
            message: "Leave type not found for this staff",
          });
        }
      } else {
        return res.json({
          success: false,
          message: "Applied Leave not found",
        });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    };
  }
  // /staff/cancel
  async cancelAllocation(req, res) {
    const body = req.body;
    const leaveAppliedData = await LeaveApplied.findOneAndUpdate(
      {
        _id: body.leaveAppliedId,
      },
      { $set: { status: 5, cancelledBy: req.user._id, cancelledDateTime: new Date() } },
      { new: true }
    );
    let lLog = JSON.parse(JSON.stringify(leaveAppliedData))
    delete lLog._id;
    lLog.changeDateHistory = [];
    lLog.isChangeDate = false;
    const leaveLog = new LeaveLog(lLog).save();
    const updateQuota = await this.managePlanLeave(leaveAppliedData.userId, leaveAppliedData.totalDeducated, leaveAppliedData);
    return res.json({ success: true, message: "Leave successfully cancelled" });
  }
  async managePlanLeave(userId, leaveQuota, leaveTypeData) {
    console.log("managePlanLeave", userId, leaveQuota, leaveTypeData);
    const year = new Date(leaveTypeData.startDate).getFullYear();
    if (
      leaveTypeData.submittedFrom == 1 ||
      (leaveTypeData.submittedFrom == 2 && leaveTypeData.status == 8) ||
      (leaveTypeData.submittedFrom == 3 && leaveTypeData.status == 1) ||
      (leaveTypeData.submittedFrom == 4 && leaveTypeData.status == 1)
    ) {
      const updateStaffLeave = await staffLeave.findOneAndUpdate(
        {
          userId,
          leaveDetails: { "$elemMatch": { "year": year, leaveTypeId: leaveTypeData.leaveTypeId } }
        },
        {
          $inc: {
            "leaveDetails.$.planQuota": leaveQuota,
            "leaveDetails.$.quota": leaveQuota,
            "leaveDetails.$.request": -leaveQuota,
            "leaveDetails.$.taken": -leaveQuota,
          },
        }
      );
      return updateStaffLeave;
    } else {
      const updateStaffLeave = await staffLeave.findOneAndUpdate(
        { userId, leaveDetails: { "$elemMatch": { "year": year, leaveTypeId: leaveTypeData.leaveTypeId } } },
        { $inc: { "leaveDetails.$.planQuota": leaveQuota, "leaveDetails.$.request": -leaveQuota } }
      );
      return updateStaffLeave;
    }
  }
  async checkIsSwapAvailable(res, userId) {
    try {
      console.log('in check')
      const opsGroupData = await ops.findOne({ userId, isDelete: false }, { noOfTeam: 1, swopSetup: 1, userId: 1, opsGroupName: 1 }).populate([
        {
          path: "userId",
          select: "isLeaveSwapAllowed",
          match: { isLeaveSwapAllowed: { $ne: true } },
        },
      ]);
      console.log('opsGroupData.swopSetup', opsGroupData)
      const userData = await User.findOne({ _id: userId }, { isLeaveSwapAllowed: 1 });
      if (opsGroupData && opsGroupData.swopSetup != 0 && !userData.isLeaveSwapAllowed) {
        let opsGroupDetails = {
          opsGroupName: opsGroupData.opsGroupName,
        };
        if (opsGroupData.swopSetup == 1) {
          // ops group level
          if (opsGroupData.noOfTeam != 0) {
            const opsTeamData = await opsTeam.findOne({ userId, isDeleted: false }, { userId: 1, name: 1 });
            console.log('i AM here', opsTeamData)
            opsGroupDetails.opsTeamName = opsTeamData ? opsTeamData.name : "";
          } else {
            opsGroupDetails.opsTeamName = '';
          }
          return { success: true, userId: opsGroupData.userId, opsGroupDetails };
        } else {
          const opsTeamData = await opsTeam.findOne({ userId, isDeleted: false }, { userId: 1, name: 1 }).populate([
            {
              path: "userId",
              select: "isLeaveSwapAllowed",
              match: { isLeaveSwapAllowed: { $ne: true } },
            },
          ]);
          opsGroupDetails.opsTeamName = opsTeamData ? opsTeamData.name : "";
          return { success: true, userId: opsTeamData ? opsTeamData.userId : [], opsGroupDetails };
          // ops team level
        }
      } else {
        return { success: false };
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    };
  }
  // /teammember
  async getMyTeamMembers(req, res) {
    try {
      console.log('I ammmmm')
      let body = req.body;
      const userId = req.user._id;
      const year = new Date(body.date).getFullYear();
      const swapData = await this.checkIsSwapAvailable(res, userId);
      console.log('swapData', swapData)
      if (swapData.success) {
        const userIdArr = [];
        swapData.userId.forEach((item) => {
          if (item._id.toString() != req.user._id.toString()) {
            userIdArr.push(item._id);
          }
        });
        //return res.json({ userIdArr });
        const date = moment(new Date(body.date)).utc(body.timeZone).format();
        console.log('date', date)
        let leaveApplied = await LeaveApplied.find({
          $expr: { $eq: [{ $year: "$startDate" }, year] },
          userId: { $in: userIdArr },
          startDate: { $lte: date },
          endDate: { $gte: date },
          isSwappable: { $in: [0, 1] }, //,
        }).populate([
          {
            path: "userId",
            select: "name staffId parentBussinessUnitId email contactNumber appointmentId profilePic",
            populate: [
              {
                path: "appointmentId",
                select: "name",
              },
              {
                path: "parentBussinessUnitId",
                select: "name",
                populate: {
                  path: "sectionId",
                  select: "name",
                  populate: {
                    path: "departmentId",
                    select: "name status",
                    populate: {
                      path: "companyId",
                      select: "name status",
                    },
                  },
                },
              },
            ],
          },
          {
            path: "leaveTypeId",
            select: "name",
          },
          {
            path: "leaveGroupId",
            select: "name",
          },
        ]);
        //return res.json({leaveApplied})
        leaveApplied = JSON.parse(JSON.stringify(leaveApplied));
        for (let i = 0; i < leaveApplied.length; i++) {
          const userOpsTeam = await opsTeam.findOne({ userId: leaveApplied[i].userId._id, isDeleted: false }, { name: 1 })
          leaveApplied[i].opsDetails = {
            opsGroupName: swapData.opsGroupDetails.opsGroupName,
            opsTeamName: userOpsTeam ? userOpsTeam.name : ""
          };
          leaveApplied[i].businessUnitId = leaveApplied[i].userId.parentBussinessUnitId;
        }
        var grouped = _.mapValues(_.groupBy(leaveApplied, "leaveTypeId._id"), (clist) => clist.map((leaveApplied) => _.omit(leaveApplied, "leaveTypeId._id")));
        const leaveTypeIdArr = Object.keys(grouped);
        const leaveTypeCount = [];
        for (let i = 0; i < leaveTypeIdArr.length; i++) {
          const leaveTypeId = leaveTypeIdArr[i];
          const leaveTypeObj = grouped[leaveTypeId][0];
          console.log('leaveTypeObj', leaveTypeObj)
          const obj = {
            leaveTypeId,
            total: grouped[leaveTypeId].length,
            leaveTypeName: leaveTypeObj.leaveTypeId.name,
          };
          leaveTypeCount.push(obj);
        }
        return res.json({ success: true, message: "Swap Allowed", data: leaveApplied, leaveTypeCount, opsGroupDetails: swapData.opsGroupDetails });
      } else {
        return res.json({ success: false, message: "No Swap Allowed" });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    };
  }
  // /leavesbybu
  async getLeavesByBu(req, res) {
    try {
      const body = req.body;
      const userIds = await User.find({ parentBussinessUnitId: { $in: body.buId } }, { _id: 1 });
      let userId = [];
      userIds.forEach((item) => {
        userId.push(item._id);
      });

      const opsGroupData = await OpsGroup.find({ userId: { $in: userId }, isDelete: false, isDraft: false }, { opsGroupName: 1, userId: 1 }).sort({
        updatedAt: -1,
      });
      const date = moment(new Date(body.date)).utc(body.timeZone).format();
      let leaveList = await LeaveApplied.find({
        userId: { $in: userId },
        startDate: { $lte: date },
        endDate: { $gte: date },
        $or: [{ status: { $in: [0, 1, 2] } }, { submittedFrom: { $in: [3, 4] } }],
      }).populate([
        {
          path: "userId",
          select: "name staffId email contactNumber appointmentId profilePicture",
          populate: [
            {
              path: "appointmentId",
              select: "name",
            },
          ],
        },
        {
          path: "leaveTypeId",
          select: "name",
        },
        {
          path: "leaveGroupId",
          select: "name",
        },
        {
          path: "businessUnitId",
          select: "name status",
          match: {
            status: 1,
          },
          populate: {
            path: "sectionId",
            match: {
              status: 1,
            },
            select: "name",
            populate: {
              path: "departmentId",
              match: {
                status: 1,
              },
              select: "name",
              populate: {
                path: "companyId",
                match: {
                  status: 1,
                },
                select: "name",
              },
            },
          },
        },
        {
          path: "approvalHistory.approvalBy",
          select: "staffId name",
        },
      ]);
      leaveList = JSON.parse(JSON.stringify(leaveList));
      let len = leaveList.length;
      const opsGroupDetails = {}
      for (let i = 0; i < len; i++) {
        const item = leaveList[i];
        if (!opsGroupDetails[item.userId._id]) {
          const opsDetails = await this.getOpsGroup(res, item.userId._id);
          if (opsDetails.success) {
            leaveList[i].opsDetails = opsDetails.details;
            opsGroupDetails[item.userId._id] = {}
            opsGroupDetails[item.userId._id] = opsDetails;
          } else {
            opsGroupDetails[item.userId._id] = {};
            opsGroupDetails[item.userId._id].details = {
              opsGroupName: '',
              opsTeamName: ""
            }
          }
        } else {
          console.log('*******************')
          leaveList[i].opsDetails = opsGroupDetails[item.userId._id].details;
        }
        // let opsG = opsGroupData.filter((op) => {
        //   let aa = op.userId.map(String);
        //   return aa.includes(item.userId._id.toString());
        // });
        // console.log("opsGopsG", opsG);
        // if (opsG && opsG.length > 0) {
        //   opsG = opsG[0];
        //   let opsObj = {
        //     name: opsG.opsGroupName,
        //     opsGroupId: opsG._id,
        //   };
        //leaveList[i].opsGroup = opsObj;
        //}
      }
      var grouped = _.mapValues(_.groupBy(leaveList, "leaveTypeId._id"), (clist) => clist.map((leaveList) => _.omit(leaveList, "leaveTypeId._id")));
      const leaveTypeIdArr = Object.keys(grouped);
      const leaveTypeCount = [];
      for (let i = 0; i < leaveTypeIdArr.length; i++) {
        const leaveTypeId = leaveTypeIdArr[i];
        const leaveTypeObj = grouped[leaveTypeId][0];
        const obj = {
          leaveTypeId,
          total: grouped[leaveTypeId].length,
          leaveTypeName: leaveTypeObj.leaveTypeId.name,
        };
        leaveTypeCount.push(obj);
      }
      return res.json({ data: leaveList, leaveTypeCount, success: true });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    };
  }
}
leaveManagementController = new leaveManagementController();
module.exports = leaveManagementController;
