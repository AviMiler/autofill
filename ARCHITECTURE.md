# Architecture
_Last updated: 2026-10-20_

See [AGENT_CONTEXT.md](AGENT_CONTEXT.md) for project status and [PROJECT_MAP.md](PROJECT_MAP.md) for file layout.

## Overview
AutoFill is a Chrome MV3 extension that injects user-defined text into form fields. Two surfaces of data:
1. **Entries** (`af_entries`) — each entry is `(URL match × CSS selector) → one value (+ optional name)`. Entries sharing a selector are offered together in a dropdown when the field is focused/clicked.
2. **Snippets** (`af_snippets`) — global `trigger → value` text-expansion shortcuts, suggested while typing.

No build step, no framework, no dependencies. All content modules are IIFEs hanging off `window.__af*`.

## Extension Architecture

### Context Boundaries
| Context | Has DOM | Has chrome.* | Can message |
|---------|---------|--------------|-------------|
| Background (service worker — [background.js](background.js)) | ❌ | ✅ full | → content scripts via `chrome.tabs.sendMessage` |
| Content scripts ([content/*.js](content/)) | ✅ (host page) | ✅ limited | ← background, reads/writes `chrome.storage.local` |
| Popup ([popup/popup.js](popup/popup.js)) and manager ([manager/manager.js](manager/manager.js)) | ✅ (own page) | ✅ limited | load [content/storage.js](content/storage.js) and use `__afStorage` |

### Message Flow

**Entry configuration (right-click flow):**
1. User right-clicks editable field → Chrome shows context menu (registered by [background.js](background.js))
2. User clicks "⚡ AutoFill: הגדר אפשרויות לשדה זה"
3. [background.js](background.js) calls `chrome.tabs.sendMessage(tabId, {action: 'open-config'}, {frameId})`
4. [content/content.js](content/content.js)'s `onMessage` handler finds the last right-clicked editable element via `findEditableTarget` (walks up DOM)
5. [content/config-panel.js](content/config-panel.js) renders the Shadow-DOM panel (same panel opens from the dropdown's "➕ הוסף מילוי חדש" button)
6. On save, [content/storage.js](content/storage.js) writes to `chrome.storage.local['af_entries']`
7. `chrome.storage.onChanged` fires → [content/storage.js](content/storage.js) cache, [content/content.js](content/content.js), the popup and the manager all refresh

**Field-fill flow:**
1. User focuses/clicks editable field → capture-phase listener in [content/content.js](content/content.js) fires
2. `tryShow` checks: dropdown already shown for this field? (skip); which enabled entries match URL + selector? (de-duplicate by value)
3. [content/dropdown.js](content/dropdown.js) shows Shadow-DOM dropdown
4. User clicks option → [content/fill.js](content/fill.js) writes value to the element

**Snippet flow:**
1. User types in any editable field → capture-phase `input` listener (`trySnippet`) fires
2. [content/snippet.js](content/snippet.js) extracts the token before the cursor and finds triggers starting with it (min 2 chars)
3. Dropdown shows matches (re-shown on every keystroke, `suppressAutoHideOnInput`); selecting one calls `replaceTextBeforeCursor` so only the typed token is replaced

## Key Decisions
| Decision | Why |
|----------|-----|
| No build step / plain JS | Project is small enough; faster iteration; no toolchain to maintain |
| IIFE + `window.__af*` namespace | Required because content scripts share a single global scope and there's no module loader |
| Shadow DOM for all injected UI | Isolates extension CSS from host-page styles in both directions |
| Capture-phase event listeners | Beats site-level handlers that call `stopPropagation` (e.g. SAP UI5) |
| Flat entries (one value per entry) instead of rules with `options[]` | Simpler CRUD in the manager; per-value scope and enable toggle. Legacy `af_rules` is migrated on first load |
| Dedicated manager tab (not an overlay) | Works on any page and never overlays or conflicts with the host page |
| Credentials / Basic Auth removed | Out of scope for the product; dropped in v1.3 along with `webRequest` permissions |
| Kill switch as top-of-file constant | `AF_SNIPPET_ENABLED` in [content/snippet.js](content/snippet.js) disables snippets without removing code |

## Patterns
- **`window.__af*` IIFE module**: every content module wraps an `(() => { ... })()` with idempotent guard `if (window.__afXLoaded) return;` (or similar), assigns its API to a `window.__af*` global. See any file under [content/](content/).
- **`chrome.storage.onChanged` for cache sync**: modules that cache storage values ([content/storage.js](content/storage.js), [content/content.js](content/content.js), [content/snippet.js](content/snippet.js)) re-read on change events to stay current across tabs and popup/manager edits.
- **`findEditableTarget` walk-up**: right-click targets can be overlays on top of inputs. [content/content.js](content/content.js) walks up `parentElement` until it finds an editable ancestor.
- **Shadow-DOM event isolation**: dropdown and panel stop propagation of mouse/key/focus events at their root so host-page handlers don't react to interactions inside them; the panel also marks page siblings `inert` and traps focus.

## Security Model
- **Threat model:** single-user local use; values are user-typed convenience data, not secrets managers.
- **What's safe:**
  - `chrome.storage.local` is isolated per-extension.
  - Shadow DOM prevents host pages from reading dropdown contents before the user selects.
  - All user-provided strings rendered into extension pages go through `escHtml` or `textContent`.
- **What's not protected:**
  - Values are plaintext on disk in the Chrome profile — don't store passwords or card numbers.
  - `all_frames: true` and `<all_urls>` — the dropdown can appear in third-party iframes.
  - Entry writes are read-modify-write on the whole array: serialized within one context, but two contexts writing at the exact same instant can still race.
