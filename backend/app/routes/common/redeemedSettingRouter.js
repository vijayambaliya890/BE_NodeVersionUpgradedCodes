const express = require("express"),
  settingRouter = express.Router(),
  settingController = require("../../controllers/common/redeemedSettingController"),
  passport = require("passport"),
  jwt = require("jsonwebtoken"),
  uuid = require("node-uuid"),
  multer = require("multer"),
  path = require("path"),
  storage = multer.diskStorage({
    destination: "public/uploads/wall",
    filename: function(req, file, cb) {
      cb(null, uuid.v4() + path.extname(file.originalname));
    }
  }),
  upload = multer({
    storage: storage
  });

//RENDER
settingRouter.use(
  passport.authenticate("jwt", {
    session: false
  }) /*Allow only admin*/,
  function(req, res, next) {
    next();
  }
);

settingRouter.post("/redeemedLanding", (req, res) => {
  settingController.redeemedLanding(req, res);
});

settingRouter.post("/redeemedCategory", (req, res) => {
  settingController.redeemedCategory(req, res);
});

settingRouter.get("/getSetting", (req, res) => {
  settingController.getSetting(req, res);
});

settingRouter.post("/categoryName", (req, res) => {
  settingController.redeemedAddCategory(req, res);
});

settingRouter.post("/categoryName/:id", (req, res) => {
  settingController.redeemedUpdateCategory(req, res);
});

module.exports = settingRouter;
