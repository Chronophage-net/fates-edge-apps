/**
 * VTT Core – reactive rendering functions
 * Updated for:
 * - Vertical JRPG-style roster (scrollable list)
 * - Single-click selection with highlighting
 * - Auto-populate Quick Roller from selected character
 * - Common rolls with auto-population
 * - Larger, more readable UI
 * - Avatar support
 * - Fixed attribute/skill lookup to match character data model
 * - Rich chat message rendering: Deck/Crown Spread synthesis text
 *   posted to chat renders as structured HTML.
 * - Roll event dispatching: timer-tick-request and sb-generated.
 * - REMOVED "Show full reading" toggle – all messages are shown in full.
 * - NEW: Character detail panel with full sheet (attributes, skills, talents, assets, followers).
 * - NEW: Follower chat – clicking a follower prompts for a message and sends as follower.
 * - IMPROVED: Character sheet layout now looks like a TTRPG sheet with styled blocks.
 */

import { vttStore, MAX_CONTROLLED_CHARACTERS } from '@core/vtt-store.js';
import { escHtml, getStorage, setStorage, setHtml, createElement, sanitizeHtml } from '@core/utils.js';
import { isConnectedToServer, getRoomCode, getSocketId, getConnectionMode, changeRole } from '@core/websocket.js';
import { getOutcomeColor, getOutcomeLabel, getOutcomeClass } from '@core/dice.js';
import { showToast } from '@components/Toast.js';

// ============================================================
// Configuration
// ============================================================
export const VTT_CONFIG = {
    maxChatMessages: 200,
    chatAutoScroll: true,
    presenceUpdateInterval: 5000,
    // NEW: "Read messages aloud" -- see speakNewChatMessages() below. Off by
    // default (speech is opinionated and some players will find it
    // annoying), opt-in per session via the #vtt-speak-messages checkbox.
    speakMessages: false,
};

export const SENDER_TYPES = {
    SYSTEM: 'System',
    ROLL: 'Roll',
    OOC: 'OOC',
    GM: 'GM',
    DECK: 'Deck',
};

// Updated common rolls to match character skill names (lowercase, full names)
export const COMMON_ROLLS = {
    Stealth: { attr: 'body', skill: 'stealth' },
    Investigate: { attr: 'wits', skill: 'investigation' },
    Perception: { attr: 'wits', skill: 'insight' },          // using insight for perception
    Athletics: { attr: 'body', skill: 'athletics' },
    Acrobatics: { attr: 'body', skill: 'athletics' },
    Persuasion: { attr: 'presence', skill: 'sway' },
    Deception: { attr: 'presence', skill: 'deception' },
    Insight: { attr: 'spirit', skill: 'insight' },
    Survival: { attr: 'body', skill: 'endurance' },          // using endurance for survival
    Medicine: { attr: 'wits', skill: 'medicine' },
    Arcana: { attr: 'spirit', skill: 'arcana' },
    Intimidation: { attr: 'presence', skill: 'sway' },       // using sway for intimidation
};

function trustedSanitize(html) {
    // Use global DOMPurify if available
    const purify = (typeof window !== 'undefined' && window.DOMPurify) ? window.DOMPurify : null;
    if (purify && typeof purify.sanitize === 'function') {
        return purify.sanitize(html, {
            ALLOWED_TAGS: [
                'div', 'span', 'p', 'br', 'b', 'i', 'strong', 'em', 'u',
                'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote',
                'pre', 'code', 'hr', 'a', 'img', 'table', 'thead', 'tbody',
                'tr', 'th', 'td'
            ],
            ALLOWED_ATTR: [
                'href', 'target', 'src', 'alt', 'title', 'class', 'id',
                'style', 'data-*', 'width', 'height'
            ],
            ALLOW_DATA_ATTR: true,
            ADD_ATTR: ['target'],
            FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
        });
    }
    // --- Fallback: basic strip if DOMPurify isn't loaded ---
    return String(html)
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/href\s*=\s*["']\s*javascript:/gi, 'href="#"');
}
// ============================================================
// Container & query helpers
// ============================================================
let currentContainer = null;

export function setContainer(el) {
    currentContainer = el;
}

export function q(selector) {
    if (!currentContainer) return null;
    return currentContainer.querySelector(selector);
}

export function qa(selector) {
    if (!currentContainer) return [];
    return currentContainer.querySelectorAll(selector);
}

// ============================================================
// RICH CHAT TEXT RENDERING
// ============================================================

const RICH_TEXT_ALLOWED_TAGS = ['em', 'strong', 'i', 'b'];

// Escapes everything EXCEPT the small whitelist of inline tags already
// used in region/card flavor text, so a stray "<script>" still gets
// neutered but an authored "<em>...</em>" renders as emphasis instead
// of literal "&lt;em&gt;" text.
function escapeKeepingAllowedTags(text) {
    const stashed = [];
    const tagPattern = new RegExp(`</?(?:${RICH_TEXT_ALLOWED_TAGS.join('|')})>`, 'gi');
    const withPlaceholders = String(text).replace(tagPattern, (match) => {
        stashed.push(match);
        return `\u0000${stashed.length - 1}\u0000`;
    });
    let escaped = escHtml(withPlaceholders);
    escaped = escaped.replace(/\u0000(\d+)\u0000/g, (_, i) => stashed[Number(i)]);
    return escaped;
}

// "[Label: detail text]" → a small styled callout chip, instead of
// literal square brackets sitting in the middle of a chat line.
function renderChatBracketAnnotations(html) {
    return html.replace(/\[([A-Za-z][A-Za-z ]{0,20}):\s*([^\]]+)\]/g, (match, label, detail) => `
        <span style="display:inline-block;margin:0.1rem 0.15rem 0.1rem 0;padding:0.05rem 0.45rem;background:var(--bg4);border-radius:10px;border-left:2px solid var(--gold);font-size:0.85em;">
            <strong style="color:var(--gold);">${label}:</strong> ${detail}
        </span>
    `);
}

