// Stock added with "Ajout Manuel" and no price carries no purchase cost. When the
// only stock left is such stock, the PAM is 0 and the PAM ledger books the whole
// sale as profit, which is then shared with the investors. A new sell is refused
// in that case. (When some stock has a cost, the ledger prices every sold unit at
// that PAM, so no free profit appears.)
const QUANTITY_TOLERANCE = 0.005;

export const UNCOSTED_STOCK_MESSAGE = "Stock sans prix d'achat : faites un Retrait Manuel de ce stock, puis un Ajout Manuel avec son prix";

export function sellHasNoPurchaseCost(input: {
    quantity: number;
    /** Stock that has a purchase cost (PAM ledger `purchasedQty`). */
    costedQuantity: number;
    /** Recorded sells stay editable: the check applies to new sells only. */
    isEdit?: boolean;
}): boolean {
    if (input.isEdit)
        return false;
    const quantity = Number(input.quantity) || 0;
    if (quantity <= 0)
        return false;
    return (Number(input.costedQuantity) || 0) <= QUANTITY_TOLERANCE;
}
