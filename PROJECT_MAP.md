# Project Map
_Last updated: 2026-10-20_

See [AGENT_CONTEXT.md](AGENT_CONTEXT.md) for what the project does.

## File Tree
```
AutoFill/
├── manifest.json
├── background.js
├── icon.png
├── content/
│   ├── storage.js
│   ├── selector.js
│   ├── fill.js
│   ├── dropdown.js
│   ├── config-panel.js
│   ├── snippet.js
│   └── content.js
├── manager/
│   ├── manager.html
│   └── manager.js
├── popup/
│   ├── popup.html
│   └── popup.js
├── CLAUDE.md
├── AGENTS.md            (pointer to CLAUDE.md)
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
| [background.js](background.js) | Service worker — registers the right-click context menu and forwards `open-config` to the content script |
| icon.png | Extension icon (used for toolbar and 128px icon) |

### content/ — content scripts (all IIFE, all expose `window.__af*`)
| File | Exports | Role |
|------|---------|------|
| [content/storage.js](content/storage.js) | `window.__afStorage` | `chrome.storage.local` wrapper for entries (`af_entries`), migrates legacy `af_rules` |
| [content/selector.js](content/selector.js) | `window.__afSelector` | Generate stable CSS selectors from DOM elements |
| [content/fill.js](content/fill.js) | `window.__afFill` | Fill input / textarea / contentEditable; replace typed snippet trigger |
| [content/dropdown.js](content/dropdown.js) | `window.__afDropdown` | Shadow-DOM dropdown UI shown on focus/click and for snippet suggestions |
| [content/config-panel.js](content/config-panel.js) | `window.__afConfig` | Shadow-DOM panel for adding an entry + per-field saved-entries sub-list |
| [content/snippet.js](content/snippet.js) | `window.__afSnippet` | Snippet cache (`af_snippets`) + trigger-token matching |
| [content/content.js](content/content.js) | `window.__afContent` | Orchestrator: focus/click → match entries → dropdown; `input` → snippet suggestions |

### manager/ — standalone extension page
| File | Description |
|------|-------------|
| [manager/manager.html](manager/manager.html) | Manager markup — searchable list grouped by selector, add/edit modal |
| [manager/manager.js](manager/manager.js) | Full CRUD over `af_entries` via `__afStorage` (loads `content/storage.js`) |

### popup/
| File | Description |
|------|-------------|
| [popup/popup.html](popup/popup.html) | Popup markup — "open manager" button, entries list, snippet editor (RTL Hebrew) |
| [popup/popup.js](popup/popup.js) | Popup logic — render/toggle/delete entries, add/delete snippets, open manager tab |

### Docs
| File | Description |
|------|-------------|
| [CLAUDE.md](CLAUDE.md) | Full API reference, storage schema, testing snippets |
| [AGENTS.md](AGENTS.md) | Pointer to CLAUDE.md |
| [AGENT_CONTEXT.md](AGENT_CONTEXT.md) | Entry point for a new agent — current state, gotchas |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Data flow, decisions, security model |
| [CHANGELOG.md](CHANGELOG.md) | Dated change log |
| [DEPENDENCIES.md](DEPENDENCIES.md) | (None — no npm deps) |

## Content-script load order
Defined in [manifest.json](manifest.json) `content_scripts[0].js`. Order is critical because each module reads `window.__af*` exports of earlier modules:

```
storage.js → selector.js → fill.js → dropdown.js → config-panel.js → snippet.js → content.js
```

`content.js` must remain last — it orchestrates all the others.
