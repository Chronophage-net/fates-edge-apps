# Web client review — 27 September 2026

## Delivered

- A more compact homepage with a single prominent starter action, improved light-theme gold contrast, reduced-motion support, and Home-scoped button styles. Loading, missing-page and failed-load states share a responsive recovery card.
- Independent route panels, stale-import protection, retry in the correct panel, and role checks on legacy redirects. Client visibility is a convenience; authorization must still be enforced by the server.
- Escaped route/error output; safe plain-text fallback when shared/GM-chat sanitization is unavailable; restricted rich-content controls, CSS and delegated action attributes; prototype-key filtering in `deepMerge`.
- DOMPurify 3.4.16, jsPDF 4.2.1 and AutoTable 5.0.8 are bundled dependencies. Sanitization and PDF export no longer rely on their old CDN globals. The jsPDF update includes upstream security fixes ([release notes](https://github.com/parallax/jsPDF/releases/tag/v4.2.1)); applicability varies by API, so this review does not claim every upstream advisory was exploitable through character export.
- The document/adventure development handler is now an actual Vite plugin. It preserves binary bytes, supports HEAD, decodes filenames, returns real 404s, and rejects directory traversal and symlink escapes. The old top-level `configureServer` property was ignored by Vite, so its unsafe path handling was dormant, not a confirmed live vulnerability.
- nginx security headers are repeated where local `add_header` directives suppress inherited ones, following the [nginx inheritance rules](https://nginx.org/en/docs/http/ngx_http_headers_module.html#add_header). Referrers use `strict-origin-when-cross-origin`.
- Structured resilience values and puzzle-only adversaries render correctly without rewriting bestiary data. Tests now assert the current schema and retain legacy compatibility.

## Validation

- `npm test`: 331 tests; baseline was 312/314 passing. Added behavioral coverage for routing, stale imports, retry, sanitization failures, prototype keys, file-serving boundaries and binary output. The nginx test checks configuration structure, not a running server.
- Actual PDF generation covers the core landscape sheet and company/practice pages for all eight magic paths, using the new libraries without CDN globals.
- `npm run build`: succeeds. Bundle-size and mixed static/dynamic-import warnings remain.
- `npm audit`: zero reported vulnerabilities after the dependency updates. This covers the npm dependency tree, not the remaining CDN-loaded libraries.
- Browser smoke checks: desktop dark/light Home, missing-page recovery, 390px Home and Dice layout, navigation and a local dice roll.

## Scope and limits

This is a targeted client review, not a penetration test of the socket server or a deployed environment. No live multiplayer, backend authorization, TURN, or deployment was exercised. Neither nginx nor Docker is installed in this environment, so nginx runtime configuration/header verification remains a deployment check. The Node DOM shim cannot prove browser sanitizer behavior or full accessibility conformance. Remaining CDN scripts and the published-document HTML/CSS pipeline deserve a separate, focused review; no blanket security certification is implied.
