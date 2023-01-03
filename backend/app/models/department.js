const mongoose = require('mongoose'),
  Schema = mongoose.Schema;


const DepartmentSchema = new Schema({
  name: {
    type: String,
    default: ''
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
  },
  sections: [{
    type: Schema.Types.ObjectId,
    ref: 'Section'
  }],
  status: {
    type: Number,
    default: 0
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('Department', DepartmentSchema);