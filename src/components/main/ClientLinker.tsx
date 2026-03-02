import React from 'react';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { PlusIcon } from '../icons/PlusIcon';
import type { ClientDzd } from '../../types';

type PaymentStatus = 'credit' | 'baridi' | 'cash';

type ClientLinkerProps = {
    linkedClientId: string;
    setLinkedClientId: (clientId: string) => void;
    openClientModal: (client: ClientDzd | null) => void;
    clientsDzd: ClientDzd[];
    fieldBase: string;
    isDark: boolean;
    clientPaymentStatus: PaymentStatus;
    setClientPaymentStatus: (status: PaymentStatus) => void;
    errorMessage?: string;
    hasError?: boolean;
};

export function ClientLinker({
    linkedClientId,
    setLinkedClientId,
    openClientModal,
    clientsDzd,
    fieldBase,
    isDark,
    clientPaymentStatus,
    setClientPaymentStatus,
    errorMessage,
    hasError,
}: ClientLinkerProps) {
    return (
        <div className="pb-2 space-y-2">
            <div>
                <Label htmlFor="link_client_buy">Lier à un client DZD</Label>
                <div className="flex items-center gap-2">
                    <Select
                        id="link_client_buy"
                        value={linkedClientId}
                        onChange={(e) => setLinkedClientId(e.target.value)}
                        className={`${fieldBase} focus:ring-amber-400 rounded-xl flex-grow ${hasError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    >
                        <option value="none">Aucun / Sans client</option>
                        {clientsDzd.map((client) => (
                            <option key={client.id} value={client.id}>
                                {client.fullName || client.nom}
                            </option>
                        ))}
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
            {linkedClientId && linkedClientId !== 'none' && (
                <div>
                    <Label>Statut du Paiement Client</Label>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setClientPaymentStatus('credit')}
                            className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${clientPaymentStatus === 'credit' ? (isDark ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-amber-100 border-amber-500 text-amber-700') : (isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}
                        >
                            Crédit
                        </button>
                        <button
                            type="button"
                            onClick={() => setClientPaymentStatus('baridi')}
                            className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${clientPaymentStatus === 'baridi' ? (isDark ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-blue-100 border-blue-500 text-blue-700') : (isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}
                        >
                            Réglé Baridi
                        </button>
                        <button
                            type="button"
                            onClick={() => setClientPaymentStatus('cash')}
                            className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${clientPaymentStatus === 'cash' ? (isDark ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-green-100 border-green-500 text-green-700') : (isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}
                        >
                            Réglé Cash
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

