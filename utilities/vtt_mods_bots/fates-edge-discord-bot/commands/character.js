/**
 * Character Sync Commands
 * Updated for v1.2.0 with deck and module support
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
                .addStringOption(option =>
                    option.setName('heritage')
                        .setDescription('Character heritage')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('background')
                        .setDescription('Character background')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('patron')
                        .setDescription('Character patron')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option.setName('harm')
                        .setDescription('Harm level (0-3)')
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(3)
                )
                .addIntegerOption(option =>
                    option.setName('fatigue')
                        .setDescription('Fatigue level')
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(5)
                )
                .addIntegerOption(option =>
                    option.setName('boons')
                        .setDescription('Boons (0-5)')
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(5)
                )
                .addIntegerOption(option =>
                    option.setName('tier')
                        .setDescription('Tier (1-5)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(5)
                )
                .addStringOption(option =>
                    option.setName('skills')
                        .setDescription('Skills (e.g., "melee:2, stealth:1")')
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
                .addStringOption(option =>
                    option.setName('new_name')
                        .setDescription('New character name')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option.setName('harm')
                        .setDescription('Harm level (0-3)')
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(3)
                )
                .addIntegerOption(option =>
                    option.setName('fatigue')
                        .setDescription('Fatigue level')
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(5)
                )
                .addIntegerOption(option =>
                    option.setName('boons')
                        .setDescription('Boons (0-5)')
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(5)
                )
                .addIntegerOption(option =>
                    option.setName('tier')
                        .setDescription('Tier (1-5)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(5)
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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('boons')
                .setDescription('Add or remove boons from a character')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Character name')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount to add (negative to remove)')
                        .setRequired(true)
                        .setMinValue(-5)
                        .setMaxValue(5)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('fatigue')
                .setDescription('Add or remove fatigue from a character')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Character name')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount to add (negative to remove)')
                        .setRequired(true)
                        .setMinValue(-5)
                        .setMaxValue(5)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('harm')
                .setDescription('Update harm on a character')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Character name')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Harm level (0-3)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(3)
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
                case 'boons':
                    await handleBoons(interaction, client);
                    break;
                case 'fatigue':
                    await handleFatigue(interaction, client);
                    break;
                case 'harm':
                    await handleHarm(interaction, client);
                    break;
            }
        } catch (err) {
            await interaction.editReply(`❌ Error: ${err.message}`);
        }
    }
};

// In-memory character cache
const characters = new Map();

async function handleList(interaction, client) {
    // Request character list from VTT
    client.vtt.send('get-characters', {});
    
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
            `**${c.name}** ${c.heritage ? `(${c.heritage})` : ''}\n` +
            `   🪙 ${c.boons || 0} · ⚡ ${c.fatigue || 0} · ❤️ ${c.harm || 0} · Tier ${c.tier || 1}`
        ).join('\n'))
        .setFooter({ text: `Total: ${charList.length} characters` });

    await interaction.editReply({ embeds: [embed] });
}

async function handleAdd(interaction, client) {
    const name = interaction.options.getString('name');
    const heritage = interaction.options.getString('heritage') || '';
    const background = interaction.options.getString('background') || '';
    const patron = interaction.options.getString('patron') || '';
    const harm = interaction.options.getInteger('harm') || 0;
    const fatigue = interaction.options.getInteger('fatigue') || 0;
    const boons = interaction.options.getInteger('boons') || 0;
    const tier = interaction.options.getInteger('tier') || 1;
    const skillsStr = interaction.options.getString('skills') || '';

    if (characters.has(name)) {
        return interaction.editReply(`❌ Character "${name}" already exists. Use /vttchar update to modify.`);
    }

    // Parse skills
    const skills = {};
    if (skillsStr) {
        skillsStr.split(',').forEach(s => {
            const [key, val] = s.trim().split(':');
            if (key && val) {
                skills[key.toLowerCase()] = parseInt(val) || 0;
            }
        });
    }

    const charData = { 
        name, 
        heritage, 
        background, 
        patron, 
        harm, 
        fatigue, 
        boons, 
        tier,
        skills 
    };
    characters.set(name, charData);

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

    if (heritage) embed.addFields({ name: 'Heritage', value: heritage, inline: true });
    if (background) embed.addFields({ name: 'Background', value: background, inline: true });
    if (patron) embed.addFields({ name: 'Patron', value: patron, inline: true });
    if (Object.keys(skills).length > 0) {
        embed.addFields({ name: 'Skills', value: Object.entries(skills).map(([k, v]) => `${k}: ${v}`).join(', '), inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleUpdate(interaction, client) {
    const name = interaction.options.getString('name');
    const newName = interaction.options.getString('new_name');
    const harm = interaction.options.getInteger('harm');
    const fatigue = interaction.options.getInteger('fatigue');
    const boons = interaction.options.getInteger('boons');
    const tier = interaction.options.getInteger('tier');

    if (!characters.has(name)) {
        return interaction.editReply(`❌ Character "${name}" not found. Use /vttchar add to create it.`);
    }

    const char = characters.get(name);
    if (newName) {
        char.name = newName;
        characters.delete(name);
        characters.set(newName, char);
    }
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
            { name: 'Name', value: newName || name, inline: true },
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

async function handleBoons(interaction, client) {
    const name = interaction.options.getString('name');
    const amount = interaction.options.getInteger('amount');

    if (!characters.has(name)) {
        return interaction.editReply(`❌ Character "${name}" not found.`);
    }

    const char = characters.get(name);
    char.boons = Math.max(0, Math.min(5, (char.boons || 0) + amount));

    // Sync to VTT
    client.vtt.syncCharacters(Array.from(characters.values()).map((data, name) => ({ name, ...data })));

    const embed = new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle(`🪙 Boons Updated: ${name}`)
        .setDescription(`Boons: ${char.boons} (${amount >= 0 ? '+' : ''}${amount})`)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleFatigue(interaction, client) {
    const name = interaction.options.getString('name');
    const amount = interaction.options.getInteger('amount');

    if (!characters.has(name)) {
        return interaction.editReply(`❌ Character "${name}" not found.`);
    }

    const char = characters.get(name);
    char.fatigue = Math.max(0, Math.min(5, (char.fatigue || 0) + amount));

    // Sync to VTT
    client.vtt.syncCharacters(Array.from(characters.values()).map((data, name) => ({ name, ...data })));

    const embed = new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle(`⚡ Fatigue Updated: ${name}`)
        .setDescription(`Fatigue: ${char.fatigue} (${amount >= 0 ? '+' : ''}${amount})`)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleHarm(interaction, client) {
    const name = interaction.options.getString('name');
    const amount = interaction.options.getInteger('amount');

    if (!characters.has(name)) {
        return interaction.editReply(`❌ Character "${name}" not found.`);
    }

    const char = characters.get(name);
    char.harm = Math.max(0, Math.min(3, amount));

    // Sync to VTT
    client.vtt.syncCharacters(Array.from(characters.values()).map((data, name) => ({ name, ...data })));

    const embed = new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle(`❤️ Harm Updated: ${name}`)
        .setDescription(`Harm: ${char.harm}`)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}