# Dependencies

See [AGENT_CONTEXT.md](AGENT_CONTEXT.md) for what the project is.

## Runtime dependencies
**None.** This project has no `package.json` and no third-party JS.

| Surface | Uses |
|---------|------|
| All content scripts | Browser DOM APIs only |
| [background.js](background.js) | `chrome.contextMenus`, `chrome.tabs`, `chrome.runtime`, `chrome.storage`, `chrome.webRequest` |
| [popup/popup.js](popup/popup.js) | `chrome.storage` |

## Build dependencies
**None.** No bundler, no transpiler. Files are loaded directly by Chrome as listed in [manifest.json](manifest.json).

## Chrome API requirements
Set in [manifest.json](manifest.json):

| Permission | Used by | Reason |
|------------|---------|--------|
| `storage` | all surfaces | Persist rules (`af_rules`) and credential (`af_credential`) |
| `contextMenus` | [background.js](background.js) | "Configure this field" right-click entry |
| `webRequest` | [background.js](background.js) | Needed to register `onAuthRequired` listener |
| `webRequestAuthProvider` | [background.js](background.js) | Required (MV3) to call `callback({authCredentials})` and bypass Basic Auth dialog |
| `host_permissions: ["<all_urls>"]` | content scripts + Basic Auth listener | Extension must run on every page |

## Why no dependencies
- Project is small enough that pulling in libraries adds more risk than it saves.
- No build step → editing JS files reloads instantly via `chrome://extensions` Reload button.
- Avoids supply-chain risk on an extension that holds credentials.
