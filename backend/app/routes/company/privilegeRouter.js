let express = require('express'),
    privilegeRouter = express.Router(),
    privilegeController = require('../../controllers/company/privilegeController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');


//RENDER

privilegeRouter.use(passport.authenticate('jwt', {
        session: false
    }), /*Allow only admin*/
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

privilegeRouter.post('/create', (req, res) => {
    privilegeController.create(req, res)
});

privilegeRouter.post('/read', (req, res) => {
    privilegeController.read(req, res)
});


privilegeRouter.post('/update', (req, res) => {
    privilegeController.update(req, res)
});

privilegeRouter.post('/delete', (req, res) => {
    privilegeController.delete(req, res)
});


// privilegeRouter.post('/test', privilegeController.test);

module.exports = privilegeRouter;