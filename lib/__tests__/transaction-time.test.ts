import { parseTransactionTimeFromPrompt, resolvePromptTransactionTime } from "../transaction-time";

describe("parseTransactionTimeFromPrompt", () => {
  it("uses fallback real-time for relative day parts without explicit hour", () => {
    expect(parseTransactionTimeFromPrompt("makan siang hari ini", "12:27")).toBe("12:27");
    expect(parseTransactionTimeFromPrompt("beli sarapan pagi", "09:13")).toBe("09:13");
    expect(parseTransactionTimeFromPrompt("jajan sore", "17:42")).toBe("17:42");
    expect(parseTransactionTimeFromPrompt("makan malam", "20:05")).toBe("20:05");
  });

  it("keeps explicit prompt time when provided", () => {
    expect(parseTransactionTimeFromPrompt("makan siang jam 1", "12:27")).toBe("13:00");
    expect(parseTransactionTimeFromPrompt("beli ayam pukul 08:30", "12:27")).toBe("08:30");
  });

  it("ignores parsed AI time when prompt has no time cue", () => {
    expect(resolvePromptTransactionTime("beli ketoprak 20rb cash", "00:00", "19:41")).toBe("19:41");
    expect(resolvePromptTransactionTime("beli ketoprak 20rb cash", "08:00", "19:41")).toBe("19:41");
  });

  it("keeps parsed AI time when prompt has explicit time cue", () => {
    expect(resolvePromptTransactionTime("beli ketoprak 20rb cash jam 8", "08:00", "19:41")).toBe("08:00");
  });
});
