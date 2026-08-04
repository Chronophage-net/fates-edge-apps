from fates_edge_client.deck import (
    build_deck,
    draw_cards,
    get_card_meaning_from_region,
    get_wildcard_meaning,
    load_region_data,
    synthesise_consequence,
    synthesise_crown_spread,
    _map_numeric_rank,
    _transform_region_data,
)
from fates_edge_client.models import Card, DeckState


def test_build_deck_has_54_cards():
    deck = build_deck()
    assert len(deck) == 54
    jokers = [c for c in deck if c.is_joker]
    assert len(jokers) == 2


def test_draw_cards_rebuilds_when_exhausted():
    deck = DeckState(cards=[])
    drawn = draw_cards(deck, 5)
    assert len(drawn) == 5


def test_map_numeric_rank():
    assert _map_numeric_rank('2') == '2'
    assert _map_numeric_rank('10') == '10'
    assert _map_numeric_rank('11') == 'J'
    assert _map_numeric_rank('12') == 'Q'
    assert _map_numeric_rank('13') == 'K'
    assert _map_numeric_rank('14') == 'A'


def test_transform_region_data_maps_suits_correctly():
    raw = {
        "title": "Test Region",
        "people_and_factions": [{"rank": "14", "title": "The Duchess", "description": "Rules the port."}],
        "places": [{"rank": "2", "title": "The Wharf", "description": "Salt air."}],
        "complications": [{"rank": "6", "title": "Blockade", "description": "Ships turned away."}],
        "rewards": [{"rank": "10", "title": "Sea Charts", "description": "Old maps."}],
    }
    transformed = _transform_region_data(raw)
    assert transformed['name'] == 'Test Region'
    assert 'The Duchess' in transformed['hearts']['A']
    assert 'The Wharf' in transformed['spades']['2']
    assert 'Blockade' in transformed['clubs']['6']
    assert 'Sea Charts' in transformed['diamonds']['10']


def test_load_region_data_real_file_has_content():
    data = load_region_data('Acasia')
    assert data['hearts'] or data['spades'] or data['clubs'] or data['diamonds']


def test_load_region_data_unknown_region_falls_back():
    data = load_region_data('Nonexistent Region XYZ')
    assert data['hearts']['A']  # fallback always populates an Ace entry


def test_get_card_meaning_uses_region_data_when_present():
    region_data = {'hearts': {'A': 'A specific meaning about a Duchess.'}}
    meaning = get_card_meaning_from_region('hearts', 'A', region_data)
    assert 'A specific meaning about a Duchess.' in meaning


def test_get_card_meaning_falls_back_when_absent():
    meaning = get_card_meaning_from_region('spades', '5', {})
    assert 'Location' in meaning
    assert 'Minor' in meaning


def test_get_wildcard_meaning_returns_twist_text():
    card = Card(suit='joker', rank='Red', is_joker=True, symbol='🃏', suit_name='Joker', rank_name='Red')
    meaning = get_wildcard_meaning(card)
    assert meaning.startswith("✨ Twist")


def test_synthesise_consequence_single_card():
    region_data = load_region_data('Acasia')
    card = Card(suit='hearts', rank='K')
    result = synthesise_consequence([card], region_data)
    assert isinstance(result, str) and len(result) > 0


def test_synthesise_consequence_multiple_cards_numbered():
    region_data = load_region_data('Acasia')
    cards = [Card(suit='hearts', rank='K'), Card(suit='spades', rank='2'), Card(suit='clubs', rank='9')]
    result = synthesise_consequence(cards, region_data)
    assert result.startswith("1. ")
    assert "2. " in result
    assert "3. " in result


def test_synthesise_crown_spread_shape():
    region_data = load_region_data('Acasia')
    main_cards = [Card(suit='hearts', rank='A'), Card(suit='spades', rank='K'),
                  Card(suit='clubs', rank='7'), Card(suit='diamonds', rank='3')]
    wildcard = Card(suit='joker', rank='Black', is_joker=True, symbol='🃏', suit_name='Joker', rank_name='Black')
    result = synthesise_crown_spread(main_cards, wildcard, region_data)
    assert len(result['positions']) == 4
    assert result['positions'][0]['label'] == 'Root'
    assert result['positions'][2]['label'] == 'Crown'
    assert 'synthesis' in result and 'wildcard' in result
