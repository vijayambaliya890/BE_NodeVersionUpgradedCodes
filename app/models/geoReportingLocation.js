const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const GeoReportingLocationSchema = new Schema({
    name: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
}, {
    timestamps: true
});


const GeoReportingLocation = mongoose.model('geoReportingLocation', GeoReportingLocationSchema);
module.exports = GeoReportingLocation
