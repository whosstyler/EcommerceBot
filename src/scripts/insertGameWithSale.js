const mongoose = require('mongoose');
const Game = require('../models/Game');
const Sale = require('../models/Sale');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected successfully');

        // Create the game
        const game = new Game({
            name: "Counter-Strike 2",
            windowName: "cs2",
            description: "Experience the next evolution of tactical FPS gaming with Counter-Strike 2. Features improved graphics, enhanced mechanics, and refined gameplay.",
            prices: {
                daily: 4.99,
                weekly: 19.99,
                monthly: 49.99,
                yearly: 399.99
            },
            active: true
        });

        const savedGame = await game.save();
        console.log('Game created successfully:', savedGame);

        // Create an active sale for the game
        const sale = new Sale({
            game: savedGame._id,
            discountPercentage: 25,
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            active: true
        });

        await sale.save();
        console.log('Sale created successfully:', sale);
        
        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

connectDB();
