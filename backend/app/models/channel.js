const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

const ChannelSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    name: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
      default: '',
    },
    // assignUsers
    userDetails: [
      {
        businessUnits: [
          {
            type: Schema.Types.ObjectId,
            ref: 'SubSection',
          },
        ],
        buFilterType: {
          type: Number,
          default: 1, //1.alluser 2.includeUser 3.excludeUser
        },
        appointments: [
          {
            type: Schema.Types.ObjectId,
            ref: 'Appointment',
          },
        ],
        subSkillSets: [
          {
            type: Schema.Types.ObjectId,
            ref: 'SubSkillSet',
          },
        ],
        // user
        authors: [
          {
            type: Schema.Types.ObjectId,
            ref: 'User',
          },
        ],
        admin: [
          {
            type: Schema.Types.ObjectId,
            ref: 'User',
          },
        ],
        allBuToken: {
          type: Boolean,
          default: false,
        },
        allBuTokenStaffId: {
          type: String,
          default: '',
        },
        customField: [],
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    // enum: ['active', 'inactive'],
    status: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  },
);
module.exports = mongoose.model('Channel', ChannelSchema);
