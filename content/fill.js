// PUBLIC API: window.__afFill
// fillField(element, value) → void
//   Supports: <input>, <textarea>, contenteditable elements.
//   Dispatches native input/change events so React/Vue/Angular detect the change.

(() => {
  // Cache native setters so framework-wrapped setters don't intercept.
  const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

  function fillField(el, value) {
    if (el.isContentEditable) {
      fillContentEditable(el, value);
    } else if (el instanceof HTMLTextAreaElement) {
      textareaSetter.call(el, value);
      dispatchEvents(el);
    } else {
      inputSetter.call(el, value);
      dispatchEvents(el);
    }
  }

  function fillContentEditable(el, value) {
    el.focus();
    // Select all existing content then replace.
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, value);
    // Fallback if execCommand is unavailable (some browsers).
    if (el.textContent !== value) {
      el.textContent = value;
      dispatchEvents(el);
    }
  }

  function dispatchEvents(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  window.__afFill = { fillField };
})();
