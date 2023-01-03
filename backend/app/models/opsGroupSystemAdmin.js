const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const opsGroupSystemSchema = new Schema({

    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    userBuId: {
        type: Schema.Types.ObjectId,
        ref: 'SubSection'
    },
    buId: [{
        type: Schema.Types.ObjectId,
        ref: 'SubSection'
    }],
    createdBy:{
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    companyId:{
        type: Schema.Types.ObjectId,
        ref: 'Company'
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    hasAccess:{
        type:Number,
        default:0 //0 -create and edit , 1-view Only
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('OpsGroupSystem', opsGroupSystemSchema);
