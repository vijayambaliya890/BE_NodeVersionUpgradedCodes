let express = require('express'),
    leaveTypeRouter = express.Router(),
    leaveTypeController = require('../../controllers/company/leaveTypeController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');


//RENDER

leaveTypeRouter.use(passport.authenticate('jwt', {
        session: false
    }), /*Allow only admin*/
    (req, res, next) => {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

leaveTypeRouter.post('/create', (req, res) => {  // check if user role has access to this module
    leaveTypeController.create(req, res)
});
leaveTypeRouter.post('/update', (req, res) => {  // check if user role has access to this module
    leaveTypeController.update(req, res)
});
leaveTypeRouter.post('/delete', (req, res) => {  // check if user role has access to this module
    leaveTypeController.delete(req, res)
});
leaveTypeRouter.get('/get', (req, res) => {  // check if user role has access to this module
    leaveTypeController.get(req, res)
});
module.exports = leaveTypeRouter;
