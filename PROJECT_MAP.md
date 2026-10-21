# Project Map
_Last updated: 2026-10-21 (v1.5.0)_

See [AGENT_CONTEXT.md](AGENT_CONTEXT.md) for what the project does.

## File Tree
```
AutoFill/
├── manifest.json
├── background.js
├── icons/               (icon-16/32/48/128.png + logo.svg source)
├── docs/
│   └── REDESIGN-v1.5.md (full spec + rationale of the v1.5 UI redesign, Hebrew)
├── content/
│   ├── storage.js
│   ├── selector.js
│   ├── fill.js
│   ├── icons.js
│   ├── dropdown.js
│   ├── config-panel.js
│   ├── snippet.js
│   └── content.js
├── manager/
│   ├── manager.html
│   ├── manager.css
│   ├── fonts/           (Rubik woff2 Hebrew + Latin, OFL.txt)
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
| icons/ | Extension icon PNGs (16/32/48/128, toolbar + extensions page) and the `logo.svg` source they were rendered from |

### content/ — content scripts (all IIFE, all expose `window.__af*`)
| File | Exports | Role |
|------|---------|------|
| [content/storage.js](content/storage.js) | `window.__afStorage` | `chrome.storage.local` wrapper for entries (`af_entries`), migrates legacy `af_rules`; `restoreEntries`, `appliesToUrl` |
| [content/selector.js](content/selector.js) | `window.__afSelector` | Generate stable CSS selectors from DOM elements |
| [content/fill.js](content/fill.js) | `window.__afFill` | Fill input / textarea / contentEditable; replace typed snippet trigger |
| [content/icons.js](content/icons.js) | `window.__afIcons` | Inline SVG icon set shared by the in-page UI and the manager |
| [content/dropdown.js](content/dropdown.js) | `window.__afDropdown` | Shadow-DOM dropdown UI shown on focus/click and for snippet suggestions (pre-selected first item, keyboard hints) |
| [content/config-panel.js](content/config-panel.js) | `window.__afConfig` | Shadow-DOM popover anchored to the field for adding an entry + per-field saved-entries view |
| [content/snippet.js](content/snippet.js) | `window.__afSnippet` | Snippet cache (`af_snippets`) + trigger-token matching |
| [content/content.js](content/content.js) | `window.__afContent` | Orchestrator: focus/click → match entries → dropdown; `input` → snippet suggestions |

### manager/ — standalone extension page
| File | Description |
|------|-------------|
| [manager/manager.html](manager/manager.html) | Manager markup — sidebar (views + site filter) and three views: entries, snippets, backup (RTL Hebrew) |
| [manager/manager.css](manager/manager.css) | Design tokens (light/dark), Rubik @font-face, all manager styles, responsive < 820px |
| [manager/dom.js](manager/dom.js) | Shared helpers on `window.__afMgr`: `el`, `icon`, `hydrateIcons`, `iconButton`, `toggle`, `scopeBadge`, `copyButton`, `emptyState`, `showToast` |
| [manager/entry-editor.js](manager/entry-editor.js) | Inline row editor (`buildEditor`) — replaces the old modal |
| [manager/snippets.js](manager/snippets.js) | Snippets view: add / inline edit / delete with undo (`af_snippets`), `loadSnippets`/`saveSnippets` |
| [manager/backup.js](manager/backup.js) | Backup view: JSON export/import of entries + snippets (merge by id), stored-items stats |
| [manager/manager.js](manager/manager.js) | State, views, sidebar site filter (all/page/global/each domain/custom URLs), selector pill, hash handling, list render, copy, delete + undo toast; entries via `__afStorage` |

### Docs
| File | Description |
|------|-------------|
| [CLAUDE.md](CLAUDE.md) | Full API reference, storage schema, testing snippets |
| [AGENTS.md](AGENTS.md) | Pointer to CLAUDE.md |
| [AGENT_CONTEXT.md](AGENT_CONTEXT.md) | Entry point for a new agent — current state, gotchas |
| [DECISIONS.md](DECISIONS.md) | Decision log (alternatives and reasoning) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Data flow, decisions, security model |
| [CHANGELOG.md](CHANGELOG.md) | Dated change log |
| [DEPENDENCIES.md](DEPENDENCIES.md) | (No npm deps; bundled Rubik font) |
| [docs/REDESIGN-v1.5.md](docs/REDESIGN-v1.5.md) | v1.5 redesign: decisions Q&A, design system, per-surface spec, per-file code changes, tests |

## Content-script load order
Defined in [manifest.json](manifest.json) `content_scripts[0].js`. Order is critical because each module reads `window.__af*` exports of earlier modules:

```
storage.js → selector.js → fill.js → icons.js → dropdown.js → config-panel.js → snippet.js → content.js
```

`content.js` must remain last — it orchestrates all the others.
