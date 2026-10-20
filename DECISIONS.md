# Decisions

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design these decisions shaped.

## [2026-10-20] No popup; the manager is the single management surface
**Decision:** Removed the toolbar popup. Clicking the toolbar icon (`chrome.action.onClicked`) opens `manager/manager.html` in a tab, or focuses and re-filters the existing manager tab. Snippet editing moved into the manager as a collapsible section at the top. Opened from a normal web page, the manager is pre-filtered to that page's site (hostname + global entries); the in-page panel can also open it filtered to a selector.
**Alternatives considered:** Keep the popup as a quick-access list next to the manager (duplicated management locations); keep the popup for snippets only; open the manager as an overlay on the page.
**Why:** Entries and snippets were manageable in two places with diverging features. A single surface removes the duplication, and the site pre-filter keeps the quick "what applies here" view the popup provided. This needs `activeTab` to read the clicked tab's URL (cheaper than `tabs` or host permissions).

## [2026-10-20] Manager is not extended with duplicate-entry or bulk select
**Decision:** Not building duplicate-entry or bulk select in the manager.
**Alternatives considered:** Both were proposed alongside the manager rework.
**Why:** The user did not want them. Entry reordering also remains unsupported.
