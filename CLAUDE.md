# AutoFill Chrome Extension

Chrome MV3 extension. No build step — plain JS files loaded directly.

## Status: v1.1 — Credentials added
Core v1.0 complete. v1.1 adds global username/password (single credential) for HTTP Basic Auth + login form fields.
Load as unpacked extension from this directory.

---

## File Map

| File | Exports | Role |
|------|---------|------|
| `manifest.json` | — | MV3 config, permissions, content script load order |
| `background.js` | — | Service worker: context menu + message routing + HTTP Basic Auth autofill |
| `content/storage.js` | `window.__afStorage` | chrome.storage.local wrapper for rules |
| `content/selector.js` | `window.__afSelector` | Generate stable CSS selectors from DOM elements |
| `content/fill.js` | `window.__afFill` | Fill input/textarea/contentEditable fields |
| `content/dropdown.js` | `window.__afDropdown` | Shadow DOM dropdown UI |
| `content/config-panel.js` | `window.__afConfig` | Shadow DOM config panel (add/edit rules) |
| `content/credential.js` | `window.__afCredential` | Global credential storage + username/password field detection |
| `content/content.js` | `window.__afContent` | Orchestrator: focus → match → dropdown (also injects credential into dropdown for login fields) |
| `popup/popup.html` + `popup.js` | — | Extension popup: credential editor + list/toggle/delete rules |

Content scripts load order (critical): `storage → selector → fill → dropdown → config-panel → credential → content`

---

## Public APIs

### `window.__afStorage`
```
loadRules()           → Promise<Rule[]>
saveRules(rules)      → Promise
addRule(rule)         → Promise<Rule>    // auto-generates id + created
updateRule(rule)      → Promise
deleteRule(id)        → Promise
```

### `window.__afSelector`
```
generate(element)     → string    // best CSS selector for element
isUnique(selector)    → boolean   // true if matches exactly 1 element
```

### `window.__afFill`
```
fillField(el, value)  → void      // works for input/textarea/contentEditable
```

### `window.__afDropdown`
```
show(anchorEl, items[], onSelect, onEdit)   → void
  // items: array of { name?, value } OR strings (treated as { value: s })
  // Render: name present → two-line (bold name + gray monospace value).
  //         name absent  → single-line value.
  // onSelect receives the value string.
hide()                                      → void
isVisible()                                 → boolean
getAnchor()                                 → element | null   // currently anchored field
```

### `window.__afConfig`
```
show(element, existingRule | null) → void   // null = create new rule
hide()                             → void
```

### `window.__afContent`
```
refreshRules()  → void   // reload rules from storage (called by config-panel after save)
```

### `window.__afCredential`
```
load()                       → Promise<{username, password} | null>
save(username, password)     → Promise
clear()                      → Promise
isUsernameField(el)          → boolean   // checks type/autocomplete/id/name/class/placeholder/label/aria/data-* + Hebrew terms
isPasswordField(el)          → boolean   // checks type=password + masked-text patterns + Hebrew "סיסמ"
```

Kill switches:
- `AF_CREDENTIAL_ENABLED` (top of `content/credential.js`) — disables dropdown credential offers
- `AF_BASIC_AUTH_ENABLED` (top of `background.js`) — disables HTTP Basic Auth autofill

---

## Storage Schema

### Rules — key: `af_rules`

```json
[
  {
    "id": "r_1716xxx_abc",
    "matchType": "global" | "domain" | "url-contains",
    "matchValue": "",
    "selector": "input[name='email']",
    "label": "אימייל",
    "options": [
      { "name": "אישי", "value": "user@gmail.com" },
      { "name": "",     "value": "work@company.com" }
    ],
    "enabled": true,
    "created": 1716000000
  }
]
```

### URL matching modes
- `matchType: "global"` → matches every page (matchValue ignored)
- `matchType: "domain"` → matchValue = hostname (e.g. `"example.com"`), matches exact hostname
- `matchType: "url-contains"` → matchValue = substring, matches if `location.href.includes(matchValue)` (case-sensitive)

### Option shape
Each option is `{ name, value }`. `name` is optional — shown in dropdown as `"name — value"` when present, otherwise just `value`. Filling always uses `value`.

### Backward compat
- Old rules with only a `domain` field still work. `content.js#urlMatches` and `popup.js` both fall back: `domain === "*"` → global, anything else → domain match. New writes use `matchType` + `matchValue` and strip the legacy `domain` field on update.
- Old options stored as plain strings are auto-normalized in `content.js` and `config-panel.js#normalizeOpt` to `{ name: '', value: str }`.

Rules matched using native `element.matches(selector)` after URL check passes.

### Credential — key: `af_credential`
```json
{ "username": "user@example.com", "password": "secret123" }
```
Singular (one global credential, not per-site). Plaintext in `chrome.storage.local`.
Used by `background.js` for HTTP Basic Auth (via `webRequest.onAuthRequired`) and by `content.js` (via `__afCredential`) to prepend a saved-credential row to the dropdown on username/password fields.

---

## Manifest Permissions
`storage`, `contextMenus`, `webRequest`, `webRequestAuthProvider` — last two enable Basic Auth interception in `background.js`.

---

## How It Works

1. **Configure**: right-click any text field → "⚡ AutoFill: הגדר אפשרויות לשדה זה" → config panel opens
2. **Use**: focus OR click a configured field → dropdown appears → click option → field filled
3. **Edit**: click "⚙️ ערוך אפשרויות" in the dropdown, or open extension popup

Trigger: `content.js` binds `tryShow` to both `focus` and `click` events (capture phase).
The visibility-check (`isVisible() && getAnchor() === el`) prevents flicker on first click.

---

## Testing Each Module in Isolation

```js
// Check storage
await window.__afStorage.loadRules()
await window.__afStorage.addRule({ domain:'*', selector:'input', label:'test', options:['a','b'] })

// Check selector
window.__afSelector.generate(document.querySelector('input'))
window.__afSelector.isUnique('input[name="q"]')

// Check fill
window.__afFill.fillField(document.querySelector('input'), 'hello world')

// Check dropdown (open on currently focused input)
window.__afDropdown.show(document.activeElement, ['opt 1','opt 2'], v=>console.log(v), ()=>{})

// Check config panel
window.__afConfig.show(document.querySelector('input'), null)

// Check credential
await window.__afCredential.save('user@example.com', 'secret')
await window.__afCredential.load()
window.__afCredential.isPasswordField(document.querySelector('input[type=password]'))
window.__afCredential.isUsernameField(document.querySelector('input[type=email]'))
```

---

## What's NOT supported
- `<select>`, checkbox, radio fields (different UX needed)
- Import/export rules
- Rule reordering in popup
- Multiple credentials per site (only one global credential)
- Encryption-at-rest for credential (plaintext in `chrome.storage.local`)
