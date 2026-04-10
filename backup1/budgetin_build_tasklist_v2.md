# Budgetin — Build Task List v2

**18 prompt · eksekusi satu per satu · salin prompt ke AI tool pilihan kamu**

> **Changelog v2:** Dashboard, Modal, storage.js dipecah jadi 2 prompt. Tambah 4 fitur: recurring transactions, edit/hapus transaksi, goal tracking, export data. Total 14 → 18 task.

---

## ✅ Sudah Ada

### Task 00 — Landing page (index.html) `SELESAI`

Sudah ada di file DuitKuy. Perlu rename brand ke Budgetin dan ganti warna aksen.

```
Rename brand dari "DuitKuy" ke "Budgetin" di seluruh file HTML berikut.
Ganti juga:
- <title> menjadi "Budgetin — Atur Keuanganmu dari Nol"
- Semua teks "DuitKuy" → "Budgetin"
- Warna aksen utama: dari green-600 (#16a34a) → #0EA5E9 (sky blue)
- Meta description update ke brand Budgetin
Output: file HTML lengkap dengan perubahan tersebut.
[paste isi file DuitKuy___Personal_Finance_Planner.html di sini]
```

---

## 🟣 Fase 1 — Struktur & Auth

### Task 01 — Auth pages: Login & Register `~200 lines`

Dua halaman: /masuk dan /daftar. Style konsisten dengan landing page Budgetin.

```
Buat dua halaman HTML terpisah untuk aplikasi "Budgetin":

1. login.html — halaman /masuk
2. register.html — halaman /daftar

Design system:
- Font: Plus Jakarta Sans (Google Fonts)
- Primary: #0EA5E9 | Income: #16a34a | Expense: #dc2626 | Transfer: #2563eb
- Border radius: 12px cards, 8px inputs | Background: #f9fafb

Login: Email, Password, tombol "Masuk", link ke /daftar
Register: Nama, Email, Password, Konfirmasi, tombol "Daftar Gratis", link ke /masuk

Constraints:
- Pure HTML + CSS, no framework, mobile-first
- Bahasa Indonesia, no JS, max 200 lines per file
```

---

### Task 02 — App shell: layout dasar post-login `~250 lines` `REVISED`

Sidebar navigation + main content area. Template SEMUA halaman dalam app. **REVISI: nav ditambah "Target".**

```
Buat app-shell.html — template layout utama untuk "Budgetin" post-login.

Layout:
- Sidebar kiri (fixed, 240px) dengan navigasi
- Main content area (flex-1, scrollable)
- Top bar (mobile only) dengan hamburger menu

Sidebar nav items (urutan penting):
1. Dashboard (icon: grid)
2. Transaksi (icon: list)
3. Anggaran (icon: pie-chart)
4. Target (icon: flag) ← BARU
5. Laporan (icon: bar-chart)
6. Akun Saya (icon: wallet)
7. Pengaturan (icon: settings)

Sidebar footer: nama user "Budi Santoso" + tombol logout
Main content: placeholder "Konten halaman di sini"

Design system: Plus Jakarta Sans, #0EA5E9 primary
Constraints: Pure HTML+CSS, sidebar collapse jadi bottom nav di mobile (5 item utama: Dashboard, Transaksi, Target, Laporan, Akun), max 250 lines
```

---

## 🔵 Fase 2 — Core Features

### Task 03a — Dashboard: top section `~180 lines` `SPLIT`

3 widget atas: net worth, cashflow bulan ini, quick actions. Dipecah dari Task 03 lama.

⚠️ *Butuh: 02 (app shell)*

