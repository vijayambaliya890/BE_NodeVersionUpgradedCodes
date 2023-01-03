// Controller Code Starts here
const mongoose = require('mongoose'),
    User = require('../../models/user'),
    ResetPasswordLog = require('../../models/resetPasswordLog'),
    bcrypt = require("bcrypt-nodejs"),
    __ = require('../../../helpers/globalFunctions');

class resetPassword {

    async getResetPassword(req, res) {
        try {
            if (!__.checkHtmlContent(req.params)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let where = {
                staffId: req.params.staffId,
                status: 1,
                companyId: req.user.companyId
            };
            let userData = await User.findOne(where).populate({
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
                }
            }).select('staffId name parentBussinessUnitId').lean();
            if (!userData) {
                return __.out(res, 300, 'This Staff ID is locked, please unlock it first & then reset the password');
            }
            //current user list....
            let data = await User.findOne({ _id: req.user._id, planBussinessUnitId: userData.parentBussinessUnitId }).lean();
            if (!data) {
                return __.out(res, 300, "StaffId Not Match Plan BusinessUnit");
            }
            return __.out(res, 201, userData);
        }
        catch (err) {
            __.log(err);
            return __.out(res, 500, err);
        }
    }

    async UpdatePassword(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let userData = await User.findOne({
                staffId: req.body.staffId,
                status: 1,
                companyId: req.user.companyId
            });
            if (userData === null) {
                __.out(res, 300, 'Invalid staffId');
                return;
            } else {
                // Validate Password
                let passwordValidation = await __.pwdValidation(userData, req.body.password);
                if (passwordValidation.status == false) {
                    return __.out(res, 300, passwordValidation.message);
                }
                const {
                    generateHash
                } = new User();
                const hashVal = generateHash(req.body.password);
                // Password Reuse Condition
                if (passwordValidation.pwdSettings != null && userData.pwdManage && userData.pwdManage.pwdList.length > 0) {
                    let reUseCount = passwordValidation.pwdSettings.pwdReUse;
                    let pwdList = userData.pwdManage.pwdList;
                    // Last Mentions Passwords
                    pwdList = pwdList.reverse().slice(0, reUseCount);
                    const pwdExists = pwdList.some(v => bcrypt.compareSync(req.body.password, v.password));
                    if (pwdExists) {
                        return __.out(res, 300, `Couldn't use the last ${reUseCount} passwords`);
                    }
                }
                // Set Password
                userData.password = hashVal;
                // Track password
                if (!userData.pwdManage) {
                    userData.pwdManage = {
                        pwdUpdatedAt: moment().utc().format(),
                        pwdList: [{
                            "password": hashVal,
                            "createdAt": moment().utc().format()
                        }]
                    };
                } else {
                    userData.pwdManage.pwdUpdatedAt = moment().utc().format();
                    userData.pwdManage.pwdList = [...userData.pwdManage.pwdList, ...[{
                        "password": hashVal,
                        "createdAt": moment().utc().format()
                    }]];
                }
                let resetPass = {
                    staffId: userData._id,
                    resetDate: Date.now(),
                    resetUserId: req.user._id
                }
                let resetPasswordLog = await ResetPasswordLog(resetPass).save();
                // Logout all devices
                userData.tokenList = [];
                await userData.save();
                return __.out(res, 201, `Password updated successfully`)
            }
        }
        catch (err) {
            __.log(err);
            return __.out(res, 500, err);
        }
    }

    async getResetPasswordLog(req, res) {
        try {
            if (!__.checkHtmlContent(req.query)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let pageNum = (req.query.start) ? parseInt(req.query.start) : 0;
            let limit = (req.query.length) ? parseInt(req.query.length) : 10;
            let skip = (req.query.skip) ? parseInt(req.query.skip) : ((pageNum) * limit) / limit;
            let where = {};
            let recordsTotal = await ResetPasswordLog.count({ resetUserId: req.user._id });
            if (!!req.query.search && req.query.search.value) {
                let serachQuery = {
                    '$regex': `${req.query.search.value}`,
                    '$options': 'ixs'
                };
                where['$or'] = [{
                    "staffId.name": serachQuery
                }, {
                    "staffId.staffId": serachQuery
                }, {
                    'resetUserId.staffId': serachQuery
                }, {
                    'resetUserId.name': serachQuery
                }];
            }
            const filteredData = await ResetPasswordLog.aggregate([{
                $match: { resetUserId: mongoose.Types.ObjectId(req.user._id) }
            // }, {
            //     $lookup: {
            //         from: 'users',
            //         localField: 'resetUserId',
            //         foreignField: '_id',
            //         as: 'resetUserId'
            //     }
            // }, {
            //     $unwind: '$resetUserId'
            }, {
                $lookup: {
                    from: 'users',
                    localField: 'staffId',
                    foreignField: '_id',
                    as: 'staffId'
                }
            }, {
                $unwind: '$staffId'
            }, { $match: where }]).allowDiskUse(true);
            let recordsFiltered = filteredData.length;
            let sort = { 'updatedAt': -1 };
            const getSort = val => val === 'asc' ? -1 : 1;
            if (req.query.order) {
                const sortData = [`staffId.name`, `staffId.staffId`, `createdAt`, `resetUserId.staffId`, `resetUserId.name`];
                let orderData = req.query.order;
                sort = orderData.reduce((prev, curr, i) => {
                    const key = sortData[curr.column];
                    prev[key] = getSort(curr.dir);
                    return prev;
                }, sort);
            }
            let data = await ResetPasswordLog.aggregate([{
                $match: { resetUserId: mongoose.Types.ObjectId(req.user._id) }
            }, {
                $lookup: {
                    from: 'users',
                    localField: 'resetUserId',
                    foreignField: '_id',
                    as: 'resetUserId'
                }
            }, {
                $unwind: '$resetUserId'
            }, {
                $lookup: {
                    from: 'users',
                    localField: 'staffId',
                    foreignField: '_id',
                    as: 'staffId'
                }
            }, {
                $unwind: '$staffId'
            }, { $match: where }, {
                $project: { 'staffId.name': 1, 'staffId.staffId': 1, 'createdAt': 1, 'resetUserId.staffId': 1, 'resetUserId.name': 1 }
            }, {
                $sort: sort
            }, {
                $skip: skip
            },
            {
                $limit: limit
            }]).allowDiskUse(true);
            let result = {
                draw: req.query.draw || 0,
                recordsTotal,
                recordsFiltered,
                data
            };
            return res.status(201).json(result);
            /*
                        let userData = await ResetPasswordLog.find(where).populate({
                            path: 'staffId',
                            select: 'name staffId'
                        }).populate({
                            path: 'resetUserId',
                            select: 'name staffId'
                        })
                        if (!userData) {
                            return __.out(res, 300, "StaffId Not Found!");
                        }
                        return __.out(res, 201, userData);*/
        }
        catch (err) {
            __.log(err);
            return __.out(res, 500, err);
        }
    }
}
resetPassword = new resetPassword();
module.exports = resetPassword;
