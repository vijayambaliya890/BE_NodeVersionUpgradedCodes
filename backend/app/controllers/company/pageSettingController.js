const mongoose = require('mongoose'),
    PageSettingModel = require('../../models/pageSetting'),
    __ = require('../../../helpers/globalFunctions');
opsleave = require('./opsLeaveManagementController');
class PageSetting {

    // return the pageSetting data
    async read(req, res) {
        try {
            let pageSettingData = await PageSettingModel.findOne({
                companyId: req.user.companyId,
                status: 1
            }).populate({
                path: 'loginFields'
            }).select('bannerImages loginFields quickLinks externalLinks pwdSettings buTemplateId isChallengeIncluded isTaskViewIncluded isFormsIncluded isBoardsIncluded opsGroup loginFields adminEmail notificRemindDays notificRemindHours techEmail compliments suggestions pointSystems').lean();
            if (!pageSettingData) {
                // Create new one if not exists
                let newData = {
                    companyId: req.user.companyId,
                    bannerImages: [],
                    quickLinks: [],
                    externalLinks: [],
                    loginFields: [],
                    status: 1,
                    opsGroup: {
                        blockLeaveConfiguration: 1,
                        slotType: 1,
                        leaveAdjust: false
                    },
                    pointSystems: __.initPointSystem(req.user.companyId, true)
                };
                pageSettingData = await new PageSettingModel(newData).save();
            }
            if (!pageSettingData.pointSystems || !pageSettingData.pointSystems.length) {
                pageSettingData.pointSystems = await __.initPointSystem(req.user.companyId);
            }

            // let quick link convert to object
            let quickLinkPermissions = {};
            for (let elem of pageSettingData.quickLinks) {
                quickLinkPermissions[elem.screenName] = (elem.status == 1) ? true : false;
            }
            pageSettingData.isTaskViewIncluded = !!pageSettingData.isTaskViewIncluded;
            pageSettingData.isChallengeIncluded = !!pageSettingData.isChallengeIncluded;
            pageSettingData.isFormsIncluded = !!pageSettingData.isFormsIncluded;
            pageSettingData.isBoardsIncluded = !!pageSettingData.isBoardsIncluded;
            pageSettingData.quickLinkPermissions = quickLinkPermissions;
            // Banner Image remove timer from response
            // pageSettingData.bannerImages = pageSettingData.bannerImages.map(v=>{
            //     return v.link
            // })
            if (req.body.internalApi == true) {
                return pageSettingData;
            }
            return __.out(res, 201, pageSettingData);
        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }

    //banner Image & External Link icons upload
    async uploadFiles(req, res) {
        try {
            if (!req.file) {
                return __.out(res, 300, `No File is Uploaded`)
            }
            let filePath = `${__.serverBaseUrl()}uploads/pageSetting/${req.file.filename}`;
            __.out(res, 201, {
                link: filePath,
                exactPath: `uploads/pageSetting/${req.file.filename}`
            });
            const result = /*await*/ __.scanFile(req.file.filename, `public/uploads/pageSetting/${req.file.filename}`);
            if (!!result) {
                // return __.out(res, 300, result);
            }
        } catch (err) {
            __.log(err);
            return __.out(res, 500, err);
        };
    }

    //update the  bannerImage List, key given for quick navigation by user and the external link given by user
    async update(req, res) {
        // debugger;
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['pageId', 'bannerImages', 'quickLinks', 'externalLinks', 'opsGroup']);
            if (requiredResult.status == false) {
                return __.out(res, 400, requiredResult.missingFields);
            }
            if (!__.checkSpecialCharacters(req.body, "page settings")) {
              return __.out(res, 301, `You've entered some excluded special characters`);
            }
            let where = {
                _id: req.body.pageId,
                companyId: req.user.companyId,
                status: 1
            };
            var pageSettingData = await PageSettingModel.findOneAndUpdate(where, {
                $set: {
                    bannerImages: req.body.bannerImages,
                    quickLinks: req.body.quickLinks,
                    externalLinks: req.body.externalLinks,
                    updatedBy: req.user._id,
                    buTemplateId: req.body.buTemplateId,
                    opsGroup: req.body.opsGroup,
                    isTaskViewIncluded: req.body.isTaskViewIncluded,
                    isChallengeIncluded: req.body.isChallengeIncluded,
                    isFormsIncluded: req.body.isFormsIncluded,
                    isBoardsIncluded: req.body.isBoardsIncluded,
                    loginFields: req.body.loginFields,
                    notificRemindHours: req.body.notificRemindHours,
                    notificRemindDays: req.body.notificRemindDays,
                    adminEmail: req.body.adminEmail,
                    techEmail: req.body.techEmail,
                    compliments: req.body.compliments,
                    suggestions: req.body.suggestions,
                    pointSystems: req.body.pointSystems
                }
            }, {
                new: true
            }).lean();
            opsleave.myMethod.autoTerminateSwapRequest();
            if (!pageSettingData)
                return __.out(res, 300, "Page not found");

            return __.out(res, 201, "Updated Successfully!")
        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }

    //update the  bannerImage List, key given for quick navigation by user and the external link given by user
    async updatePwdManage(req, res) {
        try {
            if (!__.checkHtmlContent(req.body)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let requiredResult = await __.checkRequiredFields(req, ['pageId', 'pwdSettings']);
            if (requiredResult.status == false) {
                return __.out(res, 400, requiredResult.missingFields);
            }
            if (!__.checkSpecialCharacters(req.body, "page settings")) {
              return __.out(res, 301, `You've entered some excluded special characters`);
            }
            let where = {
                _id: req.body.pageId,
                companyId: req.user.companyId,
                status: 1
            };
            var pageSettingData = await PageSettingModel.findOneAndUpdate(where, {
                $set: {
                    pwdSettings: req.body.pwdSettings,
                    updatedBy: req.user._id
                }
            }, {
                new: true
            }).lean();
            if (!pageSettingData)
                return __.out(res, 300, "Page not found");

            return __.out(res, 201, "Updated Successfully!")
        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }

    async readSkillSet(req, res){
        try {
            let pageSettingData = await PageSettingModel.findOne({
                companyId: req.user.companyId,
                status: 1
            }, {opsGroup:1})
            const tierType = pageSettingData.opsGroup.tierType;
            return res.status(200).json({tierType})
        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }
}

/*Exporting Module */
module.exports =  new PageSetting();