```
Buat dashboard-top.html — bagian atas halaman dashboard "Budgetin".
Gunakan layout dari app-shell.html sebagai base.

3 Widget:

Widget 1 — Net Worth Card:
- Total: Rp 24.500.000 (font besar, bold)
- Breakdown horizontal: BCA Rp 15jt | GoPay Rp 2,5jt | Jenius Rp 7jt
- Badge: "+Rp 1.200.000 dari bulan lalu" (green, arrow up)

Widget 2 — Cashflow Bulan Ini:
- Layout: 2 kolom
- Kiri: Pemasukan Rp 8.500.000 (green, arrow up)
- Kanan: Pengeluaran Rp 5.200.000 (red, arrow down)
- Bar visual: green bar vs red bar proporsional
- Footer: "Selisih +Rp 3.300.000" (green bold)
- Note kecil: "Transfer tidak termasuk dalam cashflow"

Widget 3 — Quick Actions:
- 3 tombol horizontal:
  "+ Pengeluaran" (red accent) | "+ Pemasukan" (green accent) | "⇄ Transfer" (blue accent)
- Setiap tombol: icon + label, border colored, background white

Design system: Plus Jakarta Sans, #0EA5E9 primary
Constraints: Pure HTML+CSS, static data, max 180 lines, responsive (stack vertical di mobile)
```

---

### Task 03b — Dashboard: bottom section `~200 lines` `SPLIT`

3 widget bawah: budget overview, transaksi terakhir, goal progress. Dipecah dari Task 03 lama.

⚠️ *Butuh: 03a (dashboard top)*

```
Lanjutkan dashboard "Budgetin" — tambahkan 3 widget di bawah widget yang sudah ada di 03a.

Widget 4 — Budget Overview (5 kategori):
- Makan: 1.200.000/1.500.000 (80%) → progress bar amber, badge "Hampir Limit"
- Transport: 450.000/600.000 (75%) → green, "Aman"
- Hiburan: 320.000/300.000 (107%) → red, "Over Budget"
- Belanja: 800.000/1.000.000 (80%) → amber, "Hampir Limit"
- Tagihan: 500.000/500.000 (100%) → amber, "Pas"
Progress bar: green <75% | amber 75-99% | red ≥100%
Footer link: "Lihat semua →" ke /anggaran

Widget 5 — 5 Transaksi Terakhir:
Format setiap row: icon | nama + kategori | tanggal | jumlah (warna tipe)
- Pengeluaran: merah, icon ↓ | Pemasukan: hijau, icon ↑ | Transfer: biru, icon ⇄
Data hardcoded 5 item campuran
Footer link: "Semua transaksi →" ke /transaksi

Widget 6 — Goal Progress (NEW):
- 1 goal preview: "Nikah 2026" target Rp 60.000.000, terkumpul Rp 13.000.000 (21.7%)
- Circular progress ring (SVG) atau horizontal bar
- Sisa: Rp 47.000.000 | Estimasi selesai: "27 bulan lagi"
- Link: "Lihat semua target →" ke /target

Constraints: max 200 lines, static data, design system Budgetin
```

---

### Task 04a — Form transaksi: UI 3 tab + recurring `~180 lines` `SPLIT`

Modal form untuk 3 tipe transaksi. **REVISI: tambah toggle recurring.** Dipecah: ini UI only.

⚠️ *Butuh: 02 (app shell)*

```
Buat transaction-modal.html — komponen modal form transaksi untuk "Budgetin".
File ini HANYA struktur HTML + CSS. JavaScript di prompt berikutnya (04b).

3 TAB di bagian atas: [Pengeluaran] [Pemasukan] [Transfer]
Default aktif: Pengeluaran

TAB Pengeluaran (red accent #dc2626):
- Input: Jumlah (besar, center) | Kategori (dropdown 7 opsi) | Dari akun (dropdown) | Tanggal (date input, default hari ini) | Catatan (textarea, opsional)
- Toggle: "🔄 Recurring" — jika ON, tampilkan: Frekuensi (Harian/Mingguan/Bulanan/Tahunan) + Sampai kapan (date/Tanpa batas)
- Tombol: "Simpan Pengeluaran" (red)

TAB Pemasukan (green accent #16a34a):
- Input: Jumlah | Sumber (dropdown: Gaji, Freelance, Bonus, Investasi, Lainnya) | Ke akun | Tanggal | Catatan
- Toggle recurring sama seperti di atas
- Tombol: "Simpan Pemasukan" (green)

TAB Transfer (blue accent #2563eb):
- Input: Jumlah | Dari akun | Ke akun | Tanggal | Catatan
- Note: "Transfer tidak dihitung sebagai pengeluaran atau pemasukan"
- TIDAK ada recurring toggle untuk transfer
- Tombol: "Simpan Transfer" (blue)

Modal: overlay gelap, card center, tombol X tutup
Constraints: max 180 lines, full screen di mobile, no JS di file ini
```

