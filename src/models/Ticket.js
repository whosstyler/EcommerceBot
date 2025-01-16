const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    channelId: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM'
    },
    status: {
        type: String,
        enum: ['OPEN', 'CLOSED'],
        default: 'OPEN'
    },
    reason: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    closedAt: {
        type: Date
    },
    lastUserResponse: {
        type: Date,
        default: Date.now
    },
    lastAdminResponse: {
        type: Date
    },
    lastReminderSent: {
        type: Date
    }
});

module.exports = mongoose.model('Ticket', ticketSchema);
