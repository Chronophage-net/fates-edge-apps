/**
 * Soundboard "Search Sounds" modal — searches Freesound (via the socket
 * server's /api/soundboard/search proxy, see server/api.js) and lets the GM
 * preview a result and add it straight to the soundboard, either as a
 * one-shot SFX or as the current ambience loop (with an optional crossfade,
 * using soundboard.js's existing playAmbience({ transitionDuration })).
 *
 * Deliberately its own file, dynamically import()'d from gm-tools/index.js
 * (same pattern as encounters/combat.js, decks/index.js's Travel Planner,
 * etc.) rather than folded into gm-tools/index.js itself, which is already
 * enormous.
 *
 * Auth: reuses the same admin x-api-key + localStorage slot
 * ('fates-edge-api-key') that vtt-connected.js's character-push feature
 * already prompts the GM for — one credential, not a second one to manage.
 * The Freesound API key itself never reaches the browser; only this
 * server's own admin key does, same trust boundary as every other GM-only
 * REST route.
 */

import { getApiBaseUrl } from '../../core/websocket.js';
import { escHtml } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { addSoundTrack, setTrackAttribution, playAmbience, playSfx } from '../../core/soundboard.js';

const API_KEY_STORAGE = 'fates-edge-api-key';
const CROSSFADE_PRESETS = [
    { label: 'Instant', value: 0 },
    { label: 'Fast', value: 1000 },
    { label: 'Normal', value: 3000 },
    { label: 'Slow', value: 6000 },
    { label: 'Very Slow', value: 10000 },
];
const DEFAULT_CROSSFADE = 3000;

let modalEl = null;
let onChangeCallback = null;
let currentQuery = '';
let currentPage = 1;
let previewAudio = null;
let resultsById = new Map();

// ─── License classification ───────────────────────────────────────────
// Freesound's `license` field is a full CC license URL (e.g.
// "https://creativecommons.org/licenses/by-nc/4.0/"), not a short code --
// matched here by URL path segment rather than loose substring checks, so
// e.g. "sampling+" doesn't get misread as "-sa". Anything unrecognized
// fails CLOSED (treated as non-commercial + attribution-required) so an
// unfamiliar/future license value never silently reads as "safe to use
// freely" in the UI.
function classifyLicense(licenseUrl) {
    const url = String(licenseUrl || '').toLowerCase();
    if (url.includes('/publicdomain/zero') || url.includes('/publicdomain/')) {
        return { label: 'CC0 — Public Domain', badgeClass: 'badge-green', commercial: true, attribution: false };
    }
    if (url.includes('/by-nc-sa/')) {
        return { label: 'CC BY-NC-SA', badgeClass: 'badge-red', commercial: false, attribution: true };
    }
    if (url.includes('/by-nc/')) {
        return { label: 'CC BY-NC', badgeClass: 'badge-red', commercial: false, attribution: true };
    }
    if (url.includes('/by-sa/')) {
        return { label: 'CC BY-SA', badgeClass: 'badge-blue', commercial: true, attribution: true };
    }
    if (url.includes('/by/')) {
        return { label: 'CC BY', badgeClass: 'badge-blue', commercial: true, attribution: true };
    }
    if (url.includes('sampling+')) {
        return { label: 'Sampling+', badgeClass: 'badge-purple', commercial: true, attribution: true };
    }
    return { label: 'Unknown license', badgeClass: 'badge-red', commercial: false, attribution: true };
}

// ─── API helpers ───────────────────────────────────────────────────────

function buildApiUrl(pathAndQuery) {
    let apiBase = getApiBaseUrl();
    if (apiBase && typeof apiBase === 'string') {
        apiBase = apiBase.split('?')[0].replace(/\/+$/, '');
        if (apiBase === '') apiBase = null;
    }
    if (apiBase) return `${apiBase}${pathAndQuery}`;
    const origin = window.location.origin || '';
    return `${origin}/api${pathAndQuery}`;
}

