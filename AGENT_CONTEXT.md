# Agent Context
_Last updated: 2026-10-20 — docs synced with v1.3.2 code (entries model, manager tab, snippets; credentials removed)_

## What This Project Is
**AutoFill** — Chrome MV3 extension that lets a user save values ("entries") for web form fields (matched by URL + CSS selector) and inject them via a dropdown on focus/click. Also supports text-expansion snippets (type `@TZ` anywhere → suggestion). Entries are managed in a dedicated manager tab.

No build step. Plain JS files loaded directly. Hebrew UI (RTL).

## Current State
- ✅ Working: entries CRUD (right-click panel, dropdown "add" button, manager tab, popup), dropdown on focus/click, URL match modes (global/domain/url-contains), snippets, auto-migration of legacy `af_rules`
- 🚧 WIP: —
- ❌ Known Issues: see "Gotchas" below (fragile generated selectors, snippets don't work in email/number inputs)

## Last Changes
- v1.3.x — "➕ הוסף מילוי חדש" footer button in the dropdown; saved-entries sub-list in the add-entry panel; dropdown close (✕) button.
- v1.3 — Entries model replaces rules; manager tab added; snippets added; credentials / Basic Auth removed (see [CHANGELOG.md](CHANGELOG.md)).

## Entry Points
- [manifest.json](manifest.json) — extension manifest, permissions, content-script load order
- [background.js](background.js) — service worker (context menu only)
- [content/content.js](content/content.js) — content-script orchestrator
- [popup/popup.html](popup/popup.html) — toolbar popup
- [manager/manager.html](manager/manager.html) — full entries manager (new tab)

## Key Patterns Used
- All content modules are IIFEs exporting `window.__af*` (no bundler, no imports)
- Entries go through [content/storage.js](content/storage.js) everywhere (content scripts, and popup/manager via a `<script>` tag); mutations are queued and re-read storage. Snippets are read directly from storage (`af_snippets`) by both `snippet.js` and the popup.
- All injected UI uses Shadow DOM for CSS isolation ([content/dropdown.js](content/dropdown.js), [content/config-panel.js](content/config-panel.js))
- Content-script load order is **critical** — see [PROJECT_MAP.md](PROJECT_MAP.md#content-script-load-order)
- Kill switch at top of [content/snippet.js](content/snippet.js): `AF_SNIPPET_ENABLED`

## Next Steps
- [ ] `<select>` / checkbox / radio support (different UX)
- [ ] Import/export entries
- [ ] Entry reordering

## Gotchas / Watch Out
- **No build step.** Don't add `import`/`export`. Use `window.__af*` namespace.
- **Content-script load order matters** — see [manifest.json](manifest.json). `content.js` must be last.
- **`all_frames: true`** — content scripts run in iframes too. Guard with `if (window.__afXLoaded) return;` to avoid double-init.
- **Service worker has no DOM** — `background.js` can't touch `document` / `window`.
- **Domain match is exact** — `www.example.com` ≠ `example.com`.
- **Generated selectors can be fragile** — `selector.js#isDynamicId` skips auto-generated-looking ids (React `:r1:`, 4+ digits, UUID/hash, framework prefixes) and falls back to name/placeholder/aria-label/type, but `nth-of-type` paths may still break when the layout changes; the heuristic is conservative, so an unusual dynamic id can still slip through; the panel shows a "unique" badge only for the current page state.
- **Snippets in `type=email`/`number`** — these inputs expose no `selectionStart`; `getToken` assumes the cursor is at the end of the value, and `type=number` sanitizes non-numeric text so triggers like `@TZ` can't appear there.
- **Plaintext storage** — values live unencrypted in `chrome.storage.local`.
- See [ARCHITECTURE.md](ARCHITECTURE.md) for full design.
- See [CLAUDE.md](CLAUDE.md) for full API reference + storage schema.
