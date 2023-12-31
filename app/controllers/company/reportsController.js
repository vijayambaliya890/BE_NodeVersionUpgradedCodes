// Controller Code Starts here
const mongoose = require('mongoose'),
  Shift = require('../../models/shift'),
  User = require('../../models/user'),
  ShiftDetails = require('../../models/shiftDetails'),
  AppliedStaffs = require('../../models/appliedStaff'),
  UserField = require('../../models/userField'),
  moment = require('moment'),
  json2csv = require('json2csv').parse,
  fs = require('fs-extra'),
  _ = require('lodash'),
  __ = require('../../../helpers/globalFunctions'),
  { getName } = require('./businessUnitController');
var fsS = require('fs');
const path = require('path');
const ObjectsToCsv = require('objects-to-csv');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class reports {
  getMondayDate(date) {
    if (date) {
      var curr = new Date(date);
      var firstday = new Date(curr.setDate(curr.getDate() - curr.getDay()));
      return firstday;
    }
    return null;
  }
  getSundayDate(date) {
    if (date) {
      var curr = new Date(date);
      var lastday = new Date(curr.setDate(curr.getDate() - curr.getDay() + 6));
      return lastday;
    }
    return null;
  }
  async bookingsOld(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'businessUnitId',
        'date',
      ]);

      var timeZone = moment
        .parseZone(req.body.date, 'MM-DD-YYYY HH:mm:ss Z')
        .format('Z');
      var weekStartDate = this.getMondayDate(req.body.startDate);
      if (weekStartDate) {
        weekStartDate = new Date(weekStartDate);
        weekStartDate.setDate(weekStartDate.getDate() - 1);
      }
      var weekEndDate = this.getSundayDate(req.body.endDate);
      let query = {
        businessUnitId: {
          $in: req.body.businessUnitId,
        },
        status: 1,
      };
      if (weekStartDate) {
        query.weekRangeStartsAt = {};
        query.weekRangeStartsAt['$gte'] = moment(
          weekStartDate,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
      }
      var shift = await Shift.find(query).select('shiftDetails').lean();

      function plucker(prop) {
        return function (o) {
          return o[prop];
        };
      }
      var shiftDetailsArray = shift.map(plucker('shiftDetails'));
      shiftDetailsArray = _.flatten(shiftDetailsArray);
      shiftDetailsArray = Array.from(new Set(shiftDetailsArray));
      if (shiftDetailsArray.length == 0) {
        this.generateCsv('', [], [], res);
      } else {
        var where = {
          status: 1,
          _id: {
            $in: shiftDetailsArray,
          },
          'appliedStaffs.0': {
            $exists: true,
          },
          date: {},
        };

        if (req.body.startDate) {
          where.date['$gte'] = moment(
            req.body.startDate,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .format();
        }
        if (req.body.endDate) {
          where.date['$lte'] = moment(req.body.endDate, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format();
        }
        if (
          !(
            req.body.hasOwnProperty('startDate') ||
            req.body.hasOwnProperty('endDate')
          )
        ) {
          delete where.date;
        }
        var shifts = await ShiftDetails.find(where)
          .select('appliedStaffs')
          .lean();
        var appliedStaffsArray = shifts.map(plucker('appliedStaffs'));
        appliedStaffsArray = _.flatten(appliedStaffsArray);
        appliedStaffsArray = Array.from(new Set(appliedStaffsArray));
        if (appliedStaffsArray.length == 0) {
          this.generateCsv('', [], [], res);
        } else {
          let match = {
            _id: {
              $in: appliedStaffsArray,
            },
            status: {
              $in: [1, 2] /*only confirmed and standby slots */,
            },
          };
          var staffsShifts = await AppliedStaffs.find(match)
            .populate([
              {
                path: 'flexiStaff',
                select: 'name staffId email contactNumber profilePicture',
              },
              {
                path: 'shiftDetailsId',
                populate: [
                  {
                    path: 'reportLocationId',
                    select: 'name status',
                  },
                  {
                    path: 'subSkillSets',
                    select: 'name status',
                    populate: {
                      path: 'skillSetId',
                      select: 'name status',
                    },
                  },
                  {
                    path: 'requestedShifts',
                    match: {
                      status: {
                        $in: [0, 2],
                      },
                    },
                    populate: {
                      path: 'reportLocationId',
                      select: 'name status',
                    },
                  },
                ],
              },
              {
                path: 'shiftId',
                select: 'businessUnitId plannedBy',
                populate: [
                  {
                    path: 'plannedBy',
                    select: 'name staffId',
                  },
                  {
                    path: 'businessUnitId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
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
                        populate: {
                          path: 'companyId',
                          select: 'name status',
                          match: {
                            status: 1,
                          },
                        },
                      },
                    },
                  },
                ],
              },
            ])
            .lean();
          //res.json({staffsShifts})
          staffsShifts = await _.orderBy(
            staffsShifts,
            ['shiftDetailsId.startTime'],
            ['asc'],
          );
          let jsonArray = [];
          //return res.json(staffsShifts)
          staffsShifts.forEach((element) => {
            if (
              element.shiftId.businessUnitId &&
              element.shiftId.businessUnitId.sectionId &&
              element.shiftId.businessUnitId.sectionId.departmentId &&
              element.shiftId.businessUnitId.sectionId.departmentId.companyId
            ) {
              var json = {};
              json['shiftDetailsId'] = element.shiftDetailsId._id;
              json[
                'businessUnit'
              ] = `${element.shiftId.businessUnitId.sectionId.departmentId.companyId.name} >> ${element.shiftId.businessUnitId.sectionId.departmentId.name} >> ${element.shiftId.businessUnitId.sectionId.name} >> ${element.shiftId.businessUnitId.name}`;
              json['dateOfShift'] = moment
                .utc(element.shiftDetailsId.date)
                .utcOffset(`${timeZone}`)
                .format('DD-MM-YYYY');
              var st = element.shiftDetailsId.startTime;
              var et = element.shiftDetailsId.endTime;
              var isExtendedShift = 'No';
              if (
                element.shiftDetailsId.isExtendedShift &&
                element.shiftDetailsId.extendedStaff.length > 0
              ) {
                var extenedStaff = element.shiftDetailsId.extendedStaff.filter(
                  (ele) => {
                    return (
                      ele.userId.toString() == element.flexiStaff._id.toString()
                    );
                  },
                );
                if (extenedStaff && extenedStaff.length > 0) {
                  isExtendedShift = 'Declined';
                  extenedStaff = extenedStaff[0];
                  if (extenedStaff.confirmStatus == 1) {
                    isExtendedShift = 'Pending';
                  }
                  if (extenedStaff.confirmStatus == 2) {
                    isExtendedShift = 'Accepted';
                    st = extenedStaff.startDateTime;
                    et = extenedStaff.endDateTime;
                  }
                }
              }
              json['startTime'] = moment
                .utc(st)
                .utcOffset(`${timeZone}`)
                .format('DD-MM-YYYY HH:mm');

              json['endTime'] = moment
                .utc(et)
                .utcOffset(`${timeZone}`)
                .format('DD-MM-YYYY HH:mm');

              json['durationInMinutes'] = (
                element.shiftDetailsId.duration * 60
              ).toFixed(2);
              json['isExtendedShift'] = isExtendedShift;
              var skills = [];
              for (let subSkill of element.shiftDetailsId.subSkillSets) {
                skills.push(`${subSkill.skillSetId.name} >> ${subSkill.name}`);
              }
              json['skillSets'] = skills.join(' , ');
              json['reportTo'] = element.shiftDetailsId.reportLocationId.name;
              json['submittedByUserName'] = element.shiftId.plannedBy.name;
              json['submittedByStaffId'] = element.shiftId.plannedBy.staffId;
              json['submittedDateTime'] = moment
                .utc(element.shiftDetailsId.createdAt)
                .utcOffset(`${timeZone}`)
                .format('DD-MM-YYYY HH:mm');

              json['submittedType'] =
                element.shiftDetailsId.adjustedBy &&
                  element.shiftDetailsId.adjustedBy.length > 0
                  ? 'Adjust Shift'
                  : 'Plan Shift';
              json['BookedByUserName'] = element.flexiStaff.name;
              json['BookedByStaffId'] = element.flexiStaff.staffId;
              json['BookingStatus'] =
                element.status == 1 ? 'Confirmed' : 'Standby';
              json['BookedDateTime'] = moment
                .utc(element.createdAt)
                .utcOffset(`${timeZone}`)
                .format('DD-MM-YYYY HH:mm');
              json['BookedDate'] = moment
                .utc(element.createdAt)
                .utcOffset(`${timeZone}`)
                .format('DD-MM-YYYY');
              json['BookedTime'] = moment
                .utc(element.createdAt)
                .utcOffset(`${timeZone}`)
                .format('HH:mm:ss');
              jsonArray.push(json);
            }
          });

          let fieldsArray = [
            'businessUnit',
            'dateOfShift',
            'startTime',
            'endTime',
            'durationInMinutes',
            'isExtendedShift',
            'skillSets',
            'reportTo',
            'submittedByUserName',
            'submittedByStaffId',
            'submittedDateTime',
            'submittedType',
            'BookedByUserName',
            'BookedByStaffId',
            'BookingStatus',
            'BookedDate',
            'BookedTime',
          ];
          //__.out(res, 201 , jsonArray)
          this.generateCsv('bookings_report', jsonArray, fieldsArray, res);
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async bookingsStop(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'businessUnitId',
        'date',
      ]);
      var timeZone = moment
        .parseZone(req.body.date, 'MM-DD-YYYY HH:mm:ss Z')
        .format('Z');
      var weekStartDate = this.getMondayDate(req.body.startDate);
      if (weekStartDate) {
        weekStartDate = new Date(weekStartDate);
        weekStartDate.setDate(weekStartDate.getDate() - 1);
      }
      var weekEndDate = this.getSundayDate(req.body.endDate);
      let query = {
        businessUnitId: {
          $in: req.body.businessUnitId,
        },
        status: 1,
      };
      if (weekStartDate) {
        query.weekRangeStartsAt = {};
        query.weekRangeStartsAt['$gte'] = moment(
          weekStartDate,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
      }
      var shift = await Shift.find(query).select('shiftDetails').lean();

      function plucker(prop) {
        return function (o) {
          return o[prop];
        };
      }
      var shiftDetailsArray = shift.map(plucker('shiftDetails'));
      shiftDetailsArray = _.flatten(shiftDetailsArray);
      shiftDetailsArray = Array.from(new Set(shiftDetailsArray));
      if (shiftDetailsArray.length == 0) {
        this.generateCsv('', [], [], res);
      } else {
        var where = {
          status: 1,
          _id: {
            $in: shiftDetailsArray,
          },
          'appliedStaffs.0': {
            $exists: true,
          },
          isAssignShift: false,
          date: {},
        };

        if (req.body.startDate) {
          where.date['$gte'] = moment(
            req.body.startDate,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .format();
        }

        if (req.body.endDate) {
          where.date['$lte'] = moment(req.body.endDate, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format();
        }

        if (
          !(
            req.body.hasOwnProperty('startDate') ||
            req.body.hasOwnProperty('endDate')
          )
        ) {
          delete where.date;
        }
        var findOrFindOne = ShiftDetails.find(where);
        let staffsShifts = await findOrFindOne
          .populate([
            { path: 'appliedStaffs' },
            {
              path: 'draftId',
              select:
                'shiftRead shiftChangeRequestStatus shiftChangeRequestMessage',
            },
            {
              path: 'shiftId',
              select: '-shiftDetails',
              match: {
                businessUnitId: { $in: req.body.businessUnitId },
              },
              populate: [
                {
                  path: 'plannedBy',
                  select: 'name staffId',
                },
                {
                  path: 'businessUnitId',
                  select:
                    'name adminEmail techEmail shiftCancelHours cancelShiftPermission standByShiftPermission status',
                  match: {
                    status: 1,
                  },
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
                      populate: {
                        path: 'companyId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                  },
                },
              ],
            },
            {
              path: 'reportLocationId',
              select: 'name status',
              match: {
                status: 1,
              },
            },
            {
              path: 'subSkillSets',
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
            },
            {
              path: 'mainSkillSets',
              select: 'name status',
              match: {
                status: 1,
              },
            },
            {
              path: 'confirmedStaffs',
              select:
                'name email contactNumber profilePicture subSkillSets mainSkillSets status,schemeId staffId',
              populate: [
                {
                  path: 'subSkillSets',
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
                },
                {
                  path: 'mainSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
                {
                  path: 'schemeId',
                  select: 'shiftSetup ',
                  match: {
                    status: true,
                  },
                },
              ],
            },
            {
              path: 'backUpStaffs',
              select:
                'name email contactNumber profilePicture mainSkillSets subSkillSets status,schemeId staffId',
              populate: [
                {
                  path: 'subSkillSets',
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
                },
                {
                  path: 'mainSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
                {
                  path: 'schemeId',
                  select: 'shiftSetup',
                  match: {
                    status: true,
                  },
                },
              ],
            },
            {
              path: 'requestedShifts',
            },
            {
              path: 'currentReqShift',
              populate: {
                path: 'reportLocationId',
                select: 'name status',
                match: {
                  status: 1,
                },
              },
            },
            {
              path: 'requestedUsers.userId',
              match: {
                status: 1,
              },
              populate: [
                {
                  path: 'subSkillSets',
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
                },
                {
                  path: 'mainSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
              ],
            },
          ])
          .sort({
            startTime: 1,
          });
        //return res.json({staffsShifts})
        var jsonArray = [];
        staffsShifts.forEach((element) => {
          if (
            element.shiftId.businessUnitId &&
            element.shiftId.businessUnitId.sectionId &&
            element.shiftId.businessUnitId.sectionId.departmentId &&
            element.shiftId.businessUnitId.sectionId.departmentId.companyId
          ) {
            var json = {};
            json['shiftDetailsId'] = element._id;
            json[
              'businessUnit'
            ] = `${element.shiftId.businessUnitId.sectionId.departmentId.companyId.name} >> ${element.shiftId.businessUnitId.sectionId.departmentId.name} >> ${element.shiftId.businessUnitId.sectionId.name} >> ${element.shiftId.businessUnitId.name}`;
            json['dateOfShift'] = moment
              .utc(element.date)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY');
            var st = element.startTime;
            var et = element.endTime;
            var isExtendedShift = 'No';
            if (element.isExtendedShift && element.extendedStaff.length > 0) {
              var extenedStaff = element.extendedStaff.filter((ele) => {
                return (
                  ele.userId.toString() == element.flexiStaff._id.toString()
                );
              });
              if (extenedStaff && extenedStaff.length > 0) {
                isExtendedShift = 'Declined';
                extenedStaff = extenedStaff[0];
                if (extenedStaff.confirmStatus == 1) {
                  isExtendedShift = 'Pending';
                }
                if (extenedStaff.confirmStatus == 2) {
                  isExtendedShift = 'Accepted';
                  st = extenedStaff.startDateTime;
                  et = extenedStaff.endDateTime;
                }
              }
            }
            json['startTime'] = moment
              .utc(st)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY HH:mm');

            json['endTime'] = moment
              .utc(et)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY HH:mm');

            json['durationInMinutes'] = (
              element.shiftDetailsId.duration * 60
            ).toFixed(2);
            json['isExtendedShift'] = isExtendedShift;
            var skills = [];
            for (let subSkill of element.shiftDetailsId.subSkillSets) {
              skills.push(`${subSkill.skillSetId.name} >> ${subSkill.name}`);
            }
            json['skillSets'] = skills.join(' , ');
            json['reportTo'] = element.shiftDetailsId.reportLocationId.name;
            json['submittedByUserName'] = element.shiftId.plannedBy.name;
            json['submittedByStaffId'] = element.shiftId.plannedBy.staffId;
            json['submittedDateTime'] = moment
              .utc(element.shiftDetailsId.createdAt)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY HH:mm');

            json['submittedType'] =
              element.shiftDetailsId.adjustedBy &&
                element.shiftDetailsId.adjustedBy.length > 0
                ? 'Adjust Shift'
                : 'Plan Shift';
            json['BookedByUserName'] = element.flexiStaff.name;
            json['BookedByStaffId'] = element.flexiStaff.staffId;
            json['BookingStatus'] =
              element.status == 1 ? 'Confirmed' : 'Standby';
            json['BookedDateTime'] = moment
              .utc(element.createdAt)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY HH:mm');
            json['BookedDate'] = element.appliedstaffs
              ? moment
                .utc(element.appliedstaffs.createdAt)
                .utcOffset(`${timeZone}`)
                .format('DD-MM-YYYY')
              : '';
            json['BookedTime'] = element.appliedstaffs
              ? moment
                .utc(element.appliedstaffs.createdAt)
                .utcOffset(`${timeZone}`)
                .format('HH:mm:ss')
              : '';
            jsonArray.push(json);
          }
        });

        let fieldsArray = [
          'businessUnit',
          'dateOfShift',
          'startTime',
          'endTime',
          'durationInMinutes',
          'isExtendedShift',
          'skillSets',
          'reportTo',
          'submittedByUserName',
          'submittedByStaffId',
          'submittedDateTime',
          'submittedType',
          'BookedByUserName',
          'BookedByStaffId',
          'BookingStatus',
          'BookedDate',
          'BookedTime',
        ];
        //__.out(res, 201 , jsonArray)
        this.generateCsv('bookings_report', jsonArray, fieldsArray, res);
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async bookings(req, res) {
    try {
      logInfo(`reports/bookings API Start!`, { name: req.user.name, staffId: req.user.staffId });
      if (!__.checkHtmlContent(req.body)) {
        logError(`reports/bookings API, You've entered malicious input `, req.body);
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'businessUnitId',
        'date',
      ]);

      var timeZone = moment
        .parseZone(req.body.date, 'MM-DD-YYYY HH:mm:ss Z')
        .format('Z');
      var weekStartDate = this.getMondayDate(req.body.startDate);
      if (weekStartDate) {
        weekStartDate = new Date(weekStartDate);
        weekStartDate.setDate(weekStartDate.getDate() - 1);
      }
      var weekEndDate = this.getSundayDate(req.body.endDate);
      let query = {
        businessUnitId: {
          $in: req.body.businessUnitId,
        },
        status: 1,
      };
      if (weekStartDate) {
        query.weekRangeStartsAt = {};
        query.weekRangeStartsAt['$gte'] = moment(
          weekStartDate,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
      }
      var shift = await Shift.find(query).select('shiftDetails').lean();

      function plucker(prop) {
        return function (o) {
          return o[prop];
        };
      }
      var shiftDetailsArray = shift.map(plucker('shiftDetails'));
      shiftDetailsArray = _.flatten(shiftDetailsArray);
      shiftDetailsArray = Array.from(new Set(shiftDetailsArray));
      if (shiftDetailsArray.length == 0) {
        this.generateCsv('', [], [], res);
      } else {
        var where = {
          status: 1,
          _id: {
            $in: shiftDetailsArray,
          },
          'appliedStaffs.0': {
            $exists: true,
          },
          isOff: false,
          isRest: false
        };

        if (
          !(
            req.body.hasOwnProperty('startDate') ||
            req.body.hasOwnProperty('endDate')
          )
        ) {
          delete where.date;
        }
        var shifts = await ShiftDetails.find(where)
          .populate([
            {
              path: 'appliedStaffs',
            },
            {
              path: 'reportLocationId',
              select: 'name status',
            },
            {
              path: 'geoReportingLocation',
              select: '_id name'
            },
            {
              path: 'subSkillSets',
              select: 'name status',
              populate: {
                path: 'skillSetId',
                select: 'name status',
              },
            },
            {
              path: 'requestedShifts',
              match: {
                status: {
                  $in: [0, 2],
                },
              },
              populate: {
                path: 'reportLocationId',
                select: 'name status',
              },
            },
            {
              path: 'confirmedStaffs',
              select: 'name staffId email contactNumber profilePicture',
            },
            {
              path: 'shiftId',
              select: 'businessUnitId plannedBy weekRangeStartsAt weekRangeEndsAt createdAt',
              populate: [
                {
                  path: 'plannedBy',
                  select: 'name staffId',
                },
                {
                  path: 'businessUnitId',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
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
                      populate: {
                        path: 'companyId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                  },
                },
              ],
            },
            {
              path: 'cancelledBy.cancelledUserId',
            },
          ])
          .sort({
            startTime: 1,
          });
        var result = [];
        shifts = JSON.parse(JSON.stringify(shifts));
        for (let i = 0; i < shifts.length; i++) {
          var totalConfirm = shifts[i].confirmedStaffs.length;
          var totalCan = shifts[i].cancelledBy.length;
          for (let j = 0; j < totalConfirm; j++) {
            var shift = JSON.parse(JSON.stringify(shifts[i]));
            shift.isConfirmed = true;
            shift.flexiStaff = shift.confirmedStaffs[j];
            const appResult = shifts[i].appliedStaffs.filter((app) => {
              return (
                app.flexiStaff.toString() ==
                shift.confirmedStaffs[j]._id.toString()
              );
            });
            if (appResult && appResult.length > 0) {
              shift.bookedAt = appResult[0].createdAt;
            }
            result.push(shift);
          }
          for (let j = 0; j < totalCan; j++) {
            var shiftC = JSON.parse(JSON.stringify(shifts[i]));
            shiftC.isConfirmed = false;
            shiftC.flexiStaff = shiftC.cancelledBy[j].cancelledUserId;
            result.push(shiftC);
          }
        }
        var total = result.length;
        let jsonArray = [];
        let fieldsArray = [
          'businessUnit',
          'dateOfShift',
          'startTime',
          'endTime',
          'SplitStartTime',
          'SplitEndTime',
          'durationInMinutes',
          'isExtendedShift',
          'skillSets',
          'reportTo',
          'submittedByUserName',
          'submittedByStaffId',
          'submittedDateTime',
          'submittedType',
          'BookedByUserName',
          'BookedByStaffId',
          'BookingStatus',
          'BookedDate',
          'BookedTime',
        ];
        for (var i = 0; i < total; i++) {
          var element = result[i];
          if (
            element.shiftId.businessUnitId &&
            element.shiftId.businessUnitId.sectionId &&
            element.shiftId.businessUnitId.sectionId.departmentId &&
            element.shiftId.businessUnitId.sectionId.departmentId.companyId && element.isParent !== 2
          ) {
            var json = {};
            json['createdAt'] = moment
              .utc(element.shiftId.createdAt)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY HH:mm');
            json['shiftId'] = element.shiftId._id;
            json['shiftDetailsId'] = element._id;
            json[
              'businessUnit'
            ] = `${element.shiftId.businessUnitId.sectionId.departmentId.companyId.name} >> ${element.shiftId.businessUnitId.sectionId.departmentId.name} >> ${element.shiftId.businessUnitId.sectionId.name} >> ${element.shiftId.businessUnitId.name}`;
            json['weekRangeStart'] = moment
              .utc(element.shiftId.weekRangeStartsAt)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY');
            json['weekRangeEnd'] = moment
              .utc(element.shiftId.weekRangeEndsAt)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY');
            json['dateOfShift'] = moment
              .utc(element.date)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY');
            var st = element.startTime;
            var et = element.endTime;
            var isExtendedShift = 'No';
            if (element.isExtendedShift && element.extendedStaff.length > 0) {
              var extenedStaff = element.extendedStaff.filter((ele) => {
                return (
                  ele.userId.toString() == element.flexiStaff._id.toString()
                );
              });
              if (extenedStaff && extenedStaff.length > 0) {
                isExtendedShift = 'Declined';
                extenedStaff = extenedStaff[0];
                if (extenedStaff.confirmStatus == 1) {
                  isExtendedShift = 'Pending';
                }
                if (extenedStaff.confirmStatus == 2) {
                  isExtendedShift = 'Accepted';
                  st = extenedStaff.startDateTime;
                  et = extenedStaff.endDateTime;
                }
              }
            }
            json['startTime'] = st
              ? moment
                .utc(st)
                .utcOffset(`${timeZone}`)
                .format('DD-MM-YYYY HH:mm')
              : '';

            json['endTime'] = et
              ? moment
                .utc(et)
                .utcOffset(`${timeZone}`)
                .format('DD-MM-YYYY HH:mm')
              : '';

            json['SplitStartTime'] = '';
            json['SplitEndTime'] = '';
            json['durationInMinutes'] = element.duration
              ? (element.duration * 60).toFixed(2)
              : 0;
            if (element.isSplitShift) {
              const splitShiftSecond = result.filter(
                (record) =>
                  record.randomShiftId && record?.randomShiftId?.toString() === element?.randomShiftId?.toString() &&
                  record.isParent === 2,
              );
              if (splitShiftSecond.length) {
                json['SplitStartTime'] = moment
                  .utc(splitShiftSecond[0].startTime)
                  .utcOffset(`${timeZone}`)
                  .format('DD-MM-YYYY HH:mm');
                json['SplitEndTime'] = moment
                  .utc(splitShiftSecond[0].endTime)
                  .utcOffset(`${timeZone}`)
                  .format('DD-MM-YYYY HH:mm');
                json['durationInMinutes'] = parseFloat(json['durationInMinutes']) + parseFloat((splitShiftSecond[0].duration
                  ? (splitShiftSecond[0].duration * 60).toFixed(2)
                  : 0));
              } else {
                json['SplitStartTime'] = 'Some Error';
                json['SplitEndTime'] = 'Some Error';
              }
            }
            json['isExtendedShift'] = isExtendedShift;
            json['totalStaffNeedCount'] = element.totalStaffNeedCount;
            json['backUpStaffNeedCount'] = element.backUpStaffNeedCount;
            json['totalApplied'] = element.appliedStaffs.length;
            json['totalConfirmed'] = element.confirmedStaffs.length;
            var skills = [];
            for (let subSkill of element.subSkillSets) {
              skills.push(`${subSkill.skillSetId.name} >> ${subSkill.name}`);
            }
            json['skillSets'] = skills.join(' , ');
            json['reportTo'] = element.reportLocationId
              ? element.reportLocationId.name
              : element.geoReportingLocation.name;
            json['submittedByUserName'] = element.shiftId.plannedBy.name;
            json['submittedByStaffId'] = element.shiftId.plannedBy.staffId;
            json['submittedDateTime'] = moment
              .utc(element.createdAt)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY HH:mm');

            json['submittedType'] =
              element.adjustedBy && element.adjustedBy.length > 0
                ? 'Adjust Shift'
                : 'Plan Shift';
            if (element.isConfirmed) {
              json['BookedByUserName'] = element.flexiStaff.name;
              json['BookedByStaffId'] = element.flexiStaff.staffId;
            } else {
              json['BookedByUserName'] = element.flexiStaff.name;
              json['BookedByStaffId'] = element.flexiStaff.staffId;
            }

            json['BookingStatus'] =
              element.isConfirmed == true ? 'Confirmed' : 'Cancelled';
            json['BookedDate'] = element.bookedAt
              ? moment
                .utc(element.bookedAt)
                .utcOffset(`${timeZone}`)
                .format('DD-MM-YYYY')
              : '';
            json['BookedTime'] = element.bookedAt
              ? moment
                .utc(element.bookedAt)
                .utcOffset(`${timeZone}`)
                .format('HH:mm:ss')
              : '';
            jsonArray.push(json);
          }
        }

        logInfo(`reports/bookings API ends here!`, { name: req.user.name, staffId: req.user.staffId });
        if (jsonArray.length == 0) {
          this.generateCsv('', [], [], res);
        } else {
          this.generateCsv('bookings_report', jsonArray, fieldsArray, res);
        }
      }
    } catch (err) {
      logError(`reports/bookings API, there is an error`, err.toString());
      __.out(res, 500);
    }
  }
  async listOfShifts(req, res) {
    try {
      logInfo(`reports/listofshifts API Start!`, { name: req.user.name, staffId: req.user.staffId });
      if (!__.checkHtmlContent(req.body)) {
        logError(`reports/listofshifts API, You've entered malicious input `, req.body);
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, [
        'businessUnitId',
        'date',
      ]);

      if (requiredResult.status === false) {
        logError(`reports/listofshifts API, Required fields missing `, requiredResult.missingFields);
        logError(`reports/listofshifts API, request payload `, req.body);
        __.out(res, 400, requiredResult.missingFields);
      } else {
        var timeZone = moment
          .parseZone(req.body.date, 'MM-DD-YYYY HH:mm:ss Z')
          .format('Z');

        let match = {
          businessUnitId: {
            $in: req.body.businessUnitId,
          },
          status: 1,
          date: {},
        };
        if (req.body.startDate) {
          match.date['$gte'] = moment(
            req.body.startDate,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .startOf('day')
            .utc()
            .format();
        }

        if (req.body.endDate) {
          match.date['$lte'] = moment(req.body.endDate, 'MM-DD-YYYY HH:mm:ss Z')
            .endOf('day')
            .utc()
            .format();
        }

        if (
          !(
            req.body.hasOwnProperty('startDate') ||
            req.body.hasOwnProperty('endDate')
          )
        ) {
          delete match.date;
        }
        var jsonArray = [],
          shiftResult = await this.shifts(match);

        shiftResult.forEach((element) => {
          if (
            element.shiftId &&
            element.shiftId.businessUnitId &&
            element.shiftId.businessUnitId.sectionId &&
            element.shiftId.businessUnitId.sectionId.departmentId &&
            element.shiftId.businessUnitId.sectionId.departmentId.companyId &&
            element.isParent !== 2
          ) {
            var json = {};
            json[
              'businessUnit'
            ] = `${element.shiftId.businessUnitId.sectionId.departmentId.companyId.name} >> ${element.shiftId.businessUnitId.sectionId.departmentId.name} >> ${element.shiftId.businessUnitId.sectionId.name} >> ${element.shiftId.businessUnitId.name}`;
            json['dateOfShift'] = moment
              .utc(element.date)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY');

            json['startTime'] = moment
              .utc(element.startTime)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY HH:mm');

            json['endTime'] = moment
              .utc(element.endTime)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY HH:mm');

            json['durationInMinutes'] = element.duration
              ? (element.duration * 60).toFixed(2)
              : 0;

            if (element.isSplitShift) {
              const splitShiftSecond = shiftResult.filter(
                (record) =>
                  record.randomShiftId && record?.randomShiftId?.toString() === element?.randomShiftId?.toString() &&
                  record.isParent === 2,
              );
              if (splitShiftSecond.length) {
                json['SplitStartTime'] = moment
                  .utc(splitShiftSecond[0].startTime)
                  .utcOffset(`${timeZone}`)
                  .format('DD-MM-YYYY HH:mm');
                json['SplitEndTime'] = moment
                  .utc(splitShiftSecond[0].endTime)
                  .utcOffset(`${timeZone}`)
                  .format('DD-MM-YYYY HH:mm');
                json['durationInMinutes'] = parseFloat(json['durationInMinutes']) + parseFloat((splitShiftSecond[0].duration
                  ? (splitShiftSecond[0].duration * 60).toFixed(2)
                  : 0));
              } else {
                json['SplitStartTime'] = 'Some Error';
                json['SplitEndTime'] = 'Some Error';
              }
            }

            var skills = [];
            for (let subSkill of element.subSkillSets) {
              skills.push(`${subSkill.skillSetId.name} >> ${subSkill.name}`);
            }
            json['skillSets'] = skills.join(' , ');
            json['reportTo'] = element.reportLocationId
              ? element.reportLocationId.name
              : '';
            json['numberOfConfirmedStaff'] = element.staffNeedCount;
            json['numberOfBackupStaff'] = element.backUpStaffNeedCount;
            json['submittedByStaffName'] =
              element.shiftId && element.shiftId.plannedBy
                ? element.shiftId.plannedBy.name
                : '';

            json['submittedByStaffId'] =
              element.shiftId && element.shiftId.plannedBy
                ? element.shiftId.plannedBy.staffId
                : '';

            json['submittedDateTime'] = moment
              .utc(element.createdAt)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY HH:mm');

            json['submittedType'] =
              element.adjustedBy && element.adjustedBy.length > 0
                ? 'Adjust Shift'
                : 'Plan Shift';

            json['NumberOfConfirmedShiftBooked'] =
              element.confirmedStaffs.length;
            json['NumberOfStandByShiftBooked'] = element.backUpStaffs.length;
            json['reportGeneratedByName'] = req.user.name;
            json['reportGeneratedByStaffId'] = req.user.staffId;
            json['reportGeneratedByDateTime'] = moment()
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY HH:mm');
            if (
              element.adjustedBy
                ? element.adjustedBy.length > 0
                  ? true
                  : false
                : false
            ) {
              element.adjustedBy.forEach((eachAdjust) => {
                json['shiftAdjustedByStaffId'] = eachAdjust.adjustedUserId
                  ? eachAdjust.adjustedUserId.staffId
                  : '';
                json['shiftAdjustedByName'] = eachAdjust.adjustedUserId
                  ? eachAdjust.adjustedUserId.name
                  : '';
                json['adjustedDateTime'] = moment
                  .utc(eachAdjust.createdAt)
                  .utcOffset(`${timeZone}`)
                  .format('DD-MM-YYYY HH:mm');

                json['adjustedTo'] = eachAdjust.increasedStaffCount;
                jsonArray.push(json);
              });
            } else {
              jsonArray.push(json);
            }
          }
        });
        let fieldsArray = [
          'businessUnit',
          'dateOfShift',
          'startTime',
          'endTime',
          'SplitStartTime',
          'SplitEndTime',
          'durationInMinutes',
          'skillSets',
          'reportTo',
          'numberOfConfirmedStaff',
          'numberOfBackupStaff',
          'submittedByStaffName',
          'submittedByStaffId',
          'submittedDateTime',
          'submittedType',
          'adjustedTo',
          'shiftAdjustedByStaffId',
          'shiftAdjustedByName',
          'adjustedDateTime',
          'NumberOfConfirmedShiftBooked',
          'NumberOfStandByShiftBooked',
          'reportGeneratedByName',
          'reportGeneratedByStaffId',
          'reportGeneratedByDateTime',
        ];
        logInfo(`reports/listofshifts API ends here!`, { name: req.user.name, staffId: req.user.staffId });
        this.generateCsv('shifts_list', jsonArray, fieldsArray, res);
      }
    } catch (err) {
      logError(`reports/listofshifts API, there is an error`, err.toString());
      __.out(res, 500);
    }
  }
  async listOfCancellations(req, res) {
    try {
      logInfo(`reports/listofcancellations API Start!`, { name: req.user.name, staffId: req.user.staffId });
      if (!__.checkHtmlContent(req.body)) {
        logError(`reports/listofcancellations API, You've entered malicious input `, req.body);
        return __.out(res, 300, `You've entered malicious input`);
      }
      __.log(req.body, 'listOfCancellations');
      let requiredResult = await __.checkRequiredFields(req, [
        'businessUnitId',
        'date',
      ]);
      if (requiredResult.status === false) {
        logError(`reports/listofcancellations API, Required fields missing `, requiredResult.missingFields);
        logError(`reports/listofcancellations API, request payload `, req.body);
        __.out(res, 400, requiredResult.missingFields);
      } else {
        var timeZone = moment
          .parseZone(req.body.date, 'MM-DD-YYYY HH:mm:ss Z')
          .format('Z');

        let match = {
          businessUnitId: {
            $in: req.body.businessUnitId,
          },
          status: 1,
          cancelledBy: {
            $gt: [],
          },
          date: {},
        };

        var cancelMinutes = 0;
        if (req.body.cancelHours) {
          cancelMinutes = req.body.cancelHours * 60;
          match['cancelledBy.minutesToShiftStartTime'] = {
            $lte: cancelMinutes,
          };
        }
        if (req.body.startDate) {
          match.date['$gte'] = moment(
            req.body.startDate,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .startOf('day')
            .utc()
            .format();
        }
        if (req.body.endDate) {
          match.date['$lte'] = moment(req.body.endDate, 'MM-DD-YYYY HH:mm:ss Z')
            .endOf('day')
            .utc()
            .format();
        }
        if (
          !(
            req.body.hasOwnProperty('startDate') ||
            req.body.hasOwnProperty('endDate')
          )
        ) {
          delete match.date;
        }
        var jsonArray = [],
          shiftResult = await this.shifts(match);

        shiftResult.map((element) => {
          if (
            element.shiftId &&
            element.shiftId.businessUnitId &&
            element.shiftId.businessUnitId.sectionId &&
            element.shiftId.businessUnitId.sectionId.departmentId &&
            element.shiftId.businessUnitId.sectionId.departmentId.companyId &&
            element.isParent !== 2
          ) {
            var json = {};
            json[
              'businessUnit'
            ] = `${element.shiftId.businessUnitId.sectionId.departmentId.companyId.name} >> ${element.shiftId.businessUnitId.sectionId.departmentId.name} >> ${element.shiftId.businessUnitId.sectionId.name} >> ${element.shiftId.businessUnitId.name}`;
            json['dateOfShift'] = moment
              .utc(element.date)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY');

            json['startTime'] = moment
              .utc(element.startTime)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY HH:mm');

            json['endTime'] = moment
              .utc(element.endTime)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY HH:mm');

            json['SplitStartTime'] = '';
            json['SplitEndTime'] = '';
            json['durationInMinutes'] = element.duration
              ? (element.duration * 60).toFixed(2)
              : 0;
            if (element.isSplitShift) {
              const splitShiftSecond = shiftResult.filter(
                (record) =>
                  record.randomShiftId && record?.randomShiftId?.toString() === element?.randomShiftId?.toString() &&
                  record.isParent === 2,
              );
              if (splitShiftSecond.length) {
                json['SplitStartTime'] = moment
                  .utc(splitShiftSecond[0].startTime)
                  .utcOffset(`${timeZone}`)
                  .format('DD-MM-YYYY HH:mm');
                json['SplitEndTime'] = moment
                  .utc(splitShiftSecond[0].endTime)
                  .utcOffset(`${timeZone}`)
                  .format('DD-MM-YYYY HH:mm');
                json['durationInMinutes'] = parseFloat(json['durationInMinutes']) + parseFloat((splitShiftSecond[0].duration
                  ? (splitShiftSecond[0].duration * 60).toFixed(2)
                  : 0));
              } else {
                json['SplitStartTime'] = 'Some Error';
                json['SplitEndTime'] = 'Some Error';
              }
            }

            var skills = [];
            json['reportTo'] = element.reportLocationId
              ? element.reportLocationId.name
              : '';
            json['submittedByStaffName'] =
              element.shiftId && element.shiftId.plannedBy
                ? element.shiftId.plannedBy.name
                : '';

            json['submittedByStaffId'] =
              element.shiftId && element.shiftId.plannedBy
                ? element.shiftId.plannedBy.staffId
                : '';

            json['submittedDateTime'] = moment
              .utc(element.createdAt)
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY HH:mm');

            json['submittedType'] =
              element.adjustedBy && element.adjustedBy.length > 0
                ? 'Adjust Shift'
                : 'Plan Shift';
            if (req.body.cancelHours) {
              element.cancelledBy.map(eachCancel => {
                // Check Below the Given Hours 
                if (eachCancel.minutesToShiftStartTime <= cancelMinutes) {
                  json['cancellationDateTime'] = moment
                    .utc(eachCancel.createdAt)
                    .utcOffset(`${timeZone}`)
                    .format('DD-MM-YYYY HH:mm');
                  json['bookingMadeByStaffId'] = eachCancel.cancelledUserId
                    ? eachCancel.cancelledUserId.staffId
                    : '';
                  json['bookingMadeByName'] = eachCancel.cancelledUserId
                    ? eachCancel.cancelledUserId.name
                    : '';
                  json['durationToShiftStartTime'] = eachCancel.minutesToShiftStartTime;
                  jsonArray.push(_.cloneDeep(json));
                }
              });
            } else {
              element.cancelledBy.map(eachCancel => {
                // Check Below the Given Hours 
                json['cancellationDateTime'] = moment
                  .utc(eachCancel.createdAt)
                  .utcOffset(`${timeZone}`)
                  .format('DD-MM-YYYY HH:mm');
                json['bookingMadeByStaffId'] = eachCancel.cancelledUserId
                  ? eachCancel.cancelledUserId.staffId
                  : '';
                json['bookingMadeByName'] = eachCancel.cancelledUserId
                  ? eachCancel.cancelledUserId.name
                  : '';
                json['durationToShiftStartTime'] = eachCancel.minutesToShiftStartTime;
                jsonArray.push(_.cloneDeep(json));
              });
            }
          }
        });
        let fieldsArray = [
          'businessUnit',
          'dateOfShift',
          'startTime',
          'endTime',
          'SplitStartTime',
          'SplitEndTime',
          'durationInMinutes',
          'reportTo',
          'submittedByStaffName',
          'submittedByStaffId',
          'submittedDateTime',
          'submittedType',
          'bookingMadeByStaffId',
          'bookingMadeByName',
          'cancellationDateTime',
          'durationToShiftStartTime',
        ];
        logInfo(`reports/listofcancellations API ends here!`, { name: req.user.name, staffId: req.user.staffId });
        this.generateCsv('cancelled_shifts', jsonArray, fieldsArray, res);
      }
    } catch (err) {
      logError(`reports/listofcancellations API, there is an error`, err.toString());
      __.out(res, 500);
    }
  }
  async shifts(where, res) {
    try {
      var businessUnitId = where.businessUnitId;
      delete where.businessUnitId;
      return await ShiftDetails.find(where)
        .populate([
          {
            path: 'shiftId',
            select: '-shiftDetails',
            match: {
              businessUnitId: businessUnitId,
            },
            populate: [
              {
                path: 'plannedBy',
                select: 'name staffId',
              },
              {
                path: 'businessUnitId',
                select: 'name status',
                match: {
                  status: 1,
                },
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
                    populate: {
                      path: 'companyId',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                    },
                  },
                },
              },
            ],
          },
          {
            path: 'reportLocationId',
            select: 'name status',
            match: {
              status: 1,
            },
          },
          {
            path: 'adjustedBy.adjustedUserId',
            select: 'name staffId',
            match: {
              status: 1,
            },
          },
          {
            path: 'cancelledBy.cancelledUserId',
            select: 'name staffId',
            match: {
              status: 1,
            },
          },
          {
            path: 'subSkillSets',
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
          },
        ])
        .lean();
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async users(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult = await __.checkRequiredFields(req, ['date']);
      __.log(req.body, 'reports/users');
      // Company's Custom Fields
      let customFields = await UserField.find({
        companyId: req.user.companyId,
        status: 1,
      })
        .sort({
          indexNum: 1,
        })
        .select('_id fieldName')
        .lean();
      let match = {};
      if (req.body.businessUnitId && req.body.businessUnitId.length) {
        match.parentBussinessUnitId = {
          $in: req.body.businessUnitId,
        };
      }
      if (req.body.status) {
        req.body.status = parseInt(req.body.status);
        if (req.body.status === 3) {
          match.status = {
            $in: [1, 2],
          };
        } else {
          match.status = req.body.status;
        }
      }
      if (req.body.skillsets && req.body.skillsets.length) {
        match.subSkillSets = {
          $in: [...req.body.skillsets],
        };
      }
      if (req.body.role) {
        match.role = req.body.role;
      }
      if (req.body.appointmentId && req.body.appointmentId.length) {
        match.appointmentId = {
          $in: req.body.appointmentId,
        };
      }
      if (
        req.body.doj &&
        (req.body.doj.hasOwnProperty('startDate') ||
          req.body.doj.hasOwnProperty('endDate'))
      ) {
        const doj = req.body.doj;
        match.doj = {};
        if (doj.startDate) {
          match.doj['$gte'] = moment(doj.startDate, 'MM-DD-YYYY HH:mm:ss Z')
            .startOf('day')
            .utc()
            .format();
        }
        if (doj.endDate) {
          match.doj['$lte'] = moment(doj.endDate, 'MM-DD-YYYY HH:mm:ss Z')
            .endOf('day')
            .utc()
            .format();
        }
      }

      if (
        req.body.airportPassExpiryDate &&
        (req.body.airportPassExpiryDate.hasOwnProperty('startDate') ||
          req.body.airportPassExpiryDate.hasOwnProperty('endDate'))
      ) {
        const exp = req.body.airportPassExpiryDate;
        match.airportPassExpiryDate = {};
        if (exp.startDate) {
          match.airportPassExpiryDate['$gte'] = moment(
            exp.startDate,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .startOf('day')
            .utc()
            .format();
        }
        if (exp.endDate) {
          match.airportPassExpiryDate['$lte'] = moment(
            exp.endDate,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .endOf('day')
            .utc()
            .format();
        }
      }
      var isDataLarge = false;
      let users = [];
      
      if (!isDataLarge) {
        users = await User.find(match)
          .populate([
            {
              path: 'parentBussinessUnitId',
              select: 'name status allBUAccess',
              match: {
                status: 1,
              },
              populate: {
                path: 'sectionId',
                match: {
                  status: 1,
                },
                select: 'name',
                populate: {
                  path: 'departmentId',
                  match: {
                    status: 1,
                  },
                  select: 'name',
                  populate: {
                    path: 'companyId',
                    match: {
                      status: 1,
                    },
                    select: 'name',
                  },
                },
              },
            },
            {
              path: 'subSkillSets',
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
            },
            {
              path: 'role',
              select: 'name status',
              match: {
                status: 1,
              },
            },
            {
              path: 'appointmentId',
              select: 'name status',
              match: {
                status: 1,
              },
            },
            {
              path: 'viewBussinessUnitId',
              select: 'name status',
              match: {
                status: 1,
              },
            },
            {
              path: 'planBussinessUnitId',
              select: 'name status',
              match: {
                status: 1,
              },
              populate: {
                path: 'sectionId',
                match: {
                  status: 1,
                },
                select: 'name',
                populate: {
                  path: 'departmentId',
                  match: {
                    status: 1,
                  },
                  select: 'name',
                  populate: {
                    path: 'companyId',
                    match: {
                      status: 1,
                    },
                    select: 'name',
                  },
                },
              },
            },
            {
              path: 'leaveGroupId',
              select: 'name',
            },
          ])
          .lean();
      }
      let jsonArray = [];
      let timeZone = moment
        .parseZone(req.body.date, 'MM-DD-YYYY HH:mm:ss Z')
        .format('Z');

      const loggedData = [
        'Logged',
        'Non logged',
        'CountryCode',
        'PrimaryMobileNumber',
      ];
      var tt = 0;
      for (let v of users) {
        let json = {};
        json['staffName'] = v.name;
        json['staffId'] = v.staffId;
        json['leave Group'] = v.leaveGroupId ? v.leaveGroupId.name : '';
        json['appointment'] = v.appointmentId ? v.appointmentId.name : '';
        json['contact'] = v.contactNumber;
        json['email'] = v.email;
        json['role'] = v.role ? v.role.name : '';
        json['skillSets'] = v.subSkillSets
          .reduce((acc, x) => {
            acc.push(`${x.skillSetId.name} >> ${x.name}`);
            return acc;
          }, [])
          .join(' , ');
        json['All BU Access'] = v.allBUAccess ? 'Has Access' : 'No Access';
        json['Company'] = v.parentBussinessUnitId
          ? v.parentBussinessUnitId.sectionId.departmentId.companyId.name
          : '';
        json['Departments'] = v.parentBussinessUnitId
          ? v.parentBussinessUnitId.sectionId.departmentId.name
          : '';
        json['Section'] = v.parentBussinessUnitId
          ? v.parentBussinessUnitId.sectionId.name
          : '';
        json['Subsection'] = v.parentBussinessUnitId
          ? v.parentBussinessUnitId.name
          : '';
        const getFullBU = (businessUnit) =>
          `${businessUnit.sectionId.departmentId.companyId.name}>${businessUnit.sectionId.departmentId.name}>${businessUnit.sectionId.name}>${businessUnit.name}`;
        json['businessUnitParent'] = v.parentBussinessUnitId
          ? getFullBU(v.parentBussinessUnitId)
          : '';
        json['businessUnitPlan'] =
          v.planBussinessUnitId &&
            Array.isArray(v.planBussinessUnitId) &&
            v.planBussinessUnitId.length
            ? v.planBussinessUnitId.map(getFullBU).join(',')
            : '';

        json[loggedData[0]] = v.loggedIn ? 1 : 0;
        json[loggedData[1]] = !!json[loggedData[0]] ? 0 : 1;
        json[loggedData[2]] = v.countryCode || '';
        json[loggedData[3]] = v.primaryMobileNumber || '';
        for (let elem of customFields) {
          json[elem.fieldName] = '';
          v.otherFields = v.otherFields || [];
          for (let elemField of v.otherFields) {
            if (elem._id.equals(elemField.fieldId)) {
              json[elem.fieldName] = elemField.value;
            }
          }
        }
        jsonArray.push(json);
      }

      let fieldsArray = [
        'staffName',
        'staffId',
        'leave Group',
        'appointment',
        'contact',
        'email',
        'role',
        'businessUnitParent',
        'All BU Access',
        'Company',
        'Departments',
        'Section',
        'Subsection',
        'skillSets',
        'businessUnitPlan',
        'businessUnitView',
      ];

      // Custom Fields
      for (let elem of customFields) {
        fieldsArray.push(elem.fieldName);
      }
      fieldsArray.push(...loggedData);
      var dir = path.join(
        __dirname + '/../../../public/uploads/reportsDownloads/',
      );
      if (!fsS.existsSync(dir)) {
        fsS.mkdirSync(dir, { recursive: true });
      }
      let fileName = `users_list_${Math.random()
        .toString(36)
        .substr(2, 10)}.csv`;
      dir = dir + fileName;
      const csv = new ObjectsToCsv(jsonArray);
      await csv.toDisk(dir);
      return __.out(res, 201, {
        csvLink: `/uploads/reportsDownloads/${fileName}`,
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async generateCsv(csvType, jsonArray, fieldsArray, res) {
    try {
      var csvLink = '';
      if (jsonArray.length !== 0) {
        var csv = json2csv(jsonArray, fieldsArray);
        let fileName = `${csvType}_${Math.random().toString(36).substr(2, 10)}`;
        fs.writeFile(
          `./public/uploads/reportsDownloads/${fileName}.csv`,
          csv,
          (err) => {
            if (err) {
              __.log('json2csv err' + err);
              __.out(res, 500);
            } else {
              csvLink = `uploads/reportsDownloads/${fileName}.csv`;
              __.out(res, 201, {
                csvLink: csvLink,
              });
            }
          },
        );
      } else {
        __.out(res, 201, {
          csvLink: csvLink,
        });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
}

reports = new reports();
module.exports = reports;
