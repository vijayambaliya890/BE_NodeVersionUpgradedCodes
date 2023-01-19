/* eslint-disable new-cap */

const manageNotificationController = require('../../controllers/company/manageNotificationController');
const express = require('express'),
  router = express.Router();

router.post('/create', function (req, res) {
  manageNotificationController.createNotification(req, res);
});
router.post(
  '/scheduled',
  function (req, res) {
    manageNotificationController.getScheduleNotification(req, res);
  },
);
router.post(
  '/pushed',
  function (req, res) {
    manageNotificationController.getPushNotification(req, res);
  },
);
router.get(
  '/single/:id',
  function (req, res) {
    manageNotificationController.getSingle(req, res);
  },
);
router.post(
  '/cancel',
  function (req, res) {
    manageNotificationController.cancelled(req, res);
  },
);
router.post('/update', function (req, res) {
  manageNotificationController.updateNotification(req, res);
});

module.exports = router;
