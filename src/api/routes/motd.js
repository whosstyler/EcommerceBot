const express = require('express');
const router = express.Router();
const Motd = require('../../models/Motd');
const authMiddleware = require('../middleware/auth');

// Get current MOTD
router.get('/', async (req, res) => {
    try {
        const motd = await Motd.findOne({ active: true }).sort({ createdAt: -1 });
        res.json({ message: motd ? motd.message : 'Welcome!' });
    } catch (error) {
        console.error('Error fetching MOTD:', error);
        res.status(500).json({ error: 'Failed to fetch MOTD' });
    }
});

// Set new MOTD (requires authentication and owner role)
router.post('/', authMiddleware, async (req, res) => {
    try {
        // First check if using API token
        if (req.userId === 863142225210507294) {
            // Allow access for API token
        } else {
            // Check for user with Discord ID
            const user = await require('../../models/User').findOne({ discordId: req.userId.toString() });
            if (!user || user.role !== 'OWNER') {
                return res.status(403).json({ error: 'Unauthorized' });
            }
        }

        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Deactivate all previous MOTDs
        await Motd.updateMany({}, { active: false });

        // Create new MOTD
        const motd = new Motd({ message });
        await motd.save();

        res.json({ message: 'MOTD updated successfully', motd });
    } catch (error) {
        console.error('Error updating MOTD:', error);
        res.status(500).json({ error: 'Failed to update MOTD' });
    }
});

module.exports = router;
