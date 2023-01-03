let express = require('express'),
    staffShiftRouter = express.Router(),
    staffShiftController = require('../../controllers/staff/staffShiftController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');

//RENDER

staffShiftRouter.use(passport.authenticate('jwt', {
    session: false
}), /*Allow only FLEXISTAFF*/
    function (req, res, next) {
        if (req.user.isFlexiStaff === 1 || true)
            next();
        else {
            return res.status(402).send('This account is not permitted to access');
        };
    });
// before it was post
staffShiftRouter.get('/matchingshifts', (req, res) => {
    staffShiftController.matchingShifts(req, res)
});
staffShiftRouter.post('/recallShift', (req, res) => {
    staffShiftController.recalledShiftConfirmation(req, res)
});
staffShiftRouter.post('/bookingslist', async (req, res) => {
    const routeprivilege = await __.getPrivilegeData(req.user._id);
    if (routeprivilege.myBooking || true) {
        staffShiftController.bookingsList(req, res);
    } else {
        return __.out(res, 300, 'This account is not permitted to access');
    }
});
staffShiftRouter.post('/checklimit', (req, res) => {
    staffShiftController.checkLimitBeforeBooking(req, res);
});
staffShiftRouter.post('/reduceLimit', (req, res) => {
    staffShiftController.reduceLimitAfterAlert(req, res);
});
staffShiftRouter.post('/makebooking', (req, res) => {
    staffShiftController.makeBooking(req, res);
});

staffShiftRouter.post('/cancel', (req, res) => {
    staffShiftController.cancel(req, res)
});

staffShiftRouter.post('/responseconfirmslotrequestaftercancel', (req, res) => {
    staffShiftController.responseConfirmSlotRequestAfterCancel(req, res)
});

staffShiftRouter.post('/responseconfirmslotrequestafteradjust', (req, res) => {
    staffShiftController.responseConfirmSlotRequestAfterAdjust(req, res)
});

staffShiftRouter.post('/responsefornewshiftrequest', (req, res) => {
    staffShiftController.responseForNewShiftRequest(req, res)
});

/**
 * RequestShiftChange - v2
 */

staffShiftRouter.post('/resRequestShiftChange', (req, res) => {
    staffShiftController.resRequestShiftChange(req, res)
});
staffShiftRouter.post('/resRequestShiftChange/checklimit', (req, res) => {
    staffShiftController.checkLimitRequestShiftChange(req, res)
});
staffShiftRouter.post('/resRequestShiftChange/reducelimit', (req, res) => {
    staffShiftController.reduceLimitRSC(req, res)
});



module.exports = staffShiftRouter;
