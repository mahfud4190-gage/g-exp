# Audit rute GAGE Portal

Delta ini memakai isi `gage-portal-test-1.zip` sebagai baseline. Ekstrak isi ZIP ke root branch `main` yang dibuat dari paket tersebut. `AUDIT-HALAMAN.md` adalah catatan pemeriksaan dan boleh disimpan di luar repositori.

Pemeriksaan menjalankan HTML dan JavaScript aplikasi dalam simulasi DOM lokal dengan respons API uji. Dataset simulasi mencakup 45 stasiun, 25 requirement, dan 5.625 jawaban assessment. Data uji hanya digunakan untuk audit. Pengujian mencakup 68 rute, 21 perpindahan pada tab yang sama, perpindahan cepat, dan pagination Service Experience. `npm run build` lulus. Data akun dan Firestore produksi, penggunaan RAM browser, tata letak yang dirender browser, dan operasi CRUD per halaman belum diverifikasi.

Berhasil dimuat berarti rute menampilkan konten dan tidak memunculkan error JavaScript selama pemeriksaan. Kelengkapan informasi tetap bergantung pada koleksi Firestore dan izin pengguna. Pada rute yang memakai penyimpanan lokal lama atau belum punya sumber Firestore, portal menampilkan status sumber data.

| Rute | Judul yang tampil | Hasil |
| --- | --- | --- |
| `action-scenario` | Action & Scenario Planning | Berhasil dimuat. |
| `admin` | Account & Access Management | Berhasil dimuat. |
| `agreement-service` | Agreement & Document | Berhasil dimuat. |
| `asset-facility` | Asset & Facility Management | Berhasil dimuat ulang dalam tab yang sama. |
| `audit-log` | Audit Log | Berhasil dimuat. |
| `berita` | Berita & Informasi | Berhasil dimuat. |
| `branch-office-planning` | Branch Office Planning | Berhasil dimuat. |
| `budget-cost` | Budget & Financial | Berhasil dimuat. |
| `calendar` | Calendar & Project Tracking | Berhasil dimuat. |
| `change-password` | Change Password | Berhasil dimuat. |
| `core-foundation` | Core Foundation | Data halaman ini belum terhubung ke Firestore. |
| `core-history` | Core History | Data halaman ini belum terhubung ke Firestore. |
| `core-master` | Core Master | Data halaman ini belum terhubung ke Firestore. |
| `core-migration` | Compatibility & Migration | Data halaman ini belum terhubung ke Firestore. |
| `core-permission` | Permission Foundation | Data halaman ini belum terhubung ke Firestore. |
| `core-publication` | Source & Publication | Data halaman ini belum terhubung ke Firestore. |
| `core-relationships` | Core Relationships | Data halaman ini belum terhubung ke Firestore. |
| `core-shared` | Shared Objects | Data halaman ini belum terhubung ke Firestore. |
| `cost-intelligence` | Cost Intelligence | Berhasil dimuat. |
| `customer-experience` | Customer Experience | Berhasil dimuat. |
| `cx-import` | Import CSI & NPS | Berhasil dimuat. |
| `data` | Data Management | Berhasil dimuat. |
| `gaso-planning` | GASO Planning | Berhasil dimuat. |
| `improvement-intake` | Improvement Intake & Opportunity | Berhasil dimuat. |
| `index` | Portal Control Center | Berhasil dimuat. |
| `inisiatif` | Initiative & Improvement | Berhasil dimuat. |
| `initiative-conversion` | Controlled Initiative Conversion & Traceability | Berhasil dimuat. |
| `initiative-traceability` | Initiative Traceability, Milestone & Activity Integration | Berhasil dimuat. |
| `kontak` | Hubungi Kami | Berhasil dimuat. |
| `layanan` | Service Experience | Berhasil dimuat. |
| `lounge-access` | Lounge/Tenant Access | Berhasil dimuat. |
| `lounge-flights` | Daftar Penerbangan | Jadwal penerbangan belum memiliki sumber Firestore yang terhubung ke halaman ini. |
| `lounge-list` | Lounge/Tenant Planning | Berhasil dimuat. |
| `lounge-procurement` | Lounge & Service Procurement | Berhasil dimuat. |
| `lounge-purchase` | Pembelian Akses Lounge/Tenant | Berhasil dimuat. |
| `lounge-visitor` | Lounge/Tenant Visitor | Berhasil dimuat. |
| `management-outcome` | Management, Outcome & Transformation | Data halaman ini belum terhubung ke Firestore. |
| `master-data` | Master Data & Partners | Berhasil dimuat. |
| `planning-documents` | Planning Documents | Berhasil dimuat. |
| `planning-workspace` | Planning Workspace | Berhasil dimuat. Indikator menunggu inisialisasi workspace. |
| `portal-management` | Portal Management | Berhasil dimuat. |
| `post-flight` | Post-Flight | Berhasil dimuat. |
| `post-journey` | Post-Journey | Berhasil dimuat. |
| `pre-flight` | Pre-Flight | Berhasil dimuat. |
| `pre-journey` | Pre-Journey | Berhasil dimuat. |
| `profile` | My Profile | Berhasil dimuat. |
| `program-kerja` | Program Kerja | Data halaman ini belum terhubung ke Firestore. |
| `readiness` | Readiness & Compliance | Berhasil dimuat. |
| `service-capability` | Touch Point, Service & Capability | Berhasil dimuat. |
| `service-locations` | Service Locations | Data halaman ini belum terhubung ke Firestore. |
| `service-planning` | Service Planning | Berhasil dimuat. |
| `service` | Service Experience | Dialihkan ke Service Experience melalui alias portal. |
| `standar` | Readiness & Standards | Berhasil dimuat. |
| `station-360` | Station 360 | Berhasil dimuat. Judul Station 360. |
| `touchpoint` | Touch Point & Station Condition | Berhasil dimuat. |
| `airport-experience` | Network & Map | Berhasil dimuat. 45 marker sampel tampil. |
| `monitoring-assessment` | Monitoring & Assessment | Berhasil dimuat. |
| `monitoring-checklist` | Monitoring & Assessment | Berhasil dimuat. |
| `service-experience` | Service Experience | Berhasil dimuat. Maksimal 50 baris per halaman. |
| `capability-classification` | Capability & Classification | Berhasil dimuat. |
| `attention-settings` | Management Attention · Indicator Rules | Berhasil dimuat. |
| `service-provider` | Service & Provider | Berhasil dimuat. |
| `space-building` | Space & Building | Berhasil dimuat. |
| `station-resources` | Station Material, Tools & Equipment | Berhasil dimuat. |
| `airport-systems-planning` | Airport Systems | Berhasil dimuat. |
| `planning-documents-hub` | Planning Documents | Berhasil dimuat. |
| `planning-standards` | Standards / Reference | Berhasil dimuat. |
| `airport-cost-structure` | Airport Cost Structure | Berhasil dimuat. |
