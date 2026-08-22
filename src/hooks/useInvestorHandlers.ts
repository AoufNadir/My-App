import { useMemo, useState } from 'react';
import { db, fieldValueDelete, type FirestoreDocumentReference } from '../firebase';
import { Investor, InvestorTransaction, PortfolioStats, TreasuryTx } from '../types';
import { now, parseAndEvaluate } from '../utils';
import { roundM } from '../utils/money';
import { evaluatePersonalAdvanceReconciliation } from '../utils/personalExpenses';
import {
    computeProjectExpensePreview,
    getWalletCurrency,
    isAssetWallet,
    isCashWallet,
    type FinancialWallet,
} from '../utils/digitalServiceAccounting';

type PersonalExpenseInvestorLink = {
    id: string;
    exists: boolean;
    amount: number;
};

type PersonalExpenseInvestorLinks = {
    profit: PersonalExpenseInvestorLink;
    capital: PersonalExpenseInvestorLink;
};

const emptyPersonalExpenseInvestorLink = (): PersonalExpenseInvestorLink => ({
    id: '',
    exists: false,
    amount: 0,
});

const emptyPersonalExpenseInvestorLinks = (): PersonalExpenseInvestorLinks => ({
    profit: emptyPersonalExpenseInvestorLink(),
    capital: emptyPersonalExpenseInvestorLink(),
});

