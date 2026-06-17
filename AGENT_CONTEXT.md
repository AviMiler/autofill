# Agent Context
_Last updated: 2026-06-03 — added global credential feature (v1.1)_

## What This Project Is
**AutoFill** — Chrome MV3 extension that lets a user save text snippets for any web form field (matched by URL + CSS selector) and inject them via a popup dropdown on focus/click. v1.1 adds one global username/password used for HTTP Basic Auth dialogs and detected login fields.

No build step. Plain JS files loaded directly. Hebrew UI (RTL).

## Current State
- ✅ Working: rule CRUD, dropdown on focus/click, context-menu "Configure", URL match modes (global/domain/url-contains), popup management, credential autofill for Basic Auth + login fields
- 🚧 WIP: —
- ❌ Known Issues: credential stored plaintext in `chrome.storage.local` (acceptable for closed network — see [ARCHITECTURE.md](ARCHITECTURE.md#security-model))

## Last Changes
- 2026-06-03 — Added credential feature: [content/credential.js](content/credential.js) (new), Basic Auth listener in [background.js](background.js), credential row injection in [content/content.js](content/content.js), credential editor section in [popup/popup.html](popup/popup.html) + [popup/popup.js](popup/popup.js), manifest permissions `webRequest` + `webRequestAuthProvider`. Kill switches added.

## Entry Points
- [manifest.json](manifest.json) — extension manifest, permissions, content-script load order
- [background.js](background.js) — service worker (context menu + Basic Auth)
- [content/content.js](content/content.js) — content-script orchestrator
- [popup/popup.html](popup/popup.html) — toolbar popup

## Key Patterns Used
- All content modules are IIFEs exporting `window.__af*` (no bundler, no imports)
- All storage access goes through `chrome.storage.local` directly (rules via [content/storage.js](content/storage.js), credential via [content/credential.js](content/credential.js))
- All UI uses Shadow DOM for CSS isolation ([content/dropdown.js](content/dropdown.js), [content/config-panel.js](content/config-panel.js))
- Content-script load order is **critical** — see [PROJECT_MAP.md](PROJECT_MAP.md#content-script-load-order)
- Kill switches at top of files: `AF_CREDENTIAL_ENABLED`, `AF_BASIC_AUTH_ENABLED`

## Next Steps
- [ ] `<select>` / checkbox / radio support (different UX)
- [ ] Import/export rules
- [ ] Rule reordering in popup

## Gotchas / Watch Out
- **No build step.** Don't add `import`/`export`. Use `window.__af*` namespace.
- **Content-script load order matters** — see [manifest.json](manifest.json). `content.js` must be last.
- **`all_frames: true`** — content scripts run in iframes too. Guard with `if (window.__afXLoaded) return;` to avoid double-init.
- **Service worker has no DOM** — `background.js` can't touch `document` / `window`.
- **`isPasswordField` is broad** — matches `type=password`, `autocomplete=current-password/new-password`, and id/name/class/aria/data-* + Hebrew "סיסמ". Don't narrow without checking real-world login forms.
- **Credential plaintext** — fine for closed network only. Don't ship publicly without encryption.
- See [ARCHITECTURE.md](ARCHITECTURE.md) for full design.
- See [CLAUDE.md](CLAUDE.md) for full API reference + storage schema.
