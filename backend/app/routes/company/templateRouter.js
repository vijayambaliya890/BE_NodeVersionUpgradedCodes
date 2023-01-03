let express = require('express'),
    templateRouter = express.Router(),
    templateController = require('../../controllers/company/templateController'),
    passport = require('passport'),
    __ = require('../../../helpers/globalFunctions'),
    jwt = require('jsonwebtoken');
//RENDER
templateRouter.use(passport.authenticate('jwt', {
        session: false
    }), /*Allow only admin*/
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

templateRouter.post('/create', __.checkRole('setTemplate').validate, (req, res)=>{
    templateController.createOrUpdate(req, res);
});
templateRouter.post('/read', templateController.read);
templateRouter.post('/update', __.checkRole('setTemplate').validate, (req, res)=>{
    templateController.createOrUpdate(req, res);
});
templateRouter.post('/deleteShiftInTemplate', __.checkRole('setTemplate').validate, (req, res)=>{
    templateController.deleteShiftInTemplate(req, res);
});
templateRouter.post('/remove', __.checkRole('setTemplate').validate, (req, res)=>{
    templateController.remove(req, res);
});
templateRouter.post('/renameTemplate', __.checkRole('setTemplate').validate, (req, res)=>{
    templateController.renameTemplate(req, res);
});

module.exports = templateRouter;