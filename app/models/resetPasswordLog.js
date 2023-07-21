const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const resetPasswordSchema = new Schema({
    staffId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    resetDate: {
        type: Date
    },
    resetUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }


}, {
        timestamps: true
    })

// Indexes
resetPasswordSchema.index({ resetUserId: 1 });

module.exports = mongoose.model('ResetPasswordLog', resetPasswordSchema);