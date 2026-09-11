# Adversary Action Procedure

**Purpose:** Close P0-2. Define the one player-facing sequence that every adversary uses.

## SRD-Ready Text

### How Adversaries Act

Adversaries do not take turns in the initiative order. They act through the fiction and through Story Beats.

### When the GM Narrates Pressure from an Adversary

The targeted player rolls defense. This is the default, free action.

**Choose the defense skill** based on the threat:
- Body + Melee (melee)
- Body + Athletics (dodge or ranged)
- Wits + Insight (psychic or magical)
- Spirit + Endurance (fear or possession)

**DV = 3 + 1 per 2 TL above 3**, rounded down.
- TL 1–3: DV 3
- TL 4–5: DV 4
- TL 6–7: DV 5
- TL 8+: DV 5, Desperate position

**On a Miss:** the PC takes the adversary's Harm.

**On a Partial:** the PC marks Fatigue equal to half the adversary's Harm (rounded up), and gains 1 Boon.

**On a Success:** the PC avoids or redirects the harm. Narrate how.

### When the GM Spends Story Beats

The adversary uses a named move from its `sb_spends`. The SB cost is listed. The move is resolved according to its text — often as a modification to the baseline defense roll, or as a new pressure.

### When a PC Initiates Against an Adversary

The PC rolls normally against the same DV formula. On a Miss, the adversary acts freely — no roll from the adversary is needed; the fiction moves and the GM narrates the response. On a Partial, both sides get a piece. On a Success, the PC's intent lands.

### Opposed Rolls (Rare)

When both sides are actively contesting a single action with no clear initiator, both roll. Compare successes:
- Higher successes wins cleanly.
- Tie: Partial for both.
- 0 successes on either side: Miss for that side.

### Named Moves are the Exception

Named moves cost SB precisely because they are not free. The GM can always apply baseline pressure; the SB menu is what changes the terms of the fight.

## Design Notes for the GM

- **The GM does not roll to hit.** The player rolls defense. This keeps the spotlight on the player and reduces GM overhead.

- **The DV formula scales with TL, not with pool.** A TL 5 adversary has a 6d pool but a DV of 4. That means a competent PC hits it about 50% of the time under Controlled position, and the fight lasts long enough to feel earned.

- **The SB menu is the adversary's turn.** The GM spends SB to make the adversary do what the menu says it does. No SB, no named moves.

- **The fiction always wins.** If the table's fiction demands that an adversary act in a way not covered here, the GM rules and moves on. This procedure is a default, not a cage.

## Worked Example

### Silken Blade vs. Ellis

The GM narrates: the Blade's poisoned stiletto flicks toward Ellis's throat.

- Ellis rolls Body + Melee. TL 5 Blade → DV 4, Controlled (the fight is not yet desperate).
- Ellis's pool: 5d (Body 3 + Melee 2). Rolls: 9, 7, 4, 3, 1. Two successes vs. DV 4 → Partial.
- Ellis marks Fatigue equal to half the Blade's Harm (2 ÷ 2 = 1). Gains 1 Boon.
- The GM spends 1 SB to activate **[BLOOD] Lock eyes.** Ellis must test Spirit + Endurance or offer a wrist. Ellis rolls and passes.
- The fight continues.

## DV Formula Quick Reference

| TL | DV | Difficulty |
|---|---|---|
| 1–3 | 3 | Standard |
| 4–5 | 4 | Challenging |
| 6–7 | 5 | Hard |
| 8+ | 5 | Hard (Desperate position) |
