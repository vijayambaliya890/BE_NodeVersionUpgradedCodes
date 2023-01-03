// Controller Code Starts here
const mongoose = require('mongoose'),
    User = require('../../models/user'),
    Channel = require('../../models/channel'),
    UserField = require('../../models/userField'),
    _ = require('lodash'),
    __ = require('../../../helpers/globalFunctions');

class channel {

    async create(req, res) {
        try {
            __.log(req.body, "userFields/create")
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['fieldName', 'type']);
            if (requiredResult.status === false) {
                return __.out(res, 400, requiredResult.missingFields);
            }
            let fieldExists = await UserField.findOne({
                fieldName: req.body.fieldName,
                companyId: req.user.companyId,
                status: {
                    $ne: 3
                }
            });
            if (fieldExists) {
                __.log(fieldExists)
                return __.out(res, 300, "Field Name Already Exists");
            }
            let insertField = {
                fieldName: req.body.fieldName,
                type: req.body.type,
                companyId: req.user.companyId,
                indexNum: req.body.indexNum,
                editable: req.body.editable || false
            };
            if (req.body.type == 'dropdown') {
                let optionArray = [...new Set(req.body.options)];
                insertField.options = optionArray;
            }
            let newField = await new UserField(insertField).save();
            if (newField)
                return __.out(res, 200, "Field Created");
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
            let requiredResult = await __.checkRequiredFields(req, ['fieldId', 'fieldName', 'type']);
            if (requiredResult.status === false) {
                return __.out(res, 400, requiredResult.missingFields);
            }

            // Existing Field Name
            let fieldExists = await UserField.findOne({
                _id: {
                    $ne: req.body.fieldId
                },
                fieldName: req.body.fieldName,
                companyId: req.user.companyId,
                status: {
                    $ne: 3
                }
            });
            if (fieldExists) {
                return __.out(res, 300, "Field Name Already Exists");
            }
            // Get Field Datas
            let fieldData = await UserField.findOne({
                _id: req.body.fieldId,
                companyId: req.user.companyId
            });
            if (!fieldData) {
                return __.out(res, 300, "Field Not Found");
            }
            // Check Field is already assigned or not
            let getUser = await User.find({
                "otherFields.fieldId": fieldData._id,
                // "status": {
                //     $ne: 3
                // }
            });
            let editable = true;
            if (getUser > 0) {
                editable = false;
            }
            // Update Logics
            if (editable === true) {
                fieldData.fieldName = req.body.fieldName;
                fieldData.type = req.body.type;
                fieldData.options = [];
            }
            if (fieldData.type == 'dropdown') {
                // Combine new & old options -> update
                let newOptions = [...new Set(req.body.options)];
                let existOptions = [...new Set(req.body.nonEditableFields)];
                let optionArray = [...existOptions, ...newOptions];
                fieldData.options = optionArray;
            }

            /**Field Name Swaping */
            let changedFields = await UserField.update({
                indexNum: req.body.indexNum,
                companyId: req.user.companyId,
                status: 1
            }, {
                $set: {
                    indexNum: fieldData.indexNum
                }
            });

            // Update Current Field
            fieldData.indexNum = req.body.indexNum;
            // Update Editable
            fieldData.editable = req.body.editable || false;
            await fieldData.save();
            return __.out(res, 200, "Field Updated");
        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }

    async remove(req, res) {
        try {
            if (!__.checkHtmlContent(req.params)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            // Check Field is already assigned or not
            let getUser = await User.find({
                "otherFields.fieldId": req.params.fieldId,
                "status": {
                    $ne: 3
                }
            });
            if (getUser > 0) {
                return __.out(res, 300, "Field is already assigned with users");
            }
            let where = {
                _id: req.params.fieldId,
                companyId: req.user.companyId,
                status: {
                    $nin: [3]
                }
            };
            var removedField = await UserField.findOneAndUpdate(where, {
                $set: {
                    status: 3
                }
            }, {
                new: true
            }).lean();

            if (!removedField) {
                return __.out(res, 300, "Field Not Found");
            }
            // decrement 1 index number for fields after that
            await UserField.update({
                companyId: req.user.companyId,
                indexNum: {
                    $gt: removedField.indexNum
                }
            }, {
                $inc: {
                    indexNum: -1
                }
            }, {
                multi: true
            });
            return __.out(res, 201, "Field deleted");
        } catch (err) {
            __.log(err);
            return __.out(res, 500, err);
        };
    }

    async read(req, res) {
        try {
            let where = {
                companyId: req.user.companyId,
                status: {
                    $nin: [3]
                }
            };
            var fieldList = await UserField.find(where).sort({
                "indexNum": 1
            }).lean();
            return __.out(res, 201, {
                total: fieldList.length,
                fieldList: fieldList
            });
        } catch (err) {
            __.log(err);
            return __.out(res, 500, err);
        };
    }
}
module.exports = new channel();