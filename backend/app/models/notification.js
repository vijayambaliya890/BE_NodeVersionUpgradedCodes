const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const NotificationSchema = new Schema({
    title: {
        type: String,
        default: ''
    },
    subTitle: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        default: ''
    },
    effectiveFrom: {
        type: Date,
        default: ''
    },
    effectiveTo: {
        type: Date,
        default: ''
    },
    activeFrom: {
        type: Date
    },
    activeTo: {
        type: Date
    },
    businessUnitId: {
        type: Schema.Types.ObjectId,
        ref: 'SubSection'
    },
    subCategoryId: {
        type: Schema.Types.ObjectId,
        ref: 'SubCategory'
    },
    notificationAttachment: {
        type: String,
        default: ''
    },
    isDynamic: {
        type: Number,
        default: 0
    },
    // notifyByBusinessUnits: [{
    //     type: Schema.Types.ObjectId,
    //     ref: 'SubSection'
    // }],
    // notifyBySubSkillSets: [{
    //     type: Schema.Types.ObjectId,
    //     ref: 'SubSkillSet'
    // }],
    // notifyByAppointments: [{
    //     type: Schema.Types.ObjectId,
    //     ref: 'Appointment'
    // }],
    // notifyByUsers: [{
    //     type: Schema.Types.ObjectId,
    //     ref: 'User'
    // }],
    assignUsers: [{
        businessUnits: [{
            type: Schema.Types.ObjectId,
            ref: "SubSection"
        }],
        buFilterType: {
            type: Number,
            default: 1 //1.alluser 2.includeUser 3.excludeUser
        },
        appointments: [{
            type: Schema.Types.ObjectId,
            ref: "Appointment"
        }],
        subSkillSets: [{
            type: Schema.Types.ObjectId,
            ref: "SubSkillSet"
        }],
        user: [{
            type: Schema.Types.ObjectId,
            ref: "User"
        }],
        allBuToken: {
          type: Boolean,
          default: false
        },
        allBuTokenStaffId: {
            type: String,
            default: ""
        },
        customField: []
    }],
    notifyOverAllUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    notifyAcknowledgedUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    notifyUnreadUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    userAcknowledgedAt: [{
        type: Date
    }],
    isSent: {
        type: Number,
        default: 0
    },
    viewOnly: {
        type: Boolean,
        default: false
    },
    // user
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    // Module
    moduleIncluded: {
        type: Boolean,
        default: false
    },
    moduleId: {
        type: Schema.Types.ObjectId,
        ref: 'BuilderModule'
    },
    lastNotified: {
        type: Date,
        default: Date.now
    },
    status: {
        type: Number,
        default: 0
    },
    notificationType: {
        type: Number // 1 adhoc 2 schedule
      },
      notificationTime: {
        type: String
      },
      timeZone: {
        type: String
      },
      isPublish: {
        type: Boolean,
        default: false // false means draft true means is publish
      },
      notificationStatus: {
        type: Number,
        default: 0 // 0 draft 1 pending(publish) 2 complete 3 cancelled  4 inactive
      },
      notificationSchedule: {
        type: Number,
        default: 1 // 1 ad-hoc 2 daily 3 weekly 4 monthly
      },
      day: {
        type: Number
      },
      isScheduleNotification: {
        type: Boolean,
        default: false
      },
      actualEnd: {
        type: Date,
      },
      actualStart: {
        type: Date,
      }
}, {
    timestamps: true,
    autoIndex: true
});
NotificationSchema.index({businessUnitId:1});

module.exports = mongoose.model('Notification', NotificationSchema);