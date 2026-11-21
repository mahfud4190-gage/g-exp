# CHANGELOG — GAGE Portal

## 2026-11-21 — Integrated 14 Point Runtime Fix v4
- Master Data Edit/Delete: fixed popup hidden-on-click bug by keeping `#geGlobalRefModal` and its `.ge-ref-backdrop` together in the DOM. Both global overlay promoters now ignore this dedicated popup; stale `ge-portal-overlay` styling is cleared when it opens. Existing NPS/CSI protections, explicit delete authorization and confirmation logic are preserved.
- Sidebar: removed the repeated `global-ui-canonical.css` DOM relocation on every route change, avoiding a temporary loss of the desktop density/zoom rules.
- Added `tests/master-dialog-sidebar-stability-contract.js` and ran it separately.
- Local `npm test`: PASS (59 regression contracts, safety checks and 68-route asset integrity). No changes to Netlify configuration or Firestore Functions beyond those carried from v3.
- Changes have **not** been validated against live Netlify/Firebase or by real-browser visual snapshots.

## Previous revisions (cumulative, included in this ZIP)
- v3: corrected Planning pagination contract to validate shared pagination behavior.
- v2/v1: page navigation regression fixes, runtime script loading, and build tests.
- Integrated 14 points: Master Data edit/delete permissions for non-NPS/CSI indicators; map popup placement; flat Monitoring tabs; notifications; pagination layout; year selection; Initiative scope; explicit authorized Firestore deletes and protection against cache-driven deletion.

## Install
Use **this ZIP only** to replace earlier Integrated 14 Point deltas. Extract at the root of the same repository and overwrite matching paths. Do not upload the older integrated delta ZIPs separately. Test Master Data Edit/Delete and 100%-zoom navigation on the new Deploy Preview.
