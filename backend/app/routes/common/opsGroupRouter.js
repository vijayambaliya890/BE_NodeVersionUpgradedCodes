let express = require('express'),
  oopsGroupRouter = express.Router(),
  passport = require('passport'),
  oopsGroupController = require('../../controllers/common/opsGroupController');

oopsGroupRouter.use(
  passport.authenticate('jwt', {
    session: false,
  }) /*Allow only admin*/,
  function (req, res, next) {
    next();
  },
);
oopsGroupRouter.post('/create', (req, res) => {
  oopsGroupController.create(req, res);
});

oopsGroupRouter.post('/read', (req, res) => {
  oopsGroupController.read(req, res);
});

oopsGroupRouter.post('/get', (req, res) => {
  oopsGroupController.getDetails(req, res);
});

oopsGroupRouter.post('/update', (req, res) => {
  oopsGroupController.update(req, res);
});

oopsGroupRouter.delete('/remove', (req, res) => {
  oopsGroupController.remove(req, res);
});

oopsGroupRouter.post('/buName', (req, res) => {
  oopsGroupController.buName(req, res);
});

oopsGroupRouter.post('/getUsersByBuId', (req, res) => {
  oopsGroupController.getUsersByBuId(req, res);
});

oopsGroupRouter.post('/addUserFromBu', (req, res) => {
  oopsGroupController.addUserFromBu(req, res);
});

oopsGroupRouter.post('/transferFromOpsGroup', (req, res) => {
  oopsGroupController.transferFromOpsGroup(req, res);
});

oopsGroupRouter.post('/getOpsUsers', (req, res) => {
  oopsGroupController.getOpsUsers(req, res);
});

oopsGroupRouter.post('/getOpsList', (req, res) => {
  oopsGroupController.getOpsList(req, res);
});

oopsGroupRouter.post('/testremove', (req, res) => {
  oopsGroupController.transferDelete(req, res);
});
module.exports = oopsGroupRouter;
