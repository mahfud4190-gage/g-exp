# Monitoring & Assessment — Flat Tabs Fix

Baseline: versi `test-1` setelah delta Monitoring UI dan Monitoring Tabs sebelumnya.

## Ganti hanya
- `assets/global-ui-canonical.css`
- `assets/form-management.js`
- `assets/assessment-workspace.js`

Test: `tests/monitoring-flat-tabs-contract.js` (baru), `tests/monitoring-layout-contract.js` (diperbarui agar mengikuti tab non-button).

## Apa yang berubah
- Empat tab menjadi navigasi link `role=tab`, tidak lagi memakai elemen `button` yang diwarisi CSS button global; pola yang sama diterapkan ke modul Assessment lama.
- CSS tab sebelumnya **diganti pada tempatnya**, bukan ditambah override di akhir file. Tidak ada `!important` baru.
- Tidak ada border kotak, rounded corner, latar button, atau shadow. Hanya garis bawah lurus di tab aktif.
- Event click disesuaikan dan `preventDefault()` mencegah perubahan hash.
- Tidak ada perubahan Firebase, data, atau API.

## Uji
`node --check assets/form-management.js`
`node --check assets/assessment-workspace.js`
`node tests/monitoring-flat-tabs-contract.js`

Browser: hard refresh setelah deploy, cek Overview, Monitoring Works, Form Templates, Submissions, juga navigasi balik. Lakukan pengecekan perbedaan caching pada deploy baru.

Verifikasi: kedua pemeriksaan tab lulus. `npm test` pada salinan baseline kerja masih gagal pada `clean-draft-regression.js` dengan pesan `Route navigation must not re-fire global DOMContentLoaded` (di luar area perubahan tab); belum ada verifikasi visual di Deploy Preview.
