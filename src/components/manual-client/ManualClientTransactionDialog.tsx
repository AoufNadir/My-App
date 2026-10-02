import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { MoneyField } from '../ui/MoneyField';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '../ui/Modal';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { ManualAssetTransaction } from '../../types';
import { describeServiceBalance, type ServiceBalanceKind } from '../../utils/serviceBalances';
import { useLanguage } from '../../contexts/LanguageContext';
type TransactionType = 'service' | 'payment_received';
type PaymentMethod = 'cash' | 'baridi' | 'credit';
type ManualClientTransactionDialogProps = {
    isTxModalOpen: boolean;
    editingTx: ManualAssetTransaction | null;
    txType: TransactionType;
    setTxType: (type: TransactionType) => void;
    amount: string;
    setAmount: (value: string) => void;
    serviceType: string;
    setServiceType: (value: string) => void;
    notes: string;
    setNotes: (value: string) => void;
    paymentMethod: PaymentMethod;
    setPaymentMethod: (method: PaymentMethod) => void;
    currentBalance: number;
    onClose: () => void;
    onSave: () => void;
};
export function ManualClientTransactionDialog({ isTxModalOpen, editingTx, txType, setTxType, amount, setAmount, serviceType, setServiceType, paymentMethod, setPaymentMethod, currentBalance, onClose, onSave }: ManualClientTransactionDialogProps) {
    const { t } = useLanguage();
    const subtleText = 'text-neutral-500';
    const parsedAmount = Number.parseFloat(amount.replace(/\s/g, '').replace(',', '.')) || 0;
    const signedAmount = txType === 'service' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
    const nextBalance = currentBalance + signedAmount;
    const currentBalanceView = describeServiceBalance(currentBalance);
    const nextBalanceView = describeServiceBalance(nextBalance);
    const serviceBalanceLabel = (kind: ServiceBalanceKind) => {
        if (kind === 'to_receive')
            return t('finance.toReceive');
        if (kind === 'client_advance')
            return t('finance.clientAdvance');
        return t('finance.settled');
    };
    const balanceSemantic = (kind: ServiceBalanceKind) => kind === 'to_receive'
        ? 'profit'
        : kind === 'client_advance'
            ? 'loss'
            : 'plain';
    const segItem = (active: boolean, activeClass: string) => `min-h-touch flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${active
        ? activeClass
        : 'text-neutral-600 hover:text-neutral-800'}`;
    return (<Modal isOpen={isTxModalOpen} onClose={onClose} className="max-w-md bg-surface">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{editingTx ? t('transactions.editOperation') : t('transactions.newOperation')}</ModalTitle>
      </ModalHeader>
      <ModalContent className="px-4 py-4 sm:px-5 space-y-4">
        <div>
          <Label>{t('transactions.operationType')}</Label>
          <div className="mt-1 flex gap-1 rounded-xl bg-neutral-100 p-1">
            <button type="button" onClick={() => setTxType('service')} className={segItem(txType === 'service', 'bg-danger text-white shadow-sm')}>
              {t('services.service')} / {t('transactions.sell')}
            </button>
            <button type="button" onClick={() => setTxType('payment_received')} className={segItem(txType === 'payment_received', 'bg-success text-white shadow-sm')}>
              {t('transactions.paymentReceived')}
            </button>
          </div>
        </div>

        {txType === 'service' && (<div>
            <Label>{t('services.serviceType')}</Label>
            <Input value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="mt-1" placeholder={t('services.servicePlaceholder') as string}/>
          </div>)}

        <MoneyField label={t('transactions.amount') as string} value={amount} onChange={setAmount} currency="DZD" placeholder="0.00"/>

        {txType !== 'service' && (<div>
            <Label>{t('services.paymentMethod')}</Label>
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="mt-1">
              <option value="cash">{t('services.cash')}</option>
              <option value="baridi">BaridiMob</option>
            </Select>
          </div>)}

        <div className="rounded-xl bg-surface-muted p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className={subtleText}>{t('transactions.currentBalance')}</span>
            <span className="font-semibold text-end">
              {serviceBalanceLabel(currentBalanceView.kind)}: <CurrencyAmount value={currentBalanceView.amount} currency="DZD" semantic={balanceSemantic(currentBalanceView.kind)} size="md"/>
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className={subtleText}>{t('services.afterConfirmation')}</span>
            <span className="font-bold text-end">
              {serviceBalanceLabel(nextBalanceView.kind)}: <CurrencyAmount value={nextBalanceView.amount} currency="DZD" semantic={balanceSemantic(nextBalanceView.kind)} size="md"/>
            </span>
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button onClick={onClose} variant="outline">
          {t('common.cancel')}
        </Button>
        <Button onClick={onSave}>
          {t('common.confirm')}
        </Button>
      </ModalFooter>
    </Modal>);
}
