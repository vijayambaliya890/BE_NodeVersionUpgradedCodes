const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

const SkillSetSchema = new Schema({
  name: {
    type: String,
    default: ''
  },
  subSkillSets: [{
    type: Schema.Types.ObjectId,
    ref: 'SubSkillSet'
  }],
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company'
  },
  businessUnitId: {
    type: Schema.Types.ObjectId,
    ref: 'SubSection'
  },
  status: {
    type: Number,
    default: 0
  }
}, {
    timestamps: true
  });
module.exports = mongoose.model('SkillSet', SkillSetSchema);