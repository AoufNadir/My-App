import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { Investor, InvestorTransaction } from '../types';
import { PlusIcon } from '../components/icons/PlusIcon';
import { MinusIcon } from '../components/icons/MinusIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { PencilIcon } from '../components/icons/PencilIcon';

import { SwipeableListItem } from '../components/ui/SwipeableListItem';
import { LayoutDashboardIcon } from '../components/icons/LayoutDashboardIcon';

interface InvestorDetailsPageProps {
    investor: Investor;
    transactions: InvestorTransaction[];
    onBack: () => void;
    onAddCapital: () => void;
    onWithdrawCapital: () => void;
    onWithdrawProfit: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onDeleteTransaction: (tx: InvestorTransaction) => void;
    isDark: boolean;
    cardBase: string;
    subtleText: string;
    globalNetProfit: number;
    managerFeePercentage: number;
    totalCapital: number;
}

export const InvestorDetailsPage: React.FC<InvestorDetailsPageProps> = ({
    investor,
    transactions,
    onBack,
    onAddCapital,
    onWithdrawCapital,
    onWithdrawProfit,
    onEdit,
    onDelete,
    onDeleteTransaction,
    isDark,
    cardBase,
    subtleText,
    globalNetProfit,
    managerFeePercentage,
    totalCapital
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

    // Derived State
    const share = totalCapital > 0 ? (investor.capitalInvested / totalCapital) : 0;
    const mgrFee = globalNetProfit * (managerFeePercentage / 100);
    const pool = globalNetProfit - mgrFee;

    const currentTotalProfit = pool * share;
    const currentAvailable = currentTotalProfit - investor.withdrawnProfit;


    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">

            {/* Header */}
            <div className="flex items-center gap-4">
                <Button onClick={onBack} className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                    <ArrowLeftIcon className="w-6 h-6" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{investor.name}</h1>
                    <p className={`text-sm ${subtleText}`}>
                        Investisseur depuis le {new Date(investor.entryDate).toLocaleDateString('fr-FR')}
                    </p>
                </div>
                <div className="ml-auto flex gap-2">
                    <Button onClick={() => window.open(`/investor?id=${investor.id}`, '_blank')} className={`p-2 rounded-lg ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white hover:bg-gray-50'} border border-gray-200 dark:border-gray-700`} title="Voir le Tableau de Bord">
                        <LayoutDashboardIcon className="w-5 h-5 text-indigo-500" />
                    </Button>
                    <Button onClick={onEdit} className={`p-2 rounded-lg ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white hover:bg-gray-50'} border border-gray-200 dark:border-gray-700`}>
                        <PencilIcon className="w-5 h-5 text-blue-500" />
                    </Button>
                    <Button onClick={onDelete} className={`p-2 rounded-lg ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white hover:bg-gray-50'} border border-gray-200 dark:border-gray-700`}>
                        <TrashIcon className="w-5 h-5 text-red-500" />
                    </Button>
                </div>
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className={`${cardBase} border-l-4 border-l-indigo-500`}>
                    <CardContent className="p-4">
                        <p className={`text-sm font-medium ${subtleText}`}>Capital Investi</p>
                        <div className="flex items-end gap-2 mt-1">
                            <h2 className="text-2xl font-bold">{investor.capitalInvested.toLocaleString('fr-FR')} DZD</h2>
                            <span className="text-sm font-semibold text-indigo-500 mb-1">
                                ({(investor.sharePercentage * 100).toFixed(2)}%)
                            </span>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button onClick={onAddCapital} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                                <PlusIcon className="w-4 h-4" /> Ajouter
                            </Button>
                            <Button onClick={onWithdrawCapital} className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                                <MinusIcon className="w-4 h-4" /> Retirer
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className={`${cardBase} border-l-4 border-l-emerald-500`}>
                    <CardContent className="p-4">
                        <p className={`text-sm font-medium ${subtleText}`}>Bénéfices Disponibles</p>
                        <h2 className="text-2xl font-bold text-emerald-500 mt-1">
                            {currentAvailable.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
                        </h2>
                        <div className="flex gap-2 mt-4">
                            <Button onClick={onWithdrawProfit} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                                <WalletIcon className="w-4 h-4" /> Retirer Bénéfices
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 gap-4">
                <Card className={cardBase}>
                    <CardContent className="p-4 text-center">
                        <p className={`text-xs ${subtleText}`}>Total Gagné</p>
                        <p className="text-lg font-bold text-green-500">
                            +{currentTotalProfit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
                        </p>
                    </CardContent>
                </Card>
                <Card className={cardBase}>
                    <CardContent className="p-4 text-center">
                        <p className={`text-xs ${subtleText}`}>Total Retiré</p>
                        <p className="text-lg font-bold text-orange-500">
                            -{investor.withdrawnProfit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                >
                    Aperçu
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                >
                    Historique ({transactions.length})
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'history' && (
                <Card className={cardBase}>
                    <CardContent className="p-0">
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {transactions.length === 0 ? (
                                <p className="p-8 text-center text-sm opacity-50">Aucune transaction.</p>
                            ) : (
                                transactions.map((tx) => (
                                    <SwipeableListItem
                                        key={tx.id}
                                        onDelete={() => onDeleteTransaction(tx)}
                                    >
                                        <div className={`p-4 flex items-center justify-between w-full ${isDark ? 'bg-[#111827]' : 'bg-white'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${tx.type === 'profit_distribution' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                                                    tx.type === 'withdraw_profit' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                                                        tx.type === 'deposit_capital' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                                                            'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}>
                                                    {tx.type === 'profit_distribution' && <PlusIcon className="w-4 h-4" />}
                                                    {tx.type === 'withdraw_profit' && <WalletIcon className="w-4 h-4" />}
                                                    {tx.type === 'deposit_capital' && <PlusIcon className="w-4 h-4" />}
                                                    {tx.type === 'withdraw_capital' && <MinusIcon className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm">
                                                        {tx.type === 'profit_distribution' ? 'Distribution de Profit' :
                                                            tx.type === 'withdraw_profit' ? 'Retrait de Bénéfices' :
                                                                tx.type === 'deposit_capital' ? 'Ajout de Capital' : 'Retrait de Capital'}
                                                    </p>
                                                    <p className={`text-xs ${subtleText}`}>{tx.date} à {tx.time}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold ${tx.type === 'profit_distribution' || tx.type === 'deposit_capital' ? 'text-green-500' : 'text-red-500'
                                                    }`}>
                                                    {tx.type === 'profit_distribution' || tx.type === 'deposit_capital' ? '+' : '-'}
                                                    {tx.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
                                                </p>
                                                {tx.notes && <p className={`text-xs ${subtleText}`}>{tx.notes}</p>}
                                            </div>
                                        </div>
                                    </SwipeableListItem>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {activeTab === 'overview' && (
                <div className="space-y-4">
                    {investor.notes && (
                        <Card className={cardBase}>
                            <CardHeader className="p-4 pb-2"><h3 className="font-bold text-sm">Notes</h3></CardHeader>
                            <CardContent className="p-4 pt-0 text-sm opacity-80">{investor.notes}</CardContent>
                        </Card>
                    )}
                    {/* Add charts or more stats here later */}
                </div>
            )}

        </motion.div>
    );
};
