import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { SectionHeading } from '../ui/SectionHeading';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import { InvestorTransaction } from '../../types';
interface InvestorPerformanceChartProps {
    transactions: InvestorTransaction[];
    currentCapital: number;
}
const CHART_COLORS = {
    value: 'var(--color-primary)',
    border: 'var(--color-border)',
    tick: 'var(--color-neutral-500)',
};
export const InvestorPerformanceChart: React.FC<InvestorPerformanceChartProps> = ({ transactions, currentCapital }) => {
    const data = React.useMemo(() => {
        // Sort transactions by date
        const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
        // Calculate cumulative value over time
        let runningBalance = 0; // Or starting capital if we had it separately in history
        const chartData: any[] = [];
        sortedTxs.forEach(tx => {
            if (tx.type === 'deposit_capital') {
                runningBalance += tx.amount;
            }
            else if (tx.type === 'withdraw_capital') {
                runningBalance -= tx.amount;
            }
            else if (tx.type === 'profit_distribution') {
                // For total value, profit distribution adds to "Available Value" until withdrawn
                runningBalance += tx.amount;
            }
            else if (tx.type === 'withdraw_profit') {
                runningBalance -= tx.amount;
            }
            chartData.push({
                date: tx.date.substring(0, 5), // DD/MM
                fullDate: tx.date,
                value: runningBalance,
                amount: tx.amount,
                type: tx.type
            });
        });
        // Add current state as the last point if it differs or list is empty
        if (chartData.length === 0 || chartData[chartData.length - 1].value !== currentCapital) {
            const today = new Date();
            chartData.push({
                date: `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}`,
                fullDate: 'Aujourd\'hui',
                value: currentCapital,
                amount: 0,
                type: 'current'
            });
        }
        return chartData;
    }, [transactions, currentCapital]);
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const value = Number(payload[0].value || 0);
            return (<div className="rounded-lg border border-border bg-surface p-3 shadow-card">
                <p className="mb-1 text-xs font-medium text-neutral-500">Date: {label}</p>
                <CurrencyAmount value={value} currency="DZD" semantic="plain" size="md" decimals={2}/>
                <p className="mt-1 text-xs font-semibold text-neutral-500">Valeur Totale</p>
            </div>);
        }
        return null;
    };
    return (<Card>
            <CardHeader className="p-4 pb-0">
                <SectionHeading icon={<TrendingUpIcon className="h-4 w-4"/>}>
                    Evolution de la Valeur
                </SectionHeading>
            </CardHeader>
            <CardContent className="p-4 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART_COLORS.value} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={CHART_COLORS.value} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.border}/>
                        <XAxis dataKey="date" stroke={CHART_COLORS.tick} fontSize={12} tickLine={false} axisLine={false}/>
                        <YAxis stroke={CHART_COLORS.tick} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}/>
                        <Tooltip content={<CustomTooltip />}/>
                        <Area type="monotone" dataKey="value" stroke={CHART_COLORS.value} strokeWidth={3} fillOpacity={1} fill="url(#colorValue)"/>
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>);
};
