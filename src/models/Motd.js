const mongoose = require('mongoose');

const motdSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true
    },
    active: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Motd', motdSchema);
