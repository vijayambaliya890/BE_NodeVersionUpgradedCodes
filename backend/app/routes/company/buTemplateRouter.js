let express = require('express'),
    buTemplateRouter = express.Router(),
    buTemplateController = require('../../controllers/company/buTemplateController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');




//RENDER

buTemplateRouter.use(function (req, res, next) {
    if (req.user.isFlexiStaff !== 1)
        next();
    else
        return res.status(402).send('This account is not permitted to access');
});

buTemplateRouter.post('/createbuTemplate', (req, res) => {
    buTemplateController.create(req, res)
});

buTemplateRouter.get('/getButemplate', (req, res) => {
    buTemplateController.read(req, res)
});

module.exports = buTemplateRouter;