const mongoose = require("mongoose"),
  request = require("request"),
  User = require("../../models/user"),
  Rewards = require("../../models/redeemedRewards"),
  moment = require('moment'),
  Wishlist = require("../../models/redeemedWishlist"),
  __ = require("../../../helpers/globalFunctions"),
  rewardURL = "https://cerrapoints.com";
const isJSON = str => {
  try {
    return (JSON.parse(str) && !!str);
  } catch (e) {
    return false;
  }
}
class redeemedRewards {
  async getRequestResponse(req, headers) {
    console.log(headers.url);
    return new Promise((resolve, reject) => {
      request(headers,
        async function (error, response, data) {
          const jsonData = response.body;
          if (jsonData && isJSON(jsonData)) {
            const body = JSON.parse(jsonData);
            if (response.statusCode === 200) {
              resolve(body);
            } else if (body.detail === 'Invalid token.') {
              await __.regenerateCeraToken(req.user.companyId);
              reject('Something went wrong try later');
            } else {
              reject(body);
            }
          } else {
            reject('Something went wrong try later');
          }
        });
    });
  }
  async redemptionLogin(req, res) {
    try {
      let url = `${rewardURL}/profiles/api/token-auth/`;
      await new Promise((resolve, reject) => {
        request(
          {
            url: url,
            formData: {
              username: process.env.REWARDUSERNAME,
              password: process.env.REWARDPASSWORD
            },
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": process.env.USER_AGENT
            }
          },
          function (error, response, body) {
            if (error) {
              reject("Invalid login!");
            }
            if (body && isJSON) {
              body = JSON.parse(body);
              if ("detail" in body) {
                reject(body.detail);
              }
              resolve(body);
            } else {
              reject("Something went wrong try later!");
            }
          }
        );
      })
        .then(success => {
          return __.out(res, 201, success);
        })
        .catch(error => {
          return __.out(res, 300, "Somthing went wrong try later");
        });
    } catch (err) {
      __.log(err);
      return __.out(res, 300, err);
    }
  }

  async redemptionType(req, res) {
    try {
      let url = `${rewardURL}/rewards/api/categories/?type=${req.params.rewardType}`;
      const rewardHeaders = await __.getCeraToken(req.user.companyId);
      await this.getRequestResponse(req, {
        url: url,
        method: "GET",
        headers: rewardHeaders
      }).then(data => {
        let body = data.map(x => {
          if (x.thumbnail_img_url) {
            x.thumbnail_img_url = `${rewardURL}${x.thumbnail_img_url}`;
          }
          if (x.display_img_url) {
            x.display_img_url = `${rewardURL}${x.display_img_url}`;
          }
          x.sub_categories = x.sub_categories || [];
          x.sub_categories = x.sub_categories.map(sub => {
            if (sub.thumbnail_img_url) {
              sub.thumbnail_img_url = `${rewardURL}${
                sub.thumbnail_img_url
                }`;
            }
            if (sub.display_img_url) {
              sub.display_img_url = `${rewardURL}${sub.display_img_url}`;
            }
            return sub;
          });
          return x;
        });
        return __.out(res, 201, body);
      }).catch(error => {
        __.log(error);
        return __.out(res, 300, 'Something went wrong try later');
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async redemptionCategory(req, res) {
    try {
      let url = `${rewardURL}/rewards/api/rewards/?category=${req.params.rewardCategory}`;
      if (req.params.subCategory !== 'false') {
        url = `${url}&sub_category=${req.params.subCategory}`;
      }
      console.log(url);
      const rewardHeaders = await __.getCeraToken(req.user.companyId);
      await this.getRequestResponse(req, {
        url: url,
        method: "GET",
        headers: rewardHeaders
      }).then(data => {

        let body = data.results.map(x => {
          if (x.thumbnail_img_url) {
            x.thumbnail_img_url = `${rewardURL}${x.thumbnail_img_url}`;
          }
          if (x.display_img_url) {
            x.display_img_url = `${rewardURL}${x.display_img_url}`;
          }
          if (x.description) {
            x.description = __.stripeHtml(x.description);
          }
          return x;
        });
        return __.out(res, 201, body);
      }).catch(error => {
        __.log(error);
        return __.out(res, 300, 'something went wrong try later');
      });
    } catch (err) {
      __.log(err);
      return _.out(res, 300, JSON.stringify(err));
    }
  }

  async redemptionDetails(req, res) {
    try {
      let url = `${rewardURL}/rewards/api/rewards/${req.params.rewardDetails}/`;
      const rewardHeaders = await __.getCeraToken(req.user.companyId);
      await this.getRequestResponse(req, {
        url: url,
        method: "GET",
        headers: rewardHeaders
      }).then(async body => {
        if (body.thumbnail_img_url) {
          body.thumbnail_img_url = `${rewardURL}${body.thumbnail_img_url}`;
        }
        if (body.display_img_url) {
          body.display_img_url = `${rewardURL}${body.display_img_url}`;
        }
        if (body.terms_and_conditions) {
          body.terms_and_conditions = body.terms_and_conditions;
        }
        if (body.description) {
          body.description = __.stripeHtml(body.description);
        }
        if (!!body.merchant && body.merchant.description) {
          body.merchant.description = __.stripeHtml(
            body.merchant.description
          );
        }
        let rewardPoints = await User.find({
          _id: req.user._id
        })
          .select("rewardPoints")
          .lean();
        let redeemPoints = rewardPoints.map(x => x.rewardPoints);
        body["redeemPoints"] = redeemPoints.toString();
        return __.out(res, 201, body);
      }).catch(error => {
        __.log(error);
        return __.out(res, 300, error);
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }



  async redemptionHistory(req, res) {
    try {
      let url = `${rewardURL}/finance/api/transactions/${
        req.params.rewardHistory
        }/?date=${req.params.rewardDate}`;
      const rewardHeaders = await __.getCeraToken(req.user.companyId);
      await this.getRequestResponse(req, {
        url: url,
        method: "GET",
        headers: rewardHeaders
      }).then(body => {
        console.log(JSON.stringify(body));
        body = body.map(x => {
          if (x.reward_image_url) {
            x.reward_image_url = `${rewardURL}${x.reward_image_url}`;
          }
          return x;
        });
        return __.out(res, 201, data);
      }).catch(error => {
        __.log(error);
        return __.out(res, 300, 'something went wrong try later');
      })

      /*
            await new Promise((resolve, reject) => {
              request({ url: url, method: "GET", headers: rewardHeaders }, function (error, response, body) {
                if (error) {
                  reject(error);
                } //return __.out(res, 300, "Redemption history not found!");
      
                if (body && isJSON(body)) {
                  body = JSON.parse(body);
                  if('detail' in body){
                    reject(body.detail);
                  }
                  body = body.map(x => {
                    if (x.reward_image_url) {
                      x.reward_image_url = `${rewardURL}${x.reward_image_url}`;
                    }
                    return x;
                  });
                  resolve(body);
                  //return __.out(res, 201, body);
                } else {
                  reject(body);
                }
              });
            }).then(data=>{
              return __.out(res, 201, data);
            }).catch(error=>{
              return __.out(res, 300, 'Something went wrong try later');
            });*/
    } catch (err) {
      __.log(err);
      return __.out(res, 300, err);
    }
  }

  async rewardsDbHistory(req, res) {
    try {
      const page = (!!req.query.page) ? req.query.page * 10 : 0;
      let rewardsData = await Rewards.find({ userId: req.user._id }).sort({ createdAt: -1 }).skip(page).limit(10).lean();
      return __.out(res, 201, rewardsData);
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Somethign went wrong try later');
    }
  }

  async redemptionReward(req, res) {
    try {
      const rewardHeaders = await __.getCeraToken(req.user.companyId);
      let rewardData = req.body;
      let url = `${rewardURL}/rewards/api/rewards/${rewardData.reward}/`;
      const processRedeemption = async (data, user) => {
        let url = `${rewardURL}/redemptions/api/redemptions/`;
        let objReward = {
          reward: rewardData.reward,
          user_data: {
            email: req.user.email,
            phone: req.user.contactNumber
          }
        };
        await this.getRequestResponse(req, {
          url: url,
          method: "POST",
          headers: rewardHeaders,
          body: JSON.stringify(objReward)
        }).then(async body => {
          // console.log(JSON.stringify(body), 'DEMO REWARD');
          body.rewardId = rewardData.reward;;
          if (req.user) {
            body.userId = req.user._id;
          }
          body["code"] = body.code;
          if (body.description) {
            body.description = __.stripeHtml(body.description);
          }
          if (!!body.rewardId) {
            body.redemption_type = data.redemption_type;
            body.points = data.points;
            body.name = data.name;
            if (data.thumbnail_img_url) {
              body.thumbnail_img_url = `${rewardURL}${data.thumbnail_img_url}`;
            }
            if (data.display_img_url) {
              body.display_img_url = `${rewardURL}${data.display_img_url}`;
            }
            if (data.terms_and_conditions) {
              body.terms_and_conditions = data.terms_and_conditions;
            }
            if (data.merchant) {
              body["merchant.name"] = data.merchant.name;
              body["merchant.description"] = __.stripeHtml(
                data.merchant.description
              );
              body["merchant.website"] = data.merchant.website;
            }
            body.totalRewardPoints = user.rewardPoints || 0;
            await User.update(
              { _id: req.user._id },
              { $inc: { rewardPoints: -body.points } }
            );
            let newReward = await new Rewards(body).save();
            let rewardsPoints = await User.findById(req.user._id).select('rewardPoints').lean();
            return __.out(res, 201, newReward);
          } else {
            return __.out(res, 300, "Invalid Reward id");
          }
        })
      }

      await this.getRequestResponse(req, {
        url: url,
        method: "GET",
        headers: rewardHeaders
      }).then(async data => {
        const rewardPoints = parseInt(data.points) || 0;
        let user = await User.findById(req.user._id).select('rewardPoints').lean();
        if (user.rewardPoints >= rewardPoints) {
          await processRedeemption(data, user);
        } else {
          return __.out(res, 300, "Not suffcient amount to redeem");
        }
      }, error => {
        __.log(error);
        return __.out(res, 300, "Something went wrong try later");
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, "Something went wrong try later");
    }
  }
  async redemptionReward1(req, res) {
    try {
      const rewardHeaders = await __.getCeraToken(req.user.companyId);
      let url = `${rewardURL}/redemptions/api/redemptions/`;
      let rewardData = req.body;
      let objReward = {
        reward: rewardData.reward,
        user_data: {
          email: req.user.email,
          phone: req.user.contactNumber
        }
      };
      await this.getRequestResponse(req, {
        url: url,
        method: "POST",
        headers: rewardHeaders,
        body: JSON.stringify(objReward)
      }).then(async body => {
        // console.log(JSON.stringify(body), 'DEMO REWARD');
        body.rewardId = rewardData.reward;;
        if (req.user) {
          body.userId = req.user._id;
        }
        body["code"] = body.code;
        if (body.description) {
          body.description = __.stripeHtml(body.description);
        }
        if (body.rewardId) {
          let url = `${rewardURL}/rewards/api/rewards/${body.rewardId}/`;
          await this.getRequestResponse(req, {
            url: url,
            method: "GET",
            headers: rewardHeaders
          }).then(async data => {
            body.redemption_type = data.redemption_type;
            body.points = data.points;
            body.name = data.name;
            if (data.thumbnail_img_url) {
              body.thumbnail_img_url = `${rewardURL}${data.thumbnail_img_url}`;
            }
            if (data.display_img_url) {
              body.display_img_url = `${rewardURL}${data.display_img_url}`;
            }
            if (data.terms_and_conditions) {
              body.terms_and_conditions = data.terms_and_conditions;
            }
            if (data.merchant) {
              body["merchant.name"] = data.merchant.name;
              body["merchant.description"] = __.stripeHtml(
                data.merchant.description
              );
              body["merchant.website"] = data.merchant.website;
            }

            // Deduct points in users

            let user = await User.findById(req.user._id).select('rewardPoints').lean();
            body.totalRewardPoints = user.rewardPoints || 0;
            await User.update(
              { _id: req.user._id },
              { $inc: { rewardPoints: -body.points } }
            );
            let newReward = await new Rewards(body).save();
            let rewardsPoints = await User.findById(req.user._id).select('rewardPoints').lean();
            return __.out(res, 201, newReward);
          }).catch(error => {
            console.log(error);
            return __.out(res, 300, 'something went wrong try later');
          })
        }
      }).catch(error => {
        console.log(error)
        return __.out(res, 300, 'something went wrong try later');
      });
      /*
      await new Promise((resolve, reject)=>{
        request(
          {
            url: url,
            method: "POST",
            headers: rewardHeaders,
            body: JSON.stringify(objReward)
          },
          async function (error, response, body) {
            if (error){
              reject("Redemption reward not found!");
            }
            if (body && isJSON(body)) {
              body = JSON.parse(body);
              if('detail' in body){
                reject(body.detail);
              }
              body.rewardId = rewardData.reward;
              if (req.user) {
                body.userId = req.user._id;
              }
              if (!body.barcode) {
                body["barcode"] = `${rewardURL}/barcode/${body.code}`;
              }
              if (body.description) {
                body.description = __.stripeHtml(body.description);
              }
  
              if (body.rewardId) {
                let url = `${rewardURL}/rewards/api/rewards/${body.rewardId}/`;
                request(
                  {
                    url: url,
                    method: "GET",
                    headers: rewardHeaders
                  },
                  async function (error, response, data) {
                    if (error){
                      reject("Redemption Details not found!");
                    }
                    if (data && isJSON(data)) {
                      data = JSON.parse(data);
                      body.redemption_type = data.redemption_type;
                      body.points = data.points;
                      body.name = data.name;
                      if (data.thumbnail_img_url) {
                        body.thumbnail_img_url = `${rewardURL}${
                          data.thumbnail_img_url
                          }`;
                      }
                      if (data.display_img_url) {
                        body.display_img_url = `${rewardURL}${
                          data.display_img_url
                          }`;
                      }
                      if (data.terms_and_conditions) {
                        body.terms_and_conditions = data.terms_and_conditions;
                      }
                      if (data.merchant) {
                        body["merchant.name"] = data.merchant.name;
                        body["merchant.description"] = __.stripeHtml(
                          data.merchant.description
                        );
                        body["merchant.website"] = data.merchant.website;
                      }
  
                      // Deduct points in users
                      
                      let user = await User.findById(req.user._id).select('rewardPoints').lean();
                      body.totalRewardPoints = user.rewardPoints||0;
                      await User.update(
                        { _id: req.user._id },
                        { $inc: { rewardPoints: -body.points } }
                      );
  
                      let newReward = await new Rewards(body).save();
                      resolve(newReward)
                    } else {
                      reject(data);
                    }
                  }
                );
              }
            } else {
              reject(body);
            }
          }
        );
      }).then(body=>{
        return __.out(res, 201, body);
      }).catch(error=>{
        return __.out(res, 300, 'something went wrong try later');
      })*/
    } catch (err) {
      __.log(err);
      return __.out(res, 300, err);
    }
  }

  async rewardsHistory(req, res) {
    try {
      let query = {};
      let rewards = await Rewards.aggregate([{
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      }, {
        $unwind: '$user'
      }, {
        $match: {
          'user.parentBussinessUnitId': {
            $in: !!req.query.businessUnit ? [mongoose.Types.ObjectId(req.query.businessUnit)] : req.user.planBussinessUnitId
          }
        }
      }, {
        $project: { 'user.name': 1, 'user.staffId': 1, 'code': 1, 'points': 1, 'redemption_type': 1, 'createdAt': 1, 'totalRewardPoints': 1, 'user.parentBussinessUnitId': 1 }
      }]);
      return __.out(res, 201, rewards);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async rewardsHistoryExport(req, res) {
    try {
      const headers = ['User Name', 'StaffId', 'Code', 'Points', 'Redemption Date', 'TotalRewardPoints', 'BussinessUnit'];
      console.log(req.query)
      let rewards = await Rewards.aggregate([{
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      }, {
        $unwind: '$user'
      }, {
        $match: {
          'user.parentBussinessUnitId': {
            $in: !!req.query.businessUnit ? [mongoose.Types.ObjectId(req.query.businessUnit)] : req.user.planBussinessUnitId
          }
        }
      }, {
        $lookup: {
          from: 'subsections',
          localField: 'user.parentBussinessUnitId',
          foreignField: '_id',
          as: 'businessUnit'
        }
      }, {
        $unwind: '$businessUnit'
      }, {
        $lookup: {
          from: 'sections',
          localField: 'businessUnit.sectionId',
          foreignField: '_id',
          as: 'section'
        }
      }, {
        $unwind: '$section'
      }, {
        $lookup: {
          from: 'departments',
          localField: 'section.departmentId',
          foreignField: '_id',
          as: 'department'
        }
      }, {
        $unwind: '$department'
      }, {
        $lookup: {
          from: 'companies',
          localField: 'department.companyId',
          foreignField: '_id',
          as: 'company'
        }
      }, {
        $unwind: '$company'
      }, {
        $project: { 'user.name': 1, 'user.staffId': 1, 'code': 1, 'points': 1, 'redemption_type': 1, 'createdAt': 1, 'totalRewardPoints': 1, 'businessUnit.name': 1, 'section.name': 1, 'department.name': 1, 'company.name': 1 }
      }]);
      let rowResult = rewards.map(reward => {
        return {
          'User Name': reward.user.name || '--',
          'StaffId': reward.user.staffId || '--',
          'Code': reward.code || '--',
          'Points': reward.points || '--',
          'Redemption Date': moment(reward.createdAt).format('lll') || '--',
          'TotalRewardPoints': reward.totalRewardPoints || '--',
          'BussinessUnit': `${reward.company.name}>${reward.department.name}>${reward.section.name}>${reward.businessUnit.name}` || '--'
        };
      })
      let csv = json2csv({
        data: rowResult,
        fields: headers
      });
      await new Promise((resolve, reject) => {
        fs.writeFile(`./public/uploads/reward/rewardsExport.csv`, csv, (err) => {
          if (err) {
            reject('json2csv err' + err);
          } else {
            resolve(true);
          }
        });
      }).then(success => {
        return __.out(res, 201, { csvLink: `uploads/reward/rewardsExport.csv` });
      }).catch(error => {
        console.log(error);
        return __.out(res, 300, error);
      })
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async redemptionSearch(req, res) {
    try {
      let url = `${rewardURL}/rewards/api/rewards/?q=${req.params.rewardSearch}`;
      const rewardHeaders = await __.getCeraToken(req.user.companyId);
      await this.getRequestResponse(req, {
        url: url,
        method: "GET",
        headers: rewardHeaders
      }).then(body => {
        body = body.results.map(x => {
          if (x.thumbnail_img_url) {
            x.thumbnail_img_url = `${rewardURL}${x.thumbnail_img_url}`;
          }
          return x;
        });
        return __.out(res, 201, body);
      }).catch(error => {
        __.log(error);
        return __.out(res, 300, 'Something went wrong try later');
      })
      /*await new Promise((resolve, reject)=>{
        request({
            url: url,
            method: "GET",
            headers: rewardHeaders
          },
          function (error, response, body) {
            if (error){
              reject("Rewards not found!")
            }
            if (body && isJSON(body)) {
              body = JSON.parse(body);
              if('detail' in body){
                reject(body.detail);
              }
              body = body.results.map(x => {
                if (x.thumbnail_img_url) {
                  x.thumbnail_img_url = `${rewardURL}${x.thumbnail_img_url}`;
                }
                return x;
              });
              resolve(body);
            } else {
              reject(body);
            }
          });
      }).then(body=>{
        return __.out(res, 201, body);
      }).catch(error=>{
        return __.out(res, 300, 'something went wrong try later');
      });*/
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async redemptionWishlist(req, res) {
    try {
      let requiredResult = await __.checkRequiredFields(req, [
        "name",
        "description",
        "quantity",
        "points"
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      let wishlist = req.body;
      if (req.user) {
        wishlist.userId = req.user._id;
      }

      let insertedwishlist = await new Wishlist(wishlist).save();

      if (!insertedwishlist)
        return __.out(res, 300, "Error while adding wishlist");

      return __.out(res, 201, insertedwishlist);
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async deleteWishlist(req, res) {
    try {
      let requiredResult = await __.checkRequiredFields(req, ["wishlistId"]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let wishlistIdResult = await Wishlist.findOne({
          _id: req.body.wishlistId,
          status: {
            $ne: 3
          }
        });
        if (wishlistIdResult === null) {
          __.out(res, 300, "Invalid wishlistId");
        } else {
          wishlistIdResult.status = 3;
          let result = await wishlistIdResult.save();
          if (result === null) {
            __.out(res, 300, "Invalid wishlistId");
          } else {
            __.out(res, 200, "Wishlist deleted");
          }
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async redemptionGamification(req, res) {
    try {
      let gamification = await User.findOne({
        _id: req.user._id,
        status: {
          $ne: 3
        }
      }).select(
        "rewardPoints contactNumber profilePicture email rewardPoints staffId name companyId"
      );
      if ('rewardPoints' in gamification) {

      } else {
        if (gamification.companyId.toString() === "5d1cb77b9cbe771db02d3721") {
          gamification.rewardPoints = 5000;
        } else {
          gamification.rewardPoints = 100;
        }
      }
      let newGamification = await gamification.save();
      return __.out(res, 201, newGamification);
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async redemptionNew(req, res) {
    try {
      let rewardsData = await Rewards.aggregate([
        {
          $match: {
            userId: mongoose.Types.ObjectId(req.user._id)
          }
        },
        {
          $group: {
            _id: {
              // _id: "$_id",
              rewardId: "$rewardId",
              thumbnail_img_url: "$thumbnail_img_url",
              display_img_url: "$display_img_url",
              redemption_type: "$redemption_type",
              name: "$name",
              description: "$description"
            }
          }
        },
        { $sort: { _id: -1 } },
        { $limit: 10 }
      ]);
      __.out(res, 201, rewardsData);
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async redemptionPopular(req, res) {
    try {

      let rewardsData = await Rewards.aggregate([
        {
          $group: {
            _id: {
              rewardId: "$rewardId",
              thumbnail_img_url: "$thumbnail_img_url",
              display_img_url: "$display_img_url",
              redemption_type: "$redemption_type",
              name: "$name",
              description: "$description"
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      __.out(res, 201, rewardsData);
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
}

redeemedRewards = new redeemedRewards();
module.exports = redeemedRewards;