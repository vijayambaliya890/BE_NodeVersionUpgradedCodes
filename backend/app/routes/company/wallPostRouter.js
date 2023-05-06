let express = require('express'),
    wallPostRouter = express.Router(),
    wallPostController = require('../../controllers/common/wallPostController'),
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


// wallPostRouter.use(
//     function (req, res, next) {
//         // No Restrictions, Allow flexistaff & Non flexistaff
//         next();

//     });

wallPostRouter.post('/createPost', (req, res) => {
    wallPostController.createPost(req, res)
});

wallPostRouter.post('/uploadFiles', upload.single('file'), (req, res) => {
    wallPostController.uploadFiles(req, res)
});

wallPostRouter.post('/update', (req, res) => {
    wallPostController.updatePost(req, res)
});

wallPostRouter.post('/delete', (req, res) => {
    wallPostController.deletePost(req, res)
});

wallPostRouter.post('/like', (req, res) => {
    wallPostController.likePost(req, res)
});

wallPostRouter.post('/addEmoji', (req, res) => {
    wallPostController.addEmoji(req, res)
});

wallPostRouter.post('/comment', (req, res) => {
    wallPostController.commentPost(req, res)
});

wallPostRouter.post('/share', (req, res) => {
    wallPostController.sharePost(req, res)
});

wallPostRouter.post('/deleteComment', (req, res) => {
    wallPostController.deleteComment(req, res)
});

wallPostRouter.post('/addTask', (req, res) => {
    wallPostController.addTask(req, res)
});

wallPostRouter.post('/addNominees', (req, res) => {
    wallPostController.addNominees(req, res)
});

module.exports = wallPostRouter;