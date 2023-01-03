const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const CategorySchema = new Schema({
    name: {
        type: String,
        default: ''
    },
    subCategories: [{
        type: Schema.Types.ObjectId,
        ref: 'SubCategory'
    }],
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company'
    },
    status: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});
module.exports = mongoose.model('Category', CategorySchema);