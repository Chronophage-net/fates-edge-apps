/**
 * Local Lock – a manually-triggered, client-side-only screen lock for the
 * web GUI itself.
 *
 * Distinct from core/password.js's playtester gate (a one-time unlock
 * checked against a server-configured password, gating the whole app on
 * load): this is something a GM can flip on at any time — stepping away
 * from the table, handing the device to someone else briefly, etc. —
 * without disconnecting, losing session state, or touching the
 * playtester password at all. Its own password is entirely local (a
 * SHA-256 hash in localStorage), separate from anything server-side.
 *
 * EMERGENCY RESET: if the local lock password is forgotten, whoever has
 * filesystem access to the deployment (a self-hosting GM) can set/inspect
 * data/lock-reset.json and use the plain-text reset code described there
 * instead of the normal password. A successful reset clears the stored
 * lock password — the app unlocks, but a new lock password should be set
 * afterward (lockApp() will prompt for one again next time it's used with
 * none set).
 *
 * Deliberately does NOT implement an idle-timer auto-lock — manual only,
 * per the current design. The isLocked()/lock/unlock split below is
 * structured so an idle-timer could call lockApp() itself later without
 * any changes needed here.
 */

import { showToast } from '@components/Toast.js';

const LOCK_HASH_KEY = 'fates-edge-local-lock-hash';
const LOCKED_FLAG_KEY = 'fates-edge-locked';
const RESET_FILE_PATH = 'data/lock-reset.json';

// ─── Hashing ────────────────────────────────────────────────────
// SHA-256 via the browser's SubtleCrypto (requires a secure context —
// HTTPS or localhost — which this app already assumes elsewhere, e.g.
// core/websocket.js's isSecure checks).

