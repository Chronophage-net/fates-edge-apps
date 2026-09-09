# Fate’s Edge Manager

The account, room-access, and socket-node manager described in the docs repository’s
`SAAS_MANAGER.md`. The dashboard provides Rooms, room rosters and invitations, API keys,
Account, and an operator-only Nodes view. There are no commerce features or campaign data
in the manager database.

## Quick preview

Requires Node 22 or later. From this directory:

```sh
npm ci
npm run demo
```

Open the printed localhost address and sign in with the temporary operator credentials
printed in the terminal. The preview uses an isolated, in-memory PostgreSQL engine. Its
accounts and rooms disappear when stopped. It has no registered game servers.

## Persistent local installation

```sh
npm ci
npm run setup
docker compose up -d --wait database
npm run bootstrap
npm start
```

Open http://localhost:3100 and sign in as `operator`, using `MANAGER_BOOTSTRAP_PASSWORD`
from the generated private `.env`. After bootstrap, remove the bootstrap username/password
variables from `.env`; normal sign-in uses the password hash in PostgreSQL. You can change
your password from Account. Bootstrap refuses to operate on a populated database.

`setup` creates private configuration and a persistent RSA signing key, and refuses to
overwrite existing configuration. PostgreSQL runs on localhost port 15432 with a persistent
named volume. For an existing PostgreSQL service, set `MANAGER_DATABASE_URL` instead of
starting the supplied database container. Use a dedicated database: the manager’s tables
must not collide with the game server’s tables.

## Connect a game server

`setup` also generates `secrets/socket-node.env`. Start a separate socket-server process
with those variables, from the socket-server directory:

```sh
node --env-file=../fates-edge-manager/secrets/socket-node.env server-start.js
```

Install that package’s own dependencies first if needed. This starts a dedicated managed
node at localhost:3200. The node registers and heartbeats automatically. On the manager,
create a room and choose **Get connection** to assign it to a healthy node and issue a token.
The manager chooses a ready node with capacity, then retains that placement. Draining a node
prevents new placements while allowing existing rooms to continue.

**Deployment mode is explicit.** `MANAGER_URL` makes the entire socket process managed;
every room join requires a manager token. Leave it unset for the existing local/unmanaged
flow. Run separate processes for local and managed rooms. A managed process refuses Redis
relay and multi-worker cluster mode because those modes do not provide exclusive room ownership.

No automatic failover or live room migration is performed. If an assigned node is lost,
the room becomes unavailable until that same stable node identity is restored. This avoids
creating two authoritative copies or losing live game state. Game-state migration requires
a separate storage/fencing protocol; a drain operation does not pretend to move campaigns.

## Using room credentials

Create an API key under a room. Its secret is displayed once, with copy/download actions.
Send it only to the manager, in an `Authorization: Bearer ...` header:

```http
POST /v1/auth/exchange
Content-Type: application/json
Authorization: Bearer fe_live_<key-id>_<secret>

{}
```

The response contains `socket_url`, `server_id`, `placement_version`, and `room_token`.
The token expires in ten minutes. Never send the API key to a socket node or put credentials
in a URL. Human sessions can obtain the same connection response through
`GET /v1/rooms/{room_id}/connect`.

For Socket.IO, emit `join-room` with `{roomCode, roomToken, playerName}`. For plain WebSocket,
connect to `/?room=ROOMCODE`, wait for `auth-required`, then send
`{type: "handshake", roomToken, clientName}`. Both acknowledgements include `serverId` and
`placementVersion`. The verified membership determines the game role; client role claims
cannot change it. Connections close at token expiry and must reconnect with a fresh token.

Managed REST supports authenticated room reads for `deck`, `deck/history`, `clients`, and
`characters`, plus POST `deck/draw`, `deck/shuffle`, and `deck/crown` for permitted narrators.
Use `Authorization: Bearer <room-token>`. Other legacy REST routes are closed on a managed
node, including deployment-wide API-key access. The existing game-event role policy still
applies, narrowed by the key’s scopes. Seat/roster changes must go through the manager.

### Join from the web client

1. Sign in to the manager, open your room, and choose **Get connection → Copy**.
2. In the web client, open **Settings → Managed room** and paste the connection.
3. Choose **Enter managed room**. The assigned socket node must confirm the room, node identity,
   and placement version before the client displays or sends game state.

The paste field clears immediately. Credentials stay in memory, never in query parameters or
browser storage. The manager supplies the room code and game role; the local role selector
cannot override them. Transient reconnects reuse the unexpired grant. At expiry or rejection,
get a new connection from the manager and paste it again. **Leave managed room** clears the
connection. Ordinary local/password rooms continue to use the existing connection controls.

