import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';

type ClientFormData = {
  fullName: string;
  phone: string;
  email: string;
  notes: string;
  balance: string;
};

type ManualAssetClientDialogsProps = {
  isDark: boolean;
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

export function ManualAssetClientDialogs({
  isDark,
  cardBase,
  fieldBase,
  subtleText,
  isCreateClientModalOpen,
  isEditClientModalOpen,
  clientForm,
  setClientForm,
  onCloseCreateModal,
  onCloseEditModal,
  onCreate,
  onUpdate
}: ManualAssetClientDialogsProps) {
  return (
    <>
      <Dialog isOpen={isCreateClientModalOpen} onClose={onCloseCreateModal} className={`${cardBase} max-w-md`}>
        <DialogHeader onClose={onCloseCreateModal} isDark={isDark}>
          <DialogTitle>Nouveau Client</DialogTitle>
        </DialogHeader>
        <DialogContent className="px-6 pb-6 space-y-4">
          <div><Label>Nom Complet</Label><Input value={clientForm.fullName} onChange={(e) => setClientForm((prev) => ({ ...prev, fullName: e.target.value }))} className={fieldBase} placeholder="Ex: Agence X" /></div>
          <div><Label>Telephone (Optionnel)</Label><Input value={clientForm.phone} onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))} className={fieldBase} /></div>
          <div><Label>Email (Optionnel)</Label><Input value={clientForm.email} onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))} className={fieldBase} /></div>
          <div><Label>Notes (Optionnel)</Label><Input value={clientForm.notes} onChange={(e) => setClientForm((prev) => ({ ...prev, notes: e.target.value }))} className={fieldBase} /></div>
        </DialogContent>
        <DialogFooter>
          <Button onClick={onCreate} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">Creer le Client</Button>
        </DialogFooter>
      </Dialog>

      <Dialog isOpen={isEditClientModalOpen} onClose={onCloseEditModal} className={`${cardBase} max-w-md`}>
        <DialogHeader onClose={onCloseEditModal} isDark={isDark}>
          <DialogTitle>Modifier le Client</DialogTitle>
        </DialogHeader>
        <DialogContent className="px-6 pb-6 space-y-4">
          <div><Label>Nom Complet</Label><Input value={clientForm.fullName} onChange={(e) => setClientForm((prev) => ({ ...prev, fullName: e.target.value }))} className={fieldBase} /></div>
          <div><Label>Telephone</Label><Input value={clientForm.phone} onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))} className={fieldBase} /></div>
          <div><Label>Email</Label><Input value={clientForm.email} onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))} className={fieldBase} /></div>
          <div><Label>Notes</Label><Input value={clientForm.notes} onChange={(e) => setClientForm((prev) => ({ ...prev, notes: e.target.value }))} className={fieldBase} /></div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <Label className="text-amber-500">Ajustement Manuel du Solde</Label>
            <Input
              value={clientForm.balance}
              onChange={(e) => setClientForm((prev) => ({ ...prev, balance: e.target.value }))}
              className={`${fieldBase} font-mono font-bold`}
              placeholder="0.00"
            />
            <p className={`text-xs mt-1 ${subtleText}`}>
              Modifiez cette valeur uniquement pour corriger une erreur. Une transaction d'ajustement sera creee automatiquement.
            </p>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button onClick={onUpdate} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">Enregistrer les modifications</Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
