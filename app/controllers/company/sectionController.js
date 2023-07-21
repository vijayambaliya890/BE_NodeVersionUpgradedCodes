// Controller Code Starts here
const mongoose = require('mongoose'),
    Section = require('../../models/section'),
    departmentController = require('./departmentController'),
    businessUnitController = require('./businessUnitController'),
    SubSection = require('../../models/subSection'),
    __ = require('../../../helpers/globalFunctions');

class section {
    async create(req, res) {
        try {
            let requiredResult = await __.checkRequiredFields(req, ['name', 'status', 'departmentId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let regex = new RegExp(`^${req.body.name.trim()}$`, "i");
                let duplicate = await Section.count({
                    name: { $regex: regex },
                    status: { $nin: 3 },
                    departmentId: req.body.departmentId
                });
                if (duplicate !== 0) {
                    __.out(res, 300, 'Section name already exists');
                    return;
                }
                let insert = req.body;
                //create new model
                let insertedSection = await new Section(insert).save();
                //save model to MongoDB
                req.body.sectionId = insertedSection._id;
                let params = {
                    "sectionId": insertedSection._id,
                    "departmentId": req.body.departmentId
                };
                departmentController.push(params, res); /* push generated city id in state table (field name : sectionIds)*/
                businessUnitController.masterBUTableUpdate(req.user.companyId);
                this.read(req, res); /*calling read fn with sectionId(last insert id). it calls findOne fn in read */
            }
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }
    async read(req, res) {
        try {
            let sectionIds = await __.getCompanyBU(req.user.companyId, "section");
            let where = {
                '_id': {
                    $in: sectionIds
                },
                'status': {
                    $ne: 3 /* $ne => not equal*/
                }
            };
            let findOrFindOne;
            if (req.body.departmentId) {
                where.departmentId = req.body.departmentId;
            }
            /*if ID given then it acts as findOne which gives object else find which gives array of object*/
            if (req.body.sectionId) {
                where._id = req.body.sectionId;
                findOrFindOne = Section.findOne(where);
            } else
                findOrFindOne = Section.find(where);

            let sections = await findOrFindOne.populate({
                path: 'departmentId',
                select: 'name',
                populate: {
                    path: 'companyId',
                    select: 'name',
                }
            }).lean();
            __.out(res, 201, {
                sections: sections
            });
        } catch (err) {
            __.log(err);
            __.out(res, 500, err);
        };
    }
    async update(req, res) {
        try {
            let requiredResult = await __.checkRequiredFields(req, ['sectionId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await Section.findOne({
                    _id: req.body.sectionId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid sectionId');
                } else {
                    let regex = new RegExp(`^${req.body.name.trim()}$`, "i");
                    let duplicate = await Section.count({
                        name: { $regex: regex },
                        status: { $nin: 3 },
                        departmentId: doc.departmentId
                    });
                    if (duplicate !== 0) {
                        __.out(res, 300, 'Section name already exists');
                        return;
                    }

                    let isDepartmentEdited = false;
                    if (req.body.departmentId && doc.departmentId != req.body.departmentId) {
                        isDepartmentEdited = true;
                        let params = {
                            "sectionId": req.body.sectionId,
                            "departmentId": doc.departmentId /*existing departmentId*/
                        };
                        departmentController.pull(params, res); /* pull this city id in from existing state (field name : sectionIds)*/
                    }
                    let sectionDetails = await Section.findOne({
                        _id: req.body.sectionId
                    }).select('orgName')
                        .populate({
                            path: 'subSections',
                            select: 'orgName'
                        })
                    .lean();
                    if (sectionDetails && sectionDetails.subSections) {
                        for (const subSecDetail of sectionDetails.subSections) {
                            let orgName = subSecDetail.orgName.split('>')
                            orgName[2] = ` ${req.body.name.trim()} `
                            orgName = orgName.join('>')
                            await SubSection.update({ _id: subSecDetail._id }, { orgName });
                        }
                    }
                    Object.assign(doc, req.body);
                    let result = await doc.save();
                    if (result === null) {
                        __.out(res, 300, 'Something went wrong');
                    } else {
                        if (isDepartmentEdited) {
                            let params = {
                                "sectionId": req.body.sectionId,
                                "departmentId": req.body.departmentId /*current departmentId*/
                            };
                            departmentController.push(params, res); /* push generated city id in state table (field name : sectionIds)*/
                        }
                        businessUnitController.masterBUTableUpdate(req.user.companyId);
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
            let requiredResult = await __.checkRequiredFields(req, ['sectionId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await Section.findOne({
                    _id: req.body.sectionId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid sectionId');
                } else {
                    doc.status = 3;
                    let result = await doc.save();
                    businessUnitController.masterBUTableUpdate(req.user.companyId);
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
            let pushJson = {};
            pushJson.subSections = mongoose.Types.ObjectId(params.subSectionId);
            let result = await Section.findOneAndUpdate({
                _id: params.sectionId
            }, {
                $addToSet: pushJson
            });
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }
    async pull(params, res) {
        try {
            let pullJson = {};
            pullJson.subSections = mongoose.Types.ObjectId(params.subSectionId);
            let result = await Section.findOneAndUpdate({
                _id: params.sectionId
            }, {
                $pull: pullJson
            });
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }
}
module.exports = new section();