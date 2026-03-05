import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { PlusIcon } from '../icons/PlusIcon';
import type { ClientDzd } from '../../types';

type PaymentStatus = 'credit' | 'baridi' | 'cash';

type ClientLinkerProps = {
    linkedClientId: string;
    setLinkedClientId: (clientId: string) => void;
    linkedClientDzdId: string;
    setLinkedClientDzdId: (clientId: string) => void;
    openClientModal: (client: ClientDzd | null) => void;
    clientsDzd: ClientDzd[];
    fieldBase: string;
    isDark: boolean;
    clientPaymentStatus: PaymentStatus;
    setClientPaymentStatus: (status: PaymentStatus) => void;
    errorMessage?: string;
    hasError?: boolean;
    errorMessageDzd?: string;
    hasErrorDzd?: boolean;
};

const getClientName = (client: ClientDzd) => {
    if (client.fullName && client.fullName.trim()) return client.fullName;
    return client.nom || '';
};

const normalizeText = (value: string) => value.toLowerCase().trim();

export function ClientLinker({
    linkedClientId,
    setLinkedClientId,
    linkedClientDzdId,
    setLinkedClientDzdId,
    openClientModal,
    clientsDzd,
    fieldBase,
    isDark,
    clientPaymentStatus,
    setClientPaymentStatus,
    errorMessage,
    hasError,
    errorMessageDzd,
    hasErrorDzd,
}: ClientLinkerProps) {
    const [primaryClientSearch, setPrimaryClientSearch] = useState('');
    const [linkedDzdClientSearch, setLinkedDzdClientSearch] = useState('');

    const hasPrimaryClient = Boolean(linkedClientId && linkedClientId !== 'none');
    const showLinkedDzdClient = hasPrimaryClient && clientPaymentStatus === 'cash';

    const filteredPrimaryClients = useMemo(() => {
        const q = normalizeText(primaryClientSearch);
        let result = !q
            ? clientsDzd
            : clientsDzd.filter((client) => normalizeText(getClientName(client)).includes(q));

        if (linkedClientId !== 'none' && !result.some((client) => client.id === linkedClientId)) {
            const selectedClient = clientsDzd.find((client) => client.id === linkedClientId);
            if (selectedClient) result = [selectedClient, ...result];
        }
        return result;
    }, [clientsDzd, primaryClientSearch, linkedClientId]);

    const filteredDzdClients = useMemo(() => {
        const q = normalizeText(linkedDzdClientSearch);
        let result = !q
            ? clientsDzd
            : clientsDzd.filter((client) => normalizeText(getClientName(client)).includes(q));

        if (linkedClientDzdId !== 'none' && !result.some((client) => client.id === linkedClientDzdId)) {
            const selectedClient = clientsDzd.find((client) => client.id === linkedClientDzdId);
            if (selectedClient) result = [selectedClient, ...result];
        }
        return result;
    }, [clientsDzd, linkedDzdClientSearch, linkedClientDzdId]);

    return (
        <div className="pb-2 space-y-2">
            <div>
                <Label htmlFor="primary_client_buy">Client principal</Label>
                <Input
                    value={primaryClientSearch}
                    onChange={(e) => setPrimaryClientSearch(e.target.value)}
                    placeholder="Rechercher un client..."
                    className={`${fieldBase} h-9 mb-2`}
                />
                <div className="flex items-center gap-2">
                    <Select
                        id="primary_client_buy"
                        value={linkedClientId}
                        onChange={(e) => setLinkedClientId(e.target.value)}
                        className={`${fieldBase} focus:ring-amber-400 rounded-xl flex-grow ${hasError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    >
                        <option value="none">Aucun / Sans client</option>
                        {filteredPrimaryClients.map((client) => (
                            <option key={client.id} value={client.id}>
                                {getClientName(client)}
                            </option>
                        ))}
                        {filteredPrimaryClients.length === 0 && (
                            <option value="none" disabled>Aucun client trouve</option>
                        )}
                    </Select>
                    <Button
                        type="button"
                        onClick={() => openClientModal(null)}
                        className={`p-2.5 h-10 w-10 rounded-xl shrink-0 transition-colors ${isDark ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                    >
                        <PlusIcon className="w-5 h-5" />
                    </Button>
                </div>
                {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
            </div>

            {hasPrimaryClient && (
                <div>
                    <Label>Statut du Paiement Client</Label>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setClientPaymentStatus('credit')}
                            className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${clientPaymentStatus === 'credit' ? (isDark ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-amber-100 border-amber-500 text-amber-700') : (isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}
                        >
                            Credit
                        </button>
                        <button
                            type="button"
                            onClick={() => setClientPaymentStatus('baridi')}
                            className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${clientPaymentStatus === 'baridi' ? (isDark ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-blue-100 border-blue-500 text-blue-700') : (isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}
                        >
                            Regle Baridi
                        </button>
                        <button
                            type="button"
                            onClick={() => setClientPaymentStatus('cash')}
                            className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${clientPaymentStatus === 'cash' ? (isDark ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-green-100 border-green-500 text-green-700') : (isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}
                        >
                            Regle Cash
                        </button>
                    </div>
                </div>
            )}

            {showLinkedDzdClient && (
                <div>
                    <Label htmlFor="link_client_dzd_cash">Lier a un client DZD</Label>
                    <Input
                        value={linkedDzdClientSearch}
                        onChange={(e) => setLinkedDzdClientSearch(e.target.value)}
                        placeholder="Rechercher un client..."
                        className={`${fieldBase} h-9 mb-2`}
                    />
                    <Select
                        id="link_client_dzd_cash"
                        value={linkedClientDzdId}
                        onChange={(e) => setLinkedClientDzdId(e.target.value)}
                        className={`${fieldBase} focus:ring-amber-400 rounded-xl ${hasErrorDzd ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    >
                        <option value="none">Choisir un client DZD</option>
                        {filteredDzdClients.map((client) => (
                            <option key={client.id} value={client.id}>
                                {getClientName(client)}
                            </option>
                        ))}
                        {filteredDzdClients.length === 0 && (
                            <option value="none" disabled>Aucun client trouve</option>
                        )}
                    </Select>
                    {errorMessageDzd && <p className="text-red-500 text-xs mt-1">{errorMessageDzd}</p>}
                </div>
            )}
        </div>
    );
}
