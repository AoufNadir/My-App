import { Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../ui/Card';
import { Alert, AlertDescription } from '../ui/Alert';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { CalendarIcon } from '../icons/CalendarIcon';
import { now } from '../../utils';
import type { ManualAsset } from '../../types';

type MainContentAreaProps = Record<string, any>;

const MotionDiv = motion.div;

export function MainContentArea({
    alert,
    alertClass,
    cardBase,
    subtleText,
    t,
    isDark,
    dailyOverview,
    PageLoadingFallback,
    view,
    TransactionsPage,
    openAdjustmentModal,
    openForm,
    filterMode,
    setFilterMode,
    transactions,
    getRelativeDateLabel,
    clientTransactionsDzd,
    clientsDzd,
    getClientFullName,
    setTxToDelete,
    openDateFilterModal,
    dateRange,
    setDateRange,
    setIsWalletTransferModalOpen,
    setIsTransferModalOpen,
    treasuryTransactions,
    handleEditClientTx,
    handleDeleteClientTxClick,
    setTreasuryTxToDelete,
    PortfolioPage,
    portfolioPageProps,
    AnalyticsPage,
    ClientsPage,
    clientsPageProps,
    selectedAssetClientId,
    ManualClientPage,
    manualAssetClients,
    manualAssetTransactions,
    assetClientBalances,
    selectedAssetId,
    setSelectedAssetClientId,
    handleCreateAssetTransaction,
    handleUpdateAssetTransaction,
    handleDeleteAssetTransaction,
    fieldBase,
    ManualAssetPage,
    manualAssets,
    handleCreateAssetClient,
    handleUpdateAssetClient,
    handleDeleteAssetClient,
    TresoreriePage,
    treasuryStats,
    totals,
    portfolioStats,
    openTreasuryCardModal,
    treasuryCards,
    setTreasuryCardToDelete,
    openTreasuryBalanceEditModal,
    openPortfolioBalanceEditModal,
    assetBalances,
    setSelectedAssetId,
    setIsCreateAssetModalOpen,
    handleDeleteAsset,
    selectedInvestorId,
    setSelectedInvestorId,
    InvestorDetailsPage,
    derivedInvestors,
    investorTransactions,
    setInvestorTxType,
    setIsInvestorTxModalOpen,
    setReinvestInput,
    setIsReinvestModalOpen,
    setInvestorTxToDelete,
    managerFeePercentage,
    InvestorsPage,
    setEditingInvestor,
    setIsInvestorModalOpen,
    setInvestorToDelete,
    setManagerFeePercentage,
    handleExportInvestorReport
}: MainContentAreaProps) {
    return (
                <main className="py-6">
                    <AnimatePresence>{alert && (<MotionDiv initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="mb-4"><Alert className={`rounded-xl ${alertClass}`}><AlertDescription>{alert}</AlertDescription></Alert></MotionDiv>)}</AnimatePresence>

                    <Card className={`${cardBase} p-4 mb-4`}>
                        <div className="flex items-center justify-between mb-3">
                            <UnifiedTitle
                                as="h2"
                                isDark={isDark}
                                variant="section"
                                icon={<CalendarIcon className="w-4 h-4" />}
                            >
                                {t('common.dailyOverview')}
                            </UnifiedTitle>
                            <span className={`text-xs ${subtleText}`}>{now().date}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <p className={`text-xs ${subtleText}`}>{t('common.caisseBalance')}</p>
                                <p className="text-lg font-bold text-emerald-400">{dailyOverview.caisse.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <p className={`text-xs ${subtleText}`}>{t('common.baridiBalance')}</p>
                                <p className="text-lg font-bold text-sky-400">{dailyOverview.baridi.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <p className={`text-xs ${subtleText}`}>{t('common.activeClientsToday')}</p>
                                <p className="text-lg font-bold text-indigo-400">{dailyOverview.activeClients}</p>
                            </div>
                            <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <p className={`text-xs ${subtleText}`}>{t('common.todayProfit')}</p>
                                <p className={`text-lg font-bold ${dailyOverview.todayProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {dailyOverview.todayProfit >= 0 ? '+' : ''}{dailyOverview.todayProfit.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className={`text-[11px] ${subtleText}`}>{dailyOverview.todayUsdtSold.toFixed(2)} USDT</p>
                            </div>
                        </div>
                    </Card>

                    <Suspense fallback={<PageLoadingFallback isDark={isDark} text={t('common.loading')} />}>
                    {view === 'transactions' && <TransactionsPage
                        cardBase={cardBase}
                        isDark={isDark}
                        subtleText={subtleText}
                        openAdjustmentModal={openAdjustmentModal}
                        openForm={openForm}
                        filterMode={filterMode}
                        setFilterMode={setFilterMode}
                        transactions={transactions}
                        getRelativeDateLabel={getRelativeDateLabel}
                        clientTransactionsDzd={clientTransactionsDzd}
                        clientsDzd={clientsDzd}
                        getClientFullName={getClientFullName}
                        setTxToDelete={setTxToDelete}
                        openDateFilterModal={openDateFilterModal}
                        dateRange={dateRange}
                        setDateRange={setDateRange}
                        openWalletTransferModal={() => setIsWalletTransferModalOpen(true)}
                        openTransferModal={() => setIsTransferModalOpen(true)}
                        treasuryTransactions={treasuryTransactions}
                        handleEditClientTx={handleEditClientTx}
                        handleDeleteClientTxClick={handleDeleteClientTxClick}
                        setTreasuryTxToDelete={setTreasuryTxToDelete}
                    />}

                    {view === 'statistiques' && <PortfolioPage {...portfolioPageProps} />}

                    {view === 'analytics' && <AnalyticsPage {...portfolioPageProps} />}

                    {view === 'dzd' && <ClientsPage {...clientsPageProps} />}

                    {view === 'tresorerie' && (
                        selectedAssetClientId ? (
                            <ManualClientPage
                                client={manualAssetClients.find(c => c.id === selectedAssetClientId)!}
                                transactions={manualAssetTransactions.filter(tx => tx.clientId === selectedAssetClientId)}
                                balance={assetClientBalances.get(`${selectedAssetId}_${selectedAssetClientId}`) || 0}
                                onBack={() => setSelectedAssetClientId(null)}
                                onAddTransaction={handleCreateAssetTransaction}
                                onUpdateTransaction={handleUpdateAssetTransaction}
                                onDeleteTransaction={handleDeleteAssetTransaction}
                                isDark={isDark}
                                cardBase={cardBase}
                                fieldBase={fieldBase}
                                subtleText={subtleText}
                            />
                        ) : selectedAssetId ? (
                            <ManualAssetPage
                                asset={manualAssets.find(a => a.id === selectedAssetId)!}
                                clients={manualAssetClients.filter(c => c.assetId === selectedAssetId)}
                                clientBalances={assetClientBalances}
                                onBack={() => setSelectedAssetId(null)}
                                onSelectClient={(client) => setSelectedAssetClientId(client.id)}
                                onCreateClient={(fullName, phone, email, notes) => {
                                    handleCreateAssetClient(selectedAssetId, { fullName, phone, email, notes });
                                }}
                                onUpdateClient={(clientId, data) => {
                                    handleUpdateAssetClient(clientId, data);
                                }}
                                onDeleteClient={handleDeleteAssetClient}
                                isDark={isDark}
                                cardBase={cardBase}
                                fieldBase={fieldBase}
                                subtleText={subtleText}
                            />
                        ) : (
                            <TresoreriePage
                                {...{
                                    isDark, cardBase, subtleText,
                                    caisseBalance: treasuryStats.caisse,
                                    baridiBalance: treasuryStats.baridi,
                                    totalDettes: totals.totalDettes,
                                    totalAvances: totals.totalAvances,
                                    portfolioValue: (portfolioStats.usdt.available * (portfolioStats.usdt.avgBuy || 0) + portfolioStats.eur.available * (portfolioStats.eur.avgBuy || 0)),
                                    openTreasuryModal: () => openTreasuryCardModal(),
                                    treasuryCards,
                                    openTreasuryCardModal,
                                    setTreasuryCardToDelete,
                                    openTreasuryBalanceEditModal,
                                    openPortfolioBalanceEditModal,
                                    openAdjustmentModal: openAdjustmentModal,
                                    treasuryTransactions,
                                    setTreasuryTxToDelete,
                                    manualAssets,
                                    manualAssetClients,
                                    assetBalances,
                                    assetClientBalances,
                                    onSelectAsset: setSelectedAssetId,
                                    onAddManualAsset: () => setIsCreateAssetModalOpen(true),
                                    onDeleteManualAsset: (id: string) => handleDeleteAsset(id, manualAssetTransactions.filter(tx => tx.actifId === id).length),
                                    onOpenManualAsset: (asset: ManualAsset) => setSelectedAssetId(asset.id),
                                    onOpenCreateManualAsset: () => setIsCreateAssetModalOpen(true)
                                }}
                            />
                        )
                    )}

                    {view === 'investors' && (
                        selectedInvestorId ? (
                            <InvestorDetailsPage
                                investor={derivedInvestors.find(i => i.id === selectedInvestorId)!}
                                transactions={investorTransactions.filter(tx => tx.investorId === selectedInvestorId)}
                                onBack={() => setSelectedInvestorId(null)}
                                onAddCapital={() => { setInvestorTxType('deposit_capital'); setIsInvestorTxModalOpen(true); }}
                                onWithdrawCapital={() => { setInvestorTxType('withdraw_capital'); setIsInvestorTxModalOpen(true); }}
                                onWithdrawProfit={() => { setInvestorTxType('withdraw_profit'); setIsInvestorTxModalOpen(true); }}
                                onReinvestProfit={() => {
                                    const inv = derivedInvestors.find(i => i.id === selectedInvestorId);
                                    if (inv) {
                                        setReinvestInput((inv.availableProfit || 0).toFixed(2));
                                        setIsReinvestModalOpen(true);
                                    }
                                }}
                                onDeleteTransaction={(tx) => { setInvestorTxToDelete(tx); }}
                                onExportReport={() => handleExportInvestorReport(selectedInvestorId)}
                                isDark={isDark}
                                cardBase={cardBase}
                                subtleText={subtleText}
                                globalNetProfit={portfolioStats.usdt.totalProfit}
                                managerFeePercentage={Number(managerFeePercentage)}
                                totalCapital={derivedInvestors.reduce((sum, inv) => sum + (inv.isActive ? inv.capitalInvested : 0), 0)}
                            />
                        ) : (
                            <InvestorsPage
                                isDark={isDark}
                                cardBase={cardBase}
                                subtleText={subtleText}
                                investors={derivedInvestors}
                                onOpenInvestor={(inv) => setSelectedInvestorId(inv.id)}
                                onAddInvestor={() => { setEditingInvestor(null); setIsInvestorModalOpen(true); }}
                                onEditInvestor={(inv) => { setEditingInvestor(inv); setIsInvestorModalOpen(true); }}
                                onDeleteInvestor={(inv) => { setInvestorToDelete(inv); }}
                                globalNetProfit={portfolioStats.usdt.totalProfit}
                                managerFeePercentage={managerFeePercentage}
                                setManagerFeePercentage={setManagerFeePercentage}
                            />
                        )
                    )}
                    </Suspense>
                </main>
    );
}
