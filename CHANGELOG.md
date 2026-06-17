# Changelog

See [AGENT_CONTEXT.md](AGENT_CONTEXT.md) for current state and [ARCHITECTURE.md](ARCHITECTURE.md) for design.

## 2026-06-03 — v1.1 Credentials
- **Added:** [content/credential.js](content/credential.js) — `window.__afCredential` with `load` / `save` / `clear` / `isUsernameField` / `isPasswordField`. Broad detection: type, autocomplete, id, name, class, placeholder, aria-*, `formcontrolname`, `data-*`, linked `<label>`, plus Hebrew terms (סיסמ, משתמש, אימייל, ...).
- **Added:** [background.js](background.js) — `chrome.webRequest.onAuthRequired` listener with `asyncBlocking` so HTTP Basic Auth dialogs auto-fill from `af_credential`.
- **Added:** [popup/popup.html](popup/popup.html) + [popup/popup.js](popup/popup.js) — credential editor section at top of popup (username, password with show/hide toggle, save, clear, status).
- **Changed:** [content/content.js](content/content.js) `tryShow` — on username/password fields, prepends saved credential to dropdown items.
- **Changed:** [manifest.json](manifest.json) — added permissions `webRequest`, `webRequestAuthProvider`; added `content/credential.js` to content-script load order (before `content.js`).
- **Added:** Kill switches `AF_CREDENTIAL_ENABLED` (top of [content/credential.js](content/credential.js)) and `AF_BASIC_AUTH_ENABLED` (top of [background.js](background.js)) for one-line disable.
- **Updated:** [CLAUDE.md](CLAUDE.md) — credential API, storage schema, permissions, testing snippet.
- **Added:** Tracking files [AGENT_CONTEXT.md](AGENT_CONTEXT.md), [PROJECT_MAP.md](PROJECT_MAP.md), [ARCHITECTURE.md](ARCHITECTURE.md), [CHANGELOG.md](CHANGELOG.md), [DEPENDENCIES.md](DEPENDENCIES.md).

## v1.0 — initial release
- Rule-based autofill with URL matching (global / domain / url-contains) and CSS selectors.
- Right-click context menu to configure fields.
- Shadow-DOM dropdown + config panel.
- Popup for rule list / toggle / delete.
- See [CLAUDE.md](CLAUDE.md) for full v1.0 spec.
