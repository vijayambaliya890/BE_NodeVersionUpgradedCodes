let express = require('express'),
    reportPostRouter = express.Router(),
    reportPostController = require('../../controllers/common/reportPostController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');

// reportPostRouter.use(passport.authenticate('jwt', {
//         session: false
//     }), /*Allow only admin*/
//     function (req, res, next) {
//         // No Restrictions, Allow flexistaff & Non flexistaff
//         next();

//     });

reportPostRouter.post('/reportPost', (req, res) => {
    reportPostController.reportPost(req, res)
});

reportPostRouter.post('/reportComment', (req, res) => {
    reportPostController.reportCommment(req, res)
});

reportPostRouter.post('/reportChannelPost', (req, res) => {
    reportPostController.reportChannelPost(req, res)
});

// Not in use
reportPostRouter.post('/reportChannelComment', (req, res) => {
    reportPostController.reportChannelComment(req, res)
});


module.exports = reportPostRouter;