let express = require('express'),
addOnSchemesRouter = express.Router(),
addOnSchemesController = require('../../controllers/company/addOnSchemesController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');


//RENDER

addOnSchemesRouter.use(passport.authenticate('jwt', {
    session: false
}), /*Allow only admin*/(req, res, next) => {
    if (req.user.isFlexiStaff !== 1) {
        next();
    } else {
        return res.status(402).send('This account is not permitted to access');
    }
});

addOnSchemesRouter.post('/create', (req, res)=>{
    console.log("create route=======================");
    addOnSchemesController.create(req, res);
});
addOnSchemesRouter.post('/update/:id', (req, res)=>{
    addOnSchemesController.update(req, res);
});

addOnSchemesRouter.post('/read', (req, res) => {
    addOnSchemesController.getAddOnScheme(req, res)
});

addOnSchemesRouter.post('/remove/:schemeId', (req, res) => {
    addOnSchemesController.remove(req, res);
});

module.exports = addOnSchemesRouter;
