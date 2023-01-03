const mongoose = require('mongoose'),
	Schema = mongoose.Schema;

const RSVPRequestSchema = new Schema({
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
	isRSVPRequested: {
		type: Boolean
	},
	isRSVPCancelled: {
		type: Boolean
	},
	isRSVPRequestAccepted: {
		type: Boolean,
		default: true
	},
	isRSVPRequestDeclined: {
		type: Boolean
	},
	isDeleted: {
		type: Boolean
	}
}, {
	timestamps: true,
	usePushEach: true
});

const RSVPRequestModel = mongoose.model('RSVPRequest', RSVPRequestSchema);

module.exports = RSVPRequestModel;
