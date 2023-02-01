const { agendaNormal } = require('./agendaInit');
const AppliedStaffs = require('../app/models/appliedStaff'),
  ShiftDetails = require('../app/models/shiftDetails'),
  AgendaJobs= require('../app/models/agenda');

const { logInfo, logError } = require('./logger.helper');

class AgendaCron {
  async addEvent(dateTime, data, oneTime = true) {
    if (oneTime) {
      const job = await agendaNormal.schedule(dateTime, 'eventHandler', data);
      return job;
    }
  }

  async removeEvent(where) {
    logInfo('remove event called', where)
    new AgendaJobs({nextRunAt: new Date(), name:'aa'}).save();
    const job = await AgendaJobs.findOneAndUpdate(where, {$set:{nextRunAt: null, 'data.isRemoved': true}}).lean();
    console.log('dddddd', jobs.length)
    return job;
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

agendaNormal.define('eventHandler', async (job) => {
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

    default:
      break;
  }
});
AgendaCron = new AgendaCron();
module.exports = AgendaCron;
