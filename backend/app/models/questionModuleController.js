// Controller Code Starts here
const mongoose = require("mongoose"),
  User = require("../../models/user"),
  Notification = require("../../models/notification"),
  BuilderModule = require("../../models/builderModule"),
  Question = require("../../models/question"),
  ManageForm = require("../../models/manageForm"),
  QuestionResponse = require("../../models/questionResponse"),
  TrackedQuestion = require("../../models/trackUserQns"),
  CustomForm = require("../../models/customForms"),
  ManageFormLog = require("../../models/manageFormLog"),
  ChallengeModule = require("../common/challengeController"),
  _ = require("lodash"),
  __ = require("../../../helpers/globalFunctions");

class questionModule {
  async getModuleQuestions(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, ["moduleId"]);
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Module Data
      let moduleData = await BuilderModule.findOne({
        _id: req.body.moduleId,
        status: 1
      })
        .populate({
          path: "questions"
        })
        .lean();
      if (!moduleData) {
        return __.out(res, 300, `Module Not Found`);
      }

      // Questions Order By Index Number First
      if (moduleData.questions) {
        moduleData.questions = _.orderBy(
          moduleData.questions,
          ["indexNum"],
          ["asc"]
        );
      }
      //console.log(moduleData.questions.length);
      // moduleData.questions.map(value=>{
      //   //value.question
      // })
      //var content = content.replace(/<img[^>]*>/g,"");

      /**
       * Tracking Request
       */
      let trackedData = [];
      if (req.body.trackQns) {
        let searchQuery = {
          userId: req.user._id,
          moduleId: req.body.moduleId
        };
        if (req.body.notificationId) {
          searchQuery.notificationId = req.body.notificationId;
        }
        if (req.body.wallPostId) {
          searchQuery.wallPostId = req.body.wallPostId;
        }
        if (req.body.postId) {
          searchQuery.postId = req.body.postId;
        }
        if (req.body.customFormId) {
          searchQuery.customFormId = req.body.customFormId;
        }

        let existData = await TrackedQuestion.findOne(searchQuery)
          .populate({
            path: "questions"
          })
          .sort({
            indexNum: 1
          })
          .lean();
        if (existData) {
          req.body.trackedData = existData.questions;
          req.body.moduleData = moduleData;
          return this.getTrackedQuestions(req, res);
        }
      }

      const filterQuestions = v => v.conditionalQuestions.length === 0;
      //const viewQuestions = moduleData.questions.filter(filterQuestions);
      // Check Randomisation Enable Or Not
      if (moduleData.randomOrder == true) {
        // Randomisation
        let questions = moduleData.questions.filter(filterQuestions); //moduleData.questions;
        let viewCount = moduleData.viewCount;
        let requiredQns = [];
        let nonRequiredQns = [];
        let selectedRandomQns = [];
        let randomCount = 0;
        let int = 0;
        for (let elem of questions) {
          if (elem.required) {
            requiredQns.push(elem);
          } else {
            nonRequiredQns.push(elem);
          }
          // Default Tracked Data
          questions[int].selectedOptions = [];
          questions[int].answer = null;
          questions[int].qnsAnswered = false;
          int++;
        }
        randomCount = viewCount - requiredQns.length;

        // Select N Randomised Qns from Non Required Qns
        selectedRandomQns = __.getRandomElement(randomCount, nonRequiredQns);

        // Overall Qns
        let viewQuestions = [...requiredQns, ...selectedRandomQns];
        moduleData.questions.forEach((curr, i) => {
          if (
            !filterQuestions(curr) &&
            -1 === viewQuestions.findIndex(v => v._id === curr._id) &&
            curr.conditionalQuestions.some(
              cq =>
                -1 !==
                viewQuestions.findIndex(
                  v => v._id.toString() == cq.questionId.toString()
                )
            )
          ) {
            viewQuestions.push(curr);
          }
        });
        moduleData.questions = viewQuestions;
      }
      // Track Selected Questions Once viewed by user
      if (req.body.trackQns) {
        let trackData = {
          userId: req.user._id,
          moduleId: req.body.moduleId,
          questions: []
        };
        if (req.body.notificationId) {
          trackData.notificationId = req.body.notificationId;
        }
        if (req.body.wallPostId) {
          trackData.wallPostId = req.body.wallPostId;
        }
        if (req.body.postId) {
          trackData.postId = req.body.postId;
        }
        if (req.body.customFormId) {
          trackData.customFormId = req.body.customFormId;
        }
        for (let quesData of moduleData.questions) {
          trackData.questions.push(quesData._id);
        }
        await new TrackedQuestion(trackData).save();
      }

