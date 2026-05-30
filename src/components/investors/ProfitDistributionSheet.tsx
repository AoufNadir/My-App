import { useMemo, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { MoneyField } from '../ui/MoneyField';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { db, FirestoreDocumentReference } from '../../firebase';
import { now, parseAndEvaluate } from '../../utils';
import type { Investor } from '../../types';

type ActiveInvestor = Investor & { isManager?: boolean };

type Props = {
    isOpen: boolean;
    onClose: () => void;
    investors: ActiveInvestor[];
    suggestedTotal: number;   // netDistributableProfit from economics
    userDocRef: FirestoreDocumentReference;
    setAlert: (msg: string) => void;
};

export function ProfitDistributionSheet({ isOpen, onClose, investors, suggestedTotal, userDocRef, setAlert }: Props) {
    const [totalInput, setTotalInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    const activeNonManagers = useMemo(
        () => investors.filter(inv => inv.isActive && !inv.isManager),
        [investors]
    );
    const totalSharePct = useMemo(
        () => activeNonManagers.reduce((s, inv) => s + Number(inv.sharePercentage || 0), 0),
        [activeNonManagers]
    );

    const totalAmount = parseAndEvaluate(totalInput) || suggestedTotal;

    const distribution = useMemo(() =>
        activeNonManagers.map(inv => {
            const share = Number(inv.sharePercentage || 0);
            // Normalize relative to non-manager share pool
            const normalizedShare = totalSharePct > 0 ? share / totalSharePct : 0;
            const amount = Math.round(totalAmount * normalizedShare);
            return { inv, share, normalizedShare, amount };
        }).filter(d => d.amount > 0),
        [activeNonManagers, totalAmount, totalSharePct]
    );

    const totalDistributed = distribution.reduce((s, d) => s + d.amount, 0);

    const handleConfirm = async () => {
        if (distribution.length === 0 || totalDistributed <= 0) return;
        setIsSaving(true);
        try {
            const { timestamp, date, time } = now();
            const batch = db.batch();
            for (const { inv, amount } of distribution) {
                if (amount <= 0) continue;
                const txRef = userDocRef.collection('investor_transactions').doc();
                batch.set(txRef, {
                    investorId: inv.id,
                    type: 'profit_distribution',
                    amount,
                    date,
                    time,
                    timestamp,
                    notes: `Distribution groupée — ${date}`,
                });
            }
            await batch.commit();
            setAlert(`✅ Distribution enregistrée — ${distribution.length} investisseur${distribution.length > 1 ? 's' : ''} · ${totalDistributed.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DZD`);
            setConfirmed(false);
            setTotalInput('');
            onClose();
        } catch (e: any) {
            setAlert(`❌ Erreur: ${e.message || 'inconnue'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const resetAndClose = () => {
        setConfirmed(false);
        setTotalInput('');
        onClose();
    };

    return (
        <BottomSheet isOpen={isOpen} onClose={resetAndClose} title="Plan de distribution">
            <div className="px-4 pb-6 space-y-5">

                {/* Total amount to distribute */}
                <div>
                    <MoneyField
                        label="Montant total à distribuer (DZD)"
                        value={totalInput}
                        onChange={setTotalInput}
                        currency="DZD"
                        placeholder={suggestedTotal > 0 ? String(Math.round(suggestedTotal)) : '0'}
                        hint={suggestedTotal > 0
                            ? `Profit net disponible : ${suggestedTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DZD`
                            : 'Entrez le montant à distribuer'}
                    />
                    {!totalInput && suggestedTotal > 0 && (
                        <button
                            type="button"
                            onClick={() => setTotalInput(String(Math.round(suggestedTotal)))}
                            className="mt-1 text-xs font-semibold text-primary hover:underline"
                        >
                            Utiliser le profit net disponible →
                        </button>
                    )}
                </div>

                {/* Distribution table */}
                {totalAmount > 0 && distribution.length > 0 && (
                    <div className="rounded-xl border border-border overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-surface-muted px-4 py-2 text-[10px] font-bold uppercase text-neutral-400 tracking-wide">
                            <span>Investisseur</span>
                            <span className="text-right">Part</span>
                            <span className="text-right w-28">Montant</span>
                        </div>
                        {/* Rows */}
                        <div className="divide-y divide-neutral-100">
                            {distribution.map(({ inv, normalizedShare, amount }) => (
                                <div key={inv.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold truncate">{inv.name}</p>
                                        <p className="text-[10px] text-neutral-400">
                                            Disponible actuel : {Number(inv.availableProfit || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DZD
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold text-neutral-500 tabular-nums">
                                        {(normalizedShare * 100).toFixed(1)}%
                                    </span>
                                    <div className="text-right w-28">
                                        <CurrencyAmount value={amount} currency="DZD" semantic="profit" size="md" decimals={0}/>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Total */}
                        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-muted px-4 py-3">
                            <span className="text-sm font-bold text-neutral-700">Total distribué</span>
                            <CurrencyAmount value={totalDistributed} currency="DZD" semantic="profit" size="lg" decimals={0}/>
                        </div>
                    </div>
                )}

                {distribution.length === 0 && totalAmount > 0 && (
                    <p className="text-sm text-center text-neutral-400">
                        Aucun investisseur actif à distribuer.
                    </p>
                )}

                {/* Action buttons */}
                {distribution.length > 0 && totalDistributed > 0 && (
                    !confirmed ? (
                        <Button
                            type="button"
                            onClick={() => setConfirmed(true)}
                            className="w-full font-bold gap-2"
                        >
                            Confirmer la distribution
                        </Button>
                    ) : (
                        <div className="space-y-2">
                            <div className="rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning font-medium text-center">
                                ⚠️ Cette action va créer {distribution.length} transaction{distribution.length > 1 ? 's' : ''} et ne peut pas être annulée facilement.
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button type="button" variant="outline" onClick={() => setConfirmed(false)} className="w-full">
                                    Annuler
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={isSaving}
                                    className="w-full font-bold bg-financial-profit text-white hover:bg-financial-profit/90"
                                >
                                    {isSaving ? 'Enregistrement…' : '✓ Confirmer'}
                                </Button>
                            </div>
                        </div>
                    )
                )}
            </div>
        </BottomSheet>
    );
}
