# Ground Experience Portal — Work History

This is the single canonical work-history file for the portal. Entries are grouped by functional area/page so changes, root causes, deleted files, and validation can be traced without versioned history files.

## Global / Shared UI
- Canonical control geometry: buttons, fields, dropdowns, modal layering, active sidebar state, responsive/mobile behavior, and desktop density.
- Replacement cleanup: versioned runtime asset names were migrated to domain/canonical names; obsolete files are removed explicitly, not disabled by overwrite.

## Network & Map
- Preserve Station/Airport detail information hierarchy while adding optional image thumbnails and gallery behavior.
- Gallery upload/display is additive; it must not rearrange provider/service metadata.

## Monitoring & Assessment
- Professional flat workspace tabs; submission filters use in-field labels only.
- Share Checklist uses portal dialog and public short-link routes. Public share routes boot without protected-shell authentication.
- Submission includes KPI summary, pie chart, bar chart, and pageable/sortable history.

## Initiative & Improvement
- Grid/List share the same filter source. Journey, touch point, achievement, priority and search filters are synchronized.
- List table follows the Lounge table standard and exposes Update/Delete according to permissions.

## Improvement Opportunity
- Dashboard cards, Source Intake, Create Opportunity, Review/Disposition and Integrity sections use a responsive page layout.
- Page-level runtime errors are contained inside the page and must never replace the portal shell.

## Planning Workspace / Service & Provider
- Lounge/Tenant is the presentation reference for GHA, Airport Operator and other provider categories.
- Unassigned is hidden from the user-facing workspace; existing uncategorized records are not deleted.
- Provider category images are configurable through the central category-image mapping.

## Lounge / Tenant
- Add/Edit/Delete and station/provider filters use canonical bindings.
- Card/detail views retain Lounge/Tenant naming and parent navigation to Service & Provider.

## Master Data & Partners
- Master references and IDs are Add/Edit capable.
- Only Touch Points sourced from NPS/CSI remain locked; manually maintained Touch Points remain editable.
- Currency and exchange-rate collections are supported by the data API.

## Audit Log
- CRUD audit events from both the canonical and legacy audit stores are merged for Super Admin viewing.
- Login and logout are written as server-side audit events.

## Performance & Cache
- Static assets use Service Worker caching and data collections use scoped IndexedDB cache with background refresh.
- Protected-route authentication remains authoritative; public checklist share routes bypass the protected bootstrap only where explicitly allowed.

## Deployment
- Netlify regression gate must pass before handoff. Obsolete runtime files are deleted explicitly from the repository; no auto-delete build step is used.

## 2026-10-15 — Canonical UI & Runtime Regression Recovery

### Global / Shared
- Standardized desktop density so browser 100% uses the compact portal density previously seen around 90%, while mobile remains 100%.
- Kept dropdown, text field, radio, and checkbox content left-aligned.
- Restored visible active-sidebar state and constrained button content so zoom does not escape button borders.
- Changed Service Worker navigation caching to network-first and static assets to stale-while-revalidate to prevent stale `app.html` / authentication bootstrap mismatches while preserving fast repeat navigation.

### Network & Map
- Restored station-detail hierarchy after gallery support: provider metadata and service tabs retain their layout; service/lounge/facility images stay inside record content and no longer reshape the station header.
- Made station detail responsive without oversized/overflowing tab controls.

### Monitoring & Assessment
- Reworked Overview / Monitoring Works / Form Templates / Submissions into flat professional navigation tabs without elevated-button shadows.
- Standardized submission filters and Download Data to one control height and kept filters self-describing without separate field titles.
- Protected shared-checklist routes against stale cached HTML/auth bootstrap mismatch.

### Initiative & Improvement
- Normalized the initial “Semua Journey” state so search and Grid View render correctly on first open, not only after changing Journey filters.
- Aligned List View table presentation with the Lounge/Tenant table language and kept Update/Delete action rendering for editable roles.

### Improvement Opportunity
- Reworked the page to a full-width two-column workspace with separated KPI cards, source intake, create opportunity, register, and integrity panels.
- Added initialization guards to prevent duplicate event binding / page lockups after route re-entry.

