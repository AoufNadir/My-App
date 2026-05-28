import React from 'react';
import { Button } from '../ui/Button';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { PlusCircleIcon } from '../icons/PlusCircleIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { useLanguage } from '../../contexts/LanguageContext';
interface QuickActionsProps {
    onAction: (action: string) => void;
}
export const QuickActions: React.FC<QuickActionsProps> = ({ onAction }) => {
    const { t } = useLanguage();
    const actions = [
        {
            id: 'buy_usdt',
            label: t('transactions.buyUsdt'),
            icon: <ArrowDownLeftIcon className="w-6 h-6"/>,
            color: 'bg-financial-profit',
            hoverColor: 'hover:bg-success',
        },
        {
            id: 'sell_usdt',
            label: t('transactions.sellUsdt'),
            icon: <ArrowUpRightIcon className="w-6 h-6"/>,
            color: 'bg-financial-loss',
            hoverColor: 'hover:bg-danger',
        },
        {
            id: 'add_client',
            label: t('common.newClient'), // Assuming this key exists, or use raw string
            icon: <PlusCircleIcon className="w-6 h-6"/>,
            color: 'bg-primary',
            hoverColor: 'hover:bg-primary-dark',
        },
        {
            id: 'treasury',
            label: t('menu.treasury'),
            icon: <BriefcaseIcon className="w-6 h-6"/>,
            color: 'bg-secondary',
            hoverColor: 'hover:bg-secondary-dark',
        }
    ];
    return (<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {actions.map((action) => (<Button key={action.id} onClick={() => onAction(action.id)} className={`
            relative overflow-hidden group py-6 rounded-xl shadow-sm transition-all duration-300
            bg-surface text-neutral-900 border border-border
            hover:shadow-md hover:scale-[1.02]
          `}>
                    <div className={`
            absolute top-0 left-0 w-1 h-full
            ${action.color}
          `}/>

                    <div className="flex flex-col items-center gap-3">
                        <div className={`
              p-3 rounded-full text-white shadow-sm
              ${action.color} ${action.hoverColor} transition-colors
            `}>
                            {action.icon}
                        </div>
                        <span className="font-semibold text-neutral-700">
                            {action.label}
                        </span>
                    </div>
                </Button>))}
        </div>);
};
