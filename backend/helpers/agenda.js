const mongoDsn = `${process.env.LIVE_DB_HOST}`;
const Agenda = require('Agenda');

class CreateAgenda {
    constructor() {
    }
    async createJob(jobName, cron, data, dbName) {
        // console.log(agendaObjqq)
        const agenda = new Agenda({ db: { address: `${mongoDsn}`, collection: 'notificationCron' } });
        await agenda.start();
        console.log('agenda started');
        const job = await agenda.schedule(cron, jobName, data);
        return job;
    }
}
CreateAgenda = new CreateAgenda();
module.exports = CreateAgenda;

