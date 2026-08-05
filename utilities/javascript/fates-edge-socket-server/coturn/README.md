# coturn TLS certs (optional)

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
