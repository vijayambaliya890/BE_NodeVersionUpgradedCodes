let express = require('express'),
  leaveApplicationRouter = express.Router(),
  leaveApplicationController = require('../../controllers/company/leaveApplicationsController'),
  passport = require('passport'),
  jwt = require('jsonwebtoken'),
  uuid = require('node-uuid'),
  path = require('path');

leaveApplicationRouter.use(function (req, res, next) {
  if (req.user.isFlexiStaff !== 1 || req.path.includes('staff')) next();
  else return res.status(402).send('This account is not permitted to access');
});

leaveApplicationRouter.get('/', (req, res) => {
  leaveApplicationController.testRoute(req, res);
});

leaveApplicationRouter.post('/staff/apply', (req, res) => {
  leaveApplicationController.applyForLeave(req, res);
});

leaveApplicationRouter.post('/staff/getLeavedetailToApply', (req, res) => {
  leaveApplicationController.getLeaveDetailToApply(req, res);
});

leaveApplicationRouter.get('/getMyUsersList', (req, res) => {
  leaveApplicationController.getMyUserLeaves(req, res);
});

module.exports = leaveApplicationRouter;
