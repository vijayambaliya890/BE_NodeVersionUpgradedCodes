// Controller Code Starts here
const mongoose = require('mongoose'),
    Notification = require('../../models/notification'),
    notificationController = require('../company/notificationController'),
    _ = require('lodash'),
    __ = require('../../../helpers/globalFunctions');

class notification {

    async myNotifications(req, res) {
        var data = {
            userId: req.user._id
        }
        var myNotifications = await notificationController.userNotifications(data, res);
        __.out(res, 201, myNotifications);
    }

    async acknowledge(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['notificationId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                console.log(req.body, 'acknowledge params')
                var data = {
                    userId: req.user._id,
                    notificationId: req.body.notificationId
                };
                if (req.body.qnsresponses) {
                    data.user = req.user;
                    data.qnsresponses = req.body.qnsresponses;
                }
                __.log(data, "userAcknowledge")

                notificationController.userAcknowledge(data, res);
            }
        } catch (err) {
            __.log(err);
            __.out(res, 500)
        }
    }
}
notification = new notification();
module.exports = notification;