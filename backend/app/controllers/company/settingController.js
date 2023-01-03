// Controller Code Starts here
const mongoose = require('mongoose'),
    Setting = require('../../models/setting'),
    __ = require('../../../helpers/globalFunctions');

class setting {

    async create(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['adminEmail', 'techEmail']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let insert = req.body;
                //create new model
                var doc = await new Setting(insert).save();
                //save model to MongoDB
                req.body.settingId = doc._id;
                this.read(req, res); /*calling read fn with settingId(last insert id). it calls findOne fn in read */
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
            let findOrFindOne;
            /*if ID given then it acts as findOne which gives object else find which gives array of object*/
            if (req.body.settingId) {
                where._id = req.body.settingId;
                findOrFindOne = Setting.findOne(where);
            } else
                findOrFindOne = Setting.find(where);

            let settings = await findOrFindOne.lean();

            __.out(res, 201, {
                settings: settings
            });
        } catch (err) {
            __.log(err);
            __.out(res, 500, err);
        }
    }
    async update(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['settingId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await Setting.findOne({
                    _id: req.body.settingId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid settingId');
                } else {
                    Object.assign(doc, req.body);
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
            let requiredResult = await __.checkRequiredFields(req, ['settingId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await Setting.findOne({
                    _id: req.body.settingId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid settingId');
                } else {
                    doc.status = 3;
                    doc.updatedBy = req.user._id;
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
module.exports = new setting();