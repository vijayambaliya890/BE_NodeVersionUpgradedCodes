let express = require('express'),
    integrationRouter = express.Router(),
    passport = require('passport'),
    integrationController = require('./../../controllers/company/integrationController');

    integrationRouter.use(function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

integrationRouter.get('/read', (req, res)=>{
    integrationController.read(req, res);
});
integrationRouter.get('/readMasterData', (req, res)=>{
    integrationController.readMasterData(req, res);
});
integrationRouter.get('/readQuota', (req, res)=>{
    integrationController.readQuota(req, res);
});
integrationRouter.get('/readApprove', (req, res)=>{
    integrationController.readApprove(req, res);
});

module.exports = integrationRouter;