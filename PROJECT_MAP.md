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
│   ├── manager.css
│   ├── dom.js
│   ├── entry-editor.js
│   ├── snippets.js
│   ├── backup.js
│   └── manager.js
├── CLAUDE.md
├── AGENTS.md            (pointer to CLAUDE.md)
├── AGENT_CONTEXT.md
├── PROJECT_MAP.md       (this file)
├── ARCHITECTURE.md
├── CHANGELOG.md
├── DECISIONS.md
└── DEPENDENCIES.md
```

## File Descriptions

### Root
| File | Description |
|------|-------------|
| [manifest.json](manifest.json) | MV3 manifest — permissions (`storage`, `contextMenus`, `activeTab`), content-script load order, action without a popup |
| [background.js](background.js) | Service worker — right-click context menu (`open-config` to the content script); toolbar click and `open-manager` message → `openManager()` (focus or open the manager tab with a hash filter) |
| icon.png | Extension icon (used for toolbar and 128px icon) |

### content/ — content scripts (all IIFE, all expose `window.__af*`)
| File | Exports | Role |
|------|---------|------|
| [content/storage.js](content/storage.js) | `window.__afStorage` | `chrome.storage.local` wrapper for entries (`af_entries`), migrates legacy `af_rules`; `restoreEntries`, `appliesToUrl` |
| [content/selector.js](content/selector.js) | `window.__afSelector` | Generate stable CSS selectors from DOM elements |
| [content/fill.js](content/fill.js) | `window.__afFill` | Fill input / textarea / contentEditable; replace typed snippet trigger |
| [content/dropdown.js](content/dropdown.js) | `window.__afDropdown` | Shadow-DOM dropdown UI shown on focus/click and for snippet suggestions |
| [content/config-panel.js](content/config-panel.js) | `window.__afConfig` | Shadow-DOM panel for adding an entry + per-field saved-entries sub-list |
| [content/snippet.js](content/snippet.js) | `window.__afSnippet` | Snippet cache (`af_snippets`) + trigger-token matching |
| [content/content.js](content/content.js) | `window.__afContent` | Orchestrator: focus/click → match entries → dropdown; `input` → snippet suggestions |

### manager/ — standalone extension page
| File | Description |
|------|-------------|
| [manager/manager.html](manager/manager.html) | Manager markup — collapsible snippets section at top, filter chips, list grouped by selector (RTL Hebrew) |
| [manager/manager.css](manager/manager.css) | Manager styles |
| [manager/dom.js](manager/dom.js) | Shared helpers on `window.__afMgr`: `el`, `scopeBadge`, `showToast` |
| [manager/entry-editor.js](manager/entry-editor.js) | Inline row editor (`buildEditor`) — replaces the old modal |
| [manager/snippets.js](manager/snippets.js) | Snippet add/delete (`af_snippets`), `loadSnippets`/`saveSnippets`; open state in `af_ui_snippets_open` |
| [manager/backup.js](manager/backup.js) | JSON export/import of entries + snippets, merge by id |
| [manager/manager.js](manager/manager.js) | State, filter chips (all/global/page/by-domain), selector pill, hash handling, list render, delete + undo toast; entries via `__afStorage` |

### Docs
| File | Description |
|------|-------------|
| [CLAUDE.md](CLAUDE.md) | Full API reference, storage schema, testing snippets |
| [AGENTS.md](AGENTS.md) | Pointer to CLAUDE.md |
| [AGENT_CONTEXT.md](AGENT_CONTEXT.md) | Entry point for a new agent — current state, gotchas |
| [DECISIONS.md](DECISIONS.md) | Decision log (alternatives and reasoning) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Data flow, decisions, security model |
| [CHANGELOG.md](CHANGELOG.md) | Dated change log |
| [DEPENDENCIES.md](DEPENDENCIES.md) | (None — no npm deps) |

## Content-script load order
Defined in [manifest.json](manifest.json) `content_scripts[0].js`. Order is critical because each module reads `window.__af*` exports of earlier modules:

```
storage.js → selector.js → fill.js → dropdown.js → config-panel.js → snippet.js → content.js
```

`content.js` must remain last — it orchestrates all the others.