      // If polling result needed
      for (let i in moduleData.questions) {
        if (moduleData.questions[i].type == 4) {
          req.body.questionId = moduleData.questions[i]._id;
          req.body.pollingResult = true;
          req.body.internalApi = true;
          moduleData.questions[i].resultData = await this.getPollingResult(req);
        }
      }
      const getImageSrc = (strings) => {
        let imagearray =[];
        let stringsplit = strings.split('<');
        let imgfiltered = stringsplit.filter(v=> v.startsWith("img "));
        imgfiltered.forEach((item)=>{
          let newimgpos = item.split('src="')[1];
          imagearray.push(newimgpos.substring(0, newimgpos.indexOf('"')));
        });
        return imagearray;
      }

      const getVideoSrc = (strings) => {
        let videoarray = [];
        let stringsplit = strings.split('<');
        let videofiltered = stringsplit.filter(v=> v.startsWith("video ") || v.startsWith("iframe "));
        videofiltered.forEach((item)=>{
          let newvideopos = item.split('src="')[1];
          videoarray.push(newvideopos.substring(0, newvideopos.indexOf('"')));  
        });
        return videoarray;
      }

      moduleData.questions = moduleData.questions.map(question=>{
        question['images'] = getImageSrc(question.question);
        question.question = question.question.replace(/<img .*?>/g,"");
        question['videos'] = getVideoSrc(question.question);
        question.question = question.question.replace(/<video.*>.*?<\/video>/ig,'');
        return question;
      });
      console.log(moduleData.questions)
      

