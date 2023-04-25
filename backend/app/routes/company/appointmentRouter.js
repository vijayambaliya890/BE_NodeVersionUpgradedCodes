let express = require('express'),
  appointmentRouter = express.Router(),
  appointmentController = require('../../controllers/company/appointmentController'),
  passport = require('passport'),
  jwt = require('jsonwebtoken');

//RENDER
appointmentRouter.get(
  '/getAppointments',
  appointmentController.getAppointments,
);

appointmentRouter.use(
  passport.authenticate('jwt', {
    session: false,
  }) /*Allow only admin*/,
  function (req, res, next) {
    if (req.user.isFlexiStaff !== 1) next();
    else return res.status(402).send('This account is not permitted to access');
  },
);

appointmentRouter.post('/create', (req, res) => {
  appointmentController.create(req, res);
});

appointmentRouter.post('/read', (req, res) => {
  appointmentController.read(req, res);
});

appointmentRouter.get('/', (req, res) => {
  appointmentController.getAll(req, res);
});

appointmentRouter.post('/fromuser', (req, res) => {
  appointmentController.getAllAppointmentFromUser(req, res);
});

appointmentRouter.post('/readWithPn', (req, res) => {
  appointmentController.readWithPn(req, res);
});

appointmentRouter.post('/update', (req, res) => {
  appointmentController.update(req, res);
});

appointmentRouter.post('/delete', (req, res) => {
  appointmentController.delete(req, res);
});

// appointmentRouter.post('/test', appointmentController.test);

module.exports = appointmentRouter;
