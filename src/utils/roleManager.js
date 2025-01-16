const User = require('../models/User');

const updateUserRole = async (userId, client) => {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        // Get current date
        const now = new Date();

        // Check if user has any active subscriptions
        const hasActiveSubscription = user.subscriptions.some(sub => 
            sub.active && sub.endDate > now
        );

        // Update role based on subscription status
        if (hasActiveSubscription && user.role === 'USER') {
            user.role = 'VIP';
            await user.save();
            console.log(`Upgraded user ${user.username} to VIP role`);
        } else if (!hasActiveSubscription && user.role === 'VIP') {
            user.role = 'USER';
            await user.save();
            console.log(`Downgraded user ${user.username} from VIP role`);
        }
    } catch (error) {
        console.error('Error updating user role:', error);
    }
};

// Function to check and update expired subscriptions
const checkExpiredSubscriptions = async () => {
    try {
        const now = new Date();
        
        // Find all VIP users
        const vipUsers = await User.find({ role: 'VIP' });
        
        for (const user of vipUsers) {
            // Check if all subscriptions are expired
            const hasActiveSubscription = user.subscriptions.some(sub => 
                sub.active && sub.endDate > now
            );
            
            if (!hasActiveSubscription) {
                user.role = 'USER';
                await user.save();
                console.log(`Removed VIP role from ${user.username} due to expired subscriptions`);
            }
        }
    } catch (error) {
        console.error('Error checking expired subscriptions:', error);
    }
};

module.exports = {
    updateUserRole,
    checkExpiredSubscriptions
};
