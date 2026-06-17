import { parseAccountSetup } from "@/utils/setup/account-setup-groq";
import { callWithRotation } from "@/utils/groq";

jest.mock("@/utils/groq", () => ({
  callWithRotation: jest.fn(),
}));

const mockedCall = callWithRotation as jest.MockedFunction<typeof callWithRotation>;

/** Buat completion palsu berisi JSON tertentu. */
function mockCompletion(json: unknown) {
  mockedCall.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(json) } }],
  } as never);
}

describe("parseAccountSetup", () => {
  beforeEach(() => mockedCall.mockReset());

  it("menormalkan beberapa akun dengan tipe & saldo benar", async () => {
    mockCompletion({
      accounts: [
        { name: "BCA", typeName: "Bank", classification: "asset", saldoAwal: 5000000, currency: "IDR" },
        { name: "GoPay", typeName: "E-Wallet", classification: "asset", saldoAwal: 200000, currency: "IDR" },
        { name: "Cash", typeName: "Kas", classification: "asset", saldoAwal: 100000, currency: "IDR" },
      ],
    });

    const result = await parseAccountSetup("BCA 5jt, gopay 200rb, cash 100rb");
    expect(result.clarification).toBeUndefined();
    expect(result.accounts).toHaveLength(3);
    expect(result.accounts[0]).toMatchObject({ name: "BCA", typeName: "Bank", classification: "asset", saldoAwal: 5000000 });
    expect(result.accounts[2]).toMatchObject({ name: "Cash", typeName: "Kas", saldoAwal: 100000 });
  });

  it("memaksa classification liability untuk Kartu Kredit", async () => {
    mockCompletion({
      accounts: [{ name: "Kartu Kredit BNI", typeName: "Kartu Kredit", classification: "asset", saldoAwal: 0 }],
    });
    const result = await parseAccountSetup("kartu kredit BNI");
    expect(result.accounts[0].classification).toBe("liability");
  });

  it("infer ulang tipe dari nama jika typeName AI tidak valid", async () => {
    mockCompletion({
      accounts: [{ name: "BCA", typeName: "Ngawur", classification: "asset", saldoAwal: 0 }],
    });
    const result = await parseAccountSetup("BCA");
    expect(result.accounts[0].typeName).toBe("Bank");
    expect(result.accounts[0].classification).toBe("asset");
  });

  it("menjadikan saldo negatif jadi 0 dan default currency IDR", async () => {
    mockCompletion({
      accounts: [{ name: "Dompet", typeName: "Kas", classification: "asset", saldoAwal: -5000 }],
    });
    const result = await parseAccountSetup("dompet minus");
    expect(result.accounts[0].saldoAwal).toBe(0);
    expect(result.accounts[0].currency).toBe("IDR");
  });

  it("mengembalikan clarification saat tidak ada akun", async () => {
    mockCompletion({ accounts: [], clarification: "Sebutkan akunmu." });
    const result = await parseAccountSetup("halo apa kabar");
    expect(result.accounts).toHaveLength(0);
    expect(result.clarification).toBeTruthy();
  });

  it("mengembalikan clarification saat JSON rusak", async () => {
    mockedCall.mockResolvedValueOnce({
      choices: [{ message: { content: "bukan json" } }],
    } as never);
    const result = await parseAccountSetup("apa pun");
    expect(result.accounts).toHaveLength(0);
    expect(result.clarification).toBeTruthy();
  });
});
