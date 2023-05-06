// Controller Code Starts here
const mongoose = require('mongoose'),
    Role = require('../../models/role'),
    User = require('../../models/user'),
    __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class role {

    async create(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['name', 'isFlexiStaff', 'description', 'privileges', 'status']);

            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let insert = req.body;
                insert.companyId = req.user.companyId;
                //create new model
                var doc = await new Role(insert).save();
                //save model to MongoDB
                req.body.roleId = doc._id;
                this.read(req, res); /*calling read fn with roleId(last insert id). it calls findOne fn in read */
            }
        } catch (err) {
            __.log(err);
            __.out(res, 500);
        }
    }

    async read(req, res) {
        try {
            logInfo(`role/read API Start!`, { name: req.user.name, staffId: req.user.staffId });
            if (!__.checkHtmlContent(req.body)) {
                logError(`role/read API, You've entered malicious input `, req.body);
                return __.out(res, 300, `You've entered malicious input`);
            }
            let where = {
                'companyId': req.user.companyId,
                'status': {
                    $ne: 3 /* $ne => not equal*/
                }
            };
            let findOrFindOne;
            /*if ID given then it acts as findOne which gives object else find which gives array of object*/
            if (req.body.roleId) {
                where._id = req.body.roleId;
                findOrFindOne = Role.findOne(where);
            } else
                findOrFindOne = Role.find(where);

            let roles = await findOrFindOne.lean();
            logInfo(`role/read API ends here!`, { name: req.user.name, staffId: req.user.staffId });
            __.out(res, 201, { roles: roles });
        } catch (err) {
            logError(`role/read API, there is an error`, err.toString());
            __.out(res, 500, err);
        }
    }

    async update(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['roleId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {
                let doc = await Role.findOne({
                    _id: req.body.roleId,
                    companyId: req.user.companyId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid roleId');
                } else {
                  const userUpdate = await User.updateMany(
                    { role: req.body.roleId },
                    { $set: { roleUpdate: true } },
                  );
                  logInfo('During role update user updated', userUpdate);
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
            let requiredResult = await __.checkRequiredFields(req, ['roleId']);
            if (requiredResult.status === false) {
                __.out(res, 400, requiredResult.missingFields);
            } else {

                let doc = await Role.findOne({
                    _id: req.body.roleId,
                    companyId: req.user.companyId,
                    status: {
                        $ne: 3
                    }
                });
                if (doc === null) {
                    __.out(res, 300, 'Invalid roleId');
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
module.exports = new role();