---

### Task 04b — Form transaksi: JS logic + edit mode `~150 lines JS` `SPLIT`

JavaScript untuk modal: tab switch, format angka, validasi, recurring toggle, dan EDIT mode.

⚠️ *Butuh: 04a (modal UI)*

```
Buat transaction-modal.js — JavaScript untuk modal transaksi "Budgetin".

Fungsi yang harus ada:

1. Tab switching:
- Klik tab → ganti form yang tampil + ganti warna aksen (red/green/blue)
- Reset form saat ganti tab

2. Format angka:
- Input jumlah: auto format "Rp 1.500.000" saat ketik
- Strip non-numeric saat submit

3. Validasi:
- Jumlah wajib > 0
- Kategori/sumber wajib dipilih
- Transfer: "Dari akun" dan "Ke akun" tidak boleh sama
- Jika recurring ON: frekuensi wajib dipilih

4. Recurring toggle:
- Klik toggle → show/hide frekuensi fields dengan slide animation
- Transfer tab: sembunyikan toggle recurring

5. EDIT MODE (NEW):
- Fungsi openEditMode(transactionData):
  - Pre-fill semua field dari data transaksi yang ada
  - Ganti judul modal: "Catat Transaksi" → "Edit Transaksi"
  - Ganti tombol: "Simpan..." → "Update..."
  - Tambah tombol "Hapus" (merah, di kiri) dengan konfirmasi
- Fungsi openCreateMode(): reset ke mode default

6. Submit:
- Kumpulkan data → return object {type, amount, category, fromAccount, toAccount, date, note, recurring: {enabled, frequency, until}}
- Trigger custom event 'transaction-saved' dengan data

Constraints: max 150 lines, vanilla JS, no framework
```

---

### Task 05 — Halaman transaksi + edit/hapus `~250 lines` `REVISED`

**REVISI: tambah tombol edit dan hapus per transaksi, dengan konfirmasi delete.**

⚠️ *Butuh: 02 (app shell), 04a+04b (modal)*

```
Buat transactions.html — halaman daftar transaksi untuk "Budgetin".

Header:
- Judul "Transaksi"
- Filter tabs: [Semua] [Pengeluaran] [Pemasukan] [Transfer]
- Dropdown: bulan + kategori
- Tombol "+ Catat Transaksi" (buka modal)

Summary strip:
- Pemasukan Rp 8.500.000 (green) | Pengeluaran Rp 5.200.000 (red)
- Note: "Transfer Rp 2.000.000 — tidak masuk cashflow"

Transaction list (10 data hardcoded):
Setiap row:
- Kiri: icon kategori + nama/deskripsi + kategori label + tanggal
- Kanan: jumlah (warna tipe) + badge tipe
- Recurring indicator: icon 🔄 kecil di samping nama jika recurring
- Transfer: tampilkan "BCA → GoPay", icon ⇄, warna biru

★ AKSI PER TRANSAKSI (NEW):
- Hover/tap row → muncul 2 tombol kecil di kanan:
  ✏️ Edit → buka modal dalam EDIT MODE (pre-fill data)
  🗑️ Hapus → konfirmasi "Hapus transaksi ini?" → Ya/Batal
- Mobile: swipe kiri untuk reveal tombol edit/hapus (CSS only, translateX trick)

JS:
- Filter tabs: klik → tampilkan hanya tipe tersebut
- Delete: hapus row dari DOM + alert konfirmasi
- Edit: panggil openEditMode() dari modal

Constraints: max 250 lines, design system Budgetin
```

---

