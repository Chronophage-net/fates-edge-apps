# Kon'reh – Core Rules

*A game of Apex, Sanctum, and Reforge*

---

## 🎯 Objective

Capture your opponent's **Blue (Arbiter)**. After capture, the opponent has **five of their own turns** to plant a banner (end a move) on your Home Apex to return their Blue (*Reforge*). If they fail, you win. If they succeed, the game continues.

---

## 🧩 Setup

- **Board**: 8×8 diamond grid. Four corner Apexes:
  - **Home Apex** (your starting corner)
  - **Opposing Apex** (enemy Home)
  - **Two Sanctums** (side corners)
- **Pieces per player**: 1 Blue, 2 Oranges, 6 Reds, 1 Green — arranged in a four‑rank pyramid out from your Home Apex:
  - **R1** (length 1): Blue on the Home Apex
  - **R2** (length 2): 2 Oranges
  - **R3** (length 3): Red – Green – Red
  - **R4** (length 4): 4 Reds
- Player 1's Home Apex is (0,0); Player 2's is (7,7). The two remaining corners, (0,7) and (7,0), are the Sanctums.
- **Heads up**: the setup is tight. Nearly every piece starts boxed in by its own side — expect the first move or two, for both players, to come from the outer‑rank Reds only.

---

## 🔄 Turn Order

1. Players alternate **one move** per turn.
2. **Second player** gets an opening **double‑move** on their first turn: they may move two **different** pieces (one move each). Every turn after that is a normal single move for both sides.

---

## 🏃 Movement & Zones

### Onward (exact) vs. Homeward (up to)

Every piece has two **Onward** lanes — the two straight directions leading away from *your own* Home Apex — and two **Homeward** lanes, leading back toward it.

- **Onward is exact.** The piece must travel its *full* Onward distance in a straight line — no shorter stop is allowed. If anything blocks the path before that exact square, that lane simply has **no legal move** this turn.
- **Homeward is "up to."** The piece may stop at any square from 1 up to its Homeward distance — an ordinary slide, stopping short is fine.

| Piece  | Onward (exact) | Homeward (up to) |
|--------|:---------------:|:-----------------:|
| Red    | 2               | 1                 |
| Orange | 3               | 2                 |
| Green  | 4               | 3                 |
| Blue   | 5               | 4                 |

### Zone of Control (ZoC)

