import { Fragment, lazy, Suspense, useMemo, useState } from 'react';
import { TreasuryCard, TreasuryTx } from '../types';
import { TreasurySummarySection } from '../components/treasury/TreasurySummarySection';
import { CashCountSection } from '../components/treasury/CashCountSection';
import { expectedCashCount } from '../utils/cashCount';
import { TreasuryCollectionsSection } from '../components/treasury/TreasuryCollectionsSection';
import { CapitalOverviewCard } from '../components/financial/CapitalOverviewCard';
import { ListRow, SectionCard } from '../components/cards';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { ArrowDownLeftIcon } from '../components/icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../components/icons/ArrowUpRightIcon';
import { BanknotesIcon } from '../components/icons/BanknotesIcon';
import { DownloadCloudIcon } from '../components/icons/DownloadCloudIcon';
import { EmptyState } from '../components/ui/EmptyState';
import { useLanguage } from '../contexts/LanguageContext';
import type { CapitalSnapshot } from '../utils/capitalSnapshot';
const TreasuryReportDialog = lazy(() => import('../components/reports/documents/DocumentReportDialogs').then((module) => ({ default: module.TreasuryReportDialog })));

/** Mirrors the wallet resolution used for the Caisse/BaridiMob balances in useAppData. */
function isCashWalletMovement(tx: TreasuryTx): boolean {
    const raw = tx as TreasuryTx & { asset?: string };
    const source = String(raw.source || '').toLowerCase();
    return source.includes('caisse')
        || source.includes('baridi')
        || raw.asset === 'DZD-Caisse'
        || raw.asset === 'DZD-Baridi';
}

/** Rows of the treasury PDF: cash movements only, newest first, like the balances. */
export function treasuryPdfRows(treasuryTransactions: TreasuryTx[]) {
    return treasuryTransactions
        .filter((tx) => tx.type !== 'Transfer' && isCashWalletMovement(tx))
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((tx) => ({
            date: tx.date,
            time: tx.time,
            type: tx.type,
            source: tx.source ?? '',
            amount: Number(tx.amount || 0),
            notes: tx.notes ?? '',
            origin: tx.origin,
        }));
}

const isMoneyIn = (tx: TreasuryTx) => tx.type === 'Ajout' || tx.type === 'Adjustment (+)';
const MOVEMENT_LABEL_KEYS: Partial<Record<TreasuryTx['type'], string>> = {
    'Ajout': 'treasury.inShort',
    'Retrait': 'treasury.outShort',
    'Adjustment (+)': 'treasury.adjustmentIn',
    'Adjustment (-)': 'treasury.adjustmentOut',
};
const WALLET_LABEL_KEYS: Record<string, string> = { Caisse: 'transactions.cash', BaridiMob: 'transactions.baridi' };