async function hashText(text) {
    const enc = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Password storage ───────────────────────────────────────────

export function hasLocalLockPassword() {
    return !!localStorage.getItem(LOCK_HASH_KEY);
}

/**
 * Set (or, passing a falsy value, clear) the local lock password.
 */
export async function setLocalLockPassword(password) {
    if (!password) {
        localStorage.removeItem(LOCK_HASH_KEY);
        return;
    }
    localStorage.setItem(LOCK_HASH_KEY, await hashText(password));
}

async function checkPassword(password) {
    const stored = localStorage.getItem(LOCK_HASH_KEY);
    if (!stored) return false;
    return (await hashText(password)) === stored;
}

async function checkResetCode(code) {
    try {
        // Cache-bust: a GM who just edited the reset file to regain access
        // shouldn't have to fight a stale cached copy.
        const res = await fetch(`${RESET_FILE_PATH}?_=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data?.resetCodeHash) return false;
        return (await hashText(code)) === data.resetCodeHash;
    } catch (err) {
        console.warn('[LocalLock] Failed to check reset file:', err);
        return false;
    }
}

// ─── Lock state ─────────────────────────────────────────────────
// sessionStorage (not localStorage): a lock persists across an accidental
// refresh within the same tab, but doesn't outlive the browser session —
// closing the tab/browser doesn't leave the app permanently locked out
// for whoever opens it next.

export function isLocked() {
    return sessionStorage.getItem(LOCKED_FLAG_KEY) === 'true';
}

// ─── Overlay UI ─────────────────────────────────────────────────

function getOverlay() {
    return document.getElementById('localLockOverlay');
}

function showOverlay(subMessage = null) {
    const overlay = getOverlay();
    if (!overlay) {
        console.warn('[LocalLock] #localLockOverlay not found in the DOM.');
        return;
    }
    overlay.classList.add('open');
    const input = document.getElementById('localLockInput');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 100);
    }
    const errorEl = document.getElementById('localLockError');
    if (errorEl) errorEl.textContent = '';
    const resetSection = document.getElementById('localLockResetSection');
    if (resetSection) resetSection.style.display = 'none';

    // BUGFIX: app.css has #toast-container at z-index 2000 but
    // .password-overlay (this overlay's class) at z-index 9999 — any
    // toast shown around the same time this overlay opens renders
    // entirely behind it, for its whole ~5s lifetime, and is never seen.
    // A one-time confirmation message (e.g. "password set") needs to be
    // shown INSIDE the overlay itself instead, via the existing .gate-sub
    // element, not via showToast().
    const subEl = overlay.querySelector('.gate-sub');
    if (subEl) {
        subEl.textContent = subMessage || 'Enter your local lock password to continue.';
    }
}

function hideOverlay() {
    getOverlay()?.classList.remove('open');
}

// ─── Public actions ─────────────────────────────────────────────

/**
 * Lock the app. If no local lock password has been set yet, prompts to
 * set one first (with confirmation) rather than locking with no way back
 * in except the emergency reset — that path should stay an emergency
 * fallback, not the normal way in.
 */
export async function lockApp() {
    let justSetPassword = false;

    if (!hasLocalLockPassword()) {
        const pw = prompt('Set a local lock password (stored only on this device):');
        if (!pw) {
            showToast('Lock cancelled — no password set.', 'info');
            return false;
        }
        const confirmPw = prompt('Confirm password:');
        if (confirmPw !== pw) {
            showToast('Passwords did not match. Lock cancelled.', 'error');
            return false;
        }
        await setLocalLockPassword(pw);
        justSetPassword = true;
    }

    sessionStorage.setItem(LOCKED_FLAG_KEY, 'true');
    // See showOverlay()'s note: this confirmation has to be shown INSIDE
    // the overlay (not via showToast()) since a toast fired around the
    // same time this overlay opens would render behind it and never be
    // seen (z-index 2000 vs. the overlay's 9999).
    showOverlay(justSetPassword ? '✅ Password set! Enter it below to confirm.' : null);
    return true;
}

function unlock(message = 'Unlocked.', type = 'success') {
    sessionStorage.removeItem(LOCKED_FLAG_KEY);
    hideOverlay();
    showToast(message, type);
}

// ─── Wiring ─────────────────────────────────────────────────────
// Call once at app startup (after the lock overlay markup exists in the
// DOM). Re-shows the overlay immediately if the page was reloaded while
// locked, and attaches all the overlay's own event handlers.

export function initLocalLock() {
    if (isLocked()) {
        showOverlay();
    }

    const input = document.getElementById('localLockInput');
    const btn = document.getElementById('localLockBtn');
    const errorEl = document.getElementById('localLockError');
    const forgotLink = document.getElementById('localLockForgotLink');
    const resetSection = document.getElementById('localLockResetSection');
    const resetInput = document.getElementById('localLockResetInput');
    const resetBtn = document.getElementById('localLockResetBtn');

    async function tryUnlock() {
        if (!input) return;
        const ok = await checkPassword(input.value);
        if (ok) {
            unlock();
        } else {
            if (errorEl) errorEl.textContent = '❌ Incorrect password.';
            input.value = '';
            input.focus();
        }
    }

    btn?.addEventListener('click', tryUnlock);
    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') tryUnlock();
    });

    forgotLink?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!resetSection) return;
        const showing = resetSection.style.display !== 'none';
        resetSection.style.display = showing ? 'none' : 'block';
        if (!showing) resetInput?.focus();
    });

    async function tryReset() {
        if (!resetInput) return;
        const ok = await checkResetCode(resetInput.value);
        if (ok) {
            localStorage.removeItem(LOCK_HASH_KEY); // clear the forgotten password
            unlock('Unlocked via emergency reset. Set a new lock password when convenient.', 'warning');
            resetInput.value = '';
        } else {
            if (errorEl) errorEl.textContent = '❌ Invalid reset code.';
            resetInput.value = '';
        }
    }

    resetBtn?.addEventListener('click', tryReset);
    resetInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') tryReset();
    });
}

export default {
    lockApp,
    isLocked,
    hasLocalLockPassword,
    setLocalLockPassword,
    initLocalLock,
};