export function useInvestorHandlers(userDocRef: FirestoreDocumentReference, derivedInvestors: any[], treasuryStats: {
    caisse: number;
    baridi: number;
}, portfolioStats: PortfolioStats, setAlert: (msg: string) => void) {
    const [isSaving, setIsSaving] = useState(false);
    // Modal & form state
    const [isInvestorModalOpen, setIsInvestorModalOpen] = useState(false);
    const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
    const [investorToDelete, setInvestorToDelete] = useState<Investor | null>(null);
    const [investorName, setInvestorName] = useState('');
    const [investorInitialCapital, setInvestorInitialCapital] = useState('0');
    const [investorNotes, setInvestorNotes] = useState('');
    const [isManager, setIsManager] = useState(false);
    const [investorEmail, setInvestorEmail] = useState('');
    const [investorPhone, setInvestorPhone] = useState('');
    // M3: payment source for the opening capital. 'none' keeps the legacy
    // behavior (treat as opening equity, no cash movement). Caisse/BaridiMob
    // adds a matching treasury_tx so totalCapital reflects the cash inflow.
    const [investorInitialCapitalSource, setInvestorInitialCapitalSource] = useState<'none' | 'Caisse' | 'BaridiMob'>('none');
    // Transaction state
    const [isInvestorTxModalOpen, setIsInvestorTxModalOpen] = useState(false);
    const [investorTxAmount, setInvestorTxAmount] = useState('');
    const [investorTxType, setInvestorTxType] = useState<'deposit_capital' | 'withdraw_profit' | 'withdraw_capital' | 'reinvest_profit'>('deposit_capital');
    const [investorTxNotes, setInvestorTxNotes] = useState('');
    const [investorTxPaymentSource, setInvestorTxPaymentSource] = useState<'Caisse' | 'BaridiMob'>('Caisse');
    const [investorTxToDelete, setInvestorTxToDelete] = useState<InvestorTransaction | null>(null);
    // Reinvest state
    const [isReinvestModalOpen, setIsReinvestModalOpen] = useState(false);
    const [reinvestInput, setReinvestInput] = useState('');
    const [selectedInvestorId, setSelectedInvestorId] = useState('');
    // Personal withdrawal state (manager only — daily personal expense)
    const [isPersonalWithdrawalModalOpen, setIsPersonalWithdrawalModalOpen] = useState(false);
    const [personalWithdrawalAmount, setPersonalWithdrawalAmount] = useState('');
    const [personalWithdrawalMethod, setPersonalWithdrawalMethod] = useState<FinancialWallet>('Caisse');
    const [personalWithdrawalDate, setPersonalWithdrawalDate] = useState<string>('');
    const [personalWithdrawalNote, setPersonalWithdrawalNote] = useState('');
    const [personalWithdrawalMode, setPersonalWithdrawalMode] = useState<'expense' | 'advance'>('expense');
    const [editingPersonalExpenseTx, setEditingPersonalExpenseTx] = useState<TreasuryTx | null>(null);
    const [personalExpenseToDelete, setPersonalExpenseToDelete] = useState<TreasuryTx | null>(null);
    const personalWithdrawalRates = useMemo(() => ({
        usdtPma: Number(portfolioStats.usdt.avgBuy || 0),
        eurPma: Number(portfolioStats.eur.avgBuy || 0),
    }), [portfolioStats.usdt.avgBuy, portfolioStats.eur.avgBuy]);
    const personalWithdrawalPreview = useMemo(() => {
        const amount = parseAndEvaluate(personalWithdrawalAmount);
        if (!Number.isFinite(amount)) return null;
        return computeProjectExpensePreview({
            wallet: personalWithdrawalMethod,
            amount,
            rates: personalWithdrawalRates,
        });
    }, [personalWithdrawalAmount, personalWithdrawalMethod, personalWithdrawalRates]);
    const openPersonalWithdrawalModal = () => {
        setEditingPersonalExpenseTx(null);
        setPersonalWithdrawalAmount('');
        setPersonalWithdrawalMethod('Caisse');
        setPersonalWithdrawalDate('');
        setPersonalWithdrawalNote('');
        setPersonalWithdrawalMode('expense');
        setIsPersonalWithdrawalModalOpen(true);
    };
    const closePersonalWithdrawalModal = () => {
        setIsPersonalWithdrawalModalOpen(false);
        setEditingPersonalExpenseTx(null);
    };
    // Reconcile advance state
    const [isReconcileAdvanceModalOpen, setIsReconcileAdvanceModalOpen] = useState(false);
    const [reconcileAdvanceTx, setReconcileAdvanceTx] = useState<TreasuryTx | null>(null);
    const [reconcileActualAmount, setReconcileActualAmount] = useState('');
    const [reconcileSpentDescription, setReconcileSpentDescription] = useState('');
    const openReconcileAdvanceModal = (advanceTx: TreasuryTx) => {
        setReconcileAdvanceTx(advanceTx);
        setReconcileActualAmount('');
        setReconcileSpentDescription(advanceTx.spentDescription || '');
        setIsReconcileAdvanceModalOpen(true);
    };
    const closeReconcileAdvanceModal = () => {
        setIsReconcileAdvanceModalOpen(false);
        setReconcileAdvanceTx(null);
        setReconcileActualAmount('');
        setReconcileSpentDescription('');
    };
    const managerInvestor = derivedInvestors.find((inv) => inv.isManager === true) || null;
    const managerAvailableProfit = Number(managerInvestor?.availableProfit || 0);
    const managerCapitalInvested = Number(managerInvestor?.capitalInvested || 0);
    const computePersonalExpenseFunding = (amountDzd: number, currentProfitCredit = 0, currentCapitalCredit = 0) => {
        const availableProfit = Math.max(0, managerAvailableProfit + currentProfitCredit);
        const availableCapital = Math.max(0, managerCapitalInvested + currentCapitalCredit);
        const profitAmount = roundM(Math.min(amountDzd, availableProfit));
        const capitalAmount = roundM(Math.max(0, amountDzd - profitAmount));
        return {
            profitAmount,
            capitalAmount,
            availableProfit,
            availableCapital,
        };
    };
    const toDateInput = (timestamp?: number) => {
        if (!timestamp)
            return '';
        const d = new Date(timestamp);
        if (Number.isNaN(d.getTime()))
            return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const resolvePersonalExpenseInvestorTxs = async (tx: TreasuryTx): Promise<PersonalExpenseInvestorLinks> => {
        const docs = new Map<string, InvestorTransaction & { id: string }>();
        const addDoc = (id: string, data?: InvestorTransaction) => {
            if (!id || !data) return;
            docs.set(id, { ...data, id });
        };
        if (tx.linkedInvestorTxId) {
            const snap = await userDocRef.collection('investor_transactions').doc(tx.linkedInvestorTxId).get();
            if (snap.exists) {
                addDoc(tx.linkedInvestorTxId, snap.data() as InvestorTransaction);
            }
        }
        if (tx.linkedCapitalInvestorTxId) {
            const snap = await userDocRef.collection('investor_transactions').doc(tx.linkedCapitalInvestorTxId).get();
            if (snap.exists) {
                addDoc(tx.linkedCapitalInvestorTxId, snap.data() as InvestorTransaction);
            }
        }
        if (tx.id) {
            const snap = await userDocRef.collection('investor_transactions')
                .where('linkedTreasuryTxId', '==', tx.id)
                .get();
            snap.docs.forEach((doc) => addDoc(doc.id, doc.data() as InvestorTransaction));
        }
        const rows = Array.from(docs.values());
        const profitRow = rows.find((row) => row.type === 'withdraw_profit');
        const capitalRow = rows.find((row) => row.type === 'withdraw_capital');
        return {
            profit: profitRow
                ? { id: profitRow.id, exists: true, amount: Number(profitRow.amount || 0) }
                : emptyPersonalExpenseInvestorLink(),
            capital: capitalRow
                ? { id: capitalRow.id, exists: true, amount: Number(capitalRow.amount || 0) }
                : emptyPersonalExpenseInvestorLink(),
        };
    };
    const writePersonalExpenseInvestorFunding = (batch: any, options: {
        links: PersonalExpenseInvestorLinks;
        treasuryId: string;
        managerId: string;
        source: FinancialWallet;
        date: string;
        time: string;
        timestamp: number;
        note: string;
        profitAmount: number;
        capitalAmount: number;
        forceProfitRow?: boolean;
    }) => {
        const {
            links,
            treasuryId,
            managerId,
            source,
            date,
            time,
            timestamp,
            note,
            profitAmount,
            capitalAmount,
            forceProfitRow = false,
        } = options;
        let linkedInvestorTxId = '';
        let linkedCapitalInvestorTxId = '';
        if (profitAmount > 0.005 || forceProfitRow) {
            const profitRef = links.profit.exists && links.profit.id
                ? userDocRef.collection('investor_transactions').doc(links.profit.id)
                : userDocRef.collection('investor_transactions').doc();
            linkedInvestorTxId = profitRef.id;
            const profitPayload = {
                investorId: managerId,
                type: 'withdraw_profit',
                origin: 'personal_expense',
                amount: profitAmount,
                paymentSource: source,
                linkedTreasuryTxId: treasuryId,
                date,
                time,
                timestamp,
                notes: note,
            };
            if (links.profit.exists) {
                batch.update(profitRef, profitPayload);
            }
            else {
                batch.set(profitRef, profitPayload);
            }
        }
        else if (links.profit.exists && links.profit.id) {
            batch.delete(userDocRef.collection('investor_transactions').doc(links.profit.id));
        }

        if (capitalAmount > 0.005) {
            const capitalRef = links.capital.exists && links.capital.id
                ? userDocRef.collection('investor_transactions').doc(links.capital.id)
                : userDocRef.collection('investor_transactions').doc();
            linkedCapitalInvestorTxId = capitalRef.id;
            const capitalPayload = {
                investorId: managerId,
                type: 'withdraw_capital',
                origin: 'personal_expense',
                amount: capitalAmount,
                paymentSource: source,
                linkedTreasuryTxId: treasuryId,
                date,
                time,
                timestamp,
                notes: `${note} (capital)`,
            };
            if (links.capital.exists) {
                batch.update(capitalRef, capitalPayload);
            }
            else {
                batch.set(capitalRef, capitalPayload);
            }
        }
        else if (links.capital.exists && links.capital.id) {
            batch.delete(userDocRef.collection('investor_transactions').doc(links.capital.id));
        }
        return { linkedInvestorTxId, linkedCapitalInvestorTxId };
    };
    const findPersonalAdvanceReturnDocs = async (tx: TreasuryTx) => {
        const docs = new Map<string, any>();
        if (tx.linkedReturnTxId) {
            const snap = await userDocRef.collection('treasury_txs').doc(tx.linkedReturnTxId).get();
            if (snap.exists)
                docs.set(tx.linkedReturnTxId, snap.ref);
        }
        if (tx.id) {
            const snap = await userDocRef.collection('treasury_txs')
                .where('linkedTreasuryTxId', '==', tx.id)
                .where('origin', '==', 'personal_expense_return')
                .get();
            snap.docs.forEach((doc) => docs.set(doc.id, doc.ref));
        }
        return Array.from(docs.entries()).map(([id, ref]) => ({ id, ref }));
    };
    const resolvePersonalExpenseWallet = (tx?: TreasuryTx | null): FinancialWallet => {
        const wallet = tx?.expenseWallet || tx?.source || 'Caisse';
        return wallet === 'USDT' || wallet === 'EUR' || wallet === 'BaridiMob' ? wallet : 'Caisse';
    };
    const getWalletAvailableBalance = (wallet: FinancialWallet): number => {
        if (wallet === 'Caisse') return Number(treasuryStats.caisse || 0);
        if (wallet === 'BaridiMob') return Number(treasuryStats.baridi || 0);
        if (wallet === 'USDT') return Number(portfolioStats.usdt.available || 0);
        return Number(portfolioStats.eur.available || 0);
    };
    const getSourceAmountFromPersonalExpense = (tx?: TreasuryTx | null): number => Number(tx?.originalAmount ?? tx?.amount ?? 0);
    const deleteLinkedPersonalExpensePortfolioDocs = async (batch: ReturnType<typeof db.batch>, txId: string) => {
        const [direct, legacy] = await Promise.all([
            userDocRef.collection('usdt_txs').where('linkedPersonalExpenseTxId', '==', txId).get(),
            userDocRef.collection('usdt_txs').where('linkedTxId', '==', txId).get(),
        ]);
        const seen = new Set<string>();
        direct.forEach((doc) => {
            seen.add(doc.id);
            batch.delete(doc.ref);
        });
        legacy.forEach((doc) => {
            if (seen.has(doc.id)) return;
            const data = doc.data() as any;
            if (data.origin === 'personal_expense' || data.origin === 'personal_expense_return') {
                batch.delete(doc.ref);
            }
        });
    };
    const buildPersonalWithdrawalStamp = (dateInput: string, editingTx?: TreasuryTx | null) => {
        if (dateInput) {
            const [y, m, d] = dateInput.split('-').map(Number);
            if (y && m && d) {
                const selectedDateInput = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                if (editingTx && toDateInput(editingTx.timestamp) === selectedDateInput) {
                    return {
                        timestamp: editingTx.timestamp,
                        date: editingTx.date,
                        time: editingTx.time
                    };
                }
                const picked = new Date();
                const isToday = picked.getFullYear() === y && picked.getMonth() + 1 === m && picked.getDate() === d;
                if (isToday) {
                    return now();
                }
                const customDate = new Date(y, m - 1, d, 12, 0, 0);
                return {
                    timestamp: customDate.getTime(),
                    date: customDate.toLocaleDateString('fr-FR'),
                    time: customDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                };
            }
        }
        return now();
    };
    const openEditPersonalExpense = (tx: TreasuryTx) => {
        if (tx.advanceState === 'settled') {
            const advanceAmount = getSourceAmountFromPersonalExpense(tx);
            const rate = Number(tx.conversionRateToDzd || 1);
            const settledAmountSource = rate > 0 ? Number(tx.settledAmount || 0) / rate : Number(tx.settledAmount || 0);
            const returnedAmount = Math.max(0, advanceAmount - settledAmountSource);
            setReconcileAdvanceTx(tx);
            setReconcileActualAmount(String(returnedAmount));
            setIsReconcileAdvanceModalOpen(true);
            return;
        }
        setEditingPersonalExpenseTx(tx);
        setPersonalWithdrawalAmount(String(getSourceAmountFromPersonalExpense(tx)));
        setPersonalWithdrawalMethod(resolvePersonalExpenseWallet(tx));
        setPersonalWithdrawalDate(toDateInput(tx.timestamp));
        setPersonalWithdrawalNote(tx.notes || '');
        setPersonalWithdrawalMode(tx.advanceState === 'pending' ? 'advance' : 'expense');
        setIsPersonalWithdrawalModalOpen(true);
    };
    const handleSavePersonalWithdrawal = async () => {
        const amountNum = roundM(parseAndEvaluate(personalWithdrawalAmount));
        if (isNaN(amountNum) || amountNum <= 0) {
            setAlert('⚠️ Montant invalide.');
            return;
        }
        if (!managerInvestor) {
            setAlert('⚠️ Aucun gérant défini. Désignez un investisseur comme gérant.');
            return;
        }
        if (isAssetWallet(personalWithdrawalMethod)) {
            const rate = personalWithdrawalMethod === 'USDT' ? personalWithdrawalRates.usdtPma : personalWithdrawalRates.eurPma;
            if (rate <= 0) {
                setAlert(`⚠️ PMA ${personalWithdrawalMethod} indisponible.`);
                return;
            }
        }
        const preview = computeProjectExpensePreview({
            wallet: personalWithdrawalMethod,
            amount: amountNum,
            rates: personalWithdrawalRates,
        });
        const epsilon = 0.005;
        const isAdvance = personalWithdrawalMode === 'advance';
        const currentProfitCredit = editingPersonalExpenseTx && editingPersonalExpenseTx.advanceState !== 'pending'
            ? Number(editingPersonalExpenseTx.profitAmountDzd ?? editingPersonalExpenseTx.settledAmount ?? editingPersonalExpenseTx.amount ?? 0)
            : 0;
        const currentCapitalCredit = editingPersonalExpenseTx && editingPersonalExpenseTx.advanceState !== 'pending'
            ? Number(editingPersonalExpenseTx.capitalAmountDzd ?? 0)
            : 0;
        const validationFunding = isAdvance
            ? { profitAmount: 0, capitalAmount: 0, availableProfit: 0, availableCapital: managerCapitalInvested }
            : computePersonalExpenseFunding(preview.amountDzd, currentProfitCredit, currentCapitalCredit);
        if (!isAdvance && validationFunding.capitalAmount > validationFunding.availableCapital + epsilon) {
            setAlert('⚠️ Montant dépasse le capital disponible.');
            return;
        }
        const currentSourceCredit = resolvePersonalExpenseWallet(editingPersonalExpenseTx) === personalWithdrawalMethod
            ? getSourceAmountFromPersonalExpense(editingPersonalExpenseTx)
            : 0;
        const availableBalance = getWalletAvailableBalance(personalWithdrawalMethod) + currentSourceCredit;
        if (amountNum > availableBalance + epsilon) {
            setAlert(`⚠️ Solde ${personalWithdrawalMethod} insuffisant.`);
            return;
        }
        if (isSaving)
            return;
        setIsSaving(true);
        try {
            const { timestamp, date: dateStr, time: timeStr } = buildPersonalWithdrawalStamp(personalWithdrawalDate, editingPersonalExpenseTx);
            const trimmedNote = personalWithdrawalNote.trim();
            const batch = db.batch();
            const treasuryRef = editingPersonalExpenseTx?.id
                ? userDocRef.collection('treasury_txs').doc(editingPersonalExpenseTx.id)
                : userDocRef.collection('treasury_txs').doc();
            const linkedInvestors = editingPersonalExpenseTx
                ? await resolvePersonalExpenseInvestorTxs(editingPersonalExpenseTx)
                : emptyPersonalExpenseInvestorLinks();
            const funding = isAdvance
                ? { profitAmount: 0, capitalAmount: 0 }
                : computePersonalExpenseFunding(preview.amountDzd, linkedInvestors.profit.amount, linkedInvestors.capital.amount);
            if (!isAdvance && funding.capitalAmount > managerCapitalInvested + linkedInvestors.capital.amount + epsilon) {
                setAlert('⚠️ Montant dépasse le capital disponible.');
                return;
            }
            const investorNote = trimmedNote
                ? `${isAdvance ? 'Avance perso' : 'Dépense perso'}: ${trimmedNote}`
                : (isAdvance ? 'Avance personnelle' : 'Dépense personnelle');
            const fundingLinks = writePersonalExpenseInvestorFunding(batch, {
                links: linkedInvestors,
                treasuryId: treasuryRef.id,
                managerId: managerInvestor.id,
                source: personalWithdrawalMethod,
                date: dateStr,
                time: timeStr,
                timestamp,
                note: investorNote,
                profitAmount: funding.profitAmount,
                capitalAmount: funding.capitalAmount,
                forceProfitRow: isAdvance,
            });
            const treasuryPayload: any = {
                timestamp,
                date: dateStr,
                time: timeStr,
                type: 'Retrait',
                ...(isCashWallet(personalWithdrawalMethod) ? { source: personalWithdrawalMethod } : {}),
                amount: preview.amountDzd,
                notes: trimmedNote || (isAdvance ? 'Avance personnelle' : 'Dépense personnelle'),
                origin: 'personal_expense',
                trackingPhase: editingPersonalExpenseTx?.trackingPhase || 'current',
                expenseWallet: personalWithdrawalMethod,
                expenseCurrency: preview.currency,
                originalAmount: amountNum,
                conversionRateToDzd: preview.rateToDzd,
                amountDzd: preview.amountDzd,
                profitAmountDzd: funding.profitAmount,
                capitalAmountDzd: funding.capitalAmount,
            };
            if (fundingLinks.linkedInvestorTxId) {
                treasuryPayload.linkedInvestorTxId = fundingLinks.linkedInvestorTxId;
            }
            else if (editingPersonalExpenseTx) {
                treasuryPayload.linkedInvestorTxId = fieldValueDelete();
            }
            if (fundingLinks.linkedCapitalInvestorTxId) {
                treasuryPayload.linkedCapitalInvestorTxId = fundingLinks.linkedCapitalInvestorTxId;
            }
            else if (editingPersonalExpenseTx) {
                treasuryPayload.linkedCapitalInvestorTxId = fieldValueDelete();
            }
            if (isAdvance) {
                treasuryPayload.advanceState = 'pending';
                if (editingPersonalExpenseTx) {
                    treasuryPayload.settledAmount = fieldValueDelete();
                    treasuryPayload.linkedReturnTxId = fieldValueDelete();
                }
            }
            else if (editingPersonalExpenseTx) {
                treasuryPayload.advanceState = fieldValueDelete();
                treasuryPayload.settledAmount = fieldValueDelete();
                treasuryPayload.linkedReturnTxId = fieldValueDelete();
            }
            if (editingPersonalExpenseTx?.id) {
                await deleteLinkedPersonalExpensePortfolioDocs(batch, editingPersonalExpenseTx.id);
            }
            if (editingPersonalExpenseTx) {
                batch.update(treasuryRef, treasuryPayload);
            }
            else {
                batch.set(treasuryRef, treasuryPayload);
            }
            if (isAssetWallet(personalWithdrawalMethod)) {
                batch.set(userDocRef.collection('usdt_txs').doc(), {
                    timestamp,
                    date: dateStr,
                    time: timeStr,
                    type: 'Retrait Manuel',
                    currency: personalWithdrawalMethod,
                    quantity: amountNum,
                    price: preview.rateToDzd,
                    total: preview.amountDzd,
                    notes: trimmedNote || (isAdvance ? 'Avance personnelle' : 'Dépense personnelle'),
                    linkedTxId: treasuryRef.id,
                    linkedPersonalExpenseTxId: treasuryRef.id,
                    origin: 'personal_expense',
                });
            }
            await batch.commit();
            setAlert(editingPersonalExpenseTx
                ? '✅ Dépense mise à jour.'
                : (isAdvance
                    ? "✅ Avance enregistrée — elle ne sera déduite du profit qu'à la régularisation."
                    : funding.capitalAmount > 0.005
                        ? `✅ Dépense personnelle enregistrée — ${funding.capitalAmount.toFixed(0)} DZD déduit du capital.`
                        : '✅ Dépense personnelle enregistrée.'));
            setIsPersonalWithdrawalModalOpen(false);
            setEditingPersonalExpenseTx(null);
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de l’enregistrement.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleReconcilePersonalAdvance = async () => {
        if (!reconcileAdvanceTx || !reconcileAdvanceTx.id) {
            setAlert('⚠️ Avance introuvable.');
            return;
        }
        const advanceWallet = resolvePersonalExpenseWallet(reconcileAdvanceTx);
        const fallbackRate = advanceWallet === 'USDT'
            ? personalWithdrawalRates.usdtPma
            : advanceWallet === 'EUR'
                ? personalWithdrawalRates.eurPma
                : 1;
        const rateToDzd = Number(reconcileAdvanceTx.conversionRateToDzd || fallbackRate || 0);
        if (rateToDzd <= 0) {
            setAlert(`⚠️ PMA ${advanceWallet} indisponible.`);
            return;
        }
        const advanceAmount = getSourceAmountFromPersonalExpense(reconcileAdvanceTx);
        const advanceCurrency = getWalletCurrency(advanceWallet);
        const reconciliation = evaluatePersonalAdvanceReconciliation(reconcileActualAmount, advanceAmount);
        if (!reconciliation.isValid) {
            if (reconciliation.error === 'exceeds') {
                setAlert(`⚠️ Le montant retourné ne peut pas dépasser l'avance (${advanceAmount} ${advanceCurrency}).`);
            }
            else if (reconciliation.error === 'negative') {
                setAlert('⚠️ Le montant retourné doit être positif ou zéro.');
            }
            else {
                setAlert('⚠️ Montant invalide.');
            }
            return;
        }
        const actualSpent = reconciliation.actualSpent;
        const returnAmount = reconciliation.returnAmount;
        const actualSpentDzd = roundM(actualSpent * rateToDzd);
        const returnAmountDzd = roundM(returnAmount * rateToDzd);
        const spentDescription = reconcileSpentDescription.trim();
        if (!managerInvestor) {
            setAlert('⚠️ Aucun gérant défini. Désignez un investisseur comme gérant.');
            return;
        }
        if (isSaving)
            return;
        setIsSaving(true);
        try {
            const { date, time, timestamp } = now();
            const batch = db.batch();
            const originalAdvanceRef = userDocRef.collection('treasury_txs').doc(reconcileAdvanceTx.id);
            const linkedInvestors = await resolvePersonalExpenseInvestorTxs(reconcileAdvanceTx);
            const funding = computePersonalExpenseFunding(actualSpentDzd, linkedInvestors.profit.amount, linkedInvestors.capital.amount);
            if (funding.capitalAmount > funding.availableCapital + 0.005) {
                setAlert('⚠️ Montant dépasse le capital disponible.');
                return;
            }
            const investorNote = spentDescription
                ? `Dépense perso: ${spentDescription}`
                : reconcileAdvanceTx.notes
                    ? `Dépense perso: ${reconcileAdvanceTx.notes}`
                    : 'Dépense personnelle';
            const fundingLinks = writePersonalExpenseInvestorFunding(batch, {
                links: linkedInvestors,
                treasuryId: reconcileAdvanceTx.id,
                managerId: managerInvestor.id,
                source: advanceWallet,
                date: reconcileAdvanceTx.date,
                time: reconcileAdvanceTx.time,
                timestamp: reconcileAdvanceTx.timestamp,
                note: investorNote,
                profitAmount: funding.profitAmount,
                capitalAmount: funding.capitalAmount,
            });
            const returnDocs = await findPersonalAdvanceReturnDocs(reconcileAdvanceTx);
            const primaryReturnDoc = returnDocs[0] || null;
            const advanceUpdatePayload: any = {
                advanceState: 'settled',
                settledAmount: actualSpentDzd,
                profitAmountDzd: funding.profitAmount,
                capitalAmountDzd: funding.capitalAmount,
            };
            if (fundingLinks.linkedInvestorTxId) {
                advanceUpdatePayload.linkedInvestorTxId = fundingLinks.linkedInvestorTxId;
            }
            else {
                advanceUpdatePayload.linkedInvestorTxId = fieldValueDelete();
            }
            if (fundingLinks.linkedCapitalInvestorTxId) {
                advanceUpdatePayload.linkedCapitalInvestorTxId = fundingLinks.linkedCapitalInvestorTxId;
            }
            else {
                advanceUpdatePayload.linkedCapitalInvestorTxId = fieldValueDelete();
            }
            if (spentDescription) {
                advanceUpdatePayload.spentDescription = spentDescription;
            }
            else {
                advanceUpdatePayload.spentDescription = fieldValueDelete();
            }
            if (returnAmount > 0.005) {
                const returnPayload: any = {
                    timestamp,
                    date,
                    time,
                    type: 'Ajout',
                    ...(isCashWallet(advanceWallet) ? { source: advanceWallet } : {}),
                    amount: returnAmountDzd,
                    notes: `Régularisation avance · Retour ${advanceWallet}`,
                    linkedTreasuryTxId: reconcileAdvanceTx.id,
                    origin: 'personal_expense_return',
                    expenseWallet: advanceWallet,
                    expenseCurrency: advanceCurrency,
                    originalAmount: returnAmount,
                    conversionRateToDzd: rateToDzd,
                    amountDzd: returnAmountDzd,
                };
                if (fundingLinks.linkedInvestorTxId) {
                    returnPayload.linkedInvestorTxId = fundingLinks.linkedInvestorTxId;
                }
                let returnTxId = '';
                if (primaryReturnDoc) {
                    await deleteLinkedPersonalExpensePortfolioDocs(batch, primaryReturnDoc.id);
                    const { timestamp: _timestamp, date: _date, time: _time, ...returnUpdatePayload } = returnPayload;
                    batch.update(primaryReturnDoc.ref, returnUpdatePayload);
                    advanceUpdatePayload.linkedReturnTxId = primaryReturnDoc.id;
                    returnTxId = primaryReturnDoc.id;
                }
                else {
                    const returnTxRef = userDocRef.collection('treasury_txs').doc();
                    batch.set(returnTxRef, returnPayload);
                    advanceUpdatePayload.linkedReturnTxId = returnTxRef.id;
                    returnTxId = returnTxRef.id;
                }
                if (isAssetWallet(advanceWallet)) {
                    batch.set(userDocRef.collection('usdt_txs').doc(), {
                        timestamp,
                        date,
                        time,
                        type: 'Ajout Manuel',
                        currency: advanceWallet,
                        quantity: returnAmount,
                        price: rateToDzd,
                        total: returnAmountDzd,
                        notes: `Régularisation avance · Retour ${advanceWallet}`,
                        linkedTxId: returnTxId,
                        linkedTreasuryTxId: reconcileAdvanceTx.id,
                        linkedPersonalExpenseTxId: returnTxId,
                        origin: 'personal_expense_return',
                    });
                }
                for (const doc of returnDocs.slice(1)) {
                    await deleteLinkedPersonalExpensePortfolioDocs(batch, doc.id);
                    batch.delete(doc.ref);
                }
            }
            else {
                advanceUpdatePayload.linkedReturnTxId = fieldValueDelete();
                for (const doc of returnDocs) {
                    await deleteLinkedPersonalExpensePortfolioDocs(batch, doc.id);
                    batch.delete(doc.ref);
                }
            }
            batch.update(originalAdvanceRef, advanceUpdatePayload);
            await batch.commit();
            setAlert(returnAmount > 0.005
                ? `✅ Avance régularisée — ${returnAmount.toFixed(2)} ${advanceCurrency} retourné à ${advanceWallet}.`
                : funding.capitalAmount > 0.005
                    ? `✅ Avance régularisée — ${funding.capitalAmount.toFixed(0)} DZD déduit du capital.`
                    : '✅ Avance régularisée.');
            closeReconcileAdvanceModal();
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de la régularisation.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleDeletePersonalExpense = async () => {
        if (!personalExpenseToDelete?.id)
            return;
        if (isSaving)
            return;
        setIsSaving(true);
        try {
            const batch = db.batch();
            const tx = personalExpenseToDelete;
            batch.delete(userDocRef.collection('treasury_txs').doc(tx.id));
            await deleteLinkedPersonalExpensePortfolioDocs(batch, tx.id);
            const linkedInvestors = await resolvePersonalExpenseInvestorTxs(tx);
            const linkedInvestorIds = new Set([linkedInvestors.profit.id, linkedInvestors.capital.id].filter(Boolean));
            for (const investorTxId of linkedInvestorIds) {
                batch.delete(userDocRef.collection('investor_transactions').doc(investorTxId));
            }
            const returnDocs = await findPersonalAdvanceReturnDocs(tx);
            for (const doc of returnDocs) {
                await deleteLinkedPersonalExpensePortfolioDocs(batch, doc.id);
                batch.delete(doc.ref);
            }
            await batch.commit();
            setAlert('✅ Dépense supprimée.');
            setPersonalExpenseToDelete(null);
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de la suppression.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const openInvestorModal = (investor: Investor | null = null) => {
        setEditingInvestor(investor);
        if (investor) {
            setInvestorName(investor.name);
            setInvestorInitialCapital(investor.initialCapital.toString());
            setInvestorNotes(investor.notes || '');
            setIsManager(investor.isManager || false);
            setInvestorEmail(investor.email || '');
            setInvestorPhone(investor.phone || '');
        }
        else {
            setInvestorName('');
            setInvestorInitialCapital('0');
            setInvestorNotes('');
            setIsManager(false);
            setInvestorEmail('');
            setInvestorPhone('');
            setInvestorInitialCapitalSource('none');
        }
        setIsInvestorModalOpen(true);
    };
    const closeInvestorModal = () => {
        setIsInvestorModalOpen(false);
        setEditingInvestor(null);
    };
    const handleSaveInvestor = async () => {
        const capital = parseAndEvaluate(investorInitialCapital);
        if (!investorName.trim()) {
            setAlert('⚠️ Nom de l’investisseur invalide.');
            return;
        }
        if (isNaN(capital) || capital < 0) {
            setAlert('⚠️ Capital initial invalide.');
            return;
        }
        setIsSaving(true);
        try {
            const batch = db.batch();
            if (editingInvestor) {
                const updatePayload: any = {
                    name: investorName.trim(),
                    notes: investorNotes.trim(),
                    isManager,
                    email: investorEmail.trim(),
                    phone: investorPhone.trim(),
                    linkedClientId: fieldValueDelete()
                };
                batch.update(userDocRef.collection('investors').doc(editingInvestor.id), updatePayload);
                setAlert('✅ Investisseur mis à jour.');
            }
            else {
                const ref = userDocRef.collection('investors').doc();
                const data: Investor = {
                    id: ref.id,
                    name: investorName.trim(),
                    entryDate: new Date().toISOString(),
                    capitalInvested: capital,
                    initialCapital: capital,
                    sharePercentage: 0,
                    totalProfit: 0,
                    withdrawnProfit: 0,
                    availableProfit: 0,
                    isActive: true,
                    notes: investorNotes.trim(),
                    isManager,
                    email: investorEmail.trim(),
                    phone: investorPhone.trim()
                };
                batch.set(ref, data);
                if (capital > 0) {
                    const { date: depositDate, time: depositTime, timestamp: depositTs } = now();
                    const investorTxRef = userDocRef.collection('investor_transactions').doc();
                    const investorTxPayload: any = {
                        investorId: ref.id,
                        type: 'deposit_capital',
                        amount: capital,
                        date: depositDate,
                        time: depositTime,
                        timestamp: depositTs,
                        notes: 'Capital Initial'
                    };
                    // M3: when the user picks Caisse/BaridiMob the cash actually moved
                    // into the project — record it in treasury so totalCapital reflects
                    // the inflow. 'none' keeps the legacy opening-equity semantics.
                    if (investorInitialCapitalSource !== 'none') {
                        const treasuryRef = userDocRef.collection('treasury_txs').doc();
                        investorTxPayload.paymentSource = investorInitialCapitalSource;
                        investorTxPayload.linkedTreasuryTxId = treasuryRef.id;
                        batch.set(treasuryRef, {
                            timestamp: depositTs,
                            date: depositDate,
                            time: depositTime,
                            type: 'Ajout',
                            source: investorInitialCapitalSource,
                            amount: capital,
                            notes: `Capital initial: ${investorName.trim()}`,
                            linkedInvestorTxId: investorTxRef.id,
                            origin: 'investor_capital_deposit'
                        });
                    }
                    batch.set(investorTxRef, investorTxPayload);
                }
                setAlert('✅ Investisseur ajouté.');
            }
            await batch.commit();
            closeInvestorModal();
            return true;
        }
        catch (e) {
            setAlert('❌ Erreur lors de l’enregistrement.');
            return false;
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleSaveInvestorTx = async () => {
        const amount = parseAndEvaluate(investorTxAmount);
        if (!selectedInvestorId || isNaN(amount) || amount <= 0) {
            setAlert('⚠️ Données de transaction invalides.');
            return;
        }
        const selectedInvestor = derivedInvestors.find((investor) => investor.id === selectedInvestorId);
        if (!selectedInvestor) {
            setAlert('⚠️ Investisseur introuvable.');
            return;
        }
        if (investorTxType === 'withdraw_profit') {
            const availableProfit = Number(selectedInvestor.availableProfit || 0);
            const sourceBalance = investorTxPaymentSource === 'Caisse'
                ? Number(treasuryStats.caisse || 0)
                : Number(treasuryStats.baridi || 0);
            if (amount > availableProfit + 0.005) {
                setAlert('⚠️ Montant dépasse le profit disponible.');
                return;
            }
            if (amount > sourceBalance + 0.005) {
                setAlert(investorTxPaymentSource === 'Caisse' ? '⚠️ Solde Caisse insuffisant.' : '⚠️ Solde BaridiMob insuffisant.');
                return;
            }
        }
        // Retrait de capital: valider que la trésorerie et le capital sont suffisants.
        if (investorTxType === 'withdraw_capital') {
            const capitalInvested = Number(selectedInvestor.capitalInvested || 0);
            const availableProfit = Number(selectedInvestor.availableProfit || 0);
            const sourceBalance = investorTxPaymentSource === 'Caisse'
                ? Number(treasuryStats.caisse || 0)
                : Number(treasuryStats.baridi || 0);
            if (amount > capitalInvested + 0.005) {
                setAlert('⚠️ Montant dépasse le capital investi.');
                return;
            }
            // M1: an investor whose accumulated profit went negative (e.g. delivery
            // expense burden exceeded their share) cannot withdraw capital without
            // first reconciling that debt — otherwise the project loses money.
            if (availableProfit < -0.005) {
                setAlert(`⚠️ Cet investisseur a un profit négatif (${availableProfit.toFixed(2)} DZD). Régularisez avant le retrait de capital.`);
                return;
            }
            if (amount > sourceBalance + 0.005) {
                setAlert(investorTxPaymentSource === 'Caisse' ? '⚠️ Solde Caisse insuffisant.' : '⚠️ Solde BaridiMob insuffisant.');
                return;
            }
        }
        if (isSaving)
            return;
        setIsSaving(true);
        try {
            const { date, time, timestamp } = now();
            const batch = db.batch();
            const txRef = userDocRef.collection('investor_transactions').doc();
            const investorTxPayload: any = {
                investorId: selectedInvestorId,
                type: investorTxType,
                amount,
                notes: investorTxNotes.trim(),
                date,
                time,
                timestamp
            };
            if (investorTxType === 'withdraw_profit') {
                investorTxPayload.origin = 'profit_withdrawal';
                const treasuryRef = userDocRef.collection('treasury_txs').doc();
                investorTxPayload.paymentSource = investorTxPaymentSource;
                investorTxPayload.linkedTreasuryTxId = treasuryRef.id;
                batch.set(treasuryRef, {
                    timestamp,
                    date,
                    time,
                    type: 'Retrait',
                    source: investorTxPaymentSource,
                    amount,
                    notes: `Retrait profit investisseur: ${selectedInvestor.name}${investorTxNotes.trim() ? ` - ${investorTxNotes.trim()}` : ''}`,
                    linkedInvestorTxId: txRef.id,
                    origin: 'investor_profit_withdrawal'
                });
            }
            // Retrait de capital investisseur: crée un Retrait de trésorerie correspondant
            // afin que Capital Total diminue du même montant que Engagements investisseurs,
            // laissant Capital réel = Capital Total - Engagements inchangé.
            if (investorTxType === 'withdraw_capital') {
                const treasuryRef = userDocRef.collection('treasury_txs').doc();
                investorTxPayload.paymentSource = investorTxPaymentSource;
                investorTxPayload.linkedTreasuryTxId = treasuryRef.id;
                batch.set(treasuryRef, {
                    timestamp,
                    date,
                    time,
                    type: 'Retrait',
                    source: investorTxPaymentSource,
                    amount,
                    notes: `Retrait capital investisseur: ${selectedInvestor.name}${investorTxNotes.trim() ? ` - ${investorTxNotes.trim()}` : ''}`,
                    linkedInvestorTxId: txRef.id,
                    origin: 'investor_capital_withdrawal'
                });
            }
            // Nouvel apport investisseur: crée une entrée de trésorerie correspondante
            // afin que Capital Total augmente du même montant que Engagements investisseurs,
            // laissant Capital réel = Capital Total - Engagements inchangé.
            if (investorTxType === 'deposit_capital') {
                const treasuryRef = userDocRef.collection('treasury_txs').doc();
                investorTxPayload.paymentSource = investorTxPaymentSource;
                investorTxPayload.linkedTreasuryTxId = treasuryRef.id;
                batch.set(treasuryRef, {
                    timestamp,
                    date,
                    time,
                    type: 'Ajout',
                    source: investorTxPaymentSource,
                    amount,
                    notes: `Apport capital investisseur: ${selectedInvestor.name}${investorTxNotes.trim() ? ` - ${investorTxNotes.trim()}` : ''}`,
                    linkedInvestorTxId: txRef.id,
                    origin: 'investor_capital_deposit'
                });
            }
            batch.set(txRef, investorTxPayload);
            await batch.commit();
            setAlert('✅ Transaction enregistrée.');
            setIsInvestorTxModalOpen(false);
            setInvestorTxAmount('');
            setInvestorTxNotes('');
            setInvestorTxPaymentSource('Caisse');
            return true;
        }
        catch (e) {
            setAlert('❌ Erreur lors de l’enregistrement de la transaction.');
            return false;
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleReinvestProfit = async (investorId: string, amount: number) => {
        const investor = derivedInvestors.find((i) => i.id === investorId);
        if (!investor || amount <= 0)
            return;
        const availableProfit = Number(investor.availableProfit || 0);
        if (amount > availableProfit + 0.005) {
            setAlert('⚠️ Montant dépasse le profit disponible.');
            return;
        }
        if (isSaving)
            return;
        setIsSaving(true);
        try {
            const batch = db.batch();
            // Record the reinvestment transaction only.
            // capitalInvested is derived dynamically from transaction history in
            // buildInvestorsBase (useInvestorEconomics) — no direct Firestore field update needed.
            batch.set(userDocRef.collection('investor_transactions').doc(), {
                investorId,
                type: 'reinvest_profit',
                origin: 'reinvestment',
                amount,
                date: now().date,
                time: now().time,
                timestamp: now().timestamp,
                notes: 'Reinvestissement profit'
            });
            await batch.commit();
            setAlert('✅ Réinvestissement enregistré.');
            return true;
        }
        catch (e) {
            setAlert('❌ Erreur lors du réinvestissement.');
            return false;
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleDeleteInvestor = async (investorId?: string) => {
        const targetInvestorId = investorId || investorToDelete?.id;
        if (!targetInvestorId) {
            setAlert('⚠️ Investisseur introuvable.');
            return false;
        }
        setIsSaving(true);
        try {
            const investorRef = userDocRef.collection('investors').doc(targetInvestorId);
            const txCollection = userDocRef.collection('investor_transactions');
            const DELETE_CHUNK = 400;
            let deletedTxCount = 0;
            let investorDeleted = false;
            while (true) {
                const txSnap = await txCollection.where('investorId', '==', targetInvestorId).limit(DELETE_CHUNK).get();
                if (txSnap.empty)
                    break;
                const batch = db.batch();
                // M6: a personal expense advance treasury_tx may have a paired
                // personal_expense_return row. The return is linked to the advance
                // (not directly to the investor_tx), so we must look it up and
                // delete it explicitly — otherwise it orphans when the manager
                // investor is removed.
                const linkedTreasuryIds: string[] = [];
                txSnap.docs.forEach((doc) => {
                    const txData = doc.data() as InvestorTransaction;
                    if (txData.linkedTreasuryTxId) {
                        linkedTreasuryIds.push(txData.linkedTreasuryTxId);
                        batch.delete(userDocRef.collection('treasury_txs').doc(txData.linkedTreasuryTxId));
                    }
                    batch.delete(doc.ref);
                });
                for (const treasuryId of linkedTreasuryIds) {
                    const returnDocs = await userDocRef
                        .collection('treasury_txs')
                        .where('linkedTreasuryTxId', '==', treasuryId)
                        .where('origin', '==', 'personal_expense_return')
                        .get();
                    returnDocs.forEach((doc) => batch.delete(doc.ref));
                }
                if (!investorDeleted) {
                    batch.delete(investorRef);
                    investorDeleted = true;
                }
                await batch.commit();
                deletedTxCount += txSnap.size;
                if (txSnap.size < DELETE_CHUNK)
                    break;
            }
            if (!investorDeleted) {
                await investorRef.delete();
            }
            setAlert(`✅ Investisseur supprimé (${deletedTxCount} transaction${deletedTxCount > 1 ? 's' : ''}).`);
            setInvestorToDelete(null);
            return true;
        }
        catch (e) {
            setAlert('❌ Erreur lors de la suppression de l’investisseur.');
            return false;
        }
        finally {
            setIsSaving(false);
        }
    };
    return {
        isSaving,
        isInvestorModalOpen,
        setIsInvestorModalOpen,
        editingInvestor,
        setEditingInvestor,
        investorToDelete,
        setInvestorToDelete,
        investorName,
        setInvestorName,
        investorInitialCapital,
        setInvestorInitialCapital,
        investorNotes,
        setInvestorNotes,
        isManager,
        setIsManager,
        investorEmail,
        setInvestorEmail,
        investorPhone,
        setInvestorPhone,
        investorInitialCapitalSource,
        setInvestorInitialCapitalSource,
        isInvestorTxModalOpen,
        setIsInvestorTxModalOpen,
        investorTxAmount,
        setInvestorTxAmount,
        investorTxType,
        setInvestorTxType,
        investorTxNotes,
        setInvestorTxNotes,
        investorTxPaymentSource,
        setInvestorTxPaymentSource,
        investorTxToDelete,
        setInvestorTxToDelete,
        handleSaveInvestorTx,
        isReinvestModalOpen,
        setIsReinvestModalOpen,
        reinvestInput,
        setReinvestInput,
        selectedInvestorId,
        setSelectedInvestorId,
        openInvestorModal,
        closeInvestorModal,
        handleSaveInvestor,
        handleReinvestProfit,
        handleDeleteInvestor,
        // Personal withdrawal (manager's daily personal expense)
        isPersonalWithdrawalModalOpen,
        setIsPersonalWithdrawalModalOpen,
        personalWithdrawalAmount,
        setPersonalWithdrawalAmount,
        personalWithdrawalMethod,
        setPersonalWithdrawalMethod,
        personalWithdrawalDate,
        setPersonalWithdrawalDate,
        personalWithdrawalNote,
        setPersonalWithdrawalNote,
        personalWithdrawalMode,
        setPersonalWithdrawalMode,
        personalWithdrawalPreview,
        editingPersonalExpenseTx,
        personalExpenseToDelete,
        setPersonalExpenseToDelete,
        openEditPersonalExpense,
        openPersonalWithdrawalModal,
        closePersonalWithdrawalModal,
        handleSavePersonalWithdrawal,
        handleDeletePersonalExpense,
        managerAvailableProfit,
        managerCapitalInvested,
        managerExists: Boolean(managerInvestor),
        // Reconcile advance
        isReconcileAdvanceModalOpen,
        reconcileAdvanceTx,
        reconcileActualAmount,
        setReconcileActualAmount,
        reconcileSpentDescription,
        setReconcileSpentDescription,
        openReconcileAdvanceModal,
        closeReconcileAdvanceModal,
        handleReconcilePersonalAdvance
    };
}
