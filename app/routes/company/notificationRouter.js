let express = require('express'),
    notificationRouter = express.Router(),
    notificationController = require('../../controllers/company/notificationController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken'),
    multer = require('multer'),
    uuid = require('node-uuid'),
    path = require('path'),
    __ = require('../../../helpers/globalFunctions'),
    storage = multer.diskStorage({
        destination: 'public/uploads/notificationAttachment',
        filename: function (req, file, cb) {
            cb(null, uuid.v4() + path.extname(file.originalname));
        }
    }),
    upload = multer({
        storage: storage
    });


//RENDER

notificationRouter.use(function (req, res, next) {
    if (req.user.isFlexiStaff !== 1)
        next();
    else
        return res.status(402).send('This account is not permitted to access');
});
const inputNotification = async (req, res) => {
    const routeprivilege = await __.getPrivilegeData(req.user);
    if (routeprivilege.inputNotification) {
        switch (req.route.path) {
            case "/create": notificationController.create(req, res); break;
            case "/update": notificationController.update(req, res); break;
            default:
                break;
        }
    } else {
        return __.out(res, 300, 'This account is not permitted to access');
    }
}


notificationRouter.post('/create', upload.single('notificationAttachment'), inputNotification);
notificationRouter.post('/update', upload.single('notificationAttachment'), inputNotification);

notificationRouter.post('/read', async (req, res) => {
    const routeprivilege = await __.getPrivilegeData(req.user);
    if (routeprivilege.viewNotification) {
        notificationController.read(req, res);
    } else {
        return __.out(res, 300, 'This account is not permitted to access');
    }
});

notificationRouter.get('/readAcknowledgedAndUnreadUser/:_id', async (req, res) => {
    const routeprivilege = await __.getPrivilegeData(req.user);
    if (routeprivilege.viewNotification) {
        notificationController.getUserwhoUnreadOrAchknowledgedNotification(req, res);
    } else {
        return __.out(res, 300, 'This account is not permitted to access');
    }
});

notificationRouter.get('/viewAllNotification/:businessUnitId', async (req, res) => {
    const routeprivilege = await __.getPrivilegeData(req.user);
    if (routeprivilege.viewNotification) {
        notificationController.viewAllNotification(req, res);
    } else {
        return __.out(res, 300, 'This account is not permitted to access');
    }
});

notificationRouter.get('/mynotifications', (req, res) => {
    notificationController.myNotifications(req, res);
});

notificationRouter.get('/unReadNotifications', (req, res) => {
    notificationController.unReadNotifications(req, res);
});

notificationRouter.get('/acknowledgedNotifications/', (req, res) => {
    notificationController.acknowledgedNotifications(req, res);
});

notificationRouter.post('/acknowledge', (req, res) => {
    notificationController.acknowledge(req, res);
});

notificationRouter.post('/download', (req, res) => {
    notificationController.download(req, res);
});

notificationRouter.post('/getNotificModule', (req, res) => {
    notificationController.getNotificModule(req, res);
});

notificationRouter.post('/uploadContentFiles', upload.single('file'), (req, res) => {
    notificationController.uploadContentFiles(req, res);
});

notificationRouter.post('/allQuestionAnswered', (req, res) => {
    notificationController.allQuestionAnswered(req, res);
});

module.exports = notificationRouter;