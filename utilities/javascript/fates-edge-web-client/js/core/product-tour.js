import { t as i18nText } from '@core/i18n.js';
/**
 * A short, route-aware tour of the parts of the toolkit used at the table.
 * It deliberately avoids feature-by-feature narration: each stop answers
 * "when would I come here?" and leaves the rest to the screen itself.
 */

const TOUR_ID = 'fates-edge-product-tour';
const HIGHLIGHT_CLASS = 'product-tour-highlight';

const STEPS = [
  {
    route: 'home',
    eyebrow: 'Before the dice',
    title: 'Begin with a person',
    body: 'The rules can wait a minute. Decide who has something to lose, then make only as much character as tonight needs.',
  },
  {
    route: 'characters',
    eyebrow: 'Characters',
    title: 'Keep the human part in view',
    body: 'Abilities matter. So do Bonds, Complications, followers, and promises. The printable sheet carries both.',
  },
  {
    route: 'dice',
    eyebrow: 'At the hinge',
    title: 'One roll, two answers',
    body: 'The dice tell you whether it worked and what the attempt set loose. Position makes the danger visible before anyone commits.',
  },
  {
    route: 'encounters',
    eyebrow: 'When the scene tightens',
    title: 'Track pressure, not every breath',
    body: 'Use an encounter for a fight, a chase, a locked archive, or a room turning against someone. Keep only what the table needs to see.',
  },
  {
    route: 'spellcraft',
    eyebrow: 'Practices',
    title: 'Magic keeps its own customs',
    body: 'Free Casters, Runekeepers, Invokers, Cantors, witches, summoners, psions, and monastics do not arrive at power by the same road.',
  },
  {
    route: 'docs',
    eyebrow: 'When you need the words',
    title: 'The books are here too',
    body: 'Rules, adventures, and printable resources travel with the toolkit. Search them here; bring paper when paper is kinder.',
  },
];

function stepText(step, field) {
  return i18nText(`feature.core.product-tour.steps.${step.route}.${field}`, null, step[field]);
}

let stepIndex = 0;
let previousFocus = null;
let keyHandler = null;

function injectStyles() {
  if (document.getElementById(`${TOUR_ID}-styles`)) return;
  const style = document.createElement('style');
  style.id = `${TOUR_ID}-styles`;
  style.textContent = `
    #${TOUR_ID} {
      position: fixed;
      inset-inline-end: clamp(1rem, 3vw, 2.25rem);
      bottom: clamp(1rem, 3vw, 2.25rem);
      z-index: 12000;
      width: min(25rem, calc(100vw - 2rem));
      color: var(--text-primary, #f4eee1);
      background: color-mix(in srgb, var(--surface, #17181c) 94%, transparent);
      border: 1px solid var(--gold, #c9a227);
      border-radius: 12px;
      box-shadow: 0 22px 70px rgba(0, 0, 0, .55);
      padding: 1.15rem 1.2rem 1rem;
      backdrop-filter: blur(12px);
    }
    #${TOUR_ID} .product-tour-eyebrow {
      margin: 0 0 .25rem;
      color: var(--gold, #d7b85a);
      font-size: .72rem;
      font-weight: 700;
      letter-spacing: .14em;
      text-transform: uppercase;
    }
    #${TOUR_ID} h2 { margin: 0; font-size: 1.35rem; line-height: 1.15; }
    #${TOUR_ID} p { margin: .65rem 0 1rem; line-height: 1.55; }
    #${TOUR_ID} .product-tour-progress {
      display: flex;
      gap: .35rem;
      margin-bottom: .85rem;
    }
    #${TOUR_ID} .product-tour-progress span {
      height: 3px;
      flex: 1;
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 22%, transparent);
    }
    #${TOUR_ID} .product-tour-progress span.done { background: var(--gold, #c9a227); }
    #${TOUR_ID} .product-tour-actions { display: flex; align-items: center; gap: .5rem; }
    #${TOUR_ID} .product-tour-actions .btn:last-child { margin-inline-start: auto; }
    #${TOUR_ID} .product-tour-count { color: var(--text-muted, #aaa); font-size: .75rem; }
    .${HIGHLIGHT_CLASS} {
      position: relative;
      z-index: 11999 !important;
      outline: 2px solid var(--gold, #c9a227) !important;
      outline-offset: 3px;
      box-shadow: 0 0 0 7px rgba(201, 162, 39, .14) !important;
    }
    @media (max-width: 640px) {
      #${TOUR_ID} { inset-inline-end: .75rem; bottom: .75rem; width: calc(100vw - 1.5rem); }
    }
    @media (prefers-reduced-motion: reduce) {
      #${TOUR_ID}, .${HIGHLIGHT_CLASS} { scroll-behavior: auto; }
    }
  `;
  document.head.appendChild(style);
}

