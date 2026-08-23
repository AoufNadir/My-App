import { fromCents, toCents } from '../utils/money';
import { validateAccountingOperation } from './integrity';
import type { AccountingOperationDraft, FinancialOperationKind, LedgerAccount, LedgerPosting } from './types';

export type TreasuryWallet = 'Caisse' | 'BaridiMob';

export type TreasuryShadowKind =
    | 'treasury_adjustment_in'
    | 'treasury_adjustment_out'
    | 'treasury_transfer'
    | 'project_expense_cash'
    | 'portfolio_purchase_cash'
    | 'portfolio_sale_cash'
    | 'client_receipt_cash'
    | 'client_payout_cash'
    | 'investor_capital_deposit_cash'
    | 'investor_capital_withdrawal_cash'
    | 'investor_profit_withdrawal_cash'
    | 'personal_advance_cash'
    | 'personal_expense_cash'
    | 'personal_advance_return_cash'
    | 'digital_service_purchase_cash'
    | 'digital_service_sale_cash'
    | 'manual_asset_receipt_cash'
    | 'manual_asset_payout_cash'
    | 'po_order_sale_receipt_cash';

type TreasuryShadowBase = {
    operationId: string;
    actorUid: string;
    effectiveAt: number;
    amountDzd: number;
    wallet?: TreasuryWallet;
    currency?: 'USDT' | 'EUR';
    clientId?: string;
    investorId?: string;
};

export type TreasuryShadowIntent = TreasuryShadowBase & {
    kind: Exclude<TreasuryShadowKind, 'treasury_transfer'>;
    wallet: TreasuryWallet;
} | TreasuryShadowBase & {
    kind: 'treasury_transfer';
    from: TreasuryWallet;
    to: TreasuryWallet;
};

/** Minimal Legacy row shape used only to compare the cash effect in memory. */
export type LegacyTreasuryShadowRow = {
    type: 'Ajout' | 'Retrait' | 'Adjustment (+)' | 'Adjustment (-)' | 'Transfer';
    amount: number;
    source?: TreasuryWallet;
    destination?: TreasuryWallet;
};

export type TreasuryCashDeltas = Record<TreasuryWallet, number>;

export type TreasuryShadowResult = {
    intent: TreasuryShadowIntent;
    draft: AccountingOperationDraft;
    legacyCashDeltas: TreasuryCashDeltas;
    ledgerCashDeltas: TreasuryCashDeltas;
    integrityErrors: string[];
    mismatches: string[];
    matches: boolean;
};

const ZERO_DELTAS = (): TreasuryCashDeltas => ({ Caisse: 0, BaridiMob: 0 });

function walletAccount(wallet: TreasuryWallet): LedgerAccount {
    return wallet === 'Caisse' ? 'asset.cash.caisse' : 'asset.cash.baridimob';
}

function cashPosting(id: string, wallet: TreasuryWallet, side: 'debit' | 'credit', amountDzd: number): LedgerPosting {
    return { id, account: walletAccount(wallet), side, amountDzd };
}

function posting(id: string, account: LedgerAccount, side: 'debit' | 'credit', amountDzd: number, intent: TreasuryShadowIntent): LedgerPosting {
    return {
        id,
        account,
        side,
        amountDzd,
        ...(intent.clientId ? { clientId: intent.clientId } : {}),
        ...(intent.investorId ? { investorId: intent.investorId } : {}),
    };
}

function operationKind(intent: TreasuryShadowIntent): FinancialOperationKind {
    switch (intent.kind) {
        case 'treasury_adjustment_in':
        case 'treasury_adjustment_out':
            return 'correction';
        case 'treasury_transfer':
            return 'treasury_transfer';
        case 'project_expense_cash':
            return 'project_expense';
        case 'portfolio_purchase_cash':
            return 'portfolio_buy';
        case 'portfolio_sale_cash':
            return 'portfolio_sell';
        case 'client_receipt_cash':
        case 'client_payout_cash':
            return 'client_settlement';
        case 'investor_capital_deposit_cash':
            return 'investor_capital_deposit';
        case 'investor_capital_withdrawal_cash':
            return 'investor_capital_withdrawal';
        case 'investor_profit_withdrawal_cash':
            return 'investor_profit_withdrawal';
        case 'personal_advance_cash':
        case 'personal_expense_cash':
        case 'personal_advance_return_cash':
            return 'personal_expense';
        case 'digital_service_purchase_cash':
        case 'digital_service_sale_cash':
            return 'digital_service_sale';
        case 'manual_asset_receipt_cash':
        case 'manual_asset_payout_cash':
            return 'manual_asset_transaction';
        case 'po_order_sale_receipt_cash':
            return 'order_completion';
    }
}

