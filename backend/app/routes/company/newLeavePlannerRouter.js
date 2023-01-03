let express = require("express"),
  newLeavePlannerRouter = express.Router(),
  newLeavePlannerController = require("../../controllers/company/newLeavePlannerController"),
  passport = require("passport"),
  jwt = require("jsonwebtoken");

//RENDER

newLeavePlannerRouter.use(
  passport.authenticate("jwt", {
    session: false,
  }) /*Allow only admin*/,
  (req, res, next) => {
    if (req.user.isFlexiStaff !== 1) next();
    else next();
  }
);

newLeavePlannerRouter.post("/leavetype", (req, res) => {
  // check if user role has access to this module
  newLeavePlannerController.getLeaveType(req, res);
});
newLeavePlannerRouter.post("/leavetype/bu", (req, res) => {
  // check if user role has access to this module
  newLeavePlannerController.getLeaveTypeBu(req, res);
});
newLeavePlannerRouter.post("/usersbydate", (req, res) => {
  // check if user role has access to this module
  newLeavePlannerController.getUsersByDate(req, res);
});
newLeavePlannerRouter.post("/export", (req, res) => {
  // check if user role has access to this module
  newLeavePlannerController.export(req, res);
});
newLeavePlannerRouter.post("/usersbydate/bu", (req, res) => {
  // check if user role has access to this module
  newLeavePlannerController.getUsersByDateBu(req, res);
});
newLeavePlannerRouter.post("/staffleavetype", (req, res) => {
  // check if user role has access to this module
  newLeavePlannerController.getStaffLeaveType(req, res);
});
newLeavePlannerRouter.post("/allocateleave", (req, res) => {
  // check if user role has access to this module
  newLeavePlannerController.allocateLeave(req, res);
});
newLeavePlannerRouter.post("/mobilescreenforleaves", (req, res) => {
  // check if user role has access to this module
  newLeavePlannerController.mobileScreenForLeaves(req, res);
});
newLeavePlannerRouter.post("/cancel", (req, res) => {
  // check if user role has access to this module
  newLeavePlannerController.cancelAllocation(req, res);
});

module.exports = newLeavePlannerRouter;
