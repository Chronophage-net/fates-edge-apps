/**
 * utils/tts-voice.js
 *
 * Optional playback of AI GM voice narration ('tts-audio' WS events --
 * see the AI GM Bot's modules/tts-client.js and its TTS_ENABLED/TTS_URL)
 * into a Discord voice channel, via @discordjs/voice.
 *
 * Entirely optional and fails soft, same philosophy as every other
 * optional integration in this project (the AI GM Bot's
 * modules/knowledge-index.js, modules/tts-client.js): with no
 * DISCORD_TTS_ENABLED/DISCORD_TTS_VOICE_CHANNEL_ID configured, or if
 * @discordjs/voice (or its own optional Opus-encoder/FFmpeg
 * dependencies) isn't installed, playback is a silent no-op and the bot
 * behaves exactly as it did before this module existed -- the
 * narration TEXT still reaches Discord normally via whatever already
 * relays 'chat-message' (this repo's webhook 'vtt-chat' event, or a
 * future live chat-relay feature).
 *
 * Why this needs more than @discordjs/voice alone: Discord's voice
 * protocol only carries Opus, and the AI GM Bot sends WAV (or
 * MP3/Ogg, per TTS_FORMAT) — @discordjs/voice transcodes arbitrary
 * input via FFmpeg (needs the `ffmpeg` binary on PATH, or the
 * `ffmpeg-static` package) and then needs an Opus encoder package
 * (`@discordjs/opus` or `opusscript`) to actually produce Discord-
 * compatible audio. None of that is bundled by default -- @discordjs/
 * voice deliberately leaves the choice of encoder to the app. All of
 * it is lazily required so a bot that never enables this feature never
 * needs any of these installed.
 */

const { Readable } = require('stream');
const logger = require('./logger');
const config = require('./config');

let voiceApi = null;
let voiceApiLoadFailed = false;

function loadVoiceApi() {
    if (voiceApi || voiceApiLoadFailed) return voiceApi;
    try {
        voiceApi = require('@discordjs/voice');
    } catch (e) {
        voiceApiLoadFailed = true;
        logger.warn(`⚠️ AI GM voice narration: @discordjs/voice is not installed -- run "npm install @discordjs/voice @discordjs/opus" (or "opusscript") to enable it. Narration audio will not be played; narration text is unaffected. (${e.message})`);
    }
    return voiceApi;
}

const connections = new Map(); // guildId -> VoiceConnection
const players = new Map();     // guildId -> AudioPlayer

function getPlayer(guildId, connection, api) {
    let player = players.get(guildId);
    if (!player) {
        player = api.createAudioPlayer();
        player.on('error', (e) => {
            logger.warn(`⚠️ AI GM voice narration: playback error: ${e.message}`);
        });
        connection.subscribe(player);
        players.set(guildId, player);
    }
    return player;
}

async function ensureConnection(client, guildId, channelId, api) {
    const existing = connections.get(guildId);
    if (existing && existing.state.status !== api.VoiceConnectionStatus.Destroyed) {
        return existing;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error(`Guild ${guildId} (DISCORD_GUILD_ID) is not in this bot's cache -- is the bot actually a member of that server?`);
    const channel = guild.channels.cache.get(channelId);
    if (!channel || typeof channel.isVoiceBased !== 'function' || !channel.isVoiceBased()) {
        throw new Error(`Channel ${channelId} (DISCORD_TTS_VOICE_CHANNEL_ID) is not a voice channel in guild ${guildId}`);
    }

    const connection = api.joinVoiceChannel({
        channelId,
        guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true // the bot only ever speaks narration, it never needs to listen
    });
    await api.entersState(connection, api.VoiceConnectionStatus.Ready, 15_000);
    connections.set(guildId, connection);
    return connection;
}

/**
 * Play one AI GM narration clip in the configured voice channel.
 * Fire-and-forget from callers (see events/ready.js's 'tts-audio'
 * handler) -- a failure here (missing deps, no permission to join,
 * bad channel config) is logged and swallowed, never thrown back at
 * the WS event loop.
 *
 * @param {import('discord.js').Client} client
 * @param {{audio: string, text?: string, voice?: string, format?: string}} data
 */
async function playNarration(client, data) {
    const voiceCfg = config.voice || {};
    const guildId = config.discord?.guildId;
    if (!voiceCfg.enabled || !voiceCfg.channelId || !guildId) return; // not configured -- silent no-op, see file header

    const { audio, text, format } = data || {};
    if (!audio) return;

    const api = loadVoiceApi();
    if (!api) return;

    try {
        const connection = await ensureConnection(client, guildId, voiceCfg.channelId, api);
        const player = getPlayer(guildId, connection, api);
        const buffer = Buffer.from(audio, 'base64');
        // StreamType.Arbitrary tells @discordjs/voice to run this through
        // FFmpeg (prism-media) rather than assume it's already Opus/PCM --
        // required since the source format is whatever TTS_FORMAT sent
        // (wav by default), not something Discord natively understands.
        const resource = api.createAudioResource(Readable.from(buffer), {
            inputType: api.StreamType.Arbitrary
        });
        player.play(resource);
        if (text) {
            const preview = String(text).slice(0, 80);
            logger.info(`🔊 AI GM narration playing in voice: "${preview}${text.length > 80 ? '…' : ''}"`);
        }
    } catch (e) {
        logger.warn(`⚠️ AI GM voice narration: failed to play (format: ${format || 'wav'}): ${e.message}`);
    }
}

module.exports = { playNarration };
