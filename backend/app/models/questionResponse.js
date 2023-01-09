const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const questionResponsechema = new Schema({
    questionId: {
        type: Schema.Types.ObjectId,
        ref: 'Question'
    },
    option: {
        type: Schema.Types.ObjectId
    },
    answer: {
        type: Schema.Types.Mixed
    },
    
    // Module Data
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    notificationId: {
        type: Schema.Types.ObjectId,
        ref: 'Notification'
    },
    wallPostId: {
        type: Schema.Types.ObjectId,
        ref: 'WallPost'
    },
    postId: {
        type: Schema.Types.ObjectId,
        ref: 'Post'
    },
    customFormId:{
        type:Schema.Types.ObjectId,
        ref:'Customform'
    },
    status: {
        type: Number,
        default: 1
    },
    
}, {
    timestamps: true
});

module.exports = mongoose.model('QuestionResponse', questionResponsechema);