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
 *   posted to chat (which carries the same embedded <em> tags and
 *   [Bracket] annotations as region card data) now renders as
 *   structured HTML instead of one escaped run-on line, matching the
 *   treatment already applied to Adventure Manager descriptions.
 *
 * NEW: Roll event dispatching – when a roll with outcome "Partial" or
 * "Miss" appears, dispatch `timer-tick-request`. When a roll has
 * storyBeats > 0, dispatch `sb-generated`. Uses a processed-ids Set
 * to avoid duplicate events on re-renders.
 */

import { vttStore } from '../../core/vtt-store.js';
import { escHtml, getStorage, setHtml, createElement, sanitizeHtml } from '../../core/utils.js';
import { isConnectedToServer, getRoomCode, getSocketId, getConnectionMode } from '../../core/websocket.js';
import { getOutcomeColor, getOutcomeLabel, getOutcomeClass } from '../../core/dice.js';

// ============================================================
// Configuration
// ============================================================
export const VTT_CONFIG = {
    maxChatMessages: 200,
    chatAutoScroll: true,
    presenceUpdateInterval: 5000,
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
// RICH CHAT TEXT RENDERING (plain text → nice HTML, composed from
// sub-components at display time — same approach as Adventure
// Manager's description renderer, for the same underlying reason:
// Deck draws / Crown Spreads post their synthesis text straight to
// chat, complete with inline <em> flavor tags and [Bracket: ...]
// annotations from the region card data. Escaping that wholesale
// turns it into a wall of "&lt;em&gt;" and literal brackets.
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
        // Only treat a colon within the first ~25 chars as a "Label:" —
        // further out (or inside "**Ace Effect:**"-style markdown) it's
        // just punctuation inside the body text.
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

// Clean, tag/bracket/marker-free text for the collapsed preview line.
function chatPlainPreview(text, maxLen = 160) {
    let plain = String(text)
        .replace(/<\/?[^>]+>/g, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\*\*/g, '')
        .replace(/[🌱🏔️👑🤝🌟⏱️♠️]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (plain.length > maxLen) plain = plain.slice(0, maxLen).trim() + '…';
    return plain;
}

let richChatMsgCounter = 0;

/**
 * Renders a chat message's text nicely. Crown Spread / deck synthesis
 * text (detected by its emoji position markers) gets the structured
 * block treatment; anything else gets newline-aware paragraphing plus
 * the same [Bracket]/**bold** treatment, so ordinary player chat still
 * reads naturally (and looks identical to before for a normal one-line
 * message). Long messages get a "Show full reading" toggle so the
 * chat feed doesn't get overwhelmed by one giant Crown Spread post.
 */
function renderChatMessageText(rawText) {
    const text = String(rawText || '');
    if (!text) return '';

    const isCrown = looksLikeCrownSpreadText(text);
    const formatted = isCrown
        ? renderCrownSpreadChatHtml(text)
        : renderChatBracketAnnotations(renderChatMarkdownBold(escapeKeepingAllowedTags(text)))
            .split(/\n\s*\n/)
            .map(p => `<div style="margin:0.15rem 0;">${p.trim()}</div>`)
            .join('');

    const safeFormatted = sanitizeHtml(formatted);

    if (text.length > 220) {
        const toggleId = `chat-msg-full-${++richChatMsgCounter}`;
        return `
            <span class="chat-msg-preview">${escHtml(chatPlainPreview(text))}</span>
            <button class="btn btn-xs btn-ghost chat-msg-expand-btn" data-target="${toggleId}" style="font-size:0.7rem;padding:0.05rem 0.4rem;margin-left:0.3rem;">Show full reading</button>
            <div id="${toggleId}" class="chat-msg-full" style="display:none;margin-top:0.3rem;">${safeFormatted}</div>
        `;
    }
    return safeFormatted;
}

// ============================================================
// Roll event dispatching helpers (NEW)
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
// Chat renderer (reactive) – with selected character display
// ============================================================
let chatUnsubscribe = null;
let selectedCharUnsubscribe = null;

export function renderChat() {
    if (!currentContainer) return;
    const chatContainer = currentContainer.querySelector('#chatMessages');
    if (!chatContainer) return;

    const selectedDisplay = currentContainer.querySelector('#selected-character-display');
    if (selectedDisplay) {
        if (selectedCharUnsubscribe) selectedCharUnsubscribe();
        selectedCharUnsubscribe = vttStore.subscribe('selectedCharacterId', (id) => {
            const char = id ? vttStore.getSelectedCharacter() : null;
            if (char) {
                const avatarHtml = char.avatar
                    ? `<img src="${char.avatar}" alt="${escHtml(char.name)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);" />`
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
                        <div style="word-break:break-word;font-size:1rem;flex:1 1 auto;min-width:0;">${whisper}${renderChatMessageText(text)}</div>
                        ${modeBadge}
                        <span class="msg-status" style="font-size:0.7rem;color:${statusColor};margin-left:auto;" title="${statusTitle}">${statusIcon}</span>
                    </div>
                    ${msg.rollData ? renderRollDetails(msg.rollData) : ''}
                    ${msg.deckData ? renderDeckDetails(msg.deckData) : ''}
                </div>
            `;
        }

        setHtml(chatContainer, html);

        // Wire up "Show full reading" toggles for long/Crown-Spread messages.
        chatContainer.querySelectorAll('.chat-msg-expand-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = chatContainer.querySelector(`#${btn.dataset.target}`);
                const preview = btn.previousElementSibling;
                if (!target) return;
                const showing = target.style.display !== 'none';
                target.style.display = showing ? 'none' : 'block';
                if (preview && preview.classList.contains('chat-msg-preview')) {
                    preview.style.display = showing ? 'inline' : 'none';
                }
                btn.textContent = showing ? 'Show full reading' : 'Show less';
            });
        });

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
    const outcomeLabel = getOutcomeLabel(rollData.outcome || '');
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

// ============================================================
// Party Status – Vertical JRPG-style roster (scrollable list)
// ============================================================
let charUnsubscribe = null;

export function renderVTTChars() {
    if (!currentContainer) return;
    const grid = currentContainer.querySelector('#vttCharGrid');
    if (!grid) return;

    if (charUnsubscribe) charUnsubscribe();
    charUnsubscribe = vttStore.subscribe('characters', (chars) => {
        const vttChars = chars.filter(c => c.vtt !== false);
        const selectedId = vttStore.getSelectedCharacterId();

        if (vttChars.length === 0) {
            setHtml(grid, `<div style="text-align:center;padding:1.5rem;color:var(--text3);font-size:1.1rem;">👤 No VTT characters</div>`);
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
                ? `<img src="${char.avatar}" alt="${escHtml(name)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid ${isSelected ? 'var(--gold)' : 'var(--border)'};flex-shrink:0;" />`
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

        grid.querySelectorAll('.vtt-char-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const id = card.dataset.charId;
                if (id) {
                    vttStore.selectCharacter(id);
                }
            });
        });
    });
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
        // Use char.body as the default attribute; but we could also use the highest attribute
        // For simplicity, we set to body (primary for many actions)
        attrSelect.value = char.body ?? 3;
    }
    if (skillSelect) {
        // We can't auto-set a skill because there's no single "main" skill.
        // The common rolls will set specific skills; we'll keep it as 0 here.
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
            // Use the character's actual attributes and skills
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

    // Track both presence and characters
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
        let membersHtml = '';
        for (const p of presence) {
            const isSelf = p.id === myId;
            const isOnline = p.online !== false;
            const playerName = p.name || 'Unknown';

            const roleBadge = p.role === 'gm'
                ? `<span style="font-size:0.55rem;background:var(--gold);color:#1a1400;padding:0.05rem 0.4rem;border-radius:8px;font-weight:600;">GM</span>`
                : `<span style="font-size:0.55rem;background:var(--bg4);color:var(--text3);padding:0.05rem 0.4rem;border-radius:8px;">Player</span>`;

            const avatarUrl = showAvatars
                ? p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(playerName)}&size=32&background=2c3e50&color=fff`
                : '';

            let charDisplayHtml = '';
            if (isSelf) {
                const currentChar = p.selectedCharacter || '';
                if (characters.length > 0) {
                    charDisplayHtml = `
                        <select class="vtt-char-select" data-client-id="${p.id}" style="font-size:0.75rem;padding:0.05rem 0.3rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);max-width:120px;">
                            <option value="">— Select —</option>
                            ${characters.map(c => `<option value="${c.name}" ${c.name === currentChar ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    `;
                } else {
                    charDisplayHtml = `
                        <span style="font-size:0.75rem;color:var(--text3);white-space:nowrap;">No characters</span>
                        <button class="btn btn-xs btn-primary" onclick="window.location.hash='characters'" style="font-size:0.6rem;padding:0.05rem 0.4rem;white-space:nowrap;">+ Create</button>
                    `;
                }
            } else {
                charDisplayHtml = p.selectedCharacter
                    ? `<span style="font-size:0.75rem;color:var(--text2);white-space:nowrap;">🎭 ${escHtml(p.selectedCharacter)}</span>`
                    : `<span style="font-size:0.75rem;color:var(--text3);white-space:nowrap;">No character selected</span>`;
            }

            membersHtml += `
                <div class="presence-item" style="display:flex;align-items:center;gap:0.6rem;padding:0.25rem 0;border-bottom:1px solid var(--border);${isSelf ? 'background:var(--bg4);border-radius:6px;padding:0.25rem 0.6rem;' : ''}">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${isOnline ? 'var(--green)' : 'var(--text3)'};flex-shrink:0;" title="${isOnline ? 'Online' : 'Offline'}"></span>
                    ${showAvatars ? `<img src="${avatarUrl}" alt="${escHtml(playerName)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22 viewBox=%220 0 32 32%22%3E%3Crect fill=%22%232c3e50%22 width=%2232%22 height=%2232%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.35em%22 fill=%22%23fff%22 font-family=%22Arial%22 font-size=%2214%22%3E${encodeURIComponent(playerName.charAt(0))}%3C/text%3E%3C/svg%3E'" />` : ''}
                    <span style="font-weight:${isSelf ? '600' : '400'};font-size:0.9rem;white-space:nowrap;">${escHtml(playerName)}${isSelf ? ' (you)' : ''}</span>
                    ${roleBadge}
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

        // Attach change event for dropdowns
        presenceList.querySelectorAll('.vtt-char-select').forEach(select => {
            select.removeEventListener('change', handleCharSelect);
            select.addEventListener('change', handleCharSelect);
        });
    }

    // Clean up old subscriptions
    if (presenceUnsub) presenceUnsub();
    if (charUnsub) charUnsub();

    // Subscribe to both presence and characters
    presenceUnsub = vttStore.subscribe('presence', renderPresence);
    charUnsub = vttStore.subscribe('characters', renderPresence);

    // Initial render
    renderPresence();
}

// Separate handler for character selection
function handleCharSelect(e) {
    const select = e.target;
    const clientId = select.dataset.clientId;
    const selectedChar = select.value;
    if (window.__vttConnected && window.__vttConnected.sendCharacterSelection) {
        window.__vttConnected.sendCharacterSelection(selectedChar);
    } else {
        import('./vtt-connected.js').then(module => {
            if (module.sendCharacterSelection) {
                module.sendCharacterSelection(selectedChar);
            }
        });
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
            html += `
                <span class="voice-client-badge" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.3rem 0.8rem;border-radius:20px;background:var(--bg4);font-size:0.85rem;border:1px solid var(--border);">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${isSpeaking};transition:background 0.3s;" title="${isSpeaking === 'var(--gold)' ? 'Speaking' : 'Silent'}"></span>
                    <span style="font-weight:500;">${escHtml(client.name)}</span>
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

export { getOutcomeColor, getOutcomeLabel, getOutcomeClass } from '../../core/dice.js';