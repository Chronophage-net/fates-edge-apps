// Shared enhancements for local and connected tables; no transport logic here.
export function setupTableUI(root) {
    const table = root.querySelector('.vtt-live-table');
    if (!table || table.querySelector('.vtt-quick-nav')) return;
    const nav = document.createElement('nav');
    nav.className = 'vtt-quick-nav';
    nav.setAttribute('aria-label', 'Table sections');
    const sections = [
        ['Chat', '#chatInput', '.chat-box'],
        ['Party', '#vttCharGrid', '.vtt-panel'],
        ['Actions', '#vtt-combat-actions', '.vtt-panel'],
        ['Roller', '#vtt-attr', '.vtt-panel'],
        ['Timers', '#vttTimerList', '.vtt-panel'],
    ];
    for (const [label, selector, panelSelector] of sections) {
        const target = root.querySelector(selector);
        const panel = target?.closest(panelSelector);
        if (!panel) continue;
        panel.id ||= `vtt-section-${label.toLowerCase()}`;
        panel.tabIndex = -1;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-sm btn-ghost';
        button.textContent = label;
        button.setAttribute('aria-controls', panel.id);
        button.addEventListener('click', () => {
            panel.scrollIntoView({block:'start'});
            panel.focus({preventScroll:true});
        });
        nav.appendChild(button);
    }
    table.querySelector('.vtt-header')?.after(nav);
    const labels = {chatInput:'Chat message',chatRecipient:'Send to','vtt-attr':'Attribute','vtt-skill':'Skill','vtt-dv':'Difficulty value','vtt-pos':'Position','vtt-boons':'Boons','vtt-attack-type':'Weapon','vtt-range':'Range'};
    for (const [id, label] of Object.entries(labels)) {
        root.querySelector(`#${id}`)?.setAttribute('aria-label', label);
    }
}

export function validTimerInput(name, segments) {
    return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 100
        && Number.isInteger(segments) && segments >= 1 && segments <= 60;
}

export function showTimerForm(root, onCreate) {
    const button = root?.querySelector('#vtt-add-timer');
    if (!button) return;
    const existing = root.querySelector('.vtt-timer-form');
    if (existing) { existing.querySelector('input').focus(); return; }
    const form = document.createElement('form');
    form.className = 'vtt-timer-form';
    form.setAttribute('aria-label', 'Create scene timer');
    form.innerHTML = `<label>Timer name<input name="timerName" value="Scene Timer" maxlength="100" required></label>
        <label>Segments (1–60)<input name="segments" type="number" value="6" min="1" max="60" step="1" required></label>
        <p role="alert" hidden></p>
        <div class="vtt-btn-row"><button type="submit" class="btn btn-gold">Create timer</button><button type="button" class="btn">Cancel</button></div>`;
    form.querySelector('[type="button"]').addEventListener('click', () => { form.remove(); button.focus(); });
    form.addEventListener('submit', event => {
        event.preventDefault();
        const name = form.elements.timerName.value.trim();
        const segments = Number(form.elements.segments.value);
        if (!validTimerInput(name, segments)) {
            const error = form.querySelector('[role="alert"]');
            error.hidden = false;
            error.textContent = 'Enter a name and a whole number of segments from 1 to 60.';
            return;
        }
        onCreate({name, segments, current:0});
        form.remove();
        button.focus();
    });
    button.closest('.vtt-panel').appendChild(form);
    form.querySelector('input').focus();
}
