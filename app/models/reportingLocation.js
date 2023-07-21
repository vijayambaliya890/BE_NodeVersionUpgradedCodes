const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const ReportingLocationSchema = new Schema({
    name: {
        type: String,
        default: ''
    },
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company'
    },
    status: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes
ReportingLocationSchema.index({ companyId: 1 });
ReportingLocationSchema.index({ name: 'text', status: 1 });

const ReportingLocation = mongoose.model('ReportingLocation', ReportingLocationSchema);
module.exports = ReportingLocation
