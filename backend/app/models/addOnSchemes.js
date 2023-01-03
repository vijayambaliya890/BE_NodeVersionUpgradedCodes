const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const AddOnSchema = new Schema({
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company'
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        // default: true
    },
    startDate: {
        type: Date,
    },
    endDate: {
        type: Date,
    },
    tiers: [{
        countType: {
            type: String
        },
        IncentiveValue: {
            type: Number
        }

    }],
    countType: {
        type: String,
        default: ''
    },
    shiftsubTypes: {
        type: String,
        default: ''
    },
    numberOfTiers: {
        type: Number,
        default: ''
    },
    recurringType: {
        type: String,
    },
    createdBy:{
        type: String,
    },



}, {
    timestamps: true
});
module.exports = mongoose.model('AddOnSchemes', AddOnSchema);