let express = require('express'),
  customFormRouter = express.Router(),
  customFormController = require('../../controllers/company/customFormController'),
  passport = require('passport'),
  jwt = require('jsonwebtoken'),
  multer = require('multer'),
  uuid = require('node-uuid'),
  path = require('path'),
  __ = require('../../../helpers/globalFunctions'),
  storage = multer.diskStorage({
    destination: 'public/uploads/customForm',
    filename: function (req, file, cb) {
      cb(null, uuid.v4() + path.extname(file.originalname));
    },
  }),
  upload = multer({
    storage: storage,
  });

//RENDER
customFormRouter.get('/myForms/', (req, res) => {
  customFormController.readCustomForms(req, res);
});
customFormRouter.get('/readFormsandMyforms/', (req, res) => {
  customFormController.readFormsandMyforms(req, res);
});
customFormRouter.get('/ownSubmittedForms/', (req, res) => {
  customFormController.readOwnSubmittedForms(req, res);
});
customFormRouter.post('/getManageQuestions/', (req, res) => {
  customFormController.getManageQuestions(req, res);
});
customFormRouter.post('/getManageFormAnswers/', (req, res) => {
  customFormController.getManageFormAnswers(req, res);
});
customFormRouter.post('/getManageFormUsers/', (req, res) => {
  customFormController.getManageFormUsers(req, res);
});
/*Allow only admin*/

/* customFormRouter.use(passport.authenticate('jwt', {
    session: false
}),
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    }); */

customFormRouter.post(
  '/createCustomForm',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.createForm(req, res);
  },
);
customFormRouter.get(
  '/getFormSettings/:customFormId',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.getFormSettings(req, res);
  },
);
customFormRouter.post(
  '/setFormSettings',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.setFormSettings(req, res);
  },
);

customFormRouter.post(
  '/updateCustomForm',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.updateManageForm(req, res);
  },
);
customFormRouter.post(
  '/exportFormCsv',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.exportFormCsv(req, res);
  },
);
customFormRouter.get(
  '/readManageFormLog',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.readManageFormLog(req, res);
  },
);
customFormRouter.get(
  '/readManageFormLog/:manageFormId',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.readManageFormStatusLog(req, res);
  },
);
customFormRouter.get(
  '/readMManageFormLog/:manageFormId',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.readMManageFormLog(req, res);
  },
);
customFormRouter.get(
  '/readFormsList',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.readFormsList(req, res);
  },
);
customFormRouter.post(
  '/updateManageForm',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.updateManageFormData(req, res);
  },
);
customFormRouter.post(
  '/exportCustomForm',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.exportWallPost(req, res);
  },
);
customFormRouter.post(
  '/exportManageforms',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.exportManageforms(req, res);
  },
);
customFormRouter.post(
  '/readManageforms/:customFormId',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.readManageforms(req, res);
  },
);
customFormRouter.post(
  '/readMManageforms',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.readMManageforms(req, res);
  },
);
customFormRouter.get('/QuickNavFB/', (req, res) => {
  customFormController.readFormsandMyforms(req, res, true);
});
customFormRouter.get('/readForm/', (req, res) => {
  customFormController.readCustomForm(req, res);
});

customFormRouter.post('/getCustomFormsforAdmin', (req, res) => {
  customFormController.getCustomFormsforAdmin(req, res);
});

customFormRouter.post('/readOne/', (req, res) => {
  customFormController.readOne(req, res);
});

customFormRouter.post('/readCustomFormData/', (req, res) => {
  customFormController.readCustomFormData(req, res);
});

customFormRouter.post('/uploadFiles/', upload.single('file'), (req, res) => {
  customFormController.uploadContentFiles(req, res);
});

customFormRouter.post('/getManageForm/', (req, res) => {
  customFormController.getManageFormData(req, res);
});

customFormRouter.post('/getManageData/', (req, res) => {
  customFormController.getManageData(req, res);
});
customFormRouter.post('/getManageQuestions/', (req, res) => {
  customFormController.getManageQuestions(req, res);
});
customFormRouter.post('/getManageFormUsers/', (req, res) => {
  customFormController.getManageFormUsers(req, res);
});

customFormRouter.post('/getCustomFormStatus/', (req, res) => {
  customFormController.getCustomFormStatus(req, res);
});
customFormRouter.get('/getExternalFormsBaseUrl/', (req, res) => {
  customFormController.getExternalFormsBaseUrl(req, res);
});

customFormRouter.put('/updateForm/', (req, res) => {
  customFormController.updateForm(req, res);
});
customFormRouter.post(
  '/updateWorkflowStatus',
  __.checkRole('setUpForm').validate,
  (req, res) => {
    customFormController.updateManageformWorkflowStatus(req, res);
  },
);

module.exports = customFormRouter;
