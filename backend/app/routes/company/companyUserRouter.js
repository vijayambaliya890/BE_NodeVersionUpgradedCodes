let express = require('express'),
    companyUserRouter = express.Router(),
    companyUserController = require('../../controllers/company/companyUserController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken'),
    multer = require('multer'),
    uuid = require('node-uuid'),
    __ = require('../../../helpers/globalFunctions'),
    path = require('path'),

    storage = multer.diskStorage({
        destination: 'public/uploads/profilePictures',
        filename: function (req, file, cb) {
            cb(null, uuid.v4() + path.extname(file.originalname));
        }
    }),


    bulkStorage = multer.diskStorage({
        destination: 'public/uploads/bulkUpload',
        filename: function (req, file, cb) {
            cb(null, uuid.v4() + path.extname(file.originalname));
        }
    }),



    upload = multer({
        storage: storage
    });


bulkStorage = multer({
    storage: bulkStorage
});



//RENDER
companyUserRouter.get('/getUserPrivilege', companyUserController.getUserPrivilege);
companyUserRouter.get('/employeeDirecotory', __.checkRole('employeeDirectory').validate, (req, res) => {
    companyUserController.employeeDirecotory(req, res);
});
companyUserRouter.post('/updateOtherFields', (req, res) => {
    companyUserController.updateOtherFields(req, res);
});
companyUserRouter.use(passport.authenticate('jwt', {
    session: false
}), /*Allow only admin*/
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

companyUserRouter.get('/lockedAccounts', __.checkRole('lockedAccount').validate, (req, res) => {
    companyUserController.lockedUsers(req, res)
});

companyUserRouter.post('/test', (req, res) => {
    companyUserController.test(req, res)
});

companyUserRouter.get('/readUserFields', (req, res) => {
    companyUserController.readUserFields(req, res)
});

companyUserRouter.post('/readUserByBU', (req, res) => {
    companyUserController.readUserByBU(req, res)
});
companyUserRouter.post('/readUserByPlanBU', (req, res) => {
    companyUserController.readUserByPlanBU(req, res)
});
companyUserRouter.post('/readUserByPlanBU/assignshift', (req, res) => {
    companyUserController.readUserByPlanBUForAssignShift(req, res)
});
companyUserRouter.post('/sendMail', (req, res) => {
    companyUserController.sendMail(req, res)
});

companyUserRouter.post('/read', (req, res) => {
    companyUserController.read(req, res);
});
companyUserRouter.post('/read/single', (req, res) => {
    companyUserController.readSingle(req, res);
});
companyUserRouter.post('/update', upload.single('profilePicture'), (req, res) => {
    companyUserController.update(req, res);
});
companyUserRouter.post('/active', (req, res) => {
    companyUserController.statusUpdate(req, res);
});
companyUserRouter.get('/checkWithRole', (req, res) => {
    companyUserController.checkWithRole(req, res);
});
companyUserRouter.post('/inactive', (req, res) => {
    companyUserController.statusUpdate(req, res);
});
companyUserRouter.post('/delete', (req, res) => {
    companyUserController.statusUpdate(req, res);
});

companyUserRouter.post('/create', upload.single('profilePicture'), __.checkRole('createUser').validate, (req, res) => {
    companyUserController.create(req, res);
});

companyUserRouter.get('/editList', (req, res) => {
    companyUserController.editList(req, res);
});

companyUserRouter.post('/uploadBulkUsers', bulkStorage.single('file'), __.checkRole('createUser').validate, (req, res) => {
    companyUserController.uploadBulkUsers(req, res);
});


module.exports = companyUserRouter;