/**
 * Highlights [TAG] patterns across the site
 * Usage: highlightTags() to scan the whole document, or highlightTags(container) for a specific area
 */

/**
 * Highlight [tags] in a given container
 */
export function highlightTags(container = document.body) {
  // Avoid processing if the container isn't in the DOM
  if (!container || !container.isConnected) return;

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip text inside script/style tags
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip nodes already inside a .tag span (to avoid double-wrapping)
        if (parent.closest?.('.tag')) {
          return NodeFilter.FILTER_REJECT;
        }
        // Only process text that contains [something]
        return /\[[^\]]+\]/.test(node.textContent) 
          ? NodeFilter.FILTER_ACCEPT 
          : NodeFilter.FILTER_REJECT;
      }
    }
  );

  const nodesToReplace = [];
  let currentNode;
  while ((currentNode = walker.nextNode())) {
    nodesToReplace.push(currentNode);
  }

  nodesToReplace.forEach(textNode => {
    const parent = textNode.parentElement;
    if (!parent) return;

    // Replace [tag] with <span class="tag">[tag]</span>
    const fragment = document.createDocumentFragment();
    const text = textNode.textContent;
    const parts = text.split(/(\[[^\]]+\])/g);

    parts.forEach(part => {
      if (part.match(/\[[^\]]+\]/)) {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = part;
        fragment.appendChild(span);
      } else if (part) {
        fragment.appendChild(document.createTextNode(part));
      }
    });

    parent.replaceChild(fragment, textNode);
  });
}

/**
 * Set up automatic highlighting for dynamically added content
 */
export function initTagHighlighting() {
  // Run once on the whole document
  highlightTags();

  // Observe future changes
  const observer = new MutationObserver((mutations) => {
    let needsUpdate = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        // Check if any added node contains text
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE || 
              (node.nodeType === Node.ELEMENT_NODE && node.textContent?.includes('['))) {
            needsUpdate = true;
            break;
          }
        }
      }
      if (needsUpdate) break;
    }
    if (needsUpdate) {
      // Debounce to avoid running too often
      clearTimeout(window._tagHighlightDebounce);
      window._tagHighlightDebounce = setTimeout(() => {
        highlightTags();
      }, 150);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  return observer;
}

// Auto-initialize if this file is imported
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTagHighlighting);
} else {
  initTagHighlighting();
}
