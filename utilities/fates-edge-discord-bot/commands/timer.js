/**
 * Timer Management Commands
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Store timers locally
const timers = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vtttimer')
        .setDescription('Manage VTT timers')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new timer')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Timer name')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('segments')
                        .setDescription('Number of segments (4-10)')
                        .setRequired(true)
                        .setMinValue(2)
                        .setMaxValue(12)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('tick')
                .setDescription('Tick a timer forward')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Timer name')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of ticks (default: 1)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(5)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all active timers')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a timer')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Timer name')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reset a timer to 0')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Timer name')
                        .setRequired(true)
                )
        ),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();

        await interaction.deferReply();

        try {
            if (!client.vtt.connected) {
                return interaction.editReply('❌ Not connected to VTT server. Use `/vtt connect` first.');
            }

            switch (subcommand) {
                case 'create':
                    await handleCreate(interaction, client);
                    break;
                case 'tick':
                    await handleTick(interaction, client);
                    break;
                case 'list':
                    await handleList(interaction, client);
                    break;
                case 'remove':
                    await handleRemove(interaction, client);
                    break;
                case 'reset':
                    await handleReset(interaction, client);
                    break;
            }
        } catch (err) {
            await interaction.editReply(`❌ Error: ${err.message}`);
        }
    }
};

async function handleCreate(interaction, client) {
    const name = interaction.options.getString('name');
    const segments = interaction.options.getInteger('segments');

    if (timers.has(name)) {
        return interaction.editReply(`❌ Timer "${name}" already exists. Use /vtttimer reset or remove.`);
    }

    const timer = { name, segments, current: 0 };
    timers.set(name, timer);

    // Sync to VTT
    client.vtt.syncTimers(Array.from(timers.values()));

    const embed = new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle(`⏱️ Timer Created: ${name}`)
        .addFields(
            { name: 'Segments', value: String(segments), inline: true },
            { name: 'Progress', value: '0/0', inline: true }
        );

    await interaction.editReply({ embeds: [embed] });
}

async function handleTick(interaction, client) {
    const name = interaction.options.getString('name');
    const amount = interaction.options.getInteger('amount') || 1;

    if (!timers.has(name)) {
        return interaction.editReply(`❌ Timer "${name}" not found.`);
    }

    const timer = timers.get(name);
    timer.current = Math.min(timer.current + amount, timer.segments);

    // Sync to VTT
    client.vtt.syncTimers(Array.from(timers.values()));

    const isComplete = timer.current >= timer.segments;
    const progress = Math.round((timer.current / timer.segments) * 10);
    const bar = '█'.repeat(progress) + '░'.repeat(10 - progress);

    const embed = new EmbedBuilder()
        .setColor(isComplete ? 0xf04747 : 0xd4af37)
        .setTitle(`⏱️ Timer: ${name}`)
        .setDescription(`[${bar}] ${timer.current}/${timer.segments}`)
        .addFields(
            { name: 'Status', value: isComplete ? '⚠️ COMPLETE!' : '⏳ Active', inline: true }
        );

    if (isComplete) {
        embed.setFooter({ text: '⚠️ Timer complete! Take action!' });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction, client) {
    if (timers.size === 0) {
        return interaction.editReply('⏱️ No active timers.');
    }

    const embed = new EmbedBuilder()
        .setTitle('⏱️ Active Timers')
        .setColor(0xd4af37);

    for (const [name, timer] of timers) {
        const progress = Math.round((timer.current / timer.segments) * 10);
        const bar = '█'.repeat(progress) + '░'.repeat(10 - progress);
        const status = timer.current >= timer.segments ? '✅ Complete' : '⏳ Active';
        embed.addFields({
            name: name,
            value: `[${bar}] ${timer.current}/${timer.segments} - ${status}`,
            inline: false
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleRemove(interaction, client) {
    const name = interaction.options.getString('name');

    if (!timers.has(name)) {
        return interaction.editReply(`❌ Timer "${name}" not found.`);
    }

    timers.delete(name);

    // Sync to VTT
    client.vtt.syncTimers(Array.from(timers.values()));

    await interaction.editReply(`✅ Removed timer: ${name}`);
}

async function handleReset(interaction, client) {
    const name = interaction.options.getString('name');

    if (!timers.has(name)) {
        return interaction.editReply(`❌ Timer "${name}" not found.`);
    }

    const timer = timers.get(name);
    timer.current = 0;

    // Sync to VTT
    client.vtt.syncTimers(Array.from(timers.values()));

    await interaction.editReply(`✅ Reset timer: ${name}`);
}
