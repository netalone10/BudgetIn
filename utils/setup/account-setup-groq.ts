/**
 * Tujuan: Parse prompt setup akun user baru → daftar akun + saldo awal (NO DB write).
 * Caller: app/api/setup/accounts/route.ts
 * Dependensi: utils/groq (callWithRotation), utils/record/account-resolver (inferAccountSpec)
 * Side Effects: none (hanya panggil LLM)
 */

import { callWithRotation } from "@/utils/groq";
import { inferAccountSpec } from "@/utils/record/account-resolver";

const MODEL = "llama-3.1-8b-instant";

/** Tipe akun valid (sinkron dengan DEFAULT_TYPES di utils/account-types.ts). */
const VALID_TYPES = [
  "Kas",
  "Bank",
  "E-Wallet",
  "Investasi",
  "Kripto",
  "Properti",
  "Kendaraan",
  "Piutang",
  "Hutang",
  "Kartu Kredit",
  "Lainnya",
] as const;

const LIABILITY_TYPES = new Set(["Hutang", "Kartu Kredit"]);

export interface ParsedAccount {
  name: string;
  typeName: string;
  classification: "asset" | "liability";
  saldoAwal: number;
  currency: string;
}

export interface AccountSetupResult {
  accounts: ParsedAccount[];
  clarification?: string;
}

const SYSTEM_PROMPT = `Kamu adalah asisten setup akun keuangan. Tugasmu mengekstrak daftar AKUN/dompet/rekening yang ingin dibuat user baru, beserta SALDO AWAL masing-masing.

RULES:
1. Output HANYA JSON valid, tanpa teks tambahan, tanpa markdown backticks.
2. Format: {"accounts":[{"name":"STRING","typeName":"STRING","classification":"asset|liability","saldoAwal":NUMBER,"currency":"IDR"}]}
3. Jika tidak ada akun yang bisa diekstrak, kembalikan {"accounts":[],"clarification":"PERTANYAAN SINGKAT"}.

4. typeName WAJIB salah satu dari: ["Kas","Bank","E-Wallet","Investasi","Kripto","Properti","Kendaraan","Piutang","Hutang","Kartu Kredit","Lainnya"].
   Infer dari nama:
   - bca/bni/bri/mandiri/cimb/permata/jago/seabank/bank → "Bank" (asset)
   - ovo/gopay/dana/shopeepay/linkaja/e-wallet/dompet digital → "E-Wallet" (asset)
   - cash/tunai/kas/dompet → "Kas" (asset)
   - saham/reksa dana/reksadana/rdpu/investasi/deposito → "Investasi" (asset)
   - bitcoin/btc/eth/kripto/crypto → "Kripto" (asset)
   - kartu kredit/credit card/cc → "Kartu Kredit" (liability)
   - hutang/utang/paylater/pinjaman/cicilan/kredit → "Hutang" (liability)
   - lainnya → "Lainnya" (asset)

5. classification: "asset" untuk uang/harta milik user; "liability" untuk hutang/kartu kredit.

6. Konversi nominal saldo awal — IKUTI PERSIS:
   "rb"/"ribu"/"k" = × 1.000 ; "jt"/"juta" = × 1.000.000
   "5jt" → 5000000 ; "200rb" → 200000 ; "100k" → 100000 ; "1.5jt" → 1500000 ; "1.500.000" → 1500000
   Jika saldo tidak disebut, isi saldoAwal: 0. Saldo tidak boleh negatif.

7. currency default "IDR".

8. Satu prompt bisa berisi banyak akun (dipisah koma/baris baru). Contoh:
   "BCA 5jt, gopay 200rb, cash 100rb, kartu kredit BNI"
   → {"accounts":[
       {"name":"BCA","typeName":"Bank","classification":"asset","saldoAwal":5000000,"currency":"IDR"},
       {"name":"GoPay","typeName":"E-Wallet","classification":"asset","saldoAwal":200000,"currency":"IDR"},
       {"name":"Cash","typeName":"Kas","classification":"asset","saldoAwal":100000,"currency":"IDR"},
       {"name":"Kartu Kredit BNI","typeName":"Kartu Kredit","classification":"liability","saldoAwal":0,"currency":"IDR"}
     ]}`;

function normalizeAccount(raw: unknown, fallbackName: string): ParsedAccount | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const name = typeof r.name === "string" ? r.name.trim().slice(0, 50) : "";
  if (!name) return null;

  let typeName = typeof r.typeName === "string" ? r.typeName.trim() : "";
  let classification: "asset" | "liability" =
    r.classification === "liability" ? "liability" : "asset";

  // Validasi typeName terhadap whitelist; kalau meragukan, infer ulang dari nama (selaras auto-create).
  if (!VALID_TYPES.includes(typeName as (typeof VALID_TYPES)[number])) {
    const inferred = inferAccountSpec(name, fallbackName);
    typeName = inferred.typeName;
    classification = inferred.classification;
  } else {
    // Sinkronkan classification dengan tipe liability yang sudah pasti.
    classification = LIABILITY_TYPES.has(typeName) ? "liability" : classification;
  }

  let saldoAwal = typeof r.saldoAwal === "number" && isFinite(r.saldoAwal) ? r.saldoAwal : 0;
  if (saldoAwal < 0) saldoAwal = 0;

  const currency = typeof r.currency === "string" && r.currency.trim() ? r.currency.trim() : "IDR";

  return { name, typeName, classification, saldoAwal, currency };
}

export async function parseAccountSetup(prompt: string): Promise<AccountSetupResult> {
  const completion = await callWithRotation((client) =>
    client.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Input user: "${prompt}"` },
      ],
    })
  );

  const rawText = completion.choices[0]?.message?.content ?? "{}";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return { accounts: [], clarification: "Maaf, tidak bisa memproses input. Coba tulis lebih jelas, contoh: \"BCA 5jt, gopay 200rb, cash 100rb\"." };
  }

  const rawAccounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
  const accounts = rawAccounts
    .map((a) => normalizeAccount(a, prompt))
    .filter((a): a is ParsedAccount => a !== null);

  if (accounts.length === 0) {
    const clarification =
      typeof parsed.clarification === "string" && parsed.clarification.trim()
        ? parsed.clarification.trim()
        : "Tidak ada akun terdeteksi. Coba sebutkan akun & saldonya, contoh: \"BCA 5jt, gopay 200rb, cash 100rb\".";
    return { accounts: [], clarification };
  }

  return { accounts };
}
