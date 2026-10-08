# coturn TLS certs (optional)

TURN is opt-in in both the root and standalone server Compose files. Set
`TURN_SECRET` and actual browser-reachable `TURN_URLS` in that project's `.env`,
then run `docker compose --profile turn up -d`. A missing secret stops the relay
with an explicit error; it does not block the ordinary two-container setup.

Host networking shares the host's network: use deliberate firewall rules for
3478 UDP/TCP and 49160–49200 UDP, plus 5349 TCP if TLS is enabled. Linux Docker
Engine supports it; Docker Desktop requires a supported version and opt-in.
See [Docker's host networking requirements](https://docs.docker.com/engine/network/drivers/host/).
HTTPS microphone permission is still required separately; see the
[Home Docker guide](../../../../DOCKER_HOME.md).

By default the `coturn` service in `docker-compose.yml` only listens for
plain `turn://` (UDP/TCP on 3478), which is enough to fix voice chat for
most players behind ordinary home NATs.

To also support `turns://` (TURN over TLS on 5349) — which is what lets
voice chat get through firewalls that block everything except
HTTPS-looking traffic — drop a real certificate here and set
`TURN_ENABLE_TLS=true` in your `.env`:

```
coturn/cert.pem   # full chain
coturn/key.pem    # private key
```

Reuse the same cert your reverse proxy/HTTPS termination already has for
this domain (e.g. copy it from Let's Encrypt/certbot's output). These
files are gitignored — never commit real certs or keys.
