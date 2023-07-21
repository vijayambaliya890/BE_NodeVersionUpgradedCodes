// Controller Code Starts here
const mongoose = require('mongoose'),
    PrivilegeCategory = require('../../models/privilegeCategory'),
    __ = require('../../../helpers/globalFunctions');

class privilegeCategory {

    async create(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['name', 'status']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let insert = req.body;
                //create new model
                let insertedDoc = await new PrivilegeCategory(insert).save();
                req.body.privilegeCategoryId = insertedDoc._id;
                this.read(req, res); /*calling read fn with privilegeCategoryId(last insert id). it calls findOne fn in read */
            }
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }

    async read(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let where = {
                    'status': {
                        $ne: 3 /* $ne => not equal*/
                    }
                },
                findOrFindOne;
            /*if ID given then it acts as findOne which gives object else find which gives array of object*/
            if (req.body.privilegeCategoryId) {
                where._id = req.body.privilegeCategoryId;
                findOrFindOne = PrivilegeCategory.findOne(where);
            } else
                findOrFindOne = PrivilegeCategory.find(where);

            let privilegeCategory = await findOrFindOne.populate({
                path: 'privileges',
                select: 'name description status additionalAccessRights',
                match: {
                    status: {
                        $ne: 3
                    }
                },
            }).sort({_id:1}).lean();
            __.out(res, 201, {
                privilegeCategory: privilegeCategory
            });
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }

    async update(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['privilegeCategoryId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await PrivilegeCategory.findOne({
                    _id: req.body.privilegeCategoryId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid privilegeCategoryId');
                } else {
                    Object.assign(doc, req.body);
                    let result = await doc.save();
                    if (result === null) {
                        __.out(res, 300, 'Something went wrong');
                    } else {
                        this.read(req, res);
                    }
                }
            }
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }

    async delete(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['privilegeCategoryId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let privilegeCategoryResult = await PrivilegeCategory.findOne({
                    _id: req.body.privilegeCategoryId,
                    status: {
                        $ne: 3
                    }
                });
                if (privilegeCategoryResult === null) {
                    __.out(res, 300, 'Invalid privilegeCategoryId');
                } else {
                    privilegeCategoryResult.status = 3;
                    let result = await privilegeCategoryResult.save();
                    if (result === null) {
                        __.out(res, 300, 'Something went wrong');
                    } else {
                        __.out(res, 200);
                    }
                }
            }
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }

    async push(params, res) {
        try {
            let pushJson = {},
                addToSetOrSet;
            __.log(params);
            if (params.privilegeId) {
                pushJson.privileges = mongoose.Types.ObjectId(params.privilegeId);
                addToSetOrSet = {
                    $addToSet: pushJson
                };
                let result = await PrivilegeCategory.findOneAndUpdate({
                    _id: params.privilegeCategoryId
                }, addToSetOrSet);
                __.log(result);
            }
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }

    }

    async pull(params, res) {
        try {
            let pullJson = {},
                setOrPull;
            __.log(params);
            if (params.privilegeId) {
                pullJson.privileges = mongoose.Types.ObjectId(params.privilegeId);
                setOrPull = {
                    $pull: pullJson
                };
                let result = await PrivilegeCategory.findOneAndUpdate({
                    _id: params.privilegeCategoryId
                }, setOrPull);
                __.log(result);
            }
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    };
}
privilegeCategory = new privilegeCategory();
module.exports = privilegeCategory;