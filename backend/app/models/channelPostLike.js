const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const PostLikeSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    postId: {
        type: Schema.Types.ObjectId,
        ref: 'WallPost'
    },
    channelId: {
        type: Schema.Types.ObjectId,
        ref: 'Channel'
    },
    isLiked: {
        type: Boolean,
        default: false
    },
    status: {
        type: Number,
        default: 0 //1.active
    },
}, {
    timestamps: true
});

const PostLike = mongoose.model('ChannelPostLike', PostLikeSchema);

module.exports = PostLike;