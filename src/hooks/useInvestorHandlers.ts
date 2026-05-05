import { useState } from 'react';
import { db, type FirestoreDocumentReference } from '../firebase';
import { Investor, InvestorTransaction } from '../types';
import { now, parseAndEvaluate } from '../utils';

export function useInvestorHandlers(
    userDocRef: FirestoreDocumentReference,
    investors: Investor[],
    derivedInvestors: any[],
    treasuryStats: { caisse: number; baridi: number },
    setAlert: (msg: string) => void
) {
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

    // Transaction state
    const [isInvestorTxModalOpen, setIsInvestorTxModalOpen] = useState(false);
    const [investorTxAmount, setInvestorTxAmount] = useState('');
    const [investorTxType, setInvestorTxType] = useState<'deposit_capital' | 'withdraw_profit' | 'withdraw_capital' | 'reinvest_profit'>('deposit_capital');
    const [investorTxNotes, setInvestorTxNotes] = useState('');
    const [investorTxToDelete, setInvestorTxToDelete] = useState<InvestorTransaction | null>(null);

    // Reinvest state
    const [isReinvestModalOpen, setIsReinvestModalOpen] = useState(false);
    const [reinvestInput, setReinvestInput] = useState('');
    const [selectedInvestorId, setSelectedInvestorId] = useState('');

    const openInvestorModal = (investor: Investor | null = null) => {
        setEditingInvestor(investor);
        if (investor) {
            setInvestorName(investor.name);
            setInvestorInitialCapital(investor.initialCapital.toString());
            setInvestorNotes(investor.notes || '');
            setIsManager(investor.isManager || false);
            setInvestorEmail(investor.email || '');
            setInvestorPhone(investor.phone || '');
        } else {
            setInvestorName('');
            setInvestorInitialCapital('0');
            setInvestorNotes('');
            setIsManager(false);
            setInvestorEmail('');
            setInvestorPhone('');
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
            setAlert('Invalid investor name.');
            return;
        }
        if (isNaN(capital) || capital < 0) {
            setAlert('Invalid initial capital.');
            return;
        }

        setIsSaving(true);
        try {
            const batch = db.batch();
            if (editingInvestor) {
                batch.update(userDocRef.collection('investors').doc(editingInvestor.id), {
                    name: investorName.trim(),
                    notes: investorNotes.trim(),
                    isManager,
                    email: investorEmail.trim(),
                    phone: investorPhone.trim()
                });
                setAlert('Investor updated.');
            } else {
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
                    batch.set(userDocRef.collection('investor_transactions').doc(), {
                        investorId: ref.id,
                        type: 'deposit_capital',
                        amount: capital,
                        date: now().date,
                        time: now().time,
                        timestamp: now().timestamp,
                        notes: 'Capital Initial'
                    });
                }
                setAlert('Investor added.');
            }

            await batch.commit();
            closeInvestorModal();
            return true;
        } catch (e) {
            setAlert('Error while saving investor.');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveInvestorTx = async () => {
        const amount = parseAndEvaluate(investorTxAmount);
        if (!selectedInvestorId || isNaN(amount) || amount <= 0) {
            setAlert('Invalid transaction data.');
            return;
        }

        setIsSaving(true);
        try {
            const txRef = userDocRef.collection('investor_transactions').doc();
            await txRef.set({
                investorId: selectedInvestorId,
                type: investorTxType,
                amount,
                notes: investorTxNotes.trim(),
                date: now().date,
                time: now().time,
                timestamp: now().timestamp
            });

            setAlert('Transaction saved.');
            setIsInvestorTxModalOpen(false);
            setInvestorTxAmount('');
            setInvestorTxNotes('');
            return true;
        } catch (e) {
            setAlert('Error while saving transaction.');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleReinvestProfit = async (investorId: string, amount: number) => {
        const investor = derivedInvestors.find((i) => i.id === investorId);
        if (!investor || amount <= 0) return;

        setIsSaving(true);
        try {
            const batch = db.batch();
            batch.set(userDocRef.collection('investor_transactions').doc(), {
                investorId,
                type: 'reinvest_profit',
                amount,
                date: now().date,
                time: now().time,
                timestamp: now().timestamp,
                notes: 'Reinvestissement'
            });

            batch.update(userDocRef.collection('investors').doc(investorId), {
                capitalInvested: investor.capitalInvested + amount,
                // initialCapital is NOT updated: it must remain the original
                // deposit. The reinvested amount is tracked via the
                // 'reinvest_profit' investor transaction instead.
            });

            await batch.commit();
            setAlert('Reinvestment recorded.');
            return true;
        } catch (e) {
            setAlert('Error while reinvesting.');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteInvestor = async (investorId?: string) => {
        const targetInvestorId = investorId || investorToDelete?.id;
        if (!targetInvestorId) {
            setAlert('Investor not found.');
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
                if (txSnap.empty) break;

                const batch = db.batch();
                txSnap.docs.forEach((doc) => batch.delete(doc.ref));

                if (!investorDeleted) {
                    batch.delete(investorRef);
                    investorDeleted = true;
                }

                await batch.commit();
                deletedTxCount += txSnap.size;

                if (txSnap.size < DELETE_CHUNK) break;
            }

            if (!investorDeleted) {
                await investorRef.delete();
            }

            setAlert(`Investor deleted (${deletedTxCount} transaction(s) removed).`);
            setInvestorToDelete(null);
            return true;
        } catch (e) {
            setAlert('Error while deleting investor.');
            return false;
        } finally {
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
        isInvestorTxModalOpen,
        setIsInvestorTxModalOpen,
        investorTxAmount,
        setInvestorTxAmount,
        investorTxType,
        setInvestorTxType,
        investorTxNotes,
        setInvestorTxNotes,
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
        handleDeleteInvestor
    };
}
