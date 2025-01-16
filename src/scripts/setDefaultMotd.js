const mongoose = require('mongoose');
const Motd = require('../models/Motd');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected successfully');

        const defaultMotd = new Motd({
            message: "Welcome to the service! Use !help for commands.",
            active: true
        });

        await defaultMotd.save();
        console.log('Default MOTD set successfully');
        
        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

connectDB();
