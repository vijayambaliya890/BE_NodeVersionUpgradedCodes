let express = require('express'),
    pageSettingRouter = express.Router(),
    pageSettingController = require('../../controllers/company/pageSettingController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken'),
    uuid = require('node-uuid'),

    multer = require('multer'),
    path = require('path'),

    storage = multer.diskStorage({
        destination: 'public/uploads/pageSetting',
        filename: function (req, file, cb) {
            cb(null, uuid.v4() + path.extname(file.originalname));
        }
    }),
    upload = multer({
        storage: storage
    });



pageSettingRouter.get('/read', (req, res) => {
    pageSettingController.read(req, res)
});
/*Allow only admin*/
/*Allow only admin*/
pageSettingRouter.use(passport.authenticate('jwt', {
    session: false
}), 
function (req, res, next) {
    next();
});

pageSettingRouter.use(passport.authenticate('jwt', {
        session: false
    }), 
    function (req, res, next) {
        console.log('req.url', req.url)
        if (true || req.user.isFlexiStaff !== 1 || req.url == '/skillset')
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

pageSettingRouter.post('/update', (req, res) => {
    pageSettingController.update(req, res)
});

pageSettingRouter.post('/updatePwdManage', (req, res) => {
    pageSettingController.updatePwdManage(req, res)
});

pageSettingRouter.post('/uploadFiles', upload.single('file'), (req, res) => {
    pageSettingController.uploadFiles(req, res)
});
pageSettingRouter.get('/skillset', (req, res) => {
    pageSettingController.readSkillSet(req, res)
});

module.exports = pageSettingRouter;