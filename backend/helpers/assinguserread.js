const User = require('../app/models/user');
const { logError, logInfo } = require('./logger.helper');
class AssignUserRead {
  async read(userDetails, project = { _id: 1 }) {
    try {
      logInfo('AssignUserRead:: read');
      if (userDetails.length === 0) {
        return { status: false, message: 'user details are empty', users: [] };
      }
      const callGetUserDetails = [];
      userDetails.forEach((detail) => {
        callGetUserDetails.push(this.getUserDetails(detail, project));
      });
      const userInfo = await Promise.all(callGetUserDetails);
      const users = userInfo.flat().map((user) => user._id);
      return { users, status: true };
    } catch (err) {
      logError('AssignUserRead:: read', err.stack);
      return { status: false, message: err.message, users: [] };
    }
  }

  async getUserDetails(detail, project) {
    try {
      logInfo('AssignUserRead:: getUserDetails');
      if (!detail.businessUnits) {
        return [];
      }
      let buList = detail.businessUnits;
      if (detail.allBuToken) {
        const userPlanBu = await User.findOne(
          { staffId: detail.allBuTokenStaffId },
          { planBussinessUnitId: 1, _id: 0 },
        ).lean();
        buList = userPlanBu.planBussinessUnitId;
      }

      let searchQuery = {
        $or: [],
      };
      if (detail.buFilterType === 1) {
        searchQuery = {
          parentBussinessUnitId: { $in: buList },
          status: 1,
        };
      } else {
        const condition = detail.buFilterType == 2 ? '$in' : '$nin';
        if (detail.appointments.length > 0) {
          let appointmentId = {
            [condition]: detail.appointments,
          };
          searchQuery.$or.push({
            appointmentId: appointmentId,
            status: 1,
          });
        }
        if (detail.subSkillSets.length > 0) {
          let subSkillSets = { [condition]: detail.subSkillSets };
          searchQuery.$or.push({
            subSkillSets: subSkillSets,
            status: 1,
          });
        }
        detail.authors = detail.authors || [];
        if (detail.authors.length > 0) {
          let authors = { [condition]: detail.authors };
          searchQuery.$or.push({
            _id: authors,
            status: 1,
          });
        }
        detail.admin = detail.admin || [];
        if (detail.admin.length > 0) {
          let admin = { ['$in']: detail.admin };
          searchQuery.$or.push({
            _id: admin,
            status: 1,
          });
        }
        if (detail.customField.length > 0) {
          for (let singleCustom of detail.customField) {
            searchQuery.$or.push({
              otherFields: {
                $elemMatch: {
                  fieldId: singleCustom.fieldId,
                  value: {
                    [condition]: [singleCustom.value],
                  },
                },
              },
              status: 1,
            });
          }
        }
      }
      const users = await User.find(searchQuery, project).lean();
      return users;
    } catch (e) {
      logError('AssignUserRead: getUserDetails', e.stack);
      return [];
    }
  }

  async getUserInWhichAssignUser(userData, Model) {
    try {
      logInfo('AssignUserRead:: getUserInWhichAssignUser');
      let customFields = userData.otherFields || [];
      let subSkillSets = userData.subSkillSets || [];
      let includeOnly = [];
      let excludeOnly = [];
      for (let singleCustom of customFields) {
        const value = singleCustom.value || null;
        const fieldId = singleCustom.fieldId;
        excludeOnly.push({
          'userDetails.customField.fieldId': fieldId,
          'userDetails.customField.value': { $ne: value },
        });
        includeOnly.push({
          'userDetails.customField.fieldId': fieldId,
          'userDetails.customField.value': value,
        });
      }
      // AllbuToken
      let searchQuery = {
        $or: [
          {
            'userDetails.admin': { $in: [userData._id] },
          },
          {
            'userDetails.businessUnits': {
              $in: [userData.parentBussinessUnitId],
            },
            'userDetails.buFilterType': 1,
          },
          {
            'userDetails.businessUnits': {
              $in: [userData.parentBussinessUnitId],
            },
            'userDetails.buFilterType': 2,
            $or: [
              { 'userDetails.authors': userData._id },
              {
                'userDetails.appointments': {
                  $in: [userData.appointmentId],
                },
              },
              {
                'userDetails.subSkillSets': {
                  $in: subSkillSets,
                },
              },
              ...includeOnly,
            ],
          },
          {
            businessUnits: userData.parentBussinessUnitId,
            buFilterType: 3,
            $and: [
              { 'userDetails.authors': { $nin: [userData._id] } },
              {
                'userDetails.appointments': {
                  $nin: [userData.appointmentId],
                },
              },
              {
                'userDetails.subSkillSets': {
                  $nin: subSkillSets,
                },
              },
              ...excludeOnly,
            ],
          },
        ],
      };
      const result = await Model.aggregate([
        {
          $match: {
            status: 1,
            companyId: userData.companyId,
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'createdBy',
            pipeline: [
              {
                $project: {
                  planBussinessUnitId: 1,
                },
              },
            ],
          },
        },
        { $unwind: '$createdBy' },
        { $unwind: '$userDetails' },
        {
          $addFields: {
            'userDetails.businessUnits': {
              $cond: [
                { $eq: ['$userDetails.allBuToken', true] },
                '$createdBy.planBussinessUnitId',
                '$userDetails.businessUnits',
              ],
            },
          },
        },
        {
          $group: {
            _id: '$_id',
            userDetails: { $push: '$userDetails' },
          },
        },
        { $match: searchQuery },
        { $project: { userDetails: 0 } },
      ]);
      return result.map((re) => re._id);
      return result;
    } catch (error) {
      logError('AssignUserRead:: getUserInWhichAssignUser', error.stack);
      return [];
    }
  }

  //   async readSecond(userDetails) {
  //     try {
  //         logInfo('AssignUserRead:: read')
  //       if (userDetails.length === 0) {
  //         return { status: false, message: 'user details are empty', users: [] };
  //       }
  //       const callGetUserDetails = [];
  //       userDetails.forEach((detail, i) => {
  //         callGetUserDetails.push(this.getUserDetails(detail, i));
  //       });
  //       const userInfo = await Promise.all(callGetUserDetails);
  //       const whereCause = {$or:[]};
  //       userInfo.forEach((ss)=>{
  //         whereCause.$or.push(ss)
  //       });
  //     const users = await User.find(whereCause,{_id:1}).lean()
  //       return { users: users, status: true };
  //     } catch (err) {
  //      logError('AssignUserRead:: read', err.stack);
  //      return { status: false, message: err.message, users: [] };
  //     }
  //   }
}
AssignUserRead = new AssignUserRead();
module.exports = { AssignUserRead };
