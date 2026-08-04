import json

from fates_edge_client.models import Character, Timer
from fates_edge_client.store import CURRENT_VERSION, DataStore, load_data, migrate, save_data


def test_save_then_load_round_trip(tmp_path):
    path = tmp_path / "data.json"
    store = DataStore()
    store.characters.append(Character(id=1, name="Aria"))
    store.timers.append(Timer(id=2, name="Clock", segments=4))
    store._nextId = 3

    save_data(store, path)
    assert path.exists()

    loaded = load_data(path)
    assert len(loaded.characters) == 1
    assert loaded.characters[0].name == "Aria"
    assert loaded.timers[0].segments == 4
    assert loaded._nextId == 3


def test_load_missing_file_returns_empty_store(tmp_path):
    store = load_data(tmp_path / "nope.json")
    assert store.characters == []
    assert store.version == CURRENT_VERSION


def test_save_is_atomic_no_leftover_temp_files(tmp_path):
    path = tmp_path / "data.json"
    store = DataStore()
    save_data(store, path)

    leftovers = [p for p in tmp_path.iterdir() if p.name != "data.json"]
    assert leftovers == []


def test_load_corrupt_file_is_preserved_not_discarded(tmp_path):
    path = tmp_path / "data.json"
    path.write_text("{not valid json!!", encoding="utf-8")

    store = load_data(path)
    assert store.characters == []  # fresh empty store returned

    corrupt_path = path.with_suffix(path.suffix + ".corrupt")
    assert corrupt_path.exists()
    assert corrupt_path.read_text(encoding="utf-8") == "{not valid json!!"
    assert not path.exists()  # original moved, not left behind as garbage


def test_migrate_stamps_current_version_on_old_data():
    old_data = {"version": 1, "characters": []}
    migrated = migrate(old_data)
    assert migrated["version"] == CURRENT_VERSION


def test_migrate_leaves_current_version_data_untouched():
    data = {"version": CURRENT_VERSION, "characters": [], "marker": "keep-me"}
    migrated = migrate(data)
    assert migrated["marker"] == "keep-me"


def test_from_dict_handles_missing_keys_gracefully():
    # Simulates a very old / hand-edited file missing most keys.
    store = DataStore.from_dict({"version": 1})
    assert store.characters == []
    assert store.deck.cards == []
    assert store._nextId == 1
