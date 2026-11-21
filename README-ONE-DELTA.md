# GAGE Portal — Integrated 14 Point Delta (Build Fix)

**This ZIP supersedes `GAGE-Portal-Integrated-14-Point-Delta.zip`.**
Use it against the same original branch/repository baseline used for the previous integrated delta. Extract the ZIP at repository root, replacing matching files. Do not install the previous delta separately.

## Included
- All 10 code/test files from the previous integrated 14-point delta.
- `app.html`: remove synthetic `DOMContentLoaded` during route navigation; guard layout-release when navigating rapidly; provide retry on route failures; fix script loader to retry after timeouts/errors rather than caching rejected promises.
- `tests/regression-gate.js`: update historical assertions for the current split Master Data hydration, protected NPS/CSI labels, script loader definition, and existing 12-item planning pagination.
- `tests/firestore-explicit-delete-contract.js`: verify snapshots cannot trigger DELETE, only explicit DELETE_RECORD and server permissions can delete.
- `tests/runtime-loader-recovery-contract.js`: verify concurrent loads, retry after failure/timeout, and reuse on success.

## Validation
- `npm run build` **PASS** (Node 22 local, package requires >=20).
- 59 built-in regression contracts **PASS**.
- Firestore cache / explicit deletion, loader retry, business controls, Monitoring layout, and 68-route asset integrity contracts **PASS**.
- This is **not yet an end-to-end Netlify / production Firestore validation**.

## Installation
1. In the repository root, extract/upload **all files** from this ZIP, keeping directories.
2. Commit the files together to the branch connected to PR/Deploy Preview.
3. Verify Netlify has a fresh build on that commit; do not deploy to production until authenticated CRUD and UI smoke checks succeed.
4. Keep server-side environment secrets out of GitHub.

## Note on Netlify log
The original log stops after `npm run test` began; local replication of this precise source exposed a failing navigation regression, followed by outdated assertions and missing referenced test files. These are repaired and tested in this replacement delta.


## Build-fix v2 (21 Nov 2026)

Netlify 502? No. The latest build failure is the regression assertion `Planning records must support paginated views` from `planning-master-region-cache-contract.js`, embedded in `tests/regression-gate.js`. The former check hard-coded a 12-row page size, which is incompatible with configurable pagination in newer branches. The check now validates pager controls, page calculation, row slicing, and previous/next navigation without assuming exactly 12 records per page. No `planning-domains.js` file is overwritten.

Verification: `npm run build` PASS on the available test-1 integrated baseline (59 regression contracts, Firestore, loader, business controls, UI integrity 68 routes). This does not verify the full live GitHub branch or Netlify environment; if that branch diverges, inspect its planning implementation.
