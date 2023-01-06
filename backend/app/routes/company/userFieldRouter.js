let express = require('express'),
  userFieldRouter = express.Router(),
  userFieldController = require('../../controllers/company/userFieldController'),
  passport = require('passport'),
  jwt = require('jsonwebtoken');

//RENDER

userFieldRouter.use(
  passport.authenticate('jwt', {
    session: false,
  }) /*Allow only admin*/,
  (req, res, next) => {
    if (req.user.isFlexiStaff !== 1) next();
    else return res.status(402).send('This account is not permitted to access');
  },
);

userFieldRouter.post('/create', (req, res) => {
  console.log('/create');
  userFieldController.create(req, res);
});

userFieldRouter.post('/update', (req, res) => {
  userFieldController.update(req, res);
});

userFieldRouter.get('/read', (req, res) => {
  userFieldController.read(req, res);
});

userFieldRouter.get('/', (req, res) => {
  userFieldController.getAll(req, res);
});

userFieldRouter.get('/remove/:fieldId', (req, res) => {
  userFieldController.remove(req, res);
});

module.exports = userFieldRouter;
