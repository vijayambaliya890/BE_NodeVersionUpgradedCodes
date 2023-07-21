let express = require('express'),
    companyRouter = express.Router(),
    companyController = require('../../controllers/company/companyController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');




//RENDER

companyRouter.use(function (req, res, next) {
    if (req.user.isFlexiStaff !== 1)
        next();
    else
        return res.status(402).send('This account is not permitted to access');
});

companyRouter.post('/create', (req, res) => {
    companyController.create(req, res)
});

companyRouter.post('/read', (req, res) => {
    companyController.read(req, res)
});


companyRouter.post('/update', (req, res) => {
    companyController.update(req, res)
});


companyRouter.post('/delete', (req, res) => {
    companyController.delete(req, res)
});


// companyRouter.post('/test', companyController.test);

module.exports = companyRouter;