const ManageNotificationRepo = require('../../../helpers/manageNotification'); 
const NotificationCronRepo = require('../../../helpers/notificationCron'); 
const Agenda = require('../../../helpers/agenda'); 
const moment = require('moment');
const { logInfo, logError } = require('../../../helpers/logger.helper');


const dayArr = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
class ManageNotification {
  constructor() {

  }
  async createAdHocNotification(body, req, res) {
    try {
      body.effectiveFrom = `${body.activeFrom.split(" ")[0]} ${body.notificationTime}:00 ${body.timeZone}`;
      body.effectiveTo = body.effectiveFrom;
      // add createdby
      const date = new Date(body.effectiveFrom);
      if (date.getTime() < new Date().getTime()) {
        return res.json({ success: false, msg: "You can not create past notification" });
      }
      body.createdBy = req.user._id;
      let notification = await ManageNotificationRepo.create(body);
      notification = JSON.parse(JSON.stringify(notification))
      // notification.companyName = req.company.name;
      notification.moduleType = "pushNotification";
      notification = this.deleteUnwantedData(notification);
      // const agenda = await Agenda.agendaObj(req.company.name);
      const job = await Agenda.createJob('ad-hoc', date, notification)
      if (!body.isPublish) {
        let notificationCron = await NotificationCronRepo.update({ "data._id": notification._id }, { nextRunAt: null });

        // const updateCron = await NotificationCron.findOneAndUpdate({ "data._id": notification._id }, { nextRunAt: null })
      }

      return res.status(201).json({ success: true, msg: `Ad-Hoc notification created successfully ${!body.isPublish ? "as draft" : ""}`, data: notification, job })
    } catch (e) {
      console.log('e', e)
      return res.status(201).json({ success: false, msg: "Ad-Hoc notification not created successfully", e })
    }

  }
  deleteUnwantedData(notification) {
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
  async createNotification(req, res) {
    try {
      const body = req.body;
      body.createdBy = req.user._id;
      if (body.notificationType === 1) {
        this.createAdHocNotification(body, req, res)
      } else {
        if (!body.activeTo) {
          return res.status(422).json({
            success: false,
            msg: "Following field is missing :-  activeTo",
          });
        }
        if (body.notificationSchedule === 2) {
          // daily
          this.createDailyNotification(body, req, res)
        } else if (body.day || body.day === 0) {
          if (body.notificationSchedule === 3) {
            this.createWeeklyNotification(body, req, res)
          } else if (body.notificationSchedule === 4) {
            this.createMonthlyNotification(body, req, res)
          } else {
            return res.status(422).json({
              success: false,
              msg: "Wrong value is provided",
            });
          }
          // notificationSchedule 3 weekly 4 monthly
          // weekly and monthly
        }
        else {
          return res.status(422).json({
            success: false,
            msg: "Following field is missing :-  day",
          });
        }
      }
    } catch (error) {
      return res.error(error);
    }
  }
  async createDailyNotification(body, req, res) {
    try {
      body.effectiveFrom = `${body.activeFrom.split(" ")[0]} ${body.notificationTime}:00 ${body.timeZone}`;
      body.effectiveTo = `${body.activeTo.split(" ")[0]} ${body.notificationTime}:00 ${body.timeZone}`;
      let date = new Date(body.effectiveFrom);
      body.createdBy = req.user._id;
      let notification = await ManageNotificationRepo.create(body);
      const notifcationIdUpdate = notification._id;
      notification = JSON.parse(JSON.stringify(notification))
      // notification.companyName = req.company.name;
      notification.moduleType = "pushNotification";
      notification = this.deleteUnwantedData(notification);
      // const notification = await new Notification(body).save();
      let actualStart;
      let actualEnd;
      let i = 0;
      if (body.isPublish) {
        while (date.getTime() <= new Date(body.effectiveTo).getTime()) {
          if (date.getTime() >= new Date().getTime() && date.getTime() >= new Date(body.effectiveFrom).getTime()) {
            // const job = agenda.createJob('ad-hoc', date, notification, 1);
            if (i === 0) {
              actualStart = new Date(date);
            }
            actualEnd = new Date(date);
            i++;
            const job = await Agenda.createJob('ad-hoc', date, notification)
          }
          date.setDate(date.getDate() + 1)

        }
        if (actualStart) {
          let updateField = {
            actualStart, actualEnd
          }
          let notificationUpdate = await ManageNotificationRepo.updateField(notifcationIdUpdate, updateField);
        }
        return res.status(201).json({ success: true, msg: "Daily notification is created successfully", data: notification })
      } else {
        return res.status(201).json({ success: true, msg: "Daily notification is created successfully as a draft", data: notification })
      }
    } catch (e) {
      return res.status(201).json({ success: true, msg: "Daily notification is not created successfully" })
    }

  }
  async createWeeklyNotification(body, req, res) {
    try {
      body.effectiveFrom = `${body.activeFrom.split(" ")[0]} ${body.notificationTime}:00 ${body.timeZone}`;
      body.effectiveTo = `${body.activeTo.split(" ")[0]} ${body.notificationTime}:00 ${body.timeZone}`;
      const dateFrom = new Date(body.effectiveFrom);
      const dateTo = new Date(body.effectiveTo);
      const dayFrom = dateFrom.getDay();
      const dayToAdd = body.day - dayFrom;
      let date = dateFrom;
      date = new Date(date.setDate(dateFrom.getDate() + dayToAdd));
      //monday  =1
      //friday =5
      //5-1 = 4
      if (date.getTime() > dateTo.getTime()) {
        return res.json({ success: false, msg: "There is not possible any schedule" })
      }
      body.createdBy = req.user._id;
      let notification = await ManageNotificationRepo.create(body);
      const notifcationIdUpdate = notification._id;
      notification = JSON.parse(JSON.stringify(notification))
      // notification.companyName = req.company.name;
      notification.moduleType = "pushNotification";
      notification = this.deleteUnwantedData(notification);
      if (!body.isPublish) {
        return res.status(201).json({ success: true, msg: "Weekly notification is created successfully as draft", data: notification })
      }
      let actualStart;
      let actualEnd;
      let i = 0;
      while (date.getTime() <= dateTo.getTime()) {
        console.log("date", date)
        if (date.getTime() >= new Date().getTime() && date.getTime() >= new Date(body.effectiveFrom).getTime()) {
          // const job = agenda.createJob('ad-hoc', date, notification, 1);
          if (i === 0) {
            actualStart = new Date(date);
          }
          actualEnd = new Date(date);
          i++;
          const job = await Agenda.createJob('ad-hoc', date, notification)
        }
        date = new Date(date.setDate(date.getDate() + 7))
      }
      if (actualStart) {
        let updateField = {
          actualStart, actualEnd
        }
        let notificationUpdate = await ManageNotificationRepo.updateField(notifcationIdUpdate, updateField);
      }
      return res.status(201).json({ success: true, msg: "Weekly notification created successfully", data: notification })
    } catch (e) {
      return res.status(201).json({ success: false, msg: "Weekly notification is not created successfully" })
    }
  }
  async createMonthlyNotification(body, req, res) {
    try {
      body.effectiveFrom = `${body.activeFrom.split(" ")[0]} ${body.notificationTime}:00 ${body.timeZone}`;
      body.effectiveTo = `${body.activeTo.split(" ")[0]} ${body.notificationTime}:00 ${body.timeZone}`;
      const dateFrom = new Date(body.effectiveFrom);
      const dateTo = new Date(body.effectiveTo);
      let date = dateFrom;
      date = new Date(date.setDate(1));
      // date = new Date(date.setMonth(date.getMonth() + 1));
      const dayD = new Date(date).getDay();
      console.log(dayD);
      const addD = (body.day + 7 - dayD) % 7
      date = new Date(date.setDate(date.getDate() + addD));
      console.log("date monthly first", date);
      if (date.getTime() > dateTo.getTime()) {
        return res.json({ success: false, msg: "There is not possible any scheudle" })
      }
      // const notification = await new Notification(body).save();
      body.createdBy = req.user._id;
      let notification = await ManageNotificationRepo.create(body);
      const notifcationIdUpdate = notification._id;
      notification = JSON.parse(JSON.stringify(notification))
      // notification.companyName = req.company.name;
      notification.moduleType = "pushNotification";
      notification = this.deleteUnwantedData(notification);
      if (!body.isPublish) {
        return res.status(201).json({ success: true, msg: "Monthly notification is created successfully as a draft", data: notification })
      }
      let actualStart;
      let actualEnd;
      let i = 0;
      while (date.getTime() <= dateTo.getTime()) {
        if (date.getTime() >= new Date().getTime() && date.getTime() >= new Date(body.effectiveFrom).getTime()) {
          // const job = agenda.createJob('ad-hoc', date, notification, 1);
          if (i === 0) {
            actualStart = new Date(date);
          }
          actualEnd = new Date(date);
          i++;
          const job = await Agenda.createJob('ad-hoc', date, notification)
        }
        date = new Date(date.setMonth(date.getMonth() + 1));
        date = new Date(date.setDate(1));
        const day = new Date(date).getDay();
        const add = (body.day + 7 - day) % 7
        date = new Date(date.setDate(date.getDate() + add));

      }
      if (actualStart) {
        let updateField = {
          actualStart, actualEnd
        }
        let notificationUpdateData = await ManageNotificationRepo.updateField(notifcationIdUpdate, updateField);
      }
      return res.status(201).json({ success: true, msg: "Monthly notification is created successfully", data: notification })
    } catch (e) {
      return res.status(201).json({ success: false, msg: "Monthly notification is not created successfully" })
    }
  }
  async getScheduleNotification(req, res) {
    try {
      const body = req.body;
      // const pageNumber = body.draw ? body.pageNo - 1 : 0;
      let { sortBy, sortWith, page, limit, search } = req.query;
      const pageNum = !!page ? parseInt(page) : 0;
      limit = !!limit ? parseInt(limit) : 10;
      const skip = (pageNum - 1) * limit;
      let sortObj = {
        [sortWith]: sortBy === 'desc' ? -1 : 1
      }
      let where = { notificationType: 2 };
      // -1 means dec
      
      if (search) {
        where.title = { $regex: search, $options: 'i' }
      }
      where.businessUnitId = body.buId;
      const allData = await Promise.all([this.getAllScheduleData(where, req), this.getScheduleData(skip, limit, sortObj, where, req)]);
      let notificationData = allData[1]
      const len = notificationData.length;
      if (notificationData.length > 0) {
        notificationData = JSON.parse(JSON.stringify(notificationData))
        for (let i = 0; i < len; i++) {
          const item = notificationData[i];
          const currentTime = new Date().getTime();
          let status = "Expired"
          if (!item.isPublish) {
            status = "Draft";
          } else if (item.notificationStatus === 4) {
            status = "Inactive";
          } else if (new Date(item.actualStart).getTime() > currentTime) {
            status = "Pending"
          } else if (new Date(item.actualEnd).getTime() > currentTime && currentTime > new Date(item.actualStart).getTime()) {
            status = "Active"
          }
          notificationData[i].notificationStatus = status;
          let scheduleType = "Daily"
          let When = item.notificationTime;
          if (item.notificationSchedule === 3) {
            scheduleType = 'Weekly'
            When = `${dayArr[item.day]}, ${item.notificationTime}`
          } else if (item.notificationSchedule === 4) {
            scheduleType = 'Monthly'
            When = `${dayArr[item.day]}, ${item.notificationTime}`
          }
          notificationData[i].scheduleType = `${scheduleType} [${When}]`
          notificationData[i].createdBy = item.createdBy ? item.createdBy.name : '';
          notificationData[i].activeFrom = moment(new Date(item.activeFrom)).utcOffset(body.timeZone).format("DD-MM-YYYY");
          notificationData[i].activeTo = moment(new Date(item.activeTo)).utcOffset(body.timeZone).format("DD-MM-YYYY");
        }
        return res.json({ success: true, msg: "Notification Data found", data: notificationData, totalRecords: allData[0] })
      } else {
        return res.json({ success: false, msg: "No notification found", data: [], totalRecords: 0 })
      }
    } catch (e) {
      logError('getScheduleNotification error', e.stack)
      return res.json({
        success: false,
        msg: "Something went wrong"
      })
    }

  }
  async getScheduleData(skip, limit, sortObj, where, req) {
    return new Promise(async (resolve, reject) => {
      try {
        const requiredData = { actualEnd: 1, actualStart: 1, isPublish: 1, title: 1, _id: 1, notificationSchedule: 1, activeFrom: 1, activeTo: 1, effectiveFrom: 1, effectiveTo: 1, createdBy: 1, notificationDay: 1, notificationTime: 1, day: 1, notificationStatus: 1 }
        let notificationData = await ManageNotificationRepo.getAll(where, requiredData, sortObj, skip, limit);
        // let notificationData = await Notification.find(where, { isPublish: 1, title: 1, _id: 1, notificationSchedule: 1, activeFrom: 1, activeTo: 1, effectiveFrom: 1, effectiveTo: 1, createdBy: 1, notificationDay: 1, notificationTime: 1, day: 1 })
        //     .sort(sortObj).skip(skip)
        //     .limit(limit);
        resolve(notificationData);
      } catch (e) {
        reject([])
      }
    });
  }
  async getAllScheduleData(where, req) {
    return new Promise(async (resolve, reject) => {
      try {
        let notificationData = await ManageNotificationRepo.count(where);
        resolve(notificationData);
      } catch (e) {
        reject([])
      }
    });
  }
  async getPushNotification(req, res) {
    // find, sort, limit and skip
    try {
      const body = req.body;
      let { sortBy, sortWith, page, limit, search } = req.query;
      const pageNum = !!page ? parseInt(page) : 0;
      limit = !!limit ? parseInt(limit) : 10;
      const skip = (pageNum - 1) * limit;
      let sortObj = {
        [sortWith]: sortBy === 'desc' ? -1 : 1
      }
      let where = {
        $or: [
          { 'data.notificationType': 1 }, { lastFinishedAt: { $ne: null } }
        ]
      }
      if (search) {
        where['data.title'] = { $regex: search, $options: 'i' }
      }
      where['data.businessUnitId'] = body.buId;
      const data = await Promise.all([this.getAllPushData(where, req), this.getPushData(skip, limit, sortObj, where, req)]);
      const notificationData = data[1];
      const count = notificationData.length;
      const finalData = [];
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const item = notificationData[i].data;
          let obj = {
            _id: item._id,
            title: item.title,
            pushedDate: this.getPushDate(notificationData[i], item, body.timeZone),
            pushedDateOld: notificationData[i].lastFinishedAt ? new Date(notificationData[i].lastFinishedAt) : new Date(notificationData[i].nextRunAt),
            pushTime: this.getPushTime(notificationData[i], item, body.timeZone),//moment(new Date(notificationData[i].lastFinishedAt)).utcOffset(body.timeZone).format("HH:mm"),
            type: '',
            notificationCount: notificationData[i].totalSent ? notificationData[i].totalSent : 0,
            createdBy: item.createdBy ? item.createdBy.name : '',
            status: "",
            lastFinishedAt: notificationData[i].lastFinishedAt,
            isPublish: item.isPublish
          }
          if (item.notificationType === 1) {
            obj.type = "Ad-hoc";
            if (item.notificationStatus === 3) {
              obj.status = "Cancelled";
              finalData.push(obj);
              continue;
            }
            if (obj.lastFinishedAt) {
              obj.status = "Completed";
            } else {
              obj.status = "Pending"
            }
            if (!obj.isPublish) {
              obj.status = "Draft"
            }
            finalData.push(obj);
          } else {
            obj.type = "Scheduled";
            if (item.notificationStatus === 3) {
              obj.status = "Cancelled";
              continue;
            } else {
              obj.status = "Completed";
            }
            finalData.push(obj);
          }
        }
        return res.json({ success: true, totalRecords: data[0], data: finalData })
      } else {

        return res.json({ success: false, msg: "No data present", totalRecords: 0, data: [] })
      }
    } catch (e) {
      logError('manageNotificationController::getPushNotification', e);
      logError('manageNotificationController::getPushNotification e', e.stack);
      return res.json({ success: false, msg: "Something went wrong", totalRecords: 0, data: [] })
    }
  }
  async getPushData(skip, limit, sortObj, where, req) {
    return new Promise(async (resolve, reject) => {
      try {
        const requiredData = {
          'data.businessUnitId': 1, 'data.title': 1, 'data.day': 1, 'data.notificationType': 1, 'data.activeFrom': 1, 'data.effectiveTo': 1, 'data.activeTo': 1,
          'data.effectiveFrom': 1, "data._id": 1, "data.isPublish": 1, 'data.createdBy': 1, 'data.notificationStatus': 1, lastFinishedAt: 1, nextRunAt: 1, totalSent: 1
        }
        let notificationData = await NotificationCronRepo.getAll(skip, limit, sortObj, where, requiredData);
        // let notificationData = await NotificationCron.find(where,).sort(sortObj).skip(skip).limit(limit);
        resolve(notificationData);
      } catch (e) {
        reject([])
      }
    });
  }
  async getAllPushData(where, req) {
    return new Promise(async (resolve, reject) => {
      try {
        let notificationData = await NotificationCronRepo.count(where);
        resolve(notificationData);
      } catch (e) {
        reject([])
      }
    });
  }
  getPushDate(notificationData, item, timeZone) {
    // console.log("noti", notificationData, item)
    if (notificationData.lastFinishedAt) {
      return moment(new Date(notificationData.lastFinishedAt)).utcOffset(timeZone).format("DD-MM-YYYY")
    } else if (notificationData.nextRunAt) {
      return moment(new Date(notificationData.nextRunAt)).utcOffset(timeZone).format("DD-MM-YYYY");
    } else {
      console.log("immama", item.title)
      return moment(new Date(item.effectiveFrom)).utcOffset(timeZone).format("DD-MM-YYYY");
    }
  }
  getPushTime(notificationData, item, timeZone) {
    // console.log("noti", notificationData, item)
    if (notificationData.lastFinishedAt) {
      return moment(new Date(notificationData.lastFinishedAt)).utcOffset(timeZone).format("HH:mm")
    } else if (notificationData.nextRunAt) {
      return moment(new Date(notificationData.nextRunAt)).utcOffset(timeZone).format("HH:mm");
    } else {
      return moment(new Date(item.effectiveFrom)).utcOffset(timeZone).format("HH:mm");
    }
  }
  async getSingle(req, res) {
    try {
      const id = req.params.id;
      let data = await ManageNotificationRepo.getSingle({ _id: id });
      if (data) {
        data = JSON.parse(JSON.stringify(data))
        const currentTime = new Date().getTime();
        let status = data.notificationType === 2 ? "Expired" : "Completed";
        if (new Date(data.actualStart).getTime() > currentTime) {
          status = "Pending"
        } else if (new Date(data.actualEnd).getTime() > currentTime && currentTime > new Date(data.actualStart).getTime()) {
          status = "Active"
        }
        if (!data.isPublish) {
          status = "Draft";
        }
        if (data.notificationStatus === 4) {
          status = data.notificationType === 2 ? "Inactive" : "Cancelled";
        }
        data.notificationStatus = status;
        // return res.json({ data })
        let assignUsers = []
        // let company = req.company.name;
        data.assignUsers.forEach(e => {
          let BU = [];
          e.businessUnits.forEach(k => {
            let _id = k._id
            let subsection = k.orgName
            // let section = k.sectionId.name
            // let department = k.sectionId.departmentId.name
            // let company = k.sectionId.departmentId.companyName;
            let businessUnit = subsection;

            let obj = {
              _id: _id,
              name: businessUnit
            }
            BU.push(obj)
          })
          if (e.allBuToken) {
            BU.push({ _id: "All Business Unit", name: "All Business Unit" })
          }
          let appointments = e.appointments
          let user = e.user
          let admin = e.admin
          let customField = e.customField
          let buFilterType = e.buFilterType
          let subSkillSets = e.subSkillSets
          let allBuToken = e.allBuToken
          let allBuTokenStaffId = e.allBuTokenStaffId

          let obj1 = {
            businessUnits: BU,
            buFilterType: buFilterType,
            appointments: appointments,
            subSkillSets: subSkillSets,
            user: user,
            admin: admin,
            allBuToken: allBuToken,
            allBuTokenStaffId: allBuTokenStaffId,
            customField: customField
          }
          assignUsers.push(obj1)
        });
        data.assignUsers = assignUsers
        return res.json({ success: true, data: data, msg: "Data found" })
      } else {
        return res.json({ success: false, data: {}, msg: "Data not found" })
      }
    } catch (e) {
      console.log('e', e);
      return res.json({
        success: false,
        msg: "Something went wrong"
      })
    }
  }
  async cancelled(req, res) {
    try {
      const body = req.body;
      // const noti = await Notification.findOne({ _id: body.id });
      let noti = await ManageNotificationRepo.getSingle({ _id: body.id });
      if (noti) {
        if (new Date(noti.effectiveTo).getTime() < new Date().getTime()) {
          const text = noti.notificationType == 1 ? 'cancelled' : 'deactivated';
          return res.json({ success: false, msg: `Notification can not be ${text} as it is already expired` });
        } else if (noti.notificationStatus === 3 || noti.notificationStatus === 4) {
          const text = noti.notificationType == 1 ? 'cancelled' : 'deactivated';
          return res.json({ success: false, msg: `Notification is already ${text}` });
        }
        let notificationStatus = 3;
        if (noti.notificationType == 2) {
          notificationStatus = 4;
          const notiLog = await this.deleteNextSchedule(noti._id, req)
        } else {
          const notiLog = await this.updateadhocSchedule(noti._id, noti.notificationStatus)
        }
        await ManageNotificationRepo.cancelled(noti._id, notificationStatus)
        return res.json({ success: true, msg: "Cancelled Successfully" });
      } else {
        return res.json({ success: false, msg: "Not found" });
      }
    } catch (e) {
      return res.json({
        success: false,
        msg: "Something went wrong"
      })
    }

  }
  async deleteNextSchedule(id, req, from) {
    if (from === "adhoc") {
      let notificationData = await NotificationCronRepo.deleteMany({ "data._id": id });
      return notificationData;
    } else {
      // const notiLog = await NotificationCron.deleteMany({ "data._id": id, nextRunAt: { $ne: null } });
      // return notiLog;
      let notificationData = await NotificationCronRepo.deleteMany({ "data._id": id, nextRunAt: { $ne: null } });
      return notificationData;
    }
  }
  async updateadhocSchedule(id, notificationStatus) {
    if(notificationStatus === 0){
      let notiLog = await NotificationCronRepo.update({ "data._id": id }, { "data.notificationStatus": 3 });
      return notiLog;
    }
    let notiLog = await NotificationCronRepo.update({ "data._id": id, nextRunAt: { $ne: null } }, { nextRunAt: null, "data.notificationStatus": 3 });
    return notiLog;
  }
  async updateNotification(req, res) {
    try {
      const body = req.body;

      body.updatedBy = req.user._id;
      // ad-hoc notification 
      if (body.notificationType === 1) {
        this.updateAdHocNotification(body, req, res)
      } else {
        if (!body.activeTo) {
          return res.status(422).json({
            success: false,
            msg: "Following field is missing :-  activeTo",
          });
        }
        if (body.notificationSchedule === 2) {
          // daily
          this.updateDailyNotification(body, req, res)
        } else if (body.day || body.day === 0) {
          if (body.notificationSchedule === 3) {
            this.updateWeeklyNotification(body, req, res)
          } else if (body.notificationSchedule === 4) {
            this.updateMonthlyNotification(body, req, res)
          } else {
            return res.status(422).json({
              success: false,
              msg: "Wrong value is provided",
            });
          }
          // notificationSchedule 3 weekly 4 monthly
          // weekly and monthly
        } else {
          return res.status(422).json({
            success: false,
            msg: "Following field is missing :-  day",
          });
        }
      }
    } catch (e) {
      return res.json({
        success: false,
        msg: "Something went wrong"
      })
    }
  }
  async updateAdHocNotification(body, req, res) {
    try {
      // const updateNotificationData = await Notification.findOne({ _id: body._id, notificationSchedule: 1 });
      let updateNotificationData = await ManageNotificationRepo.getSingle({ _id: body._id, notificationSchedule: 1 });
      if (!updateNotificationData) {
        return res.status(201).json({ success: false, msg: "Ad-Hoc notification is not found" })
      }
      if (updateNotificationData.isPublish && !body.isPublish) {
        return res.status(201).json({ success: false, msg: "Ad-Hoc is alreday publish so can not update it as draft" })
      }
      if (new Date(updateNotificationData.effectiveFrom).getTime() < new Date().getTime()) {
        return res.status(201).json({ success: false, msg: "Ad-Hoc notification is expired" })
      }
      console.log("hehehe")
      body.effectiveFrom = `${body.activeFrom.split(" ")[0]} ${body.notificationTime}:00 ${body.timeZone}`;
      body.effectiveTo = body.effectiveFrom;
      // add createdby
      const date = new Date(body.effectiveFrom);
      if (date.getTime() < new Date().getTime()) {
        return res.json({ success: false, msg: "You can not update notification with past date and time" });
      }
      const updateId = body._id;
      delete body._id;
      let notification = await ManageNotificationRepo.updateOne(updateId, body);
      // const notification = await Notification.findOneAndUpdate({ _id: updateId }, body, { new: true })
      if (notification) {
        const deleted = await this.deleteNextSchedule(updateId, req, 'adhoc');
        notification = JSON.parse(JSON.stringify(notification))
        // notification.companyName = req.company.name;
        notification.moduleType = "pushNotification";
        notification = this.deleteUnwantedData(notification);
        console.log("notification", notification)
        // const job = await agenda.createJob('ad-hoc', date, notification, 1)
        const job = await Agenda.createJob('ad-hoc', date, notification)
        if (!body.isPublish) {
          let notificationCron = await NotificationCronRepo.update({ "data._id": notification._id }, { nextRunAt: null });
          // const updateCron = await NotificationCron.findOneAndUpdate({ "data._id": notification._id }, { nextRunAt: null })
        }

        return res.status(201).json({ success: true, msg: `Ad-Hoc notification is updated successfully ${!notification.isPublish ? "as draft" : ""}`, data: notification })
      } else {
        return res.status(201).json({ success: false, msg: "Ad-Hoc is notification not found" })
      }

    } catch (e) {
      return res.status(201).json({ success: false, msg: "Ad-Hoc notification is not updated successfully", e })
    }

  }
  async updateDailyNotification(body, req, res) {
    // const updateNotificationData = await Notification.findOne({ _id: body._id, notificationSchedule: 2 });
    try {
      let updateNotificationData = await ManageNotificationRepo.getSingle({ _id: body._id, notificationSchedule: 2 });
      if (!updateNotificationData) {
        return res.status(201).json({ success: false, msg: "Daily notification is not found" })
      }
      if (updateNotificationData.isPublish && !body.isPublish) {
        return res.status(201).json({ success: false, msg: "Daily notification is alreday publish so can not update it as draft" })
      }
      if (new Date(updateNotificationData.effectiveTo).getTime() < new Date().getTime()) {
        return res.status(201).json({ success: false, msg: "Daily notification is expired" })
      }
      body.effectiveFrom = `${body.activeFrom.split(" ")[0]} ${body.notificationTime}:00 ${body.timeZone}`;
      body.effectiveTo = `${body.activeTo.split(" ")[0]} ${body.notificationTime}:00 ${body.timeZone}`;
      let date = new Date(body.effectiveFrom);
      const updateId = body._id;
      delete body._id;
      let notification = await ManageNotificationRepo.updateOne(updateId, body);
      // const notification = await Notification.findOneAndUpdate({ _id: updateId }, body, { new: true })
      if (!body.isPublish) {
        return res.status(201).json({ success: true, msg: "Daily notification updated successfully as draft", data: notification })
      }
      if (notification) {
        notification = JSON.parse(JSON.stringify(notification))
        // notification.companyName = req.company.name;
        notification.moduleType = "pushNotification";
        notification = this.deleteUnwantedData(notification);
        const deleted = await this.deleteNextSchedule(updateId, req);
        let actualStart;
        let actualEnd;
        let i = 0;
        while (date.getTime() <= new Date(body.effectiveTo).getTime()) {
          if (date.getTime() >= new Date().getTime()) {
            if (i === 0) {
              console.log("Here once")
              if (new Date(updateNotificationData.actualStart).getTime() > new Date(date)) {
                actualStart = new Date(date);
              }
            }
            actualEnd = new Date(date);
            i++;
            // const job = agenda.createJob('ad-hoc', date, notification, 1);
            const job = await Agenda.createJob('ad-hoc', date, notification)
          }
          date.setDate(date.getDate() + 1)
        }
        if (actualStart) {
          let updateField = {
            actualStart, actualEnd
          }
          let notificationUpdate = await ManageNotificationRepo.updateField(updateId, updateField);
        }
        if (body.isSend) {
          const sendNotificationD = await ManageNotificationRepo.sendImmediateNotification(updateId, true)
        }
        return res.status(201).json({ success: true, msg: "Daily notification is updated successfully", data: notification })
      } else {
        return res.status(201).json({ success: false, msg: "Daily notification is not found" })
      }
    } catch (e) {
      return res.status(201).json({ e, success: false, msg: "Daily notification is not updated successfully" })
    }
  }
  async updateWeeklyNotification(body, req, res) {
    try {
      // const updateNotificationData = await Notification.findOne({ _id: body._id, notificationSchedule: 3 });
      let updateNotificationData = await ManageNotificationRepo.getSingle({ _id: body._id, notificationSchedule: 3 });
      if (!updateNotificationData) {
        return res.status(201).json({ success: false, msg: "Weekly notification is not found" })
      }
      if (updateNotificationData.isPublish && !body.isPublish) {
        return res.status(201).json({ success: false, msg: "Weekly notification is alreday publish so can not update it as draft" })
      }
      if (new Date(updateNotificationData.effectiveTo).getTime() < new Date().getTime()) {
        return res.status(201).json({ success: false, msg: "Weekly notification is expired" })
      }
      body.effectiveFrom = `${body.activeFrom.split(" ")[0]} ${body.notificationTime}:00 ${body.timeZone}`;
      body.effectiveTo = `${body.activeTo.split(" ")[0]} ${body.notificationTime}:00 ${body.timeZone}`;
      const dateFrom = new Date(body.effectiveFrom);
      const dateTo = new Date(body.effectiveTo);
      const dayFrom = dateFrom.getDay();
      const dayToAdd = body.day - dayFrom;
      let date = dateFrom;
      date = new Date(date.setDate(dateFrom.getDate() + dayToAdd));
      //monday  =1
      //friday =5
      //5-1 = 4
      if (date.getTime() > dateTo.getTime()) {
        return res.json({ success: false, msg: "There is not possible any scheudle" })
      }
      const updateId = body._id;
      delete body._id;
      let notification = await ManageNotificationRepo.updateOne(updateId, body);
      // const notification = await Notification.findOneAndUpdate({ _id: updateId }, body, { new: true })
      if (!notification.isPublish) {
        return res.status(201).json({ success: true, msg: "Weekly notification is updated successfully as a draft", data: notification })
      }
      if (notification) {
        notification = JSON.parse(JSON.stringify(notification))
        // notification.companyName = req.company.name;
        notification.moduleType = "pushNotification";
        notification = this.deleteUnwantedData(notification);
        const deleted = await this.deleteNextSchedule(updateId, req);
        let actualStart;
        let actualEnd;
        let i = 0;
        while (date.getTime() <= dateTo.getTime()) {
          // console.log("date", date)
          if (date.getTime() >= new Date().getTime() && date.getTime() >= new Date(body.effectiveFrom).getTime()) {
            if (i === 0) {
              console.log("Here once")
              if (new Date(updateNotificationData.actualStart).getTime() > new Date(date)) {
                actualStart = new Date(date);
              }
            }
            actualEnd = new Date(date);
            i++;
            const job = await Agenda.createJob('ad-hoc', date, notification)
            // const job = agenda.createJob('ad-hoc', date, notification, 1);
          }
          date = new Date(date.setDate(date.getDate() + 7))
        }
        if (actualStart) {
          let updateField = {
            actualStart, actualEnd
          }
          let notificationUpdate = await ManageNotificationRepo.updateField(updateId, updateField);
        }
        if (body.isSend) {
          const sendNotificationD = await ManageNotificationRepo.sendImmediateNotification(updateId, true)
        }
        return res.status(201).json({ success: true, msg: "Weekly notification is updated successfully", data: notification })
      } else {
        return res.status(201).json({ success: false, msg: "Weekly notification is not found", data: notification })
      }
    } catch (e) {
      return res.status(201).json({ success: false, msg: "Weekly notification is not updated successfully" })
    }
  }
  async updateMonthlyNotification(body, req, res) {
    try {
      let updateNotificationData = await ManageNotificationRepo.getSingle({ _id: body._id, notificationSchedule: 4 });
      // const updateNotificationData = await Notification.findOne({ _id: body._id, notificationSchedule: 4 });
      if (!updateNotificationData) {
        return res.status(201).json({ success: false, msg: "Monthly notification is not found" })
      }
      if (updateNotificationData.isPublish && !body.isPublish) {
        return res.status(201).json({ success: false, msg: "Monthly notification is alreday publish so can not update it as draft" })
      }
      if (new Date(updateNotificationData.effectiveTo).getTime() < new Date().getTime()) {
        return res.status(201).json({ success: false, msg: "Monthly notification is expired" })
      }
      body.effectiveFrom = `${body.activeFrom.split(" ")[0]} ${body.notificationTime}:00 ${body.timeZone}`;
      body.effectiveTo = `${body.activeTo.split(" ")[0]} ${body.notificationTime}:00 ${body.timeZone}`;
      const dateFrom = new Date(body.effectiveFrom);
      const dateTo = new Date(body.effectiveTo);
      let date = dateFrom;
      date = new Date(date.setDate(1));
      // date = new Date(date.setMonth(date.getMonth() + 1));
      const dayD = new Date(date).getDay();
      console.log(dayD);
      const addD = (body.day + 7 - dayD) % 7
      date = new Date(date.setDate(date.getDate() + addD));
      if (date.getTime() > dateTo.getTime()) {
        return res.json({ success: false, msg: "There is not possible any scheudle" })
      }
      const updateId = body._id;
      delete body._id;
      let notification = await ManageNotificationRepo.updateOne(updateId, body);
      // const notification = await Notification.findOneAndUpdate({ _id: updateId }, body, { new: true });
      if (!notification.isPublish) {
        return res.status(201).json({ success: true, msg: "Monthly notification is updated successfully as a draft", data: notification })
      }
      if (notification) {
        notification = JSON.parse(JSON.stringify(notification))
        // notification.companyName = req.company.name;
        notification.moduleType = "pushNotification";
        notification = this.deleteUnwantedData(notification);
        const deleted = await this.deleteNextSchedule(updateId, req);
        let actualStart;
        let actualEnd;
        let i = 0;
        while (date.getTime() <= dateTo.getTime()) {
          if (date.getTime() >= new Date().getTime() && date.getTime() >= new Date(body.effectiveFrom).getTime()) {
            if (i === 0) {
              if (new Date(updateNotificationData.actualStart).getTime() > new Date(date)) {
                actualStart = new Date(date);
              }
            }
            actualEnd = new Date(date);
            i++;
            const job = await Agenda.createJob('ad-hoc', date, notification)
            // const job = agenda.createJob('ad-hoc', date, notification, 1);
          }
          date = new Date(date.setMonth(date.getMonth() + 1));
          date = new Date(date.setDate(1));
          const day = new Date(date).getDay();
          const add = (body.day + 7 - day) % 7
          date = new Date(date.setDate(date.getDate() + add));

        }
        if (actualStart) {
          let updateField = {
            actualStart, actualEnd
          }
          let notificationUpdate = await ManageNotificationRepo.updateField(updateId, updateField);
        }
        if (body.isSend) {
          const sendNotificationD = await ManageNotificationRepo.sendImmediateNotification(updateId, true)
        }
        return res.status(201).json({ success: true, msg: "Monthly notification is updated successfully", data: notification })
      } else {
        return res.status(201).json({ success: false, msg: "Monthly notification is not found", data: notification })
      }
    } catch (e) {
      return res.status(201).json({ success: false, msg: "Monthly notification is not updated successfully" })
    }

  }

}

ManageNotification = new ManageNotification();
module.exports = ManageNotification;