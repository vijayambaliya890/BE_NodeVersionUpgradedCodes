let express = require('express'),
    centralBuilderRouter = express.Router(),
    centralBuilderController = require('../../controllers/company/centralBuilderController'),
    __ = require('../../../helpers/globalFunctions'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');


//RENDER

// centralBuilderRouter.use(passport.authenticate('jwt', {
//         session: false
//     }), /*Allow only admin*/
//     (req, res, next) => {
//         if (req.user.isFlexiStaff !== 1)
//             next();
//         else
//             return res.status(402).send('This account is not permitted to access');
//     });
        
centralBuilderRouter.post('/create', __.checkRole('centralBuilder').validate, (req, res)=>{
    centralBuilderController.create(req, res);
});
centralBuilderRouter.post('/update', __.checkRole('centralBuilder').validate, (req, res)=>{
    centralBuilderController.update(req, res);
});
centralBuilderRouter.post('/questionsUpdate', __.checkRole('centralBuilder').validate, (req, res)=>{
    centralBuilderController.questionsUpdate(req, res);
});
centralBuilderRouter.post('/removeQuestion', __.checkRole('centralBuilder').validate, (req, res)=>{
    centralBuilderController.removeQuestions(req, res);
});
centralBuilderRouter.post('/updateModule', __.checkRole('centralBuilder').validate, (req, res)=>{
    centralBuilderController.updateModule(req, res);
});

centralBuilderRouter.get('/remove/:moduleId', __.checkRole('centralBuilder').validate, (req, res)=>{    
    centralBuilderController.remove(req, res);
});


centralBuilderRouter.get('/read', (req, res) => {
    centralBuilderController.read(req, res)
});
centralBuilderRouter.get('/readCentralBuilder', (req, res) => {
    centralBuilderController.readCentralBuilder(req, res)
});
centralBuilderRouter.get('/readMCentralBuilder', (req, res) => {
    centralBuilderController.readMCentralBuilder(req, res)
});

centralBuilderRouter.get('/readOne/:moduleId', (req, res) => {
    centralBuilderController.readOne(req, res)
});

/*
centralBuilderRouter.post('/questionsUpdate', (req, res) => {
    centralBuilderController.questionsUpdate(req, res);
});

centralBuilderRouter.post('/removeQuestion', (req, res) => {
    centralBuilderController.removeQuestions(req, res)
});*/




module.exports = centralBuilderRouter;