require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const authRoutes = require('./api/routes/auth');
const paymentRoutes = require('./api/routes/payments');
const discordBot = require('./discord/bot');

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();

// Raw body parsing for Stripe webhooks must come before other middleware
app.use('/api/payments/webhook/stripe', express.raw({ type: 'application/json' }));

// Security middleware
app.use(helmet());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/uploads', require('./api/routes/uploads'));
app.use('/api/motd', require('./api/routes/motd'));

// Start Express server
const PORT = process.env.API_PORT || 3000;
app.listen(PORT, () => {
    console.log(`API Server running on port ${PORT}`);
});

// Start Discord bot
discordBot.login(process.env.DISCORD_TOKEN);

// Set up periodic subscription check
const { checkExpiredSubscriptions } = require('./utils/roleManager');
setInterval(checkExpiredSubscriptions, 1000 * 60 * 60); // Check every hour
checkExpiredSubscriptions(); // Run initial check at startup
