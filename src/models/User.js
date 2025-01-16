const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    hwid: {
        type: String,
        default: null
    },
    subscriptions: [{
        game: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Game'
        },
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        },
        active: {
            type: Boolean,
            default: true
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: null
    },
    role: {
        type: String,
        enum: ['USER', 'VIP', 'ADMIN', 'OWNER', 'BANNED'],
        default: 'USER'
    },
    banReason: {
        type: String,
        default: null
    },
    banSource: {
        type: String,
        enum: ['DISCORD', 'HWID', 'USERID'],
        default: null
    },
    previousRole: {
        type: String,
        enum: ['USER', 'VIP', 'ADMIN', 'OWNER'],
        default: null
    }
});

userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 12);
    }
    next();
});

module.exports = mongoose.model('User', userSchema);
