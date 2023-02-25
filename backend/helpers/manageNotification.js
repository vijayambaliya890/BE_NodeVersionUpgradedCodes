const push_noti_status = {
  SUCCESS: 'success',
  FAILED: 'failed',
};
// import PushNotificationHelper from "../../helpers/pushNotificationHelper";
// import { getDB } from '../connection/db.connect';
// import PushNotification from "../../helpers/pushNotification";
// import Agenda from "../../helpers/agenda";
const PushNotificationHelper = require('./pushNotificationHelper');
const { agendaNotification } = require('./agendaInit');
const PushNotification = require('./pushNotification');
const Notification = require('../app/models/notification');
const NotificationCron = require('../app/models/notificationCron');
const { logInfo, logError } = require('./logger.helper');
class ManageNotification {
  constructor() {}
  async create(notification) {
    return await new Notification(notification).save();
  }
  async getAll(where, requiredData, sortObj, skip, limit) {
    let notificationData = await Notification.find(where, requiredData)
      .populate([
        {
          path: 'createdBy',
          select: 'name',
        },
      ])
      .sort(sortObj)
      .skip(skip)
      .limit(limit);
    return notificationData;
  }
  async count(where) {
    let notificationData = await Notification.countDocuments(where);
    return notificationData;
  }
  async getSingle(where) {
    let notificationData = await Notification.findOne(where)
      .populate({
        path: 'assignUsers.businessUnits',
        select: 'name status sectionId orgName',
        populate: {
          path: 'sectionId',
          select: 'name status departmentId',
          populate: {
            path: 'departmentId',
            select: 'name status companyName',
          },
        },
      })
      .populate({
        path: 'assignUsers.appointments',
        select: 'name status',
      })
      .populate({
        path: 'assignUsers.user',
        select: 'name staffId',
      })
      .populate({
        path: 'assignUsers.admin', // this is missing in notification
        strictPopulate: false,
        select: 'name staffId',
      })
      .populate({
        path: 'assignUsers.subSkillSets',
        strictPopulate: false,
        select: 'name status',
        populate: {
          //this populate has been requested from frontEnd team , so did so
          path: 'skillSetId',
          select: '_id name',
        },
      });
    return notificationData;
  }
  async cancelled(id, notificationStatus) {
    const updateCron = await Notification.findOneAndUpdate(
      { _id: id },
      { $set: { notificationStatus: notificationStatus } },
    );

    return true;
  }
  async updateField(id, updateObj) {
    const updatedNotification = await Notification.findOneAndUpdate(
      { _id: id },
      { $set: updateObj },
    );
    return updatedNotification;
  }
  async updateOne(id, updateObj) {
    const updatedNotification = await Notification.findOneAndUpdate(
      { _id: id },
      updateObj,
      { new: true },
    );
    return updatedNotification;
  }
  async sendNotification(data) {
    // fromUpdate
    try {
      logInfo('manageNotification::sendNotification', data);
      if (data.otherModules) {
        // from doodleblue for other module push notifications
        const result = await this.sendPushNotificationOtherModules(data);
        return result;
      } else if (data.moduleType === 'pushNotification') {
        const result = await this.sendImmediateNotification(data._id, false);
        return result;
      } else {
        return 'old data';
      }
    } catch (e) {
      logError('manageNotification::sendNotification', e);
      return e;
    }
  }
  async sendImmediateNotification(id, fromUpdate = false) {
    // fromUpdate
    logInfo('manageNotification::sendImmediateNotification', id);
    let getField = {};
    if (!fromUpdate) {
      getField = {
        title: 1,
        description: 1,
        assignUsers: 1,
      };
    }
    let notificationData = await Notification.findOne(
      { _id: id, isPublish: true, notificationStatus: { $nin: [3, 4] } },
      getField,
    );
    if (notificationData) {
      const notificationObj = {
        title: notificationData.title,
        body: notificationData.description,
      };
      // get device token

      const users = await PushNotificationHelper.getAssignUsers(
        notificationData,
        ['_id', 'deviceToken'],
      );
      let totalUser = 0;
      let userId = [];
      if (users.length > 0) {
        totalUser = users.length;
        let deviceTokenList = [];
        deviceTokenList = users.map((user) => user.deviceToken);
        userId = users.map((user) => user._id);
        deviceTokenList = deviceTokenList.filter((tokenId) => tokenId);
        const result = PushNotification.push(
          notificationObj,
          deviceTokenList,
          notificationData._id,
        );
      }
      if (!fromUpdate) {
        const updateCron = await NotificationCron.updateOne(
          { 'data._id': id },
          {
            $set: {
              lastFinishedAt: new Date(),
              totalSent: totalUser,
              'data.notifyAcknowledgedUsers': userId,
            },
          },
        );

        return updateCron;
      } else {
        // create cron entry in case if immediate notification
        let data = JSON.parse(JSON.stringify(notificationData));
        data.notifyAcknowledgedUsers = userId;
        data.moduleType = 'pushNotification';
        data = await this.deleteUnwantedData(data);
        const obj = {
          name: 'ad-hoc',
          totalSent: totalUser,
          data: data,
          priority: 0,
          type: 'normal',
          nextRunAt: null,
          lastRunAt: new Date(),
          lastFinishedAt: new Date(),
        };
        const rr = await new NotificationCron(obj).save();
        return true;
      }
    } else {
      return true;
    }
  }
  async sendPushNotificationOtherModules(notificationData) {
    notificationData = await this.ifActiveThenSend(notificationData);

    const updateCron = await NotificationCron.updateOne(
      { 'data._id': notificationData.id },
      {
        $set: {
          lastFinishedAt: new Date(),
          totalSent: notificationData.notifyAcknowledgedUsers.length,
          'data.notifyAcknowledgedUsers':
            notificationData.notifyAcknowledgedUsers,
        },
      },
    );

    return updateCron;
  }

