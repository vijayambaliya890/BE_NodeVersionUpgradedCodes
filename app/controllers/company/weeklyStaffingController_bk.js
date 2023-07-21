// Controller Code Starts here
const mongoose = require('mongoose'),
    moment = require('moment'),
    WeeklyStaffData = require('../../models/weeklyStaffData'),
    csv = require('csv2json-convertor'),
    __ = require('../../../helpers/globalFunctions');

class weeklyStaff {

    async uploadWeeklyStaffingData(req, res) {
        try {
            let requiredResult1 = await __.checkRequiredFields(req, ['businessUnitId', 'weekRangeStartsAt', 'weekRangeEndsAt', 'isFlexiStaff'], 'weeklyStaff');

            if (requiredResult1.status === false) {
                __.out(res, 400, requiredResult1.missingFields);
            } else {
                var jsonArray = [];
                jsonArray = csv.csvtojson(req.file.path);
                var data = {},
                    dateTimeUnix = 0;
                for (let json of jsonArray) {
                    var key = json['Timings'].toLowerCase();
                    delete json['Timings'];

                    if (dateTimeUnix == 0) { /*first iteration */
                        dateTimeUnix = moment(req.body.weekRangeStartsAt).utc().startOf('day').unix()

                    } else {
                        dateTimeUnix += (24 * 60 * 60);
                    }

                    var multipliedDateTimeUnix = dateTimeUnix * 1000,
                        /*this is for each day */
                        array = [];

                    for (let prop in json) {
                        /*add custom hours and mins to date  */
                        var timeUnix = (moment((moment(multipliedDateTimeUnix).format("DD-MM-YYYY")) + ' ' + prop, 'DD-MM-YYYY HH:mm').utc().unix()) * 1000; /*this is for each time on the corresponding date  */
                        array.push([Number(timeUnix), Number(json[prop])])
                    }
                    data[key] = array;
                }

                var weekRangeStartsAt = moment(req.body.weekRangeStartsAt).utc().format(),

                    weekRangeEndsAt = moment(req.body.weekRangeEndsAt).utc().format(),

                    weekNumber = await __.weekNoStartWithMonday(weekRangeStartsAt),

                    set = {
                        businessUnitId: req.body.businessUnitId,
                        weekNumber: weekNumber,
                        weekRangeStartsAt: weekRangeStartsAt,
                        weekRangeEndsAt: weekRangeEndsAt
                    };

                if (req.body.isFlexiStaff == 1)
                    set.flexiStaffData = data;
                else
                    set.staffData = data;

                var checkAlreadyExistsOrNot = await WeeklyStaffData.findOne({
                    weekNumber: weekNumber,
                    businessUnitId: req.body.businessUnitId
                }).select('_id').lean();

                if (checkAlreadyExistsOrNot) { /*update */
                    var updatedData = await WeeklyStaffData.update({
                        _id: checkAlreadyExistsOrNot._id
                    }, {
                            $set: set
                        });
                } else { /*insert */
                    var updatedData = await new WeeklyStaffData(set).save();
                }
                __.out(res, 200);
            }
        } catch (err) {
            __.log(err);
            __.out(res, 500);

        }
    }
    async weeklyStaffingData(data, res) {
        try {
            var result = await WeeklyStaffData.findOne({
                weekNumber: data.weekNumber,
                businessUnitId: data.businessUnitId
            }).lean();
            return result;
        } catch (err) {
            __.log(err);
            __.out(res, 500)
        }
    }

}
weeklyStaff = new weeklyStaff();
module.exports = weeklyStaff;