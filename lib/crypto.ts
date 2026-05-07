import crypto from "crypto";

const ENCRYPTION_PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const rawKey = process.env.APP_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error("APP_ENCRYPTION_KEY is required for secret encryption");
  }

  const trimmed = rawKey.trim();
  const candidates: Buffer[] = [];
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

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(ENCRYPTION_PREFIX);
}

export function encryptSecret(value: string | null | undefined): string | null {
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

export function decryptSecret(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null;
  if (!isEncryptedSecret(value)) return value;

  const parts = value.split(":");
  if (parts.length !== 5) {
    throw new Error("Invalid encrypted secret format");
  }

  const [, , ivPart, authTagPart, encryptedPart] = parts;
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const encrypted = Buffer.from(encryptedPart, "base64url");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted secret payload");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
