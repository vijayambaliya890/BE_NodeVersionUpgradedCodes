// Controller Code Starts here
const mongoose = require('mongoose'),
  Template = require('../../models/template'),
  shiftController = require('./shiftController'),
  shiftLogController = require('./shiftLogController'),
  businessUnitController = require('./businessUnitController'),
  moment = require('moment'),
  _ = require('lodash'),
  { logInfo, logError } = require('../../../helpers/logger.helper'),
  __ = require('../../../helpers/globalFunctions');

class template {
  async createOrUpdate(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        logError(`template/create API, there is something wrong in request payload`, req.body);
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult1 = await __.checkRequiredFields(
        req,
        ['businessUnitId', 'weekRangeStartsAt', 'weekRangeEndsAt', 'shifts'],
        'shift',
      );
      if (requiredResult1.status === false) {
        logError(`template/create API, Required fields missing `, requiredResult1.missingFields);
        logError(`template/create API, request payload `, req.body);
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        // Formatting Shift based on below functionalities
        let shiftsNewFormat = [];
        let isSplitShift = false;
        let separateShiftPerDay = function () {
          console.log('issp');
          for (let elementData of req.body.shifts) {
            const uniqueId = new mongoose.Types.ObjectId();
            for (let elem of elementData.dayDate) {
              if (elem.isSplitShift) {
                isSplitShift = true;
              }

              let shiftSeparated = {
                subSkillSets: elementData.subSkillSets,
                mainSkillSets: elementData.mainSkillSets,
                skillSetTierType: elementData.skillSetTierType,
                staffNeedCount: elementData.staffNeedCount,
                backUpStaffNeedCount: elementData.backUpStaffNeedCount || 0,
                date: elem.date,
                day: elem.day,
                isSplitShift: elem.isSplitShift,
                startTime: elem.startTime,
                endTime: elem.endTime,
                reportLocationId: elementData.reportLocationId,
                status: elementData.status,
                splitStartTime: elem.splitStartTime,
                splitEndTime: elem.splitEndTime,
                _id: new mongoose.Types.ObjectId(),
                uniqueId,
              };
              shiftsNewFormat.push(shiftSeparated);
            }
          }
          req.body.shifts = shiftsNewFormat;
        };
        if (req.body.platform && req.body.platform == 'web') {
          separateShiftPerDay();
        }
        let requiredResult2;
        /*check required fields in shifts array of objects */
        if (req.body.skillSetTierType != 1) {
          requiredResult2 = await __.customCheckRequiredFields(
            req.body.shifts,
            [
              'subSkillSets',
              'staffNeedCount',
              'backUpStaffNeedCount',
              'date',
              'startTime',
              'endTime',
              'reportLocationId',
              'status',
            ],
            'shiftDetails',
          );
        } else {
          requiredResult2 = await __.customCheckRequiredFields(
            req.body.shifts,
            [
              'mainSkillSets',
              'staffNeedCount',
              'backUpStaffNeedCount',
              'date',
              'startTime',
              'endTime',
              'reportLocationId',
              'status',
            ],
            'shiftDetails',
          );
        }
        if (requiredResult2.status === false) {
          logError(`template/create API, Required fields missing `, requiredResult2.missingFields);
          logError(`template/create API, request payload `, req.body);
          __.out(res, 400, requiredResult2.missingFields);
        } else {
          /*compose the date variables */
          var weekRangeStartsAt = moment(
            req.body.weekRangeStartsAt,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .format(),
            weekRangeEndsAt = moment(
              req.body.weekRangeEndsAt,
              'MM-DD-YYYY HH:mm:ss Z',
            )
              .utc()
              .format(),
            weekNumber = await __.weekNoStartWithMonday(weekRangeStartsAt);

          var composeShiftsFn = (shifts) => {
            let composedShiftsArray = [];
            for (let shiftObj of shifts) {
              /*converting to utc time */
              console.log('shiftObj.date', shiftObj.date);
              shiftObj.date = moment(shiftObj.date, 'MM-DD-YYYY HH:mm:ss Z')
                .utc()
                .format();
              shiftObj.startTime = moment(
                shiftObj.startTime,
                'MM-DD-YYYY HH:mm:ss Z',
              )
                .utc()
                .format();
              shiftObj.endTime = moment(
                shiftObj.endTime,
                'MM-DD-YYYY HH:mm:ss Z',
              )
                .utc()
                .format();
              shiftObj.startTimeInSeconds = moment(shiftObj.startTime).unix();
              shiftObj.endTimeInSeconds = moment(shiftObj.endTime).unix();
              shiftObj.totalStaffNeedCount =
                Number(shiftObj.staffNeedCount) +
                Number(shiftObj.backUpStaffNeedCount);
              shiftObj.isSplitShift = shiftObj.isSplitShift;
              //  __.log(shiftObj, "shiftObj------>")
              console.log('shiftObj.dateshiftObj.date', shiftObj.date);
              composedShiftsArray.push(shiftObj);
            }
            return composedShiftsArray;
          };

          var composedShifts = await composeShiftsFn(req.body.shifts);
          var insertOrUpdateObj = {
            businessUnitId: req.body.businessUnitId,
            weekNumber: weekNumber,
            weekRangeStartsAt: weekRangeStartsAt,
            weekRangeEndsAt: weekRangeEndsAt,
            plannedBy: req.user._id,
            isSplitShift: isSplitShift,
            shifts: composedShifts,
            status: 1,
          };
          var statusLogData = {
            userId: req.user._id,
            weekNumber: weekNumber,
            weekRangeStartsAt: weekRangeStartsAt,
            weekRangeEndsAt: weekRangeEndsAt,
            /*template edited */
            businessUnitId: req.body.businessUnitId,
          };
          if (req.body.templateId) {
            /*update */
            var templateId = {
              _id: req.body.templateId,
            };
            delete req.body.templateId;
            delete insertOrUpdateObj.name;
            let templateDoc = await Template.findOneAndUpdate(
              templateId,
              {
                $set: insertOrUpdateObj,
              },
              {
                new: true,
                setDefaultsOnInsert: true,
              },
            );
            req.body.templateId = templateDoc._id;
            statusLogData.status = 4; /*temaplate updated */
          } else {
            /*insert */
            delete req.body.templateId;
            var countTemplatesForGivenWeek = await Template.count({
              plannedBy: req.user._id,
              businessUnitId: req.body.businessUnitId,
            }).lean();
            var data = {
              businessUnitId: req.body.businessUnitId,
            },
              timeZone = moment
                .parseZone(req.body.weekRangeStartsAt, 'MM-DD-YYYY HH:mm:ss Z')
                .format('Z'),
              businessUnitName = await businessUnitController.getName(
                data,
                res,
              ),
              weekRange =
                moment(req.body.weekRangeStartsAt, 'MM-DD-YYYY HH:mm:ss Z')
                  .utcOffset(`${timeZone}`)
                  .format('DD-MMM') +
                ' - ' +
                moment(req.body.weekRangeEndsAt, 'MM-DD-YYYY HH:mm:ss Z')
                  .utcOffset(`${timeZone}`)
                  .format('DD-MMM'),
              templateName =
                req.user.name +
                '_' +
                businessUnitName +
                '_' +
                (countTemplatesForGivenWeek + 1);
            insertOrUpdateObj.name = templateName;
            __.log(insertOrUpdateObj);
            let templateDoc = await new Template(insertOrUpdateObj).save();
            req.body.templateId = templateDoc._id;
            statusLogData.status = 3; /*tempalte created */
          }
          shiftLogController.create(statusLogData, res); /* log insert*/
          __.out(res, 201, 'Template created successfully');
        }
      }
    } catch (err) {
      logError(`template/create API, there is an error `, err.toString());
      __.log(err);
      __.out(res, 500);
    }
  }
  async read(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      let requiredResult1 = await __.checkRequiredFields(req, [
        'businessUnitId',
        'date',
      ]);
      if (requiredResult1.status === false) {
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        /*compose the date variables */
        //var weekRangeStartsAt = moment(req.body.weekRangeStartsAt, 'MM-DD-YYYY HH:mm:ss Z').utc().format(),
        //   weekNumber = await __.weekNoStartWithMonday(weekRangeStartsAt);
        //console.log(weekNumber);
        var where = {
          status: 1,
          businessUnitId: req.body.businessUnitId,
          // plannedBy: req.user._id,
        },
          findOrFindOne;

        if (req.body.templateId) {
          where._id = req.body.templateId;
          findOrFindOne = Template.findOne(where);
        } else findOrFindOne = Template.find(where);

        let templates = await findOrFindOne
          .select('-__v -createdAt -updatedAt -shifts._id')
          .populate([
            {
              path: 'plannedBy',
              select: 'name staffId',
            },
            {
              path: 'businessUnitId',
              select: 'name status',
              populate: {
                path: 'sectionId',
                select: 'name status',
                populate: {
                  path: 'departmentId',
                  select: 'name status',
                  populate: {
                    path: 'companyId',
                    select: 'name status',
                  },
                },
              },
            },
          ])
          .populate({
            path: 'shifts.reportLocationId',
            select: 'name status',
          })
          .populate({
            path: 'shifts.subSkillSets',
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
            path: 'shifts.mainSkillSets',
            select: 'name status',
            match: {
              status: 1,
            },
          })
          .lean();

        let result;
        if (Array.isArray(templates)) {
          result = templates;
        } else {
          let listData = {},
            graphData = {},
            graphDataWeb = {},
            dashboardGraphData = {
              plannedFlexiHours: 0,
              plannedFlexiShifts: 0,
            },
            customShiftDetails = [];
          let timeZone = moment
            .parseZone(req.body.date, 'MM-DD-YYYY HH:mm:ss Z')
            .format('Z');
          await templates.shifts.forEach((element) => {
            if (
              (element.mainSkillSets.length || element.subSkillSets.length) &&
              element.reportLocationId
            ) {
              let key = __.getDateStringFormat(element.date, timeZone);
              let duration = __.getDurationInHours(
                element.startTime,
                element.endTime,
              );
              /*dashboard graph data starts*/
              dashboardGraphData.plannedFlexiHours +=
                element.staffNeedCount * duration;
              dashboardGraphData.plannedFlexiShifts += element.staffNeedCount;
              /*dashboard graph data ends */
              if (listData[key]) {
                /*if date already keyed in array */
                listData[key].push(element);
                graphData[key].totalHours += duration * element.staffNeedCount;
                graphData[key].totalShifts += element.staffNeedCount;
                graphDataWeb[key].totalHours.need +=
                  duration * element.staffNeedCount;
                graphDataWeb[key].numberOfShifts.need += element.staffNeedCount;
                graphDataWeb[key].numberOfShifts.backup +=
                  element.backUpStaffNeedCount;
              } else {
                /*else create a new key by date in array */
                listData[key] = [];
                graphData[key] = {};
                listData[key].push(element);
                graphData[key].totalHours = duration * element.staffNeedCount;
                graphData[key].totalShifts = element.staffNeedCount;
                graphDataWeb[key] = {
                  totalHours: {
                    need: duration * element.staffNeedCount,
                  },
                  numberOfShifts: {
                    need: element.staffNeedCount,
                    backup: element.backUpStaffNeedCount,
                  },
                };
              }
              var customElement = _.omit(element, [
                'shiftId',
                'reportLocationId',
                'subSkillSets',
                'mainSkillSets',
              ]);
              customShiftDetails.push(customElement);
            }
          });
          console.log(customShiftDetails);
          /*weeklyGraph starts */
          var staffNeedWeekdaysObj = {
            monday: {},
            tuesday: {},
            wednesday: {},
            thursday: {},
            friday: {},
            saturday: {},
            sunday: {},
          };
          var mondayOfShift = moment(
            customShiftDetails[0].startTimeInSeconds * 1000,
          )
            .startOf('isoweek')
            .format();
          var sundayOfShift = moment(mondayOfShift)
            .add(6, 'days')
            .add(23, 'hours')
            .add(59, 'minutes')
            .add(59, 'seconds')
            .utc()
            .format();
          var startUnixDateTime = moment(mondayOfShift).unix(),
            endUnixDateTime = moment(sundayOfShift).unix();

          for (var i = startUnixDateTime; i <= endUnixDateTime; i += 1800) {
            var dateTimeUnix = i * 1000;
            await customShiftDetails.forEach(async (element) => {
              var weekDay = __.getDayStringFormatFromUnix(i, timeZone),
                staffNeedCount = 0;
              if (
                i >= element.startTimeInSeconds &&
                i <= element.endTimeInSeconds
              ) {
                /*shift matches the time then it will take the count else it will assign 0 by default */
                staffNeedCount = element.staffNeedCount;
              }
              if (
                typeof staffNeedWeekdaysObj[weekDay][dateTimeUnix] !=
                'undefined'
              ) {
                /*dont change to if condition bcoz it may be zero so it fails in it*/
                staffNeedWeekdaysObj[weekDay][dateTimeUnix] += staffNeedCount;
              } else {
                staffNeedWeekdaysObj[weekDay][dateTimeUnix] = staffNeedCount;
              }
            });
          }
          var formattedNeedStaffData = {};
          for (var needElement in staffNeedWeekdaysObj) {
            formattedNeedStaffData[needElement] = [];
            for (var time in staffNeedWeekdaysObj[needElement]) {
              var array = [
                Number(time),
                Number(staffNeedWeekdaysObj[needElement][time]),
              ];
              formattedNeedStaffData[needElement].push(array);
            }
          }
          let weeklyStaffGraphData = {
            formattedNeedStaffData,
          };
          /*weeklyGraph ends */
          result = {
            template: templates,
            listData,
            graphData,
            graphDataWeb,
            dashboardGraphData,
            weeklyStaffGraphData,
          };
        }
        __.out(res, 201, {
          templates: result,
        });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async exportTemplateDataForBu(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      console.log('heheheheh');
      let requiredResult1 = await __.checkRequiredFields(req, [
        'businessUnitId',
        'date',
      ]);

      if (requiredResult1.status === false) {
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        /*compose the date variables */
        //var weekRangeStartsAt = moment(req.body.weekRangeStartsAt, 'MM-DD-YYYY HH:mm:ss Z').utc().format(),
        //   weekNumber = await __.weekNoStartWithMonday(weekRangeStartsAt);
        //console.log(weekNumber);
        var where = {
          status: 1,
          businessUnitId: req.body.businessUnitId,
        },
          findOrFindOne;
        if (req.body.templateId) {
          where._id = req.body.templateId;
          findOrFindOne = Template.findOne(where);
        } else findOrFindOne = Template.find(where);

        let templates = await findOrFindOne
          .select('-__v -createdAt -updatedAt -shifts._id')
          .populate([
            {
              path: 'plannedBy',
              select: 'name staffId',
            },
            {
              path: 'businessUnitId',
              select: 'name status',
              populate: {
                path: 'sectionId',
                select: 'name status',
                populate: {
                  path: 'departmentId',
                  select: 'name status',
                  populate: {
                    path: 'companyId',
                    select: 'name status',
                  },
                },
              },
            },
          ])
          .populate({
            path: 'shifts.reportLocationId',
            select: 'name status',
          })
          .populate({
            path: 'shifts.subSkillSets',
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
            path: 'shifts.mainSkillSets',
            select: 'name status',
            match: {
              status: 1,
            },
          })
          .lean();
        // send template graph data only for findOne
        let result;
        if (Array.isArray(templates)) {
          result = templates;
        } else {
          let listData = {},
            graphData = {},
            graphDataWeb = {},
            dashboardGraphData = {
              plannedFlexiHours: 0,
              plannedFlexiShifts: 0,
            },
            customShiftDetails = [];
          let timeZone = moment
            .parseZone(req.body.date, 'MM-DD-YYYY HH:mm:ss Z')
            .format('Z');
          await templates.shifts.forEach((element) => {
            if (
              (element.mainSkillSets.length || element.subSkillSets.length) &&
              element.reportLocationId
            ) {
              let key = __.getDateStringFormat(element.date, timeZone);
              let duration = __.getDurationInHours(
                element.startTime,
                element.endTime,
              );
              /*dashboard graph data starts*/
              dashboardGraphData.plannedFlexiHours +=
                element.staffNeedCount * duration;
              dashboardGraphData.plannedFlexiShifts += element.staffNeedCount;
              /*dashboard graph data ends */
              if (listData[key]) {
                /*if date already keyed in array */
                listData[key].push(element);
                graphData[key].totalHours += duration * element.staffNeedCount;
                graphData[key].totalShifts += element.staffNeedCount;
                graphDataWeb[key].totalHours.need +=
                  duration * element.staffNeedCount;
                graphDataWeb[key].numberOfShifts.need += element.staffNeedCount;
                graphDataWeb[key].numberOfShifts.backup +=
                  element.backUpStaffNeedCount;
              } else {
                /*else create a new key by date in array */
                listData[key] = [];
                graphData[key] = {};
                listData[key].push(element);
                graphData[key].totalHours = duration * element.staffNeedCount;
                graphData[key].totalShifts = element.staffNeedCount;
                graphDataWeb[key] = {
                  totalHours: {
                    need: duration * element.staffNeedCount,
                  },
                  numberOfShifts: {
                    need: element.staffNeedCount,
                    backup: element.backUpStaffNeedCount,
                  },
                };
              }
              var customElement = _.omit(element, [
                'shiftId',
                'reportLocationId',
                'subSkillSets',
                'mainSkillSets',
              ]);
              customShiftDetails.push(customElement);
            }
          });
          console.log(customShiftDetails);
          /*weeklyGraph starts */
          var staffNeedWeekdaysObj = {
            monday: {},
            tuesday: {},
            wednesday: {},
            thursday: {},
            friday: {},
            saturday: {},
            sunday: {},
          };
          var mondayOfShift = moment(
            customShiftDetails[0].startTimeInSeconds * 1000,
          )
            .startOf('isoweek')
            .format();
          var sundayOfShift = moment(mondayOfShift)
            .add(6, 'days')
            .add(23, 'hours')
            .add(59, 'minutes')
            .add(59, 'seconds')
            .utc()
            .format();
          var startUnixDateTime = moment(mondayOfShift).unix(),
            endUnixDateTime = moment(sundayOfShift).unix();
          for (var i = startUnixDateTime; i <= endUnixDateTime; i += 1800) {
            var dateTimeUnix = i * 1000;
            await customShiftDetails.forEach(async (element) => {
              var weekDay = __.getDayStringFormatFromUnix(i, timeZone),
                staffNeedCount = 0;
              if (
                i >= element.startTimeInSeconds &&
                i <= element.endTimeInSeconds
              ) {
                /*shift matches the time then it will take the count else it will assign 0 by default */
                staffNeedCount = element.staffNeedCount;
              }
              if (
                typeof staffNeedWeekdaysObj[weekDay][dateTimeUnix] !=
                'undefined'
              ) {
                /*dont change to if condition bcoz it may be zero so it fails in it*/
                staffNeedWeekdaysObj[weekDay][dateTimeUnix] += staffNeedCount;
              } else {
                staffNeedWeekdaysObj[weekDay][dateTimeUnix] = staffNeedCount;
              }
            });
          }
          var formattedNeedStaffData = {};
          for (var needElement in staffNeedWeekdaysObj) {
            formattedNeedStaffData[needElement] = [];
            for (var time in staffNeedWeekdaysObj[needElement]) {
              var array = [
                Number(time),
                Number(staffNeedWeekdaysObj[needElement][time]),
              ];
              formattedNeedStaffData[needElement].push(array);
            }
          }
          let weeklyStaffGraphData = {
            formattedNeedStaffData,
          };
          /*weeklyGraph ends */
          result = {
            template: templates,
            listData,
            graphData,
            graphDataWeb,
            dashboardGraphData,
            weeklyStaffGraphData,
          };
        }
        var finalData = [];
        var $scope = {
          selectTemplate: templates,
          fullDataCreateDummy: {
            location: '',
            'Template Name': '',
            'Confirmed count': '',
            shifts: [],
            status: '1',
            businessUnitName: '',
          },
        };
        var a;
        for (var index = 0; index < $scope.selectTemplate.length; index++) {
          var ShiftData = [];
          $scope.fullDataCreateDummy = {
            location: '',
            'Template Name': '',
            'Confirmed count': '',
            shifts: [],
            status: '1',
            businessUnitName: '',
            name: $scope.selectTemplate[index].name,
          };
          for (a = 0; a < $scope.selectTemplate[index].shifts.length; a++) {
            let dday = $scope.selectTemplate[index].shifts[a].day;
            var aaaa = $scope.selectTemplate[index].shifts[a];
            let tempStartDate = moment(aaaa.endTime, 'YYYY-MM-DD').format(
              'MM-DD-YYYY',
            );
            let tempEndDate = moment(aaaa.endTime, 'YYYY-MM-DD').format(
              'MM-DD-YYYY',
            );
            var backUpStaffNeedCount =
              $scope.selectTemplate[index].shifts[a].backUpStaffNeedCount;
            var reportLocationId =
              $scope.selectTemplate[index].shifts[a].reportLocationId._id;
            var reportLocationName =
              $scope.selectTemplate[index].shifts[a].reportLocationId.name;
            var staffNeedCount =
              $scope.selectTemplate[index].shifts[a].staffNeedCount;
            var status = $scope.selectTemplate[index].shifts[a].status;
            let subSkillSetsList;
            var mainSkillSets;
            subSkillSetsList =
              $scope.selectTemplate[index].shifts[a].subSkillSets;
            var subSkillSets = [];
            for (let x = 0; x < subSkillSetsList.length; x++) {
              subSkillSets.push({
                mainName: subSkillSetsList[x].skillSetId.name,
                subName: subSkillSetsList[x].name,
                id: subSkillSetsList[x]._id,
                name:
                  subSkillSetsList[x].skillSetId.name +
                  '->' +
                  subSkillSetsList[x].name,
              });
            }
            console.log(
              '$scope.selectTemplate[index].shifts[a]',
              $scope.selectTemplate[index].shifts[a],
            );
            ShiftData.push({
              subSkillSets: subSkillSets,
              mainSkillSets: mainSkillSets,
              staffNeedCount: staffNeedCount,
              plannedBy: $scope.selectTemplate[index].plannedBy.name,
              plannedByStaffId: $scope.selectTemplate[index].plannedBy.staffId,
              backUpStaffNeedCount: parseInt(backUpStaffNeedCount),
              dayDate: {
                date:
                  tempStartDate + ' ' + '00:00:00 GMT' + moment().format('ZZ'),
                day: moment
                  .utc($scope.selectTemplate[index].shifts[a].date)
                  .local()
                  .format('dddd'),
                startTime:
                  tempStartDate +
                  ' ' +
                  moment(
                    $scope.selectTemplate[index].shifts[a].startTime,
                  ).format('HH:mm') +
                  ':00 GMT' +
                  moment().format('ZZ'),
                endTime:
                  tempEndDate +
                  ' ' +
                  moment($scope.selectTemplate[index].shifts[a].endTime).format(
                    'HH:mm',
                  ) +
                  ':00 GMT' +
                  moment().format('ZZ'),
                isSplitShift:
                  $scope.selectTemplate[index].shifts[a].isSplitShift,
              },
              reportLocationId: reportLocationId,
              status: status,
              reportLocationName: reportLocationName,
              name: $scope.selectTemplate[index].name,
            });
          }
          ShiftData.forEach(function (x, index) {
            if ($scope.fullDataCreateDummy.shifts.length > 0) {
              let isDuplicate = false;
              var dayDateIndex;
              $scope.fullDataCreateDummy.shifts.forEach(function (y, $index) {
                dayDateIndex = $index;
                if (y.staffNeedCount === x.staffNeedCount) {
                  if (y.backUpStaffNeedCount === x.backUpStaffNeedCount) {
                    if (y.reportLocationId === x.reportLocationId) {
                      if (y.subSkillSets.length === x.subSkillSets.length) {
                        // return isDuplicate = true
                        y.dayDate.forEach(function (z, dayDateIndex) {
                          if (
                            moment(z.startTime).format('HH:mm') ===
                            moment(x.dayDate.startTime).format('HH:mm')
                          ) {
                            if (
                              moment(z.endTime).format('HH:mm') ===
                              moment(x.dayDate.endTime).format('HH:mm')
                            ) {
                              function objectsAreSame(x1, y1) {
                                var objectsAreSame = true;
                                //var objectsAreSame = true;
                                for (var xy = 0; xy < x1.length; xy++) {
                                  if (
                                    x1[xy].mainName == y1[xy].mainName &&
                                    x1[xy].subName == y1[xy].subName
                                  ) {
                                  } else {
                                    objectsAreSame = false;
                                    break;
                                  }
                                }
                                return objectsAreSame;
                              }
                              var isSame = objectsAreSame(
                                y.subSkillSets,
                                x.subSkillSets,
                              );
                              console.log('isSame', isSame);
                              if (isSame) return (isDuplicate = true);
                              else return (isDuplicate = false);
                            } else {
                              return (isDuplicate = false);
                            }
                            //return isDuplicate = true
                          } else {
                            return (isDuplicate = false);
                          }
                          //return isDuplicate = true
                        });
                      } else {
                        return (isDuplicate = false);
                      }
                    } else {
                      return (isDuplicate = false);
                    }
                  } else {
                    return (isDuplicate = false);
                  }
                } else {
                  return (isDuplicate = false);
                }
              });
              if (!isDuplicate && !x.isSplitShift) {
                $scope.fullDataCreateDummy.shifts.push(x);
                let shiftIndex = $scope.fullDataCreateDummy.shifts.length;
                $scope.fullDataCreateDummy.shifts[shiftIndex - 1].dayDate = [
                  x.dayDate,
                ];
              } else {
                $scope.fullDataCreateDummy.shifts[dayDateIndex].dayDate.push(
                  x.dayDate,
                );
              }
            } else {
              $scope.fullDataCreateDummy.shifts.push(x);
              $scope.fullDataCreateDummy.shifts[0].dayDate = [x.dayDate];
            }
          });
          finalData.push($scope.fullDataCreateDummy.shifts);
        }
        var lastFinal = [];
        for (let i = 0; i < finalData.length; i++) {
          var shifts = finalData[i];
          for (var j = 0; j < shifts.length; j++) {
            var shift = shifts[j];
            var obj = {
              templatename: shift.name,
              startTime: moment(shift.dayDate[0].startTime).format('HH:mm'),
              endTime: moment(shift.dayDate[0].endTime).format('HH:mm'),
              confirmStaff: shift.staffNeedCount,
              standbyStaff: shift.backUpStaffNeedCount,
              plannedBy: shift.plannedBy,
              plannedByStaffId: shift.plannedByStaffId,
              reportLocationName: shift.reportLocationName,
            };
            var skillSet = '';
            shift.subSkillSets.forEach((skill) => {
              skillSet += ',' + skill.name;
            });
            var days = '';
            shift.dayDate.forEach((day) => {
              days += ',' + day.day;
            });
            obj.skillSets = skillSet;
            obj.days = days;
            lastFinal.push(obj);
          }
        }
        __.out(res, 201, { lastFinal });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
  async remove(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      __.log(req.body, 'template/remove');
      let requiredResult = await __.checkRequiredFields(req, ['templateId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      let where = {
        _id: req.body.templateId,
        plannedBy: req.user._id,
        status: {
          $nin: [3],
        },
      };
      let templateData = await Template.findOne(where);
      if (!templateData) {
        return __.out(res, 300, 'Template Not Found');
      }

      templateData.status = 3;
      await templateData.save();
      return __.out(res, 201, 'Template deleted');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async renameTemplate(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      __.log(req.body, 'template/renameTemplate');
      let requiredResult = await __.checkRequiredFields(req, ['templateId', 'name']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const templateObj = await Template.updateOne({ _id: mongoose.Types.ObjectId(req.body.templateId), status: 1 }, { name: req.body.name });
      if (templateObj.nModified == 1) {
        return __.out(res, 200, 'Successfully updated');
      } else {
        return __.out(res, 300, "Error while updating Template");
      }

    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async deleteShiftInTemplate(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }
      __.log(req.body, 'template/remove');
      let requiredResult = await __.checkRequiredFields(req, ['templateId', 'planShiftToDelete']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }
      let where = {
        _id: req.body.templateId,
        plannedBy: req.user._id,
        status: {
          $nin: [3],
        },
      };
      let templateData = await Template.findOne(where);
      if (!templateData) {
        return __.out(res, 300, 'Template Not Found');
      }

      templateData.shifts = templateData.shifts.filter(i => i._doc.uniqueId != req.body.planShiftToDelete);
      await templateData.save();
      return __.out(res, 201, 'Plan Shift deleted');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }
}

module.exports = new template();
