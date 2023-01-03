const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const AppointmentSchema = new Schema({
    name: {
        type: String,
        default: ''
    },
    companyId: {
        type: Schema.Types.ObjectId,
        ref: "Company"
    },
    status: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});
module.exports = mongoose.model('Appointment', AppointmentSchema);