let express = require('express'),
    shiftLogRouter = express.Router(),
    shiftLogController = require('../../controllers/company/shiftLogController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');

//RENDER

shiftLogRouter.use(
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });



shiftLogRouter.post('/read', (req, res) => {
    shiftLogController.read(req , res);
});

module.exports = shiftLogRouter;