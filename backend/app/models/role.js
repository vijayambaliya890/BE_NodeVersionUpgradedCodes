const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const roleSchema = new Schema({
    name: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        default: ''
    },
    isFlexiStaff: {
        type: Number,
        default: 0
    },
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company'
    },
    privileges: [{
        type: Schema.Types.ObjectId,
        ref: 'Privilege'
    }],
    status: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});
const Role = mongoose.model('Role', roleSchema);

module.exports = Role;