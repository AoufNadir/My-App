import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { useLanguage } from '../../contexts/LanguageContext';

interface ProfitHistoryChartProps {
    data: { date: string; profit: number }[];
    isDark: boolean;
}

export const ProfitHistoryChart: React.FC<ProfitHistoryChartProps> = ({ data, isDark }) => {
    const { t } = useLanguage();

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className={`p-3 rounded-lg shadow-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
                    <p className={`text-sm font-bold ${payload[0].value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {payload[0].value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card className={`h-full ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
            <CardHeader>
                <CardTitle className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    {t('dashboard.profitHistory') || 'Historique des Profits (30j)'}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#374151' : '#E5E7EB'} />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: isDark ? '#9CA3AF' : '#6B7280', fontSize: 10 }}
                                minTickGap={30}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: isDark ? '#9CA3AF' : '#6B7280', fontSize: 10 }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="profit"
                                stroke="#10B981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#profitGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};
