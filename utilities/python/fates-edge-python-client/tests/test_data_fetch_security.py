import json
from unittest.mock import Mock, patch

import pytest

from fates_edge_client.data_fetch import fetch_region_data


@pytest.mark.parametrize("manifest", [
    ["../outside"], ["/tmp/outside"], ["a/b"], ["a\\b"], ["%2e%2e"],
    ["manifest"], ["a" * 129], [42], {"region": "Acasia"}, ["a"] * 1001,
])
def test_rejects_remote_paths_before_writes(tmp_path, manifest):
    response = Mock(text=json.dumps(manifest))
    with patch("fates_edge_client.data_fetch.requests.get", return_value=response) as get:
        with pytest.raises(ValueError, match="Invalid region manifest"):
            fetch_region_data(tmp_path, quiet=True)
        assert get.call_count == 1
    assert list(tmp_path.iterdir()) == []


def test_rejects_symlink_destination(tmp_path):
    target = tmp_path / "outside.txt"
    target.write_text("keep")
    (tmp_path / "Acasia.json").symlink_to(target)
    with patch("fates_edge_client.data_fetch.requests.get", return_value=Mock(text='["Acasia"]')):
        with pytest.raises(ValueError, match="symlink"):
            fetch_region_data(tmp_path, quiet=True)
    assert target.read_text() == "keep"


def test_valid_region_download(tmp_path):
    responses = [Mock(text='["Acasia"]'), Mock(text='{"name":"Acasia"}')]
    with patch("fates_edge_client.data_fetch.requests.get", side_effect=responses):
        assert fetch_region_data(tmp_path, quiet=True) == ["Acasia"]
    assert json.loads((tmp_path / "Acasia.json").read_text()) == {"name": "Acasia"}
