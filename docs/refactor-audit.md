# UI Refactor Audit

Date: 2026-05-28

This audit records the surfaces planned and completed for the fintech mobile UI refactor. Business calculations, PAM/investor economics, transaction linking, and Firebase collection paths/ordering stayed out of scope.

## Foundations
- `tailwind.config.ts` (new): compat/mirror only. Tailwind v4 tokens remain sourced from CSS `@theme`.
- `src/styles/tokens.css` (new): single active design-token source for Tailwind v4.
- `src/index.css`: imports tokens and owns base font/body rules.
- `index.html`, `src/AppContent.tsx`: remove design hex/inline body styling and app shell colors.
- `src/components/ui/*`: normalize primitives, touch targets, token colors, modal compatibility, loading/error/empty states.
- `src/components/financial/*`: normalize all money display and financial row/card components.

## UI Pages
- `src/pages/DashboardPage.tsx`
- `src/pages/TransactionsPage.tsx`
- `src/pages/ClientsPage.tsx`
- `src/pages/InvestorsPage.tsx`
- `src/pages/InvestorDetailsPage.tsx`
- `src/pages/InvestorDashboardPage.tsx`
- `src/pages/ServicesPage.tsx`
- `src/pages/PersonalExpensesPage.tsx`
- `src/pages/ReportsPage.tsx`
- `src/pages/AnalyticsPage.tsx`
- `src/pages/PortfolioPage.tsx`
- `src/pages/TresoreriePage.tsx`
- `src/pages/ManualAssetPage.tsx`
- `src/pages/ManualClientPage.tsx`

## Modals And Dialog Surfaces
- `src/components/main/MainAppDialogs.tsx`
- `src/components/main/MainTransactionDialog.tsx`
- `src/components/main/MainClientOperationsDialogs.tsx`
- `src/components/main/MainClientCrudDialogs.tsx`
- `src/components/main/MainClientSummaryDialog.tsx`
- `src/components/main/MainDialogs.tsx`
- `src/components/main/MainInvestorDialogs.tsx`
- `src/components/main/MainTransferAndFilterDialogs.tsx`
- `src/components/main/MainUtilityDialogs.tsx`
- `src/components/transactions/NewTransactionMenuDialog.tsx`
- `src/components/clients/OverdueDebtsModal.tsx`
- `src/components/investors/CommissionEditorModal.tsx`
- `src/components/manual-asset/ManualAssetClientDialogs.tsx`
- `src/components/manual-client/ManualClientTransactionDialog.tsx`
- `src/components/modals/AdjustmentModal.tsx`
- `src/components/modals/ClientModal.tsx`
- `src/components/modals/DeliveryExpenseModal.tsx`
- `src/components/modals/PersonalAdvanceReconcileModal.tsx`
- `src/components/modals/PersonalWithdrawalModal.tsx`
- `src/components/modals/TransactionModal.tsx`
- `src/components/ReportModal.tsx`

## Reports, Charts, Exports, And Print
- Reports and analytics UI: `src/pages/ReportsPage.tsx`, `src/pages/AnalyticsPage.tsx`, `src/components/analytics/AnalyticsReportCard.tsx`, `src/components/analytics/AnalyticsExportPanel.tsx`.
- Recharts: `src/components/dashboard/ProfitHistoryChart.tsx`, `src/components/dashboard/InvestorPerformanceChart.tsx`, `src/components/dashboard/AssetAllocationChart.tsx`.
- PDF and print HTML: `src/utils/pdfReports.ts`.
- JPG/image export: `src/components/main/MainClientSummaryDialog.tsx`.
- Canvas/report preview export: `src/components/ReportModal.tsx`.

## List State And Technical Exceptions
- Loading/error/empty state integration: `src/hooks/useAppData.ts`, `src/components/main/MainContentArea.tsx`, `src/components/ui/MobileTable.tsx`, `src/components/ui/SkeletonList.tsx`, `src/components/ui/ErrorState.tsx`, `src/components/ui/EmptyState.tsx`.
- Inline styles are banned for design, colors, spacing, and layout identity.
- Inline styles are allowed only for technical needs such as virtualization/content visibility, swipe widths, canvas/export dimensions, or third-party chart/export APIs. Each remaining exception must include a short comment explaining why a Tailwind class cannot replace it.

## Completion Status
- Design tokens are centralized in `src/styles/tokens.css` with `@theme`; `tailwind.config.ts` is compatibility/mirror only.
- UI primitives and financial components are in place and used across the refactored app surfaces.
- Dashboard, Transactions, Clients, Investors, Services, Expenses, Reports, Analytics, Portfolio/Stock, and Parameters surfaces have been refactored to the shared UI/tokens layer.
- Recharts surfaces now use token-backed CSS variables and custom tokenized tooltips.
- PDF/print HTML reads report colors from design tokens; image exports keep only technical capture styles.
- Remaining `style={{...}}` usages are technical exceptions only: list `content-visibility`, swipe widths/touch action, and hidden export capture positioning.
- Focused scans show no direct hex colors outside `src/styles/tokens.css`, and no old direct Tailwind palette classes in `src/components`, `src/pages`, or `src/AppContent.tsx`.
- `npm run build` succeeds after the refactor.

## Execution Order
1. Tokens and UI primitives.
2. Financial components.
3. Pages and nested details.
4. Reports and Recharts.
5. PDF, JPG/image export, and print HTML.
6. Build, regression scripts, grep checks, and 390px visual verification.

## Verification Completed
- `npm run build`
- Direct hex scan excluding token source and generated Data Connect files.
- Direct old Tailwind palette scan for `src/components`, `src/pages`, and `src/AppContent.tsx`.
- Dialog scan confirmed app modals route through the unified `Modal` wrapper, except the internal `Modal -> Dialog` implementation.
- Playwright 390px smoke check on `http://localhost:5173`:
  - viewport width: `390`
  - document/body scroll width: `390`
  - horizontal overflow: `false`
  - console errors: `[]`
- Real Firebase account smoke check on `390x844` completed:
  - login succeeded.
  - Dashboard, Transactions, Clients, Investors, Services, Expenses, Portfolio/Stock, Analytics/Reports, Treasury, and Parameters opened.
  - horizontal overflow: `false` on all checked surfaces.
  - console/page errors: `[]`.

## Remaining Manual QA
- Perform hands-on CRUD checks with real data after login: create/edit/delete one transaction, client entry, investor movement, service item, and expense.
- Export one monthly PDF, one client PDF, one investor PDF, one expenses PDF, and verify browser print/save output.
- Test JPG/image share or download from the client summary export on mobile and desktop.
- Run a short financial scenario with real data: buy, sell, linked client payment, expense, investor movement, PAM profit preview.
- Review `git status` carefully before any commit because the workspace contains many pre-existing modified/untracked files.