  /* push notification for other modules */
  async createPushNotification(input) {
    input.otherModules = true; // notification not sent from enhanced notification module
    input.pushNotificationStatus = push_noti_status.SUCCESS;
    input.companyName = this.dbName;
    const bool = [
      'title',
      'description',
      'nextRunTime', // `now` to push immediatly. give `date and time` to push on time
      'moduleName', // model name, from Constants.js
      'moduleAction', // in board - create post, create admin response, etc.
      'moduleId', // like., customformId, postId, etc.
      'createdBy', // userId (_id)
    ].every((field) => Object.keys(input).includes(field) && !!input[field]);

    if (!bool) {
      input.pushNotificationStatus = push_noti_status.FAILED;
      input.reason = `push notification input missing`;
      input.nextRunTime = null; // push notification entry will create. but will not send
    }

    // delete any existing notification, if requesting again on the same.
    await NotificationCron.deleteMany({
      'data.moduleId': input.moduleId,
      'data.moduleAction': input.moduleAction,
      nextRunAt: { $ne: null },
    });

    // send immediatly, (nextRunTime: 'now')
    if (
      input.nextRunTime === 'now' &&
      input.pushNotificationStatus !== push_noti_status.FAILED
    ) {
      input.nextRunTime = null;
      input = await this.ifActiveThenSend(input);
    }
    //(cron, jobName, data)
    // date/time given to send push notification, creating new notification cron entry
    await agendaNotification.schedule(input.nextRunTime, 'ad-hoc', input);

    /* make sure next run time as null */

    return {
      status:
        input.pushNotificationStatus === push_noti_status.FAILED ? false : true,
      message:
        input.pushNotificationStatus === push_noti_status.FAILED
          ? input.reason
          : 'Push notification created successfully',
    };
  }

  async ifActiveThenSend(input) {
    const output = await PushNotificationHelper.getUserList(input); // if `false` module not active, so push notification cannot be send.
    // otherwise it will return data which needed to send push notification

    if (!output.isActive) {
      input.pushNotificationStatus = push_noti_status.FAILED;
      input.reason = output.reason;
    }
    input.notifyAcknowledgedUsers = output.userIds; // only these users having device tokens to send push notification. if this empty then notification send to nobody
    input.deviceTokenList = output.deviceTokenList;

    if (
      !!output.deviceTokenList.length &&
      input.pushNotificationStatus !== push_noti_status.FAILED
    ) {
      PushNotification.push(
        {
          title: input.title,
          body: input.description,
        },
        output.deviceTokenList,
        input.moduleId,
      );
    }

    return input;
  }

  async deleteUnwantedData(notification) {
    delete notification.subTitle;
    delete notification.notificationAttachment;
    delete notification.isDynamic;
    delete notification.notifyOverAllUsers;
    delete notification.notifyUnreadUsers;
    delete notification.userAcknowledgedAt;
    delete notification.isSent;
    delete notification.viewOnly;
    delete notification.moduleIncluded;
    delete notification.status;
    delete notification.isScheduleNotification;
    delete notification.notificationTime;
    delete notification.assignUsers;
    delete notification.lastNotified;
    return notification;
  }
}
ManageNotification = new ManageNotification();
module.exports = ManageNotification;
