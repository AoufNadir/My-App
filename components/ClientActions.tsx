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
  isDark?: boolean;
};

export const ClientActions: React.FC<Props> = ({ variant = 'list', onOperation, onExport, onTransfer, onSettlement }) => {
  if (variant === 'detail') {
    return (
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Button
          onClick={onOperation}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
        >
          <PlusIcon className="w-5 h-5" /> Opération
        </Button>
        <Button
          onClick={onExport}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
        >
          Exporter
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 mb-3">
      <Button
        onClick={() => onSettlement && onSettlement('reçu')}
        className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl shadow-md transition-all"
      >
        <ArrowDownIcon className="w-4 h-4" />
        <span className="text-sm">Règlement</span>
      </Button>
      <Button
        onClick={() => onSettlement && onSettlement('effectué')}
        className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl shadow-md transition-all"
      >
        <ArrowUpIcon className="w-4 h-4" />
        <span className="text-sm">Paiement</span>
      </Button>
      <Button
        onClick={onTransfer}
        className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold py-3 rounded-xl shadow-md transition-all"
      >
        <ArrowRightLeftIcon className="w-5 h-5" />
        <span className="text-sm">Transfert</span>
      </Button>
    </div>
  );
};

export default ClientActions;
