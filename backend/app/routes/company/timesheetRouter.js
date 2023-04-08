let express = require('express'),
    timeSheetRouter = express.Router(),
    timeSheetController = require('../../controllers/company/timesheetController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');


//RENDER

timeSheetRouter.use(passport.authenticate('jwt', {
    session: false
}), /*Allow only admin*/
    (req, res, next) => {
        if (req.user.isFlexiStaff !== 1 || req.path.includes("qrcode") || req.path.includes("qrCodeStatus"))
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

timeSheetRouter.get('/read/:businessUnitId', (req, res) => {
    timeSheetController.read(req, res)
});
// dashboard api
timeSheetRouter.post('/read/:businessUnitId', (req, res) => {
    timeSheetController.readModifyAshish(req, res)
});
timeSheetRouter.get('/readcopy/:businessUnitId', (req, res) => {
    timeSheetController.readCopy(req, res)
});
timeSheetRouter.get('/user/:userID/:shiftDetailId', (req, res) => {
    timeSheetController.readUserForDashboard(req, res)
});
timeSheetRouter.get('/user/:userID', (req, res) => {
    timeSheetController.readUser(req, res)
});
timeSheetRouter.get('/userimage/:userID', (req, res) => {
    timeSheetController.readUserImage(req, res)
});
timeSheetRouter.get('/qrCode/:userId/:shiftDetailId', (req, res) => {
    timeSheetController.qrCode(req, res)
});
timeSheetRouter.post('/matchFace', (req, res) => {
    timeSheetController.matchFace(req, res)
});
timeSheetRouter.get('/qrCodeStatus/:userId/:shiftDetailId', (req, res) => {
    timeSheetController.checkQrCodeStatus(req, res)
});
// timesheet API
timeSheetRouter.get('/:businessUnitId', (req, res) => {
    timeSheetController.timesheetData(req, res)
});
timeSheetRouter.post('/approval', (req, res) => {
    timeSheetController.approval(req, res)
});
timeSheetRouter.post('/lock', (req, res) => {
    timeSheetController.lock(req, res)
});
timeSheetRouter.post('/timesheetlock/:isLock', (req, res) => {
    timeSheetController.timeSheetLock(req, res)
});
timeSheetRouter.post('/history/:businessUnitId', (req, res) => {
    timeSheetController.history(req, res)
});
timeSheetRouter.get('/export/:businessUnitId', (req, res) => {
    timeSheetController.timesheetDataExport(req, res)
});
timeSheetRouter.post('/history/export/:businessUnitId', (req, res) => {
    timeSheetController.historyExport(req, res)
});
timeSheetRouter.post('/play', (req, res) => {
    timeSheetController.play(req, res)
});
timeSheetRouter.post('/lockall', (req, res) => {
    timeSheetController.lockAllAtOnce(req, res);
});


module.exports = timeSheetRouter;
