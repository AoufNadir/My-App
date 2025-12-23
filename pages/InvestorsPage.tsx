import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PlusIcon } from '../components/icons/PlusIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { Investor } from '../types';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { SwipeableListItem } from '../components/ui/SwipeableListItem';

interface InvestorsPageProps {
    isDark: boolean;
    cardBase: string;
    subtleText: string;
    investors: Investor[];
    onOpenInvestor: (investor: Investor) => void;
    onAddInvestor: () => void;
    onEditInvestor: (investor: Investor) => void;
    onDeleteInvestor: (investor: Investor) => void;
    globalNetProfit: number;
    managerFeePercentage: string;
    setManagerFeePercentage: (val: string) => void;
}

export const InvestorsPage: React.FC<InvestorsPageProps> = ({
    isDark,
    cardBase,
    subtleText,
    investors,
    onOpenInvestor,
    onAddInvestor,
    onEditInvestor,
    onDeleteInvestor,
    globalNetProfit,
    managerFeePercentage,
    setManagerFeePercentage
}) => {

    const stats = useMemo(() => {
        const totalCapital = investors.reduce((sum, inv) => sum + (inv.isActive ? inv.capitalInvested : 0), 0);
        const mgrFeePercent = parseFloat(managerFeePercentage) || 0;
        const managerFee = globalNetProfit * (mgrFeePercent / 100);
        const investorPool = globalNetProfit - managerFee;

        // Derived: Total Profit allocated to investors based on (Capital / TotalCapital) * Pool
        const totalProfitDistributed = investors.reduce((sum, inv) => {
            if (totalCapital === 0) return sum;
            const share = inv.capitalInvested / totalCapital;
            return sum + (investorPool * share);
        }, 0);

        const totalAvailable = investors.reduce((sum, inv) => {
            if (totalCapital === 0) return sum;
            const share = inv.capitalInvested / totalCapital;
            const profitShare = investorPool * share;
            return sum + (profitShare - inv.withdrawnProfit);
        }, 0);

        return { totalCapital, totalProfitDistributed, totalAvailable, investorPool };
    }, [investors, globalNetProfit, managerFeePercentage]);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">




            {/* Manager Fee Config (Admin Only visually) */}
            <Card className={`${cardBase} border-l-4 border-l-purple-500`}>
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-lg">Configuration Commission Gérant</h3>
                        <p className={`text-sm ${subtleText}`}>Pourcentage prélevé sur le bénéfice net avant distribution.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-32">
                            <input
                                type="number"
                                value={managerFeePercentage}
                                onChange={(e) => setManagerFeePercentage(e.target.value)}
                                className="w-full pl-3 pr-8 py-2 rounded-lg border bg-transparent font-bold text-right"
                                placeholder="20"
                            />
                            <span className="absolute right-3 top-2 opacity-50">%</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Global Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className={`${cardBase} bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20`}>
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <p className={`text-sm font-medium ${subtleText} mb-1`}>Capital Total Investi</p>
                        <p className="text-2xl font-bold text-indigo-500">
                            {stats.totalCapital.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
                        </p>
                    </CardContent>
                </Card>
                <Card className={`${cardBase} bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20`}>
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <p className={`text-sm font-medium ${subtleText} mb-1`}>Part Bénéfices (Globale)</p>
                        <p className="text-2xl font-bold text-emerald-500">
                            {stats.totalProfitDistributed.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
                        </p>
                    </CardContent>
                </Card>
                <Card className={`${cardBase} bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20`}>
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <p className={`text-sm font-medium ${subtleText} mb-1`}>Bénéfices Disponibles</p>
                        <p className="text-2xl font-bold text-amber-500">
                            {stats.totalAvailable.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Action Button */}
            <Button
                onClick={onAddInvestor}
                className="w-full py-4 rounded-xl shadow-lg font-bold text-lg text-white flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-[1.01]"
            >
                <PlusIcon className="w-6 h-6" />
                Nouvel Investisseur
            </Button>

            {/* Investors List */}
            <Card className={cardBase}>
                <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <UsersIcon className="w-5 h-5 text-indigo-500" />
                        <h2 className="font-bold text-lg">Liste des Investisseurs</h2>
                    </div>
                    <span className={`text-sm ${subtleText}`}>{investors.length} Actifs</span>
                </CardHeader>
                <CardContent className="p-0">
                    {investors.length === 0 ? (
                        <div className="p-8 text-center opacity-50">
                            <UsersIcon className="w-12 h-12 mx-auto mb-2" />
                            <p>Aucun investisseur enregistré.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {investors.map((investor) => (
                                <SwipeableListItem
                                    key={investor.id}
                                    onEdit={() => onEditInvestor(investor)}
                                    onDelete={() => onDeleteInvestor(investor)}
                                >
                                    <div
                                        onClick={() => onOpenInvestor(investor)}
                                        className={`p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer flex items-center justify-between group w-full ${isDark ? 'bg-[#111827]' : 'bg-white'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${isDark ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
                                                {investor.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-base">{investor.name}</h3>
                                                <p className={`text-xs ${subtleText}`}>
                                                    Part: <span className="font-semibold text-indigo-500">
                                                        {stats.totalCapital > 0 ? ((investor.capitalInvested / stats.totalCapital) * 100).toFixed(2) : '0.00'}%
                                                    </span>
                                                    {' • '}
                                                    Entrée: {new Date(investor.entryDate).toLocaleDateString('fr-FR')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-right">
                                            <div>
                                                <p className="font-bold text-sm">{investor.capitalInvested.toLocaleString('fr-FR')} DZD</p>
                                                <p className="text-xs text-emerald-500 font-medium">
                                                    {(() => {
                                                        const share = stats.totalCapital > 0 ? (investor.capitalInvested / stats.totalCapital) : 0;
                                                        const profit = stats.investorPool * share;
                                                        const avail = profit - investor.withdrawnProfit;
                                                        return `+${avail.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD`;
                                                    })()}
                                                </p>
                                            </div>
                                            <ChevronRightIcon className={`w-5 h-5 ${subtleText} group-hover:text-indigo-500 transition-colors`} />
                                        </div>
                                    </div>
                                </SwipeableListItem>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
};
