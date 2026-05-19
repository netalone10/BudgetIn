# Requirements Document

## Introduction

Halaman `/dashboard/details` ("Rincian Pemasukan & Pengeluaran") menyatukan rincian pemasukan dan pengeluaran dalam satu halaman dengan sub-tab. Tampilan default mengelompokkan transaksi per kategori, dengan setiap baris kategori dapat di-expand (accordion) untuk menampilkan transaksi anggotanya. Halaman menyediakan filter periode (mengikuti pola `TransactionsClient`), filter akun, pencarian teks, dan ringkasan total dengan share kontribusi tiap kategori.

Fitur ini mengisi gap antara `/dashboard/transactions` (flat list, semua tipe) dan `/dashboard/report` (income statement formal). Fokusnya: drill-down cepat per kategori untuk satu tipe transaksi sekaligus, dengan akses edit/hapus inline melalui komponen `TransactionCard` yang sudah ada. Implementasi memaksimalkan reuse: data dari `GET /api/record` (existing) dan agregasi client-side via helper baru `aggregateDetails` di `lib/details-data.ts` yang konsisten dengan rule `aggregatePeriodReport` di `lib/report-data.ts`.

## Glossary

- **Details_Page**: Halaman Next.js di route `/dashboard/details` yang me-render server shell dan memuat `Details_Client` di dalam `<Suspense>`.
- **Details_Client**: Komponen client-side (`DetailsClient.tsx`) yang mengelola state, fetching, filter, dan rendering interaktif.
- **Details_Aggregator**: Fungsi pure `aggregateDetails` di `lib/details-data.ts` yang mengelompokkan transaksi per kategori menjadi `incomeGroups` dan `expenseGroups`.
- **Details_Filter**: Fungsi pure `applyDetailsFilters` di `lib/details-data.ts` yang menerapkan filter pencarian, akun, dan kategori pada array transaksi.
- **Details_Toggler**: Fungsi pure `toggleExpand` yang membalik keanggotaan sebuah kategori di dalam `Set<string>` expanded keys (immutable).
- **Type_Tabs**: Komponen `TypeTabs` yang menampilkan dua tombol pill (Pemasukan / Pengeluaran) beserta total dan jumlah transaksi per tab.
- **Category_Group_List**: Komponen yang me-render daftar `CategoryRow` (accordion) untuk tab aktif.
- **Category_Row**: Header satu kategori dalam accordion, menampilkan nama, total, share bar, count badge, dan chevron.
- **Tx_Row_List**: Daftar transaksi anggota satu kategori, dirender lazy ketika kategorinya di-expand, menggunakan komponen `TransactionCard` yang sudah ada.
- **Filter_Bar**: Kumpulan kontrol filter (periode, kustom range, pencarian, akun).
- **Summary_Strip**: Komponen ringkasan total dan jumlah transaksi untuk tab aktif.
- **CategoryGroup**: Struktur data hasil agregasi `{ category, amount, count, share, transactions }` di mana `amount >= 0`, `count === transactions.length`, dan `0 <= share <= 1`.
- **DetailsAggregation**: Hasil `Details_Aggregator` berisi `{ incomeGroups, expenseGroups, incomeTotal, expenseTotal }`.
- **Active_Tab**: Sub-tab aktif, salah satu dari `"income"` atau `"expense"`. Default: `"expense"`.
- **Period**: Salah satu dari `"today" | "week" | "month" | "lastMonth" | "custom"`. Default: `"month"`.
- **Expanded_Keys**: `Set<string>` berisi nama kategori yang sedang di-expand di tab aktif.
- **Saldo_Awal_Category**: Kategori bernama persis `"Saldo Awal"` yang harus diabaikan dari agregasi.
- **Savings_Category**: Kategori yang termasuk savings sesuai `isSavingsTransaction(category, savingsCategoryNames)` dari `@/lib/savings-utils`.
- **Transfer_Principal**: Transaksi `transfer_in`/`transfer_out` yang merepresentasikan principal pemindahan dana antar akun (bukan expense), diidentifikasi via `isExpenseTransaction(tx)` dari `@/lib/transaction-classification`.
- **Sidebar**: Komponen navigasi `components/Sidebar.tsx`, khususnya array `insightsItems`.

