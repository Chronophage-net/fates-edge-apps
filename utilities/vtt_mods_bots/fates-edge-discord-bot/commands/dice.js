/**
 * Deck of Consequences Commands
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deck')
        .setDescription('Draw from the Deck of Consequences')
        .addSubcommand(subcommand =>
            subcommand
                .setName('draw')
                .setDescription('Draw cards from the deck')
                .addIntegerOption(option =>
                    option.setName('count')
                        .setDescription('Number of cards to draw (1-5)')
                        .setMinValue(1)
                        .setMaxValue(5)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Region for card meanings')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('crown')
                .setDescription('Perform a Crown Spread')
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Region for card meanings')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('shuffle')
                .setDescription('Shuffle the deck')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Show deck status')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('Show deck history')
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Number of history entries to show')
                        .setMinValue(1)
                        .setMaxValue(25)
                        .setRequired(false)
                )
        ),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();

        await interaction.deferReply();

        try {
            switch (subcommand) {
                case 'draw':
                    await handleDraw(interaction, client);
                    break;
                case 'crown':
                    await handleCrown(interaction, client);
                    break;
                case 'shuffle':
                    await handleShuffle(interaction, client);
                    break;
                case 'status':
                    await handleStatus(interaction, client);
                    break;
                case 'history':
                    await handleHistory(interaction, client);
                    break;
            }
        } catch (err) {
            await interaction.editReply(`❌ Error: ${err.message}`);
        }
    }
};

async function handleDraw(interaction, client) {
    const count = interaction.options.getInteger('count');
    const region = interaction.options.getString('region') || client.vtt.defaultRegion || 'Acasia';

    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }

    // Request deck draw from VTT
    client.vtt.send('deck-draw', { count, region });

    const embed = new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle('🃏 Deck Draw')
        .setDescription(`Drawing ${count} card${count > 1 ? 's' : ''} from **${region}**`)
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleCrown(interaction, client) {
    const region = interaction.options.getString('region') || client.vtt.defaultRegion || 'Acasia';

    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }

    client.vtt.send('deck-draw', { count: 5, region });

    const embed = new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle('👑 Crown Spread')
        .setDescription(`Crown Spread requested from **${region}**`)
        .addFields(
            { name: '🌱 Root', value: 'Waiting for cards...', inline: true },
            { name: '🏔️ Crest', value: 'Waiting for cards...', inline: true },
            { name: '👑 Crown', value: 'Waiting for cards...', inline: true },
            { name: '🤝 Left Hand', value: 'Waiting for cards...', inline: true },
            { name: '🌟 Wildcard', value: 'Waiting for cards...', inline: true }
        )
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleShuffle(interaction, client) {
    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }

    client.vtt.send('deck-shuffle', {});

    const embed = new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle('🔀 Deck Shuffled')
        .setDescription('The Deck of Consequences has been shuffled.')
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleStatus(interaction, client) {
    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }

    const deckState = client.vtt.deck || { cards: [], history: [] };
    const region = client.vtt.defaultRegion || 'Acasia';

    const embed = new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle('🃏 Deck Status')
        .addFields(
            { name: 'Cards Remaining', value: String(deckState.cards?.length || 0), inline: true },
            { name: 'History Entries', value: String(deckState.history?.length || 0), inline: true },
            { name: 'Default Region', value: region, inline: true }
        )
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleHistory(interaction, client) {
    const limit = interaction.options.getInteger('limit') || 10;

    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }

    const deckState = client.vtt.deck || { cards: [], history: [] };
    const history = deckState.history.slice(-limit);

    if (history.length === 0) {
        return interaction.editReply('📜 No deck history available.');
    }

    const embed = new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle('📜 Deck History')
        .setDescription(history.map((entry, i) => 
            `**${i + 1}.** ${entry.type || 'Draw'}: ${entry.synthesis?.substring(0, 100) || 'No details'}...`
        ).join('\n'))
        .setFooter({ text: `Showing last ${history.length} entries` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}