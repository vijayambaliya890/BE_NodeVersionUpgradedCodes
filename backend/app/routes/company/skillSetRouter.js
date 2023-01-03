let express = require('express'),
    skillSetRouter = express.Router(),
    skillSetController = require('../../controllers/company/skillSetController'),
    passport = require('passport'),
    __ = require('../../../helpers/globalFunctions'),
    jwt = require('jsonwebtoken');


//RENDER

skillSetRouter.use(passport.authenticate('jwt', {
    session: false
}), /*Allow only admin*/
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

skillSetRouter.post('/read', (req, res) => {
    skillSetController.read(req, res);
});

skillSetRouter.post('/create', __.checkRole('skillSetSetup').validate, (req, res)=>{
    skillSetController.create(req, res);
});
skillSetRouter.post('/update', __.checkRole('skillSetSetup').validate, (req, res)=>{
    skillSetController.update(req, res);
});
skillSetRouter.post('/delete', __.checkRole('skillSetSetup').validate, (req, res)=>{
    skillSetController.delete(req, res);
});
// skillSetRouter.post('/test', skillSetController.test);

module.exports = skillSetRouter;