## Requirements

### Requirement 1: Navigasi & Page Shell

**User Story:** Sebagai pengguna BudgetIn, saya ingin mengakses halaman rincian pemasukan dan pengeluaran dari sidebar, sehingga saya dapat melakukan drill-down per kategori tanpa meninggalkan dashboard.

#### Acceptance Criteria

1. THE Sidebar SHALL menampilkan tepat satu item navigasi berlabel `"Rincian"` dengan ikon `ListTree` sebagai entri di dalam grup `insightsItems`, dengan target navigasi ke `/dashboard/details` dan status active ditandai ketika pathname aktif tepat sama dengan `/dashboard/details`.
2. WHEN pengguna terautentikasi membuka `/dashboard/details`, THE Details_Page SHALL me-render heading `"Rincian Pemasukan & Pengeluaran"` sebagai bagian dari output server dan memuat Details_Client di dalam `<Suspense>` dengan fallback skeleton yang mengisi area konten utama dan tetap terlihat hingga Details_Client selesai mount di sisi klien.
3. THE Details_Page SHALL tidak melakukan pemanggilan endpoint maupun query data untuk transaksi, akun, atau kategori pada saat eksekusi di sisi server, dan seluruh fetching data dinamis tersebut harus dieksekusi oleh Details_Client setelah hydration di sisi klien.
4. WHERE konten halaman bersifat statis (metadata halaman, heading, dan copy non-dinamis), THE Details_Page SHALL me-render konten tersebut di sisi server tanpa melibatkan endpoint data dinamis maupun memerlukan hydration Details_Client.
5. IF pengguna yang belum terautentikasi mengakses `/dashboard/details`, THEN THE Details_Page SHALL mengikuti aturan proteksi route dashboard yang sudah berlaku dengan mengarahkan pengguna ke alur login sebelum konten Details_Page dirender.

### Requirement 2: Sub-tab Pemasukan & Pengeluaran

**User Story:** Sebagai pengguna, saya ingin beralih antara tampilan pemasukan dan pengeluaran dalam satu halaman, sehingga saya dapat menganalisis kedua sisi tanpa memuat ulang data.

#### Acceptance Criteria

1. WHEN Details_Client pertama kali ter-mount, THE Details_Client SHALL menetapkan Active_Tab ke nilai `"expense"` sebelum render pertama Type_Tabs sehingga tab Pengeluaran tampil dalam keadaan terpilih (state `aria-selected="true"` atau penanda visual setara) tanpa memerlukan interaksi pengguna.
2. THE Type_Tabs SHALL menampilkan tepat dua tombol pill berlabel `"Pemasukan"` dan `"Pengeluaran"`, masing-masing menampilkan total nominal dalam format mata uang IDR (mis. `Rp1.234.567`) dan jumlah transaksi sebagai bilangan bulat non-negatif, dihitung dari hasil agregasi yang sudah di-memo untuk rentang tanggal aktif; jika jumlah transaksi 0, total nominal SHALL ditampilkan sebagai `Rp0`.
3. WHEN pengguna mengaktifkan tab Pemasukan (klik atau aktivasi keyboard pada tombol pill `"Pemasukan"`), THE Details_Client SHALL me-render `incomeGroups` dari hasil agregasi yang sudah di-memo dan SHALL TIDAK memicu permintaan HTTP baru ke `/api/record` apabila satu-satunya perubahan state adalah Active_Tab.
4. WHEN pengguna mengaktifkan tab Pengeluaran (klik atau aktivasi keyboard pada tombol pill `"Pengeluaran"`), THE Details_Client SHALL me-render `expenseGroups` dari hasil agregasi yang sudah di-memo dan SHALL TIDAK memicu permintaan HTTP baru ke `/api/record` apabila satu-satunya perubahan state adalah Active_Tab.
5. WHEN Active_Tab berubah dari nilai sebelumnya ke nilai baru yang valid (`"income"` atau `"expense"`), THE Details_Client SHALL me-reset Expanded_Keys menjadi `Set<string>` kosong pada render yang sama sehingga tidak ada grup yang tampil dalam keadaan terbuka pada tab tujuan.
6. IF nilai yang dikirim untuk mengubah Active_Tab bukan salah satu dari `"income"` atau `"expense"`, THEN THE Details_Client SHALL mempertahankan nilai Active_Tab sebelumnya, SHALL TIDAK mengubah Expanded_Keys, dan SHALL TIDAK memicu permintaan HTTP baru ke `/api/record`.

