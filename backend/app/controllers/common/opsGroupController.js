const mongoose = require('mongoose')
const moment = require("moment")
const OpsGroup = require('../../models/ops')
const LeavePlanner = require('../../models/leavePlanner')
const OpsTeam = require('../../models/opsTeam')
const User = require('../../models/user')
const userFieldController = require('../company/userFieldController')
const SubSection = require('../../models/subSection')
const Appointment = require('../../models/appointment')
const leaveController = require('../../controllers/company/leavePlannerController')
const _ = require('lodash')
const __ = require('../../../helpers/globalFunctions');

// API to create OpsGroup

module.exports.create = async (req, res) => {
    //  console.log('heheh')
    try {
        let requiredResult = await __.checkRequiredFields(req, ['userId', 'buId', 'teamName', 'createdBy']);
        if (requiredResult.status === false) {
            __.out(res, 400, requiredResult.missingFields);
        }
        else {
            // console.log(req.body);
            const insertObj = {
                userId: req.body.userId,
                buId: req.body.buId,
                teamName: req.body.teamName,
                createdBy: req.body.createdBy
            }
            let ops = await new OpsGroup(insertObj).save()
            // console.log(ops)
            if (ops) {
                return res.status(201).json({
                    success: true,
                    message: 'New oops created successfully',
                    OpsGroup: ops
                });
            } else {
                return res.status(201).json({
                    success: false,
                    message: 'New oops not created successfully',
                    OpsGroup: ops
                });
            }
        }
    }
    catch (err) {
        console.log(err)
        __.log(err);
        __.out(res, 500);
    }
}

// API to fetch data of OPS GROUP
module.exports.read = async (req, res) => {
    try {
       var buID=mongoose.Types.ObjectId(req.body.buId);
        let data= await OpsGroup.find({buId:buID}).populate(
            [
            {
                path:"userId",
                select:["name","email","doj"],
                populate:{
                    path:"appointmentId",
                    select:["name","status"]
                }
            },{
                path:"opsTeam"
            }
            ]);
        // let data = await OpsGroup.aggregate([
        //     {
        //         $match: {
        //             buId: mongoose.Types.ObjectId(req.body.buId)
        //             // _id: mongoose.Types.ObjectId(req.body._id)

        //         }
        //     },
        //     {

        //         $lookup: {
        //             from: 'users',
        //             localField: 'userId',
        //             foreignField: '_id',
        //             as: 'userInfo',
        //         }

        //     },
        //     // { $unwind: '$userInfo' },
        //     {
        //         $lookup: {
        //             from: 'appointments',
        //             localField: 'userInfo.appointmentId',
        //             foreignField: '_id',
        //             as: 'appointmentInfo',
        //         }

        //     },

        //     {
        //         $lookup: {
        //             from: 'opsteams',
        //             localField: '_id',
        //             foreignField: 'opsId',
        //             as: 'team',
        //         }
        //     },
        //     {
        //         $sort:{
        //             _id : -1
        //         }
        //     }
    
        // ])
        //newDate 1000 = data; //1000
        
        let newData = JSON.stringify(data);
        newData = JSON.parse(newData);
        // for (let i = 0; i < newData.length; i++) {
        //     const item = newData[i];
        //     item.userInfo.map((user, userIndex) => { 
        //         const appointmentInfo = item.appointmentInfo.filter((appointmentObj, appointmentIndex) => {
        //             return appointmentObj._id.toString() === user.appointmentId.toString();
        //         });
        //         if (appointmentInfo.length > 0) {
        //             newData[i].userInfo[userIndex].appointmentName = appointmentInfo[0].name;
        //         }
        //         item.team.forEach((teamObj) => {
        //             console.log("TEAM OBJECT:", teamObj);
        //             if (teamObj.userId.includes(user._id)) {
        //                 newData[i].userInfo[userIndex].teamName = teamObj.teamName;
        //             }
        //         });

        //     });

        // }

        return __.out(res, 201, {
            opsGroupList: newData != null ? newData : [],

        });
    }
    catch (err) {
        console.log(err)
        __.log(err);
        __.out(res, 500);
    }
}


// API for mobile App to give leave of particular user
module.exports.getDetails = async (req, res) => {
    try {
        // console.log('req.body.userId',req.body.userId)
        let data = await OpsGroup.aggregate([
            {
                $match: {
                    userId: mongoose.Types.ObjectId(req.body.userId)
                }
            },
            {
                $lookup: {
                    from: 'leaveplanners',
                    localField: '_id',
                    foreignField: 'opsGroup',
                    as: 'leave'
                }
            },
            { $unwind: '$leave' }
        ]);
        return __.out(res, 201, {
            oopsList: data != null ? data : []
        });
    }
    catch (err) {
        console.log(err)
        __.log(err);
        __.out(res, 500);
    }
}


