// modules/roster.js
import { getState } from '../../../core/state.js';
import { showToast } from '../../../components/Toast.js';
import { escHtml } from '../../../core/utils.js';
import { state, getActiveSheet, getLayer} from './state.js';
import { pushUndoSnapshot } from './undo.js';
import { saveWhiteboardData } from './persistence.js';
import { renderOverlay, updateStats } from './renderer.js';

let rosterMode = 'icon'; // 'icon' | 'avatar'

export function populateRoster() {
    const panel = document.getElementById('whiteboard-roster-panel');
    if (!panel) return;

    const characters = getState().characters || [];
    const items = characters.map(c => ({
        id: c.id,
        name: c.name || 'Unnamed',
        // SECURITY: Block SVG uploads globally; for now, use a safe fallback if SVG is detected.
        image: (c.icon && !c.icon.includes('image/svg+xml')) ? c.icon :
               'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB7UlEQVR42u2bsXHDMAxFTZwaz5E2vVdIGU+QVgtkiiygNhM4ZVZI79ZzuHSq5HQ8kiJIAAJIorPPpvC+PijyBB4OI/oOJ3mx6+X0yP3t8/nHmRcAA7yXIE4S/PX9nj3G18dRRAjHCY0BLhGEQgzHAU8JviVErQjOCjiXEI4CXhI8JUSJCGAZ3r9+yVPHlcLXgM/zHPx+WRYSN2Cc4KTgY9CxKBUDKwJohC/9zzq/3HIAjfCSIoBWeCkRgGstTwFPNVaKAzBq7gFfM2ZO3sD5uNMQW6UA3NtYTRHiAkrrc9mfakIkWwq3FNBq7efOBcMBPdz9lAuGA6gHrN3SSo89HNBL/cfmAbBiVa7SAgv1yjmvdD8HTJrW7FvjcThh0gwuIcRkAZxTCLAGT31tsApPlQNYhqfIBazD1+b0L8Dfq6RYZ4ZmeExu/qszsH7na3OEluBLch3b4fWH2Dxg6e6ncg69Oh8O8L/wXWDx7odcEGucGA7IeWZajxRHtI/mejk9vm9vTQjw8vQZtH/SAVLd2lIR4xlzQA+QKTd374DsOrf04gTTLAlYG2l/NLJ1iloQgb1X2C8HLSVR0zJfNAmuL7K3G2rPC4wTIxTJdHtmKCUCtRCqT43liIEVxNy5QYwQ1MtZtQLUCNLablRt/AJ4/zJrt3sMNgAAAABJRU5ErkJggg==', // fallback avatar
        type: 'character'
    }));

    panel.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:8px;">
            <label><input type="radio" name="rosterMode" value="icon" ${rosterMode === 'icon' ? 'checked' : ''}> Character Icon</label>
            <label><input type="radio" name="rosterMode" value="avatar" ${rosterMode === 'avatar' ? 'checked' : ''}> Player Avatar</label>
        </div>
        <div style="max-height:200px;overflow-y:auto;">
            ${items.map(item => `
                <div class="roster-item" draggable="true" style="display:flex;align-items:center;gap:8px;padding:4px;border-bottom:1px solid var(--border);cursor:grab;">
                    <img src="${escHtml(item.image)}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />
                    <span class="text-sm">${escHtml(item.name)}</span>
                </div>
            `).join('')}
        </div>
    `;

    // Attach drag events securely using dataset
    panel.querySelectorAll('.roster-item').forEach(el => {
        const idx = Array.from(el.parentElement.children).indexOf(el);
        const item = items[idx];
        if (!item) return;
        el.dataset.item = JSON.stringify(item);
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', el.dataset.item);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    // Radio change
    panel.querySelectorAll('input[name="rosterMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            rosterMode = e.target.value;
            populateRoster();
        });
    });
}

export function toggleRosterPanel() {
    const panel = document.getElementById('whiteboard-roster-panel');
    if (!panel) return;
    const showing = panel.style.display !== 'none';
    panel.style.display = showing ? 'none' : 'block';
    if (!showing) populateRoster();
}

// Called from canvas drop event
export function handleRosterDrop(e) {
    const data = e.dataTransfer.getData('application/json');
    if (!data) return false;
    try {
        const item = JSON.parse(data);
        const rect = document.getElementById('whiteboard-canvas').getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const layer = getLayer('characters') || getLayer('drawing');
        if (layer && layer.locked) {
            showToast('Character layer is locked', 'warning');
            return false;
        }
        pushUndoSnapshot();
        state.characterTokens.push({
            id: 'ctok-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            x: x - 24,
            y: y - 24,
            name: item.name,
            imageData: item.image || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB7UlEQVR42u2bsXHDMAxFTZwaz5E2vVdIGU+QVgtkiiygNhM4ZVZI79ZzuHSq5HQ8kiJIAAJIorPPpvC+PijyBB4OI/oOJ3mx6+X0yP3t8/nHmRcAA7yXIE4S/PX9nj3G18dRRAjHCY0BLhGEQgzHAU8JviVErQjOCjiXEI4CXhI8JUSJCGAZ3r9+yVPHlcLXgM/zHPx+WRYSN2Cc4KTgY9CxKBUDKwJohC/9zzq/3HIAjfCSIoBWeCkRgGstTwFPNVaKAzBq7gFfM2ZO3sD5uNMQW6UA3NtYTRHiAkrrc9mfakIkWwq3FNBq7efOBcMBPdz9lAuGA6gHrN3SSo89HNBL/cfmAbBiVa7SAgv1yjmvdD8HTJrW7FvjcThh0gwuIcRkAZxTCLAGT31tsApPlQNYhqfIBazD1+b0L8Dfq6RYZ4ZmeExu/qszsH7na3OEluBLch3b4fWH2Dxg6e6ncg69Oh8O8L/wXWDx7odcEGucGA7IeWZajxRHtI/mejk9vm9vTQjw8vQZtH/SAVLd2lIR4xlzQA+QKTd374DsOrf04gTTLAlYG2l/NLJ1iloQgb1X2C8HLSVR0zJfNAmuL7K3G2rPC4wTIxTJdHtmKCUCtRCqT43liIEVxNy5QYwQ1MtZtQLUCNLablRt/AJ4/zJrt3sMNgAAAABJRU5ErkJggg==",
            characterId: item.id,
            layerId: 'characters',
        });
        saveWhiteboardData();
        renderOverlay();
        updateStats();
        showToast(`Token "${item.name}" placed`, 'success');
        return true;
    } catch (err) {
        console.warn('Roster drop parse error', err);
        return false;
    }
}
