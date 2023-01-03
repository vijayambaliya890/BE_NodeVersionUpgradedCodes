// Controller Code Starts here
const mongoose = require('mongoose'),
    Department = require('../../models/department'),
    companyController = require('./companyController'),
    businessUnitController = require('./businessUnitController'),
    __ = require('../../../helpers/globalFunctions');
class department {

    async create(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['name', 'status', 'companyId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let regex = new RegExp(`^${req.body.name.trim()}$`, "i");
                let duplicate = await Department.count({
                    name: { $regex: regex },
                    status: { $nin: 3 },
                    companyId: req.user.companyId
                });
                if (duplicate !== 0) {
                    __.out(res, 300, 'Department name already exists');
                    return;
                }

                let insert = req.body;
                //create new model
                let insertedDepartment = await new Department(insert).save();
                //save model to MongoDB
                req.body.departmentId = insertedDepartment._id;
                let params = {
                    "departmentId": insertedDepartment._id,
                    "companyId": req.body.companyId
                };
                companyController.push(params, res); /* push generated city id in state table (field name : departmentIds)*/
                businessUnitController.masterBUTableUpdate(req.user.companyId);
                this.read(req, res); /*calling read fn with departmentId(last insert id). it calls findOne fn in read */
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
            let departmentIds = await __.getCompanyBU(req.user.companyId, "department");
            let where = {
                '_id': {
                    $in: departmentIds
                },
                'status': {
                    $ne: 3 /* $ne => not equal*/
                }
            };
            let findOrFindOne;
            /*if ID given then it acts as findOne which gives object else find which gives array of object*/
            if (req.body.departmentId) {
                where._id = req.body.departmentId;
                findOrFindOne = Department.findOne(where);
            } else
                findOrFindOne = Department.find(where);

            let departments = await findOrFindOne.populate({
                path: 'companyId',
                select: '_id name'
            }).lean();
            __.out(res, 201, {
                departments: departments
            });
        } catch (err) {
            __.log(err);
            __.out(res, 500, err);
        };
    }

    async readWithPn(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let page = !!req.body.page ? parseInt(req.body.page) * 10 : 0; // skip from department dropdown
            page = page ? page : parseInt(req.body.start); // skip from department table
            let query = {
                companyId: mongoose.Types.ObjectId(req.user.companyId),
                status: {
                    $in: [1, 2]
                }
            };
            const recordsTotal = await Department.count(query);
            if (req.body.q !== undefined) {
                query.name = {
                    $regex: req.body.q.toString(),
                    $options: "i",
                };
            }
            const recordsFiltered = await Department.count(query);
            const departments = await Department.find(query).skip(page).limit(10).populate({
                path: 'companyId',
                select: '_id name'
            }).lean();
            const count_filtered = await Department.count(query);
            if(!!Object.keys(req.body).includes("start")) {
                departments.forEach((d, i) => d.sno = req.body.start+i+1)
            }
            return res.status(201).json({ departments, count_filtered, recordsTotal, recordsFiltered });
        } catch (error) {
            __.log(error);
            return __.out(res, 300, error);
        }
    }

    async update(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['departmentId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {

                let doc = await Department.findOne({
                    _id: req.body.departmentId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid departmentId');
                } else {
                    let regex = new RegExp(`^${req.body.name.trim()}$`, "i");
                    let duplicate = await Department.count({
                        name: { $regex: regex },
                        status: { $nin: 3 },
                        companyId: req.user.companyId
                    });
                    if (duplicate !== 0) {
                        __.out(res, 300, 'Department name already exists');
                        return;
                    }
    
                    let isCompanyEdited = false;
                    if (req.body.companyId && doc.companyId != req.body.companyId) {
                        isCompanyEdited = true;
                        let params = {
                            "departmentId": req.body.departmentId,
                            "companyId": doc.companyId /*existing companyId*/
                        };
                        companyController.pull(params, res); /* pull this city id in from existing state (field name : departmentIds)*/
                    }
                    let sectionDetails = await Department.findOne({
                        _id: req.body.departmentId,
                        status: {
                            $ne: 3
                        }
                    }).select('name orgName')
                        .populate({
                            path: 'sections',
                            select: 'name',
                            populate: {
                                path: 'subSections',
                                select: 'orgName',
                              }
                        })
                    .lean();
                    if (sectionDetails && sectionDetails.sections) {
                        for (const section of sectionDetails.sections) {
                            for (const subSection of section.subSections) {
                                let orgName = subSection.orgName.split('>')
                                orgName[1] = ` ${req.body.name.trim()} `
                                orgName = orgName.join('>')
                                await SubSection.update({ _id: subSection._id }, { orgName });
                            }
                        }    
                    }

                    Object.assign(doc, req.body);
                    let result = await doc.save();
                    if (result === null) {
                        __.out(res, 300, 'Something went wrong');
                    } else {
                        if (isCompanyEdited) {
                            let params = {
                                "departmentId": req.body.departmentId,
                                "companyId": req.body.companyId /*current companyId*/
                            };
                            companyController.push(params, res); /* push generated city id in state table (field name : departmentIds)*/
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
            let requiredResult = await __.checkRequiredFields(req, ['departmentId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await Department.findOne({
                    _id: req.body.departmentId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid departmentId');
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
            pushJson.sections = mongoose.Types.ObjectId(params.sectionId);
            let result = await Department.findOneAndUpdate({
                _id: params.departmentId
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
            pullJson.sections = mongoose.Types.ObjectId(params.sectionId);
            let result = await Department.findOneAndUpdate({
                _id: params.departmentId
            }, {
                $pull: pullJson
            });
            __.log(result);
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }
}
department = new department();
module.exports = department;