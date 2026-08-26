import { escHtml } from '@core/utils.js';

/**
 * Render a character's avatar as an <img> if char.avatar is set, or a
 * deterministic initial-letter circle (colored from the name's hash) as a
 * fallback — no character ever renders with a broken image icon. Shared by
 * CharacterCard.js and the VTT chat renderer so portraits look the same
 * everywhere a character appears.
 */
export function renderAvatar(char, size = 40) {
    const name = char?.name || '?';
    const initial = name.trim().charAt(0).toUpperCase() || '?';
    const hash = String(name).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const hue = hash % 360;
    const fontSize = Math.max(12, Math.round(size * 0.42));

    // Fallback initial-letter circle, always rendered underneath. If an avatar
    // image is set, it's layered on top and simply hides itself (via onerror)
    // if it fails to load — the initials circle underneath is never hidden,
    // so a broken image URL degrades to initials instead of a broken-image icon.
    const fallback = `<div style="width:${size}px;height:${size}px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:700;color:#fff;background:hsl(${hue},45%,38%);border:1px solid var(--border);">${escHtml(initial)}</div>`;

    if (!char?.avatar) return fallback;

    return `
        <span style="position:relative;display:inline-block;width:${size}px;height:${size}px;flex-shrink:0;">
            ${fallback}
            <img src="${escHtml(char.avatar)}" alt="${escHtml(name)}" loading="lazy"
                 style="position:absolute;inset:0;width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:1px solid var(--border);"
                 onerror="this.style.display='none'" />
        </span>
    `;
}

/**
 * Create a character card DOM element
 */
export function createCharacterCard(char, { onEdit, onDelete, onToggleVTT, onRoll }) {
    const div = document.createElement('div');
    div.className = 'char-item';
    
    const vttBadge = char.vtt ? '<span style="font-size:0.7rem;background:var(--gold);color:#1a141a;padding:0.1rem 0.4rem;border-radius:12px;">VTT</span>' : '';
    const avatarHtml = renderAvatar(char, 40);

    div.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.6rem;flex:1;min-width:0;">
            ${avatarHtml}
            <div style="min-width:0;">
                <div class="name">${escHtml(char.name || 'Unnamed')} ${vttBadge}</div>
                <div class="meta">${escHtml(char.heritage || '')} · Tier ${char.tier || 'I'} · XP ${char.xp || 32} · ❤️${char.harm || 0} ⚡${char.fatigue || 0} 🎲${char.boons || 0} · ${(char.bonds || []).length}B · ${(char.complications || []).length}C</div>
            </div>
        </div>
        <div class="actions">
            <button class="btn btn-sm ${char.vtt ? 'btn-green' : 'btn-primary'}" data-action="toggle-vtt">${char.vtt ? '✓ VTT' : '💬 Push'}</button>
            <button class="btn btn-sm btn-primary" data-action="edit">✏️</button>
            <button class="btn btn-sm btn-primary" data-action="roll">🎲</button>
            <button class="btn btn-sm btn-danger" data-action="delete">🗑️</button>
        </div>
    `;
    
    // Attach event listeners
    const editBtn = div.querySelector('[data-action="edit"]');
    const deleteBtn = div.querySelector('[data-action="delete"]');
    const toggleBtn = div.querySelector('[data-action="toggle-vtt"]');
    const rollBtn = div.querySelector('[data-action="roll"]');
    
    if (editBtn && onEdit) editBtn.addEventListener('click', onEdit);
    if (deleteBtn && onDelete) deleteBtn.addEventListener('click', onDelete);
    if (toggleBtn && onToggleVTT) toggleBtn.addEventListener('click', onToggleVTT);
    if (rollBtn && onRoll) rollBtn.addEventListener('click', onRoll);
    
    return div;
}
