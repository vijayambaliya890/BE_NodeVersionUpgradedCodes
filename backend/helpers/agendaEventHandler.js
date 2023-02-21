const { agendaNormal } = require('./agendaInit');
const AppliedStaffs = require('../app/models/appliedStaff'),
  ShiftDetails = require('../app/models/shiftDetails'),
  AgendaJobs = require('../app/models/agenda');
const Ballot = require('../app/models/ballot');
const OpsGroup = require('../app/models/ops');
const User = require('../app/models/user');
const FCM = require('./fcm');
const {
  conductBallot,
  publishBallot,
  resultReleaseFun,
} = require('../app/controllers/company/ballotController');

const {
  autoApproveCron,
} = require('../app/controllers/company/attendanceController');

const { logInfo, logError } = require('./logger.helper');

class AgendaCron {
  async addEvent(dateTime, data, oneTime = true) {
    if (oneTime) {
      const job = await agendaNormal.schedule(dateTime, 'eventHandler', data);
      return job;
    }
  }

  async removeEvent(where) {
    try {
      logInfo('remove event called', where);
      const job = await AgendaJobs.findOneAndUpdate(where, {
        $set: { nextRunAt: null, 'data.isRemoved': true },
      }).lean();
      logInfo('removeEvent job', job);
      return job;
    } catch (e) {
      logError('removeEvent has error', e);
      logError('removeEvent has error', e.stack);
      return false;
    }
  }
}

const backupStaffRemoval = async (data) => {
  try {
    logInfo('backupStaffRemoval called', data);
    const shiftDetailId = data.shiftDetailId;
    if (!shiftDetailId) {
      return true;
    }
    const shiftDetailsObj = await ShiftDetails.findOne({
      _id: shiftDetailId,
      $where: 'this.backUpStaffs.length > 0',
    });
    if (!shiftDetailsObj) {
      logInfo('backupStaffRemoval no backup staff found');
      return false;
    }
    const update = await ShiftDetails.findOneAndUpdate(
      {
        _id: shiftDetailId,
      },
      {
        $set: {
          backUpStaffs: [],
          backUpStaffsLog: shiftDetailsObj.backUpStaffs,
          backUpStaffNeedCountLog: shiftDetailsObj.backUpStaffNeedCount,
          backUpStaffNeedCount: 0,
        },
      },
    );
    const backupStaff = shiftDetailsObj.backUpStaffs;
    for (let j = 0; j < backupStaff.length; j++) {
      const userId = backupStaff[j];
      await AppliedStaffs.findOneAndUpdate(
        { flexiStaff: userId, shiftDetailsId: shiftDetailId },
        { status: 0 },
      );
      // add shift limit back
    }
    logInfo('backupStaffRemoval updated', update);
    return update;
  } catch (err) {
    logError('backupStaffRemoval update has error', err);
    logError('backupStaffRemoval update has error', err.stack);
    return err;
  }
};