### Planning Workspace / Service & Provider
- Removed Unassigned from category presentation.
- Standardized provider cards to the Lounge-style content hierarchy with station identity limited to about 15–20% of card width.
- Standardized filter row and Grid/Details/action heights; editable roles use Edit/Delete while viewer-only roles use View.
- Category imagery remains configurable through `GE_PLANNING_CATEGORY_IMAGES`.

### Lounge/Tenant
- Kept child title `Lounge/Tenant Planning` under the top-level `Service & Provider` navigation.
- Restored canonical initialization for Add/Edit controls after Firestore hydration rather than relying on suppressed DOMContentLoaded handlers.
- Standardized heading/back-action and Grid/Details heights.

### Master Data & Partners
- Preserved editable reference/ID behavior while keeping NPS/CSI-derived locked Touch Points read-only.
- Ensured deployment includes server allow-list support for `currencies` and `exchangeRates`.
- Standardized master tabs and content-height panels to avoid blank oversized areas.

### Audit Log
- Authentication audit path remains enabled for Login and Logout; canonical mutation flows continue to write their page/module audit records.

### Deployment / Regression
- Added pending-auth shell hiding expected by the navigation readiness regression gate.
- No new R/P/V runtime identity was introduced by this work.


## 2026-10-15 — Planning Workspace Canonical Interaction Alignment

### Planning Workspace / Service & Provider
- Standardized Grid/Details to one segmented-control behavior shared with Lounge/Tenant.
- Standardized provider-category cards to the Lounge/Tenant card hierarchy; station identity is a compact square element and card actions use the same control geometry.
- Back navigation to Service & Provider uses one page-head placement across child pages.
- Service/provider pages show agreement attention for Expired and Expiring Soon records.
- Category totals use source-record counts; station-expanded entries are reported separately to avoid inflated GHA totals.
- Bulk Upload now opens a dedicated review flow before import, including total/ready/failed validation counts and preview.
- Delete uses the shared confirmation dialog and emits a success confirmation after persistence.

### Lounge / Tenant
- Restored the child page title as `Lounge/Tenant Planning` and retained Service & Provider only as the parent breadcrumb/navigation.
- Fixed Grid/Details switching recursion that could make Details unresponsive.
- Rebound Add and view controls during canonical page initialization.
- Region filtering now derives region from the station/airport master when the lounge record itself has no region value.
- Added Expired / Expiring Soon status filtering and standardized delete confirmation/result feedback.

### Ground Handling Agent / Airport Operator / Other Provider Categories
- Source-record totals no longer use station-expanded row counts, preventing totals such as 66/15 when the selected GHA source contains 12 records.
- Per-station rows/cards are still preserved for operational display where one source record covers multiple stations.


## Planning Workspace — Canonical behavior recovery
- Restored Lounge/Tenant child title; first-level sidebar title normalization no longer overwrites Planning Workspace subpages.
- Unified Grid/Details segmented control and Planning Workspace card proportions.
- Replaced Planning Workspace native dialog usage with one fixed shared overlay layer so Close/Cancel/Save remain interactive above header/sidebar even with desktop density mode.
- Shared delete confirmation now uses the same fixed overlay behavior instead of browser/native dialog.
- Generic bulk upload uses the same professional import/review pattern and accepts XLSX/CSV when the shared reader is available.
- Lounge/Tenant page hydrates Airport/Region master data and rebinds Add/Grid/Details on SPA route entry.
- Service & Provider child pages use `data` wording, support Show agreement history, and retain Expired / Expiring Soon lifecycle filters and warnings.

## Stability Recovery — rollback two unintended UI revisions

### Scope
- Restored the visual and functional baseline from immediately before the two revisions that unintentionally redesigned Planning Workspace, Service & Provider, and Initiative state behavior.
- Recovery intentionally avoids redesigning unrelated pages.

### Planning Workspace / Service & Provider
- Restored the pre-regression renderer, typography, card hierarchy, page structure, and page-specific lifecycle.
- Removed the two-revision replacement path that changed the Planning Workspace hub and Service & Provider presentation beyond the requested scope.
- This recovery is a baseline reset only; future shared-component consolidation must preserve this visual baseline first.

