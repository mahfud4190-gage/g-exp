# Delta — Master Data Touch Point / Source Safety

Baseline: gage-portal-test-1 + latest cumulative UI fixes already deployed. This delta replaces ONLY the listed JS files. Do not apply the original test-1 ZIP again.

Changed files:
- assets/master-reference.js — stable delegated Edit handler in ID / Master Reference; Edit available on protected NPS/CSI source to correct Journey Areas while source name is read-only; only explicitly manually created touch points show Hapus; server-confirmed record deletion; no background master catalog writes.
- netlify/functions/edition1-data.js — server denies DELETE_RECORD for any touchpoint not explicitly marked sourceType Manual; imported NPS/CSI remain protected, and their names remain immutable on updates.

Installation: copy both files to repository root at their exact paths, commit together, review Deploy Preview before production.

Test notes: JavaScript syntax checks passed. Full baseline npm test fails on an unrelated legacy regression 'Route navigation must not re-fire global DOMContentLoaded' because the fully current deployed repo is not available here. End-to-end Firestore and current deployed runtime not tested. Do NOT assume all outstanding UI requests are included.

NOT INCLUDED / awaiting verified current source: global multi-year filter, map popup marker avoidance, notification close/reset issue, shared pagination spacing and any other outstanding visual defects. Avoid attempting to repair these from an older snapshot because it can overwrite newer fixes.

Safety: never write to Firestore automatically while loading reference catalogs. Delete requires confirmation, canEdit, and server-side source protection.
