let express = require('express'),
    staffPostRouter = express.Router(),
    staffPostController = require('../../controllers/staff/staffPostController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');

//RENDER
staffPostRouter.use(passport.authenticate('jwt', {
        session: false
    }), /*Allow only admin*/
    function (req, res, next) {
        if (req.user.isFlexiStaff === 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

staffPostRouter.get('/readOne/:postId', (req, res) => {
    staffPostController.readOne(req, res)
});

staffPostRouter.post('/read', (req, res) => {
    staffPostController.read(req, res)
});

module.exports = staffPostRouter;