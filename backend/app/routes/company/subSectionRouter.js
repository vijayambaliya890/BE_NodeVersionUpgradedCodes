let express = require('express'),
    subSectionRouter = express.Router(),
    subSectionController = require('../../controllers/company/subSectionController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');




//RENDER

subSectionRouter.use(passport.authenticate('jwt', {
        session: false
    }), /*Allow only admin*/
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

subSectionRouter.post('/create', (req, res) => {
    subSectionController.create(req, res)
});

subSectionRouter.post('/read', (req, res) => {
    subSectionController.read(req, res)
});


subSectionRouter.post('/update', (req, res) => {
    subSectionController.update(req, res)
});


subSectionRouter.post('/delete', (req, res) => {
    subSectionController.delete(req, res)
});

subSectionRouter.get('/categories' , (req , res) => {
    subSectionController.getCategories(req.query.id , res)
});

subSectionRouter.post('/checkDuplicate', (req , res) => {
    subSectionController.checkDuplicate(req , res);
});

subSectionRouter.get('/testRole', (req , res) => {
    subSectionController.testRole(req , res);
})

module.exports = subSectionRouter;