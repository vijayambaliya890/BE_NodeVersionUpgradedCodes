// Controller Code Starts here
const mongoose = require('mongoose'),
    ReportingLocation = require('../../models/reportingLocation'),
    __ = require('../../../helpers/globalFunctions');

class reportingLocation {

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
                let insertedDoc = await new ReportingLocation(insert).save();
                req.body.reportingLocationId = insertedDoc._id;
                this.read(req, res); /*calling read fn with reportingLocationId(last insert id). it calls findOne fn in read */
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
                    "companyId": req.user.companyId,
                    'status': {
                        $ne: 3 /* $ne => not equal*/
                    }
                },
                findOrFindOne;
            /*if ID given then it acts as findOne which gives object else find which gives array of object*/
            if (req.body.reportingLocationId) {
                where._id = req.body.reportingLocationId;
                findOrFindOne = ReportingLocation.findOne(where);
            } else
                findOrFindOne = ReportingLocation.find(where);

            let reportingLocations = await findOrFindOne.lean();
            __.out(res, 201, {
                reportingLocations: reportingLocations
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
            let requiredResult = await __.checkRequiredFields(req, ['reportingLocationId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await ReportingLocation.findOne({
                    _id: req.body.reportingLocationId,
                    companyId: req.user.companyId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid reportingLocationId');
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
            let requiredResult = await __.checkRequiredFields(req, ['reportingLocationId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let reportingLocationResult = await ReportingLocation.findOne({
                    _id: req.body.reportingLocationId,
                    companyId: req.user.companyId,
                    status: {
                        $ne: 3
                    }
                });
                if (reportingLocationResult === null) {
                    __.out(res, 300, 'Invalid reportingLocationId');
                } else {
                    reportingLocationResult.status = 3;
                    let result = await reportingLocationResult.save();
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
reportingLocation = new reportingLocation();
module.exports = reportingLocation;