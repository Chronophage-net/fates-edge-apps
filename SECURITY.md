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
