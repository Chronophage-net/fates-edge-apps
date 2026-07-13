/**
 * Fate's Edge Discord Bot
 * Integrates Discord with the Fate's Edge VTT WebSocket Server
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Import utilities
const VTTClient = require('./utils/websocket');
const logger = require('./utils/logger');
const config = require('./utils/config');

// ============================================================
// Discord Client Setup
// ============================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

client.commands = new Collection();
client.vtt = new VTTClient(config.vtt);

// ============================================================
// Command Loading
// ============================================================

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    try {
        const command = require(`./commands/${file}`);
        if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
            logger.info(`✅ Loaded command: ${command.data.name}`);
        } else {
            logger.warn(`⚠️ Skipping ${file}: missing data or execute`);
        }
    } catch (err) {
        logger.error(`❌ Failed to load command ${file}:`, err);
    }
}

// ============================================================
// Event Loading
// ============================================================

const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    try {
        const event = require(`./events/${file}`);
        const eventName = file.split('.')[0];
        if (event.once) {
            client.once(eventName, (...args) => event.execute(...args, client));
        } else {
            client.on(eventName, (...args) => event.execute(...args, client));
        }
        logger.info(`✅ Loaded event: ${eventName}`);
    } catch (err) {
        logger.error(`❌ Failed to load event ${file}:`, err);
    }
}

// ============================================================
// Slash Command Registration
// ============================================================

async function registerCommands() {
    const commands = [];
    for (const command of client.commands.values()) {
        commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        logger.info('🔄 Registering slash commands...');

        if (process.env.DISCORD_GUILD_ID) {
            // Guild-specific commands (instant update)
            await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
                { body: commands }
            );
            logger.info(`✅ Registered ${commands.length} guild commands`);
        } else {
            // Global commands (up to 1 hour to propagate)
            await rest.put(
                Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
                { body: commands }
            );
            logger.info(`✅ Registered ${commands.length} global commands`);
        }
    } catch (err) {
        logger.error('❌ Failed to register commands:', err);
    }
}

// ============================================================
// Express Webhook Server (Optional)
// ============================================================

function startWebhookServer() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    const port = process.env.WEBHOOK_PORT || 3001;
    const secret = process.env.WEBHOOK_SECRET || 'fates-edge-webhook';

    // Webhook endpoint for external services
    app.post('/webhook', (req, res) => {
        const auth = req.headers['x-webhook-secret'];
        if (auth !== secret) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { event, data } = req.body;
        logger.info(`📨 Webhook received: ${event}`);

        // Handle webhook events
        switch (event) {
            case 'vtt-roll':
                // Broadcast roll to Discord channel
                const channel = client.channels.cache.get(data.channelId);
                if (channel) {
                    const embed = {
                        title: '🎲 VTT Dice Roll',
                        description: `**${data.sender}** rolled: ${data.roll}`,
                        fields: [
                            { name: 'Result', value: data.result, inline: true },
                            { name: 'Reason', value: data.reason || 'No reason', inline: true }
                        ],
                        color: 0xd4af37,
                        timestamp: new Date().toISOString()
                    };
                    channel.send({ embeds: [embed] });
                }
                res.json({ success: true });
                break;

            case 'vtt-chat':
                const chatChannel = client.channels.cache.get(data.channelId);
                if (chatChannel) {
                    chatChannel.send(`💬 **${data.sender}:** ${data.message}`);
                }
                res.json({ success: true });
                break;

            default:
                res.json({ success: true, message: 'Event received but no action taken' });
        }
    });

    app.listen(port, () => {
        logger.info(`🌐 Webhook server running on port ${port}`);
    });
}

// ============================================================
// Bot Login
// ============================================================

client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        logger.info(`✅ Logged in as ${client.user.tag}`);
        registerCommands();
        if (process.env.WEBHOOK_PORT) {
            startWebhookServer();
        }
    })
    .catch(err => {
        logger.error('❌ Failed to login:', err);
        process.exit(1);
    });

// ============================================================
// Graceful Shutdown
// ============================================================

process.on('SIGINT', () => {
    logger.info('🛑 Shutting down...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('🛑 Shutting down...');
    client.destroy();
    process.exit(0);
});

module.exports = client;
