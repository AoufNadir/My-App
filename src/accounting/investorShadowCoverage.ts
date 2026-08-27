import type { InvestorShadowKind } from './investorShadow';

export type InvestorShadowV2Policy = 'shadow_observed' | 'lifecycle_prepared' | 'archive_entity';

/** Tracking only: it never enables a V2 writer, closure, Rule, or Firebase write. */
export const INVESTORS_V2_READINESS = 'shadow' as const;

export type InvestorShadowWriter = {
    id: string;
    file: string;
    legacyWrite: string;
    shadowKinds: InvestorShadowKind[];
    v2Policy: InvestorShadowV2Policy;
};

export const INVESTOR_SHADOW_WRITERS: readonly InvestorShadowWriter[] = [
    { id: 'investors.create-opening-capital', file: 'src/hooks/useInvestorHandlers.ts', legacyWrite: 'investors + investor_transactions deposit_capital + optional treasury', shadowKinds: ['investor_initial_capital'], v2Policy: 'shadow_observed' },
    { id: 'investors.capital-top-up', file: 'src/hooks/useInvestorHandlers.ts', legacyWrite: 'investor_transactions deposit_capital + treasury Ajout', shadowKinds: ['investor_capital_top_up'], v2Policy: 'shadow_observed' },
    { id: 'investors.capital-withdrawal', file: 'src/hooks/useInvestorHandlers.ts', legacyWrite: 'investor_transactions withdraw_capital + treasury Retrait', shadowKinds: ['investor_capital_withdrawal'], v2Policy: 'shadow_observed' },
    { id: 'investors.profit-payout', file: 'src/hooks/useInvestorHandlers.ts', legacyWrite: 'investor_transactions withdraw_profit + treasury Retrait', shadowKinds: ['profit_payout'], v2Policy: 'shadow_observed' },
    { id: 'investors.profit-reinvestment', file: 'src/hooks/useInvestorHandlers.ts', legacyWrite: 'investor_transactions reinvest_profit without cash', shadowKinds: ['profit_reinvestment'], v2Policy: 'shadow_observed' },
    { id: 'investors.personal-advance', file: 'src/hooks/useInvestorHandlers.ts', legacyWrite: 'treasury personal_expense pending + linked investor rows', shadowKinds: ['personal_advance'], v2Policy: 'shadow_observed' },
    { id: 'investors.personal-expense', file: 'src/hooks/useInvestorHandlers.ts', legacyWrite: 'treasury personal_expense settled + linked profit/capital rows', shadowKinds: ['personal_expense'], v2Policy: 'shadow_observed' },
    { id: 'investors.personal-advance-reconcile', file: 'src/hooks/useInvestorHandlers.ts', legacyWrite: 'settle advance + optional return + linked investor rows', shadowKinds: ['personal_advance_reconcile'], v2Policy: 'shadow_observed' },
    { id: 'investors.profit-allocation', file: 'src/accounting/investorShadowReadReconciliation.ts', legacyWrite: 'derived historical allocation only; no Legacy document exists', shadowKinds: ['profit_allocation'], v2Policy: 'shadow_observed' },
    { id: 'investors.entity-delete', file: 'src/hooks/useInvestorHandlers.ts', legacyWrite: 'investor and history delete', shadowKinds: [], v2Policy: 'archive_entity' },
    { id: 'investors.transaction-lifecycle', file: 'src/hooks/useInvestorHandlers.ts', legacyWrite: 'legacy investor transaction delete/update', shadowKinds: [], v2Policy: 'lifecycle_prepared' },
];
