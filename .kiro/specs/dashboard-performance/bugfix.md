# Bugfix Requirements Document

## Introduction

Dokumen ini mencakup dua bug yang perlu diperbaiki:

1. **Dashboard Load Time Performance** — Dashboard BudgetIn mengalami waktu muat yang lambat karena tidak adanya strategi caching lintas-request di server, tidak ada stale-while-revalidate pattern di client, dan tidak ada streaming/partial rendering. Setiap kali user membuka dashboard, seluruh data di-fetch ulang dari database/Google Sheets tanpa memanfaatkan cache.

2. **Hyperlink Injection di Email Verifikasi** — Field nama user pada registrasi tidak disanitasi sebelum dirender ke template email HTML. Attacker bisa menyisipkan URL/domain pada kolom nama yang kemudian muncul sebagai clickable hyperlink di email resmi BudgetIn, berpotensi untuk phishing dan social engineering.

---

## Bug Analysis — Dashboard Performance

### Current Behavior (Defect)

1.1 WHEN user membuka halaman dashboard THEN sistem melakukan full database/Sheets query pada setiap request tanpa cross-request cache, menyebabkan waktu muat yang lambat meskipun data belum berubah sejak request sebelumnya

1.2 WHEN client-side melakukan refetch data setelah mutasi THEN sistem melakukan full fetch tanpa deduplication atau stale-while-revalidate, sehingga UI menampilkan loading state yang lama dan tidak ada data stale yang ditampilkan sementara

1.3 WHEN user Google Sheets membuka dashboard THEN sistem melakukan full ledger fetch dari Google Sheets API pada setiap request meskipun data belum berubah, menyebabkan latency tinggi yang tidak perlu

1.4 WHEN dashboard page di-render di server THEN seluruh data (transaksi, budget, akun, kategori, savings) harus selesai di-resolve sebelum konten apapun ditampilkan ke user, menyebabkan Time to First Byte (TTFB) yang tinggi

1.5 WHEN user mencatat transaksi baru THEN UI menunggu response server dan refetch penuh sebelum memperbarui tampilan, menyebabkan delay yang terasa lambat antara aksi user dan feedback visual

1.6 WHEN client melakukan fetch ke API endpoints THEN sistem tidak memanfaatkan ETag/conditional request yang sudah diimplementasi di server, sehingga selalu menerima full response meskipun data tidak berubah

### Expected Behavior (Correct)

2.1 WHEN user membuka halaman dashboard THEN sistem SHALL menyajikan data dari server-side cache (TTL 30-60 detik per user) dan hanya melakukan fresh query jika cache expired atau di-invalidate oleh mutasi

2.2 WHEN client-side membutuhkan data terbaru THEN sistem SHALL menampilkan data stale dari cache secara instan dan melakukan background refresh (stale-while-revalidate pattern), sehingga user tidak melihat loading state yang lama

2.3 WHEN user Google Sheets membuka dashboard THEN sistem SHALL menyajikan data dari cache layer (TTL 60 detik per user) dan hanya melakukan fresh fetch ke Google Sheets API jika cache expired atau di-invalidate oleh operasi write

2.4 WHEN dashboard page di-render di server THEN sistem SHALL menggunakan streaming dengan Suspense boundaries untuk menampilkan KPI kritis (ringkasan hari ini, net worth) terlebih dahulu, kemudian stream data sekunder (riwayat transaksi, budget) secara progresif

2.5 WHEN user mencatat transaksi baru THEN sistem SHALL melakukan optimistic update pada local state secara langsung tanpa menunggu response server, kemudian melakukan background sync untuk memastikan konsistensi

2.6 WHEN client melakukan fetch ke API endpoints THEN sistem SHALL mengirim header If-None-Match dengan ETag terakhir yang diketahui, dan menerima response 304 Not Modified jika data belum berubah, mengurangi payload transfer

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user membuka dashboard untuk pertama kali (cold start, belum ada cache) THEN sistem SHALL CONTINUE TO menampilkan data yang akurat dan lengkap dari database/Sheets seperti saat ini

