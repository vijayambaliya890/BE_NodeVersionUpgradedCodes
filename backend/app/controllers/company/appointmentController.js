// Controller Code Starts here
const mongoose = require('mongoose'),
  Appointment = require('../../models/appointment'),
  __ = require('../../../helpers/globalFunctions');

class appointment {
  async create(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'name',
        'status',
      ]);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let regex = new RegExp(`^${req.body.name.trim()}$`, 'i');
        let duplicate = await Appointment.count({
          name: { $regex: regex },
          status: { $nin: 3 },
          companyId: req.user.companyId,
        });
        if (duplicate !== 0) {
          __.out(res, 300, 'Appointment name already exists');
          return;
        }

        let insert = req.body;
        insert.companyId = req.user.companyId;
        let insertedDoc = await new Appointment(insert).save();
        req.body.appointmentId = insertedDoc._id;
        this.read(
          req,
          res,
        ); /*calling read fn with appointmentId(last insert id). it calls findOne fn in read */
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async getAll(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let where = {
          companyId: req.user.companyId,
          status: 1,
        },
        findOrFindOne;
      /*if ID given then it acts as findOne which gives object else find which gives array of object*/
      if (req.body.appointmentId) {
        where._id = req.body.appointmentId;
        findOrFindOne = Appointment.findOne(where);
      } else {
        const data = await this.findAll(where, req.query);
        return res.json({ data });
      }

      let appointments = await findOrFindOne.lean();
      __.out(res, 201, {
        appointments: appointments,
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async findAll(where, { page = 1, limit = 10, search, sortBy, sortWith }) {
    let searchCondition = {};
    if (search) {
      searchCondition['name'] = { $regex: search, $options: 'i' };
    }

    limit = Number(limit);
    page = Number(page);
    const skip = (page - 1) * limit;
    const searchObj = { ...where, ...searchCondition };
    console.log(searchObj)
    const sort = {
      [sortWith]: sortBy === 'desc' ? -1 : 1,
    }
    console.log(searchObj)
    const allResult = [
      Appointment.find(searchObj, { _id: 1, name: 1 })
        .sort(sort)
        .skip(skip)
        .limit(limit).lean(),
    ];
    if (page === 1) {
      allResult.push(Appointment.countDocuments(searchObj));
      const [data, count] = await Promise.all(allResult);
      return { count, data };
    }
    const [data] = await Promise.all(allResult);
    return { data };
  }
  async read(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let where = {
          companyId: req.user.companyId,
          status: {
            $ne: 3 /* $ne => not equal*/,
          },
        },
        findOrFindOne;
      /*if ID given then it acts as findOne which gives object else find which gives array of object*/
      if (req.body.appointmentId) {
        where._id = req.body.appointmentId;
        findOrFindOne = Appointment.findOne(where);
      } else findOrFindOne = Appointment.find(where);

      let appointments = await findOrFindOne.lean();
      __.out(res, 201, {
        appointments: appointments,
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async readWithPn(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      const limit = 10;
      let page = !!req.body.page ? parseInt(req.body.page) * limit : 0; // skip from appointment dropdown
      page = page ? page : req.body.start ? parseInt(req.body.start) : 0; // skip from appointment table
      let query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
        status: {
          $in: [1],
        },
      };
      const recordsTotal = await Appointment.count(query);
      if (req.body.q !== undefined) {
        query.name = {
          $regex: req.body.q.toString(),
          $options: 'ixs',
        };
      }
      const recordsFiltered = await Appointment.count(query).lean();
      const appointments = await Appointment.find(query)
        .skip(page)
        .limit(limit)
        .lean();
      appointments.forEach((a, i) => (a.sno = page + i + 1));
      return res
        .status(201)
        .json({ appointments, recordsTotal, recordsFiltered });
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
      let requiredResult = await __.checkRequiredFields(req, ['appointmentId']);
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      } else {
        let doc = await Appointment.findOne({
          _id: req.body.appointmentId,
          companyId: req.user.companyId,
          status: {
            $ne: 3,
          },
        });
        if (doc === null) {
          return __.out(res, 300, 'Invalid appointmentId');
        } else {
          let regex = new RegExp(`^${req.body.name.trim()}$`, 'i');
          let duplicate = await Appointment.count({
            name: { $regex: regex },
            status: { $nin: 3 },
            companyId: req.user.companyId,
          });
          if (duplicate !== 0) {
            __.out(res, 300, 'Appointment name already exists');
            return;
          }

          Object.assign(doc, req.body);
          let result = await doc.save();
          if (result === null) {
            return __.out(res, 300, 'Something went wrong');
          } else {
            this.read(req, res);
          }
        }
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async delete(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, ['appointmentId']);
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let appointmentResult = await Appointment.findOne({
          _id: req.body.appointmentId,
          companyId: req.user.companyId,
          status: {
            $ne: 3,
          },
        });
        if (appointmentResult === null) {
          __.out(res, 300, 'Invalid appointmentId');
        } else {
          appointmentResult.status = 3;
          let result = await appointmentResult.save();
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
  async getAppointments(req, res) {
    try {
      let query = {
        $match: {
          status: 1,
          companyId: mongoose.Types.ObjectId(req.user.companyId),
        },
      };
      if (!!req.query && !!req.query.q) {
        query.$match['name'] = {
          $regex: `${req.query.q}`,
          $options: 'is',
        };
      }
      const limit = 300;
      const skip = !!req.query.page ? parseInt(req.query.page) * limit : 0;
      let appointments = await Appointment.aggregate([
        query,
        {
          $project: { name: 1 },
        },
        {
          $sort: {
            name: 1,
          },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]);
      return __.out(res, 201, appointments);
    } catch (error) {
      console.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
}
/* */
appointment = new appointment();
module.exports = appointment;
