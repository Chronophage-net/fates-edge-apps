# Fate's Edge Toolkit

> **A complete digital ecosystem for playing, running, and building Fate's Edge.**

Fate's Edge is a narrative tabletop roleplaying game built around **Story Beats, Patrons, Rites, consequences, and player-driven fiction**.

The Fate's Edge Toolkit brings the game to the browser and connects it to the tools people already use to play tabletop RPGs. Create characters, run adventures, manage encounters, play online with your group, connect to VTTs and Discord, or let the AI GM help run the game.

It also includes standalone games and tools built for the Fate's Edge universe, including **Kon'reh** and **Toll & Veil**.

---

## 🎲 What Can I Do?

### 🧙 Play Fate's Edge

* Create and manage characters
* Build characters with the full Fate's Edge rules
* Roll dice and resolve actions
* Manage Patrons, Symbols, Rites, Talents, and other character elements
* Track Story Beats and other campaign resources
* Play through adventures and encounters
* Use the built-in magic and monastic-path systems

### 🗺️ Run a Campaign

The toolkit gives Game Masters a complete set of campaign-management tools:

* Campaign and party management
* Adventure and scene management
* Encounter tracking
* Objective clocks for combat and non-combat challenges
* NPC and faction management
* Shared campaign state
* Deck of Consequences management
* GM, Co-GM, Assistant GM, Player, and Spectator roles
* Real-time synchronization between players

The **Assistant GM** role is designed specifically to support AI-assisted game mastering without giving an AI unrestricted administrative authority.

### 🌐 Play Together Online

The Fate's Edge campaign server provides real-time multiplayer infrastructure for the toolkit.

Players can:

* Join shared campaign rooms
* Synchronize characters and campaign state
* See party presence
* Share adventure progress
* Participate in real-time encounters
* Use integrated voice chat
* Share campaign resources

The server supports both Socket.IO and plain WebSocket transports.

### 🤖 Use AI to Help Run the Game

Fate's Edge can integrate with an AI GM service to assist with:

* Campaign state
* Adventure management
* Encounters
* Character information
* Patron obligations
* Narrative support
* GM-assistant workflows

The AI GM operates within the same campaign infrastructure as human players and GMs.

---

## 🎭 Use the Tools You Already Have

Fate's Edge is designed to work alongside existing tabletop platforms rather than requiring everyone to abandon them.

### Foundry VTT

Connect Fate's Edge campaigns to Foundry VTT through the Fate's Edge bridge.

### Roll20

Use Fate's Edge commands and campaign functionality directly from Roll20.

### Discord

The Fate's Edge Discord bot provides campaign and administrative commands without requiring everyone to remain in the web client.

### Avrae

Fate's Edge can integrate with Avrae-based Discord workflows.

---

## ⚔️ More Than a VTT

The toolkit also contains standalone games from the Fate's Edge universe.

### Kon'reh

A strategic board game set within the Fate's Edge world.

Play:

* Pass-and-play
* Against the built-in AI
* In real-time multiplayer

Kon'reh's AI includes phase-aware strategic behavior and can provide coaching during play.

### Toll & Veil

A second original game built on the Fate's Edge infrastructure.

Toll & Veil supports:

* Pass-and-play
* Solo play against AI
* Real-time multiplayer
* Optional stakes
* Narrative consequences tied to the Fate's Edge setting

These games aren't separate technology islands. They use the same ecosystem and multiplayer infrastructure as the rest of the toolkit.

---

## 🚀 Quick Start

### Run the web client

The simplest way to explore Fate's Edge is through the web application.

```bash
git clone https://github.com/Chronophage-net/fates-edge-apps.git
cd fates-edge-apps
npm install
npm run build
```

The repository contains the web client, server, integrations, game modules, and supporting packages.

### Docker

A Docker Compose configuration is provided for running the ecosystem as a collection of services.

```bash
docker compose up
```

