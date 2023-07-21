// Controller Code Starts here
const User = require("../../models/user"),
  UserField = require("../../models/userField"),
  PageSettingModel = require("../../models/pageSetting"),
  nodemailer = require("nodemailer"),
  smtpTransport = require("nodemailer-smtp-transport"),
  hbs = require("nodemailer-express-handlebars"),
  mongoose = require("mongoose"),
  __ = require("../../../helpers/globalFunctions");

const ObjectId = require("mongoose").Types.ObjectId;

/* Email Credentials */
const transporter = nodemailer.createTransport(
  smtpTransport({
    service: "gmail",
    host: "smtpout.secureserver.net",
    port: 465,
    secure: true,
    auth: {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PASSWORD
    }
  })
);

const options = {
  viewEngine: {
    extname: ".hbs",
    layoutsDir: "../../public/email/"
  },
  viewPath: "public/email/",
  extName: ".hbs"
};

class user {
  async read(req, res) {
    try {
      let where = {
        _id: req.user._id,
        status: {
          $ne: 3 /* $ne => not equal*/
        }
      };
      let users = await User.findOne(where)
        .select("-password -pwdManage")
        .populate([
          {
            path: "subSkillSets",
            select: "name status",
            match: {
              status: 1
            },
            populate: {
              path: "skillSetId",
              select: "name status",
              match: {
                status: 1
              }
            }
          },
          {
            path: "appointmentId",
            select: "name status"
          },
          {
            path: "role",
            select: "name description isFlexiStaff privileges",
            populate: {
              path: "privileges",
              select: "name description flags privilegeCategoryId",
              populate: {
                path: "privilegeCategoryId",
                select: "name"
              }
            }
          },
          {
            path: "parentBussinessUnitId",
            select: "name",
            populate: {
              path: "sectionId",
              select: "name",
              populate: {
                path: "departmentId",
                select: "name",
                populate: {
                  path: "companyId",
                  select: "name"
                }
              }
            }
          },
          {
            path: "planBussinessUnitId",
            select: "name",
            populate: {
              path: "sectionId",
              select: "name",
              populate: {
                path: "departmentId",
                select: "name",
                populate: {
                  path: "companyId",
                  select: "name"
                }
              }
            }
          },
          {
            path: "viewBussinessUnitId",
            select: "name",
            populate: {
              path: "sectionId",
              select: "name",
              populate: {
                path: "departmentId",
                select: "name",
                populate: {
                  path: "companyId",
                  select: "name"
                }
              }
            }
          }
        ])
        .lean();

      var privilegeFlags = await __.getUserPrivilegeObject(
        users.role.privileges
      );
      users.userId = users._id;
      users.privilegeFlags = privilegeFlags;
      delete users.role.privileges;

      // Custom Fields Setup
      let userFields = await UserField.find({
        companyId: req.user.companyId,
        status: 1
      })
        .sort({
          indexNum: 1
        })
        .lean();

        const userFieldsUpdate = otherFields => {
          otherFields = otherFields || [];
          return userFields.reduce((prev, curr, i)=>{
            curr.value = curr.value || "";
            const field = otherFields.find(o=>__.isEqualObjectIds(o.fieldId, curr._id))
            if(!!field){
              curr.value = field.value||"";
            }
            return prev.concat(curr);
          },[])
        }
        users.otherFields = userFieldsUpdate(users.otherFields);

      /*let i = 0;
      users.otherFields = users.otherFields || [];
      for (let field of userFields) {
        userFields[i].value = "";

        for (let elem of users.otherFields) {
          if (elem.fieldId == field._id) {
            userFields[i].value = elem.value;
          }
        }
        i++;
      }
      users.otherFields = userFields;*/
      // password management
      let pageSettingData = await PageSettingModel.findOne({
        companyId: req.user.companyId,
        status: 1
      })
        .select("pwdSettings")
        .lean();
      users.pwdSettings = pageSettingData;

      __.out(res, 201, {
        data: users
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }

  async getStaffs(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId)
      };
      let planBu = await User.findOne({_id:req.user._id}, {_id:0, planBussinessUnitId:1});
      planBu = planBu.planBussinessUnitId;
      req.body.parentBussinessUnitId = planBu;
      if (Array.isArray(req.body.parentBussinessUnitId) && 'parentBussinessUnitId' in req.body) {
        if (-1 === req.body.parentBussinessUnitId.indexOf('all')) {
          query = {
            parentBussinessUnitId: { $in: req.body.parentBussinessUnitId.map(val => mongoose.Types.ObjectId(val)) }
          }
        } else {
          query = {
            parentBussinessUnitId: { $in: req.user.planBussinessUnitId.map(val => mongoose.Types.ObjectId(val)) }
          }
        }
      } else {
        return __.out(res, 201, { items: [], count_filtered: 0 });
      }
      if (req.body.q !== undefined && req.body.q.trim()) {
        query = {
          $text:{$search:  '\"' + req.body.q.toString() +'\"'}
        };
      }
      query.status = {
        $nin: [2]
      };
      var limit =1;
      let users = await User.aggregate([{
        $match: query
      },
      {
        $lookup: {
            from: 'schemes',
            localField: 'schemeId',
            foreignField: '_id',
            as: 'schemeInfo'
        },
      },
      {
        $unwind: '$schemeInfo',
    },
    {
      $match:{
        'schemeInfo.shiftSchemeType':{$in:[2,3]},
      }
    },
    { $project: { schemeId:1, 'schemeInfo.shiftSchemeType':1,name: 1, _id: 1, parentBussinessUnitId: 1, staffId:1 } }]).allowDiskUse(true);
      if (!users) {
        return res.send({code:1, data:[]})
      }
      return res.send({code:1, data:users})
    } catch (error) {
      __.log(error);
      return __.out(res, 300, error);
    }
  }

