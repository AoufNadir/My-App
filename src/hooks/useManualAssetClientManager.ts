import { useMemo, useState } from 'react';
import { ManualAssetClient } from '../types';
type ClientFormData = {
    fullName: string;
    phone: string;
    email: string;
    notes: string;
    balance: string;
};
type UpdatePayload = {
    fullName: string;
    phone?: string;
    email?: string;
    notes?: string;
    balance?: number;
};
type UseManualAssetClientManagerArgs = {
    assetId: string;
    clients: ManualAssetClient[];
    clientBalances: Map<string, number>;
    onCreateClient: (fullName: string, phone?: string, email?: string, notes?: string) => void;
    onUpdateClient: (clientId: string, data: UpdatePayload) => void;
};
function getEmptyClientForm(): ClientFormData {
    return { fullName: '', phone: '', email: '', notes: '', balance: '' };
}
function parseBalance(value: string): number | null {
    const parsed = parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
}
export function useManualAssetClientManager({ assetId, clients, clientBalances, onCreateClient, onUpdateClient }: UseManualAssetClientManagerArgs) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateClientModalOpen, setIsCreateClientModalOpen] = useState(false);
    const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<ManualAssetClient | null>(null);
    const [clientForm, setClientForm] = useState<ClientFormData>(getEmptyClientForm());
    const filteredClients = useMemo(() => {
        const activeClients = clients.filter((client) => client.archived !== true);
        const normalizedQuery = searchQuery.trim().toLowerCase();
        if (!normalizedQuery)
            return activeClients;
        return activeClients.filter((client) => client.fullName.toLowerCase().includes(normalizedQuery) ||
            (client.phone || '').includes(normalizedQuery));
    }, [clients, searchQuery]);
    const openCreateModal = () => {
        setClientForm(getEmptyClientForm());
        setIsCreateClientModalOpen(true);
    };
    const openEditModal = (client: ManualAssetClient) => {
        const currentBalance = clientBalances.get(`${assetId}_${client.id}`) || 0;
        setEditingClient(client);
        setClientForm({
            fullName: client.fullName,
            phone: client.phone || '',
            email: client.email || '',
            notes: client.notes || '',
            balance: currentBalance.toString()
        });
        setIsEditClientModalOpen(true);
    };
    const closeEditModal = () => {
        setIsEditClientModalOpen(false);
        setEditingClient(null);
        setClientForm(getEmptyClientForm());
    };
    const handleCreate = () => {
        if (!clientForm.fullName.trim())
            return;
        onCreateClient(clientForm.fullName, clientForm.phone, clientForm.email, clientForm.notes);
        setIsCreateClientModalOpen(false);
    };
    const handleUpdate = () => {
        if (!editingClient || !clientForm.fullName.trim())
            return;
        const parsedBalance = parseBalance(clientForm.balance);
        const payload: UpdatePayload = {
            fullName: clientForm.fullName,
            phone: clientForm.phone,
            email: clientForm.email,
            notes: clientForm.notes
        };
        if (parsedBalance !== null) {
            payload.balance = parsedBalance;
        }
        onUpdateClient(editingClient.id, payload);
        closeEditModal();
    };
    return {
        searchQuery,
        setSearchQuery,
        isCreateClientModalOpen,
        setIsCreateClientModalOpen,
        isEditClientModalOpen,
        clientForm,
        setClientForm,
        filteredClients,
        openCreateModal,
        openEditModal,
        closeEditModal,
        handleCreate,
        handleUpdate
    };
}
