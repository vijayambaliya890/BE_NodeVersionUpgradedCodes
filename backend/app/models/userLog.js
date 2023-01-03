const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const userLogSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    businessUnitId: {
        type: Schema.Types.ObjectId,
        ref: 'SubSection'
    },
    updatedBy:{
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    oldSchemeId:{
        type: Schema.Types.ObjectId,
        ref: 'Scheme'
    },
    type:{
        type: String // 1 scheme
    },
    newSchemeId:{
        type: Schema.Types.ObjectId,
        ref: 'Scheme'
    }
   
}, {
    timestamps: true
});
const UserLog = mongoose.model('UserLog', userLogSchema);

module.exports = UserLog;