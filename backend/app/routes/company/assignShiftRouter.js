let express = require('express'),
    assignShiftRouter = express.Router(),
    assignShiftController = require('../../controllers/company/assignShiftController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');




//RENDER

assignShiftRouter.use(passport.authenticate('jwt', {
    session: false
}), /*Allow only admin*/
    function (req, res, next) {
        console.log('req.path', req.path)
        if (req.path.includes("view")) {
            console.log('aaa')
        }
        if (req.user.isFlexiStaff !== 1 || req.path.includes("changerequest") || req.path.includes("changeRequest") || req.path.includes("view"))
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

assignShiftRouter.post('/stafflisting', (req, res) => {
    assignShiftController.createStaffListing(req, res)
});
assignShiftRouter.post('/create', (req, res) => {
    assignShiftController.create(req, res)
});
assignShiftRouter.post('/staff/create', (req, res) => {
    assignShiftController.createStaff(req, res)
});
assignShiftRouter.post('/staff/update', (req, res) => {
    assignShiftController.updateStaffShift(req, res)
});
assignShiftRouter.post('/staff/updateafterrestoff', (req, res) => {
    assignShiftController.updateStaffShiftRestOff(req, res)
});
assignShiftRouter.post('/staff/create/restoff', (req, res) => {
    assignShiftController.createStaffAsRestOrOff(req, res)
});
assignShiftRouter.post('/staff/update/restoff', (req, res) => {
    assignShiftController.updateStaffAsRestOrOff(req, res)
});
assignShiftRouter.post('/read', (req, res) => {
    assignShiftController.read(req, res)
});
assignShiftRouter.post('/view', (req, res) => {
    assignShiftController.shiftView(req, res)
});
assignShiftRouter.post('/changerequest', (req, res) => {
    assignShiftController.changeRequest(req, res)
});
assignShiftRouter.post('/datelist', (req, res) => {
    assignShiftController.dateList(req, res)
});
assignShiftRouter.post('/log', (req, res) => {
    assignShiftController.readLog(req, res)
});
assignShiftRouter.get('/rolelist', (req, res) => {
    assignShiftController.getRole(req, res)
});
assignShiftRouter.post('/alertaction', (req, res) => {
    assignShiftController.alertAction(req, res)
});
assignShiftRouter.post('/approve', (req, res) => {
    assignShiftController.approveRequest(req, res)
});
assignShiftRouter.post('/changetime', (req, res) => {
    assignShiftController.changeShiftTime(req, res)
});

assignShiftRouter.post('/publishAll', (req, res) => {
    assignShiftController.publishAll(req, res)
});
assignShiftRouter.get('/stafflist/:staffId', (req, res) => {
    assignShiftController.getStaffById(req, res)
});
assignShiftRouter.post('/staff/delete', (req, res) => {
    assignShiftController.deleteShift(req, res)
});
assignShiftRouter.post('/staff/delete/single', (req, res) => {
    assignShiftController.deleteShiftSingle(req, res)
});
assignShiftRouter.get('/tiersetup', (req, res) => {
    assignShiftController.readTierSetup(req, res)
});
// changetime
//publish
//publish single //validation

// appointmentRouter.post('/test', appointmentController.test);

module.exports = assignShiftRouter;