### Requirement 3: Filter Periode

**User Story:** Sebagai pengguna, saya ingin memilih periode tampilan (hari ini, minggu ini, bulan ini, bulan lalu, atau rentang kustom), sehingga saya dapat membatasi rincian sesuai jendela waktu yang relevan.

#### Acceptance Criteria

1. WHEN Details_Client pertama kali ter-mount, THE Details_Client SHALL menetapkan Period ke `"month"`.
2. WHEN pengguna memilih Period selain `"custom"`, THE Details_Client SHALL melakukan fetch ke `/api/record?period=<periodValue>` dengan `cache: "no-store"`.
3. WHERE Period adalah `"custom"` dan kedua input `customFrom` dan `customTo` terisi dengan tanggal valid yang memenuhi `customFrom <= customTo`, THE Details_Client SHALL melakukan fetch ke `/api/record?period=custom&from=<customFrom>&to=<customTo>`.
4. IF Period adalah `"custom"` namun `customFrom` atau `customTo` kosong atau gagal di-parse sebagai tanggal, atau `customFrom > customTo`, THEN THE Details_Client SHALL menunda fetch dan menampilkan pesan helper `"Pilih tanggal mulai dan akhir yang valid."`.
5. WHEN Period berubah, atau `customFrom`/`customTo` berubah saat Period adalah `"custom"`, dan terdapat fetch sebelumnya yang masih in-flight, THE Details_Client SHALL membatalkan request sebelumnya menggunakan `AbortController` sebelum memulai request baru.
6. WHEN Period, `customFrom`, atau `customTo` berubah, THE Details_Client SHALL me-reset Expanded_Keys menjadi `Set<string>` kosong.

### Requirement 4: Filter Akun, Kategori, dan Pencarian

**User Story:** Sebagai pengguna, saya ingin menyaring rincian berdasarkan akun, kategori, dan teks pencarian, sehingga saya dapat menemukan transaksi tertentu dengan cepat.

#### Acceptance Criteria

1. THE Filter_Bar SHALL menyediakan kontrol untuk pencarian teks, pemilihan akun, dan pemilihan kategori opsional.
2. WHEN pengguna menerapkan satu atau lebih filter, THE Details_Filter SHALL mengembalikan transaksi yang memenuhi semua filter aktif (semantik AND) dengan urutan relatif input dipertahankan.
3. WHERE `accountFilter` non-kosong, THE Details_Filter SHALL hanya menyertakan transaksi `tx` yang memenuhi `tx.accountId === accountFilter` ATAU `tx.fromAccountId === accountFilter` ATAU `tx.toAccountId === accountFilter`.
4. WHERE `categoryFilter` non-kosong, THE Details_Filter SHALL hanya menyertakan transaksi yang memiliki `tx.category === categoryFilter`.
5. WHERE `searchQuery` non-kosong setelah `trim`, THE Details_Filter SHALL hanya menyertakan transaksi yang gabungan lowercase dari `tx.note` dan `tx.category` mengandung lowercase dari `searchQuery`.
6. THE Details_Filter SHALL idempoten: untuk semua input `txs` dan `filters`, `applyDetailsFilters(applyDetailsFilters(txs, filters), filters)` SHALL menghasilkan array yang deeply equal dengan `applyDetailsFilters(txs, filters)`.
7. THE Details_Filter SHALL tidak memutasi array input atau elemennya.

### Requirement 5: Agregasi per Kategori

