/**
 * Single source of truth for the version string shown in the UI
 * (console banner, browser tab title, sidebar "brand-version" badge).
 *
 * WHY THIS FILE EXISTS: before it did, the version was hand-typed in
 * three unrelated places — a comment + two console.log() strings in
 * app.js, plus <title>/<meta description>/the .brand-version span in
 * index.html — and a version bump only actually touched package.json
 * (via tools/bump-version.mjs) plus whichever of those spots someone
 * remembered by hand. That's exactly how v4.4.0 shipped with index.html
 * fixed but app.js still hardcoded at "v4.3a".
 *
 * Now: this constant is the only thing that needs to change, app.js
 * imports it for its console banner AND pushes it into the DOM at
 * startup (see setDisplayedVersion() below, called from app.js's init())
 * so index.html's static text is just a pre-hydration fallback, not a
 * second source of truth. tools/bump-version.mjs updates this file
 * alongside every package.json — see its VERSION_JS_FILES list.
 */

export const APP_VERSION = '4.25.0';

// Pushes APP_VERSION into the DOM elements that show it statically in
// index.html (title, meta description, .brand-version badge), so those
// only need to be *roughly* right at ship time — this corrects them the
// moment the app actually loads. Safe to call even if some elements are
// missing (SSR-less static HTML, or a stripped-down embed).
export function applyDisplayedVersion(version = APP_VERSION) {
    if (typeof document === 'undefined') return;

    const badge = document.querySelector('.brand-version');
    if (badge) badge.textContent = `v${version}`;

    if (document.title) {
        document.title = document.title.replace(/v\d+\.\d+\.\d+\S*/, `v${version}`);
    }

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        metaDesc.content = metaDesc.content.replace(/v\d+\.\d+\.\d+\S*/, `v${version}`);
    }
}
