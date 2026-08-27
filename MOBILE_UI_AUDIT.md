# Mobile UI Audit - Pro Digital

Date: 2026-05-30

## Scope

Reviewed the mobile-first UI surfaces that affect daily phone usage:

- Header / topbar: `MainHeaderBar`
- Mobile menu and bottom navigation: `AppNavigation`, `MobileNavLink`, `Fab`
- Layout shell: `MainApp`, `MainContentArea`
- Shared UI primitives: `Button`, `IconButton`, `Input`, `Select`, `Textarea`, `MoneyField`, `DatePicker`, `Tabs`, `Card`, `Dialog`, `BottomSheet`, `Dropdown`, `PageHeader`
- Main pages checked with Playwright: Dashboard, Transactions, Clients, Stock/Portfolio simulator, Investors, Services, Personal Expenses, Settings modal, New Transaction modal

## Problems Found

- Mobile header still rendered five utility actions at once: search, settings, theme, language, logout.
- Header icon buttons were visually around 36px on mobile, below the intended 44px touch target.
- `Pro Digital` had protection against wrapping, but the available space was still squeezed by too many right-side icons.
- Button sizing was inconsistent across shared components and page-level buttons: mixed `py-2`, `py-3`, `h-9`, `h-12`, custom radii, and ad hoc colors.
- Input/select/money fields used compatible but not fully unified heights and radii.
- Modal footer buttons were not consistently full-width on mobile.
- PAM simulator tabs needed a strict mobile grid and consistent 44px tab height.
- The previous audit file was stale: it described header fixes that were not present in the current source.
- `NumberInput` emitted a browser console error because the native `pattern` attribute was invalid with modern `/v` regexp parsing.

## Fixes Applied

- Rebuilt mobile header as a separate mobile layout:
  - left: menu button only
  - center: single-line `Pro Digital`
  - right: theme and language only
  - search, settings, logout moved to the mobile menu
- Added/extended design tokens in `src/styles/tokens.css` and mirrored them in `tailwind.config.ts`:
  - `button-sm`, `button-md`, `button-lg`
  - `icon-button`
  - `input`
  - `button` and `card` radius
  - mobile typography tokens
- Unified shared components:
  - `Button`: variants and sizes include `primary`, `secondary`, `success`, `danger`, `ghost`, `outline`, `tab`, `icon`; sizes include `sm`, `md`, `lg`, `icon`
  - `IconButton`: 40/44/52px touch sizes
  - `Input`, `Select`, `Textarea`, `MoneyField`, `DatePicker`: 48px input height and `rounded-button`
  - `Tabs`: mobile `grid-cols-2`, 44px height, truncated labels
  - `Card`: `rounded-card`
  - `Dialog` / `BottomSheet`: max-width safeguards and mobile-friendly footer buttons
  - `Dropdown`: viewport max-width guard
  - `PageHeader`: max-width and button target consistency
- Updated key page buttons in Dashboard, Transactions, Clients, Client Details, Investors, Services, and manual-service panels to use shared sizing instead of local random padding.
- Changed the app content wrapper to `px-page-x` so mobile page padding is consistently 16px.
- Removed the invalid `NumberInput` native `pattern` attribute; math-expression validation remains in the component logic.

## Overflow Findings

No persistent page-level horizontal overflow was found after the fixes.

Notable risk areas checked:

- Header utility buttons: fixed by reducing visible mobile actions.
- Page headers using `-mx-4`: safe after the shell padding was standardized to 16px.
- PAM simulator tabs and inputs: fixed via mobile two-column tabs and responsive input grids.
- Dropdowns and sheets: constrained with `max-w-[calc(100vw-2rem)]` or `max-w-full`.
- Bottom navigation: retained `100dvw` behavior to avoid scrollbar-width overflow on fixed mobile nav.

## Verification

Commands:

- `npm run build` passed.
- Playwright responsive checks passed at:
  - 360px
  - 375px
  - 390px
  - 414px
  - 430px

Checked on each width:

- No horizontal overflow.
- Header title remains one line.
- Header has only 3 visible mobile buttons: menu, theme, language.
- Header buttons are 44px touch targets.
- PAM simulator tabs render as a balanced 2x2 grid with 44px height.
- PAM simulator fields are 48px high and responsive.
- Settings modal fields are 48px high and fit the viewport.
- New Transaction modal fits the viewport.
- Browser console errors from `NumberInput` pattern are gone.

## Remaining Decisions

- The mobile header currently keeps both theme and language visible. If the desired header is even quieter, theme can also move into the menu, leaving only language on the right.
- Some legacy feature-specific screens still have local visual classes for specialized rows/cards. They now inherit the shared primitives where practical, but a deeper visual pass can further reduce local styling without changing behavior.
