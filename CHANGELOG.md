# Changelog

See [AGENT_CONTEXT.md](AGENT_CONTEXT.md) for current state and [ARCHITECTURE.md](ARCHITECTURE.md) for design.

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