Additional services, including the AI GM bot and TURN server, can be enabled through the appropriate Compose profiles.

See the deployment documentation for production configurations.

---

## 🏗️ Architecture

At its core, Fate's Edge separates the **game rules and data** from the **interfaces used to play the game**.

```text
                         Fate's Edge Rules & Data
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Campaign Server  │
                         │  Authoritative   │
                         │   Game State     │
                         └────────┬─────────┘
                                  │
               ┌──────────────────┼──────────────────┐
               │                  │                  │
               ▼                  ▼                  ▼
          Web Client          AI GM Bot        VTT / Bots
               │                                     │
        ┌──────┼──────┐                    ┌─────────┼─────────┐
        ▼      ▼      ▼                    ▼         ▼         ▼
      Players   GM   Games              Foundry   Roll20   Discord
```

The server is authoritative for shared campaign state, while clients provide the interfaces through which players and GMs interact with that state.

This makes it possible to add new interfaces without rebuilding the underlying campaign system.

### Scaling

The socket server can operate as:

* A single self-contained instance
* A multi-core Node.js cluster
* Multiple instances using Redis
* A horizontally scaled deployment behind a load balancer

The common configuration remains deliberately simple: **no external services are required for basic single-server operation.**

---

## 🔒 Security

The multiplayer infrastructure includes protections for hostile or malformed clients, including:

* REST API rate limiting
* WebSocket message-rate limiting
* Authentication rate limiting
* Per-room client limits
* Input length and validation controls
* Server-verified socket identities
* Network-supplied display-name sanitization
* Authoritative multiplayer game state
* Controlled stake transactions
* Configurable deployment limits

Security is treated as part of the game infrastructure rather than something added after multiplayer functionality is complete.

---

## ♿ Accessibility

Accessibility is an ongoing, actively-tracked pass, not a one-time checklist — see
[`ACCESSIBILITY.md`](ACCESSIBILITY.md) for the full, pass-by-pass record (what's implemented,
what was audited and found already sufficient, and what's deliberately deferred, with the
reasoning for each). Highlights:

* Focus management + `document.title` updates on every route change, with `aria-live` regions
  hardcoded in `index.html`
* A `role="log"` chat pane, self-announcing dice rolls, and a `role="tab"`/`role="tabpanel"`
  sidebar with `aria-selected`/`aria-controls`
* A built-in **high-contrast theme** (AAA-level contrast throughout) alongside the dark/light themes
* Two independent opt-in **text-to-speech features**, serving accessibility from opposite
  directions: **"Type to Speak"** reads incoming chat messages aloud (for players who'd rather
  listen than read a fast-scrolling log), and **AI GM Voice Narration** (see the AI GM Bot's
  README/DESIGN.md) reads the AI's own replies aloud alongside the text — both off by default,
  both purely additive to the text that's already there
* Voice-chat speaking indicators (icon + screen-reader text, not color alone), labeled sliders
  with numeric readouts, image `alt` text, a GM keyboard-shortcuts modal, and DOMPurify configured
  to strip `aria-*`/`role` from any untrusted content
* 14 static accessibility lint checks (`tests/unit/a11y-lint.test.js`), run as part of the normal
  test suite — see "Development" below
* Cross-repo coverage: the Foundry bridge's GM panel controls carry explicit `aria-label`s
  (honoring a `CONFIG.ariaLabels` override when the host Foundry instance defines one), and the
  Discord bot's embeds were audited for missing alt text (none currently use image fields)

Real axe-core/Playwright coverage in CI, `inert`-based focus trapping for inline editors, and a
configurable mic-sensitivity threshold are tracked as deferred in `ACCESSIBILITY.md`, not silently
dropped.

---

## 📦 Repository Structure

The repository contains the major components of the Fate's Edge digital ecosystem.