// "**bold**" (used by Ace Effect text) → real <strong>.
function renderChatMarkdownBold(html) {
    return html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// Crown Spread / deck synthesis text always uses these emoji markers.
const CHAT_POSITION_MARKERS = ['🌱', '🏔️', '👑', '🤝', '🌟', '⏱️', '♠️'];

function looksLikeCrownSpreadText(text) {
    return CHAT_POSITION_MARKERS.filter(m => text.includes(m)).length >= 3;
}

// Splits Crown Spread synthesis text into one compact styled block per
// position/wildcard/timer/ace-effect segment.
function renderCrownSpreadChatHtml(text) {
    const splitPattern = /(?=(?:🌱|🏔️|👑|🤝|🌟|⏱️|♠️))/g;
    const rawSegments = text.split(splitPattern).map(s => s.trim()).filter(Boolean);

    return rawSegments.map(seg => {
        const marker = CHAT_POSITION_MARKERS.find(m => seg.startsWith(m));
        const rest = marker ? seg.slice(marker.length).trim() : seg;
        const colonIdx = rest.indexOf(':');
        let label = '';
        let body = rest;
        if (colonIdx > -1 && colonIdx <= 25) {
            label = rest.slice(0, colonIdx).replace(/\*\*/g, '').trim();
            body = rest.slice(colonIdx + 1).replace(/^\*\*\s*/, '').trim();
        }
        const withChips = renderChatBracketAnnotations(renderChatMarkdownBold(escapeKeepingAllowedTags(body)));
        const isHighlight = marker === '🌟' || marker === '⏱️' || marker === '♠️';

        return `
            <div style="padding:0.3rem 0.5rem;margin:0.2rem 0;border-radius:6px;background:${isHighlight ? 'var(--bg4)' : 'var(--bg2)'};border-left:2px solid ${isHighlight ? 'var(--gold)' : 'var(--border)'};">
                ${label ? `<div style="font-weight:600;color:var(--gold);font-size:0.8rem;">${marker || ''} ${escHtml(label)}</div>` : ''}
                <div style="font-size:0.85rem;line-height:1.4;">${withChips}</div>
            </div>
        `;
    }).join('');
}

/**
 * Renders a chat message's text nicely. 
 * - Trusted senders (GM, System) get full HTML sanitised – no "Show full reading" toggle.
 * - Untrusted senders get the rich text treatment (Crown Spread blocks, bracket chips, bold).
 * - Long messages are always fully shown.
 *
 * SECURITY: a message's `sender` field is just text the SENDING client put
 * in its own message body -- nothing stops a modified client from claiming
 * `sender: 'GM'` to get the more permissive HTML allowlist below. For a
 * message that came over the network, `verifiedGM` is stamped by the
 * socket server from its own authoritative role tracking for that
 * connection (see server/socketio-handlers.js and server/ws-handlers.js's
 * 'chat-message' handlers), overwriting anything the client sent -- so it
 * can't be spoofed the way the `sender` label can. `System` messages stay
 * trusted by label: they're pre-built, developer-templated cards (spell
 * casts, ace effects, X-Card notices) any client can legitimately post for
 * its own actions, not a claim of GM authority.
 */
function renderChatMessageText(rawText, sender = '', verifiedGM = false) {
    const text = String(rawText || '');
    if (!text) return '';

    const isTrusted = (sender === 'System') || (sender === 'GM' && verifiedGM === true);

    // --- Trusted senders: render full sanitised HTML ---
    if (isTrusted) {
        return trustedSanitize(text);
    }

    // --- Untrusted senders (players, etc.): use the original escaping logic ---
    const isCrown = looksLikeCrownSpreadText(text);
    if (isCrown) {
        return renderCrownSpreadChatHtml(text);
    }
    const formatted = renderChatBracketAnnotations(
        renderChatMarkdownBold(escapeKeepingAllowedTags(text))
    ).split(/\n\s*\n/).map(p => `<div style="margin:0.15rem 0;">${p.trim()}</div>`).join('');
    return sanitizeHtml(formatted);
}

// ============================================================
// Roll event dispatching helpers
// ============================================================

// Map outcome labels to machine‑friendly codes
function getOutcomeCodeFromLabel(label) {
    const map = {
        'Clean Success': 'clean',
        'Success with SB': 'success_sb',
        'Partial': 'partial',
        'Miss': 'miss'
    };
    return map[label] || 'unknown';
}

// Keep track of already‑processed roll messages to avoid duplicate events
const processedRollIds = new Set();

// ============================================================
// "Type to Speak" -- text-to-speech for chat messages
// ============================================================
// A deaf or mute player who can't (or doesn't want to) use voice chat
// still types into the same shared chat everyone else uses. That's fine
// for players who are reading the screen, but anyone in the voice call
// who ISN'T also watching chat -- driving-adjacent attention during combat,
// a low-vision player, or just someone looking at the map -- never hears
// what that player said. This opts each client into having new chat
// messages read aloud locally via the browser's built-in speechSynthesis,
// so a typed message reaches a listening player the same way a spoken one
// does. It's per-client and off by default (see VTT_CONFIG.speakMessages
// and the #vtt-speak-messages checkbox in vtt-connected.js/vtt-local.js).
const spokenMessageIds = new Set();
let hasRenderedChatOnce = false;

function speakChatMessage(sender, text) {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    // Strip markdown bold/bracket-annotation punctuation that renderChatMessageText
    // turns into styled HTML -- here we're reading the raw text, so "**bold**"
    // would otherwise be read aloud as literal asterisks.
    const spoken = String(text).replace(/\*\*/g, '').trim();
    if (!spoken) return;
    try {
        const utterance = new SpeechSynthesisUtterance(`${sender} says: ${spoken}`);
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn('[VTT] speechSynthesis failed:', e);
    }
}

// Called once per chat re-render with the messages currently being shown.
// Speaks only messages that are new since the last render, and never speaks
// the existing backlog the first time chat renders (e.g. on page load, or
// the moment the checkbox is first turned on) -- only turn-taking messages
// that arrive from then on.
function speakNewChatMessages(displayMessages) {
    const isFirstRender = !hasRenderedChatOnce;
    for (const msg of displayMessages) {
        if (!msg || !msg.id) continue;
        if (spokenMessageIds.has(msg.id)) continue;
        spokenMessageIds.add(msg.id);
        if (isFirstRender) continue;
        if (!VTT_CONFIG.speakMessages) continue;
        const sender = msg.sender || 'Unknown';
        if (sender === SENDER_TYPES.SYSTEM || sender === SENDER_TYPES.ROLL || sender === SENDER_TYPES.DECK) continue;
        speakChatMessage(sender, msg.text || '');
    }
    hasRenderedChatOnce = true;
}

// ============================================================
// Chat renderer (reactive) – with selected character display
// ============================================================
let chatUnsubscribe = null;
let selectedCharUnsubscribe = null;

export function renderChat() {
    if (!currentContainer) return;
    const chatContainer = currentContainer.querySelector('#chatMessages');
    if (!chatContainer) return;

    // NEW: Assistant GM suggestion Approve/Reject buttons (see
    // renderSuggestionDetails() below and vtt-connected.js's
    // assistant-suggestion-created/-resolved handlers, ROADMAP.md item 2
    // in fates-edge-ai-gm-bot). One delegated click listener, wired once
    // per container instance (chatContainer persists across the many
    // vttStore.subscribe re-renders below, only renderChat() itself is
    // ever re-invoked on remount) -- dispatches a DOM CustomEvent rather
    // than importing sendMessage() directly, matching this module's
    // existing 'timer-tick-request'/'sb-generated' pattern for talking
    // back to vtt-connected.js without a circular import.
    if (!chatContainer.dataset.suggestionClickWired) {
        chatContainer.dataset.suggestionClickWired = '1';
        chatContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-suggestion-action]');
            if (!btn) return;
            const id = btn.getAttribute('data-suggestion-id');
            const action = btn.getAttribute('data-suggestion-action');
            if (!id || !action) return;
            const card = btn.closest('.suggestion-card');
            if (card) card.querySelectorAll('button').forEach(b => { b.disabled = true; });
            document.dispatchEvent(new CustomEvent('assistant-suggestion-action', { detail: { id, action } }));
        });
    }

    const selectedDisplay = currentContainer.querySelector('#selected-character-display');
    if (selectedDisplay) {
        if (selectedCharUnsubscribe) selectedCharUnsubscribe();
        selectedCharUnsubscribe = vttStore.subscribe('selectedCharacterId', (id) => {
            const char = id ? vttStore.getSelectedCharacter() : null;
            if (char) {
                const avatarHtml = char.avatar
                    ? `<img src="${escHtml(char.avatar)}" alt="${escHtml(char.name)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);" />`
                    : `<span style="font-size:1.8rem;">🧑</span>`;
                selectedDisplay.innerHTML = `
                    <div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg3);padding:0.2rem 0.8rem;border-radius:20px;border:2px solid var(--gold);">
                        ${avatarHtml}
                        <span style="font-weight:700;font-size:1rem;">${escHtml(char.name)}</span>
                        <span style="font-size:0.7rem;color:var(--text2);">(selected)</span>
                        <button class="btn btn-xs btn-ghost" id="clear-selected-char" title="Deselect" style="padding:0 0.3rem;">✕</button>
                    </div>
                `;
                const clearBtn = selectedDisplay.querySelector('#clear-selected-char');
                if (clearBtn) {
                    clearBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        vttStore.selectCharacter(null);
                    });
                }
            } else {
                selectedDisplay.innerHTML = `<span style="color:var(--text3);font-size:0.9rem;">No character selected</span>`;
            }
        });
    }

    if (chatUnsubscribe) chatUnsubscribe();
    chatUnsubscribe = vttStore.subscribe('chatMessages', (messages) => {
        const allMessages = messages || [];
        const isConnected = isConnectedToServer();
        const roomCode = isConnected ? getRoomCode() : null;
        const mode = getConnectionMode ? getConnectionMode() : 'websocket';

        // --- Process new roll messages for event dispatching ---
        for (const msg of allMessages) {
            if (!msg || !msg.rollData || !msg.id) continue;
            if (processedRollIds.has(msg.id)) continue;

            const rollData = msg.rollData;
            const outcomeCode = rollData.outcomeCode || getOutcomeCodeFromLabel(rollData.outcome);

            // Auto‑tick timers on Partial or Miss
            if (outcomeCode === 'partial' || outcomeCode === 'miss') {
                document.dispatchEvent(new CustomEvent('timer-tick-request', {
                    detail: {
                        amount: 1,
                        source: 'roll',
                        rollData: rollData,
                        messageId: msg.id
                    }
                }));
            }

            // SB generation on any roll with story beats
            if (rollData.storyBeats && rollData.storyBeats > 0) {
                document.dispatchEvent(new CustomEvent('sb-generated', {
                    detail: {
                        count: rollData.storyBeats,
                        source: 'roll',
                        rollData: rollData,
                        messageId: msg.id
                    }
                }));
            }

            processedRollIds.add(msg.id);
        }

        // --- Render chat messages ---
        if (!Array.isArray(allMessages) || allMessages.length === 0) {
            setHtml(chatContainer, `
                <div class="empty-chat-state" style="padding:2rem 1rem;text-align:center;color:var(--text3);">
                    <div style="font-size:2.5rem;margin-bottom:0.5rem;">💬</div>
                    <div style="font-size:1.1rem;">No messages yet</div>
                    <div style="font-size:0.9rem;margin-top:0.3rem;">
                        ${isConnected ? `🌐 Connected to server${roomCode ? ` (${roomCode})` : ''}` : '📡 Messages stay local'}
                        <span style="color:var(--text4);margin-left:0.3rem;">via ${mode}</span>
                    </div>
                    <div style="font-size:0.8rem;margin-top:0.5rem;color:var(--text4);">
                        Type /help for commands
                    </div>
                </div>
            `);
            return;
        }

        const displayMessages = allMessages.length > VTT_CONFIG.maxChatMessages
            ? allMessages.slice(-VTT_CONFIG.maxChatMessages)
            : allMessages;

        speakNewChatMessages(displayMessages);

        let html = '';
        for (const msg of displayMessages) {
            if (!msg || typeof msg !== 'object') continue;
            const sender = msg.sender || 'Unknown';
            const text = msg.text || '';
            const time = msg.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isSystem = sender === SENDER_TYPES.SYSTEM || sender === SENDER_TYPES.ROLL;
            const isOOC = sender === SENDER_TYPES.OOC;
            const isGM = sender === SENDER_TYPES.GM;
            const isDeck = sender === SENDER_TYPES.DECK;
            const isLocal = msg.local !== false;

            let senderColor = 'var(--text)';
            if (isSystem) senderColor = 'var(--gold)';
            else if (isOOC) senderColor = 'var(--blue)';
            else if (isGM) senderColor = 'var(--red)';
            else if (isDeck) senderColor = 'var(--purple)';

            const whisper = msg.whisper ? '🔒 ' : '';
            const recipient = msg.recipient && msg.recipient !== 'all' ? ` → ${escHtml(msg.recipient)}` : '';

            let modeBadge = '';
            if (isLocal && !isConnected) {
                modeBadge = ` <span class="mode-badge local" style="font-size:0.65rem;color:var(--text3);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:10px;margin-left:0.3rem;border:1px solid var(--border);">📡 local</span>`;
            } else if (isLocal && isConnected) {
                modeBadge = ` <span class="mode-badge local-ws" style="font-size:0.65rem;color:var(--gold);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:10px;margin-left:0.3rem;border:1px solid var(--gold);">📡 local</span>`;
            } else if (!isLocal && isConnected) {
                modeBadge = ` <span class="mode-badge synced" style="font-size:0.65rem;color:var(--green);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:10px;margin-left:0.3rem;border:1px solid var(--green);">🌐 synced</span>`;
            }

            let statusIcon = '✓';
            let statusColor = 'var(--text3)';
            let statusTitle = 'Local only';
            if (msg.sent === true) {
                statusIcon = '✓✓';
                statusColor = 'var(--green)';
                statusTitle = 'Synced to server';
            } else if (msg.sent === false) {
                statusIcon = '✗';
                statusColor = 'var(--red)';
                statusTitle = 'Failed to send';
            } else if (isLocal) {
                statusIcon = '✓';
                statusColor = 'var(--text3)';
                statusTitle = 'Local only';
            } else {
                statusIcon = '✓✓';
                statusColor = 'var(--green)';
                statusTitle = 'Synced to server';
            }

            html += `
                <div class="chat-message" data-msg-id="${msg.id || ''}" style="padding:0.4rem 0.6rem;border-bottom:1px solid var(--border);font-size:1rem;transition:background 0.2s;">
                    <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        <span style="color:var(--text2);font-size:0.8rem;">${escHtml(time)}</span>
                        <strong style="color:${senderColor};font-size:1rem;">${escHtml(sender)}${recipient}:</strong>
                        <div style="word-break:break-word;font-size:1rem;flex:1 1 auto;min-width:0;">${whisper}${renderChatMessageText(text, sender, msg.verifiedGM === true)}</div>
                        ${modeBadge}
                        <span class="msg-status" style="font-size:0.7rem;color:${statusColor};margin-left:auto;" title="${statusTitle}">${statusIcon}</span>
                    </div>
                    ${msg.rollData ? renderRollDetails(msg.rollData) : ''}
                    ${msg.deckData ? renderDeckDetails(msg.deckData) : ''}
                    ${msg.suggestionData ? renderSuggestionDetails(msg.suggestionData) : ''}
                </div>
            `;
        }

        setHtml(chatContainer, html);

        if (VTT_CONFIG.chatAutoScroll) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    });
}

