
import React from 'react';
import { motion } from 'framer-motion';
import { SummaryCard } from '../src/components/dashboard/SummaryCard';
import { QuickActions } from '../src/components/dashboard/QuickActions';
import { ProfitHistoryChart } from '../src/components/dashboard/ProfitHistoryChart';
import { AssetAllocationChart } from '../src/components/dashboard/AssetAllocationChart';
import { useLanguage } from '../src/contexts/LanguageContext';
import { WalletIcon } from '../components/icons/WalletIcon';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { ArrowDownIcon } from '../components/icons/ArrowDownIcon';
import { ArrowUpIcon } from '../components/icons/ArrowUpIcon';

interface DashboardProps {
    isDark: boolean;
    totalBalanceDzd: number;
    totalBalanceUsdt: number;
    totalBalanceEur: number;
    totalProfitMonth: number;
    profitTrendDiff: number; // Percentage difference from last month
    onAction: (action: string) => void;
    userName: string;
    dailyProfits: { date: string; profit: number }[];
    assetAllocation: { name: string; value: number; color: string }[];
}

export const DashboardPage: React.FC<DashboardProps> = ({
    isDark,
    totalBalanceDzd,
    totalBalanceUsdt,
    totalBalanceEur,
    totalProfitMonth,
    profitTrendDiff,
    onAction,
    userName,
    dailyProfits,
    assetAllocation
}) => {
    const { t } = useLanguage();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6 pb-20" // PB for mobile nav if applicable
        >
            {/* Header Section */}
            <motion.div variants={itemVariants} className="flex justify-between items-center px-1">
                <div>
                    <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('common.welcome')}, {userName}
                    </h1>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {t('dashboard.overview')}
                    </p>
                </div>
            </motion.div>

            {/* Summary Cards Grid */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Balance DZD */}
                <SummaryCard
                    title={t('dashboard.totalBalance')}
                    value={`${totalBalanceDzd.toLocaleString('fr-FR')} DZD`}
                    subValue="Total estimé (Caisse + Baridi + Cryptos)"
                    icon={<WalletIcon className="w-6 h-6 text-blue-500" />}
                    color="text-blue-500"
                    isDark={isDark}
                    onClick={() => onAction('treasury')}
                />

                {/* Monthly Profit */}
                <SummaryCard
                    title={t('dashboard.monthlyProfit')}
                    value={`${totalProfitMonth.toLocaleString('fr-FR')} DZD`}
                    icon={<TrendingUpIcon className="w-6 h-6 text-green-500" />}
                    trend={profitTrendDiff >= 0 ? 'up' : 'down'}
                    trendValue={`${Math.abs(profitTrendDiff).toFixed(1)}%`}
                    color="text-green-500"
                    isDark={isDark}
                />

                {/* Crypto Holdings */}
                <SummaryCard
                    title="Portefeuille Crypto"
                    value={`${totalBalanceUsdt.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} USDT`}
                    subValue={`${totalBalanceEur.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} EUR`}
                    icon={<div className="flex gap-1">
                        <span className="text-green-500 font-bold">$</span>
                        <span className="text-blue-500 font-bold">€</span>
                    </div>}
                    isDark={isDark}
                    onClick={() => onAction('portfolio')}
                />
            </motion.div>

            {/* Quick Actions Section */}
            <motion.div variants={itemVariants}>
                <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    {t('dashboard.quickActions')}
                </h2>
                <QuickActions onAction={onAction} isDark={isDark} />
            </motion.div>

            {/* Visual Charts Section */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Profit History Chart - Takes up 2 columns on large screens */}
                <div className="lg:col-span-2">
                    <ProfitHistoryChart data={dailyProfits} isDark={isDark} />
                </div>

                {/* Asset Allocation Chart - Takes up 1 column */}
                <div className="lg:col-span-1">
                    <AssetAllocationChart data={assetAllocation} isDark={isDark} />
                </div>

            </motion.div>

        </motion.div>
    );
};