### Task 06 — Halaman budget (/anggaran) `~200 lines`

Set budget per kategori, tampil perbandingan budget vs realisasi dengan progress bar.

⚠️ *Butuh: 02 (app shell)*

```
Buat budget.html — halaman manajemen anggaran untuk "Budgetin".

Header: "Anggaran" + period selector "Maret 2026" + tombol "+ Atur Budget"

Summary card:
- Total budget: Rp 5.000.000
- Realisasi: Rp 4.270.000
- Sisa: Rp 730.000
- Status badge: "Dalam Kendali" (green) / "Perlu Perhatian" (amber) / "Over Budget" (red)

7 kategori hardcoded:
1. Makan — budget 1.500.000 / actual 1.200.000 → 80% → Aman (green)
2. Transport — 600.000 / 450.000 → 75% → Aman (green)
3. Hiburan — 300.000 / 320.000 → 107% → Over (red)
4. Belanja — 1.000.000 / 800.000 → 80% → Hampir Limit (amber)
5. Tagihan — 500.000 / 500.000 → 100% → Pas (amber)
6. Kesehatan — 300.000 / 0 → 0% → Aman (green)
7. Lainnya — 800.000 / 1.000.000 → 125% → Over (red)

Setiap kartu budget:
- Nama kategori + icon
- Progress bar (green <75% | amber 75-99% | red ≥100%)
- "Rp 1.200.000 / Rp 1.500.000" + status badge
- Sisa atau Lebih: "+Rp 300.000 sisa" (green) atau "-Rp 20.000 lebih" (red)
- Edit inline: klik angka budget → jadi input → Enter untuk simpan → update progress bar

Catatan footer: "Budget hanya untuk pengeluaran. Transfer tidak dihitung."
Constraints: max 200 lines, design system Budgetin
```

---

## 🟡 Fase 3 — Secondary Pages

### Task 07 — Halaman akun saya (/akun) `~200 lines`

Daftar semua akun (bank + e-wallet), saldo masing-masing, total net worth.

⚠️ *Butuh: 02 (app shell)*

```
Buat accounts.html — halaman manajemen akun untuk "Budgetin".

Header: "Akun Saya" + tombol "+ Tambah Akun"

Net worth card:
- Total: Rp 24.500.000 (besar, bold)
- Badge: "+Rp 1.200.000 dari bulan lalu (+5.1%)" green
- Note: "Net worth = total saldo semua akun"

Daftar akun grouped:
Bank:
- BCA Tahapan — Rp 15.000.000 | Rekening utama
- Jenius — Rp 7.000.000 | Tabungan darurat

E-Wallet:
- GoPay — Rp 2.500.000 | Harian
- OVO — Rp 0 | Tidak aktif

Investasi:
- Reksa Dana (Bibit) — Rp 0 | Belum mulai

Setiap kartu akun:
- Icon tipe (bank/wallet/investasi) + nama + label
- Saldo (bold)
- Keterangan
- Tombol "Edit" + tombol "Hapus" (dengan konfirmasi)

Modal tambah akun (simple):
- Nama akun | Tipe (Bank/E-Wallet/Investasi/Cash) | Saldo awal | Keterangan
- Tombol "Simpan Akun"

Catatan: "Transfer antar akun tidak mengubah total net worth."
Constraints: max 200 lines, design system Budgetin
```

---

### Task 08 — Halaman laporan (/laporan) `~250 lines` `REVISED`

**REVISI: tambah goal progress chart di samping 3 chart existing.**

⚠️ *Butuh: 02 (app shell)*

