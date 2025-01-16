# Discord E-Commerce Bot - EcommerceBot

EcommerceBot is a Node.js-based Discord bot with integrated e-commerce functionality powered by Stripe and MongoDB. The bot allows users to register, manage their profiles, purchase game subscriptions, upload files, and create/manage tickets for support. Designed for simplicity and efficiency, it provides tools for both users and administrators.

## Features

### User Commands:
1. **!register**
   - Registers a user with their Discord username and generates a secure password.
   - Displays credentials upon successful registration.

2. **!profile**
   - Shows the user's profile, including their role, subscriptions, and account details.

3. **!games**
   - Displays a list of available games and their subscription plans (e.g., 24-hour, 7-day, 30-day, and 365-day access).
   - Generates a Stripe purchase link for selected subscriptions.

4. **!support**
   - Creates a support ticket.
   - Allows users to set ticket priority (Low, Medium, High, Urgent).

### Admin Commands:
1. **!upload**
   - Uploads files related to a specific game.

2. **!creategame**
   - Adds new games to the list of available options.

3. **!ban / !unban**
   - Bans or unbans users from accessing the bot or specific functionalities.

4. **!sale**
   - Sets discounts for games.
   - Notifies all registered users of the sale via an embedded message.

5. **!motd**
   - Updates the message of the day (optional).

### Ticket Logic:
- Tracks the last response time for both admins and users.
- Periodically checks for open tickets and sends reminders to users if:
  - The admin has responded.
  - The user hasn’t replied within 30 minutes.
  - No previous reminders were sent in the last 30 minutes.
- Prevents spam by updating reminder timestamps.

### Other Features:
- Automatically updates user roles after purchases.
- Sends notifications for game sales and updates.

## Tech Stack
- **Backend:** Node.js
- **Database:** MongoDB
- **Payment Integration:** Stripe

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/whosstyler/EcommerceBot.git
   cd EcommerceBot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Create a `.env` file and add the following:
     ```env
     # MongoDB Connection
     MONGODB_URI=mongodb://localhost:27017/EcommerceBot

     # JWT Configuration
     JWT_SECRET=your-jwt-secret

     # Discord Bot
     DISCORD_TOKEN=your-discord-bot-token

     # API Configuration
     API_PORT=3000
     API_TOKEN=your-api-token

     # Stripe Configuration
     STRIPE_SECRET_KEY=sk-your-stripe-secret
     STRIPE_WEBHOOK_SECRET=your-stripe-webhook
     PAYMENT_SUCCESS_URL=http://localhost:3000/payment/success
     STRIPE_WEBHOOK_URL=http://localhost:3000/api/payments/webhook/stripe

     # Encryption Configuration
     ENCRYPTION_KEY=your-encryption-key

     # Owner ID
     OWNER_ID=your-owner-id
     ```

4. Run the bot:
   ```bash
   npm run dev
   ```

## Usage
1. Invite the bot to your Discord server using the generated OAuth2 URL.
2. Use `!register` to create a profile.
3. Explore other commands (`!games`, `!profile`, `!support`) as needed.

[Watch on YouTube](https://www.youtube.com/watch?v=bQRlKC3dGWE&ab_channel=whosstyler)

## Contribution
Contributions are welcome! Please submit a pull request or open an issue for any bugs or feature requests.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.

---
