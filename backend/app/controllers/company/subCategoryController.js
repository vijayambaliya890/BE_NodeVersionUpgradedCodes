// Controller Code Starts here
const mongoose = require('mongoose'),
  SubCategory = require('../../models/subCategory'),
  Category = require('../../models/category'),
  categoryController = require('./categoryController'),
  __ = require('../../../helpers/globalFunctions');
class subCategory {
  async create(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'name',
        'status',
        'categoryId',
      ]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let insert = req.body;
        __.log(req.body, 'req.body'); //create new model
        let insertedSubCategory = await new SubCategory(insert).save();
        //save model to MongoDB
        req.body.subCategoryId = insertedSubCategory._id;
        let params = {
          subCategoryId: insertedSubCategory._id,
          categoryId: req.body.categoryId,
        };
        categoryController.push(
          params,
          res,
        ); /* push generated city id in state table (field name : subCategoryIds)*/
        this.read(
          req,
          res,
        ); /*calling read fn with subCategoryId(last insert id). it calls findOne fn in read */
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
      let categoryIds = await this.getCompanyCategory(req);
      let where = {
        categoryId: {
          $in: [...categoryIds],
        },
        status: {
          $ne: 3 /* $ne => not equal*/,
        },
      };
      let findOrFindOne;
      /*if ID given then it acts as findOne which gives object else find which gives array of object*/
      if (req.body.subCategoryId) {
        where._id = req.body.subCategoryId;
        findOrFindOne = SubCategory.findOne(where);
      } else findOrFindOne = SubCategory.find(where);

      let subCategories = await findOrFindOne
        .populate({
          path: 'categoryId',
          select: '_id name',
        })
        .lean();
      __.out(res, 201, {
        subCategories: subCategories,
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
      let requiredResult = await __.checkRequiredFields(req, ['subCategoryId']);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let doc = await SubCategory.findOne({
          _id: req.body.subCategoryId,
          status: {
            $ne: 3,
          },
        });
        if (doc === null) {
          __.out(res, 300, 'Invalid subCategoryId');
        } else {
          let isCategoryEdited = false;
          if (req.body.categoryId && doc.categoryId != req.body.categoryId) {
            isCategoryEdited = true;
            let params = {
              subCategoryId: req.body.subCategoryId,
              categoryId: doc.categoryId /*existing categoryId*/,
            };
            categoryController.pull(
              params,
              res,
            ); /* pull this city id in from existing state (field name : subCategoryIds)*/
          }
          Object.assign(doc, req.body);
          let result = await doc.save();
          if (result === null) {
            __.out(res, 300, 'Something went wrong');
          } else {
            if (isCategoryEdited) {
              let params = {
                subCategoryId: req.body.subCategoryId,
                categoryId: req.body.categoryId /*current categoryId*/,
              };
              categoryController.push(
                params,
                res,
              ); /* push generated city id in state table (field name : subCategoryIds)*/
            }
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
      let requiredResult = await __.checkRequiredFields(req, ['subCategoryId']);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        __.log(req.body, 'SubCategory');
        let doc = await SubCategory.findOne({
          _id: req.body.subCategoryId,
          status: {
            $ne: 3,
          },
        });
        if (doc === null) {
          __.out(res, 300, 'Invalid subCategoryId');
        } else {
          doc.status = 3;
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

  async getCompanyCategory(req) {
    let categories = await Category.find({
      companyId: req.user.companyId,
      status: 1,
    });
    let categoryIds = [];
    for (let elem of categories) {
      categoryIds.push(elem._id);
    }
    return categoryIds;
  }
}
module.exports = new subCategory();
