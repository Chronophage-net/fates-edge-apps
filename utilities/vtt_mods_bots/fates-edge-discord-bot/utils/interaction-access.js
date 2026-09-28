const { PermissionsBitField } = require('discord.js');
// One bot process owns one VTT identity (and possibly a deployment API key).
// Do not lend that authority to another Discord guild or ordinary members.
function accessError(interaction, config) {
    if (!config.discord?.guildId || interaction.guildId !== config.discord.guildId) return 'Use this bot in its configured Discord server.';
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) return 'Manage Server permission is required to use this shared VTT bridge.';
    return null;
}
module.exports = { accessError };