- Every piece projects ZoC onto its four edge‑adjacent squares.
- On a **Homeward** move: entering an enemy ZoC square ends the move there — that square is still a legal landing spot, you just can't slide further past it.
- On an **Onward** move: ZoC does **not** interrupt the path — only an actual piece (friendly or enemy) blocks it. (If ZoC blocked Onward paths the same way, captures at distance 2+ would be mathematically impossible — the second‑to‑last square of any straight approach is always inside the target's own ZoC. Landing on the exact required square is always legal, whether or not that square happens to be in ZoC.)
- No piece — friend or foe — can ever be passed through, on either kind of move.

### Capture

- **Red, Orange, Green** capture by displacement — landing on an enemy‑occupied square, on either an Onward or a Homeward move.
- **Blue's own slide never captures.** A plain Blue move (Onward or Homeward) can only land on an empty square. Blue captures exclusively through its two specials, below.

---

## 🔵 Blue (Arbiter) Specials

On a Blue turn, you may **slide** first (its normal Onward‑5‑exact / Homeward‑up‑to‑4 movement), then perform **one special** — but only if that slide did not end by entering enemy ZoC. You cannot special, then slide.

- **S:D (Displacement)** – step 1 square, in any of the four directions, onto an adjacent enemy and remove it.
- **S:H (Hop‑capture)** – jump over exactly one adjacent enemy to the empty square immediately beyond; remove the jumped piece. The landing square must be empty.
- Each special can be used **only once per Blue life**.
- **Crown Stagger**: if you use both distinct specials (S:D and S:H) in the same life, your Blue becomes **Rooted** until your next turn. While Rooted, it cannot move.

---

## ⚔️ The Cross (Central Four)

The **2×2 center diamond** — (3,3), (3,4), (4,3), (4,4) — carries special restrictions for Blue only:

- **Stay cap**: a Blue may end at most **3 consecutive of its own turns** in the Cross. This is *per visit*, not cumulative for the whole life — once Blue leaves, the count resets to 0, so a later visit gets a fresh 3‑turn budget.
- **Exclusion**: after a Blue leaves the Cross, it may not re‑enter for the next **2 of its own turns**.
- **Practice rule (recommended)**: enter only if you have at least one **certified exit** next turn (XS ≥ 1).

---

## 🌱 Twin Apex Seed (Spawning Greens)

If your Blue ends a move on a **Sanctum**, and the **opposite Sanctum is empty**, you may **Seed**: place a Green on the opposite Sanctum. Conditions:

- Global cap of **6 Greens** on the board (combined, both players).
- The Blue that Seeded becomes **Rooted** until its next turn.
- **Mobilization Delay**: you cannot Seed on the first turn your Blue leaves Home in a given life.
- **Same‑Sanctum ban**: if a Blue was placed on a Sanctum via Reforge, it may not Seed from that same Sanctum for the rest of its current life.

Greens move like any other piece (Onward‑4‑exact / Homeward‑up‑to‑3, capture by displacement), and are also used in Reforge below.

---

## ♻️ Reforge (After Blue is Captured)

When your Blue is captured:

- You have **5 of your own turns** to plant a banner on the enemy's Home Apex.
- Plant by ending a move of **any of your pieces** on the enemy's Home Apex.
- If you succeed:
  - Remove the planting piece.
  - Return your Blue to the board, choosing one placement:
    - **Opposing Apex** (enemy Home) – costs **1 Green** (the runner itself may pay, if it was a Green).
    - **Either Sanctum** – free, but that Blue may **never Seed from that Sanctum** for the rest of this life.
    - **Your Home Apex** – free.
  - The reforged Blue returns with **both specials refreshed** (S:D and S:H available again).
- If you **fail** to plant within 5 turns, you **lose immediately**.

---

## 🤖 Playing vs. the Computer (Schools)

The board offers a **vs Computer** mode alongside hot‑seat two‑player. Pick one of six Schools for the computer to play as — the rules never change between them, only how the computer *weighs* a position:

| School | Doctrine |
|---|---|
| **Ykrul** | Control before contact — count exits, not victims. |
| **Vilikari** | Tempo theft and misdirection — sell them the hour you stole. |
| **Thepyrgosi** | Proof and parity — refuse noise, prove inevitability. |
| **Aeler** | Ledger and toll — every square pays, or closes. |
| **Lethai** | Single‑Stroke — win by inevitability, not attrition. |
| **Vhasian** | Honor as bait — polish the helm in public, strike in private. |

Under the hood, each School runs the same look‑ahead search but scores positions differently — e.g. Ykrul values mobility and avoids the Cross; Vilikari rewards forcing threats and Cross activity; Thepyrgosi guards its own Blue above almost everything else. Pick "Two Players" to skip this and play locally against another person as before.

**School flavor.** Whichever side a School controls has its pieces named per the Concordance's own titles instead of generic Blue/Orange/Red/Green in the move log — e.g. Ykrul calls them Warlord/Shaman/Picket/Raider, Vilikari calls them Boss/Barker/Stall/Runner, and so on for all six. Purely cosmetic; the on‑board glyphs stay B/O/R/G for clarity.

**Live coach hints.** When the active Blue is in or entering the Cross, a rough **Exit Certainty (XS)** reading appears in the stat panel; when it's sitting on a Sanctum, a rough **Seed Safety (SSI)** reading appears too. Both are simplified, single‑ply approximations of the named heuristics above — a nudge, not a solver — and apply in every mode, not just vs Computer.

---

## 🌐 Connected Mode (`kon-reh-connected.js`)

A separate module for playing a real game between two separate clients — e.g. two people in the same VTT/chat session — over **any transport your application already has**. This module never opens a connection itself; it just needs two things from you:

```js
import { openKonrehModalConnected } from './kon-reh-connected.js';

const connection = openKonrehModalConnected(myTransport, {
  localPlayer: 1,      // which seat THIS client controls: 1, 2, or omit/null to spectate
  startFresh: true,     // true: start a brand-new game now
                         // false: ask the peer for its current state and join in progress
});

// wire messages from your existing socket into it:
mySocket.on('konreh', (msg) => connection.receive(msg));

// tear down when done:
connection.destroy();
```

`myTransport` needs exactly one method: **`transport.send(message)`** — a plain JS object; serialize and route it however your socket layer already works (`socket.emit(...)`, `ws.send(JSON.stringify(...))`, your VTT's own event bus, etc). Everything else — whose turn it is, applying moves, Reforge choices, and catching a client up after a dropped message — is handled internally on top of the same engine used for local and vs‑Computer play.

**Resync.** If your transport reports a reconnect (or you just suspect a message went missing), call `connection.requestSync()` to have the peer resend its full current state rather than guessing. The module also detects an unexpected gap automatically whenever a *later* message does arrive, and requests a resync on its own in that case — `requestSync()` covers the case where nothing further arrives to trigger that automatically.

Verified with two independent browser clients relayed through a mock server: fresh start, mid‑game join, bidirectional move relay (including the opening double‑move), and drop‑then‑resync recovery all stay in sync with zero divergence.

---

## 📋 State Tracking (Recommended for Physical Play)

Use markers or dice to track the following for each Blue:

- **[CF: in x/3]** – Cross stay count (resets to 0 each time Blue leaves).
- **[Excl: y]** – Cross re‑entry exclusion turns remaining.
- **[S:H] / [S:D]** – Specials spent this life.
- **[Rooted]** – Blue cannot move until next turn.
- **[RC n/5]** – Reforge countdown for the side whose Blue is captured.
- **G6 Dial** – global Green count (0–6).

---

## 🧠 Key Heuristics (Table Etiquette)

- **XS (Exit Certainty)** – Count legal exits before entering the Cross. One is playable; two is safe.
- **SSI (Seed Safety Index)** – Seed only if the opponent's Blue cannot punish the Rooted turn (≥2 plies away or out of specials).
- **Don't spend both Blue specials lightly** – Stagger makes you vulnerable.
- **Seed for tempo, not vanity** – avoid rooting into a punish.
- **Reforge math beats material** – if you can force a failed Reforge, trade pieces freely.
- **Respect the Onward block** – a single piece parked in an enemy's exact Onward lane shuts that whole advance down; use this to deny, not just to capture.

---

## 🧭 Recommended Learning Path

1. **Get comfortable with Onward/Homeward** first — it's the one mechanic that doesn't look like a normal board game. Play a few opening turns just watching which pieces can move at all.
2. **Add Blue specials** – practice S:D and S:H, watch for Stagger.
3. **Add Cross discipline** – enter only with XS ≥ 1, respect the 3‑stay/2‑exclusion cycle.
4. **Learn Seed** – learn Mobilization Delay, seed only when safe.
5. **Reforge drill** – run a capture and the five‑turn banner race.
6. **Try a School** – play "vs Computer" against Aeler or Thepyrgosi for a steadier opponent, or Vilikari/Vhasian for a sharper one, once you're fluent in the base rules.

---

## 📁 Files

- **`konreh.html`** – standalone build; open it directly in any browser, no server or install needed.
- **`kon-reh.js`** – the same engine as a drop-in ES module (exports `KonrehEngine`, `SCHOOLS`, `openKonrehModal()`, and friends), for embedding in a larger app.
- **`kon-reh-connected.js`** – optional add-on module (exports `openKonrehModalConnected()`) for real-time play between two clients over a transport you already have. Imports from `./kon-reh.js`, so keep the two files together. Not needed for local or vs‑Computer play.
