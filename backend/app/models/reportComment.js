const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const postSchema = new Schema({
    commentId: {
        type: Schema.Types.ObjectId,
        ref: 'PostComment'
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
        timestamps: true
    });
module.exports = mongoose.model('ReportComment', postSchema);