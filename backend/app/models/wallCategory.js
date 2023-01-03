const mongoose = require('mongoose'),
    Schema = mongoose.Schema;

const WallCategorySchema = new Schema({
    wallId: {
        type: Schema.Types.ObjectId,
        ref: 'Wall'
    },
    categoryName: {
        type: String,
        default: ''
    },
    status: {
        type: Number,
        default: 1
    }
}, {
        timestamps: true
    });
module.exports = mongoose.model('WallCategory', WallCategorySchema);