const mongoose = require('mongoose'),
      LeaveType = require("../../models/leaveType"),
      LeaveTypeLog = require('../../models/leaveTypeLog');
const __ = require('../../../helpers/globalFunctions');
const _ = require('lodash')
var diff = require('deep-diff').diff;

class leaveTypeController{

    async create(req, res) {
       try{
        // let requiredResult = await __.checkRequiredFields(req, ['name', 'isQuotaExceed']);
        // if (requiredResult.status === false) {
        //     return res.status(400).json({message:'Fields missing '+requiredResult.missingFields.toString(), success:false});
        // }
           var failed = [];
           var success = []; 
           let objArr = req.body;
           for(let i=0; i<objArr.length;i++){
            var obj = objArr[i];
            obj.createdBy = req.user._id;
            obj.updatedBy = req.user._id;
            obj.companyId = req.user.companyId;
            let found =await LeaveType.find({name: { "$regex" : obj.name , "$options" : "i"},companyId:req.user.companyId, isActive:true});
            if(found && found.length>0){
                found = JSON.parse(JSON.stringify(found));
                found[0].reason = 'Duplicate leave type name';
                failed.push(found[0]);
                continue;
                //return res.status(200).json({message:'Duplicate leave type name', success:false});
            }
            let insertLeaveType = await new LeaveType(obj).save();
            if(insertLeaveType){
                insertLeaveType = JSON.parse(JSON.stringify(insertLeaveType));
                insertLeaveType.reason = 'Leave Type Created';
                success.push(insertLeaveType);
             //this.insertLog(insertLeaveType,null, 'Leave Type Created');
             //return res.status(200).json({message:'leave type successfully created', success:true});
            }else{
              obj.reason = 'leave type not created';
              failed.push(obj);
             //return res.status(200).json({message:'leave type not created', success:false});
            }
           }
           //this.insertLog(success,failed, 'Created');
           if(failed.length == 0){
            return res.status(200).json({message:'leave type successfully created', success:true});
           }else{
            return res.status(200).json({message:'some leave type not created', success:false,failed});
           }
        } catch (err) {
            __.log(err)
          return res.status(500).json({message:'something went wrong', success:false});
        }
    }
    async update(req, res) {
        try{
        //  let requiredResult = await __.checkRequiredFields(req, ['name', 'isQuotaExceed',"leaveTypeId"]);
        //  if (requiredResult.status === false) {
        //      return res.status(400).json({message:'Fields missing '+requiredResult.missingFields.toString(), success:false});
        //  } 
        var failed = [];
        var success = []; 
        let body = req.body;
        let objArr = [];
        objArr.push(body)
        for(let i=0; i<objArr.length;i++){  
            let obj = objArr[i];
            if(!obj.isRemoved){
            var isPresent = await LeaveType.findOne({_id:obj.leaveTypeId,isActive:true});
                if(isPresent) {
                        obj.updatedBy = req.user._id;
                        obj.companyId = req.user.companyId;
                        let found =await LeaveType.find({_id:{$ne:obj.leaveTypeId},name: { "$regex" : obj.name , "$options" : "i"},companyId:req.user.companyId,isActive:true});
                        if(found && found.length>0){
                            found = JSON.parse(JSON.stringify(found));
                            found[0].reason = 'Duplicate leave type name';
                            failed.push(found[0]);
                            continue;
                            //return res.status(200).json({message:'Duplicate leave type name', success:false});
                        }
                        let insertLeaveType = await LeaveType.findOneAndUpdate({_id:obj.leaveTypeId},{
                            $set:{
                                name:obj.name,
                                updatedBy: obj.updatedBy,
                                isQuotaExceed: obj.isQuotaExceed
                            }
                        },{new:true});
                        if(insertLeaveType){
                            insertLeaveType = JSON.parse(JSON.stringify(insertLeaveType));
                            insertLeaveType.reason = 'Leave Type Created';
                            success.push(insertLeaveType);
                            // this.insertLog(insertLeaveType,isPresent, 'Leave Type Updated')
                            //  return res.status(200).json({message:'leave type successfully updated', success:true, insertLeaveType,isPresent});
                        }else{
                            obj.reason = 'leave type not created';
                            failed.push(obj);
                        }
                } else {
                    // not create one
                    obj.createdBy = req.user._id;
                    obj.updatedBy = req.user._id;
                    obj.companyId = req.user.companyId;
                    let insertLeaveType = await new LeaveType(obj).save();
                //return res.status(200).json({message:'leave type not found', success:false}); 
                }
            } else {
                obj.updatedBy = req.user._id;
                const insertLeaveType = await LeaveType.findOneAndUpdate({_id:obj.leaveTypeId},{
                    $set:{
                        isActive: false,
                        updatedBy: obj.updatedBy
                    }
                });
            }
        }
        if(failed.length == 0){
            return res.status(200).json({message:'leave type successfully update', success:true});
        }else{
            return res.status(200).json({message:'some leave type not updated', success:false,failed});
        }
        } catch (err) {
            __.log(err)
            return res.status(500).json({message:'something went wrong', success:false});
        }
    }
    async delete(req, res) {
        try{
            let requiredResult = await __.checkRequiredFields(req, ["leaveTypeId"]);
            if (requiredResult.status === false) {
                return res.status(400).json({message:'Fields missing '+requiredResult.missingFields.toString(), success:false});
            }   
            let obj = req.body;
            var isPresent = await LeaveType.findOne({_id:obj.leaveTypeId});
            if(isPresent){
                obj.updatedBy = req.user._id;
                const insertLeaveType = await LeaveType.findOneAndUpdate({_id:obj.leaveTypeId},{
                    $set:{
                        isActive: false,
                        updatedBy: obj.updatedBy
                    }
                });
                if(insertLeaveType){
                    this.insertLog(res, insertLeaveType,null, 'Leave Type Deleted');
                    return res.status(200).json({message:'leave type successfully deleted', success:true});
                }else{
                    return res.status(200).json({message:'leave type not deleted', success:false});
                }
            }else{
                return res.status(200).json({message:'leave type not found', success:false}); 
            }
        } catch (err) {
             __.log(err)
           return res.status(500).json({message:'something went wrong', success:false});
         }
    }
    async get(req, res) {
        try{
            var compnayId = req.user.companyId;
            const insertLeaveType = await LeaveType.find({companyId:compnayId, isActive:true}).populate([{
                path:'createdBy',
                select:'name staffId'
            },{
                path:'updatedBy',
                select:'name staffId'
            }]).sort({createdAt:1});
            if(insertLeaveType){
                return res.status(200).json({message:'leave type is present', success:true,data:insertLeaveType});
            }else{
                return res.status(200).json({message:'leave type not present', success:false});
            }
         } catch (err) {
             __.log(err)
           return res.status(500).json({message:'something went wrong', success:false});
         }
    }
    async insertLog(res, newData,oldData=null,reason) {
        try {
            var  obj = {
                companyId: newData.companyId,
                leaveTypeId: newData._id,
                change:{
                    newData,
                    oldData
                },
                updatedBy: newData.updatedBy,
                reason
            }
            new LeaveTypeLog(obj).save();
        } catch (err) {
            __.log(err);
            __.out(res, 500, err);
        };
    }
}

leaveTypeController = new leaveTypeController();
module.exports = leaveTypeController;