import React from 'react';
import { Button } from './ui/Button';
import { PlusIcon } from './icons/PlusIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { ArrowDownIcon } from './icons/ArrowDownIcon';
import { ArrowUpIcon } from './icons/ArrowUpIcon';
type Props = {
    variant?: 'list' | 'detail';
    onOperation?: () => void;
    onExport?: () => void;
    onTransfer?: () => void;
    onSettlement?: (type: 'reçu' | 'effectué') => void;
};
export const ClientActions: React.FC<Props> = ({ variant = 'list', onOperation, onExport, onTransfer, onSettlement }) => {
    if (variant === 'detail') {
        return (<div className="grid grid-cols-2 gap-3 mb-4">
        <Button onClick={onOperation} variant="secondary" className="w-full gap-2 py-3.5 font-bold">
          <PlusIcon className="w-5 h-5"/> Opération
        </Button>
        <Button onClick={onExport} variant="danger" className="w-full gap-2 py-3.5 font-bold">
          Exporter
        </Button>
      </div>);
    }
    return (<div className="grid grid-cols-3 gap-2 mb-3">
      <Button onClick={() => onSettlement && onSettlement('reçu')} variant="secondary" className="gap-2 py-3 font-semibold">
        <ArrowDownIcon className="w-4 h-4"/>
        <span className="text-sm">Règlement</span>
      </Button>
      <Button onClick={() => onSettlement && onSettlement('effectué')} variant="danger" className="gap-2 py-3 font-semibold">
        <ArrowUpIcon className="w-4 h-4"/>
        <span className="text-sm">Paiement</span>
      </Button>
      <Button onClick={onTransfer} className="gap-2 py-3 font-semibold">
        <ArrowRightLeftIcon className="w-5 h-5"/>
        <span className="text-sm">Transfert</span>
      </Button>
    </div>);
};
export default ClientActions;
