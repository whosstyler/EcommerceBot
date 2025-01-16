const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, Colors, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fetch = require('node-fetch');
const FormData = require('form-data');
const path = require('path');
const User = require('../models/User');
const Game = require('../models/Game');
const { generatePassword } = require('../utils/helpers');
const { ChannelType } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
    ]
});

// Initialize game creation cache
client.gameCreationCache = new Map();

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    // Check for inactive tickets every 5 minutes
    setInterval(checkInactiveTickets, 5 * 60 * 1000);

    // Set up roles in Discord
    try {
        const guild = await client.guilds.fetch('1239416790455423066');
        if (!guild) {
            console.error('Could not find guild');
            return;
        }

        // Define roles with their colors
        const roles = [
            { name: 'OWNER', color: '#FFD700' },  // Gold
            { name: 'ADMIN', color: '#FF0000' },  // Red
            { name: 'VIP', color: '#9B59B6' },    // Purple
            { name: 'USER', color: '#3498DB' },   // Blue
            { name: 'BANNED', color: '#2C3E50' }  // Dark Gray
        ];

        // Create or update roles
        for (const roleData of roles) {
            const existingRole = guild.roles.cache.find(r => r.name === roleData.name);
            if (!existingRole) {
                await guild.roles.create({
                    name: roleData.name,
                    color: roleData.color,
                    reason: 'Setting up authentication system roles'
                });
                console.log(`Created role: ${roleData.name}`);
            }
        }

        // Sync existing users with their roles
        const User = require('../models/User');
        const users = await User.find({});
        
        for (const user of users) {
            try {
                const member = await guild.members.fetch(user.discordId);
                if (member) {
                    await syncUserRoles(member, user.role, guild);
                }
            } catch (error) {
                console.error(`Error syncing roles for user ${user.username}:`, error);
            }
        }
    } catch (error) {
        console.error('Error setting up roles:', error);
    }
});

// Function to sync user roles
async function syncUserRoles(member, userRole, guild) {
    try {
        // Remove all managed roles first
        const managedRoles = ['OWNER', 'ADMIN', 'VIP', 'USER', 'BANNED'];
        for (const roleName of managedRoles) {
            const role = guild.roles.cache.find(r => r.name === roleName);
            if (role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
            }
        }

        // Add the current role
        const newRole = guild.roles.cache.find(r => r.name === userRole);
        if (newRole) {
            await member.roles.add(newRole);
            console.log(`Updated role for ${member.user.tag} to ${userRole}`);
        }
    } catch (error) {
        console.error(`Error syncing roles for member ${member.user.tag}:`, error);
    }
}

// Function to check for inactive tickets and send reminders
async function checkInactiveTickets() {
    try {
        const Ticket = require('../models/Ticket');
        const now = new Date();
        const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000);
        
        // Find tickets that:
        // 1. Are open
        // 2. Have an admin response
        // 3. Haven't had a user response in 30 minutes
        // 4. Haven't had a reminder in the last 30 minutes
        const inactiveTickets = await Ticket.find({
            status: 'OPEN',
            lastAdminResponse: { $exists: true },
            lastUserResponse: { $lt: thirtyMinutesAgo },
            $or: [
                { lastReminderSent: { $lt: thirtyMinutesAgo } },
                { lastReminderSent: { $exists: false } }
            ]
        });

        for (const ticket of inactiveTickets) {
            try {
                const user = await client.users.fetch(ticket.userId);
                await user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('🔔 Ticket Reminder')
                            .setDescription(`You have an unread response in your support ticket.\nPlease check <#${ticket.channelId}> for the admin's response.`)
                            .setColor('#FFA500')
                            .setTimestamp()
                    ]
                });

                // Update last reminder time
                ticket.lastReminderSent = now;
                await ticket.save();
            } catch (error) {
                console.error(`Error sending reminder for ticket ${ticket._id}:`, error);
            }
        }
    } catch (error) {
        console.error('Error checking inactive tickets:', error);
    }
}

const getRoleColor = (role) => {
    switch(role) {
        case 'OWNER':
            return Colors.Gold;
        case 'ADMIN':
            return Colors.Red;
        case 'VIP':
            return Colors.Purple;
        case 'BANNED':
            return Colors.DarkRed;
        default:
            return Colors.Blue;
    }
};

const getRoleDisplay = (role) => {
    switch(role) {
        case 'OWNER':
            return '👑 CEO';
        case 'ADMIN':
            return '⚡ Admin';
        case 'VIP':
            return '💎 VIP';
        case 'BANNED':
            return '🚫 **BANNED**';
        default:
            return '👤 User';
    }
};

const createProfileEmbed = async (user, discordUser) => {
    // Get active subscriptions with populated game data
    const userWithSubs = await User.findById(user._id).populate('subscriptions.game');
    
    const activeSubscriptions = userWithSubs.subscriptions
        .filter(sub => sub.active && sub.endDate > new Date())
        .map(sub => {
            const timeLeft = Math.ceil((sub.endDate - new Date()) / (1000 * 60 * 60 * 24));
            return `• ${sub.game.name} (${timeLeft} days remaining)`;
        })
        .join('\n');

    const lastLoginStr = user.lastLogin 
        ? new Date(user.lastLogin).toLocaleString()
        : 'Never';

    return new EmbedBuilder()
        .setTitle(`${user.username}'s Profile`)
        .setColor(getRoleColor(user.role))
        .setThumbnail(discordUser.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'Discord ID', value: user.discordId, inline: true },
            { name: 'Username', value: user.username, inline: true },
            { name: 'Account Created', value: new Date(user.createdAt).toLocaleDateString(), inline: true },
            { name: 'Last Login', value: lastLoginStr, inline: true },
            { name: 'Role', value: `**${getRoleDisplay(user.role)}**`, inline: true },
            { name: 'Active Subscriptions', value: user.role === 'BANNED' ? '*Account Banned*' : (activeSubscriptions || 'No active subscriptions') },
            ...(user.role === 'BANNED' ? [{ name: 'Ban Reason', value: user.banReason || 'No reason provided' }] : [])
        )
        .setTimestamp();
};

