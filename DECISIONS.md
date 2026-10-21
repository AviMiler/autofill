# Decisions

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design these decisions shaped.

## [2026-10-21] v1.5 UI redesign — minimal neutral, decided with the user question by question
**Decision:** Minimal neutral design (black/white accent, thin 1px lines), light/dark following the system, inline SVG
icons instead of emoji, bundled Rubik font in the manager (system font inside web pages). Manager = sidebar + content
with entries grouped by field and a "filter by site" list; inline editing kept. Add-entry panel = popover anchored to the
field with only value + display name visible and scope defaulting to "this site". Saved-entries view with editing kept
(inside the popover). Dropdown: keyboard hints, typed-prefix highlight for snippets, first item pre-selected.
Copy-value button in the manager. New minimal icon. Toolbar click unchanged (opens the manager).
**Alternatives considered (rejected by the user):** soft/rounded or dense styles; manual theme toggle; indigo/teal/amber
accents; keeping emoji; top-tabs layout; side drawer editor; grouping by site or a flat list; centered modal or side
panel for adding; showing all fields; a toolbar popup; removing or simplifying the saved-entries sub-window; keyboard
shortcuts and per-site counters (counters were added anyway as part of the site list); per-item scope icon in the dropdown.
**Why:** Full Q&A and trade-offs in [docs/REDESIGN-v1.5.md](docs/REDESIGN-v1.5.md).
**Logic changes it implies:** Enter on a just-opened dropdown now fills the first item instead of reaching the page
(e.g. submitting a form); new entries from the page default to the current domain instead of all sites.

## [2026-10-20] No popup; the manager is the single management surface
**Decision:** Removed the toolbar popup. Clicking the toolbar icon (`chrome.action.onClicked`) opens `manager/manager.html` in a tab, or focuses and re-filters the existing manager tab. Snippet editing moved into the manager (a collapsible section in v1.4; its own sidebar view since v1.5). Opened from a normal web page, the manager is pre-filtered to that page's site (hostname + global entries); the in-page panel can also open it filtered to a selector.
**Alternatives considered:** Keep the popup as a quick-access list next to the manager (duplicated management locations); keep the popup for snippets only; open the manager as an overlay on the page.
**Why:** Entries and snippets were manageable in two places with diverging features. A single surface removes the duplication, and the site pre-filter keeps the quick "what applies here" view the popup provided. This needs `activeTab` to read the clicked tab's URL (cheaper than `tabs` or host permissions).

## [2026-10-20] Manager is not extended with duplicate-entry or bulk select
**Decision:** Not building duplicate-entry or bulk select in the manager.
**Alternatives considered:** Both were proposed alongside the manager rework.
**Why:** The user did not want them. Entry reordering also remains unsupported.