| Component          | Purpose                                                            |
| ------------------ | ------------------------------------------------------------------ |
| Web Client         | Browser-based player and GM interface                              |
| Socket Server      | Real-time campaign and multiplayer infrastructure                  |
| AI GM Bot          | AI-assisted game mastering                                         |
| Discord Bot        | Discord campaign integration                                       |
| Foundry Bridge     | Foundry VTT integration                                            |
| Roll20 Integration | Roll20 campaign integration                                        |
| Avrae Integration  | Discord/Avrae integration                                          |
| Kon'reh            | Strategy game                                                      |
| Toll & Veil        | Card game                                                          |
| Adventure Modules  | Playable Fate's Edge adventures                                    |
| Shared Data        | Rules, characters, factions, patrons, talents, and other game data |

For detailed architecture, implementation notes, and development history, see [`DESIGN.md`](DESIGN.md).

---

## 📚 Documentation

| Document                                                                 | Description                                                |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| [`DESIGN.md`](DESIGN.md)                                                 | Architecture, implementation details, and technical design |
| [`ROADMAP.md`](utilities/javascript/fates-edge-socket-server/ROADMAP.md) | Planned development                                        |
| [`ROLES.md`](utilities/javascript/fates-edge-socket-server/ROLES.md)     | Multiplayer roles and permissions                          |
| [`SCALING.md`](utilities/javascript/fates-edge-socket-server/SCALING.md) | Socket-server scaling                                      |
| Adventure documentation                                                  | Running and building Fate's Edge adventures                |
| Integration READMEs                                                      | Foundry, Roll20, Discord, and other integrations           |

---

## 🧪 Development

The project uses automated tests across its major components.

Run the appropriate package tests from the component you are working on.

The project is primarily JavaScript/Node.js, with additional tooling and integrations where appropriate.

Before submitting changes:

1. Run the relevant test suites.
2. Verify the affected integration or client.
3. Update documentation when behavior changes.
4. Keep shared game data compatible with existing campaigns.

---

## 🛣️ Roadmap

Fate's Edge is actively developed.

Current development focuses on:

* Expanding the campaign and adventure system
* Improving multiplayer reliability
* Expanding AI GM capabilities
* Improving VTT integrations
* Expanding the standalone game collection
* Improving accessibility and usability
* Continuing security and scaling work

See [`ROADMAP.md`](utilities/javascript/fates-edge-socket-server/ROADMAP.md) for the current technical roadmap.

---

## 📜 Licensing

The Fate's Edge ecosystem contains several categories of material with different licenses.

### Code

Code is released under the **MIT License** unless otherwise specified.

See [`LICENSE.code`](LICENSE.code).

### Fate's Edge SRD

The Fate's Edge System Reference Document is released under **CC BY-NC-SA 4.0** unless otherwise specified.

See [`LICENSE.srd`](LICENSE.srd).

### Proprietary Content

Setting material, artwork, adventures, characters, and other designated Fate's Edge content may be **All Rights Reserved**.

See [`LICENSE.proprietary`](LICENSE.proprietary).

When in doubt, check the license associated with the specific file or component.

---

## 🤝 Contributing

Contributions, bug reports, testing, and feedback are welcome.

Before contributing, please read the relevant technical documentation in [`DESIGN.md`](DESIGN.md) and check the component-specific documentation for the area you want to change.

---

## 🌌 About Fate's Edge

Fate's Edge is a tabletop roleplaying game about **people, powers, obligations, and consequences**.

The digital toolkit exists to make those systems easier to play without replacing the things that make tabletop RPGs work: imagination, conversation, improvisation, and the people sitting around the table.

Whether you're running a campaign, playing a character, experimenting with the setting, or building tools for the system, the goal is the same:

**Make Fate's Edge easier to play—and give the world more ways to come alive.**

---

**Fate's Edge Toolkit v4.14.0**

[Chronophage-net/fates-edge-apps](https://github.com/Chronophage-net/fates-edge-apps)
