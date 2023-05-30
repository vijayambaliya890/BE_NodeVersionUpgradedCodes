const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const PostCategorySchema = new Schema({
    name: {
        type: String,
        default: ''
    },
    channelId: {
        type: String,
        ref: 'Channel'
    },
    status: {
        type: Number,
        default: 1
    }
}, {
    timestamps: true
});

// Indexes
PostCategorySchema.index({ channelId: 1 });

module.exports = mongoose.model('PostCategory', PostCategorySchema);