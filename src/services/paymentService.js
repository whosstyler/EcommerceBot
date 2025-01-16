const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class PaymentService {
    static async createPayment(amount, gameId, subscriptionType, discordId, currency = 'usd', game) {
        try {
            // Check for active sale
            const Sale = require('../models/Sale');
            const activeSale = await Sale.findOne({
                game: gameId,
                active: true,
                startDate: { $lte: new Date() },
                endDate: { $gt: new Date() }
            });

            // Apply discount if there's an active sale
            if (activeSale) {
                amount = amount * (100 - activeSale.discountPercentage) / 100;
            }
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: currency,
                        unit_amount: Math.round(amount * 100),
                        product_data: {
                            name: `${game.name} - ${subscriptionType} Access`,
                            metadata: {
                                gameId: gameId,
                                subscriptionType: subscriptionType
                            }
                        },
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: 'https://example.com/success',
                cancel_url: 'https://example.com/cancel',
                metadata: {
                    gameId: gameId,
                    subscriptionType: subscriptionType,
                    discordId: discordId
                }
            });
            
            return { success: true, url: session.url };
        } catch (error) {
            console.error('Stripe payment error:', error);
            throw error;
        }
    }
}

module.exports = PaymentService;
