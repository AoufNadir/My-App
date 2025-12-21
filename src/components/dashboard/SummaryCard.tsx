
import React from 'react';
import { Card, CardContent } from '../../../components/ui/Card';

interface SummaryCardProps {
    title: string;
    value: string;
    subValue?: string;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    color?: string; // Tailwind class for text color, e.g., 'text-green-500'
    isDark: boolean;
    onClick?: () => void;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
    title,
    value,
    subValue,
    icon,
    trend,
    trendValue,
    color,
    isDark,
    onClick
}) => {
    return (
        <Card
            onClick={onClick}
            className={`relative overflow-hidden transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.01]' : ''} ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
        >
            <CardContent className="p-5">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <p className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {title}
                        </p>
                        <h3 className={`text-2xl font-bold ${color || (isDark ? 'text-white' : 'text-gray-900')}`}>
                            {value}
                        </h3>
                        {subValue && (
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {subValue}
                            </p>
                        )}
                    </div>

                    <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                        {icon}
                    </div>
                </div>

                {trend && trendValue && (
                    <div className="mt-4 flex items-center text-xs">
                        <span
                            className={`font-medium mr-2 flex items-center ${trend === 'up' ? 'text-green-500' :
                                trend === 'down' ? 'text-red-500' :
                                    'text-gray-500'
                                }`}
                        >
                            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '•'} {trendValue}
                        </span>
                        <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                            vs dernier mois
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
