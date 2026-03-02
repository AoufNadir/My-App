import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { NumberInput } from '../components/ui/NumberInput';
import { Tx, ClientDzd, ClientTransactionDzd } from '../types';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { useLanguage } from '../contexts/LanguageContext';

type AnalyticsPageProps = {
  statsView: 'usdt' | 'clients';
  setStatsView: (view: 'usdt' | 'clients') => void;
  isDark: boolean;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  cardBase: string;
  subtleText: string;
  portfolioStats: any;
  totalPortfolioValue: number;
  suggestedProfitMargin: string;
  suggestedSellingPrice?: string;
  parseAndEvaluate: (expr: string) => number;
  usdtReportMonth: number;
  setUsdtReportMonth: (month: number) => void;
  usdtReportYear: number;
  setUsdtReportYear: (year: number) => void;
  reportMonths: (year: number) => string[];
  reportYears: number[];
  monthlyStats: any;
  transactions: Tx[];
  selectedHeatmapDay: { day: number; profit: number; } | null;
  setSelectedHeatmapDay: (day: { day: number; profit: number; } | null) => void;
  simMode: 'dzd' | 'eur' | 'sell_dzd';
  setSimMode: (mode: 'dzd' | 'eur' | 'sell_dzd') => void;
  simBuyQty: string;
  setSimBuyQty: (val: string) => void;
  simBuyPrice: string;
  setSimBuyPrice: (val: string) => void;
  fieldBase: string;
  newPamFromDzdSimulator: number | null;
  simEurQty: string;
  setSimEurQty: (val: string) => void;
  simEurDzdPrice: string;
  setSimEurDzdPrice: (val: string) => void;
  simEurUsdtRate: string;
  setSimEurUsdtRate: (val: string) => void;
  newPamFromEurSimulator: number | null;
  handleExportUsdtReport: () => void;
  dzdDashboardStats: any;
  reportClient: string;
  setReportClient: (id: string) => void;
  clientsDzd: ClientDzd[];
  clientTransactionsDzd: ClientTransactionDzd[];
  getClientFullName: (client: ClientDzd) => string;
  reportMonth: number;
  setReportMonth: (month: number) => void;
  reportYear: number;
  setReportYear: (year: number) => void;
  handleExportClientReport: (clientId: string, month: number, year: number) => void;
  simSellUsdtQty?: string;
  setSimSellUsdtQty?: (val: string) => void;
  simSellDzdPrice?: string;
  setSimSellDzdPrice?: (val: string) => void;
  openPortfolioBalanceEditModal?: (asset: 'USDT' | 'EUR') => void;
};

type MonthlyClientRank = {
  clientId: string;
  clientName: string;
  buyVolumeUsdt: number;
  sellVolumeUsdt: number;
  totalVolumeUsdt: number;
  realizedProfit: number;
  txCount: number;
  sellCount: number;
};

