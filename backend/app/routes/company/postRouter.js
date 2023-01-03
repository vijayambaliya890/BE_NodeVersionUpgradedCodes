let express = require('express'),
    postRouter = express.Router(),
    postController = require('../../controllers/company/postController'),
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
            case "/create":
                filePath = "/posts";
                break;
            case "/update":
                filePath = "/posts";
                break;
            case "/read":
                filePath = "/posts";
                break;
            case "/uploadContentFiles":
                filePath = "/posts";
                break;
            default:
                filePath = "";
        }
        cb(null, 'public/uploads' + filePath)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});
var upload = multer({
    storage: storage
});
var multiUpload = upload.fields([{
    name: 'teaserImage',
    maxCount: 1
}, {
    name: 'mainImage',
    maxCount: 1
}, {
    name: 'eventWallLogoImage',
    maxCount: 1
}
]);

//RENDER
postRouter.use(passport.authenticate('jwt', {
        session: false
    }), /*Allow only admin*/
    (req, res, next) => {
        if (req.user.isFlexiStaff !== 1)
            next();
        else
            return res.status(402).send('This account is not permitted to access');
    });

postRouter.post('/create', multiUpload, (req, res) => {
    postController.create(req, res)
});

postRouter.post('/update', multiUpload, (req, res) => {
    postController.update(req, res)
});

postRouter.get('/read', (req, res) => {    
    postController.read(req, res)
});

postRouter.get('/getManageNews', (req, res) => {
    postController.getManageNews(req, res)
});

postRouter.get('/readOne/:postId', (req, res) => {
    postController.readOne(req, res)
});

postRouter.get('/remove/:postId', (req, res) => {
    postController.remove(req, res)
});

postRouter.get('/reportedPosts/:postType', (req, res) => {
    postController.reportedPosts(req, res)
});

postRouter.get('/getAuthorChannels', (req, res) => {
    postController.getAuthorChannels(req, res)
});

postRouter.post('/uploadContentFiles', upload.single('file'), (req, res) => {
    postController.uploadContentFiles(req, res)
});

postRouter.get('/reportedPosts/:postType', (req, res) => {
    postController.reportedPosts(req, res)
});

postRouter.get('/reportedComments/:postType', (req, res) => {
    postController.reportedComments(req, res)
});

postRouter.post('/updatereviewPost/', (req, res) => {
    postController.updatereviewPost(req, res)
});

postRouter.post('/updateCommentStatus/', (req, res) => {
    postController.updateCommentStatus(req, res)
});

postRouter.post('/exportPost/', (req, res) => {
    postController.exportPost(req, res)
});

postRouter.post('/exportWall',(req,res)=>{
    postController.exportWallData(req,res);
}); 
module.exports = postRouter;
