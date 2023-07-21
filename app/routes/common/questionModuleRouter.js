let express = require('express'),
    moduleRouter = express.Router(),
    moduleController = require('../../controllers/common/questionModuleController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');


    moduleRouter.post('/isUserExistInQuestion', (req, res) => {
        moduleController.isUserExistInQuestion(req, res)
    });    

// moduleRouter.use(passport.authenticate('jwt', {
//         session: false
//     }), /*Allow only admin*/
//     function (req, res, next) {

//         // No Restrictions, Allow flexistaff & Non flexistaff
//         next();

//     });

moduleRouter.post('/getModuleQuestions', (req, res) => {
    moduleController.getModuleQuestions(req, res)
});

moduleRouter.post('/getPollingResult', (req, res) => {
    moduleController.getPollingResult(req, res)
});

moduleRouter.post('/resQuestions', (req, res) => {
    moduleController.resQuestions(req, res)
});

moduleRouter.post('/resCustomFormQuestions', (req, res) => {
    moduleController.resCustomFormQuestions(req, res)
});

moduleRouter.post('/customFormQuestionsUpdate', (req, res) => {
    moduleController.customFormQuestionsUpdate(req, res)
});

moduleRouter.get('/allTrackedAnswered', (req, res) => {
    moduleController.allTrackedAnswered(req, res)
});

module.exports = moduleRouter;