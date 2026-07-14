import { escHtml } from '../core/utils.js';

/**
 * Create a character card DOM element
 */
export function createCharacterCard(char, { onEdit, onDelete, onToggleVTT, onRoll }) {
    const div = document.createElement('div');
    div.className = 'char-item';
    
    const vttBadge = char.vtt ? '<span style="font-size:0.7rem;background:var(--gold);color:#1a141a;padding:0.1rem 0.4rem;border-radius:12px;">VTT</span>' : '';
    
    div.innerHTML = `
        <div>
            <div class="name">${escHtml(char.name || 'Unnamed')} ${vttBadge}</div>
            <div class="meta">${escHtml(char.heritage || '')} · Tier ${char.tier || 'I'} · XP ${char.xp || 32} · ❤️${char.harm || 0} ⚡${char.fatigue || 0} 🎲${char.boons || 0} · ${(char.bonds || []).length}B · ${(char.complications || []).length}C</div>
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
