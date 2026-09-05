import { parsePaperImport, planPaperImport, PAPER_EXAMPLE } from '@core/paper-import.js';
import { getState, ensureCharacterDefaults } from '@core/state.js';
import { syncManager } from '@core/sync/index.js';
import { t } from '@core/i18n.js';

export function openPaperImport() {
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'margin:auto;width:min(48rem,90vw);max-height:85vh;overflow:auto;background:var(--bg);color:var(--text);border:1px solid var(--border);padding:1.5rem;';
    const heading = document.createElement('h2');
    heading.id = 'paper-import-title';
    heading.textContent = t('paperImport.title');
    dialog.setAttribute('aria-labelledby', heading.id);
    const intro = document.createElement('p');
    intro.textContent = t('paperImport.intro');
    const input = document.createElement('textarea');
    input.rows = 14;
    input.maxLength = 50000;
    input.style.cssText = 'width:100%;font-family:monospace;';
    input.setAttribute('aria-label', t('paperImport.input'));
    input.placeholder = PAPER_EXAMPLE;
    const output = document.createElement('pre');
    output.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;';
    output.setAttribute('role', 'status');
    const button = (label, fn) => {
        const el = document.createElement('button');
        el.className = 'btn btn-secondary';
        el.textContent = t(label);
        el.addEventListener('click', fn);
        return el;
    };
    let reviewed = null;
    const invalidate = () => { reviewed = null; apply.disabled = true; output.textContent = ''; };
    const example = button('paperImport.example', () => { input.value = PAPER_EXAMPLE; invalidate(); });
    const preview = button('paperImport.preview', () => {
        const parsed = parsePaperImport(input.value);
        const messages = parsed.issues.map(i => t(`paperImport.issue.${i.code}`, { line: i.line, value: i.value }));
        output.textContent = messages.join('\n');
        try {
            const operations = planPaperImport(parsed, getState(), () => crypto.randomUUID());
            reviewed = { parsed, operations };
            output.textContent += '\n' + operations.map(op => `${t(op.type === 'update_character' ? 'paperImport.update' : 'paperImport.create')}\n${Object.entries(op.value).map(([key, value]) => {
                const label = key === 'totalXp' ? 'XP' : key === 'id' ? 'ID' : key[0].toUpperCase() + key.slice(1);
                const text = key === 'skills' ? Object.entries(value).map(([skill, rating]) => `${skill}=${rating}`).join(', ') : Array.isArray(value) ? value.join(', ') : value;
                return `${label}: ${text}`;
            }).join('\n')}`).join('\n\n');
            apply.disabled = false;
        } catch (error) {
            reviewed = null;
            apply.disabled = true;
            if (!parsed.issues.some(i => i.code !== 'corrected')) output.textContent += '\n' + t('paperImport.idError');
        }
    });
    const apply = button('paperImport.apply', () => {
        if (!reviewed) return;
        // Resolve against current state again in case another participant edited a character since preview.
        let operations;
        try {
            const ids = reviewed.operations.filter(op => !op.path).map(op => op.value.id);
            let index = 0;
            operations = planPaperImport(reviewed.parsed, getState(), () => ids[index++]);
        } catch {
            output.textContent = t('paperImport.idError');
            reviewed = null; apply.disabled = true;
            return;
        }
        reviewed = null;
        apply.disabled = true; preview.disabled = true; example.disabled = true; input.disabled = true;
        output.textContent = t('paperImport.saved');
        for (const op of operations) {
            if (op.type === 'add_character') ensureCharacterDefaults(op.value);
            // Broadcast applies locally and uses the existing persistent offline queue.
            // Keep the same entity IDs after a timeout; never re-import to retry delivery.
            syncManager.broadcast(op).catch(() => {
                output.textContent = t('paperImport.pending');
            });
        }
    });
    apply.disabled = true;
    input.addEventListener('input', invalidate);
    const close = button('paperImport.close', () => dialog.close());
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:.5rem;margin:.75rem 0;';
    actions.append(example, preview, apply, close);
    dialog.append(heading, intro, input, actions, output);
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    document.body.append(dialog);
    dialog.showModal();
    input.focus();
}
