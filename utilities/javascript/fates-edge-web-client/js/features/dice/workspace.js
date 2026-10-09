export function poolSummary(values) {
    const pool=Math.min(12,Number(values.attr)+Number(values.skill)+Number(values.boons));
    return `${pool} dice · DV ${values.dv} · ${values.position}${Number(values.attr)+Number(values.skill)+Number(values.boons)>12?' · pool capped at 12':''}`;
}

export function arrangeDiceWorkspace(root, values, onChange) {
    root._diceEvents?.abort();
    root._diceEvents=new AbortController();
    root.classList.add('dice-workspace');
    const title=root.querySelector('h1');
    const eyebrow=document.createElement('p'); eyebrow.className='play-eyebrow'; eyebrow.textContent='FATE’S EDGE / TAKE A CHANCE'; title.before(eyebrow);
    const setup=root.querySelector('#roll-attr').closest('.panel'); setup.classList.add('dice-setup');
    const heading=document.createElement('h2'); heading.textContent='Build your roll'; setup.prepend(heading);
    const summary=document.createElement('p'); summary.id='dice-pool-preview'; summary.setAttribute('role','status');
    setup.querySelector('.form-row').after(summary);
    const update=()=>{for(const key of Object.keys(values)) values[key]=root.querySelector('#roll-'+key).value;summary.textContent=poolSummary(values);onChange?.();};
    for(const key of Object.keys(values)) {
        const field=root.querySelector('#roll-'+key); field.value=values[key];
        field.previousElementSibling?.setAttribute('for',field.id);
        field.addEventListener('change',update);
    }
    root.addEventListener('dice-preset-change',update,{signal:root._diceEvents.signal});
    update();
    const presets=root.querySelector('.preset-rolls');
    const disclosure=document.createElement('details'); disclosure.className='dice-presets';
    disclosure.innerHTML='<summary>Example setups</summary><p>Presets fill the controls. Review them, then press Roll.</p>';
    presets.before(disclosure); disclosure.append(presets);
    const history=root.querySelector('#roll-history').closest('.panel'); history.classList.add('dice-history-panel');
    const actions=document.createElement('div'); actions.className='dice-history-actions';
    actions.append(root.querySelector('#roll-export-history'),root.querySelector('#roll-clear-history')); history.append(actions);
    const seedPanel=root.querySelector('#seed-regenerate').closest('.panel');
    const replay=document.createElement('details'); replay.className='dice-replay';
    replay.innerHTML='<summary>Randomness & replay tools</summary><p>Normal play uses cryptographic randomness. A seed enables repeatable testing for this session and also affects other tools that share the dice engine.</p>';
    seedPanel.before(replay); replay.append(seedPanel); root.append(replay);
    const demo=root.querySelector('[data-roll-preset="deterministic"]');
    demo.removeAttribute('data-i18n'); demo.textContent='Test pool (3+3, DV4, +1 Boon)';
    const result=root.querySelector('#roll-result'); result.setAttribute('aria-label','Latest roll'); result.setAttribute('role','region');
    const layout=document.createElement('div'); layout.className='dice-play-layout'; setup.before(layout);
    const resultColumn=document.createElement('div'); resultColumn.className='dice-results';
    layout.append(setup,resultColumn); resultColumn.append(result,history);
}
