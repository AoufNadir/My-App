import React from 'react';
import { XIcon } from './icons/XIcon';
import { CheckIcon } from './icons/CheckIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';

export interface Notification {
    id: string;
    type: 'client_debt_critical' | 'client_debt_warning' | 'low_cash' | 'pam_variation' | 'profit_loss';
    priority: 1 | 2 | 3; // 1=high, 2=medium, 3=low
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
    color: 'red' | 'yellow' | 'orange' | 'blue' | 'green';
    data?: any;
}

interface NotificationPanelProps {
    notifications: Notification[];
    onClose: () => void;
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    isDark: boolean;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
    notifications,
    onClose,
    onMarkAsRead,
    onMarkAllAsRead,
    isDark
}) => {
    const getColorClasses = (color: Notification['color']) => {
        const classes = {
            red: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
            yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400',
            orange: 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400',
            blue: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
            green: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
        };
        return classes[color];
    };

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return "À l'instant";
        if (diffMins < 60) return `Il y a ${diffMins} min`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Il y a ${diffHours}h`;

        const diffDays = Math.floor(diffHours / 24);
        return `Il y a ${diffDays}j`;
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div
            className={`fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-auto sm:mt-2 w-auto sm:w-96 max-w-md max-h-[80vh] sm:max-h-[600px] rounded-xl shadow-2xl border z-50 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                }`}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                <div>
                    <h3 className="text-lg font-bold">Notifications</h3>
                    {unreadCount > 0 && (
                        <p className="text-xs text-gray-500">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>
                    )}
                </div>
                <button onClick={onClose} className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700`}>
                    <XIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Actions */}
            {unreadCount > 0 && (
                <div className={`px-4 py-2 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    <button
                        onClick={onMarkAllAsRead}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                        <CheckIcon className="w-3 h-3" />
                        Tout marquer comme lu
                    </button>
                </div>
            )}

            {/* Notifications List */}
            <div className="max-h-[calc(70vh-140px)] sm:max-h-[480px] overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="px-4 py-12 text-center text-gray-500">
                        <AlertTriangleIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Aucune notification</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-slate-700">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                                    }`}
                                onClick={() => onMarkAsRead(notification.id)}
                            >
                                <div className="flex gap-3">
                                    {/* Color Indicator */}
                                    <div className={`w-1 rounded-full ${getColorClasses(notification.color).split(' ')[0]}`} />

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h4 className={`text-sm font-semibold ${getColorClasses(notification.color).split(' ').slice(2).join(' ')}`}>
                                                {notification.title}
                                            </h4>
                                            {!notification.read && (
                                                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                                            )}
                                        </div>
                                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                                            {notification.message}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {formatTimestamp(notification.timestamp)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
