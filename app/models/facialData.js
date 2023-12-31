const mongoose = require("mongoose"),
  bcrypt = require("bcrypt-nodejs"),
  Schema = mongoose.Schema;

const FacialDataSchema = new Schema({
  facialInfo: {
    type: String,
    default: ""
  },
  descriptor: {
    type: Object
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User"
  }
  }, {
  timestamps: true
});
// Indexes
FacialDataSchema.index({ userId: 1 });

const FacialData = mongoose.model("FacialData", FacialDataSchema);
module.exports = FacialData;
