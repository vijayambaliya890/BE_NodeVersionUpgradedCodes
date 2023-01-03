// Controller Code Starts here
const mongoose = require('mongoose'),
    Category = require('../../models/category'),
    __ = require('../../../helpers/globalFunctions');

class category {

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
                insert.companyId = req.user.companyId;
                //create new model
                let insertedDoc = await new Category(insert).save();
                req.body.categoryId = insertedDoc._id;
                this.read(req, res); /*calling read fn with categoryId(last insert id). it calls findOne fn in read */
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
                'companyId': req.user.companyId,
                'status': {
                    $ne: 3 /* $ne => not equal*/
                }
            },
                findOrFindOne;
            /*if ID given then it acts as findOne which gives object else find which gives array of object*/
            if (req.body.categoryId) {
                where._id = req.body.categoryId;
                findOrFindOne = Category.findOne(where);
            } else
                findOrFindOne = Category.find(where);

            let categories = await findOrFindOne.populate({
                path: 'subCategories',
                select: '_id name',
                match: {
                    status: {
                        $ne: 3
                    }
                },
                populate: { //this populate has been requested from frontEnd team , so did so
                    path: 'categoryId',
                    select: '_id name',
                }
            }).lean();
            __.out(res, 201, {
                categories: categories
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
            let requiredResult = await __.checkRequiredFields(req, ['categoryId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await Category.findOne({
                    _id: req.body.categoryId,
                    companyId: req.user.companyId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid categoryId');
                } else {
                    Object.assign(doc, req.body);
                    doc.companyId = req.user.companyId;
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
            let requiredResult = await __.checkRequiredFields(req, ['categoryId']);
            if (requiredResult.status === false) {
                return __.out(res, 400, requiredResult.missingFields);
            }

            let skillSetResult = await Category.findOne({
                _id: req.body.categoryId,
                companyId: req.user.companyId,
                status: {
                    $ne: 3
                }
            });

            if (skillSetResult === null) {
                __.out(res, 300, 'Invalid categoryId');
            } else {
                skillSetResult.status = 3;
                let result = await skillSetResult.save();
                if (result === null) {
                    __.out(res, 300, 'Something went wrong');
                } else {

                    __.out(res, 200);
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
            if (params.subCategoryId) {
                pushJson.subCategories = mongoose.Types.ObjectId(params.subCategoryId);
                addToSetOrSet = {
                    $addToSet: pushJson
                };
                __.log(addToSetOrSet, params.categoryId)
                let result = await Category.findOneAndUpdate({
                    _id: params.categoryId
                }, addToSetOrSet);
                __.log(result);
            }
        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }

    async pull(params, res) {
        try {
            let pullJson = {},
                setOrPull;
            __.log(params);
            if (params.subCategoryId) {
                pullJson.subCategories = mongoose.Types.ObjectId(params.subCategoryId);
                setOrPull = {
                    $pull: pullJson
                };

                let result = await Category.findOneAndUpdate({
                    _id: params.categoryId
                }, setOrPull);
                __.log(result);
            }
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    };
}
category = new category();
module.exports = category;