      return __.out(res, 201, {
        data: moduleData
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  /**
   * Get Tracked Same Questions
   */
  async getTrackedQuestions(req, res) {
    try {
      let searchQuery = {
        userId: req.user._id
      };
      if (req.body.notificationId) {
        searchQuery.notificationId = req.body.notificationId;
      }
      if (req.body.wallPostId) {
        searchQuery.wallPostId = req.body.wallPostId;
      }
      if (req.body.postId) {
        searchQuery.postId = req.body.postId;
      }
      if (req.body.customFormId) {
        searchQuery.customFormId = req.body.customFormId;
      }

      // Get Answered Questions
      let getAllSubmitted = await QuestionResponse.find(searchQuery).lean();
      let trackedData = req.body.trackedData;
      let moduleData = req.body.moduleData;

      let int = 0;
      for (let elem of trackedData) {
        trackedData[int].selectedOptions = [];
        trackedData[int].answer = "";
        trackedData[int].qnsAnswered = false;
        for (let responseData of getAllSubmitted) {
          if (
            responseData.questionId.toString() ==
            trackedData[int]._id.toString()
          ) {
            trackedData[int].selectedOptions.push(responseData.option);
            trackedData[int].answer = responseData.answer || "";
            trackedData[int].qnsAnswered = true;
          }
        }
        int++;
      }
      moduleData.questions = trackedData;

      // If polling result needed
      for (let i in moduleData.questions) {
        if (moduleData.questions[i].type == 4) {
          req.body.questionId = moduleData.questions[i]._id;
          req.body.pollingResult = true;
          req.body.internalApi = true;
          moduleData.questions[i].resultData = await this.getPollingResult(req);
        }
      }
      const getImageSrc = (strings) => {
        let stringsplit = strings.split('<');
        let imgfiltered = stringsplit.filter(v=> v.startsWith("img "));
        return imgfiltered.map((item)=>{
          let newimgpos = item.split('src="')[1];
          return newimgpos.substring(0, newimgpos.indexOf('"'));
        });
      }

      const getVideoSrc = (strings) => {
        let stringsplit = strings.split('<');
        let videofiltered = stringsplit.filter(v=> v.startsWith("video ") || v.startsWith("iframe "));
        return videofiltered.map((item)=>{
          let newvideopos = item.split('src="')[1];
          return newvideopos.substring(0, newvideopos.indexOf('"'));  
        });
      }
      moduleData.questions = moduleData.questions.map(question=>{
        question['images'] = getImageSrc(question.question);
        question.question = question.question.replace(/<img .*?>/g,"");
        question['videos'] = getVideoSrc(question.question);
        question.question = question.question.replace(/<video.*>.*?<\/video>/ig,'');
        return question;
      });
      return __.out(res, 201, {
        data: moduleData
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getPollingResult(req, res) {
    try {
      let requiredResult = await __.checkRequiredFields(req, ["questionId"]);
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Question Options
      let pollingData = await Question.findOne({
        _id: req.body.questionId,
        status: 1
      })
        .select("options")
        .lean();

      if (!pollingData) {
        return __.out(res, 300, "Question Not Found");
      }

      // Options Object
      let optionsData = {};
      for (let elem of pollingData.options) {
        optionsData[elem._id] = 0;
      }
      let matchQuery = {
        questionId: mongoose.Types.ObjectId(req.body.questionId),
        status: 1
      };
      if (req.body.notificationId) {
        matchQuery.notificationId = mongoose.Types.ObjectId(
          req.body.notificationId
        );
      }
      if (req.body.wallPostId) {
        matchQuery.wallPostId = mongoose.Types.ObjectId(req.body.wallPostId);
      }
      if (req.body.postId) {
        matchQuery.postId = mongoose.Types.ObjectId(req.body.postId);
      }
      if (req.body.customFormId) {
        matchQuery.customFormId = mongoose.Types.ObjectId(
          req.body.customFormId
        );
      }
      //__.log(matchQuery, "matchQuery");
      // Question Answers/Pollings/Responses
      let resData = await QuestionResponse.aggregate([
        {
          $match: matchQuery
        },
        {
          $group: {
            _id: "$option",
            count: {
              $sum: 1
            }
          }
        }
      ]);
      // Make Result Object
      let resultData = optionsData;
      let totalVoted = 0;
      for (let elem of resData) {
        resultData[elem._id] = elem.count;
        totalVoted = totalVoted + elem.count;
      }

      // Percentage Calculation
      let percentData = {};
      for (let key in resultData) {
        if (totalVoted > 0) {
          let percentage = Math.round((resultData[key] / totalVoted) * 100);
          percentData[key] = percentage;
        } else {
          percentData[key] = 0;
        }
      }

      // Set Return Data
      let returnData = {
        total: totalVoted,
        data: resultData,
        percentData: percentData
      };

      // Internal Api only for result
      if (req.body.internalApi == true) {
        return returnData;
      }

      return __.out(res, 201, returnData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  // Response Question Replies as same array
  async resQuestions(req, res) {
    try {
      let requiredResult = await __.checkRequiredFields(req, ["qnsresponses"]);
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      let resData = {
        userId: req.user._id,
        questionId: req.body.qnsresponses.questionId,
        options: req.body.qnsresponses.options || [],
        answer: req.body.qnsresponses.answer || ""
      };
      if (req.body.notificationId) {
        resData.notificationId = req.body.notificationId;
      }
      if (req.body.wallPostId) {
        resData.wallPostId = req.body.wallPostId;
      }
      if (req.body.postId) {
        resData.postId = req.body.postId;
      }
      if (req.body.qnsresponses.customFormId) {
        resData.customFormId = req.body.qnsresponses.customFormId;
      }
      if (!!req.body.postType) {
        if (req.body.wallPostId) {
          await ChallengeModule.triggerChallenge(
            res,
            req.user._id,
            req.body.wallPostId,
            'wall',
            2
          );
        }
        if (req.body.postId) {
          await ChallengeModule.triggerChallenge(
            res,
            req.user._id,
            req.body.postId,
            'channel',
            2
          );
        }
      }

      if (resData.options.length > 0) {
        for (let elem of resData.options) {
          resData.option = elem._id;
          await new QuestionResponse(resData).save();
        }
      } else {
        await new QuestionResponse(resData).save();
      }

      if (req.body.pollingResult) {
        req.body.questionId = req.body.qnsresponses.questionId;
        return this.getPollingResult(req, res);
      }

      return __.out(res, 201, "Submitted Successfully!!");
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getInternalModuleQuestions(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, ["formName"]);
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      //let customFormId = Buffer.from(req.body.customFormId, 'base64').toString('ascii');
      let condition = { formName: req.body.formName };
      let findModuleId = await CustomForm.findOne(condition).lean();
      let customFormId = findModuleId._id;
      // Module Data
      let moduleData = await BuilderModule.findOne({
        _id: findModuleId.moduleId,
        status: 1
      })
        .populate({
          path: "questions"
        })
        .lean();
      if (!moduleData) {
        return __.out(res, 300, `Module Not Found`);
      }

      // Questions Order By Index Number First
      if (moduleData.questions) {
        moduleData.questions = _.orderBy(
          moduleData.questions,
          ["indexNum"],
          ["asc"]
        );
      }

      /**
       * Tracking Request
       */
      let trackedData = [];
      if (req.body.trackQns) {
        let searchQuery = {
          userId: req.user._id,
          moduleId: findModuleId.moduleId
        };

        if (customFormId) {
          searchQuery.customFormId = customFormId;
        }

        let existData = await TrackedQuestion.findOne(searchQuery)
          .populate({
            path: "questions"
          })
          .sort({
            indexNum: 1
          })
          .lean();
        if (existData) {
          req.body.trackedData = existData.questions;
          req.body.moduleData = moduleData;
          return this.getTrackedQuestions(req, res);
        }
      }

      // Check Randomisation Enable Or Not
      if (moduleData.randomOrder == true) {
        // Randomisation
        let questions = moduleData.questions;
        let viewCount = moduleData.viewCount;
        let requiredQns = [];
        let nonRequiredQns = [];
        let selectedRandomQns = [];
        let randomCount = 0;

        let int = 0;
        for (let elem of questions) {
          if (elem.required == true) {
            requiredQns.push(elem);
          } else {
            nonRequiredQns.push(elem);
          }
          // Default Tracked Data
          questions[int].selectedOptions = [];
          questions[int].answer = "";
          questions[int].qnsAnswered = false;
          int++;
        }
        randomCount = viewCount - requiredQns.length;

        // Select N Randomised Qns from Non Required Qns
        selectedRandomQns = __.getRandomElement(randomCount, nonRequiredQns);

        // Overall Qns
        moduleData.questions = [...requiredQns, ...selectedRandomQns];
      }

      // Track Selected Questions Once viewed by user
      if (req.body.trackQns) {
        let trackData = {
          userId: req.user._id,
          moduleId: req.body.moduleId,
          questions: []
        };
        if (req.body.notificationId) {
          trackData.notificationId = req.body.notificationId;
        }
        if (req.body.wallPostId) {
          trackData.wallPostId = req.body.wallPostId;
        }
        if (req.body.postId) {
          trackData.postId = req.body.postId;
        }
        if (req.body.customFormId) {
          trackData.customFormId = req.body.customFormId;
        }
        for (let quesData of moduleData.questions) {
          trackData.questions.push(quesData._id);
        }
        await new TrackedQuestion(trackData).save();
      }

      // If polling result needed
      for (let i in moduleData.questions) {
        if (moduleData.questions[i].type == 4) {
          req.body.questionId = moduleData.questions[i]._id;
          req.body.pollingResult = true;
          req.body.internalApi = true;
          //moduleData.questions[i].resultData = await this.getPollingResult(req);
        }
      }

      moduleData.customFormId = customFormId;
      moduleData.title = findModuleId.title;
      return __.out(res, 201, {
        data: moduleData
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getPollingResultArray(data) {
    try {
      const { customFormId, questionId } = data;
      let polls = await QuestionResponse.aggregate([
        {
          $match: {
            customFormId: mongoose.Types.ObjectId(customFormId),
            questionId: mongoose.Types.ObjectId(questionId),
            status: 1
          }
        },
        {
          $group: {
            _id: "$answer._id",
            count: {
              $sum: 1
            }
          }
        }
      ]);
      const total = polls.reduce((prev, curr, i) => prev + curr.count, 0);
      const options = polls.reduce((prev, curr, i) => {
        const percentage = (curr.count / total) * 100, _id = curr._id;
        return prev.concat({ _id, percentage });
      }, []);
      return { _id: questionId, options, total };
    } catch (error) {
      return __.out(res, 300, error);
    }
  }

  async resCustomFormQuestions(req, res) {
    try {
      let resData;
      let questionsIds = [];
      let userIds;
      let staffName;
      let poll = [];
      for (let data of req.body.answers) {
        if (req.user) {
          userIds = req.user._id;
          let data = await User.findOne({ _id: req.user._id })
            .select("name")
            .lean();
          staffName = data.name;
        } else {
          staffName = data.answer.userName;
        }

        resData = {
          userId: userIds,
          questionId: data._id,
          options: data.options || [],
          answer: data.answer
        };
        __.log(req.body.customFormId, "req.body.customFormId");
        if (req.body.customFormId) {
          resData.customFormId = req.body.customFormId;
        }
        if (resData.options.length > 0) {
          for (let elem of resData.options) {
            resData.option = elem._id;
            let qns = await new QuestionResponse(resData).save();
            questionsIds.push(qns._id);
          }
        } else {
          let qnsData = await new QuestionResponse(resData).save();
          questionsIds.push(qnsData._id);
        }

        if (data.type == 4) {
          console.log(data);
          const polls = await this.getPollingResultArray({
            customFormId: req.body.customFormId,
            questionId: data._id
          });
          poll.push(polls);
        }
      }

      // form status updated
      // var customFormData = await CustomForm.findOneAndUpdate({ _id: req.body.customFormId }, {
      //     $set: {
      //         formSubmitted: true
      //     }
      // }, {
      //         setDefaultsOnInsert: true
      //     }).lean();

      let manageFormDetails = {
        userId: userIds,
        customFormId: req.body.customFormId,
        staffName: staffName,
        formStatus: req.body.formStatus || [],
        questionId: questionsIds || [],
        questions: req.body.questions || []
      };
      await new ManageForm(manageFormDetails).save();
      return __.out(res, 201, {
        message: "Submitted  Successfully!!",
        data: poll
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async customFormQuestionsUpdate(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let questionsIds = [];
      var manageForm = await ManageForm.findOne({ _id: req.body.manageFormId }).populate({
          path: "customFormId",
          select: "title"
        }).lean();
      const oldData = await QuestionResponse.find({
        _id: { $in: manageForm.questionId }
      }).lean();
      let newData = [];
      /** Removing question already existed question responses  */
      await QuestionResponse.find({
        _id: { $in: manageForm.questionId }
      }).remove();
      for (let data of req.body.answers) {
        let resData = {
          userId: manageForm.userId,
          questionId: data._id,
          options: data.options || [],
          answer: data.answer,
          customFormId: manageForm.customFormId
        };
        newData[newData.length] = resData;
        let qnsData = await QuestionResponse(resData).save();
        questionsIds.push(qnsData._id);
      }
      const userId = req.user._id;
      const manageFormId = req.body.manageFormId;
      const changeType = 2;
      const changeMessage = `${manageForm.customFormId.title} was updated by ${
        req.user.name
        }`;
      var manageFormUpdate = await ManageForm.findOneAndUpdate(
        { _id: req.body.manageFormId },
        {
          $set: {
            questionId: questionsIds
          }
        },
        {
          setDefaultsOnInsert: true
        }
      );
      if (!manageFormUpdate) {
        await ManageFormLog({
          userId,
          manageFormId,
          changeType,
          oldData,
          newData,
          changeMessage
        }).save();
        return __.out(res, 300, "Updated Not Successfully!!");
      }
      return __.out(res, 201, { message: "Updated  Successfully!!" });
    } catch (err) {
      return __.out(res, 500, err);
    }
  }
}

questionModule = new questionModule();
module.exports = questionModule;
