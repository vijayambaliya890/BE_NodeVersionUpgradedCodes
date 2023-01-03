const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const EventSessionSchema = new Schema({
    eventId: {
        type: Schema.Types.ObjectId,
        ref: 'Post'
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    startTime: {
        type: Date
    },
    endTime: {
        type: Date
    },
    startTimeInSeconds : {
        type : Number
    },
    endTimeInSeconds : {
        type : Number
    },
    totalParticipantPerSession: {
        type: Number,
        default: 0
    },
    location:{
        type: String
    },
    totalConfirmedStaff:{
        type: Number,
        default: 0
    },
    RemainingStaff:{
        type: Number,
        default: 0
    },
    status: {
        type: Number,
        default: 0
    },
    assignAdmin: [{
        type: Schema.Types.ObjectId,
        ref: "AdminUser"
    }],
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    createdOn: {
        type: Date
    },
    updatedOn: {
        type: Date
    },
    status: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const Sessions = mongoose.model('EventSession', EventSessionSchema);

module.exports = Sessions;