const createGameEmbed = (game) => {
    const embed = new EmbedBuilder()
        .setTitle(game.name)
        .setDescription(game.description || 'No description available')
        .setColor(game.sale.active ? '#FF0000' : '#0099ff');

    // Helper function to format price display
    const formatPrice = (regularPrice, salePrice) => {
        if (regularPrice === -1) return 'Not Available';
        if (regularPrice === 0) return 'Free';
        if (game.sale.active) {
            return `~~$${regularPrice.toFixed(2)}~~ **$${salePrice.toFixed(2)}**`;
        }
        return `$${regularPrice.toFixed(2)}`;
    };

    // Add prices only if they're available (-1 means disabled)
    if (game.prices.daily !== -1) {
        embed.addFields({ 
            name: '24 Hour Access', 
            value: formatPrice(game.prices.daily, game.sale.salePrices?.daily), 
            inline: true 
        });
    }
    if (game.prices.weekly !== -1) {
        embed.addFields({ 
            name: '7 Day Access', 
            value: formatPrice(game.prices.weekly, game.sale.salePrices?.weekly), 
            inline: true 
        });
    }
    if (game.prices.monthly !== -1) {
        embed.addFields({ 
            name: '30 Day Access', 
            value: formatPrice(game.prices.monthly, game.sale.salePrices?.monthly), 
            inline: true 
        });
    }
    if (game.prices.yearly !== -1) {
        embed.addFields({ 
            name: '365 Day Access', 
            value: formatPrice(game.prices.yearly, game.sale.salePrices?.yearly), 
            inline: true 
        });
    }

    // Add sale information to footer if active
    if (game.sale.active) {
        embed.setFooter({ 
            text: `🔥 ${game.sale.discountPercentage}% OFF! Sale ends ${new Date(game.sale.endDate).toLocaleDateString()}` 
        });
    } else {
        embed.setFooter({ 
            text: 'Select the game below to view purchase options' 
        });
    }

    return embed;
};

// Handle traditional message commands (for DMs)
// Handle select menu interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'game_select') {
        try {
            const gameId = interaction.values[0];
            const game = await Game.findById(gameId);
            
            if (!game) {
                return interaction.reply('Game not found.');
            }

            const gameEmbed = createGameEmbed(game);
            
            // Create subscription buttons
            // Create buttons only for available subscription types
            const buttons = [];
            
            const formatButtonLabel = (type, regularPrice, salePrice) => {
                const periods = {
                    daily: '24 Hours',
                    weekly: '7 Days',
                    monthly: '30 Days',
                    yearly: '365 Days'
                };
                if (game.sale.active) {
                    return `${periods[type]} ($${salePrice.toFixed(2)})`;
                }
                return `${periods[type]} ($${regularPrice.toFixed(2)})`;
            };

            if (game.prices.daily !== -1) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`subscribe_${game._id}_daily`)
                        .setLabel(formatButtonLabel('daily', game.prices.daily, game.sale.salePrices?.daily))
                        .setStyle(ButtonStyle.Primary)
                );
            }

            if (game.prices.weekly !== -1) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`subscribe_${game._id}_weekly`)
                        .setLabel(formatButtonLabel('weekly', game.prices.weekly, game.sale.salePrices?.weekly))
                        .setStyle(ButtonStyle.Primary)
                );
            }

            if (game.prices.monthly !== -1) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`subscribe_${game._id}_monthly`)
                        .setLabel(formatButtonLabel('monthly', game.prices.monthly, game.sale.salePrices?.monthly))
                        .setStyle(ButtonStyle.Primary)
                );
            }

            if (game.prices.yearly !== -1) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`subscribe_${game._id}_yearly`)
                        .setLabel(formatButtonLabel('yearly', game.prices.yearly, game.sale.salePrices?.yearly))
                        .setStyle(ButtonStyle.Primary)
                );
            }

            const buttonRow = new ActionRowBuilder()
                .addComponents(...buttons);

            await interaction.reply({
                embeds: [gameEmbed],
                components: [buttonRow]
            });
        } catch (error) {
            console.error('Error handling game selection:', error);
            await interaction.reply({
                content: 'An error occurred while processing your selection. Please try again later.',
                ephemeral: true
            });
        }
    }
});

