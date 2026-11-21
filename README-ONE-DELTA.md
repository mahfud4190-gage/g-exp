# GAGE Portal — Integrated 14-point correction delta

**Baseline:** Existing `gage-portal-test-1` deployment with the cumulative Monitoring UI / Data Management updates applied. This ZIP supersedes BOTH `GAGE-Monitoring-Tabs-FLAT-DELTA.zip` and `GAGE-Portal-Master-Touchpoint-Safety-Delta.zip`: do NOT apply those two separately. Upload extracted files to identical repository paths. This is a delta, not a full site.

## Delivered code changes

1–4. **Master Data / Touch Point**: Edit and explicit Delete for managed touch points other than corporate NPS/CSI, including legacy source classifications. Journey, aliases, name, and status can be edited. NPS/CSI are read-only in UI AND server; no edit or delete. Edit/Delete are wired to the existing shared modal/server, not automatic snapshot deletion. The existing permission/scope checks remain enforced.

5. **Network & Map**: Hover card is anchored to the selected marker with edge-aware placement. Its coordinates account for CSS browser-page scaling; size is measured after the card is shown, preventing use of hidden element height.

6. **Monitoring & Assessment**: The prior FLAT tabs patch is included. The four tabs use text navigation with a single underline for the active tab; no button box, border-radius, or shadow style.

7–8. **Notifications**: Opening the bell does not itself read/acknowledge notifications. Click-outside handler excludes the bell and notification panel, preventing instant close. When inbox data is already loaded, opening the panel does not rehydrate and overwrite it. Reading an individual notification remains an explicit click.

9. **Shared table pagination**: Spacing between `Tampilkan`, selector and `data` increased in the canonical CSS (and standard table controls). No page-specific style override added.

10. **Portal period**: Header select offers current and surrounding individual years, plus multiyear ranges; persists the range separately from the older single-year setting to preserve compatibility. Default remains current year.

11. **Initiative**: Period-aware list and summary: `planningYear`/`year` or start/end dates are used to include overlapping initiatives. Records with no defined year remain visible until their period can be verified, preventing silent disappearance. `All Touch Point` rows participate when filtering an individual touch point.

12. **Initiative data investigation**: **UNVERIFIED**. The ZIP cannot confirm whether previously imported records are still present in production Firestore. No restore/import was run; do not interpret an empty view as proof that Firestore was deleted. Check `portalData/initiatives/records` and server logs if still absent.

13. **Initiative scope**: Current multi-touchpoint picker remains the source of explicit selection. This delta fixes All Touch Point filter inclusion; it does not migrate existing records or silently rewrite All to Selected.

14. **Firestore safety**: Existing explicit `DELETE_RECORD`/audit/permission checks are retained. The server-side Touch Point delete eligibility now corresponds to the final policy. No automatic bulk deletion was added.

## Important limitations

- The new period range is consumed by the Initiative list and summary. **Other modules do not yet all aggregate a multiyear range**; older modules still receive the single-year starting value. Do not assume Budget or Dashboard aggregation across multiple years is complete.
- UI and API integration against a real deployed Firebase project **has not been performed**. Test with disposable records in staging before production.
- `npm test` on the supplied cumulative working baseline remains failing due to the pre-existing `clean-draft-regression.js` assertion about re-firing `DOMContentLoaded`; this delta deliberately does not rewrite the unrelated route loader.
- Source CSS may contain historical `!important` elsewhere; **no new `!important`** was added to these changes. Changed shared CSS file contains none.
- No files are deleted, and no live Firebase data was touched.

## Verification completed

- `node --check` for all changed JavaScript and Netlify functions: PASS.
- `node tests/monitoring-flat-tabs-contract.js`: PASS.
- `node tests/monitoring-layout-contract.js`: PASS.
- `node tests/integrated-safety-contract.js`: PASS (static integration checks, not an end-to-end browser test).

## Rollout

1. Open the repository branch corresponding to the last cumulative delta before the two discarded packages.
2. Extract this single ZIP to the **repository root**, preserving the `assets/`, `netlify/functions/`, and `tests/` directory layout.
3. Commit once, let Deploy Preview build, and first verify the deployed commit SHA.
4. Verify in staging: edit/delete a non-NPS/CSI touch point, reject NPS/CSI changes, change Journey, hover near both edges of map, open/close notifications, switch 2026/2027/range, and inspect Initiative list.
5. If a file in this delta has been changed in the repo since the supplied baseline, merge its changes rather than blindly overwriting newer work.