function counterpart(intent: TreasuryShadowIntent): { account: LedgerAccount; side: 'debit' | 'credit' } {
    switch (intent.kind) {
        case 'treasury_adjustment_in': return { account: 'equity.cash_adjustment', side: 'credit' };
        case 'treasury_adjustment_out': return { account: 'equity.cash_adjustment', side: 'debit' };
        case 'project_expense_cash': return { account: 'expense.project', side: 'debit' };
        case 'portfolio_purchase_cash': return { account: `asset.portfolio.${intent.currency || 'USDT'}`.toLowerCase() as LedgerAccount, side: 'debit' };
        case 'portfolio_sale_cash': return { account: 'income.portfolio_sale', side: 'credit' };
        case 'client_receipt_cash': return { account: 'asset.receivable.client', side: 'credit' };
        case 'client_payout_cash': return { account: 'liability.client_advance', side: 'debit' };
        case 'investor_capital_deposit_cash': return { account: 'liability.investor_capital', side: 'credit' };
        case 'investor_capital_withdrawal_cash': return { account: 'liability.investor_capital', side: 'debit' };
        case 'investor_profit_withdrawal_cash': return { account: 'liability.investor_profit_payable', side: 'debit' };
        case 'personal_advance_cash': return { account: 'asset.manager_advance', side: 'debit' };
        case 'personal_expense_cash': return { account: 'expense.personal', side: 'debit' };
        case 'personal_advance_return_cash': return { account: 'asset.manager_advance', side: 'credit' };
        case 'digital_service_purchase_cash': return { account: 'asset.service_inventory', side: 'debit' };
        case 'digital_service_sale_cash': return { account: 'income.digital_service_sale', side: 'credit' };
        case 'manual_asset_receipt_cash': return { account: 'asset.receivable.manual_asset', side: 'credit' };
        case 'manual_asset_payout_cash': return { account: 'asset.manual_asset', side: 'debit' };
        case 'po_order_sale_receipt_cash': return { account: 'income.purchase_order_sale', side: 'credit' };
        case 'treasury_transfer': throw new Error('Treasury transfers do not have a non-cash counterpart.');
    }
}

function cashSide(intent: Exclude<TreasuryShadowIntent, { kind: 'treasury_transfer' }>): 'debit' | 'credit' {
    return intent.kind === 'treasury_adjustment_out'
        || intent.kind === 'project_expense_cash'
        || intent.kind === 'portfolio_purchase_cash'
        || intent.kind === 'client_payout_cash'
        || intent.kind === 'investor_capital_withdrawal_cash'
        || intent.kind === 'investor_profit_withdrawal_cash'
        || intent.kind === 'personal_advance_cash'
        || intent.kind === 'personal_expense_cash'
        || intent.kind === 'digital_service_purchase_cash'
        || intent.kind === 'manual_asset_payout_cash'
        ? 'credit'
        : 'debit';
}

function assertIntent(intent: TreasuryShadowIntent): void {
    if (!Number.isFinite(intent.amountDzd) || intent.amountDzd <= 0) {
        throw new Error('Treasury shadow amount must be a positive finite number.');
    }
    if (!intent.operationId.trim() || !intent.actorUid.trim() || !Number.isFinite(intent.effectiveAt) || intent.effectiveAt <= 0) {
        throw new Error('Treasury shadow operation identity is invalid.');
    }
    if (intent.kind === 'treasury_transfer' && intent.from === intent.to) {
        throw new Error('Treasury shadow transfer requires two different wallets.');
    }
}

/**
 * Pure Draft builder. It has no Firestore imports, no clock access, and no
 * mutable module state. Shadow callers pass every value explicitly.
 */
