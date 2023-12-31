const mongoose = require('mongoose'),
  __ = require('../../../helpers/globalFunctions'),
  moment = require('moment'),
  PostCategory = require('../../models/postCategory'),
  Channel = require('../../models/channel'),
  Wall = require('../../models/wall'),
  WallPost = require('../../models/wallPost'),
  User = require('../../models/user'),
  ChannelPost = require('../../models/post'),
  Challenge = require('../../models/challenge'),
  ChallengeLog = require('../../models/challengeLog'),
  json2csv = require('json2csv').parse,
  fs = require('fs'),
  ChallengeStatus = require('../../models/challengeStatus'),
  ChallengeCriteria = require('../../models/challengeCriteria'),
  ChallengeStatusNonReward = require('../../models/challengeStatusNonReward'),
  ChallengeCriteriaNonReward = require('../../models/challengeCriteriaNonReward'),
  ManageForm = require('../../models/manageForm'),
  CustomForm = require('../../models/customForms'),
  Question = require('../../models/question'),
  PageSettings = require('../../models/pageSetting'),
  DisqualifyUser = require('../../models/disqualifyUser');
const subSection = require('../../models/subSection');
const RewardImportLog = require('../../models/rewardImportLog');
const { AssignUserRead } = require('../../../helpers/assinguserread');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class challenge {
  getChallengeStatusModel(res, flag) {
    return flag ? ChallengeStatusNonReward : ChallengeStatus;
  }
  getChallengeCriteriaModel(flag) {
    return flag ? ChallengeCriteriaNonReward : ChallengeCriteria;
  }
  async disqualifyUser(req, res) {
    try {
      logInfo('Challenge Controller: disqualifyUser', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'challengeId',
        'userId',
        'fromDate',
        'toDate',
      ]);
      if (!requiredResult.status) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const cb = (date) => new Date(moment(date).toLocaleString());
      const fromDate = cb(req.body.fromDate),
        toDate = cb(req.body.toDate);
      const userExists = await DisqualifyUser.findOne({
        challengeId: req.body.challengeId,
        userId: req.body.userId,
        $or: [
          { fromDate: { $lte: fromDate }, toDate: { $gte: fromDate } },
          { fromDate: { $lte: toDate }, toDate: { $gte: toDate } },
          { fromDate: { $gte: fromDate }, toDate: { $lte: toDate } },
        ],
        status: 1,
      }).lean();

      if (!!userExists)
        return __.out(res, 300, `User already exists for given date range`);

      req.body.status = 1;
      req.body.fromDate = fromDate;
      req.body.toDate = toDate;
      let createData = await new DisqualifyUser(req.body).save();
      if (!createData) {
        return __.out(res, 301, 'Error while make disqualifier');
      } else {
        return __.out(res, 201, 'User disqualified successfully');
      }
    } catch (err) {
      logError('Challenge Controller: disqualifyUser', err.stack);
      return __.out(res, 500, err);
    }
  }
  async readDisqualifier(req, res) {
    try {
      logInfo('Challenge Controller: readDisqualifier', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const challengeId = req.query.challengeId;
      if (!challengeId) {
        return __.out(res, 300, 'challengeId is required');
      }
      let pageNum = req.query.start ? parseInt(req.query.start) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum * limit) / limit;
      const recordsTotal = await DisqualifyUser.find({ challengeId }).count();
      const result = await DisqualifyUser.find({
        challengeId,
        status: { $in: [0, 1] },
      })
        .populate({
          path: 'userId',
          select: 'name',
        })
        .skip(skip)
        .limit(limit)
        .lean();
      return res.status(201).json({
        draw: req.query.draw || 0,
        recordsTotal: recordsTotal || 0,
        recordsFiltered: recordsTotal || 0,
        data: result,
      });
    } catch (err) {
      logError('Challenge Controller: readDisqualifier', err.stack);
      return __.out(res, 500, err);
    }
  }
  async deleteDisqualifier(req, res) {
    try {
      logInfo('Challenge Controller: deleteDisqualifier', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      if (!req.query._id) {
        return __.out(res, 300, 'Disqualifier id is required');
      }
      await DisqualifyUser.findOneAndUpdate(
        {
          _id: req.query._id,
        },
        { status: 2 },
      );
      return __.out(res, 201, 'Deleted successfully');
    } catch (err) {
      logError('Challenge Controller: deleteDisqualifier', err.stack);
      return __.out(res, 500, err);
    }
  }

  async checkUser(res, user) {
    try {
      logInfo('CheckUser function:', { soruceUser: user._id });
      const userId = user._id;
      const [walls, channels, customForms] = await Promise.all([
        AssignUserRead.getUserInAssignedUser(user, Wall),
        AssignUserRead.getUserInAssignedUser(user, Channel, 'channel'),
        AssignUserRead.getUserInAssignedUser(user, CustomForm),
      ]);
      const allAssignedChallenges = await this.getChallengeStatusModel()
        .find(
          { userId: mongoose.Types.ObjectId(userId) },
          { challengeId: 1, _id: 0 },
        )
        .lean();
      const selectedFields = {
        _id: 1,
        selectedWall: 1,
        selectedChannel: 1,
        selectedCustomForm: 1,
        nonRewardPointSystemEnabled: 1,
      };
      const query = {
        $or: [
          { selectedChannel: { $in: channels } },
          { selectedWall: { $in: walls } },
          { selectedCustomForm: { $in: customForms } },
        ],
        status: 1,
        challengeStart: { $lte: new Date() },
        _id: {
          $nin: allAssignedChallenges.map((v) =>
            mongoose.Types.ObjectId(v.challengeId),
          ),
        },
      };

      const challenges = await Challenge.find(query, selectedFields).lean();

      const updatePromises = challenges.map((challenge) =>
        this.getChallengeStatusModel(
          !!challenge.nonRewardPointSystemEnabled,
        ).findOneAndUpdate(
          { challengeId: challenge._id, userId: userId },
          {
            challengeId: challenge._id,
            userId: userId,
            status: true,
            totalRewardPoints: 0,
          },
          { upsert: true },
        ),
      );
      await Promise.all(updatePromises);
    } catch (error) {
      logError('CheckUser function:', error.stack);
      return __.out(res, 500);
    }
  }

  async getPointsSummary(req, res) {
    try {
      logInfo('Challenge Controller: getPointsSummary', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      await this.checkUser(res, req.user);
      const aggregateQuery = [
        {
          $match: {
            userId: mongoose.Types.ObjectId(req.user._id),
          },
        },
        {
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge',
            pipeline: [
              {
                $match: {
                  nonRewardPointSystemEnabled: false,
                },
              },
            ],
          },
        },
        {
          $unwind: '$challenge',
        },
        {
          $group: {
            _id: '$challenge.nonRewardPointSystem',
            count: { $sum: '$totalRewardPoints' },
          },
        },
      ];

      const aggregateNonQuery = [
        {
          $match: {
            userId: mongoose.Types.ObjectId(req.user._id),
          },
        },
        {
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge',
            pipeline: [
              {
                $match: {
                  nonRewardPointSystemEnabled: true,
                },
              },
            ],
          },
        },
        {
          $unwind: '$challenge',
        },
        {
          $group: {
            _id: '$challenge.nonRewardPointSystem',
            count: { $sum: '$rewardPoints' },
          },
        },
      ];

      let [challengeStatus, challengeNonStatus] = await Promise.all([
        this.getChallengeStatusModel()
          .aggregate(aggregateQuery)
          .allowDiskUse(true),
        ChallengeCriteriaNonReward.aggregate(aggregateNonQuery).allowDiskUse(
          true,
        ),
      ]);
      challengeStatus = [
        { _id: null, count: challengeStatus.reduce((a, b) => a + b.count, 0) },
      ];
      challengeStatus = [...challengeStatus, ...challengeNonStatus];

      // get active point systems
      const pageSettings = await PageSettings.findOne({
        companyId: req.user.companyId,
        status: 1,
      }).select('pointSystems');
      let list = challengeStatus.map((status) => {
        const finder = pageSettings.pointSystems.find((pointSystem) =>
          !!status._id
            ? pointSystem._id.toString() === status._id.toString()
            : `Reward points`.toUpperCase() === pointSystem.title.toUpperCase(),
        );
        status.icon = !!finder ? finder.icon : '';
        return status;
      });
      list = list.sort((first, second) => second.count - first.count);
      return __.out(res, 201, list);
    } catch (error) {
      logError('Challenge Controller: getPointsSummary', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async update(req, res) {
    try {
      logInfo('Challenge Controller: update', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      if (!__.checkSpecialCharacters(req.body, 'challenges')) {
        return __.out(
          res,
          301,
          `You've entered some excluded special characters`,
        );
      }
      let challenge = req.body.challenge;
      let {
        _id,
        title,
        description,
        icon,
        leaderBoard,
        publishStart,
        publishEnd,
        challengeStart,
        challengeEnd,
        criteriaType,
        criteriaSourceType,
        criteriaCountType,
        criteriaCount,
        rewardPoints,
        stopAfterAchievement,
        setLimitToMaxRewards,
        status,
        businessUnit,
        administrators,
        maximumRewards,
        selectedChannel,
        selectedWall,
        assignUsers,
        selectedCustomForm,
        nomineeQuestion,
      } = challenge;
      challenge.leaderBoard = !!challenge.leaderBoard;
      maximumRewards = parseInt(maximumRewards);
      if (1 === status) {
        const message = !!!title
          ? 'Title is required'
          : !!!description
          ? 'Description is required'
          : !!!icon
          ? 'Icon is required'
          : !!!publishStart
          ? 'Publish Start date and time are required'
          : !!!publishEnd
          ? 'Publish end date and time are required'
          : !!!challengeStart
          ? 'Challenge Start date and time are required'
          : !!!challengeEnd
          ? 'Challenge Start date and time are required'
          : !!!criteriaType
          ? 'Select Criteria Type'
          : administrators.length
          ? false
          : 'Administrators is required';
        stopAfterAchievement = stopAfterAchievement || false;
        if (message) {
          return __.out(res, 300, message);
        }
      } else {
        const message = !!!title
          ? 'Title is required'
          : !administrators.length
          ? 'Administrators is required'
          : false;
        if (message) {
          return __.out(res, 300, message);
        }
      }

      if (criteriaType !== 4 && !criteriaType) {
        return __.out(res, 300, 'Select Criteria Source Type');
      }
      challenge['createdBy'] = req.user._id;
      challenge['companyId'] = req.user.companyId;
      challenge.rewardPoints = parseInt(challenge.rewardPoints || 0);
      if (challenge._id) {
        let existingData = await Challenge.findOne({
          _id: challenge._id,
        }).lean();
        let updatedFields = this.checkUpdatedFields(existingData, challenge);
        Challenge.findOneAndUpdate(
          { _id: challenge._id },
          {
            $set: challenge,
          },
          { new: true },
        )
          .then(() => {
            logInfo('challenge updated');
          })
          .catch((err) => {
            logError('Error in challenge update', err.stack);
          });
        challenge.challengeId = challenge._id;
        challenge.logDescription = 'Updated';
        delete challenge['_id'];
        /** get the users for wall/channal */
        if (1 == status) {
          let users = [];
          const promises = [];
          if (!!selectedChannel) {
            const channel = await Channel.findOne({ _id: selectedChannel })
              .select('userDetails createdBy')
              .lean();
            promises.push(
              AssignUserRead.read(channel.userDetails, null, channel.createdBy),
            );
          } else if (!!selectedWall) {
            const wall = await Wall.findOne({ _id: selectedWall })
              .select('assignUsers createdBy')
              .lean();
            promises.push(
              AssignUserRead.read(wall.assignUsers, null, wall.createdBy),
            );
          } else if (!!selectedCustomForm) {
            const customform = await CustomForm.findOne({
              _id: selectedCustomForm,
            })
              .select('assignUsers createdBy')
              .lean();
            promises.push(
              AssignUserRead.read(
                customform.assignUsers,
                null,
                customform.createdBy,
              ),
            );
          } else if (criteriaType === 4 && assignUsers.length) {
            promises.push(AssignUserRead.read(assignUsers, null, req.user._id));
          }
          let challengeUsers = [];
          let userData = {};
          promises.push(
            this.getChallengeStatusModel(
              !!challenge.nonRewardPointSystemEnabled,
            )
              .find({ challengeId: challenge.challengeId })
              .select('userId')
              .lean(),
          );
          [userData, challengeUsers] = await Promise.all(promises);
          users = userData.users;
          const userIds = new Set(
            challengeUsers?.map((u) => u.userId.toString()),
          );
          const finalUsers = users?.filter((u) => !userIds.has(u.toString()));
          if (finalUsers && finalUsers.length) {
            for (const user of finalUsers) {
              await this.getChallengeStatusModel(
                !!challenge.nonRewardPointSystemEnabled,
              ).updateOne(
                { challengeId: challenge.challengeId, userId: user },
                {
                  $setOnInsert: { status: true, totalRewardPoints: 0 },
                },
                { upsert: true },
              );
            }
          } else {
            __.log('no new users found');
          }
        }
        challenge.updatedFields = updatedFields;
        new ChallengeLog(challenge)
          .save()
          .then(() => {
            logInfo('challenge log added');
          })
          .catch((err) => {
            logError('Error in challenge log addition', err.stack);
          });
        return __.out(res, 201, 'Challenge updated successfully');
      } else {
        return __.out(res, 300, 'challengeId is missing');
      }
    } catch (error) {
      logError('Challenge Controller: update', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  checkUpdatedFields(existingData, requestData) {
    try {
      let differentProperties = {};

      // Iterate over the properties of the first object
      for (let prop in existingData) {
        // Check if the property exists in both objects and has different values
        if (
          existingData.hasOwnProperty(prop) &&
          requestData.hasOwnProperty(prop) &&
          existingData[prop]?.toString() !== requestData[prop]?.toString()
        ) {
          differentProperties[prop] = [existingData[prop], requestData[prop]];
        }
      }

      // Iterate over the properties of the second object
      for (let prop in requestData) {
        // Check if the property exists in the second object but not in the first object
        if (
          requestData.hasOwnProperty(prop) &&
          !existingData.hasOwnProperty(prop)
        ) {
          differentProperties[prop] = [undefined, requestData[prop]];
        }
      }
      // old value -> new Value
      return differentProperties;
    } catch (e) {
      logError('checkUpdatedFields has error', e.stack);
      return {};
    }
  }

  async create(req, res) {
    try {
      logInfo('Challenge Controller: create', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      if (!__.checkSpecialCharacters(req.body, 'challenges')) {
        return __.out(
          res,
          301,
          `You've entered some excluded special characters`,
        );
      }
      if ('challenge' in req.body) {
        let challenge = req.body.challenge;
        let {
          title,
          description,
          icon,
          leaderBoard,
          publishStart,
          publishEnd,
          challengeStart,
          challengeEnd,
          criteriaType,
          criteriaSourceType,
          criteriaCountType,
          criteriaCount,
          rewardPoints,
          stopAfterAchievement,
          setLimitToMaxRewards,
          status,
          businessUnit,
          administrators,
          maximumRewards,
          selectedChannel,
          selectedWall,
          assignUsers,
          selectedCustomForm,
          nomineeQuestion,
        } = challenge;
        challenge.leaderBoard = !!challenge.leaderBoard;
        maximumRewards = parseInt(maximumRewards);
        status = status || 0;
        if (1 === status) {
          const message = !!!title
            ? 'Title is required'
            : !!!description
            ? 'Description is required'
            : !!!icon
            ? 'Icon is required'
            : !!!publishStart
            ? 'Publish Start date and time are required'
            : !!!publishEnd
            ? 'Publish end date and time are required'
            : !!!challengeStart
            ? 'Challenge Start date and time are required'
            : !!!challengeEnd
            ? 'Challenge Start date and time are required'
            : !!!criteriaType
            ? 'Select Criteria Type'
            : !administrators.length
            ? 'Administrators is required'
            : null;
          stopAfterAchievement = stopAfterAchievement || false;
          if (message) {
            return __.out(res, 300, message);
          }
        } else {
          const message = !!!title
            ? 'Title is required'
            : administrators.length
            ? false
            : 'Administrators is required';
          if (message) {
            return __.out(res, 300, message);
          }
        }
        challenge['createdBy'] = req.user._id;
        challenge['companyId'] = req.user.companyId;
        if (!!challenge.rewardPoints) {
          challenge.rewardPoints = parseInt(challenge.rewardPoints);
        }
        let challengeUpdated = await new Challenge(challenge).save();
        challenge.challengeId = challengeUpdated._id;
        challenge.logDescription = 'Created';
        /** get the users for wall/channal */
        if (1 == status) {
          let users = [];
          if (!!selectedChannel) {
            const channel = await Channel.findOne({ _id: selectedChannel })
              .select('userDetails createdBy')
              .lean();
            // users = await __.channelUsersList(channel);
            users = await AssignUserRead.read(
              channel.userDetails,
              null,
              channel.createdBy,
            );
            users = users.users;
          } else if (!!selectedWall) {
            const wall = await Wall.findOne({ _id: selectedWall })
              .select('assignUsers createdBy')
              .lean();
            // users = await __.wallUsersList(wall);
            users = await AssignUserRead.read(
              wall.assignUsers,
              null,
              wall.createdBy,
            );
            users = users.users;
          } else if (!!selectedCustomForm) {
            const customform = await CustomForm.findOne({
              _id: selectedCustomForm,
            })
              .select('assignUsers createdBy')
              .lean();
            users = await AssignUserRead.read(
              customform.assignUsers,
              null,
              customform.createdBy,
            );
            users = users.users;
          } else if (criteriaType === 4 && assignUsers.length) {
            users = await AssignUserRead.read(assignUsers, null, req.user._id);
            users = users.users;
          }
          if (users.length) {
            users = users.map((user) => ({
              challengeId: challenge.challengeId,
              userId: user,
              status: true,
              totalRewardPoints: 0,
            }));
            let pro = new Promise((resolve, reject) => {
              this.getChallengeStatusModel(
                !!challenge.nonRewardPointSystemEnabled,
              ).collection.insert(users, (err, result) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(result);
                }
              });
            });
            await pro.then(
              (data) => {
                console.log('success');
              },
              (error) => {
                console.log(error);
              },
            );
          }
          //await ChallengeStatus.insert(users);
        }
        await new ChallengeLog(challenge).save();
        return __.out(res, 201, 'Challenge created successfully');
      }
      return __.out(res, 300, 'Challenge data missing');
    } catch (err) {
      logError('Challenge Controller: create', err.stack);
      return __.out(res, 300, 'Invalid Data submitted');
    }
  }

  async getChannelOrBoardsUsers(req, res) {
    try {
      logInfo('Challenge Controller: getChannelOrBoardsUsers', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const page = !!req.body.page ? parseInt(req.body.page) * 10 : 0;
      let { channelId, wallId, criteriaType, customFormId, questionId } =
        req.body;
      let users = [];
      if (!!channelId) {
        let channel = await Channel.findById(channelId)
          .select('userDetails createdBy')
          .lean();
        users = await AssignUserRead.read(
          channel.userDetails,
          null,
          channel.createdBy,
        );
        users = users.users;
      }
      if (!!wallId) {
        let wall = await Wall.findById(wallId)
          .select('assignUsers createdBy')
          .lean();
        users = await AssignUserRead.read(
          wall.assignUsers,
          null,
          wall.createdBy,
        );
        users = users.users;
      }
      if (!!customFormId) {
        let customform = await CustomForm.findById(customFormId)
          .select('assignUsers createdBy')
          .lean();
        users = await AssignUserRead.read(
          customform.assignUsers,
          null,
          customform.createdBy,
        );
        users = users.users;
      }
      if (!!questionId) {
        let questionDetails = await Question.findById(questionId)
          .select('assignUsers moduleId')
          .populate({
            path: 'moduleId',
            select: 'createdBy',
          })
          .lean();
        users = users = await AssignUserRead.read(
          questionDetails.assignUsers,
          null,
          questionDetails.moduleId.createdBy,
        );
        users = users.users;
      }
      let query = {};
      if (users.length) {
        query._id = {
          $in: users,
        };
      } else if (criteriaType == 3 || criteriaType == 4) {
        query.parentBussinessUnitId = {
          $in: req.user.planBussinessUnitId.map((v) =>
            mongoose.Types.ObjectId(v),
          ),
        };
      } else {
        return __.out(res, 201, { items: [], count_filtered: 0 });
      }
      if (req.body.q !== undefined) {
        query.name = {
          $regex: req.body.q.toString(),
          $options: 'ixs',
        };
      }
      query.status = {
        $nin: [2],
      };
      users = await User.aggregate([
        {
          $match: query,
        },
        { $skip: page },
        { $limit: 10 },
        { $project: { name: 1, _id: 1 } },
      ]).allowDiskUse(true);
      const count_filtered = await User.find(query).count();
      if (!users) {
        return __.out(res, 300, 'No users Found');
      }
      return __.out(res, 201, { items: users, count_filtered });
    } catch (error) {
      logError('Challenge Controller: getChannelOrBoardsUsers', error.stack);
      return __.out(res, 300, error);
    }
  }

  async getChannelsAndBoards(req, res) {
    try {
      logInfo('Challenge Controller: getChannelsAndBoards', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      /** Channels */
      let channels = await Channel.find({
        'userDetails.admin': {
          $elemMatch: {
            $eq: mongoose.Types.ObjectId(req.user._id),
          },
        },
        status: 1,
      })
        .populate([
          {
            path: 'userDetails.admin',
            select: 'name',
          },
        ])
        .select('name');
      let i = 0;
      for (const curr of channels) {
        channels[i]['categories'] = await PostCategory.find({
          channelId: curr._id.toString(),
        }).select('name');
        i++;
      }
      /** Boards */
      let boards = await Wall.find({
        'assignUsers.admin': {
          $elemMatch: {
            $eq: mongoose.Types.ObjectId(req.user._id),
          },
        },
        status: 1,
      })
        .populate([
          {
            path: 'assignUsers.admin',
            select: 'name',
          },
          {
            path: 'category',
            select: 'categoryName',
          },
        ])
        .select('wallName')
        .lean();
      let customForms = await CustomForm.find({
        $or: [
          {
            $and: [
              {
                $or: [
                  { workflow: { $exists: false } },
                  { workflow: { $size: 0 } },
                ],
              },
            ],
            assignUsers: {
              $elemMatch: {
                admin: {
                  $in: [req.user._id],
                },
              },
            },
          },
          {
            workflow: {
              $exists: true,
              $elemMatch: {
                admin: {
                  $in: [req.user._id],
                },
              },
            },
          },
        ],
        status: 1,
      })
        .select('title')
        .lean();
      // get active point systems
      let pageSettings = await PageSettings.findOne({
        companyId: req.user.companyId,
        status: 1,
      }).select('pointSystems');
      if (!pageSettings.pointSystems || !pageSettings.pointSystems.length) {
        pageSettings.pointSystems = await __.initPointSystem(
          req.user.companyId,
        );
      }
      pageSettings.pointSystems.splice(
        pageSettings.pointSystems.findIndex(
          (ps) => 'reward points'.toUpperCase() === ps.title.toUpperCase(),
        ),
        1,
      );

      return __.out(res, 201, {
        channels,
        boards,
        customForms,
        pointSystems: pageSettings.pointSystems
          ? pageSettings.pointSystems.filter((ps) => ps.isEnabled)
          : [],
      });
    } catch (error) {
      logError('Challenge Controller: getChannelsAndBoards', error.stack);
      return __.out(res, 300, 'Invalid Data submitted');
    }
  }

  async uploadContentFiles(req, res) {
    try {
      logInfo('Challenge Controller: uploadContentFiles', {
        soruceUser: req.user._id,
      });
      if (!req.file) {
        return __.out(res, 300, `No File is Uploaded`);
      }

      let storePath = `uploads/challenge/${req.file.filename}`;
      const url = req.protocol + '://' + req.get('host');
      let filePath = `${url}/${storePath}`;
      res.status(201).send({
        link: filePath,
        filePath: storePath,
      });
      const result = /*await*/ __.scanFile(
        req.file.filename,
        `public/uploads/challenge/${req.file.filename}`,
      );
      if (!!result) {
        //return __.out(res, 300, result);
      }
    } catch (err) {
      logError('Challenge Controller: uploadContentFiles', err.stack);
      return __.out(res, 500, err);
    }
  }

  async readChallenges(req, res) {
    try {
      logInfo('Challenge Controller: readChallenges', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      // if (!(!!req.query.businessUnit)) {
      //   return __.out(res, 300, 'businessUnit is required');
      // }
      let pageNum = req.query.start ? parseInt(req.query.start) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum * limit) / limit;
      let query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
        administrators: {
          $in: [mongoose.Types.ObjectId(req.user._id)],
        },
        status: {
          $nin: [2],
        },
      };
      const recordsTotal = await Challenge.count(query).lean();
      if (req.query.search && req.query.search.value) {
        query['$or'] = [
          {
            title: {
              $regex: `${req.query.search.value}`,
              $options: 'ixs',
            },
          },
        ];
      }
      const recordsFiltered = await Challenge.count(query).lean();
      let sort = {};
      if (req.query.order) {
        let orderData = 'desc'; //req.query.order;
        const getSort = (val) => ('asc' === val ? 1 : -1);
        for (let i = 0; i < orderData.length; i++) {
          switch (orderData[i].column) {
            case '0':
              sort[`createdAt`] = getSort(orderData[i].dir);
              break;
            case '1':
              sort[`title`] = getSort(orderData[i].dir);
              break;
            case '2':
              sort[`status`] = getSort(orderData[i].dir);
              break;
          }
        }
        if (!Object.keys(sort).length) {
          sort = { createdAt: -1 };
        }
      }
      const challengeData = await Challenge.find(query)
        .populate([
          {
            path: 'administrators',
            select: 'name staffId',
          },
          {
            path: 'selectedChannel',
            select: 'name',
          },
          {
            path: 'selectedWall',
            select: 'wallName',
          },
          {
            path: 'selectedCustomForm',
            select: 'title',
          },
          {
            path: 'nomineeQuestion',
            select: 'question',
          },
          {
            path: 'businessUnit',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'sectionId',
              select: 'name status',
              match: {
                status: 1,
              },
              populate: {
                path: 'departmentId',
                select: 'name status',
                match: {
                  status: 1,
                },
                populate: {
                  path: 'companyId',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
              },
            },
          },
          {
            path: 'assignUsers.businessUnits',
            select: 'name status sectionId',
            populate: {
              path: 'sectionId',
              select: 'name status departmentId',
              populate: {
                path: 'departmentId',
                select: 'name status companyId',
                populate: {
                  path: 'companyId',
                  select: 'name status',
                },
              },
            },
          },
          {
            path: 'assignUsers.appointments',
            select: 'name',
          },
          {
            path: 'assignUsers.subSkillSets',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'skillSetId',
              select: 'name status',
              match: {
                status: 1,
              },
            },
          },
          {
            path: 'assignUsers.user',
            select: 'name staffId',
          },
          {
            path: 'assignUsers.admin',
            select: 'name staffId',
          },
          {
            path: 'selectedScheme',
            select: '_id schemeName',
            match: {
              status: 1,
            },
          },
        ])
        .skip(skip)
        .sort(sort)
        .limit(limit)
        .lean();
      let arr = [];

      // get point system data to add
      const pageSettings = await PageSettings.findOne({
        companyId: req.user.companyId,
        status: 1,
      }).select('pointSystems');

      for (const challenge of challengeData) {
        const index = challenge.administrators.findIndex((v) => {
          return v._id.toString() === req.user._id.toString();
        });
        // append point system data
        if (
          !!challenge.nonRewardPointSystemEnabled &&
          !!challenge.nonRewardPointSystem
        ) {
          challenge.nonRewardPointSystem = pageSettings.pointSystems.find(
            (ps) =>
              ps._id.toString() === challenge.nonRewardPointSystem.toString(),
          );
        }
        challenge.isAdmin = -1 !== index;
        if (challenge.criteriaType === 1 && !!challenge.selectedChannel) {
          let channel = await Channel.findById(challenge.selectedChannel)
            .select('userDetails createdBy')
            .lean();
          let users = await AssignUserRead.read(
            channel.userDetails,
            null,
            channel.createdBy,
          );
          users = users.users;
          const ind = users.findIndex(
            (v) => v.toString() === req.user._id.toString(),
          );
          if (-1 !== ind) {
            arr[arr.length] = challenge;
          }
        }
        if (challenge.criteriaType === 2 && !!challenge.selectedWall) {
          let wall = await Wall.findById(challenge.selectedWall)
            .select('assignUsers createdBy')
            .lean();
          let users = await AssignUserRead.read(
            wall.assignUsers,
            null,
            wall.createdBy,
          );
          users = users.users;
          const ind = users.findIndex(
            (v) => v.toString() === req.user._id.toString(),
          );
          if (-1 !== ind) {
            arr[arr.length] = challenge;
          }
        }
        if (
          challenge.isAdmin &&
          -1 ===
            arr.findIndex((v) => v._id.toString() === challenge._id.toString())
        ) {
          arr[arr.length] = challenge;
        }
      }
      let result = {
        draw: req.query.draw || 0,
        recordsTotal: recordsTotal || 0,
        recordsFiltered: recordsFiltered || 0,
        data: arr,
      };
      return res.status(201).json(result);
    } catch (error) {
      logError('Challenge Controller: readChallenges', error.stack);
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async readChallengesSingle(req, res) {
    try {
      logInfo('Challenge Controller: readChallengesSingle', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const challengeId = req.params.challengeId;
      let query = {
        _id: challengeId,
        status: {
          $nin: [2],
        },
      };
      const challenge = await Challenge.findOne(query)
        .populate([
          {
            path: 'administrators',
            select: 'name staffId',
          },
          {
            path: 'selectedChannel',
            select: 'name',
          },
          {
            path: 'selectedWall',
            select: 'wallName',
          },
          {
            path: 'selectedCustomForm',
            select: 'title workflow',
          },
          {
            path: 'nomineeQuestion',
            select: 'question',
          },
          {
            path: 'businessUnit',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'sectionId',
              select: 'name status',
              match: {
                status: 1,
              },
              populate: {
                path: 'departmentId',
                select: 'name status',
                match: {
                  status: 1,
                },
                populate: {
                  path: 'companyId',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
              },
            },
          },
          {
            path: 'assignUsers.businessUnits',
            select: 'name status sectionId',
            populate: {
              path: 'sectionId',
              select: 'name status departmentId',
              populate: {
                path: 'departmentId',
                select: 'name status companyId',
                populate: {
                  path: 'companyId',
                  select: 'name status',
                },
              },
            },
          },
          {
            path: 'assignUsers.appointments',
            select: 'name',
          },
          {
            path: 'assignUsers.subSkillSets',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'skillSetId',
              select: 'name status',
              match: {
                status: 1,
              },
            },
          },
          {
            path: 'assignUsers.user',
            select: 'name staffId',
          },
          {
            path: 'assignUsers.admin',
            select: 'name staffId',
          },
          {
            path: 'selectedScheme',
            select: '_id schemeName',
            match: {
              status: 1,
            },
          },
        ])
        .lean();

      if (challenge.criteriaType === 5) {
        const workflow = challenge.selectedCustomForm.workflow;
        const fieldOptions = challenge.fieldOptions;
        const matchedWorkFlow = workflow.filter((obj1) =>
          fieldOptions.some((obj2) => obj1._id == obj2.fieldOptionValue),
        );
        let result = [];
        matchedWorkFlow.forEach((workFlow) => {
          const workflowStatus = workFlow.workflowStatus.filter((obj1) =>
            fieldOptions.some((obj2) => obj1._id == obj2.formStatusValue),
          );
          const workflowStatusResult = workflowStatus.map((ws) => {
            return `${workFlow.title}-> ${ws.field}`;
          });
          result = [...result, ...workflowStatusResult];
        });
        challenge.workFlowStatusInfo = result;
        delete challenge.selectedCustomForm.workflow;
      }

      const pageSettings = await PageSettings.findOne({
        companyId: req.user.companyId,
        status: 1,
      }).select('pointSystems');
      // append point system data
      if (
        !!challenge.nonRewardPointSystemEnabled &&
        !!challenge.nonRewardPointSystem
      ) {
        challenge.nonRewardPointSystem = pageSettings.pointSystems.find(
          (ps) =>
            ps._id.toString() === challenge.nonRewardPointSystem.toString(),
        );
      }
      let result = {
        data: challenge,
      };
      return res.status(201).json(result);
    } catch (error) {
      logError('Challenge Controller: readChallengesSingle', error.stack);
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async readChallengesNew(req, res) {
    try {
      logInfo('Challenge Controller: readChallengesNew', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let pageNum = req.query.start ? parseInt(req.query.start) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum * limit) / limit;
      let query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
        administrators: {
          $in: [mongoose.Types.ObjectId(req.user._id)],
        },
        status: {
          $nin: [2],
        },
      };
      if (req.query.search && req.query.search.value) {
        query['$or'] = [
          {
            title: {
              $regex: `${req.query.search.value}`,
              $options: 'ixs',
            },
          },
        ];
      }
      let sort = {};
      const order = req.query.order;
      if (order) {
        const getSort = (val) => ('asc' === val ? 1 : -1);
        for (let i = 0; i < order.length; i++) {
          const or = order[i];
          switch (or.column) {
            case '0':
              sort[`createdAt`] = getSort(or.dir);
              break;
            case '1':
              sort[`title`] = getSort(or.dir);
              break;
            case '2':
              sort[`publishEnd`] = getSort(or.dir);
              break;
          }
        }
        if (!Object.keys(sort).length) {
          sort = { createdAt: -1 };
        }
      }
      const [challengeData, recordsFiltered] = await Promise.all([
        Challenge.find(query).skip(skip).sort(sort).limit(limit).lean(),
        Challenge.countDocuments(query),
      ]);
      let result = {
        draw: req.query.draw || 0,
        recordsTotal: recordsFiltered || 0,
        recordsFiltered: recordsFiltered || 0,
        data: challengeData,
      };
      return res.status(201).json(result);
    } catch (error) {
      logError('Challenge Controller: readChallengesNew', error.stack);
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async read(req, res) {
    try {
      logInfo('Challenge Controller: read', { soruceUser: req.user._id });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let pageNum = req.query.start ? parseInt(req.query.start) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum * limit) / limit;
      let searchQuery = {
        companyId: req.user.companyId,
        // administrators: {
        //   $in: [req.user._id]
        // },
        status: {
          $nin: [3],
        },
      };

      let recordsTotal = await Challenge.count(searchQuery).lean();
      let recordsFiltered;

      if (req.query.search && req.query.search.value != '') {
        searchQuery['$or'] = [
          {
            challengeTitle: {
              $regex: `${req.query.search.value}`,
              $options: 'i',
            },
          },
        ];
        recordsFiltered = await Challenge.count(searchQuery);
      } else {
        recordsFiltered = recordsTotal;
      }

      let sort = {};
      if (req.query.order) {
        let orderData = req.query.order;
        const getSort = (val) => ('asc' === val ? 1 : -1);
        for (let i = 0; i < orderData.length; i++) {
          switch (orderData[i].column) {
            case '0':
              sort[`createdAt`] = getSort(orderData[i].dir);
              break;
            case '1':
              sort[`title`] = getSort(orderData[i].dir);
              break;
            case '2':
              sort[`status`] = getSort(orderData[i].dir);
              break;
          }
        }
      }

      const challengeData = await Challenge.find(searchQuery)
        .populate({
          path: 'administrators',
          select: 'name staffId',
        })
        .populate({
          path: 'businessUnit',
          select: 'name status',
          match: {
            status: 1,
          },
          populate: {
            path: 'sectionId',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'departmentId',
              select: 'name status',
              match: {
                status: 1,
              },
              populate: {
                path: 'companyId',
                select: 'name status',
                match: {
                  status: 1,
                },
              },
            },
          },
        })
        .skip(skip)
        .sort(sort)
        .limit(limit)
        .lean();

      let result = {
        draw: req.query.draw || 0,
        recordsTotal: recordsTotal || 0,
        recordsFiltered: recordsFiltered || 0,
        data: challengeData,
      };
      return res.status(201).json(result);
    } catch (err) {
      logError('Challenge Controller: read', err.stack);
      return __.out(res, 500, err);
    }
  }

  async readOne(req, res) {
    try {
      logInfo('Challenge Controller: readOne', { soruceUser: req.user._id });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      let searchQuery = {
        companyId: req.user.companyId,
        administrators: {
          $in: [req.user._id],
        },
        status: {
          $nin: [3],
        },
      };
      let challengeData = await Challenge.findOne(searchQuery).lean();
      if (!challengeData) {
        return __.out(res, 300, 'Challenge Not Found');
      }
      return __.out(res, 201, challengeData);
    } catch (err) {
      logError('Challenge Controller: readOne', err.stack);
      return __.out(res, 500, err);
    }
  }

  async exportManageChallenge(req, res) {
    try {
      logInfo('Challenge Controller: exportManageChallenge', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let {
        challengeId,
        startDate,
        endDate,
        businessUnit,
        nonRewardPointSystemEnabled,
      } = req.query;
      console.log(
        challengeId,
        startDate,
        endDate,
        businessUnit,
        'challengeId, startDate, endDate, businessUnit',
      );

      if (!!!challengeId) {
        return __.out(res, 300, 'challengeId is required');
      }

      let query = {
        challengeId: mongoose.Types.ObjectId(challengeId),
        rewardPoints: {
          $exists: true,
        },
        rewardPoints: {
          $gt: 0,
        },
      };
      let userQuery = {
        'user.status': {
          $in: [1, 2],
        },
      };
      if (!!businessUnit) {
        userQuery['user.parentBussinessUnitId'] = {
          $in: [mongoose.Types.ObjectId(businessUnit)],
        };
      }

      if (!!startDate) {
        query['createdAt'] = query['createdAt'] || {};
        query['createdAt']['$gte'] = query['createdAt']['$gte'] || {};
        query['createdAt']['$gte'] = moment(startDate, 'YYYY-MM-DD').toDate();
      }
      if (!!endDate) {
        query['createdAt'] = query['createdAt'] || {};
        query['createdAt']['$lte'] = query['createdAt']['$lte'] || {};
        query['createdAt']['$lte'] = moment(endDate, 'YYYY-MM-DD').toDate();
      }
      const populateQuery = [
        {
          $match: query,
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
        {
          $match: userQuery,
        },
        {
          $lookup: {
            from: 'subsections',
            localField: 'user.parentBussinessUnitId',
            foreignField: '_id',
            as: 'subsection',
          },
        },
        {
          $unwind: '$subsection',
        },
        {
          $lookup: {
            from: 'sections',
            localField: 'subsection.sectionId',
            foreignField: '_id',
            as: 'section',
          },
        },
        {
          $unwind: '$section',
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'section.departmentId',
            foreignField: '_id',
            as: 'department',
          },
        },
        {
          $unwind: '$department',
        },
        {
          $lookup: {
            from: 'companies',
            localField: 'department.companyId',
            foreignField: '_id',
            as: 'company',
          },
        },
        {
          $unwind: '$company',
        },
        {
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge',
          },
        },
        {
          $unwind: '$challenge',
        },
        {
          $lookup: {
            from: 'users',
            localField: 'directReward.rewardedBy',
            foreignField: '_id',
            as: 'rewardedBy',
          },
        },
        {
          $unwind: {
            path: '$rewardedBy',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            'challenge._id': 1,
            'challenge.title': 1,
            'user.staffId': 1,
            'user.name': 1,
            'company.name': 1,
            'department.name': 1,
            'section.name': 1,
            'subsection.name': 1,
            rewardPoints: 1,
            directReward: 1,
            'rewardedBy.name': 1,
            createdAt: 1,
          },
        },
      ];

      let totalRecords = await this.getChallengeCriteriaModel(
        eval(nonRewardPointSystemEnabled),
      )
        .aggregate(populateQuery)
        .allowDiskUse(true);
      const formatDate = (dateUTC) => [
        moment(dateUTC)
          .add(-req.query.timeZone, 'minutes')
          .format('YYYY-MM-DD'),
        moment(dateUTC).add(-req.query.timeZone, 'minutes').format('hh:mm:A'),
      ];
      totalRecords = totalRecords.map((d, i) => {
        let r = {
          count: d.rewardPoints,
          businessUnit: `${d.company.name} > ${d.department.name} > ${d.section.name} > ${d.subsection.name}`,
          company: d.company.name,
          department: d.department.name,
          section: d.section.name,
          subsection: d.subsection.name,
          challengeTitle: d.challenge.title,
          staffId: d.user.staffId,
          name: d.user.name,
          directReward: d.directReward,
          'RewardedAt(Date)': formatDate(d.createdAt)[0],
          'RewardedAt(Time)': formatDate(d.createdAt)[1],
        };
        r.SNo = i + 1;
        r['DirectRewardedBy'] = !!d.directReward
          ? d.rewardedBy.name || ''
          : '--';
        r['count'] = d.rewardPoints;
        return r;
      });
      let headers = [
        'SNo',
        'challengeTitle',
        'staffId',
        'name',
        'businessUnit',
        'company',
        'department',
        'section',
        'subsection',
        'count',
        'RewardedAt(Date)',
        'RewardedAt(Time)',
        'DirectRewardedBy',
      ];
      let csv = json2csv({ data: totalRecords, fields: headers });
      const directory = 'public/challenge';
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      fs.writeFileSync(
        `public/challenge/${moment().format('YYYYMMDD')}.csv`,
        csv,
      );
      return __.out(res, 201, {
        csvLink: `challenge/${moment().format('YYYYMMDD')}.csv`,
      });
    } catch (error) {
      logError('Challenge Controller: exportManageChallenge', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getCountOfChallenges(req, res) {
    try {
      logInfo('Challenge Controller: getCountOfChallenges', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      console.log('getCountOfChallenges API has called');
      let {
        challengeId,
        startDate,
        endDate,
        businessUnit,
        nonRewardPointSystemEnabled,
      } = req.query;
      let query = {
        challengeId: mongoose.Types.ObjectId(challengeId),
        rewardPoints: {
          $exists: true,
        },
        rewardPoints: {
          $gt: 0,
        },
      };
      let userQuery = {
        status: {
          $in: [1, 2],
        },
      };
      if (!!businessUnit) {
        userQuery['parentBussinessUnitId'] = {
          $in: [mongoose.Types.ObjectId(businessUnit)],
        };
      }

      if (!!startDate) {
        query['createdAt'] = query['createdAt'] || {};
        query['createdAt']['$gte'] = query['createdAt']['$gte'] || {};
        query['createdAt']['$gte'] = moment(startDate, 'YYYY-MM-DD').toDate();
      }
      if (!!endDate) {
        query['createdAt'] = query['createdAt'] || {};
        query['createdAt']['$lte'] = query['createdAt']['$lte'] || {};
        query['createdAt']['$lte'] = moment(endDate, 'YYYY-MM-DD').toDate();
      }
      const groupData = await this.getChallengeCriteriaModel(
        eval(nonRewardPointSystemEnabled),
      ).aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: '$userId',
            totalAmount: {
              $sum: '$rewardPoints',
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              {
                $match: userQuery,
              },
              {
                $project: {
                  _id: 1.0,
                },
              },
            ],
          },
        },
        {
          $unwind: '$user',
        },
        {
          $group: {
            _id: null,
            totalUsers: {
              $sum: 1,
            },
            totalAmount: {
              $sum: '$totalAmount',
            },
          },
        },
      ]);
      let result = { totalUsers: 0, totalAmount: 0 };
      if (groupData.length) {
        result.totalUsers = groupData[0].totalUsers;
        result.totalAmount = groupData[0].totalAmount;
      }
      return __.out(res, 201, result);
    } catch (error) {
      logError('Challenge Controller: getCountOfChallenges', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getUsers(businessUnit, value) {
    let userQuery = {};

    if (!!businessUnit) {
      userQuery['parentBussinessUnitId'] =
        mongoose.Types.ObjectId(businessUnit);
    }
    if (value) {
      userQuery['$or'] = [
        'staffId',
        'name',
      ].map((v) => {
        let obj = {};
        obj[v] = {
          $regex: `${value}`,
          $options: 'i',
        };
        return obj;
      });
    }
    const userIds = await User.find(userQuery).distinct("_id");
    return userIds; 
  }

  async manageChallenge(req, res) {
    try {
      logInfo('Challenge Controller: manageChallenge', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let {
        challengeId,
        startDate,
        endDate,
        businessUnit,
        individual,
        nonRewardPointSystemEnabled,
      } = req.query;
      let pageNum = req.query.draw ? parseInt(req.query.draw) : 1;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      console.log(req.query.skip, pageNum);
      const skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum - 1) * limit;

      if (!!!challengeId) {
        return __.out(res, 300, 'challengeId is required');
      }
      let query = {
        challengeId: mongoose.Types.ObjectId(challengeId),
        rewardPoints: {
          $gt: 0,
        },
      };
      if (!!startDate) {
        query['createdAt'] = query['createdAt'] || {};
        query['createdAt']['$gte'] = query['createdAt']['$gte'] || {};
        query['createdAt']['$gte'] = moment(startDate, 'YYYY-MM-DD').toDate();
      }
      if (!!endDate) {
        query['createdAt'] = query['createdAt'] || {};
        query['createdAt']['$lte'] = query['createdAt']['$lte'] || {};
        query['createdAt']['$lte'] = moment(endDate, 'YYYY-MM-DD').toDate();
      }

      let sort = {};
      if (req.query.order) {
        let orderData = req.query.order;
        const getSort = (val) => ('asc' === val ? 1 : -1);
        for (let i = 0; i < orderData.length; i++) {
          switch (orderData[i].column) {
            case '0':
              sort[`createdAt`] = 1;
              break;
            case '1':
              sort[`name`] = getSort(orderData[i].dir);
              break;
            case '2':
              sort[`staffId`] = getSort(orderData[i].dir);
              break;
            case '3':
              sort[`businessUnit`] = getSort(orderData[i].dir);
              break;
            case '4':
              sort[`count`] = getSort(orderData[i].dir);
              break;
            case '5':
              sort[`createdAt`] = getSort(orderData[i].dir);
              break;
            case '6':
              sort[`rewardedBy.name`] = getSort(orderData[i].dir);
              break;
          }
        }
      }
      console.log('req.query.search.value', req.query.search.value)
      if (businessUnit || (req.query.search && req.query.search.value)) {
        // get userId to pass in main query
        const userIdArr = await this.getUsers(businessUnit, req.query.search.value);
        query.userId = {$in: userIdArr}
      }

      const ind = individual === 'true';

      const allCall = [
        !!ind
          ? this.getChallengeCriteriaModel(
              eval(nonRewardPointSystemEnabled),
            ).countDocuments(query)
          : this.getChallengeCriteriaModel(
              eval(nonRewardPointSystemEnabled),
            ).aggregate([
              { $match: query },
              {
                $group: {
                  _id: '$userId',
                },
              },
              { $count: 'total' },
            ]),
      ];

      const populateQuery = [
        { $match: query },
        {
          $group: {
            _id: !!ind ? '$_id' : '$userId',
            count: !!ind
              ? {
                  $first: '$rewardPoints',
                }
              : {
                  $sum: '$rewardPoints',
                },
            directReward: {
              $first: '$directReward',
            },
            userId: {
              $first: '$userId',
            },
            createdAt: {
              $first: '$createdAt',
            },
            directRewardBy: {
              $first: '$rewardedBy',
            },
          },
        },
        {
          $sort: sort,
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              {
                $project: {
                  staffId: 1.0,
                  name: 1.0,
                  parentBussinessUnitId: 1.0,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: '$user',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'directReward.rewardedBy',
            foreignField: '_id',
            as: 'rewardedBy',
            pipeline: [
              {
                $project: {
                  name: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: '$rewardedBy',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            staffId: '$user.staffId',
            name: '$user.name',
            _id: '$user._id',
            parentBussinessUnitId: '$user.parentBussinessUnitId',
            rewardPoints: 1,
            directReward: 1,
            'rewardedBy.name': 1,
            createdAt: 1,
            count: 1,
          },
        },
      ];

      allCall.push(
        this.getChallengeCriteriaModel(eval(nonRewardPointSystemEnabled))
          .aggregate([
            ...populateQuery,
            {
              $lookup: {
                from: 'subsections',
                localField: 'parentBussinessUnitId',
                foreignField: '_id',
                as: 'bu',
              },
            },
            {
              $unwind: '$bu',
            },
            {
              $project: {
                _id: 1,
                count: 1,
                businessUnit: '$bu.orgName',
                staffId: 1,
                name: 1,
                directReward: 1,
                createdAt: 1,
                directRewardBy: 1,
              },
            },
          ])
          .allowDiskUse(true),
      );

      let [recordsFilteredCount, totalRecords] = await Promise.all(allCall);
      let recordsFiltered = 0;
      if (!!ind) {
        recordsFiltered = recordsFilteredCount;
      } else {
        if (recordsFilteredCount.length) {
          recordsFiltered = recordsFilteredCount[0].total;
        }
      }
      const result = {
        draw: req.query.draw || 0,
        recordsTotal: recordsFiltered || 0,
        recordsFiltered: recordsFiltered || 0,
        data: totalRecords,
      };
      return res.status(201).json(result);
    } catch (error) {
      logError('Challenge Controller: manageChallenge', error.stack);
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async triggerChallenge(res, userId, postId, postType, sourceType) {
    try {
      logInfo('Challenge Controller: triggerChallenge', { soruceUser: userId });
      const setRewardsForUser = async (
        challenge,
        challengeCriteria,
        challengeStatus,
        userId,
      ) => {
        /** Criteria count w'll be triggered */
        challengeCriteria['criteriaCount'] = 1;
        let crId = await new (this.getChallengeCriteriaModel(
          !!challenge.nonRewardPointSystemEnabled,
        ))(challengeCriteria).save();
        /** Total criteria count */
        let totalRewardPoints = challengeStatus.totalRewardPoints || 0,
          status = true,
          rewardPoints = 0;
        let totalCount = await this.getChallengeCriteriaModel(
          !!challenge.nonRewardPointSystemEnabled,
        ).count({
          challengeId: challengeCriteria.challengeId,
          userId: challengeCriteria.userId,
          directReward: {
            $exists: false,
          },
        });

        /** Get user */
        let user = await User.findById(userId)
          .select({ _id: 1, rewardPoints: 1 })
          .lean();
        user.rewardPoints = user.rewardPoints || 0;
        const criteriaCountType = (type) => {
          const rewardPoints =
            1 === type
              ? challenge.rewardPoints
              : 2 === type &&
                !!totalCount &&
                0 === totalCount % challenge.criteriaCount
              ? challenge.rewardPoints
              : 0;
          const status = !(
            challenge.stopAfterAchievement &&
            ((2 === type && totalCount === challenge.criteriaCount) ||
              (1 === type && !!rewardPoints))
          );
          return { rewardPoints, status };
        };

        const updateChallengeStatus = async (
          rewardPoints,
          status,
          _id,
          totalRewardPoints,
        ) => {
          user.rewardPoints = user.rewardPoints + (rewardPoints || 0);
          if (!!_id) {
            await this.getChallengeCriteriaModel(
              !!challenge.nonRewardPointSystemEnabled,
            ).updateOne({ _id: _id }, { rewardPoints });
          }
          totalRewardPoints = totalRewardPoints + rewardPoints;
          if (
            challenge.setLimitToMaxRewards &&
            challenge.maximumRewards < totalRewardPoints
          ) {
            await this.getChallengeCriteriaModel(
              !!challenge.nonRewardPointSystemEnabled,
            ).findByIdAndRemove(crId._id);
            status = false;
            totalRewardPoints = totalRewardPoints - rewardPoints;
            rewardPoints = 0;
          }
          const data = { totalRewardPoints, status };
          __.log(data, challengeStatus._id, challengeCriteria.userId);
          await this.getChallengeStatusModel(
            !!challenge.nonRewardPointSystemEnabled,
          ).updateOne(
            { _id: challengeStatus._id, userId: challengeCriteria.userId },
            data,
          );
          if (!challenge.nonRewardPointSystemEnabled && rewardPoints) {
            await User.updateOne(
              { _id: userId },
              { rewardPoints: user.rewardPoints },
            );
          }
        };

        switch (challenge.criteriaSourceType) {
          case 5:
            rewardPoints = challenge.rewardPoints;
            status = false;
            break;
          default:
            const obj = criteriaCountType(challenge.criteriaCountType);
            (rewardPoints = obj.rewardPoints), (status = obj.status);
            break;
        }
        await updateChallengeStatus(
          rewardPoints,
          status,
          crId._id,
          totalRewardPoints,
        );
        /*
        if (challenge.setLimitToMaxRewards && challenge.maximumRewards < totalRewardPoints) {
          //user.rewardPoints = userRewardPoints;
          await ChallengeCriteria.findByIdAndRemove(crId._id);
          await updateChallengeStatus(0, false, null, totalRewardPoints);
        } else {
          
        }*/
      };

      /** Criteria Checking */
      const incCriteriaCount = async (challenge, challengeStatus, userId) => {
        const bool = await DisqualifyUser.findOne({
          challengeId: challenge._id,
          userId,
          fromDate: { $lte: new Date().toISOString() },
          toDate: { $gte: new Date().toISOString() },
          status: 1,
        }).lean();
        if (bool) return;
        let challengeCriteria = {
          userId,
          criteriaSourceType: challenge.criteriaSourceType,
        };
        if ('wall' === postType) {
          challengeCriteria['wallPost'] = postId;
          challengeCriteria['challengeId'] = challenge._id;
        } else if ('channel' === postType) {
          challengeCriteria['challengeId'] = challenge._id;
          challengeCriteria['channelPost'] = postId;
        } else if (5 === challenge.criteriaType) {
          challengeCriteria['challengeId'] = challenge._id;
          challengeCriteria['manageForm'] = postId;
        }
        let challengeCriteriaData = await this.getChallengeCriteriaModel(
          !!challenge.nonRewardPointSystemEnabled,
        )
          .find(challengeCriteria)
          .count();
        if (challengeCriteriaData === 0) {
          if (!!challengeStatus) {
            await setRewardsForUser(
              challenge,
              challengeCriteria,
              challengeStatus,
              userId,
            );
          } else {
            challengeCriteria['challengeId'] = challenge._id;
            let challengeStatus = await new (this.getChallengeStatusModel(
              !!challenge.nonRewardPointSystemEnabled,
            ))({
              challengeId: challenge._id,
              userId: userId,
              status: true,
              totalRewardPoints: 0,
            }).save();
            await setRewardsForUser(
              challenge,
              challengeCriteria,
              challengeStatus,
              userId,
            );
          }
        }
      };

      const checkChallenge = async (challenge, userId) => {
        const challengeId = challenge._id;
        const bool = await DisqualifyUser.findOne({
          challengeId,
          userId,
          fromDate: { $lte: new Date().toISOString() },
          toDate: { $gte: new Date().toISOString() },
          status: 1,
        }).lean();
        if (bool) return;

        const challengeStatus = await this.getChallengeStatusModel(
          !!challenge.nonRewardPointSystemEnabled,
        )
          .findOne({
            challengeId: challengeId,
            userId: userId,
          })
          .select('status totalRewardPoints')
          .lean();
        if (!!challengeStatus) {
          if (challengeStatus.status) {
            await incCriteriaCount(challenge, challengeStatus, userId);
          }
        } else if (5 === challenge.criteriaType) {
          const challengeStatus = await new (this.getChallengeStatusModel(
            !!challenge.nonRewardPointSystemEnabled,
          ))({
            challengeId: challenge._id,
            userId,
            status: true,
            totalRewardPoints: 0,
          }).save();
          await incCriteriaCount(challenge, challengeStatus, userId);
        }
      };

      const checkWall = async () => {
        const wallPost = await WallPost.findById(postId)
          .select('wallId')
          .lean();
        if (wallPost) {
          /** Search challenges under wall id */
          let challenges = await Challenge.find({
            selectedWall: wallPost.wallId,
            challengeStart: {
              $lte: new Date(),
            },
            challengeEnd: {
              $gte: new Date(),
            },
            criteriaSourceType: sourceType,
          }).lean();
          if (!!challenges && challenges.length) {
            for (const challenge of challenges) {
              if (sourceType === 8) {
                // 8.nominated user criteria
                for (const user of userId) {
                  // userId means nominated users
                  await checkChallenge(challenge, user);
                }
              } else {
                await checkChallenge(challenge, userId);
              }
            }
          }
        }
      };

      const checkChannel = async () => {
        const channelPost = await ChannelPost.findById(postId)
          .select('channelId')
          .lean();
        if (channelPost) {
          let challenges = await Challenge.find({
            selectedChannel: channelPost.channelId,
            challengeStart: {
              $lte: new Date(),
            },
            challengeEnd: {
              $gte: new Date(),
            },
            criteriaSourceType: sourceType,
          }).lean();
          if (!!challenges && challenges.length) {
            for (const challenge of challenges) {
              await checkChallenge(challenge, userId);
            }
          }
        }
      };

      /** First login Challenge */
      const checkSystem = async () => {
        let user = await User.findById(userId).lean();
        if (user) {
          if ([5, 6].includes(sourceType)) {
            let challenges = await Challenge.find({
              challengeStart: {
                $lte: new Date(),
              },
              challengeEnd: {
                $gte: new Date(),
              },
              criteriaSourceType: sourceType,
              companyId: user.companyId,
            }).lean();
            console.log(
              '--------------challenges ------------------- ',
              challenges,
            );
            if (!!challenges && challenges.length) {
              for (const challenge of challenges) {
                console.log(
                  '-------------- 12341234 ------------------- ',
                  challenge,
                );
                await incCriteriaCount(challenge, null, userId);
              }
            }
          }
        }
      };
      const checkCustomForm = async () => {
        const customform = await ManageForm.findById(postId)
          .select('customFormId formStatus workflowStatus questionId userId')
          .populate({
            path: 'questionId',
            select: 'questionId answer',
            populate: {
              path: 'questionId',
              select: 'type',
            },
          })
          .lean();
        const allNomineeTypeQuestions = customform.questionId.filter(
          (question) => question.questionId.type === 14,
        );
        if (
          !!customform &&
          ((!!customform.formStatus && customform.formStatus.length) ||
            (!!customform.workflowStatus && !!customform.workflowStatus.length))
        ) {
          let challenges = await Challenge.find({
            selectedCustomForm: customform.customFormId,
            challengeStart: {
              $lte: new Date(),
            },
            challengeEnd: {
              $gte: new Date(),
            },
            criteriaType: 5,
          }).lean();
          if (!!challenges && challenges.length) {
            for (const challenge of challenges) {
              const statusFlag = challenge.fieldOptions.some((fieldOption) => {
                return !!customform.formStatus && !!customform.formStatus.length
                  ? customform.formStatus.some(
                      (fs) =>
                        fieldOption.formStatusValue?.toString() ===
                        fs.fieldStatusValueId?.toString(),
                    )
                  : customform.workflowStatus.some(
                      (wf) =>
                        fieldOption.formStatusValue?.toString() ===
                        wf.fieldStatusId?.toString(),
                    );
              });
              if (7 === challenge.criteriaSourceType) {
                const index = allNomineeTypeQuestions.findIndex(
                  (question) =>
                    question.questionId._id.toString() ===
                    challenge.nomineeQuestion.toString(),
                );
                const nomineeQuestionFlag = -1 !== index;
                if (statusFlag && nomineeQuestionFlag) {
                  for (const user of allNomineeTypeQuestions[index].answer) {
                    await checkChallenge(challenge, user._id);
                  }
                } else {
                  console.log(
                    `statusFlag ${statusFlag} nomineeflag ${nomineeQuestionFlag}`,
                  );
                }
              } else if (6 === challenge.criteriaSourceType && statusFlag) {
                await checkChallenge(challenge, customform.userId);
              }
            }
          }
        }
      };

      switch (postType) {
        case 'wall':
          await checkWall();
          break;
        case 'channel':
          await checkChannel();
          break;
        case 'system':
          await checkSystem();
          break;
        case 'customform':
          await checkCustomForm();
          break;
        default:
          break;
      }
    } catch (error) {
      logError('Challenge Controller: triggerChallenge', error.stack);
      return __.out(res, 500);
    }
  }

  async getChallengeUsers(req, res) {
    try {
      logInfo('Challenge Controller: getChallengeUsers', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const page = !!req.body.page ? parseInt(req.body.page) * 10 : 0;
      const { challengeId } = req.body;

      let userIds = [];
      const {
        criteriaType,
        selectedChannel,
        selectedWall,
        selectedCustomForm,
        assignUsers,
        createdBy,
      } = await Challenge.findById(challengeId)
        .select(
          'criteriaType selectedChannel selectedCustomForm selectedWall assignUsers createdBy',
        )
        .lean();
      switch (criteriaType) {
        case 1:
          const channel = await Channel.findById(selectedChannel)
            .select('userDetails createdBy')
            .lean();
          userIds = await AssignUserRead.read(
            channel.userDetails,
            null,
            channel.createdBy,
          );
          userIds = userIds.users;
          break;
        case 2:
          const wall = await Wall.findById(selectedWall)
            .select('assignUsers createdBy')
            .lean();
          userIds = await AssignUserRead.read(
            wall.assignUsers,
            null,
            wall.createdBy,
          );
          userIds = userIds.users;
          break;
        case 4:
          userIds = await AssignUserRead.read(assignUsers, null, createdBy);
          userIds = userIds.users;
          break;
        case 5:
          const customform = await CustomForm.findById(selectedCustomForm)
            .select('assignUsers createdBy')
            .lean();
          userIds = await AssignUserRead.read(
            customform.assignUsers,
            null,
            customform.createdBy,
          );
          userIds = userIds.users;
          break;
        default:
          break;
      }
      let query = {
        status: {
          // $in: [1, 2]
          $in: [1], // active users only
        },
        _id: {
          $in: userIds || [],
        },
      };
      if (req.body.q) {
        query['$or'] = [
          {
            name: {
              $regex: req.body.q.toString(),
              $options: 'i',
            },
          },
          {
            staffId: {
              $regex: req.body.q.toString(),
              $options: 'i',
            },
          },
        ];
      }
      let finalUsers = await User.find(query)
        .skip(page)
        .limit(10)
        .select('name staffId')
        .lean();
      finalUsers = finalUsers.map((user) => ({
        _id: user._id,
        name: `${user.name} - (${user.staffId})`,
      }));
      let count_filtered = await User.count(query).lean();
      return __.out(res, 201, { items: finalUsers, count_filtered });
    } catch (error) {
      logError('Challenge Controller: getChallengeUsers', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
  async getChallengesAndUsers(req, res) {
    try {
      logInfo('Challenge Controller: getChallengesAndUsers', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const page = !!req.body.page ? parseInt(req.body.page) * 10 : 0;
      let query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
      };
      if (req.body.q !== undefined) {
        query.title = {
          $regex: req.body.q.toString(),
          $options: 'ixs',
        };
      }
      query.status = {
        $nin: [0, 2],
      };
      let challenges = await Challenge.aggregate([
        {
          $match: query,
        },
        { $skip: page },
        { $limit: 10 },
        { $project: { title: 1, _id: 1, selectedWall: 1, selectedChannel: 1 } },
      ]).allowDiskUse(true);
      const count_filtered = await User.find(query).count();
      for (const challenge of challenges) {
        let users = [];
        if (!!challenge.selectedWall) {
          let wall = await Wall.findById(challenge.selectedWall)
            .select('assignUsers createdBy')
            .lean();
          users = await AssignUserRead.read(
            wall.assignUsers,
            { name: 1, staffId: 1, deviceToken: 1, otherFields: 1 },
            wall.createdBy,
          );
          users = users.users;
        } else if (!!challenge.selectedChannel) {
          let channel = await Channel.findById(challenge.selectedChannel)
            .select('userDetails createdBy')
            .lean();

          users = await AssignUserRead.read(
            channel.userDetails,
            { name: 1, staffId: 1, deviceToken: 1, otherFields: 1 },
            channel.createdBy,
          );
          users = users.users;
        }
        challenge['users'] = users;
      }
      return __.out(res, 201, { items: challenges || [], count_filtered });
    } catch (error) {
      logError('Challenge Controller: getChallengesAndUsers', error.stack);
      __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getChallengesLog(req, res) {
    try {
      logInfo('Challenge Controller: getChallengesLog', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      let pageNum = req.query.draw ? parseInt(req.query.draw) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum - 1) * limit;
      let query = {
        administrators: {
          $in: [mongoose.Types.ObjectId(req.user._id)],
        },
      };
      let sort = { createdAt: -1 };
      if (req.query.order) {
        let order = req.query.order;
        const getSort = (val) => ('asc' === val ? 1 : -1);
        for (let i = 0; i < order.length; i++) {
          switch (order[i].column) {
            case '0':
              sort[`user.name`] = getSort(order[i].dir);
              break;
            case '1':
              sort[`createdAt`] = getSort(order[i].dir);
              break;
            case '2':
              sort[`title`] = getSort(order[i].dir);
              break;
            default:
              sort[`description`] = getSort(order[i].dir);
              break;
          }
        }
      }
      if (!!req.query.search) {
        if (req.query.search.value) {
          const searchCondition = {
            $regex: `${req.query.search.value}`,
            $options: 'i',
          };
          query['$or'] = [
            {
              title: searchCondition,
            },
            {
              logDescription: searchCondition,
            },
          ];
        }
      }

      if (!Object.keys(sort).length) {
        sort[`createdAt`] = -1;
      }
      const populateQuery = [
        {
          $match: query,
        },
        {
          $sort: sort,
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              {
                $project: {
                  name: 1,
                  staffId: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: '$user',
        },
        {
          $project: {
            user: 1,
            title: 1,
            createdAt: 1,
            description: 1,
            logDescription: 1,
            _id: '$challengeId',
          },
        },
      ];
      const filteredRecordsPromise = ChallengeLog.countDocuments(query);
      const dataPromise = ChallengeLog.aggregate(populateQuery);

      const [filteredRecords, data] = await Promise.all([
        filteredRecordsPromise,
        dataPromise,
      ]);
      // console.log(data)
      const result = {
        draw: req.query.draw || 0,
        recordsTotal: filteredRecords || 0,
        recordsFiltered: filteredRecords || 0,
        data: data,
      };
      return res.status(201).json(result);
    } catch (error) {
      logError('Challenge Controller: getChallengesLog', error.stack);
      __.out(res, 201, 'Something went wrong try later');
    }
  }

  async readChallengeCriteriaLog(req, res) {
    try {
      logInfo('Challenge Controller: readChallengeCriteriaLog', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let pageNum = req.query.draw ? parseInt(req.query.draw) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum - 1) * limit;

      let query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
        status: {
          $nin: [3],
        },
        //businessUnit : mongoose.Types.ObjectId(req.body.businessUnit)
      };
      let aggregateQuery = [
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
        {
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge',
          },
        },
        {
          $unwind: '$challenge',
        },
        {
          $lookup: {
            from: 'wallposts',
            localField: 'wallPost',
            foreignField: '_id',
            as: 'wallPost',
          },
        },
        {
          $unwind: '$wallPost',
        },
        {
          $lookup: {
            from: 'posts',
            localField: 'channelPost',
            foreignField: '_id',
            as: 'post',
          },
        },
        {
          $unwind: '$post',
        },
      ];

      const totalRecords = await this.getChallengeCriteriaModel()
        .aggregate([
          { $match: query },
          ...aggregateQuery,
          { $group: { _id: null, count: { $sum: 1 } } },
        ])
        .allowDiskUse(true);

      if (!!req.query.search) {
        if (req.query.search.value) {
          const searchCondition = {
            $regex: `${req.query.search.value}`,
            $options: 'i',
          };
          query['$or'] = [
            {
              'user.name': searchCondition,
            },
            {
              'challenge.title': searchCondition,
            },
            {
              'wallPost.title': searchCondition,
            },
            {
              'post.wallName': searchCondition,
            },
          ];
        }
      }

      let sort = {};
      let orderData = req.query.order;
      if (req.query.order) {
        const getSort = (val) => ('asc' === val ? 1 : -1);
        for (let i = 0; i < orderData.length; i++) {
          switch (orderData[i].column) {
            case '0':
              sort[`createdAt`] = getSort(orderData[i].dir);
              break;
            case '1':
              sort[`user.name`] = getSort(orderData[i].dir);
              break;
            case '2':
              sort[`challenge.title`] = getSort(orderData[i].dir);
              break;
            case '3':
              sort[`wallPost.title`] = getSort(orderData[i].dir);
              break;
            case '4':
              sort[`post.wallName`] = getSort(orderData[i].dir);
              break;
            default:
              sort[`status`] = getSort(orderData[i].dir);
              break;
          }
        }
      }
      if (!Object.keys(sort).length) {
        sort[`createdAt`] = -1;
      }
      const filteredRecords = await this.getChallengeCriteriaModel()
        .aggregate([
          ...aggregateQuery,
          { $match: query },
          { $group: { _id: null, count: { $sum: 1 } } },
        ])
        .allowDiskUse(true);

      const challengeCriteriaLog = await this.getChallengeCriteriaModel()
        .aggregate([
          ...aggregateQuery,
          { $match: query },
          {
            $project: {
              'user.name': 1,
              'challenge.title': 1,
              'wallPost.title': 1,
              'post.wallName': 1,
              criteriaSourceType: 1,
              criteriaCount: 1,
              status: 1,
              createdAt: 1,
            },
          },
          {
            $sort: sort,
          },
          {
            $skip: skip,
          },
          {
            $limit: limit,
          },
        ])
        .allowDiskUse(true);
      const result = {
        draw: req.query.draw || 0,
        recordsTotal: totalRecords.length ? totalRecords[0].count : 0,
        recordsFiltered: filteredRecords.length ? filteredRecords[0].count : 0,
        data: challengeCriteriaLog,
      };
      return res.status(201).json(result);
    } catch (error) {
      logError('Challenge Controller: readChallengeCriteriaLog', error.stack);
      return __.out(res, 300, { error });
    }
  }

  async appListOfChallenge(req, res) {
    try {
      logInfo('Challenge Controller: appListOfChallenge', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const skip = req.query.page ? req.query.page * 10 : 0;

      await this.checkUser(res, req.user);

      const aggregateQuery = [
        {
          $match: { userId: mongoose.Types.ObjectId(req.user._id) },
        },
        {
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge',
          },
        },
        {
          $unwind: '$challenge',
        },
        {
          $match: {
            'challenge.publishStart': {
              $lte: new Date(),
            },
            'challenge.publishEnd': {
              $gte: new Date(),
            },
          },
        },
        {
          $sort: { _id: -1 },
        },
        {
          $project: {
            totalRewardPoints: 1,
            'challenge._id': 1,
            'challenge.title': 1,
            'challenge.criteriaCount': 1,
            'challenge.leaderBoard': 1,
            'challenge.description': 1,
            'challenge.criteriaType': 1,
            'challenge.challengeEnd': 1,
            'challenge.challengeStart': 1,
            'challenge.rewardPoints': 1,
            'challenge.criteriaSourceType': 1,
            'challenge.stopAfterAchievement': 1,
            'challenge.setLimitToMaxRewards': 1,
            'challenge.maximumRewards': 1,
            'challenge.icon': 1,
            'challenge.criteriaCountType': 1,
            'challenge.nonRewardPointSystem': 1,
            'challenge.nonRewardPointSystemEnabled': 1,
            updatedAt: 1,
          },
        },
      ];

      let challengeStatus = await this.getChallengeStatusModel().aggregate(
        aggregateQuery,
      );

      const pageSettings = await PageSettings.findOne({
        companyId: req.user.companyId,
        status: 1,
      }).select('pointSystems');
      const finderIcon = pageSettings.pointSystems.find(
        (ps) => ps.title.toUpperCase() === 'Reward points'.toUpperCase(),
      );
      challengeStatus = challengeStatus.map((v) => {
        if (
          !!v.challenge.nonRewardPointSystemEnabled &&
          !!v.challenge.nonRewardPointSystem
        ) {
          const finder = pageSettings.pointSystems.find(
            (ps) =>
              ps._id.toString() === v.challenge.nonRewardPointSystem.toString(),
          );
          if (!!finder) {
            v.challenge.rewardPoints = `${v.challenge.rewardPoints} ${finder.title}`;
            v.challenge.rewardPointsIcon = finder.icon;
          }
        } else if (!!finderIcon) {
          v.challenge.rewardPoints = `${v.challenge.rewardPoints} Reward points`;
          v.challenge.rewardPointsIcon = finderIcon.icon;
        }
        v.totalRewardPoints = v.totalRewardPoints || 0;
        return v;
      });
      return __.out(res, 201, challengeStatus);
    } catch (error) {
      logError('Challenge Controller: appListOfChallenge', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async appListOfAchievements(req, res) {
    try {
      logInfo('Challenge Controller: appListOfAchievements', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      console.log('.......................... req.user._id ', req.user._id);
      await this.triggerChallenge(res, req.user._id, null, 'system', 5);
      const skip = req.query.page ? req.query.page * 10 : 0;
      const { earnings } = req.query;
      const aggregateQuery = [
        {
          $match: {
            userId: mongoose.Types.ObjectId(req.user._id),
            totalRewardPoints: {
              $gt: 0,
            },
          },
        },
        {
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge',
          },
        },
        {
          $unwind: '$challenge',
        },
        {
          $match: {
            $or: [
              {
                'challenge.nonRewardPointSystemEnabled': {
                  $in: !!earnings ? [false] : [true, false],
                },
              },
              { 'challenge.nonRewardPointSystemEnabled': { $exists: false } },
            ],
            'challenge.challengeStart': {
              $lte: new Date(),
            },
          },
        },
        {
          $sort: { _id: -1 },
        },
        {
          $project: {
            totalRewardPoints: 1,
            'challenge.nonRewardPointSystemEnabled': 1,
            'challenge._id': 1,
            'challenge.title': 1,
            'challenge.criteriaCount': 1,
            'challenge.leaderBoard': 1,
            'challenge.description': 1,
            'challenge.challengeEnd': 1,
            'challenge.challengeStart': 1,
            'challenge.rewardPoints': 1,
            'challenge.criteriaType': 1,
            'challenge.criteriaSourceType': 1,
            'challenge.stopAfterAchievement': 1,
            'challenge.setLimitToMaxRewards': 1,
            'challenge.maximumRewards': 1,
            'challenge.icon': 1,
            'challenge.criteriaCountType': 1,
            updatedAt: 1,
            'challenge.ranks': 1,
          },
        },
      ];
      let challengeStatus = await this.getChallengeStatusModel()
        .aggregate(aggregateQuery)
        .allowDiskUse(true);
      challengeStatus = challengeStatus.sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
      challengeStatus = challengeStatus.map((v) => {
        v.challenge['ranks'] = v.challenge['ranks'] || [];
        if (![1, 2, 5].includes(v.challenge.criteriaType)) {
          v.challenge['ranks'] = [];
        }
        return v;
      });
      return __.out(res, 201, challengeStatus);
    } catch (error) {
      logError('Challenge Controller: appListOfAchievements', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async appListOfRanks(req, res) {
    try {
      logInfo('Challenge Controller: appListOfRanks', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      if (req.query.challengeId) {
        const page = (req.query.page || 0) * 10;
        const challengeId = mongoose.Types.ObjectId(req.query.challengeId);
        const aggregateQuery = [
          {
            $match: {
              challengeId: challengeId,
              totalRewardPoints: {
                $gt: 0,
              },
            },
          },
          {
            $lookup: {
              from: 'challenges',
              localField: 'challengeId',
              foreignField: '_id',
              as: 'challenge',
            },
          },
          {
            $unwind: '$challenge',
          },
          {
            $match: {
              'challenge.leaderBoard': true,
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user',
            },
          },
          {
            $unwind: '$user',
          },
          {
            $match: {
              'user.status': {
                $in: [0, 1],
              },
            },
          },
          {
            $group: {
              _id: '$totalRewardPoints',
              rewardPoints: { $first: '$totalRewardPoints' },
              users: { $addToSet: '$user' },
              challenge: { $addToSet: '$challenge' },
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              rewardPoints: 1,
              'users.name': 1,
              'users.profilePicture': 1,
              challenge: 1,
            },
          },
          {
            $sort: { rewardPoints: -1 },
          },
          {
            $limit: 10,
          },
        ];
        const challengeData = await Challenge.findOne({
          _id: req.query.challengeId,
        }).lean();
        let ranks = await this.getChallengeStatusModel(
          !!challengeData.nonRewardPointSystemEnabled,
        )
          .aggregate(aggregateQuery)
          .allowDiskUse(true);
        ranks = ranks.reduce((prev, curr, i) => {
          const users = curr.users.map((u) => {
            u['rewardPoints'] = curr.rewardPoints;
            u['rank'] = i + 1;
            return u;
          });
          return prev.concat(users);
        }, []);
        ranks = ranks.slice(page, page + 10);
        return __.out(res, 201, ranks);
      } else {
        return __.out(res, 300, 'Challenge id required');
      }
    } catch (error) {
      logError('Challenge Controller: appListOfRanks', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async directRewards(req, res) {
    try {
      logInfo('Challenge Controller: directRewards', {
        soruceUser: req.user._id,
        body: req.body,
      });
      const challenge = await Challenge.findOne({
        _id: req.body.challengeId,
        challengeEnd: {
          $gte: new Date(),
        },
        status: 1,
      })
        .select({ _id: 1, nonRewardPointSystemEnabled: 1 })
        .lean();
      const user = await User.findById(req.body.userId)
        .select({ _id: 1, rewardPoints: 1 })
        .lean();
      if (!!challenge && !!user) {
        let userRewards = parseInt(user.rewardPoints) || 0;
        const directReward = {
          rewardedBy: req.user._id,
          rewardDate: new Date(),
          comment: req.body.comment,
        };
        const criteria = {
          directReward,
          companyId: req.user.companyId,
          challengeId: challenge._id,
          userId: req.body.userId,
          status: true,
          rewardPoints: parseInt(req.body.points) || 0,
        };
        let challengeStatus = await this.getChallengeStatusModel(
          !!challenge.nonRewardPointSystemEnabled,
        )
          .findOne({ challengeId: challenge._id, userId: req.body.userId })
          .select('_id totalRewardPoints status')
          .lean();
        const totalRewardPoints =
          (!!challengeStatus ? challengeStatus.totalRewardPoints || 0 : 0) +
          criteria.rewardPoints;
        const rewardPoints = userRewards + criteria.rewardPoints;
        const challengeCriteria = await new (this.getChallengeCriteriaModel(
          !!challenge.nonRewardPointSystemEnabled,
        ))(criteria).save();
        let status = null;
        if (!!challengeStatus) {
          status = challengeStatus.status;
        } else {
          status = true;
        }
        const result = await this.getChallengeStatusModel(
          !!challenge.nonRewardPointSystemEnabled,
        ).updateOne(
          { challengeId: challenge._id, userId: challengeCriteria.userId },
          {
            challengeId: challenge._id,
            userId: challengeCriteria.userId,
            totalRewardPoints,
            status,
          },
          { upsert: true },
        );
        await User.updateOne({ _id: user._id }, { rewardPoints });
        if (!!result) {
          return __.out(res, 201, 'Reward added successfully');
        }
        return __.out(res, 300, 'Reward not added successfully');
      } else {
        return __.out(res, 300, 'Challenge or User not found');
      }
    } catch (error) {
      logError('Challenge Controller: directRewards', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
  async getBadges(req, res) {
    try {
      logInfo('Challenge Controller: getBadges', { soruceUser: req.user._id });
      const currentFolder = './public/uploads/challenge/badges';
      fs.readdir(currentFolder, (err, files) => {
        if (!!err) {
          return __.out(res, 300, 'Something went wrong try later');
        }
        const url = req.protocol + '://' + req.get('host');
        files = files.map((file) => {
          return `${url}/uploads/challenge/badges/${file}`;
        });
        return __.out(res, 201, files);
      });
    } catch (error) {
      logError('Challenge Controller: getBadges', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
  async saveBadge(req, res) {
    try {
      logInfo('Challenge Controller: saveBadge', { soruceUser: req.user._id });
      if (!req.file) {
        return __.out(res, 300, `No File is Uploaded`);
      }
      const filename = `${req.file.filename}`.toLowerCase();
      if (
        !filename.match(
          /\.(tiff|tif|svg|PNG|png|JPEG|jpeg|jpg|gif|txt|pdf|odt|doc|docx|wmv|mpg|mpeg|mp4|avi|3gp|3g2|xlsx|xls|xlr|pptx|ppt|odp|key)$/,
        )
      ) {
        return __.out(
          res,
          300,
          `Please upload this type extension tiff,tif,svg,png,jpeg,jpg,gif,txt,pdf,odt,doc,docx,wmv,mpg,mpeg,mp4,avi,3gp,3g2,xlsx,xls,xlr,pptx,ppt,odp,key `,
        );
      }
      let url = req.protocol + '://' + req.get('host');
      let filePath = `${url}/uploads/challenge/badges/${req.file.filename}`;
      return res.json({
        link: filePath,
        data: { link: filePath },
      });
    } catch (error) {
      logError('Challenge Controller: saveBadge', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
  async getRecentChallenges(req, res) {
    try {
      logInfo('Challenge Controller: getRecentChallenges', {
        soruceUser: req.user._id,
      });
      const aggregateQuery = [
        {
          $match: {
            userId: mongoose.Types.ObjectId(req.user._id),
            // totalRewardPoints: {
            //   $eq: 0
            // }
          },
        },
        {
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge',
          },
        },
        {
          $unwind: '$challenge',
        },
        {
          $match: {
            'challenge.publishStart': {
              $lte: new Date(),
            },
            'challenge.publishEnd': {
              $gte: new Date(),
            },
          },
        },
        {
          $sort: { _id: -1 },
        },
        {
          $project: {
            totalRewardPoints: 1,
            'challenge._id': 1,
            'challenge.title': 1,
            'challenge.criteriaCount': 1,
            'challenge.leaderBoard': 1,
            'challenge.description': 1,
            'challenge.challengeEnd': 1,
            'challenge.challengeStart': 1,
            'challenge.rewardPoints': 1,
            'challenge.criteriaSourceType': 1,
            'challenge.stopAfterAchievement': 1,
            'challenge.setLimitToMaxRewards': 1,
            'challenge.maximumRewards': 1,
            'challenge.icon': 1,
            'challenge.criteriaCountType': 1,
            updatedAt: 1,
          },
        },
      ];
      let challengeStatus = await this.getChallengeStatusModel()
        .aggregate(aggregateQuery)
        .allowDiskUse(true);
      // const challengeStatus2 = await this.getChallengeStatusModel(true).aggregate(aggregateQuery).allowDiskUse(true);
      // challengeStatus.push(...challengeStatus2);
      challengeStatus = challengeStatus.sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
      return __.out(res, 201, challengeStatus);
    } catch (error) {
      logError('Challenge Controller: getRecentChallenges', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
  async getNomineeQuestions(req, res) {
    try {
      logInfo('Challenge Controller: getNomineeQuestions', {
        soruceUser: req.user._id,
      });
      const customFormId = req.query.customFormId;
      const questions = await CustomForm.aggregate([
        {
          $match: {
            _id: mongoose.Types.ObjectId(customFormId),
            status: 1,
            moduleId: {
              $exists: true,
            },
          },
        },
        {
          $lookup: {
            from: 'buildermodules',
            localField: 'moduleId',
            foreignField: '_id',
            as: 'buildermodule',
          },
        },
        {
          $unwind: '$buildermodule',
        },
        {
          $unwind: '$buildermodule.questions',
        },
        {
          $lookup: {
            from: 'questions',
            localField: 'buildermodule.questions',
            foreignField: '_id',
            as: 'questions',
          },
        },
        {
          $unwind: '$questions',
        },
        {
          $project: { questions: 1, formStatus: 1, workflow: 1 },
        },
        {
          $project: {
            'questions.question': 1,
            'questions._id': 1,
            'questions.type': 1,
            formStatus: 1,
            workflow: 1,
          },
        },
      ]);
      let moduleQuestions = questions
        .filter((question) => question.questions.type === 14)
        .map((question) => question.questions);
      return __.out(res, 201, {
        questions: moduleQuestions,
        formStatus: questions[0] ? questions[0].formStatus : [],
        workflow: questions[0] ? questions[0].workflow : [],
      });
    } catch (error) {
      logError('Challenge Controller: getNomineeQuestions', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
  async getBadgeDetails(challengeId, userId) {
    try {
      logInfo('Challenge Controller: getBadgeDetails', {
        soruceUser: req.user._id,
      });
      const challenge = await Challenge.findOne({ _id: challengeId })
        .select({
          badgeTiering: 1,
          ranks: 1,
          nonRewardPointSystemEnabled: 1,
          criteriaSourceType: 1,
          criteriaCountType: 1,
          criteriaCount: 1,
          rewardPoints: 1,
        })
        .lean();
      const challengeStatus = await this.getChallengeStatusModel(
        !!challenge.nonRewardPointSystemEnabled,
      )
        .findOne({ challengeId, userId })
        .select({ totalRewardPoints: 1, status: 1 })
        .lean();
      challenge.ranks.sort((a, b) => a.startRange - b.startRange);

      if (challenge.badgeTiering) {
        // badge description
        const subText = {
          1: `you read articles`,
          2: `attempt questionnaire`,
          3: `attempt an event`,
          4: `create post in board`,
          6: `submitted form acheived expected status`,
          7: `you been nominated in submitted form acheived expected status`,
          8: `you been nominated in wallpost`,
        };
        const badgeDescription = `These badges are awarded when ${
          subText[challenge.criteriaSourceType]
        }`;

        // current badge
        let currentBadge = challenge.ranks.find(
          (rank) =>
            +challengeStatus.totalRewardPoints >= +rank.startRange &&
            +challengeStatus.totalRewardPoints <= +rank.endRange,
        );

        if (!currentBadge) {
          // not achieved any or achieved all
          if (
            challengeStatus.totalRewardPoints < challenge.ranks[0].startRange
          ) {
            // not achieved any
            currentBadge = {
              _id: challenge.ranks[0]._id,
              percentage: 0,
            };
          } else if (
            challengeStatus.totalRewardPoints >
            challenge.ranks.slice(-1).startRange
          ) {
            currentBadge = {
              _id: challenge.ranks.slice(-1)._id,
              percentage: 100,
            };
            var allChallengesCompleted = true;
          }
        } else {
          currentBadge = {
            _id: currentBadge._id,
            percentage:
              ((challengeStatus.totalRewardPoints - currentBadge.startRange) /
                (currentBadge.endRange - currentBadge.startRange)) *
              100,
          };
        }

        // badge hint
        if (!allChallengesCompleted) {
          var badgeHint = `All badges achieved`;
        } else {
          const endRange = challenge.ranks.find(
            (rank) => currentBadge._id.toString() === rank._id.toString(),
          ).endRange;
          const hintCount = Math.ceil(
            ((endRange - challengeStatus.totalRewardPoints) /
              challenge.rewardPoints) *
              (challenge.criteriaCount || 1),
          );

          // badge hint description
          const subTextHint = {
            1: `read ${hintCount} more articles to complete this level`,
            2: `attempt ${hintCount} more questionnaire to complete this level`,
            3: `attempt ${hintCount} more events to complete this level`,
            4: `create ${hintCount} more posts to complete this level`,
            6: `when ${hintCount} more submitted form acheived expected status, this will be completed`,
            7: `when you been nominated in ${hintCount} more submitted form and acheived expected status, this will be completed`,
            8: `when you been nominated in ${hintCount} more wallpost`,
          };
          badgeHint = `These badges are awarded when ${
            subTextHint[challenge.criteriaSourceType]
          }`;
        }

        return {
          badges:
            challenge.ranks /* { _id, name, description, icon, startRange, endRange } */,
          badgeDescription,
          currentBadge, // current badge _id and percentage
          badgeHint, // hint to acheive current badge
        };
      } else {
        return {
          badges:
            [] /* { _id, name, description, icon, startRange, endRange } */,
          badgeDescription: null,
          currentBadge: null, // current badge _id and percentage
          badgeHint: null, // hint to acheive current badge
        };
      }
    } catch (error) {
      logError('Challenge Controller: getBadgeDetails', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
  async bulkUpdateDirectReward(req, res) {
    try {
      logInfo('Challenge Controller: bulkUpdateDirectReward', {
        soruceUser: req.user._id,
        body: req.body,
      });
      const challenge = await Challenge.findOne({
        _id: req.body.challengeId,
        challengeEnd: {
          $gte: new Date(),
        },
        status: 1,
      })
        .select({ _id: 1, nonRewardPointSystemEnabled: 1 })
        .lean();
      if (!challenge) {
        return __.out(res, 300, 'Challenge not found');
      }
      const updateChallenge = [];
      const payloadErrorLog = [];
      let failCount = 0;
      for (const userChallenge of req.body.updateChallenge) {
        const user = await User.findOne({ staffId: userChallenge.staffId })
          .select({ _id: 1, rewardPoints: 1 })
          .lean();
        if (!user) {
          failCount++;
          payloadErrorLog.push({
            staffId: userChallenge.staffId,
            points: userChallenge.points,
            comment: userChallenge.comment,
            reason: 'Staff ID is incorrect',
          });
        } else {
          userChallenge.rewardPoints = user.rewardPoints;
          userChallenge.userId = user._id;
          updateChallenge.push(userChallenge);
        }
      }

      for (const userChallenge of updateChallenge) {
        let userRewards = parseInt(userChallenge.rewardPoints) || 0;
        const directReward = {
          rewardedBy: req.user._id,
          rewardDate: new Date(),
          comment: userChallenge.comment,
        };

        const criteria = {
          directReward,
          companyId: req.user.companyId,
          challengeId: challenge._id,
          userId: userChallenge.userId,
          status: true,
          rewardPoints: parseInt(userChallenge.points) || 0,
        };
        let challengeStatus = await this.getChallengeStatusModel(
          !!challenge.nonRewardPointSystemEnabled,
        )
          .findOne({ challengeId: challenge._id, userId: userChallenge.userId })
          .select('_id totalRewardPoints status')
          .lean();
        const totalRewardPoints =
          (!!challengeStatus ? challengeStatus.totalRewardPoints || 0 : 0) +
          criteria.rewardPoints;
        const rewardPoints = userRewards + criteria.rewardPoints;
        if (rewardPoints < 0) {
          payloadErrorLog.push({
            staffId: userChallenge.staffId,
            points: userChallenge.points,
            comment: userChallenge.comment,
            reason: 'No sufficient reward points!',
          });
          failCount++;
        } else {
          const challengeCriteria = await new (this.getChallengeCriteriaModel(
            !!challenge.nonRewardPointSystemEnabled,
          ))(criteria).save();
          let status = null;
          if (!!challengeStatus) {
            status = challengeStatus.status;
          } else {
            status = true;
          }
          await this.getChallengeStatusModel(
            !!challenge.nonRewardPointSystemEnabled,
          ).updateOne(
            { challengeId: challenge._id, userId: challengeCriteria.userId },
            {
              challengeId: challenge._id,
              userId: challengeCriteria.userId,
              totalRewardPoints,
              status,
            },
            { upsert: true },
          );
          await User.updateOne({ _id: userChallenge.userId }, { rewardPoints });
        }
      }

      const savePayload = {
        challengeId: req.body.challengeId,
        success: req.body.updateChallenge.length - failCount,
        fail: failCount,
        failDetails:
          payloadErrorLog.length !== 0 ? JSON.stringify(payloadErrorLog) : '',
        createdBy: req.user._id,
      };

      await new RewardImportLog(savePayload).save();
      return __.out(res, 201, 'Reward added successfully');
    } catch (error) {
      logError('Challenge Controller: bulkUpdateDirectReward', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async isRewardErrorLogExist(req, res) {
    try {
      logInfo('Challenge Controller: isRewardErrorLogExist', {
        soruceUser: req.user._id,
      });
      const challenge = await RewardImportLog.findOne({
        challengeId: req.params.challengeId,
      }).lean();
      if (!challenge) {
        return __.out(res, 201, false);
      }

      return __.out(res, 201, true);
    } catch (error) {
      logError('Challenge Controller: isRewardErrorLogExist', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getRewardErrorLog(req, res) {
    try {
      logInfo('Challenge Controller: getRewardErrorLog', {
        soruceUser: req.user._id,
      });
      const draw = req.query.draw || 0,
        pageNum = req.query.start ? parseInt(req.query.start) : 0,
        limit = req.query.length ? parseInt(req.query.length) : 10,
        skip = req.query.skip
          ? parseInt(req.query.skip)
          : (pageNum * limit) / limit;
      let query = {};
      const recordsTotal = await RewardImportLog.count({
        createdBy: req.user._id,
        challengeId: req.params.challengeId,
      });

      if (req.query.search && req.query.search.value) {
        const searchQuery = {
          $regex: `${req.query.search.value}`,
          $options: 'ixs',
        };
        query['$or'] = [
          { 'company.name': searchQuery },
          { sourcePath: searchQuery },
          { errorMessage: searchQuery },
          { status: searchQuery },
          { noOfNewUsers: parseInt(req.query.search.value) },
          { noOfUpdatedUsers: parseInt(req.query.search.value) },
          { faildUpdateUsers: parseInt(req.query.search.value) },
        ];
      }
      let sort = {};

      if (req.query.order) {
        let orderData = req.query.order;
        const getSort = (val) => ('asc' === val ? 1 : -1);
        const sortData = [
          `company.name`,
          `status`,
          `noOfNewUsers`,
          `noOfUpdatedUsers`,
          `faildUpdateUsers`,
          `createdAt`,
          `errorFilePath`,
        ];
        sort = orderData.reduce((prev, curr) => {
          prev[sortData[parseInt(curr.column)]] = getSort(curr.dir);
          return prev;
        }, sort);
      }
      const recordsFilteredData = await RewardImportLog.find({
        createdBy: req.user._id,
        challengeId: req.params.challengeId,
      });

      const data = await RewardImportLog.find({
        createdBy: req.user._id,
        challengeId: req.params.challengeId,
      })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
      let result = {
        draw,
        recordsTotal,
        recordsFiltered: recordsFilteredData.length,
        data,
      };
      return res.status(201).json(result);
    } catch (error) {
      logError('Challenge Controller: getRewardErrorLog', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
}

module.exports = new challenge();
