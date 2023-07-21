let express = require('express'),
    loginRouter = new express.Router(),
    loginController = require('../../controllers/superadmin/loginController.js'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');

//RENDER

loginRouter.post('/login', (req, res) => {
    loginController.login(req, res)
});

loginRouter.use(
    function (req, res, next) {
        if (req.user.role === "superadmin") {
            next();
        } else {
            return res.status(402).send('This account is not permitted to access');
        }
    });

loginRouter.get('/logout', (req, res) => {
    loginController.logout(req, res)
});




module.exports = loginRouter;