  async update(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
    }
      let requiredResult = await __.checkRequiredFields(req, [
        "email",
        "contactNumber"
      ]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let doc = await User.findOne({
          _id: req.user._id
        });
        const existingUser = JSON.parse(JSON.stringify(doc));
        if (doc === null) {
          __.out(res, 300, "Invalid userId");
        } else {
          Object.assign(doc, {
            email: req.body.email,
            contactNumber: req.body.contactNumber
          });
          if (req.body.password) {
            doc.password = doc.generateHash(req.body.password);
            // Logout all devices
            doc.tokenList = [];
          }
          if (req.file) doc.profilePicture = req.file.path.substring(6);

          // Custom fields
          let otherFields;
          if (req.body.otherFields) {
            if (typeof req.body.otherFields == "string") {
              req.body.otherFields = JSON.parse(req.body.otherFields);
            }

            // Update Only Accessible Custom Fields
            let companyFields = await UserField.find({
              companyId: req.user.companyId,
              status: {
                $ne: 3
              }
            })
              .select("editable")
              .lean();

            otherFields = req.body.otherFields
              .map(v => {
                let i = companyFields.findIndex(
                  x => x._id.toString() == v.fieldId
                );
                // unknown fields
                if (i == -1) {
                  return false;
                }
                /*if (companyFields[i].editable == true) {
                  return v;
                }
                return false;*/
                return v;
              })
              .filter(Boolean);

            doc.otherFields = otherFields;
          }

          doc.leaveGroupId = null;
          console.log(">>> existingUser.leaveGroupId :", existingUser.leaveGroupId);
          if(!!existingUser.leaveGroupId) {
            doc.leaveGroupId = existingUser.leaveGroupId;
          }
          console.log(">>> existingUser.leaveGroupId :", doc.leaveGroupId);
          let result = await doc.save();
          if (result === null) {
            __.out(res, 300, "Something went wrong");
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
  test(req, res) {
    __.out(res, 200);
  }
}
user = new user();
module.exports = user;