function clearHighlight() {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => el.classList.remove(HIGHLIGHT_CLASS));
}

function highlightRoute(route) {
  clearHighlight();
  const nav = document.querySelector(`.sidebar-nav [data-tab="${route}"]`);
  if (nav) {
    nav.classList.add(HIGHLIGHT_CLASS);
    nav.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function tourHTML(step) {
  const finalStep = stepIndex === STEPS.length - 1;
  const back = i18nText('feature.core.product-tour.back', null, 'Back');
  const next = finalStep
    ? i18nText('feature.core.product-tour.finish', null, 'Finish')
    : i18nText('feature.core.product-tour.next', null, 'Next');
  return `
    <div class="product-tour-progress" aria-hidden="true">
      ${STEPS.map((_, index) => `<span class="${index <= stepIndex ? 'done' : ''}"></span>`).join('')}
    </div>
    <div class="product-tour-eyebrow">${stepText(step, 'eyebrow')}</div>
    <h2 id="product-tour-title">${stepText(step, 'title')}</h2>
    <p>${stepText(step, 'body')}</p>
    <div class="product-tour-actions">
      <button type="button" class="btn btn-sm btn-secondary" data-tour-action="close" data-i18n="feature.core.product-tour.leaveTour">Leave tour</button>
      <span class="product-tour-count">${i18nText('feature.core.product-tour.stepCount', { current: stepIndex + 1, total: STEPS.length }, '{{current}} of {{total}}')}</span>
      ${stepIndex > 0 ? `<button type="button" class="btn btn-sm btn-secondary" data-tour-action="back">${back}</button>` : ''}
      <button type="button" class="btn btn-sm btn-gold" data-tour-action="next">${next}</button>
    </div>
  `;
}

async function showStep(index) {
  stepIndex = Math.max(0, Math.min(index, STEPS.length - 1));
  const step = STEPS[stepIndex];
  const { navigate } = await import('../router.js');
  await navigate(step.route);
  window.history.replaceState(null, '', `#${step.route}`);

  const tour = document.getElementById(TOUR_ID);
  if (!tour) return;
  tour.innerHTML = tourHTML(step);
  highlightRoute(step.route);
  tour.querySelector('[data-tour-action="next"]')?.focus({ preventScroll: true });
}

export function closeProductTour() {
  clearHighlight();
  document.getElementById(TOUR_ID)?.remove();
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = null;
  previousFocus?.focus?.({ preventScroll: true });
  previousFocus = null;
}

export async function startProductTour(options = {}) {
  closeProductTour();
  injectStyles();
  previousFocus = document.activeElement;

  const tour = document.createElement('section');
  tour.id = TOUR_ID;
  tour.setAttribute('role', 'dialog');
  tour.setAttribute('aria-labelledby', 'product-tour-title');
  tour.setAttribute('aria-live', 'polite');
  document.body.appendChild(tour);

  tour.addEventListener('click', event => {
    const action = event.target.closest('[data-tour-action]')?.dataset.tourAction;
    if (action === 'close') closeProductTour();
    if (action === 'back') showStep(stepIndex - 1);
    if (action === 'next') {
      if (stepIndex === STEPS.length - 1) closeProductTour();
      else showStep(stepIndex + 1);
    }
  });

  keyHandler = event => {
    if (event.key === 'Escape') closeProductTour();
    const rtl = document.documentElement?.dir === 'rtl';
    const backKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    if (event.key === backKey && stepIndex > 0) showStep(stepIndex - 1);
    if (event.key === nextKey) {
      if (stepIndex === STEPS.length - 1) closeProductTour();
      else showStep(stepIndex + 1);
    }
  };
  document.addEventListener('keydown', keyHandler);
  await showStep(Number.isInteger(options.step) ? options.step : 0);
}
