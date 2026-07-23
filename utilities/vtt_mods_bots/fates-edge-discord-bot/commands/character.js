/**
 * Character Sync Commands – v2.0
 * Uses the server's REST API for full character management.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vttchar')
        .setDescription('Manage VTT characters (uses server API)')
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
                .addStringOption(option =>
                    option.setName('attributes')
                        .setDescription('Attributes (e.g., "body:3, mind:2")')
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
                        .setDescription('New character name (renames)')
                        .setRequired(false)
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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a character from VTT (soft delete)')
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

            // Build API base and key
            const apiBase = client.vtt.getApiBaseUrl ? client.vtt.getApiBaseUrl() : 
                `${client.vtt.config.serverUrl.replace('ws', 'http')}/api`;
            const apiKey = process.env.API_KEY || client.vtt.config.apiKey || '';

            // Helper for API requests
            const apiRequest = async (endpoint, method = 'GET', data = null) => {
                const url = `${apiBase}${endpoint}`;
                const headers = { 'Content-Type': 'application/json' };
                if (apiKey) headers['x-api-key'] = apiKey;
                const options = { method, headers };
                if (data && method !== 'GET') options.body = JSON.stringify(data);
                const res = await fetch(url, options);
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`HTTP ${res.status}: ${text}`);
                }
                return res.json();
            };

            const roomCode = client.vtt.roomCode;

            switch (subcommand) {
                case 'list':
                    await handleList(interaction, apiRequest, roomCode);
                    break;
                case 'add':
                    await handleAdd(interaction, apiRequest, roomCode);
                    break;
                case 'update':
                    await handleUpdate(interaction, apiRequest, roomCode);
                    break;
                case 'remove':
                    await handleRemove(interaction, apiRequest, roomCode);
                    break;
                case 'boons':
                    await handleBoons(interaction, apiRequest, roomCode);
                    break;
                case 'fatigue':
                    await handleFatigue(interaction, apiRequest, roomCode);
                    break;
                case 'harm':
                    await handleHarm(interaction, apiRequest, roomCode);
                    break;
            }
        } catch (err) {
            await interaction.editReply(`❌ Error: ${err.message}`);
        }
    }
};

// ─── Handlers ──────────────────────────────────────────────

async function handleList(interaction, apiRequest, roomCode) {
    const result = await apiRequest(`/rooms/${roomCode}/characters`);
    const characters = result.characters || [];

    if (characters.length === 0) {
        return interaction.editReply('📭 No characters synced to VTT. Use `/vttchar add` to add one.');
    }

    // Filter out soft-deleted (active: false)
    const active = characters.filter(c => c.active !== false);

    if (active.length === 0) {
        return interaction.editReply('📭 No active characters found (some may be soft-deleted).');
    }

    const embed = new EmbedBuilder()
        .setTitle('👥 VTT Characters')
        .setColor(0xd4af37)
        .setDescription(active.map(c => 
            `**${c.name}** ${c.heritage ? `(${c.heritage})` : ''}\n` +
            `   🪙 ${c.boons || 0} · ⚡ ${c.fatigue || 0} · ❤️ ${c.harm || 0} · Tier ${c.tier || 1}`
        ).join('\n'))
        .setFooter({ text: `Total: ${active.length} characters` });

    await interaction.editReply({ embeds: [embed] });
}

async function handleAdd(interaction, apiRequest, roomCode) {
    const name = interaction.options.getString('name');
    const heritage = interaction.options.getString('heritage') || '';
    const background = interaction.options.getString('background') || '';
    const patron = interaction.options.getString('patron') || '';
    const harm = interaction.options.getInteger('harm') || 0;
    const fatigue = interaction.options.getInteger('fatigue') || 0;
    const boons = interaction.options.getInteger('boons') || 0;
    const tier = interaction.options.getInteger('tier') || 1;
    const skillsStr = interaction.options.getString('skills') || '';
    const attrsStr = interaction.options.getString('attributes') || '';

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

    // Parse attributes
    const attributes = {};
    if (attrsStr) {
        attrsStr.split(',').forEach(s => {
            const [key, val] = s.trim().split(':');
            if (key && val) {
                attributes[key.toLowerCase()] = parseInt(val) || 0;
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
        skills,
        attributes,
        active: true
    };

    // Send update to server (will merge or create)
    const updates = { [name]: charData };
    await apiRequest(`/rooms/${roomCode}/characters/update`, 'POST', { updates });

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
    if (Object.keys(attributes).length > 0) {
        embed.addFields({ name: 'Attributes', value: Object.entries(attributes).map(([k, v]) => `${k}: ${v}`).join(', '), inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleUpdate(interaction, apiRequest, roomCode) {
    const name = interaction.options.getString('name');
    const newName = interaction.options.getString('new_name');
    const heritage = interaction.options.getString('heritage');
    const background = interaction.options.getString('background');
    const patron = interaction.options.getString('patron');
    const harm = interaction.options.getInteger('harm');
    const fatigue = interaction.options.getInteger('fatigue');
    const boons = interaction.options.getInteger('boons');
    const tier = interaction.options.getInteger('tier');

    // First fetch current character to merge changes
    let current;
    try {
        const result = await apiRequest(`/rooms/${roomCode}/characters/${encodeURIComponent(name)}`);
        current = result;
    } catch (e) {
        return interaction.editReply(`❌ Character "${name}" not found.`);
    }

    // Build updates
    const updates = {};
    if (newName && newName !== name) {
        // Rename: we need to delete old and create new? 
        // The server doesn't support rename natively. We'll have to create a new entry and soft-delete the old.
        // We'll do: create new with all data, then set old active: false.
        const newData = { ...current };
        newData.name = newName;
        // Ensure we don't carry over the old name as a field
        delete newData.name;
        // Also ensure we set active: true for new
        newData.active = true;
        // Prepare update for new name
        updates[newName] = newData;
        // Set old to inactive
        updates[name] = { active: false };
        await apiRequest(`/rooms/${roomCode}/characters/update`, 'POST', { updates });
        return interaction.editReply(`✅ Character renamed from "${name}" to "${newName}" (old marked inactive).`);
    }

    // Build update object for the same name
    const updateData = { active: true };
    if (heritage !== null) updateData.heritage = heritage;
    if (background !== null) updateData.background = background;
    if (patron !== null) updateData.patron = patron;
    if (harm !== null) updateData.harm = harm;
    if (fatigue !== null) updateData.fatigue = fatigue;
    if (boons !== null) updateData.boons = boons;
    if (tier !== null) updateData.tier = tier;

    if (Object.keys(updateData).length === 0) {
        return interaction.editReply('No fields to update.');
    }

    updates[name] = updateData;
    await apiRequest(`/rooms/${roomCode}/characters/update`, 'POST', { updates });

    const embed = new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle(`✅ Character Updated: ${name}`)
        .addFields(
            { name: 'Harm', value: String(updateData.harm ?? current.harm ?? 0), inline: true },
            { name: 'Fatigue', value: String(updateData.fatigue ?? current.fatigue ?? 0), inline: true },
            { name: 'Boons', value: String(updateData.boons ?? current.boons ?? 0), inline: true },
            { name: 'Tier', value: String(updateData.tier ?? current.tier ?? 1), inline: true }
        );

    if (updateData.heritage !== undefined) embed.addFields({ name: 'Heritage', value: updateData.heritage, inline: true });
    if (updateData.background !== undefined) embed.addFields({ name: 'Background', value: updateData.background, inline: true });
    if (updateData.patron !== undefined) embed.addFields({ name: 'Patron', value: updateData.patron, inline: true });

    await interaction.editReply({ embeds: [embed] });
}

async function handleRemove(interaction, apiRequest, roomCode) {
    const name = interaction.options.getString('name');

    // Soft delete: set active: false
    const updates = { [name]: { active: false } };
    await apiRequest(`/rooms/${roomCode}/characters/update`, 'POST', { updates });

    await interaction.editReply(`✅ Character "${name}" removed (soft-deleted).`);
}

async function handleBoons(interaction, apiRequest, roomCode) {
    const name = interaction.options.getString('name');
    const amount = interaction.options.getInteger('amount');

    // Get current boons
    let current;
    try {
        const result = await apiRequest(`/rooms/${roomCode}/characters/${encodeURIComponent(name)}`);
        current = result;
    } catch (e) {
        return interaction.editReply(`❌ Character "${name}" not found.`);
    }

    const newBoons = Math.max(0, Math.min(5, (current.boons || 0) + amount));
    const updates = { [name]: { boons: newBoons } };
    await apiRequest(`/rooms/${roomCode}/characters/update`, 'POST', { updates });

    const embed = new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle(`🪙 Boons Updated: ${name}`)
        .setDescription(`Boons: ${newBoons} (${amount >= 0 ? '+' : ''}${amount})`)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleFatigue(interaction, apiRequest, roomCode) {
    const name = interaction.options.getString('name');
    const amount = interaction.options.getInteger('amount');

    // Get current fatigue
    let current;
    try {
        const result = await apiRequest(`/rooms/${roomCode}/characters/${encodeURIComponent(name)}`);
        current = result;
    } catch (e) {
        return interaction.editReply(`❌ Character "${name}" not found.`);
    }

    const newFatigue = Math.max(0, Math.min(5, (current.fatigue || 0) + amount));
    const updates = { [name]: { fatigue: newFatigue } };
    await apiRequest(`/rooms/${roomCode}/characters/update`, 'POST', { updates });

    const embed = new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle(`⚡ Fatigue Updated: ${name}`)
        .setDescription(`Fatigue: ${newFatigue} (${amount >= 0 ? '+' : ''}${amount})`)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleHarm(interaction, apiRequest, roomCode) {
    const name = interaction.options.getString('name');
    const amount = interaction.options.getInteger('amount');

    const updates = { [name]: { harm: amount } };
    await apiRequest(`/rooms/${roomCode}/characters/update`, 'POST', { updates });

    const embed = new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle(`❤️ Harm Updated: ${name}`)
        .setDescription(`Harm: ${amount}`)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}