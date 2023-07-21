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


// wallPostRouter.use(passport.authenticate('jwt', {
//     session: false
// }), /*Allow only admin*/
//     function (req, res, next) {
//         // No Restrictions, Allow flexistaff & Non flexistaff
//         next();

//     });

const myBoards = async (req, res) => {
    const routeprivilege = await __.getPrivilegeData(req.user);
    if (routeprivilege.myBoards) {
        switch (req.route.path) {
            case '/createPost': wallPostController.createPost(req, res); break;
            case '/uploadFiles': wallPostController.uploadFiles(req, res); break;
            case '/update': wallPostController.updatePost(req, res); break;
            case '/comment': wallPostController.commentPost(req, res); break;
            case '/like': wallPostController.likePost(req, res); break;
            case '/addTask': wallPostController.addTask(req, res); break;
            case '/addNominees': wallPostController.addNominees(req, res); break;
            case '/delete': wallPostController.deletePost(req, res); break;
            case '/addEmoji': wallPostController.addEmoji(req, res); break;
            case '/share': wallPostController.sharePost(req, res); break;
            case '/deleteComment': wallPostController.deleteComment(req, res); break;
            case '/adminResponse': wallPostController.adminResponse(req, res); break;
            case '/deleteAdminResponse': wallPostController.deleteAdminResponse(req, res); break;
            default:
                break;
        }
    } else {
        return __.out(res, 300, 'This account is not permitted to access');
    }
}

wallPostRouter.post('/createPost', myBoards);
wallPostRouter.post('/uploadFiles', upload.single('file'), myBoards);
wallPostRouter.post('/update', myBoards);
wallPostRouter.post('/comment', myBoards);
wallPostRouter.post('/like', myBoards);
wallPostRouter.post('/addTask', myBoards);
wallPostRouter.post('/addNominees', myBoards);
wallPostRouter.post('/delete', myBoards);
wallPostRouter.post('/addEmoji', myBoards);
wallPostRouter.post('/share', myBoards);
wallPostRouter.post('/deleteComment', myBoards);
wallPostRouter.post('/adminResponse', myBoards);
wallPostRouter.post('/deleteAdminResponse', myBoards);




module.exports = wallPostRouter;