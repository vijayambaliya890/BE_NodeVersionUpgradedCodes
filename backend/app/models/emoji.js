const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const AppointmentSchema = new Schema({
    name: {
        type: String,
        default: ''
    },
    emoji: {
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
    },
    assignedTo: [{
        type: Schema.Types.ObjectId,
        ref: 'Wall'
    }]


}, {
        timestamps: true
    });
module.exports = mongoose.model('Emoji', AppointmentSchema);