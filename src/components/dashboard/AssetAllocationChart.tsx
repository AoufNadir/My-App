import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { useLanguage } from '../../contexts/LanguageContext';

interface AssetAllocationChartProps {
    data: { name: string; value: number; color: string }[];
    isDark: boolean;
}

export const AssetAllocationChart: React.FC<AssetAllocationChartProps> = ({ data, isDark }) => {
    const { t } = useLanguage();

    // Filter out zero values
    const activeData = data.filter(item => item.value > 0);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const dataItem = payload[0].payload;
            return (
                <div className={`p-3 rounded-lg shadow-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dataItem.color }} />
                        <span className={`text-xs font-bold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{dataItem.name}</span>
                    </div>
                    <p className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {dataItem.value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DZD
                    </p>
                    <p className="text-xs text-gray-500">
                        {payload[0].percent ? `${(payload[0].percent * 100).toFixed(1)}%` : ''}
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
                    {t('dashboard.assetAllocation') || 'Répartition des Actifs'}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full relative">
                    {activeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={activeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {activeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke={isDark ? '#1F2937' : '#ffffff'} strokeWidth={2} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    formatter={(value, entry: any) => (
                                        <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{value}</span>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                            No data available
                        </div>
                    )}
                    {/* Center Text for Total Value could go here if requested, keeping it simple for now */}
                </div>
            </CardContent>
        </Card>
    );
};
