const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { PaperImports, deliverOperations } = require('../utils/paper-import');
const sessions = new PaperImports();

function context(interaction, client) {
    if (!interaction.guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        throw new Error('Importing campaign data requires Manage Server permission.');
    }
    const vtt = client.vtt;
    if (!vtt?.connected || !vtt.clientId || !vtt.roomCode) throw new Error('Connect the bot to the intended VTT room first.');
    return { user: interaction.user.id, guild: interaction.guildId, channel: interaction.channelId,
        room: vtt.roomCode, server: vtt.config.serverUrl, connection: vtt.clientId };
}
const privateReply = { ephemeral: true, allowedMentions: { parse: [] } };

module.exports = {
    data: new SlashCommandBuilder().setName('vttimport').setDescription('Preview and import a transcribed paper sheet')
        .setDMPermission(false).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction, client) {
        try {
            context(interaction, client);
            const field = new TextInputBuilder().setCustomId('paper-text').setLabel('Paper blocks (new entries only)')
                .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000)
                .setPlaceholder('=== Character ===\nName: Rowan\nBody: 2\nSkills: Melee=2, Lore=1');
            await interaction.showModal(new ModalBuilder().setCustomId('paper-import:input').setTitle('Import from Paper')
                .addComponents(new ActionRowBuilder().addComponents(field)));
        } catch (error) {
            await interaction.reply({ ...privateReply, content: error.message });
        }
    },
    async handleInteraction(interaction, client) {
        try {
            const current = context(interaction, client);
            if (interaction.isModalSubmit()) {
                await interaction.deferReply({ ephemeral: true });
                const preview = await sessions.preview(interaction.fields.getTextInputValue('paper-text'), current);
                const components = preview.token ? [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`paper-import:confirm:${preview.token}`).setLabel('Import reviewed entries').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`paper-import:cancel:${preview.token}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                )] : [];
                await interaction.editReply({
                    content: preview.token
                        ? `Review all ${preview.count} entries in the attached preview, including any OCR corrections. Destination: **${current.room}**. Keep a web client connected to this room with Live Campaign Sync enabled. Confirm within five minutes. Entries are new records; importing the same sheet twice creates duplicates.`
                        : 'Nothing imported. Correct the issues in the attached report, then run /vttimport again.',
                    files: [new AttachmentBuilder(Buffer.from(preview.report, 'utf8'), { name: 'paper-import-preview.txt' })],
                    components, allowedMentions: { parse: [] }
                });
                return;
            }
            const [, action, token] = interaction.customId.split(':');
            if (!['confirm', 'cancel'].includes(action) || !token) throw new Error('Invalid import button.');
            const operations = sessions.take(token, current);
            await interaction.update({ content: action === 'cancel' ? 'Import cancelled. Nothing sent.' : 'Sending reviewed entries…', components: [], allowedMentions: { parse: [] } });
            if (action === 'cancel') return;
            const result = await deliverOperations(client.vtt, operations, current);
            let content;
            if (result.confirmed === result.total) {
                content = `A connected web client acknowledged all ${result.total} entries. Check them in the web client. This is a client receipt, not a server backup.`;
            } else {
                content = `${result.confirmed} of ${result.total} entries acknowledged. ${result.uncertain ? 'The next entry may have arrived, but delivery was not confirmed.' : 'The connection changed before the next entry was sent.'} Remaining entries were not sent. Check the web client against the attached preview before trying again; do not re-import the entire sheet.`;
            }
            await interaction.editReply({ content, components: [], allowedMentions: { parse: [] } });
        } catch (error) {
            const message = { content: error.message, allowedMentions: { parse: [] } };
            if (interaction.deferred || interaction.replied) await interaction.editReply({ ...message, components: [] });
            else await interaction.reply({ ...privateReply, ...message });
        }
    }
};
