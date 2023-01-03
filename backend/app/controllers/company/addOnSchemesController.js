// Controller Code Starts here
var moment = require("moment");

const mongoose = require('mongoose'),
    AddOnSchemes = require('../../models/addOnSchemes'),
    PostCategory = require('../../models/postCategory'),
    _ = require('lodash'),
    __ = require('../../../helpers/globalFunctions');

class addOnSchemes {

    async create(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['name', 'description', 'countType']);
            if (!requiredResult.status) {
                return __.out(res, 400, requiredResult.missingFields);
            }

            if (req.body.endDate) {
                var endDate = moment(req.body.endDate, 'DD-MM-YYYY').utc().format();
            }
            else {
                var endDate = ""
            }

            let insertScheme = {
                description: req.body.description,
                name: req.body.name,
                startDate: moment(req.body.startDate, 'DD-MM-YYYY').utc().format(),
                endDate: endDate,
                tiers: req.body.tiers,
                numberOfTiers: req.body.numberOfTiers,
                countType: req.body.countType,
                shiftsubTypes: req.body.shiftsubTypes,
                recurringType: req.body.recurringType,
                schemeId: req.user.schemeId,
                createdBy: req.body.createdBy
            };
            let newScheme = await new AddOnSchemes(insertScheme).save();
            console.log("newScheme-----save-------", newScheme);
            if (!newScheme) {
                return __.out(res, 301, "Error while creating add on scheme");
            }
            return __.out(res, 200, "Add On Scheme Created");
        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }

    async update(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['name', 'description', 'startDate', 'endDate', 'tiers', 'countType', 'shiftsubTypes', 'numberOfTiers']);
            if (requiredResult.status === false) {
                return __.out(res, 400, requiredResult.missingFields);
            }

            const id = {_id: req.params.id};
            let schemeData = await AddOnSchemes.findOneAndUpdate(id, {
                new: true,
                upsert: true // Make this update into an upsert
            });
            
            if (!schemeData) {
                return __.out(res, 300, "Add On Scheme Not Found");
            }
            if (req.body.endDate) {
                var endDate = moment(req.body.endDate, 'DD-MM-YYYY').utc().format();
            }
            else {
                var endDate = ""
            }

            /******** End GET businessUnitIds,exclusionAppointmentIds,authors **********/

            schemeData.description = req.body.description;
            schemeData.name = req.body.name;
            schemeData.startDate = moment(req.body.startDate, 'DD-MM-YYYY').utc().format();
            schemeData.endDate = endDate;
            schemeData.shiftsubTypes = req.body.shiftsubTypes;
            schemeData.tiers = req.body.tiers;
            schemeData.numberOfTiers = req.body.numberOfTiers;
            schemeData.countType = req.body.countType;
            schemeData.recurringType = req.body.recurringType;
            let updatedChannel = await schemeData.save();
            let existingCatIds = [];
            // Remove Not Listed Categories
            return __.out(res, 200, "Add On Scheme Updated");
        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }

    async remove(req, res) {
        try {
            var removedScheme = await AddOnSchemes.findByIdAndRemove({
                _id: req.params.schemeId,
                companyId: req.user.companyId,
            });
            if (!removedScheme) {
                return __.out(res, 300, "Add On Schemes Not Found");
            }
            return __.out(res, 201, "Add On Schemes deleted");
        } catch (err) {
            __.log(err);
            return __.out(res, 500, err);
        };
    }

    async getAddOnScheme(req, res) {
        try {
            if (!__.checkHtmlContent(req.params)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            var addOnSchemeData = await AddOnSchemes.find({}).lean();
            if (!addOnSchemeData) {
                return __.out(res, 300, "Add On Data Not Found");
            }

            return __.out(res, 201, addOnSchemeData);
        } catch (err) {
            __.log(err);
            return __.out(res, 500, err);
        };
    }
}

addOnSchemes = new addOnSchemes();
module.exports = addOnSchemes;
