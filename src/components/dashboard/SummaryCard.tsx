import React from 'react';
import { Card, CardContent } from '../ui/Card';
interface SummaryCardProps {
    title: string;
    value: string;
    subValue?: string;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    color?: string;
    onClick?: () => void;
}
export const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, subValue, icon, trend, trendValue, color, onClick }) => {
    return (<Card onClick={onClick} variant={onClick ? 'hoverable' : 'default'} className="relative overflow-hidden transition-all duration-200">
            <CardContent className="p-5">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <p className="text-xs font-medium uppercase text-neutral-500">
                            {title}
                        </p>
                        <h3 dir="ltr" className={`text-2xl font-bold tabular-nums ${color || 'text-neutral-900'}`}>
                            {value}
                        </h3>
                        {subValue && (<p className="text-xs text-neutral-500">
                                {subValue}
                            </p>)}
                    </div>

                    <div className="p-3 rounded-xl bg-neutral-100 text-neutral-600">
                        {icon}
                    </div>
                </div>

                {trend && trendValue && (<div className="mt-4 flex items-center text-xs">
                        <span className={`font-medium mr-2 flex items-center ${trend === 'up' ? 'text-financial-profit' :
                trend === 'down' ? 'text-financial-loss' :
                    'text-neutral-500'}`}>
                            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '•'} {trendValue}
                        </span>
                        <span className="text-neutral-400">
                            vs dernier mois
                        </span>
                    </div>)}
            </CardContent>
        </Card>);
};