function getOrPromptApiKey() {
    let apiKey = localStorage.getItem(API_KEY_STORAGE);
    if (!apiKey) {
        const input = prompt('Sound search needs this server\'s admin API key (the same one used for VTT character sync). Enter it:');
        if (input === null) return null;
        apiKey = input.trim();
        if (apiKey) localStorage.setItem(API_KEY_STORAGE, apiKey);
    }
    return apiKey || null;
}

// ─── Modal lifecycle ────────────────────────────────────────────────────

function modalTemplate() {
    const presetButtons = CROSSFADE_PRESETS.map(p => `
        <button type="button" class="btn btn-xs ${p.value === DEFAULT_CROSSFADE ? 'btn-gold' : 'btn-secondary'}" data-crossfade-preset="${p.value}">${escHtml(p.label)}</button>
    `).join('');

    return `
        <div class="modal" style="max-width:820px;">
            <button class="modal-close" id="sound-search-close" aria-label="Close">&times;</button>
            <h2>🔎 Search Sounds</h2>
            <div class="modal-body">
                <div class="flex">
                    <input type="text" id="sound-search-input" placeholder="Search Freesound (e.g. thunder, tavern murmur, sword clash)…" class="flex-1" style="min-width:220px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:0.4rem 0.6rem;color:var(--text);" />
                    <button class="btn btn-gold" id="sound-search-btn">Search</button>
                </div>
                <div class="flex mt-1" style="font-size:0.8rem;">
                    <label style="display:flex;align-items:center;gap:0.35rem;cursor:pointer;">
                        <input type="checkbox" id="sb-filter-commercial" checked /> Allow non-commercial-only sounds
                    </label>
                    <label style="display:flex;align-items:center;gap:0.35rem;cursor:pointer;">
                        <input type="checkbox" id="sb-filter-attribution" checked /> Allow attribution-required sounds
                    </label>
                </div>
                <div class="flex mt-1" style="align-items:center;padding-top:0.5rem;border-top:1px solid var(--border);">
                    <label for="sb-crossfade-input" style="font-size:0.8rem;color:var(--text2);">🎵 Ambience crossfade:</label>
                    <input type="number" id="sb-crossfade-input" value="${DEFAULT_CROSSFADE}" min="0" max="30000" step="500" style="width:80px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:0.2rem 0.4rem;color:var(--text);" />
                    <span style="font-size:0.75rem;color:var(--text3);">ms (0 = instant switch)</span>
                    <div class="flex" id="sb-crossfade-presets" style="gap:0.3rem;">${presetButtons}</div>
                </div>
                <div id="sound-search-results" class="sound-search-results mt-1">
                    <p style="font-size:0.85rem;color:var(--text2);">Search Freesound for ambience loops and one-shot SFX to add straight to your board.</p>
                </div>
                <div id="sound-search-pagination" class="flex mt-1" style="justify-content:center;align-items:center;"></div>
            </div>
        </div>
    `;
}

function ensureModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.className = 'modal-overlay';
    modalEl.id = 'soundSearchModal';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.innerHTML = modalTemplate();
    document.body.appendChild(modalEl);

    // This modal is created after page load, so app.js's generic
    // setupModals() (which wires .modal-close/.modal-overlay listeners
    // once, at DOMContentLoaded, over whatever .modal-overlay elements
    // existed at that moment) never sees it -- wire its own close/backdrop
    // handling here instead (Escape is still covered: app.js's Escape
    // handler re-queries `.modal-overlay.open` live on every keydown, so
    // it picks this modal up automatically once it's marked open).
    modalEl.querySelector('#sound-search-close')?.addEventListener('click', closeSoundSearchModal);
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeSoundSearchModal();
    });

    modalEl.querySelector('#sound-search-btn')?.addEventListener('click', () => performSearch(1));
    modalEl.querySelector('#sound-search-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performSearch(1);
    });

    modalEl.querySelector('#sb-crossfade-presets')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-crossfade-preset]');
        if (!btn) return;
        const input = modalEl.querySelector('#sb-crossfade-input');
        if (input) input.value = btn.dataset.crossfadePreset;
        modalEl.querySelectorAll('#sb-crossfade-presets .btn').forEach(b => {
            b.classList.remove('btn-gold');
            b.classList.add('btn-secondary');
        });
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-gold');
    });

    // Event delegation for result cards -- rebuilt on every search, so
    // listeners are bound once here rather than re-attached per render.
    modalEl.querySelector('#sound-search-results')?.addEventListener('click', (e) => {
        const previewBtn = e.target.closest('.sound-preview-btn');
        const sfxBtn = e.target.closest('.sound-add-sfx-btn');
        const ambienceBtn = e.target.closest('.sound-add-ambience-btn');
        const btn = previewBtn || sfxBtn || ambienceBtn;
        if (!btn) return;
        const sound = resultsById.get(btn.dataset.id);
        if (!sound) return;
        if (previewBtn) playPreview(sound);
        else if (sfxBtn) addSoundFromResult(sound, 'sfx');
        else if (ambienceBtn) addSoundFromResult(sound, 'ambience');
    });

    return modalEl;
}

