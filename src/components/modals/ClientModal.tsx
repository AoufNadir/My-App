import React from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { ClientDzd } from '../../types';

interface ClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    isSaving: boolean;
    isDark: boolean;
    editingClient: ClientDzd | null;
    clientFullName: string; setClientFullName: (v: string) => void;
    clientPhone: string; setClientPhone: (v: string) => void;
    clientRedotpayId: string; setClientRedotpayId: (v: string) => void;
    clientBinanceEmail: string; setClientBinanceEmail: (v: string) => void;
    initialBalance: string; setInitialBalance: (v: string) => void;
    clientBalanceInput: string; setClientBalanceInput: (v: string) => void;
    onSave: () => void;
}

export function ClientModal({
    isOpen, onClose, isSaving, isDark, editingClient,
    clientFullName, setClientFullName,
    clientPhone, setClientPhone,
    clientRedotpayId, setClientRedotpayId,
    clientBinanceEmail, setClientBinanceEmail,
    initialBalance, setInitialBalance,
    clientBalanceInput, setClientBalanceInput,
    onSave
}: ClientModalProps) {
    const fieldBase = isDark ? 'bg-[#0F172A] text-white border border-[#334155]' : 'bg-white text-gray-900 border border-[#CBD5E1]';

    return (
        <Dialog isOpen={isOpen} onClose={onClose}>
            <DialogContent className={`${isDark ? 'bg-[#111827] border-[#1F2937] text-white' : 'bg-white border-[#E5E7EB] text-gray-900'} max-w-md w-[95vw] rounded-2xl p-6`}>
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        {editingClient ? "Modifier le client" : "Ajouter un nouveau client"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 my-4">
                    {/* Client Form Fields */}
                    <div>
                        <Label>Nom Complet</Label>
                        <Input value={clientFullName} onChange={e => setClientFullName(e.target.value)} className={fieldBase} />
                    </div>
                    {/* ... Other fields (Phone, ID, Balance) ... */}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>Annuler</Button>
                    <Button onClick={onSave} disabled={isSaving} className="bg-sky-500 hover:bg-sky-600 text-white font-bold">
                        {isSaving ? "Enregistrement..." : (editingClient ? "Mettre à jour" : "Ajouter")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
