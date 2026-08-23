import { useState } from 'react';
import { db, type FirestoreDocumentReference } from '../firebase';
import { ManualAsset, ManualAssetClient, ManualAssetTransaction } from '../types';
import { recordTreasuryShadow } from '../accounting/treasuryShadowDiagnostics';
type AssetClientInput = {
    fullName: string;
    phone?: string;
    email?: string;
    notes?: string;
    balance?: number;
};
export function useAssetHandlers(userDocRef: FirestoreDocumentReference, manualAssets: ManualAsset[], manualAssetClients: ManualAssetClient[], assetClientBalances: Map<string, number>, setAlert: (msg: string) => void) {
    const [isSaving, setIsSaving] = useState(false);
    // Asset modal state
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<ManualAsset | null>(null);
    // Create asset modal state
    const [isCreateAssetModalOpen, setIsCreateAssetModalOpen] = useState(false);
    const [newAssetName, setNewAssetName] = useState('');
    const [newAssetDescription, setNewAssetDescription] = useState('');
    // Asset client modal state
    const [isAssetClientModalOpen, setIsAssetClientModalOpen] = useState(false);
    const [editingAssetClient, setEditingAssetClient] = useState<ManualAssetClient | null>(null);
    const [assetClientFullName, setAssetClientFullName] = useState('');
    const [assetClientPhone, setAssetClientPhone] = useState('');
    const [assetClientEmail, setAssetClientEmail] = useState('');
    const [assetClientNotes, setAssetClientNotes] = useState('');
    const [assetClientBalance, setAssetClientBalance] = useState('');
    const [assetClientAssetId, setAssetClientAssetId] = useState('');
    const closeAssetClientModal = () => {
        setIsAssetClientModalOpen(false);
        setEditingAssetClient(null);
    };
    const handleCreateAsset = async () => {
        if (!newAssetName.trim()) {
            setAlert('⚠️ Nom requis.');
            return;
        }
        setIsSaving(true);
        try {
            const ts = Date.now();
            await userDocRef.collection('manual_assets').add({
                name: newAssetName.trim(),
                description: newAssetDescription.trim() || '',
                createdAt: ts,
                updatedAt: ts,
                archived: false
            });
            setAlert('✅ Service créé.');
            setIsCreateAssetModalOpen(false);
            setNewAssetName('');
            setNewAssetDescription('');
            return true;
        }
        catch (e) {
            setAlert('❌ Erreur lors de la création du service.');
            return false;
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleDeleteAsset = async (assetId: string, txCount: number) => {
        setIsSaving(true);
        try {
            await userDocRef.collection('manual_assets').doc(assetId).update({
                archived: true,
                archivedAt: Date.now(),
                archivedReason: txCount > 0 ? 'user_delete_with_history' : 'user_delete',
            });
            setAlert('✅ Service archivé.');
            return true;
        }
        catch (e) {
            setAlert('❌ Erreur lors de la suppression.');
            return false;
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleCreateAssetTransaction = async (data: Omit<ManualAssetTransaction, 'id'>) => {
        setIsSaving(true);
        try {
            const batch = db.batch();
            const assetTxRef = userDocRef.collection('actifTransactions').doc();
            const payload = { ...data, amount: Number(data.amount) };
            batch.set(assetTxRef, payload);
            // FIX-5 (Q7): both inflows (payment_received) and outflows (payment_made) with
            // cash/baridi must be reflected in the treasury. payment_received → Ajout (cash in),
            // payment_made → Retrait (cash out).
            const isCashOrBaridi = data.paymentMethod === 'cash' || data.paymentMethod === 'baridi';
            const isInflow = data.type === 'payment_received';
            const isOutflow = data.type === 'payment_made';
            if ((isInflow || isOutflow) && isCashOrBaridi) {
                const client = manualAssetClients.find((c) => c.id === data.clientId);
                const asset = manualAssets.find((a) => a.id === data.actifId);
                const treasuryTxRef = userDocRef.collection('treasury_txs').doc();
                const treasuryType = isInflow ? 'Ajout' : 'Retrait';
                const noteVerb = isInflow ? 'Paiement' : 'Dépense';
                batch.set(treasuryTxRef, {
                    timestamp: data.timestamp,
                    date: data.date,
                    time: data.time,
                    type: treasuryType,
                    source: data.paymentMethod === 'cash' ? 'Caisse' : 'BaridiMob',
                    amount: Math.abs(Number(data.amount)),
                    notes: `${noteVerb} ${client?.fullName || 'Client'} - ${asset?.name || 'Service'}`,
                    origin: 'manual_asset',
                    linkedAssetTxId: assetTxRef.id
                });
                batch.update(assetTxRef, { linkedTreasuryTxId: treasuryTxRef.id });
                const wallet = data.paymentMethod === 'cash' ? 'Caisse' : 'BaridiMob';
                recordTreasuryShadow({
                    operationId: `shadow:manual-asset:${assetTxRef.id}`,
                    actorUid: userDocRef.id,
                    effectiveAt: data.timestamp,
                    kind: isInflow ? 'manual_asset_receipt_cash' : 'manual_asset_payout_cash',
                    wallet,
                    amountDzd: Math.abs(Number(data.amount)),
                    clientId: data.clientId,
                }, [{ type: treasuryType, source: wallet, amount: Math.abs(Number(data.amount)) }]);
            }
            await batch.commit();
            setAlert('✅ Transaction ajoutée.');
            return true;
        }
        catch (e) {
            setAlert('❌ Erreur lors de l’ajout de la transaction.');
            return false;
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleCreateAssetClient = async (assetId: string, input?: AssetClientInput) => {
        const fullName = (input?.fullName ?? assetClientFullName).trim();
        if (!fullName) {
            setAlert('⚠️ Nom requis.');
            return;
        }
        const phone = (input?.phone ?? assetClientPhone).trim();
        const email = (input?.email ?? assetClientEmail).trim();
        const notes = (input?.notes ?? assetClientNotes).trim();
        setIsSaving(true);
        try {
            const clientRef = await userDocRef.collection('manual_asset_clients').add({
                assetId,
                fullName,
                phone,
                email,
                notes,
                createdAt: Date.now()
            });
            const initialBal = typeof input?.balance === 'number' ? input.balance : parseFloat(assetClientBalance);
            if (!Number.isNaN(initialBal) && initialBal !== 0) {
                const nowTs = new Date();
                await userDocRef.collection('actifTransactions').add({
                    actifId: assetId,
                    clientId: clientRef.id,
                    type: 'adjustment',
                    amount: initialBal,
                    date: nowTs.toLocaleDateString('fr-FR'),
                    time: nowTs.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                    timestamp: nowTs.getTime(),
                    notes: 'Solde Initial'
                });
            }
            setAlert('✅ Client ajouté.');
            setIsAssetClientModalOpen(false);
            return true;
        }
        catch (e) {
            setAlert('❌ Erreur lors de l’ajout du client.');
            return false;
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleUpdateAssetClient = async (clientId: string, input?: AssetClientInput) => {
        const existingClient = manualAssetClients.find((c) => c.id === clientId);
        const targetAssetId = existingClient?.assetId || assetClientAssetId;
        const fullName = (input?.fullName ?? assetClientFullName).trim();
        const phone = (input?.phone ?? assetClientPhone).trim();
        const email = (input?.email ?? assetClientEmail).trim();
        const notes = (input?.notes ?? assetClientNotes).trim();
        setIsSaving(true);
        try {
            await userDocRef.collection('manual_asset_clients').doc(clientId).update({
                fullName,
                phone,
                email,
                notes,
                updatedAt: Date.now()
            });
            const currentBalance = assetClientBalances.get(`${targetAssetId}_${clientId}`) || 0;
            const newBalance = typeof input?.balance === 'number' ? input.balance : parseFloat(assetClientBalance);
            if (!Number.isNaN(newBalance) && Math.abs(newBalance - currentBalance) > 0.01) {
                const nowTs = new Date();
                await userDocRef.collection('actifTransactions').add({
                    actifId: targetAssetId,
                    clientId,
                    type: 'adjustment',
                    amount: newBalance - currentBalance,
                    date: nowTs.toLocaleDateString('fr-FR'),
                    time: nowTs.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                    timestamp: nowTs.getTime(),
                    notes: 'Ajustement manuel du solde'
                });
            }
            setAlert('✅ Client mis à jour.');
            setIsAssetClientModalOpen(false);
            return true;
        }
        catch (e) {
            setAlert('❌ Erreur lors de la mise à jour du client.');
            return false;
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleDeleteAssetClient = async (clientId: string) => {
        const client = manualAssetClients.find((c) => c.id === clientId);
        if (!client)
            return;
        setIsSaving(true);
        try {
            const bal = assetClientBalances.get(`${client.assetId}_${clientId}`) || 0;
            await userDocRef.collection('manual_asset_clients').doc(clientId).update({
                archived: true,
                archivedAt: Date.now(),
                archivedReason: Math.abs(bal) > 0.01 ? 'user_delete_with_open_balance' : 'user_delete',
            });
            setAlert('✅ Client archivé (historique financier conservé).');
            return true;
        }
        catch (e) {
            setAlert('❌ Erreur lors de la suppression du client.');
            return false;
        }
        finally {
            setIsSaving(false);
        }
    };
    const openAssetClientModal = (assetId: string, client: ManualAssetClient | null = null) => {
        setAssetClientAssetId(assetId);
        setEditingAssetClient(client);
        if (client) {
            setAssetClientFullName(client.fullName);
            setAssetClientPhone(client.phone || '');
            setAssetClientEmail(client.email || '');
            setAssetClientNotes(client.notes || '');
            setAssetClientBalance((assetClientBalances.get(`${assetId}_${client.id}`) || 0).toString());
        }
        else {
            setAssetClientFullName('');
            setAssetClientPhone('');
            setAssetClientEmail('');
            setAssetClientNotes('');
            setAssetClientBalance('0');
        }
        setIsAssetClientModalOpen(true);
    };
    return {
        isSaving,
        isAssetModalOpen,
        setIsAssetModalOpen,
        editingAsset,
        setEditingAsset,
        isAssetClientModalOpen,
        setIsAssetClientModalOpen,
        editingAssetClient,
        setEditingAssetClient,
        isCreateAssetModalOpen,
        setIsCreateAssetModalOpen,
        newAssetName,
        setNewAssetName,
        newAssetDescription,
        setNewAssetDescription,
        assetClientBalance,
        setAssetClientBalance,
        assetClientAssetId,
        setAssetClientAssetId,
        handleCreateAsset,
        handleDeleteAsset,
        openAssetClientModal,
        closeAssetClientModal,
        handleCreateAssetClient,
        handleUpdateAssetClient,
        handleDeleteAssetClient,
        handleCreateAssetTransaction
    };
}
