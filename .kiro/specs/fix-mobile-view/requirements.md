# Requirements Document

## Introduction

Perbaikan tampilan mobile (viewport ≤ 768px) di seluruh halaman aplikasi BudgetIn agar tidak ada teks yang tumpang tindih, tidak ada konten yang melebar melebihi viewport, dan konten yang memang lebar (seperti tabel) dibungkus dengan horizontal scroll yang proper.

## Glossary

- **Viewport**: Area layar yang terlihat oleh pengguna pada perangkat mobile (lebar ≤ 768px)
- **Root_Layout**: Komponen layout utama di `app/layout.tsx` yang membungkus seluruh aplikasi
- **Dashboard_Layout**: Komponen layout dashboard di `app/dashboard/layout.tsx` yang berisi Sidebar dan area konten
- **Sidebar**: Komponen navigasi yang pada mobile tampil sebagai drawer overlay
- **DashboardTabs**: Komponen tab di halaman utama dashboard yang menampilkan tabel budget dengan `min-w-[860px]`
- **Public_Pages**: Halaman-halaman yang dapat diakses tanpa login (landing, about, auth, contact, privacy, terms)
- **Dashboard_Pages**: Halaman-halaman di dalam `/dashboard/` yang memerlukan autentikasi
- **Overflow_Wrapper**: Elemen `<div>` dengan class `overflow-x-auto` yang memungkinkan scroll horizontal pada konten yang lebih lebar dari container

## Requirements

### Requirement 1: Pencegahan Overflow Horizontal pada Root

**User Story:** Sebagai pengguna mobile, saya ingin halaman tidak bisa di-scroll secara horizontal di level body/html, sehingga pengalaman browsing terasa natural tanpa konten yang "bocor" ke samping.

#### Acceptance Criteria

1. THE Root_Layout SHALL memastikan elemen `<html>` dan `<body>` tidak menghasilkan horizontal scrollbar pada viewport mobile
2. WHEN konten di dalam halaman melebihi lebar viewport, THE Root_Layout SHALL memotong overflow horizontal pada level body sehingga hanya scroll vertikal yang tersedia di level halaman
3. WHEN konten lebar berada di dalam Overflow_Wrapper, THE Overflow_Wrapper SHALL menyediakan scroll horizontal lokal tanpa mempengaruhi scroll horizontal body

### Requirement 2: Responsive Text pada Landing Page

**User Story:** Sebagai pengguna mobile, saya ingin teks heading di landing page tetap terbaca dengan baik tanpa overflow atau tumpang tindih, sehingga saya bisa memahami value proposition BudgetIn.

#### Acceptance Criteria

1. WHEN viewport lebih kecil dari 640px, THE Landing_Page SHALL menampilkan heading utama (h1) dengan ukuran font yang responsif dan tidak melebihi lebar viewport
2. WHEN viewport lebih kecil dari 640px, THE Landing_Page SHALL menampilkan section heading (h2) dengan ukuran font yang menyesuaikan lebar layar
3. THE Landing_Page SHALL memastikan semua teks pada hero section melakukan word-wrap tanpa overflow horizontal
4. WHEN tombol CTA ditampilkan pada mobile, THE Landing_Page SHALL menyusun tombol secara vertikal dengan lebar penuh agar mudah di-tap

### Requirement 3: Horizontal Scroll untuk Tabel Dashboard

**User Story:** Sebagai pengguna mobile, saya ingin tabel budget dan data lebar lainnya bisa di-scroll secara horizontal di dalam container-nya, sehingga saya tetap bisa melihat semua kolom tanpa merusak layout halaman.

#### Acceptance Criteria

1. WHEN tabel budget ditampilkan pada viewport mobile, THE DashboardTabs SHALL membungkus tabel dengan Overflow_Wrapper yang memungkinkan scroll horizontal
2. THE Dashboard_Layout SHALL menggunakan `overflow-x-auto` (bukan `overflow-x-clip`) pada area konten utama agar child element yang membutuhkan scroll horizontal dapat berfungsi
3. WHEN tabel transaksi atau data grid ditampilkan pada mobile, THE Dashboard_Pages SHALL menyediakan Overflow_Wrapper di sekitar elemen dengan lebar minimum yang melebihi viewport

### Requirement 4: Responsive Grid dan Flex Layout

**User Story:** Sebagai pengguna mobile, saya ingin card dan grid layout menyesuaikan ke single-column pada layar kecil, sehingga konten tidak saling tumpang tindih.

#### Acceptance Criteria

1. WHEN viewport lebih kecil dari 640px, THE Dashboard_Pages SHALL menampilkan grid card dalam layout single-column
2. WHEN viewport lebih kecil dari 640px, THE Public_Pages SHALL menampilkan grid card dalam layout single-column
3. THE Dashboard_Pages SHALL memastikan flex container dengan banyak item melakukan wrap pada mobile sehingga tidak ada item yang terpotong
4. WHEN header atau toolbar memiliki banyak elemen, THE Dashboard_Pages SHALL menyusun elemen secara vertikal (stack) pada mobile

### Requirement 5: Truncation dan Word-Wrap pada Konten Panjang

**User Story:** Sebagai pengguna mobile, saya ingin teks panjang (nama kategori, catatan transaksi) ditampilkan dengan truncation atau word-wrap yang proper, sehingga tidak ada teks yang meluber keluar container.

#### Acceptance Criteria

1. WHEN nama kategori atau label melebihi lebar container, THE Dashboard_Pages SHALL memotong teks dengan ellipsis (truncate) atau melakukan word-break
2. WHEN catatan transaksi ditampilkan dalam list, THE Dashboard_Pages SHALL membatasi teks agar tetap dalam batas container menggunakan word-wrap atau truncation
3. THE Dashboard_Pages SHALL memastikan angka nominal dengan format panjang (contoh: Rp 1.000.000.000) tidak menyebabkan overflow pada card atau cell

### Requirement 6: Mobile Sidebar dan Navigation

**User Story:** Sebagai pengguna mobile, saya ingin navigasi sidebar berfungsi sebagai drawer yang tidak mengganggu layout konten utama, sehingga saya bisa berpindah halaman dengan mudah.

#### Acceptance Criteria

1. THE Sidebar SHALL menampilkan mobile topbar dengan tombol hamburger menu pada viewport mobile (< 768px)
2. WHEN pengguna membuka menu pada mobile, THE Sidebar SHALL menampilkan drawer overlay dari sisi kiri tanpa menggeser konten utama
3. WHEN pengguna menavigasi ke halaman baru pada mobile, THE Sidebar SHALL menutup drawer secara otomatis
4. THE Dashboard_Layout SHALL memberikan padding-top yang cukup pada konten utama untuk mengakomodasi fixed topbar pada mobile

### Requirement 7: Responsive pada Halaman Settings

**User Story:** Sebagai pengguna mobile, saya ingin halaman settings (account, account-types, backup-restore) tetap usable pada layar kecil tanpa konten yang terpotong.

#### Acceptance Criteria

1. WHEN form settings ditampilkan pada mobile, THE Dashboard_Pages SHALL menyusun form field secara full-width single-column
2. WHEN tabel atau list data ditampilkan di halaman settings, THE Dashboard_Pages SHALL membungkusnya dengan Overflow_Wrapper jika lebarnya melebihi viewport
3. THE Dashboard_Pages SHALL memastikan tombol aksi pada halaman settings tetap accessible dan tidak tumpang tindih dengan konten lain pada mobile