3.2 WHEN user melakukan mutasi (tambah/edit/hapus transaksi, budget, akun) THEN sistem SHALL CONTINUE TO menampilkan data terbaru yang konsisten setelah mutasi selesai — cache harus di-invalidate dengan benar

3.3 WHEN multiple tabs terbuka THEN sistem SHALL CONTINUE TO menyinkronkan perubahan data antar tab melalui BroadcastChannel seperti saat ini

3.4 WHEN user Google Sheets melakukan write operation THEN sistem SHALL CONTINUE TO memastikan data yang ditampilkan setelahnya adalah data terbaru dari Sheets (cache di-invalidate)

3.5 WHEN komponen below-the-fold di-render THEN sistem SHALL CONTINUE TO menggunakan dynamic import dengan skeleton placeholder untuk mengurangi initial bundle size

3.6 WHEN data kategori dan tipe akun di-fetch THEN sistem SHALL CONTINUE TO menggunakan profil cache "semi-static" yang sudah ada untuk data yang jarang berubah

3.7 WHEN dashboard menghitung budget data (rollover, spent, unbudgeted) THEN sistem SHALL CONTINUE TO menghasilkan kalkulasi yang identik dengan implementasi saat ini

---

## Bug Analysis — Hyperlink Injection di Email

### Current Behavior (Defect)

4.1 WHEN user mendaftar dengan nama yang mengandung URL/domain (contoh: "klik disini evil.com") THEN sistem merender nama tersebut langsung ke template HTML email verifikasi tanpa sanitasi, menyebabkan email client mengubah teks URL menjadi clickable hyperlink

4.2 WHEN user mendaftar dengan nama yang mengandung karakter HTML (contoh: `<a href="evil.com">klik</a>`) THEN sistem tidak melakukan HTML escaping pada field nama, berpotensi menyebabkan HTML injection pada body email

4.3 WHEN admin melakukan reset password untuk user yang namanya mengandung URL/domain THEN email reset password juga merender nama tanpa sanitasi di template HTML (`Halo, ${name}!`)

### Expected Behavior (Correct)

5.1 WHEN user mendaftar dengan nama yang mengandung URL/domain THEN sistem SHALL menyanitasi field nama dengan menghapus atau menolak karakter/pattern yang tidak valid untuk nama orang sebelum menyimpan ke database dan merender ke email

5.2 WHEN nama user dirender ke template email HTML THEN sistem SHALL melakukan HTML entity escaping pada semua user-generated content (minimal: `<`, `>`, `&`, `"`, `'`) sehingga tidak ada raw HTML atau auto-linked URL yang muncul di email

5.3 WHEN admin melakukan reset password THEN sistem SHALL menerapkan sanitasi yang sama pada nama user sebelum merender ke template email

5.4 WHEN user mencoba mendaftar dengan nama yang hanya berisi URL, karakter spesial, atau pattern mencurigakan THEN sistem SHALL menolak input dengan pesan error yang jelas dan tidak membuat akun

### Unchanged Behavior (Regression Prevention)

6.1 WHEN user mendaftar dengan nama normal (huruf, spasi, tanda baca umum seperti titik dan koma) THEN sistem SHALL CONTINUE TO menerima dan menampilkan nama tersebut dengan benar di email dan di aplikasi

6.2 WHEN user mendaftar dengan nama yang mengandung karakter non-Latin (aksara Jawa, Arab, Mandarin, dll.) THEN sistem SHALL CONTINUE TO menerima dan menampilkan nama tersebut dengan benar

6.3 WHEN email verifikasi dikirim THEN sistem SHALL CONTINUE TO menampilkan link verifikasi yang valid dan bisa diklik oleh user

6.4 WHEN email pengingat recurring dikirim THEN sistem SHALL CONTINUE TO menampilkan nama item/bill dengan benar (nama bill juga perlu disanitasi)
