import React from 'react';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart } from 'recharts';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { SectionHeading } from '../ui/SectionHeading';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import { useLanguage } from '../../contexts/LanguageContext';
interface ProfitHistoryChartProps {
    data: {
        date: string;
        profit: number;
    }[];
}
const CHART_COLORS = {
    profit: 'var(--color-financial-profit)',
    border: 'var(--color-border)',
    tick: 'var(--color-neutral-500)',
};
export const ProfitHistoryChart: React.FC<ProfitHistoryChartProps> = ({ data }) => {
    const { t } = useLanguage();
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const value = Number(payload[0].value || 0);
            return (<div className="rounded-lg border border-border bg-surface p-3 shadow-card">
                    <p className="mb-1 text-xs font-medium text-neutral-500">{label}</p>
                    <CurrencyAmount value={value} currency="DZD" semantic="auto" size="md" decimals={2}/>
                </div>);
        }
        return null;
    };
    return (<Card className="h-full">
            <CardHeader className="p-4 pb-0">
                <SectionHeading icon={<TrendingUpIcon className="h-4 w-4"/>}>
                    {t('dashboard.profitHistory') || 'Historique des Profits (30j)'}
                </SectionHeading>
            </CardHeader>
            <CardContent className="p-4">
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={CHART_COLORS.profit} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={CHART_COLORS.profit} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.border}/>
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: CHART_COLORS.tick, fontSize: 10 }} minTickGap={30}/>
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART_COLORS.tick, fontSize: 10 }}/>
                            <Tooltip content={<CustomTooltip />}/>
                            <Area type="monotone" dataKey="profit" stroke={CHART_COLORS.profit} strokeWidth={2} fillOpacity={1} fill="url(#profitGradient)"/>
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>);
};
