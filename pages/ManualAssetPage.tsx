import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { PlusIcon } from '../components/icons/PlusIcon';
import { SearchIcon } from '../components/icons/SearchIcon';
import { UserIcon } from '../components/icons/UserIcon';
import { Trash2Icon } from '../components/icons/Trash2Icon';
import { SwipeableListItem } from '../components/ui/SwipeableListItem';
import { ManualAsset, ManualAssetClient } from '../types';

type ManualAssetPageProps = {
    asset: ManualAsset;
    clients: ManualAssetClient[];
    clientBalances: Map<string, number>;
    onBack: () => void;
    onSelectClient: (client: ManualAssetClient) => void;
    onCreateClient: (fullName: string, phone?: string, email?: string, notes?: string) => void;
    onUpdateClient: (clientId: string, data: { fullName: string, phone?: string, email?: string, notes?: string, balance?: number }) => void;
    onDeleteClient: (clientId: string) => void;
    isDark: boolean;
    cardBase: string;
    fieldBase: string;
    subtleText: string;
};

export function ManualAssetPage({
    asset,
    clients,
    clientBalances,
    onBack,
    onSelectClient,
    onCreateClient,
    onUpdateClient,
    onDeleteClient,
    isDark,
    cardBase,
    fieldBase,
    subtleText
}: ManualAssetPageProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateClientModalOpen, setIsCreateClientModalOpen] = useState(false);
    const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<ManualAssetClient | null>(null);

    // Form State
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [clientNotes, setClientNotes] = useState('');
    const [clientBalanceInput, setClientBalanceInput] = useState('');

    const filteredClients = clients.filter(c =>
        c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(searchQuery))
    );

    const totalBalance = Array.from(clientBalances.values()).reduce((acc, val) => acc + val, 0);
    const totalClients = clients.length;

    const openCreateModal = () => {
        setClientName('');
        setClientPhone('');
        setClientEmail('');
        setClientNotes('');
        setClientBalanceInput('');
        setIsCreateClientModalOpen(true);
    };

    const openEditModal = (client: ManualAssetClient) => {
        setEditingClient(client);
        setClientName(client.fullName);
        setClientPhone(client.phone || '');
        setClientEmail(client.email || '');
        setClientNotes(client.notes || '');
        const currentBalance = clientBalances.get(`${asset.id}_${client.id}`) || 0;
        setClientBalanceInput(currentBalance.toString());
        setIsEditClientModalOpen(true);
    };

    const handleCreate = () => {
        if (!clientName.trim()) return;
        onCreateClient(clientName, clientPhone, clientEmail, clientNotes);
        setIsCreateClientModalOpen(false);
    };

    const handleUpdate = () => {
        if (!editingClient || !clientName.trim()) return;

        const balance = parseFloat(clientBalanceInput.replace(',', '.'));
        const updateData: any = {
            fullName: clientName,
            phone: clientPhone,
            email: clientEmail,
            notes: clientNotes
        };

        if (!isNaN(balance)) {
            updateData.balance = balance;
        }

        onUpdateClient(editingClient.id, updateData);
        setIsEditClientModalOpen(false);
        setEditingClient(null);
    };

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button onClick={onBack} className={`p-2 rounded-full ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
                    <ArrowLeftIcon className="w-6 h-6" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{asset.name}</h1>
                    <p className={`text-sm ${subtleText}`}>{asset.description || 'Gestion des clients et opérations'}</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className={`text-sm font-medium mb-1 ${subtleText}`}>Solde Total (Estimé)</div>
                    <div className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {totalBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} <span className="text-sm text-gray-500">DZD</span>
                    </div>
                </div>
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className={`text-sm font-medium mb-1 ${subtleText}`}>Nombre de Clients</div>
                    <div className="text-2xl font-bold">{totalClients}</div>
                </div>
            </div>

            {/* Clients List Section */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:w-auto flex-1">
                        <SearchIcon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${subtleText}`} />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`${fieldBase} pl-9 w-full`}
                            placeholder="Rechercher un client..."
                        />
                    </div>
                    <Button onClick={openCreateModal} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2">
                        <PlusIcon className="w-5 h-5" /> Nouveau Client
                    </Button>
                </div>

                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                    {filteredClients.length > 0 ? (
                        filteredClients.map(client => {
                            const balance = clientBalances.get(`${asset.id}_${client.id}`) || 0;
                            return (
                                <div key={client.id}>
                                    <SwipeableListItem
                                        onEdit={() => openEditModal(client)}
                                        onDelete={() => onDeleteClient(client.id)}
                                    >
                                        <div className={`p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer`} onClick={() => onSelectClient(client)}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                                    <UserIcon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="font-bold">{client.fullName}</div>
                                                    <div className={`text-xs ${subtleText}`}>{client.phone || 'Pas de téléphone'}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className={`text-right font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} <span className="text-xs opacity-70">DZD</span>
                                                </div>
                                            </div>
                                        </div>
                                    </SwipeableListItem>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-8 text-center opacity-50">
                            Aucun client trouvé.
                        </div>
                    )}
                </div>
            </div>

            {/* Create Client Modal */}
            <Dialog isOpen={isCreateClientModalOpen} onClose={() => setIsCreateClientModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsCreateClientModalOpen(false)} isDark={isDark}>
                    <DialogTitle>Nouveau Client</DialogTitle>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div><Label>Nom Complet</Label><Input value={clientName} onChange={e => setClientName(e.target.value)} className={fieldBase} placeholder="Ex: Agence X" /></div>
                    <div><Label>Téléphone (Optionnel)</Label><Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className={fieldBase} /></div>
                    <div><Label>Email (Optionnel)</Label><Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} className={fieldBase} /></div>
                    <div><Label>Notes (Optionnel)</Label><Input value={clientNotes} onChange={e => setClientNotes(e.target.value)} className={fieldBase} /></div>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={handleCreate} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">Créer le Client</Button>
                </DialogFooter>
            </Dialog>

            {/* Edit Client Modal */}
            <Dialog isOpen={isEditClientModalOpen} onClose={() => setIsEditClientModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsEditClientModalOpen(false)} isDark={isDark}>
                    <DialogTitle>Modifier le Client</DialogTitle>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div><Label>Nom Complet</Label><Input value={clientName} onChange={e => setClientName(e.target.value)} className={fieldBase} /></div>
                    <div><Label>Téléphone</Label><Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className={fieldBase} /></div>
                    <div><Label>Email</Label><Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} className={fieldBase} /></div>
                    <div><Label>Notes</Label><Input value={clientNotes} onChange={e => setClientNotes(e.target.value)} className={fieldBase} /></div>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Label className="text-amber-500">Ajustement Manuel du Solde</Label>
                        <Input
                            value={clientBalanceInput}
                            onChange={e => setClientBalanceInput(e.target.value)}
                            className={`${fieldBase} font-mono font-bold`}
                            placeholder="0.00"
                        />
                        <p className={`text-xs mt-1 ${subtleText}`}>
                            Modifiez cette valeur uniquement pour corriger une erreur. Une transaction d'ajustement sera créée automatiquement.
                        </p>
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={handleUpdate} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">Enregistrer les modifications</Button>
                </DialogFooter>
            </Dialog>
        </motion.div>
    );
}
