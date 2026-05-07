import { encryptSecret, isEncryptedSecret } from "@/lib/crypto";

const TEST_KEY = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
const findUnique = jest.fn();
const update = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

describe("getValidToken", () => {
  const previousKey = process.env.APP_ENCRYPTION_KEY;
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  const previousClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  let getValidToken: typeof import("@/utils/token").getValidToken;

  beforeAll(async () => {
    ({ getValidToken } = await import("@/utils/token"));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_ENCRYPTION_KEY = TEST_KEY;
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
  });

  afterAll(() => {
    process.env.APP_ENCRYPTION_KEY = previousKey;
    process.env.GOOGLE_CLIENT_ID = previousClientId;
    process.env.GOOGLE_CLIENT_SECRET = previousClientSecret;
    jest.restoreAllMocks();
  });

  it("decrypts and returns a valid encrypted access token", async () => {
    findUnique.mockResolvedValue({
      accessToken: encryptSecret("access-token"),
      refreshToken: encryptSecret("refresh-token"),
      tokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
    });

    await expect(getValidToken("user-1")).resolves.toBe("access-token");
    expect(update).not.toHaveBeenCalled();
  });

  it("re-encrypts a legacy plaintext access token when it is still valid", async () => {
    findUnique.mockResolvedValue({
      accessToken: "legacy-access-token",
      refreshToken: "legacy-refresh-token",
      tokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
    });

    await expect(getValidToken("user-1")).resolves.toBe("legacy-access-token");

    expect(update).toHaveBeenCalledTimes(1);
    const data = update.mock.calls[0][0].data;
    expect(isEncryptedSecret(data.accessToken)).toBe(true);
  });

  it("refreshes with decrypted refresh token and stores encrypted tokens", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "new-access-token", expires_in: 3600 }),
    } as Response);

    findUnique.mockResolvedValue({
      accessToken: encryptSecret("expired-access-token"),
      refreshToken: "legacy-refresh-token",
      tokenExpiry: new Date(Date.now() - 60 * 1000),
    });

    await expect(getValidToken("user-1")).resolves.toBe("new-access-token");

    const body = fetchMock.mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get("refresh_token")).toBe("legacy-refresh-token");

    const data = update.mock.calls[0][0].data;
    expect(isEncryptedSecret(data.accessToken)).toBe(true);
    expect(isEncryptedSecret(data.refreshToken)).toBe(true);
  });
});
