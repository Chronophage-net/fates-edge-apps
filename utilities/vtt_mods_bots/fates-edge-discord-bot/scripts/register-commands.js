/**
 * Slash Command Registration (standalone)
 *
 * Registers this bot's slash commands with Discord without needing to log
 * the bot client in -- registration is a plain REST call against the
 * application's command endpoints, so it doesn't need a gateway
 * connection. Referenced by package.json's `npm run register` and by the
 * README (setup step 3, and the "Commands not registered" troubleshooting
 * entry) but was missing from the repo -- this fills that gap.
 *
 * Mirrors the same command-loading (readdir ./commands, require each
 * .js file, keep ones with both `data` and `execute`) and guild-vs-global
 * registration branching already used by index.js's registerCommands(),
 * so running this script and letting the bot self-register on next login
 * produce identical results.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

function loadCommands() {
    const commands = [];
    const commandFiles = fs.readdirSync(COMMANDS_DIR).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(COMMANDS_DIR, file);
        let command;
        try {
            command = require(filePath);
        } catch (err) {
            console.error(`❌ Failed to load ${file}:`, err.message);
            continue;
        }

        if (command && command.data && typeof command.execute === 'function') {
            commands.push(command.data.toJSON());
            console.log(`✅ Loaded command: ${command.data.name}`);
        } else {
            console.warn(`⚠️ Skipping ${file}: missing data or execute`);
        }
    }

    return commands;
}

async function main() {
    const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

    if (!DISCORD_TOKEN) {
        console.error('❌ DISCORD_TOKEN is not set (see .env.example).');
        process.exit(1);
    }
    if (!DISCORD_CLIENT_ID) {
        console.error('❌ DISCORD_CLIENT_ID is not set (see .env.example).');
        process.exit(1);
    }

    const commands = loadCommands();
    if (commands.length === 0) {
        console.error('❌ No valid commands found in ./commands -- nothing to register.');
        process.exit(1);
    }

    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    try {
        console.log(`🔄 Registering ${commands.length} slash command(s)...`);

        if (DISCORD_GUILD_ID) {
            // Guild-specific: updates instantly, ideal for development.
            const data = await rest.put(
                Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
                { body: commands }
            );
            console.log(`✅ Registered ${data.length} guild command(s) for guild ${DISCORD_GUILD_ID}.`);
        } else {
            // Global: can take up to an hour to propagate to all guilds.
            const data = await rest.put(
                Routes.applicationCommands(DISCORD_CLIENT_ID),
                { body: commands }
            );
            console.log(`✅ Registered ${data.length} global command(s). This can take up to an hour to propagate.`);
        }
    } catch (err) {
        console.error('❌ Failed to register commands:', err);
        process.exit(1);
    }
}

main();