### Initiative & Improvement
- Restored the pre-regression `activeJourney` lifecycle and rendering path so the initial page does not inherit the newer shared state that could suppress all Initiative data.
- No visual redesign was introduced.

### Navigation / Performance
- Preserved the existing route lifecycle to avoid introducing cross-page regression.
- Repeated `app.html` navigation now uses a cached static shell with background refresh through the service worker.
- Route assets are pre-warmed on pointer/focus/touch intent and the shared business-data cache is warmed earlier after login.
- API and Firebase traffic remain live; business data is not permanently pinned to the static cache.

### Regression rule
- A correction to one page must not redesign another page or replace its renderer unless that renderer is explicitly inside the agreed scope.


## Stability Recovery — Planning data, modal visibility, Initiative state, navigation latency
- Root cause: canonical UI applied `position:fixed` to every `[role=dialog]` / `[aria-modal=true]`, which could detach a dialog card from its overlay layout and leave only the dark overlay visible. Fixed the global rule and gave the Planning modal card a dedicated canonical class.
- Root cause: cached empty planning/initiative collections could remain on the critical render path until the background manifest refresh. Added an explicit `GEStore.refresh()` path and a one-time fresh recovery when critical collections are unexpectedly empty.
- Root cause: the consolidated Initiative interaction layer referenced the lexical `activeJourney` variable from a different IIFE, producing `activeJourney is not defined`. The canonical interaction layer now owns `window.GE_ACTIVE_JOURNEY` and derives state from the active Journey tab.
- Service & Provider category panels now reuse the existing Planning Workspace hub card/panel pattern instead of introducing another category-card design.
- Navigation latency: Firebase profile validation is reused for up to five minutes for the same authenticated UID; business collection cache already uses a five-minute manifest interval. This removes repeated profile reads without making business data permanently stale.

## Planning Workspace / Initiative Recovery — 2026-10-16

### Planning Workspace — Lounge/Tenant canonicalization
- Root cause: `lounge-list` still loaded the legacy Lounge/Tenant renderer and handlers, while GHA/Airport Operator used `planning-domains.js`. Visual alignment therefore did not create shared behavior; Add/Edit, filters, Grid/Details and navigation continued to diverge.
- Replaced the Lounge/Tenant route with the same `planning-domains.js` renderer used by the other Planning Workspace Service & Provider categories.
- Added Lounge/Tenant as a forced `LOUNGE` category in the shared Planning Workspace domain configuration, with the same back-navigation, filter, Grid/Details, pagination, Add/Edit/Delete and dialog owner.
- Added Lounge/Tenant-specific field mapping to the shared form without restoring the legacy Lounge-specific runtime path.
- Improved legacy `serviceProcurement` category inference so existing Airport Operator/GHA/Lounge-labelled records are classified into the shared Service & Provider view when `planningCategoryId` is absent.

### Initiative & Improvement
- Root cause: the canonical picker rendered as a button-like trigger with a visible glyph, creating an inconsistent multi-select appearance.
- Replaced the picker trigger with a field-style combobox surface while retaining checkbox multi-select behavior, keyboard access and left-aligned text.
- Normalized the Super Administrator/Super Admin role alias in Initiative scope/edit/delete checks.
- Main Initiative page now initializes deterministically to All Journey unless an explicit `journey` query is supplied; Journey switching uses the canonical window state.

### Regression protection
- Updated the regression contracts so Lounge/Tenant is required to use the shared Planning Workspace controls instead of the retired legacy Lounge-specific markup.
- Validation: 59 regression contracts passed; UI integrity gate passed for 68 pages / 594 asset references; local build passed.

## Monitoring & Assessment — submission recovery, share link and QR
- Submission filter toolbar uses placeholder/select content only; redundant field titles removed and control height/spacing aligned.
- Monitoring data recovery now revalidates `formTemplates`, `monitoringWorks`, and `formSubmissions` only when cached data is unexpectedly empty, with a 5-minute session guard to avoid repeated reads on every page entry.
- Share Checklist now separates the full working URL from the short code. A custom short URL is shown only when `GE_SHORT_LINK_ORIGIN` is configured; the portal no longer pretends a long Deploy Preview hostname is a short URL.
- Added locally rendered QR code for the working `/s/<code>` route. QR generation is bundled locally so internal share URLs are not sent to a third-party QR service.
- Share dialog keeps Copy Link, Copy Code, optional Copy Short Link, and Copy QR Link actions in one workflow.


