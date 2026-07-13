/**
 * VTT Commands - Connect, status, disconnect
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
        }
    }
};

async function handleConnect(interaction, vtt) {
    const room = interaction.options.getString('room');

    await interaction.deferReply();

    try {
        if (vtt.connected) {
            return interaction.editReply('🔌 Already connected to VTT server');
        }

        vtt.connect(room || undefined);

        // Wait for connection with timeout
        const timeout = setTimeout(() => {
            interaction.editReply('⏰ Connection timed out. Check server URL and room code.');
        }, 10000);

        vtt.once('connected', () => {
            clearTimeout(timeout);
            interaction.editReply('✅ Connected to VTT server!');
        });

        vtt.once('error', (err) => {
            clearTimeout(timeout);
            interaction.editReply(`❌ Connection failed: ${err.message}`);
        });

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
        interaction.editReply('🔌 Disconnected from VTT server');
    } catch (err) {
        interaction.editReply(`❌ Error: ${err.message}`);
    }
}

async function handleStatus(interaction, vtt) {
    await interaction.deferReply();

    const embed = new EmbedBuilder()
        .setTitle('📊 VTT Connection Status')
        .setColor(vtt.connected ? 0x43b581 : 0xf04747)
        .addFields(
            { name: 'Status', value: vtt.connected ? '🟢 Connected' : '🔴 Disconnected', inline: true },
            { name: 'Server', value: vtt.config.serverUrl, inline: true },
            { name: 'Room', value: vtt.roomCode || 'Not set', inline: true },
            { name: 'Client ID', value: vtt.clientId || 'N/A', inline: true },
            { name: 'Reconnect Attempts', value: String(vtt.reconnectAttempts), inline: true },
            { name: 'Pending Messages', value: String(vtt.pendingMessages.length), inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
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
                { name: '📊 Stats', value: `Clients: ${data.clients?.length || 0}\nChat Messages: ${data.chatHistory?.length || 0}`, inline: true },
                { name: '👥 Clients', value: data.clients?.map(c => `- ${c.data?.name || 'Unknown'}`).join('\n') || 'No clients', inline: true }
            )
            .setTimestamp();

        interaction.editReply({ embeds: [embed] });
    });
}
