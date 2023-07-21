const mongoose = require("mongoose"),
  Schema = mongoose.Schema;

const ChallengeStatusSchema = new Schema(
  {
    challengeId: {
      type: Schema.Types.ObjectId,
      ref: "Challenge"
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    status:{
      type:Boolean,
      default:true
    },
    totalRewardPoints: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Indexes
ChallengeStatusSchema.index({ challengeId: 1, userId: 1 });
ChallengeStatusSchema.index({ userId: 1 });
module.exports = mongoose.model(
  "ChallengeStatus",
  ChallengeStatusSchema
);
