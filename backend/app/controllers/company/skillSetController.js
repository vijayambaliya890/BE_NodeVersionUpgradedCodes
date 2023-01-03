// Controller Code Starts here
const mongoose = require('mongoose'),
    SkillSet = require('../../models/skillSet'),
    __ = require('../../../helpers/globalFunctions');

class skillSet {

    async create(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['name', 'status']);
            if (requiredResult.status === false) {
                return __.out(res, 400, requiredResult.missingFields);
            } else {
                let insert = req.body;
                insert.companyId = req.user.companyId;
                //create new model
                let insertedDoc = await new SkillSet(insert).save();
                req.body.skillSetId = insertedDoc._id;
                this.read(req, res); /*calling read fn with skillSetId(last insert id). it calls findOne fn in read */
            }
        } catch (err) {
            __.log(err);
            return __.out(res, 500);
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
            if (req.body.skillSetId) {
                where._id = req.body.skillSetId;
                findOrFindOne = SkillSet.findOne(where);
            } else
                findOrFindOne = SkillSet.find(where);

            let skillsets = await findOrFindOne.populate({
                path: 'subSkillSets',
                select: '_id name',
                match: {
                    status: {
                        $ne: 3
                    }
                },
                populate: { //this populate has been requested from frontEnd team , so did so
                    path: 'skillSetId',
                    select: '_id name',
                }
            }).lean();
            __.out(res, 201, {
                skillsets: skillsets
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
            let requiredResult = await __.checkRequiredFields(req, ['skillSetId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await SkillSet.findOne({
                    _id: req.body.skillSetId,
                    companyId: req.user.companyId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid skillSetId');
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
            let requiredResult = await __.checkRequiredFields(req, ['skillSetId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let skillSetResult = await SkillSet.findOne({
                    _id: req.body.skillSetId,
                    companyId: req.user.companyId,
                    status: {
                        $ne: 3
                    }
                });
                if (skillSetResult === null) {
                    __.out(res, 300, 'Invalid skillSetId');
                } else {
                    skillSetResult.status = 3;
                    let result = await skillSetResult.save();
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
            if (params.subSkillSetId) {
                pushJson.subSkillSets = mongoose.Types.ObjectId(params.subSkillSetId);
                addToSetOrSet = {
                    $addToSet: pushJson
                };
                let result = await SkillSet.findOneAndUpdate({
                    _id: params.skillSetId
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
            if (params.subSkillSetId) {
                pullJson.subSkillSets = mongoose.Types.ObjectId(params.subSkillSetId);
                setOrPull = {
                    $pull: pullJson
                };

                let result = await SkillSet.findOneAndUpdate({
                    _id: params.skillSetId
                }, setOrPull);
                __.log(result);
            }
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    };
}
module.exports = new skillSet();