const mongoose = require('mongoose'),
  Schema = mongoose.Schema;


const SectionSchema = new Schema({
  name: {
    type: String,
    default: ''
  },
  departmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Department'
  },
  subSections: [{
    type: Schema.Types.ObjectId,
    ref: 'SubSection'
  }],
  status: {
    type: Number,
    default: 0
  },
}, {
  timestamps: true
});
module.exports = mongoose.model('Section', SectionSchema);