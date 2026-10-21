# Agent Context
_Last updated: 2026-10-21 — v1.5.0: full UI redesign (minimal neutral design system, light/dark, SVG icons, Rubik font, manager sidebar, in-page popover); see [docs/REDESIGN-v1.5.md](docs/REDESIGN-v1.5.md)_

## What This Project Is
**AutoFill** — Chrome MV3 extension that lets a user save values ("entries") for web form fields (matched by URL + CSS selector) and inject them via a dropdown on focus/click. Also supports text-expansion snippets (type `@TZ` anywhere → suggestion). Entries and snippets are managed in a dedicated manager tab, opened by clicking the toolbar icon (there is no popup).

No build step. Plain JS files loaded directly. Hebrew UI (RTL).

## Current State
- ✅ Working: entries CRUD (right-click panel, dropdown "add" button, manager tab), manager filters/inline edit/undo/JSON import-export, dropdown on focus/click, URL match modes (global/domain/url-contains), snippets, auto-migration of legacy `af_rules`
- 🚧 WIP: —
- ❌ Known Issues: see "Gotchas" below (fragile generated selectors, snippets don't work in email/number inputs)

## Last Changes
- 2026-10-21 — User guide: [docs/tutorial/](docs/tutorial/) (MP4 + interactive HTML), generated from the real extension by `tests/tutorial/`. UI smoke test: `tests/ui-smoke.js` (see [docs/REDESIGN-v1.5.md](docs/REDESIGN-v1.5.md) §7). README.md rewritten.
- 2026-10-21 (v1.5.0) — UI redesign of every surface, spec in [docs/REDESIGN-v1.5.md](docs/REDESIGN-v1.5.md). New `content/icons.js` (`__afIcons`, loaded after `fill.js`). Dropdown: first item pre-selected (Enter fills it), footer with keyboard hints + close, `opts.highlight` for snippet triggers, scrollable list. Add-entry panel is now a popover anchored to the field: value + display name visible, scope select defaulting to "this site", field label/selector under "מתקדם", field label guessed from the page; saved-entries view inside the popover with two-step delete. Manager: sidebar (entries / snippets / backup views + filter by site), copy-value button, empty states, bundled Rubik font, responsive. New icon set in `icons/` (old `icon.png` removed). `af_ui_snippets_open` no longer used.
- 2026-10-20 — Manager snippets section: inline edit of existing snippets (`manager/snippets.js`; the list does not redraw while an editor is open, it re-renders on close).
- 2026-10-20 — Panel: cancel (↩) button when editing a row in the saved-entries sub-list; add-entry form has a fixed "הדף הזה בלבד (ה-URL המלא)" scope (saved as `url-contains` + page URL without `#fragment`).
- 2026-10-20 (v1.4.0) — Toolbar popup removed (`popup/` deleted, no `default_popup`); icon click (`chrome.action.onClicked`) opens/focuses `manager/manager.html`, pre-filtered to the clicked page's site via hash `#url=…&sel=…` (re-filters an existing tab). Manager split into `manager/{manager.css,dom.js,entry-editor.js,snippets.js,backup.js,manager.js}`: snippet editor as collapsible section at top, filter chips, inline edit, delete with undo toast, JSON export/import. `__afStorage` gained `restoreEntries`/`appliesToUrl`. In-page panel sub-list shows scope, dims non-applicable entries, sends only changed fields, has a "ניהול מלא ←" link (`open-manager` message). Added `activeTab` permission. Not built on purpose: duplicate-entry, bulk select.
- 2026-10-20 — `selector.js` bug fixes (API unchanged): no bogus `[type="textarea"]`; all DOM reads use prototype getters + `getAttribute` so form controls named `id`/`tagName`/`parentElement` can't shadow, throw or hang; `buildPath` replaced by `buildAnchoredPath` (nth-of-type chain from nearest unique stable-id ancestor or `<html>`, unique by construction); dynamic-id heuristic extended (`_r_`, embedded `:rX:`, `react-select-`, `cdk-`, `ui-id-`, `mantine-`).
- 2026-10-20 — Dropdown closes on anchor focus loss / removal and ignores keys unless the anchor is active; `tryShow` hides the old dropdown on fields with no entries; contentEditable anchors on the editing host; `getToken` returns '' for runs > 20 chars; `snippet.js` is safe against double injection; email edit-away-from-end heuristic.
- 2026-10-20 — Manager edit sends only `{id}` + form fields and closes if the entry was deleted elsewhere; `saveEntries` caches only after a successful write; selector text no longer uppercased in the manager; `host_permissions` dropped (reload the unpacked extension).
- 2026-10-20 — Dropdown now follows its anchor (reposition on scroll/resize, flip above, horizontal clamp, auto-hide when anchor removed/out of view/clipped); `hide()` cleans all listeners. Known limits: clip check doesn't cross shadow roots; fixed/absolute anchors escaping an overflow ancestor may be hidden wrongly.
- v1.3.x — "➕ הוסף מילוי חדש" footer button in the dropdown; saved-entries sub-list in the add-entry panel; dropdown close (✕) button.
- v1.3 — Entries model replaces rules; manager tab added; snippets added; credentials / Basic Auth removed (see [CHANGELOG.md](CHANGELOG.md)).

## Entry Points
- [manifest.json](manifest.json) — extension manifest, permissions, content-script load order
- [background.js](background.js) — service worker (context menu, toolbar click, `open-manager` message)
- [content/content.js](content/content.js) — content-script orchestrator
- [manager/manager.html](manager/manager.html) — entries + snippets manager (tab opened by the toolbar icon; scripts in [manager/](manager/))

## Key Patterns Used
- All content modules are IIFEs exporting `window.__af*` (no bundler, no imports)
- Entries go through [content/storage.js](content/storage.js) everywhere (content scripts, and the manager via a `<script>` tag); mutations are queued and re-read storage. Snippets are read directly from storage (`af_snippets`) by `snippet.js`, and read/written by `manager/snippets.js` (and `backup.js` on import).
- All injected UI uses Shadow DOM for CSS isolation ([content/dropdown.js](content/dropdown.js), [content/config-panel.js](content/config-panel.js))
- Content-script load order is **critical** — see [PROJECT_MAP.md](PROJECT_MAP.md#content-script-load-order)
- Kill switch at top of [content/snippet.js](content/snippet.js) (inside the IIFE, after the double-injection guard): `AF_SNIPPET_ENABLED`

## Next Steps
- [ ] `<select>` / checkbox / radio support (different UX)
- [ ] Entry reordering

## Gotchas / Watch Out
- **No build step.** Don't add `import`/`export`. Use `window.__af*` namespace.
- **Content-script load order matters** — see [manifest.json](manifest.json). `content.js` must be last.
- **`all_frames: true`** — content scripts run in iframes too. Guard with `if (window.__afXLoaded) return;` to avoid double-init.
- **Service worker has no DOM** — `background.js` can't touch `document` / `window`.
- **Domain match is exact** — `www.example.com` ≠ `example.com`.
- **Generated selectors can be fragile** — `selector.js#isDynamicId` skips auto-generated-looking ids (React `:r1:`/`«r1»`/`_r_`, also embedded; 4+ digits, UUID/hash, framework prefixes incl. `react-select-`/`cdk-`/`ui-id-`/`mantine-`) and falls back to name/placeholder/aria-label/`[type]` (attribute only). The last resort is `buildAnchoredPath`, a unique-by-construction nth-of-type chain from the nearest stable-id ancestor or `<html>`, which still breaks if the layout changes. Short counter ids (`input25`, `field_465`) can't be distinguished from stable ones. Never read `el.id`/`el.name`/`el.tagName`/`el.parentElement`/`el.type` directly in `selector.js`: named form controls shadow them — use `getAttribute` or the prototype getters. The panel's "unique" badge reflects only the current page state.
- **Snippets in `type=email`/`number`** — these inputs expose no `selectionStart`; `getToken` assumes the cursor is at the end of the value, and `type=number` sanitizes non-numeric text so triggers like `@TZ` can't appear there.
- **Dropdown focus coupling** — the dropdown closes when its anchor loses focus, so any new clickable element inside it must use `mousedown` + `preventDefault` (as items and the footer do). Snippet tokens longer than 20 chars are never matched.
- **Email snippets** — `isEditAwayFromEnd` (content.js) is a best-effort heuristic; it can't catch a typed char equal to the last one, deletes or pastes. Ctrl+Z after expansion can garble the field (native setter breaks undo) — known, unfixed.
- **No `host_permissions`, no `tabs`** — injection comes from `content_scripts.matches`; `activeTab` is the only extra permission (icon click reads the tab URL). **Unverified in a real Chrome:** `chrome.tabs.query` on the extension's own manager URL without the `tabs` permission (used to find an existing manager tab) — if it returns nothing, a new manager tab opens on every click; test this first on any manager-opening bug.
- **Manager hash contract** — `manager.html#url=<page url>&sel=<css selector>`; the manager reacts to `hashchange`. `sender.tab.url` is hidden without `tabs`, so the `open-manager` handler uses `sender.url` only for `frameId === 0`.
- **Design system:** colors only through the CSS variables (`manager.css` `:root`, and per-shadow-root variables in `dropdown.js`/`config-panel.js`), always with a dark-mode value; icons only from `content/icons.js`, no emoji in UI strings.
- **No modal / `confirm()` in the manager** — inline editing and undo toast (`restoreEntries`). Don't reintroduce a second management UI (popup) — see [DECISIONS.md](DECISIONS.md).
- **Plaintext storage** — values live unencrypted in `chrome.storage.local`.
- See [ARCHITECTURE.md](ARCHITECTURE.md) for full design.
- See [CLAUDE.md](CLAUDE.md) for full API reference + storage schema.
