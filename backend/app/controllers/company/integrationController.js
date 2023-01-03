const mongoose = require('mongoose'), IntegrationModel = require('../../models/integration'),
    IntegrationMasterDataModel = require('../../models/integrationMasterData');
class Integration {
    async read(req, res) {
        try {
            const draw = req.query.draw || 0,
                pageNum = (req.query.start) ? parseInt(req.query.start) : 0,
                limit = (req.query.length) ? parseInt(req.query.length) : 10,
                skip = (req.query.skip) ? parseInt(req.query.skip) : ((pageNum) * limit) / limit;
            let query = {};
            const recordsTotal = await IntegrationModel.count({
                companyId: mongoose.Types.ObjectId(req.user.companyId),
                sourcePath: { $nin: ['Quota','Approve'] }
            });
            if (req.query.search && req.query.search.value) {
                const searchQuery = {
                    $regex: `${req.query.search.value}`,
                    $options: "ixs"
                };
                query["$or"] = [{'company.name': searchQuery},
                    {sourcePath: searchQuery},
                    {errorMessage: searchQuery},
                    {status: searchQuery},
                    {noOfNewUsers: parseInt(req.query.search.value)},
                    {noOfUpdatedUsers: parseInt(req.query.search.value)},
                    {faildUpdateUsers: parseInt(req.query.search.value)}
                ];
            }
            let sort = {};
            
            if (req.query.order) {
                let orderData = req.query.order;
                const getSort = val => ("asc" === val ? 1 : -1);                
                const sortData = [`company.name`, `status`,`noOfNewUsers`, `noOfUpdatedUsers`, `faildUpdateUsers`, `createdAt`, `errorFilePath` ];
                sort = orderData.reduce((prev, curr)=>{
                    prev[sortData[parseInt(curr.column)]]=getSort(curr.dir);
                    return prev;
                }, sort);
            }
            console.log(sort);
            let agger = [{
                $match: {
                    companyId: mongoose.Types.ObjectId(req.user.companyId),
                    sourcePath: { $nin: ['Quota','Approve'] }
                }
            }, {
                $lookup: {
                    from: 'companies',
                    localField: 'companyId',
                    foreignField: '_id',
                    as: 'company'
                }
            }, {
                $unwind: '$company'
            },{
                $project: {
                    'company.name': 1,
                        sourcePath: {
                            $nin: ['Quota','Approve']
                          },
                    sourcePath: 1,
                    errorFilePath: 1,
                    noOfNewUsers: { $cond: { if: { $isArray: '$newUsers' }, then: { $size: '$newUsers' }, else: 0 } },
                    noOfUpdatedUsers: { $cond: { if: { $isArray: '$updatedUsers' }, then: { $size: '$updatedUsers' }, else: 0 } },
                    faildUpdateUsers: { $cond: { if: { $isArray: '$nonUpdatedUsers' }, then: { $size: '$nonUpdatedUsers' }, else: 0 } },
                    status: 1,
                    createdAt: 1,
                    errorMessage: 1
                }
            }, {
                $match: {}
            }];
            const recordsFilteredData = await IntegrationModel.aggregate(agger);
            const data = await IntegrationModel.aggregate([...agger, {
                $sort: sort
            }, {
                $skip: skip
            }, {
                $limit: limit
            }]);
            let result = { draw, recordsTotal, recordsFiltered:recordsFilteredData.length, data };
            return res.status(201).json(result);
        } catch (error) {
            __.log(error);
            return __.out(res, 300, 'Something went wrong try later');
        }
    }

