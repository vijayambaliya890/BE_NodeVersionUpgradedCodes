let express = require('express'),
    loginRouter = new express.Router(),
    loginController = require('../controllers/loginController.js'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');


//var fs = require('fs')

//RENDER

loginRouter.post('/', (req, res) => {
    loginController.login(req, res)
});

loginRouter.post('/sendOtp', (req, res)=>{
    loginController.sendOtp(req, res)
});

loginRouter.post('/validateOtp', (req, res)=>{
    loginController.validateOtp(req, res);
});

loginRouter.get('/getLatestVersion/:app', (req, res)=>{
    loginController.getLatestVersion(req, res);
});

loginRouter.post('/setLatestVersion', (req, res)=>{
    loginController.setLatestVersion(req, res);
});

loginRouter.post('/forgotPassword', (req, res) => {
    loginController.forgotPassword(req, res);
});

loginRouter.get('/checkTokenForForgotPassword/:token', (req, res) => {
    loginController.checkTokenForForgotPassword(req, res);
});

loginRouter.post('/resetPassword', (req, res) => {
    loginController.resetPassword(req, res);
});

/* Separate Company Login */
loginRouter.get('/getCompany/:pathName', (req, res) => {
    loginController.getCompany(req, res);
});

loginRouter.post('/sendFeedback', (req, res) => {
    loginController.sendFeedback(req, res)
});

loginRouter.post('/requestOtp', (req, res) => {
    loginController.requestOtp(req, res);
});

loginRouter.post('/verifyOtp', (req, res) => {
    loginController.verifyOtp(req, res);
});

loginRouter.use(passport.authenticate('jwt', {
    session: false
}));

loginRouter.get('/pwdChangeDuration', (req, res) =>{
    loginController.pwdChangeDuration(req, res);
});

loginRouter.post('/test', (req, res) => {
    loginController.test(req, res)
});
// it was post
loginRouter.get('/logout', (req, res) => {
    loginController.logout(req, res)
});

loginRouter.post('/feedback', (req, res) => {
    loginController.feedback(req, res)
});
module.exports = loginRouter;