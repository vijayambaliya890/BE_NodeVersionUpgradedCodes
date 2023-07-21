const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

const MasterBUTableSchema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: "Company"
  },
  allActiveBusinessUnits: [],
  version: {
    type: Number,
    default: 0
  }
});
module.exports = mongoose.model('masterbutable', MasterBUTableSchema);