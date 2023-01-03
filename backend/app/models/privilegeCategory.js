const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const PrivilegeCategorySchema = new Schema({
    name: {
        type: String,
        default: ''
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

const PrivilegeCategory = mongoose.model('PrivilegeCategory', PrivilegeCategorySchema);

module.exports = PrivilegeCategory;