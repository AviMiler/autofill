# AutoFill Chrome Extension

Chrome MV3 extension. No build step — plain JS files loaded directly.

## Status: v1.3.3 — Entries model + manager tab
Core autofill (entries model, per-selector/per-URL matching) complete. Text-expansion snippets
(user-defined trigger strings, e.g. `@TZ`, that suggest a stored value while typing in any field) are supported.
Management of saved entries happens in a dedicated manager tab (`manager/manager.html`), opened from the popup.
There is no saved-credential / username-password feature and no HTTP Basic Auth handling — both were removed.
Load as unpacked extension from this directory.

---

## File Map

| File | Exports | Role |
|------|---------|------|
| `manifest.json` | — | MV3 config, permissions, content script load order |
| `background.js` | — | Service worker: context menu → sends `open-config` to the content script |
| `content/storage.js` | `window.__afStorage` | chrome.storage.local wrapper for entries (auto-migrates legacy `af_rules`) |
| `content/selector.js` | `window.__afSelector` | Generate stable CSS selectors from DOM elements |
| `content/fill.js` | `window.__afFill` | Fill input/textarea/contentEditable fields; snippet text replacement |
| `content/dropdown.js` | `window.__afDropdown` | Shadow DOM suggestion dropdown UI (close button, optional "add new entry" footer) |
| `content/config-panel.js` | `window.__afConfig` | Shadow DOM "add new entry" panel (opened via right-click or dropdown footer) + per-field saved-entries sub-list |
| `content/snippet.js` | `window.__afSnippet` | Snippet cache + trigger-token matching for text-expansion shortcuts |
| `content/content.js` | `window.__afContent` | Orchestrator: focus/click → match → dropdown; also `input` → snippet-trigger detection → dropdown |
| `manager/manager.html` + `manager.js` | — | Standalone extension page (opened in a new tab): full CRUD over saved entries |
| `popup/popup.html` + `popup.js` | — | Extension popup: snippet editor + quick entries list/toggle/delete + "open manager" button |

Content scripts load order (critical): `storage → selector → fill → dropdown → config-panel → snippet → content`

Note: `popup.js` and `manager.js` are extension pages, not content scripts — they load `content/storage.js`
via a `<script>` tag and use `__afStorage` for entries. Snippets are read/written by `popup.js` and `snippet.js`
directly (there is no snippet CRUD in `__afStorage`).

---

## Public APIs

### `window.__afStorage`
```
loadEntries()          → Promise<Entry[]>   // cached; first call migrates legacy af_rules
saveEntries(entries)   → Promise
addEntry(entry)        → Promise<Entry>     // auto-generates id + created; defaults matchType 'global', enabled true
updateEntry(entry)     → Promise            // merges by id
deleteEntry(id)        → Promise
```
The cache is kept in sync via `chrome.storage.onChanged`. `addEntry`/`updateEntry`/`deleteEntry` bypass the cache
(re-read storage) and are serialized through an internal queue, so overlapping mutations in one context don't
overwrite each other. `saveEntries` updates the cache only after `chrome.storage.local.set` succeeds; if the write
rejects, the error propagates to the caller and the cache is left unchanged (no phantom entries). A narrow
cross-context window remains (two pages writing at the same instant).

### `window.__afSelector`
```
generate(element)     → string    // best CSS selector for element
isUnique(selector)    → boolean   // true if matches exactly 1 element
```

### `window.__afFill`
```
fillField(el, value)                       → void   // works for input/textarea/contentEditable
replaceTextBeforeCursor(el, matchText, value) → void
  // Replaces `matchText` characters immediately before the cursor with `value`.
  // Used for snippet expansion — only the typed trigger is replaced, not the whole field.
```

### `window.__afDropdown`
```
show(anchorEl, items[], onSelect, opts?)   → void
  // items: array of { name?, value } OR strings (treated as { value: s })
  // Render: name present → two-line (bold name + gray monospace value).
  //         name absent  → single-line value.
  // onSelect receives the value string.
  // opts.onAdd: function → adds a bottom "➕ הוסף מילוי חדש" footer button that
  //   hides the dropdown and calls it. Omitted → no footer.
  // opts.suppressAutoHideOnInput: true → skip the default auto-hide-on-input
  //   behavior. Needed by callers that re-show() on every keystroke themselves
  //   (e.g. live snippet suggestions) — otherwise the dropdown closes itself
  //   on the very input event that should keep it open/update it.
hide()                                      → void
isVisible()                                 → boolean
getAnchor()                                 → element | null   // currently anchored field
```
Keyboard: ArrowUp/Down moves focus, Enter selects the focused item, Escape closes. Keys act only while the anchor is the
active element. The dropdown also closes when the anchor loses focus to anything outside the dropdown (items and the
footer use `mousedown` + `preventDefault`, so focus stays on the field — new buttons must do the same) or when the
anchor is removed from the DOM. For rich `contentEditable` fields the anchor is the topmost editing host, not the child
node that was clicked. The ✕ button has `tabIndex=-1`.

