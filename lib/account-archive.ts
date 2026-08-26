export type AccountStatus = "active" | "archived";

export function parseSheetAccountActive(value: unknown): boolean {
  if (value === false) return false;
  if (typeof value === "string" && value.trim().toLowerCase() === "false") return false;
  return true;
}

export function accountMatchesStatus(
  isActive: boolean,
  status: string | null
): boolean {
  return status === "archived" ? !isActive : isActive;
}

export function filterAccountsByArchivedOption<T extends { isActive?: boolean }>(
  accounts: T[],
  includeArchived = false
): T[] {
  return includeArchived ? accounts : accounts.filter((account) => account.isActive !== false);
}