**User Story:** Sebagai pengguna, saya ingin melihat total dan share kontribusi setiap kategori untuk tab aktif, sehingga saya dapat memahami kontribusi relatif tiap kategori terhadap total.

#### Acceptance Criteria

1. WHEN Details_Aggregator dipanggil dengan array transaksi dan `savingsCategoryNames`, THE Details_Aggregator SHALL mengembalikan `DetailsAggregation` berisi `incomeGroups`, `expenseGroups`, `incomeTotal`, dan `expenseTotal`.
2. THE Details_Aggregator SHALL mengabaikan setiap transaksi dengan `tx.category === "Saldo Awal"`.
3. THE Details_Aggregator SHALL mengabaikan setiap transaksi dengan `Math.abs(Number(tx.amount) || 0) === 0`.
4. WHEN sebuah transaksi memiliki `tx.type === "income"`, THE Details_Aggregator SHALL menambahkan `Math.abs(tx.amount)` ke bucket `incomeMap[tx.category]` dan ke `incomeTotal`.
5. IF sebuah transaksi non-income tidak memenuhi `isExpenseTransaction(tx)`, THEN THE Details_Aggregator SHALL mengabaikan transaksi tersebut (mengecualikan Transfer_Principal).
6. IF sebuah transaksi non-income memenuhi `isExpenseTransaction(tx)` dan `isSavingsTransaction(tx.category, savingsCategoryNames)` bernilai true, THEN THE Details_Aggregator SHALL mengabaikan transaksi tersebut.
7. WHEN sebuah transaksi non-income memenuhi `isExpenseTransaction(tx)` dan bukan Savings_Category, THE Details_Aggregator SHALL menambahkan `Math.abs(tx.amount)` ke bucket `expenseMap[tx.category]` dan ke `expenseTotal`.
8. THE Details_Aggregator SHALL menjamin `Math.abs(incomeTotal - sum(incomeGroups[i].amount)) < 0.01` dan `Math.abs(expenseTotal - sum(expenseGroups[i].amount)) < 0.01` (Total Invariance).
9. THE Details_Aggregator SHALL menjamin `g.count === g.transactions.length` untuk setiap `g` di `incomeGroups` dan `expenseGroups` (Count Integrity).
10. WHERE total tab > 0, THE Details_Aggregator SHALL menetapkan `g.share = g.amount / grandTotal` untuk tiap group, dan menjamin `Math.abs(sum(groups[i].share) - 1) < 0.01` (Share Normalization).
11. WHERE total tab === 0, THE Details_Aggregator SHALL menetapkan `g.share = 0` untuk tiap group.
12. THE Details_Aggregator SHALL menjamin `g.amount >= 0`, `incomeTotal >= 0`, dan `expenseTotal >= 0` karena akumulasi menggunakan `Math.abs(tx.amount)`, sehingga `g.share >= 0` untuk semua group.
13. THE Details_Aggregator SHALL mengurutkan `incomeGroups` dan `expenseGroups` secara descending berdasarkan `amount`, dengan tie-break ascending berdasarkan `category` (string compare).
14. THE Details_Aggregator SHALL mengurutkan `transactions` di dalam tiap group secara descending berdasarkan tanggal-waktu menggunakan `compareTransactionDateTimeDesc`.
15. THE Details_Aggregator SHALL tidak memutasi array `transactions` input atau elemennya.
16. FOR ALL pasangan `(transactions, savingsCategoryNames)` valid, untuk setiap kategori `c` yang muncul di `aggregatePeriodReport(transactions, savingsCategoryNames).income` (atau `.expense`) dengan amount `r`, group dengan `category === c` di `aggregateDetails(transactions, savingsCategoryNames).incomeGroups` (atau `.expenseGroups`) SHALL memiliki `Math.abs(g.amount - r) < 0.01` (Konsistensi dengan Report).

### Requirement 6: Accordion Per Kategori

**User Story:** Sebagai pengguna, saya ingin mengembangkan dan menutup baris kategori untuk melihat transaksi anggotanya, sehingga saya dapat melakukan drill-down tanpa berpindah halaman.

