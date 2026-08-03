/**
 * Dice3D — lightweight animated 3D-style dice for roll results.
 *
 * Deliberately NOT a physics/WebGL dice library (no external CDN dependency,
 * no worker threads, nothing that can silently fail to load). It's pure CSS
 * 3D-transform tumble animation driven by the *actual* die values already
 * computed by roller.js's executeRoll() — this never influences the outcome,
 * it only visualizes it, so the underlying game math is untouched.
 *
 * Usage:
 *   import { playDiceAnimation } from '../../components/Dice3D.js';
 *   await playDiceAnimation(containerEl, result.dice, { reRolledDice: result.reRolledDice });
 */

const TUMBLE_MS = 700;
const STAGGER_MS = 60;
const SETTLE_MS = 350;

function classifyDie(value) {
    if (value === 10) return 'dice3d-ten';
    if (value >= 6) return 'dice3d-success';
    if (value === 1) return 'dice3d-storybeat';
    return '';
}

/**
 * Render an animated dice stage into `container` showing `values` (array of
 * final die results), then resolve once the animation has settled. Safe to
 * call even if `container` is null/detached — resolves immediately in that case.
 *
 * @param {HTMLElement} container
 * @param {number[]} values
 * @param {object} [options]
 * @param {boolean} [options.skipAnimation] - render final state instantly (e.g. reduced-motion, or replaying history)
 * @returns {Promise<void>}
 */
export function playDiceAnimation(container, values, options = {}) {
    return new Promise((resolve) => {
        if (!container || !Array.isArray(values) || values.length === 0) {
            resolve();
            return;
        }

        const prefersReducedMotion = typeof window !== 'undefined' &&
            window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const skip = options.skipAnimation || prefersReducedMotion;

        container.innerHTML = '';
        const stage = document.createElement('div');
        stage.className = 'dice3d-stage';
        container.appendChild(stage);

        const dieEls = values.map((value, i) => {
            const die = document.createElement('div');
            const cls = classifyDie(value);
            die.className = 'dice3d-die' + (cls ? ' ' + cls : '');
            die.textContent = String(value);
            if (!skip) {
                die.style.animationDelay = `${i * STAGGER_MS}ms`;
            } else {
                die.style.animation = 'none';
            }
            stage.appendChild(die);
            return die;
        });

        if (skip) {
            resolve();
            return;
        }

        const totalTumble = TUMBLE_MS + (values.length - 1) * STAGGER_MS;

        setTimeout(() => {
            dieEls.forEach((die, i) => {
                die.classList.add('dice3d-settled');
                if (die.classList.contains('dice3d-ten')) {
                    // Small celebratory burst on natural 10s — the big moments in this system.
                    die.classList.add('dice3d-burst');
                    setTimeout(() => die.classList.remove('dice3d-burst'), 650);
                }
            });
            setTimeout(resolve, SETTLE_MS);
        }, totalTumble);
    });
}

export default { playDiceAnimation };