## 2026-10-16 — Runtime ownership and stale-data recovery

### Global runtime
- Removed the obsolete visual scaffold flash by keeping the route outlet hidden until the canonical page owner finishes initialization.
- Rotated the static service-worker cache and IndexedDB business-data cache once to discard stale UI/data produced by failed revisions; subsequent page opens continue to reuse the new cache.
- Planning modal ownership is corrected in the shared overlay manager: the full `.planning-dialog-layer` is promoted to `document.body`; the dialog card is no longer detached from its overlay and pushed into page flow.

### Planning Workspace
- Removed `Lounge/Tenant Planning` from the top-level Planning Workspace hub; Lounge remains a child of Service & Provider.
- Planning pages hydrate only the collections needed by the current page, then perform a direct fresh read when all critical collections are unexpectedly empty.
- Existing Expired / Expiring Soon lifecycle filters remain part of the shared Planning Workspace renderer.

### Monitoring & Assessment
- Registry-level legacy Monitoring/Checklist markup was removed; `form-management.js` is now the visible owner from first paint.
- When both Monitoring Forms and Monitoring Works are unexpectedly empty, a canonical fresh read is performed immediately rather than waiting on a stale empty cache.

### Initiative & Improvement
- Removed the internal “Proven V224…” implementation note from the user interface.
- Late journey-state access uses the canonical `GE_ACTIVE_JOURNEY` state instead of an out-of-scope lexical variable.


## 2026-10-16 — Planning / Initiative / Master Data PR recovery

### Planning Workspace
- Add/Edit now uses the Lounge/Tenant canonical agreement form structure across Planning Workspace pages: Region, Station, service/provider identity, service type, PIC, agreement action/replacement, agreement dates, single price/currency, document identity/type/status, remarks, Price Schedule, Capacity Schedule, and document attachment. Collection-specific fields remain available under Additional Details so existing domain data is not discarded.
- Category hub cards now use the same `planning-workspace-card` behavior and photo geometry for Service & Provider, Space & Building, Station Material / Tools / Equipment, Airport Systems, Planning Documents, and Standards / Reference. The separate `planning-category-visual` rendering path is no longer used.
- Status filter no longer collapses to only Expired / Expiring Soon when records fail to hydrate. Stable baseline values include Valid, Pending, Invalid, Active, Draft, Inactive, Superseded, Expired, and Expiring Soon; record-specific values are appended.
- Legacy/copied Planning records without `planningCategoryId` remain visible in All Records through category inference and an Unassigned compatibility state instead of being silently filtered out.
- Planning routes reuse the canonical cache without a second blocking refresh; cached-empty snapshots are revalidated in the background so navigation does not wait on a duplicate data request.
- Client-side Planning audit injection was retired; successful mutations are audited by the canonical server adapter.

### Initiative & Improvement / scope
- Initiative route now revalidates initiatives and its dependent collections on entry, so Firestore data copied outside the portal is not hidden behind a previously cached empty collection.
- Station scoping now recognizes canonical `assignedStations[]` (with legacy `airports[]` fallback) in both browser and server adapters; lounge scope likewise recognizes `assignedLounges[]`.

### Master Data
- Removed the privileged `auditLogs` hydrate dependency from Master Data initialization and removed client-side audit-log writes from Add/Edit save. This prevents Admin/Editor saves from failing because Audit Log is Super Admin-only while retaining server-side mutation audit.

### Validation
- Added regression protection for the recovery paths. Full regression gate and UI integrity gate must pass before handoff.

