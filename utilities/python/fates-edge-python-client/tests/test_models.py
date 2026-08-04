from fates_edge_client.models import Card, Character, DeckState, MessageQueue, Timer


def test_card_fills_in_derived_fields():
    c = Card(suit='spades', rank='K')
    assert c.symbol == '♠'
    assert c.suit_name == 'Spades'
    assert c.rank_name == 'King'
    assert c.color == '#2c3e50'


def test_card_joker_overrides():
    c = Card(suit='joker', rank='Red', is_joker=True, symbol='🃏', suit_name='Joker', rank_name='Red')
    assert c.color == '#d4af37'


def test_card_round_trip():
    c = Card(suit='hearts', rank='A')
    d = c.to_dict()
    c2 = Card.from_dict(d)
    assert c2 == c


def test_deck_state_round_trip():
    cards = [Card(suit='clubs', rank='2'), Card(suit='diamonds', rank='10')]
    deck = DeckState(cards=cards, history=[{'a': 1}], offset=7)
    d = deck.to_dict()
    deck2 = DeckState.from_dict(d)
    assert len(deck2.cards) == 2
    assert deck2.offset == 7
    assert deck2.history == [{'a': 1}]


def test_character_default_skills_populated():
    c = Character(id=1)
    assert c.skills['melee'] == 0
    assert 'ritual' in c.skills
    assert len(c.skills) == 19


def test_character_round_trip():
    c = Character(id=5, name="Aria", body=4)
    d = c.to_dict()
    c2 = Character.from_dict(d)
    assert c2.name == "Aria"
    assert c2.body == 4


def test_timer_basic():
    t = Timer(id=1, name="Clock", segments=6)
    assert t.current == 0


def test_message_queue_enqueue_and_drain():
    q = MessageQueue()
    q.enqueue("chat-message", {"text": "hi"})
    q.enqueue("roll-dice", {"roll": "2d6"})
    assert len(q.messages) == 2

    drained = q.drain()
    assert len(drained) == 2
    assert drained[0]["event"] == "chat-message"
    assert len(q.messages) == 0  # drained, not just peeked


def test_message_queue_respects_max_size():
    q = MessageQueue(max_size=2)
    for i in range(5):
        q.enqueue("evt", i)
    assert len(q.messages) == 2
