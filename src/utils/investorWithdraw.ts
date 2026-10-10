import { floorM } from './money';

/**
 * What the « max » button of the investor withdrawal window fills in: the smaller of what the
 * investor is owed (available profit, or invested capital) and what the chosen box (Caisse or
 * BaridiMob) holds, rounded down to the cent so it never exceeds either. Nothing is saved from here.
 */
export type InvestorWithdrawLimit = {
    /** Amount the button writes; 0 when nothing can be withdrawn (the button is then disabled) */
    max: number;
    /** The box holds less than the investor is owed, so the button stops at the box */
    limitedBySource: boolean;
};

export function investorWithdrawLimit(input: { entitlement: number; sourceBalance: number }): InvestorWithdrawLimit {
    const entitlement = Number.isFinite(input.entitlement) ? input.entitlement : 0;
    const sourceBalance = Number.isFinite(input.sourceBalance) ? input.sourceBalance : 0;
    return {
        max: floorM(Math.min(entitlement, sourceBalance)),
        limitedBySource: sourceBalance < entitlement,
    };
}
