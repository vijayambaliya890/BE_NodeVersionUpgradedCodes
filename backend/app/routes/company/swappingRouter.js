let express = require("express"),
  swappingRouter = express.Router(),
  swappingController = require("../../controllers/company/swappingController"),
  passport = require("passport"),
  jwt = require("jsonwebtoken"),
  multer = require("multer"),
  uuid = require("node-uuid"),
  path = require("path"),
  storage = multer.diskStorage({
    destination: "public/uploads/leaveManagementAttachment",
    filename: function (req, file, cb) {
      console.log("file", file);
      cb(null, uuid.v4() + path.extname(file.originalname));
    },
  }),
  upload = multer({
    storage: storage,
  });

console.log("ehehhe");
//RENDER

swappingRouter.use(
  passport.authenticate("jwt", {
    session: false,
  }) /*Allow only admin*/,
  (req, res, next) => {
    if (req.user.isFlexiStaff !== 1) next();
    else next();
  }
);

swappingRouter.post("/apply", (req, res) => {
  swappingController.swapApply(req, res);
});
swappingRouter.post("/stafflist", (req, res) => {
  swappingController.getStaffList(req, res);
});
swappingRouter.post("/sentrequest", (req, res) => {
  swappingController.getSentSwapRequest(req, res);
});
swappingRouter.post("/receivedrequest", (req, res) => {
  swappingController.getReceivedSwapRequest(req, res);
});
swappingRouter.post("/staff/senderhavedate", (req, res) => {
  swappingController.checkIfSenderHaveDate(req, res);
});
swappingRouter.post("/staff/receiverhavedate", (req, res) => {
  swappingController.checkIfReceiverHaveDate(req, res);
});
swappingRouter.post("/cancel", (req, res) => {
  swappingController.cancelSwapRequest(req, res);
});
swappingRouter.post("/acceptreject", (req, res) => {
  swappingController.updateSwapRequest(req, res);
});
swappingRouter.get("/", (req, res) => {
  swappingController.swapLog(req, res);
});
// auto reject logic
module.exports = swappingRouter;