export function openSoundSearchModal({ onChange } = {}) {
    onChangeCallback = typeof onChange === 'function' ? onChange : null;
    ensureModal();
    modalEl.classList.add('open');
    modalEl.querySelector('#sound-search-input')?.focus();
}

export function closeSoundSearchModal() {
    if (!modalEl) return;
    modalEl.classList.remove('open');
    stopPreview();
}

function stopPreview() {
    if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = '';
        previewAudio = null;
    }
}

function playPreview(sound) {
    stopPreview();
    if (!sound.preview_url) {
        showToast('No preview available for this sound.', 'error');
        return;
    }
    previewAudio = new Audio(sound.preview_url);
    previewAudio.volume = 0.6;
    previewAudio.play().catch(err => console.warn('[Sound Search] Preview blocked or failed:', err?.message));
}

// ─── Search ─────────────────────────────────────────────────────────────

async function performSearch(page) {
    if (!modalEl) return;
    const input = modalEl.querySelector('#sound-search-input');
    const resultsEl = modalEl.querySelector('#sound-search-results');
    const paginationEl = modalEl.querySelector('#sound-search-pagination');
    const query = (input?.value || '').trim();

    if (!query || query.length < 2) {
        resultsEl.innerHTML = '<p style="font-size:0.85rem;color:var(--text2);">Enter at least 2 characters.</p>';
        paginationEl.innerHTML = '';
        return;
    }

    const apiKey = getOrPromptApiKey();
    if (!apiKey) {
        resultsEl.innerHTML = '<p style="font-size:0.85rem;color:var(--text2);">A server API key is required to search sounds.</p>';
        return;
    }

    currentQuery = query;
    currentPage = page;
    stopPreview();
    resultsEl.innerHTML = '<p style="font-size:0.85rem;color:var(--text2);">Searching…</p>';
    paginationEl.innerHTML = '';

    try {
        const url = buildApiUrl(`/soundboard/search?q=${encodeURIComponent(query)}&page=${page}&page_size=20`);
        const response = await fetch(url, { headers: { 'x-api-key': apiKey } });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            // A stale/wrong stored key: drop it so the next search re-prompts
            // instead of silently failing forever.
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem(API_KEY_STORAGE);
            }
            resultsEl.innerHTML = `<p style="font-size:0.85rem;color:var(--red);">${escHtml(data.error || `Search failed (${response.status}).`)}</p>`;
            return;
        }

        const results = Array.isArray(data.results) ? data.results : [];
        resultsById = new Map(results.map(s => [String(s.id), s]));

        if (results.length === 0) {
            resultsEl.innerHTML = '<p style="font-size:0.85rem;color:var(--text2);">No results found.</p>';
            return;
        }

        resultsEl.innerHTML = results.map(renderResultCard).join('');
        renderPagination(paginationEl, data);
    } catch (err) {
        console.error('[Sound Search] Search error:', err);
        resultsEl.innerHTML = '<p style="font-size:0.85rem;color:var(--red);">Search failed. Check your connection and try again.</p>';
    }
}

