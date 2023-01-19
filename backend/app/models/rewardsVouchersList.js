const mongoose = require("mongoose"),
  Schema = mongoose.Schema;

const RewardsVoucherSchema = new Schema(
  {
    productCode: {
      type: String,
      default: ""
    },
    productName: {
      type: String,
      default: ""
    },
    description: {
      type: String,
      default: ""
    },
    orderNumber: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('RewardsVouchersList', RewardsVoucherSchema);