```
Buat reports.html — halaman laporan untuk "Budgetin". Gunakan Chart.js dari CDN:
https://cdn.jsdelivr.net/npm/chart.js

4 section:

1. Cashflow 6 bulan (grouped bar chart):
- Pemasukan (green) vs Pengeluaran (red)
- Bulan: Okt 2025 — Mar 2026
- Sumbu Y: format "Rp 5jt", "Rp 10jt"
- Tooltip: angka lengkap

2. Pengeluaran per kategori (donut chart):
- 7 kategori, warna berbeda
- Legend di samping (desktop) / bawah (mobile)
- Center text: "Rp 5.2jt total"

3. Performa budget (horizontal bar):
- Setiap kategori: bar budget (gray) vs realisasi (green/amber/red)
- Label: nama kategori + persentase

4. Goal Progress (NEW):
- Horizontal bar per goal:
  "Nikah 2026" — 21.7% (Rp 13jt / Rp 60jt) — estimasi 27 bulan
  "Dana Darurat" — 58.3% (Rp 7jt / Rp 12jt) — estimasi 3 bulan
- Warna: primary blue gradient

Summary stats di atas charts:
- Bulan terbaik: "November 2025 — surplus Rp 4.1jt"
- Kategori terboros: "Makan — rata-rata Rp 1.4jt/bulan"
- Rata-rata pengeluaran harian: "Rp 173.000"

Constraints: max 250 lines, responsive charts, data hardcoded
```

---

### Task 09 — Pengaturan + export data `~220 lines` `REVISED`

**REVISI: export CSV dan JSON sekarang beneran jalan, bukan cuma tombol dummy.**

⚠️ *Butuh: 02 (app shell)*

```
Buat settings.html — halaman pengaturan untuk "Budgetin". Tab navigation.

Tab 1 — Profil:
- Nama (editable) | Email (disabled, grayed) | Mata uang: IDR (dropdown)
- Tombol "Simpan Perubahan"

Tab 2 — Kategori:
- 7 kategori default: Makan, Transport, Hiburan, Belanja, Tagihan, Kesehatan, Lainnya
- Setiap row: warna dot + nama + tombol hapus (dengan konfirmasi)
- Form tambah: input nama + pilih warna (6 preset) + tombol "Tambah"
- Note: "Kategori custom hanya untuk pengeluaran"

Tab 3 — Akun & Data:
- Section "Export Data" (NEW — harus beneran jalan):
  Tombol "Export CSV":
  → JS: ambil data dari localStorage → convert ke CSV format → trigger download file transactions.csv
  → Format: tanggal,tipe,jumlah,kategori,dari_akun,ke_akun,catatan

  Tombol "Export JSON":
  → JS: ambil SEMUA data dari localStorage (accounts, transactions, budgets, goals) → JSON.stringify → trigger download budgetin_backup.json

- Section "Import Data":
  Tombol "Import JSON" → file input → parse → confirm "Ini akan mengganti semua data. Lanjutkan?" → load ke localStorage

- Zona bahaya (red border section):
  "Hapus Semua Data" → double confirm: "Ketik HAPUS untuk konfirmasi" → clear localStorage

Constraints: tab switching JS, export/import harus functional, max 220 lines
```

---

### Task 10 — Halaman target / goal tracking `~200 lines` `NEW`

**BARU: halaman khusus goal tracking.** Set target, lihat progress, estimasi waktu.

⚠️ *Butuh: 02 (app shell)*

```
Buat goals.html — halaman goal/target tracking untuk "Budgetin".

Header: "Target Keuangan" + tombol "+ Buat Target Baru"

Summary card:
- Total target aktif: 2
- Total terkumpul: Rp 20.000.000 / Rp 72.000.000
- Progress overall: 27.8%

2 goal cards hardcoded:

Goal 1 — "Nikah 2026":
- Target: Rp 60.000.000 | Terkumpul: Rp 13.000.000 | Progress: 21.7%
- Circular progress ring (SVG, animated)
- Sisa: Rp 47.000.000
- Tabungan/bulan saat ini: Rp 1.700.000
- Estimasi selesai: "27 bulan (Juni 2028)" — badge merah "Melebihi deadline"
- Deadline: Desember 2026
- Tombol: "Setor ke Target" | "Edit" | "Hapus"

Goal 2 — "Dana Darurat 6 Bulan":
- Target: Rp 12.000.000 | Terkumpul: Rp 7.000.000 | Progress: 58.3%
- Estimasi selesai: "3 bulan (Juni 2026)" — badge hijau "Sesuai jadwal"
- Deadline: Agustus 2026
- Tombol: "Setor ke Target" | "Edit" | "Hapus"

Modal "Buat Target Baru":
- Nama target | Jumlah target (Rp) | Deadline (date) | Saldo awal (opsional, default 0)
- Tombol "Simpan Target"

Modal "Setor ke Target":
- Jumlah setor (Rp) | Dari akun (dropdown) | Tanggal
- Note: "Setoran akan mengurangi saldo akun yang dipilih"
- Tombol "Setor"

Logika estimasi: sisa ÷ rata-rata tabungan per bulan = bulan tersisa
Constraints: max 200 lines, SVG progress ring, design system Budgetin
```

