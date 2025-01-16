const express = require('express');
const router = express.Router();
const path = require('path');
const PaymentService = require('../../services/paymentService');
const authMiddleware = require('../middleware/auth');
const User = require('../../models/User');
const Game = require('../../models/Game');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.post('/create-payment', async (req, res) => {
    try {
        const { gameId, subscriptionType, discordId } = req.body;
        
        const game = await Game.findById(gameId);
        if (!game || !game.active) {
            return res.status(404).json({ error: 'Game not found or inactive' });
        }

        let amount = game.prices[subscriptionType];
        if (!amount) {
            return res.status(400).json({ error: 'Invalid subscription type' });
        }

        const paymentData = await PaymentService.createPayment(amount, gameId, subscriptionType, discordId, 'usd', game);
        res.json(paymentData);
    } catch (error) {
        console.error('Payment creation error:', error);
        res.status(500).json({ error: 'Payment creation failed' });
    }
});

router.post('/webhook/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    const timestamp = new Date().toISOString();
    console.log(`${timestamp}   --> Received Stripe webhook`);
    console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Signature:', sig);
    
    if (!sig) {
        console.error(`${timestamp}   --> ERROR: No Stripe signature found`);
        return res.status(400).send('No Stripe signature');
    }

    try {
        // Access raw body directly
        const payload = req.body;
        if (!payload) {
            console.error('No payload received');
            return res.status(400).send('No payload');
        }

        console.log('Webhook Secret:', process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10) + '...');
        console.log('Payload size:', payload.length);

        const event = stripe.webhooks.constructEvent(
            payload,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
        
        const timestamp = new Date().toISOString();
        console.log(`${timestamp}   --> ${event.type} [${event.id}]`);
        console.log('API Version:', event.api_version);
        console.log('Event Created:', new Date(event.created * 1000).toISOString());
        
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const timestamp = new Date().toISOString();
            console.log(`${timestamp}   --> Session Details:`);
            console.log('Session ID:', session.id);
            console.log('Customer:', session.customer);
            console.log('Payment Status:', session.payment_status);
            console.log('Amount Total:', session.amount_total);
            console.log('Currency:', session.currency);
            console.log('Metadata:', JSON.stringify(session.metadata, null, 2));
            const { gameId, subscriptionType, discordId } = session.metadata;
            
            if (!gameId || !subscriptionType || !discordId) {
                console.error('Missing required metadata:', { gameId, subscriptionType, discordId });
                return res.status(400).send('Missing required metadata');
            }
            
            // Calculate subscription end date based on type
            const startDate = new Date();
            let endDate = new Date(startDate);
            
            switch(subscriptionType) {
                case 'daily':
                    endDate.setDate(endDate.getDate() + 1);
                    break;
                case 'monthly':
                    endDate.setMonth(endDate.getMonth() + 1);
                    break;
                case 'yearly':
                    endDate.setFullYear(endDate.getFullYear() + 1);
                    break;
            }

            console.log('Processing payment for:', {
                gameId,
                subscriptionType,
                discordId,
                startDate,
                endDate: endDate.toISOString()
            });
            const user = await User.findOne({ discordId: discordId });
            if (!user) {
                console.error('User not found for Discord ID:', discordId);
                return res.status(400).send('User not found');
            }
            console.log('Found user:', user.username);

            console.log('Checking existing subscriptions for user:', user.username);
            
            // Find existing active subscription for this game
            const existingSubIndex = user.subscriptions.findIndex(sub => 
                sub.game.toString() === gameId && 
                sub.active && 
                sub.endDate > new Date()
            );

            let updatedUser;
            if (existingSubIndex !== -1) {
                // Extend existing subscription
                console.log('Extending existing subscription');
                const currentEndDate = user.subscriptions[existingSubIndex].endDate;
                endDate = new Date(currentEndDate);
                
                // Add additional time based on subscription type
                switch(subscriptionType) {
                    case 'daily':
                        endDate.setDate(endDate.getDate() + 1);
                        break;
                    case 'weekly':
                        endDate.setDate(endDate.getDate() + 7);
                        break;
                    case 'monthly':
                        endDate.setMonth(endDate.getMonth() + 1);
                        break;
                    case 'yearly':
                        endDate.setFullYear(endDate.getFullYear() + 1);
                        break;
                }

                // Update existing subscription
                user.subscriptions[existingSubIndex].endDate = endDate;
                updatedUser = await user.save();
                console.log('Extended subscription end date to:', endDate);
            } else {
                // Create new subscription
                console.log('Creating new subscription');
                updatedUser = await User.findByIdAndUpdate(user._id, {
                    $push: {
                        subscriptions: {
                            game: gameId,
                            startDate,
                            endDate,
                            active: true
                        }
                    }
                }, { new: true });
            }
            

            const { syncUserRoles } = require('../../discord/bot');
            console.log('Updated user subscriptions:', updatedUser.subscriptions);

            // Update user role based on subscription status
            const { updateUserRole } = require('../../utils/roleManager');
            await updateUserRole(user._id);

            // Update Discord role
            try {
                const client = require('../../discord/bot');

                const guild = await client.guilds.fetch('1239416790455423066');
                const member = await guild.members.fetch(discordId);
                if (member) {
                    const updatedUser = await User.findById(user._id);
                    await syncUserRoles(member, updatedUser.role, guild);
                }
            } catch (error) {
                console.error('Error updating Discord role:', error);
            }

            // Send Discord DM to user
            try {
                const client = require('../../discord/bot');
                const discordUser = await client.users.fetch(discordId);
                if (discordUser) {
                    const game = await Game.findById(gameId);
                    await discordUser.send(
                        `🎉 **Payment Successful!**\n\n` +
                        `Your ${subscriptionType} subscription to **${game.name}** has been activated.\n` +
                        `Subscription period: ${new Date().toLocaleDateString()} - ${endDate.toLocaleDateString()}\n` +
                        `Type \`!profile\` to view your active subscriptions.`
                    );
                }
            } catch (error) {
                console.error('Error sending Discord message:', error);
            }
        }
        
        res.json({ received: true });
    } catch (err) {
        console.error('Webhook Error:', err);
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
});


module.exports = router;
