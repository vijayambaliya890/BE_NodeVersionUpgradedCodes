const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const QrCodeSchema = new Schema({
    qrCode: {
        type: String,
        default: ''
    },
    userId: {
        type: Schema.Types.ObjectId
    },
    shiftId: {
        type: Schema.Types.ObjectId
    },
    shiftDetailId: {
        type: Schema.Types.ObjectId
    },
    status: {
        type: Number,
        default: 1
    }
}, {
    timestamps: true
});

// Indexes
QrCodeSchema.index({ shiftDetailId: 1, userId: 1 });

module.exports = mongoose.model('QrCode', QrCodeSchema);
