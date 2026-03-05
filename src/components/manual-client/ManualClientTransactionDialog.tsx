import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { NumberInput } from '../ui/NumberInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { ManualAssetTransaction } from '../../types';

type TransactionType = 'service' | 'payment_received';
type PaymentMethod = 'cash' | 'baridi' | 'credit';

type ManualClientTransactionDialogProps = {
  isDark: boolean;
  cardBase: string;
  fieldBase: string;
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
  onClose: () => void;
  onSave: () => void;
};

export function ManualClientTransactionDialog({
  isDark,
  cardBase,
  fieldBase,
  isTxModalOpen,
  editingTx,
  txType,
  setTxType,
  amount,
  setAmount,
  serviceType,
  setServiceType,
  notes,
  setNotes,
  paymentMethod,
  setPaymentMethod,
  onClose,
  onSave
}: ManualClientTransactionDialogProps) {
  return (
    <Dialog isOpen={isTxModalOpen} onClose={onClose} className={`${cardBase} max-w-md`}>
      <DialogHeader onClose={onClose} isDark={isDark}>
        <DialogTitle>{editingTx ? "Modifier l'Operation" : 'Nouvelle Operation'}</DialogTitle>
      </DialogHeader>
      <DialogContent className="px-6 pb-6 space-y-4">
        <div>
          <Label>Type d'Operation</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTxType('service')}
              className={`p-3 rounded-xl border font-bold text-sm transition-all ${txType === 'service' ? 'bg-indigo-600 text-white border-indigo-600' : `${fieldBase} opacity-70`}`}
            >
              Service / Vente
            </button>
            <button
              onClick={() => setTxType('payment_received')}
              className={`p-3 rounded-xl border font-bold text-sm transition-all ${txType === 'payment_received' ? 'bg-green-600 text-white border-green-600' : `${fieldBase} opacity-70`}`}
            >
              Reglement Recu
            </button>
          </div>
        </div>

        {txType === 'service' && (
          <div>
            <Label>Type de Service</Label>
            <Input value={serviceType} onChange={(e) => setServiceType(e.target.value)} className={fieldBase} placeholder="Ex: Conception, Impression..." />
          </div>
        )}

        <div>
          <Label>Montant (DZD)</Label>
          <NumberInput value={amount} onChange={(e) => setAmount(e.target.value)} className={`${fieldBase} text-center text-2xl font-bold`} placeholder="0.00" />
        </div>

        {txType !== 'service' && (
          <div>
            <Label>Mode de Paiement</Label>
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className={fieldBase}>
              <option value="cash">Especes</option>
              <option value="baridi">BaridiMob</option>
            </Select>
          </div>
        )}

        <div>
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldBase} />
        </div>
      </DialogContent>
      <DialogFooter>
        <Button onClick={onSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">Confirmer</Button>
      </DialogFooter>
    </Dialog>
  );
}
