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
  ManageForm = require('../../models/manageForm'),
  CustomForm = require('../../models/customForms'),
  Question = require('../../models/question');

class challenge {
  async update(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
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
          : !!!criteriaSourceType
          ? 'Select Criteria Source Type'
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
      challenge['createdBy'] = req.user._id;
      challenge['companyId'] = req.user.companyId;
      challenge.rewardPoints = parseInt(challenge.rewardPoints);
      if ('_id' in challenge) {
        await Challenge.findOneAndUpdate(
          { _id: challenge._id },
          {
            $set: challenge,
          },
          { new: true },
        );
        challenge.challengeId = challenge._id;
        challenge.logDescription = 'Updated';
        delete challenge['_id'];
        /** get the users for wall/channal */
        if (1 == status) {
          let users = [];
          if (!!selectedChannel) {
            const channel = await Channel.findOne({ _id: selectedChannel })
              .select('userDetails createdBy')
              .lean();
            users = await __.channelUsersList(channel);
          } else if (!!selectedWall) {
            const wall = await Wall.findOne({ _id: selectedWall })
              .select('assignUsers createdBy')
              .lean();
            users = await __.wallUsersList(wall);
          } else if (criteriaType === 4 && assignUsers.length) {
            users = await __.wallUsersList({
              assignUsers,
              createdBy: req.user._id,
            });
          }
          if (users.length) {
            for (const user of users) {
              await ChallengeStatus.update(
                { challengeId: challenge.challengeId, userId: user },
                {
                  $setOnInsert: { status: true, totalRewardPoints: 0 },
                },
                { upsert: true },
              );
            }
          }
        }
        await new ChallengeLog(challenge).save();
        return __.out(res, 201, 'Challenge updated successfully');
      } else {
        return __.out(res, 300, 'challengeId is missing');
      }
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
  async create(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
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
            users = await __.channelUsersList(channel);
          } else if (!!selectedWall) {
            const wall = await Wall.findOne({ _id: selectedWall })
              .select('assignUsers createdBy')
              .lean();
            users = await __.wallUsersList(wall);
          } else if (criteriaType === 4 && assignUsers.length) {
            users = await __.wallUsersList({
              assignUsers,
              createdBy: req.user._id,
            });
          }
          if (users.length) {
            users = users.map((user) => ({
              challengeId: challenge.challengeId,
              userId: user,
              status: true,
              totalRewardPoints: 0,
            }));
            let pro = new Promise((resolve, reject) => {
              ChallengeStatus.collection.insert(users, (err, result) => {
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
      __.log(err);
      return __.out(res, 300, 'Invalid Data submitted');
    }
  }

  async getChannelOrBoardsUsers(req, res) {
    try {
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
        users = await __.channelUsersList(channel);
      }
      if (!!wallId) {
        let wall = await Wall.findById(wallId)
          .select('assignUsers createdBy')
          .lean();
        users = await __.wallUsersList(wall, true);
      }
      if (!!customFormId) {
        let customform = await CustomForm.findById(customFormId)
          .select('assignUsers createdBy')
          .lean();
        users = await __.wallUsersList(customform, true);
      }
      if (!!questionId) {
        let questionDetails = await Question.findById(questionId)
          .select('assignUsers moduleId')
          .populate({
            path: 'moduleId',
            select: 'createdBy',
          })
          .lean();
        users = await __.wallUsersList(
          {
            assignUsers: questionDetails.assignUsers,
            createdBy: questionDetails.moduleId.createdBy,
          },
          true,
        );
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
      __.log(error);
      return __.out(res, 300, error);
    }
  }

  async getChannelsAndBoards(req, res) {
    try {
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
        'assignUsers.admin': {
          $elemMatch: {
            $eq: mongoose.Types.ObjectId(req.user._id),
          },
        },
        status: 1,
      })
        .select('title')
        .lean();
      return __.out(res, 201, { channels, boards, customForms });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Invalid Data submitted');
    }
  }

  async uploadContentFiles(req, res) {
    try {
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
      const result = await __.scanFile(
        req.file.filename,
        `public/uploads/challenge/${req.file.filename}`,
      );
      if (!!result) {
        //return __.out(res, 300, result);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async readChallenges(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
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
        ])
        .skip(skip)
        .sort(sort)
        .limit(limit)
        .lean();
      let arr = [];
      for (const challenge of challengeData) {
        const index = challenge.administrators.findIndex((v) => {
          return v._id.toString() === req.user._id.toString();
        });
        challenge.isAdmin = -1 !== index;
        if (challenge.criteriaType === 1 && !!challenge.selectedChannel) {
          let channel = await Channel.findById(challenge.selectedChannel)
            .select('userDetails')
            .lean();
          let users = await __.channelUsersList(channel);
          const ind = users.findIndex(
            (v) => v.toString() === req.user._id.toString(),
          );
          if (-1 !== ind) {
            arr[arr.length] = challenge;
          }
        }
        if (challenge.criteriaType === 2 && !!challenge.selectedWall) {
          let wall = await Wall.findById(challenge.selectedWall)
            .select('assignUsers')
            .lean();
          let users = await __.wallUsersList(wall, true);
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
      __.log(error);
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async read(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
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
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async readOne(req, res) {
    try {
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
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async exportManageChallenge(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let { challengeId, startDate, endDate, businessUnit } = req.query;
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
        query['createdAt'] = {
          $gte: moment(startDate, 'YYYY-MM-DD').toDate(),
        };
      }
      if (!!endDate) {
        query['createdAt'] = {
          $lte: moment(endDate, 'YYYY-MM-DD').toDate(),
        };
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

      let totalRecords = await ChallengeCriteria.aggregate(
        populateQuery,
      ).allowDiskUse(true);
      totalRecords = totalRecords.map((d, i) => {
        let r = {
          count: d.rewardPoints,
          businessUnit: `${d.company.name} > ${d.department.name} > ${d.section.name} > ${d.subsection.name}`,
          challengeTitle: d.challenge.title,
          staffId: d.user.staffId,
          name: d.user.name,
          directReward: d.directReward,
          RewardedAt: d.createdAt,
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
        'count',
        'RewardedAt',
        'DirectRewardedBy',
      ];
      let csv = json2csv({ data: totalRecords, fields: headers });
      await fs.writeFileSync(
        `./public/challenge/${moment().format('YYYYMMDD')}.csv`,
        csv,
      );
      return __.out(res, 201, {
        csvLink: `/challenge/${moment().format('YYYYMMDD')}.csv`,
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async manageChallenge(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let { challengeId, startDate, endDate, businessUnit } = req.query;
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
        query['createdAt'] = {
          $gte: moment(startDate, 'YYYY-MM-DD').toDate(),
        };
      }
      if (!!endDate) {
        query['createdAt'] = {
          $lte: moment(endDate, 'YYYY-MM-DD').toDate(),
        };
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
      console.log(JSON.stringify(populateQuery));
      let totalRecords = await ChallengeCriteria.aggregate(
        populateQuery,
      ).allowDiskUse(true);
      totalRecords = totalRecords.map((d) => {
        let r = {
          count: d.rewardPoints,
          businessUnit: `${d.company.name} > ${d.department.name} > ${d.section.name} > ${d.subsection.name}`,
          challengeTitle: d.challenge.title,
          staffId: d.user.staffId,
          name: d.user.name,
          directReward: d.directReward,
          createdAt: d.createdAt,
        };
        r.directRewardBy = d.rewardedBy || {};
        r['count'] = d.rewardPoints;
        return r;
      });
      return __.out(res, 201, totalRecords);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async triggerChallenge(userId, postId, postType, sourceType) {
    const setRewardsForUser = async (
      challenge,
      challengeCriteria,
      challengeStatus,
      userId,
    ) => {
      /** Criteria count w'll be triggered */
      challengeCriteria['criteriaCount'] = 1;
      let crId = await new ChallengeCriteria(challengeCriteria).save();
      /** Total criteria count */
      let totalRewardPoints = challengeStatus.totalRewardPoints || 0,
        status = true,
        rewardPoints = 0;
      let totalCount = await ChallengeCriteria.count({
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
          await ChallengeCriteria.update({ _id: _id }, { rewardPoints });
        }
        totalRewardPoints = totalRewardPoints + rewardPoints;
        if (
          challenge.setLimitToMaxRewards &&
          challenge.maximumRewards < totalRewardPoints
        ) {
          await ChallengeCriteria.findByIdAndRemove(crId._id);
          status = false;
          totalRewardPoints = totalRewardPoints - rewardPoints;
          rewardPoints = 0;
        }
        const data = { totalRewardPoints, status };
        __.log(data, challengeStatus._id, challengeCriteria.userId);
        await ChallengeStatus.update(
          { _id: challengeStatus._id, userId: challengeCriteria.userId },
          data,
        );
        await User.update({ _id: userId }, { rewardPoints: user.rewardPoints });
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
      try {
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
        let challengeCriteriaData = await ChallengeCriteria.find(
          challengeCriteria,
        ).count();
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
            let challengeStatus = await new ChallengeStatus({
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
      } catch (error) {
        __.log(error);
      }
    };

    const checkChallenge = async (challenge, userId) => {
      try {
        const challengeId = challenge._id;
        const challengeStatus = await ChallengeStatus.findOne({
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
          const challengeStatus = await new ChallengeStatus({
            challengeId: challenge._id,
            userId,
            status: true,
            totalRewardPoints: 0,
          }).save();
          await incCriteriaCount(challenge, challengeStatus, userId);
        }
      } catch (error) {
        __.log(error);
      }
    };

    const checkWall = async () => {
      try {
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
              await checkChallenge(challenge, userId);
            }
          }
        }
      } catch (error) {
        console.log(error);
      }
    };

    const checkChannel = async () => {
      try {
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
      } catch (error) {
        __.log(error);
      }
    };

    /** First login Challenge */
    const checkSystem = async () => {
      try {
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
            if (!!challenges && challenges.length) {
              for (const challenge of challenges) {
                await incCriteriaCount(challenge, null, userId);
              }
            }
          }
        }
      } catch (error) {
        __.log(error);
      }
    };
    const checkCustomForm = async () => {
      try {
        const customform = await ManageForm.findById(postId)
          .select('customFormId formStatus questionId')
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
          !!customform.formStatus &&
          customform.formStatus.length
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
              const statusFlag = challenge.fieldOptions.some((fieldOption) =>
                customform.formStatus.some(
                  (fs) =>
                    fieldOption.fieldOptionValue.toString() ===
                    fs.fieldStatusValueId.toString(),
                ),
              );
              if (7 === challenge.criteriaSourceType) {
                const index = allNomineeTypeQuestions.findIndex(
                  (question) =>
                    question.questionId._id.toString() ===
                    challenge.nomineeQuestion.toString(),
                );
                const nomineeQuestionFlag = -1 !== index;
                if (statusFlag && nomineeQuestionFlag) {
                  for (const user of allNomineeTypeQuestions[index].answer) {
                    await checkChallenge(challenge, userId);
                  }
                } else {
                  console.log(
                    `statusFlag ${statusFlag} nomineeflag ${nomineeQuestionFlag}`,
                  );
                }
              } else if (6 === challenge.criteriaSourceType) {
                await checkChallenge(challenge, userId);
              }
            }
          }
        }
      } catch (error) {
        __.log(error);
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
  }

  async getChallengeUsers(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const page = !!req.body.page ? parseInt(req.body.page) * 10 : 0;
      const { challengeId } = req.body;
      let userQuery = {
        'user.status': {
          $in: [1, 2],
        },
      };
      if (!!req.body.q) {
        userQuery['user.name'] = {
          $regex: req.body.q.toString(),
          $options: 'ixs',
        };
      }
      const challengeStatus = await ChallengeStatus.aggregate([
        {
          $match: {
            challengeId: mongoose.Types.ObjectId(challengeId),
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
          $match: userQuery,
        },
        { $skip: page },
        { $limit: 10 },
        { $project: { 'user.name': 1, 'user._id': 1 } },
      ]).allowDiskUse(true);
      let users = challengeStatus.map((userObj) => {
        return {
          name: userObj.user.name,
          _id: userObj.user._id,
        };
      });
      return __.out(res, 201, { items: users });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
  async getChallengesAndUsers(req, res) {
    try {
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
            .select('assignUsers')
            .lean();
          users = await __.wallUsersList(wall, false);
        } else if (!!challenge.selectedChannel) {
          let wall = await Channel.findById(challenge.selectedChannel)
            .select('userDetails')
            .lean();
          users = await __.channelUsersList(wall, null);
        }
        challenge['users'] = users;
      }
      return __.out(res, 201, { items: challenges || [], count_filtered });
    } catch (error) {
      __.log(error);
      __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getChallengesLog(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let pageNum = req.query.start ? parseInt(req.query.start) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum * limit) / limit;
      //"challenge.businessUnit": mongoose.Types.ObjectId(businessUnit)
      let query = {
        administrators: {
          $in: [mongoose.Types.ObjectId(req.user._id)],
        },
      };
      const populateQuery = [
        {
          $match: query,
        },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
      ];
      let sort = { createdAt: -1 };
      if (req.query.order) {
        let orderData = req.query.order;
        const getSort = (val) => ('asc' === val ? 1 : -1);
        for (let i = 0; i < orderData.length; i++) {
          switch (orderData[i].column) {
            case '0':
              sort[`user.name`] = getSort(orderData[i].dir);
              break;
            case '1':
              sort[`createdAt`] = getSort(orderData[i].dir);
              break;
            case '2':
              sort[`title`] = getSort(orderData[i].dir);
              break;
            default:
              sort[`description`] = getSort(orderData[i].dir);
              break;
          }
        }
      }
      let totalRecords = await ChallengeLog.aggregate(
        populateQuery,
      ).allowDiskUse(true);
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
              'user.name': searchCondition,
            },
            {
              logDescription: searchCondition,
            },
          ];
        }
      }
      let filteredRecords = await ChallengeLog.aggregate(
        populateQuery,
      ).allowDiskUse(true);
      let data = await ChallengeLog.aggregate([
        ...populateQuery,
        {
          $sort: sort,
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]).allowDiskUse(true);
      const result = {
        draw: req.query.draw || 0,
        recordsTotal: totalRecords.length || 0,
        recordsFiltered: filteredRecords.length || 0,
        data: data,
      };
      return res.status(201).json(result);
      /*const populateQuery1 = [
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        {
          $unwind: "$user"
        },
        {
          $lookup: {
            from: "challenges",
            localField: "challengeId",
            foreignField: "_id",
            as: "challenge"
          }
        },
        {
          $unwind: "$challenge"
        }, {
          $lookup: {
            from: "channels",
            localField: "challenge.selectedChannel",
            foreignField: "_id",
            as: "channel"
          }
        }, {
          '$unwind': {
            path: '$channel',
            preserveNullAndEmptyArrays: true
          }
        }, {
          $lookup: {
            from: "walls",
            localField: "challenge.selectedWall",
            foreignField: "_id",
            as: "wall"
          }
        }, {
          $unwind: {
            path: '$wall',
            preserveNullAndEmptyArrays: true
          },
        }];

      let totalRecords = await ChallengeCriteria.aggregate([...populateQuery, { $match: query }]);
      if (!!challengeId) {
        query = { ...query, challengeId: mongoose.Types.ObjectId(challengeId) };
      }
      if (!!userId) {
        query = { ...query, userId: mongoose.Types.ObjectId(userId) };
      }
      if (!!req.query.search) {
        if (req.query.search.value) {
          const searchCondition = {
            $regex: `${req.query.search.value}`,
            $options: "i"
          };
          query["$or"] = [
            {
              "challenge.title": searchCondition
            },
            {
              "user.staffId": searchCondition
            },
            {
              "user.name": searchCondition
            }
          ];
        }
      }
      let sort = { createdAt: -1 };
      if (req.query.order) {
        let orderData = req.query.order;
        const getSort = val => ("asc" === val ? 1 : -1);
        for (let i = 0; i < orderData.length; i++) {
          switch (orderData[i].column) {
            case "0":
              sort[`challenge.title`] = getSort(orderData[i].dir);
              break;
            case "1":
              sort[`user.name`] = getSort(orderData[i].dir);
              break;
            case "2":
              sort[`user.staffId`] = getSort(orderData[i].dir);
              break;
            default:
              sort[`criteriaCount`] = getSort(orderData[i].dir);
              break;
          }
        }
      }
      let filteredRecords = await ChallengeCriteria.aggregate([...populateQuery, { $match: query }]);
      const data = await ChallengeCriteria.aggregate([...populateQuery, { $match: query }, {
        $sort: sort
      }, {
        $project: {
          "challenge.title": 1,
          'challenge.criteriaSourceType': 1,
          "user.name": 1,
          "user.staffId": 1,
          "channel.name": 1,
          "wall.wallName": 1,
          "criteriaCount": 1,
          "createdAt": 1
        }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      }]).allowDiskUse(true);
      const result = {
        draw: req.query.draw || 0,
        recordsTotal: totalRecords.length || 0,
        recordsFiltered: filteredRecords.length || 0,
        data: data
      };
      return res.status(201).json(result);*/
    } catch (error) {
      __.log(error);
      __.out(res, 201, 'Something went wrong try later');
    }
  }

  async readChallengeCriteriaLog(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let pageNum = req.query.start ? parseInt(req.query.start) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum * limit) / limit;

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

      const totalRecords = await ChallengeCriteria.aggregate([
        { $match: query },
        ...aggregateQuery,
        { $group: { _id: null, count: { $sum: 1 } } },
      ]).allowDiskUse(true);

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

      let sort = { createdAt: -1 };
      if (req.query.order) {
        let orderData = req.query.order;
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

      const filteredRecords = await ChallengeCriteria.aggregate([
        ...aggregateQuery,
        { $match: query },
        { $group: { _id: null, count: { $sum: 1 } } },
      ]).allowDiskUse(true);

      const challengeCriteriaLog = await ChallengeCriteria.aggregate([
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
      ]).allowDiskUse(true);
      const result = {
        draw: req.query.draw || 0,
        recordsTotal: totalRecords.length ? totalRecords[0].count : 0,
        recordsFiltered: filteredRecords.length ? filteredRecords[0].count : 0,
        data: challengeCriteriaLog,
      };
      return res.status(201).json(result);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, { error });
    }
  }

  async appListOfChallenge(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const skip = req.query.page ? req.query.page * 10 : 0;
      const checkUser = async () => {
        let user = await User.findById(req.user._id).lean();
        let walls = await __.getUserWalls(user);
        let channels = await __.getUserChannel(user);
        let assignedChallenges = await ChallengeStatus.aggregate([
          {
            $match: {
              userId: mongoose.Types.ObjectId(req.user._id),
            },
          },
          {
            $project: { challengeId: 1, _id: 0 },
          },
        ]).allowDiskUse(true);
        assignedChallenges = assignedChallenges || [];
        let challenges = [];
        if (walls.length) {
          let wallchallenges = await Challenge.find({
            selectedWall: {
              $in: walls || [],
            },
            challengeStart: {
              $lte: new Date(),
            },
            _id: {
              $nin: assignedChallenges.map((v) =>
                mongoose.Types.ObjectId(v.challengeId),
              ),
            },
            status: 1,
          }).lean();
          wallchallenges = wallchallenges || [];
          challenges = [...challenges, ...wallchallenges];
        }
        if (channels.length) {
          let channelChallenges = await Challenge.find({
            selectedChannel: {
              $in: channels || [],
            },
            status: 1,
            challengeStart: {
              $lte: new Date(),
            },
            _id: {
              $nin: assignedChallenges.map((v) =>
                mongoose.Types.ObjectId(v.challengeId),
              ),
            },
          }).lean();
          channelChallenges = channelChallenges || [];
          challenges = [...challenges, ...channelChallenges];
        }
        for (const challenge of challenges) {
          await ChallengeStatus.findOneAndUpdate(
            { challengeId: challenge._id, userId: req.user._id },
            {
              challengeId: challenge._id,
              userId: req.user._id,
              status: true,
              totalRewardPoints: 0,
            },
            { upsert: true },
          );
        }
      };
      await checkUser();
      let challengeStatus = await ChallengeStatus.aggregate([
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
      ]).allowDiskUse(true);
      /**
       * ,{
        $skip:skip
      },{
        $limit:10
      }
       */
      challengeStatus.map((v) => {
        v.totalRewardPoints = v.totalRewardPoints || 0;
        return v;
      });
      return __.out(res, 201, challengeStatus);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async appListOfAchievements(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      await this.triggerChallenge(req.user._id, null, 'system', 5);
      const skip = req.query.page ? req.query.page * 10 : 0;
      let challengeStatus = await ChallengeStatus.aggregate([
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
            'challenge.ranks': 1,
          },
        },
      ]).allowDiskUse(true);
      /**
       * 
       * ,{
        $skip:skip
      },{
        $limit:10
      }
       */
      challengeStatus.map((v) => {
        if ('ranks' in v.challenge) {
          return v;
        }
        return (v.challenge['ranks'] = [
          {
            name: 'bronze',
            index: 0,
            startRange: 10,
            endRange: 50,
          },
          {
            name: 'silver',
            index: 1,
            startRange: 51,
            endRange: 100,
          },
          {
            name: 'gold',
            index: 2,
            startRange: 101,
            endRange: 500,
          },
        ]);
      });
      return __.out(res, 201, challengeStatus);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async appListOfRanks(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      if (req.query.challengeId) {
        const page = (req.query.page || 0) * 10;
        const challengeId = mongoose.Types.ObjectId(req.query.challengeId);
        let ranks = await ChallengeStatus.aggregate([
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
        ]).allowDiskUse(true);
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
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async directRewards(req, res) {
    try {
      /*const directRewardStatus = async () => {
        let count = await Challenge.count({
          administrators: req.user._id,
          criteriaType: 4,
          status: 1,
          challengeStart: {
            $lte: new Date()
          },
          challengeEnd: {
            $gte: new Date()
          }
        });
        return !!count;
      }
      const flag = await directRewardStatus(req);
      if (!flag) {
        return __.out(res, 300, 'No direct rewards assigned');
      }*/
      const challenges = await Challenge.find({
        _id: req.body.challengeId,
        challengeEnd: {
          $gte: new Date(),
        },
        status: 1,
      })
        .select({ _id: 1 })
        .lean();
      const user = await User.findById(req.body.userId)
        .select({ _id: 1, rewardPoints: 1 })
        .lean();
      if (!!challenges && challenges.length && !!user) {
        let userRewards = parseInt(user.rewardPoints) || 0;
        const challenge = challenges[0];
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
        const challengeStatus = await ChallengeStatus.findOne({
          challengeId: challenge._id,
          userId: req.body.userId,
        })
          .select('_id totalRewardPoints')
          .lean();
        const totalRewardPoints =
          (challengeStatus.totalRewardPoints || 0) + criteria.rewardPoints;
        const rewardPoints = userRewards + criteria.rewardPoints;
        const challengeCriteria = await new ChallengeCriteria(criteria).save();
        const result = await ChallengeStatus.update(
          { challengeId: challenge._id, userId: challengeCriteria.userId },
          { totalRewardPoints },
        );
        await User.update({ _id: user._id }, { rewardPoints });
        if (!!result) {
          return __.out(res, 201, 'Reward added successfully');
        }
        return __.out(res, 300, 'Reward not added successfully');
      } else {
        return __.out(res, 300, 'Challenge or User not found');
      }
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
  async getBadges(req, res) {
    try {
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
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
  async saveBadge(req, res) {
    try {
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
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
  async getRecentChallenges(req, res) {
    try {
      let challengeStatus = await ChallengeStatus.aggregate([
        {
          $match: {
            userId: mongoose.Types.ObjectId(req.user._id),
            totalRewardPoints: {
              $eq: 0,
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
      ]).allowDiskUse(true);
      return __.out(res, 201, challengeStatus);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
  async getNomineeQuestions(req, res) {
    try {
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
          $project: { questions: 1, formStatus: 1 },
        },
        {
          $project: {
            'questions.question': 1,
            'questions._id': 1,
            'questions.type': 1,
            formStatus: 1,
          },
        },
      ]);
      let moduleQuestions = questions
        .map((question) => question.questions)
        .filter((question) => question.type === 14);
      return __.out(res, 201, {
        questions: moduleQuestions,
        formStatus: questions[0].formStatus,
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
}

module.exports = new challenge();
