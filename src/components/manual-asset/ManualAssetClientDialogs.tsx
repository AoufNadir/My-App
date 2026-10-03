import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { NumberInput } from '../ui/NumberInput';
import { Label } from '../ui/Label';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '../ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';
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
    const { t } = useLanguage();
    const optional = <span className="text-xs font-normal text-neutral-500">({t('common.optional')})</span>;
    return (<>
      <Modal isOpen={isCreateClientModalOpen} onClose={onCloseCreateModal} className="max-w-md bg-surface">
        <ModalHeader onClose={onCloseCreateModal}>
          <ModalTitle className="text-base sm:text-lg">{t('common.newClient')}</ModalTitle>
        </ModalHeader>
        <ModalContent className="px-4 py-4 sm:px-5 space-y-3">
          <div><Label>{t('services.clientFullName')}</Label><Input value={clientForm.fullName} onChange={(e) => setClientForm((prev) => ({ ...prev, fullName: e.target.value }))} placeholder={t('services.clientNamePlaceholder') as string}/></div>
          <div><Label>{t('transactions.phone')} {optional}</Label><Input value={clientForm.phone} onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))} dir="ltr"/></div>
          <div><Label>{t('services.email')} {optional}</Label><Input value={clientForm.email} onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))} dir="ltr"/></div>
        </ModalContent>
        <ModalFooter>
          <Button onClick={onCloseCreateModal} variant="outline">{t('common.cancel')}</Button>
          <Button onClick={onCreate}>{t('services.createClient')}</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={isEditClientModalOpen} onClose={onCloseEditModal} className="max-w-md bg-surface">
        <ModalHeader onClose={onCloseEditModal}>
          <ModalTitle className="text-base sm:text-lg">{t('transactions.editClient')}</ModalTitle>
        </ModalHeader>
        <ModalContent className="px-4 py-4 sm:px-5 space-y-3">
          <div><Label>{t('services.clientFullName')}</Label><Input value={clientForm.fullName} onChange={(e) => setClientForm((prev) => ({ ...prev, fullName: e.target.value }))}/></div>
          <div><Label>{t('transactions.phone')}</Label><Input value={clientForm.phone} onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))} dir="ltr"/></div>
          <div><Label>{t('services.email')}</Label><Input value={clientForm.email} onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))} dir="ltr"/></div>

          <div className="border-t border-border pt-3">
            <Label>{t('services.manualBalanceAdjustment')}</Label>
            <NumberInput value={clientForm.balance} onChange={(e) => setClientForm((prev) => ({ ...prev, balance: e.target.value }))} className="font-semibold tabular-nums" placeholder="0.00"/>
            <p className="mt-1 text-xs text-neutral-500">
              {t('services.manualBalanceAdjustmentHint')}
            </p>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button onClick={onCloseEditModal} variant="outline">{t('common.cancel')}</Button>
          <Button onClick={onUpdate}>{t('common.save')}</Button>
        </ModalFooter>
      </Modal>
    </>);
}
