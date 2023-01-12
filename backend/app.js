const os = require('os'),
  mongoose = require('mongoose'),
  express = require('express'),
  app = express(),
  compression = require('compression'),
  helmet = require('helmet'),
  chalk = require('chalk'),
  dotenv = require('dotenv').config(),
  bodyParser = require('body-parser'),
  jwt = require('jsonwebtoken'),
  passport = require('passport'),
  cors = require('cors'),
  __ = require('./helpers/globalFunctions'),
  rateLimit = require('express-rate-limit');
const { logInfo } = require('./helpers/logger.helper.js');
const ResponseHelper = require('./helpers/response.helper');
let db_host;
let environment = 'live';
let port;
if (
  os.hostname().indexOf('doodlews-67') == 0 ||
  os.hostname().indexOf('doodlews-88') == 0 ||
  os.hostname().indexOf('doodlews-70') == 0 ||
  os.hostname().indexOf('doodlews116') == 0 ||
  os.hostname().indexOf('doodle-ws-71') == 0 ||
  os.hostname().indexOf('doodleblue-ws-15') == 0
) {
  /*localhost*/
  db_host = process.env.LOCAL_DB_HOST;
  environment = 'local';
  port = process.env.LOCAL_STAGING_PORT;
} else if (os.hostname().indexOf('doodledev') == 0) {
  /*staging*/
  db_host = process.env.STAGING_DB_HOST;
  environment = 'staging';
  port = process.env.LOCAL_STAGING_PORT;
} /*live*/ else {
  /*live hostname = 'ip-172-31-18-55'*/
  db_host = process.env.LIVE_DB_HOST;

  environment = 'live';
  port = process.env.LIVE_PORT;
}

/**
 * Connect to MongoDB.
 */
mongoose.Promise = global.Promise;
//db_host = "mongodb://localhost:27017/flexishift";
//db_host = "mongodb://polarisdev3.gq:27017/flexiDev";
//db_host = "mongodb://3.0.89.233:27017/flexiDev1";
//db_host = "mongodb://polarisdev3.gq:27017/Prd";
mongoose.connect(db_host);
mongoose.connection.on('error', (err) => {
  console.log(
    '%s MongoDB connection error. Please make sure MongoDB is running (' +
      db_host +
      ').',
    chalk.red('✗'),
  );
  process.exit();
});
logInfo('DATABASE CONNECTED IS: ', db_host);
/*Express configuration*/
new ResponseHelper().init(app);
app.set('port', port);
app.use(helmet());
app.use(cors());
app.use(compression());

// X-Frame-Options defaults to sameorigin
app.use(helmet.frameguard({ action: 'sameorigin' }));

// Sets "Strict-Transport-Security: max-age=5184000; includeSubDomains".
const sixtyDaysInSeconds = 5184000;
app.use(
  helmet.hsts({
    maxAge: sixtyDaysInSeconds,
  }),
);

// Sets "X-XSS-Protection: 1; mode=block".
app.use(helmet.xssFilter());

// Sets "X-Content-Type-Options: nosniff".
app.use(helmet.noSniff());

app.use(
  bodyParser.json({
    limit: '50mb',
  }),
);
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: '50mb',
    parameterLimit: 1000000,
  }),
);

app.use(passport.initialize());

/**
 * Rate Limiter
 */

app.enable('trust proxy');

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 250,
});

app.use(limiter);

/** Clear cache */
app.use(function (req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
});

