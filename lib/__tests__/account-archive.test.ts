import {
  accountMatchesStatus,
  filterAccountsByArchivedOption,
  parseSheetAccountActive,
} from "@/lib/account-archive";

describe("account archive helpers", () => {
  describe("parseSheetAccountActive", () => {
    it("treats legacy blank values as active", () => {
      expect(parseSheetAccountActive(undefined)).toBe(true);
      expect(parseSheetAccountActive("")).toBe(true);
    });

    it("recognizes explicit false values as archived", () => {
      expect(parseSheetAccountActive(false)).toBe(false);
      expect(parseSheetAccountActive("false")).toBe(false);
      expect(parseSheetAccountActive("FALSE")).toBe(false);
    });
  });

  describe("accountMatchesStatus", () => {
    it("keeps active accounts in default view", () => {
      expect(accountMatchesStatus(true, null)).toBe(true);
      expect(accountMatchesStatus(false, null)).toBe(false);
    });

    it("keeps archived accounts only in archived view", () => {
      expect(accountMatchesStatus(false, "archived")).toBe(true);
      expect(accountMatchesStatus(true, "archived")).toBe(false);
    });
  });

  describe("filterAccountsByArchivedOption", () => {
    const accounts: Array<{ id: string; isActive?: boolean }> = [
      { id: "legacy" },
      { id: "active", isActive: true },
      { id: "archived", isActive: false },
    ];

    it("hides archived accounts from normal callers", () => {
      expect(filterAccountsByArchivedOption(accounts).map((account) => account.id))
        .toEqual(["legacy", "active"]);
    });

    it("returns all accounts for archive-management callers", () => {
      expect(filterAccountsByArchivedOption(accounts, true)).toEqual(accounts);
    });
  });
});
