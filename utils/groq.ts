import Groq from "groq-sdk";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "Asia/Jakarta";
const MODEL = "llama-3.1-8b-instant";

// ── Key Rotation ──────────────────────────────────────────────────────────────

function loadApiKeys(): string[] {
  const keys: string[] = [];
  let i = 1;
  while (true) {
    const key = process.env[`GROQ_API_KEY_${i}`];
    if (!key) break;
    keys.push(key);
    i++;
  }
  // Backward-compatible fallback ke GROQ_API_KEY lama
  if (keys.length === 0 && process.env.GROQ_API_KEY) {
    keys.push(process.env.GROQ_API_KEY);
  }
  return keys;
}

function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (e.status === 429) return true;
    if (typeof e.message === "string" && e.message.includes("429")) return true;
  }
  return false;
}

export async function callWithRotation<T>(
  fn: (client: Groq) => Promise<T>
): Promise<T> {
  const keys = loadApiKeys();
  if (keys.length === 0) throw new Error("No GROQ API keys configured");

  let lastError: unknown;
  for (const key of keys) {
    const client = new Groq({ apiKey: key });
    try {
      return await fn(client);
    } catch (err) {
      if (isRateLimitError(err)) {
        lastError = err;
        continue; // coba key berikutnya
      }
      throw err; // error lain → langsung throw
    }
  }

  throw new Error(
    `All ${keys.length} Groq API key(s) exhausted (rate limited). Last error: ${lastError}`
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedRecord {
  intent: "transaksi" | "transaksi_bulk" | "pemasukan" | "budget_setting" | "laporan" | "unknown";

  // intent: transaksi (pengeluaran)
  amount?: number;
  category?: string;
  note?: string;
  date?: string; // YYYY-MM-DD
  accountName?: string; // nama akun yang disebutkan user

  // intent: transaksi_bulk (beberapa item sekaligus)
  items?: Array<{ amount: number; category: string; note?: string }>;

  // intent: pemasukan (income)
  incomeAmount?: number;
  incomeCategory?: string; // "Gaji" | "Freelance" | "Bonus" | "Investasi" | lainnya

  // intent: budget_setting
  budgetCategory?: string;
  budgetAmount?: number;

  // intent: laporan
  period?: string;
  reportType?: "summary" | "per_category" | "analisis";

  // intent: unknown
  clarification?: string;
}

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Kamu adalah asisten pencatat keuangan. Tugasmu adalah mengklasifikasikan input user dan mengekstrak data yang relevan.

RULES:
1. Tentukan intent dari input:
   - "transaksi": user mencatat PENGELUARAN (ada nominal + konteks belanja/bayar/beli/makan/transport/dll)
   - "pemasukan": user mencatat PEMASUKAN / income (ada kata: gajian/gaji/terima/dapat/income/masuk/fee/bayaran/transfer masuk/bonus/dividen/freelance)
   - "budget_setting": user ingin set atau ubah batas budget per kategori (ada kata: budget/limit/alokasi)
   - "laporan": user meminta rekap, ringkasan, atau analisis pengeluaran (ada kata: rekap/laporan/lihat/berapa/analisis)
   - "unknown": tidak bisa ditentukan, butuh klarifikasi

2. Untuk transaksi, infer kategori dari konteks:
   PRIORITAS: jika ada daftar "Kategori user" di pesan, WAJIB pilih yang paling cocok dari daftar itu.
   Fallback default jika tidak ada di daftar:
   - makan/minum/warung/resto/kafe/warteg/nasi/bakso/mie/kopi → "Makan"
   - grab/gojek/transjakarta/commuter/ojek/bensin/parkir/toll/taksi → "Transport"
   - netflix/spotify/game/bioskop/hiburan/konser/streaming → "Hiburan"
   - kos/sewa kos/kost/ngekos/kontrak rumah → "Kos"
   - listrik/air/internet/iuran/wifi/pln/bpjs/pulsa → "Tagihan"
   - obat/dokter/apotek/rumah sakit/klinik/vitamin → "Kesehatan"
   - lainnya → gunakan kategori paling relevan dalam Title Case

3. Konversi nominal — IKUTI PERSIS:
   SATUAN: "rb" / "ribu" = × 1.000 (SERIBU, BUKAN JUTA!)
            "jt" / "juta" = × 1.000.000
            "k"            = × 1.000
   Contoh BENAR:
     "35rb"      → 35000        (35 × 1000)
     "200rb"     → 200000       (200 × 1000, BUKAN 200000000)
     "500ribu"   → 500000
     "1.5jt"     → 1500000
     "2jt"       → 2000000
     "2k"        → 2000
     "1.500.000" → 1500000
   JANGAN pernah mengembalikan amount > 10.000.000 kecuali input jelas menyebut "juta"/"jt".

4. Resolve tanggal relatif ke format YYYY-MM-DD timezone Asia/Jakarta:
   - "kemarin" → yesterday
   - "tadi pagi" / "tadi" / "barusan" → today
   - "minggu lalu" → 7 days ago
   - default (tidak disebutkan) → today

5. Output HANYA JSON valid, tanpa teks tambahan, tanpa markdown backticks.

6. Jika intent = "unknown", isi field clarification dengan pertanyaan singkat dalam bahasa yang sama dengan input user.

7. Untuk pemasukan, infer kategori income:
   - gaji/salary/slip gaji/upah/tunjangan/tunjangan kinerja/tunjangan jabatan/take home pay/thp/rapel → "Gaji"
   - freelance/project/klien/fee/jasa/honor/honorarium → "Freelance"
   - bonus/thr/insentif/reward/achievement → "Bonus"
   - dividen/investasi/bunga/return/profit/yield/deposito/reksa dana → "Investasi"
   - bisnis/usaha/jualan/dagangan/omzet → "Bisnis"
   - lainnya → gunakan kategori paling relevan dalam Title Case

8. TRANSAKSI BULK: Jika user mencantumkan BEBERAPA item pengeluaran sekaligus (dipisah koma, titik koma, atau baris baru dengan nominal masing-masing), gunakan intent "transaksi_bulk".
   Contoh: "Belanja: ayam 30rb, sayur 15rb, telur 25rb" → transaksi_bulk
   Contoh: "Beli kopi 25rb, snack 15rb" → transaksi_bulk
   Gunakan "transaksi" (bukan bulk) jika hanya ADA SATU item.

9. VALIDASI NOMINAL WAJIB: Input transaksi/pemasukan/budget_setting HARUS mengandung nominal uang dalam IDR.
   - VALID: "makan 35rb", "gajian 8jt", "beli kopi 25000", "dapat freelance 2.5jt"
   - TIDAK VALID → return unknown: "dapat warisan 1kg emas", "jual 1 lot BBCA", "beli 2 gram emas", "terima 50 pcs barang"
   Jika input menggunakan satuan NON-UANG (kg, gram, gr, ons, ton, lot, unit, pcs, ekor, biji, potong, ikat, helai, lusin, botol, kaleng, sachet, kantong, bungkus, kotak, porsi, meter, liter, ml) tanpa menyebut nilai/harga dalam IDR,
   return: {"intent":"unknown","clarification":"Input harus berisi nominal uang (contoh: 35rb, 2jt). Untuk aset non-uang, tulis nilainya: 'jual saham dapat 5jt' atau 'dapat emas senilai 3jt'."}

10. EXTRACT AKUN: Jika user menyebut nama akun/bank/dompet/kartu kredit, extract ke field "accountName".
   Contoh:
   - "makan 50rb pakai BCA" → accountName: "BCA"
   - "bayar pakai Mandiri" → accountName: "Mandiri"
   - "dari cash" → accountName: "cash"
   - "pakai kartu kredit BNI" → accountName: "BNI"
   - "dari dompet" → accountName: "dompet"
   Jika TIDAK disebutkan, JANGAN isi accountName (biarkan undefined/null).

11. FORMAT JSON WAJIB per intent:
   - transaksi: {"intent":"transaksi","amount":NUMBER,"category":"STRING","accountName":"STRING","note":"STRING","date":"YYYY-MM-DD"}
   - transaksi_bulk: {"intent":"transaksi_bulk","items":[{"amount":NUMBER,"category":"STRING","note":"STRING"}],"accountName":"STRING","date":"YYYY-MM-DD"}
   - pemasukan: {"intent":"pemasukan","incomeAmount":NUMBER,"incomeCategory":"STRING","accountName":"STRING","note":"STRING","date":"YYYY-MM-DD"}
   - budget_setting: {"intent":"budget_setting","budgetCategory":"STRING","budgetAmount":NUMBER}
   - laporan: {"intent":"laporan","period":"STRING","reportType":"summary"}
   - unknown: {"intent":"unknown","clarification":"STRING"}

   PENTING: untuk budget_setting WAJIB gunakan key "budgetCategory" dan "budgetAmount" (bukan "category"/"amount").
   PENTING: untuk pemasukan WAJIB gunakan key "incomeAmount" dan "incomeCategory".
   PENTING: accountName hanya diisi jika user MENYEBUTKAN nama akun, jika tidak disebutkan biarkan kosong/undefined.`;


// ── Main function ─────────────────────────────────────────────────────────────

export async function classifyIntent(
  prompt: string,
  userCategories?: string[],
  userAccounts?: string[]
): Promise<ParsedRecord> {
  const jakartaNow = toZonedTime(new Date(), TIMEZONE);
  const today = format(jakartaNow, "yyyy-MM-dd");
  const currentMonth = format(jakartaNow, "yyyy-MM");

  const categoryHint =
    userCategories && userCategories.length > 0
      ? `\nKategori user yang sudah ada: [${userCategories.join(", ")}] — PRIORITASKAN salah satu ini jika cocok.`
      : "";

  const accountHint =
    userAccounts && userAccounts.length > 0
      ? `\nAkun user yang tersedia: [${userAccounts.join(", ")}] — jika user menyebut salah satu, extract ke accountName.`
      : "";

  const userMessage = `Tanggal hari ini: ${today} (bulan: ${currentMonth})${categoryHint}${accountHint}\n\nInput user: "${prompt}"`;

  const completion = await callWithRotation((client) =>
    client.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    })
  );

  const raw = completion.choices[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(raw) as ParsedRecord;
    if (parsed.intent === "transaksi" && !parsed.date) {
      parsed.date = today;
    }
    return parsed;
  } catch {
    return {
      intent: "unknown",
      clarification: "Maaf, tidak bisa memproses input. Coba ulangi dengan lebih jelas.",
    };
  }
}
