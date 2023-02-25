const { agendaNotification } = require('./agendaInit');
const { logInfo, logError } = require('./logger.helper');
const ManageNotification = require('./manageNotification')
const Mongoose = require('mongoose');

class CreateAgenda {
  constructor() {}
  async createJob(jobName, cron, data) {
    try {
      // console.log(agendaObjqq)
      logInfo('agenda createJob called');

      console.log('agenda started');
      const job = await agendaNotification.schedule(cron, jobName, data);
      return job;
    } catch (e) {
      logError('createJob has error');
      return null;
    }
  }

  async sendNotification(notificationData, flag) {
    try {
      const result = await ManageNotification.sendNotification(notificationData, false)
      return result;
    } catch (e) {
      logError('sendNotification has error', e);
      logError('sendNotification has error', e.stack);
      return null;
    }
  }
}

agendaNotification.define('ad-hoc', async (job) => {
  try {
    logInfo('ad-hoc agenda cron', job);
    const data = job?.attrs.data;
    const notificationData = data.otherModules
      ? data
      : {
          _id: Mongoose.Types.ObjectId(data._id),
          moduleType: data.moduleType,
        };

    CreateAgenda.sendNotification(notificationData, false)
      .then((result) => {
        logInfo('result ad-hoc', result);
      })
      .catch((err) => {
        logError('result ad-hoc', result);
      });
  } catch (e) {
    logError('ad-hoc agenda cron', e);
    logError('ad-hoc agenda cron', e.stack);
  }
});
CreateAgenda = new CreateAgenda();
module.exports = CreateAgenda;
