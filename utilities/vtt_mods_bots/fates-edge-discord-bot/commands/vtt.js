/**
 * VTT Commands - Connect, status, disconnect
 * Updated for v1.2.0 with deck, module, and region support
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vtt')
        .setDescription('Manage VTT connection')
        .addSubcommand(subcommand =>
            subcommand
                .setName('connect')
                .setDescription('Connect to the VTT server')
                .addStringOption(option =>
                    option.setName('room')
                        .setDescription('Room code to join')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('server')
                        .setDescription('Server URL (overrides config)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disconnect')
                .setDescription('Disconnect from the VTT server')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Show VTT connection status')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Show room information')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('region')
                .setDescription('Set default region for deck draws')
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Region name')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('modules')
                .setDescription('List loaded modules')
        ),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const vtt = client.vtt;

        switch (subcommand) {
            case 'connect':
                await handleConnect(interaction, vtt);
                break;

            case 'disconnect':
                await handleDisconnect(interaction, vtt);
                break;

            case 'status':
                await handleStatus(interaction, vtt);
                break;

            case 'info':
                await handleInfo(interaction, vtt);
                break;

            case 'region':
                await handleRegion(interaction, vtt);
                break;

            case 'modules':
                await handleModules(interaction, vtt);
                break;
        }
    }
};

async function handleConnect(interaction, vtt) {
    const room = interaction.options.getString('room');
    const serverUrl = interaction.options.getString('server');

    await interaction.deferReply();

    try {
        if (vtt.connected) {
            return interaction.editReply('🔌 Already connected to VTT server');
        }

        // Override server URL if provided
        if (serverUrl) {
            vtt.config.serverUrl = serverUrl;
        }

        // Initialize deck state
        vtt.deck = { cards: [], history: [], offset: 0 };
        vtt.modules = [];
        vtt.defaultRegion = vtt.defaultRegion || 'Acasia';
        vtt.pendingMessages = [];

        vtt.connect(room || undefined);

        // Wait for connection with timeout
        const timeout = setTimeout(() => {
            interaction.editReply('⏰ Connection timed out. Check server URL and room code.');
        }, 15000);

        // Handle connection events
        const connectedHandler = () => {
            clearTimeout(timeout);
            vtt.removeListener('error', errorHandler);
            
            const embed = new EmbedBuilder()
                .setColor(0x43b581)
                .setTitle('✅ Connected to VTT Server')
                .addFields(
                    { name: '📡 Server', value: vtt.config.serverUrl, inline: true },
                    { name: '🏠 Room', value: vtt.roomCode || 'Not set', inline: true },
                    { name: '📍 Default Region', value: vtt.defaultRegion, inline: true }
                )
                .setTimestamp();

            interaction.editReply({ embeds: [embed] });
        };

        const errorHandler = (err) => {
            clearTimeout(timeout);
            vtt.removeListener('connected', connectedHandler);
            interaction.editReply(`❌ Connection failed: ${err.message}`);
        };

        vtt.once('connected', connectedHandler);
        vtt.once('error', errorHandler);

    } catch (err) {
        interaction.editReply(`❌ Error: ${err.message}`);
    }
}

async function handleDisconnect(interaction, vtt) {
    await interaction.deferReply();

    try {
        if (!vtt.connected) {
            return interaction.editReply('❌ Not connected to VTT server');
        }

        vtt.disconnect();
        
        // Clear deck state on disconnect
        vtt.deck = { cards: [], history: [], offset: 0 };
        vtt.modules = [];
        
        const embed = new EmbedBuilder()
            .setColor(0xf04747)
            .setTitle('🔌 Disconnected from VTT Server')
            .setDescription('Disconnected successfully.')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        interaction.editReply(`❌ Error: ${err.message}`);
    }
}

async function handleStatus(interaction, vtt) {
    await interaction.deferReply();

    const deckState = vtt.deck || { cards: [], history: [] };
    const modules = vtt.modules || [];
    const region = vtt.defaultRegion || 'Acasia';

    const embed = new EmbedBuilder()
        .setTitle('📊 VTT Connection Status')
        .setColor(vtt.connected ? 0x43b581 : 0xf04747)
        .addFields(
            { name: 'Status', value: vtt.connected ? '🟢 Connected' : '🔴 Disconnected', inline: true },
            { name: '📡 Server', value: vtt.config?.serverUrl || 'Not set', inline: true },
            { name: '🏠 Room', value: vtt.roomCode || 'Not set', inline: true },
            { name: '📍 Default Region', value: region, inline: true },
            { name: '🃏 Deck Cards', value: String(deckState.cards?.length || 0), inline: true },
            { name: '📜 Deck History', value: String(deckState.history?.length || 0), inline: true },
            { name: '📦 Modules Loaded', value: String(modules.length), inline: true },
            { name: '🔄 Reconnect Attempts', value: String(vtt.reconnectAttempts || 0), inline: true },
            { name: '📨 Pending Messages', value: String(vtt.pendingMessages?.length || 0), inline: true }
        )
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('vtt_refresh_status')
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleInfo(interaction, vtt) {
    await interaction.deferReply();

    if (!vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server');
    }

    // Request room state
    vtt.send('get-clients', {});

    // Wait for response with timeout
    const timeout = setTimeout(() => {
        interaction.editReply('⏰ No response from VTT server');
    }, 5000);

    vtt.once('room-state', (data) => {
        clearTimeout(timeout);

        const embed = new EmbedBuilder()
            .setTitle(`🏠 VTT Room: ${vtt.roomCode}`)
            .setColor(0xd4af37)
            .addFields(
                { name: '📊 Stats', value: `Clients: ${data.clients?.length || 0}\nChat Messages: ${data.chatHistory?.length || 0}\nDeck Cards: ${vtt.deck?.cards?.length || 0}`, inline: true },
                { name: '👥 Clients', value: data.clients?.map(c => `- ${c.data?.name || c.name || 'Unknown'}`).join('\n') || 'No clients', inline: true }
            )
            .setTimestamp();

        interaction.editReply({ embeds: [embed] });
    });
}

async function handleRegion(interaction, vtt) {
    const region = interaction.options.getString('region');

    await interaction.deferReply();

    try {
        if (!vtt.connected) {
            return interaction.editReply('❌ Not connected to VTT server');
        }

        vtt.defaultRegion = region;
        
        // Send region update to VTT
        vtt.send('set-region', { region });

        const embed = new EmbedBuilder()
            .setColor(0x43b581)
            .setTitle('📍 Region Updated')
            .setDescription(`Default region set to: **${region}**`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        interaction.editReply(`❌ Error: ${err.message}`);
    }
}

async function handleModules(interaction, vtt) {
    await interaction.deferReply();

    try {
        if (!vtt.connected) {
            return interaction.editReply('❌ Not connected to VTT server');
        }

        // Request module list from VTT
        vtt.send('module-list', {});

        const modules = vtt.modules || [];
        
        if (modules.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xd4af37)
                .setTitle('📦 Loaded Modules')
                .setDescription('No modules currently loaded.')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setColor(0xd4af37)
            .setTitle('📦 Loaded Modules')
            .setDescription(modules.map(m => 
                `**${m.name || m.id}** v${m.version || '1.0.0'}\n` +
                `  ${m.description || 'No description'}`
            ).join('\n\n'))
            .setFooter({ text: `Total: ${modules.length} modules` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        interaction.editReply(`❌ Error: ${err.message}`);
    }
}