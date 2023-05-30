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

// Indexes
postSchema.index({ userId: 1 });

module.exports = mongoose.model('ReportChannelPost', postSchema);