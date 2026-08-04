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
    def __init__(self, base_url: str = "http://localhost:10000", api_key: str = "",
                 auth_token: str = ""):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key or os.environ.get("FATES_EDGE_API_KEY", "")
        # NEW: optional per-user JWT (from /api/auth/login|register), fully
        # separate from the static admin api_key above -- the two auth
        # models don't overlap server-side (see auth.js/api.js), so this
        # client keeps them as two separate constructor args rather than
        # collapsing them into one "credential" concept.
        self.auth_token = auth_token or os.environ.get("FATES_EDGE_AUTH_TOKEN", "")
        self.headers = {"X-API-Key": self.api_key} if self.api_key else {}

    def _auth_headers(self, use_bearer: bool = False) -> Dict[str, str]:
        """Headers for a request. use_bearer=True adds the per-user JWT
        (for /api/auth/me and /api/account/characters*); the static
        X-API-Key is still included whenever present since some deployments
        may want both, and the server only checks the header(s) it cares
        about for a given route."""
        headers = dict(self.headers)
        if use_bearer and self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return headers

    async def _request(self, method: str, endpoint: str, data: Dict = None,
                        use_bearer: bool = False) -> Dict:
        """Make an API request, translating HTTP errors into typed
        exceptions."""
        url = f"{self.base_url}{endpoint}"
        headers = self._auth_headers(use_bearer)
        try:
            if method == 'GET':
                resp = requests.get(url, headers=headers)
            elif method == 'POST':
                resp = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                resp = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                resp = requests.delete(url, headers=headers)
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

    # ------------------------------------------------------------
    # Optional account auth (NEW)
    # ------------------------------------------------------------
    # These hit the server's optional accounts feature (server/auth.js,
    # server/api.js). All are no-ops on an older/unpatched server: it
    # will 404/503 rather than the client crashing, since these routes
    # simply won't exist there. Nothing here is required for the
    # anonymous flow above -- register/login just populate self.auth_token
    # for subsequent calls, or for a caller to persist into DataStore.

    async def register(self, username: str, password: str) -> Dict:
        """Create an account and return {token, user}. Also updates
        self.auth_token so subsequent calls on this instance are
        authenticated immediately."""
        result = await self._request('POST', '/api/auth/register', {
            "username": username, "password": password,
        })
        if result.get('token'):
            self.auth_token = result['token']
        return result

    async def login(self, username: str, password: str) -> Dict:
        """Log in and return {token, user}; updates self.auth_token."""
        result = await self._request('POST', '/api/auth/login', {
            "username": username, "password": password,
        })
        if result.get('token'):
            self.auth_token = result['token']
        return result

    async def whoami(self) -> Dict:
        """Return the account associated with self.auth_token."""
        return await self._request('GET', '/api/auth/me', use_bearer=True)

    # ------------------------------------------------------------
    # Account character library (up to 5 per account, server-enforced)
    # ------------------------------------------------------------

    async def list_account_characters(self) -> List[Dict]:
        result = await self._request('GET', '/api/account/characters', use_bearer=True)
        return result.get('characters', result if isinstance(result, list) else [])

    async def create_account_character(self, name: str, data: Dict) -> Dict:
        """Raises FatesEdgeApiError (status_code=409) if the account
        already has 5 characters stored -- the server enforces the cap,
        this client doesn't duplicate that logic locally."""
        return await self._request('POST', '/api/account/characters', {
            "name": name, "data": data,
        }, use_bearer=True)

    async def update_account_character(self, character_id: str, name: str = None,
                                        data: Dict = None) -> Dict:
        payload = {}
        if name is not None:
            payload['name'] = name
        if data is not None:
            payload['data'] = data
        return await self._request('PUT', f'/api/account/characters/{character_id}', payload,
                                    use_bearer=True)

    async def delete_account_character(self, character_id: str) -> Dict:
        return await self._request('DELETE', f'/api/account/characters/{character_id}',
                                    use_bearer=True)

    # ------------------------------------------------------------
    # Admin: room passwords + persistent bans (x-api-key gated)
    # ------------------------------------------------------------

    async def set_room_password(self, room_code: str, password: str) -> Dict:
        """Admin-only (static X-API-Key): set/replace a room's persistent
        join password. Requires the server to have account support
        enabled (returns 503 FatesEdgeApiError otherwise)."""
        return await self._request('POST', f'/api/rooms/{room_code}/password', {
            "password": password,
        })

    async def ban_member(self, room_code: str, user_id: str) -> Dict:
        """Admin-only: ban an account from a room persistently -- survives
        the member reconnecting with a new socket id, unlike the older
        purely in-memory/ephemeral ban."""
        return await self._request('POST', f'/api/rooms/{room_code}/members/{user_id}/ban')

    async def unban_member(self, room_code: str, user_id: str) -> Dict:
        return await self._request('POST', f'/api/rooms/{room_code}/members/{user_id}/unban')
