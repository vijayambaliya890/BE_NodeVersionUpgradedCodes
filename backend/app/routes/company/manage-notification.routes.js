/* eslint-disable new-cap */

const manageNotificationController = require('../../controllers/company/manage-notification.controller');
const { validator } = require('../../validations/validator');
const { isParamObjectId } = require('../../validations/common.validator');
const {
  createNotification,
  paginateNotification,
  cancelledNotification,
  updateNotification,
} = require('../../validations/manageNotification.validator');
const express = require('express'),
  router = express.Router();

router.post('/create', validator.body(createNotification), function (req, res) {
  manageNotificationController.createNotification(req, res);
});
router.post(
  '/scheduled',
  validator.body(paginateNotification),
  function (req, res) {
    manageNotificationController.getScheduleNotification(req, res);
  },
);
router.post(
  '/pushed',
  validator.body(paginateNotification),
  function (req, res) {
    manageNotificationController.getPushNotification(req, res);
  },
);
router.get(
  '/single/:id',
  validator.params(isParamObjectId('id')),
  function (req, res) {
    manageNotificationController.getSingle(req, res);
  },
);
router.post(
  '/cancel',
  validator.body(cancelledNotification),
  function (req, res) {
    manageNotificationController.cancelled(req, res);
  },
);
router.post('/update', validator.body(updateNotification), function (req, res) {
  manageNotificationController.updateNotification(req, res);
});
//validator.params(isParamObjectId('pageSettingId')), validator.body(updatePageSetting),

module.exports = router;
