const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const postSchema = new Schema({
    postId: {
        type: Schema.Types.ObjectId,
        ref: 'Post'
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }

}, {
    timestamps: true
});
module.exports = mongoose.model('ReportPost', postSchema);