//defining router
const loginRoute = require('./app/routes/loginRouter'),
  externalRoute = require('./app/routes/externalFormRoute'),
  logRoute = require('./app/routes/logRouter'),
  /*company*/
  companyUserRoute = require('./app/routes/company/companyUserRouter'),
  roleRoute = require('./app/routes/company/roleRouter'),
  companyRoute = require('./app/routes/company/companyRouter'),
  departmentRoute = require('./app/routes/company/departmentRouter'),
  sectionRoute = require('./app/routes/company/sectionRouter'),
  subSectionRoute = require('./app/routes/company/subSectionRouter'),
  businessUnitRoute = require('./app/routes/company/businessUnitRouter'),
  skillSetRoute = require('./app/routes/company/skillSetRouter'),
  subSkillSetRoute = require('./app/routes/company/subSkillSetRouter'),
  reportingLocationRoute = require('./app/routes/company/reportingLocationRouter'),
  shiftRoute = require('./app/routes/company/shiftRouter'),
  templateRoute = require('./app/routes/company/templateRouter'),
  weeklyStaffingRoute = require('./app/routes/company/weeklyStaffingRouter'),
  privilegeCategoryRoute = require('./app/routes/company/privilegeCategoryRouter'),
  privilegeRoute = require('./app/routes/company/privilegeRouter'),
  categoryRoute = require('./app/routes/company/categoryRouter'),
  subCategoryRoute = require('./app/routes/company/subCategoryRouter'),
  appointmentRoute = require('./app/routes/company/appointmentRouter'),
  notificationRoute = require('./app/routes/company/notificationRouter'),
  settingRoute = require('./app/routes/company/settingRouter'),
  reportsRoute = require('./app/routes/company/reportsRouter'),
  shiftLogRouter = require('./app/routes/company/shiftLogRouter'),
  channelRoute = require('./app/routes/company/channelRouter'),
  postRoute = require('./app/routes/company/postRouter'),
  userFieldRoute = require('./app/routes/company/userFieldRouter'),
  centralBuilderRoute = require('./app/routes/company/centralBuilderRouter'),
  pageSettingRoute = require('./app/routes/company/pageSettingrouter'),
  postLogRoute = require('./app/routes/company/postLogRouter'),
  wallRoute = require('./app/routes/company/wallRouter'),
  timeSheetRoute = require('./app/routes/company/timesheetRouter'),
  buTemplateRoute = require('./app/routes/company/buTemplateRouter'),
  customForm = require('./app/routes/company/customFormRouter'),
  leavePlannerRoute = require('./app/routes/company/leavePlannerRouter'),
  opsTeamRoute = require('./app/routes/company/opsTeamRouter'),
  resetPasswordRoute = require('./app/routes/company/resetPasswordRouter'),
  assignShiftRoute = require('./app/routes/company/assignShiftRouter'),
  ballotRoute = require('./app/routes/company/ballotRouter'),
  leaveApplicationRoute = require('./app/routes/company/leavesRouter'),
  /*staff */
  staffShiftRoute = require('./app/routes/staff/staffShiftRouter'),
  staffUserRoute = require('./app/routes/staff/staffUserRouter'),
  staffNotificationRoute = require('./app/routes/staff/staffNotificationRouter'),
  integrationRoute = require('./app/routes/company/integrationRouter'),
  opsGroupRoute = require('./app/routes/company/opsGroupRouter');
const eventSessionRoute = require('./app/routes/company/eventSessionRouter');
/* Common */
const commonPostRoute = require('./app/routes/common/postRouter');
const questionModuleRoute = require('./app/routes/common/questionModuleRouter');
const myBoardRoute = require('./app/routes/common/myBoardRouter');
const wallPostRoute = require('./app/routes/common/wallPostRouter');
const reportRoute = require('./app/routes/common/reportPostRouter');
const emojiRoute = require('./app/routes/common/emojiRouter');
const rewardRoute = require('./app/routes/common/rewardRouter');
const redeemedSettingRoute = require('./app/routes/common/redeemedSettingRouter');
const challengeRoute = require('./app/routes/common/challengeRouter');
const opsRoute = require('./app/routes/common/opsGroupRouter');
const addOnSchemesRoute = require('./app/routes/company/addOnSchemesRouter');
const leaveTypeRoute = require('./app/routes/company/leaveTypeRouter');
const leaveGroupRoute = require('./app/routes/company/leaveGroupRouter');
const leaveManagementRoute = require('./app/routes/company/leaveManagementRouter');
const newLeavePlannerRoute = require('./app/routes/company/newLeavePlannerRouter');
const swappingRouter = require('./app/routes/company/swappingRouter');
/* Super Admin Routes */
const superAdminLoginRoute = require('./app/routes/superadmin/loginRouter');
const superAdmincompanyRoute = require('./app/routes/superadmin/companyRouter');
const superAdminList = require('./app/routes/superadmin/list');
const facialRoute = require('./app/routes/company/facialDataRouter');
const schemeRoute = require('./app/routes/company/schemeRouter');
const csvDownload = require('./app/routes/common/csv-download');
const attendanceRoute = require('./app/routes/company/attendanceRouter');

require('./helpers/authApi');

// app.get("/", function(req, res) {
//   res.send("Welcome Flexishift!");
// });

// app.use(function(req, res, next) {
//   next();
// });

/* Routes */
app.use('/login', loginRoute);
app.use('/log', logRoute);
app.use('/integration', integrationRoute);
/* External Routes */
app.use('/external', externalRoute);
app.use('/*.jpg', csvDownload);
app.use('/*.jpeg', csvDownload);
app.use('/*.png', csvDownload);
app.use('/*.gif', csvDownload);
app.use('/*.mp4', csvDownload);
app.use('/*.mpg', csvDownload);
app.use('/*.mpeg', csvDownload);
app.use('/*.3gp', csvDownload);
app.use('/*.avi', csvDownload);
app.use('/*.pdf', csvDownload);
/* Super Admin Routes starts */
app.use('/superadmin/auth/', superAdminLoginRoute);
app.use('/superadmin/company/', superAdmincompanyRoute);
/* Super Admin Routes ends */

