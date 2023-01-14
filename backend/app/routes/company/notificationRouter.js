let express = require('express'),
    notificationRouter = express.Router(),
    notificationController = require('../../controllers/company/notificationController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken'),
    multer = require('multer'),
    uuid = require('node-uuid'),
    path = require('path'),
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

notificationRouter.use(passport.authenticate('jwt', {
    session: false
}), /*Allow only admin*/
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });
const inputNotification = async (req, res) => {
    const routeprivilege = await __.getPrivilegeData(req.user._id);
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
    const routeprivilege = await __.getPrivilegeData(req.user._id);
    if (routeprivilege.viewNotification) {
        notificationController.read(req, res);
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