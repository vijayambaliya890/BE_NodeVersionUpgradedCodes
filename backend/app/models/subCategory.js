const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const SubCategorySchema = new Schema({
    name: {
        type: String,
        default: ''
    },
    categoryId: {
        type: Schema.Types.ObjectId,
        ref: 'Category'
    },
    status: {
        type: Number,
        default: 0
    },
}, {
    timestamps: true
});
module.exports = mongoose.model('SubCategory', SubCategorySchema);