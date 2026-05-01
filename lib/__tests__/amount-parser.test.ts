import { correctAmount, parseNominalFromPrompt, countMonetaryTokens } from "@/utils/record/amount-parser";

describe("parseNominalFromPrompt", () => {
  test("rb suffix", () => expect(parseNominalFromPrompt("bayar 18rb")).toBe(18_000));
  test("ribu suffix", () => expect(parseNominalFromPrompt("kasih 50 ribu")).toBe(50_000));
  test("k suffix", () => expect(parseNominalFromPrompt("makan 35k")).toBe(35_000));
  test("jt suffix", () => expect(parseNominalFromPrompt("gajian 8jt")).toBe(8_000_000));
  test("decimal jt", () => expect(parseNominalFromPrompt("freelance 2.5jt")).toBe(2_500_000));
  test("negative rb suffix", () => expect(parseNominalFromPrompt("refund makan -50rb")).toBe(-50_000));
  test("negative minus word", () => expect(parseNominalFromPrompt("koreksi gaji minus 100rb")).toBe(-100_000));
  test("negative decimal jt", () => expect(parseNominalFromPrompt("koreksi bonus -1.5jt")).toBe(-1_500_000));
  test("no monetary token", () => expect(parseNominalFromPrompt("bayar tagihan listrik")).toBeNull());
});

describe("countMonetaryTokens", () => {
  test("single", () => expect(countMonetaryTokens("bayar 18rb pakai skorcard")).toBe(1));
  test("multiple", () => expect(countMonetaryTokens("belanja 30rb dan 15rb")).toBe(2));
  test("zero", () => expect(countMonetaryTokens("rekap bulan ini")).toBe(0));
  test("mixed units", () => expect(countMonetaryTokens("gajian 8jt + bonus 500rb")).toBe(2));
  test("negative token", () => expect(countMonetaryTokens("refund makan -50rb")).toBe(1));
});

describe("correctAmount", () => {
  test("single token: AI 10x error gets corrected (the bug from user report)", () => {
    expect(correctAmount("bayar listrik 18rb pakai skorcard", 180_000)).toBe(18_000);
  });

  test("single token: AI 1000x error still corrected (legacy)", () => {
    expect(correctAmount("bayar listrik 18rb", 18_000_000)).toBe(18_000);
  });

  test("single token: AI returns correct value, returned unchanged", () => {
    expect(correctAmount("bayar 18rb", 18_000)).toBe(18_000);
  });

  test("single negative token: AI positive value gets corrected to negative", () => {
    expect(correctAmount("refund makan -50rb", 50_000)).toBe(-50_000);
  });

  test("single token: AI 0.001x error still corrected (legacy)", () => {
    expect(correctAmount("gajian 8jt", 8_000)).toBe(8_000_000);
  });

  test("multi token: AI returns sum, regex would say 30k → keep AI value (45k)", () => {
    expect(correctAmount("belanja 30rb dan 15rb", 45_000)).toBe(45_000);
  });

  test("multi token: 1000x error on multi token still gets corrected via legacy path", () => {
    // expected from regex = first match 30rb = 30_000; AI = 30_000_000 → ratio 1000 → return expected
    expect(correctAmount("belanja 30rb dan 15rb", 30_000_000)).toBe(30_000);
  });

  test("no monetary token in prompt: AI value passes through", () => {
    expect(correctAmount("bayar tagihan listrik", 250_000)).toBe(250_000);
  });

  test("single token decimal jt", () => {
    expect(correctAmount("freelance 2.5jt", 2_500)).toBe(2_500_000);
  });
});
