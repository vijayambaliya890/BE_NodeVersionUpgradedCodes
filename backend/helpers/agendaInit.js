const Agenda = require('agenda');
const { logInfo, logError } = require('./logger.helper');
const mongoDsn = `${process.env.LIVE_DB_HOST}`;
const agendaNotification = new Agenda({
  db: { address: `${mongoDsn}`, collection: 'notificationcrons' },
  maxConcurrency: 30,
});

(async function () {
  // IIFE to give access to async/await
  logInfo('agendaNotification called');
  await agendaNotification.start();
  logInfo('agendaNotification started');
})();

const agendaNormal = new Agenda({
  db: { address: `${mongoDsn}` },
  processEvery: '1 minute',
  maxConcurrency: 60,
});

(async function () {
  // IIFE to give access to async/await
  logInfo('agendaNormal called');
  await agendaNormal.start();

  const jobs = await agendaNormal.jobs({ name: 'autoApproveAttendanceCron' });
  if (jobs.length === 0) {
    const autoApproveAttendanceCron = agendaNormal.create(
      'autoApproveAttendanceCron',
      {},
    );
    const job = await autoApproveAttendanceCron.repeatEvery('3 minutes', {
      skipImmediate: true,
    });
    job.unique({ name: 'autoApproveAttendanceCron' });
    await job.save();
    logInfo('autoApproveAttendanceCron created');
  }

  logInfo('agendaNormal started');
})();

module.exports = {
  agendaNotification,
  agendaNormal,
};
