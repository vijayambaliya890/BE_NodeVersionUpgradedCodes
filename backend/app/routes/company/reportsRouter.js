let express = require('express'),
    reportsRouter = express.Router(),
    reportsController = require('../../controllers/company/reportsController'),
    passport = require('passport'),
    __ = require('../../../helpers/globalFunctions'),
    jwt = require('jsonwebtoken');




//RENDER

reportsRouter.use(passport.authenticate('jwt', { session: false }), /*Allow only admin*/ function (req, res, next) {
    if (req.user.isFlexiStaff !== 1){
        next();
    } else {
        return res.status(402).send('This account is not permitted to access');
    }
});
reportsRouter.post('/bookings', (req, res)=>{
    reportsController.bookings(req, res);
});
reportsRouter.post('/listofshifts',(req,res)=>{
     reportsController.listOfShifts(req, res)
    });
reportsRouter.post('/listofcancellations', (req, res) => {
    reportsController.listOfCancellations(req, res)
});
reportsRouter.post('/users', reportsController.users);

module.exports = reportsRouter;