Positioning: while shown, the dropdown follows its anchor. It repositions on window `resize` and on any scroll
(capture-phase, passive listener, coalesced into one `requestAnimationFrame`). It sits below the anchor, flips above when
it would overflow the bottom (only if it fits there), and is clamped horizontally into the viewport (right edges are
aligned for RTL anchors). It auto-hides when the anchor is removed from the DOM, has zero size, is scrolled out of view,
or is clipped by an overflow ancestor. `hide()` removes every listener and cancels the pending rAF, so repeated
`show()` calls (snippet flow) don't leak.

### `window.__afConfig`
```
show(element) → void   // opens the "add new entry" panel for element (selector auto-generated)
hide()        → void
```
The panel also has a "show all saved entries for this field" button that opens a sub-list
(toggle / inline edit / delete) filtered by the selector currently in the selector input.

### `window.__afContent`
```
refreshEntries()  → void   // reload entries from storage (called after add/edit/delete)
```

### `window.__afSnippet`
```
getToken(el)         → string    // non-whitespace run ending at the cursor; '' if none or if the run is longer than 20 chars
findMatches(token)    → Snippet[] // snippets whose trigger startsWith(token); [] if token.length < 2; triggers longer than 20 chars are ignored
```

Kill switches:
- `AF_SNIPPET_ENABLED` (top of `content/snippet.js`, inside the IIFE after the double-injection guard) — disables snippet-trigger suggestions

---

## Storage Schema

### Entries — key: `af_entries`

One entry = one selectable value for one field. Several entries sharing a `selector` appear together in that field's dropdown.

```json
[
  {
    "id": "e_1716xxx_abc",
    "selector": "input[name='email']",
    "fieldLabel": "אימייל",
    "name": "אישי",
    "value": "user@gmail.com",
    "matchType": "global" | "domain" | "url-contains",
    "matchValue": "",
    "enabled": true,
    "created": 1716000000
  }
]
```
- `fieldLabel` — display only (group title in popup/manager). `name` — optional; shown as the bold first line in the dropdown. Filling always uses `value`.

### URL matching modes
- `matchType: "global"` → matches every page (matchValue ignored)
- `matchType: "domain"` → matchValue = hostname (e.g. `"example.com"`), exact hostname match (`www.example.com` ≠ `example.com`)
- `matchType: "url-contains"` → matchValue = substring, matches if `location.href.includes(matchValue)` (case-sensitive)

Entries are matched with native `element.matches(selector)` after the URL check passes. In `tryShow`, entries with an identical `value` are de-duplicated (first one wins).

### Legacy migration (`af_rules` → `af_entries`)
`storage.js#loadEntries` runs once, when `af_entries` does not exist but the legacy `af_rules` key does: each rule's `options[]` is
flattened into one entry per option (string options become `{ name: '', value }`; legacy `domain` field is mapped to
`matchType`/`matchValue`; rule `label` becomes `fieldLabel`). The legacy key is left in place, untouched.

### Snippets — key: `af_snippets`
```json
[
  { "id": "s_1716xxx_abc", "trigger": "@TZ", "value": "123456789", "created": 1716000000 }
]
```
Global text-expansion shortcuts (no per-site/per-field targeting). Managed only from the popup. While typing in any editable field, `content.js#trySnippet` (bound to a capture-phase `input` listener) reads the token ending at the cursor via `__afSnippet.getToken`, finds triggers that start with it via `__afSnippet.findMatches` (case-sensitive), and shows the dropdown (live-updating per keystroke via `opts.suppressAutoHideOnInput`). Selecting an item calls `__afFill.replaceTextBeforeCursor(el, token, value)`, replacing only the typed token — not the whole field.

---

