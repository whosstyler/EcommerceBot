const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
    game: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game',
        required: true
    },
    discountPercentage: {
        type: Number,
        required: true,
        min: 1,
        max: 99
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    active: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('Sale', saleSchema);
