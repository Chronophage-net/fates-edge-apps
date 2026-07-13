/**
 * Chat Relay Commands
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
        ),

    async execute(interaction, client) {
        const message = interaction.options.getString('message');
        const sender = interaction.options.getString('sender') || interaction.user.username;

        await interaction.deferReply({ ephemeral: true });

        try {
            if (!client.vtt.connected) {
                return interaction.editReply('❌ Not connected to VTT server. Use `/vtt connect` first.');
            }

            // Send to VTT
            client.vtt.sendChatMessage(message, sender);

            // Confirm
            const embed = new EmbedBuilder()
                .setColor(0x43b581)
                .setTitle('📤 Message Sent to VTT')
                .addFields(
                    { name: 'Sender', value: sender, inline: true },
                    { name: 'Message', value: message, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            await interaction.editReply(`❌ Error: ${err.message}`);
        }
    }
};
