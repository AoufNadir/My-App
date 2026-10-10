// The numbers of the three list reports (V3-7): the client list, the investor list and the
// operations log. They are the numbers of the old printed reports (buildClientListPdf,
// buildInvestorListPdf and buildTransactionListPdf in pdfReports.ts); the sheets write them in the
// report's language.

const pad2 = (value: number) => String(value).padStart(2, '0');
const dayDashed = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};
const dayCompact = (timestamp: number) => dayDashed(timestamp).replace(/-/g, '');

// ---------------------------------------------------------------------------------------
// The client list
// ---------------------------------------------------------------------------------------

/** A client as ClientsListView gives it: the name as the app writes it and the balance in dinars. */
export type ClientListInput = {
    name: string;
    phone?: string;
    email?: string;
    redotpay?: string;
    balance: number;
};

/** « debt »: the client owes us, « advance »: we owe the client, within a centime of zero it is « zero » */
export type ClientListSide = 'debt' | 'advance' | 'zero';

export type ClientListReport = {
    reference: string;
    issuedAt: number;
    clientCount: number;
    /** What the clients owe us, every balance below zero */
    totalDebt: number;
    /** What we owe the clients, every balance above zero */
    totalAdvance: number;
    debtCount: number;
    advanceCount: number;
    rows: Array<ClientListInput & { index: number; side: ClientListSide }>;
};

export const clientListSide = (balance: number): ClientListSide => (balance < -0.01 ? 'debt' : balance > 0.01 ? 'advance' : 'zero');

/** CL-20261010: the day the report is made. */
export const clientListReference = (issuedAt: number) => `CL-${dayCompact(issuedAt)}`;
/** ProDigital_Clients_2026-10-10.pdf */
export const clientListFileName = (issuedAt: number) => `ProDigital_Clients_${dayDashed(issuedAt)}.pdf`;

export function buildClientListReport(input: { rows: ReadonlyArray<ClientListInput>; issuedAt: number }): ClientListReport {
    const { rows, issuedAt } = input;
    return {
        reference: clientListReference(issuedAt),
        issuedAt,
        clientCount: rows.length,
        totalDebt: rows.reduce((sum, row) => (row.balance < 0 ? sum + Math.abs(row.balance) : sum), 0),
        totalAdvance: rows.reduce((sum, row) => (row.balance > 0 ? sum + row.balance : sum), 0),
        debtCount: rows.filter((row) => row.balance < -0.01).length,
        advanceCount: rows.filter((row) => row.balance > 0.01).length,
        rows: rows.map((row, index) => ({ ...row, index: index + 1, side: clientListSide(row.balance) })),
    };
}

// ---------------------------------------------------------------------------------------
// The investor list
// ---------------------------------------------------------------------------------------

/** An investor as InvestorsPage gives it (the manager's capital and profit already chosen as the page shows them). */
export type InvestorListInput = {
    name: string;
    isManager: boolean;
    isActive: boolean;
    capitalInvested: number;
    availableProfit: number;
    withdrawnProfit: number;
    totalProfit: number;
    roi: number | null;
    entryDate: string;
};

export type InvestorListReport = {
    reference: string;
    issuedAt: number;
    investorCount: number;
    /** Active investors other than the manager */
    activeCount: number;
    /** Their capital */
    totalCapital: number;
    /** Profit available to every investor but the manager */
    totalAvailable: number;
    /** Profit earned over time, the manager included */
    totalGain: number;
    rows: Array<InvestorListInput & { index: number }>;
};

/**
 * The day an investor entered, as the sheet writes it: 15/01/2025. The old page wrote what is
 * saved as it was, and the app saves a whole timestamp (« 2025-01-15T09:30:00.000Z »). A plain day
 * keeps its day, a timestamp is read in the local time zone as the investor page does, and a text
 * that is not a date is left as it is.
 */
export function investorEntryDay(entryDate: string): string {
    const raw = entryDate.trim();
    const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (plain)
        return `${plain[3]}/${plain[2]}/${plain[1]}`;
    const time = raw ? new Date(raw).getTime() : Number.NaN;
    if (Number.isNaN(time))
        return raw;
    const date = new Date(time);
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** IL-20261010 */
export const investorListReference = (issuedAt: number) => `IL-${dayCompact(issuedAt)}`;
/** ProDigital_Investisseurs_2026-10-10.pdf */
export const investorListFileName = (issuedAt: number) => `ProDigital_Investisseurs_${dayDashed(issuedAt)}.pdf`;

export function buildInvestorListReport(input: { rows: ReadonlyArray<InvestorListInput>; issuedAt: number }): InvestorListReport {
    const { rows, issuedAt } = input;
    const active = rows.filter((row) => row.isActive && !row.isManager);
    return {
        reference: investorListReference(issuedAt),
        issuedAt,
        investorCount: rows.length,
        activeCount: active.length,
        totalCapital: active.reduce((sum, row) => sum + row.capitalInvested, 0),
        totalAvailable: rows.filter((row) => !row.isManager).reduce((sum, row) => sum + row.availableProfit, 0),
        totalGain: rows.reduce((sum, row) => sum + row.totalProfit, 0),
        rows: rows.map((row, index) => ({ ...row, index: index + 1 })),
    };
}

// ---------------------------------------------------------------------------------------
// The operations log
// ---------------------------------------------------------------------------------------

export type TransactionCategory = 'portfolio' | 'client' | 'digital_service' | 'treasury';

/**
 * An operation as TransactionsPage lists it. « type » is the name the app shows (in the app's
 * language, it is built by the list's view model), the other texts are the data.
 */
export type TransactionListInput = {
    category: TransactionCategory;
    date: string;
    time: string;
    type: string;
    currency: string;
    /** Only for portfolio and digital-service rows */
    quantity: number | null;
    /** Only for portfolio rows */
    price: number | null;
    /** In dinars, rounded */
    totalDzd: number;
    client: string;
    notes: string;
    /** Raw tags: « credit » is written in the report's language */
    tags: string[];
    /** A portfolio operation is a purchase or a sale */
    side?: 'buy' | 'sell';
};

export type TransactionListReport = {
    reference: string;
    issuedAt: number;
    operationCount: number;
    /** Portfolio purchases and sales (USDT and EUR) */
    buyCount: number;
    sellCount: number;
    rows: TransactionListInput[];
};

/** LT-20261010 */
export const transactionListReference = (issuedAt: number) => `LT-${dayCompact(issuedAt)}`;
/** ProDigital_Operations_2026-10-10.pdf */
export const transactionListFileName = (issuedAt: number) => `ProDigital_Operations_${dayDashed(issuedAt)}.pdf`;

export function buildTransactionListReport(input: { rows: ReadonlyArray<TransactionListInput>; issuedAt: number }): TransactionListReport {
    const { rows, issuedAt } = input;
    const portfolio = rows.filter((row) => row.category === 'portfolio');
    return {
        reference: transactionListReference(issuedAt),
        issuedAt,
        operationCount: rows.length,
        buyCount: portfolio.filter((row) => row.side === 'buy').length,
        sellCount: portfolio.filter((row) => row.side === 'sell').length,
        rows: [...rows],
    };
}
