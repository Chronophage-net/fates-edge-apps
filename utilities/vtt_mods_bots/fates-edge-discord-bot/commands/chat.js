/**
 * Chat Relay Commands – Send messages to VTT chat with optional whispers and system messages
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vttchat')
        .setDescription('Send a message to the VTT chat')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Message to send')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sender')
                .setDescription('Sender name (defaults to Discord username)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('whisper')
                .setDescription('Target player name or ID for a whisper')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('system')
                .setDescription('Send as system message (admin only)')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        const message = interaction.options.getString('message');
        const sender = interaction.options.getString('sender') || interaction.user.username;
        const whisperTarget = interaction.options.getString('whisper') || null;
        const system = interaction.options.getBoolean('system') || false;

        await interaction.deferReply({ ephemeral: true });

        try {
            if (!client.vtt.connected) {
                return interaction.editReply('❌ Not connected to VTT server. Use `/vtt connect` first.');
            }

            // Check system message permission
            if (system) {
                const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
                if (!isAdmin) {
                    return interaction.editReply('❌ You need Administrator permission to send system messages.');
                }
            }

            // Build the chat payload
            const payload = {
                type: 'chat-message',
                text: message,
                sender: system ? 'System' : sender,
                recipient: whisperTarget || 'all',
                whisper: !!whisperTarget,
                timestamp: Date.now()
            };

            // Send via VTT client (uses WebSocket)
            client.vtt.send('chat-message', payload);

            // Build confirmation embed
            const embed = new EmbedBuilder()
                .setColor(system ? 0xf1c40f : 0x43b581)
                .setTitle(system ? '📢 System Message Sent' : '📤 Message Sent to VTT')
                .addFields(
                    { name: 'Sender', value: system ? 'System' : sender, inline: true },
                    { name: 'Recipient', value: whisperTarget || 'Everyone', inline: true },
                    { name: 'Message', value: message, inline: false }
                )
                .setFooter({ text: system ? 'System message' : 'Chat message' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            await interaction.editReply(`❌ Error: ${err.message}`);
        }
    }
};