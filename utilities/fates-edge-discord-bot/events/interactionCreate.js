/**
 * Interaction Create Event Handler
 */

const logger = require('../utils/logger');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            logger.warn(`⚠️ Command not found: ${interaction.commandName}`);
            return;
        }

        try {
            logger.info(`📝 Command: ${interaction.commandName} (${interaction.user.username})`);
            await command.execute(interaction, client);
        } catch (error) {
            logger.error(`❌ Command error (${interaction.commandName}):`, error);
            await interaction.reply({
                content: `❌ There was an error executing this command: ${error.message}`,
                ephemeral: true
            });
        }
    }
};
