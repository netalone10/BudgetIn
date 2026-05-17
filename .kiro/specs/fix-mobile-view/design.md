# Design Document: Fix Mobile View

## Overview

This design addresses horizontal overflow, text overflow, and layout responsiveness issues across the BudgetIn application on mobile viewports (≤ 768px). The approach uses Tailwind CSS v4 utility classes applied directly to existing components — no new components or JavaScript logic required.

The fix strategy is layered:
1. **Global overflow prevention** at the html/body level
2. **Responsive typography** scaling on the landing page
3. **Proper scroll wrappers** for wide content (tables, data grids)
4. **Grid/flex responsiveness** defaulting to single-column on mobile
5. **Text truncation/word-break** for long content in cards and lists

## Architecture

The fix is purely presentational. No new files, components, or dependencies are introduced. Changes are limited to:

- `app/globals.css` — global overflow rule
- `app/layout.tsx` — optional overflow class on `<body>`
- `app/page.tsx` — responsive font sizes and layout adjustments
- `app/dashboard/layout.tsx` — verify overflow behavior
- `components/DashboardTabs.tsx` — confirm scroll wrapper exists
- Various dashboard page files — grid/flex/truncation fixes
- Settings and public page files — responsive adjustments

### Decision Rationale

| Decision | Rationale |
|----------|-----------|
| `overflow-x: hidden` on html/body | Prevents any child from causing page-level horizontal scroll. Inner `overflow-x-auto` wrappers still work because they create their own scroll context. |
| Responsive font via `text-3xl sm:text-5xl` pattern | Tailwind v4 mobile-first approach. Default is mobile size, `sm:` breakpoint scales up. |
| Keep `overflow-x-clip` on dashboard content area | Already present in `dashboard/layout.tsx`. Clip is stricter than hidden (no programmatic scroll) which is correct for the main content wrapper. Inner `overflow-x-auto` divs still scroll. |
| `min-w-0` on flex children | Prevents flex items from overflowing their container — a common flexbox gotcha on mobile. |

## Components and Interfaces

No new components. Modifications to existing components:

### globals.css
Add `overflow-x: hidden` to `html` and `body` in the `@layer base` section.

### app/layout.tsx
No structural changes needed — the `overflow-x: hidden` is handled via CSS.

### app/page.tsx (Landing Page)
- h1: Change from `text-5xl sm:text-[64px]` to `text-3xl sm:text-5xl lg:text-[64px]`
- h2 sections: Add responsive sizing `text-2xl sm:text-[40px]`
- CTA buttons: Ensure `w-full sm:w-auto` pattern
- Add `break-words` on hero text container

### app/dashboard/layout.tsx
- Current: `overflow-x-clip` on content div — this is correct, keep it
- Verify `min-w-0` is present on the flex-1 child (it is)

### components/DashboardTabs.tsx
- The table already has `overflow-x-auto` wrapper and `min-w-[860px]` on the table — this is correct
- Verify the mobile card view (`sm:hidden`) works without overflow

### Dashboard sub-pages
- Ensure grids default to `grid-cols-1` and scale with `sm:grid-cols-2 lg:grid-cols-3`
- Add `truncate` or `break-words` to category names and long text
- Wrap any wide content in `overflow-x-auto` divs

### Settings pages
- Forms should use `w-full` on inputs
- Tables/lists wrapped in `overflow-x-auto`

### Public pages (about, contact, privacy, terms)
- Ensure text containers have `max-w-full` and proper padding
- Headings use responsive font sizes

## Data Models

Not applicable — no data model changes for CSS fixes.

## Error Handling

Not applicable — CSS changes cannot produce runtime errors. If a class is misapplied, the worst case is a visual regression which is caught by manual testing.

## Testing Strategy

**Property-based testing is NOT applicable** for this feature. The changes are purely CSS/visual and cannot be meaningfully validated through automated property tests. There are no pure functions, serializers, or logic transformations involved.

**Recommended testing approach:**

1. **Manual visual testing** — Open each modified page on mobile viewport (Chrome DevTools device toolbar, 375px width) and verify:
   - No horizontal scrollbar on body
   - Text doesn't overflow containers
   - Tables scroll horizontally within their wrapper
   - Grids collapse to single column
   - Buttons are tappable (min 44px touch target)

2. **Responsive breakpoint check** — Verify at 320px, 375px, 414px, 768px widths

3. **Build verification** — Run `next build` to ensure no compilation errors from class changes