function renderRollDetails(rollData) {
    if (!rollData) return '';
    const diceHtml = (rollData.dice || []).map(die => {
        let bgColor = 'var(--bg4)';
        let textColor = 'var(--text)';
        let label = die;
        if (die === 10) {
            bgColor = 'var(--green)';
            textColor = 'white';
            label = '10';
        } else if (die >= 6) {
            bgColor = 'var(--green)';
            textColor = 'white';
        } else if (die === 1) {
            bgColor = 'var(--red)';
            textColor = 'white';
            label = '1⚠️';
        }
        return `<span style="display:inline-block;padding:0.05rem 0.4rem;margin:0.05rem;border-radius:4px;background:${bgColor};color:${textColor};font-size:0.8rem;">${label}</span>`;
    }).join(' ');
    
    const outcomeColor = getOutcomeColor(rollData.outcome || '');
    // FIX: getOutcomeLabel(successes, dv, storyBeats) takes three NUMBERS
    // and recomputes the label from scratch -- it does not accept an
    // already-computed label string. Calling it as
    // getOutcomeLabel(rollData.outcome || '') passed the outcome STRING
    // (e.g. "Clean Success") as `successes` with `dv`/`storyBeats`
    // undefined, so every comparison inside it (`"Clean Success" >=
    // undefined`, `"Clean Success" > 0`) evaluated to false via NaN and
    // it fell through to the final `else` branch every single time --
    // rendering "Miss" on the card no matter what the roll actually was.
    // rollData.outcome is already the resolved label from the server
    // (see modules/dice.js's determineOutcome()); just use it directly.
    const outcomeLabel = rollData.outcome || getOutcomeLabel(rollData.successes || 0, rollData.dv || 0, rollData.storyBeats || 0);
    const outcomeClass = getOutcomeClass(rollData.outcome || '');
    
    return `
        <div style="margin-top:0.3rem;padding:0.3rem 0.5rem;background:var(--bg2);border-radius:6px;font-size:0.85rem;">
            <div style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;">
                <span class="outcome-tag ${outcomeClass}" style="padding:0.1rem 0.8rem;border-radius:20px;font-weight:700;background:${outcomeColor};color:white;font-size:0.9rem;">${outcomeLabel}</span>
                <span>🎲 ${diceHtml}</span>
                <span style="color:var(--text3);">S:${rollData.successes || 0} SB:${rollData.storyBeats || 0}</span>
            </div>
        </div>
    `;
}

