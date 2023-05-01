const channelRouter = require('../company/channelRouter');

const express = require('express'),
  challengeRouter = express.Router(),
  challengeController = require('../../controllers/common/challengeController'),
  passport = require('passport'),
  jwt = require('jsonwebtoken'),
  uuid = require('node-uuid'),
  multer = require('multer'),
  path = require('path'),
  __ = require('../../../helpers/globalFunctions'),
  storage = multer.diskStorage({
    destination: 'public/uploads/challenge',
    filename: function (req, file, cb) {
      cb(null, uuid.v4() + path.extname(file.originalname));
    },
  }),
  upload = multer({
    storage: storage,
  }),
  badgeStorage = multer.diskStorage({
    destination: 'public/uploads/challenge/badges',
    filename: function (req, file, cb) {
      cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    },
  }),
  badgeUpload = multer({
    storage: badgeStorage,
  });

const myChallenges = async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user._id);
  if (routeprivilege.challenges) {
    switch (req.route.path) {
      case '/appListOfChallenge':
        challengeController.appListOfChallenge(req, res);
        break;
      case '/appListOfAchievements':
        challengeController.appListOfAchievements(req, res);
        break;
      case '/appListOfRanks':
        challengeController.appListOfRanks(req, res);
        break;
      default:
        break;
    }
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }
};

// Disqualify a user for particular period
challengeRouter.post('/disqualifyUser', (req, res) => {
  challengeController.disqualifyUser(req, res);
});
// get disqualifier data
challengeRouter.get('/readDisqualifier', (req, res) => {
  challengeController.readDisqualifier(req, res);
});
// delete disqualifier data
challengeRouter.get('/deleteDisqualifier', (req, res) => {
  challengeController.deleteDisqualifier(req, res);
});

// Read Non reward points challenges
challengeRouter.get('/getPointsSummary', (req, res) => {
  challengeController.getPointsSummary(req, res);
});

challengeRouter.get(
  '/appListOfChallenge',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.appListOfChallenge(req, res);
  },
);
challengeRouter.get(
  '/appListOfAchievements',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.appListOfAchievements(req, res);
  },
);
challengeRouter.get(
  '/appListOfRanks',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.appListOfRanks(req, res);
  },
);
challengeRouter.get('/getRecentChallenges', async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user._id);
  if (!routeprivilege.challenges) {
    return __.out(res, 201, []);
  } else {
    challengeController.getRecentChallenges(req, res);
  }
});

//RENDER
challengeRouter.use(
  passport.authenticate('jwt', {
    session: false,
  }) /*Allow only admin*/,
  function (req, res, next) {
    next();
  },
);

challengeRouter.post(
  '/create',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.create(req, res);
  },
);
challengeRouter.post(
  '/update',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.update(req, res);
  },
);
challengeRouter.get(
  '/read',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.readChallenges(req, res);
  },
);

challengeRouter.get(
  '/read/new',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.readChallengesNew(req, res);
  },
);

challengeRouter.get(
  '/read/new/:challengeId',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.readChallengesSingle(req, res);
  },
);

challengeRouter.post(
  '/uploadFiles',
  upload.single('file'),
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.uploadContentFiles(req, res);
  },
);
challengeRouter.post(
  '/saveBadge',
  badgeUpload.single('file'),
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.saveBadge(req, res);
  },
);
challengeRouter.get(
  '/manageChallenge',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.manageChallenge(req, res);
  },
);
challengeRouter.get(
  '/getCountOfChallenges',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.getCountOfChallenges(req, res);
  },
);
challengeRouter.get(
  '/exportManageChallenge',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.exportManageChallenge(req, res);
  },
);
challengeRouter.get(
  '/getChannelsAndBoards',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.getChannelsAndBoards(req, res);
  },
);
challengeRouter.post(
  '/getChannelOrBoardsUsers',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.getChannelOrBoardsUsers(req, res);
  },
);
challengeRouter.get(
  '/getChallengesLog',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.getChallengesLog(req, res);
  },
);
challengeRouter.get(
  '/readChallengeCriteriaLog',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.readChallengeCriteriaLog(req, res);
  },
);
challengeRouter.get(
  '/getChallengesAndUsers',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.getChallengesAndUsers(req, res);
  },
);
challengeRouter.post(
  '/getChallengeUsers',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.getChallengeUsers(req, res);
  },
);

challengeRouter.get(
  '/getNomineeQuestions',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.getNomineeQuestions(req, res);
  },
);
challengeRouter.get('/readOne/:challengeId', (req, res) => {
  challengeController.readOne(req, res);
});
challengeRouter.get(
  '/getBadges',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.getBadges(req, res);
  },
);
challengeRouter.post(
  '/directRewards',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.directRewards(req, res);
  },
);
challengeRouter.post(
  '/bulkUpdateDirectReward',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.bulkUpdateDirectReward(req, res);
  },
);
challengeRouter.get('/isRewardErrorLogExist/:challengeId', (req, res) => {
  challengeController.isRewardErrorLogExist(req, res);
});

challengeRouter.get(
  '/getRewardErrorLog/:challengeId',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.getRewardErrorLog(req, res);
  },
);
// challengeRouter.get("/getChallengesAndUsers", (req, res) => {
//   challengeController.getChallengesAndUsers(req, res);
// });

module.exports = challengeRouter;