// API to update OPS TEAM
module.exports.update = async (req, res) => {
    try {
        console.log("REQ OPS: ",req.body);
        const insertObj = {
            buId: req.body.buId,
            teamName: req.body.teamName,
            createdBy: req.body.createdBy
        }
        var update = await OpsGroup.findOneAndUpdate({ _id: req.body._id }, insertObj,
            { new: true })
        // console.log("OpsGRpBOdy:" ,req.body)
        // console.log("OpsGRp:" ,update)
        if (update) {
            return res.status(201).json({
                success: true,
                message: 'Group updated Successfully',
                OpsGroup: update
            });
        } else {
            return res.status(201).json({
                success: false,
                message: 'Updation Failed',
                OpsGroup: update
            });
        }
    }
    catch (err) {
        console.log(err)
        __.log(err);
        __.out(res, 500);
    }
}

// API to delete created Group
module.exports.remove = async (req, res) => {
    try {
        var where = {
            _id: req.body._id
        }
        var data = await OpsGroup.findOneAndRemove(where)
        if (data) {
            return res.status(201).json({
                success: true,
                message: 'Group deleted Successfully',
                OpsGroup: data
            });
        } else {
            return res.status(201).json({
                success: false,
                message: 'Failed',
                OpsGroup: data
            });
        }
    }
    catch (err) {
        console.log(err)
        __.log(err);
        __.out(res, 500);
    }
}

//API to fetch buNmae of specific ops group
module.exports.buName = async (req, res) => {
    try {
        var buName = await OpsGroup.find({ _id: req.body._id })
            .populate(
                [{
                    path: "buId",
                    select: "name",
                    populate: {
                        path: "sectionId",
                        select: "name",
                        populate: {
                            path: "departmentId",
                            select: "name",
                            populate: {
                                path: "companyId",
                                select: "name"
                            }
                        }
                    }
                },
                ])
        return __.out(res, 201, {
            buList: buName != null ? buName : []
        });
    }
    catch (err) {
        console.log(err)
        __.log(err);
        __.out(res, 500);
    }
}

//API to fetch users from bu
module.exports.getUsersByBuId = async (req, res) => {
    try {
        let buIds = req.body.businessUnitId;
        var buIdData = [];
        var promises = buIds.map(async buId => {
            let where = {
                companyId: req.user.companyId,
                status: 1
            };
            where.parentBussinessUnitId = mongoose.Types.ObjectId(buId);
            var users = await User.find(where).populate({
                path: "companyId",
                select: "name"
            })
                .populate(
                    [{
                        path: "appointmentId",
                        select: "name"
                    },
                    {
                        path: "parentBussinessUnitId",
                        select: "name",
                        populate: {
                            path: "sectionId",
                            select: "name",
                            populate: {
                                path: "departmentId",
                                select: "name",
                            }
                        }
                    }
                    ])

            buIdData.push(users);
        })
        //return __out((res,201,buIdData));
        Promise.all(promises).then(function () {
            __.out(res, 201, buIdData);
        })
    } catch (err) {
        __.log(err);
        __.out(res, 500, err);
    }

}

//API to fetch users from BU(not in any ops group)
module.exports.addUserFromBu = async (req, res) => {
    try {
        // console.log('req.body.businessUnitId',req.body.businessUnitId);
        OpsGroup.find({ buId: { $in: req.body.businessUnitId } }, { _id: 0, userId: 1 }).then((result) => {
            let userID = [];
            result.forEach((item) => {
                item.userId.forEach((u) => {
                    userID.push(u);
                });
            });

            User.find({ parentBussinessUnitId: { $in: req.body.businessUnitId }, _id: { $nin: userID }, status: 1 })
                .populate({
                    path: "appointmentId",
                    select: "name"
                })
                .populate(
                    [{
                        path: "parentBussinessUnitId",
                        select: "name",
                        populate: {
                            path: "sectionId",
                            select: "name",
                            populate: {
                                path: "departmentId",
                                select: "name",
                                populate: {
                                    path: "companyId",
                                    select: "name"
                                }
                            }
                        },
                    },
                    ]).then((usersList) => {
                        res.json(usersList)
                    });
        })
    } catch (err) {
        console.log("ERR: ", err);
        __.log(err);
        __.out(res, 500, err);
    }
}

