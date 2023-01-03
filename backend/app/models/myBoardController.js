const mongoose = require('mongoose'),
    moment = require("moment"),
    User = require('../../models/user'),
    WallModel = require('../../models/wall'),
    WallPost = require('../../models/wallPost'),
    WallLike = require('../../models/wallPostLike'),
    PostView = require('../../models/wallPostView'),
    Emojis = require('../../models/emoji'),
    WallCategory = require('../../models/wallCategory'),
    WallComment = require('../../models/wallPostComment'),
    QuestionResponse = require('../../models/questionResponse'),
    __ = require(`../../../helpers/globalFunctions`),
    QuestionModule = require('./questionModuleController.js'),
    SubSection = require('../../models/subSection');

class myBoard {
    // List Filtered Walls
    async getWalls(req, res) {
        try {
            // Check user is in this wall
            let userWalls = await __.getUserWalls(req.user);

            let wallList = await WallModel.find({
                _id: {
                    $in: userWalls
                },
                status: 1
            }).populate({
                path: "category",
                select: "categoryName"
            }).populate({
                path: "user",
                strictPopulate: false,
                select: "name userName profilePicture"
            }).lean();

            wallList = wallList.map((v) => {
                let adminList = [];
                let userList = [];
                for (let elem of v.assignUsers) {
                    adminList = [...adminList, ...elem.admin];
                    userList = [...userList, ...elem.user];
                }
                v.adminList = adminList;
                v.userList = userList;

                delete v.assignUsers;
                return v;
            });

            return __.out(res, 201, wallList);
        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }

    // Walls Summary
    async wallSummary(req, res) {
        try {
            // Check user is in this wall
            let userWalls = await __.getUserWalls(req.user);
            /***  WALL SUMMARY */

            // Get all wall list
            let wallList = await WallModel.find({
                _id: {
                    $in: userWalls
                },
                status: 1
            }).populate({
                path: "category",
                select: "categoryName"
            }).populate({
                path: "user",
                strictPopulate: false,
                select: "name userName profilePicture"
            }).select('wallName bannerImage displayType postType category assignUsers').lean();


            wallList = wallList.map((v) => {
                let adminList = [];
                let userList = [];
                for (let elem of v.assignUsers) {
                    adminList = [...adminList, ...elem.admin];
                    userList = [...userList, ...elem.user];
                }
                v.adminList = adminList;
                v.userList = userList;
                delete v.assignUsers;
                return v;
            });

            // Custom quick function
            let getPostList = async function (filterQuery, sort, limit) {

                return await WallPost.find(filterQuery).populate({
                    path: "category",
                    select: "categoryName"
                }).populate({
                    path: "user",
                    select: "name userName profilePicture"
                }).populate({
                    path: "author",
                    select: "name userName profilePicture"
                }).populate({
                    path: "wallId",
                    select: "wallName bannerImage displayType postType admin",
                    populate: {
                        path: "admin",
                        select: "name profilePicture"
                    }
                }).sort(sort).limit(limit).lean();

            }
            // GET each wall's limited/featured posts 
            let int = 0;
            for (let elem of wallList) {

                let displayType = elem.displayType;
                // consolidated ( no category wise )
                // { wall.postList:[] }
                if (displayType == 1) {
                    let limit = 10;
                    let condition = { wallId: elem._id, status: 1 }
                    let wallPostList = await getPostList({ ...condition, priorityDate: { $exists: true, $gte: new Date() } }, { priorityDate: -1 }, limit);
                    if (!!wallPostList && wallPostList.length) {
                        limit = limit - wallPostList.length;
                    }
                    if (limit) {
                        const remain = wallPostList.map(v => v._id) || [];
                        let remainPosts = await getPostList({ ...condition, _id: { $nin: remain } }, { lastUpdated: -1 }, limit);
                        wallPostList = [...wallPostList, ...remainPosts];
                    }
                    wallList[int].postList = wallPostList;
                    /*for (var i = 0; i < wallList[int].postList.length; i++) {
                        if ('priorityDate' in wallList[int].postList[i] && wallList[int].postList[i].priorityDate > wallList[int].postList[i].lastUpdated) {
                            wallList[int].postList[i].filterDates = wallList[int].postList[i].priorityDate;
                        } else {
                            wallList[int].postList[i].filterDates = wallList[int].postList[i].lastUpdated;
                        }
                    }*/
                    // wallList[int].postList.sort(function (a, b) {
                    //     return new Date(b.filterDates) - new Date(a.filterDates);
                    // });
                    // separate ( category wise )
                    // { wall.category:{ [ postList:[] ] } }
                } else if (displayType == 2) {

                    let j = 0;
                    for (let cat of elem.category) {

                        wallList[int].category[j].postList = await getPostList({
                            wallId: elem._id,
                            category: cat._id,
                            status: 1
                        }, {
                                lastUpdated: -1
                            }, 10);
                        j++;
                    }
                } // end of separate wall
                int++;
            }

            /***  TOP POSTS */
            let lastMonthDate = moment().subtract(30, 'd').utc().format();
            let topPostList = await WallPost.aggregate([{
                $match: {
                    "wallId": {
                        $in: userWalls
                    },
                    "status": 1
                }
            }, {
                $lookup: {
                    from: 'wallcategories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: "$category"
            }, {
                $lookup: {
                    from: 'users',
                    localField: 'author',
                    foreignField: '_id',
                    as: 'author'
                }
            },
            {
                $unwind: "$author"
            },
            {
                $lookup: {
                    from: 'walls',
                    localField: 'wallId',
                    foreignField: '_id',
                    as: 'wallId'
                }
            },
            {
                $unwind: "$wallId"
            }, {
                $lookup: {
                    from: 'postlikes',
                    localField: '_id',
                    foreignField: 'postId',
                    as: 'likes'
                }
            }, {
                $project: {
                    "title": 1,
                    "description": 1,
                    "updatedAt": 1,
                    "createdAt": 1,
                    "wallId": 1,
                    "category": 1,
                    "title": 1,
                    "author": 1,
                    "priorityDate": 1,
                    "status": 1,
                    "assignedToList": 1,
                    "taskList": 1,
                    "reportCount": 1,
                    "sharedCount": 1,
                    "likesCount": 1,
                    "commentCount": 1,
                    "attachments": 1,
                    "description": 1,
                    "likes": {
                        "$filter": {
                            input: "$likes",
                            as: "item",
                            cond: {
                                $gte: ["$$item.createdAt", lastMonthDate]
                            }
                        }
                    }
                }
            }, {
                $project: {
                    "title": 1,
                    "description": 1,
                    "updatedAt": 1,
                    "createdAt": 1,
                    "wallId": {
                        "_id": "$wallId._id",
                        "wallName": "$wallId.wallName",
                        "bannerImage": "$wallId.bannerImage",
                        "postType": "$wallId.postType",
                        "displayType": "$wallId.displayType",
                        "assignUsers": "$wallId.assignUsers"
                    },
                    "category": {
                        "_id": "$category._id",
                        "categoryName": "$category.categoryName"
                    },
                    "author": {
                        "_id": "$author._id",
                        "name": "$author.name",
                        "profilePicture": "$author.profilePicture"
                    },
                    "priorityDate": 1,
                    "status": 1,
                    "assignedToList": 1,
                    "taskList": 1,
                    "reportCount": 1,
                    "sharedCount": 1,
                    "likesCount": 1,
                    "commentCount": 1,
                    "attachments": 1,
                    "description": 1,
                    "likesCount": {
                        $size: "$likes"
                    }
                }
            }, {
                $sort: {
                    likesCount: -1,
                    priorityDate: -1
                }

            }, {
                $limit: 20
            }
            ]);

            // Get Admin & User List of each top posts
            topPostList = topPostList.map((v) => {
                let adminList = [];
                let userList = [];
                for (let elem of v.wallId.assignUsers) {
                    adminList = [...adminList, ...elem.admin];
                    userList = [...userList, ...elem.user];
                }
                v.adminList = adminList;
                v.userList = userList;
                delete v.wallId.assignUsers;
                return v;
            });

            // Top posts, wall wise posts
            let returnData = {
                recentPolls: await this.recentPolls(req, res),
                topPosts: topPostList,
                wallSummary: wallList
            };
            
            return __.out(res, 201, returnData);

        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }

    }

    // Get all Posts - wall base
    async getPosts(req, res) {
        try {
            if(!__.checkHtmlContent(req.body)){
                return __.out(res, 300, `You've entered malicious input`);
            }
            let pageNum = (req.body.pageNum) ? parseInt(req.body.pageNum) : 1;
            let limit = (req.body.limit) ? parseInt(req.body.limit) : 10;
            let skip = (req.body.skip) ? parseInt(req.body.skip) : ((pageNum - 1) * limit);
            let requiredResult = await __.checkRequiredFields(req, ['wallId']);
            if (requiredResult.status == false) {
                return __.out(res, 400, requiredResult.missingFields);
            }
            let searchQuery = {
                status: 1
            };
            // Specified Wall or all assigned walls
            if (req.body.wallId) {
                searchQuery["wallId._id"] = mongoose.Types.ObjectId(req.body.wallId);
            } else {
                let userWalls = await __.getUserWalls(req.user);
                userWalls = userWalls.map(v => {
                    return mongoose.Types.ObjectId(v);
                });
                searchQuery["wallId._id"] = {
                    $in: userWalls
                };
            }

            if (req.body.categoryId) {
                // convert array of id strings into object id
                req.body.categoryId = req.body.categoryId.map((v) => {
                    return mongoose.Types.ObjectId(v)
                });
                searchQuery["category._id"] = {
                    $in: req.body.categoryId
                }
            } else {
                searchQuery["category.status"] = {
                    $nin: [2, 3]
                }
            }
            if (req.body.searchTitle) {
                // title/description/author name
                searchQuery['$or'] = [{
                    title: {
                        '$regex': `${req.body.searchTitle}`,
                        '$options': 'i'
                    }
                },
                {
                    description: {
                        '$regex': `${req.body.searchTitle}`,
                        '$options': 'i'
                    }
                },
                {
                    "author.name": {
                        '$regex': `${req.body.searchTitle}`,
                        '$options': 'i'
                    }
                }
                ];
            }
            if (req.body.fromDate) {
                searchQuery.createdAt = {};
                searchQuery.createdAt['$gte'] = new Date(moment(req.body.fromDate).startOf('day').utc().format());
            }
            if (req.body.toDate) {
                searchQuery.createdAt['$lte'] = new Date(moment(req.body.toDate).endOf('day').utc().format());
            }
            // Question Only Posts
            if (req.body.moduleIncluded == true) {
                searchQuery.moduleIncluded = true;
            }
            // Tasks API
            if (req.body.taskOnly == true) {
                searchQuery.taskList = {
                    $gt: []
                }
            }
            if (req.body.myTasks == true) {
                searchQuery.assignedToList = {
                    $in: [req.user._id]
                }
            }
            if (req.body.createdByUser == true) {
                searchQuery['author._id'] = mongoose.Types.ObjectId(req.user._id);
            }
            if (!!req.body.isTaskCompleted) {
                searchQuery.isTaskCompleted = req.body.isTaskCompleted;
            }
            // Dynamic Search Queries
            let postList = await WallPost.aggregate([{
                $lookup: {
                    from: 'walls',
                    localField: 'wallId',
                    foreignField: '_id',
                    as: 'wallId'
                }
            },
            {
                $unwind: "$wallId"
            },
            {
                $lookup: {
                    from: 'wallcategories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'author',
                    foreignField: '_id',
                    as: 'author'
                }
            },
            {
                $unwind: "$author"
            },
            {
                $match: searchQuery
            },
            {
                $sort: {
                    lastUpdated: -1
                }
            },
            {
                $skip: skip
            }, {
                $limit: limit
            }, {
                $project: {
                    category: 1,
                    title: 1,
                    description: 1,
                    attachments: 1,
                    reportCount: 1,
                    sharedCount: 1,
                    likesCount: 1,
                    commentCount: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    moduleIncluded: 1,
                    moduleId: 1,
                    lastUpdated: 1,
                    priorityDate: 1,
                    taskList: 1,
                    assignedToList: 1,
                    taskDueDate: 1,
                    isTaskCompleted: 1,
                    wallId: {
                        _id: "$wallId._id",
                        wallName: "$wallId.wallName",
                        bannerImage: "$wallId.bannerImage"
                    },
                    category: {
                        categoryName: "$category.categoryName"
                    },
                    author: {
                        name: "$author.name",
                        staffId: "$author.staffId",
                        profilePicture: "$author.profilePicture"
                    }
                }
            }
            ]);
            for (var i = 0; i < postList.length; i++) {
                postList[i].category = Array.isArray(postList[i].category)?postList[i].category:[postList[i].category];
                if (postList[i].priorityDate > postList[i].lastUpdated) {
                    postList[i].filterDates = postList[i].priorityDate;
                } else {
                    postList[i].filterDates = postList[i].lastUpdated;
                }
            }            
            postList.sort(function (a, b) {
                return new Date(b.filterDates) - new Date(a.filterDates);
            });

            let totalPost = await WallPost.aggregate([{
                $lookup: {
                    from: 'wallcategories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },{
                $lookup: {
                    from: 'users',
                    localField: 'author',
                    foreignField: '_id',
                    as: 'author'
                }
            },
            {
                $unwind: "$author"
            }, {
                $lookup: {
                    from: 'walls',
                    localField: 'wallId',
                    foreignField: '_id',
                    as: 'wallId'
                }
            },
            {
                $unwind: "$wallId"
            },
            {
                $match: searchQuery
            },
            {
                $sort: {
                    lastUpdated: -1
                }
            }
            ]);

            // Find User is liked this post
            let postIds = postList.map(v => v._id);
            // Get liked posts Id
            let likedIds = await WallLike.find({
                postId: {
                    $in: postIds
                },
                userId: req.user._id,
                isLiked: true,
                status: 1
            }).lean();
            likedIds = likedIds.map((v) => {
                return v.postId
            });

            // Add User liked Key
            postList = postList.map((v, i) => {

                // User Liked Status
                let checkIndex = likedIds.findIndex((x) => x.toString() == v._id).toString();
                if (checkIndex != -1) {
                    v.userLiked = true;
                } else {
                    v.userLiked = false;
                }

                // Add key doesn't exists
                v.moduleIncluded = v.moduleIncluded || false;
                v.taskList = v.taskList || [];
                v.lastUpdated = v.lastUpdated || v.createdAt;

                return v;
            });

            // Get This Companies Emojis
            let where = {
                companyId: req.user.companyId,
                status: 1
            };
            let emojiList = await Emojis.find(where).select('emoji _id status').lean();
            let taskAssigningUsers = await this.taskAssigningUsers(req);
            return __.out(res, 201, {
                data: postList || [],
                total: totalPost.length,
                emojiList: emojiList,
                taskAssigningUsers: taskAssigningUsers.map(v => {
                    return { _id: v._id, name: v.name };
                }),
                userBUs: await this.getWallBunsinessUnit(req.body.wallId)
            });

        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }

    async getWallBunsinessUnit(wallId) {
        try {
            const wall = await WallModel.findById(wallId).populate([{
                path: 'assignUsers.businessUnits',
                select: 'name sectionId',
                populate: {
                    path: 'sectionId',
                    select: 'name departmentId',
                    populate: {
                        path: 'departmentId',
                        select: 'name companyId',
                        populate: {
                            path: 'companyId',
                            select: 'name'
                        }
                    }
                }
            }]).select('assignUsers.businessUnits');
            if(!!wall){

            } else {
                return [];
            }
            let businessUnits = wall.assignUsers.reduce((prev, au, i) => {
                return prev.concat(au.businessUnits);
            }, []);
            return await businessUnits.filter(v => {
                return v.sectionId != null && v.sectionId.departmentId != null && v.sectionId.departmentId.companyId != null
            }).map(v => {
                let x = {
                    _id: v._id,
                    name: `${v.sectionId.departmentId.companyId.name} > ${v.sectionId.departmentId.name} > ${v.sectionId.name} > ${v.name}`
                }
                return x;
            });

            //return businessUnits;
        } catch (error) {
            __.log(error);
            return [];
            //return __.out(res, 300, 'Something went wrong try later');
        }
    }


    // Get all Posts - wall base
    async viewPost(req, res) {
        try {
            if(!__.checkHtmlContent(req.params)){
                return __.out(res, 300, `You've entered malicious input`);
            }
            let searchQuery = {
                _id: req.params.postId,
                status: 1
            };
            let postData = await WallPost.findOne(searchQuery).populate({
                path: "category",
                select: "categoryName"
            }).populate({
                path: "user",
                select: "name userName profilePicture"
            }).populate({
                path: "author",
                select: "name userName profilePicture"
            }).populate({
                path: "wallId",
                select: "wallName bannerImage displayType postType assignUsers isNomineeActive isTaskActive"
            }).populate({
                path: "author",
                select: "name userName profilePicture"
            }).populate({
                path: "assignedEmojis"
            }).populate({
                path: "moduleId",
                select: "moduleName"
            }).populate({
                path: "assignedToList",
                select: "name staffId profilePicture"
            }).populate({
                path: "nomineeUsers",
                select: "name staffId profilePicture"
            }).lean();

            //__.log(postData);

            if (!postData) {
                return __.out(res, 300, `Post not found`);
            }

            // Get Admin List of this post's wall
            let adminList = [];
            for (let elem of postData.wallId.assignUsers) {
                adminList = [...adminList, ...elem.admin];
            }
            postData.wallId.adminList = adminList;

            // Check user liked this post or not
            postData.userLiked = false;
            let likeData = await WallLike.findOne({
                userId: req.user._id,
                postId: postData._id,
                status: 1
            }).lean();

            if (likeData)
                postData.userLiked = likeData.isLiked || false;

            // Get This Companies Emojis
            let where = {
                companyId: req.user.companyId,
                status: 1
            };
            postData.emojiList = await Emojis.find(where).select('emoji _id name status').lean();
            req.body = req.body || {};
            req.body.wallId = postData.wallId;
            postData.category = Array.isArray(postData.category)?postData.category:[postData.category];
            postData.taskAssigningUsers = await this.taskAssigningUsers(req);
            postData.taskAssigningUsers = postData.taskAssigningUsers.map(v => {
                return { name: v.name, _id: v._id };
            });
            postData.userBUs = await this.getUserBUs(req.user);
            /** update viewHistory in postview and update count post object */
            if (postData) {
                await PostView.findOneAndUpdate({
                    wallId: postData.wallId._id,
                    wallPostId: postData._id,
                    userId: req.user._id,
                    postType: 'wall'
                }, {
                        $push: { 'viewHistory': moment().utc().format() }
                    }, {
                        'new': true,
                        'lean': true,
                        'upsert': true
                    }).then(result => {
                        if (result) { } else {
                            return __.out(res, 300, 'Not updated');
                        }
                    });
                let viewCount = await PostView.find({ wallPostId: postData._id }).count();
                await WallPost.findByIdAndUpdate(postData._id, { viewCount }, function (err, res) {
                    if (err) {
                        return __.out(res, 300, 'Not updated');
                    }
                });
            }
            /** update code end */
            return __.out(res, 201, postData);
        } catch (err) {
            __.log(err);
            return __.out(res, 300, 'Something went wrong try later');
        }
    }

    // check and uncheck tasks
    async completeTask(req, res) {
        try {
            if(!__.checkHtmlContent(req.body)){
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['taskId', 'postId']);
            if (requiredResult.status == false)
                return __.out(res, 400, requiredResult.missingFields);

            let postData = await WallPost.findOne({
                _id: req.body.postId,
                status: 1
            }).lean();

            if (!postData){
                return __.out(res, 300, 'No post found');
            }
            let taskIndex = postData.taskList.findIndex(x => x._id.toString() === req.body.taskId)

            if (taskIndex == -1)
                return __.out(res, 300, 'No Task found');

            let updateData = {
                taskList: postData.taskList
            };
            // Update Task as Completed
            updateData.taskList[taskIndex]['status'] = (req.body.status == 0) ? 0 : 1;
            updateData.taskList[taskIndex]['completedBy'] = (req.body.status == 0) ? undefined : req.user._id;
            updateData.taskList[taskIndex]['completedAt'] = (req.body.status == 0) ? undefined : moment().utc().format();
            updateData.isTaskCompleted = true;

            // If any task is pending
            for (let x of updateData.taskList) {
                if (x.status == 0) {
                    updateData.isTaskCompleted = false;
                }
            }

            let where = {
                _id: req.body.postId
            },
                update = updateData,
                options = {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                };

            let isStatusChanged = await WallPost.findOneAndUpdate(where, update, options).lean();

            if (!isStatusChanged)
                return __.out(res, 300, 'Error while completing task');

            return __.out(res, 201, 'Task Updated');

        } catch (error) {
            __.log(error);
            return __.out(res, 500);
        }

    }

    // Get all Posts - wall base
    async viewComments(req, res) {
        try {
            if(!__.checkHtmlContent(req.params)){
                return __.out(res, 300, `You've entered malicious input`);
            }
            let searchQuery = {
                postId: req.params.postId,
                status: 1
            };
            let postComments = await WallComment.find(searchQuery).populate({
                path: "userId",
                select: "name userName profilePicture"
            }).sort({
                createdAt: -1
            }).lean();

            return __.out(res, 201, {
                data: postComments
            });

        } catch (err) {

            __.log(err);
            __.out(res, 500);

        }
    }

    // User's Task Summary
    async taskSummary(req, res) {
        try {

            // Get users assigned users
            let userWallIds = await __.getUserWalls(req.user);

            // Get Active Categories - to avoid the deleted category posts
            let categoryIds = await WallCategory.find({
                wallId: {
                    $in: userWallIds
                },
                status: 1
            });
            categoryIds = categoryIds.map(v => mongoose.Types.ObjectId(v._id));

            let userWalls = await WallModel.find({
                _id: {
                    $in: userWallIds
                }
            }).populate({
                path: "category",
                select: "categoryName"
            }).populate({
                path: "user",
                strictPopulate: false,
                select: "name userName profilePicture"
            }).lean();

            userWalls = userWalls.map((v) => {
                let adminList = [];
                let userList = [];
                for (let elem of v.assignUsers) {
                    adminList = [...adminList, ...elem.admin];
                    userList = [...userList, ...elem.user];
                }
                v.adminList = adminList;
                v.userList = userList;

                delete v.assignUsers;
                return v;
            });

            // Total Created Tasks
            let createdTasks = await WallPost.count({
                category: {
                    $in: categoryIds
                },
                taskList: {
                    $gt: []
                },
                isTaskCompleted: false,
                author: req.user._id,
                status: 1
            });

            // Wall vise pending tasks
            let wallList = [];
            for (let elem of userWalls) {

                elem.pendingTasks = await WallPost.count({
                    wallId: elem._id,
                    category: {
                        $in: categoryIds
                    },
                    taskList: {
                        $gt: []
                    },
                    isTaskCompleted: false,
                    assignedToList: {
                        $in: [req.user._id]
                    },
                    status: 1
                });
                if (elem.pendingTasks > 0) {
                    wallList.push(elem);
                }

            }

            // Total Pending Tasks
            let myAssignedTasks = 0;
            for (let elem of wallList) {
                myAssignedTasks += elem.pendingTasks;
            }

            // Due in this current time - 3 Hours
            var dueTasks = await WallPost.count({
                category: {
                    $in: categoryIds
                },
                "$and": [{
                    taskDueDate: {
                        $gte: moment(req.body.reqDate).startOf('day').utc().format()
                    }
                },
                {
                    taskDueDate: {
                        $lte: moment(req.body.reqDate).endOf('day').utc().format()
                    }
                }
                ],
                taskList: {
                    $gt: []
                },
                assignedToList: {
                    $in: [req.user._id]
                },
                isTaskCompleted: false,
                status: 1
            });

            let data = {
                profile: {
                    name: req.user.name,
                    profilePicture: req.user.profilePicture,
                },
                createdTasks: createdTasks,
                wallList: wallList,
                myAssignedTasks: myAssignedTasks,
                dueTasks: dueTasks
            };

            return __.out(res, 201, data);

        } catch (error) {
            __.log(error);
            return __.out(res, 500);
        }

    }
    // Get all Posts - wall base
    async taskAssigningUsers(req) {
        try {
            if(!__.checkHtmlContent(req.body)){
                return __.out(res, 300, `You've entered malicious input`);
            }
            let wallData = await WallModel.findOne({
                _id: req.body.wallId
            });

            // In case missing wall
            if (!wallData) {
                return [];
            }
            let users = await __.wallUsersList(wallData, false);
            return users;
            /*
            // If no users are filtered out
            if (wallUsersList.length == 0) {
                return [];
            }

            let userList = await User.find({
                _id: {
                    $in: wallUsersList
                },
                status: 1
            }).select('name staffId profilePicture otherFields appointmentId').lean();

            return userList;*/

        } catch (err) {

            __.log(err);
            __.out(res, 500);

        }
    }

    // Recent Polls - Posts with question modules ( question type only 4 )
    async recentPolls(req, res) {
        try {

            // Active Walls
            let userWalls = await __.getUserWalls(req.user);

            // Get Active Categories - to avoid the deleted category posts
            let categoryIds = await WallCategory.find({
                wallId: {
                    $in: userWalls
                },
                status: 1
            }).select('_id');
            categoryIds = categoryIds.map(v => mongoose.Types.ObjectId(v._id));

            // Filter modules's question only as polling & get the first polling to show
            let postList = await WallPost.aggregate([{
                $match: {
                    category: {
                        $in: categoryIds
                    },
                    moduleIncluded: true,
                    moduleId: {
                        $exists: true
                    },
                    wallId:{
                        $exists: true
                    },
                    status: 1
                }
            }, {
                $lookup: {
                    from: 'walls',
                    localField: 'wallId',
                    foreignField: '_id',
                    as: 'wallId'
                }
            },
            {
                $unwind: "$wallId"
            }, {
                $lookup: {
                    from: 'wallcategories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: "$category"
            }, {
                $lookup: {
                    from: 'buildermodules',
                    localField: 'moduleId',
                    foreignField: '_id',
                    as: 'module'
                }
            },
            {
                $unwind: "$module"
            }, {
                $unwind: "$module.questions"
            }, {
                $lookup: {
                    from: 'questions',
                    localField: 'module.questions',
                    foreignField: '_id',
                    as: 'question'
                }
            }, {
                $unwind: "$question"
            }, {
                $match: {
                    "question.type": 4, // polling type 4,
                    $or: [{
                        "module.randomOrder": true,
                        "question.required": true
                    }, {
                        "module.randomOrder": false
                    }]
                }
            },
            // {
            //     $group: {
            //         "_id": "$_id",
            //         "title": {
            //             $first: "$title"
            //         },
            //         "description": {
            //             $first: "$description"
            //         },
            //         "wallId": {
            //             $first: "$wallId"
            //         },
            //         "category": {
            //             $first: "$category"
            //         },
            //         "question": {
            //             $push: "$question"
            //         },
            //         "module": {
            //             $first: "$module"
            //         },
            //         "createdAt": {
            //             $first: "$createdAt"
            //         },
            //         "lastUpdated": {
            //             $first: "$lastUpdated"
            //         }
            //     }
            // },
            {
                $sort: {                    
                    "question.createdAt": 1
                }
            }, {
                $limit: 10
            }
            ]);
            // return postList;
            // Add Polling Result in it
            let index = 0;
            for (const iterator of postList) {
                postList[index].wallId = {
                    _id: postList[index].wallId._id,
                    wallName: postList[index].wallId.wallName
                }

                // Category
                postList[index].category = {
                    _id: postList[index].category._id,
                    categoryName: postList[index].category.categoryName
                }

                // Polling
                req.body = req.body || {};
                req.body.questionId = postList[index]['question']['_id'];
                req.body.moduleId = postList[index]['module']['_id'];
                req.body.wallPostId = postList[index]._id;
                req.body.internalApi = true;
                postList[index].isAnswered = false;

                // Check if user already answered then show results              
                let userAnswered = await QuestionResponse.findOne({
                    questionId: postList[index]['question']['_id'],
                    wallPostId: postList[index]._id,
                    userId: req.user._id,
                    status: 1
                }).lean();
                if (userAnswered) {
                    postList[index].resultData = await QuestionModule.getPollingResult(req, res);
                    postList[index].isAnswered = true;
                }
                index++;
            }
            
            /*for (let int in postList) {

                // Wall
                if('wallId' in postList[int]){
                    postList[int].wallId = {
                        _id: postList[int].wallId._id,
                        wallName: postList[int].wallId.wallName
                    }
    
                    // Category
                    postList[int].category = {
                        _id: postList[int].category._id,
                        categoryName: postList[int].category.categoryName
                    }
    
                    // Polling
                    req.body = req.body || {};
                    req.body.questionId = postList[int]['question']['_id'];
                    req.body.moduleId = postList[int]['module']['_id'];
                    req.body.wallPostId = postList[int]._id;
                    req.body.internalApi = true;
                    postList[int].isAnswered = false;
    
                    // Check if user already answered then show results              
                    let userAnswered = await QuestionResponse.findOne({
                        questionId: postList[int]['question']['_id'],
                        wallPostId: postList[int]._id,
                        userId: req.user._id,
                        status: 1
                    }).lean();
                    if (userAnswered) {
                        postList[int].resultData = await QuestionModule.getPollingResult(req, res);
                        postList[int].isAnswered = true;
                    }
                } else {
                    console.log(postList[int], int);
                }
            }*/

            return postList;

        } catch (err) {
            __.log(err);
            __.out(res, 300, 'Something went wrong try later');

        }
    }


    // Get users bu list for parent & plan
    async getUserBUs(userData) {

        let businessUnits = await SubSection.find({
            $or: [{
                _id: userData.parentBussinessUnitId
            }, {
                _id: {
                    $in: userData.planBussinessUnitId
                }
            }],
            status: 1
        }).populate({
            path: 'sectionId',
            select: 'name status',
            match: {
                status: 1
            },
            populate: {
                path: 'departmentId',
                select: 'name status',
                match: {
                    status: 1
                },
                populate: {
                    path: 'companyId',
                    select: 'name status',
                    match: {
                        status: 1
                    }
                }
            }
        }).select('name sectionId').lean();
        businessUnits = await businessUnits.filter(v => {
            return v.sectionId != null && v.sectionId.departmentId != null && v.sectionId.departmentId.companyId != null
        }).map(v => {
            let x = {
                _id: v._id,
                name: `${v.sectionId.departmentId.companyId.name} > ${v.sectionId.departmentId.name} > ${v.sectionId.name} > ${v.name}`
            }
            return x;
        });
        return businessUnits;
    }

    // Getting userlist for a particular bu
    async getBuUsers(req, res) {
        try {
            if(!__.checkHtmlContent(req.body)){
                return __.out(res, 300, `You've entered malicious input`);
            }
            let userList = await User.find({
                parentBussinessUnitId: req.body.businessUnitId,
                status: 1
            }).select('name staffId profilePicture').lean();

            return __.out(res, 201, userList);

        } catch (err) {

            __.log(err);
            __.out(res, 500);

        }

    }
    async getBoardUsers(req, res) {
        try {
            if(!__.checkHtmlContent(req.params)){
                return __.out(res, 300, `You've entered malicious input`);
            }
            const wallId = req.params.wallId;
            let wall = await WallModel.findById(wallId).select('assignUsers').lean();
            return await __.wallUsersList(wall, false);
        } catch (error) {
            __.log(error);
            return __.out(res, 300, 'Something went wrong try later');
        }
    }

}

myBoard = new myBoard();
module.exports = myBoard;