let express = require('express'),
    settingRouter = express.Router(),
    settingController = require('../../controllers/company/settingController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');




//RENDER

settingRouter.use(
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

settingRouter.post('/create', (req, res) => {
    settingController.create(req, res)
});

settingRouter.post('/read', (req, res) => {
    settingController.read(req, res)
});

settingRouter.post('/update', (req, res) => {
    settingController.update(req, res)
});

settingRouter.post('/delete', (req, res) => {
    settingController.delete(req, res)
});

module.exports = settingRouter;