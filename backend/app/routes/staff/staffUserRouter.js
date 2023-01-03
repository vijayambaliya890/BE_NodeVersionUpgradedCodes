let express = require('express'),
    staffUserRouter = express.Router(),
    staffUserController = require('../../controllers/staff/staffUserController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken'),
    multer = require('multer'),
    uuid = require('node-uuid'),
    path = require('path'),
    storage = multer.diskStorage({
        destination: 'public/uploads/profilePictures',
        filename: function (req, file, cb) {
            cb(null, uuid.v4() + path.extname(file.originalname));
        }
    }),
    upload = multer({
        storage: storage
    });




//RENDER

staffUserRouter.use(passport.authenticate('jwt', {
        session: false
    }), /*Allow only FLEXISTAFF*/
    function (req, res, next) {
        if (req.user.isFlexiStaff === 1 || req.url === '/read' || req.url === '/getStaff')
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });


staffUserRouter.get('/read', (req, res) => {
    staffUserController.read(req, res)
});

staffUserRouter.post('/getStaff', (req, res) => {
    staffUserController.getStaffs(req, res)
});


staffUserRouter.post('/update', upload.single('profilePicture'), (req, res) => {
    staffUserController.update(req, res)
});

staffUserRouter.post('/test', (req, res) => {
    staffUserController.test(req, res)
});



module.exports = staffUserRouter;