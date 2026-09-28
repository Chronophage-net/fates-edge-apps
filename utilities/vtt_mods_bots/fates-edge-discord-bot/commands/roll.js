const { SlashCommandBuilder } = require('discord.js');
const { randomInt } = require('node:crypto');

function rollDice(expression) {
    const match = /^(\d{1,3})d(\d{1,3})([+-]\d{1,3})?$/i.exec(expression.trim());
    if (!match || +match[1] < 1 || +match[1] > 100 || +match[2] < 2 || +match[2] > 100) {
        throw new Error('Use NdS[+modifier], with 1–100 dice and 2–100 sides.');
    }
    const rolls = Array.from({ length: +match[1] }, () => randomInt(1, +match[2] + 1));
    return { rolls, total: rolls.reduce((a, b) => a + b, Number(match[3] || 0)) };
}
module.exports = {
    data: new SlashCommandBuilder().setName('roll').setDescription('Roll local dice; apply Fate’s Edge outcomes at the table')
        .addStringOption(option => option.setName('dice').setDescription('For example: 4d10 or 2d6+3').setRequired(true).setMaxLength(20)),
    async execute(interaction, client) {
        const expr = interaction.options.getString('dice');
        let result;
        try { result = rollDice(expr); }
        catch (error) { return interaction.reply({ content: error.message, ephemeral: true }); }
        await interaction.reply({ content: `🎲 ${expr}: ${result.rolls.join(', ')} → **${result.total}**`, allowedMentions: { parse: [] } });
        if (client.vtt?.connected) client.vtt.send('roll-result', { expr, result: result.total, ...result, sender: interaction.user.username });
    },
    rollDice
};
