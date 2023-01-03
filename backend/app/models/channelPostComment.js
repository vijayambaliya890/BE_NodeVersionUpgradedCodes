const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const PostCommentSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    postId: {
        type: Schema.Types.ObjectId,
        ref: 'Post'
    },
    channelId: {
        type: Schema.Types.ObjectId,
        ref: 'Channel'
    },
    comment: {
        type: String,
        default: ""
    },
    attachment: {
        type: Object,
        default: {}
    },
    status: {
        type: Number,
        default: 0 //1.active 2.inActive
    },
    reportList: [{
        reportedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        reportedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

const PostComment = mongoose.model('ChannelPostComment', PostCommentSchema);

module.exports = PostComment;