const express = require('express'),
    LogRouter = express.Router(),
    logController = require('../controllers/common/logController');
    LogRouter.post('/setLog', (req, res) => {
        logController.setLog(req, res);
    });
    module.exports = LogRouter;