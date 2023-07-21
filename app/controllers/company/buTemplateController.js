// Controller Code Starts here
const mongoose = require('mongoose'),
    BuTemplate = require('../../models/buTemplate'),
    Appoinment = require('../../models/appointment'),
    Role = require('../../models/role'),
    __ = require('../../../helpers/globalFunctions');

class buTemplate {

    async create(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['role', 'appointments', 'status']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let insert = req.body;
                insert.companyId = req.user.companyId;
                let insertedDoc = await new BuTemplate(insert).save();
                return __.out(res, 201, "Butemplate Created Successfully");
            }
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }

    async read(req, res) {
        try {
            let where = {
                companyId: req.user.companyId,
                status: 1
            };
            let buTemplatedata = await BuTemplate.find(where).populate({
                path: 'subCategories',
                populate:{
                    path:'categoryId'
                }   
            }).populate({
                path: 'subSkillSets',
                populate:{
                    path:'skillSetId'
                }
            }).populate({
                path: 'reportingLocation'
            }).populate({
                path: 'appointments'
            }).populate({
                path: 'role'
            }).lean();

            return __.out(res, 201, {
                data: buTemplatedata
            });
        }
        catch (error) {
            return __.out(res, 500, error);
        }
    }
}
buTemplate = new buTemplate();
module.exports = buTemplate;