/*
 Reset Password Duration Status
 */
/*,
    process.env.API_KEY*/

app.use(
  passport.authenticate('jwt', {
    session: false,
  }),
  function (req, res, next) {
    if (
      !!req.user &&
      req.user.pwdDurationStatus &&
      req.user.pwdDurationStatus == true
    ) {
      next();
    } else {
      res.send(401, {
        error: 'Passwordchange',
        message: 'You have to change your password',
      });
    }
  },
);

/*Company Routes starts */
app.use('/facial', facialRoute);
app.use('/scheme', schemeRoute);
app.use('/attendance', attendanceRoute);
app.use('/companyuser', companyUserRoute);
app.use('/user', companyUserRoute);
app.use('/timesheet', timeSheetRoute);
app.use('/role', roleRoute);
app.use('/company', companyRoute);
app.use('/department', departmentRoute);
app.use('/section', sectionRoute);
app.use('/subsection', subSectionRoute);
app.use('/businessunit', businessUnitRoute);
app.use('/skillset', skillSetRoute);
app.use('/subskillset', subSkillSetRoute);
app.use('/repotinglocation', reportingLocationRoute);
app.use('/shift', shiftRoute);
app.use('/template', templateRoute);
app.use('/weeklystaffing', weeklyStaffingRoute);
app.use('/privilegeCategory', privilegeCategoryRoute);
app.use('/privilege', privilegeRoute);
app.use('/category', categoryRoute);
app.use('/subcategory', subCategoryRoute);
app.use('/appointment', appointmentRoute);
app.use('/notification', notificationRoute);
app.use('/setting', settingRoute);
app.use('/reports', reportsRoute);
app.use('/shiftLog', shiftLogRouter);
app.use('/channel', channelRoute);
app.use('/post', postRoute);
app.use('/userField', userFieldRoute);
app.use('/custom-field', userFieldRoute);
app.use('/centralBuilder', centralBuilderRoute);
app.use('/pageSetting', pageSettingRoute);
app.use('/wall', wallRoute);
app.use('/postLog', postLogRoute);
app.use('/buTemplate', buTemplateRoute);
app.use('/customForm', customForm);
app.use('/event', eventSessionRoute);
app.use('/assginshift', assignShiftRoute);
app.use('/ballot', ballotRoute);
app.use('/leaveapplication', leaveApplicationRoute);
app.use('/resetPass', resetPasswordRoute);
app.use('/leave', leavePlannerRoute);
app.use('/opsTeam', opsTeamRoute);
app.use('/opsgroup', opsGroupRoute);
app.use('/addOnSchemes', addOnSchemesRoute);
app.use('/leavetype', leaveTypeRoute);
app.use('/leavegroup', leaveGroupRoute);
app.use('/leavemanagement', leaveManagementRoute);
app.use('/newleaveplanner', newLeavePlannerRoute);
app.use('/swap', swappingRouter);
/*company Routes ends */

/*staff Routes starts */
app.use('/staffuser', staffUserRoute);
app.use('/staffshift', staffShiftRoute);
app.use('/staffnotification', staffNotificationRoute);
/*staff Routes ends */

/* Common Routes starts */
app.use('/common/post/', commonPostRoute);
app.use('/common/questionModule/', questionModuleRoute);
app.use('/common/myBoards/', myBoardRoute);
app.use('/common/wallPost/', wallPostRoute);
app.use('/common/report/', reportRoute);
app.use('/common/emoji/', emojiRoute);
app.use('/common/redemption/', rewardRoute);
app.use('/common/redeemedSetting/', redeemedSettingRoute);
app.use('/common/challenge/', challengeRoute);
app.use('/common/ops/', opsRoute);

/* Common Routes ends */

/* Super Admin Routes starts */
app.use('/superadmin/auth/', superAdminLoginRoute);
app.use('/superadmin/company/', superAdmincompanyRoute);
app.use('/superadmin/list', superAdminList);
/* Super Admin Routes ends */

// Download CSV
app.use('/uploads/*', csvDownload);
app.use('*.csv', csvDownload);

//if (environment != "local")
/*cron for only live*/
require('./helpers/cron');

/* Start Express server. */
app.listen(app.get('port'), (req, res) => {
  console.log(
    `%s App is running at ${__.serverBaseUrl()} `,
    chalk.blue('✓'),
    app.get('port'),
    environment,
  );
  console.log('Press CTRL-C to exit');
});

module.exports = app;
