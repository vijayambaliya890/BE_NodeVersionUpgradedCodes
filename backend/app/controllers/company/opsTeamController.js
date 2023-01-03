const mongoose = require('mongoose')
const moment = require("moment")
const OpsTeam = require('../../models/opsTeam')
const OpsGroup = require('../../models/ops')
const _ = require('lodash')
const __ = require('../../../helpers/globalFunctions');

// API to create OPS TEAM
module.exports.create = async (req, res) => {
     console.log('body: ',req.body);
    try {
        let requiredResult = await __.checkRequiredFields(req, ['userId', 'buId', 'opsId', 'teamName']);
        if (requiredResult.status === false) {
            __.out(res, 400, requiredResult.missingFields);
        }
        else {
            const insertObj = {
                userId: req.body.userId,
                buId: req.body.buId,
                opsId: req.body.opsId,
                teamName: req.body.teamName,
                createdBy: req.body.createdBy
            }
            let doc = await OpsTeam(insertObj).save()
            if (doc) {
              let updateOpsGroup = await OpsGroup.findByIdAndUpdate(req.body.opsId,
                    {$push: {"opsTeam": doc._id}});
                    // console.log('updateOpsGroup',updateOpsGroup);
                return res.status(201).json({
                    success: true,
                    message: 'New opsTeam created successfully',
                    Team: doc
                });
            } else {
                return res.status(201).json({
                    success: false,
                    message: 'New opsTeam not created successfully',
                    Team: doc
                });
            }
        }
    }
    catch (err) {
        __.log(err);
        __.out(res, 500);
    }
}

// API to fetch OPS TEAM DATA
module.exports.read = async (req, res) => {
    try {
        let data = await OpsTeam.aggregate([
            {
                $match: {
                    _id: mongoose.Types.ObjectId(req.body._id)
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userInfo',
                }
            },
            {
                $lookup: {
                    from: 'appointments',
                    localField: 'userInfo.appointmentId',
                    foreignField: '_id',
                    as: 'appointmentInfo',
                }
            },
        ])
        let newData = JSON.stringify(data);
        newData = JSON.parse(newData);
        for (let i = 0; i < newData.length; i++) {
            const item = newData[i];
            item.userInfo.map((user, userIndex) => {
                const appointmentInfo = item.appointmentInfo.filter((appointmentObj, appointmentIndex) => {
                    return appointmentObj._id.toString() === user.appointmentId.toString();
                });
                if (appointmentInfo.length > 0) {
                    newData[i].userInfo[userIndex].appointmentName = appointmentInfo[0].name;
                }

            });
        }
        return __.out(res, 201, {
            opsTeamList: newData != null ? newData : []
        });
    }
    catch (err) {
        __.log(err);
        __.out(res, 500);
    }
}

// API to update OPS TEAM
module.exports.update = async (req, res) => {
    try {
        await req.body.map(async re=>{
           console.log("REQ: ",re);
            const insertObj = {
                userId: re.userId,
                buId: re.buId,
                opsId: re.opsId,
                teamName: re.teamName,
                createdBy: re.createdBy
            }
            let updateObj;
            if(re._id){
                updateObj = await OpsTeam.findOneAndUpdate({ _id: re._id }, insertObj,
                { new: true })
            }else{
                updateObj = new OpsTeam(insertObj);
                updateObj.save();
                if (updateObj) {
                    let updateOpsGroup = await OpsGroup.findByIdAndUpdate(re.opsId,
                          {$push: {"opsTeam": updateObj._id,"userId":{$each:updateObj.userId}}});
            }
         }
        });
        res.send("updated succesfully");
    }
    catch (err) {
        __.log(err);
        __.out(res, 500);
    }
};

// API to delete created Team
module.exports.delete = async (req, res) => {
    try {
        var where = {
            _id: req.body._id
        }
        var remove = await OpsTeam.findOneAndRemove(where)
        if (remove) {
            return res.status(201).json({
                success: true,
                message: 'Team deleted Successfully',
                OpsTeam: remove
            });
        } else {
            return res.status(201).json({
                success: false,
                message: 'Failed',
                OpsTeam: remove
            });
        }
    }
    catch (err) {
        __.log(err);
        __.out(res, 500);
    }
};
