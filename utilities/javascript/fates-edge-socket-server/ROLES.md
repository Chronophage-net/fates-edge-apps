# Roles & Permissions

> Implemented in `server/room.js` (`handleGmRequest`/`handleGmApproval`/`handleRoleChangeRequest`) and `server/security.js` (`isGmLike`/`canManageGmSeat`/`isSpectator`). Promoted out of `DESIGN.md` into its own document since this is the most load-bearing part of the server's design and was previously buried at the bottom of a much longer file.

---

## 1. The four roles

Every connected client has exactly one role at a time, held on `client.role` (in-memory, per connection) and mirrored to `room_memberships.role` (persistent, per account) once the client is authenticated.

```mermaid
flowchart TD
    GM["👑 gm\n(exactly one per room)"]
    COGM["🛡️ co-gm\n(0 or more, uncapped)"]
    PLAYER["🎭 player\n(default role)"]
    SPEC["👁️ spectator\n(read-only)"]

    GM -- "grants / revokes" --> COGM
    GM -- "role_change_request" --> PLAYER
    GM -- "role_change_request" --> SPEC
    COGM -. "cannot promote/demote anyone" .-> PLAYER

    classDef gm fill:#d4af37,stroke:#7a5c00,color:#1a1400,font-weight:bold;
    classDef cogm fill:#8a6fd6,stroke:#4a2f9e,color:#fff;
    classDef player fill:#3a6fb0,stroke:#1a3a66,color:#fff;
    classDef spec fill:#555,stroke:#222,color:#fff;
    class GM gm;
    class COGM cogm;
    class PLAYER player;
    class SPEC spec;
```

Only the GM seat itself is capped at exactly one; the diagram's downward arrows are permission *grants*, not a strict reporting hierarchy — a Co-GM's permissions are a subset of the GM's, not a link in an approval chain.

## 2. Permission matrix

| Action | GM | Co-GM | Player | Spectator |
|---|:---:|:---:|:---:|:---:|
| Deck control (draw/shuffle/history) | ✅ | ✅ | ❌ | ❌ |
| Edit any character | ✅ | ✅ | Own claimed character only | ❌ |
| Kick / ban / unban a client | ✅ | ✅ | ❌ | ❌ |
| Set/clear room password | ✅ | ✅ | ❌ | ❌ |
| GM-only / secret adventure state | ✅ | ✅ | ❌ | ❌ |
| Promote/demote a Co-GM | ✅ | ❌ | ❌ | ❌ |
| Transfer/revoke the GM seat | ✅ | ❌ | ❌ | ❌ |
| Delete / reset the room | ✅ | ❌ | ❌ | ❌ |
| View public room/adventure state | ✅ | ✅ | ✅ | ✅ |
| Claim / release a character | n/a (doesn't need one) | n/a | ✅ | ❌ |

The three seat-management rows (promote/demote Co-GM, transfer GM, delete/reset room) are gated by a strict `role === 'gm'` check (`security.canManageGmSeat()`) — everything else a GM can do, a Co-GM can also do, via `security.isGmLike(role)`.

## 3. How a role actually changes

```mermaid
sequenceDiagram
    participant GM as GM client
    participant Server as room.js
    participant Storage as storage.js (DB)
    participant Room as Everyone in the room

    GM->>Server: role_change_request { targetId, role, persist }
    Server->>Server: security.canManageGmSeat(sender) ?
    alt sender is not strictly 'gm'
        Server-->>GM: rejected (Co-GM cannot promote/demote)
    else authorized
        Server->>Server: client.role = role (this connection only)
        opt persist === true (or any demotion)
            Server->>Storage: write room_memberships.role
        end
        Server->>Room: broadcast role_update { targetId, role, byId, persist }
    end
```

Notes:
- `persist: false` (the default) only flips the live connection's role — it reverts to whatever's on file the next time that user joins. Good for "run tonight's fight scene" without a permanent grant.
- `persist: true` writes through to `room_memberships.role`, so the grant survives reconnects.
- **Demotions always persist**, regardless of how the promotion was made — a saved Co-GM can be fully revoked, not just silenced for one session.
- A client's self-declared role on join is only trusted for `gm`/`player`/`spectator` — **`co-gm` is never accepted from the client itself.** It's only restored automatically when the account's persisted `room_memberships.role` already says `co-gm` (i.e. a previously *saved* grant), so nobody can claim Co-GM by simply asking for it at join time.

## 4. Character claim/release

Bridges a player's account-owned character *library* (`GET/POST/PUT/DELETE /api/account/characters`, capped at `storage.MAX_CHARACTERS_PER_USER`) to a room's live character roster (`room.characters`), via a `room_character_claims` table: one row per `(room_code, user_id)`, enforcing exactly one live claim per player per room.

```mermaid
flowchart LR
    Lib["Account character library\n(GET/POST/PUT/DELETE\n/api/account/characters)"]
    Claim["POST /api/rooms/:code/claim-character\n(or socket 'claim-character')"]
    Roster["Room's live roster\n(room.characters)"]
    Release["DELETE .../claim-character\n(or socket 'release-character')"]

    Lib -- "characterId" --> Claim
    Claim -- "binds, sets ownerId" --> Roster
    Roster -- "release-character" --> Release
    Release -. "character stays in library" .-> Lib
```

- Claiming again replaces the previous claim (one live claim per player per room).
- On join/rejoin (either transport), a previously-saved claim auto-resolves against the room's live roster — a returning player doesn't have to re-pick their character every session.
- The claimed character's roster record gets an `ownerId` field. A Player may only write to a character where `room.characterClaims[userId] === normalizeCharKey(name)` (checked via `room.canEditCharacter()`); GM/Co-GM bypass this check entirely; a Spectator never passes it.

## 5. Where this is enforced in code

| Concern | File | Function(s) |
|---|---|---|
| Role storage & broadcast | `server/room.js` | `handleRoleChangeRequest`, `_persistRole` |
| GM seat request/approve | `server/room.js` | `handleGmRequest`, `handleGmApproval` |
| Permission checks | `server/security.js` | `isGmLike`, `canManageGmSeat`, `isSpectator` |
| Character edit authorization | `server/room.js` | `canEditCharacter` |
| Character claim/release (API) | `server/api.js` | `claim-character` routes |
| Character claim/release (sockets) | `server/socketio-handlers.js`, `server/ws-handlers.js` | `claim-character` / `release-character` handlers |
| Persistent role/claim storage | `server/storage.js` | `setMemberRole`, `setCharacterClaim`, `deleteCharacterClaim` |
