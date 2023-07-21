let express = require('express'),
    staffNotificationRouter = express.Router(),
    staffNotificationController = require('../../controllers/staff/staffNotificationController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');

//RENDER

staffNotificationRouter.use(
    function (req, res, next) {
        if (req.user.isFlexiStaff === 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });
// it was post
staffNotificationRouter.get('/mynotifications', (req, res) => {
    staffNotificationController.myNotifications(req, res)
});

staffNotificationRouter.post('/acknowledge', (req, res) => {
    staffNotificationController.acknowledge(req, res)
});

module.exports = staffNotificationRouter;