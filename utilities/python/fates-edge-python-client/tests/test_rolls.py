import pytest

from fates_edge_client.rolls import attr_cost, perform_roll, skill_cost


def test_perform_roll_pool_size():
    result = perform_roll(3, 2, dv=2, pos='controlled', boons=0)
    assert result['pool'] == 5
    assert len(result['dice']) == 5


def test_perform_roll_rejects_empty_pool():
    with pytest.raises(ValueError):
        perform_roll(0, 0, dv=2, pos='controlled', boons=0)


def test_perform_roll_outcome_classification_is_internally_consistent():
    for _ in range(200):
        result = perform_roll(3, 3, dv=3, pos='controlled', boons=1)
        successes = result['successes']
        sb = result['sb']
        outcome = result['outcome']
        if successes >= 3 and sb == 0:
            assert outcome == 'Clean Success'
        elif successes >= 3 and sb > 0:
            assert outcome == 'Success with SB'
        elif 0 < successes < 3:
            assert outcome == 'Partial'
        else:
            assert outcome == 'Miss'


def test_perform_roll_boons_never_exceed_requested():
    result = perform_roll(2, 2, dv=2, pos='controlled', boons=3)
    assert result['boons_used'] <= 3


def test_attr_cost_monotonic():
    assert attr_cost(2) < attr_cost(3) < attr_cost(4)
    assert attr_cost(0) == 0


def test_skill_cost_monotonic():
    assert skill_cost(1) < skill_cost(2) < skill_cost(3)
    assert skill_cost(0) == 0
