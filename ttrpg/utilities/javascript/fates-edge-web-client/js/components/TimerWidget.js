import { escHtml } from '../core/utils.js';

/**
 * Create a timer widget DOM element
 */
export function createTimerWidget(timer, { onTick, onReset, onDelete }, compact = false) {
    const div = document.createElement('div');
    div.className = compact ? '' : 'timer-widget';
    
    const filled = Math.min(timer.current, timer.segments);
    const ratio = timer.segments > 0 ? filled / timer.segments : 0;
    const danger = ratio >= 0.75;
    const complete = ratio >= 1;
    const barClass = complete ? 'complete' : danger ? 'danger' : '';
    
    // Build segment display
    let segs = '';
    for (let i = 0; i < timer.segments; i++) {
        const cls = i < filled ? 'filled' : '';
        const extra = (i < filled && danger) ? 'danger' : (i < filled && complete) ? 'complete' : '';
        segs += `<span class="timer-seg ${cls} ${extra}">${i < filled ? '●' : '○'}</span>`;
    }
    
    if (compact) {
        div.innerHTML = `
            <div style="margin-bottom:0.6rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div><strong>${escHtml(timer.name)}</strong> <span class="text-muted">${timer.current}/${timer.segments}</span></div>
                    <div class="flex">
                        <button class="btn btn-xs btn-primary" data-action="tick">+</button>
                        <button class="btn btn-xs" data-action="reset">↺</button>
                    </div>
                </div>
                <div style="display:flex;gap:0.4rem;align-items:center;margin:0.2rem 0;">
                    <div class="timer-bar-wrap"><div class="timer-bar-fill ${barClass}" style="width:${ratio * 100}%;"></div></div>
                    <span class="timer-label">${Math.round(ratio * 100)}%</span>
                </div>
            </div>
        `;
    } else {
        div.innerHTML = `
            <div style="background:var(--bg3);padding:0.8rem;border-radius:var(--radius);margin-bottom:0.6rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;">
                    <div><strong>${escHtml(timer.name)}</strong> <span class="text-muted">${timer.current}/${timer.segments}</span></div>
                    <div class="flex">
                        <button class="btn btn-sm btn-primary" data-action="tick">+ Tick</button>
                        <button class="btn btn-sm" data-action="reset">↺</button>
                        <button class="btn btn-sm btn-danger" data-action="delete">🗑️</button>
                    </div>
                </div>
                <div style="display:flex;gap:0.4rem;align-items:center;margin:0.4rem 0;">
                    <div class="timer-bar-wrap"><div class="timer-bar-fill ${barClass}" style="width:${ratio * 100}%;"></div></div>
                    <span class="timer-label">${Math.round(ratio * 100)}%</span>
                </div>
                <div class="timer-display">${segs}</div>
                ${complete ? '<span style="font-size:0.7rem;color:var(--green);">✓ Complete</span>' : ''}
            </div>
        `;
    }
    
    // Attach event listeners
    const tickBtn = div.querySelector('[data-action="tick"]');
    const resetBtn = div.querySelector('[data-action="reset"]');
    const deleteBtn = div.querySelector('[data-action="delete"]');
    
    if (tickBtn && onTick) tickBtn.addEventListener('click', onTick);
    if (resetBtn && onReset) resetBtn.addEventListener('click', onReset);
    if (deleteBtn && onDelete) deleteBtn.addEventListener('click', onDelete);
    
    return div;
}
