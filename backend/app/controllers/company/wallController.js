const mongoose = require('mongoose'),
  SocialWallModel = require('../../models/wall'),
  WallCategoryModel = require('../../models/wallCategory'),
  WallPost = require('../../models/wallPost'),
  User = require('../../models/user'),
  channelModel = require('../../models/channel'),
  __ = require('../../../helpers/globalFunctions'),
  WallComment = require('../../models/wallPostComment'),
  ReportCommentModel = require('../../models/reportComment'),
  ReportPostModel = require('../../models/reportPost'),
  Company = require('../../models/company'),
  Question = require('../../models/question'),
  PostComment = require('../../models/channelPostComment'),
  QuestionResponse = require('../../models/questionResponse'),
  Challenge = require('../../models/challenge'),
  CustomForm = require('../../models/customForms'),
  ManageForm = require('../../models/manageForm'),
  fs = require('fs-extra'),
  spawn = require('child_process').spawn,
  SubSection = require('../../models/subSection'),
  moment = require('moment'),
  json2csv = require('json2csv').parse;

class SocialWall {
  async buToolQueryChecking(req, res) {
    try {
      let pageNum = !!req.query.start ? parseInt(req.query.start) : 0;
      let limit = !!req.query.length ? parseInt(req.query.length) : 10;
      let skip = !!req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum * limit) / limit;
      let query = {
        customFormId: mongoose.Types.ObjectId(req.query.customFormId),
      };
      const recordsTotal = await ManageForm.count(query).lean();
      const customForm = await CustomForm.findById(req.query.customFormId)
        .select({
          formStatus: 1,
        })
        .lean();
      let recordsFiltered = recordsTotal;
      if (!!req.query.search && req.query.search.value) {
        query['$or'] = [
          {
            'customFormId.title': {
              $regex: `${req.query.search.value}`,
              $options: 'ixs',
            },
          },
        ];
        recordsFiltered = await ManageForm.count(query).lean();
      }
      let sort = {};
      if (req.query.order) {
        let orderData = req.query.order;
        const getSort = (val) => ('asc' === val ? 1 : -1);
        for (let i = 0; i < orderData.length; i++) {
          switch (orderData[i].column) {
            case '0':
              sort[`createdAt`] = getSort(orderData[i].dir);
              break;
            case '1':
              sort[`title`] = getSort(orderData[i].dir);
              break;
            default:
              sort[`createdAt`] = getSort(orderData[i].dir);
              break;
          }
        }
      }
      const manageForm = await ManageForm.find(query)
        .populate([
          {
            path: 'customFormId',
            select: { title: 1, _id: 0 },
          },
          {
            path: 'userId',
            select: 'name',
          },
        ])
        .select({
          customFormId: 1,
          userId: 1,
          formStatus: 1,
          createdAt: 1,
        })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
      const addStatusToManageForm = (single) => {
        let obj = {
          _id: single._id,
          createdAt: single.createdAt,
          formName: single.customFormId.title,
          user: single.userId.name,
        };
        return customForm.formStatus.reduce((prev, curr, i) => {
          const index = single.formStatus.findIndex(
            (st) => st.fieldId.toString() == curr._id.toString(),
          );
          prev[curr._id] =
            -1 === index ? null : single.formStatus[index].fieldStatusValueId;
          return prev;
        }, obj);
      };
      const result = manageForm.reduce((prev, single, i) => {
        return prev.concat(addStatusToManageForm(single));
      }, []);
      const groupByStatus = await ManageForm.aggregate([
        {
          $match: {
            customFormId: mongoose.Types.ObjectId(req.query.customFormId),
          },
        },
        {
          $project: {
            formStatus: 1,
          },
        },
        {
          $unwind: '$formStatus',
        },
        {
          $group: {
            _id: '$formStatus.fieldStatusValueId',
            count: { $sum: 1 },
          },
        },
      ]);
      const data = {
        draw: req.query.draw || 0,
        recordsTotal: recordsTotal || 0,
        recordsFiltered: recordsFiltered || 0,
        data: { result, groupByStatus },
      };
      return res.status(201).json(data);
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
    /*try {
            let Client = require('ssh2-sftp-client');
        let sftp = new Client();
        let timeStamp = `${moment().format('YYYYMMDD')}04`;
        await sftp.connect({
            host: 'ftp.sats.com.sg',
            port: '22',
            username: 'MySATS_AD_UAT',
            password: 'mySatsuat!23',
            algorithms: {
                kex: ['diffie-hellman-group14-sha1']
            }
        }).then(() => {
            return sftp.list('/ADDailyExtractPRD');
        }).then(async (data) => {
            data = data || [];
            const filteredData = data.filter(v => -1 !== v.name.indexOf(`dailyMySATS${timeStamp}`));
            for (const d of filteredData) {
                let daily = d.name;
                await sftp.get(`/ADDailyExtractPRD/${daily}`).then(async (fileData) => {
                    let writtenFileData = await fs.writeFileSync(`public/${daily}`, fileData);
                    await spawn('unzip', ['-P', 'Daily@dm1n!', '-d', './public/', `./public/${daily}`]);
                    const resDaily = daily.split('.')[0] + '.csv';
                    console.log('ended');
                    return __.out(res, 201, 'successfully fetched');
                    //await integration(resDaily, req, res);
                }, async (error) => {
                    console.log(error);
                    return __.out(res, 300, 'Something went wrong try later');
                    
                });
            }
        }).catch(async (error) => {
            console.log(error);            
            return __.out(res, 300, 'Something went wrong try later');
        });
        } catch (error) {
            __.log(error);
            return __.out(res, 300, 'Something went wrong try later');
        }*/
    /*try {
            if (req.query.daily) {
                let Client = require('ssh2-sftp-client');
                let sftp = new Client();
                let timeStamp = `${moment().format('YYYYMMDD')}`;
                if(!!req.query.date){
                    timeStamp = req.query.date;
                }
                __.log('daily started');
                await sftp.connect({
                    host: 'ftp.sats.com.sg',
                    port: '22',
                    username: 'MySATS_AD_PRD',
                    password: 'mySatsprd!23',
                    algorithms: {
                        kex: ['diffie-hellman-group14-sha1']
                    }
                }).then(() => {
                    return sftp.list('/ADDailyExtractPRD');
                }).then(async (data) => {
                    data = data || [];
                    const filteredData = data.filter(v => -1 !== v.name.indexOf(`dailyMySATS${timeStamp}`));
                    for (const d of filteredData) {
                        let daily = d.name;
                        __.log('started downloading', daily);
                        await sftp.get(`/ADDailyExtractPRD/${daily}`).then(async (fileData) => {
                            let writtenFileData = await fs.writeFileSync(`public/${daily}`, fileData);
                            await spawn('unzip', ['-P', 'Daily@dm1n!', '-d', './public/', `./public/${daily}`]);
                        }, async (error) => {
                            await fs.appendFileSync('./public/integration/integration.log', JSON.stringify(error));
                            return __.out(res, 300, { message: error })
                        });
                    }
                    return __.out(res, 201, `successfully fetched ${filteredData.length}`);
                }).catch(async (error) => {
                    await fs.appendFileSync('./public/integration/integration.log', JSON.stringify(error));
                    return __.out(res, 300, { message: error })
                });
            } else if(req.query.weekly){
                try {
                    let Client = require('ssh2-sftp-client');
                    let sftp = new Client();
                    let timeStamp = `${moment().format('YYYYMM')}`;
                    await sftp.connect({
                        host: 'ftp.sats.com.sg',
                        port: '22',
                        username: 'MySATS_AD_PRD',
                        password: 'mySatsprd!23',
                        algorithms: {
                            kex: ['diffie-hellman-group14-sha1']
                        }
                    }).then(() => {
                        console.log('connected')
                        return sftp.list('/ADWeeklyExtractPRD');
                    }).then(async (data) => {
                        data = data || [];
                        const filteredData = data.filter(v => -1 !== v.name.indexOf(`weeklyMySATS${timeStamp}`));
                        for (const d of filteredData) {
                            let daily = d.name;
                            console.log(daily,'weekly');
                            await sftp.get(`/ADWeeklyExtractPRD/${daily}`).then(async (fileData) => {
                                console.log('filedata');
                                let writtenFileData = await fs.writeFileSync(`public/${daily}`, fileData);
                            });
                        }
                        return __.out(res, 201, `successfully fetched ${filteredData.length}`);
                    });
                } catch (error) {
                    return __.out(res, 201, { data: error })
                }
            }
        } catch (error) {
            __.log(error);
            return __.out(res, 300, { message: error })
        }*/
    /*try {
            let post = await PostComment.find({}).populate({
                path: 'userId',
                select: 'parentBussinessUnitId'
            }).populate({
                path: 'postId',
                select: 'postId',
                match: {
                    postId: {
                        $exists: false
                    }
                },
                populate: {
                    path: 'channelId',
                    select: '_id',
                    match: {
                        channelId: {
                            $exists: false
                        }
                    }
                }
            }).sort({ _id: -1 }).limit(10).lean();
            //group by channel
 
            let channelGroupBy = post.reduce((prev, curr, i) => {
                if (!!curr.postId) {
                    prev[curr.postId.channelId._id] = prev[curr.postId.channelId._id] || [];
                    prev[curr.postId.channelId._id].push(curr);
                }
                return prev;
            }, {});
            const commentCount = (filteredData) => {
                for (const key in filteredData) {
                    if (filteredData.hasOwnProperty(key)) {
                        const element = filteredData[key];
                        filteredData[key] = element.length;
                    }
                }
                return filteredData;
            }
            const buBasedCount = (cpost) => {
                return commentCount(cpost.reduce((prev, curr, i) => {
                    prev[curr.userId.parentBussinessUnitId] = prev[curr.userId.parentBussinessUnitId] || [];
                    prev[curr.userId.parentBussinessUnitId].push(curr);
                    return prev;
                }, {}));
            }
            for (const key in channelGroupBy) {
                if (channelGroupBy.hasOwnProperty(key)) {
                    const element = channelGroupBy[key];
                    channelGroupBy[key] = buBasedCount(channelGroupBy[key]);
                }
            }
            return __.out(res, 201, { channelGroupBy });
        } catch (error) {
            __.log(error);
            return __.out(res, 300, error);
        }*/

    /*
        try {
            let users = await User.find({}).populate({
                path: 'parentBussinessUnitId',
                select: 'sectionId name',
                populate: {
                    path: 'sectionId',
                    select: 'name departmentId',
                    populate: {
                        path: 'departmentId',
                        select: 'companyId name',
                        populate: {
                            path: 'companyId',
                            select: 'name'
                        }
                    }
                }
            }).populate({
                path: 'appointmentId',
                select: 'name'
            }).populate({
                path: 'role',
                select: 'name'
            }).select('role parentBussinessUnitId staffId appointmentId name').lean();
            const getParentBusinessUnit = curr => {
                let parentBussinessUnitId = '--', sectionId = '--', departmentId = '--', companyId = '--'
                if (!!curr.parentBussinessUnitId) {
                    parentBussinessUnitId = curr.parentBussinessUnitId.name;
                    if (!!curr.parentBussinessUnitId.sectionId) {
                        sectionId = curr.parentBussinessUnitId.sectionId.name;
                        if (!!curr.parentBussinessUnitId.sectionId.departmentId) {
                            departmentId = curr.parentBussinessUnitId.sectionId.departmentId.name;
                            if (!!curr.parentBussinessUnitId.sectionId.departmentId.companyId) {
                                companyId = curr.parentBussinessUnitId.sectionId.departmentId.companyId.name
                            }
                        }
                    }
                }
                return `${companyId}>${departmentId}>${sectionId}>${parentBussinessUnitId}`;
            }
            const usersToPrint = Array.from(users, curr => {
                return {
                    name: curr.name || '',
                    staffId: curr.staffId || '',
                    role: curr.role.name || '',
                    appointmentId: curr.appointmentId.name || '',
                    parentBussinessUnitId: getParentBusinessUnit(curr)
                };
            });
            var csvLink = '', fieldsArray = ["name", "staffId", "role", "appointmentId", "parentBussinessUnitId"];
            if (usersToPrint.length !== 0) {
                var csv = json2csv({
                    data: usersToPrint,
                    fields: fieldsArray
                });
                await fs.writeFile(`./public/uploads/usersList/${moment().format('YYYYMMDD')}.csv`, csv, (err) => {
                    console.log(err);
                });
                return __.out(res, 201, { csvLink: `uploads/usersList/${moment().format('YYYYMMDD')}.csv` });
            }
        } catch (error) {
            return __.out(res, 300, { error });
        }*/
    /*try {
            let Client = require('ssh2-sftp-client');
            let sftp = new Client();
            let timeStamp = `${moment().format('YYYYMM')}`;
            await sftp.connect({
                host: 'ftp.sats.com.sg',
                port: '22',
                username: 'MySATS_AD_PRD',
                password: 'mySatsprd!23',
                algorithms: {
                    kex: ['diffie-hellman-group14-sha1']
                }
            }).then(() => {
                console.log('connected')
                return sftp.list('/ADWeeklyExtractPRD');
            }).then(async (data) => {
                data = data || [];
                const filteredData = data.filter(v => -1 !== v.name.indexOf(`weeklyMySATS${timeStamp}`));
                for (const d of filteredData) {
                    let daily = d.name;
                    console.log(daily,'daily');
                    await sftp.get(`/ADWeeklyExtractPRD/${daily}`).then(async (fileData) => {
                        console.log('filedata');
                        let writtenFileData = await fs.writeFileSync(`public/${daily}`, fileData);
                    });
                }
                return __.out(res, 201, `successfully fetched ${filteredData.length}`);
            });
        } catch (error) {
            return __.out(res, 201, { data: error })
        }*/
  }
  // Upload social banner image
  async uploadFiles(req, res) {
    try {
      if (!req.file) {
        return __.out(res, 300, `No File is Uploaded`);
      }
      __.out(res, 201, {
        filePath: `uploads/wall/${req.file.filename}`,
      });
      const result = await __.scanFile(
        req.file.filename,
        `public/uploads/wall/${req.file.filename}`,
      );
      if (!!result) {
        //return __.out(res, 300, result);
      }
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  //Creating new category
  async addCategory(req, res) {
    try {
      let alreadyAvailCategory = await WallCategoryModel.findOne({
        wallId: req.body.wallId,
        categoryName: req.body.categoryName,
      }).lean();
      if (!alreadyAvailCategory) {
        let isCategoryAdded = await WallCategoryModel.create({
          wallId: req.body.wallId,
          categoryName: req.body.categoryName,
        });
        if (!isCategoryAdded)
          return __.out(res, 300, 'Error while adding category');

        return __.out(res, 201, 'Category added successfully!');
      }
      return __.out(res, 300, 'Category already exist');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async addWall(req, res) {
    try {
      __.log(req.body, 'add wall');
      let requiredResult = await __.checkRequiredFields(
        req,
        [
          'wallName',
          'displayType',
          'postType',
          'bannerImage',
          'assignUsers',
          'category',
        ],
        'wall',
      );

      if (requiredResult.status == false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      // if (!__.checkSpecialCharacters(req.body, "wall")) {
      //   return __.out(res, 300, `You've entered some excluded special characters`);
      // }
      // Check exist wall name
      let isWallAvail = await SocialWallModel.findOne({
        companyId: req.user.companyId,
        wallName: req.body.name,
        status: {
          $nin: [3],
        },
      }).lean();

      if (isWallAvail) {
        return __.out(res, 300, 'Wall name already exist');
      }

      // insert createdDate at nomination limits
      req.body.maxNomination.createdAt = moment(new Date()).utc().toDate();
      req.body.nominationPerUser.createdAt = moment(new Date()).utc().toDate();

      let insertWall = {
        wallName: req.body.wallName,
        displayType: req.body.displayType,
        postType: req.body.postType,
        isTaskActive: req.body.isTaskActive,
        quickNavEnabled: req.body.quickNavEnabled,
        isNomineeActive: req.body.isNomineeActive,
        bannerImage: req.body.bannerImage,
        assignUsers: req.body.assignUsers,
        companyId: req.user.companyId,
        createdBy: req.user._id,
        status: req.body.status || 1,
        maxNomination: req.body.maxNomination,
        nominationPerUser: req.body.nominationPerUser,
        adminResponse: req.body.adminResponse,
        postAnonymously: req.body.postAnonymously,
      };
      let newWall = await new SocialWallModel(insertWall).save();
      // Create Category & add in wall
      let catList = [];
      let createCategory = async function () {
        for (let elem of req.body.category) {
          let insert = {
            wallId: newWall._id,
            categoryName: elem.categoryName,
          };
          let catData = await new WallCategoryModel(insert).save();
          catList.push(catData._id);
        }
      };

      await createCategory();
      newWall.category = catList;
      await newWall.save();
      return __.out(res, 201, 'Wall Created successfully!');
    } catch (error) {
      return __.out(res, 500, error);
    }
  }

  async updateWall(req, res) {
    try {
      let requiredResult = await __.checkRequiredFields(
        req,
        [
          'wallName',
          'displayType',
          'postType',
          'bannerImage',
          'assignUsers',
          'category',
        ],
        'wall',
      );

      if (requiredResult.status == false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      // if (!__.checkSpecialCharacters(req.body, "wall")) {
      //   return __.out(res, 300, `You've entered some excluded special characters`);
      // }

      let where = {
        _id: req.body.wallId,
        companyId: req.user.companyId,
        assignUsers: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };

      let catList = [];
      let createCategory = async function () {
        for (let elem of req.body.category) {
          __.log(elem);
          if (!elem._id) {
            let update = {
              wallId: req.body.wallId,
              categoryName: elem.categoryName,
            };
            let catData = await new WallCategoryModel(update).save();
            catList.push(catData._id);
          } else {
            let existCat = await WallCategoryModel.findOne({
              _id: elem._id,
              wallId: req.body.wallId,
              status: 1,
            });
            if (existCat) {
              existCat.categoryName = elem.categoryName;
              await existCat.save();
              catList.push(existCat._id);
            }
          }
        }
      };
      await createCategory();
      // Remove Not Listed Categories
      let removeNonCategories = await WallCategoryModel.update(
        {
          _id: {
            $nin: catList,
          },
          wallId: req.body.wallId,
          status: 1,
        },
        {
          $set: {
            status: 3,
          },
        },
        {
          multi: true,
        },
      );

      if (!removeNonCategories)
        return __.out(res, 300, 'Oops something went wrong');

      // check with nomination limit properties
      const wall = await SocialWallModel.findOne({
        companyId: req.user.companyId,
        wallName: req.body.wallName,
        status: 1,
      }).lean();

      if (!!req.body.maxNomination && !!req.body.maxNomination.enabled) {
        if (
          !wall.maxNomination.enabled ||
          (!!wall.maxNomination.enabled &&
            (wall.maxNomination.submissionLimit !=
              req.body.maxNomination.submissionLimit ||
              wall.maxNomination.submissionPeriod !=
                req.body.maxNomination.submissionPeriod))
        ) {
          req.body.maxNomination.createdAt = moment(new Date()).utc().toDate();
        } else {
          req.body.maxNomination.createdAt =
            wall.maxNomination.createdAt || moment(new Date()).utc().toDate();
        }
      }
      if (
        !!req.body.nominationPerUser &&
        !!req.body.nominationPerUser.enabled
      ) {
        if (
          !wall.nominationPerUser.enabled ||
          (!!wall.nominationPerUser.enabled &&
            (wall.nominationPerUser.submissionLimit !=
              req.body.nominationPerUser.submissionLimit ||
              wall.nominationPerUser.submissionPeriod !=
                req.body.nominationPerUser.submissionPeriod))
        ) {
          req.body.nominationPerUser.createdAt = moment(new Date())
            .utc()
            .toDate();
        } else {
          req.body.nominationPerUser.createdAt =
            wall.nominationPerUser.createdAt ||
            moment(new Date()).utc().toDate();
        }
      }

      var wallData = await SocialWallModel.findOneAndUpdate(
        where,
        {
          $set: {
            wallName: req.body.wallName,
            displayType: req.body.displayType,
            postType: req.body.postType,
            isTaskActive: req.body.isTaskActive,
            quickNavEnabled: req.body.quickNavEnabled,
            isNomineeActive: req.body.isNomineeActive,
            bannerImage: req.body.bannerImage,
            category: catList,
            assignUsers: req.body.assignUsers,
            status: req.body.status || 2,
            maxNomination: req.body.maxNomination,
            nominationPerUser: req.body.nominationPerUser,
            adminResponse: !!req.body.adminResponse,
            postAnonymously: !!req.body.postAnonymously,
            nominationOnlyByAdmin: !!req.body.nominationOnlyByAdmin,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      ).lean();
      if (!wallData) return __.out(res, 300, 'Wall not found');

      return __.out(res, 201, 'Updated Successfully!');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async delete(req, res) {
    try {
      let isWallAvail = await SocialWallModel.findOne({
        _id: req.body.wallId,
        companyId: req.user.companyId,
      });
      if (!isWallAvail) {
        return __.out(res, 404, 'Wall not found');
      }
      let isDeleted = await SocialWallModel.update(
        {
          _id: req.body.wallId,
          companyId: req.user.companyId,
        },
        {
          $set: {
            status: 3,
          },
        },
      ).lean();

      if (!isDeleted) return __.out(res, 300, 'Error while removing wall');

      return __.out(res, 201, 'Removed successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async read(req, res, quickNav = false) {
    try {
      let searchQuery = {
        companyId: req.user.companyId,
        $or: [
          {
            wallType: {
              $exists: false,
            },
          },
          {
            wallType: 1,
          },
        ],
        status: {
          $ne: 3, // except deleted
        },
        assignUsers: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      if (quickNav) {
        searchQuery.quickNavEnabled = true;
      }

      let wallList = await SocialWallModel.find(searchQuery)
        .populate({
          path: 'assignUsers.businessUnits',
          select: 'name status sectionId',
          populate: {
            path: 'sectionId',
            select: 'name status departmentId',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name status',
              },
            },
          },
        })
        .populate({
          path: 'assignUsers.appointments',
          select: 'name',
        })
        .populate({
          path: 'assignUsers.subSkillSets',
          select: 'name status',
          match: {
            status: 1,
          },
          populate: {
            path: 'skillSetId',
            select: 'name status',
            match: {
              status: 1,
            },
          },
        })
        .populate({
          path: 'assignUsers.user',
          select: 'name staffId',
        })
        .populate({
          path: 'assignUsers.admin',
          select: 'name staffId',
        })
        .populate({
          path: 'category',
          select: 'categoryName',
        })
        .sort({
          createdAt: -1,
        })
        .lean();
      return __.out(res, 201, wallList);
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async readOne(req, res) {
    try {
      let result = await SocialWallModel.findOne({
        _id: req.body.wallId,
      })
        .populate({
          path: 'category',
          select: 'categoryName',
        })
        .populate({
          path: 'user',
          select: 'name userName profilePicture',
        })
        .lean();

      if (result) return __.out(res, 201, result);

      return __.out(res, 300, 'Record not found');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  // Get all Posts - wall base
  async reportedPosts(req, res) {
    try {
      let pageNum = req.query.start ? parseInt(req.query.start) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum * limit) / limit;
      // User as admin in wall
      let searchQuery = {
        companyId: req.user.companyId,
        status: 1,
        assignUsers: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      let wallIds = await SocialWallModel.find(searchQuery).lean();
      wallIds = wallIds.map((v) => {
        return mongoose.Types.ObjectId(v._id);
      });
      let query = {
        reportCount: {
          $nin: [0],
        },
        'wallId._id': {
          $in: wallIds,
        },
        status: {
          $in: [1, 2],
        },
      };

      var isSearched = false;
      if (req.query.search.value) {
        isSearched = true;
        query['$or'] = [
          {
            title: {
              $regex: `${req.query.search.value}`,
              $options: 'i',
            },
          },
          {
            'wallId.wallName': {
              $regex: `${req.query.search.value}`,
              $options: 'i',
            },
          },
        ];
      }

      let sort = {};
      if (req.query.order) {
        let orderData = req.query.order;
        for (let i = 0; i < orderData.length; i++) {
          switch (orderData[i].column) {
            case '0':
              sort[`title`] = getSort(orderData[i].dir);
              break;
            case '1':
              sort[`wallId.wallName`] = getSort(orderData[i].dir);
              break;
            case '2':
              sort[`createdAt`] = getSort(orderData[i].dir);
              break;
            default:
              sort[`status`] = getSort(orderData[i].dir);
              break;
          }
        }
      }

      function getSort(val) {
        if (val === 'asc') return 1;
        else return -1;
      }

      let postList = await WallPost.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
          },
        },
        {
          $unwind: '$author',
        },
        {
          $lookup: {
            from: 'walls',
            localField: 'wallId',
            foreignField: '_id',
            as: 'wallId',
          },
        },
        {
          $unwind: '$wallId',
        },
        {
          $match: query,
        },
        {
          $sort: sort,
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]);

      // Get all post ids
      let postIds = postList.map((v) => v._id);
      const reportUsers = await ReportPostModel.find({
        postId: {
          $in: postIds,
        },
      })
        .populate({
          path: 'userId',
          select: 'name userName profilePicture',
        })
        .lean();
      postList = postList.map((p) => {
        p['userList'] = reportUsers.filter(
          (v) => p._id.toString() == v.postId.toString(),
        );
        return p;
      });

      let totalCount;
      let totalUserCount = await WallPost.count({
        reportCount: {
          $nin: [0],
        },
        wallId: {
          $in: wallIds,
        },
        status: {
          $in: [1, 2],
        },
      }).lean();
      if (isSearched) {
        totalCount = await WallPost.aggregate([
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'author',
            },
          },
          {
            $unwind: '$author',
          },
          {
            $lookup: {
              from: 'walls',
              localField: 'wallId',
              foreignField: '_id',
              as: 'wallId',
            },
          },
          {
            $unwind: '$wallId',
          },
          {
            $match: query,
          },
        ]);
        totalCount = totalCount.length;
      } else {
        totalCount = totalUserCount;
      }

      let result = {
        draw: req.query.draw || 0,
        recordsTotal: totalUserCount || 0,
        recordsFiltered: totalCount || 0,
        data: postList,
      };
      return res.status(201).json(result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // Get all Posts - wall base
  async reportedComments(req, res) {
    try {
      let pageNum = req.query.start ? parseInt(req.query.start) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum * limit) / limit;
      // User as admin in wall
      let searchQuery = {
        companyId: req.user.companyId,
        status: 1,
        assignUsers: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      let wallIds = await SocialWallModel.find(searchQuery).lean();
      wallIds = wallIds.map((v) => {
        return mongoose.Types.ObjectId(v._id);
      });

      let query = {
        reportCount: {
          $nin: [0],
        },
        'wallId._id': {
          $in: wallIds,
        },
        status: {
          $in: [1, 2],
        },
      };

      var isSearched = false;
      if (req.query.search.value) {
        isSearched = true;
        query['$or'] = [
          {
            comment: {
              $regex: `${req.query.search.value}`,
              $options: 'i',
            },
          },
          {
            'postId.title': {
              $regex: `${req.query.search.value}`,
              $options: 'i',
            },
          },
          {
            'wallId.wallName': {
              $regex: `${req.query.search.value}`,
              $options: 'i',
            },
          },
        ];
      }

      let sort = {};
      if (req.query.order) {
        let orderData = req.query.order;
        for (let i = 0; i < orderData.length; i++) {
          switch (orderData[i].column) {
            case '0':
              sort[`comment`] = getSort(orderData[i].dir);
              break;
            case '1':
              sort[`postId.title`] = getSort(orderData[i].dir);
              break;
            case '2':
              sort[`wallId.wallName`] = getSort(orderData[i].dir);
              break;
            case '3':
              sort[`createdAt`] = getSort(orderData[i].dir);
              break;
            default:
              sort[`status`] = getSort(orderData[i].dir);
              break;
          }
        }
      }

      function getSort(val) {
        if (val === 'asc') return 1;
        else return -1;
      }

      let commentList = await WallComment.aggregate([
        {
          $lookup: {
            from: 'walls',
            localField: 'wallId',
            foreignField: '_id',
            as: 'wallId',
          },
        },
        {
          $unwind: '$wallId',
        },
        {
          $lookup: {
            from: 'wallposts',
            localField: 'postId',
            foreignField: '_id',
            as: 'postId',
          },
        },
        {
          $unwind: '$postId',
        },
        {
          $match: query,
        },
        {
          $sort: sort,
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]);

      // Get all post ids
      let commentIds = commentList.map((v) => v._id);
      const reportUsers = await ReportCommentModel.find({
        commentId: {
          $in: commentIds,
        },
      })
        .populate({
          path: 'userId',
          select: 'name userName profilePicture',
        })
        .lean();
      commentList = commentList.map((p) => {
        p['userList'] = reportUsers.filter(
          (v) => p._id.toString() == v.commentId.toString(),
        );
        return p;
      });

      let totalCount;
      let totalUserCount = await WallComment.count({
        reportCount: {
          $nin: [0],
        },
        wallId: {
          $in: wallIds,
        },
        status: {
          $in: [1, 2],
        },
      }).lean();
      if (isSearched) {
        totalCount = await WallComment.aggregate([
          {
            $lookup: {
              from: 'walls',
              localField: 'wallId',
              foreignField: '_id',
              as: 'wallId',
            },
          },
          {
            $unwind: '$wallId',
          },
          {
            $lookup: {
              from: 'wallposts',
              localField: 'postId',
              foreignField: '_id',
              as: 'postId',
            },
          },
          {
            $unwind: '$postId',
          },
          {
            $match: query,
          },
        ]);
        totalCount = totalCount.length;
      } else {
        totalCount = totalUserCount;
      }

      let result = {
        draw: req.query.draw || 0,
        recordsTotal: totalUserCount || 0,
        recordsFiltered: totalCount || 0,
        data: commentList,
      };
      return res.status(201).json(result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // Get all Posts - wall base
  async reviewPost(req, res) {
    try {
      let requiredResult = await __.checkRequiredFields(req, [
        'postId',
        'status',
      ]);
      if (requiredResult.status == false)
        return __.out(res, 400, requiredResult.missingFields);

      let isUpdated = await WallPost.update(
        {
          _id: req.body.postId,
        },
        {
          $set: {
            status: req.body.status,
          },
        },
      ).lean();

      if (!isUpdated)
        return __.out(res, 300, 'Oops error while updating status');

      return __.out(res, 201, 'Updated successfully');
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async viewComments(req, res) {
    try {
      let pageNum = req.query.start ? parseInt(req.query.start) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum * limit) / limit;
      // User as admin in wall
      let wallQuery = {
        companyId: req.user.companyId,
        status: 1,
        assignUsers: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      let wallIds = await SocialWallModel.find(wallQuery).lean();
      wallIds = wallIds.map((v) => {
        return mongoose.Types.ObjectId(v._id);
      });

      // Admin's posts
      let postIds = await WallPost.find({
        // wallId: {
        //     $in: wallIds
        // },
        status: 1,
      }).lean();
      postIds = postIds.map((v) => {
        return v._id;
      });

      let searchQuery = {
        reportCount: {
          $gt: 0,
        },
        postId: {
          $in: postIds,
        },
        status: {
          $in: [1, 2],
        },
      };

      var isSearched = false;
      if (req.query.search.value) {
        isSearched = true;
        searchQuery['$or'] = [
          {
            comment: {
              $regex: `${req.query.search.value}`,
              $options: 'i',
            },
          },
        ];
      }

      let populateArray = [
        {
          path: 'userId',
          select: 'name _id',
        },
        {
          path: 'postId',
          select: 'title _id',
        },
        {
          path: 'wallId',
          select: 'wallName _id',
        },
      ];

      let postComments = await WallComment.find(searchQuery)
        .populate(populateArray)
        .skip(skip)
        .limit(limit)
        .lean();

      let totalComments = await WallComment.count(searchQuery).lean();

      let totalCount = 0;

      if (isSearched)
        totalCount = await WallComment.count({
          reportCount: {
            $gt: 0,
          },
          postId: {
            $in: postIds,
          },
          status: {
            $in: [1, 2],
          },
        }).lean();
      else totalCount = totalComments;

      return res.status(201).json({
        draw: req.query.draw || 0,
        recordsTotal: totalComments || 0,
        recordsFiltered: totalCount || 0,
        data: postComments,
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async updateStatus(req, res) {
    try {
      let requiredResult = await __.checkRequiredFields(req, [
        'commentId',
        'status',
      ]);
      if (requiredResult.status == false)
        return __.out(res, 400, requiredResult.missingFields);

      let isUpdated = await WallComment.update(
        {
          _id: req.body.commentId,
        },
        {
          $set: {
            status: req.body.status,
          },
        },
      ).lean();

      if (!isUpdated)
        return __.out(res, 300, 'Oops error while updating status');

      let incCount = -1;
      if (req.body.status == 1) {
        incCount = 1;
      }

      let isCountUpdated = await WallPost.update(
        {
          _id: isUpdated.postId,
        },
        {
          $set: {
            $inc: {
              commentCount: incCount,
            },
          },
        },
      ).lean();

      if (!isCountUpdated)
        return __.out(res, 300, 'Oops error while updating status');

      return __.out(res, 201, 'Updated successfully');
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  // Export the Wallpost..
  async exportWallPost(req, res) {
    try {
      const wallPostDetails = await WallPost.findById(req.body._id)
        .populate([
          {
            path: 'moduleId',
            select: 'moduleName questions',
            populate: {
              path: 'questions',
            },
          },
          {
            path: 'wallId',
            select: 'assignUsers createdBy',
          },
        ])
        .select('title description moduleId wallId')
        .lean();
      const questions = wallPostDetails.moduleId.questions;
      const users = await __.wallUsersList(wallPostDetails.wallId);
      const userDetails = await User.find({
        _id: {
          $in: users,
        },
      })
        .populate([
          {
            path: 'appointmentId',
            select: 'name',
          },
          {
            path: 'parentBussinessUnitId',
            select: 'name',
            match: {
              status: 1,
            },
            populate: {
              path: 'sectionId',
              select: 'name',
              populate: {
                path: 'departmentId',
                select: 'name',
                match: {
                  status: 1,
                },
                populate: {
                  path: 'companyId',
                  select: 'name',
                  match: {
                    status: 1,
                  },
                },
              },
            },
          },
        ])
        .select(
          'name staffId email appointmentId contactNumber parentBussinessUnitId',
        )
        .lean();
      const questionResponses = await QuestionResponse.find({
        userId: {
          $in: users || [],
        },
        wallPostId: wallPostDetails._id,
      }).lean();
      if (!!questionResponses && questionResponses.length) {
      } else {
        return __.out(res, 300, 'No data found');
      }
      let headers = questions.map((qestion, i) => `Q-${i}`);
      let rows = [];
      const getOptionValue = (question, response) => {
        if (question.type === 11) {
          return response.answer;
        }
        if (!!response.answer) {
          if (Array.isArray(response.answer)) {
            if (response.answer.length === 1) {
              return response.answer[0].value;
            }
            return response.answer.map((answer) => answer.value).join(',');
          } else {
            return response.answer.value;
          }
        }
        const index = question.options.findIndex(
          (opt) => opt._id.toString() === response.option.toString(),
        );
        if (-1 !== index) {
          return question.options[index].value;
        }
        return '--';
      };
      const getAnswer = (question, response) => {
        let answer = null;
        switch (question.type) {
          case 1:
          case 8:
          case 9:
          case 13:
            answer = response.answer;
            break;
          case 2:
          case 3:
          case 4:
          case 11:
            answer = getOptionValue(question, response);
            break;
          case 5:
          case 15:
            answer = Array.isArray(response.answer)
              ? response.answer.map((a) => a.value).join(', ')
              : getOptionValue(question, response);
            break;
          case 6:
            answer = '';
            break;
          case 10:
            answer =
              (response.answer.date || '') + ' ' + (response.answer.time || '');
            break;
          case 12:
            answer = response.answer.name;
            break;
          case 14:
            answer = response.answer.reduce(
              (prev, curr, i) => (prev = prev + ', ' + curr.text),
              '',
            );
            break;
          // response.answer = `${response.answer || ''}`.startsWith(`data:image/png;base64,`) ? response.answer : `data:image/png;base64,${response.answer}`;
          // answer = `<img src="${response.answer}" width="100" height="auto" />`; break;
          default:
            break;
        }
        return !!answer ? answer : '--';
      };
      const userBasesResponses = questionResponses.reduce((prev, curr, i) => {
        prev[curr.userId] = prev[curr.userId] || [];
        prev[curr.userId].push(curr);
        return prev;
      }, {});
      const getQuestionAndAnswer = (userResponse) => {
        if (userResponse.length) {
          let output = questions.reduce((prev, question, i) => {
            const index = userResponse.findIndex(
              (questionResponse) =>
                questionResponse.questionId.toString() ===
                question._id.toString(),
            );
            prev[`Q-${i}`] =
              -1 === index ? '--' : getAnswer(question, userResponse[index]);
            return prev;
          }, {});
          const user = userDetails.find(
            (u) => u._id.toString() === userResponse[0].userId.toString(),
          );
          if (!!!user) {
            return {};
          }
          output['staffId'] = user.staffId;
          output[
            'businessUnit'
          ] = `${user.parentBussinessUnitId.sectionId.departmentId.companyId.name} > ${user.parentBussinessUnitId.sectionId.departmentId.name} > ${user.parentBussinessUnitId.sectionId.name} > ${user.parentBussinessUnitId.name}`;
          const data = questions.filter((question) => question.type === 7);
          if (data.length) {
            const profile = data[0].profile;
            const internalQuestions = profile.map((iq) =>
              iq.questionName.toLowerCase(),
            );
            internalQuestions.forEach((element) => {
              switch (element) {
                case 'username':
                  output[element] = user.name;
                  headers = [element, ...headers];
                  break;
                case 'appointment':
                  output[element] = user.appointmentId.name;
                  headers = [element, ...headers];
                  break;
                case 'mobile':
                  output[element] = user.contactNumber;
                  headers = [element, ...headers];
                  break;
                case 'email':
                  output[element] = user.email;
                  headers = [element, ...headers];
                  break;
                default:
                  break;
              }
            });
          }
          const set = new Set(['staffId', 'businessUnit', ...headers]);
          headers = Array.from(set);
          return output;
        }
        return {};
      };
      for (const user in userBasesResponses) {
        if (userBasesResponses.hasOwnProperty(user)) {
          const element = userBasesResponses[user];
          rows[rows.length] = getQuestionAndAnswer(element);
        }
      }
      if (rows.length) {
        let csv = json2csv({
          data: rows,
          fields: headers,
        });
        fs.writeFile(
          `./public/uploads/Postexport/${wallPostDetails._id}.csv`,
          csv,
          (err) => {
            if (err) {
              __.log('json2csv err', err);
              return __.out(res, 300, 'Something went wrong try later');
            } else {
              return __.out(res, 201, {
                csvLink: `uploads/Postexport/${wallPostDetails._id}.csv`,
              });
            }
          },
        );
      } else {
        return __.out(res, 300, 'Something went wrong try later');
      }
    } catch (error) {
      console.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Get all Posts - wall base
  async getWallPostsList(req, res) {
    try {
      let pageNum = req.query.start ? parseInt(req.query.start) : 0;
      let limit = req.query.length ? parseInt(req.query.length) : 10;
      let skip = req.query.skip
        ? parseInt(req.query.skip)
        : (pageNum * limit) / limit;
      // User as admin in wall
      let searchQuery = {
        companyId: req.user.companyId,
        status: 1,
        assignUsers: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      let wallIds = await SocialWallModel.find(searchQuery).lean();
      wallIds = wallIds.map((v) => {
        return mongoose.Types.ObjectId(v._id);
      });

      let query = {
        'wallId._id': {
          $in: wallIds,
        },
        status: {
          $in: [1],
        },
        moduleIncluded: true,
      };

      var isSearched = false;
      if (req.query.search.value) {
        isSearched = true;
        query['$or'] = [
          {
            title: {
              $regex: `${req.query.search.value}`,
              $options: 'i',
            },
          },
          {
            'wallId.wallName': {
              $regex: `${req.query.search.value}`,
              $options: 'i',
            },
          },
        ];
      }

      let sort = {};
      if (req.query.order) {
        let orderData = req.query.order;
        for (let i = 0; i < orderData.length; i++) {
          switch (orderData[i].column) {
            case '0':
              sort[`title`] = getSort(orderData[i].dir);
              break;
            case '1':
              sort[`wallId.wallName`] = getSort(orderData[i].dir);
              break;
            case '2':
              sort[`createdAt`] = getSort(orderData[i].dir);
              break;
            default:
              sort[`status`] = getSort(orderData[i].dir);
              break;
          }
        }
      }

      function getSort(val) {
        if (val === 'asc') return 1;
        else return -1;
      }

      let postList = await WallPost.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
          },
        },
        {
          $unwind: '$author',
        },
        {
          $lookup: {
            from: 'walls',
            localField: 'wallId',
            foreignField: '_id',
            as: 'wallId',
          },
        },
        {
          $unwind: '$wallId',
        },
        {
          $match: query,
        },
        {
          $sort: sort,
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]);

      let totalCount;
      let totalUserCount = await WallPost.count({
        wallId: {
          $in: wallIds,
        },
        status: {
          $in: [1],
        },
        moduleIncluded: true,
      }).lean();
      if (isSearched) {
        totalCount = await WallPost.aggregate([
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'author',
            },
          },
          {
            $unwind: '$author',
          },
          {
            $lookup: {
              from: 'walls',
              localField: 'wallId',
              foreignField: '_id',
              as: 'wallId',
            },
          },
          {
            $unwind: '$wallId',
          },
          {
            $match: query,
          },
        ]);
        totalCount = totalCount.length;
      } else {
        totalCount = totalUserCount;
      }

      let result = {
        draw: req.query.draw || 0,
        recordsTotal: totalUserCount || 0,
        recordsFiltered: totalCount || 0,
        data: postList,
      };
      return res.status(201).json(result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getCompanyWalls(req, res) {
    try {
      const walls = await SocialWallModel.find({
        status: 1,
        companyId: req.user.companyId,
      })
        .select('wallName')
        .lean();
      return __.out(res, 201, walls);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}

module.exports = new SocialWall();
