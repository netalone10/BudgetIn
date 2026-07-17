# Dashboard Improvement Plan — BudgetIn

> Status: ✅ APPROVED — Execute all phases
> Created: 2026-07-17
> Decisions:
> - Chart library: recharts (already in deps)
> - Card collapse: per-card memory, localStorage key `dashboard-collapsed-cards`
> - Anomaly threshold: 1.5x, hardcoded
> - Upcoming bills window: 7 days
> - Execution scope: all 6 phases

---

## Phase 1 — Spending Velocity (High Impact, Low Effort)

### 1.1 Create `SpendingVelocityCard` component
- File: `components/dashboard/SpendingVelocityCard.tsx`
- Input: `budgetData`, `transactions`, current date
- Logic:
  - `daysElapsed` = days from start of month to today
  - `daysRemaining` = days from today to end of month
  - `totalBudget` = sum of all category budgets
  - `totalSpent` = sum of all expenses this month
  - `dailyBurnRate` = totalSpent / daysElapsed
  - `projectedTotal` = dailyBurnRate * totalDaysInMonth
  - `projectedOverBudget` = projectedTotal - totalBudget (if positive)
- Display:
  - Progress bar: totalSpent / totalBudget
  - Color: green < 70%, yellow 70-90%, red > 90%
  - Text: "Rp Xjt dari Rp Yjt (Z%) · W hari tersisa"
  - Projection: "Di rate ini, lo bakal [over/under] budget Rp Xjt"

### 1.2 Add to dashboard layout
- File: `app/dashboard/DashboardClient.tsx`
- Position: Right column row 1, alongside SafeToSpendCard
- Lazy load with skeleton

---

## Phase 2 — Upcoming Bills (High Impact, Low Effort)

### 2.1 Create `UpcomingBillsCard` component
- File: `components/dashboard/UpcomingBillsCard.tsx`
- Input: recurring transactions with `isActive=true` + installment data
- Logic:
  - Filter recurring where `nextDueDate` is within **7 days**
  - Sort by `nextDueDate` ascending
  - Show category, amount, due date, days until due
- Display:
  - List of upcoming bills (max 5)
  - Each row: category + amount + countdown badge
  - "X hari lagi" / "Besok" / "Hari ini" with color coding
  - Empty state: "Tidak ada tagihan dalam 7 hari ke depan"

### 2.2 API
- Check existing `/api/recurring` for enough data
- If insufficient, create `/api/dashboard/upcoming-bills`

### 2.3 Add to dashboard layout
- File: `app/dashboard/DashboardClient.tsx`
- Position: Right column row 2

---

## Phase 3 — Reorganize Right Column (Medium Impact, Medium Effort)

### 3.1 New layout structure
```
Right Column:
├── Row 1 (2 cols): SpendingVelocity | SafeToSpend
├── Row 2 (2 cols): UpcomingBills | BudgetAlerts
├── Row 3 (2 cols): CashFlowTrend | RunwayKas
├── Row 4 (full):   BudgetMiniList (collapsible)
├── Row 5 (2 cols): SavingsGoal | Installments
```

### 3.2 Collapsible cards
- Add chevron toggle to card headers
- Persist state in localStorage `dashboard-collapsed-cards`
- Default: expanded

---

## Phase 4 — Cash Flow Trend (Medium Impact, Medium Effort)

### 4.1 Enhance `MiniCashflowCard`
- Add 6-month trend chart using recharts
- Aggregate transactions by month
- Bar chart: income (green) vs expense (red) per month

### 4.2 Display
- X-axis: last 6 months labels
- Y-axis: amount in IDR
- Highlight current month

---

## Phase 5 — Anomaly Detection (Nice to Have)

### 5.1 Create `AnomalyAlertCard` component
- File: `components/dashboard/AnomalyAlertCard.tsx`
- Logic:
  - Calculate 3-month rolling average per category
  - Flag current month spending > **1.5x** average
- Display:
  - Warning: "Pengeluaran [kategori] 2x lipat dari biasanya"
  - Only show if anomalies detected

---

## Phase 6 — Monthly Comparison (Nice to Have)

### 6.1 Create `MonthlyComparisonCard` component
- File: `components/dashboard/MonthlyComparisonCard.tsx`
- Input: transactions current + previous month
- Logic:
  - Aggregate income, expense, savings per month
  - Delta: (current - previous) / previous * 100
- Display:
  - 3 rows: Income, Expense, Savings
  - Delta arrow + percentage
  - Green for positive, red for negative

---

## Technical Notes

- All data from existing endpoints (transactions, budget, recurring, installments, accounts)
- All new cards: lazy loaded with `next/dynamic` + skeleton
- SWR pattern (ETag) for data fetching
- No new dependencies (recharts already installed)
- Mobile responsive: stack vertically, collapsible on small screens
- Accessibility: ARIA labels, text alternatives for color coding

---

## Execution

1. [ ] Phase 1: SpendingVelocityCard
2. [ ] Phase 2: UpcomingBillsCard
3. [ ] Phase 3: Reorganize layout
4. [ ] Phase 4: CashFlowTrend
5. [ ] Phase 5: AnomalyAlertCard
6. [ ] Phase 6: MonthlyComparisonCard
7. [ ] Final QA review
8. [ ] Commit + push
