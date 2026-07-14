/**
 * Dice Rolling Commands
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll dice and optionally send to VTT')
        .addStringOption(option =>
            option.setName('dice')
                .setDescription('Dice expression (e.g., 3d6+2)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the roll')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('vtt')
                .setDescription('Send roll to VTT')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        const dice = interaction.options.getString('dice');
        const reason = interaction.options.getString('reason') || 'Dice roll';
        const sendToVTT = interaction.options.getBoolean('vtt') || false;

        await interaction.deferReply();

        try {
            // Parse and roll dice
            const result = parseDice(dice);

            // Create embed
            const embed = new EmbedBuilder()
                .setTitle('🎲 Dice Roll')
                .setColor(0xd4af37)
                .addFields(
                    { name: 'Expression', value: dice, inline: true },
                    { name: 'Result', value: String(result.total), inline: true },
                    { name: 'Rolls', value: result.rolls.join(' + '), inline: false }
                )
                .setFooter({ text: `Rolled by ${interaction.user.username}` })
                .setTimestamp();

            if (reason) {
                embed.addFields({ name: 'Reason', value: reason, inline: false });
            }

            // Send to Discord
            await interaction.editReply({ embeds: [embed] });

            // Send to VTT if requested
            if (sendToVTT && client.vtt.connected) {
                client.vtt.sendRoll(dice, reason, interaction.user.username);
                await interaction.followUp({ content: '📤 Roll sent to VTT', ephemeral: true });
            }

        } catch (err) {
            await interaction.editReply(`❌ Error: ${err.message}`);
        }
    }
};

function parseDice(expr) {
    // Parse dice expression like "3d6+2"
    const parts = expr.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!parts) {
        const num = parseInt(expr);
        if (isNaN(num)) {
            throw new Error('Invalid dice expression. Use format: 3d6+2');
        }
        return { total: num, rolls: [num] };
    }

    const count = parseInt(parts[1]);
    const sides = parseInt(parts[2]);
    const modifier = parseInt(parts[3]) || 0;

    if (count > 100) throw new Error('Cannot roll more than 100 dice');
    if (sides > 1000) throw new Error('Cannot roll more than 1000-sided dice');

    const rolls = [];
    let total = 0;
    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        total += roll;
    }
    total += modifier;

    return { total, rolls };
}
