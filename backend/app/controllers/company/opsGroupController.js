const json2csv = require('json2csv').parse;
const mongoose = require('mongoose');
const moment = require('moment');
const OpsGroup = require('../../models/ops');
const LeavePlanner = require('../../models/leavePlanner');
const OpsTeam = require('../../models/opsTeam');
const User = require('../../models/user');
const userFieldController = require('../company/userFieldController');
const SubSection = require('../../models/subSection');
const Appointment = require('../../models/appointment');
const OpsGroupSystemAdmin = require('../../models/opsGroupSystemAdmin');
const Privilege = require('../../models/privilege');
const Role = require('../../models/role');
const leaveController = require('../../controllers/company/leavePlannerController');
const opsLog = require('../../models/opsGroupLogs');
const StaffSapData = require('../../models/staffSAPData');
const _ = require('lodash');
const __ = require('../../../helpers/globalFunctions');
var multiparty = require('multiparty');
const csv = require('csvtojson');
const async = require('async');
const leaveType = require('../../models/leaveType');
const staffLeave = require('../../models/staffLeave');
const Ballot = require('../../models/ballot');

// API to create OpsGroup
module.exports.create = async (req, res) => {
  //  console.log('heheh')
  try {
    let requiredResult = await __.checkRequiredFields(req, [
      'userId',
      'buId',
      'adminId',
      'opsGroupName',
      'opsTeam',
      'noOfTeam',
    ]);
    if (requiredResult.status === false) {
      __.out(res, 400, requiredResult.missingFields);
    } else {
      // console.log(req.body);
      const insertObj = {
        userId: req.body.userId,
        buId: req.body.buId,
        opsGroupName: req.body.opsGroupName,
        adminId: req.body.adminId,
        noOfTeam: req.body.noOfTeam,
        createdBy: req.user._id,
        companyId: req.user.companyId,
        isDraft: req.body.isDraft,
        swopSetup: req.body.swopSetup,
      };
      let opsTeamByName = await OpsGroup.findOne({
        opsGroupName: insertObj.opsGroupName,
      });
      // console.log('opsteamby name', opsTeamByName);
      if (!opsTeamByName) {
        let ops = await new OpsGroup(insertObj).save();
        console.log('aaaa', ops);
        if (ops) {
          const opsTeamId = [];
          for (let i = 0; i < insertObj.noOfTeam; i++) {
            const team = req.body.opsTeam[i];
            const teamObj = {
              name: team.name,
              adminId: team.admin,
              userId: team.userId,
              opsGroupId: ops._id,
              buId: req.body.buId,
              createdBy: req.user._id,
            };
            let opsTeam = await new OpsTeam(teamObj).save();
            opsTeamId.push(opsTeam._id.toString());
          }
          console.log('opsTeamId', opsTeamId);
          if (opsTeamId.length > 0) {
            let opsGroupUpdate = await OpsGroup.update(
              { _id: ops._id },
              { $set: { opsTeamId: opsTeamId } },
            );
          }
          return res.status(200).json({
            success: true,
            message: 'Ops Group created successfully',
            OpsGroup: ops,
          });
        } else {
          return res.status(201).json({
            success: false,
            message: "Couldn't create Ops Group",
          });
        }
      } else {
        return res.status(201).json({
          success: false,
          message: 'Duplicate Ops Group Name',
        });
      }
    }
  } catch (err) {
    return res.status(201).json({
      success: false,
      message: 'Something Went Wrong',
    });
  }
};

