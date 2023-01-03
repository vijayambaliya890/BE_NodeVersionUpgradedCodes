const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

const SubSectionSchema = new Schema({
  name: {
    type: String,
    default: ''
  },
  adminEmail: {
    type: String,
    default: ''
  },
  techEmail: {
    type: String,
    default: ''
  },
  shiftCancelHours: {
    type: Number,
    default: 0
  },
  plannedHours: {
    type: Number,
    default: 0
  },
  notificRemindDays: {
    type: Number,
    default: 0
  },
  notificRemindHours: {
    type: Number,
    default: 0
  },
  standByShiftPermission: {
    type: Boolean,
    default: false
  },
  cancelShiftPermission: {
    type: Boolean,
    default: false
  },
  sectionId: {
    type: Schema.Types.ObjectId,
    ref: 'Section'
  },
  subCategories: [{
    type: Schema.Types.ObjectId,
    ref: 'SubCategory'
  }],
  subSkillSets: [{
    type: Schema.Types.ObjectId,
    ref: 'SubSkillSet'
  }],
  mainSkillSets:[{
    type: Schema.Types.ObjectId,
    ref: 'SkillSet'
  }],
  skillSetTierType:{
    type: Number,
    default:2
  },
  orgName: {
    type: String,
    default: ''
  },
  reportingLocation: [{
    type: Schema.Types.ObjectId,
    ref: 'ReportingLocation'
  }],
  users: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  appointments: [{
    type: Schema.Types.ObjectId,
    ref: 'Appointment'
  }],
  scheme: [{
    type: Schema.Types.ObjectId,
    ref: 'Scheme'
  }],
  noOfWeek: {
    type: Number,
    default:3
  },
  status: {
    type: Number,
    default: 0
  },
  isUsedInOpsGroup:{
    type: Boolean,
    default: false
  },
  isUserInOpsViewOnly:{
    type:Boolean,
    default:false
  },

  shiftBreak:[{
    breakInMinutes:{type:Number,default:0},
    shiftHour:{type:Number,default:0}
  }],
  // breakInMinutes:{
  //   type:Number,
  //   default:0
  // },
  shiftTimeInMinutes:{ 
    type:Number,
    default:0
  },
  isBreakTime:{
    type:Boolean,
    default:false
  },
  cutOffDaysForBookingAndCancelling:{
    type:Number,
    default:0
  },
  geoReportingLocation: [{
    type: Schema.Types.ObjectId,
    ref: 'geoReportingLocation'
  }],
  reportingLocationType: {
    type: String
  },
  isCheckInEnabled:{
    type:Boolean,
    default:false
  },
  isProximityEnabled:{
    type:Boolean,
    default:false
  },
  proximity:{
    type: Number,
    default: 0
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('SubSection', SubSectionSchema);
