const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const StaffLimitSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    shiftId: {
        type: Schema.Types.ObjectId,
        ref: 'Shift'
    },
    shiftDetailId: {
        type: Schema.Types.ObjectId,
        ref: 'ShiftDetails'
    },
    childShiftId:{
        type: Schema.Types.ObjectId,
        ref: 'ShiftDetails'
    },
    date:{
        type:Date
    },
    assignShiftId:{
        type: Schema.Types.ObjectId,
        ref: 'AssignShift'
    },
    isAssignShift:{
        type: Boolean,
        default: false
    },    
    normalDuration:{
        type: Number,
        default: 0
    },
    otDuration:{
        type: Number,
        default: 0  
    },
    weekNumber:{
        type:Number
    },
    totalBreakDuration:{
        type: Number,
        default: 0
    },
    businessUnitId:{
        type: Schema.Types.ObjectId,
        ref:"SubSection"
    },
    assignShiftId:{
        type: Schema.Types.ObjectId,
        ref:"AssignShift"
    }
}, {
    timestamps: true
});

const StaffLimit = mongoose.model('StaffLimit', StaffLimitSchema);

module.exports = StaffLimit;
