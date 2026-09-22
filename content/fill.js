// PUBLIC API: window.__afFill
// fillField(element, value) → void
//   Supports: <input>, <textarea>, contenteditable elements.
//   Dispatches native input/change events so React/Vue/Angular detect the change.
// replaceTextBeforeCursor(element, matchText, value) → void
//   Replaces the `matchText` characters immediately before the cursor with `value`.
//   Used for snippet-shortcut expansion (only the typed shortcut is replaced,
//   not the whole field).

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

  function replaceTextBeforeCursor(el, matchText, value) {
    if (el.isContentEditable) {
      replaceContentEditableBeforeCursor(el, matchText, value);
    } else {
      replaceInputBeforeCursor(el, matchText, value);
    }
  }

  function replaceInputBeforeCursor(el, matchText, value) {
    const setter = el instanceof HTMLTextAreaElement ? textareaSetter : inputSetter;
    const cursor = el.selectionStart ?? el.value.length;
    const start = Math.max(0, cursor - matchText.length);
    const newValue = el.value.slice(0, start) + value + el.value.slice(cursor);
    setter.call(el, newValue);
    const caret = start + value.length;
    el.setSelectionRange(caret, caret);
    dispatchEvents(el);
  }

  function replaceContentEditableBeforeCursor(el, matchText, value) {
    const sel = window.getSelection();
    for (let i = 0; i < matchText.length; i++) {
      sel.modify('extend', 'backward', 'character');
    }
    document.execCommand('insertText', false, value);
    dispatchEvents(el);
  }

  window.__afFill = { fillField, replaceTextBeforeCursor };
})();