module.exports.readAll = async (req, res) => {
  try {
    const companyId = mongoose.Types.ObjectId(req.user.companyId);
    let data = await OpsGroup.find(
      { companyId: companyId, isDelete: false, adminId: req.user._id },
      { adminId: 0, companyId: 0 },
    ).populate([
      {
        path: 'createdBy',
        select: ['name', 'email', 'doj'],
      },
    ]);
    console.log('OPS DATA HERE.....');
    if (data) {
      return res.json({
        success: true,
        data,
      });
    } else {
      return res.json({
        success: false,
        message: 'No OPS Group Found',
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      success: false,
      message: 'Something went wrong',
    });
  }
};

// API to fetch data of OPS GROUP
module.exports.read = async (req, res) => {
  try {
    console.log('user :', req.user._id);
    console.log('privillage: ', req.body);
    let privilage = req.body.privilage;
    console.log('PRIVILLAGE HERE:', privilage);
    const companyId = mongoose.Types.ObjectId(req.user.companyId);
    if (privilage == true) {
      console.log('inside if');
      let buId = [];
      const user = await User.findById(req.user._id);
      buId.push(user.parentBussinessUnitId);
      if (user.viewBussinessUnitId.length > 0) {
        for (var i = 0; i <= user.viewBussinessUnitId[i]; i++) {
          buId.push(user.viewBussinessUnitId[i]);
        }
      }
      if (user.planBussinessUnitId.length > 0) {
        for (var i = 0; i <= user.planBussinessUnitId[i]; i++) {
          buId.push(user.planBussinessUnitId[i]);
        }
      }
      let data = await OpsGroup.find(
        { companyId: companyId, isDelete: false, buId: { $in: buId } },
        { adminId: 0, companyId: 0 },
      ).populate([
        {
          path: 'createdBy',
          select: ['name', 'email', 'doj'],
        },
      ]);
      if (data) {
        return res.json({
          success: true,
          data,
        });
      } else {
        return res.json({
          success: false,
          message: 'No OPS Group Found',
        });
      }
    } else {
      console.log('IN ELSE');
      const buId = await OpsGroupSystemAdmin.findOne(
        { userId: req.user._id },
        { buId: 1, _id: 0 },
      );
      console.log('buId', buId);
      let data = await OpsGroup.find(
        { companyId: companyId, isDelete: false, buId: { $in: buId.buId } },
        { adminId: 0, companyId: 0 },
      ).populate([
        {
          path: 'createdBy',
          select: ['name', 'email', 'doj'],
        },
      ]);
      //  let myops = await OpsGroup.find({companyId:companyId,isDelete:false,createdBy:req.user.id},{adminId:0, companyId:0 }).populate(
      //     [
      //     {
      //         path:"createdBy",
      //         select:["name","email","doj"]
      //     }
      //     ]);
      //     data.concat(myops);
      //     console.log("OPS :",data);
      if (data) {
        return res.json({
          success: true,
          data,
        });
      } else {
        return res.json({
          success: false,
          message: 'No OPS Group Found',
        });
      }
    }
    // const userData = await User.findById(req.user._id).populate([{path:'role',select:["name","privileges"]}]);
    // console.log("USERDATA IS:c",userData);
  } catch (err) {
    console.log(err);
    return res.json({
      success: false,
      message: 'Something went wrong',
    });
  }
};
module.exports.readWithTeam = async (req, res) => {
  try {
    console.log('I TEAMS : ');
    const buId = mongoose.Types.ObjectId(req.user.companyId);
    let data = await OpsGroup.find(
      { companyId: buId, adminId: req.user._id, isDelete: false },
      { adminId: 0, companyId: 0 },
    ).populate([
      {
        path: 'opsTeamId',
        select: ['name', '_id'],
      },
    ]);
    if (data) {
      console.log('DAA :', data);
      return res.json({
        success: true,
        data: data,
      });
    } else {
      return res.json({
        success: false,
        message: 'No OPS Group Found',
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      success: false,
      message: 'Something went wrong',
    });
  }
};
module.exports.readDropDown = async (req, res) => {
  try {
    const buId = req.body.buId;
    let data = await OpsGroup.find(
      { buId: { $in: buId }, isDelete: false },
      { _id: 1, opsGroupName: 1 },
    ).lean();
    if (data) {
      return res.json({
        success: true,
        data,
      });
    } else {
      return res.json({
        success: false,
        message: 'No OPS Group Found',
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      success: false,
      message: 'Something went wrong',
    });
  }
};
module.exports.delete = async (req, res) => {
  try {
    const opsGroupId = req.params.opsGroupId;
    const updatedBy = {
      userId: req.user._id,
    };
    const data = await OpsGroup.findOneAndUpdate(
      { _id: opsGroupId },
      { $set: { isDelete: true }, $push: { updatedBy } },
      { new: true },
    );
    console.log('data', data);
    if (data) {
      const teamUpdate = await OpsTeam.update(
        { _id: { $in: data.opsTeamId } },
        { $set: { isDeleted: true }, $push: { updatedBy } },
        { multi: true },
      );
      return res.json({
        success: true,
        message: 'Ops Group Deleted Successfully',
      });
    } else {
      return res.json({
        success: false,
        message: 'Ops Group Not Deleted Successfully',
      });
    }
  } catch (e) {
    console.log(e);
    return res.json({
      success: false,
      message: 'Something went wrong',
    });
  }
};
module.exports.opsDetails = async (req, res) => {
  try {
    // console.log('req.body.userId',req.body.userId)
    const opsGroupId = req.params.opsGroupId;
    let data = await OpsGroup.find({ _id: opsGroupId, isDelete: false })
      .populate([
        {
          path: 'createdBy',
          select: [
            'name',
            'email',
            'doj',
            'contactNumber',
            'staffId',
            'parentBussinessUnitId',
          ],
        },
        {
          path: 'userId',
          select: [
            'name',
            'email',
            'doj',
            'contactNumber',
            'staffId',
            'parentBussinessUnitId',
          ],
          populate: [
            {
              path: 'appointmentId',
              select: ['name', 'status'],
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
          path: 'opsTeamId',
          populate: [
            {
              path: 'userId',
              select: [
                'name',
                'email',
                'doj',
                'contactNumber',
                'staffId',
                'parentBussinessUnitId',
              ],
              populate: [
                {
                  path: 'appointmentId',
                  select: ['name', 'status'],
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
              path: 'adminId',
              select: ['name', 'email', 'doj'],
              populate: {
                path: 'appointmentId',
                select: ['name', 'status'],
              },
            },
          ],
        },
        {
          path: 'removeOpsTeamId.teamId',
          select: 'name',
        },
        {
          path: 'removeOpsTeamId.userId',
          select: 'name',
        },
        {
          path: 'adminId',
          select: ['name', 'email', 'doj'],
          populate: {
            path: 'appointmentId',
            select: ['name', 'status'],
          },
        },
        {
          path: 'buId',
          select: 'name status sectionId',
          populate: {
            path: 'sectionId',
            select: 'name status departmentId',
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
      ])
      .lean();
    if (data) {
      return res.json({
        success: true,
        data,
      });
    } else {
      return res.json({
        success: false,
        message: 'Data not found',
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      success: false,
      message: 'Something Went wrong',
    });
  }
};
module.exports.adminList = async (req, res) => {
  try {
    let requiredResult = await __.checkRequiredFields(req, ['buId']);
    if (requiredResult.status === false) {
      __.out(res, 400, requiredResult.missingFields);
    } else {
      console.log(' $scope.adminList', req.body);
      const adminList = await User.find(
        { parentBussinessUnitId: { $in: req.body.buId } },
        { _id: 1, name: 1 },
      );
      return res.json({ success: true, adminList });
    }
  } catch (e) {
    return res.json({ success: false, adminList: [] });
  }
};
module.exports.validateOpsGroup = async (req, res) => {
  try {
    const name = req.params.name;
    console.log(name);
    const result = await OpsGroup.findOne({
      opsGroupName: name,
      isDelete: false,
    });
    console.log('result', result);
    if (result) {
      return res.json({
        success: true,
        message: 'Ops Group Name already present',
      });
    } else {
      return res.json({ success: false });
    }
  } catch (e) {
    return res.json({
      success: false,
      message: 'Something Went wrong',
    });
  }
};
// ----------------------------
module.exports.unAssignStaffList = async (req, res) => {
    try {
        let requiredResult = await __.checkRequiredFields(req, ['buId']);
        if (requiredResult.status === false) {
            __.out(res, 400, requiredResult.missingFields);
        } else {
            let limit = 0;
            let skip = 0;
            console.log('req.params.pageno', req.query.pageno)
            if (req.query.pageno) {
                skip = (parseInt(req.query.pageno) - 1) * 10;
                limit = 10;
            }
            const userIDArr = await OpsGroup.find({ buId: { $in: req.body.buId }, isDelete: false }, { userId: 1, _id: 0 });
            let userId = [];
            userIDArr.forEach((item) => {
                userId = userId.concat(item.userId)
            });

            let userDetails = await User.find({ _id: { $nin: userId }, parentBussinessUnitId: { $in: req.body.buId } }, { _id: 1})
            userDetails = userDetails.map(user => user._id)
            const userIDArray = await OpsGroup.find({ userId: { $in: userDetails} }, { userId: 1, _id: 0 });
            
            let userIdList = []
            for (const user of userIDArray) {
                userIdList = [...user.userId, ... userIdList]
            }
            const parentBuUserId = []
            for (const userId of userDetails) {
                let isIdExist = userIdList.find(id => String(id) == String(userId));
                if (!isIdExist) {
                    parentBuUserId.push(userId)
                }
            }

            const unAssignUser = await User.find({ _id: { $in: parentBuUserId } })
                .select("_id parentBussinessUnitId name role appointmentId staffId doj contactNumber")
                .populate([{
                    path: 'appointmentId',
                    select: 'name'
                }, {
                    path: 'role',
                    select: 'name description'
                },
                {
                    path: 'parentBussinessUnitId',
                    select: 'name status sectionId',
                    populate: {
                        path: 'sectionId',
                        select: 'name status departmentId',
                        populate: {
                            path: 'departmentId',
                            select: 'name status companyId',
                            populate: {
                                path: 'companyId',
                                select: 'name status'
                            }
                        }
                    }
                }
                ])
                .skip(skip)
                .limit(limit)
                .lean();
            return res.status(200).json({ success: true, data: unAssignUser });
            // return res.status(200).json({ success: true, data: unAssignUser, parentBuUserId });
        }
    } catch (e) {
        console.log('.................................. ', e);
        return res.status(200).json({ success: false, message: 'Something went wrong' });
    }
};
module.exports.assignStaffList = async (req, res) => {
  try {
    let requiredResult = await __.checkRequiredFields(req, ['buId']);
    if (requiredResult.status === false) {
      __.out(res, 400, requiredResult.missingFields);
    } else {
      let limit = 0;
      let skip = 0;
      console.log('req.params.pageno', req.query.pageno);
      if (req.query.pageno) {
        skip = (parseInt(req.query.pageno) - 1) * 10;
        limit = 10;
      }
      const userIDArr = await OpsGroup.find(
        { buId: { $in: req.body.buId }, isDelete: false },
        { userId: 1, _id: 0 },
      );
      let userId = [];
      userIDArr.forEach((item) => {
        userId = userId.concat(item.userId);
      });
      const unAssignUser = await User.find({ _id: { $in: userId } })
        .select('_id parentBussinessUnitId name role appointmentId')
        .populate([
          {
            path: 'appointmentId',
            select: 'name',
          },
          {
            path: 'role',
            select: 'name description',
          },
          {
            path: 'parentBussinessUnitId',
            select: 'name status sectionId',
            populate: {
              path: 'sectionId',
              select: 'name status departmentId',
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
        ])
        .skip(skip)
        .limit(limit)
        .lean();
      return res.status(200).json({ success: true, data: unAssignUser });
    }
  } catch (e) {
    return res
      .status(200)
      .json({ success: false, message: 'Something went wrong', e });
  }
};
module.exports.teamStaff = async (req, res) => {
  try {
    let requiredResult = await __.checkRequiredFields(req, [
      'opsTeamId',
      'opsGroupId',
    ]);
    if (requiredResult.status === false) {
      __.out(res, 400, requiredResult.missingFields);
    } else {
      let limit = 0;
      let skip = 0;
      console.log('req.params.pageno', req.query.pageno);
      if (req.query.pageno) {
        skip = (parseInt(req.query.pageno) - 1) * 10;
        limit = 10;
      }
      console.log('skip', skip);
      console.log('req.body', req.body);
      const userIDArr = await OpsTeam.find(
        { _id: { $in: req.body.opsTeamId }, isDeleted: false },
        { userId: 1, _id: 0 },
      );
      //  return res.json(userIDArr)
      let userId = [];
      userIDArr.forEach((item) => {
        userId = userId.concat(item.userId);
      });
      console.log('userId', userId);
      const unAssignUser = await User.find({ _id: { $in: userId } })
        .select(
          '_id parentBussinessUnitId name role appointmentId doj contactNumber staffId',
        )
        .populate([
          {
            path: 'appointmentId',
            select: 'name',
          },
          {
            path: 'role',
            select: 'name description',
          },
          {
            path: 'parentBussinessUnitId',
            select: 'name status sectionId',
            populate: {
              path: 'sectionId',
              select: 'name status departmentId',
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
        ])
        .skip(skip)
        .limit(limit)
        .lean();
      return res.status(200).json({ success: true, data: unAssignUser });
    }
  } catch (e) {
    console.log(e);
    return res
      .status(200)
      .json({ success: false, message: 'Something went wrong' });
  }
};
module.exports.opsGroupStaff = async (req, res) => {
  try {
    let requiredResult = await __.checkRequiredFields(req, ['opsGroupId']);
    if (requiredResult.status === false) {
      __.out(res, 400, requiredResult.missingFields);
    } else {
      const userIDArr = await OpsGroup.find(
        { _id: { $in: req.body.opsGroupId }, isDelete: false },
        { userId: 1, _id: 0 },
      );
      //  return res.json(userIDArr)
      let userId = [];
      userIDArr.forEach((item) => {
        userId = userId.concat(item.userId);
      });
      console.log('userId', userId);
      const unAssignUser = await User.find({ _id: { $in: userId } })
        .select(
          '_id parentBussinessUnitId name role appointmentId doj contactNumber staffId',
        )
        .populate([
          {
            path: 'appointmentId',
            select: 'name',
          },
          {
            path: 'role',
            select: 'name description',
          },
          {
            path: 'parentBussinessUnitId',
            select: 'name status sectionId',
            populate: {
              path: 'sectionId',
              select: 'name status departmentId',
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
        ])
        .lean();
      return res.status(200).json({ success: true, data: unAssignUser });
    }
  } catch (e) {
    console.log(e);
    return res
      .status(200)
      .json({ success: false, message: 'Something went wrong' });
  }
};
module.exports.opsGroupTeam = async (req, res) => {
  try {
    let requiredResult = await __.checkRequiredFields(req, ['opsGroupId']);
    if (requiredResult.status === false) {
      __.out(res, 400, requiredResult.missingFields);
    } else {
      const opsTeamIdObj = await OpsGroup.find(
        { _id: { $in: req.body.opsGroupId }, isDelete: false },
        { opsTeamId: 1, _id: 0 },
      );
      //  return res.json(userIDArr)
      let opsTeamIdArr = [];
      opsTeamIdObj.forEach((item) => {
        opsTeamIdArr = opsTeamIdArr.concat(item.opsTeamId);
      });
      console.log('opsTeamIdArr', opsTeamIdArr);
      const unAssignUser = await OpsTeam.find({
        _id: { $in: opsTeamIdArr },
        isDeleted: false,
      })
        .select('_id name')
        .lean();
      let team = JSON.stringify(unAssignUser);
      team = JSON.parse(team);
      team.forEach((item) => {
        item.checkbox = false;
      });
      return res.status(200).json({ success: true, data: unAssignUser });
    }
  } catch (e) {
    console.log(e);
    return res
      .status(200)
      .json({ success: false, message: 'Something went wrong' });
  }
};
module.exports.transferToOpsGroup = async (req, res) => {
  try {
    const data = req.body.data;
    console.log(data);
    for (let i = 0; i < data.idArr.length; i++) {
      const userId = data.idArr[i];
      const removeFromOpsGroup = await OpsGroup.update(
        { userId: userId },
        { $pull: { userId: userId } },
      );
      console.log('ree', removeFromOpsGroup);
      const removeFromTeam = await OpsTeam.update(
        { userId: userId },
        { $pull: { userId: userId } },
      );
      const toOpsGroup = await OpsGroup.findOneAndUpdate(
        { _id: data.destinationOpsGroupId },
        { $push: { userId } },
      );
      if (data.destinationOpsTeamId) {
        const toOpsTeam = await OpsTeam.findOneAndUpdate(
          { _id: data.destinationOpsTeamId },
          { $push: { userId } },
        );
      }
    }
    return res
      .status(200)
      .json({ success: true, message: 'Staff Transferred Successfully' });
  } catch (e) {
    return res
      .status(400)
      .json({ success: false, message: 'Something went wrong', e });
  }
};
module.exports.removeStaffByUserId = async (req, res) => {
  try {
    let requiredResult = await __.checkRequiredFields(req, ['userId']);
    if (requiredResult.status === false) {
      __.out(res, 400, requiredResult.missingFields);
    } else {
      let annualLeaveId = await leaveType.findOne({
        isActive: true,
        name: 'Annual Leave',
        companyId: req.user.companyId,
      });
      if (annualLeaveId) {
        annualLeaveId = annualLeaveId._id;
      }
      if (!annualLeaveId) {
        return res.json({
          success: false,
          message: 'No annual leave found for this company',
        });
      }
      if (req.body.teamId) {
        const obj = {
          teamId: req.body.teamId,
          deletedDateTime: new Date(),
          userId: req.user._id,
        };
        const removeTeamFrom2 = await OpsGroup.update(
          { opsTeamId: req.body.teamId },
          {
            $pull: { opsTeamId: req.body.teamId },
            $push: { removeOpsTeamId: obj },
            $inc: { noOfTeam: -1 },
          },
        );
        const removeFromTeam3 = await OpsTeam.update(
          { _id: req.body.teamId },
          { $set: { isDeleted: true } },
        );
      }

      const userIdArr = req.body.userId;
      for (let i = 0; i < userIdArr.length; i++) {
        const userId = userIdArr[i];
        let id = userIdArr[i];
        id = mongoose.Types.ObjectId(id);
        console.log(typeof mongoose.Types.ObjectId(id));
        const removeFromOpsGroup = await OpsGroup.update(
          { userId: userId },
          { $pull: { userId: userId } },
        );
        //console.log('ree', removeFromOpsGroup);
        console.log('userId', userId);
        const removeFromTeam1 = await OpsTeam.findOneAndUpdate(
          { userId: { $in: [id] } },
          {
            $pull: { userId: id },
          },
        );
        /*,
                    { "$pull" : { userId: userId}});*/
        const ballotData = await Ballot.find({
          isConduct: false,
          appliedStaff: { $elemMatch: { userId: id } },
        });
        let total = 0;
        if (ballotData && ballotData.length > 0) {
          for (let j = 0; j < ballotData.length; j++) {
            const bal = ballotData[j];
            const ballotApplied = ballotData[j].appliedStaff;
            let leaveFormat = 5;
            if (bal.leaveConfiguration === 2) {
              leaveFormat = 6;
            } else if (bal.leaveConfiguration === 3) {
              leaveFormat = 7;
            }
            if (bal.leaveType == 2) {
              leaveFormat = 1;
            }
            if (ballotApplied) {
              let totalApplied = 0;
              for (let k = 0; k < ballotApplied.length; k++) {
                const stf = ballotApplied[k];
                if (stf.userId.toString() == userId) {
                  totalApplied++;
                  ballotApplied.splice(k, 1);
                  k--;
                }
              }
              total = total + leaveFormat * totalApplied;
            }
            // update ballot
            //ballotApplied
            const updateBallot = await Ballot.findOneAndUpdate(
              { _id: bal._id },
              { $set: { appliedStaff: ballotApplied } },
            );
            // remove quota total
            const year = new Date(bal.weekRange[0].end).getFullYear();
            //total = -1 * total;
            console.log('totaltotal', total);
            const updateStaffLeave = await staffLeave.findOneAndUpdate(
              {
                userId,
                leaveDetails: {
                  $elemMatch: { year: year, leaveTypeId: annualLeaveId },
                },
              },
              {
                $inc: {
                  'leaveDetails.$.planQuota': total,
                  'leaveDetails.$.request': total,
                },
              },
            );
          }
        }
      }
      return res.json({ success: true, message: 'Staff Removed Successfully' });
    }
  } catch (e) {
    console.log(e);
    return res
      .status(200)
      .json({ success: false, message: 'Something went wrong' });
  }
};
module.exports.getSysAdmin = async (req, res) => {
  try {
    console.log('Company id is: ', req.user);
    let companyId = req.user.companyId;
    const admin = await OpsGroupSystemAdmin.find({
      companyId: companyId,
    }).populate([
      {
        path: 'userId',
        select: 'name',
      },
      {
        path: 'userBuId',
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
      {
        path: 'buId',
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
    ]);
    return res.json({ success: true, data: admin });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong' });
  }
};
module.exports.addSysAdmin = async (req, res) => {
  try {
    console.log('USERID: ', req.body.userId);
    const data = {
      userId: req.body.userId,
      userBuId: req.body.userBuId,
      buId: req.body.buId,
      companyId: req.user.companyId,
      createdBy: req.user._id,
      hasAccess: req.body.hasAccess,
    };
    const opsGroupAdmin = await new OpsGroupSystemAdmin(data).save();
    if (data.hasAccess === 0) {
      console.log('SAVING HERE: ', 0);
      const userUpdate = await User.findOneAndUpdate(
        { _id: data.userId },
        { $set: { isUsedInOpsGroup: true } },
      );
      const subsectionUdate = await SubSection.updateMany(
        { _id: { $in: data.buId } },
        { $set: { isUsedInOpsGroup: true } },
      );
    } else {
      console.log('SAVING HERE: ', 1);
      const userUpdate = await User.findOneAndUpdate(
        { _id: data.userId },
        { $set: { isUserInOpsViewOnly: true } },
      );
      const subsectionUdate = await SubSection.updateMany(
        { _id: { $in: data.buId } },
        { $set: { isUserInOpsViewOnly: true } },
      );
    }
    return res.json({ success: true, message: 'Admin Created', opsGroupAdmin });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong' });
  }
};

module.exports.updateSysAdmin = async (req, res) => {
  console.log('REQ:', req.body);
  let data = req.body;
  try {
    if (data.hasAccess === 0) {
      console.log('iN IF');
      if (data.deletedBu && data.deletedBu.length > 0) {
        let delArr = data.deletedBu;
        const opsGrpSystemBUremove = await OpsGroupSystemAdmin.update(
          { _id: data.staffId },
          { $pullAll: { buId: data.deletedBu } },
        );
        const subsectionUdate = await SubSection.updateMany(
          { _id: { $in: delArr } },
          { $set: { isUsedInOpsGroup: false } },
        );
      }
      const opsgrpSystem = await OpsGroupSystemAdmin.findById(data.staffId);
      let missing = data.buId.filter(
        (item) => opsgrpSystem.buId.indexOf(item) < 0,
      );
      if (missing.length > 0) {
        const opsGrpSystemBUAdd = await OpsGroupSystemAdmin.update(
          { _id: data.staffId },
          { $push: { buId: { $each: missing } } },
        );
        const subsectionUdate = await SubSection.updateMany(
          { _id: { $in: missing } },
          { $set: { isUsedInOpsGroup: true } },
        );
      }
      return res.json({ success: true, message: 'updated Successfully' });
    } else {
      console.log('INELSE');
      if (data.deletedBu && data.deletedBu.length > 0) {
        let delArr = data.deletedBu;
        const opsGrpSystemBUremove = await OpsGroupSystemAdmin.update(
          { _id: data.staffId },
          { $pullAll: { buId: data.deletedBu } },
        );
        const subsectionUdate = await SubSection.updateMany(
          { _id: { $in: delArr } },
          { $set: { isUserInOpsViewOnly: false } },
        );
      }
      const opsgrpSystem = await OpsGroupSystemAdmin.findById(data.staffId);
      let missing = data.buId.filter(
        (item) => opsgrpSystem.buId.indexOf(item) < 0,
      );
      if (missing.length > 0) {
        const opsGrpSystemBUAdd = await OpsGroupSystemAdmin.update(
          { _id: data.staffId },
          { $push: { buId: { $each: missing } } },
        );
        const subsectionUdate = await SubSection.updateMany(
          { _id: { $in: missing } },
          { $set: { isUserInOpsViewOnly: true } },
        );
      }
      return res.json({ success: true, message: 'updated Successfully' });
    }
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong' });
  }
};

module.exports.unusedAdmin = async (req, res) => {
  try {
    console.log('In hre unused');
    const privilege = await Privilege.find(
      { 'flags.createEditOPSGroup': true },
      { _id: 1 },
    );
    const privilegeArr = [];
    privilege.forEach((item) => {
      privilegeArr.push(item);
    });
    const role = await Role.find(
      { companyId: req.user.companyId, privileges: { $in: privilegeArr } },
      { _id: 1 },
    );
    const roleArr = [];
    role.forEach((item) => {
      roleArr.push(item);
    });
    const user = await User.find(
      {
        companyId: req.user.companyId,
        role: { $in: roleArr },
        isUsedInOpsGroup: { $ne: true },
      },
      { _id: 1, parentBussinessUnitId: 1, staffId: 1, name: 1 },
    );
    return res.json({ success: true, data: user, roleArr });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong1', e });
  }
};
module.exports.getUnassignBu = async (req, res) => {
  try {
    const bu = await SubSection.find({ isUsedInOpsGroup: { $ne: true } })
      .populate({
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
      })
      .populate({
        path: 'appointments',
        select: 'name status',
      })
      .lean();
    var found = bu.filter(function (bUnit) {
      if (bUnit.sectionId == null) {
        console.log('in section If case');
      } else {
        return (
          bUnit.sectionId.departmentId.companyId._id.toString() ===
          req.user.companyId.toString()
        );
      }
    });
    return res.json({ success: true, data: found });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong1', e });
  }
};
module.exports.getUnassignBuForViewOnly = async (req, res) => {
  try {
    const bu = await SubSection.find({ isUserInOpsViewOnly: { $ne: true } })
      .populate({
        path: 'sectionId',
        select: 'name',
        populate: {
          path: 'departmentId',
          select: 'name status',
          populate: {
            path: 'companyId',
            select: '_id name status',
          },
        },
      })
      .populate({
        path: 'appointments',
        select: 'name status',
      })
      .lean();

    var found = bu.filter(function (bUnit) {
      if (bUnit.sectionId == null) {
        console.log('in section If case');
      } else {
        return (
          bUnit.sectionId.departmentId.companyId._id.toString() ===
          req.user.companyId.toString()
        );
      }
    });
    return res.json({ success: true, data: found });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong1', e });
  }
};

module.exports.getAdminDeatils = async (req, res) => {
  try {
    let userId = req.user._id;
    if (req.params.id !== '0') {
      userId = req.params.id;
    }
    const admin = await OpsGroupSystemAdmin.findOne({
      userId: userId,
    }).populate([
      {
        path: 'userId',
        select: 'name',
      },
      {
        path: 'userBuId',
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
      {
        path: 'buId',
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
    ]);
    return res.json({ success: true, data: admin });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong' });
  }
};
module.exports.updateAdmin = async (req, res) => {};

// API to update OPS TEAM
module.exports.update = async (req, res) => {
  try {
    //console.log(req.body);
    const insertObj = {
      userId: req.body.userId,
      buId: req.body.buId,
      opsGroupName: req.body.opsGroupName,
      adminId: req.body.adminId,
      noOfTeam: req.body.noOfTeam,
      createdBy: req.user._id,
      companyId: req.user.companyId,
      isDraft: req.body.isDraft,
      swopSetup: req.body.swopSetup,
    };
    // console.log('in', insertObj)
    let ops = await OpsGroup.findOneAndUpdate({ _id: req.body._id }, insertObj);
    const opsTeamId = [];
    for (let i = 0; i < insertObj.noOfTeam; i++) {
      const team = req.body.opsTeam[i];
      const teamObj = {
        name: team.name,
        adminId: team.admin,
        userId: team.userId,
        opsGroupId: ops._id,
        buId: req.body.buId,
        createdBy: req.user._id,
      };
      if (team._id) {
        let ops = await OpsTeam.findOneAndUpdate({ _id: team._id }, teamObj);
        opsTeamId.push(team._id.toString());
      } else {
        let opsTeam = await new OpsTeam(teamObj).save();
        opsTeamId.push(opsTeam._id.toString());
      }
    }
    if (opsTeamId.length > 0) {
      let opsGroupUpdate = await OpsGroup.update(
        { _id: ops._id },
        { $set: { opsTeamId: opsTeamId } },
      );
    }
    return res.status(200).json({
      success: true,
      message: 'Ops Group Updated Successfully',
      OpsGroup: ops,
    });
  } catch (err) {
    __.log(err);
    __.out(res, 500);
  }
};

// API to delete created Group
module.exports.remove = async (req, res) => {
  try {
    var where = {
      _id: req.body._id,
    };
    var data = await OpsGroup.findOneAndRemove(where);
    if (data) {
      return res.status(201).json({
        success: true,
        message: 'Group deleted Successfully',
        OpsGroup: data,
      });
    } else {
      return res.status(201).json({
        success: false,
        message: 'Failed',
        OpsGroup: data,
      });
    }
  } catch (err) {
    __.log(err);
    __.out(res, 500);
  }
};

//API to fetch buNmae of specific ops group
module.exports.buName = async (req, res) => {
  try {
    var buName = await OpsGroup.find({ _id: req.body._id }).populate([
      {
        path: 'buId',
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
    ]);
    return __.out(res, 201, {
      buList: buName != null ? buName : [],
    });
  } catch (err) {
    __.log(err);
    __.out(res, 500);
  }
};

//API to fetch users from bu
module.exports.getUsersByBuId = async (req, res) => {
  try {
    let buIds = req.body.businessUnitId;
    var buIdData = [];
    var promises = buIds.map(async (buId) => {
      let where = {
        companyId: req.user.companyId,
        status: 1,
      };
      where.parentBussinessUnitId = mongoose.Types.ObjectId(buId);
      var users = await User.find(where)
        .populate({
          path: 'companyId',
          select: 'name',
        })
        .populate([
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
                select: 'name',
              },
            },
          },
        ]);

      buIdData.push(users);
    });
    //return __out((res,201,buIdData));
    Promise.all(promises).then(function () {
      __.out(res, 201, buIdData);
    });
  } catch (err) {
    __.log(err);
    __.out(res, 500, err);
  }
};

//API to fetch users from BU(not in any ops group)
module.exports.addUserFromBu = async (req, res) => {
  try {
    // console.log('req.body.businessUnitId',req.body.businessUnitId);
    OpsGroup.find(
      { buId: { $in: req.body.businessUnitId } },
      { _id: 0, userId: 1 },
    ).then((result) => {
      let userID = [];
      result.forEach((item) => {
        item.userId.forEach((u) => {
          userID.push(u);
        });
      });

      User.find({
        parentBussinessUnitId: { $in: req.body.businessUnitId },
        _id: { $nin: userID },
        status: 1,
      })
        .populate({
          path: 'appointmentId',
          select: 'name',
        })
        .populate([
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
        ])
        .then((usersList) => {
          res.json(usersList);
        });
    });
  } catch (err) {
    __.log(err);
    __.out(res, 500, err);
  }
};

//API to fetch users from ops group of selected BU
module.exports.transferFromOpsGroup = async (req, res) => {
  try {
    // console.log("req:",req.body.businessUnitId)
    OpsGroup.find(
      { buId: { $in: req.body.businessUnitId } },
      { _id: 0, userId: 1 },
    ).then((result) => {
      let userID = [];
      // console.log("buId:",buId)
      result.forEach((item) => {
        item.userId.forEach((u) => {
          if (!userID.includes(u)) userID.push(u);
        });
      });
      // console.log('userId', userID.length);
      User.find({
        parentBussinessUnitId: { $in: req.body.businessUnitId },
        _id: { $in: userID },
        status: 1,
      }).then(async (usersList) => {
        await OpsGroup.find({ userId: { $in: usersList } }).then(
          async (counter) => {
            let notIn = [];
            counter.map((item) => {
              // console.log("req:",req.body.opsGroupId)
              //   console.log("IIN COUNTER: ",item._id ,"AND: ", req.body.opsGroupId);
              if (item._id == req.body.opsGroupId) {
                //do nothing
                // console.log("IN IF");
              } else {
                item.userId.forEach((u) => {
                  if (!notIn.includes(u)) notIn.push(u);
                });
              }
            });

            await User.find({
              parentBussinessUnitId: { $in: req.body.businessUnitId },
              _id: { $in: notIn },
              status: 1,
            })
              .populate({
                path: 'appointmentId',
                select: 'name',
              })
              .populate([
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
              ])
              .then((usersFromOtherOps) => {
                // res.json(usersFromOtherOps);
                // console.log("USERSFOUND: ",usersFromOtherOps)ss
                __.out(res, 201, usersFromOtherOps);
              });
          },
        );
        //  res.json(usersList)
      });
    });
  } catch (err) {
    __.log(err);
    __.out(res, 500, err);
  }
};

//Api for mobile, display no of users in ops grp with details
module.exports.getOpsUsers = async (req, res) => {
  try {
    let where = {
      buId: req.body.buId,
      _id: req.body._id,
    };
    let data = await OpsGroup.find(where)
      .lean()
      .populate({
        path: 'userId',
        populate: {
          path: 'appointmentId',
          select: 'name',
        },
      });
    return __.out(res, 201, {
      opsGroupUsers: data != null ? data : [],
    });
  } catch (err) {
    __.log(err);
    __.out(res, 500, err);
  }
};

//Api for mobile, display no of grp in bu
module.exports.getOpsList = async (req, res) => {
  try {
    let where = { buId: req.body.buId };
    let data = await OpsGroup.find(where).lean();
    return __.out(res, 201, {
      opsGroupList: data != null ? data : [],
    });
  } catch (err) {
    __.log(err);
    __.out(res, 500, err);
  }
};

module.exports.transferDelete = async (req, res) => {
  try {
    console.log('reaqere:', req.body);
    if (req.body.userId && req.body.userId.length > 0) {
      let Users = req.body.userId;
      console.log(req.body.userId);
      //for(var i = 0; i < Users.length; i++) {
      var done = Users.forEach(async (use) => {
        console.log('Iteration: ', use);
        await OpsGroup.find({ userId: use }, function (err, ops) {
          if (ops) {
            ops.map(async (opmap) => {
              //console.log("OPS :",ops);
              await opmap.userId.remove(use);
              await opmap.save((err, data) => {
                if (!err) {
                  console.log('SUCCESSFULLY DELETED');
                } else {
                  console.log("Couldn't delete", err);
                }
              });
            });
          } else {
            console.log('NO OPS', err);
          }
        });
        await OpsTeam.find({ userId: use }, function (err, tmp) {
          if (tmp) {
            tmp.map(async (tmap) => {
              // console.log("tmp:",tmp)
              await tmap.userId.remove(use);
              // console.log("tmap:",tmap)
              await tmap.save((err, data) => {
                if (!err) {
                  console.log('Deleted');
                } else {
                  console.log('failed');
                }
              });
            });
          } else {
            console.log('NO OPS', err);
          }
        });
      });
      Promise.all(done).then(() => {
        res.send('OK');
      });
    }
  } catch (err) {
    console.log(err);
    __.log(err);
    __.out(res, 500, err);
  }
};

module.exports.unusedStaffReadOnly = async (req, res) => {
  try {
    const privilege = await Privilege.find(
      {
        $and: [
          { 'flags.viewOPSGroup': true },
          { 'flags.setupOPSGroup:': { $exists: false } },
        ],
      },
      { _id: 1 },
    );
    const onlyviewPrivillege = await Privilege.find(
      { 'flags.setupOPSGroup': true },
      { _id: 1 },
    );
    const privilegeArr = [];
    const onlyP = [];
    onlyviewPrivillege.forEach((it) => {
      onlyP.push(it);
    });
    privilege.forEach((item) => {
      privilegeArr.push(item);
    });
    const role = await Role.find(
      {
        $and: [
          { companyId: req.user.companyId, privileges: { $in: privilegeArr } },
          { companyId: req.user.companyId, privileges: { $nin: onlyP } },
        ],
      },
      { _id: 1 },
    );
    console.log('ROLE: ', role);
    const roleArr = [];
    role.forEach((item) => {
      roleArr.push(item);
    });
    const user = await User.find(
      {
        companyId: req.user.companyId,
        role: { $in: roleArr },
        isUserInOpsViewOnly: { $ne: true },
      },
      { _id: 1, parentBussinessUnitId: 1, staffId: 1, name: 1 },
    );
    return res.json({ success: true, data: user, roleArr });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong1', e });
  }
};

module.exports.removeBuFromOpsGroup = async (req, res) => {
  try {
    console.log('data here:', req.body);
    const data = req.body;
    const removeBuFromOpsGroup = await OpsGroup.findOneAndUpdate(
      { _id: data.opsGroupId },
      { $pull: { buId: data.buID } },
    );
    console.log('aaa', removeBuFromOpsGroup.opsTeamId.length);
    for (let i = 0; i < removeBuFromOpsGroup.opsTeamId.length; i++) {
      const teamId = removeBuFromOpsGroup.opsTeamId[i];
      const removeBuFromOpsTeam = await OpsTeam.update(
        { _id: teamId },
        { $pull: { buId: data.buID } },
      );
    }
    const userIdArr = req.body.userId;
    for (let i = 0; i < userIdArr.length; i++) {
      const userId = userIdArr[i];
      const removeFromOpsGroup = await OpsGroup.update(
        { userId: userId },
        { $pull: { userId: userId } },
      );
      console.log('ree', removeFromOpsGroup);
      const removeFromTeam = await OpsTeam.update(
        { userId: userId },
        { $pull: { userId: userId } },
      );
      console.log('removeFromTeam', removeFromTeam);
    }
    console.log('adjh');
    let OpsGroupDetails = await OpsGroup.findOne({
      _id: data.opsGroupId,
      isDelete: false,
    })
      .populate([
        {
          path: 'userId',
          select: [
            'name',
            'email',
            'doj',
            'contactNumber',
            'staffId',
            'parentBussinessUnitId',
          ],
          populate: [
            {
              path: 'appointmentId',
              select: ['name', 'status'],
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
          path: 'opsTeamId',
          populate: [
            {
              path: 'userId',
              select: [
                'name',
                'email',
                'doj',
                'contactNumber',
                'staffId',
                'parentBussinessUnitId',
              ],
              populate: [
                {
                  path: 'appointmentId',
                  select: ['name', 'status'],
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
              path: 'adminId',
              select: ['name', 'email', 'doj'],
              populate: {
                path: 'appointmentId',
                select: ['name', 'status'],
              },
            },
          ],
        },
        {
          path: 'adminId',
          select: ['name', 'email', 'doj'],
          populate: {
            path: 'appointmentId',
            select: ['name', 'status'],
          },
        },
        {
          path: 'buId',
          select: 'name status sectionId',
          populate: {
            path: 'sectionId',
            select: 'name status departmentId',
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
      ])
      .lean();
    return res.json({
      success: true,
      message: 'Source Bu Deleted Successfully',
      data: OpsGroupDetails,
    });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong', e });
  }
};
module.exports.exportOpsGroup = async (req, res) => {
  try {
    console.log('h');
    const opsData = req.body;
    const currentYear = moment().year();
    const previousYear = currentYear - 1;
    const nextYear = currentYear + 1;
    const isAnnualLeave = await leaveType.findOne({
      name: 'Annual Leave',
      isActive: true,
      companyId: req.user.companyId,
    });
    if (isAnnualLeave) {
      const keys = [
        'Ops Group Name',
        'Staff Id',
        'Staff name',
        'Staff Parent Bu',
        'Staff Email',
        'Staff Phone',
        'Date Added',
        'Last Modified',
        'Admin Name',
        'Leave Group Name',
        `Plan Quota (${previousYear})`,
        ,
        `Annual Leave ${previousYear} (Remaining Plan quota)`,
        `Plan Quota (${currentYear})`,
        ,
        `Annual Leave ${currentYear} (Remaining Plan quota)`,
        `Plan Quota (${nextYear})`,
        ,
        `Annual Leave ${nextYear} (Remaining Plan quota)`,
      ];
      let isTeamPresent = false;
      if (opsData.opsTeamId && opsData.opsTeamId.length > 0) {
        keys.splice(1, 0, 'Ops Team Name');
        isTeamPresent = true;
      }
      const csvData = [];
      if (isTeamPresent) {
        console.log('aaa');
        for (let i = 0; i <= opsData.opsTeamId.length - 1; i++) {
          for (let j = 0; j <= opsData.opsTeamId[i].userId.length - 1; j++) {
            const csvObj = {
              'Ops Group Name': opsData.opsGroupName,
              'Ops Team Name': opsData.opsTeamId[i].name,
              'Staff Id': opsData.opsTeamId[i].userId[j].staffId,
              'Staff name': opsData.opsTeamId[i].userId[j].name,
              'Staff Parent Bu':
                opsData.opsTeamId[i].userId[j].parentBussinessUnitId.sectionId
                  .departmentId.companyId.name +
                ' > ' +
                opsData.opsTeamId[i].userId[j].parentBussinessUnitId.sectionId
                  .departmentId.name +
                ' > ' +
                opsData.opsTeamId[i].userId[j].parentBussinessUnitId.sectionId
                  .name +
                '> ' +
                opsData.opsTeamId[i].userId[j].parentBussinessUnitId.name,
              'Staff Email': opsData.opsTeamId[i].userId[j].email,
              'Staff Phone': opsData.opsTeamId[i].userId[j].contactNumber,
              'Date Added': moment(opsData.createdAt).format('MM-DD-YYYY'),
              'Last Modified': moment(opsData.updatedAt).format(
                'MM-DD-YYYY HH:mm',
              ),
              'Admin Name': opsData.createdBy ? opsData.createdBy.name : '',
            };
            //  console.log("IN TEAM fort User: ",opsData.opsTeamId[i].userId[j]);
            const userSapData = await staffLeave
              .findOne(
                { userId: opsData.opsTeamId[i].userId[j]._id },
                { leaveGroupId: 1, leaveDetails: 1 },
              )
              .populate([
                {
                  path: 'leaveGroupId',
                  select: 'name',
                },
              ]);
            //   let userSap = JSON.stringify(userSapData);
            //   userSap = JSON.parse(userSap)
            //   if(userSapData){
            //     csvObj['Ballot Ballance'] = userSap.ballotLeaveBalanced;
            //   }else{
            //       console.log("here sapdata cannot be found");
            //   }
            if (userSapData) {
              let userSap = JSON.stringify(userSapData);
              userSap = JSON.parse(userSap);
              csvObj['Leave Group Name'] = userSap.leaveGroupId.name;
              // previous year data
              let leaveDetailsPreviousYear = userSap.leaveDetails.filter(
                (leave) => {
                  return (
                    leave.leaveTypeId.toString() ==
                      isAnnualLeave._id.toString() && leave.year == previousYear
                  );
                },
              );
              if (
                leaveDetailsPreviousYear &&
                leaveDetailsPreviousYear.length > 0
              ) {
                leaveDetailsPreviousYear = leaveDetailsPreviousYear[0];
                csvObj[`Plan Quota (${previousYear})`] =
                  leaveDetailsPreviousYear.total;
                csvObj[`Annual Leave ${previousYear} (Remaining Plan quota)`] =
                  leaveDetailsPreviousYear.planQuota;
              } else {
                csvObj[`Plan Quota (${previousYear})`] = '-';
                csvObj[`Annual Leave ${previousYear} (Remaining Plan quota)`] =
                  '-';
              }

              // current year data
              let leaveDetailsCurrentYear = userSap.leaveDetails.filter(
                (leave) => {
                  return (
                    leave.leaveTypeId.toString() ==
                      isAnnualLeave._id.toString() && leave.year == currentYear
                  );
                },
              );
              if (
                leaveDetailsCurrentYear &&
                leaveDetailsCurrentYear.length > 0
              ) {
                leaveDetailsCurrentYear = leaveDetailsCurrentYear[0];
                csvObj[`Plan Quota (${currentYear})`] =
                  leaveDetailsCurrentYear.total;
                csvObj[`Annual Leave ${currentYear} (Remaining Plan quota)`] =
                  leaveDetailsCurrentYear.planQuota;
              } else {
                csvObj[`Plan Quota (${currentYear})`] = '-';
                csvObj[`Annual Leave ${currentYear} (Remaining Plan quota)`] =
                  '-';
              }

              // next year data
              let leaveDetailsNextYear = userSap.leaveDetails.filter(
                (leave) => {
                  return (
                    leave.leaveTypeId.toString() ==
                      isAnnualLeave._id.toString() && leave.year == nextYear
                  );
                },
              );
              if (leaveDetailsNextYear && leaveDetailsNextYear.length > 0) {
                leaveDetailsNextYear = leaveDetailsNextYear[0];
                csvObj[`Plan Quota (${nextYear})`] = leaveDetailsNextYear.total;
                csvObj[`Annual Leave ${nextYear} (Remaining Plan quota)`] =
                  leaveDetailsNextYear.planQuota;
              } else {
                csvObj[`Plan Quota (${nextYear})`] = '-';
                csvObj[`Annual Leave ${nextYear} (Remaining Plan quota)`] = '-';
              }
            } else {
              csvObj['Leave Group Name'] = '-';
              csvObj[`Plan Quota (${previousYear})`] = '-';
              csvObj[`Annual Leave ${previousYear} (Remaining Plan quota)`] =
                '-';
              csvObj[`Plan Quota (${currentYear})`] = '-';
              csvObj[`Annual Leave ${currentYear} (Remaining Plan quota)`] =
                '-';
              csvObj[`Plan Quota (${nextYear})`] = '-';
              csvObj[`Annual Leave ${nextYear} (Remaining Plan quota)`] = '-';
              console.log('here sapdata cannot be found');
            }
            csvData.push(csvObj);
          }
        }
      } else {
        for (let k = 0; k <= opsData.userId.length - 1; k++) {
          console.log('I amhhhh');
          const csvObj = {
            'Ops Group Name': opsData.opsGroupName,
            'Staff Id': opsData.userId[k].staffId,
            'Staff name': opsData.userId[k].name,
            'Staff Parent Bu':
              opsData.userId[k].parentBussinessUnitId.sectionId.departmentId
                .companyId.name +
              ' > ' +
              opsData.userId[k].parentBussinessUnitId.sectionId.departmentId
                .name +
              ' > ' +
              opsData.userId[k].parentBussinessUnitId.sectionId.name +
              '> ' +
              opsData.userId[k].parentBussinessUnitId.name,
            'Staff Email': opsData.userId[k].email,
            'Staff Phone': opsData.userId[k].contactNumber,
            'Date Added': moment(opsData.createdAt).format('MM-DD-YYYY'),
            'Last Modified': moment(opsData.updatedAt).format(
              'MM-DD-YYYY HH:mm',
            ),
            'Admin Name': opsData.createdBy.name,
          };

          const userSapData = await staffLeave
            .findOne(
              { userId: opsData.userId[k]._id },
              { leaveGroupId: 1, leaveDetails: 1 },
            )
            .populate([
              {
                path: 'leaveGroupId',
                select: 'name',
              },
            ]);

          //const userSapData = await StaffSapData.findOne({staff_Id:opsData.userId[k]._id},{_id:0,staff_Id:1,ballotLeaveBalanced:1});
          if (userSapData) {
            let userSap = JSON.stringify(userSapData);
            userSap = JSON.parse(userSap);
            csvObj['Leave Group Name'] = userSap.leaveGroupId.name;

            // previous year data
            let leaveDetailsPreviousYear = userSap.leaveDetails.filter(
              (leave) => {
                return (
                  leave.leaveTypeId.toString() ==
                    isAnnualLeave._id.toString() && leave.year == 2021
                );
              },
            );
            if (
              leaveDetailsPreviousYear &&
              leaveDetailsPreviousYear.length > 0
            ) {
              leaveDetailsPreviousYear = leaveDetailsPreviousYear[0];
              csvObj[`Plan Quota (${previousYear})`] =
                leaveDetailsPreviousYear.total;
              csvObj[`Annual Leave ${previousYear} (Remaining Plan quota)`] =
                leaveDetailsPreviousYear.planQuota;
            } else {
              csvObj[`Plan Quota (${previousYear})`] = '-';
              csvObj[`Annual Leave ${previousYear} (Remaining Plan quota)`] =
                '-';
            }

            // current year data
            let leaveDetailsCurrentYear = userSap.leaveDetails.filter(
              (leave) => {
                return (
                  leave.leaveTypeId.toString() ==
                    isAnnualLeave._id.toString() && leave.year == 2022
                );
              },
            );
            if (leaveDetailsCurrentYear && leaveDetailsCurrentYear.length > 0) {
              leaveDetailsCurrentYear = leaveDetailsCurrentYear[0];
              csvObj[`Plan Quota (${currentYear})`] =
                leaveDetailsCurrentYear.total;
              csvObj[`Annual Leave ${currentYear} (Remaining Plan quota)`] =
                leaveDetailsCurrentYear.planQuota;
            } else {
              csvObj[`Plan Quota (${currentYear})`] = '-';
              csvObj[`Annual Leave ${currentYear} (Remaining Plan quota)`] =
                '-';
            }

            // next year data
            let leaveDetailsNextYear = userSap.leaveDetails.filter((leave) => {
              return (
                leave.leaveTypeId.toString() == isAnnualLeave._id.toString() &&
                leave.year == nextYear
              );
            });
            if (leaveDetailsNextYear && leaveDetailsNextYear.length > 0) {
              leaveDetailsNextYear = leaveDetailsNextYear[0];
              csvObj[`Plan Quota (${nextYear})`] = leaveDetailsNextYear.total;
              csvObj[`Annual Leave ${nextYear} (Remaining Plan quota)`] =
                leaveDetailsNextYear.planQuota;
            } else {
              csvObj[`Plan Quota (${nextYear})`] = '-';
              csvObj[`Annual Leave ${nextYear} (Remaining Plan quota)`] = '-';
            }
          } else {
            csvObj['Leave Group Name'] = '-';
            csvObj[`Plan Quota (${previousYear})`] = '-';
            csvObj[`Annual Leave ${previousYear} (Remaining Plan quota)`] = '-';
            csvObj[`Plan Quota (${currentYear})`] = '-';
            csvObj[`Annual Leave ${currentYear} (Remaining Plan quota)`] = '-';
            csvObj[`Plan Quota (${nextYear})`] = '-';
            csvObj[`Annual Leave ${nextYear} (Remaining Plan quota)`] = '-';
            console.log('here sapdata cannot be found');
          }
          csvData.push(csvObj);
        }
      }
      //return res.json({success: true, keys,csvData});
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
        res.status(200).send(csv);
        return;
      });
    }
  } catch (err) {
    __.log(err);
    __.out(res, 500, err);
  }
};

module.exports.importOpsGroup = async (req, res) => {
  try {
    const bodyData = await getBodyData1(req);
    let asyncIndex = 0;
    if (bodyData) {
      await async.eachSeries(bodyData.opsGroupDetails, (item, next) => {
        let opsData = item;
        console.log('ITEM IS: ', opsData['Staff name']);
        if (opsData['Ops Group Name'] == '' || opsData['Admin Name'] == '') {
          console.log('no datato save');
          next();
        }
        if (
          opsData['Ops Group Name'] == undefined ||
          opsData['Admin Name'] == undefined
        ) {
          console.log('no datato save');
          next();
        }
        var parentBuArr = opsData['Staff Parent Bu'].split('>');
        let parentBu = parentBuArr[3].trim();
        console.log('parentBuArr: ', parentBu);
        SubSection.findOne({ name: parentBu })
          .then((Bu) => {
            console.log('BU is:');
            User.findOne({ name: opsData['Admin Name'] })
              .then((user) => {
                console.log('user found', user.name);
                console.log('USERID IS: ', user._id);
                OpsGroupSystemAdmin.findOne({ userId: user._id })
                  .then((systemAdminData) => {
                    console.log(
                      'Syestem admin found',
                      systemAdminData.buId,
                      'and BUID is : ',
                      Bu._id,
                    );
                    let ifHas = checkIfHasId(systemAdminData.buId, Bu._id);
                    console.log('IDHAS IS: ', ifHas);
                    if (ifHas == true) {
                      console.log('FOUND IN systemAdminData');
                      User.findOne({ staffId: opsData['Staff Id'] })
                        .populate({
                          path: 'parentBussinessUnitId',
                          select: 'name',
                        })
                        .then((staff) => {
                          console.log('FOUND STAFF BY ID: ', staff._id);
                          if (staff.name !== opsData['Staff name']) {
                            console.log(
                              'IN CHECK IF STAFF ID AND NAME DOES NOT MATCH',
                            );
                            var logObj = {
                              message: 'StaffId and Staff name does not match',
                              adminName: opsData['Admin Name'],
                              adminId: user._id,
                              userName: opsData['Staff name'],
                              opsGroupName: opsData['Ops Group Name'],
                              opsTeamName: opsData['Ops Team Name'],
                            };
                            var log = new opsLog(logObj);
                            let lg = log.save();
                            next();
                          } else {
                            OpsGroup.find({ userId: staff._id })
                              .then((ops) => {
                                if (ops.length > 0) {
                                  var logObj = {
                                    message:
                                      'This Staff is already exists in some other ops group',
                                    adminName: opsData['Admin Name'],
                                    adminId: user._id,
                                    userName: opsData['Staff name'],
                                    opsGroupName: opsData['Ops Group Name'],
                                    opsTeamName: opsData['Ops Team Name'],
                                  };
                                  var log = new opsLog(logObj);
                                  let lg = log.save();
                                  next();
                                } else {
                                  console.log(
                                    'IN ELSE OF IF OPS GROUP HAS THAT STAFF',
                                  );
                                  OpsGroup.findOne({
                                    opsGroupName: opsData['Ops Group Name'],
                                  })
                                    .then((opsgroup) => {
                                      if (
                                        opsData['Ops Team Name'] !== '' &&
                                        opsData['Ops Team Name'] !== undefined
                                      ) {
                                        console.log(
                                          'IN IF OF FINDING SIMILAR OPS GROUP WITH ITS NAME:',
                                        );
                                        if (opsgroup.opsTeamId.length > 0) {
                                          OpsTeam.findOne({
                                            name: opsData['Ops Team Name'],
                                          })
                                            .then((team) => {
                                              OpsGroup.update(
                                                { _id: opsgroup._id },
                                                {
                                                  $push: { userId: staff._id },
                                                },
                                                function (err, updatedops) {
                                                  if (!err) {
                                                    OpsTeam.update(
                                                      { _id: team._id },
                                                      {
                                                        $push: {
                                                          userId: staff._id,
                                                        },
                                                      },
                                                      function (err, opsteam) {
                                                        if (!err) {
                                                          console.log(
                                                            'UPDATED',
                                                            opsgroup,
                                                            'And OPS TEAM IS: ',
                                                            team,
                                                          );
                                                          next();
                                                        } else {
                                                          console.log(
                                                            "couldn't update in opsteam .",
                                                          );
                                                          next();
                                                        }
                                                      },
                                                    );
                                                  } else {
                                                    console.log(
                                                      "couldn't update in ops group.",
                                                    );
                                                    next();
                                                  }
                                                },
                                              );
                                            })
                                            .catch((err) => {
                                              var logObj = {
                                                message:
                                                  'Cannot find specified team.',
                                                adminName:
                                                  opsData['Admin Name'],
                                                adminId: user._id,
                                                userName: opsData['Staff name'],
                                                opsGroupName:
                                                  opsData['Ops Group Name'],
                                                opsTeamName:
                                                  opsData['Ops Team Name'],
                                              };
                                              var log = new opsLog(logObj);
                                              let lg = log.save();
                                              next();
                                            });
                                        } else {
                                          //This ops group dont have teams
                                          console.log(
                                            'IN ELSE OF THERE IS NO TEAM IN OPS GROP ALSO UPDATING HERE',
                                          );
                                          console.log(
                                            'iF TEAM LENGTH IS GREATER THAN 0',
                                          );
                                          var logObj = {
                                            message:
                                              'This Ops Group does not contain any Team. Cannot add Staff to ops group.',
                                            adminName: opsData['Admin Name'],
                                            adminId: user._id,
                                            userName: opsData['Staff name'],
                                            opsGroupName:
                                              opsData['Ops Group Name'],
                                            opsTeamName:
                                              opsData['Ops Team Name'],
                                          };
                                          var log = new opsLog(logObj);
                                          let lg = log.save();
                                          next();
                                        }
                                      } else {
                                        // console.log("HERE IN UPDATION OF ELSE")
                                        if (opsgroup.opsTeamId.length > 0) {
                                          console.log('ELSE OF ELSE YEP YEP');
                                          var logObj = {
                                            message:
                                              'Please specify Team To add this staff. This Ops group contains Teams',
                                            adminName: opsData['Admin Name'],
                                            adminId: user._id,
                                            userName: opsData['Staff name'],
                                            opsGroupName:
                                              opsData['Ops Group Name'],
                                            opsTeamName:
                                              opsData['Ops Team Name'],
                                          };
                                          var log = new opsLog(logObj);
                                          let lg = log.save();
                                          next();
                                        } else {
                                          console.log(
                                            'FOUND MORE THAN 0 TEAMS SECOND ELSE ME AND UPDATING',
                                          );
                                          var logObj = {
                                            message:
                                              'Please specify Team To add this staff.',
                                            adminName: opsData['Admin Name'],
                                            adminId: user._id,
                                            userName: opsData['Staff name'],
                                            opsGroupName:
                                              opsData['Ops Group Name'],
                                            opsTeamName:
                                              opsData['Ops Team Name'],
                                          };
                                          var log = new opsLog(logObj);
                                          let lg = log.save();
                                          next();
                                        }
                                      }
                                    })
                                    .catch((err) => {
                                      console.log(
                                        'not able to find Opsgroup by its name',
                                      );
                                      next();
                                    });
                                }
                              })
                              .catch((err) => {
                                var logObj = {
                                  message: 'Unable to find matching ops group',
                                  adminName: opsData['Admin Name'],
                                  adminId: user._id,
                                  userName: opsData['Staff name'],
                                  opsGroupName: opsData['Ops Group Name'],
                                  opsTeamName: opsData['Ops Team Name'],
                                };
                                var log = new opsLog(logObj);
                                let lg = log.save();
                                next();
                              });
                          }
                        })
                        .catch((err) => {
                          var logObj = {
                            message:
                              'Couldent find mathing Staff, please check staffId',
                            adminName: opsData['Admin Name'],
                            adminId: user._id,
                            userName: opsData['Staff name'],
                            opsGroupName: opsData['Ops Group Name'],
                            opsTeamName: opsData['Ops Team Name'],
                          };
                          var log = new opsLog(logObj);
                          let lg = log.save();
                          next();
                        });
                    } else {
                      var logObj = {
                        message:
                          'This Admin can not add any user from requested BU id.',
                        adminName: opsData['Admin Name'],
                        adminId: user._id,
                        userName: opsData['Staff name'],
                        opsGroupName: opsData['Ops Group Name'],
                        opsTeamName: opsData['Ops Team Name'],
                      };
                      var log = new opsLog(logObj);
                      let lg = log.save();
                      next();
                    }
                  })
                  .catch((err) => {
                    console.log('In system admin catch');
                    next();
                  });
              })
              .catch((err) => {
                console.log('FOUND BU ELSE');
                var logObj = {
                  message: 'Admin not found.',
                  opsGroupName: opsData['Ops Group Name'],
                  opsTeamName: opsData['Ops Team Name'],
                };
                var log = new opsLog(logObj);
                let lg = log.save();
                next();
              });
          })
          .catch((err) => {
            console.log('FOUND BU ELSE');
            var logObj = {
              message: 'Business Unit not found.',
              opsGroupName: opsData['Ops Group Name'],
              opsTeamName: opsData['Ops Team Name'],
            };
            var log = new opsLog(logObj);
            let lg = log.save();
            next();
          });
      });
      res.json({
        status: true,
        code: 0,
        message: 'Successfully Uploaded File',
      });
    } else {
      res.json({
        status: false,
        code: 1,
        message: 'Something went wrong, Try to Reupload file.',
      });
    }
  } catch (err) {
    __.log(err);
    __.out(res, 500, err);
  }
};

module.exports.importCsvLogs = async (req, res) => {
  try {
    let adminid = req.params.id;
    let Logs = await opsLog.find({ adminId: adminid });
    if (!Logs || !Logs.length > 0) {
      return res.json({
        success: false,
        data: 'No Logs Found',
        message: 'Something went wrong!',
      });
    } else {
      return res.json({
        success: true,
        data: Logs,
        message: 'Succesfully Received data',
      });
    }
  } catch (err) {
    __.log(err);
    __.out(res, 500, err);
  }
};

const checkIfHasId = (arrayvar, id) => {
  let result = false;
  arrayvar.map((vr) => {
    if (vr.equals(id)) {
      console.log('vr===id', vr, 'kfjk', id);
      result = true;
    } else {
      console.log('not match');
    }
  });
  return result;
};

const getBodyData1 = (req) => {
  return new Promise((resolve, reject) => {
    var form = new multiparty.Form();
    form.parse(req, function (err, fields, files) {
      const pathCSV = files.file[0].path;
      csv()
        .fromFile(pathCSV)
        .then((jsonObj) => {
          // console.log("jsonObj: ",jsonObj);
          const dataRequiredObj = {
            // opsGroupData: JSON.parse(fields.ops[0]),
            opsGroupDetails: jsonObj,
          };
          resolve(dataRequiredObj);
        })
        .catch((err) => {
          reject(null);
        });
    });
  });
};
module.exports.getplanbu = async (req, res) => {
  try {
    console.log('assisiisis', req.user._id);
    const data = await User.findOne(
      { _id: req.user._id },
      { _id: 0, planBussinessUnitId: 1 },
    ).populate([
      {
        path: 'planBussinessUnitId',
        select: 'orgName',
        match: {
          status: 1,
        },
        // populate: {
        //     path: 'sectionId',
        //     select: 'name',
        //     populate: {
        //         path: 'departmentId',
        //         select: 'name status',
        //         populate: {
        //             path: 'companyId',
        //             select: 'name status',
        //         }
        //     }
        // }
      },
    ]);
    return res.json({ data });
  } catch (err) {
    __.log(err);
    __.out(res, 500, err);
  }
};
module.exports.adminListForBu = async (req, res) => {
  try {
    let planBuObj = await User.findOne(
      { _id: req.user._id },
      {
        planBussinessUnitId: 1,
        _id: 0,
      },
    ).populate([
      {
        path: 'planBussinessUnitId',
        select: '_id',
        match: {
          status: 1,
        },
      },
    ]);
    var plabBuArr = [];
    planBuObj.planBussinessUnitId.forEach((item) => {
      plabBuArr.push(item._id);
    });
    //return res.json({status: true, data: plabBuArr});
    if (plabBuArr && plabBuArr.length > 0) {
      var adminList = await User.find(
        { parentBussinessUnitId: { $in: plabBuArr }, status: 1 },
        {
          name: 1,
          status: 1,
        },
      );
      return res.json({ status: true, data: adminList });
    } else {
      return res.json({ status: false, data: 'no admin found' });
    }
  } catch (e) {
    return res.json({
      status: false,
      data: null,
      message: 'Something went wrong',
      e,
    });
  }
};