## Manifest Permissions
`storage`, `contextMenus`. There is no `host_permissions`: content-script injection is granted by `content_scripts.matches: ["<all_urls>"]` (with `all_frames: true`), and the background uses `chrome.tabs.sendMessage`, which needs no host access. After adding or removing permissions, reload the unpacked extension.

---

## How It Works

1. **Configure**: right-click any text field → "⚡ AutoFill: הגדר אפשרויות לשדה זה" → config panel opens (or use the "➕ הוסף מילוי חדש" button in an open dropdown)
2. **Use**: focus OR click a configured field → dropdown appears → click option → field filled
3. **Manage**: open the extension popup → "open manager" → full CRUD in a dedicated tab. Editing sends only `{id}` + the form fields (selector, fieldLabel, name, value, matchType, matchValue) to `updateEntry`, so `enabled`/`created` changed elsewhere are never overwritten; if the entry was deleted elsewhere meanwhile, the edit modal just closes (nothing is re-created).

When focus moves to a field with no entries, `tryShow` hides the previous dropdown.

Trigger: `content.js` binds `tryShow` to both `focus` and `click` events (capture phase).
The visibility-check (`isVisible() && getAnchor() === el`) prevents flicker on first click.

**Snippets**: type a saved trigger (e.g. `@TZ`) in any field (managed via the popup) → dropdown appears live as you type → click the suggestion → only the typed trigger is replaced with the value. Bound to a capture-phase `input` listener (`trySnippet` in `content.js`), separate from the focus/click flow above.

---

## Testing Each Module in Isolation

```js
// Check storage
await window.__afStorage.loadEntries()
await window.__afStorage.addEntry({ selector:'input', fieldLabel:'test', name:'a', value:'hello' })

// Check selector
window.__afSelector.generate(document.querySelector('input'))
window.__afSelector.isUnique('input[name="q"]')

// Check fill
window.__afFill.fillField(document.querySelector('input'), 'hello world')

// Check dropdown (open on currently focused input)
window.__afDropdown.show(document.activeElement, ['opt 1','opt 2'], v=>console.log(v), { onAdd: ()=>console.log('add') })

// Check config panel
window.__afConfig.show(document.querySelector('input'))

// Check snippets (snippets are plain storage; there is no __afStorage helper)
await chrome.storage.local.set({ af_snippets: [{ id:'s_test', trigger:'@TZ', value:'123456789', created: Date.now() }] })
window.__afSnippet.getToken(document.activeElement)      // token ending at cursor
window.__afSnippet.findMatches('@T')                      // matching snippets
window.__afFill.replaceTextBeforeCursor(document.querySelector('input'), '@TZ', '123456789')
```

---

## What's NOT supported
- `<select>`, checkbox, radio fields (different UX needed)
- Import/export entries
- Entry reordering
- Saved credentials / username-password autofill / HTTP Basic Auth (removed)
- Selectors for pages whose fields have no stable attribute: ids that look auto-generated (React `:r1:` / `«r1»` / `_r_…` including when embedded in a longer id, 4+ digit runs, UUID/hex hashes, `ember123`, `ng-`/`mat-`/`mui-`/`radix-`/`headlessui-`/`react-select-`/`cdk-`/`ui-id-`/`mantine-` prefixes) are skipped; the selector falls back to name → placeholder → aria-label → type (only when the `type` attribute is present) → a guaranteed-unique `nth-of-type` path anchored at the nearest unique stable-id ancestor (or `<html>`). That fallback can still break if the page layout changes. Counter-style ids of 1–3 digits (`input25`, `field_465`) can't be told apart from stable ids and are accepted as stable
- Fields inside a page's own Shadow DOM (selectors don't pierce shadow roots)
- Dropdown follow-the-anchor: the "clipped by overflow ancestor" check doesn't cross shadow roots, and a `fixed`/`absolute` anchor that legitimately escapes an overflow ancestor may be hidden wrongly (rare)
- Snippets in `type=email` / `type=number` inputs work only at the end of the text (the browser exposes no cursor position there, so the cursor is assumed to be at the end). `content.js#isEditAwayFromEnd` skips the suggestion when the typed character is clearly not at the end of the value, but it can't catch a typed character equal to the last one, nor deletes or pastes; `type=number` can't hold non-numeric triggers at all
- Ctrl+Z after a snippet expansion can restore previously deleted text (the native value setter breaks the browser's undo stack)
- Snippet triggers with whitespace in them (matching is done on a whitespace-delimited token)
- Snippet matching across multiple text nodes in `contentEditable` fields (only the current text node is checked)
