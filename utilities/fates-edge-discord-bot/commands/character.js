/**
 * Character Sync Commands
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vttchar')
        .setDescription('Manage VTT characters')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List characters synced to VTT')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a character to VTT')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Character name')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('harm')
                        .setDescription('Harm level (0-3)')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option.setName('fatigue')
                        .setDescription('Fatigue level')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option.setName('boons')
                        .setDescription('Boons (0-5)')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option.setName('tier')
                        .setDescription('Tier (1-5)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('update')
                .setDescription('Update a character in VTT')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Character name')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('harm')
                        .setDescription('Harm level (0-3)')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option.setName('fatigue')
                        .setDescription('Fatigue level')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option.setName('boons')
                        .setDescription('Boons (0-5)')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option.setName('tier')
                        .setDescription('Tier (1-5)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a character from VTT')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Character name')
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
                case 'list':
                    await handleList(interaction, client);
                    break;
                case 'add':
                    await handleAdd(interaction, client);
                    break;
                case 'update':
                    await handleUpdate(interaction, client);
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

// These would need to track characters locally or fetch from VTT
const characters = new Map();

async function handleList(interaction, client) {
    const charList = Array.from(characters.entries()).map(([name, data]) => ({
        name,
        ...data
    }));

    if (charList.length === 0) {
        return interaction.editReply('📭 No characters synced to VTT. Use `/vttchar add` to add one.');
    }

    const embed = new EmbedBuilder()
        .setTitle('👥 VTT Characters')
        .setColor(0xd4af37)
        .setDescription(charList.map(c => 
            `**${c.name}** - Harm: ${c.harm || 0}, Fatigue: ${c.fatigue || 0}, Boons: ${c.boons || 0}, Tier: ${c.tier || 1}`
        ).join('\n'))
        .setFooter({ text: `Total: ${charList.length} characters` });

    await interaction.editReply({ embeds: [embed] });
}

async function handleAdd(interaction, client) {
    const name = interaction.options.getString('name');
    const harm = interaction.options.getInteger('harm') || 0;
    const fatigue = interaction.options.getInteger('fatigue') || 0;
    const boons = interaction.options.getInteger('boons') || 0;
    const tier = interaction.options.getInteger('tier') || 1;

    if (characters.has(name)) {
        return interaction.editReply(`❌ Character "${name}" already exists. Use /vttchar update to modify.`);
    }

    characters.set(name, { harm, fatigue, boons, tier });

    // Sync to VTT
    client.vtt.syncCharacters(Array.from(characters.values()).map((data, name) => ({ name, ...data })));

    const embed = new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle(`✅ Character Added: ${name}`)
        .addFields(
            { name: 'Harm', value: String(harm), inline: true },
            { name: 'Fatigue', value: String(fatigue), inline: true },
            { name: 'Boons', value: String(boons), inline: true },
            { name: 'Tier', value: String(tier), inline: true }
        );

    await interaction.editReply({ embeds: [embed] });
}

async function handleUpdate(interaction, client) {
    const name = interaction.options.getString('name');
    const harm = interaction.options.getInteger('harm');
    const fatigue = interaction.options.getInteger('fatigue');
    const boons = interaction.options.getInteger('boons');
    const tier = interaction.options.getInteger('tier');

    if (!characters.has(name)) {
        return interaction.editReply(`❌ Character "${name}" not found. Use /vttchar add to create it.`);
    }

    const char = characters.get(name);
    if (harm !== null) char.harm = harm;
    if (fatigue !== null) char.fatigue = fatigue;
    if (boons !== null) char.boons = boons;
    if (tier !== null) char.tier = tier;

    // Sync to VTT
    client.vtt.syncCharacters(Array.from(characters.values()).map((data, name) => ({ name, ...data })));

    const embed = new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle(`✅ Character Updated: ${name}`)
        .addFields(
            { name: 'Harm', value: String(char.harm), inline: true },
            { name: 'Fatigue', value: String(char.fatigue), inline: true },
            { name: 'Boons', value: String(char.boons), inline: true },
            { name: 'Tier', value: String(char.tier), inline: true }
        );

    await interaction.editReply({ embeds: [embed] });
}

async function handleRemove(interaction, client) {
    const name = interaction.options.getString('name');

    if (!characters.has(name)) {
        return interaction.editReply(`❌ Character "${name}" not found.`);
    }

    characters.delete(name);

    // Sync to VTT
    client.vtt.syncCharacters(Array.from(characters.values()).map((data, name) => ({ name, ...data })));

    await interaction.editReply(`✅ Removed character: ${name}`);
}
