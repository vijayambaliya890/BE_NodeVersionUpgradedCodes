let express = require("express"),
  rewardsRouter = express.Router(),
  rewardsController = require("../../controllers/common/rewardsController"),
  passport = require("passport"),
  jwt = require("jsonwebtoken"),
  uuid = require("node-uuid"),
  multer = require("multer"),
  path = require("path"),
  __ = require('../../../helpers/globalFunctions'),
  storage = multer.diskStorage({
    destination: "public/uploads/reward",
    filename: function (req, file, cb) {
      cb(null, uuid.v4() + path.extname(file.originalname));
    }
  }),
  upload = multer({
    storage: storage
  });

//RENDER
rewardsRouter.use(
  passport.authenticate("jwt", {
    session: false
  }) /*Allow only admin*/,
  function (req, res, next) {
    next();
  }
);

rewardsRouter.get("/login", (req, res) => {
  rewardsController.redemptionLogin(req, res);
});

const myRewards = async (req, res) => {
  let routeprivilege = await __.getPrivilegeData(req.user._id);
  if (routeprivilege.myRewards) {
    switch (req.route.path) {
      case "/redemptionGamification": rewardsController.redemptionGamification(req, res); break;
      case "/redemptionHistory": rewardsController.rewardsDbHistory(req, res); break;
      case "/reward": rewardsController.redemptionReward(req, res); break;
      case "/wishlist": rewardsController.redemptionWishlist(req, res); break;
      case "/deleteWishlist": rewardsController.deleteWishlist(req, res); break;
      case "/redemptionNew": rewardsController.redemptionNew(req, res); break;
      case "/redemptionPopular": rewardsController.redemptionPopular(req, res); break;
      case "/getCategorywiseList": rewardsController.rewardCategorywiseList(req, res); break;
      case "/redeemedVouchersDetails/:productCode": rewardsController.redeemedVouchersDetails(req, res); break;
      case "/vouchersRequest/:productCode": rewardsController.redemptionVouchersRequest(req, res); break;
      case "/saveVoucherDetail": rewardsController.saveVoucherDetail(req, res); break;
      case "/getVoucherList": rewardsController.getVoucherList(req, res); break;
      case "/redeemedRewardSaveProduct/:productCode": rewardsController.redeemedRewardSaveProductDetails(req, res); break;
      default:
        break;
    }
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }
}

rewardsRouter.get("/redemptionGamification", myRewards);
rewardsRouter.get("/redemptionHistory", myRewards);
rewardsRouter.post("/reward", myRewards);
rewardsRouter.post("/wishlist", myRewards);
rewardsRouter.post("/deleteWishlist", myRewards);
rewardsRouter.get("/redemptionNew", myRewards);
rewardsRouter.get("/redemptionPopular", myRewards);
rewardsRouter.get("/getCategorywiseList", myRewards);
rewardsRouter.get("/redeemedVouchersDetails/:productCode", myRewards);
rewardsRouter.get('/vouchersRequest/:productCode', myRewards);
rewardsRouter.post('/saveVoucherDetail', myRewards);
rewardsRouter.get('/getVoucherList', myRewards);
rewardsRouter.get('/redeemedRewardSaveProduct/:productCode', myRewards);

rewardsRouter.get("/type/:rewardType", async (req, res) => {
  let routeprivilege = await __.getPrivilegeData(req.user._id);
  if (routeprivilege.myRewards) {
    rewardsController.redemptionType(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }
});

rewardsRouter.get("/category/:rewardCategory/:subCategory", async (req, res) => {
  let routeprivilege = await __.getPrivilegeData(req.user._id);
  if (routeprivilege.myRewards) {
    rewardsController.redemptionCategory(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }
});

rewardsRouter.get("/details/:rewardDetails", async (req, res) => {
  let routeprivilege = await __.getPrivilegeData(req.user._id);
  if (routeprivilege.myRewards) {
    rewardsController.redemptionDetails(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }
});

rewardsRouter.get("/history/:rewardHistory/:rewardDate", async (req, res) => {
  let routeprivilege = await __.getPrivilegeData(req.user._id);
  if (routeprivilege.myRewards) {
    rewardsController.redemptionHistory(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }
});





rewardsRouter.get("/search/:rewardSearch", async (req, res) => {
  let routeprivilege = await __.getPrivilegeData(req.user._id);
  if (routeprivilege.myRewards) {
    rewardsController.redemptionSearch(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }
});



rewardsRouter.get("/rewardsHistory", async (req, res) => {
  let routeprivilege = await __.getPrivilegeData(req.user._id);
  if (routeprivilege.redemptionList) {
    rewardsController.rewardsHistory(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }
});

rewardsRouter.get("/rewardsHistoryExport", async (req, res) => {
  let routeprivilege = await __.getPrivilegeData(req.user._id);
  if (routeprivilege.redemptionList) {
    rewardsController.rewardsHistoryExport(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }
});

module.exports = rewardsRouter;
