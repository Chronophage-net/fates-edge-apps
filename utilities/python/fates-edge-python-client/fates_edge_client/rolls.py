"""
Fate's Edge dice mechanic — pure logic, no I/O. Ported verbatim from the
original single-file client's roll_d10()/perform_roll() (attr+skill d10
pool, successes = dice >= 6 with each natural 10 counted twice, 1s
generate Stress Beats for the GM), plus the XP cost helpers
(attr_cost/skill_cost), which had no natural home elsewhere and are
equally pure.
"""

import random
from datetime import datetime
from typing import Dict, List


def roll_d10() -> int:
    return random.randint(1, 10)


def attr_cost(rating: int) -> int:
    """Cumulative XP cost to raise an attribute to `rating`."""
    total = 0
    for i in range(2, rating + 1):
        total += i * 3
    return total


def skill_cost(level: int) -> int:
    """Cumulative XP cost to raise a skill to `level`."""
    total = 0
    for i in range(1, level + 1):
        total += i * 2
    return total


def perform_roll(attr: int, skill: int, dv: int, pos: str, boons: int) -> Dict:
    """Perform a Fate's Edge roll: roll (attr + skill) d10s, count
    successes (each die >= 6 counts once, each natural 10 counts as an
    extra success on top of that), compare against the difficulty value
    (dv, a target *number* of successes), and classify the outcome.

    pos:
      - "dominant": re-roll the first die below 6 (if any)
      - "desperate": re-roll the first die at/above 6 (if any)
      - anything else ("risky", "controlled", ...): no special re-roll

    boons: re-roll the current lowest die, one at a time, as long as it's
    still below 6 (stops early once no die remains below 6).
    """
    pool = attr + skill
    if pool < 1:
        raise ValueError("Pool must be at least 1")
    dice = [roll_d10() for _ in range(pool)]

    if pos == 'dominant':
        for i, d in enumerate(dice):
            if d < 6:
                dice[i] = roll_d10()
                break
    elif pos == 'desperate':
        for i, d in enumerate(dice):
            if d >= 6:
                dice[i] = roll_d10()
                break

    boons_used = 0
    while boons_used < boons:
        min_idx = min(range(len(dice)), key=lambda i: dice[i])
        if dice[min_idx] >= 6:
            break
        dice[min_idx] = roll_d10()
        boons_used += 1

    successes = sum(1 for d in dice if d >= 6) + sum(1 for d in dice if d == 10)
    sb = sum(1 for d in dice if d == 1)

    if successes >= dv and sb == 0:
        outcome = 'Clean Success'
        outcome_class = 'outcome-clean'
        result_text = 'You succeed without cost.'
    elif successes >= dv and sb > 0:
        outcome = 'Success with SB'
        outcome_class = 'outcome-sb'
        result_text = f'You succeed, but the GM gains {sb} Story Beat{"" if sb == 1 else "s"}.'
    elif 0 < successes < dv:
        outcome = 'Partial'
        outcome_class = 'outcome-partial'
        result_text = 'You make progress. Gain 1 Boon.'
    else:
        outcome = 'Miss'
        outcome_class = 'outcome-miss'
        result_text = 'You fail and things get worse. Gain 2 Boons.'

    return {
        'attr': attr,
        'skill': skill,
        'dv': dv,
        'pos': pos,
        'boons': boons,
        'boons_used': boons_used,
        'pool': pool,
        'dice': dice,
        'successes': successes,
        'sb': sb,
        'outcome': outcome,
        'outcome_class': outcome_class,
        'result_text': result_text,
        'time': datetime.now().isoformat(),
    }
