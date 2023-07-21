let express = require('express'),
    privilegeCategoryRouter = express.Router(),
    privilegeCategoryController = require('../../controllers/company/privilegeCategoryController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');


//RENDER

privilegeCategoryRouter.use(function (req, res, next) {
    if (req.user.isFlexiStaff !== 1)
        next();
    else
        return res.status(402).send('This account is not permitted to access');
});

privilegeCategoryRouter.post('/create', (req, res) => {
    privilegeCategoryController.create(req, res)
});

privilegeCategoryRouter.post('/read', (req, res) => {
    privilegeCategoryController.read(req, res)
});


privilegeCategoryRouter.post('/update', (req, res) => {
    privilegeCategoryController.update(req, res)
});

privilegeCategoryRouter.post('/delete', (req, res) => {
    privilegeCategoryController.delete(req, res)
});

privilegeCategoryRouter.post('/push', (req, res) => {
    privilegeCategoryController.push(req, res)
});

privilegeCategoryRouter.post('/pull', (req, res) => {
    privilegeCategoryController.pull(req, res)
});

// privilegeCategoryRouter.post('/test', privilegeCategoryController.test);

module.exports = privilegeCategoryRouter;