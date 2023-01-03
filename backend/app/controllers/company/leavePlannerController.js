const mongoose = require('mongoose')
const moment = require("moment")
const LeavePlanner = require('../../models/leavePlanner')
const User = require('../../models/user')
const userFieldController = require('../company/userFieldController')
const OpsGroup = require('../../models/ops')
const OpsController = require('../common/opsGroupController')
const _ = require('lodash')
const __ = require('../../../helpers/globalFunctions');

// API to create Leave Ballot

module.exports.create = async (req, res) => {
    // console.log('heheh')
    try {
        let requiredResult = await __.checkRequiredFields(req, ['buId', 'opsGroup']);
        if (requiredResult.status === false) {
            __.out(res, 400, requiredResult.missingFields);
        }
        else {
            console.log(req.body);
            const insertObj = {
                buId: req.body.buId,
                opsGroup: req.body.opsGroup,
                ballotName: req.body.ballotName,
                ballotStartDate: req.body.ballotStartDate,
                ballotEndDate: req.body.ballotEndDate,
                openDate:req.body.openDate,
                openTime:req.body.openTime,
                closeDate:req.body.closeDate,
                closeTime:req.body.closeTime,
                timeZone:req.body.timeZone,
                ballotAppStartDate: "",
                ballotAppEndDate: "",
                slotAvlPerDay: req.body.slotAvlPerDay,
                maxLeaveDays: req.body.maxLeaveDays,
                ballotType: req.body.ballotType,
            }
            insertObj.ballotAppStartDate = `${insertObj.openDate} ${insertObj.openTime}:00 ${insertObj.timeZone}`
            insertObj.ballotAppEndDate = `${insertObj.closeDate} ${insertObj.closeTime}:00 ${insertObj.timeZone}`
            insertObj.ballotAppStartDate = moment(insertObj.ballotAppStartDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
            insertObj.ballotAppEndDate = moment(insertObj.ballotAppEndDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
            console.log('herr, insert', insertObj);
            let planner = await new LeavePlanner(insertObj).save()
            // console.log(ops)
            if (planner) {
                return res.status(201).json({
                    success: true,
                    message: 'Ballot Created Successfully',
                    LeavePlanner: planner
                });
            } else {
                return res.status(201).json({
                    success: false,
                    message: 'Ballot Failed',
                    LeavePlanner: planner
                });
            }
        }
        // }
    }
    catch (err) {
        console.log(err)
        __.log(err);
        __.out(res, 500);
    }
}

/* date time together
module.exports.create = async (req, res) => {
    // console.log('heheh')
    try {
        let requiredResult = await __.checkRequiredFields(req, ['buId', 'opsGroup']);
        if (requiredResult.status === false) {
            __.out(res, 400, requiredResult.missingFields);
        }
        else {
            console.log(req.body);
            const insertObj = {
                buId: req.body.buId,
                opsGroup: req.body.opsGroup,
                ballotName: req.body.ballotName,
                ballotStartDate: req.body.ballotStartDate,
                ballotEndDate: req.body.ballotEndDate,
                ballotAppStartDate: req.body.ballotAppStartDate,
                ballotAppEndDate: req.body.ballotAppEndDate,
                slotAvlPerDay: req.body.slotAvlPerDay,
                maxLeaveDays: req.body.maxLeaveDays,
                ballotType: req.body.ballotType,
            }

            console.log('herr, insert', insertObj);
            let planner = await new LeavePlanner(insertObj).save()
            // console.log(ops)
            if (planner) {
                return res.status(201).json({
                    success: true,
                    message: 'Ballot Created Successfully',
                    LeavePlanner: planner
                });
            } else {
                return res.status(201).json({
                    success: false,
                    message: 'Ballot Failed',
                    LeavePlanner: planner
                });
            }
        }
        // }
    }
    catch (err) {
        console.log(err)
        __.log(err);
        __.out(res, 500);
    }
}
*/
// API to fetch ballot data
module.exports.read = async (req, res) => {
    try {
        // console.log(req.body)
        let where = {
            buId: req.body.buId,
            opsGroup: req.body.opsGroup
        }
        // console.log(where)
        var leave = await LeavePlanner.find(where).lean()
        //  console.log(leave)
        // .populate({
        //     path: 'opsGroup',
        //     select: ' userId title'
        // })
        return __.out(res, 201, {
            LeavePlannerList: leave != null ? leave : []
        });
    }
    catch (err) {
        console.log(err)
        __.log(err);
        __.out(res, 500);
    }
}

// API to update Leave Ballot
module.exports.update = async (req, res) => {
    try {
        const insertObj = {
            buId: req.body.buId,
            opsGroup: req.body.opsGroup,
            ballotName: req.body.ballotName,
            ballotStartDate: req.body.ballotStartDate,
            ballotEndDate: req.body.ballotEndDate,
            ballotAppStartDate: req.body.ballotAppStartDate,
            ballotAppEndDate: req.body.ballotAppEndDate,
            slotAvlPerDay: req.body.slotAvlPerDay,
            maxLeaveDays: req.body.maxLeaveDays,
            ballotType: req.body.ballotType,
        }
        var update = await LeavePlanner.findOneAndUpdate({ _id: req.body._id }, insertObj,
            { new: true })

        // console.log(req.body)
        if (update) {
            return res.status(201).json({
                success: true,
                message: 'Ballot updated Successfully',
                LeavePlanner: update
            });
        } else {
            return res.status(201).json({
                success: false,
                message: 'Ballot Failed',
                LeavePlanner: update
            });
        }
    }
    catch (err) {
        console.log(err)
        __.log(err);
        __.out(res, 500);
    }
}

// API to delete created Ballot
module.exports.delete = async (req, res) => {
    try {
        var remove = await LeavePlanner.findByIdAndRemove({ _id: req.params._id })
        console.log(req.body)
        if (remove) {
            return res.status(201).json({
                success: true,
                message: 'Ballot deleted Successfully',
                LeavePlanner: remove
            });
        } else {
            return res.status(201).json({
                success: false,
                message: 'Ballot Failed',
                LeavePlanner: remove
            });
        }
    } catch (err) {
        __.log(err);
        __.out(res, 500);
    }
}