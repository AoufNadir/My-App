import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { NumberInput } from '../ui/NumberInput';
import { Select } from '../ui/Select';
import { MoneyField } from '../ui/MoneyField';
import { TransactionPreviewCard, type PreviewRow } from '../ui/TransactionPreviewCard';
import { parseAndEvaluate } from '../../utils';
import { formatMoney } from '../../pages/shared/pageFormat';
type MainInvestorDialogsProps = Record<string, any>;
export function MainInvestorDialogs({ isInvestorModalOpen, setIsInvestorModalOpen, editingInvestor, handleSaveInvestor, investorName, setInvestorName, fieldBase, investorInitialCapital, setInvestorInitialCapital, investorInitialCapitalSource, setInvestorInitialCapitalSource, investorNotes, setInvestorNotes, isManager, setIsManager, derivedInvestors, selectedInvestorId, isInvestorTxModalOpen, setIsInvestorTxModalOpen, investorTxType, investorTxAmount, setInvestorTxAmount, investorTxPaymentSource, setInvestorTxPaymentSource, treasuryStats, investorTxNotes, setInvestorTxNotes, handleInvestorTransaction, t, investorToDelete, setInvestorToDelete, handleDeleteInvestor, investorTxToDelete, setInvestorTxToDelete, handleDeleteInvestorTx, isReinvestModalOpen, setIsReinvestModalOpen, reinvestInput, setReinvestInput, handleReinvestProfit, setAlert }: MainInvestorDialogsProps) {
    const headerClass = 'sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5';
    const footerClass = 'sticky bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5';
    const cancelBtn = 'flex-1 rounded-xl bg-neutral-100 py-3 font-bold text-neutral-700 transition-colors hover:bg-neutral-200';
    const primaryBtn = 'flex-1 rounded-xl bg-primary py-3 font-bold text-white shadow-sm transition-colors hover:bg-primary-dark';
    const dangerBtn = 'flex-1 rounded-xl bg-danger py-3 font-bold text-white shadow-sm transition-colors hover:bg-danger-light';
    return (<>
            {/* INVESTOR CREATION / EDIT MODAL */}
            <Modal isOpen={isInvestorModalOpen} onClose={() => setIsInvestorModalOpen(false)} className="max-w-md bg-surface">
                <ModalHeader onClose={() => setIsInvestorModalOpen(false)} className={headerClass}>
                    <ModalTitle className="text-base sm:text-lg">{editingInvestor ? "Modifier Investisseur" : "Nouvel Investisseur"}</ModalTitle>
                </ModalHeader>
                <form onSubmit={(e) => {
            e.preventDefault();
            handleSaveInvestor();
        }}>
                    <ModalContent className="px-4 py-4 sm:px-5 space-y-3">
                        <div>
                            <Label>Nom Complet</Label>
                            <Input value={investorName} onChange={e => setInvestorName(e.target.value)} className="mt-1" placeholder="Nom de l'investisseur" required/>
                        </div>
                        {!editingInvestor && (<div>
                                <Label>Capital Initial (DZD)</Label>
                                <NumberInput value={investorInitialCapital} onChange={e => setInvestorInitialCapital(e.target.value)} className="mt-1" placeholder="0.00"/>
                            </div>)}

                        {!editingInvestor && parseAndEvaluate(investorInitialCapital) > 0 && (
                            <div>
                                <Label>Source du capital</Label>
                                <div className="mt-1 grid grid-cols-3 gap-2">
                                    {([
                                        { v: 'none', label: 'Solde d’ouverture' },
                                        { v: 'Caisse', label: 'Caisse' },
                                        { v: 'BaridiMob', label: 'BaridiMob' }
                                    ] as const).map(opt => (
                                        <button
                                            key={opt.v}
                                            type="button"
                                            onClick={() => setInvestorInitialCapitalSource(opt.v)}
                                            className={`rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${investorInitialCapitalSource === opt.v ? 'border-primary bg-primary/10 text-primary' : 'border-border text-neutral-500'}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-1 text-[10px] text-neutral-400">
                                    {investorInitialCapitalSource === 'none'
                                        ? 'Aucun cash ajouté — le capital est traité comme un solde d’ouverture.'
                                        : `Le capital sera ajouté à ${investorInitialCapitalSource}.`}
                                </p>
                            </div>
                        )}

                        <div>
                            <Label>Notes</Label>
                            <Input value={investorNotes} onChange={e => setInvestorNotes(e.target.value)} className="mt-1" placeholder="Notes optionnelles..."/>
                        </div>

                        <label htmlFor="isManager" className="mt-2 flex min-h-touch cursor-pointer items-center gap-3 rounded-xl bg-surface-muted p-3 transition-colors hover:bg-neutral-100">
                            <input type="checkbox" id="isManager" checked={isManager} onChange={e => setIsManager(e.target.checked)} className="h-5 w-5 rounded accent-primary"/>
                            <span className="text-sm font-medium select-none">
                                Cet investisseur est le Gérant 👑
                            </span>
                        </label>
                    </ModalContent>
                    <ModalFooter className={footerClass}>
                        <div className="flex gap-2 w-full">
                            <Button type="button" onClick={() => setIsInvestorModalOpen(false)} className={cancelBtn}>
                                Annuler
                            </Button>
                            <Button type="submit" className={primaryBtn}>
                                {editingInvestor ? "Mettre à jour" : "Créer"}
                            </Button>
                        </div>
                    </ModalFooter>
                </form>
            </Modal>

            {/* INVESTOR TRANSACTION MODAL */}
            {(() => {
            const selectedInv = derivedInvestors.find(i => i.id === selectedInvestorId);
            const amt = parseAndEvaluate(investorTxAmount);
            const validAmount = Number.isFinite(amt) && amt > 0;
            const availableProfit = selectedInv?.availableProfit || 0;
            const capitalInvested = selectedInv?.capitalInvested || 0;
            const paymentSource = investorTxPaymentSource || 'Caisse';
            const paymentSourceBalance = paymentSource === 'Caisse'
                ? Number(treasuryStats?.caisse || 0)
                : Number(treasuryStats?.baridi || 0);
            let cap = 0;
            let capLabel = '';
            let nextLabel = '';
            let nextValue = 0;
            let exceedsCap = false;
            let exceedsPaymentSource = false;
            let titleStr = '';
            if (investorTxType === 'withdraw_profit') {
                cap = availableProfit;
                capLabel = 'Profit disponible';
                nextLabel = 'Profit apres retrait';
                nextValue = availableProfit - amt;
                exceedsCap = amt > availableProfit;
                exceedsPaymentSource = amt > paymentSourceBalance;
                titleStr = 'Retrait Profit';
            }
            else if (investorTxType === 'withdraw_capital') {
                cap = capitalInvested;
                capLabel = 'Capital investi';
                nextLabel = 'Capital apres retrait';
                nextValue = capitalInvested - amt;
                exceedsCap = amt > capitalInvested;
                exceedsPaymentSource = amt > paymentSourceBalance;
                titleStr = 'Retrait Capital';
            }
            else if (investorTxType === 'deposit_capital') {
                capLabel = 'Capital actuel';
                cap = capitalInvested;
                nextLabel = 'Capital apres depot';
                nextValue = capitalInvested + amt;
                titleStr = 'Depot Capital';
            }
            else {
                capLabel = 'Profit actuel';
                cap = availableProfit;
                nextLabel = 'Profit apres distribution';
                nextValue = availableProfit + amt;
                titleStr = 'Distribution Profit';
            }
            const isInvalid = !validAmount || exceedsCap || exceedsPaymentSource;
            const errorMsg = !validAmount
                ? 'Montant invalide'
                : exceedsCap
                    ? `Montant superieur a ${capLabel.toLowerCase()}`
                    : exceedsPaymentSource
                        ? `Solde ${paymentSource} insuffisant`
                        : '';
            return (<Modal isOpen={isInvestorTxModalOpen} onClose={() => setIsInvestorTxModalOpen(false)} className="max-w-md bg-surface">
                        <ModalHeader onClose={() => setIsInvestorTxModalOpen(false)} className={headerClass}>
                            <ModalTitle className="text-base sm:text-lg">{titleStr}</ModalTitle>
                        </ModalHeader>
                        <ModalContent className="px-4 py-4 sm:px-5 space-y-3">
                            <MoneyField label="Montant" value={investorTxAmount} onChange={setInvestorTxAmount} currency="DZD" placeholder="0.00" error={errorMsg && validAmount ? errorMsg : undefined}/>

                            {investorTxType === 'withdraw_profit' && (<div>
                                    <Label>Source du paiement</Label>
                                    <Select value={paymentSource} onChange={(event) => setInvestorTxPaymentSource(event.target.value as 'Caisse' | 'BaridiMob')} className="mt-1">
                                        <option value="Caisse">Caisse</option>
                                        <option value="BaridiMob">BaridiMob</option>
                                    </Select>
                                    <p className="mt-1 text-xs text-neutral-500">
                                        Solde disponible: <span dir="ltr">{formatMoney(paymentSourceBalance, 'DZD')}</span>
                                    </p>
                                </div>)}

                            {investorTxType === 'deposit_capital' && (<div>
                                    <Label>Destination de l'apport</Label>
                                    <Select value={paymentSource} onChange={(event) => setInvestorTxPaymentSource(event.target.value as 'Caisse' | 'BaridiMob')} className="mt-1">
                                        <option value="Caisse">Caisse</option>
                                        <option value="BaridiMob">BaridiMob</option>
                                    </Select>
                                    <p className="mt-1 text-xs text-neutral-500">
                                        Solde actuel: <span dir="ltr">{formatMoney(paymentSourceBalance, 'DZD')}</span>
                                    </p>
                                </div>)}

                            {investorTxType === 'withdraw_capital' && (<div>
                                    <Label>Source du retrait</Label>
                                    <Select value={paymentSource} onChange={(event) => setInvestorTxPaymentSource(event.target.value as 'Caisse' | 'BaridiMob')} className="mt-1">
                                        <option value="Caisse">Caisse</option>
                                        <option value="BaridiMob">BaridiMob</option>
                                    </Select>
                                    <p className="mt-1 text-xs text-neutral-500">
                                        Solde disponible: <span dir="ltr">{formatMoney(paymentSourceBalance, 'DZD')}</span>
                                    </p>
                                </div>)}

                            {validAmount && selectedInv && (() => {
                    const rows: PreviewRow[] = [
                        { label: capLabel, value: cap, currency: 'DZD' },
                        { label: 'Montant', value: amt, currency: 'DZD' },
                        { label: nextLabel, value: nextValue, currency: 'DZD', semantic: 'auto', emphasize: true }
                    ];
                    if (investorTxType === 'withdraw_profit') {
                        rows.push({
                            label: `${paymentSource} apres paiement`,
                            value: paymentSourceBalance - amt,
                            currency: 'DZD',
                            semantic: 'auto'
                        });
                    }
                    if (investorTxType === 'deposit_capital') {
                        rows.push({
                            label: `${paymentSource} apres depot`,
                            value: paymentSourceBalance + amt,
                            currency: 'DZD',
                            semantic: 'auto'
                        });
                    }
                    if (investorTxType === 'withdraw_capital') {
                        rows.push({
                            label: `${paymentSource} apres retrait`,
                            value: paymentSourceBalance - amt,
                            currency: 'DZD',
                            semantic: 'auto'
                        });
                    }
                    return (<TransactionPreviewCard title="Résumé" rows={rows} error={(exceedsCap || exceedsPaymentSource) ? errorMsg : undefined}/>);
                })()}
                        </ModalContent>
                        <ModalFooter className={footerClass}>
                            <div className="flex gap-2 w-full">
                                <Button onClick={() => setIsInvestorTxModalOpen(false)} className={cancelBtn}>
                                    Annuler
                                </Button>
                                <Button onClick={handleInvestorTransaction} disabled={isInvalid} className={`flex-1 rounded-xl py-3 font-bold text-white shadow-sm transition-colors ${isInvalid ? 'cursor-not-allowed bg-neutral-400 opacity-70' : 'bg-primary hover:bg-primary-dark'}`} title={isInvalid ? errorMsg : undefined}>
                                    Confirmer
                                </Button>
                            </div>
                        </ModalFooter>
                    </Modal>);
        })()}

            {/* INVESTOR DELETE CONFIRMATION */}
            <Modal isOpen={investorToDelete !== null} onClose={() => setInvestorToDelete(null)} className="max-w-sm bg-surface">
                <ModalHeader onClose={() => setInvestorToDelete(null)} className={headerClass}>
                    <ModalTitle className="text-base sm:text-lg">{t('common.confirmDelete')}</ModalTitle>
                </ModalHeader>
                <ModalContent className="px-4 py-4 sm:px-5">
                    <p className="text-sm text-neutral-700">Êtes-vous sûr de vouloir supprimer cet investisseur ?</p>
                    <p className="text-xs text-danger font-medium mt-2">Cette action est irréversible.</p>
                </ModalContent>
                <ModalFooter className={footerClass}>
                    <div className="flex gap-2 w-full">
                        <Button onClick={() => setInvestorToDelete(null)} className={cancelBtn}>{t('common.cancel')}</Button>
                        <Button onClick={() => handleDeleteInvestor(investorToDelete?.id)} className={dangerBtn}>{t('common.delete')}</Button>
                    </div>
                </ModalFooter>
            </Modal>

            {/* INVESTOR TRANSACTION DELETE CONFIRMATION */}
            <Modal isOpen={investorTxToDelete !== null} onClose={() => setInvestorTxToDelete(null)} className="max-w-sm bg-surface">
                <ModalHeader onClose={() => setInvestorTxToDelete(null)} className={headerClass}>
                    <ModalTitle className="text-base sm:text-lg">{t('common.confirmDelete')}</ModalTitle>
                </ModalHeader>
                <ModalContent className="px-4 py-4 sm:px-5">
                    <p className="text-sm text-neutral-700">Êtes-vous sûr de vouloir supprimer cette transaction ?</p>
                </ModalContent>
                <ModalFooter className={footerClass}>
                    <div className="flex gap-2 w-full">
                        <Button onClick={() => setInvestorTxToDelete(null)} className={cancelBtn}>{t('common.cancel')}</Button>
                        <Button onClick={handleDeleteInvestorTx} className={dangerBtn}>{t('common.delete')}</Button>
                    </div>
                </ModalFooter>
            </Modal>

            {/* REINVEST PROFIT MODAL */}
            {isReinvestModalOpen && (() => {
            const selectedInv = derivedInvestors.find(i => i.id === selectedInvestorId);
            const availableProfit = selectedInv?.availableProfit || 0;
            const capitalInvested = selectedInv?.capitalInvested || 0;
            const reinvestAmt = parseAndEvaluate(reinvestInput);
            const validAmount = Number.isFinite(reinvestAmt) && reinvestAmt > 0;
            const exceedsAvailable = reinvestAmt > availableProfit;
            const isInvalid = !validAmount || exceedsAvailable;
            const errorMsg = !validAmount
                ? 'Montant invalide'
                : exceedsAvailable
                    ? 'Montant superieur au profit disponible'
                    : '';
            return (<Modal isOpen={isReinvestModalOpen} onClose={() => setIsReinvestModalOpen(false)} className="max-w-md bg-surface">
                    <ModalHeader onClose={() => setIsReinvestModalOpen(false)} className={headerClass}>
                        <ModalTitle className="text-base sm:text-lg">Réinvestir les bénéfices</ModalTitle>
                    </ModalHeader>
                    <ModalContent className="px-4 py-4 sm:px-5 space-y-3">
                        <MoneyField label="Montant à réinvestir" value={reinvestInput} onChange={setReinvestInput} currency="DZD" placeholder="0.00" hint={<>Disponible: <span dir="ltr">{formatMoney(availableProfit, 'DZD')}</span></>} error={validAmount && exceedsAvailable ? errorMsg : undefined}/>
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setReinvestInput(availableProfit.toFixed(2))} className="min-h-touch rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15">
                                Tout Réinvestir
                            </button>
                            <button type="button" onClick={() => setReinvestInput((availableProfit / 2).toFixed(2))} className="min-h-touch rounded-lg bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200">
                                Moitié (50%)
                            </button>
                        </div>

                        {validAmount && selectedInv && (<TransactionPreviewCard title="Résumé" rows={[
                        { label: 'Profit disponible', value: availableProfit, currency: 'DZD' },
                        { label: 'Montant a reinvestir', value: reinvestAmt, currency: 'DZD' },
                        { label: 'Profit restant', value: availableProfit - reinvestAmt, currency: 'DZD', semantic: 'auto' },
                        { label: 'Nouveau capital', value: capitalInvested + reinvestAmt, currency: 'DZD', emphasize: true }
                    ]} error={exceedsAvailable ? errorMsg : undefined}/>)}
                    </ModalContent>
                    <ModalFooter className={footerClass}>
                        <div className="flex gap-2 w-full">
                            <Button onClick={() => setIsReinvestModalOpen(false)} className={cancelBtn}>Annuler</Button>
                            <Button onClick={() => {
                    if (isInvalid) {
                        setAlert(`⚠️ ${errorMsg}`);
                        return;
                    }
                    handleReinvestProfit(selectedInvestorId!, reinvestAmt);
                    setIsReinvestModalOpen(false);
                }} disabled={isInvalid} className={`flex-1 rounded-xl py-3 font-bold text-white shadow-sm transition-colors ${isInvalid ? 'cursor-not-allowed bg-neutral-400 opacity-70' : 'bg-primary hover:bg-primary-dark'}`} title={isInvalid ? errorMsg : undefined}>
                                Confirmer
                            </Button>
                        </div>
                    </ModalFooter>
                </Modal>);
        })()}
        </>);
}