---

## 🔴 Fase 4 — Data Layer

### Task 11a — storage.js: core CRUD `~150 lines JS` `SPLIT`

Modul data layer bagian 1: struktur data + CRUD untuk accounts, transactions. Dipecah dari Task 10 lama.

```
Buat storage.js (BAGIAN 1) — modul JavaScript core untuk "Budgetin" menggunakan localStorage.

KEY localStorage:
- 'budgetin_accounts' → JSON array
- 'budgetin_transactions' → JSON array

DATA STRUCTURES:

account: {
  id: string (crypto.randomUUID atau timestamp),
  name: string,
  type: 'bank' | 'ewallet' | 'investasi' | 'cash',
  balance: number,
  note: string
}

transaction: {
  id: string,
  type: 'expense' | 'income' | 'transfer',
  amount: number,
  category: string,
  fromAccount: string (account id),
  toAccount: string | null (account id, hanya untuk transfer dan income),
  date: string (YYYY-MM-DD),
  note: string,
  recurring: { enabled: boolean, frequency: 'daily'|'weekly'|'monthly'|'yearly', until: string|null } | null
}

FUNGSI WAJIB:

// Accounts
getAccounts() → account[]
saveAccount(account) → void (push + simpan)
updateAccount(id, updates) → void
deleteAccount(id) → void (cek: jangan hapus jika masih ada transaksi terkait)

// Transactions
getTransactions(filters?) → transaction[]
  filters: { type?, category?, month? (format "2026-03"), accountId? }
  Default: semua, sorted by date DESC
saveTransaction(tx) → void
  BUSINESS LOGIC:
  - type 'expense': kurangi saldo fromAccount
  - type 'income': tambah saldo toAccount
  - type 'transfer': kurangi fromAccount + tambah toAccount
updateTransaction(id, updates) → void
  BUSINESS LOGIC: reverse saldo lama, apply saldo baru
deleteTransaction(id) → void
  BUSINESS LOGIC: reverse efek saldo dari transaksi yang dihapus

HELPER:
_save(key, data) → localStorage.setItem
_load(key) → JSON.parse || []
_generateId() → string unik

Constraints: max 150 lines, JSDoc comment setiap fungsi, export sebagai object window.Store
```

---

### Task 11b — storage.js: computed + goals + export `~170 lines JS` `SPLIT`

Modul data layer bagian 2: budgets, goals, recurring, computed functions, export, seed data.

⚠️ *Butuh: 11a (storage core)*

