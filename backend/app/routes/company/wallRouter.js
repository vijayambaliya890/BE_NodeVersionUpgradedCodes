let express = require('express'),
    wallRouter = express.Router(),
    wallController = require('../../controllers/company/wallController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken'),
    uuid = require('node-uuid'),
    multer = require('multer'),
    path = require('path'),
    storage = multer.diskStorage({
        destination: 'public/uploads/wall',
        filename: function (req, file, cb) {
            cb(null, uuid.v4() + path.extname(file.originalname));
        }
    }),

    upload = multer({
        storage: storage
    });

wallRouter.use(passport.authenticate('jwt', {
        session: false
    }), /*Allow only admin*/
    function (req, res, next) {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

//1.uploading banner Image
wallRouter.post('/uploadFiles', upload.single('file'), (req, res) => {
    wallController.uploadFiles(req, res)
});

//2.Creating new category
wallRouter.post('/addCategory', (req, res) => {
    wallController.addCategory(req, res)
});

//3.Adding newWall
wallRouter.post('/add', __.checkRole('manageWall').validate, (req, res)=>{
    wallController.addWall(req, res);
});

//4.Updating existingWall
wallRouter.post('/update', __.checkRole('manageWall').validate, (req, res)=> {
    wallController.updateWall(req, res)
});

//5.Remove Wall
wallRouter.post('/delete', __.checkRole('manageWall').validate, (req, res)=> {
    wallController.delete(req, res);
});

//6.Get all wall
wallRouter.get('/read', (req, res) => {
    wallController.read(req, res)
});

//6.Get single wall summary
wallRouter.get('/readOne', (req, res) => {
    wallController.readOne(req, res)
});

// Read Reported posts
wallRouter.get('/reportedPosts', (req, res) => {
    wallController.reportedPosts(req, res)
});

// Read Reported posts
wallRouter.post('/reviewPost', (req, res) => {
    wallController.reviewPost(req, res)
});

wallRouter.get('/reportedComments', (req, res) => {
    wallController.reportedComments(req, res)
});

wallRouter.post('/updateStatus', (req, res) => {
    wallController.updateStatus(req, res)
});

wallRouter.post('/exportWallPost', (req, res) => {
    wallController.exportWallPost(req, res)
});

wallRouter.get('/getWallPostDetails', (req, res) => {
    wallController.getWallPostsList(req, res)
});

wallRouter.get('/buToolQueryChecking', (req, res) => {
    wallController.buToolQueryChecking(req, res)
});

wallRouter.get('/getCompanyWalls', (req, res) => {
    wallController.getCompanyWalls(req, res)
});

module.exports = wallRouter;