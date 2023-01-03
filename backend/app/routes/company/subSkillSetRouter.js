let express = require('express'),
    subSkillSetRouter = express.Router(),
    subSkillSetController = require('../../controllers/company/subSkillSetController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');




//RENDER

subSkillSetRouter.use(passport.authenticate('jwt', {
        session: false
    }), /*Allow only admin*/
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

subSkillSetRouter.post('/create', (req, res) => {
    subSkillSetController.create(req, res)
});

subSkillSetRouter.post('/read', (req, res) => {
    subSkillSetController.read(req, res)
});


subSkillSetRouter.post('/update', (req, res) => {
    subSkillSetController.update(req, res)
});


subSkillSetRouter.post('/delete', (req, res) => {
    subSkillSetController.delete(req, res)
});


// subSkillSetRouter.post('/test', subSkillSetController.test);

module.exports = subSkillSetRouter;