// import CompanyRepo from '../database/repositories/company.repository';
// import NotificationCronRepo from '../database/repositories/notificationCron.repository';
// import ManageNotificationRepo from '../database/repositories/manageNotification.repository';

const NotificationCronRepo = require('./notificationCron.repository')
const ManageNotificationRepo = require('./manageNotification.repository')
const schedule =require('node-schedule');
class AgendaPush {
    constructor() {
    }
    async getCompany() {
        // const companyRepo = new CompanyRepo("admindb");
        // const companyList = await companyRepo.getAllCompanyForNotification();
        // const companyWiseExecution = [];
        // for (let i = 0; i < companyList.length; i++) {
        //     companyWiseExecution.push(this.getNotification(companyList[i]));
        // }
        // const result = await Promise.all(companyWiseExecution);
        await this.getNotification(); // get all notification
        //console.log("*********************************", result)

    }
    async getNotification(name) {
        return new Promise(async(resolve, reject) => {
            // const notificationCronRepo = new NotificationCronRepo(name);
            const notificationDataArr = await NotificationCronRepo.getCronNotification();
            // const manageNotificationRepo = new ManageNotificationRepo(name);
            const sentNotificationArr = [];
            for (let i = 0; i < notificationDataArr.length; i++) {
                sentNotificationArr.push(ManageNotificationRepo.sendNotification(notificationDataArr[i], false));
            }
            const result = await Promise.all(sentNotificationArr)
            resolve(result)
        })

    }

}
AgendaPush = new AgendaPush();
module.exports = AgendaPush;
// export default AgendaPush;

setTimeout(() => {
    console.log('agenda push')
    const job = schedule.scheduleJob('*/30 * * * * *', function() { // evry 30 sec
        // console.log("&&&&&&&&&&&&&&77")
        AgendaPush.getCompany()
    });
}, 10000);