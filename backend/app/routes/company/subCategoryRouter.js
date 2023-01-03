let express = require('express'),
    subCategoryRouter = express.Router(),
    subCategoryController = require('../../controllers/company/subCategoryController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');




//RENDER

subCategoryRouter.use(passport.authenticate('jwt', {
        session: false
    }), /*Allow only admin*/
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

subCategoryRouter.post('/create', (req, res) => {
    subCategoryController.create(req, res)
});

subCategoryRouter.post('/read', (req, res) => {
    subCategoryController.read(req, res)
});


subCategoryRouter.post('/update', (req, res) => {
    subCategoryController.update(req, res)
});


subCategoryRouter.post('/delete', (req, res) => {
    subCategoryController.delete(req, res)
});


// subCategoryRouter.post('/test', subCategoryController.test);

module.exports = subCategoryRouter;