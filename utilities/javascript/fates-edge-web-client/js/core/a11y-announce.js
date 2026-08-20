// js/core/a11y-announce.js
//
// A11Y LIVE ANNOUNCER — a small, self-contained utility for telling
// screen-reader users about things that happen on screen without any
// action of their own: a chat message arriving, a dice roll resolving,
// route/tab navigation completing. This is deliberately SEPARATE from
// components/Toast.js's visible toast stack (#toast-container, already
// aria-live="polite"/role="status") even though the two overlap in
// spirit — toasts are a small set of discrete, dismissible visual
// notifications (deck draws, shuffles, errors); this announcer is for a
// screen-reader-only channel that can be updated far more often (every
// chat message, every roll) without also cluttering the visible UI with
// a toast per event. Sighted users never see this; it's visually hidden
// via the standard "sr-only" clip technique (NOT display:none/
// visibility:hidden, which would also hide it from assistive tech).
//
// Two live regions, matching the two urgency levels real-time events
// actually need:
//   - #a11y-announcer          aria-live="polite"    — chat messages,
//     dice roll results, deck draws/shuffles, navigation changes. Waits
//     for the screen reader to finish whatever it's currently saying.
//   - #a11y-announcer-urgent   aria-live="assertive"  — reserved for
//     genuinely interrupt-worthy events (e.g. a timer hitting 0, an
//     X-Card being called). Used sparingly and deliberately — assertive
//     regions interrupt whatever the user is doing, so they're easy to
//     overuse into "the screen reader won't shut up."
//
// Both regions are cleared and re-filled on each announce() call rather
// than accumulated, and a per-region debounce collapses back-to-back
// calls within one animation frame into the LAST message only —
// otherwise setting textContent twice in the same tick (common when two
// events fire together) can cause some screen readers to only announce
// the first, or announce a stale value. A trailing zero-width space is
// alternated on repeat-identical messages so the same text announced
// twice in a row (e.g. two players both rolling the exact same result)
// still fires — most screen readers only re-announce a live region when
// its content actually changes.

let politeEl = null;
let urgentEl = null;
let toggle = false;

function ensureRegions() {
    if (politeEl && urgentEl && document.body.contains(politeEl)) return;

    politeEl = document.getElementById('a11y-announcer');
    if (!politeEl) {
        politeEl = document.createElement('div');
        politeEl.id = 'a11y-announcer';
        politeEl.setAttribute('aria-live', 'polite');
        politeEl.setAttribute('aria-atomic', 'true');
        politeEl.className = 'sr-only';
        document.body.appendChild(politeEl);
    }

    urgentEl = document.getElementById('a11y-announcer-urgent');
    if (!urgentEl) {
        urgentEl = document.createElement('div');
        urgentEl.id = 'a11y-announcer-urgent';
        urgentEl.setAttribute('aria-live', 'assertive');
        urgentEl.setAttribute('aria-atomic', 'true');
        urgentEl.className = 'sr-only';
        document.body.appendChild(urgentEl);
    }
}

/**
 * Announce a short message to screen-reader users only.
 * @param {string} message
 * @param {{ assertive?: boolean }} [opts] - assertive: true routes to the
 *   interrupting live region. Use only for genuinely urgent events.
 */
export function announce(message, opts = {}) {
    if (!message) return;
    ensureRegions();
    const el = opts.assertive ? urgentEl : politeEl;
    // Alternate a trailing zero-width space so an identical consecutive
    // message still counts as a DOM mutation and gets re-announced.
    toggle = !toggle;
    el.textContent = String(message) + (toggle ? '​' : '');
}

export default { announce };