#### Acceptance Criteria

1. WHEN Category_Group_List me-render groups untuk tab aktif, THE Category_Group_List SHALL me-render satu Category_Row per group dengan kondisi awal collapsed (kecuali kategori tersebut ada di Expanded_Keys).
2. THE Category_Row SHALL menampilkan nama kategori, total IDR, share bar, count badge, dan chevron yang merefleksikan kondisi expanded/collapsed.
3. WHEN pengguna meng-klik Category_Row, atau menekan tombol Enter atau Space saat fokus pada Category_Row, THE Details_Client SHALL memanggil Details_Toggler untuk kategori tersebut dan memperbarui Expanded_Keys.
4. THE Details_Toggler SHALL menghasilkan `Set<string>` baru tanpa memutasi input dan SHALL memenuhi involusi: untuk semua `set` dan `cat`, `toggleExpand(toggleExpand(set, cat), cat)` SHALL deeply equal dengan `set`.
5. WHILE sebuah kategori berada di Expanded_Keys, THE Category_Group_List SHALL me-mount dan me-render Tx_Row_List untuk kategori tersebut dengan transaksi anggotanya.
6. WHILE sebuah kategori tidak berada di Expanded_Keys, THE Category_Group_List SHALL tidak me-mount Tx_Row_List untuk kategori tersebut sehingga komponen tidak hadir di pohon React (lazy mount untuk performa).
7. THE Category_Row SHALL menetapkan `aria-expanded` sesuai status expanded/collapsed dan `aria-controls` yang menunjuk ke region Tx_Row_List terkait.

### Requirement 7: Edit & Hapus Transaksi Inline

**User Story:** Sebagai pengguna, saya ingin mengedit atau menghapus transaksi langsung dari rincian kategori, sehingga saya tidak perlu berpindah ke halaman lain untuk koreksi cepat.

#### Acceptance Criteria

1. THE Tx_Row_List SHALL me-render setiap transaksi anggota menggunakan komponen `TransactionCard` existing yang mendukung edit dan delete inline.
2. WHEN pengguna menghapus sebuah transaksi melalui `TransactionCard`, THE Details_Client SHALL menghapus transaksi tersebut dari state lokal dan memanggil `emitDataChanged(["transactions", "budget", "accounts"])`.
3. WHEN pengguna mengubah sebuah transaksi melalui `TransactionCard`, THE Details_Client SHALL menggabungkan perubahan ke state lokal (`{ ...t, ...data }`) dan memanggil `emitDataChanged(["transactions", "budget", "accounts"])`.
4. WHEN Details_Client menerima `useDataEvent("transactions")`, THE Details_Client SHALL melakukan re-fetch ke `/api/record` dengan parameter Period yang aktif.

### Requirement 8: Ringkasan Total

**User Story:** Sebagai pengguna, saya ingin melihat total pemasukan, total pengeluaran, dan jumlah transaksi untuk periode aktif, sehingga saya memahami konteks angka sebelum drill-down.

#### Acceptance Criteria

1. WHEN agregasi data periode aktif selesai, THE Summary_Strip SHALL menampilkan total dalam format IDR dengan separator ribuan dan dua angka desimal beserta jumlah transaksi sebagai bilangan bulat non-negatif untuk Active_Tab.
2. THE Type_Tabs SHALL menampilkan total IDR dan jumlah transaksi untuk tab Pemasukan dan tab Pengeluaran secara bersamaan pada satu tampilan tanpa memerlukan perpindahan Active_Tab.
3. IF tidak terdapat transaksi pada periode aktif untuk suatu tab, THEN THE Summary_Strip SHALL menampilkan total bernilai 0 IDR dan jumlah transaksi bernilai 0 pada tab tersebut.
4. WHEN transaksi pada periode aktif ditambahkan, diubah, atau dihapus, THE Summary_Strip SHALL memperbarui total IDR dan jumlah transaksi pada Active_Tab dalam waktu maksimum 2 detik.
5. IF agregasi data periode aktif gagal dimuat, THEN THE Summary_Strip SHALL menampilkan indikator kegagalan pemuatan dan SHALL tidak menampilkan nilai total maupun jumlah transaksi dari hasil agregasi sebelumnya.

