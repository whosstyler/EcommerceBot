const mongoose = require('mongoose');
const Game = require('../models/Game');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected successfully');

        const testGame = new Game({
            name: "Fortnite",
            windowName: "FortniteClient-Win64-Shipping",
            description: "Battle Royale game where 100 players fight to be the last one standing.",
            prices: {
                daily: 2.99,
                weekly: 14.99,
                monthly: 39.99,
                yearly: 299.99
            },
            active: true
        });

        await testGame.save();
        console.log('Test game inserted successfully');
        
        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

connectDB();
