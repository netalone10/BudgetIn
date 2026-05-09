/**
 * Cek apakah email termasuk dalam daftar ADMIN_EMAILS.
 * ADMIN_EMAILS di .env: "email1@gmail.com,email2@gmail.com"
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .flatMap((e) => {
      const normalized = e.trim().toLowerCase();
      return normalized ? [normalized] : [];
    });
  return adminEmails.includes(email.toLowerCase());
}
