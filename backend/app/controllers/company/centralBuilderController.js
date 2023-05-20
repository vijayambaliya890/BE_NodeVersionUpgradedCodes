// Controller Code Starts here
const mongoose = require('mongoose'),
  User = require('../../models/user'),
  path = require('path'),
  Notification = require('../../models/notification'),
  WallPost = require('../../models/wallPost'),
  Post = require('../../models/post'),
  BuilderModule = require('../../models/builderModule'),
  CustomForm = require('../../models/customForms'),
  Question = require('../../models/question'),
  _ = require('lodash'),
  __ = require('../../../helpers/globalFunctions');
  const { AssignUserRead } = require('../../../helpers/assinguserread');

class channel {
  async create(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let reqFields = ['moduleName', 'questions', 'viewCount', 'status'];
      if (req.body && req.body.postSubmissionRequired)
        reqFields.push(
          ...[
            'postSubmissionRequired',
            'postSubmissionMessage',
            'postSubmissionImage',
            'postSubmissionResponse',
          ],
        );

      let requiredResult = await __.checkRequiredFields(
        req,
        reqFields,
        'builderModule',
      );
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      if (!__.checkSpecialCharacters(req.body, 'modules')) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      // Existing Module Name
      let moduleExists = await BuilderModule.findOne({
        moduleName: { $regex: new RegExp(`^${req.body.moduleName}$`, 'i') },
        companyId: req.user.companyId,
        createdBy: req.user._id,
        status: {
          $ne: 3,
        },
      });
      if (moduleExists) {
        if (
          moduleExists.moduleName.toLowerCase() ==
          req.body.moduleName.toLowerCase()
        ) {
          res.status(300).json({ message: 'Module Name Already Exists' });
        } else {
          return __.out(res, 300, 'Module Name Already Exists');
        }
      } else {
        // Create Builder Module
        let builderModule = new BuilderModule();
        builderModule.moduleName = req.body.moduleName;
        builderModule.randomOrder = req.body.randomOrder;
        builderModule.viewCount =
          req.body.viewCount || req.body.questions.length;
        builderModule.status = req.body.status || 0;
        builderModule.companyId = req.user.companyId;
        builderModule.createdBy = req.user._id;
        builderModule.questions = [];
        builderModule.welComeAttachement = req.body.welComeAttachement || '';
        builderModule.welComeMessage = req.body.welComeMessage || '';
        builderModule.closingMessage = req.body.closingMessage || '';
        builderModule.mobileModule = req.body.mobileModule || 0;
        if (req.body.postSubmissionRequired) {
          builderModule.postSubmissionRequired =
            req.body.postSubmissionRequired;
          builderModule.postSubmissionMessage = req.body.postSubmissionMessage;
          builderModule.postSubmissionImage = req.body.postSubmissionImage;
          builderModule.postSubmissionResponse =
            req.body.postSubmissionResponse;
        }
        for (let singleQns of req.body.questions) {
          // 1-Free Text(Long), 2-multipleChoice( checkbox ), 3-trueFalse , 4-polling, 5 -radio button, 6.Signature, 7. Profile Fields, 8.Free Text(Short) , 9. Numeric, 10. Date & Time, 11. DropDown, 12. Attachement,13. Star Rating, 14.Conditional Questions
          let qnsData = {
            question: singleQns.question,
            type: singleQns.type,
            indexNum: singleQns.indexNum,
            required: singleQns.required,
            moduleId: builderModule._id,
          };
          // options enabled
          qnsData.options = singleQns.options || [];
          qnsData.explanation = singleQns.explanation || '';
          let newQns = await new Question(qnsData).save();
          builderModule.questions.push(newQns._id);
        }

        let moduleId = await builderModule.save();
        if (req.body.mobileModule) {
          res.status(201).json(moduleId);
        }
        return __.out(res, 200, { moduleId: moduleId });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async update(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(
        req,
        ['moduleId', 'moduleName', 'questions', 'viewCount', 'status'],
        'builderModule',
      );
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      if (!__.checkSpecialCharacters(req.body, 'modules')) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }
      __.log(req.body);
      // Module Name Existence
      let moduleExists = await BuilderModule.findOne({
        _id: {
          $ne: req.body.moduleId,
        },
        moduleName: req.body.moduleName,
        companyId: req.user.companyId,
        createdBy: req.user._id,
        status: {
          $ne: 3,
        },
      });
      if (moduleExists) {
        return __.out(res, 300, 'Module Name Already Exists');
      }

      // Module Data
      let moduleData = await BuilderModule.findOne({
        _id: req.body.moduleId,
        createdBy: req.user._id,
        status: {
          $ne: 3,
        },
      });
      if (!moduleData) {
        return __.out(res, 300, 'Module Id Not Found');
      }

      // Update Builder Module
      moduleData.moduleName = req.body.moduleName;
      moduleData.randomOrder = req.body.randomOrder;
      moduleData.viewCount = req.body.viewCount || req.body.questions.length;
      moduleData.status = req.body.status || 0;
      moduleData.companyId = req.user.companyId;
      moduleData.createdBy = req.user._id;
      moduleData.questions = [];
      let newQnsIds = [];
      __.log(req.body.questions, 'req.body.questions');
      for (let singleQns of req.body.questions) {
        // 1-Free Text(Long), 2-multipleChoice( checkbox ), 3-trueFalse , 4-polling, 5 -radio button, 6.Signature, 7. Profile Fields, 8.Free Text(Short) , 9. Numeric, 10. Date & Time, 11. DropDown, 12. Attachement,13. Star Rating, 14.Conditional Questions
        let qnsData = {
          question: singleQns.question,
          type: singleQns.type,
          indexNum: singleQns.indexNum,
          required: singleQns.required,
          maxlength: singleQns.maxlength,
        };
        // options enabled
        qnsData.options = singleQns.options || [];
        qnsData.explanation = singleQns.explanation || '';
        if (singleQns._id) {
          await Question.findOneAndUpdate(
            {
              _id: singleQns._id,
              moduleId: moduleData._id,
              status: 1,
            },
            qnsData,
          );
          moduleData.questions.push(singleQns._id);
          newQnsIds.push(singleQns._id);
        } else {
          let newQns = await new Question(qnsData).save();
          moduleData.questions.push(newQns._id);
          newQnsIds.push(newQns._id);
        }
      }

      // Remove Non Listed Questions
      await Question.update(
        {
          _id: {
            $nin: newQnsIds,
          },
          moduleId: moduleData._id,
        },
        {
          status: 3,
        },
        {
          multi: true,
        },
      );

      // Update Module
      await moduleData.save();
      return __.out(res, 200, 'Module Updated');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async updateModule(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let reqFields = ['_id', 'moduleName', 'questions', 'status'];
      if (req.body && req.body.postSubmissionRequired)
        reqFields.push(
          ...[
            'postSubmissionRequired',
            'postSubmissionMessage',
            'postSubmissionImage',
            'postSubmissionResponse',
          ],
        );

      let requiredResult = await __.checkRequiredFields(
        req,
        reqFields,
        'builderModule',
      );
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      /* if (!__.checkSpecialCharacters(req.body, "modules")) {
              return __.out(res, 300, `You've entered some excluded special characters`);
            } */

      let where = {
        _id: req.body._id,
        companyId: req.user.companyId,
        createdBy: req.user._id,
      };

      if (req.body.scoringEnabled === true) {
        // check all scoring question have answer or not
        let answerAvail = true;
        for (let singleQns of req.body.questions) {
          let question = await Question.findOne({ _id: singleQns._id }).lean();
          // mandatory question types while answer enabled are [2, 3, 5, 11, 15]
          const qusTypesToCheck = [2, 3, 5, 11];
          let answered = false;
          if (qusTypesToCheck.indexOf(question.type) + 1) {
            answered = !!question.options.find((option) => option.correctAns);
          } else {
            answered = true;
          }
          if (answerAvail) answerAvail = answered;
        }
        if (!answerAvail) {
          // answer not given for a mandatory question
          return __.out(
            res,
            300,
            'Scoring enabled, so please provide answer for all mandatory questions',
          );
        }
      }

      let setObject = {
        moduleName: req.body.moduleName,
        randomOrder: req.body.randomOrder,
        viewCount: req.body.viewCount || 0,
        status: req.body.status,
        welComeAttachement: req.body.welComeAttachement || '',
        welComeMessage: req.body.welComeMessage || '',
        closingMessage: req.body.closingMessage,
      };
      setObject.postSubmissionRequired = req.body.postSubmissionRequired
        ? req.body.postSubmissionRequired
        : false;
      setObject.postSubmissionMessage = req.body.postSubmissionRequired
        ? req.body.postSubmissionMessage
        : '';
      setObject.postSubmissionImage = req.body.postSubmissionRequired
        ? req.body.postSubmissionImage
        : '';
      setObject.postSubmissionResponse = req.body.postSubmissionRequired
        ? req.body.postSubmissionResponse
        : [];
      setObject.scoringEnabled = req.body.scoringEnabled || false;
      if (req.body.scoringEnabled === true) {
        setObject.scorePerQuestion = req.body.scorePerQuestion;
      }
      // CustomForm Update ....
      var builderModules = await BuilderModule.findOneAndUpdate(
        where,
        {
          $set: setObject,
        },
        {
          setDefaultsOnInsert: true,
        },
      ).lean();
      __.log(req.body.questions);
      for (let singleQns of req.body.questions) {
        // CustomForm Update ....
        var builderModules = await Question.updateOne(
          { _id: singleQns._id },
          {
            $set: {
              required: singleQns.required,
            },
          },
          {
            setDefaultsOnInsert: true,
          },
        ).lean();
      }
      if (!builderModules)
        return __.out(res, 300, 'BuilderModule Data not found');

      return __.out(res, 201, 'Updated Successfully!');
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }
  async questionsUpdate(req, res) {
    try {
      let bodyContent = JSON.parse(JSON.stringify(req.body));
      delete bodyContent.question;
      delete bodyContent.explanation;
      if (!__.checkHtmlContent(bodyContent)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      if (!__.checkSpecialCharacters(req.body, 'modules')) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }
      if ('moduleId' in req.body && 'question' in req.body) {
        let moduleData = await BuilderModule.findOne({
          _id: req.body.moduleId,
          createdBy: req.user._id,
          status: {
            $ne: 3,
          },
        }).lean();
        if (!!moduleData) {
          const {
            question,
            type,
            indexNum,
            required,
            moduleId,
            assignUsers,
            options,
            explanation,
            conditionalQuestions,
            value,
            description,
            dateTime,
            maxlength,
            profile,
            optionsView,
            imageSrc,
            imageSrcForDesc,
            ppimageuploadfrom,
            extendedOption,
            pollingSelectionCount = 0,
            chooseCount,
          } = req.body;
          let questionFromBody = {
            question,
            type,
            indexNum,
            required,
            moduleId,
            assignUsers,
            options,
            explanation,
            conditionalQuestions,
            value,
            description,
            dateTime,
            maxlength,
            profile,
            optionsView,
            imageSrc,
            imageSrcForDesc,
            ppimageuploadfrom,
            extendedOption,
            pollingSelectionCount,
            chooseCount,
          };
          questionFromBody.ppimageuploadfrom =
            questionFromBody.ppimageuploadfrom || 0;
          questionFromBody.dateTime = questionFromBody.dateTime || [];
          if (type === 14 && !!assignUsers && assignUsers.length) {
            const users = await AssignUserRead.read(assignUsers, null, req.user._id);
            if (!users.users.length) {
              return __.out(res, 300, `No users found with these user details`);
            }
          }
          questionFromBody.status = 1;
          questionFromBody.required = !!questionFromBody.required;
          questionFromBody.maxlength = questionFromBody.maxlength || 0;
          questionFromBody.profile = questionFromBody.profile || [];
          if (!!req.body._id) {
            questionFromBody._id = req.body._id;
            await Question.findByIdAndUpdate(req.body._id, questionFromBody);
          } else {
            questionFromBody = await new Question(questionFromBody).save();
          }
          let questions = await Question.find({
            moduleId: questionFromBody.moduleId,
            status: 1,
          })
            .sort({
              indexNum: 1,
            })
            .lean();
          const index = questions.findIndex(
            (v) => v._id.toString() === questionFromBody._id.toString(),
          );
          questions.splice(index, 1);
          questions.splice(questionFromBody.indexNum, 0, questionFromBody);
          questions = questions.map((ques, i) => {
            ques.indexNum = i;
            return ques;
          });
          for (const questionObj of questions) {
            await Question.findByIdAndUpdate(questionObj._id, questionObj);
          }
          const builderModuleQuestions = questions.map((ques) => ques._id);
          moduleData.questions = builderModuleQuestions;
          await BuilderModule.findByIdAndUpdate(moduleData._id, moduleData);
          return __.out(
            res,
            201,
            !!req.body._id
              ? 'Question updated successfully'
              : 'Question created successfully',
          );
        } else {
          return __.out(res, 300, 'Module Not Found');
        }
      } else {
        return __.out(res, 300, 'moduleId or question is missing');
      }
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async questionsUpdate1(req, res) {
    try {
      let requiredResult = await __.checkRequiredFields(
        req,
        ['moduleId', 'question'],
        'builderModule',
      );
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      // Module Data
      let moduleData = await BuilderModule.findOne({
        _id: req.body.moduleId,
        createdBy: req.user._id,
        status: {
          $ne: 3,
        },
      });
      if (!moduleData) {
        return __.out(res, 300, 'Module Id Not Found');
      }

      let newQnsIds = [];
      // 1-Free Text(Long), 2-multipleChoice( checkbox ), 3-trueFalse , 4-polling, 5 -radio button, 6.Signature, 7. Profile Fields, 8.Free Text(Short) , 9. Numeric, 10. Date & Time, 11. DropDown, 12. Attachement,13. Star Rating, 14.Conditional Questions
      let qnsData = {
        question: req.body.question,
        type: req.body.type,
        indexNum: req.body.indexNum,
        required: req.body.required,
        moduleId: moduleData._id,
        status: 1,
      };
      if (!!req.body.assignUsers && req.body.assignUsers.length) {
        qnsData['assignUsers'] = req.body.assignUsers;
      }
      // options enabled
      qnsData.options = req.body.options || [];
      qnsData.explanation = req.body.explanation || '';
      qnsData.conditionalQuestions = req.body.conditionalQuestions || [];
      qnsData.value = req.body.value || '';
      if (!!req.body.dateTime && req.body.dateTime.length) {
        qnsData.dateTime = req.body.dateTime;
      }
      qnsData.maxlength = req.body.maxlength || 0;
      qnsData.profile = req.body.profile || [];

      let data = await Question.find({
        _id: { $in: moduleData.questions },
        status: 1,
      });

      let updateFlag = false;
      if (!!req.body._id) {
        updateFlag = false;
        data.splice(qnsData.indexNum, 0, qnsData);
        let dataIndex = data.findIndex(findIndesValue);
        function findIndesValue(element) {
          return element._id == req.body._id;
        }
        data.splice(dataIndex, 1);
        data = data.map((v, i) => {
          v.indexNum = i;
          return v;
        });

        for (let details of data) {
          if (details._id == null) {
            qnsData.indexNum = details.indexNum;
            await Question.findOneAndUpdate(
              {
                _id: req.body._id,
                moduleId: moduleData._id,
                status: 1,
              },
              qnsData,
            );
          } else {
            await Question.findOneAndUpdate(
              {
                _id: details._id,
                moduleId: moduleData._id,
                status: 1,
              },
              details,
            );
          }
        }
        newQnsIds.push(req.body._id);
      } else {
        updateFlag = true;
        console.log(qnsData, 'qnsData');
        let newQns = await new Question(qnsData).save();
        newQnsIds.push(newQns._id);
        moduleData.questions = [...moduleData.questions, ...newQnsIds];
      }

      // Remove Non Listed Questions
      await Question.update(
        {
          _id: {
            $nin: newQnsIds,
          },
          moduleId: moduleData._id,
        },
        {
          status: 1,
        },
        {
          multi: true,
        },
      );

      await BuilderModule.findByIdAndUpdate(
        {
          _id: moduleData._id,
        },
        moduleData,
      );

      if (updateFlag == true) {
        let findBuilder = await BuilderModule.findOne({
          _id: req.body.moduleId,
          createdBy: req.user._id,
          status: {
            $ne: 3,
          },
        }).lean();

        let dataFind = await Question.find({
          _id: { $in: findBuilder.questions },
          status: 1,
        });
        dataFind = dataFind.map((v, i) => {
          v.indexNum = i;
          return v;
        });

        for (let details of dataFind) {
          await Question.findOneAndUpdate(
            {
              _id: details._id,
              moduleId: moduleData._id,
              status: 1,
            },
            details,
          );
        }
      }
      return __.out(res, 200, 'Module Updated');
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async remove(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let where = {
        _id: req.params.moduleId,
        createdBy: req.user._id,
        status: {
          $nin: [3],
        },
      };

      let removedModule = await BuilderModule.findOneAndUpdate(
        where,
        {
          $set: {
            status: 3,
          },
        },
        {
          new: true,
        },
      ).lean();

      if (!removedModule) {
        return __.out(res, 300, 'Module Not Found');
      }
      return __.out(res, 201, 'Module deleted');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async removeQuestions(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let moduleData = {
        _id: req.body.moduleId,
      };
      let removedQuestion = await Question.findOne({ _id: req.body.questionId })
        .remove()
        .exec();
      if (!removedQuestion) {
        return __.out(res, 300, 'Module Not Found');
      } else {
        await BuilderModule.update(
          { _id: req.body.moduleId },
          { $pullAll: { questions: [req.body.questionId] } },
        );
        // Module Data
        let moduleData = await BuilderModule.findOne({
          _id: req.body.moduleId,
          createdBy: req.user._id,
          status: {
            $ne: 3,
          },
        });

        // find questions
        let data = await Question.find({
          _id: { $in: moduleData.questions },
          status: 1,
        });
        data = data.map((v, i) => {
          v.indexNum = i;
          return v;
        });
        for (let details of data) {
          await Question.findOneAndUpdate(
            {
              _id: details._id,
              moduleId: moduleData._id,
              status: 1,
            },
            details,
          );
        }
      }
      return __.out(res, 201, 'Module deleted');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async readCentralBuilder(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let where = {
        createdBy: req.user._id,
        status: {
          $nin: [3],
        },
      };
      const draw = parseInt(req.query.draw) || 0;
      const limit = parseInt(req.query.length) || 10;
      const skip = parseInt(req.query.start) || 0;
      let recordsTotal = await BuilderModule.count(where).lean(),
        recordsFiltered;
      if (!!req.query.search && !!req.query.search.value) {
        where.$or = [
          {
            moduleName: {
              $regex: req.query.search.value,
              $options: 'i',
            },
          },
        ];
        recordsFiltered = await BuilderModule.count(where).lean();
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
              sort[`moduleName`] = getSort(orderData[i].dir);
              break;
            case '1':
              sort[`updatedAt`] = getSort(orderData[i].dir);
              break;
            case '2':
              sort[`status`] = getSort(orderData[i].dir);
              break;
          }
        }
      } else {
        sort = { updatedAt: -1 };
      }
      const data = await BuilderModule.aggregate([
        {
          $match: where,
        },
        {
          $project: {
            moduleName: { $toLower: '$moduleName' },
            originalModuleName: '$moduleName',
            updatedAt: 1,
            status: 1,
            mobileModule: 1,
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
      ]);
      data.forEach((d) => {
        d.moduleName = d.originalModuleName;
        delete d.originalModuleName;
      });
      let d = { draw, recordsTotal, recordsFiltered, data };
      return res.status(201).json(d);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async readMCentralBuilder(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let where = {
        createdBy: req.user._id,
        // mobileModule: 1,
        status: {
          $nin: [3],
        },
      };
      const skip = req.query.start ? parseInt(req.query.start) * 10 : 0;
      let recordsTotal = await BuilderModule.count(where).lean(),
        recordsFiltered;
      if (!!req.query && !!req.query.q) {
        where.$or = [
          {
            moduleName: {
              $regex: req.query.q,
              $options: 'is',
            },
          },
        ];
        recordsFiltered = await BuilderModule.count(where).lean();
      } else {
        recordsFiltered = recordsTotal;
      }
      const data = await BuilderModule.aggregate([
        {
          $match: where,
        },
        {
          $project: {
            moduleName: 1,
            updatedAt: 1,
            createdAt: 1,
            status: 1,
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $skip: skip,
        },
        {
          $limit: 10,
        },
      ]);
      let d = { recordsTotal, recordsFiltered, data };
      return res.status(201).json(d);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Listing with Pagination
  async read(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const where = {
        createdBy: req.user._id,
        status: req.query.status || {
          $nin: [3],
        },
      };
      if (req.query.nonLinkedModules == 'true') {
        const notifications = await Notification.find({
          $or: [
            {
              createdBy: req.user._id,
              moduleIncluded: true,
              status: 1,
            },
            {
              createdBy: {
                $exists: false,
              },
              moduleIncluded: true,
              status: 1,
            },
          ],
        }).lean();
        const wallPosts = await WallPost.find({
          $or: [
            {
              author: req.user._id,
              moduleIncluded: true,
              status: 1,
            },
            {
              author: {
                $exists: false,
              },
              moduleIncluded: true,
              status: 1,
            },
          ],
        }).lean();
        const posts = await Post.find({
          $or: [
            {
              authorId: req.user._id,
              moduleIncluded: true,
              status: 1,
            },
            {
              authorId: {
                $exists: false,
              },
              moduleIncluded: true,
              status: 1,
            },
          ],
        }).lean();
        const customForms = await CustomForm.find({
          $or: [
            {
              authorId: req.user._id,
              moduleIncluded: true,
              status: 1,
            },
            {
              authorId: {
                $exists: false,
              },
              moduleIncluded: true,
              status: 1,
            },
          ],
        }).lean();
        const records = [
          ...notifications,
          ...wallPosts,
          ...posts,
          ...customForms,
        ];
        const linkedModuleIds = [];
        for (const elem of records) {
          linkedModuleIds.push(elem.moduleId);
          if (elem.workflow) {
            elem.workflow.forEach((workflow) => {
              linkedModuleIds.push(workflow.additionalModuleId);
            });
          }
        }
        if (linkedModuleIds.length) {
          where._id = {
            $nin: linkedModuleIds,
          };
          where.status = 1;
        }
      }

      // Limited Number of List
      let moduleList = await BuilderModule.find(where)
        .sort({
          updatedAt: -1,
        })
        .lean();

      return __.out(res, 201, {
        moduleList: moduleList,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async readOne(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      if (!req.params.moduleId) {
        return __.out(res, 300, 'Module id not found');
      }
      let where = {
        _id: req.params.moduleId,
        // createdBy: req.user._id,
        status: {
          $nin: [3],
        },
      };
      let moduleData = await BuilderModule.findOne(where).populate({
        path: 'questions',
        populate: [
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
        ],
      });
      /*let moduleData = await BuilderModule.findOne(where).populate({
                path: "questions",
                
            }).lean();*/

      if (!moduleData) {
        return __.out(res, 300, 'Question not found');
      }

      return __.out(res, 201, {
        data: moduleData,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  //upload the file
  async uploadContentFiles(req, res) {
    try {
      if (!req.file) {
        return __.out(res, 300, `No File is Uploaded`);
      }

      let storePath = `uploads/customForm/${req.file.filename}`;
      let filePath = `${__.serverBaseUrl()}${storePath}`;

      res.status(201).send({
        link: filePath,
        filePath: storePath,
      });
      const result = /*await*/ __.scanFile(
        req.file.filename,
        `public/uploads/customForm/${req.file.filename}`,
      );
      if (!!result) {
        // return __.out(res, 300, result);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }
}

module.exports = new channel();
