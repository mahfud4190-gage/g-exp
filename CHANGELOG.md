# CHANGELOG — GAGE Portal

## 2026-11-21 — Integrated 14 Point Build Fix v3
- Corrected the `planning-master-region-cache-contract.js` test embedded in `tests/regression-gate.js`: validate canonical shared pagination through executable checks of `geTablePage`, and verify Previous/Next wiring, without depending on legacy implementation details from `planning-domains.js`.
- Replaces all earlier integrated 14-point ZIP packages including BUILD-FIX v2; contains the same functional source changes.
- Local `npm run build`: PASS, including 59 regression contracts, Firestore safety contracts and the UI integrity gate for 68 routes.
- This is not an end-to-end test against the deployed Git branch or production Firebase. Recheck the Netlify deploy from the new commit.

## Previous integrated changes (carried forward)
- Master Data: edit/delete rules distinguish NPS/CSI references from other user-managed records.
- Monitoring navigation: flat text tabs rather than button styling.
- Network & Map: marker-attached popups.
- Notifications: prevent premature dismiss and auto-mark-read.
- Pagination spacing: shared styling.
- Periods and Initiative: additional year/range options and touch-point scope handling.
- Firestore: explicit, authorized deletion safety and regression checks.
- Runtime: prevent repeated synthetic DOMContentLoaded; expose retry when loading fails.

## Deployment instructions
Extract this **one cumulative ZIP** at the repository root, replacing paths; do not apply old integrated deltas separately. Keep the existing Netlify configuration. Inspect changes before merging to production. The ZIP contains only changed source and test files plus this single cumulative changelog.
