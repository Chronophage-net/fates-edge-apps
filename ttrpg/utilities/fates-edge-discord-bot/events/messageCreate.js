/**
 * Message Create Event Handler
 * Handles prefix commands
 */

const logger = require('../utils/logger');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // Ignore bots and empty messages
        if (message.author.bot) return;
        if (!message.content) return;

        const prefix = process.env.PREFIX || '!';

        // Check for prefix
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();

        // Map legacy commands to slash commands
        const commandMap = {
            'vtt': 'vtt connect',
            'roll': 'roll',
            'chat': 'vttchat',
            'char': 'vttchar list',
            'timer': 'vtttimer list',
            'help': 'help'
        };

        // This is a simplified handler - in a real bot, you'd want to
        // either implement prefix commands or just use slash commands
        // We'll just log that a prefix command was used
        logger.info(`📝 Prefix command: ${commandName} (${message.author.username})`);

        // Send a helpful response
        const helpMessage = [
            '📖 **Fate\'s Edge Bot Commands:**',
            `Use slash commands (/) for all functionality:`,
            `- /vtt connect - Connect to VTT server`,
            `- /vtt status - Check connection status`,
            `- /roll <dice> - Roll dice`,
            `- /vttchat <message> - Send message to VTT`,
            `- /vttchar list - List characters`,
            `- /vtttimer list - List timers`,
            '',
            `Type / to see all available commands.`
        ].join('\n');

        await message.reply(helpMessage);
    }
};