## Canonical route/data recovery — 2026-10-16
- Planning Workspace Add/Edit re-aligned to the canonical Lounge/Tenant modal geometry and field hierarchy; page width no longer dictates modal width.
- Planning domain modal rows retain the Lounge/Tenant two-column form, Price Schedule, Capacity Schedule, and attachment pattern with responsive collapse only at mobile breakpoints.
- Portal collection hydration keeps cached-empty arrays on the immediate render path and revalidates them in the background, bypassing the manifest-version shortcut because direct Firestore imports/copies do not necessarily bump portal metadata. Populated cache snapshots revalidate in the background after their freshness window.
- Internal page navigation now switches the canonical `app.html` outlet in place instead of hard-reloading the shell on every sidebar/card navigation. Header/sidebar state remains persistent; route-specific Planning runtime is disposed/reloaded safely.
- Runtime HTML/JS/CSS service-worker strategy changed to network-first to prevent a newly deployed shell from mixing with stale page/runtime assets.
- Station scope readers use `assignedStations[]` as the canonical user field with legacy `airports[]` only as compatibility fallback.

## 2026-10-16 — Persistent Shell, Firestore Scope & Airport Experience Regression Recovery

### Global / Navigation
- Removed the route-pending shell hide/reveal gate. Header and sidebar remain mounted while the content outlet changes.
- Route changes preserve outlet height during initialization and release it after mount, preventing collapse/reflow that looked like zoom-in/zoom-out.
- Removed the visible `Memuat data perencanaan…` placeholder from Planning Workspace routes.

### Firestore / Data Visibility
- Server station scope now reads canonical `assignedStations[]` first and uses legacy `airports[]` only as compatibility fallback.
- Rotated the scoped browser cache schema so stale snapshots from the previous scope contract are not reused.
- Lounge/Tenant page boot no longer requests privileged `auditLogs`; audit remains server-side after successful mutations.

### Master Data & Partners
- Master Data initialization no longer hydrates `auditLogs`, which could abort Add/Edit binding before table actions were attached.
- Existing Add/Edit implementation and canonical modal behavior are preserved.

### Airport Experience Network
- Corrected the previous route recovery that had restricted the accepted R43 foundation to Monitoring & Assessment while leaving Service Experience on its static scaffold. The existing foundation now initializes again on Network & Map, Station 360, Service Experience, Capability & Classification, and Monitoring & Assessment; no new foundation renderer was introduced.
- Removed the competing R40 four-tab map detail renderer and its now-unused R40 styles. R42 is the single station-detail owner and retains six operational information tabs: Service, Lounge, People, Facility, System, and Contract.
- Photo/gallery behavior remains additive to station record content. Photo upload no longer hydrates privileged `auditLogs` before saving metadata; the canonical store/server mutation path handles persistence and audit.

### Monitoring & Assessment / Shared Checklist
- Restored the approved one-question-per-card presentation within `checklist-share.css` and aligned Guest respondent identity fields in a dedicated responsive row; global form styles remain untouched.
- Public Guest forms no longer expose internal Touch Point/Journey/3P mapping hints. Internal form completion retains mapping context, while locked previews/submission details remain unchanged.

### Firestore / Planning / Initiative
- Cached empty collections no longer block page rendering or trigger a second awaited refresh. Empty snapshots are revalidated directly in the background, independent of the manifest version; populated cache snapshots revalidate after their freshness window.
- Cache identity now includes role/access level and canonical station scope, with a schema rotation to prevent reuse of snapshots created under an older scope contract.
- Server scope reads `assignedStations[]` first, accepts object/string station values, falls back to legacy `airports[]`, and normalizes the `Super Administrator` role alias before authorization/scope checks.
- Planning Workspace and Initiative keep their initial render non-blocking; Firestore revalidation events rerender their existing canonical views when records arrive.
- Added a runtime regression test with a simulated IndexedDB empty snapshot and delayed Firestore response; it verifies that the route returns immediately and the view receives fresh records through the background-refresh event.

