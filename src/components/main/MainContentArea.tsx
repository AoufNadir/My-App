import { Suspense, memo } from 'react';
import { Alert, AlertDescription } from '../ui/Alert';
import { SkeletonList } from '../ui/SkeletonList';
import { ErrorBoundary } from '../ErrorBoundary';
import type { ManualAsset } from '../../types';
type MainContentAreaProps = Record<string, any>;
const getDateTimestamp = (value: Date | null | undefined) => value?.getTime?.() ?? null;
const areDailyOverviewsEqual = (prev: any, next: any) => (prev?.caisse === next?.caisse
    && prev?.baridi === next?.baridi
    && prev?.activeClients === next?.activeClients
    && prev?.todayProfit === next?.todayProfit
    && prev?.monthToDateProfit === next?.monthToDateProfit
    && prev?.yearToDateProfit === next?.yearToDateProfit
    && prev?.allTimeProfit === next?.allTimeProfit
    && prev?.todayUsdtSold === next?.todayUsdtSold
    && prev?.todayEurSold === next?.todayEurSold
    && prev?.monthToDateUsdtSold === next?.monthToDateUsdtSold
    && prev?.monthToDateEurSold === next?.monthToDateEurSold
    && prev?.yearToDateUsdtSold === next?.yearToDateUsdtSold
    && prev?.yearToDateEurSold === next?.yearToDateEurSold
    && prev?.allTimeUsdtSold === next?.allTimeUsdtSold
    && prev?.allTimeEurSold === next?.allTimeEurSold);
const arePortfolioPagePropsEqual = (prev: any, next: any) => (prev?.statsView === next?.statsView
    && true
    && prev?.portfolioStats === next?.portfolioStats
    && prev?.totalPortfolioValue === next?.totalPortfolioValue
    && prev?.suggestedProfitMargin === next?.suggestedProfitMargin
    && prev?.suggestedSellingPrice === next?.suggestedSellingPrice
    && prev?.suggestedUsdtEurSellPrice === next?.suggestedUsdtEurSellPrice
    && prev?.suggestedSellingPriceEur === next?.suggestedSellingPriceEur
    && prev?.usdtReportMonth === next?.usdtReportMonth
    && prev?.usdtReportYear === next?.usdtReportYear
    && prev?.transactions === next?.transactions
    && prev?.selectedHeatmapDay === next?.selectedHeatmapDay
    && prev?.simMode === next?.simMode
    && prev?.simBuyQty === next?.simBuyQty
    && prev?.simBuyPrice === next?.simBuyPrice
    && prev?.fieldBase === next?.fieldBase
    && prev?.newPamFromDzdSimulator === next?.newPamFromDzdSimulator
    && prev?.simEurQty === next?.simEurQty
    && prev?.simEurDzdPrice === next?.simEurDzdPrice
    && prev?.simEurUsdtRate === next?.simEurUsdtRate
    && prev?.newPamFromEurSimulator === next?.newPamFromEurSimulator
    && prev?.reportClient === next?.reportClient
    && prev?.clientsDzd === next?.clientsDzd
    && prev?.clientTransactionsDzd === next?.clientTransactionsDzd
    && prev?.reportMonth === next?.reportMonth
    && prev?.reportYear === next?.reportYear
    && prev?.simSellUsdtQty === next?.simSellUsdtQty
    && prev?.simSellDzdPrice === next?.simSellDzdPrice
    && prev?.simSellEurPrice === next?.simSellEurPrice
    && prev?.simSellEurToDzdRate === next?.simSellEurToDzdRate);
const areClientsPagePropsEqual = (prev: any, next: any) => (prev?.selectedClientId === next?.selectedClientId
    && prev?.clientSearchQuery === next?.clientSearchQuery
    && prev?.clientSortMode === next?.clientSortMode
    && prev?.filteredClientsDzd === next?.filteredClientsDzd
    && prev?.clientBalances === next?.clientBalances
    && prev?.selectedClient === next?.selectedClient
    && prev?.selectedClientTransactions === next?.selectedClientTransactions
    && prev?.transactions === next?.transactions
    && prev?.copiedValue === next?.copiedValue
    && prev?.overdueDebtClients === next?.overdueDebtClients);
