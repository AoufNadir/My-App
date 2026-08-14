export type FinancialTermId =
  | 'totalCapital'
  | 'ownedCapital'
  | 'liquidity'
  | 'investorLiability'
  | 'investorCapital'
  | 'unwithdrawnProfit'
  | 'netClientPosition';

export type FinancialTermConfig = {
  labelKey: string;
  descriptionKey: string;
};

export const FINANCIAL_TERMS: Record<FinancialTermId, FinancialTermConfig> = {
  totalCapital: { labelKey: 'financialTerms.totalCapital', descriptionKey: 'financialTerms.totalCapitalDescription' },
  ownedCapital: { labelKey: 'financialTerms.ownedCapital', descriptionKey: 'financialTerms.ownedCapitalDescription' },
  liquidity: { labelKey: 'financialTerms.liquidity', descriptionKey: 'financialTerms.liquidityDescription' },
  investorLiability: { labelKey: 'financialTerms.investorLiability', descriptionKey: 'financialTerms.investorLiabilityDescription' },
  investorCapital: { labelKey: 'financialTerms.investorCapital', descriptionKey: 'financialTerms.investorCapitalDescription' },
  unwithdrawnProfit: { labelKey: 'financialTerms.unwithdrawnProfit', descriptionKey: 'financialTerms.unwithdrawnProfitDescription' },
  netClientPosition: { labelKey: 'financialTerms.netClientPosition', descriptionKey: 'financialTerms.netClientPositionDescription' },
};
