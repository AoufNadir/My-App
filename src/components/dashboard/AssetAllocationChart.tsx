import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { SectionHeading } from '../ui/SectionHeading';
import { WalletIcon } from '../icons/WalletIcon';
import { useLanguage } from '../../contexts/LanguageContext';
interface AssetAllocationChartProps {
    data: {
        name: string;
        value: number;
        color: string;
    }[];
}
const PIE_COLORS = [
    'var(--color-financial-eur)',
    'var(--color-financial-usd)',
    'var(--color-financial-dzd)',
    'var(--color-warning)',
    'var(--color-secondary)',
];
const SWATCH_CLASSES = [
    'bg-financial-eur',
    'bg-financial-usd',
    'bg-financial-dzd',
    'bg-warning',
    'bg-secondary',
];
export const AssetAllocationChart: React.FC<AssetAllocationChartProps> = ({ data }) => {
    const { t } = useLanguage();
    const activeData = data
        .filter(item => item.value > 0)
        .map((item, index) => ({
        ...item,
        chartColor: PIE_COLORS[index % PIE_COLORS.length],
        swatchClass: SWATCH_CLASSES[index % SWATCH_CLASSES.length],
    }));
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const dataItem = payload[0].payload;
            return (<div className="rounded-lg border border-border bg-surface p-3 shadow-card">
                    <div className="flex items-center gap-2 mb-1">
                        <div className={`h-3 w-3 rounded-full ${dataItem.swatchClass}`}/>
                        <span className="text-xs font-bold text-neutral-900">{dataItem.name}</span>
                    </div>
                    <CurrencyAmount value={Number(dataItem.value || 0)} currency="DZD" semantic="plain" size="md" decimals={0}/>
                    <p className="mt-1 text-xs text-neutral-500">
                        {payload[0].percent ? `${(payload[0].percent * 100).toFixed(1)}%` : ''}
                    </p>
                </div>);
        }
        return null;
    };
    return (<Card className="h-full">
            <CardHeader className="p-4 pb-0">
                <SectionHeading icon={<WalletIcon className="h-4 w-4"/>}>
                    {t('dashboard.assetAllocation') || 'Répartition des Actifs'}
                </SectionHeading>
            </CardHeader>
            <CardContent className="p-4">
                <div className="h-[250px] w-full relative">
                    {activeData.length > 0 ? (<ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={activeData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {activeData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.chartColor} stroke="var(--color-surface)" strokeWidth={2}/>))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />}/>
                                <Legend verticalAlign="bottom" height={36} formatter={(value) => (<span className="text-xs font-medium text-neutral-600">{value}</span>)}/>
                            </PieChart>
                        </ResponsiveContainer>) : (<div className="absolute inset-0">
                            <EmptyState title={t('reports.noData') || 'No data available'} className="h-full min-h-0"/>
                        </div>)}
                </div>
            </CardContent>
        </Card>);
};