function renderDeckDetails(deckData) {
    if (!deckData) return '';
    const cards = deckData.cards || [];
    const cardNames = cards.map(c => 
        c.is_joker ? '🃏 Joker' : `${c.rank_name || c.rank} of ${c.suit_name || c.suit}`
    ).join(', ');
    
    return `
        <div style="margin-top:0.3rem;padding:0.3rem 0.5rem;background:var(--bg2);border-radius:6px;font-size:0.85rem;color:var(--text3);">
            <span>🃏 ${cardNames}</span>
            ${deckData.remaining !== undefined ? `<span style="margin-left:0.5rem;">Remaining: ${deckData.remaining}</span>` : ''}
        </div>
    `;
}

// NEW: Assistant GM suggestion card (fates-edge-ai-gm-bot's
// assistant-suggestion-created/-resolved events -- see ROADMAP.md item 2
// and this file's renderChat() for the click-delegation wiring). `status`
// is 'pending' | 'approved' | 'rejected' | 'auto-rejected' -- only
// 'pending' shows live buttons; the other three are terminal, rendered as
// a plain outcome line so the card stays in the chat log as a record of
// what happened instead of disappearing.
function renderSuggestionDetails(suggestionData) {
    if (!suggestionData) return '';
    const { id, kind, preview, status = 'pending' } = suggestionData;
    const kindLabel = escHtml(kind || 'suggestion');
    const previewHtml = preview ? `<div style="margin-top:0.2rem;white-space:pre-wrap;">${escHtml(preview)}</div>` : '';

    if (status !== 'pending') {
        const outcomeLabel = { approved: '✅ Approved', rejected: '🗑️ Rejected', 'auto-rejected': '🗑️ Auto-rejected (another option was approved)' }[status] || status;
        return `
            <div class="suggestion-card" style="margin-top:0.3rem;padding:0.4rem 0.6rem;background:var(--bg2);border-radius:6px;font-size:0.85rem;color:var(--text3);">
                <span class="outcome-tag" style="font-weight:600;">${outcomeLabel}</span>
                <span style="margin-left:0.4rem;color:var(--text4);">[${kindLabel}]</span>
                ${previewHtml}
            </div>
        `;
    }

    return `
        <div class="suggestion-card" style="margin-top:0.3rem;padding:0.4rem 0.6rem;background:var(--bg2);border-radius:6px;border:1px solid var(--gold);font-size:0.85rem;">
            <div><span style="color:var(--text4);">[${kindLabel}]</span> pending GM approval</div>
            ${previewHtml}
            <div style="margin-top:0.4rem;display:flex;gap:0.4rem;">
                <button class="btn btn-xs" data-suggestion-id="${escHtml(id)}" data-suggestion-action="approve" style="color:var(--green);border-color:var(--green);">✅ Approve</button>
                <button class="btn btn-xs" data-suggestion-id="${escHtml(id)}" data-suggestion-action="reject" style="color:var(--red);border-color:var(--red);">🗑️ Reject</button>
            </div>
        </div>
    `;
}

// ============================================================
// Party Status – Vertical JRPG-style roster (scrollable list)
// with expanded detail panel – NOW with a TTRPG-style sheet
// ============================================================
let charUnsubscribe = null;
let detailUnsubscribe = null;

