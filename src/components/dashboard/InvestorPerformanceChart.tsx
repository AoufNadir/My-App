import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import { InvestorTransaction } from '../../types';

interface InvestorPerformanceChartProps {
    transactions: InvestorTransaction[];
    currentCapital: number;
    isDark: boolean;
}

export const InvestorPerformanceChart: React.FC<InvestorPerformanceChartProps> = ({ transactions, currentCapital, isDark }) => {

    const data = React.useMemo(() => {
        // Sort transactions by date
        const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

        // Calculate cumulative value over time
        let runningBalance = 0; // Or starting capital if we had it separately in history

        const chartData: any[] = [];

        sortedTxs.forEach(tx => {
            if (tx.type === 'deposit_capital') {
                runningBalance += tx.amount;
            } else if (tx.type === 'withdraw_capital') {
                runningBalance -= tx.amount;
            } else if (tx.type === 'profit_distribution') {
                // For total value, profit distribution adds to "Available Value" until withdrawn
                runningBalance += tx.amount;
            } else if (tx.type === 'withdraw_profit') {
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

    return (
        <Card className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border shadow-sm`}>
            <CardHeader className="p-4 pb-0">
                <UnifiedTitle
                    as="h3"
                    isDark={isDark}
                    variant="section"
                    icon={<TrendingUpIcon className="w-4 h-4" />}
                >
                    Evolution de la Valeur
                </UnifiedTitle>
            </CardHeader>
            <CardContent className="p-4 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                        <XAxis
                            dataKey="date"
                            stroke={isDark ? '#94a3b8' : '#64748b'}
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke={isDark ? '#94a3b8' : '#64748b'}
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDark ? '#1e293b' : '#fff',
                                borderRadius: '8px',
                                border: 'none',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            itemStyle={{ color: isDark ? '#fff' : '#000' }}
                            formatter={(value: number) => [`${value.toLocaleString()} DZD`, 'Valeur Totale']}
                            labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#6366f1"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};