function renderResultCard(sound) {
    const info = classifyLicense(sound.license);
    const duration = typeof sound.duration === 'number' ? sound.duration.toFixed(1) : '?';
    return `
        <div class="panel" style="padding:0.6rem 0.8rem;margin-top:0.5rem;">
            <div class="flex-between" style="align-items:flex-start;">
                <div style="min-width:0;flex:1;">
                    <div class="flex" style="align-items:center;">
                        <strong>${escHtml(sound.name)}</strong>
                        <span class="badge ${info.badgeClass}">${escHtml(info.label)}</span>
                    </div>
                    <div style="font-size:0.75rem;color:var(--text3);margin-top:0.15rem;">by ${escHtml(sound.username)} &middot; ${duration}s</div>
                    ${sound.description ? `<p style="font-size:0.8rem;color:var(--text2);margin-top:0.3rem;">${escHtml(sound.description)}</p>` : ''}
                </div>
                <div class="flex" style="flex-direction:column;flex-shrink:0;gap:0.3rem;">
                    <button type="button" class="btn btn-xs btn-secondary sound-preview-btn" data-id="${sound.id}">▶ Preview</button>
                    <button type="button" class="btn btn-xs btn-secondary sound-add-sfx-btn" data-id="${sound.id}">+ SFX</button>
                    <button type="button" class="btn btn-xs btn-gold sound-add-ambience-btn" data-id="${sound.id}" title="Add and crossfade in as the current ambience loop">🎵 Ambience</button>
                </div>
            </div>
        </div>
    `;
}

function renderPagination(el, data) {
    const pageSize = data.pageSize || 20;
    const count = data.count || 0;
    const totalPages = Math.max(1, Math.ceil(count / pageSize));
    el.innerHTML = `
        <button type="button" class="btn btn-xs btn-secondary" id="sb-page-prev" ${data.page <= 1 ? 'disabled' : ''}>← Prev</button>
        <span style="font-size:0.75rem;color:var(--text3);">Page ${data.page} of ${totalPages} &middot; ${count} results</span>
        <button type="button" class="btn btn-xs btn-secondary" id="sb-page-next" ${!data.hasNext ? 'disabled' : ''}>Next →</button>
    `;
    el.querySelector('#sb-page-prev')?.addEventListener('click', () => performSearch(currentPage - 1));
    el.querySelector('#sb-page-next')?.addEventListener('click', () => performSearch(currentPage + 1));
}

// ─── Adding a result to the soundboard ──────────────────────────────────

function addSoundFromResult(sound, type) {
    const info = classifyLicense(sound.license);
    const allowNonCommercial = modalEl.querySelector('#sb-filter-commercial')?.checked ?? true;
    const allowAttribution = modalEl.querySelector('#sb-filter-attribution')?.checked ?? true;

    if (!info.commercial && !allowNonCommercial) {
        showToast(`"${sound.name}" is non-commercial use only. Enable "Allow non-commercial-only sounds" to add it.`, 'warning');
        return;
    }
    if (info.attribution && !allowAttribution) {
        showToast(`"${sound.name}" requires attribution. Enable "Allow attribution-required sounds" to add it.`, 'warning');
        return;
    }
    if (!sound.preview_url) {
        showToast(`"${sound.name}" has no playable audio available.`, 'error');
        return;
    }

    const name = sound.name.replace(/\.(wav|mp3|ogg|flac|aif|aiff)$/i, '').trim() || sound.name;
    const track = addSoundTrack({ name, url: sound.preview_url, type, volume: 1 });
    if (!track) {
        showToast('Failed to add sound.', 'error');
        return;
    }

    if (info.attribution) {
        setTrackAttribution(track.id, {
            author: sound.username,
            license: info.label,
            licenseUrl: sound.license,
            url: `https://freesound.org/s/${sound.id}/`,
            title: sound.name,
        });
    }

    if (type === 'ambience') {
        const duration = parseInt(modalEl.querySelector('#sb-crossfade-input')?.value, 10) || 0;
        playAmbience(track.id, { transitionDuration: duration });
        showToast(`🎵 Crossfading to "${name}"${duration ? ` (${(duration / 1000).toFixed(1)}s)` : ' (instant)'}`, 'success');
    } else {
        playSfx(track.id);
        showToast(`Added "${name}" to soundboard.`, 'success');
    }

    onChangeCallback?.();
}

export default { openSoundSearchModal, closeSoundSearchModal };
