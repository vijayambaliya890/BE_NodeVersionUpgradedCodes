let express = require('express'),
    externalRouter = new express.Router(),
    customFormController = require('../controllers/company/customFormController.js'),
    moduleController = require('../controllers/common/questionModuleController'),
    challengeController = require('../controllers/common/challengeController'),
    centralBuilderController = require('../controllers/company/centralBuilderController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken'),
    multer = require('multer'),
    uuid = require('node-uuid'),
    path = require('path'),
    storage = multer.diskStorage({
        destination: 'public/uploads/customForm',
        filename: function (req, file, cb) {
            cb(null, uuid.v4() + path.extname(file.originalname));
        }
    }),
    upload = multer({
        storage: storage
    });

externalRouter.post('/readExternalDatas/', (req, res) => {
    customFormController.readExternalCustomFormData(req, res)
});
externalRouter.post('/readExternalData', (req, res) => {
    moduleController.getInternalModuleQuestions(req, res)
});
externalRouter.post('/uploadFiles/',upload.single('file'), (req, res) => {
    customFormController.uploadContentFiles(req, res)
});
externalRouter.post('/resQuestions/', (req, res) => {
    moduleController.resCustomFormQuestions(req, res)
});

externalRouter.post('/getChannelOrBoardsUsers', (req, res) => {
    challengeController.getChannelOrBoardsUsers(req, res);
});



module.exports = externalRouter;