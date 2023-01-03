let express = require('express'),
    companyRouter = new express.Router(),
    companyController = require('../../controllers/superadmin/companyController.js'),
    passport = require('passport'),
    path = require('path'),
    jwt = require('jsonwebtoken');

const multer = require('multer');
// Single File Upload
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Set Path
        let filePath;
        switch (req.route.path) {
            case "/createCompany":
                filePath = "/companyLogos";
                break;
            case "/updateCompany":
                filePath = "/companyLogos";
                break;
            default:
                filePath = "";
        }
        cb(null, 'public/uploads' + filePath)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
})
var upload = multer({
    storage: storage
})

//RENDER

companyRouter.use(passport.authenticate('jwt', {
        session: false
    }), /*Allow only FLEXISTAFF*/
    function (req, res, next) {
        if (req.user.role === "superadmin") {
            next();
        } else {
            return res.status(402).send('This account is not permitted to access');
        }
    });

companyRouter.post('/createCompany', upload.single('file'), (req, res) => {
    companyController.createCompany(req, res)
});

companyRouter.get('/getCompany/:companyId', (req, res) => {
    companyController.getCompany(req, res)
});

companyRouter.get('/companyList', (req, res) => {
    companyController.companyList(req, res)
});

companyRouter.post('/updateCompany', upload.single('file'), (req, res) => {
    companyController.updateCompany(req, res)
});

companyRouter.get('/deleteCompany/:companyId', (req, res) => {
    companyController.deleteCompany(req, res)
});

// companyRouter.get('/createRole', (req, res) => {
//     companyController.createRole(req, res)
// });

module.exports = companyRouter;