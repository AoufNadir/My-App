import { useState, useEffect, useMemo } from 'react';
import {
    Notification, Tx, ClientDzd, ClientTransactionDzd
} from '../types';

interface NotificationProps {
    transactions: Tx[];
    clientsDzd: ClientDzd[];
    clientBalances: Map<string, number>;
    clientTransactionsDzd: ClientTransactionDzd[];
    treasuryStats: { caisse: number; baridi: number };
    portfolioStats: { usdt: { avgBuy: number }; eur: { avgBuy: number } };
    t: (key: string) => string;
}

export function useNotifications({
    transactions, clientsDzd, clientBalances, clientTransactionsDzd,
    treasuryStats, portfolioStats, t
}: NotificationProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [lastPamValue, setLastPamValue] = useState<number | null>(() => {
        const saved = localStorage.getItem('last_pam_value');
        return saved ? parseFloat(saved) : null;
    });
    const [lastCheckDate, setLastCheckDate] = useState<string>(() => localStorage.getItem('last_check_date') || '');

    useEffect(() => {
        if (lastPamValue !== null) localStorage.setItem('last_pam_value', lastPamValue.toString());
        localStorage.setItem('last_check_date', lastCheckDate);
    }, [lastPamValue, lastCheckDate]);

    // 1. Client Debt Alerts
    const clientDebtAlerts = useMemo(() => {
        const alerts: Notification[] = [];
        const today = new Date();

        clientsDzd.forEach(client => {
            const balance = clientBalances.get(client.id) || 0;
            if (balance >= 0) return;

            const clientTxs = clientTransactionsDzd
                .filter(tx => tx.clientId === client.id && tx.montant < 0 && tx.affectsBalance !== false)
                .sort((a, b) => a.timestamp - b.timestamp);

            if (clientTxs.length === 0) return;

            const oldestDebtDate = new Date(clientTxs[0].timestamp);
            const daysSinceDebt = Math.floor((today.getTime() - oldestDebtDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysSinceDebt > 10) {
                alerts.push({
                    id: `debt_critical_${client.id}`,
                    type: 'client_debt_critical',
                    priority: 1,
                    title: 'Dette Cliente Critique',
                    message: `Alerte : le client ${client.fullName || client.nom} a une dette depuis ${daysSinceDebt} jours – montant : ${Math.abs(balance).toFixed(2)} DZD`,
                    timestamp: Date.now(),
                    read: false,
                    color: 'red',
                    data: { clientId: client.id, days: daysSinceDebt, amount: balance }
                });
            } else if (daysSinceDebt >= 7) {
                alerts.push({
                    id: `debt_warning_${client.id}`,
                    type: 'client_debt_warning',
                    priority: 2,
                    title: 'Rappel Dette Client',
                    message: `Rappel : le client ${client.fullName || client.nom} a une dette depuis ${daysSinceDebt} jours, veuillez le suivre.`,
                    timestamp: Date.now(),
                    read: false,
                    color: 'yellow',
                    data: { clientId: client.id, days: daysSinceDebt, amount: balance }
                });
            }
        });

        return alerts;
    }, [clientsDzd, clientBalances, clientTransactionsDzd]);

    // 2. Low Cash Alert
    const lowCashAlert = useMemo(() => {
        const alerts: Notification[] = [];
        const caisseBalance = treasuryStats.caisse;
        if (caisseBalance < 100000) {
            alerts.push({
                id: 'low_cash_alert',
                type: 'low_cash',
                priority: 2,
                title: 'Solde Caisse Faible',
                message: `Alerte : le solde Caisse est inférieur à 100 000.00 DZD (actuel: ${caisseBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD)`,
                timestamp: Date.now(),
                read: false,
                color: 'orange',
                data: { balance: caisseBalance }
            });
        }
        return alerts;
    }, [treasuryStats.caisse]);

    // 3. PAM Variation Alert
    const pamVariationAlert = useMemo(() => {
        const alerts: Notification[] = [];
        const currentPam = portfolioStats.usdt.avgBuy;
        const todayDate = new Date().toLocaleDateString('fr-FR');

        if (lastPamValue !== null && lastCheckDate !== todayDate && lastCheckDate !== '') {
            const variation = currentPam - lastPamValue;
            if (Math.abs(variation) >= 5) {
                const isIncrease = variation > 0;
                alerts.push({
                    id: `pam_variation_${todayDate}`,
                    type: 'pam_variation',
                    priority: 2,
                    title: isIncrease ? 'PAM en Hausse' : 'PAM en Baisse',
                    message: isIncrease
                        ? `Le PAM a augmenté de +${variation.toFixed(2)} DA`
                        : `Le PAM a diminué de ${variation.toFixed(2)} DA`,
                    timestamp: Date.now(),
                    read: false,
                    color: isIncrease ? 'blue' : 'red',
                    data: { variation, previousPam: lastPamValue, currentPam }
                });
            }
        }
        return alerts;
    }, [portfolioStats.usdt.avgBuy, lastPamValue, lastCheckDate]);

    useEffect(() => {
        const todayDate = new Date().toLocaleDateString('fr-FR');
        if (lastCheckDate !== todayDate) {
            setLastPamValue(portfolioStats.usdt.avgBuy);
            setLastCheckDate(todayDate);
        }
    }, [portfolioStats.usdt.avgBuy, lastCheckDate]);

    // 4. Daily Profit/Loss Alert
    const dailyProfitLossAlert = useMemo(() => {
        const alerts: Notification[] = [];
        const today = new Date().toLocaleDateString('fr-FR');
        const todayTransactions = transactions.filter(tx => tx.date === today && tx.type === 'sell');
        const todayProfit = todayTransactions.reduce((sum, tx) => sum + (tx.profit || 0), 0);

        if (todayProfit >= 5000) {
            alerts.push({
                id: `daily_profit_${today}`,
                type: 'profit_loss',
                priority: 3,
                title: 'Gros Bénéfice Journalier',
                message: `Le bénéfice du jour dépasse +5000.00 DZD (actuel: +${todayProfit.toFixed(2)} DZD)`,
                timestamp: Date.now(),
                read: false,
                color: 'green',
                data: { profit: todayProfit }
            });
        } else if (todayProfit <= -5000) {
            alerts.push({
                id: `daily_loss_${today}`,
                type: 'profit_loss',
                priority: 1,
                title: 'Grosse Perte Journalière',
                message: `La perte du jour dépasse -5000.00 DZD (actuel: ${todayProfit.toFixed(2)} DZD)`,
                timestamp: Date.now(),
                read: false,
                color: 'red',
                data: { loss: todayProfit }
            });
        }
        return alerts;
    }, [transactions]);

    useEffect(() => {
        const allAlerts = [
            ...clientDebtAlerts, ...lowCashAlert,
            ...pamVariationAlert, ...dailyProfitLossAlert
        ].sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return b.timestamp - a.timestamp;
        });
        setNotifications(allAlerts);
    }, [clientDebtAlerts, lowCashAlert, pamVariationAlert, dailyProfitLossAlert]);

    return {
        notifications,
        unreadCount: notifications.filter(n => !n.read).length,
        markAsRead: (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)),
        markAllAsRead: () => setNotifications(prev => prev.map(n => ({ ...n, read: true }))),
        deleteNotification: (id: string) => setNotifications(prev => prev.filter(n => n.id !== id))
    };
}
