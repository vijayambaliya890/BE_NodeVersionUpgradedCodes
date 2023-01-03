
const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const StaffAttendaceSchema = new Schema({
	staff: {
        type: Schema.Types.ObjectId,
        ref: 'User'
	},
	event: {
        type: Schema.Types.ObjectId,
		ref: 'Post'
	},
	session: {
        type: Schema.Types.ObjectId,
		ref: 'eventsession'
	},
	appointmentSlotNumber: {
		type: Number
	},
	appointmentType: {
		type: String,
        default: 'auto'
	},
	status: {
		type: Boolean,
		default: true
	}
}, {
    timestamps: true,
    usePushEach: true
});

const StaffAttendaceModel = mongoose.model('staffAttendance', StaffAttendaceSchema);

module.exports = StaffAttendaceModel;
