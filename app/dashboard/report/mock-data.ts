export type CategoryRow = {
  category: string;
  amount: number;
};

export type IncomeStatementMock = {
  periodLabel: string;
  generatedAt: string;
  ownerName: string;
  income: CategoryRow[];
  expense: CategoryRow[];
};

export type CustomRangeMock = IncomeStatementMock & {
  startDate: string;
  endDate: string;
  daysInRange: number;
};

export type YearlyCategoryRow = {
  category: string;
  monthly: number[];
};

export type YearlyMock = {
  year: number;
  ownerName: string;
  generatedAt: string;
  income: YearlyCategoryRow[];
  expense: YearlyCategoryRow[];
};

export const monthlyMockReport: IncomeStatementMock = {
  periodLabel: "April 2026",
  generatedAt: "12 Mei 2026",
  ownerName: "Akbar R.",
  income: [
    { category: "Gaji", amount: 12500000 },
    { category: "Bonus Proyek", amount: 2750000 },
    { category: "Freelance", amount: 1850000 },
    { category: "Cashback & Refund", amount: 145000 },
    { category: "Bunga Tabungan", amount: 32000 },
  ],
  expense: [
    { category: "Makan & Minum", amount: 2845000 },
    { category: "Transportasi", amount: 1320000 },
    { category: "Tagihan & Utilitas", amount: 1185000 },
    { category: "Belanja Bulanan", amount: 1650000 },
    { category: "Hiburan", amount: 720000 },
    { category: "Kesehatan", amount: 410000 },
    { category: "Tabungan & Investasi", amount: 2500000 },
    { category: "Cicilan", amount: 1250000 },
    { category: "Hadiah & Donasi", amount: 350000 },
    { category: "Lain-lain", amount: 180000 },
  ],
};

export const customRangeMockReport: CustomRangeMock = {
  periodLabel: "01 Mar 2026 – 30 Apr 2026",
  startDate: "2026-03-01",
  endDate: "2026-04-30",
  daysInRange: 61,
  generatedAt: "12 Mei 2026",
  ownerName: "Akbar R.",
  income: [
    { category: "Gaji (2 bulan)", amount: 25000000 },
    { category: "Bonus Proyek", amount: 4500000 },
    { category: "Freelance", amount: 3200000 },
    { category: "Dividen Saham", amount: 525000 },
    { category: "Cashback & Refund", amount: 287000 },
  ],
  expense: [
    { category: "Makan & Minum", amount: 5680000 },
    { category: "Transportasi", amount: 2540000 },
    { category: "Tagihan & Utilitas", amount: 2370000 },
    { category: "Belanja Bulanan", amount: 3210000 },
    { category: "Hiburan", amount: 1450000 },
    { category: "Kesehatan", amount: 825000 },
    { category: "Tabungan & Investasi", amount: 5000000 },
    { category: "Cicilan", amount: 2500000 },
    { category: "Liburan", amount: 3850000 },
    { category: "Hadiah & Donasi", amount: 620000 },
  ],
};

export const yearlyMockReport: YearlyMock = {
  year: 2026,
  ownerName: "Akbar R.",
  generatedAt: "12 Mei 2026",
  income: [
    {
      category: "Gaji",
      monthly: [12500000, 12500000, 12500000, 12500000, 12500000, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      category: "Bonus",
      monthly: [0, 1500000, 0, 2750000, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      category: "Freelance",
      monthly: [950000, 1200000, 1480000, 1850000, 2100000, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      category: "Lain-lain",
      monthly: [120000, 95000, 210000, 177000, 145000, 0, 0, 0, 0, 0, 0, 0],
    },
  ],
  expense: [
    {
      category: "Makan & Minum",
      monthly: [2640000, 2710000, 2835000, 2845000, 2920000, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      category: "Transportasi",
      monthly: [1180000, 1240000, 1220000, 1320000, 1410000, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      category: "Tagihan & Utilitas",
      monthly: [1185000, 1185000, 1185000, 1185000, 1185000, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      category: "Belanja Bulanan",
      monthly: [1480000, 1620000, 1590000, 1650000, 1720000, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      category: "Hiburan",
      monthly: [580000, 720000, 650000, 720000, 880000, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      category: "Kesehatan",
      monthly: [220000, 380000, 295000, 410000, 320000, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      category: "Tabungan & Investasi",
      monthly: [2500000, 2500000, 2500000, 2500000, 2500000, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      category: "Cicilan",
      monthly: [1250000, 1250000, 1250000, 1250000, 1250000, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      category: "Lain-lain",
      monthly: [240000, 310000, 295000, 530000, 385000, 0, 0, 0, 0, 0, 0, 0],
    },
  ],
};

export const MONTH_LABELS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export function formatRupiah(value: number): string {
  if (value === 0) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}Rp ${Math.abs(value).toLocaleString("id-ID")}`;
}

export function sumRows(rows: { amount: number }[]): number {
  return rows.reduce((acc, r) => acc + r.amount, 0);
}

export function sumMonthly(rows: YearlyCategoryRow[]): number[] {
  const totals = new Array(12).fill(0);
  for (const row of rows) {
    for (let i = 0; i < 12; i++) {
      totals[i] += row.monthly[i] ?? 0;
    }
  }
  return totals;
}

export function rowTotal(row: YearlyCategoryRow): number {
  return row.monthly.reduce((a, b) => a + b, 0);
}
