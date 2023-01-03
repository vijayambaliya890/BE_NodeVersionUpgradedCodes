let express = require('express'),
    departmentRouter = express.Router(),
    departmentController = require('../../controllers/company/departmentController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');




//RENDER

departmentRouter.use(passport.authenticate('jwt', {
        session: false
    }), /*Allow only admin*/
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

departmentRouter.post('/create', (req, res) => {
    departmentController.create(req, res)
});

departmentRouter.post('/read', (req, res) => {
    departmentController.read(req, res)
});

departmentRouter.post('/readWithPn', (req, res) => {
    departmentController.readWithPn(req, res)
});


departmentRouter.post('/update', (req, res) => {
    departmentController.update(req, res)
});


departmentRouter.post('/delete', (req, res) => {
    departmentController.delete(req, res)
});


// departmentRouter.post('/test', departmentController.test);

module.exports = departmentRouter;