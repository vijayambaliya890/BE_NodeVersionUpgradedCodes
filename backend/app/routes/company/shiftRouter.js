let express = require('express'),
  shiftRouter = express.Router(),
  passport = require('passport'),
  jwt = require('jsonwebtoken'),
  shiftController = require('../../controllers/company/shiftController');

  const rateLimit = require('express-rate-limit');
  const createShiftLimiter = rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 1,
      handler: function (req, res) {
          return res.status(200).json({
            data: 'Please wait for sometime, the shifts are getting published'
          })
      }
  })

//RENDER

shiftRouter.use(
  function (req, res, next) {
    if (req.user.isFlexiStaff !== 1 || req.path.includes('shiftExtension'))
      next();
    else return res.status(402).send('This account is not permitted to access');
  },
);

shiftRouter.post('/create', createShiftLimiter, (req, res) => {
  shiftController.create(req, res);
});
shiftRouter.post('/create/restoff', (req, res) => {
  shiftController.createRestOff(req, res);
});
shiftRouter.post('/graphData', (req, res) => {
  shiftController.graphData(req, res);
});
shiftRouter.post('/read', (req, res) => {
  shiftController.readNew(req, res);
});
shiftRouter.post('/readplanshift', (req, res) => {
  shiftController.readNewPlanShift(req, res);
});

shiftRouter.post('/delete', (req, res) => {
  shiftController.delete(req, res);
});

shiftRouter.post('/loglist', (req, res) => {
  shiftController.logList(req, res);
});

shiftRouter.post('/viewbookings', (req, res) => {
  shiftController.viewBookings(req, res);
});

shiftRouter.post('/userbookings', (req, res) => {
  shiftController.userBookings(req, res);
});

shiftRouter.post('/matchingstaffs', (req, res) => {
  shiftController.matchingStaffs(req, res);
});
shiftRouter.post('/checklimit', (req, res) => {
  shiftController.checkLimitBeforeBooking(req, res);
});
shiftRouter.post('/reduceLimit', (req, res) => {
  shiftController.reduceLimitAfterAlert(req, res);
});

shiftRouter.post('/adjust', (req, res) => {
  shiftController.adjust(req, res);
});

shiftRouter.post('/request', (req, res) => {
  shiftController.request(req, res);
});

shiftRouter.post('/updatedate', (req, res) => {
  shiftController.updateDate(req, res);
});

shiftRouter.get('/profileNotifications', (req, res) => {
  shiftController.profileNotifications(req, res);
});

/**
 *  Request Change v2
 */

shiftRouter.post('/requestChange', (req, res) => {
  shiftController.requestChange(req, res);
});

shiftRouter.post('/cancel', (req, res) => {
  shiftController.cancel(req, res);
});

shiftRouter.post('/cancelIndividualShift', (req, res) => {
  shiftController.cancelIndividualShift(req, res);
});

shiftRouter.get('/bookedStaffDetails/:staffId', (req, res) => {
  shiftController.bookedStaffDetails(req, res);
});

shiftRouter.post('/stopRequesting', (req, res) => {
  shiftController.stopRequesting(req, res);
});

// shiftRouter.post('/test', shiftController.test);
shiftRouter.post('/shiftExtension', (req, res) => {
  shiftController.shiftExtension(req, res);
});
shiftRouter.post('/shiftExtension/again', (req, res) => {
  shiftController.shiftExtensionAgain(req, res);
});
shiftRouter.post('/shiftExtension/stop', (req, res) => {
  shiftController.shiftExtensionStop(req, res);
});
shiftRouter.post('/shiftExtension/confirmation', (req, res) => {
  shiftController.shiftConfirmation(req, res);
});
shiftRouter.get('/shiftExtension/check/:shiftDetailId/:userId', (req, res) => {
  shiftController.shiftCheck(req, res);
});

shiftRouter.post('/staff/limit', (req, res) => {
  shiftController.staffLimit(req, res);
});

module.exports = shiftRouter;
