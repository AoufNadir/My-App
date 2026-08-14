import { useMemo, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { MoneyField } from '../ui/MoneyField';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { Badge } from '../ui/Badge';
import { db, FirestoreDocumentReference } from '../../firebase';
import { now, parseAndEvaluate } from '../../utils';
import { buildProfitDistributionPlan } from '../../utils/profitDistribution';
import type { Investor } from '../../types';

type ActiveInvestor = Investor & { isManager?: boolean };

type Props = {
    isOpen: boolean;
    onClose: () => void;
    investors: ActiveInvestor[];
    suggestedTotal: number;
    userDocRef: FirestoreDocumentReference;
    setAlert: (msg: string) => void;
    treasuryStats: { caisse: number; baridi: number };
};

export function ProfitDistributionSheet({ isOpen, onClose, investors, suggestedTotal, userDocRef, setAlert, treasuryStats }: Props) {
    const [totalInput, setTotalInput] = useState('');
    const [paymentSource, setPaymentSource] = useState<'Caisse' | 'BaridiMob'>('Caisse');
    const [isSaving, setIsSaving] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    const parsedTotalInput = parseAndEvaluate(totalInput);
    const totalAmount = totalInput.trim()
        ? (Number.isFinite(parsedTotalInput) ? parsedTotalInput : 0)
        : suggestedTotal;

    const distribution = useMemo(() =>
        buildProfitDistributionPlan(investors, totalAmount),
        [investors, totalAmount]
    );

    const totalDistributed = distribution.reduce((s, d) => s + d.amount, 0);
    const hasExceedingRow = distribution.some(d => d.exceedsAvailable);
    const sourceBalance = paymentSource === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
    const exceedsCash = totalDistributed > sourceBalance + 0.005;
    const canConfirm = distribution.length > 0 && totalDistributed > 0 && !hasExceedingRow && !exceedsCash;

    const handleConfirm = async () => {
        if (!canConfirm) return;
        setIsSaving(true);
        try {
            const { timestamp, date, time } = now();
            const batch = db.batch();
            for (const { inv, amount } of distribution) {
                if (amount <= 0) continue;
                const investorTxRef = userDocRef.collection('investor_transactions').doc();
                const treasuryTxRef = userDocRef.collection('treasury_txs').doc();
                batch.set(investorTxRef, {
                    investorId: inv.id,
                    type: 'withdraw_profit',
                    amount,
                    paymentSource,
                    linkedTreasuryTxId: treasuryTxRef.id,
                    date,
                    time,
                    timestamp,
                    notes: `Distribution groupée — ${date}`,
                });
                batch.set(treasuryTxRef, {
                    timestamp,
                    date,
                    time,
                    type: 'Retrait',
                    source: paymentSource,
                    amount,
                    notes: `Retrait profit investisseur: ${inv.name} (distribution groupée)`,
                    linkedInvestorTxId: investorTxRef.id,
                    origin: 'investor_profit_withdrawal'
                });
            }
            await batch.commit();
            setAlert(`✅ Distribution enregistrée — ${distribution.length} investisseur${distribution.length > 1 ? 's' : ''} · ${totalDistributed.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DZD depuis ${paymentSource}`);
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

                <div>
                    <MoneyField
                        label="Montant total à distribuer"
                        value={totalInput}
                        onChange={setTotalInput}
                        currency="DZD"
                        placeholder={suggestedTotal > 0 ? String(Math.round(suggestedTotal)) : '0'}
                        hint={suggestedTotal > 0
                            ? `Profit disponible à retirer : ${suggestedTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DZD`
                            : 'Entrez le montant à distribuer'}
                    />
                    {!totalInput && suggestedTotal > 0 && (
                        <button
                            type="button"
                            onClick={() => setTotalInput(String(Math.round(suggestedTotal)))}
                            className="mt-1 text-xs font-semibold text-primary hover:underline"
                        >
                            Utiliser le profit disponible →
                        </button>
                    )}
                </div>

                <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Source de paiement</p>
                    <div className="grid grid-cols-2 gap-2">
                        {(['Caisse', 'BaridiMob'] as const).map(src => (
                            <button
                                key={src}
                                type="button"
                                onClick={() => setPaymentSource(src)}
                                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${paymentSource === src ? 'border-primary bg-primary/10 text-primary' : 'border-border text-neutral-500'}`}
                            >
                                <span className="block">{src}</span>
                                <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                                    {(src === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DZD
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {totalAmount > 0 && distribution.length > 0 && (
                    <div className="rounded-xl border border-border overflow-hidden">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 bg-surface-muted px-4 py-2 text-xs font-bold uppercase text-neutral-500 tracking-wide">
                            <span>Investisseur</span>
                            <span className="text-end">Part</span>
                            <span className="text-end w-28">Montant</span>
                        </div>
                        <div className="divide-y divide-neutral-100">
                            {distribution.map(({ inv, normalizedShare, amount, availableProfit, exceedsAvailable }) => (
                                <div key={inv.id} className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 ${exceedsAvailable ? 'bg-danger/5' : ''}`}>
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            <p className="break-words text-sm font-semibold">{inv.name}</p>
                                            {inv.isManager && <Badge variant="warning" size="sm">Gérant</Badge>}
                                        </div>
                                        <p className={`text-xs ${exceedsAvailable ? 'text-danger font-semibold' : 'text-neutral-500'}`}>
                                            Disponible : {availableProfit.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DZD
                                            {exceedsAvailable && ' · dépassé'}
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold text-neutral-500 tabular-nums">
                                        {(normalizedShare * 100).toFixed(1)}%
                                    </span>
                                    <div className="text-end w-28">
                                        <CurrencyAmount value={amount} currency="DZD" semantic={exceedsAvailable ? 'loss' : 'profit'} size="md" decimals={0}/>
                                    </div>
                                </div>
                            ))}
                        </div>
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

                {(hasExceedingRow || exceedsCash) && distribution.length > 0 && (
                    <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger font-medium">
                        {hasExceedingRow && <p>⚠️ Une ou plusieurs lignes dépassent le profit disponible.</p>}
                        {exceedsCash && <p>⚠️ Solde {paymentSource} insuffisant ({sourceBalance.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DZD).</p>}
                    </div>
                )}

                {distribution.length > 0 && totalDistributed > 0 && (
                    !confirmed ? (
                        <Button
                            type="button"
                            onClick={() => setConfirmed(true)}
                            disabled={!canConfirm}
                            className="w-full font-bold gap-2"
                        >
                            Confirmer la distribution
                        </Button>
                    ) : (
                        <div className="space-y-2">
                            <div className="rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning font-medium text-center">
                                ⚠️ Cette action va créer {distribution.length} retrait{distribution.length > 1 ? 's' : ''} de profit + {distribution.length} mouvement{distribution.length > 1 ? 's' : ''} de trésorerie depuis {paymentSource}.
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button type="button" variant="outline" onClick={() => setConfirmed(false)} className="w-full">
                                    Annuler
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={isSaving || !canConfirm}
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
