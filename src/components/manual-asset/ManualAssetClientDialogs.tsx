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
    cardBase: string;
    fieldBase: string;
    subtleText: string;
    isCreateClientModalOpen: boolean;
    isEditClientModalOpen: boolean;
    clientForm: ClientFormData;
    setClientForm: (updater: (prev: ClientFormData) => ClientFormData) => void;
    onCloseCreateModal: () => void;
    onCloseEditModal: () => void;
    onCreate: () => void;
    onUpdate: () => void;
};
const headerClass = 'sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5';
const footerClass = 'sticky bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5';
export function ManualAssetClientDialogs({ cardBase, fieldBase, subtleText, isCreateClientModalOpen, isEditClientModalOpen, clientForm, setClientForm, onCloseCreateModal, onCloseEditModal, onCreate, onUpdate }: ManualAssetClientDialogsProps) {
    const cancelClass = 'flex-1 rounded-xl bg-neutral-100 py-3 font-bold text-neutral-700 transition-colors hover:bg-neutral-200';
    const confirmClass = 'flex-1 rounded-xl bg-primary py-3 font-bold text-white shadow-sm transition-colors hover:bg-primary-dark';
    return (<>
      <Modal isOpen={isCreateClientModalOpen} onClose={onCloseCreateModal} className="max-w-md bg-surface">
        <ModalHeader onClose={onCloseCreateModal} className={headerClass}>
          <ModalTitle className="text-base sm:text-lg">Nouveau Client</ModalTitle>
        </ModalHeader>
        <ModalContent className="px-4 py-4 sm:px-5 space-y-3">
          <div><Label>Nom Complet</Label><Input value={clientForm.fullName} onChange={(e) => setClientForm((prev) => ({ ...prev, fullName: e.target.value }))} className="mt-1" placeholder="Ex: Agence X"/></div>
          <div><Label>Téléphone <span className={`text-xs font-normal ${subtleText}`}>(Optionnel)</span></Label><Input value={clientForm.phone} onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))} className="mt-1" dir="ltr"/></div>
          <div><Label>Email <span className={`text-xs font-normal ${subtleText}`}>(Optionnel)</span></Label><Input value={clientForm.email} onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))} className="mt-1" dir="ltr"/></div>
        </ModalContent>
        <ModalFooter className={footerClass}>
          <div className="flex gap-2 w-full">
            <Button onClick={onCloseCreateModal} className={cancelClass}>Annuler</Button>
            <Button onClick={onCreate} className={confirmClass}>Créer le Client</Button>
          </div>
        </ModalFooter>
      </Modal>

      <Modal isOpen={isEditClientModalOpen} onClose={onCloseEditModal} className="max-w-md bg-surface">
        <ModalHeader onClose={onCloseEditModal} className={headerClass}>
          <ModalTitle className="text-base sm:text-lg">Modifier le Client</ModalTitle>
        </ModalHeader>
        <ModalContent className="px-4 py-4 sm:px-5 space-y-3">
          <div><Label>Nom Complet</Label><Input value={clientForm.fullName} onChange={(e) => setClientForm((prev) => ({ ...prev, fullName: e.target.value }))} className="mt-1"/></div>
          <div><Label>Téléphone</Label><Input value={clientForm.phone} onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))} className="mt-1" dir="ltr"/></div>
          <div><Label>Email</Label><Input value={clientForm.email} onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))} className="mt-1" dir="ltr"/></div>

          <div className="border-t border-border pt-3">
            <Label>Ajustement Manuel du Solde</Label>
            <NumberInput value={clientForm.balance} onChange={(e) => setClientForm((prev) => ({ ...prev, balance: e.target.value }))} className="mt-1 font-mono font-semibold" placeholder="0.00"/>
            <p className={`text-xs mt-1 ${subtleText}`}>
              Modifiez uniquement pour corriger une erreur. Une transaction d'ajustement sera créée automatiquement.
            </p>
          </div>
        </ModalContent>
        <ModalFooter className={footerClass}>
          <div className="flex gap-2 w-full">
            <Button onClick={onCloseEditModal} className={cancelClass}>Annuler</Button>
            <Button onClick={onUpdate} className={confirmClass}>Enregistrer</Button>
          </div>
        </ModalFooter>
      </Modal>
    </>);
}
