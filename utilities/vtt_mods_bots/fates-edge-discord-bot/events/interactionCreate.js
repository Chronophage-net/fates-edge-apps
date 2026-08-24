/**
 * Interaction Create Event Handler
 */

const logger = require('../utils/logger');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // NEW: Assistant GM suggestion Approve/Reject buttons (see
        // events/ready.js's assistantSuggestionCreated listener, which
        // posts these with customId `assistant_suggestion:<approve|
        // reject>:<id>`). Translates the click into the same `!gm
        // approve <id>` / `!gm reject <id>` chat command a human GM would
        // type in Discord via /vttchat -- no new client->server request
        // type, same reuse-the-approval-path posture as the web client's
        // equivalent buttons (see ROADMAP.md item 2).
        if (interaction.isButton() && interaction.customId?.startsWith('assistant_suggestion:')) {
            const [, action, id] = interaction.customId.split(':');
            if ((action !== 'approve' && action !== 'reject') || !id) {
                return interaction.reply({ content: '❌ Malformed suggestion button.', ephemeral: true });
            }
            if (!client.vtt?.connected) {
                return interaction.reply({ content: '❌ Not connected to VTT server.', ephemeral: true });
            }
            try {
                client.vtt.send('chat-message', {
                    type: 'chat-message',
                    text: `!gm ${action} ${id}`,
                    sender: interaction.user.username,
                    recipient: 'all',
                    whisper: false,
                    timestamp: Date.now(),
                });
                await interaction.reply({ content: `${action === 'approve' ? '✅ Approved' : '🗑️ Rejected'} — sent to the GM bot.`, ephemeral: true });
            } catch (error) {
                logger.error('❌ Failed to relay Assistant GM suggestion action:', error);
                await interaction.reply({ content: `❌ Failed to send: ${error.message}`, ephemeral: true });
            }
            return;
        }

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
