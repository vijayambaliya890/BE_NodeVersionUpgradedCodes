let express = require('express'),
    roleRouter = express.Router(),
    roleController = require('../../controllers/company/roleController'),
    __ = require('../../../helpers/globalFunctions'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');




//RENDER

roleRouter.use(passport.authenticate('jwt', {
    session: false
}), /*Allow only admin*/
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

roleRouter.post('/create', __.checkRole('roleSetup').validate, (req, res)=>{
    roleController.create(req, res)
});
roleRouter.post('/read', roleController.read);
roleRouter.post('/update', __.checkRole('roleSetup').validate, (req, res)=>{
    roleController.update(req, res);
});
roleRouter.post('/delete', __.checkRole('roleSetup').validate, (req, res)=>{
    roleController.delete(req, res);
});
// roleRouter.post('/test', roleController.test);


module.exports = roleRouter;