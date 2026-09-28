# Discord and VTT compatibility review — 2026-09-27

## Working paths and boundaries

| Integration | Implemented and locally verified | Still requires host verification |
| --- | --- | --- |
| Discord | Slash schemas, bounded dice, guild/operator access, room admission/password rejection, public chat, GM promotion, shared timers and deck draws against the actual socket server | Bot invitation, command registration, Discord permissions and voice playback |
| Foundry | Actual bridge connects to the socket server with mocked host APIs; chat/dice payloads, escaping, private-message handling and duplicate suppression | Installation/UI in Foundry 11–13, document permissions, journal pages and game-system behavior |
| Roll20 | Local sandbox-compatible dice/deck/timers/exports; native character-sheet buttons; bounds and GM checks | Install in a Roll20 game and verify sheet rendering |
| Avrae | Valid alias wrapper, no Python imports, bounded local d10 command; Python syntax/control-flow test with mocked Avrae builtin | Install and run in Avrae’s Draconic runtime |

Roll20 Mods cannot access external networking or browser APIs ([sandbox documentation](https://wiki.roll20.net/Mod_Sandbox)). The former WebSocket/DOM implementation was replaced by local tools. Avrae aliases use [Draconic and supported builtins](https://avrae.readthedocs.io/en/stable/aliasing/api.html), not unrestricted Python networking. Its former network bot script was replaced by a small local dice alias. Neither integration synchronizes campaign state with the web client. These are intentional capability corrections, not successful tests of the old networking features.

Discord and Foundry support unmanaged socket-server rooms, including room passwords/account tokens. Manager-controlled rooms need a manager-token adapter and currently fail explicitly. The shared Discord identity is restricted to Manage Server users in one configured guild. Its optional API key has deployment administrator authority and is not a room password. Do not distribute it as a player credential.

## Changes

- Connection state now reflects successful admission, not merely an open WebSocket. URL construction preserves valid ws/wss endpoints; rejected credentials and intentional disconnects do not loop forever. Offline Discord commands do not replay after reconnect.
- Discord chat uses the server message envelope, resolves whispers to exactly one client, suppresses mentions and avoids copying private messages into public log channels.
- Discord voice library updated to 0.19.2 with DAVE support; Node requirement is now 22.12+, including the Docker base. The local dependency report loads DAVE; optional Opus encoder is not installed here, so voice playback is not claimed as verified. Follow the README’s voice prerequisites.
- Foundry imports public messages only through the active GM; author-only outbound hooks and imported flags prevent feedback. Blind rolls and whispers stay off the public bridge. Keep the active GM connected.
- Foundry rolls are evaluated by Foundry and relayed as results. Journals use text pages with private default ownership and structural HTML filtering. Client credentials are no longer registered as world settings; clear old world credentials when upgrading.
- Removed nonexistent distribution URLs and unverified host-version claims. Corrected installation steps and local-only macros.

## Reproduce validation

Use Node 22.12+ and Python 3. Install dependencies in the socket-server and Discord directories first. The Node integration tests use the sibling socket-server test fixture and start ephemeral localhost listeners with isolated SQLite files. They make no Discord API calls.

```sh
cd utilities/vtt_mods_bots/fates-edge-discord-bot
npm ci
npm audit
npm test
```

From the repository root:

```sh
node --test utilities/vtt_mods_bots/tests/*.test.js
python3 utilities/vtt_mods_bots/tests/avrae_test.py
```

Results: 19 Discord tests passed; 6 Foundry/Roll20 tests passed; 1 Avrae helper test passed. npm audit reports zero known vulnerabilities for the installed Discord dependency tree. This is not a comprehensive security certification. Syntax checks and scoped diff whitespace checks also passed.

## Host acceptance checks

- Discord: configure `.env`, invite with bot/application-command scopes and channel permissions, register commands, start, connect, then check `/roll`, `/vttchat`, and `/vtttimer`. Test voice only after installing its optional dependencies.
- Foundry: copy the module folder as `Data/modules/fates-edge-bridge`, enable it, set server/room, connect the active GM and one player. Verify one imported public message, no whisper leak, dice results and journal updates.
- Roll20: install the local Mod and custom sheet as described in its README; shuffle/draw, tick a timer, and click both sheet roll buttons.
- Avrae: paste the entire `avrae_module.txt` command to create the alias, then run `!fates-edge help` and `!fates-edge roll 4`.

No production room was changed, no Discord commands/messages were published, and no external bot tokens were used for these checks.
