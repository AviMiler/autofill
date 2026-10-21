# Dependencies

See [AGENT_CONTEXT.md](AGENT_CONTEXT.md) for what the project is.

## Runtime dependencies
**No JS dependencies.** This project has no `package.json` and no third-party JS.

Bundled assets:

| Asset | Source | License |
|-------|--------|---------|
| [manager/fonts/](manager/fonts/) `rubik-hebrew.woff2`, `rubik-latin.woff2` | Rubik variable font, `@fontsource-variable/rubik@5.1.0` (npm) | SIL OFL 1.1 — [manager/fonts/OFL.txt](manager/fonts/OFL.txt) |
| [content/icons.js](content/icons.js) | Icon shapes drawn in the Lucide style (thin stroke, 24×24) | ISC-style (Lucide); inline, no package |

The font is only used by the manager page; injected UI inside web pages uses the system font (no font loading into third-party pages).

| Surface | Uses |
|---------|------|
| All content scripts | Browser DOM APIs + `chrome.storage` |
| [background.js](background.js) | `chrome.contextMenus`, `chrome.action`, `chrome.tabs`, `chrome.windows`, `chrome.runtime` |
| [manager/](manager/) scripts | `chrome.storage`, Blob/`URL.createObjectURL` + file input for JSON export/import |

## Build dependencies
**None.** No bundler, no transpiler. Files are loaded directly by Chrome as listed in [manifest.json](manifest.json).

## Chrome API requirements
Set in [manifest.json](manifest.json):

| Permission | Used by | Reason |
|------------|---------|--------|
| `storage` | all surfaces | Persist entries (`af_entries`) and snippets (`af_snippets`) |
| `contextMenus` | [background.js](background.js) | "Configure this field" right-click entry |
| `activeTab` | [background.js](background.js) | Read the clicked tab's URL on toolbar-icon click (manager site pre-filter) |

No `host_permissions` and no `tabs` permission: content scripts are injected via `content_scripts.matches` (`<all_urls>`), and the background only uses `chrome.tabs.sendMessage`, `tabs.create/update` and a `tabs.query` on the extension's own manager URL (the latter without `tabs` permission is unverified in a real Chrome).

## Why no dependencies
- Project is small enough that pulling in libraries adds more risk than it saves.
- No build step → editing JS files reloads instantly via `chrome://extensions` Reload button.