## G-Exp — Integrated Planning & Financial Delta (2026-11-22)
- Kept the existing source repository and this single canonical `HISTORY.md`; no extra history/changelog file created and no production GitHub/Firestore mutation performed.
- Master reference: editable Airport-to-Region mapping, service cost components, calculation rule reference parameters (including global or station applicability), provider category Catering, billing UOM expansion, and Superadmin-only business code prefix/digit configuration.
- Planning Workspace: automatic Region from Airport Master; provider-specific tariff/price-period fields for GHA, Airport Operator, and Catering (Inflight/SOG); draft-friendly partial record input; read-only Airport Operator Space Rent linked from Space & Building; non-destructive Create-only provider bulk upload with grouped agreement rows, preview, and three domain XLSX templates.
- XLSX upload: added a standalone Planning Workspace reader for the existing XLSX zip/XML format, including XML namespace support; existing legacy data and all other page handlers remain unchanged.
- Annual cost: provisional rate × user-entered forecast quantity, separated by currency and effective year; incomplete or unsupported tier/percentage/rule conditions must not be shown as a final validated annual figure. Contractual MTOW/duration thresholds and authoritative forecast integrations require further controlled validation.
- Financial: `financialBudgets`, `financialCostObjects`, `financialAllocations`, `financialActuals`, `financialAdjustments`, `financialCommitments`, and `financialForecasts` use the existing online GEStore/Firestore service, with server scope/approval checks, financial non-delete rule, and separate approved vs actual/committed balances. No business-data localStorage write was introduced in the new financial module. Pre-existing browser finance records remain untouched; optional reviewed legacy import requires explicit confirmation and must not silently overwrite online records.
- Initiative: added optional milestone weight and progress inputs, an independent weighted-progress indication when the weights form a valid 100% set, without overwriting historic manual progress; portfolio now also includes GHA.
- Server: role-constrained financial operations, server-side business reference sequencing for supported new records, and bounded revision history for budget/tariff changes. Document IDs and legacy records are preserved.
- Limitations and deferred validation: legacy `assets/improvement.js` still contains browser-local business-data persistence and has NOT yet been migrated to Firestore; full historical data migration, exact PJP4U/PJP2U MTOW/duration formulas, flight/pax forecast source integration, real invoice/payment reconciliation, fully consolidated dashboards, and production Firebase/Netlify/browser E2E tests are NOT complete. Do not state that all localStorage data is online or all cost calculations are final. No existing legacy browser data was deleted.
- Verification: JavaScript syntax checks for changed source; repository regression gate 59/59 passes; workbook header/ZIP/XML inspection passes. Further permissions/security and live CRUD/upload tests are needed before production rollout.

## G-Exp — Context-aware Cost & Budget Planning refinement (2026-11-22)
- Based on the approved integrated G-Exp planning delta. This entry updates the existing canonical HISTORY.md only; no new history files.
- Planning Workspace Add/Edit now keeps provider category contextual to the selected GHA, Airport Operator, or Catering page. A separate service-group choice drives eligible tariff components: Basic/AHAN/Special for GHA, charge type for Airport Operator, and Inflight/SOG for Catering. Individual tariff rows may have different service groups within one agreement; their DOM/INT/ALT operation is a distinct attribute.
- Space & Building, Station Material, and Airport Systems now support optional domain-specific cost components and tariff periods within their existing collections, without forcing financial data on non-financial inventory records. Matching Master Data categories and UOM/calculation-basis options were extended for those domains.
- Non-Lounge Planning Add/Edit has searchable multi-station selection. On save, each selected station gets its own record/station identity and automatically derived Region, with a shared agreement group reference. Legacy multi-station records are split only when explicitly edited, preserving other stations' records; Lounge-specific input and operations remain untouched.
- When the same rate is applied to multiple stations, forecast quantities and annual estimates are NOT copied to each BO; station-specific forecasts must be added later. Annual estimates are held as not calculable for overlapping/segmented price periods or conditional MTOW/duration/percentage charges without verified inputs, to prevent misleading cost totals.
- GHA, Airport Operator and Catering XLSX templates now include optional Service Group while preserving the previous business-column contract. Space & Building, Station Material and Airport Systems receive category-specific downloadable tariff CSV headers compatible with the existing preview/import path. The import accepts a semicolon/comma-delimited Station list but creates separate records, detects duplicates, and remains Create-only.
- Existing Firestore collections, canonical GEStore save/flush, access rules and all unrelated page renderers were preserved. No production Firestore/GitHub writes, silent migration, deleted data, or replacement of earlier source files outside this scope. Do not confuse the new calculation readiness output with a validated PJP4U/PJP2U invoice calculation.
- Verification: syntax checks passed for modified JavaScript and repository regression gate reports 59/59 PASS. Live Netlify/Firebase/browser CRUD and role-scope E2E tests are still necessary before production deployment.

