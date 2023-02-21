let express = require('express'),
    attendanceRouter = express.Router(),
    {attendanceController} = require('../../controllers/company/attendanceController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');

attendanceRouter.use(passport.authenticate('jwt', {
        session: false
    }), /*Allow only admin*/
    (req, res, next) => {
        console.log('pa', req.path);
        if (req.user.isFlexiStaff !== 1 || req.path.includes("breakTime") || req.path.includes("staff"))
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

    attendanceRouter.post('/add', (req, res) => {
        attendanceController.add(req, res)
    });
    attendanceRouter.post('/', (req, res) => {
        attendanceController.update(req, res)
    });
    attendanceRouter.post('/logs', (req, res) => {
        attendanceController.getLogs(req, res)
    });
    attendanceRouter.post('/breakTime', (req, res) => {
        attendanceController.updateBreakTime(req, res)
    });
    attendanceRouter.post('/split/breakTime', (req, res) => {
        attendanceController.updateBreakTimeSplit(req, res)
    });
    attendanceRouter.post('/delete/breakTime', (req, res) => {
        attendanceController.deleteBreakTime(req, res)
    });
    attendanceRouter.get('/breakTime/:userId/:shiftDetailId/:splitShiftId', (req, res) => {
        attendanceController.getBreakTime(req, res)
    });
    attendanceRouter.get('/check/:userId/:shiftDetailId', (req, res) => {
        attendanceController.check(req, res)
    });
    attendanceRouter.get('/staff/:userId/:shiftId/:shiftDetailId/:splitShiftId', (req, res) => {
        attendanceController.getStaffAddendance(req, res)
    });
    attendanceRouter.post('/autoapprove', (req, res) => {
        attendanceController.autoApprove(req, res)
    });


module.exports = attendanceRouter;