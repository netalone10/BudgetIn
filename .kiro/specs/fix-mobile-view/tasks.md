# Implementation Plan: Fix Mobile View

## Overview

Systematic fix of horizontal overflow, text overflow, and layout responsiveness issues across all BudgetIn pages on mobile viewports. Each task targets a specific area with concrete Tailwind CSS class changes.

## Tasks

- [x] 1. Global overflow fix
  - [x] 1.1 Add `overflow-x: hidden` to html and body in `app/globals.css`
    - In the `@layer base` block, add `overflow-x: hidden` to the `body` rule
    - Add a new `html` rule with `overflow-x: hidden` if not already present
    - This prevents any page-level horizontal scrollbar while inner `overflow-x-auto` wrappers still function
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Landing page responsive fixes
  - [x] 2.1 Fix h1 and h2 font sizes for mobile in `app/page.tsx`
    - Change h1 from `text-5xl ... sm:text-[64px]` to `text-3xl sm:text-5xl lg:text-[64px]`
    - Change h2 headings from `text-[40px]` to `text-2xl sm:text-[40px]`
    - Add `break-words` to the hero text container div (`max-w-3xl space-y-6`)
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.2 Fix CTA buttons and grid layout on mobile in `app/page.tsx`
    - Ensure CTA buttons use `w-full sm:w-auto` pattern for full-width on mobile
    - Verify the stats grid (`sm:grid-cols-3`) already defaults to single column — confirm no explicit `grid-cols-3` without responsive prefix
    - Ensure the hero section grid uses proper responsive breakpoints (already `lg:grid-cols-[1.05fr_0.95fr]`)
    - _Requirements: 2.4, 4.2_

- [x] 3. Dashboard layout and DashboardTabs fixes
  - [x] 3.1 Verify dashboard layout overflow behavior in `app/dashboard/layout.tsx`
    - Confirm `overflow-x-clip` and `min-w-0` are present on the content wrapper (they are)
    - Ensure `pt-14 md:pt-0` is present for mobile topbar spacing (it is)
    - No changes needed if already correct — just verify
    - _Requirements: 3.2, 6.4_
  - [x] 3.2 Verify DashboardTabs scroll wrapper in `components/DashboardTabs.tsx`
    - Confirm the table is wrapped in `overflow-x-auto` div (it is: `<div className="overflow-x-auto">`)
    - Confirm mobile card view (`sm:hidden` / `hidden sm:block`) provides proper mobile layout
    - Ensure metric cards grid uses `grid gap-3 sm:grid-cols-2 xl:grid-cols-4` (verify default is single-col or 2-col)
    - _Requirements: 3.1, 3.2_
  - [x] 3.3 Fix DashboardClient layout if needed in `app/dashboard/DashboardClient.tsx`
    - Check for any hardcoded widths or grids that don't collapse on mobile
    - Ensure the main container uses proper padding (`px-4` not `px-6` on mobile)
    - _Requirements: 4.1, 4.3_

- [x] 4. Dashboard sub-pages responsive fixes
  - [x] 4.1 Fix transactions page in `app/dashboard/transactions/TransactionsClient.tsx`
    - Ensure transaction list/table has `overflow-x-auto` wrapper if it uses a wide table
    - Add `truncate` to category name and description columns
    - Ensure filter/toolbar stacks vertically on mobile (`flex-col sm:flex-row`)
    - _Requirements: 3.3, 5.1, 5.2_
  - [x] 4.2 Fix budget page in `app/dashboard/budget/BudgetClient.tsx`
    - Ensure budget cards grid defaults to `grid-cols-1 sm:grid-cols-2`
    - Add `truncate` to category names if they can be long
    - Wrap any wide tables in `overflow-x-auto`
    - _Requirements: 4.1, 5.1, 5.3_
  - [x] 4.3 Fix savings page in `app/dashboard/savings/page.tsx`
    - Ensure grid layout collapses to single column on mobile
    - Add text truncation to goal names
    - _Requirements: 4.1, 5.1_
  - [x] 4.4 Fix recurring page in `app/dashboard/recurring/RecurringClient.tsx`
    - Ensure recurring items list/grid is responsive
    - Add `truncate` to item names and descriptions
    - Wrap any wide content in `overflow-x-auto`
    - _Requirements: 4.1, 5.1, 5.2_
  - [x] 4.5 Fix accounts and cashflow pages
    - `app/dashboard/accounts/AccountsClient.tsx`: Ensure card grid is responsive, add truncation
    - `app/dashboard/cashflow/page.tsx`: Ensure charts/tables don't overflow, wrap wide content
    - _Requirements: 4.1, 4.3, 5.3_

- [x] 5. Settings pages responsive fixes
  - [x] 5.1 Fix account settings in `app/dashboard/settings/account/`
    - Ensure form inputs are `w-full` on mobile
    - Stack form fields vertically
    - Ensure action buttons don't overlap
    - _Requirements: 7.1, 7.3_
  - [x] 5.2 Fix account-types settings in `app/dashboard/settings/account-types/`
    - Wrap any data tables in `overflow-x-auto`
    - Ensure list items truncate long names
    - _Requirements: 7.2, 7.3_
  - [x] 5.3 Fix backup-restore settings in `app/dashboard/settings/backup-restore/`
    - Ensure buttons and content stack properly on mobile
    - Wrap any wide content in scroll wrapper
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 6. Public pages responsive fixes
  - [x] 6.1 Fix about page in `app/about/page.tsx`
    - Ensure headings use responsive font sizes (`text-2xl sm:text-4xl`)
    - Ensure content container has proper mobile padding (`px-4 sm:px-6`)
    - Verify grid layouts collapse to single column
    - _Requirements: 4.2_
  - [x] 6.2 Fix contact page in `app/contact/page.tsx`
    - Ensure form is full-width on mobile
    - Ensure proper padding and text sizing
    - _Requirements: 4.2_
  - [x] 6.3 Fix privacy and terms pages
    - `app/privacy/page.tsx` and `app/terms/page.tsx`: Ensure long text content has `break-words` and proper padding
    - Verify no fixed-width elements cause overflow
    - _Requirements: 4.2_

- [x] 7. Final checkpoint
  - Run `next build` to verify no compilation errors
  - Ensure all tests pass, ask the user if questions arise

## Notes

- No property-based tests — these are CSS/visual fixes verified by manual responsive testing
- Each task references specific requirements for traceability
- The project uses Tailwind CSS v4 (CSS-based config, no tailwind.config file)
- Responsive prefixes are mobile-first: default = mobile, `sm:` = 640px+, `md:` = 768px+, `lg:` = 1024px+
- Checkpoints ensure incremental validation via `next build`