type TresoreriePageProps = {
    caisseBalance: number;
    baridiBalance: number;
    investorBreakdown?: { capital: number; profits: number; total: number };
    capitalSnapshot: CapitalSnapshot;
    openTreasuryModal: () => void;
    treasuryCards: TreasuryCard[];
    openTreasuryCardModal: (card?: TreasuryCard) => void;
    setTreasuryCardToDelete: (card: TreasuryCard | null) => void;
    openTreasuryBalanceEditModal: (asset: 'Caisse' | 'BaridiMob') => void;
    openDeliveryExpenseModal?: () => void;
    treasuryTransactions?: TreasuryTx[];
    onOpenServices?: () => void;
    [key: string]: any;
};
export function TresoreriePage({ caisseBalance, baridiBalance, investorBreakdown, capitalSnapshot, treasuryCards, openTreasuryCardModal, setTreasuryCardToDelete, openTreasuryBalanceEditModal, openDeliveryExpenseModal, treasuryTransactions = [], onOpenServices, userDocRef, portfolioStats }: TresoreriePageProps) {
    const { t } = useLanguage();
    const weekdays = t('common.weekdaysNarrow') as unknown as string[];

    // Last 7 days cash flow
    const weeklyFlow = useMemo(() => {
        const now = new Date();
        const result = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
            d.setHours(0, 0, 0, 0);
            const dayStart = d.getTime();
            const dayEnd = dayStart + 86_400_000 - 1;
            const dow = d.getDay();
            return { dayStart, dayEnd, weekday: dow === 0 ? 6 : dow - 1, isToday: i === 6, cashIn: 0, cashOut: 0 };
        });
        for (const tx of treasuryTransactions) {
            if (!tx.timestamp) continue;
            const slot = result.find((r) => tx.timestamp >= r.dayStart && tx.timestamp <= r.dayEnd);
            if (!slot) continue;
            // Only movements of the Caisse/BaridiMob wallets are cash flow; personal
            // expenses paid from the USDT/EUR wallets carry no cash source.
            if (!isCashWalletMovement(tx)) continue;
            const amount = Number(tx.amount || 0);
            if (tx.type === 'Ajout' || tx.type === 'Adjustment (+)') slot.cashIn += amount;
            else if (tx.type === 'Retrait' || tx.type === 'Adjustment (-)') slot.cashOut += amount;
        }
        const maxVal = Math.max(...result.flatMap((r) => [r.cashIn, r.cashOut]), 1);
        return { days: result, maxVal, totalIn: result.reduce((s, r) => s + r.cashIn, 0), totalOut: result.reduce((s, r) => s + r.cashOut, 0) };
    }, [treasuryTransactions]);
    const recentTxs = useMemo(() => {
        return [...treasuryTransactions]
            .filter((tx) => tx.type !== 'Transfer' && isCashWalletMovement(tx) && !tx.origin?.startsWith('investor') && !tx.origin?.startsWith('personal'))
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 12);
    }, [treasuryTransactions]);

    // The treasury report: its movements and balances are fixed when the window opens.
    const [report, setReport] = useState<{ rows: ReturnType<typeof treasuryPdfRows>; balances: { caisse: number; baridi: number } } | null>(null);
    const exportPdf = () => setReport({ rows: treasuryPdfRows(treasuryTransactions), balances: { caisse: caisseBalance, baridi: baridiBalance } });

    return (<div className="anim-page-in flex flex-col gap-3">
      <CapitalOverviewCard t={t} capitalSnapshot={capitalSnapshot} investorBreakdown={investorBreakdown} showBreakdown/>

      <TreasurySummarySection caisseBalance={caisseBalance} baridiBalance={baridiBalance} dettesAbs={capitalSnapshot.receivables} totalAvances={capitalSnapshot.clientAdvances} servicesCapitalImpact={capitalSnapshot.servicesCapitalImpact} openTreasuryBalanceEditModal={openTreasuryBalanceEditModal} openDeliveryExpenseModal={openDeliveryExpenseModal} deliveryExpenseLabel={t('delivery.addExpense') as string} onOpenServices={onOpenServices}/>

      {/* V5-2: the count, right under the balances it checks. */}
      <CashCountSection userDocRef={userDocRef} expected={expectedCashCount({ caisse: caisseBalance, baridi: baridiBalance, usdt: portfolioStats?.usdt ?? { available: 0 }, eur: portfolioStats?.eur ?? { available: 0 } })}/>

      {weeklyFlow.days.some((d) => d.cashIn > 0 || d.cashOut > 0) && (<SectionCard title={t('treasury.flow7Days')}>
          <div aria-hidden="true" className="flex h-20 items-end gap-1">
            {weeklyFlow.days.map((day) => {
                const inH = day.cashIn > 0 ? Math.max(6, (day.cashIn / weeklyFlow.maxVal) * 64) : 0;
                const outH = day.cashOut > 0 ? Math.max(6, (day.cashOut / weeklyFlow.maxVal) * 64) : 0;
                return (<div key={day.dayStart} className="flex h-full flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                    {inH > 0 && <div className={`w-[38%] max-w-[12px] rounded-t-sm ${day.isToday ? 'bg-financial-profit' : 'bg-financial-profit/60'}`} style={{ height: `${inH}px` }}/>}
                    {outH > 0 && <div className={`w-[38%] max-w-[12px] rounded-t-sm ${day.isToday ? 'bg-financial-loss' : 'bg-financial-loss/60'}`} style={{ height: `${outH}px` }}/>}
                  </div>
                  <span className={`text-xs font-semibold leading-none ${day.isToday ? 'text-primary dark:text-primary-light' : 'text-neutral-500'}`}>{weekdays[day.weekday]}</span>
                </div>);
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-financial-profit"/>{t('treasury.flowIn')}</p>
              <CurrencyAmount value={weeklyFlow.totalIn} currency="DZD" size="md" decimals={0} className="mt-0.5 block"/>
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-financial-loss"/>{t('treasury.flowOut')}</p>
              <CurrencyAmount value={weeklyFlow.totalOut} currency="DZD" size="md" decimals={0} className="mt-0.5 block"/>
            </div>
          </div>
        </SectionCard>)}

      <TreasuryCollectionsSection treasuryCards={treasuryCards} openTreasuryCardModal={openTreasuryCardModal} setTreasuryCardToDelete={setTreasuryCardToDelete}/>

      <SectionCard title={t('treasury.recentMovements')} flush actions={recentTxs.length > 0 ? (<button type="button" onClick={exportPdf} aria-label={t('treasury.exportPdf') as string} title={t('treasury.exportPdf') as string} className="flex h-touch w-touch items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-surface-muted hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <DownloadCloudIcon className="h-5 w-5"/>
          </button>) : undefined}>
        {recentTxs.length === 0 ? (<EmptyState icon={<BanknotesIcon className="w-5 h-5"/>} title={t('emptyStates.mouvement.title')} subtitle={t('emptyStates.mouvement.subtitle')}/>) : recentTxs.map((tx) => {
            const isIn = isMoneyIn(tx);
            const amount = Number(tx.amount || 0);
            const labelKey = MOVEMENT_LABEL_KEYS[tx.type];
            const walletKey = tx.source ? WALLET_LABEL_KEYS[tx.source] : undefined;
            const wallet = walletKey ? t(walletKey) : (tx.source ?? '—');
            return (<Fragment key={tx.id}>
                <ListRow icon={isIn ? <ArrowDownLeftIcon className="h-5 w-5"/> : <ArrowUpRightIcon className="h-5 w-5"/>} tone={isIn ? 'profit' : 'loss'} title={labelKey ? t(labelKey) : tx.type} subtitle={`${wallet} · ${tx.date}${tx.notes ? ` · ${tx.notes}` : ''}`} wrapSubtitle trailing={<CurrencyAmount value={isIn ? amount : -amount} currency="DZD" semantic="auto" size="md" decimals={0} showSign/>}/>
              </Fragment>);
        })}
      </SectionCard>

      {report && (<Suspense fallback={null}>
          <TreasuryReportDialog onClose={() => setReport(null)} rows={report.rows} balances={report.balances}/>
        </Suspense>)}
    </div>);
}
