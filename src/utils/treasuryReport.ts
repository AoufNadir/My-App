// The treasury report's numbers (V3-6). They are the numbers of the old printed report
// (buildTreasuryPdf in pdfReports.ts); the sheet writes them in the report's language.

/** A cash movement as TresoreriePage's treasuryPdfRows gives it. */
export type TreasuryMovementInput = {
    date: string;
    time: string;
    type: string;
    source: string;
    amount: number;
    notes: string;
    origin?: string;
};

export type TreasuryDirection = 'in' | 'out' | 'neutral';

export type TreasuryReportRow = TreasuryMovementInput & {
    direction: TreasuryDirection;
};

export type TreasuryReport = {
    reference: string;
    issuedAt: number;
    caisse: number;
    baridi: number;
    totalIn: number;
    totalOut: number;
    /** What came in minus what went out over the listed movements */
    netFlow: number;
    movementCount: number;
    rows: TreasuryReportRow[];
};

export const isTreasuryIn = (type: string) => type === 'Ajout' || type === 'Adjustment (+)';
export const isTreasuryOut = (type: string) => type === 'Retrait' || type === 'Adjustment (-)';

const pad2 = (value: number) => String(value).padStart(2, '0');
const dayDashed = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

/** T-20261010: the day the report is made. */
export const treasuryReportReference = (issuedAt: number) => `T-${dayDashed(issuedAt).replace(/-/g, '')}`;

/** ProDigital_Tresorerie_2026-10-10.pdf */
export const treasuryReportFileName = (issuedAt: number) => `ProDigital_Tresorerie_${dayDashed(issuedAt)}.pdf`;

export function buildTreasuryReport(input: { rows: ReadonlyArray<TreasuryMovementInput>; balances: { caisse: number; baridi: number }; issuedAt: number }): TreasuryReport {
    const { rows, balances, issuedAt } = input;
    const totalIn = rows.reduce((sum, row) => (isTreasuryIn(row.type) ? sum + row.amount : sum), 0);
    const totalOut = rows.reduce((sum, row) => (isTreasuryOut(row.type) ? sum + row.amount : sum), 0);
    return {
        reference: treasuryReportReference(issuedAt),
        issuedAt,
        caisse: balances.caisse,
        baridi: balances.baridi,
        totalIn,
        totalOut,
        netFlow: totalIn - totalOut,
        movementCount: rows.length,
        // As the old report coloured them: in, a transfer between the two wallets (neutral), everything else out.
        rows: rows.map((row) => ({ ...row, direction: isTreasuryIn(row.type) ? 'in' : row.type === 'Transfer' ? 'neutral' : 'out' })),
    };
}
