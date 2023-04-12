let LeaveType = require("../../models/leaveType"),
  LeaveApplied = require("../../models/leaveApplied"),
  OpsTeam = require("../../models/opsTeam"),
  opsLeaves = require("../../models/opsLeaves"),
  leaveLog = require("../../models/leaveLogs"),
  moment = require('moment'),
  OpsGroup = require("../../models/ops");
const _ = require("lodash");
const User = require("../../models/user");
const staffLeave = require("../../models/staffLeave");
const ops = require("../../models/ops");
const pageSetting = require("../../models/pageSetting");
const json2csv = require("json2csv").parse;
__ = require('../../../helpers/globalFunctions');

class newLeavePlannerController {
  // /leavetype
  async getLeaveType(req, res) {
    try {
      // get leaves
      // find leave applied on that date
      const body = req.body;
      let leaveType = await LeaveType.find({ companyId: req.user.companyId, isActive: true }, { name: 1 });
      let userIdArr = [];
      if (body.opsTeamId) {
        let userId = await OpsTeam.findOne({ _id: body.opsTeamId }, { userId: 1 });
        if (userId) {
          userIdArr = userId.userId;
        }
      } else if (body.opsGroupId) {
        let userId = await OpsGroup.findOne({ _id: body.opsGroupId, isDelete: false }, { userId: 1 });
        if (userId) {
          userIdArr = userId.userId;
        }
      } else {
        return res.json({ success: false, message: "Ops Group is missing" });
      }
      const date = moment(new Date(body.date)).utc(body.timeZone).format();
      console.log("date", date);
      const leaveApplied = await LeaveApplied.find({
        status: { $in: [0, 1, 3, 4] },
        userId: { $in: userIdArr },
        startDate: { $lte: date },
        endDate: { $gte: date },
      });
      var grouped = _.mapValues(_.groupBy(leaveApplied, "leaveTypeId"), (clist) => clist.map((leaveApplied) => _.omit(leaveApplied, "leaveTypeId")));
      leaveType = JSON.parse(JSON.stringify(leaveType));
      for (let i = 0; i < leaveType.length; i++) {
        if (grouped[leaveType[i]._id]) {
          leaveType[i].total = grouped[leaveType[i]._id].length;
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
  // /leavetype/bu
  async getLeaveTypeBu(req, res) {
    try {
      // get leaves
      // find leave applied on that date
      const body = req.body;
      let leaveType = await LeaveType.find({ companyId: req.user.companyId, isActive: true }, { name: 1 });
      let userIdArr = [];
      if (body.buId) {
        let userId = await User.find({ parentBussinessUnitId: body.buId }, { _id: 1 });
        if (userId) {
          userId.forEach((it) => {
            userIdArr.push(it._id);
          });
        }
      } else {
        return res.json({ success: false, message: "Bu is missing" });
      }
      //return res.json({ userIdArr });
      const date = moment(new Date(body.date)).utc(body.timeZone).format();
      console.log("date", date);
      const leaveApplied = await LeaveApplied.find({
        status: { $in: [0, 1, 3, 4] },
        userId: { $in: userIdArr },
        startDate: { $lte: date },
        endDate: { $gte: date },
      });
      var grouped = _.mapValues(_.groupBy(leaveApplied, "leaveTypeId"), (clist) => clist.map((leaveApplied) => _.omit(leaveApplied, "leaveTypeId")));
      leaveType = JSON.parse(JSON.stringify(leaveType));
      for (let i = 0; i < leaveType.length; i++) {
        if (grouped[leaveType[i]._id]) {
          leaveType[i].total = grouped[leaveType[i]._id].length;
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
  // /usersbydate
  async getUsersByDate(req, res) {
    try {
      console.log("hii");
      // get leaves
      // find leave applied on that date
      const body = req.body;
      let userIdArr = [];
      let opsGroupName = "";
      let teamName = ""
      let opsData = await OpsGroup.findOne({ _id: body.opsGroupId, isDelete: false }, { userId: 1, opsGroupName: 1 , opsTeamId : 1}).populate([{
        path: "opsTeamId",
        select: "name userId",
      }]);
      if (opsData) {
        opsGroupName = opsData.opsGroupName;
      }
      if (body.opsTeamId) {
        let userId = await OpsTeam.findOne({ _id: body.opsTeamId }, { userId: 1, name: 1 });
        if (userId) {
          teamName = userId.name
          userIdArr = userId.userId;
        }
      } else if (body.opsGroupId) {
        let userId = await OpsGroup.findOne({ _id: body.opsGroupId, isDelete: false }, { userId: 1, opsGroupName: 1 });
        if (userId) {
          userIdArr = userId.userId;
          opsGroupName = userId.opsGroupName;
        }
      } else {
        return res.json({ success: false, message: "Ops Group is missing" });
      }
      const opsleave = await opsLeaves.findOne({ opsGroupId: body.opsGroupId }, { _id: 1, perDayQuota: 1, opsTeamId: 1, users: 1 });
      const date = moment(new Date(body.date)).utc(body.timeZone).format();
      const dateF = moment(new Date(body.date)).utc(body.timeZone).format("DD-MM-YYYY");
      console.log("date", date);
      let data = {};
      //return res.json({ opsleave })
      if (opsleave) {
        if (!body.opsTeamId) {
          if (opsleave.perDayQuota && opsleave.perDayQuota.quota.length > 0) {
            console.log("here inside of if me");
            let yeardata = opsleave.perDayQuota.quota.filter((q) => {
              if (q.hasOwnProperty(body.year)) {
                return q;
              }
            });
            // return res.json({ yeardata })
            if (yeardata.length > 0) {
              console.log("in if");
              // find quota for that date and the users.
              let key = Object.keys(yeardata[0])[0];
              let thatdateIs = yeardata[0][key].filter((qa) => qa.date == dateF);
              console.log("thatdateIs", thatdateIs);
              data.date = thatdateIs[0];
            }
          }
        } else {
          console.log("HEHEH")
          let isPresentPerDay = true;
          if (opsleave && opsleave.perDayQuota && opsleave.perDayQuota.opsTeams && opsleave.perDayQuota.opsTeams.length > 0) {
            let perDayTeamQuota = opsleave.perDayQuota.opsTeams.filter((pTeam) => {
              return pTeam.id == body.opsTeamId
            });
            if (perDayTeamQuota.length > 0) {
              isPresentPerDay = false;
              perDayTeamQuota = perDayTeamQuota[0]
              // return res.json({ perDayTeamQuota })
              let yeardata = perDayTeamQuota.quota.filter((q) => {
                if (q.hasOwnProperty(body.year)) {
                  return q;
                }
              });
              // return res.json({ yeardata })
              if (yeardata.length > 0) {
                console.log("in if");
                // find quota for that date and the users.
                let key = Object.keys(yeardata[0])[0];
                let thatdateIs = yeardata[0][key].filter((qa) => qa.date == dateF);
                console.log("thatdateIs", thatdateIs);
                data.date = thatdateIs[0];
                console.log("data", data)
              }
            }
          }
        }
        const date111 = moment(new Date(body.date)).utc(body.timeZone).toISOString();
        console.log("date111", date111);
        console.log("date11111", new Date(date111).toISOString());
        let leaveApplied = await LeaveApplied.find({
          userId: { $in: userIdArr },
          startDate: { $lte: date },
          endDate: { $gte: date },
          status: { $nin: [2, 9] },
        }).populate([
          {
            path: "userId",
            select: "name staffId parentBussinessUnitId email contactNumber appointmentId profilePicture",
            populate: [
              {
                path: "appointmentId",
                select: "name",
              },
              {
                path: "parentBussinessUnitId",
                select: "orgName",
                // populate: {
                //   path: "sectionId",
                //   select: "name",
                //   populate: {
                //     path: "departmentId",
                //     select: "name status",
                //     populate: {
                //       path: "companyId",
                //       select: "name status",
                //     },
                //   },
                // },
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
            path: "cancelledBy",
            select: "staffId name",
          },
          {
            path: "approvalHistory.approvalBy",
            select: "staffId name",
          },
          {
            path: "swapLogId",
            populate: [{
              path: 'fromUserId',
              select: 'name staffId'
            }, {
              path: 'toUserId',
              select: 'name staffId'
            }]
          }
        ]);
        let total = 0;
        leaveApplied = JSON.parse(JSON.stringify(leaveApplied));
        for (let i = 0; i < leaveApplied.length; i++) {
          leaveApplied[i].opsGroupName = opsGroupName;
          opsData.opsTeamId.forEach((team) => {
            if (team.userId.includes(leaveApplied[i].userId._id)){
              leaveApplied[i].opsTeam = team.name;
            }
          })
          if (leaveApplied[i].status != 2 && leaveApplied[i].status != 5) {
            total += 1;
          }
        }
        data.totalLeaveApplied = total;
        if (data.date) {
          data.balance = data.date.value - total;
        }
        return res.json({ data, leaveApplied, success: true });
      } else {
        return res.status(200).json({ message: "Ops Leave Data Not Found", success: false });
      }
    } catch (err) {
      __.log(err);
      return res.status(500).json({ message: "something went wrong", success: false });
    }
  }
  // /usersbydate/bu
  async getUsersByDateBu(req, res) {
    try {
      // get leaves
      // find leave applied on that date
      const body = req.body;
      let userIdArr = [];
      let opsGroupName = "";
      const date = moment(new Date(body.date)).utc(body.timeZone).format();
      const dateF = moment(new Date(body.date)).utc(body.timeZone).format("DD-MM-YYYY");
      console.log("date", date);
      if (body.buId) {
        let userId = await User.find({ parentBussinessUnitId: body.buId }, { _id: 1 });
        if (userId) {
          userId.forEach((it) => {
            userIdArr.push(it._id);
          });
        }
      } else {
        return res.json({ success: false, message: "Bu is missing" });
      }
      const date111 = moment(new Date(body.date)).utc(body.timeZone).toISOString();
      console.log("date111", date111);
      console.log("date11111", new Date(date111).toISOString());
      const opsGroupData = await OpsGroup.find({ userId: { $in: userIdArr }, isDelete: false, isDraft: false }, { opsGroupName: 1, userId: 1, opsTeamId : 1 }).populate([
        {  path: "opsTeamId",
          select: "name userId"
        }]).sort({
           updatedAt: -1,
         });
      let leaveApplied = await LeaveApplied.find({
        userId: { $in: userIdArr },
        startDate: { $lte: date },
        endDate: { $gte: date },
      }).populate([
        {
          path: "userId",
          select: "name staffId parentBussinessUnitId email contactNumber appointmentId profilePicture",
          populate: [
            {
              path: "appointmentId",
              select: "name",
            },
            {
              path: "parentBussinessUnitId",
              select: "orgName",
              // populate: {
              //   path: "sectionId",
              //   select: "name",
              //   populate: {
              //     path: "departmentId",
              //     select: "name status",
              //     populate: {
              //       path: "companyId",
              //       select: "name status",
              //     },
              //   },
              // },
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
          path: "approvalHistory.approvalBy",
          select: "staffId name",
        },
        {
          path: "swapLogId",
          populate: [{
            path: 'fromUserId',
            select: 'name staffId'
          }, {
            path: 'toUserId',
            select: 'name staffId'
          }]
        }
      ]);
      let total = 0;
      leaveApplied = JSON.parse(JSON.stringify(leaveApplied));
      let len = leaveApplied.length;
      for (let i = 0; i < len; i++) {
      const item = leaveApplied[i];
      let opsG = opsGroupData.filter((op) => {
        let aa = op.userId.map(String);
        return aa.includes(item.userId._id.toString());
      });
      opsGroupData.forEach((data) =>{
        data.opsTeamId.forEach((team) => {
          if (team.userId.includes(leaveApplied[i].userId._id)){
            leaveApplied[i].opsTeam = team.name;
          }
        })
      })
      if (opsG && opsG.length > 0) {
        leaveApplied[i].opsGroup = {
          name: opsG[0].opsGroupName,
          opsGroupId: opsG[0]._id,
        };
      }
      }
      // for (let i = 0; i < leaveApplied.length; i++) {
      //   leaveApplied[i].opsGroupName = opsGroupName;
      //   if (leaveApplied[i].status != 2) {
      //     total += 1;
      //   }
      // }
      // data.totalLeaveApplied = total;
      // data.balance = data.date.value - total;
      return res.json({ leaveApplied, success: true });
    } catch (err) {
      __.log(err);
      return res.status(500).json({ message: "something went wrong", success: false });
    }
  }
  // /mobilescreenforleaves
  async mobileScreenForLeaves(req, res) {
    try {
      console.log("hiii");
      const body = req.body;
      let opsGroupNameData = await ops.findOne({ userId: body.userId, isDelete: false }, { opsGroupName: 1 });
      let opsGroupName = opsGroupNameData.opsGroupName;
      let userData = await User.findOne({ _id: body.userId }, { parentBussinessUnitId: 1 }).populate([
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
      ]);
      const userInfo = {
        opsGroupName,
        buDetails: userData.parentBussinessUnitId,
      };
      // const body = req.body;
      const leaveApplied = await LeaveApplied.find({
        $expr: { $eq: [{ $year: "$startDate" }, body.year] },
        userId: body.userId,
      })
        .populate([
          {
            path: "leaveTypeId",
            select: "name",
          },
        ])
        .sort({ startDate: 1 });
      return res.json({ success: true, data: leaveApplied, userInfo });
    } catch (e) {
      return res.json({ success: false, message: "something went wrong", e });
    }
  }
  // /staffleavetype
  async getStaffLeaveType(req, res) {
    try {
      // get leaves
      // find leave applied on that date
      const body = req.body;
      const leaveTypeData = [];
      let leaveGroupData = await staffLeave.findOne({ userId: body.userId }).populate([
        {
          path: "leaveGroupId",
          select: "name leaveType.leaveTypeId leaveType.leavePlanning",
          populate: [
            {
              path: "leaveType.leaveTypeId",
              select: "name",
            },
          ],
        },
      ]);
      if (leaveGroupData && leaveGroupData.leaveGroupId) {
        let leaveTypeFromLG = leaveGroupData.leaveGroupId.leaveType;
        let leaveDetails = leaveGroupData.leaveDetails;
        leaveDetails.forEach((details) => {
          let obj = {};
          let matchLt = leaveTypeFromLG.filter((lt) => {
            return lt.leaveTypeId._id.toString() == details.leaveTypeId.toString() && details.year == body.year;
          });
          if (matchLt.length > 0) {
            obj = JSON.parse(JSON.stringify(details));
            obj.leaveTypeName = matchLt[0].leaveTypeId.name;
            obj.isAdminAllocate = matchLt[0].leavePlanning.isAdminAllocate;
            //if (obj.isAdminAllocate) {
            leaveTypeData.push(obj);
            // }
          }
        });
      }
      const leaveApplied = await LeaveApplied.find({
        $expr: { $eq: [{ $year: "$startDate" }, body.year] },
        userId: body.userId,
        status: { $nin: [2, 9] },
      })
        .populate([
          {
            path: "leaveTypeId",
            select: "name",
          },
        ])
        .sort({ startDate: 1 });
      return res.json({ leaveApplied, leaveTypeData, success: true, leaveGroupId: leaveGroupData.leaveGroupId._id });
    } catch (err) {
      __.log(err);
      return res.status(500).json({ message: "something went wrong", success: false });
    }
  }
  async readLeaveConfiguration(res, companyId) {
    try {
      const pageData = await pageSetting.findOne({ companyId: companyId });
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
    } catch(err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async checkLeaveConfig(leaveType) {
    try {
      if (leaveType.total == 0) {
        return true;
      }
      const leaveTypeData = await LeaveType.findOne({ _id: leaveType.leaveTypeId });
      return leaveTypeData.isQuotaExceed;
    } catch(err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  // /allocateleave
  async allocateLeave(req, res) {
    try {
      const body = req.body;
      body.year = new Date(body.startDate).getFullYear();
      const userId = body.userId;
      const staffLeaveData = await staffLeave.findOne({ userId });
      if (staffLeaveData) {
        let leaveType = staffLeaveData.leaveDetails.filter((type) => type.leaveTypeId == body.leaveTypeId && type.year == body.year);
        if (leaveType && leaveType.length > 0) {
          leaveType = leaveType[0];
          let startDate = moment(body.startDate); //.format('DD-MM-YYYY');
          console.log("startDate", startDate);
          let endDate = moment(body.endDate); //.format('DD-MM-YYYY');
          const diff = endDate.diff(startDate, "days") + 1;
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
              totalDeducated,
              totalRestOff,
              leaveTypeId: body.leaveTypeId,
              leaveGroupId: staffLeaveData.leaveGroupId,
              remark: body.remark,
              timeZone: body.timeZone,
              totalDay: diff,
              attachment: body.attachment,
              businessUnitId: body.bussinessUnitId,
              isSwappable: body.isSwappable,
              status: 3,
              startAt: body.startAt,
              endAt: body.endAt,
            };
            const saveLeave = new LeaveApplied(obj).save();
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
              message: "Plan Quota is not present to take leave",
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
          leaveType,
          success: false,
          message: "Leave group not found for this staff",
        });
      }
    } catch (e) {
      return res.json({ success: false, message: "something went wrong", e });
    }
  }

  // /cancel
  async cancelAllocation(req, res) {
    try {
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
      const leaveLogD = new leaveLog(lLog).save();
      const updateQuota = await this.managePlanLeave(res, leaveAppliedData.userId, leaveAppliedData.totalDeducated, leaveAppliedData);
      return res.json({ success: true, message: "Leave successfully cancelled" });
    } catch(err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async managePlanLeave(res, userId, leaveQuota, leaveTypeData) {
    try {
      const year = new Date(leaveTypeData.startDate).getFullYear();
      console.log("managePlanLeave", userId, leaveQuota, leaveTypeData.status);
      if (
        leaveTypeData.submittedFrom == 1 ||
        (leaveTypeData.submittedFrom == 2 && leaveTypeData.status == 8) ||
        (leaveTypeData.submittedFrom == 3 && leaveTypeData.status == 1) ||
        (leaveTypeData.submittedFrom == 4 && leaveTypeData.status == 1)
      ) {
        const updateStaffLeave = await staffLeave.findOneAndUpdate(
          { userId, leaveDetails: { "$elemMatch": { "year": year, leaveTypeId: leaveTypeData.leaveTypeId } } },
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
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  // Export
  async export(req, res) {
    try {
      // get leaves
      // find leave applied on that date
      const body = req.body;
      let opsGroupName = [];
      let opsTeamName = null;
      let userIdArr = [];
      if (body.opsTeamId) {
        let userId = await OpsTeam.findOne({ _id: body.opsTeamId }, { userId: 1, name: 1 });
        if (userId) {
          userIdArr = [userId.userId];
        }
        opsTeamName = userId.name;
        if (body.opsGroupId && body.opsGroupId.length === 1) {
          let opsDetails = await OpsGroup.findOne({ _id: { $in: body.opsGroupId }, isDelete: false }, { userId: 1, opsGroupName: 1 });
          opsGroupName = [opsDetails.opsGroupName];
        }
        // } else {
        //   return res.json({ success: false, message: body.opsGroupId ? "Only 1 Ops Group needed!" : "Ops Group is missing!" });
        // }
      } else if (body.opsGroupId) {
        let userId = await OpsGroup.find({ _id: { $in: body.opsGroupId }, isDelete: false }, { userId: 1, opsGroupName: 1 });
        if (userId) {
          userId.forEach(item => {
            userIdArr.push(item.userId);
            opsGroupName.push(item.opsGroupName);
          })
        }
      } else {
        return res.json({ success: false, message: "Ops Group is missing" });
      }
      const date = moment(new Date(body.startDate)).utc(body.timeZone).format();
      const dateE = moment(new Date(body.endDate)).utc(body.timeZone).format();
      const data = [];
      const keys = ['STAFF NAME',
        'STAFF ID', "Ops Group name", "Ops Team Name", 'Leave Submitted On', 'LEAVE START', 'LEAVE END', 'TOTAL DAYS', 'LEAVE TYPE',
        'LEAVE PLAN STATUS', 'LEAVE APPLICATION Status', 'TOTAL DEDUCTED',
        'TOTAL REST OFF', 'REMARKS', 'Approver Name', 'Approver ID', 'Approver Date & Time', 'Cancelled By', 'Cancelled Date & Time'];

      if (userIdArr && userIdArr.length) {
        for (const [index, userItem] of userIdArr.entries()) {
          //
          //startDate: { $lte: date },
          //endDate: { $gte: date },
          //12<=16 && 15>=11 11-16 
          let leaveApplied = await LeaveApplied.find({
            userId: { $in: userItem },
            startDate: { $lte: dateE },
            endDate: { $gte: date },
          }).populate([
            {
              path: "userId",
              select: "name primaryMobileNumber staffId parentBussinessUnitId email contactNumber appointmentId",
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
            {
              path: "cancelledBy",
              select: "staffId name",
            },
            {
              path: "approvalHistory.approvalBy",
              select: "staffId name",
            },
          ]);
          if (leaveApplied && leaveApplied.length > 0) {
            for (let i = 0; i < leaveApplied.length; i++) {
              const leave = leaveApplied[i];
              let userObj = {};
              let obj = {};
              if (userObj[leave.userId._id]) {
                obj = userObj[leave.userId._id];
              } else {
                userObj[leave.userId._id] = {};
                obj = {
                  'STAFF NAME': leave.userId.name,
                  'STAFF ID': leave.userId.staffId,
                  phone: leave.userId.primaryMobileNumber,
                  email: leave.userId.email
                };
              }
              let opsTeamN = opsTeamName;
              if (!opsTeamName) {
                let opsTeamDetails = await OpsTeam.findOne({ userId: leave.userId._id, isDeleted: false }, { name: 1 });
                opsTeamN = opsTeamDetails ? opsTeamDetails.name : '';
              }
              obj['Ops Group name'] = opsGroupName[index];
              obj['Ops Team Name'] = opsTeamN;
              obj['Leave Submitted On'] = moment(new Date(leave.createdAt)).format('DD-MM-YYYY');
              obj['LEAVE START'] = moment(new Date(leave.startDate)).format('DD-MM-YYYY');
              obj['LEAVE END'] = moment(new Date(leave.endDate)).format('DD-MM-YYYY');//;leave.endDate;
              obj['TOTAL DAYS'] = leave.totalDay;
              //ddmmyyyy
              obj['LEAVE TYPE'] = leave.leaveTypeId.name;
              //leave.submittedFrom == 1?'Apply Leave':leave.submittedFrom == 2?'Leave Request':leave.submittedFrom == 3 && leave.status != 4?'Allocated':'Bid Successful'
              obj['LEAVE PLAN STATUS'] = leave.submittedFrom == 1 ? 'Apply Leave' : leave.submittedFrom == 2 ? 'Leave Request' : leave.submittedFrom == 3 && leave.status != 4 ? 'Allocated' : 'Bid Successful';//leave.status;
              //leave.status == 0?'Pending Approval':leave.status == 1?'Approved':leave.status == 2?'Rejected':leave.status==5?'Cancelled':leave.status == 3?'-':'-'
              obj['LEAVE APPLICATION Status'] = leave.status == 0 ? 'Pending Approval' : leave.status == 1 ? 'Approved' : leave.status == 2 ? 'Rejected' : leave.status == 5 ? 'Cancelled' : leave.status == 3 ? '-' : '-'//leave.status;
              obj['TOTAL DEDUCTED'] = leave.totalDeducated;
              obj['TOTAL REST OFF'] = leave.totalRestOff;
              obj['REMARKS'] = leave.remark;
              if (leave.approvalHistory && leave.approvalHistory.length > 0) {
                const len = leave.approvalHistory.length - 1;
                const app = leave.approvalHistory[len];
                obj['Approver Name'] = app.approvalBy.name;
                obj['Approver ID'] = app.approvalBy.staffId;
                obj['Approver Date & Time'] = moment(new Date(app.approvalDateTime)).utcOffset(body.timeZone).format('DD-MM-YYYY hh:mm')//app.approvalDateTime;
              } else {
                obj['Approver Name'] = '-';
                obj['Approver ID'] = '-';
                obj['Approver Date & Time'] = '-';
              }
              obj['Cancelled By'] = leave.cancelledBy ? leave.cancelledBy.name : '-';
              obj['Cancelled Date & Time'] = leave.cancelledDateTime ? moment(new Date(leave.cancelledDateTime)).utcOffset(body.timeZone).format('DD-MM-YYYY hh:mm') : '-'//leave.cancelledDateTime:'-';
              data.push(obj);
              // 'TOTAL DAYS','LEAVE TYPE',
              // 'LEAVE PLAN STATUS','LEAVE APPLICATION','TOTAL DEDUCTED',
              // 'TOTAL REST OFF','REMARKS','Approver Name','Approver ID',
              // 'Approver Date & Time','Cancelled By',
              // 'Cancelled Date & Time'
            }
          }
        }
        //return res.json({data})
        // json2csv({ data: data, fields: keys }, function (err, csv) {
        //   if (err) console.log(err);
        //   // console.log(csv);
        //   //  res.send(csv);
        //   //  fs.writeFile('file.csv', csv, function(err) {
        //   //      if (err) throw err;
        //   //      console.log('file saved');
        //   //  });
        //   res.setHeader('Content-disposition', 'attachment; filename=testing.csv');
        //   res.set('Content-Type', 'application/csv');
        //   res.status(200).send(csv);
        //   return
        // });
        const csv = await json2csv(data, keys);
        res.setHeader('Content-disposition', 'attachment; filename=testing.csv');
        res.set('Content-Type', 'application/csv');
        res.status(200).json({ csv, noData: true });
        // return res.json({data})
      } else {
        return res.status(200).json({ message: "No Leave data for this period", success: false });
      }
    } catch (err) {
      __.log(err);
      return res.status(500).json({ message: "something went wrong", success: false });
    }
  }
}

module.exports = new newLeavePlannerController();
