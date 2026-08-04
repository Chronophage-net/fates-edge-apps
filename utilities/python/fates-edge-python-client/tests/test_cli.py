import shlex

import pytest

from fates_edge_client.cli.commands import characters, config, deck, roll, timers
from fates_edge_client.cli.parser import build_parser
from fates_edge_client.store import DataStore


def test_parser_builds_without_error():
    parser = build_parser()
    assert parser is not None


@pytest.mark.parametrize("line,expected_module", [
    ("characters --list", characters),
    ("timers --list", timers),
    ("roll --attr 3 --skill 2 --dv 3", roll),
    ("deck --build", deck),
    ("config --show", config),
])
def test_subcommands_dispatch_to_expected_module(line, expected_module):
    parser = build_parser()
    args = parser.parse_args(shlex.split(line))
    assert args.func is expected_module.run


def test_roll_requires_attr_skill_dv():
    parser = build_parser()
    with pytest.raises(SystemExit):
        parser.parse_args(shlex.split("roll --attr 3"))


def test_roll_position_choices_enforced():
    parser = build_parser()
    with pytest.raises(SystemExit):
        parser.parse_args(shlex.split("roll --attr 3 --skill 2 --dv 3 --pos yolo"))


def test_websocket_requires_code():
    parser = build_parser()
    with pytest.raises(SystemExit):
        parser.parse_args(shlex.split("websocket"))


def test_unknown_subcommand_rejected():
    parser = build_parser()
    with pytest.raises(SystemExit):
        parser.parse_args(shlex.split("not-a-real-command"))


def test_shell_and_cli_share_identical_parser_shape():
    # This is the core Phase 4 guarantee: the shell doesn't rebuild its
    # own parser tree, it reuses this exact one. Verifying both entry
    # points produce the same args object for the same input line proves
    # there's only one schema to keep in sync.
    from fates_edge_client.shell import InteractiveShell

    store = DataStore()
    shell = InteractiveShell(store)
    cli_parser = build_parser()

    line = "characters --add --name Aria --body 4"
    shell_args = shell.parser.parse_args(shlex.split(line))
    cli_args = cli_parser.parse_args(shlex.split(line))

    assert shell_args.name == cli_args.name == "Aria"
    assert shell_args.body == cli_args.body == 4
    assert shell_args.func is cli_args.func


def test_characters_add_end_to_end(monkeypatch, capsys):
    # Avoid touching the real ~/.fates_edge/data.json during tests --
    # patch the `save_data` reference the characters command module
    # actually calls, not the one on the store module (the command
    # module imported its own reference at import time).
    monkeypatch.setattr(characters, "save_data", lambda store: None)

    parser = build_parser()
    args = parser.parse_args(shlex.split("characters --add --name Aria --body 4"))
    store = DataStore()
    args.func(args, store)

    assert len(store.characters) == 1
    assert store.characters[0].name == "Aria"
    captured = capsys.readouterr()
    assert "Aria" in captured.out
