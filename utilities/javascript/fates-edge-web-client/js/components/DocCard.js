import { escHtml } from '@core/utils.js';
import { t as i18nText } from '@core/i18n.js';

/**
 * Format category label
 */
export function formatCategoryLabel(cat) {
    const map = {
        'core': i18nText('feature.components.DocCard.category.core', null, 'Core'),
        'adventure': i18nText('feature.components.DocCard.category.adventure', null, 'Adventure'),
        'travel': i18nText('feature.components.DocCard.category.travel', null, 'Travel'),
        'expansion': i18nText('feature.components.DocCard.category.expansion', null, 'Expansion'),
        'resource': i18nText('feature.components.DocCard.category.resource', null, 'Resource'),
        'other': i18nText('feature.components.DocCard.category.other', null, 'Other')
    };
    return map[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
}

/**
 * Get category badge class
 */
export function getCategoryBadgeClass(cat) {
    const valid = ['core', 'adventure', 'travel', 'expansion', 'resource', 'other'];
    return valid.includes(cat) ? cat : 'other';
}

/**
 * Create a document card DOM element
 */
export function createDocCard(doc, { onOpen }) {
    const div = document.createElement('div');
    div.className = 'doc-card';
    div.dataset.file = doc.file;
    
    div.innerHTML = `
        <h4>${escHtml(doc.title)}</h4>
        <div class="doc-meta">
            <span class="doc-category-badge ${getCategoryBadgeClass(doc.category)}">${escHtml(doc.categoryLabel || formatCategoryLabel('other'))}</span>
            <span style="font-size:0.65rem;opacity:0.7;">${escHtml(doc.file)}</span>
        </div>
    `;
    
    if (onOpen) {
        div.addEventListener('click', onOpen);
    }
    
    return div;
}
