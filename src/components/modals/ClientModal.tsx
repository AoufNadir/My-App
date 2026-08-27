import React from 'react';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { ClientDzd } from '../../types';
interface ClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    isSaving: boolean;
    editingClient: ClientDzd | null;
    clientFullName: string;
    setClientFullName: (v: string) => void;
    clientPhone: string;
    setClientPhone: (v: string) => void;
    clientRedotpayId: string;
    setClientRedotpayId: (v: string) => void;
    clientBinanceEmail: string;
    setClientBinanceEmail: (v: string) => void;
    initialBalance: string;
    setInitialBalance: (v: string) => void;
    clientBalanceInput: string;
    setClientBalanceInput: (v: string) => void;
    onSave: () => void;
}
export function ClientModal({ isOpen, onClose, isSaving, editingClient, clientFullName, setClientFullName, clientPhone, setClientPhone, clientRedotpayId, setClientRedotpayId, clientBinanceEmail, setClientBinanceEmail, initialBalance, setInitialBalance, clientBalanceInput, setClientBalanceInput, onSave }: ClientModalProps) {
    return (<Modal isOpen={isOpen} onClose={onClose} className="max-w-md bg-surface text-neutral-900">
            <ModalHeader onClose={onClose}>
                    <ModalTitle className="text-xl font-bold">
                        {editingClient ? "Modifier le client" : "Ajouter un nouveau client"}
                    </ModalTitle>
                </ModalHeader>

            <ModalContent className="space-y-4 px-6 py-4">
                    {/* Client Form Fields */}
                    <div>
                        <Label>Nom Complet</Label>
                        <Input value={clientFullName} onChange={e => setClientFullName(e.target.value)}/>
                    </div>
                    {/* ... Other fields (Phone, ID, Balance) ... */}
                </ModalContent>

                <ModalFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>Annuler</Button>
                    <Button onClick={onSave} disabled={isSaving} className="font-bold">
                        {isSaving ? "Enregistrement..." : (editingClient ? "Mettre à jour" : "Ajouter")}
                    </Button>
                </ModalFooter>
        </Modal>);
}
