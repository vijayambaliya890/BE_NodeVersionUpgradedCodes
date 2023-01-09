const PostLog = require('../../models/postLog'),
    __ = require('../../../helpers/globalFunctions');

class postLog {
    async create(data, res) {
        try {
            let insert = {
                channelId: data.channelId,
                categoryId: data.categoryId,
                teaser: data.teaser,
                content: data.content,
                eventDetails: data.eventDetails,
                publishing: data.publishing,
                userOptions: data.userOptions,
                postType: data.postType,
                status: data.status,
                authorId: data.authorId,
                wallId: data.wallId,
                wallName: data.wallName,
            };
            if (data.logstatus === 1) {
                insert.logDescription = `Creating new post`;
            }
            if (data.logstatus === 2) {
                insert.logDescription = `Updating existing post`;
            }
            let isAdded = await new PostLog(insert).save();
            if (isAdded)
                __.log('Log Added Successfully');
        } catch (err) {
            __.log(err)
            __.out(res, 500);
        }
    }

    async read(req, res) {
        try {
            if (!__.checkHtmlContent(req.query)) {
                return __.out(res, 300, `You've entered malicious input`);
            }
            let pageNum = (req.query.start) ? parseInt(req.query.start) : 0;
            let limit = (req.query.length) ? parseInt(req.query.length) : 10;
            let skip = (req.query.skip) ? parseInt(req.query.skip) : ((pageNum) * limit) / limit;

            let where = {};

            var totalUserCount = await PostLog.count(where).lean();
            var isSearched = false;
            if (req.query.search && req.query.search.value != '') {
                isSearched = true;
                where['$or'] = [{
                    wallName: {
                        '$regex': `${req.query.search.value}`,
                        '$options': 'i'
                    }
                }];
            }

            var logData = await PostLog.find(where).populate({
                path: "authorId",
                select: "_id name parentBussinessUnitId profilePicture",
                populate: {
                    path: 'parentBussinessUnitId',
                    select: 'name status sectionId',
                    populate: {
                        path: 'sectionId',
                        select: 'name status departmentId',
                        populate: {
                            path: 'departmentId',
                            select: 'name status companyId',
                            populate: {
                                path: 'companyId',
                                select: 'name status'
                            }
                        }
                    }
                }
            }).populate({
                path: "channelId",
                select: "_id name logo"
            }).populate({
                path: "categoryId",
                select: "_id name"
            }).sort({
                "createdAt": -1
            }).skip(skip).limit(limit).lean();
            let totalCount = 0;
            if (isSearched)
                totalCount = await User.count(where).lean();
            else
                totalCount = totalUserCount

            let result = {
                draw: req.query.draw || 0,
                recordsTotal: totalUserCount || 0,
                recordsFiltered: totalCount || 0,
                data: logData
            }
            return res.status(201).json(result);
        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }
}

module.exports = new postLog()