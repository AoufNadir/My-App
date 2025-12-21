
import React from 'react';
import { Button } from '../../../components/ui/Button';
import { ArrowDownLeftIcon } from '../../../components/icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../../../components/icons/ArrowUpRightIcon';
import { PlusCircleIcon } from '../../../components/icons/PlusCircleIcon';
import { BriefcaseIcon } from '../../../components/icons/BriefcaseIcon';
import { CalendarIcon } from '../../../components/icons/CalendarIcon';
import { useLanguage } from '../../contexts/LanguageContext';

interface QuickActionsProps {
    onAction: (action: string) => void;
    isDark: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAction, isDark }) => {
    const { t } = useLanguage();

    const actions = [
        {
            id: 'buy_usdt',
            label: t('transactions.buyUsdt'),
            icon: <ArrowDownLeftIcon className="w-6 h-6" />,
            color: 'bg-green-600',
            hoverColor: 'hover:bg-green-700',
        },
        {
            id: 'sell_usdt',
            label: t('transactions.sellUsdt'),
            icon: <ArrowUpRightIcon className="w-6 h-6" />,
            color: 'bg-red-600',
            hoverColor: 'hover:bg-red-700',
        },
        {
            id: 'add_client',
            label: t('common.newClient'), // Assuming this key exists, or use raw string
            icon: <PlusCircleIcon className="w-6 h-6" />,
            color: 'bg-indigo-600',
            hoverColor: 'hover:bg-indigo-700',
        },
        {
            id: 'treasury',
            label: t('menu.treasury'),
            icon: <BriefcaseIcon className="w-6 h-6" />,
            color: 'bg-slate-600',
            hoverColor: 'hover:bg-slate-700',
        }
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {actions.map((action) => (
                <Button
                    key={action.id}
                    onClick={() => onAction(action.id)}
                    className={`
            relative overflow-hidden group py-6 rounded-xl shadow-sm transition-all duration-300
            ${isDark ? 'bg-gray-800' : 'bg-white'}
            hover:shadow-md hover:scale-[1.02]
          `}
                >
                    <div className={`
            absolute top-0 left-0 w-1 h-full
            ${action.color}
          `} />

                    <div className="flex flex-col items-center gap-3">
                        <div className={`
              p-3 rounded-full text-white shadow-sm
              ${action.color} ${action.hoverColor} transition-colors
            `}>
                            {action.icon}
                        </div>
                        <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                            {action.label}
                        </span>
                    </div>
                </Button>
            ))}
        </div>
    );
};
