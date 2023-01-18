// import Mongoose from "mongoose";
// import {
//     MODELS
// } from "../../helpers/constants";
// import { getDB } from '../connection/db.connect';
const Mongoose = require('mongoose');
const NotificationCronModel = require('../app/models/notificationCron');

class NotificationCron {

    constructor(dbName) {
        this.dbName = dbName
    }
    async update(where, updateObj) {
        // const db = await getDB(this.dbName);
        // const notificationCronModel = await db.getModel(MODELS.NOTIFICATION_CRON);
        const updateCron = await NotificationCronModel.updateOne(where, { $set: updateObj });
        console.log(where, updateCron)
        return true;
    }
    async getAll(skip, limit, sortObj, where, requiredData) {
        // const db = await getDB(this.dbName);
        // const notificationCronModel = await db.getModel(MODELS.NOTIFICATION_CRON);
        let notificationData = await NotificationCronModel.find(where, requiredData)
            .populate([{
                path: 'data.createdBy',
                select: 'name'
            }])
            .sort(sortObj).skip(skip)
            .limit(limit);
        return notificationData;
    }
    async count(where) {
        // const db = await getDB(this.dbName);
        // const notificationCronModel = await db.getModel(MODELS.NOTIFICATION_CRON);
        let notificationData = await NotificationCronModel.countDocuments(where);
        return notificationData;
    }
    async deleteMany(where) {
        // const db = await getDB(this.dbName);
        // const notificationCronModel = await db.getModel(MODELS.NOTIFICATION_CRON);
        let result = await NotificationCronModel.deleteMany(where);
        return result;
    }
    async getCronNotification() {
        // const db = await getDB(this.dbName);
        // // return []
        // const notificationCronModel = await db.getModel(MODELS.NOTIFICATION_CRON);
        const allNotification = await NotificationCronModel.find({ nextRunAt: { $lte: new Date() } }).lean();
        const cronId = allNotification.map((id) => id._id);
        const notificationData = allNotification.map((id) => 
            id.data.otherModules ? 
            id.data :
            ({ _id: Mongoose.Types.ObjectId(id.data._id), moduleType: id.data.moduleType }));
        const update = await NotificationCronModel.updateMany({ _id: { $in: cronId } }, { $set: { lastRunAt: new Date(), nextRunAt: null } });
        return notificationData;
    }
}
NotificationCron = new NotificationCron();
module.exports = NotificationCron;
