// Controller Code Starts here
const mongoose = require('mongoose'),
    Privilege = require('../../models/privilege'),
    privilegeCategoryController = require('./privilegeCategoryController'),
    __ = require('../../../helpers/globalFunctions');
class privilege {

    async create(req, res) {
        try {
            let requiredResult = await __.checkRequiredFields(req, ['name', 'status', 'flags', 'privilegeCategoryId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let insert = req.body;
                //create new model
                let insertedPrivilege = await new Privilege(insert).save();
                //save model to MongoDB
                req.body.privilegeId = insertedPrivilege._id;
                let params = {
                    "privilegeId": insertedPrivilege._id,
                    "privilegeCategoryId": req.body.privilegeCategoryId
                };
                privilegeCategoryController.push(params, res); /* push generated city id in state table (field name : privilegeIds)*/
                this.read(req, res); /*calling read fn with privilegeId(last insert id). it calls findOne fn in read */
            }
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }

    async read(req, res) {
        try {
            let where = {
                'status': {
                    $ne: 3 /* $ne => not equal*/
                }
            };
            let findOrFindOne;
            /*if ID given then it acts as findOne which gives object else find which gives array of object*/
            if (req.body.privilegeId) {
                where._id = req.body.privilegeId;
                findOrFindOne = Privilege.findOne(where);
            } else
                findOrFindOne = Privilege.find(where);

            let privileges = await findOrFindOne.populate({
                path: 'privilegeCategoryId',
                select: '_id name'
            }).lean();
            __.out(res, 201, {
                privileges: privileges
            });
        } catch (err) {
            __.log(err);
            __.out(res, 500, err);
        };
    }

    async update(req, res) {
        try {
            let requiredResult = await __.checkRequiredFields(req, ['privilegeId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await Privilege.findOne({
                    _id: req.body.privilegeId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid privilegeId');
                } else {
                    let isPrivilegeCategoryEdited = false;
                    if (req.body.privilegeCategoryId && doc.privilegeCategoryId != req.body.privilegeCategoryId) {
                        isPrivilegeCategoryEdited = true;
                        let params = {
                            "privilegeId": req.body.privilegeId,
                            "privilegeCategoryId": doc.privilegeCategoryId /*existing privilegeCategoryId*/
                        };
                        privilegeCategoryController.pull(params, res); /* pull this city id in from existing state (field name : privilegeIds)*/
                    }
                    Object.assign(doc, req.body);
                    let result = await doc.save();
                    if (result === null) {
                        __.out(res, 300, 'Something went wrong');
                    } else {
                        if (isPrivilegeCategoryEdited) {
                            let params = {
                                "privilegeId": req.body.privilegeId,
                                "privilegeCategoryId": req.body.privilegeCategoryId /*current privilegeCategoryId*/
                            };
                            privilegeCategoryController.push(params, res); /* push generated city id in state table (field name : privilegeIds)*/
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
            let requiredResult = await __.checkRequiredFields(req, ['privilegeId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await Privilege.findOne({
                    _id: req.body.privilegeId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid privilegeId');
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
privilege = new privilege();
module.exports = privilege;