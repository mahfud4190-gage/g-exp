# Delta runtime dan upload

Ekstrak isi ZIP ke root branch main dengan baseline gage-portal-test-1.zip. Delta bersifat kumulatif dan sudah mencakup perubahan Page Audit sebelumnya. Simpan catatan ini di luar repositori jika diinginkan.

- Portal memuat modul penyimpanan lampiran saat aksi file digunakan. Error startup mencantumkan tahap autentikasi, modul, atau data dan menyediakan Coba lagi.
- Master Data memuat koleksi awal dalam satu permintaan, tanpa sinkronisasi katalog otomatis pada pembukaan halaman. Impor Jenis & Referensi menampilkan preview dan menghitung baris tersimpan setelah API merespons. ID & Master Referensi tetap mengikuti pengelolaan yang tersedia pada modulnya.
- Jalur import lama memakai parser sesuai jenis file/data. Lounge/Tenant menggunakan template resmi P29 dan membuka preview pada dialog yang sama. Station Material, Airport Cost dan Standards / Reference memakai kolom yang selaras dengan template. Import Flight Schedule memakai koleksi portalData/flightSchedule/records dan penyaringan stasiun keberangkatan/tujuan sesuai akses.
- Upload Initiative dan User & Access diinisialisasi kembali saat rute dibuka. Import Airport hanya mengubah rekor dalam file, tanpa menomori ulang seluruh master.
- Program Kerja masih membutuhkan pemetaan data lama ke Firestore dan integrasi Budget & Cost. Tidak ada migrasi otomatis.

## Verifikasi lokal

npm run build lulus, termasuk pengaman penghapusan dan loader recovery. Uji simulasi DOM mencakup 68 rute dan 21 perpindahan pada tab yang sama. Contoh CSV/XML workbook diuji pada Master Data, Airport, Personnel, tiga jenis GASO, Branch Office Space & Building dan Airport Systems, Lounge/Tenant, Lounge Visitor, Lounge Flights, Station Material, Airport Cost, SkyTeam, Initiative, dan User & Access. Permintaan simpan diarahkan ke API simulasi. Simulasi HTTP 503 pada Lounge/Tenant menampilkan pesan gagal pada dialog dan percobaan ulang mempertahankan ID. Firestore produksi, waktu aktual Netlify, akun nyata dan performa browser riil belum diuji.

## Overlay dan template Lounge/Tenant

Delta ini mencakup seluruh perubahan Runtime & Upload sebelumnya. Dialog portal mendapat ukuran viewport penuh pada densitas desktop dan mobile. Skala desktop untuk konten portal berasal dari aturan densitas yang sudah ada. Hasil visual di deploy belum diverifikasi.

Lounge/Tenant menggunakan Template_Layanan_Lounge_Tenant_P29.csv. Importer menerima nama kolom versi sebelumnya (misalnya airport dan serviceCategory), koma atau titik koma, dan menyebut kolom wajib saat header tidak sesuai. Uji lokal mencakup template P29 asli yang diisi satu baris, template lama, dan CSV titik koma dengan tanggal serial. Ketiganya menampilkan hasil dan menjalankan POST CREATE terhadap API simulasi. Perubahan parser ini berlaku pada Lounge/Tenant.
