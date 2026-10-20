// PUBLIC API: window.__afSelector
// generate(element)  → string   — best CSS selector for the element
// isUnique(selector) → boolean  — true if selector matches exactly 1 element on page

(() => {
  function esc(val) {
    return CSS.escape(val);
  }

  // Page markup can shadow element properties: a <form> containing <input name="id"> makes
  // form.id / form.children / form.parentElement return that input. So never read DOM state via
  // element properties; use the prototype getters and getAttribute, which named controls can't shadow.
  const protoGetter = (proto, prop) => Object.getOwnPropertyDescriptor(proto, prop).get;
  const getLocalName = protoGetter(Element.prototype, 'localName');
  const getChildren = protoGetter(Element.prototype, 'children');
  const getParent = protoGetter(Node.prototype, 'parentNode');
  const getNodeType = protoGetter(Node.prototype, 'nodeType');
  const getAttr = Element.prototype.getAttribute;
  const queryAll = Document.prototype.querySelectorAll;

  const localNameOf = el => getLocalName.call(el);
  const attrOf = (el, name) => getAttr.call(el, name);

  function parentElementOf(node) {
    const parent = getParent.call(node);
    return parent && getNodeType.call(parent) === 1 ? parent : null;
  }

  function matchCount(selector) {
    return queryAll.call(document, selector);
  }

  function isUnique(selector) {
    try {
      return matchCount(selector).length === 1;
    } catch {
      return false;
    }
  }

  // True only if the selector matches exactly el (not merely "exactly one element").
  function isUniqueFor(selector, el) {
    try {
      const found = matchCount(selector);
      return found.length === 1 && found[0] === el;
    } catch {
      return false;
    }
  }

  function generate(el) {
    // Build the element's full ancestry chain, then walk UP it level by level
    // (element → +parent → +grandparent → …) returning the FIRST candidate that
    // matches exactly this element. Returning at the shallowest unique depth
    // yields the minimal selector.
    const targetPath = buildAncestryPath(el);

    for (let depth = 0; depth < targetPath.length; depth++) {
      const candidateSelector = targetPath.slice(targetPath.length - depth - 1).join(' > ');
      if (isUniqueFor(candidateSelector, el)) {
        return candidateSelector;
      }
    }

    // Fallback: positional path anchored at a unique stable id or at <html>.
    return buildAnchoredPath(el);
  }

  function buildAncestryPath(el) {
    // Return array of selectors from el up to body: [el, parent, grandparent, ...]
    const path = [];
    let current = el;
    while (current && localNameOf(current) !== 'body' && localNameOf(current) !== 'html') {
      path.unshift(getSingleElementSelector(current));
      current = parentElementOf(current);
    }
    return path;
  }

  // Ids that frameworks generate per page load; a selector built on them breaks after reload.
  // Deliberately conservative: plain human-readable ids ("email", "user_email", "step2") pass.
  const DYNAMIC_ID_PATTERNS = [
    /^[:«]/,                                        // React useId: ":r1:", "«r1»"
    /^_r_/,                                         // React 19.2 useId: "_r_25_"
    /:r[0-9a-z]+:|«r[0-9a-z]+»/i,                   // useId token embedded in a longer id: "field-:r30:"
    /\d{4,}/,                                       // long digit run: "input-83921"
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i,         // UUID
    /[0-9a-f]{16,}/i,                               // long hex hash
    /^(ember\d|ng-|mat-|mui-|rc_select_|radix-|headlessui-|react-aria|downshift-|ext-gen)/i, // framework prefixes
    /^(react-select-|cdk-|ui-id-|mantine-)/i        // counter/hash-based ids: "react-select-8-input", "cdk-37", "ui-id-37", "mantine-95b2e"
  ];

  function isDynamicId(id) {
    return DYNAMIC_ID_PATTERNS.some(re => re.test(id));
  }

  // Stable id of el as a string, or '' when absent/dynamic.
  function stableIdOf(el) {
    const id = attrOf(el, 'id');
    return typeof id === 'string' && id && !isDynamicId(id) ? id : '';
  }

  // 1-based position among same-tag siblings, plus how many such siblings exist.
  function siblingPosition(el) {
    const parent = getParent.call(el);
    const name = localNameOf(el);
    // Only element parents: Element.children getter throws on Document/ShadowRoot parents.
    const siblings = parent && getNodeType.call(parent) === 1
      ? Array.from(getChildren.call(parent)).filter(c => localNameOf(c) === name)
      : [el];
    return { index: siblings.indexOf(el) + 1, count: siblings.length };
  }

  function getSingleElementSelector(el) {
    // Return the "best" single selector for just this element (no ancestors).
    const tag = localNameOf(el);

    const id = stableIdOf(el);
    if (id) {
      return `#${esc(id)}`;
    }

    const name = attrOf(el, 'name');
    if (name) {
      return `${tag}[name="${esc(name)}"]`;
    }

    const placeholder = attrOf(el, 'placeholder');
    if (placeholder) {
      return `${tag}[placeholder="${esc(placeholder)}"]`;
    }

    const ariaLabel = attrOf(el, 'aria-label');
    if (ariaLabel) {
      return `[aria-label="${esc(ariaLabel)}"]`;
    }

    // Only the written attribute: el.type is a derived value ("textarea", "select-one")
    // that never matches [type=...].
    const type = attrOf(el, 'type');
    if (type && type.toLowerCase() !== 'text') {
      return `${tag}[type="${esc(type)}"]`;
    }

    // If no good attributes, use nth-of-type for this level only.
    const { index, count } = siblingPosition(el);
    return count > 1 ? `${tag}:nth-of-type(${index})` : tag;
  }

  // Positional path that is unique by construction: nth-of-type at every level, starting at
  // the nearest ancestor with a unique stable id, or at <html>.
  function buildAnchoredPath(el) {
    const parts = [];
    let node = el;
    while (node) {
      const id = node === el ? '' : stableIdOf(node);
      if (id && isUnique(`#${esc(id)}`)) {
        parts.unshift(`#${esc(id)}`);
        break;
      }
      const tag = localNameOf(node);
      if (tag === 'html') {
        parts.unshift(tag);
        break;
      }
      const { index } = siblingPosition(node);
      parts.unshift(`${tag}:nth-of-type(${index})`);
      node = parentElementOf(node);
    }
    return parts.join(' > ');
  }

  window.__afSelector = { generate, isUnique };
})();
