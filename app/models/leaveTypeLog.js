const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const LeaveTypeLogSchema = new Schema({
    leaveTypeId : {
        type: Schema.Types.ObjectId,
        ref: 'LeaveType'
    },
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company'
    },
    change:{
        type: Object
    },
    updatedBy : {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    reason :{
        type: String
    }

}, {
        timestamps: true
    });
module.exports = mongoose.model('LeaveTypeLog', LeaveTypeLogSchema);