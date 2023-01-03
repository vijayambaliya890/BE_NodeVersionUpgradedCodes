const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const ShiftCheck = new Schema({

        shiftId: {
            type: Schema.Types.ObjectId,
            ref: 'Shift'
        },
        status: {
            type: Boolean,
            default: false
        }
      
    }, {
        timestamps: true
    }
);

const ShiftCheck = mongoose.model('ShiftCheck', ShiftCheckSchema);

module.exports = ShiftCheck;
