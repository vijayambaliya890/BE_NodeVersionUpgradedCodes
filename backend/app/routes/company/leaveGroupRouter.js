let express = require('express'),
    leaveGroupRouter = express.Router(),
    leaveGroupController = require('../../controllers/company/leaveGroupController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');


//RENDER

leaveGroupRouter.use((req, res, next) => {
    if (req.user.isFlexiStaff !== 1)
        next();
    else
        return res.status(402).send('This account is not permitted to access');
});

leaveGroupRouter.post('/create', (req, res) => {  // check if user role has access to this module
    leaveGroupController.create(req, res)
});
leaveGroupRouter.post('/update', (req, res) => {  // check if user role has access to this module
    leaveGroupController.update(req, res)
});
leaveGroupRouter.post('/delete', (req, res) => {  // check if user role has access to this module
    leaveGroupController.delete(req, res)
});
leaveGroupRouter.get('/get', (req, res) => {  // check if user role has access to this module
    leaveGroupController.get(req, res)
});
leaveGroupRouter.get('/bu/adminlist', (req, res) => {  // check if user role has access to this module
    leaveGroupController.adminListForBu(req, res)
});
module.exports = leaveGroupRouter;
