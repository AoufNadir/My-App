import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { NumberInput } from '../ui/NumberInput';
import { Label } from '../ui/Label';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '../ui/Modal';
type ClientFormData = {
    fullName: string;
    phone: string;
    email: string;
    notes: string;
    balance: string;
};
type ManualAssetClientDialogsProps = {
    isCreateClientModalOpen: boolean;
    isEditClientModalOpen: boolean;
    clientForm: ClientFormData;
    setClientForm: (updater: (prev: ClientFormData) => ClientFormData) => void;
    onCloseCreateModal: () => void;
    onCloseEditModal: () => void;
    onCreate: () => void;
    onUpdate: () => void;
};
export function ManualAssetClientDialogs({ isCreateClientModalOpen, isEditClientModalOpen, clientForm, setClientForm, onCloseCreateModal, onCloseEditModal, onCreate, onUpdate }: ManualAssetClientDialogsProps) {
    return (<>
      <Modal isOpen={isCreateClientModalOpen} onClose={onCloseCreateModal} className="max-w-md bg-surface">
        <ModalHeader onClose={onCloseCreateModal}>
          <ModalTitle className="text-base sm:text-lg">Nouveau Client</ModalTitle>
        </ModalHeader>
        <ModalContent className="px-4 py-4 sm:px-5 space-y-3">
          <div><Label>Nom Complet</Label><Input value={clientForm.fullName} onChange={(e) => setClientForm((prev) => ({ ...prev, fullName: e.target.value }))} className="mt-1" placeholder="Ex: Agence X"/></div>
          <div><Label>Téléphone <span className={`text-xs font-normal text-neutral-400`}>(Optionnel)</span></Label><Input value={clientForm.phone} onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))} className="mt-1" dir="ltr"/></div>
          <div><Label>Email <span className={`text-xs font-normal text-neutral-400`}>(Optionnel)</span></Label><Input value={clientForm.email} onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))} className="mt-1" dir="ltr"/></div>
        </ModalContent>
        <ModalFooter>
          <Button onClick={onCloseCreateModal} variant="outline">Annuler</Button>
          <Button onClick={onCreate}>Créer le Client</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={isEditClientModalOpen} onClose={onCloseEditModal} className="max-w-md bg-surface">
        <ModalHeader onClose={onCloseEditModal}>
          <ModalTitle className="text-base sm:text-lg">Modifier le Client</ModalTitle>
        </ModalHeader>
        <ModalContent className="px-4 py-4 sm:px-5 space-y-3">
          <div><Label>Nom Complet</Label><Input value={clientForm.fullName} onChange={(e) => setClientForm((prev) => ({ ...prev, fullName: e.target.value }))} className="mt-1"/></div>
          <div><Label>Téléphone</Label><Input value={clientForm.phone} onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))} className="mt-1" dir="ltr"/></div>
          <div><Label>Email</Label><Input value={clientForm.email} onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))} className="mt-1" dir="ltr"/></div>

          <div className="border-t border-border pt-3">
            <Label>Ajustement Manuel du Solde</Label>
            <NumberInput value={clientForm.balance} onChange={(e) => setClientForm((prev) => ({ ...prev, balance: e.target.value }))} className="mt-1 font-mono font-semibold" placeholder="0.00"/>
            <p className={`text-xs mt-1 text-neutral-500`}>
              Modifiez uniquement pour corriger une erreur. Une transaction d'ajustement sera créée automatiquement.
            </p>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button onClick={onCloseEditModal} variant="outline">Annuler</Button>
          <Button onClick={onUpdate}>Enregistrer</Button>
        </ModalFooter>
      </Modal>
    </>);
}
