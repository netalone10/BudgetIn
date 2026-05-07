import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/crypto";

const TEST_KEY = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");

describe("secret encryption", () => {
  const previousKey = process.env.APP_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    if (previousKey === undefined) {
      delete process.env.APP_ENCRYPTION_KEY;
    } else {
      process.env.APP_ENCRYPTION_KEY = previousKey;
    }
  });

  it("encrypts and decrypts a secret", () => {
    const encrypted = encryptSecret("google-token");

    expect(encrypted).not.toBe("google-token");
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(decryptSecret(encrypted)).toBe("google-token");
  });

  it("uses a random iv for repeated encryption", () => {
    const first = encryptSecret("same-token");
    const second = encryptSecret("same-token");

    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe("same-token");
    expect(decryptSecret(second)).toBe("same-token");
  });

  it("returns legacy plaintext unchanged", () => {
    expect(isEncryptedSecret("legacy-token")).toBe(false);
    expect(decryptSecret("legacy-token")).toBe("legacy-token");
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptSecret("google-token");
    const parts = encrypted!.split(":");
    parts[4] = `${parts[4].slice(0, -1)}${parts[4].endsWith("A") ? "B" : "A"}`;
    const tampered = parts.join(":");

    expect(() => decryptSecret(tampered)).toThrow();
  });
});
