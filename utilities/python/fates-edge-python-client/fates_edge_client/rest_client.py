"""
REST API client for the Fate's Edge socket server (was `CampaignServer`
in the old single-file script).

Behavior is unchanged from the already-fixed version of `CampaignServer`
(see last session's API audit, folded in here): every route below is a
real server endpoint per API.md at the repo root. Two things are new in
this version:

1. Typed exceptions instead of `raise NotImplementedError(<string>)`.
   Callers (CLI handlers) can now branch on exception type
   (`NotSupportedByServerError`, `FatesEdgeApiError`, `RoomNotFoundError`)
   instead of string-matching `str(e)`.
2. `_request()` translates `requests.HTTPError` into
   `RoomNotFoundError` (404) or `FatesEdgeApiError` (anything else) with
   the server's own error message where available, instead of letting a
   raw `requests.exceptions.HTTPError` traceback leak to the user.

Chat, dice rolls, and generic room-state sync have NO REST route on the
server at all -- those are WebSocket-only events, implemented in
`ws_client.py`. The methods below that raise `NotSupportedByServerError`
document that clearly instead of pretending to try.
"""

import os
from typing import Any, Dict, List, Optional

import requests


class FatesEdgeApiError(Exception):
    """Base class for all REST API errors from the Fate's Edge server."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class RoomNotFoundError(FatesEdgeApiError):
    """The requested room code doesn't exist on the server (HTTP 404)."""


class NotSupportedByServerError(FatesEdgeApiError):
    """The server has no REST route for this action at all -- either it's
    WebSocket-only, or genuinely unsupported. Raised locally without a
    network call."""

    def __init__(self, message: str):
        super().__init__(message, status_code=None)


class FatesEdgeRestClient:
    def __init__(self, base_url: str = "http://localhost:10000", api_key: str = ""):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key or os.environ.get("FATES_EDGE_API_KEY", "")
        self.headers = {"X-API-Key": self.api_key} if self.api_key else {}

    async def _request(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        """Make an API request, translating HTTP errors into typed
        exceptions."""
        url = f"{self.base_url}{endpoint}"
        try:
            if method == 'GET':
                resp = requests.get(url, headers=self.headers)
            elif method == 'POST':
                resp = requests.post(url, json=data, headers=self.headers)
            elif method == 'PUT':
                resp = requests.put(url, json=data, headers=self.headers)
            elif method == 'DELETE':
                resp = requests.delete(url, headers=self.headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            resp.raise_for_status()
            if not resp.content:
                return {}
            return resp.json()
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else None
            server_message = None
            if e.response is not None:
                try:
                    body = e.response.json()
                    server_message = body.get('error') or body.get('message')
                except ValueError:
                    pass
            message = server_message or str(e)
            if status == 404:
                raise RoomNotFoundError(message, status_code=404) from e
            raise FatesEdgeApiError(message, status_code=status) from e
        except requests.exceptions.RequestException as e:
            raise FatesEdgeApiError(f"Request failed: {e}") from e

    # ------------------------------------------------------------
    # Campaign snapshots
    # ------------------------------------------------------------

    async def upload(self, room_code: str, data: Dict) -> str:
        """Upload a campaign snapshot for a room, returns a share code."""
        result = await self._request('POST', f'/api/rooms/{room_code}/campaigns', data)
        return result['code']

    async def load(self, room_code: str, campaign_code: str) -> Dict:
        """Load a previously-uploaded campaign snapshot by its share code."""
        return await self._request('GET', f'/api/rooms/{room_code}/campaigns/{campaign_code}')

    async def delete(self, room_code: str) -> bool:
        raise NotSupportedByServerError(
            "The server has no endpoint to delete a campaign snapshot manually. "
            "Manual uploads are auto-pruned (oldest first) once more than 2 exist for a room."
        )

    async def get_state(self, room_code: str) -> Dict:
        """Get the room's auto-save snapshot (a single, deterministic slot
        per room, distinct from the manual share-code uploads above)."""
        return await self._request('GET', f'/api/rooms/{room_code}/campaigns/auto-save')

    async def sync_state(self, room_code: str, state: Dict) -> Dict:
        """Overwrite the room's auto-save snapshot."""
        return await self._request('POST', f'/api/rooms/{room_code}/campaigns/auto-save', state)

    async def send_chat(self, room_code: str, message: str, sender: str = "CLI") -> Dict:
        raise NotSupportedByServerError(
            "Chat has no REST endpoint on the server -- it's WebSocket-only. "
            "Use `fates-edge ws --code <room>` (or shell `ws connect`) instead."
        )

    async def get_chat_history(self, room_code: str) -> List[Dict]:
        raise NotSupportedByServerError(
            "Chat history has no REST endpoint on the server. "
            "Connect over WebSocket and use the 'sync-request' response instead."
        )

    async def roll_dice(self, room_code: str, roll: str, reason: str = "CLI Roll") -> Dict:
        raise NotSupportedByServerError(
            "Dice rolling has no REST endpoint on the server -- it's WebSocket-only. "
            "Use `fates-edge ws --code <room>` (or shell `ws connect`) instead."
        )

    # ------------------------------------------------------------
    # Deck of Consequences
    # ------------------------------------------------------------

    async def get_deck(self, code: str) -> Dict:
        return await self._request('GET', f'/api/rooms/{code}/deck')

    async def shuffle_deck(self, code: str) -> Dict:
        return await self._request('POST', f'/api/rooms/{code}/deck/shuffle')

    async def draw_cards(self, code: str, count: int = 1, region: str = 'Acasia') -> Dict:
        payload = {"count": count, "region": region}
        return await self._request('POST', f'/api/rooms/{code}/deck/draw', payload)

    async def crown_spread(self, code: str, region: str = 'Acasia') -> Dict:
        payload = {"region": region}
        return await self._request('POST', f'/api/rooms/{code}/deck/crown', payload)

    async def get_deck_history(self, code: str, limit: int = 50) -> Dict:
        return await self._request('GET', f'/api/rooms/{code}/deck/history?limit={limit}')

    async def clear_deck_history(self, code: str) -> Dict:
        return await self._request('DELETE', f'/api/rooms/{code}/deck/history')

    # ------------------------------------------------------------
    # Modules
    # ------------------------------------------------------------

    async def list_modules(self) -> Dict:
        return await self._request('GET', '/api/modules')

    async def push_module(self, module_id: str, room_code: str = None) -> Dict:
        payload = {}
        if room_code:
            payload['roomCode'] = room_code
        return await self._request('POST', f'/api/modules/{module_id}/push', payload)

    async def cleanup_module(self, module_id: str, room_code: str = None) -> Dict:
        payload = {}
        if room_code:
            payload['roomCode'] = room_code
        return await self._request('POST', f'/api/modules/{module_id}/cleanup', payload)
