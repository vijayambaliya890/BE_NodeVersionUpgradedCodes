let express = require('express'),
    sectionRouter = express.Router(),
    sectionController = require('../../controllers/company/sectionController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');




//RENDER

sectionRouter.use(passport.authenticate('jwt', {
        session: false
    }), /*Allow only admin*/
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

sectionRouter.post('/create', (req, res) => {
    sectionController.create(req, res)
});

sectionRouter.post('/read', (req, res) => {
    sectionController.read(req, res)
});


sectionRouter.post('/update', (req, res) => {
    sectionController.update(req, res)
});


sectionRouter.post('/delete', (req, res) => {
    sectionController.delete(req, res)
});


// sectionRouter.post('/test', sectionController.test);

module.exports = sectionRouter;