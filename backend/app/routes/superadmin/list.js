let express = require('express'),
    superAdminListRouter = express.Router(),
    superAdminListController = require('../../controllers/superadmin/list.js'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');

superAdminListRouter.post('/',(req, res) => {
   superAdminListController.getList(req, res)
});

module.exports = superAdminListRouter;
