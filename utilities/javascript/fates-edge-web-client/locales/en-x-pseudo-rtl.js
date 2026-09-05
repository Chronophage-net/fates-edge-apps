/**
 * RTL layout pseudolocale.
 *
 * It deliberately reuses the complete accented English test catalogue. The
 * words are not meant to imitate Arabic, Hebrew, Persian, or any other RTL
 * language; the locale exists only to reverse the document direction while
 * retaining obvious markers around every translated interface string.
 */

import pseudo from './en-x-pseudo.js';

export default {
    ...pseudo,
    $meta: {
        code: 'en-x-pseudo-rtl',
        name: 'Pseudo RTL (layout test)',
        nativeName: 'RTL Pseudolocale',
        dir: 'rtl',
    },
};
