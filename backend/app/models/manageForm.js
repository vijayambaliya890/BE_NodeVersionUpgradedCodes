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
    staffName:{
        type:String,
        default:''
    },
    formStatus: [{
        fieldId: {  
            type:String
        },
         fieldStatusValueId: {  
            type: String            
        }
        
    }],
    workflowStatus: [{
        fieldId: {  
            type:String
        },
        fieldStatusId: {  
            type: String            
        }
        
    }],
    questionId:[{
        type:Schema.Types.ObjectId,
        ref:'QuestionResponse'
    }],
    questions:[{
        type:Schema.Types.ObjectId,
        ref:'Question'
    }],
    formId: {
        type: String,
        default: ""
    },
    userScore:{
        type:Number,
        default:0
    },
    totalScore:{
        type:Number,
        default:0
    }
},{
    timestamps: true
});
module.exports = mongoose.model('ManageForm', manageSchema);