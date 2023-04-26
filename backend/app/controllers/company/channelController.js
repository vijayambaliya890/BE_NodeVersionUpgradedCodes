// Controller Code Starts here
const mongoose = require('mongoose'),
  Channel = require('../../models/channel'),
  User = require('../../models/user'),
  SubSection = require('../../models/subSection'),
  PostCategory = require('../../models/postCategory'),
  Post = require('../../models/post'),
  PostView = require('../../models/wallPostView'),
  PostLike = require('../../models/channelPostLike'),
  PostComment = require('../../models/channelPostComment'),
  __ = require('../../../helpers/globalFunctions');
var moment = require('moment');
var fs = require('fs');
const path = require('path');
const ObjectsToCsv = require('objects-to-csv');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class channel {
  async exportReport(req, res) {
    try {
      console.log('req.body.channelId', req.body.channelId);
      const startDate = new Date(
        moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z').utc().format(),
      );
      const endDate = new Date(
        moment(req.body.endDate, 'MM-DD-YYYY HH:mm:ss Z').utc().format(),
      );
      function daysInMonth(month, year) {
        return new Date(year, month, 0).getDate();
      }
      var firstDay = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      var lastDay = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        daysInMonth(endDate.getMonth() + 1, endDate.getFullYear()),
      );
      //return res.json({startDate:firstDay, endDate:lastDay})
      const channelData = await Channel.findById(req.body.channelId, {
        name: 1,
        companyId: 1,
      }).populate([
        {
          path: 'companyId',
          select: 'name',
        },
        {
          path: 'userDetails.businessUnits',
          select: 'name',
          model: 'SubSection',
          populate: {
            path: 'sectionId',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'departmentId',
              select: 'name status',
              match: {
                status: 1,
              },
            },
          },
        },
      ]);
      const postData = await Post.find(
        { channelId: req.body.channelId },
        { _id: 1, teaser: 1, publishing: 1, status: 1, createdAt: 1 },
      ).lean();
      //console.log('postData', postData);
      let postId = [];
      let keys = [
        'Name of channel',
        'Teaser Title',
        'Status of Article',
        'Article Creation Date',
        'Company',
        'Department',
        'Month of (count of postviews) ',
        'Year of (count of postviews)',
        'Count of __V (Postviews)',
      ];
      if (channelData && postData && postData.length > 0) {
        postData.forEach((item) => {
          postId.push(item._id);
        });
        let reportData = [];
        if (req.body.type == 'view') {
          reportData = await PostView.aggregate([
            {
              $match: {
                postId: { $in: postId },
                createdAt: {
                  $gte: new Date(new Date(firstDay).toISOString()),
                  $lte: new Date(new Date(lastDay).toISOString()),
                },
              },
            },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user',
              },
            },
            {
              $unwind: '$user',
            },
            {
              $group: {
                _id: {
                  postId: '$postId',
                  buId: '$user.parentBussinessUnitId',
                  year: {
                    $year: '$createdAt',
                  },
                  month: {
                    $month: '$createdAt',
                  },
                },
                count: { $sum: 1 },
              },
            },
          ]); //{postId:{$in:postId}}, {postId:1}
        } else if (req.body.type == 'like') {
          //reportData = await PostLike.find({postId:{$in:postId}});
          reportData = await PostLike.aggregate([
            {
              $match: {
                postId: { $in: postId },
                isLiked: true,
                createdAt: {
                  $gte: new Date(new Date(firstDay).toISOString()),
                  $lte: new Date(new Date(lastDay).toISOString()),
                },
              },
            },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user',
              },
            },
            {
              $unwind: '$user',
            },
            {
              $group: {
                _id: {
                  postId: '$postId',
                  buId: '$user.parentBussinessUnitId',
                  year: {
                    $year: '$createdAt',
                  },
                  month: {
                    $month: '$createdAt',
                  },
                },
                count: { $sum: 1 },
              },
            },
          ]);
          keys[6] = 'Month of (count of postlikes) ';
          keys[7] = 'Year of (count of postlikes)';
          keys[8] = 'Count of __V (postlikes)';
        } else if (req.body.type == 'comment') {
          //console.log('heree');
          //reportData = await PostComment.find({postId:{$in:postId}});
          console.log(
            'new Date(new Date(firstDay).toISOString()',
            new Date(new Date(firstDay).toISOString()),
          );
          reportData = await PostComment.aggregate([
            {
              $match: {
                postId: { $in: postId },
                createdAt: {
                  $gte: new Date(new Date(firstDay).toISOString()),
                  $lte: new Date(new Date(lastDay).toISOString()),
                },
              },
            },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user',
              },
            },
            {
              $unwind: '$user',
            },
            {
              $group: {
                _id: {
                  postId: '$postId',
                  buId: '$user.parentBussinessUnitId',
                  year: {
                    $year: '$createdAt',
                  },
                  month: {
                    $month: '$createdAt',
                  },
                },
                count: { $sum: 1 },
              },
            },
          ]);
          keys[6] = 'Month of (count of postcomments) ';
          keys[7] = 'Year of (count of postcomments)';
          // keys[6] = 'Month of createdAt (postcomments)';
          //keys[7]='Year of createdAt (postcomments)';
          keys[8] = 'Count of __V (postcomments)';
        }
        //return res.json({channelData})
        if (reportData && reportData.length > 0) {
          //const keys = ['Name of channel', 'Teaser Title', 'Status of Article', 'Article Creation Date', 'Company',
          //'Department', 'Month of createdAt (postviews)','Year of createdAt (postviews)', 'Count of __V (Postviews)'];
          function removeTags(str) {
            if (str === null || str === '') return '';
            else str = str.toString();
            return str.replace(/(<([^>]+)>)/gi, '');
          }
          let csvData = [];
          let buData = [];
          channelData.userDetails.forEach((item) => {
            // console.log('aaa', item)
            buData = buData.concat(item.businessUnits);
          });
          //console.log(buData)
          var months = [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December',
          ];
          for (let i = 0; i < reportData.length; i++) {
            let item = reportData[i];
            let obj = {};
            let postObj = postData.filter((pd) => {
              if (pd._id && item._id && item._id.postId) {
                return pd._id.toString() == item._id.postId.toString();
              }
            });

            let buObj = buData.filter((bu) => {
              if (bu._id && item._id && item._id.buId) {
                return bu._id.toString() == item._id.buId.toString();
              }
            });
            if (postObj.length > 0 && buObj.length > 0) {
              postObj = postObj[0];
              buObj = buObj[0];
              console.log('aaaaa');
              obj['Name of channel'] = channelData.name;
              console.log('bbbb');
              obj['Teaser Title'] = removeTags(postObj.teaser.title);

              let status = '';
              switch (postObj.status) {
                case 2:
                  status = 'Draft';
                  break;
                case 0:
                  status = 'In Active';
                  break;
                case 1:
                  if (postObj.publishing) {
                    if (moment() < moment(postObj.publishing.startDate)) {
                      status = 'Pending Publication';
                    } else if (moment() > moment(postObj.publishing.endDate)) {
                      status = 'Expired';
                    } else if (moment() < moment(postObj.publishing.endDate)) {
                      status = 'Published';
                    }
                  } else {
                    status = 'In Active';
                  }
                  break;
                default:
                  break;
              }
              obj['Status of Article'] = status;
              obj['Article Creation Date'] = moment(postObj.createdAt).format(
                'DD-MMM-YYYY',
              );
              obj['Company'] = channelData.companyId.name;
              if (buObj) {
                obj['Department'] = buObj.sectionId.departmentId.name;
              } else {
                obj['Department'] = '';
              }
              //  console.log('postObj._id.month', postObj._id.Month)
              obj[keys[6]] = months[item._id.month - 1];
              obj[keys[7]] = item._id.year;
              obj[keys[8]] = item.count;
              csvData.push(obj);
            }
          }
          var dir = path.join(
            __dirname + '/../../../public/uploads/challenge/report',
          );
          console.log('dir', dir);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          var fileName = '/' + new Date().getTime() + '.csv';
          dir = dir + fileName;
          const csv = new ObjectsToCsv(csvData);
          await csv.toDisk(dir);
          return res.json({
            status: true,
            filePath: 'uploads/challenge/report' + fileName,
          });
          /*json2csv({data: csvData, fields: keys}, function(err, csv) {
                    if (err) console.log(err);
                // console.log(csv);
                //  res.send(csv);
                //  fs.writeFile('file.csv', csv, function(err) {
                //      if (err) throw err;
                //      console.log('file saved');
                //  });
                    console.log('ashish file')
                    res.setHeader('Content-disposition', 'attachment; filename=testing.csv');
                    res.set('Content-Type', 'application/csv');
                    res.status(200).send(csv);
                });*/
        } else {
          return res.status(400).json({
            success: false,
            error: {
              message: 'No data found',
            },
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: {
            message: 'No data found',
          },
        });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async create(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'name',
        'category',
        'assignUsers',
      ]);
      if (!requiredResult.status) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      let channelExists = await Channel.findOne({
        name: req.body.name,
        companyId: req.user.companyId,
        status: {
          $ne: 3,
        },
      });
      if (channelExists) {
        return __.out(res, 300, 'Channel Name Already Exists');
      }
      let userData = await User.findOne({companyId: req.user.companyId , staffId : 'admin001'}, {_id : 1});
      req.body.assignUsers.forEach((m, index) => {
        req.body.assignUsers[index].authors = [];
        req.body.assignUsers[index].authors = req.body.assignUsers[index].user;
        req.body.assignUsers[index].admin.push(userData._id);
      });
      let insertChannel = {
        name: req.body.name,
        userDetails: req.body.assignUsers,
        companyId: req.user.companyId,
        status: req.body.status,
        createdBy: req.user._id,
      };
      let newChannel = await new Channel(insertChannel).save();
      if (!newChannel) {
        return __.out(res, 301, 'Error while creating channel');
      }
      let createCategory = async function () {
        for (let elem of req.body.category) {
          let insert = {
            name: elem.name,
            channelId: newChannel._id,
          };
          await new PostCategory(insert).save();
        }
      };
      await createCategory();
      return __.out(res, 200, 'Channel Created');
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
      let requiredResult = await __.checkRequiredFields(req, [
        'name',
        'category',
        'assignUsers',
        'status',
      ]);
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      let channelExists = await Channel.findOne({
        _id: {
          $ne: req.params.channelId,
        },
        name: req.body.name,
        companyId: req.user.companyId,
        status: {
          $nin: [3],
        },
      });
      if (channelExists) {
        return __.out(res, 300, 'Channel Name Already Exists');
      }
      let channelData = await Channel.findOne({
        _id: req.params.channelId,
        companyId: req.user.companyId,
        userDetails: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      });

      if (!channelData) {
        return __.out(res, 300, 'Channel Not Found');
      }

      /******** GET businessUnitIds,exclusionAppointmentIds,authors **********/
      // await getUserDetails();
      /******** End GET businessUnitIds,exclusionAppointmentIds,authors **********/
      // Create Channel
      req.body.assignUsers.forEach((m, index) => {
        req.body.assignUsers[index].authors = [];
        req.body.assignUsers[index].authors = req.body.assignUsers[index].user;
      });
      channelData.name = req.body.name;
      channelData.userDetails = req.body.assignUsers;
      channelData.status = req.body.status;
      let updatedChannel = await channelData.save();
      let existingCatIds = [];
      let updateCategory = async function () {
        for (let elem of req.body.category) {
          if (!elem._id) {
            let insert = {
              name: elem.name,
              channelId: updatedChannel._id,
              status: req.body.status,
            };
            __.log(insert);
            let newCat = await new PostCategory(insert).save();
            existingCatIds.push(newCat._id);
          } else {
            let existCat = await PostCategory.findOne({
              _id: elem._id,
              channelId: updatedChannel._id,
            });
            if (existCat) {
              existCat.name = elem.name;
              await existCat.save();
              existingCatIds.push(elem._id);
            }
          }
        }
      };
      await updateCategory();
      // Remove Not Listed Categories
      await PostCategory.update(
        {
          _id: {
            $nin: existingCatIds,
          },
          channelId: updatedChannel._id,
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
      return __.out(res, 200, 'Channel Updated');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async remove(req, res) {
    try {
      let where = {
        _id: req.params.channelId,
        companyId: req.user.companyId,
        status: {
          $nin: [3],
        },
      };
      var removedChannel = await Channel.findOneAndUpdate(
        where,
        {
          $set: {
            status: 3,
          },
        },
        {
          new: true,
        },
      ).lean();

      if (!removedChannel) {
        return __.out(res, 300, 'Channel Not Found');
      }
      return __.out(res, 201, 'Channel deleted');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async readOne(req, res) {
    try {
      logInfo('ChannelController:read', {
        userId: req.user._id,
        channelId: req.params.channelId,
      });
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let where = {
        _id: req.params.channelId,
        companyId: req.user.companyId,
        status: {
          $nin: [3],
        },
      };
      var channelData = await Channel.findOne(
        where,
        'orgName, name status userDetails.authors, userDetails.customField userDetails.buFilterType userDetails.subSkillSets userDetails.allBuToken userDetails.allBuTokenStaffId',
      )
        .populate({
          path: 'userDetails.businessUnits',
          strictPopulate: false,
          select: 'orgName name status sectionId',
        })
        .populate({
          path: 'userDetails.appointments',
          strictPopulate: false,
          select: 'name status',
        })
        .populate({
          path: 'userDetails.subSkillSets',
          strictPopulate: false,
          select: 'name status',
          populate: { //this populate has been requested from frontEnd team , so did so
            path: 'skillSetId',
            select: '_id name',
        }
        })
        .populate({
          path: 'userDetails.authors',
          strictPopulate: false,
          select: 'name staffId',
        })
        .populate({
          path: 'userDetails.admin',
          strictPopulate: false,
          select: 'name staffId',
        });
      if (!channelData) {
        return __.out(res, 300, 'Channel Not Found');
      }
      // if (typeof channelData == 'object' && channelData.userDetails) {
      //   channelData.businessUnitDetails = [];
      //   channelData.adminDetails = [];
      //   channelData.authorDetails = [];
      //   channelData.assignUsers = channelData.userDetails;
      //   for (let i = 0; i < channelData.userDetails.length; ++i) {
      //     let user = channelData.userDetails[i];
      //     if (user.businessUnits) {
      //       for (let j = 0; j < user.businessUnits.length; ++j) {
      //         let businessUnit = user.businessUnits[j];
      //         let details = await SubSection.findById(businessUnit, 'name');
      //         channelData.businessUnitDetails.push(details);
      //         console.log({ details });
      //       }
      //     }
      //     if (user.admin) {
      //       for (let j = 0; j < user.admin.length; ++j) {
      //         let adminuser = user.admin[j];
      //         let details = await User.findById(adminuser, 'name staffId');
      //         if (channelData.adminDetails.indexOf(details) < 0)
      //           channelData.adminDetails.push(details);
      //       }
      //     }
      //     if (user.authors) {
      //       for (let j = 0; j < user.authors.length; ++j) {
      //         let author = user.authors[j];
      //         let details = await User.findById(author, 'name staffId');
      //         if (channelData.authorDetails.indexOf(details) < 0)
      //           channelData.authorDetails.push(details);
      //         console.log({ details });
      //       }
      //     }
      //   }
      // }
      let AssignUsers = [];

      if (channelData.userDetails) {
        channelData.userDetails.forEach((e) => {
          let BU = [];
          e.businessUnits.forEach((k) => {
            let _id = k._id;
            let obj = {
              _id: _id,
              name: k.orgName,
            };
            BU.push(obj);
          });
          let appointments = e.appointments;
          let user = e.authors;
          let admin = e.admin;
          let customField = e.customField;
          let buFilterType = e.buFilterType;
          let subSkillSets = e.subSkillSets;
          let allBuToken = e.allBuToken;
          let allBuTokenStaffId = e.allBuTokenStaffId;

          let obj1 = {
            businessUnits: BU,
            buFilterType: buFilterType,
            appointments: appointments,
            subSkillSets: subSkillSets,
            user: user,
            admin: admin,
            allBuToken: allBuToken,
            allBuTokenStaffId: allBuTokenStaffId,
            customField: customField,
          };
          AssignUsers.push(obj1);
        });
      }

      // Add Category List
      let categoryList = await PostCategory.find({
        channelId: channelData._id,
        status: 1,
      });
      let data = {
        _id: channelData._id,
        name: channelData.name,
        status: channelData.status,
        assignUsers: AssignUsers,
        category: categoryList,
      };
      return res.json({ data: data });
    } catch (err) {
      logError('ChannelController:read', {
        userId: req.user._id,
        channelId: req.params.channelId,
        err,
        stack: err.stack,
      });
      return __.out(res, 500, err);
    }
  }

  async read(req, res) {
    try {
      logInfo('ChannelController:read', { userId: req.user._id });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let where = {
        companyId: req.user.companyId,
        status: {
          $nin: [3],
        },
        userDetails: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      const { sortWith, sortBy, page, limit, search } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      if (search) {
        where.$or = [
          {
            name: {
              $regex: req.query.search,
              $options: 'i',
            },
          },
        ];
      }
      let sort = {};

      if (sortWith) {
        sort = { [sortWith]: 'asc' === sortBy ? 1 : -1 };
      }
      const allCalls = [
        Channel.find(where, { name: 1, status: 1 })
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Channel.count(where),
      ];
      let [channels, recordsTotal, recordsFiltered] = await Promise.all(
        allCalls,
      );
      let d = { recordsTotal, data: channels };
      return res.status(200).json(d);
    } catch (err) {
      logError('ChannelController:read', {
        userId: req.user._id,
        err,
        stack: err.stack,
      });
      return __.out(res, 500, err);
    }
  }

  async getChannelsForAdmin(req, res) {
    try {
      let where = {
        companyId: req.user.companyId,
        status: {
          $in: [1],
        },
        userDetails: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      var channelList = await Channel.find(where).select('_id name').lean();

      // Make Category Inside Channel
      let getCat = async function () {
        let count = 0;
        for (let elem of channelList) {
          let cat = await PostCategory.find({
            channelId: elem._id,
            status: 1,
          })
            .select('_id name')
            .lean();
          channelList[count].categoryList = cat;
          count++;
        }
      };
      await getCat();
      return __.out(res, 201, channelList);
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async readOneChannel(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let where = {
        _id: req.body.channelId,
        companyId: req.user.companyId,
        status: {
          $nin: [3],
        },
      };
      var channelData = await Channel.findOne(where);
      /*   channelData.userDetails.forEach(function (value, i) {
                   console.log('value.businessUnits', value.businessUnits);
                   let data = value.businessUnits.filter(a => a == req.body.buId)
                   console.log(value)
                   if(data.length){
                     return  channelData.userDetails = value
                   }
               });*/
      // return __.out(res, 201, channelData);
      if (channelData && channelData.userDetails) {
        let userList = await this.channelUsersListFastThird(
          channelData,
          'data',
          req.body.page,
          req.body.name,
        );
        return __.out(res, 201, userList);
      } else {
        return __.out(res, 201, []);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }
  async channelUsersListFastThird(
    channelData,
    responseType = 'id',
    page = 0,
    name = null,
  ) {
    try {
      let totalCount = 0;
      page = page * 10;
      channelData.userDetails = channelData.userDetails || [];
      let userIds = [];
      let allUsers = [];
      //  console.log(channelData.userDetails)
      for (let elem of channelData.userDetails) {
        // Avoid old format data
        if (!elem.businessUnits) {
          continue;
        }
        let searchQuery = {
          status: 1,
        };
        searchQuery.status = {
          $nin: [2],
        };
        // Condition Exclude -> and, nin, Other-> or, in
        let condition = elem.buFilterType == 3 ? '$nin' : '$in';
        //  let mainCondition = (elem.buFilterType == 3) ? '$or' : '$or';
        //   searchQuery[mainCondition] = [];
        if (elem.businessUnits.length > 0) {
          searchQuery.parentBussinessUnitId = {};
          const buId = elem.businessUnits.map((val) =>
            mongoose.Types.ObjectId(val),
          );
          console.log(buId);
          searchQuery.parentBussinessUnitId = { $in: buId };
        }
        /*            if (elem.appointments.length > 0) {
                                let appointmentId = {};
                                appointmentId[condition] = elem.appointments;
                                searchQuery[mainCondition].push({
                                    appointmentId: appointmentId
                                });
                            }
                            if (elem.subSkillSets.length > 0) {
                                let subSkillSets = {};
                                subSkillSets[condition] = elem.subSkillSets;
                                searchQuery[mainCondition].push({
                                    subSkillSets: subSkillSets
                                });
                            }
                            elem.user = elem.user || [];
                            if (elem.user.length > 0) {
                                let user = {};
                                user[condition] = elem.user;
                                searchQuery[mainCondition].push({
                                    _id: user
                                });
                            }
                            elem.admin = elem.admin || [];
                            if (elem.admin.length > 0) {
                                let admin = {};
                                admin['$in'] = elem.admin;
                                searchQuery[mainCondition].push({
                                    _id: admin
                                });
                            }
                            if (elem.customField.length > 0) {
                                for (let singleCustom of elem.customField) {
                                    searchQuery[mainCondition].push({
                                        otherFields: {
                                            "$elemMatch": {
                                                "fieldId": singleCustom.fieldId,
                                                "value": {
                                                    [condition]: [singleCustom.value]
                                                }
                                            }
                                        }
                                    });
                                }
                            }*/
        if (name) {
          searchQuery.name = {};
          searchQuery.name = {
            $regex: name.toString(),
            $options: 'ixs',
          };
        }
        // __.log(JSON.stringify(searchQuery), '-------------')
        //console.log('searchQuery', JSON.stringify(searchQuery));
        // if (searchQuery[mainCondition].length == 1 || (elem.buFilterType == 1 && !name)) {
        //     delete searchQuery[mainCondition];
        // }
        console.log('searchQuery', JSON.stringify(searchQuery));
        let users = await User.find(searchQuery)
          .select('_id name staffId')
          .skip(page)
          .limit(10)
          .lean();
        users.forEach((user) => (user.name = `${user.name} (${user.staffId})`));
        // console.log('uss', users.length);
        /*if(name){
                    delete searchQuery.name
                }*/
        const count_filtered = await User.find(searchQuery).count();
        totalCount = totalCount + count_filtered;
        userIds = [...userIds, ...users];
        //allUsers.push(allUsers);
      }
      return { users: userIds, totalCount };
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async channelUsersListFastSecond(
    channelData,
    responseType = 'id',
    page = 0,
    name = null,
  ) {
    try {
      let totalCount = 0;
      page = page * 10;
      channelData.userDetails = channelData.userDetails || [];
      let userIds = [];
      let allUsers = [];
      //  console.log(channelData.userDetails)
      for (let elem of channelData.userDetails) {
        // Avoid old format data
        if (!elem.businessUnits) {
          continue;
        }
        let searchQuery = {
          status: 1,
        };
        searchQuery.status = {
          $nin: [2],
        };
        // Condition Exclude -> and, nin, Other-> or, in
        let condition = elem.buFilterType == 3 ? '$nin' : '$in';
        let mainCondition = elem.buFilterType == 3 ? '$or' : '$or';
        searchQuery[mainCondition] = [];

        if (elem.businessUnits.length > 0) {
          searchQuery.parentBussinessUnitId = {};
          const buId = elem.businessUnits.map((val) =>
            mongoose.Types.ObjectId(val),
          );
          console.log(buId);
          searchQuery.parentBussinessUnitId = { $in: buId };
        }
        if (elem.appointments.length > 0) {
          let appointmentId = {};
          appointmentId[condition] = elem.appointments;
          searchQuery[mainCondition].push({
            appointmentId: appointmentId,
          });
        }
        if (elem.subSkillSets.length > 0) {
          let subSkillSets = {};
          subSkillSets[condition] = elem.subSkillSets;
          searchQuery[mainCondition].push({
            subSkillSets: subSkillSets,
          });
        }
        elem.user = elem.user || [];
        if (elem.user.length > 0) {
          let user = {};
          user[condition] = elem.user;
          searchQuery[mainCondition].push({
            _id: user,
          });
        }
        elem.admin = elem.admin || [];
        if (elem.admin.length > 0) {
          let admin = {};
          admin['$in'] = elem.admin;
          searchQuery[mainCondition].push({
            _id: admin,
          });
        }
        if (elem.customField.length > 0) {
          for (let singleCustom of elem.customField) {
            searchQuery[mainCondition].push({
              otherFields: {
                $elemMatch: {
                  fieldId: singleCustom.fieldId,
                  value: {
                    [condition]: [singleCustom.value],
                  },
                },
              },
            });
          }
        }
        if (name) {
          searchQuery.name = {};
          searchQuery.name = {
            $regex: name.toString(),
            $options: 'ixs',
          };
        }
        // __.log(JSON.stringify(searchQuery), '-------------')
        //console.log('searchQuery', JSON.stringify(searchQuery));
        if (
          searchQuery[mainCondition].length == 1 ||
          (elem.buFilterType == 1 && !name)
        ) {
          delete searchQuery[mainCondition];
        }
        console.log('searchQuery', JSON.stringify(searchQuery));
        let users = await User.find(searchQuery)
          .select('_id name')
          .skip(page)
          .limit(10)
          .lean();
        // console.log('uss', users.length);
        /*if(name){
                    delete searchQuery.name
                }*/
        const count_filtered = await User.find(searchQuery).count();
        totalCount = totalCount + count_filtered;
        userIds = [...userIds, ...users];
        //allUsers.push(allUsers);
      }
      return { users: userIds, totalCount };
    } catch (err) {
      __.log(err);
      // __.out(res, 500);
    }
  }

  byBusinessUnitId(condition) {
    return new Promise((resolve, reject) => {
      User.find(condition, { name: 1, _id: 1 })
        .then((user) => {
          resolve(user);
        })
        .catch((err) => {
          resolve([]);
        });
    });
  }
  byAppointments(condition) {
    return new Promise((resolve, reject) => {
      User.find(condition, { name: 1, _id: 1 })
        .then((user) => {
          resolve(user);
        })
        .catch((err) => {
          resolve([]);
        });
    });
  }
  bySubSkillSets(condition) {
    return new Promise((resolve, reject) => {
      User.find(condition, { name: 1, _id: 1 })
        .then((user) => {
          resolve(user);
        })
        .catch((err) => {
          resolve([]);
        });
    });
  }
  byUser(condition) {
    return new Promise((resolve, reject) => {
      console.log('u', condition);
      User.find(condition, { name: 1, _id: 1 })
        .then((user) => {
          resolve(user);
        })
        .catch((err) => {
          resolve([]);
        });
    });
  }
  byAdmin(condition) {
    return new Promise((resolve, reject) => {
      console.log('a', condition);
      User.find(condition, { name: 1, _id: 1 })
        .then((user) => {
          resolve(user);
        })
        .catch((err) => {
          resolve([]);
        });
    });
  }
  byCustomField(condition) {
    return new Promise((resolve, reject) => {
      console.log('bu', condition);
      User.find(condition, { name: 1, _id: 1 })
        .then((user) => {
          resolve(user);
        })
        .catch((err) => {
          resolve([]);
        });
    });
  }
}
channel = new channel();
module.exports = channel;
