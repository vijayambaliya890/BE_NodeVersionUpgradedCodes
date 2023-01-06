let express = require('express'),
  channelRouter = express.Router(),
  channelController = require('../../controllers/company/channelController'),
  passport = require('passport'),
  __ = require('../../../helpers/globalFunctions'),
  jwt = require('jsonwebtoken');

//RENDER

channelRouter.use(
  passport.authenticate('jwt', {
    session: false,
  }),
  /*Allow only admin*/ (req, res, next) => {
    if (req.user.isFlexiStaff !== 1) {
      next();
    } else {
      return res.status(402).send('This account is not permitted to access');
    }
  },
);

channelRouter.post('/', __.checkRole('channelSetup').validate, (req, res) => {
  channelController.create(req, res);
});
channelRouter.put(
  '/:channelId',
  __.checkRole('channelSetup').validate,
  (req, res) => {
    channelController.update(req, res);
  },
);
// API transform
channelRouter.get('/', (req, res) => {
  channelController.read(req, res);
});
// API transform
channelRouter.get('/:channelId', (req, res) => {
  channelController.readOne(req, res);
});

channelRouter.post('/readOneChannel', (req, res) => {
  channelController.readOneChannel(req, res);
});

channelRouter.get('/remove/:channelId', (req, res) => {
  channelController.remove(req, res);
});
channelRouter.post('/getChannelUsers', (req, res) => {
  channelController.getChannelUsers(req, res);
});
channelRouter.get('/getChannelsForAdmin', (req, res) => {
  channelController.getChannelsForAdmin(req, res);
});

// channelRouter.post('/readOneChannel', (req, res) => {
//     channelController.readOneChannel(req, res)
// });

channelRouter.post('/export', (req, res) => {
  channelController.exportReport(req, res);
});

module.exports = channelRouter;