```
Lanjutkan storage.js (BAGIAN 2) — tambahkan ke window.Store yang sudah ada di 11a.

KEY localStorage tambahan:
- 'budgetin_budgets' → JSON array
- 'budgetin_goals' → JSON array

DATA STRUCTURES:

budget: {
  id: string,
  category: string,
  amount: number,
  month: string (format "2026-03")
}

goal: {
  id: string,
  name: string,
  targetAmount: number,
  currentAmount: number,
  deadline: string (YYYY-MM-DD),
  deposits: [{ date: string, amount: number, fromAccount: string }]
}

FUNGSI WAJIB:

// Budgets
getBudgets(month) → budget[]
saveBudget(budget) → void
updateBudget(id, updates) → void

// Goals
getGoals() → goal[]
saveGoal(goal) → void
updateGoal(id, updates) → void
deleteGoal(id) → void
depositToGoal(goalId, amount, fromAccountId) → void
  LOGIC: tambah currentAmount + kurangi saldo akun + push ke deposits[]

// Computed
getNetWorth() → number (sum semua account.balance)
getCashflow(month) → { income: number, expense: number }
  WAJIB: EXCLUDE type 'transfer' dari perhitungan
getBudgetVsActual(month) → [{ category, budget, actual, percentage, status }]
  status: 'aman' (<75%) | 'hampir' (75-99%) | 'over' (≥100%)
getGoalProgress(goalId) → { percentage, remaining, monthlyRate, estimatedMonths }
  monthlyRate = rata-rata deposit 3 bulan terakhir (atau total/bulan sejak goal dibuat)

// Recurring
processRecurring() → void
  LOGIC: cek semua transaksi dengan recurring.enabled=true
  Jika sudah waktunya (berdasarkan frequency + tanggal terakhir), buat transaksi baru otomatis
  Panggil saat app load (DOMContentLoaded)

// Export & Import
exportCSV() → trigger download file .csv (transactions only)
exportJSON() → trigger download file .json (ALL data: accounts, transactions, budgets, goals)
importJSON(jsonString) → parse + replace semua data + reload

// Seed
seedDemoData() → void
  Isi data demo realistis: 4 akun, 15 transaksi (campur 3 tipe + 2 recurring), 7 budget, 2 goals
  HANYA jika localStorage kosong (cek budgetin_accounts)

Constraints: max 170 lines, JSDoc, tambahkan ke window.Store yang sudah ada
```

---

## 🟣 Fase 5 — Integration & Polish

### Task 12 — Integrasi storage.js ke semua halaman `~120 lines/halaman` `REVISED`

**REVISI: sekarang cover 8 halaman termasuk goals dan export.** Panggil processRecurring() saat load.

⚠️ *Butuh: 11a + 11b (storage.js lengkap)*

```
Tambahkan integrasi storage.js ke semua halaman "Budgetin".
Setiap halaman: tambah <script src="storage.js"></script> + <script> block integrasi.

GLOBAL (semua halaman):
- DOMContentLoaded → Store.seedDemoData() jika localStorage kosong
- DOMContentLoaded → Store.processRecurring()

dashboard.html (03a + 03b):
- Net worth: Store.getNetWorth()
- Cashflow: Store.getCashflow(currentMonth)
- Budget overview: Store.getBudgetVsActual(currentMonth)
- Transaksi terakhir: Store.getTransactions().slice(0, 5)
- Goal widget: Store.getGoals()[0] + Store.getGoalProgress(id)
- Quick action buttons → buka transaction modal

transactions.html (05):
- Load: Store.getTransactions()
- Filter tabs: Store.getTransactions({ type: 'expense' })
- Summary: hitung total per tipe dari data
- Delete: Store.deleteTransaction(id) → refresh list
- Edit: buka modal dengan openEditMode(transaction)
- Submit modal: Store.saveTransaction() atau Store.updateTransaction() → refresh

budget.html (06):
- Load: Store.getBudgetVsActual(currentMonth)
- Edit inline: Store.updateBudget(id, { amount: newValue }) → update progress bar

accounts.html (07):
- Load: Store.getAccounts() + Store.getNetWorth()
- Tambah: Store.saveAccount() → refresh list
- Hapus: Store.deleteAccount(id) → refresh

goals.html (10):
- Load: Store.getGoals() → render cards + Store.getGoalProgress(id)
- Buat target: Store.saveGoal() → refresh
- Setor: Store.depositToGoal() → refresh card + update saldo akun
- Hapus: Store.deleteGoal(id) → konfirmasi → refresh

reports.html (08):
- Cashflow chart: Store.getCashflow() untuk 6 bulan terakhir
- Budget chart: Store.getBudgetVsActual(currentMonth)
- Goal chart: Store.getGoals() + progress masing-masing

settings.html (09):
- Export CSV: panggil Store.exportCSV()
- Export JSON: panggil Store.exportJSON()
- Import JSON: Store.importJSON(fileContent) → reload page
- Hapus data: clear semua key 'budgetin_*' → reload

Constraints: max 120 lines tambahan per halaman, DOMContentLoaded wrapper
```