export function renderVTTChars() {
    if (!currentContainer) return;
    const grid = currentContainer.querySelector('#vttCharGrid');
    if (!grid) return;

    const detailContainer = currentContainer.querySelector('#vtt-char-detail');
    if (!detailContainer) return;

    // Clean up old subscriptions
    if (charUnsubscribe) charUnsubscribe();
    if (detailUnsubscribe) detailUnsubscribe();

    // Subscribe to characters list
    charUnsubscribe = vttStore.subscribe('characters', (chars) => {
        const vttChars = chars.filter(c => c.vtt !== false);
        const selectedId = vttStore.getSelectedCharacterId();

        if (vttChars.length === 0) {
            setHtml(grid, `<div style="text-align:center;padding:1.5rem;color:var(--text3);font-size:1.1rem;">👤 No VTT characters</div>`);
            setHtml(detailContainer, '');
            return;
        }

        let html = `<div style="display:flex;flex-direction:column;gap:0.4rem;">`;
        for (const char of vttChars) {
            const name = char.name || 'Unnamed';
            const harm = char.harm || 0;
            const fatigue = char.fatigue || 0;
            const boons = char.boons || 0;
            const tier = char.tier || 1;
            const isSelected = char.id === selectedId;

            const avatarHtml = char.avatar
                ? `<img src="${escHtml(char.avatar)}" alt="${escHtml(name)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid ${isSelected ? 'var(--gold)' : 'var(--border)'};flex-shrink:0;" />`
                : `<span style="font-size:1.6rem;flex-shrink:0;">🧑</span>`;

            html += `
                <div class="vtt-char-card" data-char-id="${char.id}" style="
                    display:flex;
                    align-items:center;
                    gap:0.8rem;
                    background:var(--bg3);
                    border-radius:var(--radius);
                    padding:0.4rem 0.8rem;
                    border:2px solid ${isSelected ? 'var(--gold)' : 'var(--border)'};
                    box-shadow: ${isSelected ? '0 0 12px rgba(212,175,55,0.4)' : 'none'};
                    transition:all 0.2s;
                    cursor:pointer;
                ">
                    ${avatarHtml}
                    <div style="display:flex;flex-direction:column;justify-content:center;flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                            <span style="font-weight:700;font-size:1rem;">${escHtml(name)}</span>
                            <span style="font-size:0.65rem;color:var(--text3);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:12px;">T${tier}</span>
                            ${isSelected ? `<span style="font-size:0.65rem;color:var(--gold);font-weight:600;">👑 Selected</span>` : ''}
                        </div>
                        <div style="display:flex;gap:0.8rem;font-size:0.85rem;color:var(--text2);margin-top:0.1rem;">
                            <span>❤️ ${harm}</span>
                            <span>⚡ ${fatigue}</span>
                            <span>🎲 ${boons}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
        setHtml(grid, html);

        // Click handler for character cards
        grid.querySelectorAll('.vtt-char-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const id = card.dataset.charId;
                if (id) {
                    // Toggle selection: if already selected, deselect; else select
                    const current = vttStore.getSelectedCharacterId();
                    if (current === id) {
                        vttStore.selectCharacter(null);
                    } else {
                        vttStore.selectCharacter(id);
                    }
                }
            });
        });
    });

    // Subscribe to selected character for detail panel – redesigned TTRPG sheet
    detailUnsubscribe = vttStore.subscribe('selectedCharacterId', (id) => {
        if (!id) {
            setHtml(detailContainer, '');
            return;
        }
        const char = vttStore.getSelectedCharacter();
        if (!char) {
            setHtml(detailContainer, '');
            return;
        }

        // Normalise attribute keys: we expect 'body', 'wits', 'spirit', 'presence' or capitalized
        const attrs = char.attributes || {};
        const skillObj = char.skills || {};
        const talents = char.talents || [];
        const assets = char.assets || [];
        const followers = char.followers || [];

        // Helper to get attribute value with fallback
        const getAttr = (key) => {
            const lowerKey = key.toLowerCase();
            const foundKey = Object.keys(attrs).find(k => k.toLowerCase() === lowerKey);
            return foundKey ? attrs[foundKey] : 1;
        };

        // Build attribute blocks
        const attrKeys = ['Body', 'Wits', 'Spirit', 'Presence'];
        const attrEmojis = { 'Body': '💪', 'Wits': '🧠', 'Spirit': '✨', 'Presence': '👑' };
        const attrBlocks = attrKeys.map(key => {
            const val = getAttr(key);
            return `
                <div style="
                    display:flex;
                    flex-direction:column;
                    align-items:center;
                    background:var(--bg3);
                    border-radius:6px;
                    padding:0.3rem 0.6rem;
                    border:1px solid var(--border);
                    flex:1;
                ">
                    <span style="font-size:0.6rem;color:var(--text3);text-transform:uppercase;">${key}</span>
                    <span style="font-size:1.2rem;font-weight:700;color:var(--gold);">${val}</span>
                </div>
            `;
        }).join('');

        // Skills – build a compact grid
        let skillsHtml = '';
        if (Object.keys(skillObj).length) {
            const skillEntries = Object.entries(skillObj)
                .filter(([k, v]) => v > 0) // show only skills with ranks > 0
                .sort((a, b) => b[1] - a[1]); // sort by rank descending
            if (skillEntries.length) {
                skillsHtml = `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.2rem 0.8rem;font-size:0.75rem;">
                        ${skillEntries.map(([k, v]) => `
                            <div style="display:flex;justify-content:space-between;border-bottom:1px dotted var(--border);padding:0.05rem 0;">
                                <span>${escHtml(k)}</span>
                                <span style="color:var(--gold);font-weight:600;">${v}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                skillsHtml = `<div style="color:var(--text3);font-size:0.75rem;">No skills ranked</div>`;
            }
        } else {
            skillsHtml = `<div style="color:var(--text3);font-size:0.75rem;">No skills</div>`;
        }

        // Talents, Assets, Followers as compact lists
        const renderList = (items, label) => {
            if (!items || items.length === 0) return '';
            const listItems = items.map(item => {
                const name = typeof item === 'string' ? item : (item.name || 'Unnamed');
                return `<span style="
                    display:inline-block;
                    background:var(--bg4);
                    border-radius:12px;
                    padding:0.05rem 0.5rem;
                    font-size:0.7rem;
                    margin:0.1rem 0.2rem 0.1rem 0;
                    border:1px solid var(--border);
                    color:var(--text2);
                ">${escHtml(name)}</span>`;
            }).join('');
            return `
                <div style="margin-top:0.4rem;">
                    <span style="font-weight:600;font-size:0.7rem;color:var(--text3);text-transform:uppercase;">${label}</span>
                    <div style="display:flex;flex-wrap:wrap;margin-top:0.2rem;">${listItems}</div>
                </div>
            `;
        };

        // Followers – clickable chips with a special class
        let followersHtml = '';
        if (followers && followers.length) {
            const followerItems = followers.map(f => {
                const name = f.name || 'Unnamed';
                return `<button class="btn btn-xs btn-secondary vtt-follower-btn" 
                                data-char="${escHtml(char.name)}" 
                                data-follower="${escHtml(name)}"
                                style="
                                    display:inline-block;
                                    background:var(--bg4);
                                    border-radius:12px;
                                    padding:0.05rem 0.6rem;
                                    font-size:0.7rem;
                                    margin:0.1rem 0.2rem 0.1rem 0;
                                    border:1px solid var(--gold);
                                    color:var(--gold);
                                    cursor:pointer;
                                    transition:all 0.2s;
                                "
                                onmouseover="this.style.background='var(--gold)'; this.style.color='#1a1400';"
                                onmouseout="this.style.background='var(--bg4)'; this.style.color='var(--gold)';"
                            >💬 ${escHtml(name)}</button>`;
            }).join('');
            followersHtml = `
                <div style="margin-top:0.4rem;">
                    <span style="font-weight:600;font-size:0.7rem;color:var(--text3);text-transform:uppercase;">Followers</span>
                    <div style="display:flex;flex-wrap:wrap;margin-top:0.2rem;">${followerItems}</div>
                </div>
            `;
        }

        // Build the full sheet
        let detailHtml = `
            <div style="
                margin-top:0.8rem;
                padding:0.8rem;
                background:var(--bg2);
                border-radius:var(--radius);
                border:1px solid var(--gold);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ">
                <!-- Header -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;border-bottom:2px solid var(--gold);padding-bottom:0.3rem;">
                    <div>
                        <span style="font-size:1.2rem;font-weight:700;color:var(--gold);">${escHtml(char.name)}</span>
                        <span style="font-size:0.7rem;color:var(--text3);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:12px;margin-left:0.5rem;">Tier ${char.tier || 1}</span>
                    </div>
                    <button class="btn btn-xs btn-ghost" id="vtt-close-detail" style="font-size:1rem;padding:0.1rem 0.4rem;">✕</button>
                </div>

                <!-- Attributes -->
                <div style="display:flex;gap:0.3rem;margin-bottom:0.5rem;">
                    ${attrBlocks}
                </div>

                <!-- Skills -->
                <div style="margin-top:0.3rem;">
                    <div style="font-weight:600;font-size:0.7rem;color:var(--text3);text-transform:uppercase;margin-bottom:0.2rem;">Skills</div>
                    ${skillsHtml}
                </div>

                <!-- Talents & Assets -->
                ${renderList(talents, 'Talents')}
                ${renderList(assets, 'Assets')}

                <!-- Followers -->
                ${followersHtml}
            </div>
        `;
        setHtml(detailContainer, detailHtml);

        // Close detail button
        const closeBtn = detailContainer.querySelector('#vtt-close-detail');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                vttStore.selectCharacter(null);
            });
        }

        // Follower chat buttons (use event delegation or re-attach)
        detailContainer.querySelectorAll('.vtt-follower-btn').forEach(btn => {
            // Remove any old listener to avoid duplicates (if any)
            btn.removeEventListener('click', followerClickHandler);
            btn.addEventListener('click', followerClickHandler);
        });
    });
}

// Separate handler for follower clicks to avoid duplication
function followerClickHandler(e) {
    const btn = e.currentTarget;
    const charName = btn.dataset.char;
    const followerName = btn.dataset.follower;
    const message = window.prompt(`What does ${followerName} say?`, '');
    if (message && message.trim()) {
        document.dispatchEvent(new CustomEvent('follower-chat', {
            detail: { characterName: charName, followerName, message: message.trim() }
        }));
    }
}

// ============================================================
// Auto-populate Quick Roller from selected character
// ============================================================
let rollerPopulateUnsubscribe = null;

/**
 * Populate the roller inputs with the selected character's stats.
 * Attributes are stored directly on the character (e.g., char.body, char.wits).
 * Skills are stored in char.skills (e.g., char.skills.melee).
 */