export function AnalyticsPage(props: AnalyticsPageProps) {
  const {
    isDark,
    cardBase,
    subtleText,
    portfolioStats,
    suggestedProfitMargin,
    suggestedSellingPrice,
    parseAndEvaluate,
    usdtReportMonth,
    setUsdtReportMonth,
    usdtReportYear,
    setUsdtReportYear,
    reportMonths,
    reportYears,
    transactions,
    selectedHeatmapDay,
    setSelectedHeatmapDay,
    simMode,
    setSimMode,
    simBuyQty,
    setSimBuyQty,
    simBuyPrice,
    setSimBuyPrice,
    fieldBase,
    newPamFromDzdSimulator,
    simEurQty,
    setSimEurQty,
    simEurDzdPrice,
    setSimEurDzdPrice,
    simEurUsdtRate,
    setSimEurUsdtRate,
    newPamFromEurSimulator,
    simSellUsdtQty,
    setSimSellUsdtQty,
    simSellDzdPrice,
    setSimSellDzdPrice,
    clientTransactionsDzd,
    clientsDzd,
    getClientFullName
  } = props;

  const { t } = useLanguage();

  const calculatedStats = useMemo(() => {
    let volUsdtBought = 0;
    let volUsdtSold = 0;
    let volEurBought = 0;
    let realizedProfit = 0;

    const startDate = new Date(usdtReportYear, usdtReportMonth, 1).getTime();
    const endDate = new Date(usdtReportYear, usdtReportMonth + 1, 0, 23, 59, 59).getTime();

    transactions.forEach(tx => {
      if (tx.timestamp >= startDate && tx.timestamp <= endDate) {
        if (tx.currency === 'USDT') {
          if (tx.type === 'buy') {
            volUsdtBought += tx.quantity;
          } else if (tx.type === 'sell') {
            volUsdtSold += tx.quantity;
            realizedProfit += (tx.profit || 0);
          }
        } else if (tx.currency === 'EUR') {
          if (tx.type === 'buy') {
            volEurBought += tx.quantity;
          }
        }
      }
    });

    return { volUsdtBought, volUsdtSold, volEurBought, realizedProfit };
  }, [transactions, usdtReportMonth, usdtReportYear]);

  const heatmapData = useMemo(() => {
    const salesByDay = new Map<number, number>();

    const startDate = new Date(usdtReportYear, usdtReportMonth, 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(usdtReportYear, usdtReportMonth + 1, 0);
    endDate.setHours(23, 59, 59, 999);

    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    transactions.forEach(tx => {
      if (tx.type === 'sell' && tx.currency === 'USDT' && tx.timestamp >= startTimestamp && tx.timestamp <= endTimestamp) {
        const txDate = new Date(tx.timestamp);
        const day = txDate.getDate();
        const currentProfit = salesByDay.get(day) || 0;
        const profit = (typeof tx.profit === 'number' && !isNaN(tx.profit)) ? tx.profit : 0;
        salesByDay.set(day, currentProfit + profit);
      }
    });

    return salesByDay;
  }, [transactions, usdtReportMonth, usdtReportYear]);

  const simSellResult = useMemo(() => {
    if (simMode !== 'sell_dzd' || !simSellUsdtQty || !simSellDzdPrice || !parseAndEvaluate) return null;
    const qty = parseAndEvaluate(simSellUsdtQty);
    const price = parseAndEvaluate(simSellDzdPrice);
    if (isNaN(qty) || isNaN(price)) return null;

    const pam = portfolioStats.usdt.avgBuy;
    const profit = (price - pam) * qty;

    return { profit, isProfitable: profit >= 0 };
  }, [simMode, simSellUsdtQty, simSellDzdPrice, portfolioStats.usdt.avgBuy, parseAndEvaluate]);

  const monthlyClientRanking = useMemo(() => {
    const startDate = new Date(usdtReportYear, usdtReportMonth, 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(usdtReportYear, usdtReportMonth + 1, 0);
    endDate.setHours(23, 59, 59, 999);

    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    const txClientMap = new Map<string, { clientId: string; timestamp: number }>();
    clientTransactionsDzd.forEach((clientTx) => {
      if (!clientTx.linkedTxId || !clientTx.clientId) return;
      const existing = txClientMap.get(clientTx.linkedTxId);
      if (!existing || clientTx.timestamp > existing.timestamp) {
        txClientMap.set(clientTx.linkedTxId, { clientId: clientTx.clientId, timestamp: clientTx.timestamp });
      }
    });

    const clientNameById = new Map<string, string>();
    clientsDzd.forEach((client) => {
      clientNameById.set(client.id, getClientFullName(client));
    });

    const ranksByClient = new Map<string, MonthlyClientRank>();

    transactions.forEach((tx) => {
      if (tx.currency !== 'USDT') return;
      if (tx.type !== 'buy' && tx.type !== 'sell') return;
      if (!tx.id || tx.timestamp < startTimestamp || tx.timestamp > endTimestamp) return;

      const linkedClient = txClientMap.get(tx.id);
      if (!linkedClient) return;

      const clientId = linkedClient.clientId;
      if (!ranksByClient.has(clientId)) {
        ranksByClient.set(clientId, {
          clientId,
          clientName: clientNameById.get(clientId) || t('portfolio.unknownClient'),
          buyVolumeUsdt: 0,
          sellVolumeUsdt: 0,
          totalVolumeUsdt: 0,
          realizedProfit: 0,
          txCount: 0,
          sellCount: 0
        });
      }

      const row = ranksByClient.get(clientId)!;
      const qty = Number(tx.quantity || 0);
      if (tx.type === 'buy') row.buyVolumeUsdt += qty;
      if (tx.type === 'sell') {
        row.sellVolumeUsdt += qty;
        row.realizedProfit += Number(tx.profit || 0);
        row.sellCount += 1;
      }
      row.txCount += 1;
    });

    const rankedRows = Array.from(ranksByClient.values())
      .map((row) => ({
        ...row,
        totalVolumeUsdt: row.buyVolumeUsdt + row.sellVolumeUsdt
      }))
      .sort((a, b) => {
        if (b.totalVolumeUsdt !== a.totalVolumeUsdt) return b.totalVolumeUsdt - a.totalVolumeUsdt;
        if (b.realizedProfit !== a.realizedProfit) return b.realizedProfit - a.realizedProfit;
        return a.clientName.localeCompare(b.clientName, 'fr');
      });

    const topTradedClient = rankedRows.length > 0 ? rankedRows[0] : null;
    const topProfitableCandidates = rankedRows.filter((row) => row.sellCount > 0);
    const topProfitableClient = topProfitableCandidates.length > 0
      ? [...topProfitableCandidates].sort((a, b) => {
        if (b.realizedProfit !== a.realizedProfit) return b.realizedProfit - a.realizedProfit;
        if (b.totalVolumeUsdt !== a.totalVolumeUsdt) return b.totalVolumeUsdt - a.totalVolumeUsdt;
        return a.clientName.localeCompare(b.clientName, 'fr');
      })[0]
      : null;

    return { rankedRows, topTradedClient, topProfitableClient };
  }, [transactions, clientTransactionsDzd, clientsDzd, getClientFullName, usdtReportMonth, usdtReportYear, t]);

  const ProfitHeatmap = () => {
    const firstDayOfMonth = new Date(usdtReportYear, usdtReportMonth, 1).getDay();
    const daysInMonth = new Date(usdtReportYear, usdtReportMonth + 1, 0).getDate();

    const getHeatmapColor = (profit: number) => {
      if (profit > 10000) return 'bg-green-500';
      if (profit > 5000) return 'bg-green-500/80';
      if (profit > 1000) return 'bg-green-500/60';
      if (profit > 0) return 'bg-green-500/40';
      if (profit < -10000) return 'bg-red-500';
      if (profit < -5000) return 'bg-red-500/80';
      if (profit < -1000) return 'bg-red-500/60';
      if (profit < 0) return 'bg-red-500/40';
      return isDark ? 'bg-white/5' : 'bg-black/5';
    };

    return (
      <div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
          {(t('common.days') as any as string[]).map(day => <div key={day}>{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const profit = heatmapData.get(day) || 0;
            return (
              <div
                key={day}
                className={`w-full aspect-square rounded-md flex items-center justify-center text-xs cursor-pointer transition-transform hover:scale-110 ${getHeatmapColor(profit)} ${selectedHeatmapDay?.day === day ? 'ring-2 ring-offset-2 ring-teal-400 ring-offset-gray-800' : ''}`}
                onClick={() => setSelectedHeatmapDay(selectedHeatmapDay?.day === day ? null : { day, profit })}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="space-y-4">
        <Card className={`${cardBase} p-4 sm:p-6`}>
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><TrendingUpIcon className="w-5 h-5" /> {t('portfolio.analysisReports')}</h2>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t('portfolio.month')}</Label><Select value={usdtReportMonth} onChange={e => setUsdtReportMonth(Number(e.target.value))} className={fieldBase}>{reportMonths(usdtReportYear).map((m, i) => <option key={m} value={i}>{m}</option>)}</Select></div>
              <div><Label>{t('portfolio.year')}</Label><Select value={usdtReportYear} onChange={e => setUsdtReportYear(Number(e.target.value))} className={fieldBase}>{reportYears.map(y => <option key={y} value={y}>{y}</option>)}</Select></div>
            </div>

            <div className="space-y-4">
              <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <Label className={subtleText}>{t('portfolio.volBoughtPeriod')}</Label>
                <p className="text-xl font-bold text-sky-400">{calculatedStats.volUsdtBought.toFixed(2)} USDT</p>
              </div>
              <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <Label className={subtleText}>{t('portfolio.volSoldPeriod')}</Label>
                <p className="text-xl font-bold text-sky-400">{calculatedStats.volUsdtSold.toFixed(2)} USDT</p>
              </div>
              <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <Label className={subtleText}>{t('portfolio.volBoughtPeriod')} (EUR)</Label>
                <p className="text-xl font-bold text-amber-400">{calculatedStats.volEurBought.toFixed(2)} EUR</p>
              </div>
              <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <Label className={subtleText}>{t('portfolio.realizedProfitPeriod')}</Label>
                <p className={`text-2xl font-bold ${calculatedStats.realizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {calculatedStats.realizedProfit.toFixed(2)} DZD
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">{t('portfolio.clientMonthlyReport')}</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <Label className={subtleText}>{t('portfolio.topTradedClient')}</Label>
                  {monthlyClientRanking.topTradedClient ? (
                    <>
                      <p className="text-lg font-bold text-sky-400 mt-1">{monthlyClientRanking.topTradedClient.clientName}</p>
                      <p className="text-sm mt-1">
                        <span className="font-semibold">{monthlyClientRanking.topTradedClient.totalVolumeUsdt.toFixed(2)} USDT</span>
                      </p>
                      <p className={`text-xs mt-1 ${subtleText}`}>
                        {t('portfolio.txCount')}: {monthlyClientRanking.topTradedClient.txCount}
                      </p>
                    </>
                  ) : (
                    <p className={`text-sm mt-2 ${subtleText}`}>{t('portfolio.noClientMonthlyData')}</p>
                  )}
                </div>

                <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <Label className={subtleText}>{t('portfolio.topProfitableClient')}</Label>
                  {monthlyClientRanking.topProfitableClient ? (
                    <>
                      <p className="text-lg font-bold text-emerald-400 mt-1">{monthlyClientRanking.topProfitableClient.clientName}</p>
                      <p className={`text-sm mt-1 font-semibold ${monthlyClientRanking.topProfitableClient.realizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {monthlyClientRanking.topProfitableClient.realizedProfit >= 0 ? '+' : ''}
                        {monthlyClientRanking.topProfitableClient.realizedProfit.toFixed(2)} DZD
                      </p>
                      <p className={`text-xs mt-1 ${subtleText}`}>
                        {t('portfolio.sellCount')}: {monthlyClientRanking.topProfitableClient.sellCount}
                      </p>
                    </>
                  ) : (
                    <p className={`text-sm mt-2 ${subtleText}`}>{t('portfolio.noClientMonthlyData')}</p>
                  )}
                </div>
              </div>

              <div className={`rounded-xl border overflow-x-auto ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <table className="w-full text-sm">
                  <thead className={`${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">{t('portfolio.clientName')}</th>
                      <th className="px-3 py-2 text-right">{t('portfolio.buyVolumeUsdt')}</th>
                      <th className="px-3 py-2 text-right">{t('portfolio.sellVolumeUsdt')}</th>
                      <th className="px-3 py-2 text-right">{t('portfolio.totalVolumeUsdt')}</th>
                      <th className="px-3 py-2 text-right">{t('portfolio.realizedProfit')}</th>
                      <th className="px-3 py-2 text-right">{t('portfolio.txCount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyClientRanking.rankedRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={`px-3 py-6 text-center ${subtleText}`}>
                          {t('portfolio.noClientMonthlyData')}
                        </td>
                      </tr>
                    ) : (
                      monthlyClientRanking.rankedRows.map((row, index) => (
                        <tr key={row.clientId} className={`${isDark ? 'border-t border-slate-700' : 'border-t border-slate-200'}`}>
                          <td className="px-3 py-2">{index + 1}</td>
                          <td className="px-3 py-2 font-semibold">{row.clientName}</td>
                          <td className="px-3 py-2 text-right">{row.buyVolumeUsdt.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{row.sellVolumeUsdt.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-sky-400">{row.totalVolumeUsdt.toFixed(2)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${row.realizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {row.realizedProfit >= 0 ? '+' : ''}{row.realizedProfit.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right">{row.txCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">{t('portfolio.profitHeatmap')}</h3>
              <ProfitHeatmap />
              {selectedHeatmapDay && (
                <p className={`text-center text-sm mt-2 p-2 rounded-md ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                  {t('portfolio.profitOn')} {selectedHeatmapDay.day}/{usdtReportMonth + 1}/{usdtReportYear}: <span className="font-bold">{selectedHeatmapDay.profit.toFixed(2)} DZD</span>
                </p>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">{t('portfolio.pamSimulator')}</h3>
              <div className="p-3 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                <div className="flex items-stretch gap-2 mb-4 p-1 rounded-2xl border" style={{ borderColor: isDark ? '#334155' : '#CBD5E1' }}>
                  <button onClick={() => setSimMode('dzd')} className={`flex-1 py-2 text-xs sm:text-sm rounded-xl font-semibold transition-colors flex items-center justify-center ${simMode === 'dzd' ? 'bg-teal-500 text-white' : ''}`}>{t('portfolio.buyWithDzd')}</button>
                  <button
                    onClick={() => {
                      setSimMode('eur');
                      if (portfolioStats.eur.available > 0) {
                        setSimEurQty(Math.round(portfolioStats.eur.available).toString());
                      }
                      if (portfolioStats.eur.avgBuy > 0) {
                        setSimEurDzdPrice(Math.round(portfolioStats.eur.avgBuy).toString());
                      }
                    }}
                    className={`flex-1 py-2 text-xs sm:text-sm rounded-xl font-semibold transition-colors flex items-center justify-center ${simMode === 'eur' ? 'bg-teal-500 text-white' : ''}`}
                  >
                    {t('portfolio.buyWithEur')}
                  </button>
                  <button
                    onClick={() => {
                      setSimMode('sell_dzd');
                      if (portfolioStats.usdt.available > 0 && setSimSellUsdtQty) {
                        setSimSellUsdtQty(portfolioStats.usdt.available.toString());
                      }

                      let priceToSet = 0;
                      if (suggestedSellingPrice && parseFloat(suggestedSellingPrice) > 0) {
                        priceToSet = parseFloat(suggestedSellingPrice);
                      } else {
                        priceToSet = portfolioStats.usdt.avgBuy + parseAndEvaluate(suggestedProfitMargin);
                      }

                      if (priceToSet > 0 && setSimSellDzdPrice) {
                        setSimSellDzdPrice(priceToSet.toFixed(2));
                      }
                    }}
                    className={`flex-1 py-1 text-xs sm:text-sm rounded-xl font-semibold transition-colors flex items-center justify-center ${simMode === 'sell_dzd' ? 'bg-teal-500 text-white' : ''}`}
                  >
                    {t('portfolio.sellUsdt')}
                  </button>
                </div>

                {simMode === 'dzd' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="flex flex-col">
                        <Label className="h-10 flex items-end pb-1 text-xs sm:text-sm leading-tight">{t('portfolio.qtyUsdt')}</Label>
                        <NumberInput value={simBuyQty} onChange={e => setSimBuyQty(e.target.value)} className={`${fieldBase} h-10`} placeholder="1000" />
                      </div>
                      <div className="flex flex-col">
                        <Label className="h-10 flex items-end pb-1 text-xs sm:text-sm leading-tight">{t('portfolio.buyPrice')}</Label>
                        <NumberInput value={simBuyPrice} onChange={e => setSimBuyPrice(e.target.value)} className={`${fieldBase} h-10`} placeholder="240.50" />
                      </div>
                    </div>
                    {newPamFromDzdSimulator !== null && (
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <div className="flex justify-between items-center">
                          <span className={subtleText}>{t('portfolio.newPam')}</span>
                          <span className="font-bold text-lg text-teal-400">{newPamFromDzdSimulator.toFixed(2)} DZD</span>
                        </div>
                        <div className={`text-xs mt-1 text-right ${subtleText}`}>{t('portfolio.suggestedSellPrice')}: <span className="font-bold text-amber-400">{(newPamFromDzdSimulator + parseAndEvaluate(suggestedProfitMargin)).toFixed(2)} DZD</span></div>
                      </div>
                    )}
                  </div>
                )}

                {simMode === 'eur' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      <div className="flex flex-col">
                        <Label className="h-10 flex items-end pb-1 text-[10px] sm:text-sm leading-tight break-words">{t('portfolio.qtyEurToSpend')}</Label>
                        <NumberInput value={simEurQty} onChange={e => setSimEurQty(e.target.value)} className={`${fieldBase} h-10 text-center px-1`} placeholder="1000" />
                      </div>
                      <div className="flex flex-col">
                        <Label className="h-10 flex items-end pb-1 text-[10px] sm:text-sm leading-tight break-words">{t('portfolio.buyPriceEur')}</Label>
                        <NumberInput value={simEurDzdPrice} onChange={e => setSimEurDzdPrice(e.target.value)} className={`${fieldBase} h-10 text-center px-1`} placeholder="242.00" />
                      </div>
                      <div className="flex flex-col">
                        <Label className="h-10 flex items-end pb-1 text-[10px] sm:text-sm leading-tight break-words">{t('portfolio.rateEurUsdt')}</Label>
                        <NumberInput value={simEurUsdtRate} onChange={e => setSimEurUsdtRate(e.target.value)} className={`${fieldBase} h-10 text-center px-1`} placeholder="1.08" />
                      </div>
                    </div>
                    {newPamFromEurSimulator !== null && (
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <div className="flex justify-between items-center">
                          <span className={subtleText}>{t('portfolio.newPam')}</span>
                          <span className="font-bold text-lg text-teal-400">{newPamFromEurSimulator.toFixed(2)} DZD</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {simMode === 'sell_dzd' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="flex flex-col">
                        <Label className="h-10 flex items-end pb-1 text-xs sm:text-sm leading-tight">{t('portfolio.qtyUsdt')}</Label>
                        <NumberInput value={simSellUsdtQty || ''} onChange={e => setSimSellUsdtQty && setSimSellUsdtQty(e.target.value)} className={`${fieldBase} h-10`} placeholder="1000" />
                      </div>
                      <div className="flex flex-col">
                        <Label className="h-10 flex items-end pb-1 text-xs sm:text-sm leading-tight">{t('portfolio.sellingPriceDzd')}</Label>
                        <NumberInput value={simSellDzdPrice || ''} onChange={e => setSimSellDzdPrice && setSimSellDzdPrice(e.target.value)} className={`${fieldBase} h-10`} placeholder="242.00" />
                      </div>
                    </div>

                    <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <div className="flex justify-between items-center">
                        <span className={subtleText}>{t('portfolio.currentPam')}</span>
                        <span className="font-bold">{portfolioStats.usdt.avgBuy.toFixed(2)} DZD</span>
                      </div>
                    </div>

                    {simSellResult && (
                      <div className={`text-center p-3 rounded-lg border ${simSellResult.isProfitable ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        <p className="text-xs uppercase tracking-widest mb-1 opacity-70">{simSellResult.isProfitable ? t('portfolio.profitableSale') : t('portfolio.unprofitableSale')}</p>
                        <div className="text-2xl font-bold">
                          {simSellResult.isProfitable ? '+' : '-'}{Math.abs(simSellResult.profit).toFixed(2)} <span className="text-sm font-normal">DZD</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
