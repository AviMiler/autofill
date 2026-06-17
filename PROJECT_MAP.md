# Project Map
_Last updated: 2026-06-03_

See [AGENT_CONTEXT.md](AGENT_CONTEXT.md) for what the project does.

## File Tree
```
AutoFill/
├── manifest.json
├── background.js
├── content/
│   ├── storage.js
│   ├── selector.js
│   ├── fill.js
│   ├── dropdown.js
│   ├── config-panel.js
│   ├── credential.js
│   └── content.js
├── popup/
│   ├── popup.html
│   └── popup.js
├── icons/
│   └── icon128.png
├── CLAUDE.md
├── AGENT_CONTEXT.md
├── PROJECT_MAP.md       (this file)
├── ARCHITECTURE.md
├── CHANGELOG.md
└── DEPENDENCIES.md
```

## File Descriptions

### Root
| File | Description |
|------|-------------|
| [manifest.json](manifest.json) | MV3 manifest — permissions, content-script load order, action popup |
| [background.js](background.js) | Service worker — context menu + HTTP Basic Auth listener (`onAuthRequired`) |

### content/ — content scripts (all IIFE, all expose `window.__af*`)
| File | Exports | Role |
|------|---------|------|
| [content/storage.js](content/storage.js) | `window.__afStorage` | `chrome.storage.local` wrapper for rules (`af_rules` key) |
| [content/selector.js](content/selector.js) | `window.__afSelector` | Generate stable CSS selectors from DOM elements |
| [content/fill.js](content/fill.js) | `window.__afFill` | Fill input / textarea / contentEditable with a value |
| [content/dropdown.js](content/dropdown.js) | `window.__afDropdown` | Shadow-DOM dropdown UI shown on focus/click |
| [content/config-panel.js](content/config-panel.js) | `window.__afConfig` | Shadow-DOM panel for adding/editing rules |
| [content/credential.js](content/credential.js) | `window.__afCredential` | Global credential storage (`af_credential` key) + username/password field detection |
| [content/content.js](content/content.js) | `window.__afContent` | Orchestrator: focus/click → match rules → show dropdown (and prepend saved credential row on login fields) |

### popup/
| File | Description |
|------|-------------|
| [popup/popup.html](popup/popup.html) | Popup markup — credential editor + rules list (RTL Hebrew) |
| [popup/popup.js](popup/popup.js) | Popup logic — load/save/clear credential, render/toggle/delete rules |

### icons/
| File | Description |
|------|-------------|
| icons/icon128.png | 128×128 extension icon (only size used) |

### Docs
| File | Description |
|------|-------------|
| [CLAUDE.md](CLAUDE.md) | Full API reference, storage schema, testing snippets |
| [AGENT_CONTEXT.md](AGENT_CONTEXT.md) | Entry point for a new agent — current state, gotchas |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Data flow, decisions, security model |
| [CHANGELOG.md](CHANGELOG.md) | Dated change log |
| [DEPENDENCIES.md](DEPENDENCIES.md) | (None — no npm deps) |

## Content-script load order
Defined in [manifest.json](manifest.json) `content_scripts[0].js`. Order is critical because each module reads `window.__af*` exports of earlier modules:

```
storage.js → selector.js → fill.js → dropdown.js → config-panel.js → credential.js → content.js
```

`content.js` must remain last — it orchestrates all the others.
