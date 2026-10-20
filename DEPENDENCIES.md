# Dependencies

See [AGENT_CONTEXT.md](AGENT_CONTEXT.md) for what the project is.

## Runtime dependencies
**None.** This project has no `package.json` and no third-party JS.

| Surface | Uses |
|---------|------|
| All content scripts | Browser DOM APIs + `chrome.storage` |
| [background.js](background.js) | `chrome.contextMenus`, `chrome.tabs`, `chrome.runtime` |
| [popup/popup.js](popup/popup.js) | `chrome.storage`, `chrome.tabs`, `chrome.runtime` |
| [manager/manager.js](manager/manager.js) | `chrome.storage` |

## Build dependencies
**None.** No bundler, no transpiler. Files are loaded directly by Chrome as listed in [manifest.json](manifest.json).

## Chrome API requirements
Set in [manifest.json](manifest.json):

| Permission | Used by | Reason |
|------------|---------|--------|
| `storage` | all surfaces | Persist entries (`af_entries`) and snippets (`af_snippets`) |
| `contextMenus` | [background.js](background.js) | "Configure this field" right-click entry |

No `host_permissions`: content scripts are injected via `content_scripts.matches` (`<all_urls>`), and the background only uses `chrome.tabs.sendMessage`.

## Why no dependencies
- Project is small enough that pulling in libraries adds more risk than it saves.
- No build step → editing JS files reloads instantly via `chrome://extensions` Reload button.
