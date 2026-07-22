# Kon'reh – Core Rules

*A game of Apex, Sanctum, and Reforge*

---

## 🎯 Objective

Capture your opponent’s **Blue (Arbiter)**. After capture, the opponent has **five of their own turns** to plant a banner (end a move) on your Home Apex to return their Blue (*Reforge*). If they fail, you win. If they succeed, the game continues.

---

## 🧩 Setup

- **Board**: 8×8 diamond grid. Four corner Apexes:  
  - **Home Apex** (your starting corner)  
  - **Opposing Apex** (enemy Home)  
  - **Two Sanctums** (side corners)
- **Pieces per player** (starting positions):
  - 1 Blue (Arbiter) – at Home Apex  
  - 1 Orange – at the square adjacent along one edge  
  - 1 Red – at the other adjacent edge square  
  - Greens are not placed at setup; they are spawned later.

Player 1 is at top‑left corner (0,0); Player 2 at bottom‑right (7,7). The two side corners are Sanctums.

---

## 🔄 Turn Order

1. Players alternate **one move** per turn.  
2. **Second player** gets an opening **double‑move** on their first turn: they may move two **different** pieces (one move each).

---

## 🏃 Movement & Zones

### Movement Rules
- All pieces slide along **straight lanes** (cardinal directions on the diamond).  
- A move travels in one direction only; no turning mid‑move.  
- A piece may move any number of empty squares until it either:
  - Reaches the edge of the board,
  - Encounters a piece (friendly or enemy),
  - Enters **enemy Zone of Control (ZoC)**.

### Zone of Control (ZoC)
- Every piece projects ZoC to its four edge‑adjacent squares.  
- You **may enter** enemy ZoC, but **entering ends your move** immediately.  
- You may **not pass through** enemy ZoC.  
- Friendly ZoC does not restrict movement.

### Capture (non‑Blue)
- **Red, Orange, Green** capture by displacement: step onto an enemy‑occupied square and remove it.  
- **Blue** does not capture by normal sliding; it has special capture moves (see below).

---

## 🔵 Blue (Arbiter) Specials

On a Blue turn, you may **slide** first (normal movement), then perform **one special** (if the slide did not enter enemy ZoC). You cannot special then slide.

- **S:D (Displacement)** – step 1 square onto an adjacent enemy and remove it.  
- **S:H (Hop‑capture)** – jump over exactly one adjacent enemy to the empty square immediately beyond; remove the jumped piece. The landing square must be empty.  
- Each special can be used **only once per Blue life**.  
- **Crown Stagger**: If you use both distinct specials (S:D and S:H) in the same life, your Blue becomes **Rooted** until your next turn. While Rooted, it cannot move.

---

## ⚔️ The Cross (Central Four)

The **2×2 center diamond** (coordinates (3,3), (3,4), (4,3), (4,4)) has special restrictions for Blue:

- **Stay cap**: A Blue may end at most **3 of its own turns** in the Cross per life.  
- **Exclusion**: After a Blue leaves the Cross, it may not re‑enter for **2 of its own turns**.  
- **Practice rule (recommended)**: Enter only if you have at least one **certified exit** next turn (XS ≥ 1).

---

## 🌱 Twin Apex Seed (Spawning Greens)

If your Blue ends a move on a **Sanctum**, and the **opposite Sanctum is empty**, you may **Seed**: place a Green on the opposite Sanctum. Conditions:

- Global cap of **6 Greens** on the board (combined).  
- The Blue that Seeded becomes **Rooted** until its next turn.  
- **Mobilisation Delay**: You cannot Seed on the first turn your Blue leaves Home in a given life.  
- **Same‑Sanctum ban**: If a Blue was placed on a Sanctum via Reforge, it may not Seed from that same Sanctum for the rest of its current life.

Greens move like other pieces (slide, capture by displacement), and are also used in Reforge (see below).

---

## ♻️ Reforge (After Blue is Captured)

When your Blue is captured:

- You have **5 of your own turns** to plant a banner on the enemy’s Home Apex.  
- Plant by ending a move of **any of your pieces** on the enemy’s Home Apex.  
- If you succeed:
  - Remove the planting piece.  
  - Return your Blue to the board, choosing one placement:
    - **Opposing Apex** (enemy Home) – costs **1 Green** (sacrifice it).  
    - **Either Sanctum** – free, but that Blue may **never Seed from that Sanctum** for the rest of this life.  
    - **Your Home Apex** – free.  
  - The reforged Blue returns with **both specials refreshed** (S:D and S:H available again).
- If you **fail** to plant within 5 turns, you **lose immediately**.

---

## 📋 State Tracking (Recommended)

Use markers or dice to track the following for each Blue:

- **[CF: in x/3]** – Cross stay count (current life).  
- **[Excl: y]** – Cross re‑entry exclusion turns remaining.  
- **[S:H] / [S:D]** – Specials spent this life.  
- **[Rooted]** – Blue cannot move until next turn.  
- **[RC n/5]** – Reforge countdown for the side whose Blue is captured.  
- **G6 Dial** – global Green count (0–6).

---

## 🧠 Key Heuristics (Table Etiquette)

- **XS (Exit Certainty)** – Count legal exits before entering the Cross. One is playable; two is safe.  
- **SSI (Seed Safety Index)** – Seed only if the opponent’s Blue cannot punish the Rooted turn (≥2 plies away or out of specials).  
- **Don’t spend both Blue specials lightly** – Stagger makes you vulnerable.  
- **Seed for tempo, not vanity** – avoid rooting into a punish.  
- **Reforge math beats material** – if you can force a failed Reforge, trade pieces freely.

---

## 🧭 Recommended Learning Path

1. **Tutor games** – no Seed, learn slides, ZoC, basic captures.  
2. **Add Blue specials** – practice S:D and S:H, watch for Stagger.  
3. **Add Cross discipline** – enter only with XS ≥ 1, respect 3‑stay/2‑exclusion.  
4. **Enable Seed** – learn Mobilization Delay, seed only when safe.  
5. **Reforge drill** – run a capture and the five‑turn banner race.  
6. **Full games** – use state markers until fluent.