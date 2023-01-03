const mongoose = require("mongoose"),
  Schema = mongoose.Schema;

const redeemedRewardSchema = new Schema(
  {
    name: {
      type: String,
      default: ""
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company"
    },
    description: {
      type: String,
      default: ""
    },
    points: {
      type: Number,
      default: 0
    },
    quantity: {
      type: Number,
      default: 0
    },
    code: {
      type: String,
      default: ""
    },
    barcode: {
      type: String,
      default: ""
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    rewardId: {
      type: String,
      default: ""
    },
    terms_and_conditions: {
      type: String
    },
    thumbnail_img_url: {
      type: String
    },
    display_img_url: {
      type: String
    },
    redemption_type: {
      type: String
    },
    type: {
      type: String,
      enum: ["spending", "earning"],
      default: "spending"
    },
    merchant: {
      name: {
        type: String
      },
      description: {
        type: String
      },
      website: {
        type: String
      }
    },
    redeemable: {
      type: Boolean
    }, 
    totalRewardPoints:{
      type:Number,
      default:0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("RedeemedRewards", redeemedRewardSchema);
