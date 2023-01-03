const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const OpsGroupSchema = new Schema({
    opsGroupName:{
      type: String,
      unique: true,
      required: true
    },
    userId: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    buId: [{
        type: Schema.Types.ObjectId,
        ref: 'SubSection'
    }],
    opsTeamId: [{
        type: Schema.Types.ObjectId,
        ref: 'opsTeam'
    }],
    removeOpsTeamId: [{
        teamId:{
        type: Schema.Types.ObjectId,
        ref: 'opsTeam'},
        deletedDateTime:{
            type: Date,
            value: Date.now()
        },
        userId:{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }

    }],
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    companyId: {
        type: Schema.Types.ObjectId
    },
    updatedBy:[{
        userId:{
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        dateTime:{
            type: Date,
            default: Date.now()
        }
    }],
    noOfTeam:{
        type:Number,
        default:0
    },
    swopSetup:{
      type: String,
      default:0 // 0 no swop // 1 swop at group level // 2 at team level;
    },
    adminId:[{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    isDelete:{
        type: Boolean,
        default: false
    },
    isDraft:{
        type: Boolean,
        default: false
    }
}, {
        timestamps: true
    });

module.exports = mongoose.model('OpsGroup', OpsGroupSchema);
