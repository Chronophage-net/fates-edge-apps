import { escHtml } from '@core/utils.js';

export const TOOL_HELP = {
    pen: ['Pen', 'Draw freehand on the active layer.'],
    eraser: ['Eraser', 'Erase drawing strokes; notes and maps are separate objects.'],
    select: ['Move', 'Drag notes, maps, portraits, or combat tokens.'],
    line: ['Line', 'Drag from the start to the end of a line.'],
    rectangle: ['Rectangle', 'Drag between opposite corners.'],
    circle: ['Ellipse', 'Drag to frame an ellipse.'],
    arrow: ['Arrow', 'Drag toward the destination.'],
    polygon: ['Polygon', 'Choose sides or star, then drag to size.'],
    ruler: ['Measure', 'Drag to measure. Hold Shift when releasing to pin the measurement.'],
    ping: ['Ping', 'Tap the board to point something out to the table.'],
    'fog-reveal': ['Reveal', 'Paint areas the players can see.'],
    'fog-hide': ['Hide', 'Paint areas back into darkness.'],
    'fog-wall': ['Wall', 'Drag a wall that blocks line of sight.'],
    'fog-light': ['Light', 'Tap to place a light; use Move to reposition it.'],
};

export function updateToolHelp(tool) {
    const hint = document.getElementById('wb-tool-help');
    const [label, help] = TOOL_HELP[tool] || [tool, ''];
    if (hint) hint.textContent = `${label} · ${help}`;
    document.querySelectorAll('#whiteboard-toolbar [data-tool]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    });
}

// Keep the established controls and IDs: the workspace changes their layout,
// not their action handlers or the saved-board schema.
export function arrangeWorkspace(root, tool) {
    const layout = root.querySelector('#whiteboard-modern-layout');
    layout.classList.add('wb-workspace');
    const header = root.querySelector('#whiteboard-header');
    const eyebrow = document.createElement('p');
    eyebrow.className = 'wb-eyebrow'; eyebrow.textContent = 'FATE’S EDGE / SHARED TABLE';
    header.firstElementChild.prepend(eyebrow);
    const actions = root.querySelector('#whiteboard-controls-bar');
    const toolbar = root.querySelector('#whiteboard-toolbar');
    const tabs = root.querySelector('#whiteboard-sheet-tabs');
    const board = root.querySelector('#whiteboard-canvas-container');
    const shell = document.createElement('div'); shell.className = 'wb-workbench';
    const stage = document.createElement('section'); stage.className = 'wb-stage';
    stage.setAttribute('aria-label', 'Board workspace');
    const rail = document.createElement('aside'); rail.className = 'wb-inspector';
    rail.setAttribute('aria-label', 'Board tools');
    layout.insertBefore(shell, toolbar);
    shell.append(stage, rail);
    const hint = document.createElement('p'); hint.id = 'wb-tool-help'; hint.setAttribute('role','status');
    stage.append(tabs, hint, board, actions);
    rail.append(toolbar);
    for (const id of ['whiteboard-layers-panel','whiteboard-roster-panel','whiteboard-lights-panel']) rail.append(root.querySelector('#'+id));
    root.querySelectorAll('[data-tool]').forEach(button => {
        const label = TOOL_HELP[button.dataset.tool]?.[0] || button.title;
        button.setAttribute('aria-label', label);
        if (button.dataset.tool && !button.dataset.tool.startsWith('fog-')) button.append(document.createTextNode(' '+label));
    });
    root.querySelector('#whiteboard-undo').setAttribute('aria-label','Undo board change');
    root.querySelector('#whiteboard-redo').setAttribute('aria-label','Redo board change');
    root.querySelector('#whiteboard-grid-type').setAttribute('aria-label','Combat grid type');
    root.querySelector('#whiteboard-fog-mode').setAttribute('aria-label','Fog mode');
    root.querySelector('#whiteboard-export').textContent = 'Export drawing PNG';
    root.querySelector('#whiteboard-export').removeAttribute('data-i18n');
    root.querySelector('#whiteboard-export').removeAttribute('data-i18n-attr');
    root.querySelector('#whiteboard-export').title = 'Exports the drawing canvas, grid and fog; pinned notes and images are not included.';
    board.querySelector('canvas').setAttribute('aria-label','Drawing canvas. Choose a tool, then draw or drag on the board.');
    const cleanup = document.createElement('details'); cleanup.className='wb-cleanup';
    cleanup.innerHTML='<summary>Clear board content</summary><p>Applies to this sheet only. Use Undo to restore cleared content.</p>';
    cleanup.append(root.querySelector('#whiteboard-clear-drawings'),root.querySelector('#whiteboard-clear'));
    layout.append(cleanup);
    const tools = toolbar.querySelectorAll('details');
    // Mobile starts with the board visible; tools remain one tap away.
    if (window.matchMedia('(max-width: 760px)').matches) tools[0].open=false;
    updateToolHelp(tool);
}

export function openNoteEditor(note, onSave) {
    document.getElementById('wb-note-editor')?.remove();
    const opener = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.id='wb-note-editor'; dialog.className='wb-note-editor';
    dialog.setAttribute('aria-labelledby','wb-note-title');
    dialog.innerHTML=`<form><p class="wb-eyebrow">A NOTE FOR THE TABLE</p><h2 id="wb-note-title">${note ? 'Edit note' : 'Pin a note'}</h2><label>Note text<textarea name="content" rows="7" maxlength="8000" required>${escHtml(note?.content || '')}</textarea></label><p>Drag the note to reposition it. Its layer controls visibility and locking.</p><footer><button type="button" class="btn" data-cancel>Cancel</button><button class="btn btn-gold" type="submit">${note ? 'Save note' : 'Pin note'}</button></footer></form>`;
    document.body.append(dialog);
    dialog.addEventListener('close',()=>{dialog.remove(); if(opener?.isConnected) opener.focus();});
    dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
    dialog.querySelector('form').onsubmit=event=>{
        event.preventDefault();
        const content=new FormData(event.target).get('content').trim();
        if(!content) return;
        onSave(content); dialog.close();
    };
    dialog.showModal(); dialog.querySelector('textarea').focus();
}
