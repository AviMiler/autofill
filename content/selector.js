// PUBLIC API: window.__afSelector
// generate(element)  → string   — best CSS selector for the element
// isUnique(selector) → boolean  — true if selector matches exactly 1 element on page

(() => {
  function esc(val) {
    return CSS.escape(val);
  }

  function generate(el) {
    // Build the element's full ancestry chain, then walk UP it level by level
    // (element → +parent → +grandparent → …) returning the FIRST candidate that
    // actually matches exactly one element. Each candidate matches `el` by
    // construction, so isUnique(candidate) is true iff it matches only `el`.
    // Returning at the shallowest unique depth yields the minimal selector.

    const targetPath = buildAncestryPath(el);

    for (let depth = 0; depth < targetPath.length; depth++) {
      const candidateSelector = targetPath.slice(targetPath.length - depth - 1).join(' > ');
      if (isUnique(candidateSelector)) {
        return candidateSelector;
      }
    }

    // Fallback: nth-of-type path if even the full ancestry chain isn't unique
    // (e.g. duplicate ids under the same parent).
    return buildPath(el, 4);
  }

  function buildAncestryPath(el) {
    // Return array of selectors from el up to body: [el, parent, grandparent, ...]
    const path = [];
    let current = el;
    while (current && current !== document.body) {
      path.unshift(getSingleElementSelector(current));
      current = current.parentElement;
    }
    return path;
  }

  function getSingleElementSelector(el) {
    // Return the "best" single selector for just this element (no ancestors).
    const tag = el.tagName.toLowerCase();

    if (el.id) {
      return `#${esc(el.id)}`;
    }

    if (el.name) {
      return `${tag}[name="${esc(el.name)}"]`;
    }

    if (el.placeholder) {
      return `${tag}[placeholder="${esc(el.placeholder)}"]`;
    }

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      return `[aria-label="${esc(ariaLabel)}"]`;
    }

    if (el.type && el.type !== 'text') {
      return `${tag}[type="${esc(el.type)}"]`;
    }

    // If no good attributes, use nth-of-type for this level only.
    const siblings = Array.from(el.parentNode?.children || []).filter(
      c => c.tagName === el.tagName
    );
    const idx = siblings.indexOf(el) + 1;
    return siblings.length > 1 ? `${tag}:nth-of-type(${idx})` : tag;
  }

  function buildPath(el, maxDepth) {
    const parts = [];
    let node = el;
    let depth = 0;

    while (node && node !== document.body && depth < maxDepth) {
      const tag = node.tagName.toLowerCase();
      const siblings = Array.from(node.parentNode?.children || []).filter(
        c => c.tagName === node.tagName
      );
      const idx = siblings.indexOf(node) + 1;
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${idx})` : tag);
      node = node.parentNode;
      depth++;
    }

    return parts.join(' > ');
  }

  function isUnique(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  }

  window.__afSelector = { generate, isUnique };
})();
