let express = require("express"),
  postRouter = express.Router(),
  path = require("path"),
  postController = require("../../controllers/common/postController"),
  companyPostController = require("../../controllers/company/postController"),
  passport = require("passport"),
  __ = require('../../../helpers/globalFunctions'),
  jwt = require("jsonwebtoken");

const multer = require("multer");

// Single File Upload
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Set Path
    let filePath = "/posts";
    cb(null, "public/uploads" + filePath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

var upload = multer({
  storage: storage
});

//RENDER
// postRouter.use(
//   passport.authenticate("jwt", {
//     session: false
//   }) /*Allow only admin*/,
//   function (req, res, next) {
//     next();
//   }
// );

postRouter.get("/readOne/:postId", async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user);
  if (routeprivilege.newsAndEvents) {
    postController.readOne(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }
});

postRouter.post("/read", (req, res) => {
  postController.read(req, res);
});

postRouter.post("/readnew", (req, res) => {
  postController.readNew(req, res);
});

const newsAndEvents = async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user);
  if (routeprivilege.newsAndEvents) {
    switch (req.route.path) {
      case "/comment": postController.commentPost(req, res); break;
      case "/deleteComment": postController.deleteComment(req, res); break;
      case "/sharePost": postController.sharePost(req, res); break;
      case "/reportComment": postController.reportComment(req, res); break;
      case "/like": postController.likePost(req, res); break;
      default:
        break;
    }
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }
}

postRouter.post("/comment", newsAndEvents);
postRouter.post("/deleteComment", newsAndEvents);
postRouter.post("/sharePost", newsAndEvents);
postRouter.post("/reportComment", newsAndEvents);
postRouter.post("/like", newsAndEvents);
postRouter.get("/getUserChannels", (req, res) => {
  postController.getUserChannels(req, res);
});

postRouter.post("/viewComments/:postId", async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user);
  if (routeprivilege.newsAndEvents) {
    postController.viewComments(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }
});

postRouter.post("/uploadContentFiles", upload.single("file"), (req, res) => {
  companyPostController.uploadContentFiles(req, res);
});

module.exports = postRouter;
