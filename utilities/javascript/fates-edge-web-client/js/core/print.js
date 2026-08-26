/**
 * Print-isolation helper.
 *
 * The app has no per-page print stylesheets by default -- hitting Ctrl+P
 * anywhere would print the sidebar, toasts, and whatever edit-mode chrome
 * happens to be on screen along with the actual content. Rather than
 * building a separate print window/iframe (which loses the page's CSS
 * variables/theme and has to re-fetch everything), this just flips a body
 * class that a handful of `@media print` rules in css/app.css key off of
 * (search that file for "print-active") to hide the known chrome around
 * whichever feature called this.
 *
 * Deliberately not exposed on every page -- see the callers in
 * js/features/characters/editor.js (character sheet) and
 * js/features/docs/index.js (SRD / Essentials / Campfire Mode only; see
 * PRINTABLE_DOC_IDS there for why the rest of the docs library doesn't get
 * this button).
 */
export function printWithChromeHidden() {
    document.body.classList.add('print-active');

    const cleanup = () => {
        document.body.classList.remove('print-active');
        window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    // afterprint doesn't reliably fire in every browser/print-preview flow
    // (some mobile browsers skip it entirely); window.print() blocks until
    // the dialog is dismissed on desktop, so by the time this timer fires
    // the class has almost always already been removed by afterprint. This
    // is just a backstop so the app never gets stuck mid-print-mode.
    setTimeout(cleanup, 2000);
}
