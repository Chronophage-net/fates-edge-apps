/**
 * Adventure Engine Commands – load, scene, encounter, timer, log, status, reference, reset
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vttadventure')
        .setDescription('Manage VTT adventure engine')
        .addSubcommand(sub =>
            sub
                .setName('load')
                .setDescription('Load an adventure module by ID')
                .addStringOption(opt =>
                    opt.setName('moduleid')
                        .setDescription('Adventure module ID (from /vtt modules list)')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('scene')
                .setDescription('Advance to a specific scene (omit both to advance sequentially)')
                .addIntegerOption(opt =>
                    opt.setName('actindex')
                        .setDescription('Act index (0-based)')
                        .setRequired(false)
                )
                .addIntegerOption(opt =>
                    opt.setName('sceneindex')
                        .setDescription('Scene index within the act (0-based)')
                        .setRequired(false)
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('encounter')
                .setDescription('Start or resolve an encounter')
                .addSubcommand(sub =>
                    sub
                        .setName('start')
                        .setDescription('Start an encounter')
                        .addStringOption(opt =>
                            opt.setName('ref')
                                .setDescription('Encounter index or name/creatureId in the current scene')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('resolve')
                        .setDescription('Resolve the active encounter')
                        .addStringOption(opt =>
                            opt.setName('outcome')
                                .setDescription('Outcome (clean, partial, miss)')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Clean Success', value: 'clean' },
                                    { name: 'Partial', value: 'partial' },
                                    { name: 'Miss', value: 'miss' }
                                )
                        )
                        .addStringOption(opt =>
                            opt.setName('notes')
                                .setDescription('Optional notes about the resolution')
                                .setRequired(false)
                        )
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('timer')
                .setDescription('Tick a timer by name')
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Timer name')
                        .setRequired(true)
                )
                .addIntegerOption(opt =>
                    opt.setName('amount')
                        .setDescription('Amount to tick (default 1, can be negative)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('scope')
                        .setDescription('Timer scope (scene or campaign)')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Scene', value: 'scene' },
                            { name: 'Campaign', value: 'campaign' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('log')
                .setDescription('Append a narrative beat to the adventure log')
                .addStringOption(opt =>
                    opt.setName('text')
                        .setDescription('Log text')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('author')
                        .setDescription('Author name (defaults to Discord username)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('status')
                .setDescription('Show current adventure state')
        )
        .addSubcommand(sub =>
            sub
                .setName('reference')
                .setDescription('Show reference data (bestiary, NPCs, locations, factions)')
        )
        .addSubcommand(sub =>
            sub
                .setName('reset')
                .setDescription('Reset the current adventure to its initial state')
        )
        .addSubcommand(sub =>
            sub
                .setName('knowledge')
                .setDescription("Show this adventure's knowledge/secret state (GM view — full secrets)")
        )
        .addSubcommand(sub =>
            sub
                .setName('reveal')
                .setDescription('Mark a knowledge entry revealed, safe to share')
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('Knowledge entry id (see /vttadventure knowledge)')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('hide')
                .setDescription('Mark a knowledge entry secret again')
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('Knowledge entry id (see /vttadventure knowledge)')
                        .setRequired(true)
                )
        ),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const subcommandGroup = interaction.options.getSubcommandGroup();

        await interaction.deferReply();

        try {
            const vtt = client.vtt;
            if (!vtt.connected) {
                return interaction.editReply('❌ Not connected to VTT server. Use `/vtt connect` first.');
            }

            // Handle nested encounter group
            if (subcommandGroup === 'encounter') {
                switch (subcommand) {
                    case 'start':
                        await handleEncounterStart(interaction, vtt);
                        break;
                    case 'resolve':
                        await handleEncounterResolve(interaction, vtt);
                        break;
                }
                return;
            }

            // Top-level subcommands
            switch (subcommand) {
                case 'load':
                    await handleLoad(interaction, vtt);
                    break;
                case 'scene':
                    await handleScene(interaction, vtt);
                    break;
                case 'timer':
                    await handleTimer(interaction, vtt);
                    break;
                case 'log':
                    await handleLog(interaction, vtt);
                    break;
                case 'status':
                    await handleStatus(interaction, vtt);
                    break;
                case 'reference':
                    await handleReference(interaction, vtt);
                    break;
                case 'reset':
                    await handleReset(interaction, vtt);
                    break;
                case 'knowledge':
                    await handleKnowledge(interaction, vtt);
                    break;
                case 'reveal':
                    await handleKnowledgeReveal(interaction, vtt);
                    break;
                case 'hide':
                    await handleKnowledgeHide(interaction, vtt);
                    break;
                default:
                    await interaction.editReply('❌ Unknown subcommand.');
            }
        } catch (err) {
            await interaction.editReply(`❌ Error: ${err.message}`);
        }
    }
};

// ─── Handlers ──────────────────────────────────────────────────────

async function handleLoad(interaction, vtt) {
    const moduleId = interaction.options.getString('moduleid');
    vtt.send('adventure-load', { moduleId });
    const embed = new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle('📖 Load Adventure')
        .setDescription(`Requested load of **${moduleId}**.`)
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}

async function handleScene(interaction, vtt) {
    const actIndex = interaction.options.getInteger('actindex');
    const sceneIndex = interaction.options.getInteger('sceneindex');
    const target = {};
    if (actIndex !== null) target.actIndex = actIndex;
    if (sceneIndex !== null) target.sceneIndex = sceneIndex;
    vtt.send('adventure-scene', target);
    const embed = new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle('🎭 Scene Change')
        .setDescription(`Requested scene change${actIndex !== null ? ` to act ${actIndex}` : ''}${sceneIndex !== null ? `, scene ${sceneIndex}` : ' (sequential)'}.`)
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}

async function handleEncounterStart(interaction, vtt) {
    const ref = interaction.options.getString('ref');
    const parsedRef = isNaN(ref) ? ref : parseInt(ref);
    vtt.send('adventure-encounter-start', { ref: parsedRef });
    const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('⚔️ Encounter Started')
        .setDescription(`Starting encounter: **${ref}**`)
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}

async function handleEncounterResolve(interaction, vtt) {
    const outcome = interaction.options.getString('outcome');
    const notes = interaction.options.getString('notes') || '';
    vtt.send('adventure-encounter-resolve', { outcome, notes });
    const embed = new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle('⚔️ Encounter Resolved')
        .setDescription(`Resolved as **${outcome}**${notes ? `\n📝 ${notes}` : ''}`)
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}

async function handleTimer(interaction, vtt) {
    const name = interaction.options.getString('name');
    const amount = interaction.options.getInteger('amount') || 1;
    const scope = interaction.options.getString('scope') || 'scene';
    vtt.send('adventure-timer', { ref: name, amount, scope });
    const embed = new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle('⏱️ Timer Tick')
        .setDescription(`Ticking **${name}** by ${amount} (${scope} scope)`)
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}

async function handleLog(interaction, vtt) {
    const text = interaction.options.getString('text');
    const author = interaction.options.getString('author') || interaction.user.username;
    vtt.send('adventure-log', { text, author });
    const embed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle('📝 Adventure Log')
        .setDescription(`"${text}"`)
        .setFooter({ text: `Author: ${author} | Requested by ${interaction.user.username}` })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}

async function handleStatus(interaction, vtt) {
    const apiBase = vtt.getApiBaseUrl ? vtt.getApiBaseUrl() : `${vtt.config.serverUrl.replace('ws', 'http')}/api`;
    const apiKey = process.env.API_KEY || vtt.config.apiKey || '';

    try {
        const url = `${apiBase}/rooms/${vtt.roomCode}/adventure`;
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['x-api-key'] = apiKey;
        const res = await fetch(url, { headers });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        const state = await res.json();

        if (!state.moduleId) {
            return interaction.editReply('📭 No adventure loaded in this room.');
        }

        const embed = new EmbedBuilder()
            .setColor(0xd4af37)
            .setTitle(`📖 ${state.title || state.moduleId}`)
            .addFields(
                { name: 'Status', value: state.status || 'unknown', inline: true },
                { name: 'Tier', value: state.tier || '?', inline: true },
                { name: 'Act', value: state.currentAct?.title || 'None', inline: true },
                { name: 'Scene', value: state.currentScene?.title || 'None', inline: true }
            );

        if (state.activeEncounter) {
            const enc = state.activeEncounter;
            const encName = enc.name || enc.creatureId || 'Encounter';
            embed.addFields({
                name: '⚔️ Active Encounter',
                value: `**${encName}** (DV ${enc.dv || '?'}, ${enc.position || 'Controlled'})${enc.creature ? `\nCreature: ${enc.creature.name} (TL${enc.creature.tl})` : ''}`,
                inline: false
            });
        }

        if (state.campaignTimers && state.campaignTimers.length) {
            const timers = state.campaignTimers.map(t => `${t.name}: ${t.current ?? 0}/${t.segments}`).join('\n');
            embed.addFields({ name: '⏱️ Campaign Timers', value: timers, inline: false });
        }

        if (state.knowledge && state.knowledge.length) {
            const revealedCount = state.knowledge.filter(k => k.revealed).length;
            embed.addFields({ name: '🗝️ Knowledge', value: `${revealedCount}/${state.knowledge.length} revealed (see /vttadventure knowledge)`, inline: true });
        }

        if (state.log && state.log.length) {
            const last = state.log[state.log.length - 1];
            embed.addFields({ name: '📜 Last Log', value: `${last.message || last.type}`, inline: false });
        }

        embed.setFooter({ text: `Updated: ${new Date(state.updatedAt).toLocaleString()}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        // Fallback to cached state if available
        if (vtt.adventureState && vtt.adventureState.moduleId) {
            const state = vtt.adventureState;
            const embed = new EmbedBuilder()
                .setColor(0xd4af37)
                .setTitle(`📖 ${state.title || state.moduleId} (cached)`)
                .setDescription('Using cached data – API may be unavailable.')
                .addFields(
                    { name: 'Status', value: state.status || 'unknown', inline: true },
                    { name: 'Act', value: state.currentAct?.title || 'None', inline: true },
                    { name: 'Scene', value: state.currentScene?.title || 'None', inline: true }
                )
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }
        return interaction.editReply(`❌ Failed to fetch adventure status: ${err.message}`);
    }
}

async function handleReference(interaction, vtt) {
    const apiBase = vtt.getApiBaseUrl ? vtt.getApiBaseUrl() : `${vtt.config.serverUrl.replace('ws', 'http')}/api`;
    const apiKey = process.env.API_KEY || vtt.config.apiKey || '';

    try {
        const url = `${apiBase}/rooms/${vtt.roomCode}/adventure/reference`;
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['x-api-key'] = apiKey;
        const res = await fetch(url, { headers });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        const ref = await res.json();

        if (!ref.moduleId) {
            return interaction.editReply('📭 No adventure loaded in this room.');
        }

        const embed = new EmbedBuilder()
            .setColor(0xd4af37)
            .setTitle(`📚 Reference: ${ref.moduleId}`)
            .setTimestamp();

        if (ref.bestiary && ref.bestiary.length) {
            const list = ref.bestiary.slice(0, 5).map(b => `${b.name} (TL${b.tl})`).join('\n');
            embed.addFields({ name: `🐉 Bestiary (${ref.bestiary.length})`, value: list || 'None', inline: false });
            if (ref.bestiary.length > 5) embed.addFields({ name: '...', value: `and ${ref.bestiary.length - 5} more`, inline: false });
        }
        if (ref.npcs && ref.npcs.length) {
            const list = ref.npcs.slice(0, 5).map(n => `${n.name} (${n.role || 'NPC'})`).join('\n');
            embed.addFields({ name: `👤 NPCs (${ref.npcs.length})`, value: list || 'None', inline: false });
            if (ref.npcs.length > 5) embed.addFields({ name: '...', value: `and ${ref.npcs.length - 5} more`, inline: false });
        }
        if (ref.locations && ref.locations.length) {
            const list = ref.locations.slice(0, 5).map(l => l.name).join('\n');
            embed.addFields({ name: `📍 Locations (${ref.locations.length})`, value: list || 'None', inline: false });
            if (ref.locations.length > 5) embed.addFields({ name: '...', value: `and ${ref.locations.length - 5} more`, inline: false });
        }
        if (ref.factions && ref.factions.length) {
            const list = ref.factions.map(f => `${f.name}`).join('\n');
            embed.addFields({ name: `⚑ Factions (${ref.factions.length})`, value: list || 'None', inline: false });
        }
        if (ref.notes) {
            embed.addFields({ name: '📝 Notes', value: ref.notes.slice(0, 1024), inline: false });
        }
        // NEW: full GM/AI-eyes-only knowledge view -- `ref` is the same
        // GM-only reference fetch npcs/bestiary/notes above already come
        // from, so the raw `gm` secret text is safe to print here.
        if (ref.knowledge && ref.knowledge.length) {
            const list = ref.knowledge.map(k => {
                const lock = k.revealed ? '🔓' : '🔒';
                const gmSnippet = (k.gm || '').slice(0, 100);
                return `${lock} **${k.id}** — ${k.revealed ? 'REVEALED' : 'secret'}: ${gmSnippet}${(k.gm || '').length > 100 ? '…' : ''}`;
            }).join('\n');
            embed.addFields({ name: `🗝️ Knowledge (${ref.knowledge.length})`, value: list.slice(0, 1024) || 'None', inline: false });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        return interaction.editReply(`❌ Failed to fetch reference data: ${err.message}`);
    }
}

async function handleReset(interaction, vtt) {
    vtt.send('adventure-reset', {});
    const embed = new EmbedBuilder()
        .setColor(0xf04747)
        .setTitle('🔄 Adventure Reset')
        .setDescription('Reset requested for the current adventure.')
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}

// NEW: knowledge state (module.knowledge[] entries) -- see
// server/adventure.js's KNOWLEDGE STATE doc comment and the matching
// REST/WS routes in api.js/ws-handlers.js/socketio-handlers.js. `/knowledge`
// pulls the full GM/AI-eyes-only reference view (same fetch handleReference()
// above uses) rather than the player-safe status view, since this bot's
// slash commands are typically run by a GM in a GM-only channel.
async function handleKnowledge(interaction, vtt) {
    const apiBase = vtt.getApiBaseUrl ? vtt.getApiBaseUrl() : `${vtt.config.serverUrl.replace('ws', 'http')}/api`;
    const apiKey = process.env.API_KEY || vtt.config.apiKey || '';

    try {
        const url = `${apiBase}/rooms/${vtt.roomCode}/adventure/reference`;
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['x-api-key'] = apiKey;
        const res = await fetch(url, { headers });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        const ref = await res.json();

        if (!ref.moduleId) {
            return interaction.editReply('📭 No adventure loaded in this room.');
        }
        if (!ref.knowledge || !ref.knowledge.length) {
            return interaction.editReply(`📭 "${ref.moduleId}" defines no knowledge/secret entries.`);
        }

        const embed = new EmbedBuilder()
            .setColor(0xd4af37)
            .setTitle(`🗝️ Knowledge State: ${ref.moduleId}`)
            .setTimestamp();

        for (const k of ref.knowledge) {
            const lock = k.revealed ? '🔓 REVEALED' : '🔒 secret';
            const body = k.revealed
                ? (k.gm || '')
                : `**truth (DO NOT reveal):** ${k.gm || ''}\n**players currently know:** ${k.player ?? '(nothing yet)'}` +
                  (k.revealCondition ? `\n**reveal when:** ${k.revealCondition}` : '');
            embed.addFields({
                name: `${lock} — ${k.id}${k.subject ? ` (${k.subject})` : ''}`,
                value: body.slice(0, 1024) || '(no text)',
                inline: false,
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        return interaction.editReply(`❌ Failed to fetch knowledge state: ${err.message}`);
    }
}

async function handleKnowledgeReveal(interaction, vtt) {
    const id = interaction.options.getString('id');
    vtt.send('adventure-knowledge-reveal', { id, by: interaction.user.username });
    const embed = new EmbedBuilder()
        .setColor(0x43b581)
        .setTitle('🔓 Knowledge Revealed')
        .setDescription(`Requested reveal of **${id}**.`)
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}

async function handleKnowledgeHide(interaction, vtt) {
    const id = interaction.options.getString('id');
    vtt.send('adventure-knowledge-hide', { id, by: interaction.user.username });
    const embed = new EmbedBuilder()
        .setColor(0xf04747)
        .setTitle('🔒 Knowledge Hidden')
        .setDescription(`Requested hide of **${id}**.`)
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
