// Controller Code Starts here
const mongoose = require('mongoose'),
    SubSection = require('../../models/subSection'),
    businessUnitController = require('./businessUnitController'),
    Role = require('../../models/role'),
    PrivilegeCategory = require('../../models/privilegeCategory'),
    Channel = require('../../models/channel'),
    Wall = require('../../models/wall'),
    User = require('../../models/user'),
    sectionController = require('./sectionController'),
    _ = require('lodash'),
    __ = require('../../../helpers/globalFunctions'),
    Section = require('../../models/section');

class subSection {

    async create(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['name', 'sectionId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let regex = new RegExp(`^${req.body.name.trim()}$`, "i");
                let duplicate = await SubSection.count({
                    name: {
                        $regex: regex
                    },
                    status: { $nin: 3 },
                    sectionId: req.body.sectionId
                });
                let subSection = await Section.findOne({
                    _id: req.body.sectionId
                }).select('name')
                    .populate({
                        path: 'departmentId',
                        select: 'name',
                        populate: {
                            path: 'companyId',
                            select: 'name'
                        }
                    })
                    .lean();
                const orgName = `${subSection.departmentId.companyId.name} > ${subSection.departmentId.name} > ${subSection.name} > ${req.body.name}`;
                if (duplicate !== 0) {
                    __.out(res, 300, 'Subsection name already exists');
                    return;
                }
                let insert = {
                    name: req.body.name,
                    sectionId: req.body.sectionId,
                    status: 1,
                    orgName
                };
                //create new model
                let insertedSubSection = await new SubSection(insert).save();
                //save model to MongoDB
                if (insertedSubSection && insertedSubSection._id) {
                    this.updatePlanBussinessUnitId(req, insertedSubSection._id)
                }
                req.body.subSectionId = insertedSubSection._id;
                let params = {
                    "subSectionId": insertedSubSection._id,
                    "sectionId": req.body.sectionId
                };
                sectionController.push(params, res); /* push generated city id in state table (field name : subSectionIds)*/
                let buIds = await User.find({ businessUnitId: insertedSubSection._id });
                if (!buIds.length) {
                    let findChannelIds = await Channel.find({});
                    findChannelIds = findChannelIds.filter(channel => {
                        return channel.userDetails.some(a => a.allBuToken);
                    });

                    findChannelIds = findChannelIds.map(v => {
                        return mongoose.Types.ObjectId(v._id)
                    });

                    for (let channelIds of findChannelIds) {
                        let findChannelBu = await Channel.update({
                            _id: channelIds,
                            "userDetails.allBuToken": true
                        }, {
                            $addToSet: {
                                "userDetails.$.businessUnits": insertedSubSection._id
                            }
                        },
                            {
                                new: true
                            });
                    }
                    // wall buIds inserted....
                    let findWallIds = await Wall.find({});
                    findWallIds = findWallIds.filter(wall => {
                        return wall.assignUsers.some(a => a.allBuToken);
                    });

                    findWallIds = findWallIds.map(v => {
                        return mongoose.Types.ObjectId(v._id)
                    });
                    for (let wallsIds of findWallIds) {
                        let findWallBu = await Wall.update({
                            _id: wallsIds,
                            "assignUsers.allBuToken": true
                        }, {
                            $addToSet: {
                                "assignUsers.$.businessUnits": insertedSubSection._id
                            }
                        },
                            {
                                new: true
                            });
                    }
                }
                businessUnitController.masterBUTableUpdate(req.user.companyId);
                this.read(req, res); /*calling read fn with subSectionId(last insert id). it calls findOne fn in read */
            }
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }

    async updatePlanBussinessUnitId(req, planBussinessUnitId) {
        const userDetails = await User.findOne({ companyId: req.user.companyId, _id: req.user._id })
            .select('planBussinessUnitId');

        if(userDetails){
            userDetails.planBussinessUnitId.push(planBussinessUnitId);
            await User.update({ companyId: req.user.companyId, _id: req.user._id }, { planBussinessUnitId: userDetails.planBussinessUnitId } )
        }
    }

