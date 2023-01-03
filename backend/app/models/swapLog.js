const mongoose = require("mongoose"),
  Schema = mongoose.Schema;

const SwapLogSchema = new Schema(
  {
    from: {
      type: Object,
    },
    to: {
      type: Object,
    },
    status: {
      type: Number,
      default: 0, // 0 pending 1 accpeted 2 rejected 3 cancelled
    },
    appliedLeaveFrom: {
      type: Schema.Types.ObjectId,
      ref: "LeaveApplied",
    },
    appliedLeaveTo: {
      type: Schema.Types.ObjectId,
      ref: "LeaveApplied",
    },
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    leaveTypeId: {
      type: Schema.Types.ObjectId,
      ref: "LeaveType",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SwapLog", SwapLogSchema);
