/**
 * Timer Management Commands
 *
 * UPDATED: these now hit the socket server's own ad-hoc timer system
 * (server/timers.js) via client.vtt.createAdhocTimer()/tickAdhocTimer()/
 * removeAdhocTimer()/requestAdhocTimers() instead of a local in-memory
 * Map -- so a timer created here is real, shared, persistent room state
 * visible to every other client (web client, terminal, Roll20, the AI
 * GM), not a Discord-bot-only echo that vanished on restart. Deliberately
 * separate from the server's adventure-module campaignTimers (see
 * server/timers.js's header doc) -- these are GM-improvised timers
 * independent of any loaded adventure.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Wait for the server's next ad-hoc-timer broadcast/reply (all four
// server event types funnel into client.vtt's 'adhocTimerState' event --
// see utils/websocket.js) instead of assuming success immediately.
function waitForAdhocTimerState(vtt, timeoutMs = 5000) {
    return new Promise((resolve) => {
        let done = false;
        const onState = (message) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve(message);
        };
        const timer = setTimeout(() => {
            if (done) return;
            done = true;
            vtt.off('adhocTimerState', onState);
            resolve(null);
        }, timeoutMs);
        vtt.once('adhocTimerState', onState);
    });
}

function progressBar(current, segments) {
    const filled = segments > 0 ? Math.round((current / segments) * 10) : 0;
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, 10 - filled));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vtttimer')
        .setDescription('Manage ad-hoc VTT timers (independent of any loaded adventure)')
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
                        .setDescription('Number of segments (2-12)')
                        .setRequired(true)
                        .setMinValue(2)
                        .setMaxValue(12)
                )
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('What happens when this timer fills (optional)')
                        .setRequired(false)
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
                        .setDescription('Number of ticks (default: 1, can be negative)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all active ad-hoc timers')
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
            }
        } catch (err) {
            await interaction.editReply(`❌ Error: ${err.message}`);
        }
    }
};

async function handleCreate(interaction, client) {
    const name = interaction.options.getString('name');
    const segments = interaction.options.getInteger('segments');
    const description = interaction.options.getString('description') || '';

    const waiter = waitForAdhocTimerState(client.vtt);
    client.vtt.createAdhocTimer(name, segments, description);
    const result = await waiter;

    if (!result) {
        return interaction.editReply(`⏱️ Requested timer "${name}" — no confirmation from the server yet, but it may still have gone through.`);
    }

    const timer = (result.timers || []).find(t => t.name === name);
    const embed = new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle(`⏱️ Timer Created: ${name}`)
        .addFields(
            { name: 'Segments', value: String(timer?.segments ?? segments), inline: true },
            { name: 'Progress', value: `${timer?.current ?? 0}/${timer?.segments ?? segments}`, inline: true }
        );
    await interaction.editReply({ embeds: [embed] });
}

async function handleTick(interaction, client) {
    const name = interaction.options.getString('name');
    const amount = interaction.options.getInteger('amount') ?? 1;

    const waiter = waitForAdhocTimerState(client.vtt);
    client.vtt.tickAdhocTimer(name, amount);
    const result = await waiter;

    if (!result) {
        return interaction.editReply(`⏱️ Requested tick on "${name}" — no confirmation from the server yet.`);
    }
    const timer = result.tickedTimer;
    if (!timer) {
        return interaction.editReply(`❌ Timer "${name}" not found.`);
    }

    const isComplete = !!timer.full;
    const embed = new EmbedBuilder()
        .setColor(isComplete ? 0xf04747 : 0xd4af37)
        .setTitle(`⏱️ Timer: ${timer.name}`)
        .setDescription(`[${progressBar(timer.current, timer.segments)}] ${timer.current}/${timer.segments}`)
        .addFields({ name: 'Status', value: isComplete ? '⚠️ COMPLETE!' : '⏳ Active', inline: true });
    if (isComplete) embed.setFooter({ text: '⚠️ Timer complete! Take action!' });

    await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction, client) {
    const waiter = waitForAdhocTimerState(client.vtt);
    client.vtt.requestAdhocTimers();
    const result = await waiter;

    const list = (result && result.timers) || [];
    if (list.length === 0) {
        return interaction.editReply('⏱️ No active ad-hoc timers.');
    }

    const embed = new EmbedBuilder()
        .setTitle('⏱️ Active Ad-Hoc Timers')
        .setColor(0xd4af37);

    for (const timer of list) {
        const status = timer.current >= timer.segments ? '✅ Complete' : '⏳ Active';
        embed.addFields({
            name: timer.name,
            value: `[${progressBar(timer.current, timer.segments)}] ${timer.current}/${timer.segments} - ${status}`,
            inline: false
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleRemove(interaction, client) {
    const name = interaction.options.getString('name');

    const waiter = waitForAdhocTimerState(client.vtt);
    client.vtt.removeAdhocTimer(name);
    const result = await waiter;

    if (!result) {
        return interaction.editReply(`⏱️ Requested removal of "${name}" — no confirmation from the server yet.`);
    }
    const stillThere = (result.timers || []).some(t => t.name === name);
    if (stillThere) {
        return interaction.editReply(`❌ Timer "${name}" not found.`);
    }
    await interaction.editReply(`✅ Removed timer: ${name}`);
}
