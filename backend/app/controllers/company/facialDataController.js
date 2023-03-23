const mongoose = require('mongoose'),
    FacialData = require("../../models/facialData"),
    User = require('../../models/user'),
    __ = require('../../../helpers/globalFunctions');


class facialDataController {

    async read(data, res) {
        try {
            let where = {
                userId: data.body.userId,
            };
            let findOrFindOne = FacialData.findOne(where);
            let facialData = await findOrFindOne.populate({
                path: 'facialData',
                select: '_id name'
            }).lean();
            __.out(res, 201, {
                facialData: facialData
            });
        } catch (err) {
            __.log(err);
            __.out(res, 500, err);
        };
    }

    async create(data, res) {
        try {
            let doc = await FacialData.findOne({
                userId: data.body.userId,
            });
            if (doc === null) {
                let insert = {
                    userId: data.body.userId,
                    facialInfo: data.body.facialInfo,
                    descriptor: data.body.descriptor
                };
                var result = await new FacialData(insert).save();
                console.log('facilid', result._id)
                const userUpdate = await User.findOneAndUpdate({ _id: insert.userId }, { $set: { facialId: result._id } })
                __.log('Log created successfully');
            } else {
                doc.facialInfo = data.body.facialInfo;
                doc.descriptor = data.body.descriptor
                let result = await doc.save();
                const userUpdate = await User.findOneAndUpdate({ _id: doc.userId }, { $set: { facialId: doc._id } })
                __.log('Log updated successfully');
            }
            __.out(res, 200);
        } catch (err) {
            __.log(err)
            __.out(res, 500);
        }
    }

    async getQrCode(data, res) {
        try {
            let doc = await User.findOne({
                _id: data.body.userId
            });
            if (doc === null) {
                __.log('Invalid staff id');
                __.out(res, 204, 'Invalid staff id');
            } else {
                __.log('Log updated successfully');
                __.out(res, 200, {
                    qrCode: doc.password
                });
            }
        } catch (err) {
            __.log(err)
            __.out(res, 500);
        }
    }

    async verifyQrCode(data, res) {
        try {
            let doc = await User.findOne({
                _id: data.body.userId,
                password: data.body.qrCode
            });
            if (doc === null) {
                __.log('Invalid qr code');
                __.out(res, 200, 'Invalid qr code');
            } else {
                __.log('valid qr code');
                __.out(res, 200, 'Valid qr code');
            }
        } catch (err) {
            __.log(err)
            __.out(res, 500);
        }
    }
    async list(req, res) {
        console.log('ashish', req.params);
        return FacialData.aggregate([{
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userInfo',
            }
        },
        {
            $unwind: '$userInfo',
        },
        {
            $match: {
                "userInfo.parentBussinessUnitId": mongoose.Types.ObjectId(
                    req.params.businessUnitId)
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
        {
            $unwind: '$appointmentInfo',
        },
        {
            $project: {
                _id: 1,
                facialInfo: 1,
                userId: 1,
                'userInfo.name': 1,
                'userInfo.staffId': 1,
                'userInfo.contactNumber': 1,
                'appointmentInfo.name': 1,
                'userInfo.appointmentId': 1
            },
        },
        ]).then((data) => {
            console.log('length', data.length);
            return __.out(res, 200, {
                facialOverviewData: data
            });
        }).catch((err) => {
            __.log(err);
            return __.out(res, 500);
        });
    }
}

facialDataController = new facialDataController();
module.exports = facialDataController;
