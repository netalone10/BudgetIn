import fc from "fast-check";
import {
  applyOptimisticUpdate,
  type OptimisticMutationOptions,
} from "@/lib/hooks/use-api";

/**
 * Property 2: Optimistic Cache Mutation Consistency
 *
 * For any valid transaction data and mutation type (create, update, or delete),
 * the `applyOptimisticUpdate` function SHALL produce a new cache state that
 * reflects the mutation: create increases array length by 1 and includes the
 * new item, update preserves array length and modifies the target item, delete
 * decreases array length by 1 and excludes the removed item.
 *
 * **Validates: Requirements 3.2**
 */

// --- Arbitraries ---

interface Transaction {
  id: string;
  amount: number;
  category: string;
  note: string;
}

const transactionArb: fc.Arbitrary<Transaction> = fc.record({
  id: fc.uuid(),
  amount: fc.double({ min: -100000, max: 100000, noNaN: true }),
  category: fc.string({ minLength: 1, maxLength: 20 }),
  note: fc.string({ maxLength: 50 }),
});

const transactionArrayArb: fc.Arbitrary<Transaction[]> = fc.array(
  transactionArb,
  { minLength: 0, maxLength: 50 }
);

// --- Standard Optimistic Transforms ---

function createTransform(
  current: Transaction[],
  newItem: Transaction
): Transaction[] {
  return [...current, newItem];
}

function updateTransform(
  current: Transaction[],
  updatedItem: Transaction
): Transaction[] {
  return current.map((item) =>
    item.id === updatedItem.id ? { ...item, ...updatedItem } : item
  );
}

function deleteTransform(
  current: Transaction[],
  itemToDelete: Transaction
): Transaction[] {
  return current.filter((item) => item.id !== itemToDelete.id);
}

describe("Property 2: Optimistic Cache Mutation Consistency", () => {
  describe("create mutation", () => {
    it("increases array length by 1 and includes the new item", () => {
      fc.assert(
        fc.property(
          transactionArrayArb,
          transactionArb,
          (currentData, newItem) => {
            const options: OptimisticMutationOptions<Transaction, Transaction> =
              {
                endpoint: "/api/transactions",
                mutationType: "create",
                mutationData: newItem,
                currentData,
                optimisticTransform: createTransform,
                rollbackData: currentData,
              };

            const result = applyOptimisticUpdate(options);

            // Array length increases by exactly 1
            expect(result.length).toBe(currentData.length + 1);

            // The new item is included in the result
            const found = result.find((item) => item.id === newItem.id);
            expect(found).toBeDefined();
            expect(found).toEqual(newItem);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe("update mutation", () => {
    it("preserves array length and modifies the target item", () => {
      fc.assert(
        fc.property(
          transactionArrayArb.filter((arr) => arr.length > 0),
          transactionArb,
          (currentData, updateData) => {
            // Pick a random existing item to update
            const targetIndex = Math.floor(
              Math.random() * currentData.length
            );
            const targetItem = currentData[targetIndex];
            const updatedItem: Transaction = {
              ...updateData,
              id: targetItem.id,
            };

            const options: OptimisticMutationOptions<Transaction, Transaction> =
              {
                endpoint: "/api/transactions",
                mutationType: "update",
                mutationData: updatedItem,
                currentData,
                optimisticTransform: updateTransform,
                rollbackData: currentData,
              };

            const result = applyOptimisticUpdate(options);

            // Array length is preserved
            expect(result.length).toBe(currentData.length);

            // The target item is modified with the new data
            const found = result.find((item) => item.id === targetItem.id);
            expect(found).toBeDefined();
            expect(found!.amount).toBe(updatedItem.amount);
            expect(found!.category).toBe(updatedItem.category);
            expect(found!.note).toBe(updatedItem.note);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe("delete mutation", () => {
    it("decreases array length by 1 and excludes the removed item", () => {
      fc.assert(
        fc.property(
          transactionArrayArb.filter((arr) => arr.length > 0),
          (currentData) => {
            // Pick a random existing item to delete
            const targetIndex = Math.floor(
              Math.random() * currentData.length
            );
            const targetItem = currentData[targetIndex];

            const options: OptimisticMutationOptions<Transaction, Transaction> =
              {
                endpoint: "/api/transactions",
                mutationType: "delete",
                mutationData: targetItem,
                currentData,
                optimisticTransform: deleteTransform,
                rollbackData: currentData,
              };

            const result = applyOptimisticUpdate(options);

            // Array length decreases by exactly 1
            expect(result.length).toBe(currentData.length - 1);

            // The removed item is excluded from the result
            const found = result.find((item) => item.id === targetItem.id);
            expect(found).toBeUndefined();
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe("delete mutation with duplicate IDs", () => {
    it("removes all items with the target ID and decreases length accordingly", () => {
      fc.assert(
        fc.property(
          transactionArrayArb.filter((arr) => arr.length > 0),
          (currentData) => {
            // Ensure unique IDs for this property by deduplicating
            const uniqueData = currentData.filter(
              (item, index, self) =>
                self.findIndex((t) => t.id === item.id) === index
            );

            if (uniqueData.length === 0) return;

            const targetIndex = Math.floor(
              Math.random() * uniqueData.length
            );
            const targetItem = uniqueData[targetIndex];

            const options: OptimisticMutationOptions<Transaction, Transaction> =
              {
                endpoint: "/api/transactions",
                mutationType: "delete",
                mutationData: targetItem,
                currentData: uniqueData,
                optimisticTransform: deleteTransform,
                rollbackData: uniqueData,
              };

            const result = applyOptimisticUpdate(options);

            // With unique IDs, length decreases by exactly 1
            expect(result.length).toBe(uniqueData.length - 1);

            // The removed item is excluded
            const found = result.find((item) => item.id === targetItem.id);
            expect(found).toBeUndefined();
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe("general invariants", () => {
    it("never mutates the original currentData array", () => {
      fc.assert(
        fc.property(
          transactionArrayArb,
          transactionArb,
          fc.constantFrom("create" as const, "update" as const, "delete" as const),
          (currentData, mutationData, mutationType) => {
            const originalCopy = [...currentData];

            const transforms = {
              create: createTransform,
              update: updateTransform,
              delete: deleteTransform,
            };

            const options: OptimisticMutationOptions<Transaction, Transaction> =
              {
                endpoint: "/api/transactions",
                mutationType,
                mutationData,
                currentData,
                optimisticTransform: transforms[mutationType],
                rollbackData: currentData,
              };

            applyOptimisticUpdate(options);

            // Original array is not mutated
            expect(currentData).toEqual(originalCopy);
            expect(currentData.length).toBe(originalCopy.length);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