const ballotNotification = async (item, type) => {
  try {
    logInfo('ballotNotification has called', item);
    let isNotified = 2;
    if (type === 2) {
      isNotified = 0;
    } else if (type === 1) {
      isNotified = 1;
    }
    item = await Ballot.findOne({
      isDeleted: false,
      isCanceled: false,
      isDraft: false,
      isNotified: isNotified,
      _id: item.ballotId,
    });
    if (item) {
      const usersDeviceTokens = [];
      let userWhere = {};
      if (item.userFrom === 1) {
        // user from ops group
        const userIDArr = await OpsGroup.find(
          { _id: { $in: item.opsGroupId }, isDelete: false },
          {
            userId: 1,
            _id: 0,
          },
        );
        let userId = [];
        userIDArr.forEach((item) => {
          userId = userId.concat(item.userId);
        });
        userWhere = { _id: { $in: userId } };
      } else {
        // user from bu
        userWhere = { parentBussinessUnitId: { $in: item.businessUnitId } };
      }
      const unAssignUser = await User.find(userWhere)
        .select('deviceToken')
        .lean();
      unAssignUser.forEach((token) => {
        if (token.deviceToken) {
          usersDeviceTokens.push(token.deviceToken);
        }
      });
      var appLastDate = new Date(item.applicationCloseDateTime);
      let appLastDateHere = appLastDate.toISOString().slice(0, 10);
      let body = `Today is the Ballot Exercise ${item.ballotName} closing day ${appLastDateHere} if not balloted yet, ballot before it closes.`;
      let bodyText = `Today is the Ballot Exercise ${item.ballotName} closing day ${appLastDateHere} if not balloted yet, ballot before it closes.`;
      let bodyTime = [
        item.applicationCloseDateTime,
        item.applicationCloseDateTime,
      ];

      if (type === 2) {
        body = `Just 2 days left for close of this Ballot submission. Ballot Name: ${item.ballotName} Please Ballot in 2 days before it closes.`;
        bodyText = `Just 2 days left for close of this Ballot submission. Ballot Name: ${item.ballotName} Please Ballot in 2 days before it closes.`;
        bodyTime = [item.applicationCloseDateTime];
      } else if (type === 1) {
        body = `Just a day left for close of this Ballot submission. Ballot Name: ${item.ballotName} Please ballot before it closes.`;
        bodyText = `Just a day left for close of this Ballot submission. Ballot Name: ${item.ballotName} Please ballot before it closes.`;
        bodyTime = [item.applicationCloseDateTime];
      }
      if (usersDeviceTokens.length > 0) {
        const pushData = {
            title: 'Reminder on the Balloting Exercise',
            body,
            bodyText,
            bodyTime,
            bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
          },
          collapseKey = item._id; /*unique id for this particular ballot */
        FCM.push(usersDeviceTokens, pushData, collapseKey);
      }
      isNotified = isNotified + 1;
      const data = await Ballot.updateOne(
        { _id: item._id },
        { isNotified: isNotified },
      );
    }
    return true;
  } catch (e) {
    logError('ballotNotification has error', e);
    logError('ballotNotification has error', e.stack);
    return false;
  }
};

agendaNormal.define('autoApproveAttendanceCron', async (job) => {
  try {
    logInfo('autoApproveAttendanceCron called');
    await autoApproveCron();
    return true;
  } catch (e) {
    logError('autoApproveAttendanceCron error', e);
    return true;
  }
});
agendaNormal.define(
  'eventHandler',
  { priority: 'high', concurrency: 50 },
  async (job) => {
    try {
      const data = job.attrs.data;
      logInfo('eventHandler agenda cron', data);
      switch (data.type) {
        case 'BackupStaffRemoval':
          backupStaffRemoval(data)
            .then((result) => {
              logInfo('BackupStaffRemoval done', result);
            })
            .catch((err) => {
              logError('BackupStaffRemoval has error', err);
            });
          break;
        case 'notificationBefore2Days':
          ballotNotification(data, 2)
            .then((result) => {
              logInfo('BackupStaffRemoval done', result);
            })
            .catch((err) => {
              logError('BackupStaffRemoval has error', err);
            });
          break;
        case 'notificationBefore1Day':
          ballotNotification(data, 1)
            .then((result) => {
              logInfo('BackupStaffRemoval done', result);
            })
            .catch((err) => {
              logError('BackupStaffRemoval has error', err);
            });
          break;
        case 'notificationOnDay':
          ballotNotification(data, 0)
            .then((result) => {
              logInfo('BackupStaffRemoval done', result);
            })
            .catch((err) => {
              logError('BackupStaffRemoval has error', err);
            });
        case 'conductBallot':
          conductBallot(data.ballotId)
            .then((result) => {
              logInfo('BackupStaffRemoval done', result);
            })
            .catch((err) => {
              logError('BackupStaffRemoval has error', err);
            });
          break;
        case 'publishBallot':
          publishBallot(data.ballotId)
            .then((result) => {
              logInfo('BackupStaffRemoval done', result);
            })
            .catch((err) => {
              logError('BackupStaffRemoval has error', err);
            });
          break;
        case 'resultRelease':
          resultReleaseFun(data.ballotId)
            .then((result) => {
              logInfo('BackupStaffRemoval done', result);
            })
            .catch((err) => {
              logError('BackupStaffRemoval has error', err);
            });
          break;
        default:
          break;
      }
      return true;
    } catch (e) {
      logError('eventHandler has error', e);
      return false;
    }
  },
);
AgendaCron = new AgendaCron();
module.exports = AgendaCron;
