// Controller Code Starts here
const mongoose = require('mongoose'),
    SkillSet = require('../../models/skillSet'),
    __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class skillSet {

    async create(req, res) {
        try {
            logInfo(`skillset/create API Start!`, { name: req.user.name, staffId: req.user.staffId });
            if (!__.checkHtmlContent(req.body)) {
                logError(`skillset/create API, You've entered malicious input `, req.body);
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['name', 'status']);
            if (requiredResult.status === false) {
                logError(`skillset/create API, Required fields missing `, requiredResult1.missingFields);
                logError(`skillset/create API, request payload `, req.body);
                return __.out(res, 400, requiredResult.missingFields);
            } else {
                let insert = req.body;
                insert.companyId = req.user.companyId;
                //create new model
                let insertedDoc = await new SkillSet(insert).save();
                req.body.skillSetId = insertedDoc._id;
                logInfo(`skillset/create API ends here!`, { name: req.user.name, staffId: req.user.staffId });
                this.read(req, res); /*calling read fn with skillSetId(last insert id). it calls findOne fn in read */
            }
        } catch (err) {
            logError(`skillset/create API, there is an error`, err.toString());
            return __.out(res, 500);
        }
    }

    async read(req, res) {
        try {
            logInfo(`skillset/read API Start!`, { name: req.user.name, staffId: req.user.staffId });
            if (!__.checkHtmlContent(req.body)) {
                logError(`skillset/read API, You've entered malicious input `, req.body);
                return __.out(res, 300, `You've entered malicious input`);
            }
            let where = { 'companyId': req.user.companyId, 'status': { $ne: 3 } },
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
            logInfo(`skillset/read API ends here!`, { name: req.user.name, staffId: req.user.staffId });
            __.out(res, 201, {
                skillsets: skillsets
            });
        } catch (err) {
            logError(`skillset/read API, there is an error`, err.toString());
            __.out(res, 500);
        }
    }

    async readSkillSet(req, res) {
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
            const { page, limit, sortBy, sortWith, search } = req.query;
            let searchCondition = {};
            if (search) {
                searchCondition['name'] = new RegExp(search, 'i');
            }
            /*if ID given then it acts as findOne which gives object else find which gives array of object*/
            if (req.body.skillSetId) {
                where._id = req.body.skillSetId;
                findOrFindOne = SkillSet.findOne({ ...where, ...searchCondition });
            } else
                findOrFindOne = SkillSet.find({ ...where, ...searchCondition });

            console.log(where)
            let skillsets = await findOrFindOne.populate({
                path: 'subSkillSets',
                select: '_id name',
                match: {
                    status: {
                        $ne: 3
                    }
                }
            })
                .sort({ [sortWith]: sortBy === 'desc' ? -1 : 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();
            __.out(res, 201, {
                data: skillsets
            });
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }

    async update(req, res) {
        try {
            logInfo(`skillset/update API Start!`, { name: req.user.name, staffId: req.user.staffId });
            if (!__.checkHtmlContent(req.body)) {
                logError(`skillset/update API, You've entered malicious input `, req.body);
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['skillSetId']);
            if (requiredResult.status === false) {
                logError(`skillset/update API, Required fields missing `, requiredResult.missingFields);
                logError(`skillset/update API, request payload `, req.body);
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
                    logError(`skillset/update API, 'Invalid skillSetId'`, req.body);
                    __.out(res, 300, 'Invalid skillSetId');
                } else {
                    Object.assign(doc, req.body);
                    let result = await doc.save();
                    if (result === null) {
                        logError(`skillset/update API, 'Something went wrong'`, req.body);
                        __.out(res, 300, 'Something went wrong');
                    } else {
                        logInfo(`skillset/update API ends here!`, { name: req.user.name, staffId: req.user.staffId });
                        this.read(req, res);
                    }
                }
            }
        } catch (err) {
            logError(`skillset/update API, there is an error`, err.toString());
            __.out(res, 500);
        }
    }

    async delete(req, res) {
        try {
            logInfo(`skillset/delete API Start!`, { name: req.user.name, staffId: req.user.staffId });
            if (!__.checkHtmlContent(req.body)) {
                logError(`skillset/delete API, You've entered malicious input `, req.body);
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['skillSetId']);
            if (requiredResult.status === false) {
                logError(`skillset/delete API, Required fields missing `, requiredResult.missingFields);
                logError(`skillset/delete API, request payload `, req.body);
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
                    logError(`skillset/delete API, there is an error`, 'Invalid skillSetId');
                    __.out(res, 300, 'Invalid skillSetId');
                } else {
                    skillSetResult.status = 3;
                    let result = await skillSetResult.save();
                    if (result === null) {
                        logError(`skillset/delete API, there is an error`, 'Something went wrong');
                        __.out(res, 300, 'Something went wrong');
                    } else {
                        logInfo(`skillset/delete API ends here!`, { name: req.user.name, staffId: req.user.staffId });
                        __.out(res, 200);
                    }
                }
            }
        } catch (err) {
            logError(`skillset/delete API, there is an error`, err.toString());
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