This release uses an explicit copy-and-paste handoff, not cross-origin manager sessions or
silent refresh. Sign-in remains on the manager dashboard.

## Sign-in and operations

The first operator can create ordinary local accounts from **Nodes → Create account**.
Existing accounts and memberships can be imported explicitly with
`npm run import -- /path/to/reviewed-export.json`. The export has `accounts`
(`id`, `username`, `password_hash`), `rooms` (`id`, `room_code`, `name`,
`owner_account_id`), and `memberships` (`account_id`, `room_id`, `role`, optional
`id` and `status`) arrays. Use UUIDs and preserve existing account IDs. Bootstrap
the operator first. The importer never reads or changes the live game database,
never overwrites existing records, and rolls back the entire import if any room
lacks exactly one active designated owner. Bcrypt passwords are accepted and
upgraded to Argon2id on successful sign-in. New passwords use Argon2id.

Invitations name an existing username and are accepted while signed in to that exact account.
Invite again to replace an expired invitation. Game role and room-administration role are
separate. An owner can change their own game role without abandoning ownership. Owners can grant or
remove the separate administrator role, cancel invitations, remove members, and archive or
reactivate rooms. Removing membership revokes its keys; archived rooms issue no connections.

Owners see safe key metadata for every member of their room and may create, rotate, or revoke
a member’s integration key. The key remains bound to that member and cannot exceed their
permissions. Issuing it for another member is recorded explicitly in the room security history.
Ordinary members see only their own keys. Operators can inspect each node’s assigned rooms.

For OIDC, configure `MANAGER_OIDC_PROVIDERS` with provider name, issuer, client ID, display
name, and optionally `client_secret_env`. Register this exact callback with the provider:

```text
https://your-manager.example/v1/auth/sso/<provider-name>/callback
```

Sign in locally, then use **Account → Link provider** within five minutes. Subsequent provider
logins identify the account by issuer and subject. Email addresses never cause automatic
linking or account creation. The OIDC adapter uses discovery, Authorization Code + S256 PKCE,
state, nonce, audience/issuer/time validation and JWKS signature verification. Provider tokens
are discarded. Configure HTTPS for both the manager and provider in remote deployments.

Production configuration:

- Set `MANAGER_ORIGIN` to the exact external HTTPS origin, without a trailing slash.
- Supply a durable `MANAGER_PEPPER` and RSA PKCS#8 `MANAGER_SIGNING_KEY_FILE` through protected
  deployment configuration. Losing/changing the pepper invalidates sessions, invitations and keys.
- Give each node a distinct stable UUID and secret in `MANAGER_NODE_CREDENTIALS`. Do not reuse
  the game server’s deployment-wide API key. Use secure public `wss://` node URLs.
- Terminate HTTPS at a reverse proxy, restrict the manager backend to it, and rate-limit public
  endpoints there. The app does not trust forwarded IP headers; its own login/exchange limiter
  therefore groups requests by the directly connected peer.
- Back up the manager database and signing material separately from game campaign storage.

Sessions are server-revocable, HTTP-only, SameSite=Lax, and Secure on HTTPS. Browser mutations
require both the exact Origin and a session CSRF token. Keys are HMAC-digested with the pepper,
not recoverable from the database. Rotation has at most five minutes of overlap. Membership
changes revoke its existing keys atomically; suspension and roster changes increment the room’s
authorization version. Nodes receive changes on their 15-second heartbeat. During an outage,
existing connections can only retain the remaining life of an already-issued ten-minute token.

Mutations accept `Idempotency-Key`: an already-completed key returns 409 rather than applying
the operation twice. One-time credentials are never retained for replay. Refresh the dashboard
after an interrupted response; rotate a key if its one-time secret was lost.

## Verification

```sh
npm test
```

Tests exercise PostgreSQL SQL and transactions using PGlite, real HTTP requests, both live
socket transports, scoped-key exchange, cross-room rejection, bans, rotation, suspension,
placement affinity, and a signed OIDC test provider with invalid claims/signatures. Tests of
the game-node adapter also require the sibling socket-server package’s dependencies.

The supplied PostgreSQL Docker service requires Docker to be running. Actual external OIDC
providers, reverse-proxy TLS and a production PostgreSQL deployment need their own deployment
smoke check. Webhooks, shared-load-balancer affinity cookies and live
room migration are not implemented in this initial release. Direct node endpoints are supported.

Code and software documentation: MIT. This package does not bundle Fate’s Edge setting content.