// Handle modal submit for game creation
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    
    if (interaction.customId === 'createGameModal_page2') {
        try {
            // Get the stored game data
            const gameData = interaction.client.gameCreationCache.get(interaction.user.id);
            if (!gameData) {
                return interaction.reply({
                    content: '❌ Game creation session expired. Please start over.',
                    ephemeral: true
                });
            }

            // Get pricing data
            const dailyPrice = parseFloat(interaction.fields.getTextInputValue('dailyPrice'));
            const weeklyPrice = parseFloat(interaction.fields.getTextInputValue('weeklyPrice'));
            const monthlyPrice = parseFloat(interaction.fields.getTextInputValue('monthlyPrice'));
            const yearlyPrice = parseFloat(interaction.fields.getTextInputValue('yearlyPrice'));

            // Validate prices
            if ([dailyPrice, weeklyPrice, monthlyPrice, yearlyPrice].some(price => isNaN(price))) {
                return interaction.reply({
                    content: '❌ Invalid price format. Please use numbers only (e.g., 2.99, 0, -1).',
                    ephemeral: true
                });
            }

            // Create the game
            const newGame = new Game({
                name: gameData.name,
                windowName: gameData.windowName,
                description: gameData.description,
                prices: {
                    daily: dailyPrice,
                    weekly: weeklyPrice,
                    monthly: monthlyPrice,
                    yearly: yearlyPrice
                },
                active: true
            });

            await newGame.save();

            // Clear the cache
            interaction.client.gameCreationCache.delete(interaction.user.id);

            // Create success embed
            const gameEmbed = new EmbedBuilder()
                .setTitle('✅ Game Created Successfully')
                .setColor(Colors.Green)
                .addFields(
                    { name: 'Name', value: gameData.name, inline: true },
                    { name: 'Window Name', value: gameData.windowName, inline: true },
                    { name: 'Description', value: gameData.description },
                    { name: 'Daily Price', value: dailyPrice === -1 ? 'Disabled' : dailyPrice === 0 ? 'Free' : `$${dailyPrice}`, inline: true },
                    { name: 'Weekly Price', value: weeklyPrice === -1 ? 'Disabled' : weeklyPrice === 0 ? 'Free' : `$${weeklyPrice}`, inline: true },
                    { name: 'Monthly Price', value: monthlyPrice === -1 ? 'Disabled' : monthlyPrice === 0 ? 'Free' : `$${monthlyPrice}`, inline: true },
                    { name: 'Yearly Price', value: yearlyPrice === -1 ? 'Disabled' : yearlyPrice === 0 ? 'Free' : `$${yearlyPrice}`, inline: true },
                    { name: 'Game ID', value: newGame._id.toString() }
                );

            // Create upload button
            const uploadButton = new ButtonBuilder()
                .setCustomId(`upload_${newGame._id}`)
                .setLabel('Upload Game Files')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(uploadButton);

            await interaction.reply({ 
                embeds: [gameEmbed], 
                components: [row],
                ephemeral: true 
            });
        } catch (error) {
            console.error('Error creating game:', error);
            await interaction.reply({
                content: '❌ Failed to create game. Please try again.',
                ephemeral: true
            });
        }
    }
});

// Add handler for upload button
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('upload_')) {
        const gameId = interaction.customId.split('_')[1];
        await interaction.reply({
            content: 'Please use the `!upload ' + gameId + '` command to upload your game files.',
            ephemeral: true
        });
    }
});