    async read(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let subSectionIds = await __.getCompanyBU(req.user.companyId, "subsection");
            let where = {
                '_id': {
                    $in: subSectionIds
                },
                'status': {
                    $ne: 3 /* $ne => not equal*/
                }
            };
            if (req.body.sectionId) {
                where.sectionId = req.body.sectionId;
            }
            let findOrFindOne;
            /*if ID given then it acts as findOne which gives object else find which gives array of object*/
            if (req.body.subSectionId) {
                where._id = req.body.subSectionId;
                findOrFindOne = SubSection.findOne(where);
            } else {
                findOrFindOne = SubSection.find(where);
            }
            let subSections = await findOrFindOne.populate({
                path: 'sectionId',
                select: 'name',
                populate: {
                    path: 'departmentId',
                    select: 'name status',
                    populate: {
                        path: 'companyId',
                        select: 'name status',
                    }
                }
            }).populate({
                path: "appointments",
                select: "name status"
            }).lean();
            __.out(res, 201, {
                subSections: subSections
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
            let requiredResult = await __.checkRequiredFields(req, ['subSectionId'], 'subSection');
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await SubSection.findOne({
                    _id: req.body.subSectionId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid subSectionId');
                } else {
                    /* Check for duplicate name */
                    let orgName = doc.orgName;
                    if (req.body.sectionId && req.body.name) {
                        let regex = new RegExp(`^${req.body.name.trim()}$`, "i");
                        orgName = orgName.split('>')
                        orgName[3] = ` ${req.body.name.trim()}`
                        doc.orgName = orgName.join('>')
                        let query = {
                            _id: {
                                $ne: req.body.subSectionId
                            },
                            name: {
                                $regex: regex
                            },
                            status: 1,
                            sectionId: req.body.sectionId
                        };
                        let duplicate = await SubSection.count(query);
                        if (duplicate !== 0) {
                            __.out(res, 300, 'Subsection name already exists');
                            return;
                        }
                    }
                    let isSectionEdited = false;
                    if (req.body.sectionId && doc.sectionId != req.body.sectionId) {
                        isSectionEdited = true;
                        let params = {
                            "subSectionId": req.body.subSectionId,
                            "sectionId": doc.sectionId /*existing sectionId*/
                        };
                        sectionController.pull(params, res); /* pull this city id in from existing state (field name : subSectionIds)*/
                    }
                    Object.assign(doc, req.body);
                    let result = await doc.save();
                    if (result === null) {
                        __.out(res, 300, 'Something went wrong');
                    } else {
                        if (isSectionEdited) {
                            let params = {
                                "subSectionId": req.body.subSectionId,
                                "sectionId": req.body.sectionId /*current sectionId*/
                            };
                            sectionController.push(params, res); /* push generated city id in state table (field name : subSectionIds)*/
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
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['subSectionId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await SubSection.findOne({
                    _id: req.body.subSectionId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid subSectionId');
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
            if (params.subSkillSetId)
                pushJson.subSkillSets = mongoose.Types.ObjectId(params.subSkillSetId);
            else if (params.reportingLocationId)
                pushJson.reportingLocations = mongoose.Types.ObjectId(params.reportingLocationId);

            let result = await SubSection.findOneAndUpdate({
                _id: params.subSectionId
            }, {
                $addToSet: pushJson
            });
            __.log(result);
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }

    async pull(params, res) {
        try {
            let pullJson = {};
            if (params.subSkillSetId)
                pullJson.subSkillSets = mongoose.Types.ObjectId(params.subSkillSetId);
            else if (params.reportingLocationId)
                pullJson.reportingLocations = mongoose.Types.ObjectId(params.reportingLocationId);

            let result = await SubSection.findOneAndUpdate({
                _id: params.subSectionId
            }, {
                $pull: pullJson
            });
            __.log(result);
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }

    async getCategories(id, res) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    message: "Invalid ID"
                });
            }
            let businessUnit = await SubSection.find({ _id: id })
                .select('subCategories')
                .populate({
                    path: 'subCategories',
                    populate: {
                        path: 'categoryId',
                        select: 'name subCategories'
                    }
                })
                .lean();

            __.out(res, 201, businessUnit);
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }

    async checkDuplicate(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['sectionId', 'name']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
                return;
            }

            let regex = new RegExp(`^${req.body.name.trim()}$`);
            let query = {
                name: {
                    $regex: regex
                },
                status: 1,
                sectionId: req.body.sectionId
            };
            if (req.body.subSectionId) {
                query._id = req.body.subSectionId;
            }
            let duplicate = await SubSection.count(query);
            if (duplicate !== 0) {
                __.out(res, 201, {
                    duplicate: true
                });
                return;
            }
            __.out(res, 201, {
                duplicate: false
            });
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }

    async testRole(req, res) {
        try {
            let categoryData = await PrivilegeCategory.findOne({
                name: "System Admin"
            }).select('privileges').lean();
            let { privileges } = categoryData;
            let adminRoles = await Role.find({
                privileges: {
                    $all: privileges
                }
            }).lean();
            let superAdminRoles = adminRoles.map(x => x._id);
            let superAdmins = await User.find({
                role: {
                    $in: superAdminRoles
                }
            }).select('role').lean();
            __.out(res, 201, superAdmins);
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }
}

module.exports = new subSection();