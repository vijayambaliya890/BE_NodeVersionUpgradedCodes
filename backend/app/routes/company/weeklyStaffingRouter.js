let express = require('express'),
    weeklyStaffingRouter = express.Router(),
    weeklyStaffingController = require('../../controllers/company/weeklyStaffingController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken'),
    multer = require('multer'),
    uuid = require('node-uuid'),
    path = require('path'),
    storage = multer.diskStorage({
        destination: 'public/uploads/weeklyStaffCsvData',
        filename: function (req, file, cb) {
            cb(null, uuid.v4() + path.extname(file.originalname));
        }
    }),
    upload = multer({
        storage: storage
    });




//RENDER

weeklyStaffingRouter.use(
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

weeklyStaffingRouter.post('/uploadweeklystaffingdata', upload.single('weeklyStaffCsvData'), (req, res) => {
    weeklyStaffingController.uploadWeeklyStaffingData(req, res)
});


// weeklyStaffingRouter.post('/test', weeklyStaffingController.test);

module.exports = weeklyStaffingRouter;