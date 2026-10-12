# Security Policy

## Reporting a Vulnerability

If you find a security issue anywhere in this toolkit — the web client,
the socket server, any of the bot/VTT integrations, or the desktop/terminal
clients — please report it privately rather than opening a public GitHub
issue:

**Email: support@fates-edge.com**

Include what you found, how to reproduce it, and its potential impact if
you can. There's no bug bounty program, but reports are taken seriously and
credited (if you'd like) once a fix ships.

## Scope

This toolkit is designed to be self-hosted — typically by a GM running the
socket server on a home machine or small VPS, with players connecting via
the web client or one of the VTT integrations (Foundry, Roll20, Discord,
Avrae). A few things worth knowing:

- API keys and credentials belong in local `.env` files only — every
  `.env.example`/`env-example.md` in this repo is a template, never commit
  a real one. `.gitignore` covers `*.env` everywhere in the monorepo.
- The socket server's auth rate limiting currently only covers
  `/api/auth/login` and `/api/auth/register` — see the socket server's own
  `DESIGN.md` for exactly what is and isn't rate-limited today.
- The optional Redis-backed horizontal scaling feature (`REDIS_URL`, see
  [`SCALING.md`](utilities/javascript/fates-edge-socket-server/SCALING.md))
  assumes a trusted network between server instances and Redis — it isn't
  designed to be exposed to the public internet.
- The AI GM bot's status dashboard binds to `127.0.0.1` only by default;
  see that repo's own `SECURITY.md` for its scope.

## Supported Versions

This monorepo follows [Semantic Versioning](https://semver.org/) (see
[VERSIONING.md](VERSIONING.md)) with a single version number shared across
every app in the repo. Only the latest released version is actively
supported; please update before reporting an issue if you're running an
older tag.

## Security sweep — 2026-10-12 (v5.14.2)

This review covered the seven npm package lockfiles and security-sensitive app
code, particularly desktop IPC/file access and the Python data downloader. It
is not a penetration test or a guarantee that no vulnerabilities remain.

### Remediations

- Updated vulnerable runtime and build dependencies, including Electron 44,
  electron-builder 26, electron-updater, proxy-addr and compression. Removed
  nodemon from the socket server and Discord bot in favor of `node --watch`.
  Removed unused Vitest from the repository root; root tests now use their
  native Node runner. Run each app's own test command for its separate suite.
- Desktop windows now use the Chromium sandbox. Every privileged IPC handler
  checks that its caller is an owned window's top-level bundled renderer.
  Secondary windows cannot load caller-supplied files, and renderer navigation,
  redirects, popups and webview attachment are restricted. Preload subscriptions
  no longer expose Electron event objects to renderer callbacks.
- Desktop file authorization resolves existing symlinks and ancestors, rejects
  dangling symlinks, and constrains backup restore/delete IDs to the generated
  backup namespace. These checks are not a defense against a malicious local
  process racing filesystem changes with the same OS account privileges.
- Python region downloads validate the complete remote manifest before writing:
  bounded slug lists, no path separators/traversal or reserved manifest name,
  and no symlink destinations.
- Desktop build overrides select patched xmldom and global-agent versions.
  Their plist roundtrip and proxy bootstrap APIs were checked. An incorrect
  pre-existing type-check lockfile checksum was corrected against npm registry
  metadata; integrity verification was not disabled.

The desktop boundaries follow the
[Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security/).
Use Node 22.12+ for the desktop/root tooling and reinstall from updated lockfiles.
Rebuild deployed containers/installers to pick up dependency changes.

### Verification and remaining limits

- Fresh `npm audit` results: **zero findings in all seven packages**, including
  development dependencies. Before remediation the package audits reported 46
  findings in total; the same dependency may have appeared in multiple packages.
- Manager: 22 tests passed; socket server: 235; Discord bot: 19; desktop security:
  5; root Docker/configuration: 9; Python client: 66 (including 12 new downloader
  security cases). Web-client production build passed.
- Web client: 457/458 tests passed. The existing modified GM Downtime guide
  fails the shared crafting-rules check (`Attribute + Craft` missing). Those
  unrelated document edits were preserved, not rewritten by this sweep.
- Electron runtime download failed (`fetch failed`), so the upgraded desktop
  binary, installer packaging, and OS integration have **not** been smoke-tested.
  Unit tests and build-tool API checks do not substitute for that validation.
- Installing the isolated Python dependency auditor failed to reach its package
  index. Python source regression tests passed, but Python dependency advisories
  remain **unverified**; do not interpret the npm result as covering Python.

Before releasing: resolve the crafting-document mismatch, run a Python dependency
audit in a network-enabled environment, and build/smoke-test the desktop app on
each supported OS (opening secondary windows, dialogs, backups, updates and
printing). The security fixes are included in v5.14.2; unrelated working-tree
document edits are excluded.
