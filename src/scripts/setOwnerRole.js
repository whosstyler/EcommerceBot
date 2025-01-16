const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected successfully');

        // Update your user to OWNER role (using your Discord ID)
        const result = await User.findOneAndUpdate(
            { discordId: '863142225210507294' },
            { role: 'OWNER' },
            { new: true }
        );

        if (result) {
            console.log('Successfully updated user role to OWNER');
            console.log('Updated user:', result);
        } else {
            console.log('User not found');
        }
        
        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

connectDB();
