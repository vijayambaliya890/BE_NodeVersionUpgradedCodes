const Agenda = require('agenda');
const { logInfo, logError } = require('./logger.helper');
const mongoDsn = `${process.env.LIVE_DB_HOST}`;
const agendaNotification = new Agenda({
    db: { address: `${mongoDsn}`, collection: 'notificationcron1' },
    maxConcurrency: 30,
  });
  
  (async function () {
    // IIFE to give access to async/await
    logInfo('called');
    await agendaNotification.start();
  })();


  const agendaNormal = new Agenda({
    db: { address: `${mongoDsn}` },
  });
  
  (async function () {
    // IIFE to give access to async/await
    logInfo('called');
    await agendaNormal.start();
  })();

  module.exports = {
    agendaNotification,
    agendaNormal
  }