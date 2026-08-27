import { db } from '../firebase';
import { OPERATOR_UID, ORDER_SYSTEM_CONFIGURED } from '../config/orderSystem';
import { quoteSale, type PricingContext } from '../services/smartPricingEngine';
import type { PoCurrency, PoPricingTier } from '../types';

export type GeneratedTier = { minQty: number; maxQty: number; unitPriceDzd: number };
export type BridgeFailReason = 'not_configured' | 'no_usdt_currency' | 'no_plan';
export type BridgeResult = { ok: boolean; tiers: GeneratedTier[]; deactivated: number; reason?: BridgeFailReason };

const fail = (reason: BridgeFailReason): BridgeResult => ({ ok: false, tiers: [], deactivated: 0, reason });

function buildBrackets(minOrder: number, maxOrder: number) {
    const lo = Math.max(1, Math.round(minOrder || 1));
    const hi = Math.max(lo, Math.round(maxOrder || 10_000));
    return [
        [lo, 99],
        [Math.max(100, lo), Math.min(500, hi)],
        [Math.max(501, lo), hi],
    ]
        .filter(([start, end]) => start <= end && start <= hi)
        .map(([start, end]) => ({ minQty: start, maxQty: Math.min(end, hi) }));
}

/**
 * Publishes anonymous, cash TARGET quotes from the canonical policy. Client
 * identity, score, daily overrides, learned opening buffer and actual prices
 * never leave the operator-only area.
 */
export async function generatePortalTiersFromPricing(
    context: PricingContext,
    actorUid: string,
): Promise<BridgeResult> {
    if (!ORDER_SYSTEM_CONFIGURED) return fail('not_configured');
    if (context.currency !== 'USDT' || context.pam <= 0) return fail('no_plan');

    const currencySnap = await db.collection('po_currencies').where('code', '==', 'USDT').get();
    const usdt = currencySnap.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() } as PoCurrency))
        .find((currency: PoCurrency) => currency.active) ?? null;
    if (!usdt) return fail('no_usdt_currency');

    const brackets = buildBrackets(usdt.minOrder, usdt.maxOrder);
    const tiers: GeneratedTier[] = brackets.map(({ minQty, maxQty }) => ({
        minQty,
        maxQty,
        unitPriceDzd: quoteSale(context, {
            currency: 'USDT',
            clientId: null,
            quantity: minQty,
            payment: { kind: 'cash' },
        }).corridor.targetPrice,
    }));

    const existingSnap = await db.collection('po_pricing_tiers').where('currencyId', '==', usdt.id).get();
    const existingActive = existingSnap.docs.filter((doc: any) => (doc.data() as PoPricingTier).active !== false);
    const batch = db.batch();
    existingActive.forEach((doc: any) => batch.update(db.collection('po_pricing_tiers').doc(doc.id), { active: false }));
    const publishedAt = Date.now();
    tiers.forEach((tier) => batch.set(db.collection('po_pricing_tiers').doc(), {
        currencyId: usdt.id,
        ...tier,
        requiresAdminApproval: false,
        active: true,
        operatorUid: OPERATOR_UID,
        pricingModelVersion: context.policy.modelVersion,
        pricingConfigRevision: context.policy.revision,
        pricingPlanRevision: context.plan.revision,
        publishedAt,
        publishedBy: actorUid,
    }));
    batch.set(db.collection('po_audit_logs').doc(), {
        action: 'catalog_generated',
        actorUid,
        targetType: 'catalog',
        targetId: usdt.id,
        createdAt: publishedAt,
        detailsJson: JSON.stringify({
            policyVersion: context.policy.modelVersion,
            configRevision: context.policy.revision,
            planRevision: context.plan.revision,
            source: 'canonical_cash_target',
            tiers,
        }),
    });
    await batch.commit();
    return { ok: true, tiers, deactivated: existingActive.length };
}

