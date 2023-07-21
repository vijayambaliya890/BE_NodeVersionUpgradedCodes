const ShiftDetails = require('../app/models/shiftDetails'),
  moment = require('moment');

class ShiftHelper {
  async checkShiftInterval(
    staffId,
    startTime,
    endTime,
    intervalTime,
    shiftDetailId = null,
    splitShiftId = null,
  ) {
    try {
      var MS_PER_MINUTE = 60000;
      startTime = new Date(
        new Date(startTime).getTime() - MS_PER_MINUTE * intervalTime,
      );

      endTime = new Date(
        new Date(endTime).getTime() + MS_PER_MINUTE * intervalTime,
      );
      var where = {
        $or: [
          {
            confirmedStaffs: staffId,
          },
          {
            backUpStaffs: staffId,
          },
        ],
        startTime: {
          $lt: moment(endTime).utc().format(),
        },
        endTime: {
          $gt: moment(startTime).utc().format(),
        },
        status: 1,
      };
      if (splitShiftId) {
        where._id = { $nin: [shiftDetailId, splitShiftId] };
      } else if (shiftDetailId) {
        where._id = { $ne: shiftDetailId };
      }
      console.log('where', JSON.stringify(where));
      var checkAnyShiftAlreadyExists = await ShiftDetails.findOne(where).lean();
      return checkAnyShiftAlreadyExists ? true : false;
    } catch (e) {
      console.log('check shift interval error', e);
      return false;
    }
  }
}
ShiftHelper = new ShiftHelper();
module.exports = ShiftHelper;
