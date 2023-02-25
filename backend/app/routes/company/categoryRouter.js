let express = require('express'),
  categoryRouter = express.Router(),
  categoryController = require('../../controllers/company/categoryController'),
  passport = require('passport'),
  jwt = require('jsonwebtoken');

//RENDER

categoryRouter.use(
  passport.authenticate('jwt', {
    session: false,
  }) /*Allow only admin*/,
  function (req, res, next) {
    if (req.user.isFlexiStaff !== 1) next();
    else return res.status(402).send('This account is not permitted to access');
  },
);

categoryRouter.post('/create', (req, res) => {
  categoryController.create(req, res);
});

categoryRouter.post('/', (req, res) => {
  categoryController.createNew(req, res);
});
// API transform
categoryRouter.get('/', (req, res) => {
  categoryController.read(req, res);
});

// API transform
categoryRouter.get('/getChannelCategories/:channelId', (req, res) => {
  categoryController.readOne(req, res);
});

categoryRouter.post('/update', (req, res) => {
  categoryController.update(req, res);
});

categoryRouter.post('/delete', (req, res) => {
  categoryController.delete(req, res);
});

categoryRouter.delete('/:categoryId', (req, res) => {
  categoryController.deleteId(req, res);
});

// categoryRouter.post('/test', categoryController.test);

module.exports = categoryRouter;