//API to fetch users from ops group of selected BU
module.exports.transferFromOpsGroup = async (req, res) => {
    try {
        // console.log("req:",req.body.businessUnitId)
        OpsGroup.find({ buId: { $in: req.body.businessUnitId } }, { _id: 0, userId: 1 }).then((result) => {
            let userID = [];
        // console.log("buId:",buId)
            result.forEach((item) => {
                item.userId.forEach((u) => {
                    if (!userID.includes(u))
                        userID.push(u);
                });
            });
            // console.log('userId', userID.length);
            User.find({ parentBussinessUnitId: { $in: req.body.businessUnitId }, _id: { $in: userID }, status: 1 })
                .then(async (usersList) => {
                    await OpsGroup.find({ userId: { $in: usersList } }).then(async (counter) => {
                        let notIn = [];
                        counter.map((item) => {
                            // console.log("req:",req.body.opsGroupId)
                            //   console.log("IIN COUNTER: ",item._id ,"AND: ", req.body.opsGroupId);
                            if (item._id == req.body.opsGroupId) {
                                //do nothing
                                // console.log("IN IF");
                            } else {
                                item.userId.forEach((u) => {
                                    if (!notIn.includes(u))
                                        notIn.push(u);
                                });
                            }
                        })

                        await User.find({ parentBussinessUnitId: { $in: req.body.businessUnitId }, _id: { $in: notIn }, status: 1 })
                            .populate({
                                path: "appointmentId",
                                select: "name"
                            })
                            .populate(
                                [{
                                    path: "parentBussinessUnitId",
                                    select: "name",
                                    populate: {
                                        path: "sectionId",
                                        select: "name",
                                        populate: {
                                            path: "departmentId",
                                            select: "name",
                                            populate: {
                                                path: "companyId",
                                                select: "name"
                                            }
                                        }
                                    },
                                },
                                ]).then(usersFromOtherOps => {
                                    // res.json(usersFromOtherOps);
                                    // console.log("USERSFOUND: ",usersFromOtherOps)ss
                                    __.out(res, 201, usersFromOtherOps);
                                })
                    })
                    //  res.json(usersList)
                });
        })
    }
    catch (err) {
        console.log("ERR:", err);
        __.log(err);
        __.out(res, 500, err);
    }
}

//Api for mobile, display no of users in ops grp with details
module.exports.getOpsUsers = async (req, res) => {
    try {
        let where = {
            buId: req.body.buId,
            _id: req.body._id
        }
        let data = await OpsGroup.find(where).lean()
            .populate({
                path: "userId",
                populate: {
                    path: "appointmentId",
                    select: "name"
                }
            })

        return __.out(res, 201, {
            opsGroupUsers: data != null ? data : [],

        });
    }
    catch (err) {
        console.log(err);
        __.log(err);
        __.out(res, 500, err);
    }
}

//Api for mobile, display no of grp in bu 
module.exports.getOpsList = async (req, res) => {
    try {
        let where = {
            buId: req.body.buId,
        }
        let data = await OpsGroup.find(where).lean()
        return __.out(res, 201, {
            opsGroupList: data != null ? data : [],
        });
    }
    catch (err) {
        console.log(err);
        __.log(err);
        __.out(res, 500, err);
    }
}


module.exports.transferDelete = async (req, res) => {
    try {
        console.log("reaqere:",req.body)
        if (req.body.userId && req.body.userId.length > 0) {
             let Users = req.body.userId;
           console.log(req.body.userId)
            //for(var i = 0; i < Users.length; i++) {
             var done= Users.forEach(async use=>{
                console.log("Iteration: ",use);
           await OpsGroup.find({userId:use},function(err,ops){
                    if(ops){
                        ops.map(async opmap=>{
                            //console.log("OPS :",ops);
                           await opmap.userId.remove(use);
                            await opmap.save((err,data)=>{
                                if(!err){
                                    console.log("SUCCESSFULLY DELETED");
                                }else{
                                    console.log("Couldn't delete",err);
                                }
                            });
                       });
                    }else{
                        console.log("NO OPS",err);
                    }
                })

             await OpsTeam.find({userId:use},function(err,tmp){
                    if(tmp){
                        tmp.map(async tmap=>{
                           // console.log("tmp:",tmp)
                           await tmap.userId.remove(use);
                           // console.log("tmap:",tmap)
                           await tmap.save((err,data)=>{
                                if(!err){
                                    console.log("Deleted")
                                }else{
                                    console.log("failed")
                                }
                            })
                        })
                    }else{
                        console.log("NO OPS",err);
                    }
                })
               // res.send("OK");
                console.log("FISRT DONE ITR");
            })
           Promise.all(done).then(()=>{
               res.send("OK");
           })
      // res.send("ok")
    }
}
    catch (err) {
        console.log(err);
        __.log(err);
        __.out(res, 500, err)
    }
}