function populateRollerFromSelected(char) {
    if (!char) return;
    const attrSelect = q('#vtt-attr');
    const skillSelect = q('#vtt-skill');
    const boonsInput = q('#vtt-boons');
    if (attrSelect) {
        attrSelect.value = char.body ?? 3;
    }
    if (skillSelect) {
        skillSelect.value = 0;
    }
    if (boonsInput) {
        boonsInput.value = char.boons ?? 0;
    }
}

export function initRollerAutoPopulate() {
    if (rollerPopulateUnsubscribe) return;
    rollerPopulateUnsubscribe = vttStore.subscribe('selectedCharacterId', (id) => {
        const char = id ? vttStore.getSelectedCharacter() : null;
        if (char) {
            populateRollerFromSelected(char);
        }
    });
}

// ============================================================
// Common Rolls Renderer
// ============================================================
let commonRollsUnsubscribe = null;

export function renderCommonRolls() {
    if (!currentContainer) return;
    const container = currentContainer.querySelector('#vtt-common-rolls');
    if (!container) return;

    initRollerAutoPopulate();

    if (commonRollsUnsubscribe) commonRollsUnsubscribe();
    commonRollsUnsubscribe = vttStore.subscribe('selectedCharacterId', (id) => {
        const char = id ? vttStore.getSelectedCharacter() : null;
        if (!char) {
            setHtml(container, `<span style="color:var(--text3);font-size:0.9rem;">Select a character to use common rolls.</span>`);
            return;
        }

        let html = `<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.4rem;">`;
        for (const [label, config] of Object.entries(COMMON_ROLLS)) {
            const attrVal = char[config.attr] ?? 3;
            const skillVal = char.skills?.[config.skill] ?? 0;
            html += `
                <button class="btn btn-sm btn-secondary common-roll-btn" 
                        data-attr="${attrVal}" 
                        data-skill="${skillVal}"
                        data-label="${label}"
                        style="font-size:0.8rem;padding:0.1rem 0.6rem;">
                    ${label} (${attrVal}+${skillVal})
                </button>
            `;
        }
        html += `</div>`;
        setHtml(container, html);

        container.querySelectorAll('.common-roll-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const attr = parseInt(btn.dataset.attr, 10) || 3;
                const skill = parseInt(btn.dataset.skill, 10) || 0;
                const label = btn.dataset.label;
                const attrSelect = q('#vtt-attr');
                const skillSelect = q('#vtt-skill');
                if (attrSelect) attrSelect.value = attr;
                if (skillSelect) skillSelect.value = skill;
                const boonsInput = q('#vtt-boons');
                if (boonsInput && char) {
                    boonsInput.value = char.boons || 0;
                }
                const output = q('#vtt-roll-output');
                if (output) {
                    output.innerHTML = `<span style="color:var(--text2);">⚡ ${label} prepared (Attr ${attr} + Skill ${skill})</span>`;
                }
                const rollerPanel = q('.vtt-panel:has(#vtt-roll-output)');
                if (rollerPanel) rollerPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });
    });
}

// ============================================================
// Timers (reactive)
// ============================================================
let timerUnsubscribe = null;

export function renderVTTTimers() {
    if (!currentContainer) return;
    const list = currentContainer.querySelector('#vttTimerList');
    if (!list) return;

    if (timerUnsubscribe) timerUnsubscribe();
    timerUnsubscribe = vttStore.subscribe('timers', (timers) => {
        if (!timers || timers.length === 0) {
            setHtml(list, `<div class="empty-state" style="text-align:center;padding:0.8rem;color:var(--text3);font-size:0.9rem;">⏱️ No active timers</div>`);
            return;
        }
        let html = '';
        for (const timer of timers) {
            const name = timer.name || 'Timer';
            const current = timer.current || 0;
            const segments = timer.segments || 1;
            const progress = segments > 0 ? Math.min((current / segments) * 100, 100) : 0;
            const isComplete = progress >= 100;
            html += `
                <div class="vtt-timer" style="margin-bottom:0.4rem;background:var(--bg3);border-radius:6px;padding:0.4rem 0.6rem;${isComplete ? 'border:1px solid var(--red);' : ''}">
                    <div style="display:flex;justify-content:space-between;font-size:0.9rem;">
                        <span style="font-weight:600;">${escHtml(name)}</span>
                        <span>${current}/${segments} ${isComplete ? '✅' : ''}</span>
                    </div>
                    <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;margin-top:4px;overflow:hidden;">
                        <div style="width:${progress}%;height:100%;background:${isComplete ? 'var(--red)' : 'var(--gold)'};border-radius:3px;transition:width 0.3s;"></div>
                    </div>
                </div>
            `;
        }
        setHtml(list, html);
    });
}

// ============================================================
// Presence (reactive with WebSocket integration)
// ============================================================
let presenceUnsubscribe = null;

