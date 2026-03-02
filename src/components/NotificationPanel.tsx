import React from 'react';
import { motion } from 'framer-motion';
import { BellIcon } from './icons/BellIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XIcon } from './icons/XIcon';
import { InfoIcon } from './icons/InfoIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { AlertCircleIcon } from './icons/AlertCircleIcon';
import { Button } from './ui/Button';
import { Notification } from '../types';

interface NotificationPanelProps {
    notifications: Notification[];
    onClose: () => void;
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    isDark: boolean;
}

export function NotificationPanel({
    notifications, onClose, onMarkAsRead, onMarkAllAsRead, isDark
}: NotificationPanelProps) {
    const getIcon = (type: string) => {
        switch (type) {
            case 'client_debt_critical': return <AlertCircleIcon className="w-5 h-5 text-red-500" />;
            case 'client_debt_warning': return <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />;
            case 'profit_loss': return <CheckIcon className="w-5 h-5 text-green-500" />;
            default: return <InfoIcon className="w-5 h-5 text-blue-500" />;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`absolute right-0 mt-2 w-[320px] sm:w-[380px] max-h-[500px] overflow-hidden rounded-2xl shadow-2xl border z-50 flex flex-col ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                }`}
        >
            <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-2">
                    <BellIcon className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                    <h3 className="font-bold">Notifications</h3>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={onMarkAllAsRead} className="text-xs">Tout lire</Button>
                    <Button variant="ghost" size="sm" onClick={onClose} className="p-1 h-auto"><XIcon className="w-4 h-4" /></Button>
                </div>
            </div>

            <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                        <CheckIcon className="w-8 h-8 mx-auto text-slate-400" />
                        <p className="text-slate-500 text-sm">Aucune nouvelle notification</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800/50">
                        {notifications.map(n => (
                            <div
                                key={n.id}
                                className={`p-4 transition-colors relative group ${!n.read ? (isDark ? 'bg-slate-800/30' : 'bg-slate-50') : ''
                                    } ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
                            >
                                <div className="flex gap-3">
                                    <div className="mt-1">{getIcon(n.type)}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm leading-tight mb-1">{n.title}</p>
                                        <p className={`text-xs leading-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{n.message}</p>
                                        <p className="text-[10px] text-slate-500 mt-2">
                                            {new Date(n.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    {!n.read && (
                                        <button
                                            onClick={() => onMarkAsRead(n.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-slate-500/10 transition-all"
                                        >
                                            <CheckIcon className="w-4 h-4 text-sky-500" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
