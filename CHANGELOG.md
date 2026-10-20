# Changelog

See [AGENT_CONTEXT.md](AGENT_CONTEXT.md) for current state and [ARCHITECTURE.md](ARCHITECTURE.md) for design.

## v1.4.0 — 2026-10-20
- **Removed:** toolbar popup (`popup/`, `action.default_popup`). The toolbar icon now opens the manager tab, or focuses/re-filters the existing one. Why: one management surface instead of two overlapping UIs.
- **Added:** manager pre-filter to the clicked page's site (hash `#url=…&sel=…`); `activeTab` permission (reload the unpacked extension).
- **Changed:** manager split into `manager/{manager.css,dom.js,entry-editor.js,snippets.js,backup.js,manager.js}`; snippet editor moved there as a collapsible top section; filter chips (all/global/current site/by domain); inline row editing replaces the modal; delete uses an undo toast instead of `confirm()`.
- **Added:** JSON export/import of entries + snippets (previously unsupported); `__afStorage.restoreEntries` / `appliesToUrl`.
- **Changed:** in-page panel saved-entries sub-list shows scope (🌐/🌍/🔗), dims entries not applying to the current page, and sends only `{id, changed fields}` to `updateEntry`; new "ניהול מלא ←" button opens the manager filtered to the selector.
- **Not built (by decision):** duplicate-entry, bulk select.
- **Known/unverified:** `tabs.query` on the extension's own URL without the `tabs` permission has not been verified in a real Chrome.

## v1.3.3 — 2026-10-20
- Release bump (`manifest.json` 1.3.2 → 1.3.3) covering all 2026-10-20 entries below: docs sync, storage race, email snippets, stable selectors, dropdown follows anchor, fixes round 2. Reload the unpacked extension (permissions changed).

## 2026-10-20 — Fixes round 2
- **Fixed:** [content/selector.js](content/selector.js) — textarea no longer gets a bogus `[type="textarea"]`; form controls named `id`/`name`/`tagName`/`parentElement` can't shadow properties (no throw, hang or bogus selector); the unanchored `buildPath` fallback is replaced by an anchored nth-of-type path (unique by construction); dynamic-id heuristic also rejects `_r_…`, embedded `:rX:`/`«rX»`, `react-select-`, `cdk-`, `ui-id-`, `mantine-`. Known limit: 1–3 digit counter ids (`input25`) are treated as stable.
- **Fixed:** [content/dropdown.js](content/dropdown.js) / [content/content.js](content/content.js) — dropdown closes on anchor focus loss or removal (no more stale dropdown writing into the old field after Tab), keys act only while the anchor is active, contentEditable anchors on the editing host, ✕ button no longer a tab stop.
- **Fixed:** [content/snippet.js](content/snippet.js) — runs longer than 20 chars are no longer matched (`Z@exactly20chars12345` bug); safe against double injection; email fields skip suggestions when the typed character is clearly not at the end (best effort).
- **Fixed:** [manager/manager.js](manager/manager.js) edit sends only `{id}` + form fields (no stale `enabled` overwrite; closes if the entry was deleted elsewhere); [content/storage.js](content/storage.js) caches only after a successful write; selector text no longer uppercased in the manager.
- **Changed:** [manifest.json](manifest.json) — removed `host_permissions` (not needed; reload the unpacked extension).
- **Known limitations:** Ctrl+Z after snippet expansion can garble the field; cross-context simultaneous writes can still lose an update.

## 2026-10-20 — Dropdown follows its anchor
- **Fixed:** [content/dropdown.js](content/dropdown.js) now repositions while shown (window resize + capture-phase passive scroll, rAF-coalesced), flips above on bottom overflow, clamps horizontally into the viewport (right-edge alignment for RTL anchors), and hides when the anchor is removed, zero-size, scrolled out of view or clipped by an overflow ancestor. `hide()` removes all added listeners and cancels the pending rAF. Public API unchanged.
- **Known limitations:** clip detection doesn't cross shadow roots; a fixed/absolute anchor escaping an overflow ancestor may be hidden wrongly (rare).

## 2026-10-20 — Stable selectors
- **Fixed:** [content/selector.js](content/selector.js) no longer builds selectors from auto-generated ids (React `:r1:`, long digit runs, UUID/hash, `ember`/`ng-`/`mat-`/… prefixes); it falls back to name → placeholder → aria-label → type → `nth-of-type`. Public API unchanged.

## 2026-10-20 — Snippets in email inputs
- **Fixed:** [content/snippet.js](content/snippet.js) `getToken` falls back to the end of the value when `selectionStart` is null (`type=email`); [content/fill.js](content/fill.js) no longer throws from `setSelectionRange` on such inputs. Typing in the middle of the text is not supported there.

## 2026-10-20 — Storage race fix
- **Fixed:** [content/storage.js](content/storage.js) `addEntry/updateEntry/deleteEntry` now re-read storage and run through a serial queue (previously read-modify-write on a possibly stale cache could drop concurrent changes).
- **Changed:** [popup/popup.js](popup/popup.js) and [manager/manager.js](manager/manager.js) use `__afStorage` (loaded via `<script src="../content/storage.js">`) instead of duplicated load/save helpers.

## 2026-10-20 — Docs sync
- **Updated:** [CLAUDE.md](CLAUDE.md), [AGENT_CONTEXT.md](AGENT_CONTEXT.md), [PROJECT_MAP.md](PROJECT_MAP.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DEPENDENCIES.md](DEPENDENCIES.md) to match the v1.3.2 code: entries model (`af_entries`, `loadEntries/addEntry/…`), `opts.onAdd` dropdown footer, manager tab, snippets without `__afStorage` helpers, no credentials / Basic Auth / `webRequest`.
- **Changed:** [AGENTS.md](AGENTS.md) — was a stale copy of CLAUDE.md; now a pointer to it.
- **Added:** known-limitations list (no Shadow-DOM page fields, snippets not in email/number inputs, exact-hostname domain match).

## v1.3 — Entries model + manager tab
- **Changed:** rules with `options[]` replaced by flat entries in `af_entries` (legacy `af_rules` auto-migrated on first load).
- **Added:** [manager/manager.html](manager/manager.html) + [manager/manager.js](manager/manager.js) — standalone entries manager opened from the popup.
- **Added:** [content/snippet.js](content/snippet.js) — text-expansion snippets (`af_snippets`), `AF_SNIPPET_ENABLED` kill switch.
- **Added:** dropdown close (✕) button, "➕ הוסף מילוי חדש" footer button, saved-entries sub-list in the add-entry panel.
- **Removed:** credentials (`content/credential.js`), HTTP Basic Auth listener, `webRequest` / `webRequestAuthProvider` permissions.

## v1.1 — Credentials (since removed in v1.3)
- Global username/password for HTTP Basic Auth dialogs and detected login fields.

## v1.0 — initial release
- Rule-based autofill with URL matching (global / domain / url-contains) and CSS selectors.
- Right-click context menu to configure fields.
- Shadow-DOM dropdown + config panel.
- Popup for rule list / toggle / delete.