export function renderLocalPresence() {
    if (!currentContainer) return;
    const presenceList = currentContainer.querySelector('#presence-list');
    if (!presenceList) return;

    let presenceUnsub = null;
    let charUnsub = null;

    function renderPresence() {
        const presence = vttStore.state.presence || [];
        const characters = vttStore.state.characters || [];
        const isConnected = isConnectedToServer();
        const roomCode = isConnected ? getRoomCode() : null;
        const socketId = isConnected ? getSocketId() : null;
        const showAvatars = getStorage('fates-edge-show-avatars', 'true') !== 'false';

        if (!presence || presence.length === 0) {
            setHtml(presenceList, `
                <details class="vtt-presence-details" style="margin-top:0.2rem;">
                    <summary style="cursor:pointer;font-weight:600;color:var(--text2);font-size:0.9rem;">👥 Party Members</summary>
                    <div style="color:var(--text3);padding:0.4rem 0;font-size:0.9rem;">
                        ${isConnected ? '🌐 Connected, no other players' : '📡 Local mode'}
                        ${roomCode ? ` (${roomCode})` : ''}
                    </div>
                </details>
            `);
            return;
        }

        const myId = socketId;
        // NEW: role-assignment picker. Gated on the LIVE presence role for
        // this connection, not localStorage's isGmLikeRole() -- the server
        // enforces role changes with a strict `=== 'gm'` check
        // (canManageGmSeat(), see room.js/ROLES.md), Co-GM cannot promote
        // anyone, so the picker must match that exactly rather than the
        // broader "GM-like" UI-visibility helper used elsewhere.
        const myPresence = presence.find(p => p.id === myId);
        const iAmGm = myPresence?.role === 'gm';
        const ROLE_LABELS = { 'co-gm': 'Co-GM', 'assistant-gm': 'Assistant GM', player: 'Player', spectator: 'Spectator', gm: 'GM' };
        let membersHtml = '';
        for (const p of presence) {
            const isSelf = p.id === myId;
            const isOnline = p.online !== false;
            const playerName = p.name || 'Unknown';
            const role = p.role || 'player';

            const roleBadge = role === 'gm'
                ? `<span style="font-size:0.55rem;background:var(--gold);color:#1a1400;padding:0.05rem 0.4rem;border-radius:8px;font-weight:600;">GM</span>`
                : `<span style="font-size:0.55rem;background:var(--bg4);color:var(--text3);padding:0.05rem 0.4rem;border-radius:8px;" title="${escHtml(ROLE_LABELS[role] || role)}">${escHtml(ROLE_LABELS[role] || role)}</span>`;

            // Role-assignment control -- visible to the GM only, never on
            // the GM's own row (the GM seat itself changes via Resign/
            // Request GM, not this picker; see room.js's
            // handleRoleChangeRequest which rejects target.role === 'gm'
            // through this path regardless).
            const roleControlHtml = (iAmGm && !isSelf && role !== 'gm') ? `
                <span class="vtt-role-control" style="display:inline-flex;align-items:center;gap:0.25rem;" data-client-id="${p.id}">
                    <select class="vtt-role-select" data-client-id="${p.id}" title="Assign a role" style="font-size:0.7rem;padding:0.05rem 0.2rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);">
                        <option value="co-gm" ${role === 'co-gm' ? 'selected' : ''}>Co-GM</option>
                        <option value="assistant-gm" ${role === 'assistant-gm' ? 'selected' : ''}>Assistant GM</option>
                        <option value="player" ${role === 'player' ? 'selected' : ''}>Player</option>
                        <option value="spectator" ${role === 'spectator' ? 'selected' : ''}>Spectator</option>
                    </select>
                    <label style="display:flex;align-items:center;gap:0.1rem;font-size:0.6rem;color:var(--text3);white-space:nowrap;cursor:pointer;" title="Persist this grant across reconnects (demotions always persist)">
                        <input type="checkbox" class="vtt-role-persist" data-client-id="${p.id}" style="margin:0;" /> save
                    </label>
                    <button class="btn btn-xs btn-primary vtt-role-apply" data-client-id="${p.id}" style="font-size:0.65rem;padding:0.05rem 0.4rem;">Set</button>
                </span>
            ` : '';

            const avatarUrl = showAvatars
                ? p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(playerName)}&size=32&background=2c3e50&color=fff`
                : '';

            let charDisplayHtml = '';
            const isRemoteEnabled = getStorage('fates-edge-remote-enabled', 'false') === 'true';
            if (isSelf) {
                const currentChar = p.selectedCharacter || '';
                const currentChars = Array.isArray(p.selectedCharacters) ? p.selectedCharacters : (currentChar ? [currentChar] : []);
                if (characters.length > 0) {
                    // "Remote enabled" lets one client drive more than one
                    // character at once (up to MAX_CONTROLLED_CHARACTERS) --
                    // a full party on one client, or a GM running several
                    // NPCs. Off by default: a plain single-choice <select>,
                    // unchanged from before. On: a native multi-select, which
                    // gets ctrl/cmd-click (desktop) or tap-to-toggle (most
                    // mobile browsers) for free with no custom widget needed.
                    const selector = isRemoteEnabled
                        ? `<select class="vtt-char-select" multiple size="${Math.min(Math.max(characters.length, 2), MAX_CONTROLLED_CHARACTERS)}" data-client-id="${p.id}" title="Up to ${MAX_CONTROLLED_CHARACTERS} characters (ctrl/cmd-click to select more than one)" style="font-size:0.75rem;padding:0.15rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);max-width:140px;">
                                ${characters.map(c => `<option value="${escHtml(c.name)}" ${currentChars.includes(c.name) ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
                            </select>`
                        : `<select class="vtt-char-select" data-client-id="${p.id}" style="font-size:0.75rem;padding:0.05rem 0.3rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);max-width:120px;">
                                <option value="">— Select —</option>
                                ${characters.map(c => `<option value="${escHtml(c.name)}" ${c.name === currentChar ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
                            </select>`;
                    charDisplayHtml = `
                        <label style="display:flex;align-items:center;gap:0.2rem;font-size:0.65rem;color:var(--text3);white-space:nowrap;cursor:pointer;" title="Allow this client to control more than one character at once">
                            <input type="checkbox" class="vtt-remote-toggle" ${isRemoteEnabled ? 'checked' : ''} style="margin:0;" />
                            Remote
                        </label>
                        ${selector}
                    `;
                } else {
                    charDisplayHtml = `
                        <span style="font-size:0.75rem;color:var(--text3);white-space:nowrap;">No characters</span>
                        <button class="btn btn-xs btn-primary" onclick="window.location.hash='characters'" style="font-size:0.6rem;padding:0.05rem 0.4rem;white-space:nowrap;">+ Create</button>
                    `;
                }
            } else {
                const otherChars = Array.isArray(p.selectedCharacters) && p.selectedCharacters.length > 0
                    ? p.selectedCharacters
                    : (p.selectedCharacter ? [p.selectedCharacter] : []);
                charDisplayHtml = otherChars.length > 0
                    ? `<span style="font-size:0.75rem;color:var(--text2);white-space:nowrap;">🎭 ${escHtml(otherChars.join(', '))}</span>`
                    : `<span style="font-size:0.75rem;color:var(--text3);white-space:nowrap;">No character selected</span>`;
            }

            membersHtml += `
                <div class="presence-item" style="display:flex;flex-wrap:wrap;align-items:center;gap:0.6rem;padding:0.25rem 0;border-bottom:1px solid var(--border);${isSelf ? 'background:var(--bg4);border-radius:6px;padding:0.25rem 0.6rem;' : ''}">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${isOnline ? 'var(--green)' : 'var(--text3)'};flex-shrink:0;" title="${isOnline ? 'Online' : 'Offline'}"></span>
                    ${showAvatars ? `<img src="${escHtml(avatarUrl)}" alt="${escHtml(playerName)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22 viewBox=%220 0 32 32%22%3E%3Crect fill=%22%232c3e50%22 width=%2232%22 height=%2232%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.35em%22 fill=%22%23fff%22 font-family=%22Arial%22 font-size=%2214%22%3E${encodeURIComponent(playerName.charAt(0))}%3C/text%3E%3C/svg%3E'" />` : ''}
                    <span style="font-weight:${isSelf ? '600' : '400'};font-size:0.9rem;white-space:nowrap;">${escHtml(playerName)}${isSelf ? ' (you)' : ''}</span>
                    ${roleBadge}
                    ${roleControlHtml}
                    <span style="flex:1;text-align:right;display:flex;justify-content:flex-end;align-items:center;gap:0.4rem;font-size:0.85rem;">
                        <span style="color:var(--text3);">Character:</span>
                        ${charDisplayHtml}
                    </span>
                </div>
            `;
        }

        const total = presence.length;
        const html = `
            <details class="vtt-presence-details" style="margin-top:0.2rem;" open>
                <summary style="cursor:pointer;font-weight:600;color:var(--text2);font-size:0.9rem;display:flex;align-items:center;gap:0.5rem;">
                    👥 Party Members
                    <span style="font-size:0.65rem;font-weight:400;color:var(--text3);">(${total} online)</span>
                </summary>
                <div style="margin-top:0.4rem;">
                    ${membersHtml}
                </div>
            </details>
        `;
        setHtml(presenceList, html);

        presenceList.querySelectorAll('.vtt-char-select').forEach(select => {
            select.removeEventListener('change', handleCharSelect);
            select.addEventListener('change', handleCharSelect);
        });
        presenceList.querySelectorAll('.vtt-remote-toggle').forEach(toggle => {
            toggle.removeEventListener('change', handleRemoteToggle);
            toggle.addEventListener('change', handleRemoteToggle);
        });
        presenceList.querySelectorAll('.vtt-role-apply').forEach(btn => {
            btn.removeEventListener('click', handleRoleApply);
            btn.addEventListener('click', handleRoleApply);
        });
    }

    if (presenceUnsub) presenceUnsub();
    if (charUnsub) charUnsub();

    presenceUnsub = vttStore.subscribe('presence', renderPresence);
    charUnsub = vttStore.subscribe('characters', renderPresence);

    renderPresence();
}

// Separate handler for character selection. Works for both the plain
// single-choice <select> (Remote off) and the multi-select <select
// multiple> (Remote on) -- vtt-connected.js's sendCharacterSelection()
// accepts either a single name or an array.
function handleCharSelect(e) {
    const select = e.target;
    let selection;
    if (select.multiple) {
        selection = Array.from(select.selectedOptions).map(o => o.value).filter(Boolean);
        if (selection.length > MAX_CONTROLLED_CHARACTERS) {
            showToast(`You can only control up to ${MAX_CONTROLLED_CHARACTERS} characters at once.`, 'warning');
            selection = selection.slice(0, MAX_CONTROLLED_CHARACTERS);
            // Reflect the trim back into the widget itself, since the
            // browser already applied the user's (over-)selection.
            Array.from(select.options).forEach(o => { o.selected = selection.includes(o.value); });
        }
    } else {
        selection = select.value;
    }
    if (window.__vttConnected && window.__vttConnected.sendCharacterSelection) {
        window.__vttConnected.sendCharacterSelection(selection);
    } else {
        import('./vtt-connected.js').then(module => {
            if (module.sendCharacterSelection) {
                module.sendCharacterSelection(selection);
            }
        });
    }
}

// "Remote enabled" checkbox: toggles between single-choice and
// multi-select character control for this client, persisted so it
// survives a reload.
function handleRemoteToggle(e) {
    const enabled = !!e.target.checked;
    setStorage('fates-edge-remote-enabled', enabled ? 'true' : 'false');
    vttStore.setRemoteEnabled(enabled);
    // Re-render immediately so the select widget swaps single/multi right
    // away instead of waiting for the next unrelated presence update.
    const presence = vttStore.state.presence || [];
    vttStore.updatePresence([...presence]);
}

// "Set" button next to a party member's role picker (GM only, see the
// roleControlHtml block in renderPresence() above). Reads the paired
// <select>/checkbox for the same data-client-id and sends a
// role_change_request over the live connection. No optimistic local
// state update -- the server has final say (GM-only, checked against
// THIS connection's own live role, not anything sent here), and the
// resulting 'role_update' broadcast (see vtt-connected.js's
// roleUpdateHandler) is what actually updates presence and re-renders
// this list, whether the change came from here, from another VTT
// integration (Discord/Foundry/Roll20), or from the REST admin API.
function handleRoleApply(e) {
    const btn = e.currentTarget;
    const clientId = btn.dataset.clientId;
    if (!clientId) return;
    const control = btn.closest('.vtt-role-control');
    if (!control) return;
    const select = control.querySelector('.vtt-role-select');
    const persistBox = control.querySelector('.vtt-role-persist');
    const role = select?.value;
    const persist = !!persistBox?.checked;
    if (!role) return;
    if (!isConnectedToServer()) {
        showToast('Not connected to server.', 'error');
        return;
    }
    const ROLE_LABELS = { 'co-gm': 'Co-GM', 'assistant-gm': 'Assistant GM', player: 'Player', spectator: 'Spectator' };
    const ok = changeRole(clientId, role, persist);
    if (ok) {
        showToast(`Requested: role → ${ROLE_LABELS[role] || role}${persist ? ' (saved)' : ''}.`, 'info');
    } else {
        showToast('Failed to send role change -- check your connection.', 'error');
    }
}

// ============================================================
// Voice Clients (reactive)
// ============================================================
let voiceUnsubscribe = null;

export function renderVoiceClients() {
    if (!currentContainer) return;
    const listEl = currentContainer.querySelector('#voice-clients-list');
    const countEl = currentContainer.querySelector('#voice-clients-count');
    if (!listEl || !countEl) return;

    if (voiceUnsubscribe) voiceUnsubscribe();
    voiceUnsubscribe = vttStore.subscribe('voiceClients', (clients) => {
        countEl.textContent = `${clients.length} voice user${clients.length !== 1 ? 's' : ''}`;
        if (!clients || clients.length === 0) {
            setHtml(listEl, `<span style="color:var(--text3);font-size:0.85rem;">No other voice clients.</span>`);
            return;
        }
        let html = '';
        for (const client of clients) {
            const isSpeaking = client.speaking ? 'var(--gold)' : 'var(--bg3)';
            const state = client.connectionState || 'idle';
            let statusLabel = '';
            let statusColor = 'var(--text3)';
            let callButton = '';
            switch (state) {
                case 'connected':
                    statusLabel = '🔗 Connected';
                    statusColor = 'var(--green)';
                    break;
                case 'connecting':
                    statusLabel = '⏳ Connecting...';
                    statusColor = 'var(--gold)';
                    break;
                case 'failed':
                    statusLabel = '❌ Failed';
                    statusColor = 'var(--red)';
                    break;
                default:
                    statusLabel = '📡 Idle';
                    break;
            }
            if (state !== 'connected' && state !== 'connecting') {
                callButton = `<button class="btn btn-sm btn-primary voice-call-btn" data-client-id="${client.id}" style="font-size:0.7rem;padding:0.1rem 0.6rem;">📞 Call</button>`;
            } else if (state === 'connected') {
                callButton = `<span style="font-size:0.7rem;color:var(--green);">● Live</span>`;
            }
            // Speaking is conveyed three ways, not just the color dot: a
            // visible 🔊 icon (so it's not color-only for colorblind users)
            // and an sr-only text suffix on the name (so it's discoverable
            // by screen readers browsing this roster) -- deliberately NOT
            // pushed through the aria-live announcer, since mic activity
            // toggles many times a second and would be pure noise there.
            const speakingNow = isSpeaking === 'var(--gold)';
            html += `
                <span class="voice-client-badge" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.3rem 0.8rem;border-radius:20px;background:var(--bg4);font-size:0.85rem;border:1px solid var(--border);">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${isSpeaking};transition:background 0.3s;" aria-hidden="true"></span>
                    <span style="font-weight:500;">${escHtml(client.name)}${speakingNow ? ' <span aria-hidden="true" title="Speaking">🔊</span>' : ''}<span class="sr-only">${speakingNow ? ', speaking' : ''}</span></span>
                    <span style="font-size:0.7rem;color:${statusColor};">${statusLabel}</span>
                    ${callButton}
                </span>
            `;
        }
        setHtml(listEl, html);

        listEl.querySelectorAll('.voice-call-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const clientId = btn.dataset.clientId;
                const event = new CustomEvent('voice-call-request', { detail: { clientId } });
                document.dispatchEvent(event);
            });
        });
    });
}

// ============================================================
// Message Count (reactive)
// ============================================================
let countUnsubscribe = null;

export function updateMessageCount() {
    if (!currentContainer) return;
    const countEl = currentContainer.querySelector('#message-count');
    if (!countEl) return;

    if (countUnsubscribe) countUnsubscribe();
    countUnsubscribe = vttStore.subscribe('chatMessages', (messages) => {
        const count = messages ? messages.length : 0;
        countEl.textContent = `${count} message${count !== 1 ? 's' : ''}`;
    });
}

// ============================================================
// Chat Recipient Select
// ============================================================
export function populateChatRecipients() {
    const recipientSelect = q('#chatRecipient');
    if (!recipientSelect) return;
    setHtml(recipientSelect, '');
    const options = [{ value: 'all', label: 'All' }, { value: 'gm', label: 'GM' }];
    const chars = vttStore.state.characters || [];
    for (const char of chars) {
        options.push({
            value: char.id || char.name.toLowerCase().replace(/\s+/g, '-'),
            label: char.name || 'Unnamed'
        });
    }
    for (const opt of options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        recipientSelect.appendChild(option);
    }
}

// ============================================================
// Notification sound (helper)
// ============================================================
let notificationAudioCtx = null;

export function playNotificationSound() {
    try {
        if (!notificationAudioCtx) {
            notificationAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const audioCtx = notificationAudioCtx;
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) { /* ignore */ }
}

// ============================================================
// RE-EXPORT for convenience
// ============================================================

export { getOutcomeColor, getOutcomeLabel, getOutcomeClass } from '@core/dice.js';