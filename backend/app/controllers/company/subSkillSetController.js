// Controller Code Starts here
const mongoose = require('mongoose'),
    SubSkillSet = require('../../models/subSkillSet'),
    skillSetController = require('./skillSetController'),
    __ = require('../../../helpers/globalFunctions');
class subSkillSet {

    async create(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['name', 'status', 'skillSetId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let insert = req.body;
                //create new model
                let insertedSubSkillSet = await new SubSkillSet(insert).save();
                //save model to MongoDB
                req.body.subSkillSetId = insertedSubSkillSet._id;
                let params = {
                    "subSkillSetId": insertedSubSkillSet._id,
                    "skillSetId": req.body.skillSetId
                };
                skillSetController.push(params, res); /* push generated city id in state table (field name : subSkillSetIds)*/
                this.read(req, res); /*calling read fn with subSkillSetId(last insert id). it calls findOne fn in read */
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
            };
            if (req.body.skillSetId) {
                where.skillSetId = req.body.skillSetId;
            }
            let findOrFindOne;
            /*if ID given then it acts as findOne which gives object else find which gives array of object*/
            if (req.body.subSkillSetId) {
                where._id = req.body.subSkillSetId;
                findOrFindOne = SubSkillSet.findOne(where);
            } else
                findOrFindOne = SubSkillSet.find(where);

            let subSkillSets = await findOrFindOne.populate({
                path: 'skillSetId',
                select: '_id name'
            }).lean();
            __.out(res, 201, {
                subSkillSets: subSkillSets
            });
        } catch (err) {
            __.log(err);
            __.out(res, 500, err);
        };
    }

    async update(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['subSkillSetId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await SubSkillSet.findOne({
                    _id: req.body.subSkillSetId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid subSkillSetId');
                } else {
                    let isSkillSetEdited = false;
                    if (req.body.skillSetId && doc.skillSetId != req.body.skillSetId) {
                        isSkillSetEdited = true;
                        let params = {
                            "subSkillSetId": req.body.subSkillSetId,
                            "skillSetId": doc.skillSetId /*existing skillSetId*/
                        };
                        skillSetController.pull(params, res); /* pull this city id in from existing state (field name : subSkillSetIds)*/
                    }
                    Object.assign(doc, req.body);
                    let result = await doc.save();
                    if (result === null) {
                        __.out(res, 300, 'Something went wrong');
                    } else {
                        if (isSkillSetEdited) {
                            let params = {
                                "subSkillSetId": req.body.subSkillSetId,
                                "skillSetId": req.body.skillSetId /*current skillSetId*/
                            };
                            skillSetController.push(params, res); /* push generated city id in state table (field name : subSkillSetIds)*/
                        }
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
            let requiredResult = await __.checkRequiredFields(req, ['subSkillSetId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await SubSkillSet.findOne({
                    _id: req.body.subSkillSetId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid subSkillSetId');
                } else {
                    doc.status = 3;
                    let result = await doc.save();
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
}

module.exports = new subSkillSet();