export function buildTreasuryShadowDraft(intent: TreasuryShadowIntent): AccountingOperationDraft {
    assertIntent(intent);
    const amountDzd = fromCents(toCents(intent.amountDzd));
    const postings: LedgerPosting[] = intent.kind === 'treasury_transfer'
        ? [
            cashPosting('cash-to', intent.to, 'debit', amountDzd),
            cashPosting('cash-from', intent.from, 'credit', amountDzd),
        ]
        : (() => {
            const cash = cashSide(intent);
            const other = counterpart(intent);
            return [
                cashPosting('cash', intent.wallet, cash, amountDzd),
                posting('counterpart', other.account, other.side, amountDzd, intent),
            ];
        })();

    return {
        operationId: intent.operationId,
        accountingVersion: 2,
        kind: operationKind(intent),
        status: 'posted',
        effectiveAt: intent.effectiveAt,
        actorUid: intent.actorUid,
        reason: `treasuryV2 shadow: ${intent.kind}`,
        postings,
        projections: [],
        metadata: { mode: 'shadow', domain: 'treasuryV2', shadowKind: intent.kind },
    };
}

/** Pure interpretation of a Legacy treasury row into Caisse/BaridiMob deltas. */
export function getLegacyTreasuryCashDeltas(rows: readonly LegacyTreasuryShadowRow[]): TreasuryCashDeltas {
    const deltas = ZERO_DELTAS();
    for (const row of rows) {
        const amount = toCents(row.amount);
        if (amount <= 0) {
            throw new Error('Legacy treasury shadow rows require a positive amount.');
        }
        if (row.type === 'Transfer') {
            if (!row.source || !row.destination || row.source === row.destination) {
                throw new Error('Legacy treasury transfer requires distinct source and destination wallets.');
            }
            deltas[row.source] -= amount;
            deltas[row.destination] += amount;
            continue;
        }
        if (!row.source) {
            throw new Error('Legacy treasury movement requires a source wallet.');
        }
        if (row.type === 'Ajout' || row.type === 'Adjustment (+)') deltas[row.source] += amount;
        else deltas[row.source] -= amount;
    }
    return {
        Caisse: fromCents(deltas.Caisse),
        BaridiMob: fromCents(deltas.BaridiMob),
    };
}

/** Pure extraction of the cash effect from a balanced V2 Draft. */
export function getLedgerTreasuryCashDeltas(draft: Pick<AccountingOperationDraft, 'postings'>): TreasuryCashDeltas {
    const deltas = ZERO_DELTAS();
    for (const row of draft.postings) {
        const wallet = row.account === 'asset.cash.caisse'
            ? 'Caisse'
            : row.account === 'asset.cash.baridimob'
                ? 'BaridiMob'
                : null;
        if (!wallet) continue;
        const amount = toCents(row.amountDzd);
        deltas[wallet] += row.side === 'debit' ? amount : -amount;
    }
    return {
        Caisse: fromCents(deltas.Caisse),
        BaridiMob: fromCents(deltas.BaridiMob),
    };
}

/**
 * Pure Legacy-versus-V2 comparison. The caller may safely discard the result:
 * this function never throws for a mismatch and cannot affect a Legacy write.
 */
export function compareTreasuryShadow(intent: TreasuryShadowIntent, legacyRows: readonly LegacyTreasuryShadowRow[]): TreasuryShadowResult {
    const draft = buildTreasuryShadowDraft(intent);
    const legacyCashDeltas = getLegacyTreasuryCashDeltas(legacyRows);
    const ledgerCashDeltas = getLedgerTreasuryCashDeltas(draft);
    const integrityErrors = validateAccountingOperation(draft);
    const mismatches: string[] = [];
    (['Caisse', 'BaridiMob'] as const).forEach((wallet) => {
        if (toCents(legacyCashDeltas[wallet]) !== toCents(ledgerCashDeltas[wallet])) {
            mismatches.push(`${wallet}: Legacy ${legacyCashDeltas[wallet]} DZD != V2 ${ledgerCashDeltas[wallet]} DZD.`);
        }
    });
    if (integrityErrors.length > 0) mismatches.push(...integrityErrors);
    return {
        intent,
        draft,
        legacyCashDeltas,
        ledgerCashDeltas,
        integrityErrors,
        mismatches,
        matches: mismatches.length === 0,
    };
}
