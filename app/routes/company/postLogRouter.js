let express = require('express'),
  postLogRouter = express.Router(),
  postLogController = require('../../controllers/company/postLogController'),
  passport = require('passport'),
  jwt = require('jsonwebtoken');

//RENDER

postLogRouter.use(function (req, res, next) {
  if (req.user.isFlexiStaff !== 1) next();
  else return res.status(402).send('This account is not permitted to access');
});

postLogRouter.get('/', (req, res) => {
  postLogController.read(req, res);
});

module.exports = postLogRouter;
