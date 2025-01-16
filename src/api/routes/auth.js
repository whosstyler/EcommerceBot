const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../../models/User');
const authMiddleware = require('../middleware/auth');

// Rate limiter specifically for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per window
    message: { error: 'Too many login attempts, please try again later' }
});

// Login route
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { username, password, hwid } = req.body;

        // Input validation
        if (!username || !password || !hwid) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Sanitize username
        const sanitizedUsername = username.toLowerCase().trim();

        // Check username format
        if (!/^[a-z0-9]{3,20}$/.test(sanitizedUsername)) {
            return res.status(400).json({ error: 'Invalid username format' });
        }

        // Check HWID format (allowing for hashed values)
        if (!/^[A-Za-z0-9+/=_\-.$]{1,255}$/i.test(hwid)) {
            return res.status(400).json({ error: 'Invalid HWID format' });
        }

        // Find user with case-insensitive username
        const user = await User.findOne({ 
            username: { $regex: new RegExp(`^${sanitizedUsername}$`, 'i') }
        });

        // Check for banned user
        if (!user) {
            console.log(`Failed login attempt for username: ${sanitizedUsername}`);
            return res.status(401).json({ error: 'Authentication failed' });
        }

        // Check for HWID ban
        const hwidBannedUser = await User.findOne({ hwid: hwid, role: 'BANNED' });
        if (hwidBannedUser || user.role === 'BANNED') {
            console.log(`Banned user/HWID attempted login: ${sanitizedUsername}`);
            return res.status(401).json({ error: 'Account is banned' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            console.log(`Invalid password for user: ${sanitizedUsername}`);
            return res.status(401).json({ error: 'Authentication failed' });
        }

        // HWID Check
        if (!user.hwid) {
            user.hwid = hwid;
            await user.save();
            console.log(`HWID set for user: ${sanitizedUsername}`);
        } else if (user.hwid !== hwid) {
            console.log(`HWID mismatch for user: ${sanitizedUsername}`);
            return res.status(401).json({ error: 'Hardware verification failed' });
        }

        // Update last login time
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT with additional claims
        const token = jwt.sign(
            {
                userId: user._id,
                username: user.username,
                iat: Math.floor(Date.now() / 1000)
            },
            process.env.JWT_SECRET,
            { 
                expiresIn: '24h',
                algorithm: 'HS256'
            }
        );

        console.log(`Successful login for user: ${sanitizedUsername}`);
        // Get current MOTD
        const Motd = require('../../models/Motd');
        const motd = await Motd.findOne({ active: true }).sort({ createdAt: -1 });
        
        res.json({ 
            message: 'Login successful',
            token,
            expiresIn: 86400, // 24 hours in seconds
            tokenType: 'Bearer',
            motd: motd ? motd.message : 'Welcome!'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});

// Verify token route
router.get('/verify', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user subscriptions route
router.get('/subscriptions', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .populate({
                path: 'subscriptions.game',
                select: 'name windowName description'
            });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Don't show subscriptions if banned
        const activeSubscriptions = user.role === 'BANNED' ? [] : user.subscriptions
            .filter(sub => sub.active && sub.endDate > new Date())
            .map(sub => ({
                gameName: sub.game.name,
                windowName: sub.game.windowName,
                description: sub.game.description,
                startDate: sub.startDate,
                endDate: sub.endDate,
                active: sub.active,
                daysRemaining: Math.ceil((new Date(sub.endDate) - new Date()) / (1000 * 60 * 60 * 24))
            }));

        res.json({
            subscriptions: activeSubscriptions
        });
    } catch (error) {
        console.error('Subscription fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
});

module.exports = router;
