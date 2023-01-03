// Controller Code Starts here
const mongoose = require('mongoose'),
    Session = require('../../models/EventSession'),    
    moment = require("moment"),
    _ = require('lodash'),
    __ = require('../../../helpers/globalFunctions');

class session {

    async create(req, res) {
        console.log("Evevnt Session:::::",req);
        try{
            let sessionsArray =[];
            console.log("req.sessions:",req.sessions);
            for (let elem of req.sessions) {
                elem.startDate = moment(elem.startDate).utc().format();
                elem.startTime = elem.startDate;
                elem.endDate = moment(elem.endDate).utc().format();
                elem.endTime = elem.endDate;
                console.log("elem:::::::::",elem)
            // Create Session
            let insertSession = {
                eventId:req._id,
                startDate:elem.startDate,
                endDate:elem.starstartDatetTime,
                startTime:elem.endDate,
                endTime:elem.endDate,
                startTimeInSeconds: 234527834,
                endTimeInSeconds: 623523442,
                totalParticipantPerSession:elem.totalParticipantPerSession,
                location:elem.location,
                totalConfirmedStaff: 0,
                RemainingStaff:0,
                assignAdmin:elem.assignAdmin,
                createdBy:req._id,
                createdOn: new Date(),
                postType: req.postType,
                status: req.status
            };
            console.log("::::::::::insertSession:::::::",insertSession)
            let newPost = await new Session(insertSession).save();
        
            sessionsArray.push(newPost);
        }
        console.log("::::::::::::sessionsArray::::::::::",sessionsArray);
        return sessionsArray;

            // let newSession = await new Session(insertSession).save();

            // let postType = __.toTitleCase(req.body.postType);
            // return __.out(res, 201, `Session Created`);

        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }

    // async update(req, res) {
    //     try {

           

    //         // Get User's assigned channels
    //         let userChannelIds = await __.getUserChannel(req.user);

    //         let postType = __.toTitleCase(req.body.postType);
    //         let postData = await Post.findOne({
    //             _id: req.body.postId,
    //             channelId: {
    //                 $in: userChannelIds
    //             },
    //             status: {
    //                 $nin: [3]
    //             }
    //         });
    //         if (!postData) {
    //             return __.out(res, 300, `${postType} Not Found`);
    //         }

    //         if (req.files && req.files['teaserImage']) {
    //             req.body.teaser['image'] = "uploads/posts/" + req.files['teaserImage'][0].filename;
    //             if (req.body.content.isTeaserImage == true) {
    //                 __.log(req.body.content.isTeaserImage, "req.body.content.isTeaserImage")
    //                 req.body.content['image'] = req.body.teaser['image'];
    //             }
    //         }
    //         if (req.files && req.files['mainImage']) {
    //             req.body.content['image'] = "uploads/posts/" + req.files['mainImage'][0].filename;
    //         }

    //         // Create Channel
    //         req.body.teaser.image = req.body.teaser.image || postData.teaser.image;
    //         req.body.content.image = req.body.content.image || postData.content.image;
    //         postData.channelId = req.body.channelId;
    //         postData.categoryId = req.body.categoryId;
    //         postData.teaser = req.body.teaser;
    //         postData.content = req.body.content;
    //         postData.eventDetails = req.body.eventDetails;
    //         postData.publishing = req.body.publishing;
    //         postData.userOptions = req.body.userOptions;
    //         postData.postType = req.body.postType;
    //         postData.status = req.body.status;
    //         postData.notifiedSent = false;


    //         //  // Link Module
    //         if (req.body.moduleId) {

    //             let moduleCheck = await BuilderModule.findOne({
    //                 _id: req.body.moduleId,
    //                 createdBy: req.user._id,
    //                 status: 1
    //             }).lean();

    //             if (!moduleCheck) {
    //                 return __.out(res, 300, `Module Not Found`);
    //             }

    //         //     // Check module is already linked
    //             if (postData.status == 1 && req.body.postId) {
    //                 let moduleLinked = await Post.findOne({
    //                     _id: {
    //                         $nin: [req.body.postId]
    //                     },
    //                     moduleId: req.body.moduleId,
    //                     status: 1
    //                 }).lean();
    //                 if (moduleLinked) {
    //                     return __.out(res, 300, `Module is already Linked !`);
    //                 }
    //             }

    //             postData.moduleIncluded = true;
    //             postData.moduleId = req.body.moduleId;

    //         } else {
    //             postData.moduleIncluded = false;
    //         }

    //         let updatedPost = await postData.save();

    //         var isWallUpdated;
    //         if (req.body.postType == 'event') {
    //             isWallUpdated = await updateWall(updatedPost);
    //         }

    //         let logPost = {
    //             channelId: req.body.channelId,
    //             categoryId: req.body.categoryId,
    //             teaser: req.body.teaser,
    //             content: req.body.content,
    //             eventDetails: req.body.eventDetails,
    //             publishing: req.body.publishing,
    //             userOptions: req.body.userOptions,
    //             postType: req.body.postType,
    //             status: req.body.status,
    //             authorId: req.user._id,
    //             logstatus: 2 //updated
    //         };
    //         if (req.body.postType == 'event') {
    //             logPost = {
    //                 ...logPost,
    //                 ...{
    //                     wallId: updatedPost._id,
    //                     wallName: updatedPost.wallName
    //                 }
    //             }
    //         }

    //         await postLogController.create(logPost, res);

    //         return __.out(res, 201, `${postType} Updated`);

    //     } catch (err) {
    //         __.log(err);
    //         return __.out(res, 500);
    //     }

        // =========>>>>>>>>>>>>>>>>>>>>>>> Update event wall <<<<<<<<<<<<<<<<<<<<<<<<<<<<============

//         async function updateWall(req) {
//             try {

//                 let channelData = await ChannelModel.findOne({
//                     _id: req.channelId
//                 }).lean();

//                 if (!channelData)
//                     return false

//                 if (req.wallId) {

//                     req.content.title = req.content.title.replace(/<(.|\n)*?>/g, ' ');

//                     let newWall = await SocialWallModel.findOneAndUpdate({
//                         _id: req.wallId
//                     }, {
//                         $set: {
//                             wallName: req.content.title,
//                             bannerImage: req.content.isTeaserImage,
//                             assignUsers: channelData.userDetails,
//                             status: req.status
//                         }
//                     }, {
//                         new: true
//                     });
//                 }

//                 return true;

//             } catch (error) {
//                 __.log(error);
//                 return false;
//             }
//         }
//     }

//     async remove(req, res) {
//         try {
//             let where = {
//                 _id: req.params.postId,
//                 authorId: req.user._id,
//                 status: {
//                     $nin: [3]
//                 }
//             };
//             var removedPost = await Post.findOne(where);

//             if (!removedPost) {
//                 return __.out(res, 300, "News/ Event Not Found");
//             }

//             removedPost.status = 3;
//             await removedPost.save();

//             return __.out(res, 200, "News/ Event Deleted");

//         } catch (err) {
//             __.log(err);
//             return __.out(res, 500, err);
//         };
//     }

//     async readOne(req, res) {

//         try {

//             let where = {
//                 _id: req.params.postId,
//                 status: {
//                     $nin: [3]
//                 }
//             };
//             var postData = await Post.findOne(where).populate({
//                 path: "authorId",
//                 select: "_id name profilePicture"
//             }).populate({
//                 path: "categoryId",
//                 select: "_id name"
//             }).lean();

//             if (!postData) {
//                 return __.out(res, 300, "News/Event Not Found");
//             }

//             return __.out(res, 201, postData);

//         } catch (err) {
//             __.log(err);
//             return __.out(res, 500, err);
//         };
//     }


//     async read(req, res) {

//         try {
//             // user can manage the 
//             let channelIds = await __.getUserChannel(req.user);

//             let where = {
//                 status: {
//                     $nin: [3]
//                 }
//             };
//             // if he is not assigning to any channel return empty
//             if (channelIds.length > 0) {
//                 where.channelId = {
//                     $in: channelIds
//                 };
//             } else {
//                 return __.out(res, 201, {
//                     total: 0,
//                     postList: []
//                 });
//             }

//             if (req.query.postType) {
//                 where.postType = req.query.postType;
//             }
//             if (req.query.channelId) {
//                 where.channelId = req.query.channelId;
//             }
//             if (req.query.categoryId) {
//                 where.categoryId = req.query.categoryId;
//             }

//             // Get Post Filtered List
//             var postList = await Post.find(where).populate({
//                 path: "authorId",
//                 select: "_id name parentBussinessUnitId profilePicture",
//                 populate: {
//                     path: 'parentBussinessUnitId',
//                     select: 'name status sectionId',
//                     populate: {
//                         path: 'sectionId',
//                         select: 'name status departmentId',
//                         populate: {
//                             path: 'departmentId',
//                             select: 'name status companyId',
//                             populate: {
//                                 path: 'companyId',
//                                 select: 'name status'
//                             }
//                         }
//                     }
//                 }
//             }).populate({
//                 path: "channelId",
//                 select: "_id name logo"
//             }).populate({
//                 path: "categoryId",
//                 select: "_id name"
//             }).sort({
//                 "createdAt": -1
//             }).lean();



//             return __.out(res, 201, {
//                 total: postList.length,
//                 postList: postList
//             });

//         } catch (err) {
//             __.log(err);
//             return __.out(res, 500, err);
//         };
//     }

//     async getAuthorChannels(req, res) {
//         try {
//             let BussinessUnitIds = await __.getCompanyBU(req.user.companyId, "subsection");

//             let channelIds = await __.getUserChannel(req.user);

//             var channelList = await Channel.find({
//                 _id: {
//                     $in: channelIds
//                 }
//             }).lean();

//             if (req.body.internalApi === true) {
//                 return channelList;
//             }

//             // Make Category Inside Channel
//             let getCat = async function () {
//                 let count = 0;
//                 for (let elem of channelList) {
//                     let cat = await PostCategory.find({
//                         channelId: elem._id,
//                         status: 1
//                     }).select("_id name").lean();
//                     channelList[count].categoryList = cat;
//                     count++;
//                 }
//             };

//             await getCat();

//             return __.out(res, 201, {
//                 total: channelList.length,
//                 channelList: channelList
//             });

//         } catch (err) {
//             __.log(err);
//             return __.out(res, 500, err);
//         };
//     }

//     async uploadContentFiles(req, res) {

//         try {

//             if (!req.file) {
//                 return __.out(res, 300, `No File is Uploaded`)
//             }

//             let filePath= `${__.serverBaseUrl()}uploads/posts/${req.file.filename}`;

//            return res.json({
//              link: filePath,
//              data: {  link: filePath }
//             });

//             // return ({link:filePaths}),__.out(res, 201, {
//             //     link: filePath
//             // });

//         } catch (err) {
//             __.log(err);
//             return __.out(res, 500, err);
//         };
//     }

//     // Get all Posts - Manage Event and Manage News
//     async reportedPosts(req, res) {
//         try {

//             let pageNum = (req.query.start) ? parseInt(req.query.start) : 0;
//             let limit = (req.query.length) ? parseInt(req.query.length) : 10;
//             let skip = (req.query.skip) ? parseInt(req.query.skip) : ((pageNum) * limit) / limit;

//             // User as admin in chennel
//             let searchQuery = {
//                 companyId: req.user.companyId,
//                 status: 1,
//                 userDetails: {
//                     $elemMatch: {
//                         admin: {
//                             $in: [req.user._id]
//                         }
//                     }
//                 }
//             };
//             let chennelId = await ChannelModel.find(searchQuery).lean();
//             chennelId = chennelId.map(v => {
//                 return mongoose.Types.ObjectId(v._id)
//             });
//             // User as Manage Event and Manage News

//             let query = {
//                 reportCount:{
//                     $gt: 0
//                 },
//                 "channelId._id": {
//                     $in: chennelId
//                 },
//                 status: {
//                     $in: [1, 2]
//                 },
//                 postType: req.params.postType
//             };
           
//             var isSearched = false;
//             if (req.query.search.value) {
//                 isSearched = true;
//                 query['$or'] = [{
//                     "teaser.title": {
//                         '$regex': `${req.query.search.value}`,
//                         '$options': 'i'
//                     }
//                 }, {
//                     "channelId.name": {
//                         '$regex': `${req.query.search.value}`,
//                         '$options': 'i'
//                     }
//                 }];
//             }

//             let sort = {};
//             if (req.query.order) {
//                 let orderData = req.query.order;
//                 for (let i = 0; i < orderData.length; i++) {
//                     switch (orderData[i].column) {
//                         case '0':
//                             sort[`teaser.title`] = getSort(orderData[i].dir);
//                             break;
//                         case '1':
//                             sort[`channelId.name`] = getSort(orderData[i].dir);
//                             break;
//                         default:
//                             sort[`status`] = getSort(orderData[i].dir);
//                             break;
//                     }
//                 }
//             }

//             function getSort(val) {
//                 if (val === 'asc')
//                     return 1
//                 else
//                     return -1
//             }

//             let postList = await Post.aggregate([ {
//                 $lookup: {
//                     from: 'users',
//                     localField: 'authorId',
//                     foreignField: '_id',
//                     as: 'author'
//                 }
//             }, {
//                 $unwind: "$author"
//             }, {
//                 $lookup: {
//                     from: 'channels',
//                     localField: 'channelId',
//                     foreignField: '_id',
//                     as: 'channelId'
//                 }
//             }, {
//                 $unwind: "$channelId"
//             },{
//                 $match: query
//             }, {
//                 $sort: sort
//             }, {
//                 $skip: skip
//             }, {
//                 $limit: limit
//             }])

//             // Get all post id
//             let postIds = postList.map(v => v._id)
          
//             const reportUsers = await ReportChennelPost.find({
//                 postId: {
//                     $in: postIds
//                 }
//             }).populate({
//                 path: "userId",
//                 select: "name userName profilePicture"
//             }).lean();
//             postList = postList.map(p => {
//                 p['userList'] = reportUsers.filter(v => p._id.toString() == v.postId.toString());
//                 return p;
//             });
             

//             let totalCount;
//             let totalUserCount = await Post.count({
//                 reportCount: {
//                     $gt: 0
//                 },
//                 channelId: {
//                     $in: chennelId
//                 },
//                 status: {
//                     $in: [1, 2]
//                 }
//             }).lean();
//             if (isSearched) {
//                 totalCount = await Post.aggregate([{
//                     $lookup: {
//                         from: 'users',
//                         localField: 'authorId',
//                         foreignField: '_id',
//                         as: 'author'
//                     }
//                 }, {
//                     $unwind: "$author"
//                 }, {
//                     $lookup: {
//                         from: 'channels',
//                         localField: 'channelId',
//                         foreignField: '_id',
//                         as: 'channelId'
//                     }
//                 }, {
//                     $unwind: "$channelId"
//                 }, 
//                 {
//                     $match: query
//                 }]);
//                 totalCount = totalCount.length;
//             } else {
//                 totalCount = totalUserCount
//             }

//             let result = {
//                 draw: req.query.draw || 0,
//                 recordsTotal: totalUserCount || 0,
//                 recordsFiltered: totalCount || 0,
//                 data: postList
//             }
//             return res.status(201).json(result);

//         } catch (err) {
//             __.log(err);
//             return __.out(res, 500);
//         }
//     }

//     // Get all Posts - 
//     async reportedComments(req, res) {
//         try {

//             let pageNum = (req.query.start) ? parseInt(req.query.start) : 0;
//             let limit = (req.query.length) ? parseInt(req.query.length) : 10;
//             let skip = (req.query.skip) ? parseInt(req.query.skip) : ((pageNum) * limit) / limit;

//             // User as admin in wall
//             let searchQuery = {
//                 companyId: req.user.companyId,
//                 status: 1,
//                 userDetails: {
//                     $elemMatch: {
//                         admin: {
//                             $in: [req.user._id]
//                         }
//                     }
//                 }
//             };
//             let channelIds = await Channel.find(searchQuery).lean();
//             channelIds = channelIds.map(v => {
//                 return mongoose.Types.ObjectId(v._id)
//             });
//             let postIds = await Post.find({
//                 channelId: {
//                     $in: channelIds
//                 },
//                 status: 1
//             }).lean();
//             postIds = postIds.map(v => {
//                 return mongoose.Types.ObjectId(v._id)
//             });

//             let query = {
//                 // reportList: {
//                 //     $ne: []
//                 // },
//                 "postId._id": {
//                     $in: postIds
//                 },
//                 status: {
//                     $in: [1, 2]
//                 }
//             };

//             var isSearched = false;
//             if (req.query.search.value) {
//                 isSearched = true;
//                 query['$or'] = [{
//                     "comment": {
//                         '$regex': `${req.query.search.value}`,
//                         '$options': 'i'
//                     }
//                 }, {
//                     "postId.title": {
//                         '$regex': `${req.query.search.value}`,
//                         '$options': 'i'
//                     }
//                 }, {
//                     "wallId.wallName": {
//                         '$regex': `${req.query.search.value}`,
//                         '$options': 'i'
//                     }
//                 }];
//             }

//             let sort = {};
//             if (req.query.order) {
//                 let orderData = req.query.order;
//                 for (let i = 0; i < orderData.length; i++) {
//                     switch (orderData[i].column) {
//                         case '0':
//                             sort[`comment`] = getSort(orderData[i].dir);
//                             break;
//                         case '1':
//                             sort[`postId.title`] = getSort(orderData[i].dir);
//                             break;
//                         case '2':
//                             sort[`channelId.name`] = getSort(orderData[i].dir);
//                             break;
//                         default:
//                             sort[`status`] = getSort(orderData[i].dir);
//                             break;
//                     }
//                 }
//             }

//             function getSort(val) {
//                 if (val === 'asc')
//                     return 1
//                 else
//                     return -1
//             }

//             let commentList = await PostComment.aggregate([{
//                     $lookup: {
//                         from: 'posts',
//                         localField: 'postId',
//                         foreignField: '_id',
//                         as: 'postId'
//                     }
//                 }, {
//                     $unwind: "$postId"
//                 },
//                 {
//                     $lookup: {
//                         from: 'channels',
//                         localField: 'postId.channelId',
//                         foreignField: '_id',
//                         as: "postId.channelId"
//                     }
//                 }, {
//                     $unwind: "$postId.channelId"
//                 }, {
//                     $unwind: "$reportList"
//                 },
//                 {
//                     $lookup: {
//                         from: 'users',
//                         localField: 'reportList.reportedBy',
//                         foreignField: '_id',
//                         as: "reportList.reportedBy"
//                     }
//                 }, {
//                     "$group": {
//                         "_id": "$_id",
//                         "comment": {
//                             $first: "$comment"
//                         },
//                         "postId": {
//                             $first: "$postId"
//                         },
//                         "reportList": {
//                             $push: "$reportList"
//                         },
//                         "status": {
//                             $first: "$status"
//                         },
//                     }
//                 }, {
//                     $match: query
//                 }, {
//                     $sort: sort
//                 }, {
//                     $skip: skip
//                 }, {
//                     $limit: limit
//                 }
//             ])

//             // Get all post ids
//             // let commentIds = commentList.map(v => v._id)
//             // const reportUsers = await ReportCommentModel.find({
//             //     commentId: {
//             //         $in: commentIds
//             //     }
//             // }).populate({
//             //     path: "userId",
//             //     select: "name userName profilePicture"
//             // }).lean();
//             // commentList = commentList.map(p => {
//             //     p['userList'] = reportUsers.filter(v => p._id.toString() == v.commentId.toString());
//             //     return p;
//             // });

//             commentList = commentList.map(v => {

//                 let data = {
//                     _id: v._id,
//                     comment: v.comment,
//                     postTitle: v.postId.teaser.title.replace(/<(.|\n)*?>/g, ' '),
//                     channelName: v.postId.channelId.name,
//                     reportList: v.reportList.map(j => {
//                         return {
//                             staffId: j['reportedBy'][0].staffId,
//                             name: j['reportedBy'][0].name,
//                             reportedAt: j.reportedAt
//                         }
//                     }),
//                     status: v.status
//                 }

//                 return data;
//             })

//             let totalCount;
//             let totalUserCount = await PostComment.count({
//                 reportCount: {
//                     $nin: [0]
//                 },
//                 channelId: {
//                     $in: channelIds
//                 },
//                 status: {
//                     $in: [1, 2]
//                 }
//             }).lean();
//             if (isSearched) {
//                 totalCount = await PostComment.aggregate([{
//                     $lookup: {
//                         from: 'channels',
//                         localField: 'channelId',
//                         foreignField: '_id',
//                         as: 'channelId'
//                     }
//                 }, {
//                     $unwind: "$channelId"
//                 }, {
//                     $lookup: {
//                         from: 'posts',
//                         localField: 'postId',
//                         foreignField: '_id',
//                         as: 'postId'
//                     }
//                 }, {
//                     $unwind: "$postId"
//                 }, {
//                     $match: query
//                 }])
//                 totalCount = totalCount.length
//             } else {
//                 totalCount = totalUserCount
//             }

//             let result = {
//                 draw: req.query.draw || 0,
//                 recordsTotal: totalUserCount || 0,
//                 recordsFiltered: totalCount || 0,
//                 data: commentList
//             }
//             return res.status(201).json(result);

//         } catch (err) {
//             __.log(err);
//             return __.out(res, 500);
//         }
//     }

//    // Get all Update Posts - News and Events 
//    async updatereviewPost(req, res) {
//     try {
//         let requiredResult = await __.checkRequiredFields(req, ['postId', 'status']);

//         if (requiredResult.status == false)
//             return __.out(res, 400, requiredResult.missingFields);

//         let isUpdated = await Post.update({
//             _id: req.body.postId
//         }, {
//             $set: {
//                 status: req.body.status
//             }
//         }).lean();

//         if (!isUpdated)
//             return __.out(res, 300, "Oops error while updating status");

//         return __.out(res, 201, "Updated successfully");

//     } catch (err) {

//         __.log(err);
//         __.out(res, 500);

//     }
// }

// // Get all Update Posts - News and Events 
// async updateCommentStatus(req, res) {
//     try {
//         let requiredResult = await __.checkRequiredFields(req, ['postId', 'status']);

//         if (requiredResult.status == false)
//             return __.out(res, 400, requiredResult.missingFields);

//         let isUpdated = await PostComment.update({
//             _id: req.body.postId
//         }, {
//             $set: {
//                 status: req.body.status
//             }
//         }).lean();

//         if (!isUpdated)
//             return __.out(res, 300, "Oops error while updating status");

//         return __.out(res, 201, "Updated successfully");

//     } catch (err) {

//         __.log(err);
//         __.out(res, 500);

//     }
// }


}
session = new session();
module.exports = session;