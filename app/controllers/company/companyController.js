// Controller Code Starts here
const mongoose = require("mongoose"),
  Company = require("../../models/company"),
  __ = require("../../../helpers/globalFunctions");

class company {
  async create(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        "name",
        "status"
      ]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let insert = req.body;

        /* Check for duplicate compane names */
        let duplicate = await Company.findOne({
          name: insert.name
        }).lean();

        if (duplicate) {
          return res.status(400).json({
            message: "Company name already exists"
          });
        }

        let insertedDoc = await new Company(insert).save();
        req.body.companyId = insertedDoc._id;
        this.read(req, res);
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
          status: {
            $ne: 3 /* $ne => not equal*/
          }
        },
        findOrFindOne;
      /*if ID given then it acts as findOne which gives object else find which gives array of object*/
      if (req.body.companyId) {
        where._id = req.body.companyId;
        findOrFindOne = Company.findOne(where);
      } else findOrFindOne = Company.find(where);

      let companies = await findOrFindOne
        .populate({
          path: "departments",
          select: "_id name sections",
          match: {
            status: {
              $ne: 3
            }
          },
          populate: {
            path: "sections",
            select: "_id name subSections",
            match: {
              status: {
                $ne: 3
              }
            },
            populate: {
              path: "subSections",
              select: "_id name",
              match: {
                status: {
                  $ne: 3
                }
              }
            }
          }
        })
        .lean();
      __.out(res, 201, {
        companies: companies
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async update(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
    }
      let requiredResult = await __.checkRequiredFields(req, ["companyId"]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let doc = await Company.findOne({
          _id: req.body.companyId,
          status: {
            $ne: 3
          }
        });
        if (doc === null) {
          __.out(res, 300, "Invalid companyId");
        } else {
          Object.assign(doc, req.body);
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

  async delete(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
    }
      let requiredResult = await __.checkRequiredFields(req, ["companyId"]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let companyResult = await Company.findOne({
          _id: req.body.companyId,
          status: {
            $ne: 3
          }
        });
        if (companyResult === null) {
          __.out(res, 300, "Invalid companyId");
        } else {
          companyResult.status = 3;
          let result = await companyResult.save();
          if (result === null) {
            __.out(res, 300, "Something went wrong");
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

  async push(params, res) {
    try {
      let pushJson = {},
        addToSetOrSet;
      __.log(params);
      if (params.departmentId) {
        pushJson.departments = mongoose.Types.ObjectId(params.departmentId);
        addToSetOrSet = {
          $addToSet: pushJson
        };

        let result = await Company.findOneAndUpdate({
            _id: params.companyId
          },
          addToSetOrSet
        );
        __.log(result);
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async pull(params, res) {
    try {
      let pullJson = {},
        setOrPull;
      __.log(params);
      if (params.departmentId) {
        pullJson.departments = mongoose.Types.ObjectId(params.departmentId);
        setOrPull = {
          $pull: pullJson
        };

        let result = await Company.findOneAndUpdate({
            _id: params.companyId
          },
          setOrPull
        );
        __.log(result);
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
}
company = new company();
module.exports = company;