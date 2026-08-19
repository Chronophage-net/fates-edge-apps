from unittest.mock import MagicMock, patch

import pytest
import requests

from fates_edge_client.rest_client import (
    FatesEdgeApiError,
    FatesEdgeRestClient,
    NotSupportedByServerError,
    RoomNotFoundError,
)


def _mock_response(status_code=200, json_data=None, content=b'{}'):
    resp = MagicMock()
    resp.status_code = status_code
    resp.content = content
    resp.json.return_value = json_data if json_data is not None else {}
    if status_code >= 400:
        resp.raise_for_status.side_effect = requests.exceptions.HTTPError(response=resp)
    else:
        resp.raise_for_status.return_value = None
    return resp


@pytest.mark.asyncio
async def test_get_deck_success():
    client = FatesEdgeRestClient('http://localhost:10000')
    with patch('requests.get', return_value=_mock_response(200, {'remaining': 40})) as mock_get:
        result = await client.get_deck('AC12')
        assert result == {'remaining': 40}
        mock_get.assert_called_once()
        assert '/api/rooms/AC12/deck' in mock_get.call_args[0][0]


@pytest.mark.asyncio
async def test_404_translates_to_room_not_found():
    client = FatesEdgeRestClient('http://localhost:10000')
    error_resp = _mock_response(404, {'error': 'Room AC12 not found'})
    with patch('requests.get', return_value=error_resp):
        with pytest.raises(RoomNotFoundError) as exc_info:
            await client.get_deck('AC12')
        assert exc_info.value.status_code == 404
        assert 'not found' in str(exc_info.value)


@pytest.mark.asyncio
async def test_other_http_error_translates_to_base_api_error():
    client = FatesEdgeRestClient('http://localhost:10000')
    error_resp = _mock_response(401, {'error': 'API key required'})
    with patch('requests.get', return_value=error_resp):
        with pytest.raises(FatesEdgeApiError) as exc_info:
            await client.get_deck('AC12')
        assert not isinstance(exc_info.value, RoomNotFoundError)
        assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_chat_raises_not_supported_without_network_call():
    client = FatesEdgeRestClient('http://localhost:10000')
    with patch('requests.post') as mock_post:
        with pytest.raises(NotSupportedByServerError):
            await client.send_chat('AC12', 'hello')
        mock_post.assert_not_called()


@pytest.mark.asyncio
async def test_upload_posts_and_returns_code():
    client = FatesEdgeRestClient('http://localhost:10000')
    with patch('requests.post', return_value=_mock_response(200, {'code': 'xy12ab'})):
        code = await client.upload('AC12', {'characters': []})
        assert code == 'xy12ab'


@pytest.mark.asyncio
async def test_get_deck_seed_success():
    client = FatesEdgeRestClient('http://localhost:10000')
    with patch('requests.get', return_value=_mock_response(200, {'code': 'AC12', 'seed': 'abc123'})) as mock_get:
        result = await client.get_deck_seed('AC12')
        assert result == {'code': 'AC12', 'seed': 'abc123'}
        mock_get.assert_called_once()
        assert '/api/rooms/AC12/deck/seed' in mock_get.call_args[0][0]


@pytest.mark.asyncio
async def test_set_deck_seed_posts_seed_and_returns_result():
    client = FatesEdgeRestClient('http://localhost:10000')
    expected = {'success': True, 'code': 'AC12', 'seed': 42, 'remaining': 54}
    with patch('requests.post', return_value=_mock_response(200, expected)) as mock_post:
        result = await client.set_deck_seed('AC12', 42)
        assert result == expected
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert '/api/rooms/AC12/deck/seed' in args[0]
        assert kwargs['json'] == {"seed": 42}


@pytest.mark.asyncio
async def test_api_key_sent_as_header():
    client = FatesEdgeRestClient('http://localhost:10000', api_key='secret123')
    assert client.headers == {"X-API-Key": "secret123"}
    with patch('requests.get', return_value=_mock_response(200, {})) as mock_get:
        await client.list_modules()
        _, kwargs = mock_get.call_args
        assert kwargs['headers'] == {"X-API-Key": "secret123"}
