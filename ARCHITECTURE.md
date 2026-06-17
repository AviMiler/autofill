# Architecture
_Last updated: 2026-06-03_

See [AGENT_CONTEXT.md](AGENT_CONTEXT.md) for project status and [PROJECT_MAP.md](PROJECT_MAP.md) for file layout.

## Overview
AutoFill is a Chrome MV3 extension that injects user-defined text into form fields. Two surfaces of data:
1. **Rules** — `(URL match × CSS selector) → [options]` for per-field text snippets.
2. **Credential** — one global `{username, password}` for HTTP Basic Auth dialogs and detected login fields.

No build step, no framework, no dependencies. All modules are IIFEs hanging off `window.__af*`.

## Extension Architecture

### Context Boundaries
| Context | Has DOM | Has chrome.* | Can message |
|---------|---------|--------------|-------------|
| Background (service worker — [background.js](background.js)) | ❌ | ✅ full | → content scripts via `chrome.tabs.sendMessage` |
| Content scripts ([content/*.js](content/)) | ✅ (host page) | ✅ limited | ← background, reads `chrome.storage.local` directly |
| Popup ([popup/popup.js](popup/popup.js)) | ✅ (own page) | ✅ limited | reads/writes `chrome.storage.local` directly |

### Message Flow

**Rule configuration (right-click flow):**
1. User right-clicks editable field → Chrome shows context menu (registered by [background.js](background.js))
2. User clicks "⚡ AutoFill: הגדר אפשרויות לשדה זה"
3. [background.js](background.js) calls `chrome.tabs.sendMessage(tabId, {action: 'open-config'}, {frameId})`
4. [content/content.js](content/content.js)'s `onMessage` handler finds the last right-clicked editable element via `findEditableTarget` (walks up DOM)
5. [content/config-panel.js](content/config-panel.js) renders Shadow-DOM panel
6. On save, [content/storage.js](content/storage.js) writes to `chrome.storage.local['af_rules']`
7. `chrome.storage.onChanged` fires → both [content/content.js](content/content.js) and [popup/popup.js](popup/popup.js) refresh their cached rules

**Field-fill flow:**
1. User focuses/clicks editable field → capture-phase listener in [content/content.js](content/content.js) fires
2. `tryShow` checks: visible already? (skip), matches any rule? (collect options), is credential field? (prepend saved credential)
3. [content/dropdown.js](content/dropdown.js) shows Shadow-DOM dropdown
4. User clicks option → [content/fill.js](content/fill.js) writes value to the element

**HTTP Basic Auth flow:**
1. Page triggers Basic Auth challenge (HTTP 401 + `WWW-Authenticate: Basic`)
2. Chrome fires `chrome.webRequest.onAuthRequired` (registered in [background.js](background.js) with `asyncBlocking`)
3. Listener reads `af_credential` from storage. If set → calls `callback({authCredentials: {username, password}})` and the native dialog is bypassed. If unset → calls `callback({})` and the native dialog appears.

## Key Decisions
| Decision | Why |
|----------|-----|
| No build step / plain JS | Project is small enough; faster iteration; no toolchain to maintain |
| IIFE + `window.__af*` namespace | Required because content scripts share a single global scope and there's no module loader |
| Shadow DOM for all injected UI | Isolates extension CSS from host-page styles in both directions |
| Capture-phase event listeners | Beats site-level handlers that call `stopPropagation` (e.g. SAP UI5) |
| Single global credential | Spec says one — user is on a private network with one account |
| Plaintext credential storage | Acceptable for closed network (see security model below); encryption would require a master password UX |
| Kill switches as top-of-file constants | Easiest way to disable a feature without removing code; documented in [CLAUDE.md](CLAUDE.md) |
| Backward-compatible rule shape | Old rules stored only `domain` field; new code falls back gracefully (see [content/content.js](content/content.js)#urlMatches) |

## Patterns
- **`window.__af*` IIFE module**: every content module wraps an `(() => { ... })()` with idempotent guard `if (window.__afXLoaded) return;` (or similar), assigns its API to a `window.__af*` global. See any file under [content/](content/).
- **`chrome.storage.onChanged` for cache sync**: modules that cache storage values (e.g. [content/content.js](content/content.js) caches `rules`) re-read on change events to stay current across tabs and popup edits.
- **`findEditableTarget` walk-up**: right-click targets can be overlays on top of inputs. [content/content.js](content/content.js) walks up `parentElement` until it finds an editable ancestor.
- **Field signal aggregation**: [content/credential.js](content/credential.js)'s `fieldSignals` collects every textual attribute (id, name, class, placeholder, label, aria-*, formcontrolname, data-*) into one lowercase string for substring matching. Lets one detector handle Angular/React/plain HTML.

## Security Model
- **Threat model:** single-user closed network, no external traffic. No untrusted scripts on visited pages.
- **What's safe:**
  - `chrome.storage.local` is isolated per-extension; no other extension can read `af_credential`.
  - Shadow DOM prevents host pages from reading dropdown contents before the user selects.
- **What's not protected:**
  - Credential is plaintext on disk in the Chrome profile.
  - `onAuthRequired` listener responds to **any** URL — fine in closed network, dangerous on open web.
  - Field detection is permissive — could fill a hidden `id="password"` injected by a malicious page.
  - `all_frames: true` — credential dropdown can appear in third-party iframes.
- **Mitigations available** (currently unused, see [AGENT_CONTEXT.md](AGENT_CONTEXT.md) "Gotchas"): kill switches `AF_CREDENTIAL_ENABLED` and `AF_BASIC_AUTH_ENABLED` disable each surface independently.
