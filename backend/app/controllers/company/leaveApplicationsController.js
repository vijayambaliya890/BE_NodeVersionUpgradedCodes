const mongoose = require("mongoose")
const StaffSapData = require('../../models/staffSAPData');
const Ballot = require('../../models/ballot');
const opsLeaves = require('../../models/opsLeaves');
const OpsGroup = require('../../models/ops');
const userHoliday = require('../../models/userHoliday');
const swopRequests = require('../../models/swapRequests');
const leaveApplications = require('../../models/leaveApplication');
const OpsTeam = require('../../models/opsTeam');
const User = require('../../models/user');
const PageSettingModel = require('../../models/pageSetting');
const async = require('async');
var __ = require('../../../helpers/globalFunctions');

class LeaveClass{
    
    async testRoute(req,res){
        console.log("I am at test leave application rouete");
    }

    async applyForLeave(req,res){
        let request = req.body;
        try {
            let user = await User.findOne({_id:req.user._id},{name:1});
            if(request.ballotId){
                let requiredResult = await __.checkRequiredFields(req, ['ballotId','slotNo']);
                if(requiredResult.status == false){
                    return res.status(300).json({
                        success: false,
                        data:null,
                        message:"Missing Fields Error!"
                        });
                }

                //check if already applied for this leave.
                const applications = await leaveApplications.find({userId:req.user._id,ballotId:request.ballotId,slotNo:request.slotNo});
                if(applications.length>0){
                    return res.status(300).json({
                        success: false,
                        data: null,
                        message:"You have already applied for this slot of the ballot!"
                    });
                }

                var obj = {
                    userId:user._id,
                    ballotId:request.ballotId,
                    slotNo:request.slotNo,
                    fromdate:request.fromdate,
                    todate:request.todate,
                    noOfdays:request.noOfdays
                }
                var leaveApply = new leaveApplications(obj);
                var application = await leaveApply.save();
                return res.status(201).json({
                    success: true,
                    data: application,
                    message:"Leave Applictaion saved Successfully!!"
                });
            }
            else {
                console.log("in elseme: ");
                let requiredResult = await __.checkRequiredFields(req, ['leaveId']);
                console.log("requiredResult: ",requiredResult);
                if(requiredResult.status == false){
                    return res.status(300).json({
                        success: false,
                        data:null,
                        message:"Missing Fields Error!"
                        });
                }
                //check if already applied for this leave.
                const applications = await leaveApplications.find({userId:req.user._id,leaveId:request.leaveId});
                if(applications.length>0){
                    return res.status(300).json({
                        success: false,
                        data: null,
                        message:"You have already applied for this leave!"
                    });
                }
                var obj = {
                    userId:user._id,
                    leaveId:request.leaveId,
                    fromdate:request.fromdate,
                    todate:request.todate,
                    noOfdays:request.noOfdays
                }
                var leaveApply = new leaveApplications(obj);
                console.log("leaveApply :",leaveApply);
                var application = await leaveApply.save();
                console.log("application :",application);

                return res.status(201).json({
                    success: true,
                    data: application,
                    message:"Leave Applictaion saved Successfully!!"
                });
            }
        } catch(e){
            return res.status(300).json({
                success: false,
                data: null,
                message:"Something went wrong!."
            });
        }
    }

    async getMyUserLeaves(req,res){
        try {
            const opsGroups = await OpsGroup.find({createdBy:req.user._id,isDelete:false},{_id:1,opsTeamId:1,opsGroupName:1,userId:1})
                
            let allUsers = [];
            for(let i=0;i<=opsGroups.length-1;i++){
                allUsers = allUsers.concat(opsGroups[i].userId);
            }
            //get users Applictaion List
            const applications = await leaveApplications.find({userId:{$in:allUsers}}).populate([{
                path:'ballotId',
                select:["ballotName", "weekRange"]
            },
            {
                path:'userId',
                select:["_id", "name", "staffId"]
            },
            {
                path:'leaveId',
                select:["fromdate", "todate","type"]
            }
            ]);

            let myApplications=[];
            for(let ap=0;ap<=applications.length-1;ap++){
                if(applications[ap].ballotId){
                    var app={};
                    app.username = applications[ap].userId.name;
                    app.staffId = applications[ap].userId.staffId;
                    app.status = applications[ap].applicationStatus;
                    app.leaveType = 'Won By Ballot';
                    myApplications.push(app);
                }
                if(applications[ap].leaveId){
                    var app={};
                    app.username = applications[ap].userId.name;
                    app.staffId = applications[ap].userId.staffId;
                    app.status = applications[ap].applicationStatus;
                    if(applications[ap].leaveId.type == 3){
                        app.leaveType = 'Block-Allocated';
                    }
                    if(applications[ap].leaveId.type == 2){
                        app.leaveType = 'Casual-Allocated';
                    }
                    if(applications[ap].leaveId.type == 4){
                        app.leaveType = 'Special leave';
                    }
                    myApplications.push(app);
                }
            }
            res.status(201).json({status: true, data: myApplications, message: "Successfull!!"});
        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }

    async getLeaveDetailToApply(req,res){
    let resObj ={};
        try{
            if(req.body.ballotId){
                console.log("in ballot If");
                const ballot=await Ballot.findOne({_id:req.body.ballotId},{ballotName:1,weekRange:1});
                resObj.fromdate = ballot.weekRange[req.body.slotNo].start;
                resObj.todate = ballot.weekRange[req.body.slotNo].end;
                resObj.leaveType = 'Balloted';
                resObj.noOfDays = 5;
                resObj.ballotId = ballot._id;
                console.log("in ballot If: ",resObj);
            }
            if(req.body.leaveId){
                const leave =await userHoliday.findOne({_id:req.body.leaveId},{fromdate:1,todate:1,type:1});
                var frmDate = leave.fromdate.split("-");
                var toDate = leave.todate.split("-");
                resObj.fromdate = frmDate[2]+"-"+frmDate[1]+"-"+frmDate[0];
                resObj.todate =toDate[2]+"-"+toDate[1]+"-"+toDate[0];
                if(leave.type==2){
                    resObj.leaveType = 'Casual Leave';
                }
                if(leave.type==3){
                    resObj.leaveType = 'Block Leave';
                }
                resObj.leaveId = leave._id;
                var dateLeaveToPartsss = leave.fromdate.split("-");
                var dateLeaveToParteee = leave.todate.split("-");
                let startLeaveTodd = new Date(+dateLeaveToPartsss[2], dateLeaveToPartsss[1] - 1, +dateLeaveToPartsss[0]+1); 
                let endLeaveTodd = new Date(+dateLeaveToParteee[2], dateLeaveToParteee[1] - 1, +dateLeaveToParteee[0]+1);            
                var LeaveTodays = Math.floor((endLeaveTodd - startLeaveTodd) / (1000*60*60*24));
                resObj.noOfDays = LeaveTodays+1;
            }
            return res.status(201).json({
                success: true,
                data:resObj ,
                message:"data received!."
            });
        } catch(e) {
            return res.status(300).json({
                success: false,
                data: null,
                message:"Couldn't find leave details."
            });
        }
    }
}

leaveApplication = new LeaveClass();
module.exports = leaveApplication;