/**
 * Heuristik password strength — zero dep, ringan.
 * Dipakai di register UI (real-time feedback) dan register API (validasi).
 */

export type PasswordCheck = {
  id: "length" | "letter" | "number" | "case" | "symbol";
  label: string;
  required: boolean;
  passed: boolean;
};

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Lemah" | "Sedang" | "Kuat";
  acceptable: boolean; // boleh submit?
  checks: PasswordCheck[];
};

export function evaluatePassword(pw: string): PasswordStrength {
  const checks: PasswordCheck[] = [
    { id: "length", label: "Minimal 8 karakter", required: true, passed: pw.length >= 8 },
    { id: "letter", label: "Mengandung huruf", required: true, passed: /[a-zA-Z]/.test(pw) },
    { id: "number", label: "Mengandung angka", required: true, passed: /\d/.test(pw) },
    { id: "case", label: "Huruf besar & kecil", required: false, passed: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { id: "symbol", label: "Mengandung simbol", required: false, passed: /[^a-zA-Z0-9]/.test(pw) },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  const requiredPassed = checks.filter((c) => c.required).every((c) => c.passed);

  let score: PasswordStrength["score"];
  if (passedCount <= 1) score = 0;
  else if (passedCount === 2) score = 1;
  else if (passedCount === 3) score = 2;
  else if (passedCount === 4) score = 3;
  else score = 4;

  const label: PasswordStrength["label"] =
    score <= 1 ? "Lemah" : score <= 2 ? "Sedang" : "Kuat";

  return { score, label, acceptable: requiredPassed, checks };
}
