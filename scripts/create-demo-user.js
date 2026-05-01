const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

function loadEnvFile(filename) {
  const fullPath = path.join(process.cwd(), filename);
  if (!fs.existsSync(fullPath)) return;

  const content = fs.readFileSync(fullPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@budgetin.local";
const DEMO_PASSWORD = "DemoBudgetIn2026!";
const DEMO_NAME = "BudgetIn Demo";

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

async function main() {
  const now = new Date();
  const currentMonth = monthKey(now);
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 10);
  const previousMonth = monthKey(previousMonthDate);

  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true },
  });

  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      password: hashedPassword,
      emailVerified: new Date(),
      image: null,
      sheetsId: null,
      googleId: null,
      verificationToken: null,
      verificationTokenExpiry: null,
    },
  });

  const categoryMap = {};
  const categories = [
    ["Gaji", "income", false, false],
    ["Freelance", "income", false, false],
    ["Bonus", "income", false, false],
    ["Makan", "expense", false, true],
    ["Transport", "expense", false, false],
    ["Tagihan", "expense", false, false],
    ["Belanja", "expense", false, false],
    ["Hiburan", "expense", false, false],
    ["Kesehatan", "expense", false, false],
    ["Dana Darurat", "expense", true, false],
    ["Investasi", "expense", true, false],
  ];

  for (const [name, type, isSavings, rolloverEnabled] of categories) {
    const created = await prisma.category.create({
      data: {
        userId: user.id,
        name,
        type,
        isSavings,
        rolloverEnabled,
      },
    });
    categoryMap[name] = created;
  }

  const accountTypeMap = {};
  const accountTypes = [
    ["Kas", "asset", "wallet", "#10b981", 10],
    ["Bank", "asset", "landmark", "#3b82f6", 20],
    ["E-Wallet", "asset", "smartphone", "#8b5cf6", 30],
    ["Kartu Kredit", "liability", "credit-card", "#dc2626", 95],
  ];

  for (const [name, classification, icon, color, sortOrder] of accountTypes) {
    const created = await prisma.accountType.create({
      data: {
        userId: user.id,
        name,
        classification,
        icon,
        color,
        sortOrder,
        isActive: true,
      },
    });
    accountTypeMap[name] = created;
  }

  const accountMap = {};
  const accounts = [
    ["BCA Utama", "Bank", "IDR", "#2563eb", "Rekening operasional harian"],
    ["Jago Savings", "Bank", "IDR", "#0f766e", "Bucket tabungan dan cadangan"],
    ["GoPay", "E-Wallet", "IDR", "#7c3aed", "Pembayaran cepat harian"],
    ["Kartu Kredit BNI", "Kartu Kredit", "IDR", "#dc2626", "Kartu kredit utama"],
    ["Cash Wallet", "Kas", "IDR", "#16a34a", "Uang tunai harian"],
  ];

  for (const [name, typeName, currency, color, note] of accounts) {
    const created = await prisma.account.create({
      data: {
        userId: user.id,
        accountTypeId: accountTypeMap[typeName].id,
        name,
        currency,
        color,
        note,
        isActive: true,
      },
    });
    accountMap[name] = created;
  }

  const tx = [];
  const pushTx = (date, amount, category, note, type, accountName, extra = {}) => {
    tx.push({
      userId: user.id,
      date,
      amount,
      category,
      note,
      type,
      accountId: accountName ? accountMap[accountName].id : null,
      ...extra,
    });
  };

  const transferId1 = "demo-transfer-1";
  const transferId2 = "demo-transfer-2";
  const transferId3 = "demo-transfer-3";

  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 1)), 12500000, "Gaji", "Gaji bulanan masuk", "income", "BCA Utama");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 3)), 1800000, "Freelance", "Project landing page", "income", "BCA Utama");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 3)), 750000, "Dana Darurat", "Top up dana cadangan", "expense", "Jago Savings");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 4)), 42000, "Makan", "Ngopi dan croissant sebelum meeting", "expense", "BCA Utama");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 4)), 18000, "Transport", "Parkir coworking", "expense", "Cash Wallet");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 5)), 155000, "Belanja", "Belanja mingguan supermarket", "expense", "BCA Utama");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 5)), 250000, "Tagihan", "Internet rumah", "expense", "BCA Utama");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 6)), 98000, "Hiburan", "Streaming dan game pass", "expense", "Kartu Kredit BNI");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 7)), 150000, "Transport", "Isi bensin", "expense", "BCA Utama");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 7)), 23000, "Transport", "Tol dalam kota", "expense", "BCA Utama");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 8)), 2500000, "Investasi", "DCA reksa dana dan ETF", "expense", "Jago Savings");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 9)), 67000, "Makan", "Makan malam ramen", "expense", "GoPay");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 10)), 125000, "Kesehatan", "Vitamin dan obat", "expense", "BCA Utama");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 11)), 89000, "Makan", "Lunch tim produk", "expense", "Kartu Kredit BNI");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 12)), 350000, "Tagihan", "Listrik bulanan", "expense", "BCA Utama");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 13)), 500000, "Bonus", "Cashback dan bonus referral", "income", "GoPay");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 14)), 142000, "Belanja", "Perlengkapan rumah", "expense", "BCA Utama");
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 15)), 53000, "Makan", "Ayam geprek", "expense", "Cash Wallet");

  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 2)), 1000000, "Transfer ke GoPay", "Isi saldo e-wallet", "transfer_out", "BCA Utama", { transferId: transferId1 });
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 2)), 1000000, "Transfer dari BCA", "Isi saldo e-wallet", "transfer_in", "GoPay", { transferId: transferId1 });
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 16)), 3000000, "Transfer ke Jago", "Pindah alokasi tabungan", "transfer_out", "BCA Utama", { transferId: transferId2 });
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 16)), 3000000, "Transfer dari BCA", "Pindah alokasi tabungan", "transfer_in", "Jago Savings", { transferId: transferId2 });
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 18)), 450000, "Bayar kartu kredit", "Pembayaran cicilan kartu", "transfer_out", "BCA Utama", { transferId: transferId3 });
  pushTx(dayKey(new Date(now.getFullYear(), now.getMonth(), 18)), 450000, "Bayar dari BCA", "Pembayaran cicilan kartu", "transfer_in", "Kartu Kredit BNI", { transferId: transferId3 });

  pushTx(dayKey(new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 2)), 11800000, "Gaji", "Gaji bulan lalu", "income", "BCA Utama");
  pushTx(dayKey(new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 5)), 320000, "Makan", "Belanja makan bulan lalu", "expense", "BCA Utama");
  pushTx(dayKey(new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 8)), 210000, "Transport", "Bensin dan parkir bulan lalu", "expense", "BCA Utama");
  pushTx(dayKey(new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 10)), 240000, "Tagihan", "Internet bulan lalu", "expense", "BCA Utama");
  pushTx(dayKey(new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 12)), 500000, "Dana Darurat", "Alokasi bulan lalu", "expense", "Jago Savings");

  await prisma.transaction.createMany({ data: tx });

  const budgetsCurrent = [
    ["Makan", 1200000],
    ["Transport", 750000],
    ["Tagihan", 1200000],
    ["Belanja", 900000],
    ["Hiburan", 400000],
    ["Kesehatan", 500000],
    ["Dana Darurat", 1500000],
    ["Investasi", 3000000],
  ];

  for (const [name, amount] of budgetsCurrent) {
    await prisma.budget.create({
      data: {
        userId: user.id,
        categoryId: categoryMap[name].id,
        amount,
        month: currentMonth,
      },
    });
  }

  const budgetsPrevious = [
    ["Makan", 900000],
    ["Transport", 700000],
    ["Tagihan", 1000000],
    ["Dana Darurat", 1000000],
  ];

  for (const [name, amount] of budgetsPrevious) {
    await prisma.budget.create({
      data: {
        userId: user.id,
        categoryId: categoryMap[name].id,
        amount,
        month: previousMonth,
      },
    });
  }

  const today = new Date();
  const overdueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const soonDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
  const upcomingDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 9);

  const recurringBills = [
    ["Internet Rumah", 350000, overdueDate, [2, 1], "Tagihan", "BCA Utama", false, null],
    ["Langganan AI Tools", 98000, todayDate, [1], "Hiburan", "Kartu Kredit BNI", false, null],
    ["Asuransi Kesehatan", 425000, soonDate, [3, 1], "Kesehatan", "BCA Utama", true, null],
    ["Cicilan Laptop", 1250000, upcomingDate, [5, 2], "Tagihan", "BCA Utama", false, null],
  ];

  for (const [name, amount, dueDate, reminderDays, categoryName, accountName, autoRecord, note] of recurringBills) {
    await prisma.recurringBill.create({
      data: {
        userId: user.id,
        name,
        amount,
        dueDay: dueDate.getDate(),
        categoryId: categoryMap[categoryName].id,
        accountId: accountMap[accountName].id,
        autoRecord,
        reminderDays,
        nextDueDate: dueDate,
        note,
        isActive: true,
      },
    });
  }

  console.log("");
  console.log("Demo user created successfully.");
  console.log(`Email    : ${DEMO_EMAIL}`);
  console.log(`Password : ${DEMO_PASSWORD}`);
  console.log(`Month    : ${currentMonth}`);
  console.log("");
}

main()
  .catch((error) => {
    console.error("Failed to create demo user.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