## G-Exp — Canonical Station multi-select correction (2026-11-22)
- Replaced the oversized custom `details`/full-checkbox Station picker introduced in the prior Cost & Budget delta with the existing G-Exp `ge-ref-multi` dropdown visual contract (compact trigger, searchable options, normal checkboxes, Batal/OK confirmation).
- Removed unapproved user-facing instructions, including `boleh menyusul`, from the Station field. The label is simply `Station`, and the empty value is `Pilih Station`.
- Preserved multi-station save behavior, per-station record creation, Region lookup, forecast safeguards, and existing Lounge selector. Cancel or outside dismissal never commits tentative Station selections.
- No extra CSS overrides, new component stylesheet, new history file, or unrelated module changes. Regression gate: 59/59 PASS; JavaScript syntax PASS. Browser interaction and Firebase save still require deploy-preview verification.

## G-Exp — Planning Cost Form UX / Canonical Station Selector Correction (2026-11-22)
- Corrected Planning Workspace Station multi-select to use the same compact `.ge-picker-*` presentation contract as Initiative, rather than the Master Reference `.ge-ref-multi` controls which had oversized checkbox/label alignment under Planning dialog styles. Added searchable option list and standard All, Clear, Cancel, Apply interactions (localized as Semua Station, Kosongkan, Batal, OK). Existing station-per-record persistence, region derivation, and multi-station safeguards are unchanged.
- Replaced provider tariff free-text Aircraft field with a dropdown sourced from the existing Aircraft Master (`aircraftConfigs`), only for GHA and Airport Operator where relevant. Previously stored aircraft values are retained as a selectable legacy option. No aircraft field is shown on Catering/other non-aircraft tariff rows.
- Replaced free-text UOM field with a dropdown of canonical unit definitions and active UOM Master entries, showing existing/suggested unit from applicable cost component/calculation rule; no invented unit is silently saved. Replaced tariff Currency text input with dropdown from Currency Master, with existing legacy values preserved for editing.
- Reworded annual quantity as `Perkiraan Jumlah Penggunaan per Tahun`, removed `Optional`, `Boleh kosong`, and generic filler from tariff row. Applied controlled, scoped styles in the existing `assets/portal.css` owner rather than layered global overrides, and kept Lounge-specific price input unchanged.
- Hydrates aircraft and currencies together with existing Airport/Reference master sources. Only `assets/planning-domains.js`, `assets/portal.css`, and this existing `HISTORY.md` changed. No GitHub/Firebase changes or production data mutation.
- Verification: modified JS syntax check PASS, repository regression gate 59/59 PASS. Live browser visual acceptance and Firestore integration still require deploy-preview verification.

## G-Exp — Cost & Budget field terminology correction (2026-11-22)
- Standardized user-facing labels, select prompts, and relevant messages in the contextual Planning Cost & Budget form to professional English. Preserved established terms including Service Type, Cost Component, Operation Type, Aircraft Type, Effective From/To, Rate, Currency, Rate Basis / UOM, Annual Forecast Volume, and Rate Conditions.
- Removed colloquial/nonstandard field wording and unnecessary financial-form helper text, including placeholder instructions about entering data later. Station multi-select now shows Search stations, All Stations, Clear, Cancel, OK, and Select station.
- Updated built-in cost component and service names for Space & Building, Station Material, and Airport Systems to English **display names only**; canonical codes and stored data values are unchanged. Master Data entries maintained by users are not automatically translated or overwritten.
- Kept Lounge-specific labels and nonfinancial input contracts unchanged; did not alter CSS, forms' field identifiers, station splitting, Firestore persistence, calculations, permissions, or import schema.
- Scope: `assets/planning-domains.js` and existing `HISTORY.md` only. Validation: JS syntax and repository regression gate 59/59 PASS. Browser visual and live Firestore E2E tests have not been run.
