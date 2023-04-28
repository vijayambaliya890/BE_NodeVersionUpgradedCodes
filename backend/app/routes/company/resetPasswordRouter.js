let express = require('express'),
    resetPasswordRouter = express.Router(),
    resetPasswordController = require('../../controllers/company/resetPasswordController'),
    passport = require('passport'),
    __ = require('../../../helpers/globalFunctions'),
    jwt = require('jsonwebtoken');




//RENDER

resetPasswordRouter.use(
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

resetPasswordRouter.get('/getUserData/:staffId', __.checkRole('resetPassword').validate, (req, res)=>{
    resetPasswordController.getResetPassword(req, res)
});
resetPasswordRouter.post('/updatePassword', __.checkRole('resetPassword').validate, (req, res)=>{
    resetPasswordController.UpdatePassword(req, res);
});
resetPasswordRouter.get('/getResetPasswordLog', __.checkRole('resetPassword').validate, (req, res)=>{
    resetPasswordController.getResetPasswordLog(req, res);
});

module.exports = resetPasswordRouter;