const areDashboardPagePropsEqual = (prev: any, next: any) => (prev?.portfolioStats === next?.portfolioStats
    && prev?.treasuryStats === next?.treasuryStats
    && prev?.totals === next?.totals
    && prev?.treasuryCards === next?.treasuryCards
    && prev?.investorLiability === next?.investorLiability
    && prev?.servicesSummary === next?.servicesSummary
    && prev?.globalNetProfit === next?.globalNetProfit
    && prev?.transactions === next?.transactions
    && prev?.clientTransactionsDzd === next?.clientTransactionsDzd
    && prev?.clientsDzd === next?.clientsDzd
    && prev?.overdueDebtClients === next?.overdueDebtClients
    && prev?.investors === next?.investors
    && prev?.treasuryTransactions === next?.treasuryTransactions
    && prev?.isDataSyncing === next?.isDataSyncing
    && areDailyOverviewsEqual(prev?.dailyOverview, next?.dailyOverview));
const areMainContentAreaPropsEqual = (prev: MainContentAreaProps, next: MainContentAreaProps) => {
    if (prev.alert !== next.alert
        || prev.alertClass !== next.alertClass
        || prev.t !== next.t
        || false
        || prev.view !== next.view
        || prev.PageLoadingFallback !== next.PageLoadingFallback
        || !areDailyOverviewsEqual(prev.dailyOverview, next.dailyOverview)) {
        return false;
    }
    switch (next.view) {
        case 'dashboard':
            return areDashboardPagePropsEqual(prev.dashboardPageProps, next.dashboardPageProps);
        case 'transactions':
            return (prev.filterMode === next.filterMode
                && getDateTimestamp(prev.dateRange?.start) === getDateTimestamp(next.dateRange?.start)
                && getDateTimestamp(prev.dateRange?.end) === getDateTimestamp(next.dateRange?.end)
                && prev.transactions === next.transactions
                && prev.clientTransactionsDzd === next.clientTransactionsDzd
                && prev.clientsDzd === next.clientsDzd
                && prev.treasuryTransactions === next.treasuryTransactions);
        case 'statistiques':
        case 'analytics':
            return arePortfolioPagePropsEqual(prev.portfolioPageProps, next.portfolioPageProps);
        case 'expenses':
            return (prev.personalExpenses === next.personalExpenses
                && prev.managerAvailableProfit === next.managerAvailableProfit
                && prev.managerExists === next.managerExists);
        case 'dzd':
            return areClientsPagePropsEqual(prev.clientsPageProps, next.clientsPageProps);
        case 'tresorerie':
            return (prev.treasuryStats === next.treasuryStats
                && prev.totals === next.totals
                && prev.portfolioStats === next.portfolioStats
                && prev.investorLiability === next.investorLiability
                && prev.treasuryCards === next.treasuryCards
                && prev.servicesSummary === next.servicesSummary);
        case 'services':
            return (prev.selectedAssetClientId === next.selectedAssetClientId
                && prev.manualAssetClients === next.manualAssetClients
                && prev.manualAssetTransactions === next.manualAssetTransactions
                && prev.assetClientBalances === next.assetClientBalances
                && prev.selectedAssetId === next.selectedAssetId
                && prev.fieldBase === next.fieldBase
                && prev.manualAssets === next.manualAssets
                && prev.assetBalances === next.assetBalances);
        case 'investors':
            return (prev.selectedInvestorId === next.selectedInvestorId
                && prev.derivedInvestors === next.derivedInvestors
                && prev.clientsDzd === next.clientsDzd
                && prev.investorTransactions === next.investorTransactions
                && prev.investorEconomicsTotals === next.investorEconomicsTotals
                && prev.managerFeePercentage === next.managerFeePercentage
                && prev.portfolioStats === next.portfolioStats
                && prev.globalNetProfit === next.globalNetProfit);
        default:
            return true;
    }
};
function MainContentAreaComponent({ alert, alertClass, t, dailyOverview, view, DashboardPage, dashboardPageProps, TransactionsPage, openAdjustmentModal, openForm, filterMode, setFilterMode, transactions, getRelativeDateLabel, clientTransactionsDzd, clientsDzd, getClientFullName, setTxToDelete, openDateFilterModal, dateRange, setDateRange, openWalletTransferModal, openTransferModal, openDeliveryExpenseModal, openPersonalWithdrawalModal, treasuryTransactions, handleEditPortfolioTx, handleEditClientTx, handleEditTreasuryTx, handleDeleteClientTxClick, setTreasuryTxToDelete, PortfolioPage, portfolioPageProps, AnalyticsPage, PersonalExpensesPage, personalExpenses, managerAvailableProfit, managerExists, openReconcileAdvanceModal, openEditPersonalExpense, setPersonalExpenseToDelete, handleExportPersonalExpensesReport, ClientsPage, clientsPageProps, ServicesPage, selectedAssetClientId, ManualClientPage, manualAssetClients, manualAssetTransactions, assetClientBalances, selectedAssetId, setSelectedAssetClientId, handleCreateAssetTransaction, handleUpdateAssetTransaction, handleDeleteAssetTransaction, fieldBase, ManualAssetPage, manualAssets, handleCreateAssetClient, handleUpdateAssetClient, handleDeleteAssetClient, TresoreriePage, treasuryStats, totals, portfolioStats, investorLiability, globalNetProfit, openTreasuryCardModal, treasuryCards, setTreasuryCardToDelete, openTreasuryBalanceEditModal, openPortfolioBalanceEditModal, assetBalances, servicesSummary, openServicesView, setSelectedAssetId, setIsCreateAssetModalOpen, handleDeleteAsset, selectedInvestorId, setSelectedInvestorId, InvestorDetailsPage, derivedInvestors, investorTransactions, investorEconomicsTotals, setInvestorTxType, setIsInvestorTxModalOpen, setReinvestInput, setIsReinvestModalOpen, setInvestorTxToDelete, managerFeePercentage, InvestorsPage, openInvestorModal, setInvestorToDelete, setManagerFeePercentage, handleExportInvestorReport }: MainContentAreaProps) {
    const selectedInvestor = selectedInvestorId
        ? derivedInvestors.find((investor: any) => investor.id === selectedInvestorId) || null
        : null;
    return (<main className="py-6">
                    {alert && (<div className="anim-fade-slide-down mb-4"><Alert className={`rounded-xl ${alertClass}`}><AlertDescription>{alert}</AlertDescription></Alert></div>)}

                    <Suspense fallback={<SkeletonList rows={6} itemHeight={72} className="mt-2"/>}>
                    <ErrorBoundary key={`${view}-${selectedInvestorId || ''}-${selectedAssetId || ''}-${selectedAssetClientId || ''}`}>
                    {view === 'dashboard' && <DashboardPage {...dashboardPageProps}/>}

                    {view === 'transactions' && <TransactionsPage openAdjustmentModal={openAdjustmentModal} openForm={openForm} filterMode={filterMode} setFilterMode={setFilterMode} transactions={transactions} getRelativeDateLabel={getRelativeDateLabel} clientTransactionsDzd={clientTransactionsDzd} clientsDzd={clientsDzd} getClientFullName={getClientFullName} setTxToDelete={setTxToDelete} openDateFilterModal={openDateFilterModal} dateRange={dateRange} setDateRange={setDateRange} openWalletTransferModal={openWalletTransferModal} openTransferModal={openTransferModal} openDeliveryExpenseModal={openDeliveryExpenseModal} openPersonalWithdrawalModal={openPersonalWithdrawalModal} treasuryTransactions={treasuryTransactions} handleEditPortfolioTx={handleEditPortfolioTx} handleEditClientTx={handleEditClientTx} handleEditTreasuryTx={handleEditTreasuryTx} handleDeleteClientTxClick={handleDeleteClientTxClick} setTreasuryTxToDelete={setTreasuryTxToDelete}/>}

                    {view === 'statistiques' && <PortfolioPage {...portfolioPageProps}/>}

                    {view === 'analytics' && <AnalyticsPage {...portfolioPageProps}/>}

                    {view === 'expenses' && PersonalExpensesPage && (<PersonalExpensesPage personalExpenses={personalExpenses} managerAvailableProfit={managerAvailableProfit} managerExists={managerExists} onOpenReconcile={openReconcileAdvanceModal} onEditExpense={openEditPersonalExpense} onDeleteExpense={setPersonalExpenseToDelete} onExportReport={handleExportPersonalExpensesReport}/>)}

                    {view === 'dzd' && <ClientsPage {...clientsPageProps}/>}

                    {view === 'tresorerie' && (<TresoreriePage {...{
            caisseBalance: treasuryStats.caisse,
            baridiBalance: treasuryStats.baridi,
            totalDettes: totals.totalDettes,
            totalAvances: totals.totalAvances,
            investorLiability,
            portfolioValue: (portfolioStats.usdt.available * (portfolioStats.usdt.avgBuy || 0) + portfolioStats.eur.available * (portfolioStats.eur.avgBuy || 0)),
            openTreasuryModal: () => openTreasuryCardModal(),
            treasuryCards,
            openTreasuryCardModal,
            setTreasuryCardToDelete,
            openTreasuryBalanceEditModal,
            openDeliveryExpenseModal,
            servicesSummary,
            onOpenServices: openServicesView
        }}/>)}

                    {view === 'services' && (selectedAssetClientId ? (<ManualClientPage client={manualAssetClients.find(c => c.id === selectedAssetClientId)!} transactions={manualAssetTransactions.filter(tx => tx.clientId === selectedAssetClientId)} balance={assetClientBalances.get(`${selectedAssetId}_${selectedAssetClientId}`) || 0} onBack={() => setSelectedAssetClientId(null)} onAddTransaction={handleCreateAssetTransaction} onUpdateTransaction={handleUpdateAssetTransaction} onDeleteTransaction={handleDeleteAssetTransaction}/>) : selectedAssetId ? (<ManualAssetPage asset={manualAssets.find(a => a.id === selectedAssetId)!} clients={manualAssetClients.filter(c => c.assetId === selectedAssetId)} assetTransactions={manualAssetTransactions.filter(tx => tx.actifId === selectedAssetId)} clientBalances={assetClientBalances} onBack={() => setSelectedAssetId(null)} onSelectClient={(client) => setSelectedAssetClientId(client.id)} onCreateClient={(fullName, phone, email, notes) => {
                handleCreateAssetClient(selectedAssetId, { fullName, phone, email, notes });
            }} onUpdateClient={(clientId, data) => {
                handleUpdateAssetClient(clientId, data);
            }} onDeleteClient={handleDeleteAssetClient}/>) : (<ServicesPage manualAssets={manualAssets} manualAssetClients={manualAssetClients} manualAssetTransactions={manualAssetTransactions} assetClientBalances={assetClientBalances} onOpenManualAsset={(asset: ManualAsset) => setSelectedAssetId(asset.id)} onOpenCreateManualAsset={() => setIsCreateAssetModalOpen(true)} onDeleteManualAsset={(id: string) => handleDeleteAsset(id, manualAssetTransactions.filter(tx => tx.actifId === id).length)}/>))}

                    {view === 'investors' && (selectedInvestorId && selectedInvestor ? (<InvestorDetailsPage investor={selectedInvestor} transactions={investorTransactions.filter(tx => tx.investorId === selectedInvestorId)} onBack={() => setSelectedInvestorId(null)} onAddCapital={() => { setInvestorTxType('deposit_capital'); setIsInvestorTxModalOpen(true); }} onWithdrawCapital={() => { setInvestorTxType('withdraw_capital'); setIsInvestorTxModalOpen(true); }} onWithdrawProfit={() => { setInvestorTxType('withdraw_profit'); setIsInvestorTxModalOpen(true); }} onReinvestProfit={() => {
                const inv = derivedInvestors.find(i => i.id === selectedInvestorId);
                if (inv) {
                    setReinvestInput((inv.availableProfit || 0).toFixed(2));
                    setIsReinvestModalOpen(true);
                }
            }} onDeleteTransaction={(tx) => { setInvestorTxToDelete(tx); }} onExportReport={(range) => handleExportInvestorReport(selectedInvestorId, range)} globalNetProfit={globalNetProfit} managerFeePercentage={Number(managerFeePercentage)} totalCapital={derivedInvestors.reduce((sum, inv) => sum + (inv.isActive ? inv.capitalInvested : 0), 0)}/>) : (<InvestorsPage investors={derivedInvestors} onOpenInvestor={(inv) => setSelectedInvestorId(inv.id)} onAddInvestor={() => openInvestorModal(null)} onEditInvestor={(inv) => openInvestorModal(inv)} onDeleteInvestor={(inv) => { setInvestorToDelete(inv); }} investorEconomicsTotals={investorEconomicsTotals} managerFeePercentage={managerFeePercentage} setManagerFeePercentage={setManagerFeePercentage}/>))}
                    </ErrorBoundary>
                    </Suspense>
                </main>);
}
export const MainContentArea = memo(MainContentAreaComponent, areMainContentAreaPropsEqual);
