const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const ENCRYPTION_PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const rawKey = process.env.APP_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error("APP_ENCRYPTION_KEY is required for secret encryption");
  }

  const trimmed = rawKey.trim();
  const candidates = [];
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    candidates.push(Buffer.from(trimmed, "hex"));
  }
  candidates.push(Buffer.from(trimmed, "base64"));

  const key = candidates.find((candidate) => candidate.length === 32);
  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY must be a 32-byte key encoded as base64 or hex");
  }

  return key;
}

function isEncryptedSecret(value) {
  return typeof value === "string" && value.startsWith(ENCRYPTION_PREFIX);
}

function encryptSecret(value) {
  if (value == null || value === "") return value ?? null;
  if (isEncryptedSecret(value)) return value;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_PREFIX.slice(0, -1),
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

async function main() {
  const write = process.argv.includes("--write");
  const users = await prisma.user.findMany({
    where: {
      OR: [{ accessToken: { not: null } }, { refreshToken: { not: null } }],
    },
    select: { id: true, accessToken: true, refreshToken: true },
  });

  let candidates = 0;
  let encrypted = 0;

  for (const user of users) {
    const nextAccessToken = encryptSecret(user.accessToken);
    const nextRefreshToken = encryptSecret(user.refreshToken);
    const changed = nextAccessToken !== user.accessToken || nextRefreshToken !== user.refreshToken;

    if (!changed) continue;
    candidates += 1;

    if (write) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accessToken: nextAccessToken,
          refreshToken: nextRefreshToken,
        },
      });
      encrypted += 1;
    }
  }

  console.log(JSON.stringify({ mode: write ? "write" : "dry-run", scanned: users.length, candidates, encrypted }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