### Requirement 9: Empty States & Filter Tanpa Hasil

**User Story:** Sebagai pengguna, saya ingin mendapatkan umpan balik yang jelas saat tidak ada data atau filter saya tidak menghasilkan apa pun, sehingga saya tahu langkah selanjutnya.

#### Acceptance Criteria

1. WHEN `incomeGroups.length === 0` dan `expenseGroups.length === 0` setelah agregasi, THE Details_Client SHALL menampilkan empty state berisi pesan `"Belum ada {pemasukan|pengeluaran} di periode ini."` sesuai tab aktif beserta saran mengganti periode.
2. IF `transactions.length > 0` namun hasil Details_Filter menghasilkan array kosong, THEN THE Details_Client SHALL menampilkan empty state `"Tidak ada transaksi yang cocok dengan filter."` beserta tombol `"Reset filter"` yang mengembalikan `searchQuery`, `accountFilter`, dan `categoryFilter` ke nilai kosong.

### Requirement 10: Penanganan Error API

**User Story:** Sebagai pengguna, saya ingin mendapat informasi yang jelas saat fetch data gagal, sehingga saya tahu apakah perlu login ulang atau mencoba kembali.

#### Acceptance Criteria

1. IF fetch ke `/api/record` mengembalikan status 401 dengan kode `token_expired`, THEN THE Details_Client SHALL menampilkan pesan `"Sesi expired. Silakan login ulang."` dan menyediakan jalur ke logout/login.
2. IF fetch ke `/api/record` gagal karena network error atau status 5xx, THEN THE Details_Client SHALL menampilkan empty state error dengan tombol `"Coba lagi"` yang memicu pemanggilan ulang `fetchTx()` dengan parameter Period yang aktif.
3. WHEN fetch dibatalkan oleh `AbortController` (`AbortError`), THE Details_Client SHALL tidak mengubah state `transactions` dan SHALL tidak menampilkan pesan error.

### Requirement 11: Reuse Kontrak Data dengan Report

**User Story:** Sebagai pengguna yang juga melihat `/dashboard/report`, saya ingin angka per kategori di rincian konsisten dengan income statement, sehingga saya tidak menerima dua jawaban berbeda untuk pertanyaan yang sama.

#### Acceptance Criteria

1. THE Details_Aggregator SHALL menggunakan rule eksklusi yang sama dengan `aggregatePeriodReport`: mengabaikan `Saldo Awal`, mengabaikan Transfer_Principal via `isExpenseTransaction`, dan mengabaikan Savings_Category via `isSavingsTransaction`.
2. THE Details_Aggregator SHALL tidak memerlukan endpoint API baru dan SHALL hanya bergantung pada `GET /api/record`, `GET /api/categories`, dan `GET /api/accounts` yang sudah ada.

### Requirement 12: Mobile Responsiveness & Aksesibilitas

**User Story:** Sebagai pengguna mobile dan pengguna assistive technology, saya ingin halaman rincian tetap bisa dipakai di layar kecil dan dengan keyboard, sehingga fitur ini inklusif.

#### Acceptance Criteria

1. THE Type_Tabs SHALL membungkus ke beberapa baris pada viewport dengan lebar di bawah 360px menggunakan `flex-wrap`.
2. THE Filter_Bar SHALL me-render kontrol filter sebagai grid satu kolom pada viewport mobile dan dua hingga empat kolom pada viewport tablet/desktop.
3. WHEN pengguna menggunakan keyboard untuk fokus pada Category_Row dan menekan Enter atau Space, THE Details_Client SHALL men-toggle expand state untuk kategori tersebut.
4. WHEN sebuah Category_Row di-expand, THE Category_Row SHALL menetapkan `aria-expanded="true"` dan `aria-controls` menunjuk ke id region Tx_Row_List yang aktif.
