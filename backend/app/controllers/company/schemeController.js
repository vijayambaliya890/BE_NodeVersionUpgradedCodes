// Controller Code Starts here
const mongoose = require('mongoose'),
  Scheme = require('../../models/scheme'),
  UserLog = require('../../models/userLog'),
  __ = require('../../../helpers/globalFunctions');
var mime = require('mime-types');

class scheme {
  async create(req, res) {
    try {
      console.log(req.body);
      let requiredResult1 = await __.checkRequiredFields(req, [
        'schemeName',
        'schemeDesc',
      ]);
      if (requiredResult1.status === false) {
        return res.json({
          status: 3,
          result: null,
          msg: 'Please fill the empty fields',
        });
        //__.out(res, 400, requiredResult1.missingFields);
      } else {
        let schemeIs = req.body;
        if (!schemeIs.schemeName.trim() || !schemeIs.schemeDesc.trim()) {
          return res.json({
            status: 3,
            result: null,
            msg: 'Please fill the empty fields',
          });
        }
        if (!schemeIs.companyID) {
          schemeIs.companyID = req.user.companyId;
        }
        schemeIs.createdBy = req.user._id;
        if (schemeIs.isShiftInterval) {
          if (!(schemeIs.shiftIntervalHour || schemeIs.shiftIntervalMins)) {
            return res.json({
              status: 3,
              result: null,
              msg: 'Interval is missing',
            });
          }
          if (
            (schemeIs.shiftIntervalHour !== 0 &&
              ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(
                schemeIs.shiftIntervalHour,
              )) ||
            (schemeIs.shiftIntervalMins !== 0 &&
              ![15, 30, 45].includes(schemeIs.shiftIntervalMins))
          ) {
            return res.json({
              status: 3,
              result: null,
              msg: 'Interval contain wrong value',
            });
          }
          schemeIs.shiftIntervalTotal =
            schemeIs.shiftIntervalHour * 60 + schemeIs.shiftIntervalMins;
        }
        console.log('To create scheme: ', schemeIs);
        schemeIs.noOfWeek = req.body.noOfWeek;
        const scheme = new Scheme(schemeIs);
        scheme.save((err, result) => {
          if (err) {
            return res.json({
              status: 3,
              result: null,
              msg: 'something went wrong',
            });
          }
          return res.json({
            status: 1,
            data: result,
            msg: 'Record inserted successfully',
          });
        });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async mimeType(req, res) {
    try {
      let url = req.body.fileName;
      let type = url.substring(url.lastIndexOf('.') + 1);
      if (type.includes('/')) {
        type = type.slice(0, -1);
      }
      console.log('ccccc', mime.contentType(type));
      console.log('type', type);
      res.json({ type: mime.contentType(type) });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async readByBu(req, res) {
    try {
      let companyId = req.params.companyId;
      if (!companyId) {
        companyId = req.user.companyId;
      }
      Scheme.find({
        companyID: companyId,
        businessUnitId: req.params.buId,
        status: true,
      }).then((result, err) => {
        if (err) {
          return res.json({
            status: 3,
            result: err,
            msg: 'something went wrong',
          });
        }
        if (result)
          return res.json({
            status: 1,
            data: result,
            msg: 'Record Fetch successfully 1',
          });
        return res.json({ status: 2, data: null, msg: 'Record Not Found' });
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async read(req, res) {
    try {
      let companyId = req.params.companyId;
      if (!companyId) {
        companyId = req.user.companyId;
      }
      Scheme.find({ companyID: companyId, status: true })
        .populate({ path: 'createdBy', select: 'name' })
        .then((result, err) => {
          if (err) {
            return res.json({
              status: 3,
              result: err,
              msg: 'something went wrong',
            });
          }
          if (result)
            return res.json({
              status: 1,
              data: result,
              msg: 'Record Fetch successfully',
            });
          return res.json({ status: 2, data: null, msg: 'Record Not Found' });
        });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async readScheme(req, res) {
    try {
      Scheme.findById({
        _id: mongoose.Types.ObjectId(req.params.schemeId),
      }).then((result, err) => {
        if (err) {
          return res.json({
            status: 3,
            result: err,
            msg: 'something went wrong',
          });
        }
        if (result)
          return res.json({
            status: 1,
            data: result,
            msg: 'Record Fetch successfully 111',
          });
        return res.json({ status: 2, data: null, msg: 'Record Not Found' });
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async update(req, res) {
    try {
      if (!req.body.status) {
        const idd = req.body._id;
        var isdelete = await Scheme.findByIdAndUpdate(
          idd,
          { $set: { status: false } },
          { new: true },
        );
        if (isdelete) {
          return res.json({
            status: 1,
            message: 'Scheme Deleted Successfully',
            result: isdelete,
          });
        }
        return res.json({
          status: 2,
          data: isdelete,
          message: 'Scheme Not Found',
        });
      }
      let requiredResult1 = await __.checkRequiredFields(req, [
        'schemeName',
        'schemeDesc',
      ]);
      if (requiredResult1.status === false) {
        return res.json({
          status: 3,
          result: null,
          msg: 'Please fill the empty fields',
        });
        //__.out(res, 400, requiredResult1.missingFields);
      } else {
        const id = req.body._id;
        const schemeIs = req.body;
        if (!schemeIs.companyID) {
          schemeIs.companyID = req.user.companyId;
        }
        if (!req.body.schemeName.trim() || !req.body.schemeDesc.trim()) {
          return res.json({
            status: 3,
            result: null,
            msg: 'Please fill the empty fields',
          });
        }
        //console.log(req.body)
        //return res.json({status: 2, message: "Scheme Not Found"});
        if (schemeIs.isShiftInterval) {
          if (!(schemeIs.shiftIntervalHour || schemeIs.shiftIntervalMins)) {
            return res.json({
              status: 3,
              result: null,
              msg: 'Interval is missing',
            });
          }
          if (
            (schemeIs.shiftIntervalHour !== 0 &&
              ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(
                schemeIs.shiftIntervalHour,
              )) ||
            (schemeIs.shiftIntervalMins !== 0 &&
              ![15, 30, 45].includes(schemeIs.shiftIntervalMins))
          ) {
            return res.json({
              status: 3,
              result: null,
              msg: 'Interval contain wrong value',
            });
          }
          schemeIs.shiftIntervalTotal =
            schemeIs.shiftIntervalHour * 60 + schemeIs.shiftIntervalMins;
        } else {
          schemeIs.shiftIntervalHour = 0;
          schemeIs.shiftIntervalMins = 0;
          schemeIs.shiftIntervalTotal = 0;
        }
        schemeIs.noOfWeek = req.body.noOfWeek;
        if (req.body.status === true) {
          Scheme.findOneAndUpdate(
            { _id: mongoose.Types.ObjectId(id) },
            schemeIs,
            { new: true },
          )
            .then((result) => {
              if (result) {
                return res.json({
                  status: 1,
                  data: result,
                  message: 'Scheme Updated Successfully',
                });
              }
              return res.json({
                status: 2,
                data: result,
                message: 'Scheme Not Found',
              });
            })
            .catch((err) => {
              return res.json({ status: 3, message: 'Something Went Wrong' });
            });
        } else {
          Scheme.findByIdAndUpdate(
            id,
            { $set: { status: false } },
            { new: true },
          )
            .then((result) => {
              if (result) {
                return res.json({
                  status: 1,
                  message: 'Scheme Deleted Successfully',
                  result,
                });
              }
              return res.json({
                status: 2,
                data: result,
                message: 'Scheme Not Found',
              });
            })
            .catch((err) => {
              return res.json({ status: 3, message: 'Something Went Wrong' });
            });
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async readUserLog(req, res) {
    try {
      var data = await UserLog.find({
        type: req.body.type,
        businessUnitId: req.body.businessUnitId,
      }).populate([
        {
          path: 'oldSchemeId',
          select: 'schemeName',
        },
        {
          path: 'newSchemeId',
          select: 'schemeName',
        },
        {
          path: 'updatedBy',
          select: 'staffId name',
        },
        {
          path: 'userId',
          select: 'staffId name',
        },
      ]);
      return res.json({ data });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async getNumberOfWeekForSchemeId(req, res) {
    try {
      const weekNumber =  await Scheme.findOne({ _id: req.user.schemeId, status: true }).select('noOfWeek').lean();
      if (weekNumber) {
        return res.json({
          data: weekNumber,
          msg: 'Record fetched successfully'
        });  
      }
      return res.json({ data: null, msg: 'Record Not Found' });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
}

module.exports = new scheme();
