# Requirements: Savings Goals & Cashflow Hybrid

## Overview

Fitur ini menambahkan dua kapabilitas utama ke BudgetIn:
1. **Savings Goals** — halaman untuk membuat dan memantau target tabungan
2. **Cashflow Hybrid** — savings diperlakukan sebagai alokasi tersendiri, bukan expense

---

## Requirement 1: Manajemen Savings Goals

**User Story:** Sebagai user, saya ingin membuat dan memantau target tabungan, sehingga saya bisa melacak progress menuju tujuan finansial saya.

### Acceptance Criteria

1. WHEN user membuka halaman `/dashboard/savings` THEN sistem SHALL menampilkan daftar semua savings goals milik user
2. WHEN user mengisi nama goal dan target amount lalu submit THEN sistem SHALL membuat goal baru dan menampilkannya di daftar
3. WHEN user mencoba membuat goal dengan nama kosong atau target amount ≤ 0 THEN sistem SHALL menolak request dan menampilkan pesan error
4. WHEN user menekan tombol hapus pada sebuah goal THEN sistem SHALL menghapus goal tersebut dan memperbarui tampilan
5. WHEN goal memiliki deadline THEN sistem SHALL menampilkan sisa hari menuju deadline
6. WHEN goal sudah tercapai (totalContributed ≥ targetAmount) THEN sistem SHALL menampilkan badge "Tercapai"
7. WHEN deadline sudah lewat dan goal belum tercapai THEN sistem SHALL menampilkan badge "Terlambat"

---

## Requirement 2: Deteksi Kontribusi Tabungan

**User Story:** Sebagai user, saya ingin kontribusi tabungan saya terdeteksi otomatis dari transaksi, sehingga saya tidak perlu input manual dua kali.

### Acceptance Criteria

1. WHEN sistem mendeteksi transaksi savings THEN sistem SHALL menggunakan keyword list yang luas mencakup variasi umum bahasa Indonesia (contoh: "tabungan", "nabung", "dana darurat", "investasi", "deposito", "dana pensiun", dll.)
2. WHEN `isSavingsTransaction(category)` dipanggil THEN sistem SHALL melakukan pencocokan case-insensitive
3. WHEN user ingin mengkategorikan kategori tertentu sebagai savings THEN sistem SHALL menyediakan mekanisme user-configurable savings categories melalui field `isSavings: Boolean` pada model `Category`
4. WHEN kategori memiliki `isSavings = true` THEN sistem SHALL memperlakukan semua transaksi dengan kategori tersebut sebagai kontribusi savings, terlepas dari nama kategorinya
5. WHEN menghitung total kontribusi THEN sistem SHALL menggabungkan hasil dari keyword matching DAN kategori yang ditandai `isSavings = true`
6. WHEN user adalah Google Sheets user THEN sistem SHALL memfilter transaksi dari Sheets berdasarkan keyword matching (karena Sheets tidak menyimpan metadata `isSavings`)

---

## Requirement 3: Progress & History Kontribusi

**User Story:** Sebagai user, saya ingin melihat progress dan riwayat kontribusi per goal, sehingga saya tahu seberapa dekat saya dengan target.

### Acceptance Criteria

1. WHEN goal ditampilkan THEN sistem SHALL menampilkan progress bar dengan persentase terkumpul / target
2. WHEN `totalContributed > targetAmount` THEN sistem SHALL tetap menghitung semua kontribusi (tidak di-cap), progress bar di-cap 100%, dan badge "Tercapai" ditampilkan
3. WHEN user menekan expand pada sebuah goal THEN sistem SHALL menampilkan daftar transaksi yang berkontribusi ke goal tersebut
4. WHEN tidak ada transaksi savings THEN sistem SHALL menampilkan `totalContributed = 0` dan progress bar 0%

---

## Requirement 4: Cashflow Hybrid

**User Story:** Sebagai user, saya ingin savings dipisahkan dari expense di cashflow view, sehingga saya mendapat gambaran keuangan yang lebih akurat.

### Acceptance Criteria

1. WHEN cashflow dihitung THEN sistem SHALL menggunakan formula: `Income − Expenses − Savings = Sisa`
2. WHEN menampilkan cashflow summary THEN sistem SHALL menampilkan 4 kolom: Pemasukan, Pengeluaran, Tabungan, Sisa
3. WHEN transaksi dikategorikan sebagai savings THEN sistem SHALL TIDAK memasukkannya ke dalam `totalExpense`
4. WHEN `totalContributed > targetAmount` di cashflow view THEN sistem SHALL tetap menghitung semua kontribusi savings (konsisten dengan card view)

---

## Requirement 5: Keamanan & Ownership

**User Story:** Sebagai user, saya ingin data savings goals saya aman dan tidak bisa diakses atau dimodifikasi oleh user lain.

### Acceptance Criteria

1. WHEN user mencoba mengakses goals THEN sistem SHALL hanya mengembalikan goals milik user yang sedang login
2. WHEN user mencoba menghapus goal THEN sistem SHALL memverifikasi kepemilikan dengan menyertakan `userId` filter pada query delete
3. WHEN user mencoba menghapus goal milik user lain THEN sistem SHALL mengembalikan error 404 (goal tidak ditemukan)

---

## Requirement 6: Budget Table Fix

**User Story:** Sebagai user, saya ingin kolom "Budget" di tabel budget menampilkan nominal penuh, sehingga saya bisa membaca angka dengan jelas.

### Acceptance Criteria

1. WHEN tabel budget ditampilkan THEN kolom "Budget" SHALL menampilkan nominal penuh (bukan format singkat seperti "500rb")
