let express = require('express'),
    facialDataRouter = express.Router(),
    facialDataController = require('../../controllers/company/facialDataController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');


//RENDER

facialDataRouter.use((req, res, next) => {
    if (req.user.isFlexiStaff !== 1)
        next();
    else
        return res.status(402).send('This account is not permitted to access');
});

facialDataRouter.post('/create', (req, res) => {
    facialDataController.create(req, res)
});

facialDataRouter.post('/read', (req, res) => {
    facialDataController.read(req, res)
});

facialDataRouter.post('/getqrcode', (req, res) => {
    facialDataController.getQrCode(req, res)
});

facialDataRouter.post('/verifyqrcode', (req, res) => {
    facialDataController.verifyQrCode(req, res)
});
facialDataRouter.get('/list/:businessUnitId', (req, res) => {
    facialDataController.list(req, res)
});

module.exports = facialDataRouter;
