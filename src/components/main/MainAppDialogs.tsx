import React, { Suspense } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
const WalletTransferDialog = React.lazy(() => import('./MainDialogs').then((module) => ({ default: module.WalletTransferDialog })));
const MainTransferAndFilterDialogs = React.lazy(() => import('./MainTransferAndFilterDialogs').then((module) => ({ default: module.MainTransferAndFilterDialogs })));
const MainTransactionDialog = React.lazy(() => import('./MainTransactionDialog').then((module) => ({ default: module.MainTransactionDialog })));
const MainClientSummaryDialog = React.lazy(() => import('./MainClientSummaryDialog').then((module) => ({ default: module.MainClientSummaryDialog })));
const MainInvestorDialogs = React.lazy(() => import('./MainInvestorDialogs').then((module) => ({ default: module.MainInvestorDialogs })));
const MainUtilityDialogs = React.lazy(() => import('./MainUtilityDialogs').then((module) => ({ default: module.MainUtilityDialogs })));
const MainClientOperationsDialogs = React.lazy(() => import('./MainClientOperationsDialogs').then((module) => ({ default: module.MainClientOperationsDialogs })));
const MainClientCrudDialogs = React.lazy(() => import('./MainClientCrudDialogs').then((module) => ({ default: module.MainClientCrudDialogs })));
const DeliveryExpenseModal = React.lazy(() => import('../modals/DeliveryExpenseModal').then((module) => ({ default: module.DeliveryExpenseModal })));
const PersonalWithdrawalModal = React.lazy(() => import('../modals/PersonalWithdrawalModal').then((module) => ({ default: module.PersonalWithdrawalModal })));
const PersonalAdvanceReconcileModal = React.lazy(() => import('../modals/PersonalAdvanceReconcileModal').then((module) => ({ default: module.PersonalAdvanceReconcileModal })));
type MainAppDialogsProps = Record<string, any>;
/**
 * Renders all of the global modal/dialog mounts that previously lived in
 * MainApp.tsx. Pure structural extraction — no behavior or wiring change.
 * Receives every referenced value as a single props bag (mirrors the
 * MainContentArea pattern). Each lazy chunk loads on demand.
 */
