import { getCategoryRegionId } from "../CategoryRow";

/**
 * `getCategoryRegionId` produces ids that are wired via `aria-controls` on the
 * row trigger and `id` on the lazy-mounted region. These tests pin the
 * normalization so the two consumers (`CategoryRow`, `CategoryGroupList`)
 * stay in sync.
 */
describe("getCategoryRegionId", () => {
  it("slugifies simple ASCII names", () => {
    expect(getCategoryRegionId("Makan")).toBe("details-tx-makan");
    expect(getCategoryRegionId("Gaji")).toBe("details-tx-gaji");
  });

  it("collapses whitespace and punctuation into single dashes", () => {
    expect(getCategoryRegionId("Makan & Minum")).toBe("details-tx-makan-minum");
    expect(getCategoryRegionId("Bonus / THR")).toBe("details-tx-bonus-thr");
  });

  it("strips leading and trailing dashes", () => {
    expect(getCategoryRegionId("  Transport  ")).toBe("details-tx-transport");
    expect(getCategoryRegionId("--Hadiah--")).toBe("details-tx-hadiah");
  });

  it("falls back to a stable token for empty / all-special names", () => {
    expect(getCategoryRegionId("")).toBe("details-tx-uncategorized");
    expect(getCategoryRegionId("---")).toBe("details-tx-uncategorized");
  });

  it("is deterministic — same input maps to same output", () => {
    expect(getCategoryRegionId("Belanja Rumah")).toBe(
      getCategoryRegionId("Belanja Rumah"),
    );
  });

  it("normalizes case-only differences to the same id", () => {
    expect(getCategoryRegionId("MAKAN")).toBe(getCategoryRegionId("Makan"));
  });
});
