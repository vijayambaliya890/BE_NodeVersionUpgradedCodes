const mongoose = require("mongoose"),
  bcrypt = require("bcrypt-nodejs"),
  Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    name: {
      type: String,
      default: "",
    },
    staffId: {
      type: String,
      default: "",
    },
    rewardPoints: {
      type: Number,
      default: 0,
    },
    password: {
      type: String,
      default: "",
    },
    otpSetup: {
      mobileVerified: {
        type: Boolean,
        default: false,
      },
      emailVerified: {
        type: Boolean,
        default: false,
      },
    },
    email: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
      required: "Email address is required",
      // validate: {
      //   validator: function(v) {
      //     return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
      //   },
      //   message: props => `${props.value} Please enter a valid Email address!`
      // },
      // match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid Email address']
    },
    profilePicture: {
      type: String,
      default: "",
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
    },
    doj: {
      type: Date,
    },
    contactNumber: {
      type: String,
      default: "",
      // validate: {
      //   validator: function(v) {
      //     return /\d{3}-\d{3}-\d{4}/.test(v);
      //   },
      //   message: props => `${props.value} is not a valid phone number!`
      // },
      // required: [true, 'User phone number required'],
      // match: [/^[0-9]+$/, 'Please enter a valid Contact Number']
    },
    countryCode: {
      type: String,
      default: "",
    },
    primaryMobileNumber: {
      type: String,
      default: "" /** Primary mobile number and country  code split with space */,
    },
    allBUAccess: {
      type: Number,
      default: 0, //  0 - no access , 1 - all bu access (wall,channel, manage shifts)
    },
    role: {
      type: Schema.Types.ObjectId,
      ref: "Role",
    },
    facialId: {
      type: Schema.Types.ObjectId,
      ref: "FacialData",
    },
    parentBussinessUnitId: {
      type: Schema.Types.ObjectId,
      ref: "SubSection",
    },
    planBussinessUnitId: [
      {
        type: Schema.Types.ObjectId,

        ref: "SubSection",
      },
    ],
    viewBussinessUnitId: [
      {
        type: Schema.Types.ObjectId,
        ref: "SubSection",
      },
    ],
    subSkillSets: [
      {
        type: Schema.Types.ObjectId,
        ref: "SubSkillSet",
      },
    ],
    mainSkillSets: [
      {
        type: Schema.Types.ObjectId,
        ref: "SkillSet",
      },
    ],
    skillSetTierType: {
      type: Number,
      default: 2,
    },
    airportPassExpiryDate: {
      type: Date,
    },
    staffPassExpiryDate: {
      type: Date,
    },
    deviceToken: {
      type: String,
    },
    loggedIn: {
      type: Date,
    },
    otp: {
      type: String,
      default: "",
    },
    status: {
      type: Number,
      default: 0,
    },
    otherFields: {
      type: Array,
      default: [], //  [{ fieldId:objectId, value:string , editable:boolean }]
    },
    tokenList: {
      type: Array,
      default: [],
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
    },
    loginAttempt: {
      type: Number,
      default: 0,
    },
    pwdManage: {
      pwdUpdatedAt: {
        type: Date,
        default: Date.now,
      },
      notifiedAt: {
        type: Date,
      },
      pwdList: [
        {
          password: {
            type: String,
            required: true,
          },
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    schemeId: {
      type: Schema.Types.ObjectId,
      ref: "Scheme",
    },
    leaveGroupId: {
      type: Schema.Types.ObjectId,
      ref: "LeaveGroup",
    },
    isUsedInOpsGroup: {
      type: Boolean,
      default: false,
    },
    isUserInOpsViewOnly: {
      type: Boolean,
      default: false,
    },
    isBallotAdmin: {
      type: Boolean,
      default: false,
    },
    isLeaveSwapAllowed: {
      type: Boolean,
      default: false, // vice versa
    },
    roleUpdate:{
      type: Boolean,
      default: false, // vice versa
    }, // use for role update check during middleware
  },
  {
    timestamps: true,
  }
);
//method to encrypt password
UserSchema.methods.generateHash = function (password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

//method to decrypt password
UserSchema.methods.validPassword = function (password) {
  var user = this;
  return bcrypt.compareSync(password, user.password);
};

UserSchema.index({ name: "text" });
const User = mongoose.model("User", UserSchema);

module.exports = User;