export function MainAppDialogs(props: MainAppDialogsProps) {
    const { 
    // walletTransferDialog
    isWalletTransferModalOpen, walletTransferDialogProps, 
    // clientOperations bundle
    isClientOperationsOpen, isClientTxModalOpen, setIsClientTxModalOpen, editingClientTx, clientTxType, setClientTxType, clientTxUsdtAmount, setClientTxUsdtAmount, clientTxSellPrice, setClientTxSellPrice, clientTxEurAmount, setClientTxEurAmount, clientTxEurPrice, setClientTxEurPrice, clientTxAmount, setClientTxAmount, clientTxNotes, setClientTxNotes, clientTxPaymentStatus, setClientTxPaymentStatus, clientTxLinkedClientId, clientTxReceiverClientId, setClientTxReceiverClientId, handleSaveClientTx, selectedClientId, isAdjustmentModalOpen, setIsAdjustmentModalOpen, editingTreasuryTx, adjustmentTab, setAdjustmentTab, adjustmentAsset, setAdjustmentAsset, adjustmentAmount, setAdjustmentAmount, adjustmentClientId, setAdjustmentClientId, adjustmentPrice, setAdjustmentPrice, adjustmentNote, setAdjustmentNote, clientBalances, portfolioStats, treasuryStats, clientsDzd, getClientFullName, treasuryCards, handleGlobalAdjustment, 
    // shared
    fieldBase, t, isSaving, setAlert,
    // transferAndFilter bundle
    isTransferAndFilterDialogsOpen, clientTransferDialogProps, treasuryBalanceEditDialogProps, portfolioBalanceEditDialogProps, dateFilterDialogProps, 
    // transaction dialog
    isTransactionDialogOpen, mode, editingTx, closeForm, openForm, buyUsdtMode, setBuyUsdtMode, setEurDzdPrice, buyUsdtAmount, setBuyUsdtAmount, isTotalManual, setIsTotalManual, buyUsdtPrice, setBuyUsdtPrice, buyUsdtTotal, setBuyUsdtTotal, formValidation, linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientPaymentStatus, setClientPaymentStatus, creditDueDate, setCreditDueDate, pendingCreditRisk, confirmCreditRisk, cancelCreditRisk, notes, setNotes, txTags, setTxTags, buyEurForUsdtAmount, setBuyEurForUsdtAmount, eurDzdPrice, eurUsdtRate, setEurUsdtRate, sellAmount, setSellAmount, sellPrice, setSellPrice, sellTotal, setSellTotal, sellSettlementCurrency, setSellSettlementCurrency, sellEurToDzdRate, setSellEurToDzdRate, profitPercent, setProfitPercent, buyEurAmount, setBuyEurAmount, buyEurPrice, setBuyEurPrice, buyEurTotal, setBuyEurTotal, handleBuy, handleSell, buyRestriction, setBuyRestriction, realPurchaseTime, setRealPurchaseTime, smartPricingByCurrency, smartQuoteRef,
    // clientCrud bundle
    isClientCrudDialogsOpen, txToDelete, setTxToDelete, handleDeleteConfirm, clientTxToDelete, setClientTxToDelete, handleDeleteClientTxConfirm, isClientModalOpen, setIsClientModalOpen, editingClient, clientFullName, setClientFullName, clientPhone, setClientPhone, clientRedotpayId, setClientRedotpayId, clientBinanceEmail, setClientBinanceEmail, clientNotes, setClientNotes, clientCreditLimit, setClientCreditLimit, clientGroup, setClientGroup, clientIsFournisseur, setClientIsFournisseur, initialBalance, setInitialBalance, handleSaveClient, clientToDelete, clientDeleteMode, handleClientDeleteRequest, handleDeleteClient,
    // utility bundle
    isUtilityDialogsOpen, isSettingsModalOpen, setIsSettingsModalOpen, setIsResetModalOpen, userDocRef, isResetModalOpen, handleGlobalReset, handleExportBackup, isCreateAssetModalOpen, setIsCreateAssetModalOpen, newAssetName, setNewAssetName, newAssetDescription, setNewAssetDescription, handleCreateAsset, isTreasuryCardModalOpen, setIsTreasuryCardModalOpen, editingTreasuryCard, treasuryCardName, setTreasuryCardName, treasuryCardValue, setTreasuryCardValue, treasuryCardNotes, setTreasuryCardNotes, handleSaveTreasuryCard, treasuryCardToDelete, setTreasuryCardToDelete, handleDeleteTreasuryCard, treasuryTxToDelete, setTreasuryTxToDelete, handleDeleteTreasuryTxConfirm,
    // client summary
    isClientSummaryOpen, summaryClient, setSummaryClient, clientTransactionsDzd, transactions, handleExportClientReport, reportMonth, reportYear, 
    // investor bundle
    isInvestorDialogsOpen, isInvestorModalOpen, setIsInvestorModalOpen, editingInvestor, handleSaveInvestor, investorName, setInvestorName, investorInitialCapital, setInvestorInitialCapital, investorInitialCapitalSource, setInvestorInitialCapitalSource, investorNotes, setInvestorNotes, isManager, setIsManager, derivedInvestors, selectedInvestorId, isInvestorTxModalOpen, setIsInvestorTxModalOpen, investorTxType, investorTxAmount, setInvestorTxAmount, investorTxPaymentSource, setInvestorTxPaymentSource, investorTxNotes, setInvestorTxNotes, handleInvestorTransaction, investorToDelete, setInvestorToDelete, handleDeleteInvestor, investorTxToDelete, setInvestorTxToDelete, handleDeleteInvestorTx, isReinvestModalOpen, setIsReinvestModalOpen, reinvestInput, setReinvestInput, handleReinvestProfit,
    // project expense
    isDeliveryExpenseModalOpen, closeDeliveryExpenseModal, deliveryExpenseAmount, setDeliveryExpenseAmount, deliveryExpenseMethod, setDeliveryExpenseMethod, deliveryExpenseDate, setDeliveryExpenseDate, deliveryExpenseNote, setDeliveryExpenseNote, handleSaveDeliveryExpense, 
    // personal withdrawal (manager's daily personal expense)
    isPersonalWithdrawalModalOpen, closePersonalWithdrawalModal, personalWithdrawalAmount, setPersonalWithdrawalAmount, personalWithdrawalMethod, setPersonalWithdrawalMethod, personalWithdrawalDate, setPersonalWithdrawalDate, personalWithdrawalNote, setPersonalWithdrawalNote, personalWithdrawalMode, setPersonalWithdrawalMode, editingPersonalExpenseTx, personalExpenseToDelete, setPersonalExpenseToDelete, handleSavePersonalWithdrawal, handleDeletePersonalExpense, managerAvailableProfit, managerExists, 
    // reconcile advance
    isReconcileAdvanceModalOpen, closeReconcileAdvanceModal, reconcileAdvanceTx, reconcileActualAmount, setReconcileActualAmount, reconcileSpentDescription, setReconcileSpentDescription, handleReconcilePersonalAdvance } = props;
    return (<>
            {isWalletTransferModalOpen && (<Suspense fallback={null}>
                    <WalletTransferDialog {...walletTransferDialogProps}/>
                </Suspense>)}
            {isClientOperationsOpen && (<Suspense fallback={null}>
                    <MainClientOperationsDialogs {...{ isClientTxModalOpen, setIsClientTxModalOpen, editingClientTx, t, clientTxType, setClientTxType, fieldBase, clientTxUsdtAmount, setClientTxUsdtAmount, clientTxSellPrice, setClientTxSellPrice, clientTxEurAmount, setClientTxEurAmount, clientTxEurPrice, setClientTxEurPrice, clientTxAmount, setClientTxAmount, clientTxNotes, setClientTxNotes, clientTxPaymentStatus, setClientTxPaymentStatus, clientTxLinkedClientId, clientTxReceiverClientId, setClientTxReceiverClientId, handleSaveClientTx, selectedClientId, isAdjustmentModalOpen, setIsAdjustmentModalOpen, editingTreasuryTx, adjustmentTab, setAdjustmentTab, adjustmentAsset, setAdjustmentAsset, adjustmentAmount, setAdjustmentAmount, adjustmentClientId, clientBalances, portfolioStats, treasuryStats, clientsDzd, getClientFullName, setAdjustmentClientId, adjustmentPrice, setAdjustmentPrice, adjustmentNote, setAdjustmentNote, treasuryCards, handleGlobalAdjustment, isSaving }}/>
                </Suspense>)}
            {isTransferAndFilterDialogsOpen && (<Suspense fallback={null}>
                    <MainTransferAndFilterDialogs clientTransferProps={clientTransferDialogProps} treasuryBalanceEditProps={treasuryBalanceEditDialogProps} portfolioBalanceEditProps={portfolioBalanceEditDialogProps} dateFilterProps={dateFilterDialogProps}/>
                </Suspense>)}
            {isTransactionDialogOpen && (<Suspense fallback={null}>
                    <MainTransactionDialog {...{ mode, editingTx, closeForm, openForm, t, fieldBase, buyUsdtMode, setBuyUsdtMode, setEurDzdPrice, portfolioStats, buyUsdtAmount, setBuyUsdtAmount, isTotalManual, buyUsdtPrice, setBuyUsdtPrice, buyUsdtTotal, setBuyUsdtTotal, setIsTotalManual, formValidation, linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, clientPaymentStatus, setClientPaymentStatus, creditDueDate, setCreditDueDate, pendingCreditRisk, confirmCreditRisk, cancelCreditRisk, notes, setNotes, txTags, setTxTags, buyEurForUsdtAmount, setBuyEurForUsdtAmount, eurDzdPrice, eurUsdtRate, setEurUsdtRate, sellAmount, setSellAmount, sellPrice, setSellPrice, sellTotal, setSellTotal, sellSettlementCurrency, setSellSettlementCurrency, sellEurToDzdRate, setSellEurToDzdRate, profitPercent, setProfitPercent, buyEurAmount, setBuyEurAmount, buyEurPrice, setBuyEurPrice, buyEurTotal, setBuyEurTotal, clientBalances, handleBuy, handleSell, isSaving, buyRestriction, setBuyRestriction, realPurchaseTime, setRealPurchaseTime, smartPricingByCurrency, smartQuoteRef }}/>
                </Suspense>)}
            {isClientCrudDialogsOpen && (<Suspense fallback={null}>
                    <MainClientCrudDialogs {...{ txToDelete, setTxToDelete, t, handleDeleteConfirm, clientTxToDelete, setClientTxToDelete, handleDeleteClientTxConfirm, isClientModalOpen, setIsClientModalOpen, editingClient, clientFullName, setClientFullName, clientPhone, setClientPhone, clientRedotpayId, setClientRedotpayId, clientBinanceEmail, setClientBinanceEmail, clientNotes, setClientNotes, clientCreditLimit, setClientCreditLimit, clientGroup, setClientGroup, clientIsFournisseur, setClientIsFournisseur, initialBalance, setInitialBalance, fieldBase, handleSaveClient, clientToDelete, clientDeleteMode, setClientToDelete: handleClientDeleteRequest, handleDeleteClient }}/>
                </Suspense>)}
            {isUtilityDialogsOpen && (<Suspense fallback={null}>
                    <MainUtilityDialogs {...{ isSettingsModalOpen, setIsSettingsModalOpen, t, fieldBase, setIsResetModalOpen, userDocRef, setAlert, isResetModalOpen, handleGlobalReset, handleExportBackup, isCreateAssetModalOpen, setIsCreateAssetModalOpen, newAssetName, setNewAssetName, newAssetDescription, setNewAssetDescription, handleCreateAsset, isTreasuryCardModalOpen, setIsTreasuryCardModalOpen, editingTreasuryCard, treasuryCardName, setTreasuryCardName, treasuryCardValue, setTreasuryCardValue, treasuryCardNotes, setTreasuryCardNotes, handleSaveTreasuryCard, isSaving, treasuryCardToDelete, setTreasuryCardToDelete, handleDeleteTreasuryCard, treasuryTxToDelete, setTreasuryTxToDelete, handleDeleteTreasuryTxConfirm }}/>
                </Suspense>)}
            {isClientSummaryOpen && (<Suspense fallback={null}>
                    <MainClientSummaryDialog {...{
            summaryClient,
            setSummaryClient,
            t,
            clientBalances,
            clientTransactionsDzd,
            clientsDzd,
            transactions,
            setAlert,
            getClientFullName,
            handleExportClientReport,
            reportMonth,
            reportYear
        }}/>
                </Suspense>)}
            {isInvestorDialogsOpen && (<Suspense fallback={null}>
                    <MainInvestorDialogs {...{ isInvestorModalOpen, setIsInvestorModalOpen, editingInvestor, handleSaveInvestor, investorName, setInvestorName, fieldBase, investorInitialCapital, setInvestorInitialCapital, investorInitialCapitalSource, setInvestorInitialCapitalSource, investorNotes, setInvestorNotes, isManager, setIsManager, derivedInvestors, selectedInvestorId, isInvestorTxModalOpen, setIsInvestorTxModalOpen, investorTxType, investorTxAmount, setInvestorTxAmount, investorTxPaymentSource, setInvestorTxPaymentSource, treasuryStats, investorTxNotes, setInvestorTxNotes, handleInvestorTransaction, t, investorToDelete, setInvestorToDelete, handleDeleteInvestor, investorTxToDelete, setInvestorTxToDelete, handleDeleteInvestorTx, isReinvestModalOpen, setIsReinvestModalOpen, reinvestInput, setReinvestInput, handleReinvestProfit, setAlert }}/>
                </Suspense>)}
            {isDeliveryExpenseModalOpen && (<Suspense fallback={null}>
                    <DeliveryExpenseModal isOpen={isDeliveryExpenseModalOpen} onClose={closeDeliveryExpenseModal} isSaving={isSaving} amount={deliveryExpenseAmount} setAmount={setDeliveryExpenseAmount} method={deliveryExpenseMethod} setMethod={setDeliveryExpenseMethod} date={deliveryExpenseDate} setDate={setDeliveryExpenseDate} note={deliveryExpenseNote} setNote={setDeliveryExpenseNote} treasuryStats={treasuryStats} onSave={handleSaveDeliveryExpense}/>
                </Suspense>)}
            {isPersonalWithdrawalModalOpen && (<Suspense fallback={null}>
                    <PersonalWithdrawalModal isOpen={isPersonalWithdrawalModalOpen} onClose={closePersonalWithdrawalModal} isSaving={isSaving} amount={personalWithdrawalAmount} setAmount={setPersonalWithdrawalAmount} method={personalWithdrawalMethod} setMethod={setPersonalWithdrawalMethod} date={personalWithdrawalDate} setDate={setPersonalWithdrawalDate} note={personalWithdrawalNote} setNote={setPersonalWithdrawalNote} mode={personalWithdrawalMode} setMode={setPersonalWithdrawalMode} treasuryStats={treasuryStats} managerAvailableProfit={managerAvailableProfit} managerExists={managerExists} editingTx={editingPersonalExpenseTx} onSave={handleSavePersonalWithdrawal}/>
                </Suspense>)}
            {isReconcileAdvanceModalOpen && (<Suspense fallback={null}>
                    <PersonalAdvanceReconcileModal isOpen={isReconcileAdvanceModalOpen} onClose={closeReconcileAdvanceModal} isSaving={isSaving} advanceTx={reconcileAdvanceTx} actualAmount={reconcileActualAmount} setActualAmount={setReconcileActualAmount} spentDescription={reconcileSpentDescription} setSpentDescription={setReconcileSpentDescription} onSave={handleReconcilePersonalAdvance}/>
                </Suspense>)}
            <ConfirmDialog isOpen={personalExpenseToDelete !== null} onClose={() => setPersonalExpenseToDelete(null)} onConfirm={handleDeletePersonalExpense} title={(t('personalExpenses.deleteTitle') as string) || "Supprimer cette dépense ?"} description={(t('personalExpenses.deleteDesc') as string) || "La ligne de caisse, le retrait du profit du gérant et le retour lié s'il existe seront supprimés ensemble."} confirmLabel={(t('common.delete') as string) || "Supprimer"} cancelLabel={(t('common.cancel') as string) || "Annuler"} variant="danger" loading={isSaving}/>
        </>);
}
