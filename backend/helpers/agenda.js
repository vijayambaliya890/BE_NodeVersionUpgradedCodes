const mongoDsn = `${process.env.LIVE_DB_HOST}`;
const Agenda = require('agenda');
const { logInfo, logError } = require('./logger.helper');
class CreateAgenda {
  constructor() {}
  async createJob(jobName, cron, data) {
    try {
      // console.log(agendaObjqq)
      logInfo('agenda createJob called');
      const agenda = new Agenda({
        db: { address: `${mongoDsn}`, collection: 'notificationcrons' },
      });
      await agenda.start();
      console.log('agenda started');
      const job = await agenda.schedule(cron, jobName, data);
      return job;
    } catch (e) {
      logError('createJob has error');
      return null;
    }
  }
}
CreateAgenda = new CreateAgenda();
module.exports = CreateAgenda;