    async readQuota(req, res) {
        try {
            const draw = req.query.draw || 0,
                pageNum = (req.query.start) ? parseInt(req.query.start) : 0,
                limit = (req.query.length) ? parseInt(req.query.length) : 10,
                skip = (req.query.skip) ? parseInt(req.query.skip) : ((pageNum) * limit) / limit;
            let query = {};
            const recordsTotal = await IntegrationModel.count({
                companyId: mongoose.Types.ObjectId(req.user.companyId),
                sourcePath: 'Quota'
            });
            if (req.query.search && req.query.search.value) {
                const searchQuery = {
                    $regex: `${req.query.search.value}`,
                    $options: "ixs"
                };
                query["$or"] = [{'company.name': searchQuery},
                    {sourcePath: 'Quota'},
                    {errorMessage: searchQuery},
                    {status: searchQuery},
                    {noOfNewUsers: parseInt(req.query.search.value)},
                    {noOfUpdatedUsers: parseInt(req.query.search.value)},
                    {faildUpdateUsers: parseInt(req.query.search.value)}];
            }
            let sort = {};
            
            if (req.query.order) {
                let orderData = req.query.order;
                const getSort = val => ("asc" === val ? 1 : -1);                
                const sortData = [`company.name`, `status`,`noOfNewUsers`, `noOfUpdatedUsers`, `faildUpdateUsers`, `createdAt`, `errorFilePath` ];
                sort = orderData.reduce((prev, curr)=>{
                    prev[sortData[parseInt(curr.column)]]=getSort(curr.dir);
                    return prev;
                }, sort);
            }
            console.log(sort);
            let agger = [{
                $match: {
                    companyId: mongoose.Types.ObjectId(req.user.companyId),
                    sourcePath: 'Quota'
                }
            }, {
                $lookup: {
                    from: 'companies',
                    localField: 'companyId',
                    foreignField: '_id',
                    as: 'company'
                }
            }, {
                $unwind: '$company'
            },{
                $project: {
                    'company.name': 1,
                    sourcePath: 1,
                    errorFilePath: 1,
                    noOfNewUsers: { $cond: { if: { $isArray: '$newUsers' }, then: { $size: '$newUsers' }, else: 0 } },
                    noOfUpdatedUsers: { $cond: { if: { $isArray: '$updatedUsers' }, then: { $size: '$updatedUsers' }, else: 0 } },
                    faildUpdateUsers: { $cond: { if: { $isArray: '$nonUpdatedUsers' }, then: { $size: '$nonUpdatedUsers' }, else: 0 } },
                    status: 1,
                    createdAt: 1,
                    errorMessage: 1
                }
            }, {
                $match: query
            }];

            const recordsFilteredData = await IntegrationModel.aggregate(agger);
            const data = await IntegrationModel.aggregate([...agger, {
                $sort: sort
            }, {
                $skip: skip
            }, {
                $limit: limit
            }]);
            let result = { draw, recordsTotal, recordsFiltered:recordsFilteredData.length, data };
            return res.status(201).json(result);
        } catch (error) {
            __.log(error);
            return __.out(res, 300, 'Something went wrong try later');
        }
    }

    async readApprove(req, res) {
        try {
            const draw = req.query.draw || 0,
                pageNum = (req.query.start) ? parseInt(req.query.start) : 0,
                limit = (req.query.length) ? parseInt(req.query.length) : 10,
                skip = (req.query.skip) ? parseInt(req.query.skip) : ((pageNum) * limit) / limit;
            let query = {};
            const recordsTotal = await IntegrationModel.count({
                companyId: mongoose.Types.ObjectId(req.user.companyId),
                sourcePath: 'Approve'
            });
            if (req.query.search && req.query.search.value) {
                const searchQuery = {
                    $regex: `${req.query.search.value}`,
                    $options: "ixs"
                };
                query["$or"] = [{'company.name': searchQuery},
                    {sourcePath: 'Approve'},
                    {errorMessage: searchQuery},
                    {status: searchQuery},
                    {noOfNewUsers: parseInt(req.query.search.value)},
                    {noOfUpdatedUsers: parseInt(req.query.search.value)},
                    {faildUpdateUsers: parseInt(req.query.search.value)}];
            }
            let sort = {};
            if (req.query.order) {
                let orderData = req.query.order;
                const getSort = val => ("asc" === val ? 1 : -1);                
                const sortData = [`company.name`, `status`,`noOfNewUsers`, `noOfUpdatedUsers`, `faildUpdateUsers`, `createdAt`, `errorFilePath` ];
                sort = orderData.reduce((prev, curr)=>{
                    prev[sortData[parseInt(curr.column)]]=getSort(curr.dir);
                    return prev;
                }, sort);
            }
            console.log(sort);
            let agger = [{
                $match: {
                    companyId: mongoose.Types.ObjectId(req.user.companyId),
                    sourcePath: 'Approve'
                }
            }, {
                $lookup: {
                    from: 'companies',
                    localField: 'companyId',
                    foreignField: '_id',
                    as: 'company'
                }
            }, {
                $unwind: '$company'
            },{
                $project: {
                    'company.name': 1,
                    sourcePath: 1,
                    errorFilePath: 1,
                    noOfNewUsers: { $cond: { if: { $isArray: '$newUsers' }, then: { $size: '$newUsers' }, else: 0 } },
                    noOfUpdatedUsers: { $cond: { if: { $isArray: '$updatedUsers' }, then: { $size: '$updatedUsers' }, else: 0 } },
                    faildUpdateUsers: { $cond: { if: { $isArray: '$nonUpdatedUsers' }, then: { $size: '$nonUpdatedUsers' }, else: 0 } },
                    status: 1,
                    createdAt: 1,
                    errorMessage: 1
                }
            }, {
                $match: query
            }];
      
            const recordsFilteredData = await IntegrationModel.aggregate(agger);
            const data = await IntegrationModel.aggregate([...agger, {
                $sort: sort
            }, {
                $skip: skip
            }, {
                $limit: limit
            }]);
            let result = { draw, recordsTotal, recordsFiltered:recordsFilteredData.length, data };
            return res.status(201).json(result);
        } catch (error) {
            __.log(error);
            return __.out(res, 300, 'Something went wrong try later');
        }
    }

