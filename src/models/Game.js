const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    windowName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    prices: {
        daily: {
            type: Number,
            required: true,
            validate: {
                validator: function(v) {
                    return v >= -1; // Allow -1 (disabled), 0 (free), or positive prices
                },
                message: 'Price must be -1 (disabled), 0 (free), or a positive number'
            }
        },
        weekly: {
            type: Number,
            required: true,
            validate: {
                validator: function(v) {
                    return v >= -1;
                },
                message: 'Price must be -1 (disabled), 0 (free), or a positive number'
            }
        },
        monthly: {
            type: Number,
            required: true,
            validate: {
                validator: function(v) {
                    return v >= -1;
                },
                message: 'Price must be -1 (disabled), 0 (free), or a positive number'
            }
        },
        yearly: {
            type: Number,
            required: true,
            validate: {
                validator: function(v) {
                    return v >= -1;
                },
                message: 'Price must be -1 (disabled), 0 (free), or a positive number'
            }
        }
    },
    sale: {
        active: {
            type: Boolean,
            default: false
        },
        discountPercentage: {
            type: Number,
            min: 1,
            max: 99,
            default: null
        },
        endDate: {
            type: Date,
            default: null
        },
        salePrices: {
            daily: Number,
            weekly: Number,
            monthly: Number,
            yearly: Number
        }
    },
    active: {
        type: Boolean,
        default: true
    }
});

// Pre-save middleware to calculate sale prices
gameSchema.pre('save', function(next) {
    if (this.sale.active && this.sale.discountPercentage) {
        const discount = (100 - this.sale.discountPercentage) / 100;
        this.sale.salePrices = {
            daily: this.prices.daily !== -1 ? +(this.prices.daily * discount).toFixed(2) : -1,
            weekly: this.prices.weekly !== -1 ? +(this.prices.weekly * discount).toFixed(2) : -1,
            monthly: this.prices.monthly !== -1 ? +(this.prices.monthly * discount).toFixed(2) : -1,
            yearly: this.prices.yearly !== -1 ? +(this.prices.yearly * discount).toFixed(2) : -1
        };
    }
    next();
});

module.exports = mongoose.model('Game', gameSchema);
