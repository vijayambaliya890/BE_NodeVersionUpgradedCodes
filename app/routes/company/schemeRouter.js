let express = require('express'),
    schemeRouter = express.Router(),
    schemeController = require('../../controllers/company/schemeController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken');




//RENDER

schemeRouter.use(
    function (req, res, next) {
        console.log('req ', req.originalUrl);
        if (req.user.isFlexiStaff !== 1)
            next();
        else if (req.originalUrl == '/scheme/userScheme/noOfWeek')
            next()
        else
            return res.status(402).send('This account is not permitted to access');
    });

schemeRouter.post('/', (req, res) => {
    schemeController.create(req, res)
});
schemeRouter.post('/mimetype', (req, res) => {
    schemeController.mimeType(req, res)
});
schemeRouter.get('/:companyId', (req, res) => {
    schemeController.read(req, res)
});
schemeRouter.get('/specific/:schemeId', (req, res) => {
    schemeController.readScheme(req, res)
});
schemeRouter.post('/update', (req, res) => {
    schemeController.update(req, res)
});

schemeRouter.post('/userlog', (req, res) => {
    schemeController.readUserLog(req, res)
});

schemeRouter.get('/userScheme/noOfWeek', (req, res) => {
    schemeController.getNumberOfWeekForSchemeId(req, res)
});

module.exports = schemeRouter;