// Handle modal submit
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    // Handle support ticket creation
    if (interaction.customId.startsWith('supportTicketModal_')) {
        try {
            const priority = interaction.customId.split('_')[1];
            const reason = interaction.fields.getTextInputValue('ticketReason');
            
            // Get the support category
            const guild = await client.guilds.fetch('1239416790455423066');
            const category = await guild.channels.fetch('1321280592926478346');
            
            if (!guild || !category) {
                return interaction.reply({
                    content: 'Failed to create ticket: Server configuration error',
                    ephemeral: true
                });
            }

            // Create ticket in database
            const Ticket = require('../models/Ticket');
            
            // Create the channel name
            const channelName = `${interaction.user.username}-${priority.toLowerCase()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            
            // Create the channel
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: ['ViewChannel']
                    },
                    {
                        id: interaction.user.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    }
                ]
            });

            // Create ticket in database
            const ticket = new Ticket({
                userId: interaction.user.id,
                username: interaction.user.username,
                channelId: channel.id,
                priority: priority,
                reason: reason
            });
            await ticket.save();

            // Send initial message in ticket channel
            const ticketEmbed = new EmbedBuilder()
                .setTitle(`Support Ticket - ${priority}`)
                .setColor(priority === 'URGENT' ? '#FF0000' : 
                         priority === 'HIGH' ? '#FFA500' : 
                         priority === 'MEDIUM' ? '#FFFF00' : '#00FF00')
                .setDescription(reason)
                .addFields(
                    { name: 'User', value: interaction.user.tag, inline: true },
                    { name: 'Priority', value: priority, inline: true },
                    { name: 'Status', value: 'OPEN', inline: true }
                )
                .setTimestamp();

            const closeButton = new ButtonBuilder()
                .setCustomId(`close_ticket_${ticket._id}`)
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(closeButton);

            await channel.send({
                content: `<@${interaction.user.id}> Support ticket created!\n<@863142225210507294> New support ticket!`,
                embeds: [ticketEmbed],
                components: [row]
            });

            await interaction.reply({
                content: `Your support ticket has been created in <#${channel.id}>`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error creating support ticket:', error);
            await interaction.reply({
                content: 'Failed to create support ticket. Please try again later.',
                ephemeral: true
            });
        }
        return;
    }
    
    if (interaction.customId === 'createGameModal_page1') {
        try {
            const gameName = interaction.fields.getTextInputValue('gameName');
            const windowName = interaction.fields.getTextInputValue('windowName');
            const description = interaction.fields.getTextInputValue('description');
            
            // Store the first page data in a temporary object
            const gameData = {
                name: gameName,
                windowName: windowName,
                description: description
            };

            // Store the game data in the cache
            interaction.client.gameCreationCache.set(interaction.user.id, gameData);

            // Acknowledge the modal submission first
            await interaction.deferUpdate();

            // Create and show a new message with button for next step
            const nextButton = new ButtonBuilder()
                .setCustomId('showPricingModal')
                .setLabel('Set Pricing')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(nextButton);

            await interaction.followUp({
                content: '✅ Basic info saved! Click below to set pricing:',
                components: [row],
                ephemeral: true
            });
            const pricingModal = new ModalBuilder()
                .setCustomId('createGameModal_page2')
                .setTitle('Create New Game - Pricing');

            const dailyPriceInput = new TextInputBuilder()
                .setCustomId('dailyPrice')
                .setLabel('Daily Price (-1 disable, 0 free)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue('-1'); // Default value

            const weeklyPriceInput = new TextInputBuilder()
                .setCustomId('weeklyPrice')
                .setLabel('Weekly Price (-1 disable, 0 free)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue('-1'); // Default value

            const monthlyPriceInput = new TextInputBuilder()
                .setCustomId('monthlyPrice')
                .setLabel('Monthly Price (-1 disable, 0 free)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue('-1'); // Default value

            const yearlyPriceInput = new TextInputBuilder()
                .setCustomId('yearlyPrice')
                .setLabel('Yearly Price (-1 disable, 0 free)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue('-1'); // Default value

            pricingModal.addComponents(
                new ActionRowBuilder().addComponents(dailyPriceInput),
                new ActionRowBuilder().addComponents(weeklyPriceInput),
                new ActionRowBuilder().addComponents(monthlyPriceInput),
                new ActionRowBuilder().addComponents(yearlyPriceInput)
            );

            // Show the pricing modal
            try {
                await interaction.showModal(pricingModal);
            } catch (error) {
                console.error('Error showing pricing modal:', error);
                // Don't try to reply here since we already deferred the update
            }
        } catch (error) {
            console.error('Error creating game:', error);
            await interaction.reply({
                content: '❌ Failed to create game. Please try again.',
                ephemeral: true
            });
        }
    }
});

// Handle button interactions for modal
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'showPricingModal') {
        // Check if game data exists in cache
        const gameData = interaction.client.gameCreationCache.get(interaction.user.id);
        if (!gameData) {
            return interaction.reply({
                content: '❌ Game creation session expired. Please start over.',
                ephemeral: true
            });
        }

        // Create pricing modal
        const pricingModal = new ModalBuilder()
            .setCustomId('createGameModal_page2')
            .setTitle('Create New Game - Pricing');

        const dailyPriceInput = new TextInputBuilder()
            .setCustomId('dailyPrice')
            .setLabel('Daily Price (-1 disable, 0 free)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue('-1');

        const weeklyPriceInput = new TextInputBuilder()
            .setCustomId('weeklyPrice')
            .setLabel('Weekly Price (-1 disable, 0 free)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue('-1');

        const monthlyPriceInput = new TextInputBuilder()
            .setCustomId('monthlyPrice')
            .setLabel('Monthly Price (-1 disable, 0 free)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue('-1');

        const yearlyPriceInput = new TextInputBuilder()
            .setCustomId('yearlyPrice')
            .setLabel('Yearly Price (-1 disable, 0 free)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue('-1');

        pricingModal.addComponents(
            new ActionRowBuilder().addComponents(dailyPriceInput),
            new ActionRowBuilder().addComponents(weeklyPriceInput),
            new ActionRowBuilder().addComponents(monthlyPriceInput),
            new ActionRowBuilder().addComponents(yearlyPriceInput)
        );

        await interaction.showModal(pricingModal);
    }
    
    if (interaction.customId === 'openGameModal') {
        try {
            // Create the modal
            const modal = new ModalBuilder()
                .setCustomId('createGameModal_page1')
                .setTitle('Create New Game - Basic Info');

            // Create the text inputs
            const gameNameInput = new TextInputBuilder()
                .setCustomId('gameName')
                .setLabel('Game Name')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const windowNameInput = new TextInputBuilder()
                .setCustomId('windowName')
                .setLabel('Window Name')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const descriptionInput = new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Game Description')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            // Add inputs to action rows
            const firstActionRow = new ActionRowBuilder().addComponents(gameNameInput);
            const secondActionRow = new ActionRowBuilder().addComponents(windowNameInput);
            const thirdActionRow = new ActionRowBuilder().addComponents(descriptionInput);

            // Add the action rows to the modal
            modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

            // Show the modal
            return interaction.showModal(modal).catch(error => {
                console.error('Error showing modal:', error);
                return interaction.reply({ 
                    content: '❌ An error occurred while creating the game modal.',
                    ephemeral: true 
                });
            });
        } catch (error) {
            console.error('Error showing modal:', error);
            await interaction.reply({ 
                content: '❌ An error occurred while creating the game modal.',
                ephemeral: true 
            });
        }
    }
});

// Handle button interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // Handle ticket priority selection
    if (interaction.customId.startsWith('ticket_priority_')) {
        const priority = interaction.customId.split('_')[2];
        
        // Create support ticket modal
        const supportModal = new ModalBuilder()
            .setCustomId(`supportTicketModal_${priority}`)
            .setTitle('Create Support Ticket');

        const reasonInput = new TextInputBuilder()
            .setCustomId('ticketReason')
            .setLabel('What do you need help with?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Describe your issue...');

        const reasonRow = new ActionRowBuilder().addComponents(reasonInput);
        supportModal.addComponents(reasonRow);

        await interaction.showModal(supportModal);
        return;
    }

    if (interaction.customId.startsWith('close_ticket_')) {
        try {
            const ticketId = interaction.customId.split('_')[2];
            const Ticket = require('../models/Ticket');
            
            const ticket = await Ticket.findById(ticketId);
            if (!ticket) {
                return interaction.reply('Ticket not found');
            }

            // Update ticket status
            ticket.status = 'CLOSED';
            ticket.closedAt = new Date();
            await ticket.save();

            // Get the channel
            const channel = interaction.channel;

            // Remove access for the ticket creator
            await channel.permissionOverwrites.edit(ticket.userId, {
                ViewChannel: false,
                SendMessages: false,
                ReadMessageHistory: false
            });

            // Rename channel to archived format
            await channel.setName(`archived-${ticket.username}`);

            // Send closing message
            const closingEmbed = new EmbedBuilder()
                .setTitle('Ticket Closed')
                .setDescription('This support ticket has been closed and access has been removed.')
                .setColor('#FF0000')
                .setTimestamp();

            await interaction.reply({ embeds: [closingEmbed] });

            // Archive and delete the channel after 5 minutes
            setTimeout(async () => {
                try {
                    const channel = await interaction.guild.channels.fetch(ticket.channelId);
                    if (channel) {
                        await channel.delete();
                    }
                } catch (error) {
                    console.error('Error deleting ticket channel:', error);
                }
            }, 5 * 60 * 1000);

        } catch (error) {
            console.error('Error closing ticket:', error);
            await interaction.reply({
                content: 'Failed to close ticket. Please try again later.',
                ephemeral: true
            });
        }
        return;
    }

    if (interaction.customId.startsWith('subscribe_')) {
        try {
            const [, gameId, subscriptionType] = interaction.customId.split('_');
            const game = await Game.findById(gameId);
            
            if (!game) {
                return interaction.reply('Game not found.');
            }

            // Create payment URL using PaymentService
            const paymentService = require('../services/paymentService');
            const payment = await paymentService.createPayment(
                game.prices[subscriptionType],
                gameId,
                subscriptionType,
                interaction.user.id,
                'usd',
                game
            );

            const paymentButton = new ButtonBuilder()
                .setLabel('Complete Purchase')
                .setURL(payment.url)
                .setStyle(ButtonStyle.Link);

            const paymentRow = new ActionRowBuilder()
                .addComponents(paymentButton);

            await interaction.reply({
                content: '🛒 Ready to complete your purchase:',
                components: [paymentRow],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error handling subscription button:', error);
            await interaction.reply({
                content: 'An error occurred while processing your subscription request.',
                ephemeral: true
            });
        }
    }
});

client.on('messageCreate', async (message) => {
    // Handle ticket channel messages
    if (!message.author.bot && message.channel.type === ChannelType.GuildText) {
        try {
            const Ticket = require('../models/Ticket');
            const ticket = await Ticket.findOne({ channelId: message.channel.id, status: 'OPEN' });
            
            if (ticket) {
                const isAdmin = message.member.roles.cache.some(role => 
                    ['ADMIN', 'OWNER'].includes(role.name.toUpperCase())
                );

                if (isAdmin && message.author.id !== ticket.userId) {
                    // Update last admin response time
                    ticket.lastAdminResponse = new Date();
                    await ticket.save();
                } else if (message.author.id === ticket.userId) {
                    // Update last user response time
                    ticket.lastUserResponse = new Date();
                    await ticket.save();
                }
            }
        } catch (error) {
            console.error('Error tracking ticket response:', error);
        }
    }

    // Ignore messages from bots and non-DM channels
    if (message.author.bot) return;

    // Only proceed if it's a DM (ChannelType.DM === 1)
    if (message.channel.type !== ChannelType.DM) return; 
    
    // Check if message starts with !
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        switch (command) {
            case 'profile':
                const profileUser = await User.findOne({ discordId: message.author.id });
                if (!profileUser) {
                    return message.reply('You need to register first! Use !register to create an account.');
                }

                const profileEmbed = await createProfileEmbed(profileUser, message.author);
                message.reply({ embeds: [profileEmbed] });
                break;

            case 'register':
                const existingDMUser = await User.findOne({ discordId: message.author.id });
                if (existingDMUser) {
                    return message.reply('You already have an account registered!');
                }

                const dmUsername = message.author.username.toLowerCase().replace(/[^a-z0-9]/g, '');
                const dmPassword = generatePassword();

                const newDMUser = new User({
                    discordId: message.author.id,
                    username: dmUsername,
                    password: dmPassword
                });

                await newDMUser.save();

                message.reply(
                    `✨ **Account Created Successfully!** ✨\n\n` +
                    `📝 **Your Login Credentials:**\n` +
                    `> **Username:** \`${dmUsername}\`\n` +
                    `> **Password:** \`${dmPassword}\`\n\n` +
                    `🔒 **IMPORTANT:** Save these credentials immediately!\n` +
                    `You'll need them to log in to your account later.`
                );
                break;

            case 'games':
                const dmGames = await Game.find({ active: true });
                
                if (dmGames.length === 0) {
                    return message.reply('No games are currently available.');
                }

                const gameSelect = new StringSelectMenuBuilder()
                    .setCustomId('game_select')
                    .setPlaceholder('Select a game')
                    .addOptions(dmGames.map(game => ({
                        label: game.name,
                        description: game.description.substring(0, 100),
                        value: game._id.toString()
                    })));

                const selectRow = new ActionRowBuilder()
                    .addComponents(gameSelect);

                await message.reply({
                    content: '🎮 **Available Games**\nSelect a game to view subscription options:',
                    components: [selectRow]
                });
                break;

            case 'creategame':
                // Check if user is authorized
                if (message.author.id !== '863142225210507294') {
                    return message.reply('❌ You are not authorized to create games.');
                }

                // Initialize the game creation cache if it doesn't exist
                if (!client.gameCreationCache) {
                    client.gameCreationCache = new Map();
                }

                const createGameButton = new ButtonBuilder()
                    .setCustomId('openGameModal')
                    .setLabel('Start Game Creation')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder().addComponents(createGameButton);

                await message.author.send({
                    content: '🎮 **Create New Game**\nClick the button below to start the game creation process:',
                    components: [row]
                }).catch(error => {
                    console.error('Error initiating game creation:', error);
                    message.reply('❌ Failed to start game creation process.');
                });
                break;

            case 'upload':
                // Check if user is authorized
                if (message.author.id !== '863142225210507294') {
                    return message.reply('❌ You are not authorized to use the upload command.');
                }

                // Check if a file was attached
                if (!message.attachments.size) {
                    return message.reply('❌ Please attach a file to upload.');
                }

                const attachment = message.attachments.first();
                const fileExt = path.extname(attachment.name).toLowerCase();

                // Validate file extension
                const validExtensions = ['.exe', '.dll', '.sys'];
                if (!validExtensions.includes(fileExt)) {
                    return message.reply(`❌ Invalid file type. Allowed extensions: ${validExtensions.join(', ')}`);
                }

                try {
                    // Download the file
                    const response = await fetch(attachment.url);
                    const buffer = await response.buffer();

                    // Get game ID from command arguments
                    const gameId = args[0];
                    if (!gameId) {
                        return message.reply('❌ Please specify a game ID: !upload <gameId>');
                    }

                    // Create form data
                    const formData = new FormData();
                    formData.append('file', buffer, attachment.name);
                    formData.append('gameId', gameId);

                    // Send to upload endpoint
                    const uploadResponse = await fetch(`http://localhost:${process.env.API_PORT}/api/uploads`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${process.env.API_TOKEN}`
                        },
                        body: formData
                    });

                    const result = await uploadResponse.json();

                    if (uploadResponse.ok) {
                        message.reply(`✅ File uploaded successfully!\nEncrypted filename: ${result.fileName}`);
                    } else {
                        message.reply(`❌ Upload failed: ${result.error}`);
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    message.reply('❌ An error occurred while uploading the file.');
                }
                break;

            case 'motd':
                // Check if setting new MOTD
                if (args.length > 0) {
                    // Only owner can set MOTD
                    if (message.author.id !== '863142225210507294') {
                        return message.reply('❌ Only the owner can set the MOTD.');
                    }

                    const newMessage = args.join(' ');
                    try {
                        const response = await fetch(`http://localhost:${process.env.API_PORT}/api/motd`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${process.env.API_TOKEN}`
                            },
                            body: JSON.stringify({ message: newMessage })
                        });

                        if (response.ok) {
                            message.reply('✅ MOTD updated successfully!');
                        } else {
                            message.reply('❌ Failed to update MOTD.');
                        }
                    } catch (error) {
                        console.error('Error updating MOTD:', error);
                        message.reply('❌ An error occurred while updating MOTD.');
                    }
                } else {
                    // Get current MOTD
                    try {
                        const response = await fetch(`http://localhost:${process.env.API_PORT}/api/motd`);
                        const data = await response.json();
                        message.reply(`📢 **Message of the Day:**\n${data.message}`);
                    } catch (error) {
                        console.error('Error fetching MOTD:', error);
                        message.reply('❌ Failed to fetch MOTD.');
                    }
                }
                break;

            case 'ban':
                // Check if user is owner/admin
                if (message.author.id !== '863142225210507294') {
                    const adminUser = await User.findOne({ discordId: message.author.id });
                    if (!adminUser || adminUser.role !== 'ADMIN') {
                        return message.reply('❌ You do not have permission to ban users.');
                    }
                }

                // Check ban type and target
                if (args.length < 2) {
                    return message.reply('❌ Usage:\n!ban discord <@user> [reason]\n!ban userid <userid> [reason]\n!ban hwid <hwid> [reason]');
                }

                const banType = args[0].toLowerCase();
                const banTarget = args[1];
                const banReason = args.slice(2).join(' ') || 'No reason provided';

                try {
                    let targetUser;
                    switch (banType) {
                        case 'discord':
                            const targetDiscordId = banTarget.replace(/[<@!>]/g, '');
                            targetUser = await User.findOne({ discordId: targetDiscordId });
                            if (!targetUser) {
                                return message.reply('❌ Discord user not found.');
                            }
                            break;
                            
                        case 'userid':
                            targetUser = await User.findOne({ discordId: banTarget });
                            if (!targetUser) {
                                return message.reply('❌ User ID not found.');
                            }
                            break;
                            
                        case 'hwid':
                            targetUser = await User.findOne({ hwid: banTarget });
                            if (!targetUser) {
                                return message.reply('❌ HWID not found.');
                            }
                            // Ban all accounts with this HWID
                            const hwidUsers = await User.find({ hwid: banTarget });
                            for (const user of hwidUsers) {
                                if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
                                    user.role = 'BANNED';
                                    user.banReason = banReason;
                                    user.banSource = 'HWID';
                                    await user.save();
                                }
                            }
                            break;
                            
                        default:
                            return message.reply('❌ Invalid ban type. Use: discord, userid, or hwid');
                    }

                    if (targetUser.role === 'OWNER' || targetUser.role === 'ADMIN') {
                        return message.reply('❌ Cannot ban administrators or owners.');
                    }

                    // Store previous role before banning
                    targetUser.previousRole = targetUser.role;
                    targetUser.role = 'BANNED';
                    targetUser.banReason = banReason;
                    targetUser.banSource = banType.toUpperCase();
                    await targetUser.save();

                    // Update Discord role for HWID banned user
                    try {
                        const guild = await client.guilds.fetch('1239416790455423066');
                        const member = await guild.members.fetch(targetUser.discordId);
                        if (member) {
                            await syncUserRoles(member, 'BANNED', guild);
                        }
                    } catch (error) {
                        console.error('Error updating Discord role for HWID banned user:', error);
                    }

                    // Update Discord role
                    try {
                        const guild = await client.guilds.fetch('1239416790455423066');
                        const member = await guild.members.fetch(targetUser.discordId);
                        if (member) {
                            await syncUserRoles(member, 'BANNED', guild);
                        }
                    } catch (error) {
                        console.error('Error updating Discord role:', error);
                    }

                    // Try to DM the banned user if it's a Discord ban
                    if (banType === 'discord') {
                        try {
                            const bannedDiscordUser = await client.users.fetch(targetUser.discordId);
                            await bannedDiscordUser.send(`🚫 Your account has been banned.\nReason: ${banReason}`);
                        } catch (dmError) {
                            console.error('Could not DM banned user:', dmError);
                        }
                    }

                    // Send ban announcement to the designated channel
                    const { generateBanAnnouncement } = require('../utils/banMessages');
                    const banChannel = await client.channels.fetch('1321285178030821478');
                    if (banChannel) {
                        await banChannel.send({
                            content: '@everyone',
                            ...generateBanAnnouncement(targetUser.username, banReason)
                        });
                    }

                    message.reply(`✅ Successfully banned ${targetUser.username}\nBan Type: ${banType.toUpperCase()}\nReason: ${banReason}`);
                } catch (error) {
                    console.error('Ban error:', error);
                    message.reply('❌ Failed to ban user.');
                }
                break;

            case 'unban':
                // Check if user is owner/admin
                if (message.author.id !== '863142225210507294') {
                    const adminUser = await User.findOne({ discordId: message.author.id });
                    if (!adminUser || adminUser.role !== 'ADMIN') {
                        return message.reply('❌ You do not have permission to unban users.');
                    }
                }

                if (args.length < 2) {
                    return message.reply('❌ Usage:\n!unban discord <@user>\n!unban userid <userid>\n!unban hwid <hwid>');
                }

                const unbanType = args[0].toLowerCase();
                const unbanTarget = args[1];

                try {
                    let targetUsers = [];
                    switch (unbanType) {
                        case 'discord':
                            const targetDiscordId = unbanTarget.replace(/[<@!>]/g, '');
                            const discordUser = await User.findOne({ discordId: targetDiscordId });
                            if (!discordUser) {
                                return message.reply('❌ Discord user not found.');
                            }
                            targetUsers = [discordUser];
                            break;
                            
                        case 'userid':
                            const idUser = await User.findOne({ discordId: unbanTarget });
                            if (!idUser) {
                                return message.reply('❌ User ID not found.');
                            }
                            targetUsers = [idUser];
                            break;
                            
                        case 'hwid':
                            targetUsers = await User.find({ hwid: unbanTarget, role: 'BANNED' });
                            if (targetUsers.length === 0) {
                                return message.reply('❌ No banned users found with this HWID.');
                            }
                            break;
                            
                        default:
                            return message.reply('❌ Invalid unban type. Use: discord, userid, or hwid');
                    }

                    for (const user of targetUsers) {
                        if (user.role === 'BANNED') {
                            // Restore previous role or default to USER
                            user.role = user.previousRole || 'USER';
                            user.banReason = null;
                            user.banSource = null;
                            user.previousRole = null;
                            await user.save();

                            // Update Discord role
                            try {
                                const guild = await client.guilds.fetch('1239416790455423066');
                                const member = await guild.members.fetch(user.discordId);
                                if (member) {
                                    await syncUserRoles(member, user.role, guild);
                                }
                            } catch (error) {
                                console.error('Error updating Discord role for unbanned user:', error);
                            }

                            // Try to DM the unbanned user if it's a Discord unban
                            if (unbanType === 'discord') {
                                try {
                                    const unbannedDiscordUser = await client.users.fetch(user.discordId);
                                    await unbannedDiscordUser.send('✅ Your account has been unbanned.');
                                } catch (dmError) {
                                    console.error('Could not DM unbanned user:', dmError);
                                }
                            }
                        }
                    }

                    const unbannedCount = targetUsers.length;
                    message.reply(`✅ Successfully unbanned ${unbannedCount} user(s)`);
                } catch (error) {
                    console.error('Unban error:', error);
                    message.reply('❌ Failed to unban user(s).');
                }
                break;

            case 'sale':
                // Check if user is owner
                if (message.author.id !== '863142225210507294') {
                    return message.reply('❌ Only the owner can announce sales.');
                }

                // Parse sale command arguments
                // Format: !sale <gameId> <discountPercentage> <endDate> <message>
                const [saleGameId, discountStr, endDateStr, ...saleMessageArr] = args;
                const saleMessage = saleMessageArr.join(' ');

                if (!saleGameId || !discountStr || !endDateStr || !saleMessage) {
                    return message.reply('❌ Usage: !sale <gameId> <discountPercentage> <endDate> <message>\nExample: !sale 65adf123 50 2024-01-31 Flash sale on Game X!');
                }

                try {
                    const game = await Game.findById(saleGameId);
                    if (!game) {
                        return message.reply('❌ Game not found.');
                    }

                    const discount = parseInt(discountStr);
                    if (isNaN(discount) || discount <= 0 || discount >= 100) {
                        return message.reply('❌ Discount must be a number between 1 and 99.');
                    }

                    const endDate = new Date(endDateStr);
                    if (isNaN(endDate.getTime())) {
                        return message.reply('❌ Invalid date format. Use YYYY-MM-DD.');
                    }

                    // Update game with sale information
                    game.sale = {
                        active: true,
                        discountPercentage: discount,
                        endDate: endDate
                    };
                    await game.save(); // This will trigger the pre-save middleware to calculate sale prices

                    // Create sale record for tracking
                    const Sale = require('../models/Sale');
                    const newSale = new Sale({
                        game: game._id,
                        discountPercentage: discount,
                        endDate: endDate,
                        active: true
                    });
                    await newSale.save();

                    // Create sale embed using the game's calculated sale prices
                    const saleEmbed = new EmbedBuilder()
                        .setTitle('🔥 SPECIAL SALE ALERT! 🔥')
                        .setColor('#FF0000')
                        .setDescription(saleMessage)
                        .addFields(
                            { name: '🎮 Game', value: game.name, inline: true },
                            { name: '💫 Discount', value: `${discount}% OFF!`, inline: true },
                            { name: '⏰ Ends', value: endDate.toLocaleDateString(), inline: true }
                        )
                        .setTimestamp();

                    // Add prices using the game's calculated sale prices
                    const priceFields = [];
                    if (game.prices.daily !== -1) {
                        priceFields.push({ 
                            name: '24 Hour Access', 
                            value: `~~$${game.prices.daily}~~ **$${game.sale.salePrices.daily}**`, 
                            inline: true 
                        });
                    }
                    if (game.prices.weekly !== -1) {
                        priceFields.push({ 
                            name: '7 Day Access', 
                            value: `~~$${game.prices.weekly}~~ **$${game.sale.salePrices.weekly}**`, 
                            inline: true 
                        });
                    }
                    if (game.prices.monthly !== -1) {
                        priceFields.push({ 
                            name: '30 Day Access', 
                            value: `~~$${game.prices.monthly}~~ **$${game.sale.salePrices.monthly}**`, 
                            inline: true 
                        });
                    }
                    if (game.prices.yearly !== -1) {
                        priceFields.push({ 
                            name: '365 Day Access', 
                            value: `~~$${game.prices.yearly}~~ **$${game.sale.salePrices.yearly}**`, 
                            inline: true 
                        });
                    }
                    saleEmbed.addFields(priceFields);

                    // Create subscription buttons
                    const buttons = [];
                    if (game.prices.daily !== -1) {
                        buttons.push(
                            new ButtonBuilder()
                                .setCustomId(`subscribe_${game._id}_daily`)
                                .setLabel(`24 Hours ($${game.sale.salePrices.daily.toFixed(2)})`)
                                .setStyle(ButtonStyle.Success)
                        );
                    }
                    if (game.prices.weekly !== -1) {
                        buttons.push(
                            new ButtonBuilder()
                                .setCustomId(`subscribe_${game._id}_weekly`)
                                .setLabel(`7 Days ($${game.sale.salePrices.weekly.toFixed(2)})`)
                                .setStyle(ButtonStyle.Success)
                        );
                    }
                    if (game.prices.monthly !== -1) {
                        buttons.push(
                            new ButtonBuilder()
                                .setCustomId(`subscribe_${game._id}_monthly`)
                                .setLabel(`30 Days ($${game.sale.salePrices.monthly.toFixed(2)})`)
                                .setStyle(ButtonStyle.Success)
                        );
                    }
                    if (game.prices.yearly !== -1) {
                        buttons.push(
                            new ButtonBuilder()
                                .setCustomId(`subscribe_${game._id}_yearly`)
                                .setLabel(`365 Days ($${game.sale.salePrices.yearly.toFixed(2)})`)
                                .setStyle(ButtonStyle.Success)
                        );
                    }

                    // Create button rows (Discord has a limit of 5 buttons per row)
                    const buttonRows = [];
                    for (let i = 0; i < buttons.length; i += 5) {
                        buttonRows.push(
                            new ActionRowBuilder().addComponents(buttons.slice(i, i + 5))
                        );
                    }

                    // Get all registered users
                    const users = await User.find({});
                    let sentCount = 0;
                    let failedCount = 0;

                    // Send DM to each user
                    for (const user of users) {
                        try {
                            const discordUser = await client.users.fetch(user.discordId);
                            await discordUser.send({ 
                                embeds: [saleEmbed],
                                components: buttonRows
                            });
                            sentCount++;
                            // Add small delay to avoid rate limiting
                            await new Promise(resolve => setTimeout(resolve, 100));
                        } catch (error) {
                            console.error(`Failed to send sale DM to user ${user.username}:`, error);
                            failedCount++;
                        }
                    }

                    message.reply(`✅ Sale announcement sent!\nSuccessfully sent to: ${sentCount} users\nFailed to send to: ${failedCount} users`);
                } catch (error) {
                    console.error('Error announcing sale:', error);
                    message.reply('❌ An error occurred while announcing the sale.');
                }
                break;

            case 'support':
                // Create modal for support ticket
                const supportModal = new ModalBuilder()
                    .setCustomId('supportTicketModal')
                    .setTitle('Create Support Ticket');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('ticketReason')
                    .setLabel('What do you need help with?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setPlaceholder('Describe your issue...');

                const reasonRow = new ActionRowBuilder().addComponents(reasonInput);
                supportModal.addComponents(reasonRow);

                try {
                    await message.author.send({
                        content: 'Please select a priority for your ticket:',
                        components: [new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('ticket_priority_LOW')
                                    .setLabel('Low')
                                    .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('ticket_priority_MEDIUM')
                                    .setLabel('Medium')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId('ticket_priority_HIGH')
                                    .setLabel('High')
                                    .setStyle(ButtonStyle.Danger),
                                new ButtonBuilder()
                                    .setCustomId('ticket_priority_URGENT')
                                    .setLabel('Urgent')
                                    .setStyle(ButtonStyle.Danger)
                                    .setEmoji('🚨')
                            )]
                    });
                } catch (error) {
                    console.error('Error sending support message:', error);
                    message.reply('Failed to create support ticket. Please ensure your DMs are open.');
                }
                break;

            default:
                message.reply('Unknown command. Available commands: !profile, !register, !games, !upload, !creategame, !motd, !ban, !unban, !sale, !support');
        }
    } catch (error) {
        console.error(`Error handling DM command ${command}:`, error);
        message.reply('An error occurred while processing your command.');
    }
});


module.exports = client;