    async readMasterData(req, res) {
        try {
            const draw = req.query.draw || 0,
                pageNum = (req.query.start) ? parseInt(req.query.start) : 0,
                limit = (req.query.length) ? parseInt(req.query.length) : 10,
                skip = (req.query.skip) ? parseInt(req.query.skip) : ((pageNum) * limit) / limit;
            let query = {};
            const recordsTotal = await IntegrationMasterDataModel.count({
                companyId: mongoose.Types.ObjectId(req.user.companyId)
            });
            /* if (req.query.search && req.query.search.value) {
                const searchQuery = {
                    $regex: `${req.query.search.value}`,
                    $options: "ixs"
                };
                query["$or"] = [{'company.name': searchQuery},
                    {sourcePath: searchQuery},
                    {errorMessage: searchQuery},
                    {status: searchQuery},
                    {noOfNewUsers: parseInt(req.query.search.value)},
                    {noOfUpdatedUsers: parseInt(req.query.search.value)},
                    {faildUpdateUsers: parseInt(req.query.search.value)}];
            } */
            let sort = { _id: -1 };
            if (req.query.order) {
                let orderData = req.query.order;
                const getSort = val => ("asc" === val ? 1 : -1);                
                const sortData = [`company.name`, `status`,`noOfNewUsers`, `noOfUpdatedUsers`, `faildUpdateUsers`, `createdAt`, `errorFilePath` ];
                sort = orderData.reduce((prev, curr)=>{
                    prev[sortData[parseInt(curr.column)]]=getSort(curr.dir);
                    return prev;
                }, sort);
            }
            // console.log(sort);
            let agger = [{
                $match: {
                    companyId: mongoose.Types.ObjectId(req.user.companyId)
                }
            }, {
                $lookup: {
                    from: 'companies',
                    localField: 'companyId',
                    foreignField: '_id',
                    as: 'company'
                }
            }, {
                $unwind: '$company'
            },{
                $project: {
                    'company.name': 1,
                    sourcePath: 1,
                    errorFilePath: 1,
                    /* noOfNewUsers: { $cond: { if: { $isArray: '$newUsers' }, then: { $size: '$newUsers' }, else: 0 } },
                    noOfUpdatedUsers: { $cond: { if: { $isArray: '$updatedUsers' }, then: { $size: '$updatedUsers' }, else: 0 } },
                    faildUpdateUsers: { $cond: { if: { $isArray: '$nonUpdatedUsers' }, then: { $size: '$nonUpdatedUsers' }, else: 0 } }, */
                    newTier2: { $cond: { if: { $isArray: '$tier2.new' }, then: { $size: '$tier2.new' }, else: 0 } },
                    newTier3: { $cond: { if: { $isArray: '$tier3.new' }, then: { $size: '$tier3.new' }, else: 0 } },
                    newTitle: { $cond: { if: { $isArray: '$title.new' }, then: { $size: '$title.new' }, else: 0 } },
                    status: 1,
                    createdAt: 1,
                    errorMessage: 1
                }
            }, {
                $match: query
            }];

            const recordsFilteredData = await IntegrationMasterDataModel.aggregate(agger);
            const data = await IntegrationMasterDataModel.aggregate([...agger, {
                $sort: sort
            }, {
                $skip: skip
            }, {
                $limit: limit
            }]);
            let result = { draw, recordsTotal, recordsFiltered:recordsFilteredData.length, data };
            return res.status(201).json(result);
        } catch (error) {
            __.log(error);
            return __.out(res, 300, 'Something went wrong try later');
        }
    }
}
module.exports = new Integration();