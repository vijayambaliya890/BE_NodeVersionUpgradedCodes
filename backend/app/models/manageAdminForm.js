const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const manageSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    customFormId:{
       type:Schema.Types.ObjectId,
       ref:'Customform'
    },
    manageFormId:{
       type:Schema.Types.ObjectId,
       ref:'ManageForm'
    },
    workflowId:{
        type:String,
        default:''
    },
    moduleId:{
       type:Schema.Types.ObjectId,
       ref:'BuilderModule'
    },
    staffName:{
        type:String,
        default:''
    },
    questionId:[{
        type:Schema.Types.ObjectId,
        ref:'QuestionResponse'
    }],
    questions:[{
        type:Schema.Types.ObjectId,
        ref:'Question'
    }]
},{
    timestamps: true
});
module.exports = mongoose.model('ManageAdminForm', manageSchema);