---

### Task 13 — Responsive & mobile fixes `~120 lines CSS`

Audit semua halaman di mobile view. Fix layout yang rusak.

⚠️ *Butuh: semua halaman selesai*

```
Buat mobile.css — file CSS khusus mobile untuk "Budgetin" (max-width: 768px).

Checklist wajib:

Navigation:
- Sidebar collapse → bottom navigation bar
- 5 item: Dashboard, Transaksi, Target, Laporan, Akun
- Icon only, label kecil di bawah, height 60px
- Active state: primary color icon + dot indicator

Dashboard:
- Widgets stack vertikal
- Net worth card: full width
- Quick actions: horizontal scroll
- Goal widget: full width, progress ring lebih kecil

Transaksi:
- Filter tabs: horizontal scroll
- Transaction rows: swipe-to-reveal edit/hapus (transform translateX)
- Touch targets minimum 44px

Budget:
- Cards stack vertikal
- Edit: tap angka → input full width

Goals:
- Goal cards: stack vertikal
- Progress ring: 80px diameter
- Modal setor: full screen

Modal (semua):
- Full screen (100vw, 100vh)
- Input min height 48px
- Tombol full width
- Safe area padding bottom (env(safe-area-inset-bottom))

Charts (reports):
- Stack vertikal
- Height 200px per chart
- Legend di bawah chart

General:
- Font body: 14px
- Padding halaman: 16px
- Card border-radius: 8px (lebih kecil dari desktop)

Output: satu file mobile.css, di-include di semua halaman.
Constraints: max 120 lines
```

---

### Task 14 — Blog page + 1 artikel SEO `~200 lines`

Halaman daftar blog + satu artikel lengkap untuk SEO.

⚠️ *Butuh: 00 (landing page)*

```
Buat dua file untuk blog "Budgetin":

1. blog.html — halaman daftar artikel:
- Header: "Blog Budgetin" + tagline "Tips keuangan yang nggak bikin pusing"
- Grid 3 kolom (2 tablet, 1 mobile)
- 5 artikel cards: thumbnail placeholder, judul, excerpt 2 kalimat, tanggal, estimasi baca, CTA "Baca →"

Artikel list:
1. "Pengeluaran vs Transfer: Kenapa Harus Dibedakan" — 5 min read
2. "Cara Bikin Budget Pertama Kamu dalam 10 Menit" — 4 min read
3. "3 Kesalahan Umum Saat Catat Keuangan Harian" — 3 min read
4. "Goal Setting Finansial: Mulai dari Rp 100.000" — 4 min read
5. "Recurring Expense: Pengeluaran Hantu yang Sering Dilupakan" — 5 min read

Sidebar: widget "Mulai tracking sekarang" CTA ke /daftar

2. artikel-transfer-vs-pengeluaran.html:
- Judul H1: "Pengeluaran vs Transfer: Kenapa Kamu Harus Bedain Keduanya di Catatan Keuangan"
- Target keyword: "catat keuangan transfer antar rekening"
- 600-800 kata Bahasa Indonesia, tone casual/friendly
- Struktur: intro hook → masalah umum → penjelasan bedanya → cara benar di Budgetin → CTA
- SEO: meta description, OG tags, proper H1/H2/H3 hierarchy
- Author: "Tim Budgetin" + tanggal
- Related articles di bawah (link ke 2 artikel lain)

Constraints: max 200 lines per file, CTA ke /daftar, design system Budgetin
```

---

## Urutan Eksekusi yang Benar

```
00 → 01 → 02 → (03a → 03b) → (04a → 04b) → 05 → 06 → 07 → 08 → 09 → 10 → (11a → 11b) → 12 → 13 → 14
```

**Jangan loncat.** Task yang di-split (03, 04, 11) harus dikerjakan berurutan — bagian B butuh output bagian A.
