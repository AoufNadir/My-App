import { useState } from 'react';
import { Card } from '../ui/Card';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { NumberInput } from '../ui/NumberInput';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { SparklesIcon } from '../icons/SparklesIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import type { ClientDzd } from '../../types';
import {
  AnalyticsSimMode,
  CalculatedStats,
  MonthlyClientRanking,
  SimSellResult
} from './analyticsTypes';

type AnalyticsReportCardProps = {
  cardBase: string;
  isDark: boolean;
  subtleText: string;
  fieldBase: string;
  t: (...args: any[]) => any;
  usdtReportMonth: number;
  setUsdtReportMonth: (month: number) => void;
  usdtReportYear: number;
  setUsdtReportYear: (year: number) => void;
  reportMonths: (year: number) => string[];
  reportYears: number[];
  reportClient: string;
  setReportClient: (id: string) => void;
  reportMonth: number;
  setReportMonth: (month: number) => void;
  reportYear: number;
  setReportYear: (year: number) => void;
  clientsDzd: ClientDzd[];
  getClientFullName: (client: ClientDzd) => string;
  handleExportUsdtReport: () => void;
  handleExportClientReport: (clientId: string, month: number, year: number) => void;
  calculatedStats: CalculatedStats;
  monthlyClientRanking: MonthlyClientRanking;
  heatmapData: Map<number, number>;
  selectedHeatmapDay: { day: number; profit: number } | null;
  setSelectedHeatmapDay: (day: { day: number; profit: number } | null) => void;
  simMode: AnalyticsSimMode;
  setSimMode: (mode: AnalyticsSimMode) => void;
  portfolioStats: any;
  setSimEurQty: (val: string) => void;
  setSimEurDzdPrice: (val: string) => void;
  setSimSellUsdtQty?: (val: string) => void;
  setSimSellDzdPrice?: (val: string) => void;
  suggestedSellingPrice?: string;
  parseAndEvaluate: (expr: string) => number;
  suggestedProfitMargin: string;
  simBuyQty: string;
  setSimBuyQty: (val: string) => void;
  simBuyPrice: string;
  setSimBuyPrice: (val: string) => void;
  newPamFromDzdSimulator: number | null;
  simEurQty: string;
  simEurDzdPrice: string;
  simEurUsdtRate: string;
  setSimEurUsdtRate: (val: string) => void;
  newPamFromEurSimulator: number | null;
  simSellUsdtQty?: string;
  simSellDzdPrice?: string;
  simSellResult: SimSellResult;
};

export function AnalyticsReportCard({
  cardBase,
  isDark,
  subtleText,
  fieldBase,
  t,
  usdtReportMonth,
  setUsdtReportMonth,
  usdtReportYear,
  setUsdtReportYear,
  reportMonths,
  reportYears,
  reportClient,
  setReportClient,
  reportMonth,
  setReportMonth,
  reportYear,
  setReportYear,
  clientsDzd,
  getClientFullName,
  handleExportUsdtReport,
  handleExportClientReport,
  calculatedStats,
  monthlyClientRanking,
  heatmapData,
  selectedHeatmapDay,
  setSelectedHeatmapDay,
  simMode,
  setSimMode,
  portfolioStats,
  setSimEurQty,
  setSimEurDzdPrice,
  setSimSellUsdtQty,
  setSimSellDzdPrice,
  suggestedSellingPrice,
  parseAndEvaluate,
  suggestedProfitMargin,
  simBuyQty,
  setSimBuyQty,
  simBuyPrice,
  setSimBuyPrice,
  newPamFromDzdSimulator,
  simEurQty,
  simEurDzdPrice,
  simEurUsdtRate,
  setSimEurUsdtRate,
  newPamFromEurSimulator,
  simSellUsdtQty,
  simSellDzdPrice,
  simSellResult
}: AnalyticsReportCardProps) {
  const [isHeatmapVisible, setIsHeatmapVisible] = useState(true);
  const [isClientRankingVisible, setIsClientRankingVisible] = useState(true);
  const sortedClients = [...clientsDzd].sort((a, b) => getClientFullName(a).localeCompare(getClientFullName(b), 'fr'));

  const topProfitableRows = [...monthlyClientRanking.rankedRows]
    .filter((row) => row.sellCount > 0)
    .sort((a, b) => {
      if (b.realizedProfit !== a.realizedProfit) return b.realizedProfit - a.realizedProfit;
      if (b.totalVolumeUsdt !== a.totalVolumeUsdt) return b.totalVolumeUsdt - a.totalVolumeUsdt;
      return a.clientName.localeCompare(b.clientName, 'fr');
    })
    .slice(0, 5);

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
    <Card className={`${cardBase} p-4 sm:p-6`}>
      <UnifiedTitle
        as="h2"
        isDark={isDark}
        variant="section"
        className="mb-4"
        icon={<SparklesIcon className="w-4 h-4" />}
      >
        {t('portfolio.analysisReports')}
      </UnifiedTitle>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>{t('portfolio.month')}</Label><Select value={usdtReportMonth} onChange={e => setUsdtReportMonth(Number(e.target.value))} className={fieldBase}>{reportMonths(usdtReportYear).map((m, i) => <option key={m} value={i}>{m}</option>)}</Select></div>
          <div><Label>{t('portfolio.year')}</Label><Select value={usdtReportYear} onChange={e => setUsdtReportYear(Number(e.target.value))} className={fieldBase}>{reportYears.map(y => <option key={y} value={y}>{y}</option>)}</Select></div>
        </div>

        <div className={`p-3 sm:p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <UnifiedTitle
            as="h3"
            isDark={isDark}
            variant="section"
            className="mb-3"
            icon={<FileSpreadsheetIcon className="w-4 h-4" />}
          >
            Rapports PDF
          </UnifiedTitle>

          <button
            type="button"
            onClick={handleExportUsdtReport}
            className="w-full px-3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm"
          >
            Exporter Rapport Mensuel PDF
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <div>
              <Label>Client</Label>
              <Select value={reportClient} onChange={e => setReportClient(e.target.value)} className={fieldBase}>
                <option value="">Selectionner un client</option>
                {sortedClients.map(client => (
                  <option key={client.id} value={client.id}>{getClientFullName(client)}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('portfolio.month')}</Label>
              <Select value={reportMonth} onChange={e => setReportMonth(Number(e.target.value))} className={fieldBase}>
                {reportMonths(reportYear).map((monthName, index) => (
                  <option key={monthName} value={index}>{monthName}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('portfolio.year')}</Label>
              <Select value={reportYear} onChange={e => setReportYear(Number(e.target.value))} className={fieldBase}>
                {reportYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </Select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleExportClientReport(reportClient, reportMonth, reportYear)}
            disabled={!reportClient}
            className={`w-full mt-3 px-3 py-2.5 rounded-xl text-white font-semibold text-sm ${reportClient ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-500 cursor-not-allowed opacity-60'}`}
          >
            Exporter Releve Client PDF
          </button>
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
          <UnifiedTitle
            as="h3"
            isDark={isDark}
            variant="section"
            className="mb-1.5 text-sm sm:text-[15px]"
            icon={<UsersIcon className="w-4 h-4" />}
          >
            {t('portfolio.clientMonthlyReport')}
          </UnifiedTitle>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <Label className={`text-xs ${subtleText}`}>{t('portfolio.topTradedClient')}</Label>
              {monthlyClientRanking.topTradedClient ? (
                <>
                  <p className="text-base sm:text-lg font-bold text-sky-400 mt-0.5 truncate">{monthlyClientRanking.topTradedClient.clientName}</p>
                  <p className="text-xs sm:text-sm mt-0.5">
                    <span className="font-semibold">{monthlyClientRanking.topTradedClient.totalVolumeUsdt.toFixed(2)} USDT</span>
                  </p>
                  <p className={`text-[11px] mt-0.5 ${subtleText}`}>
                    {t('portfolio.txCount')}: {monthlyClientRanking.topTradedClient.txCount}
                  </p>
                </>
              ) : (
                <p className={`text-xs mt-1 ${subtleText}`}>{t('portfolio.noClientMonthlyData')}</p>
              )}
            </div>

            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <Label className={`text-xs ${subtleText}`}>{t('portfolio.topProfitableClient')}</Label>
              {monthlyClientRanking.topProfitableClient ? (
                <>
                  <p className="text-base sm:text-lg font-bold text-emerald-400 mt-0.5 truncate">{monthlyClientRanking.topProfitableClient.clientName}</p>
                  <p className={`text-xs sm:text-sm mt-0.5 font-semibold ${monthlyClientRanking.topProfitableClient.realizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {monthlyClientRanking.topProfitableClient.realizedProfit >= 0 ? '+' : ''}
                    {monthlyClientRanking.topProfitableClient.realizedProfit.toFixed(2)} DZD
                  </p>
                  <p className={`text-[11px] mt-0.5 ${subtleText}`}>
                    {t('portfolio.sellCount')}: {monthlyClientRanking.topProfitableClient.sellCount}
                  </p>
                </>
              ) : (
                <p className={`text-xs mt-1 ${subtleText}`}>{t('portfolio.noClientMonthlyData')}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <UnifiedTitle
              as="h4"
              isDark={isDark}
              variant="section"
              icon={<FileSpreadsheetIcon className="w-4 h-4" />}
            >
              Afficher le tableau detaille (Top 5 Profit)
            </UnifiedTitle>
            <button
              type="button"
              onClick={() => setIsClientRankingVisible(prev => !prev)}
              className={`px-3 py-1.5 text-xs rounded-lg border ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-slate-300 hover:bg-slate-100'}`}
            >
              {isClientRankingVisible ? 'Masquer' : 'Afficher'}
            </button>
          </div>

          {isClientRankingVisible && (
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
                  {topProfitableRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`px-3 py-6 text-center ${subtleText}`}>
                        {t('portfolio.noClientMonthlyData')}
                      </td>
                    </tr>
                  ) : (
                    topProfitableRows.map((row, index) => (
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
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <UnifiedTitle
              as="h3"
              isDark={isDark}
              variant="section"
              icon={<TrendingUpIcon className="w-4 h-4" />}
            >
              {t('portfolio.profitHeatmap')}
            </UnifiedTitle>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsHeatmapVisible(prev => !prev)}
                className={`px-3 py-1.5 text-xs rounded-lg border ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-slate-300 hover:bg-slate-100'}`}
              >
                {isHeatmapVisible ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </div>

          {isHeatmapVisible && (
            <>
              <ProfitHeatmap />
              {selectedHeatmapDay && (
                <p className={`text-center text-sm mt-2 p-2 rounded-md ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                  {t('portfolio.profitOn')} {selectedHeatmapDay.day}/{usdtReportMonth + 1}/{usdtReportYear}: <span className="font-bold">{selectedHeatmapDay.profit.toFixed(2)} DZD</span>
                </p>
              )}
            </>
          )}
        </div>

        <div>
          <UnifiedTitle
            as="h3"
            isDark={isDark}
            variant="section"
            className="mb-2"
            icon={<RefreshCwIcon className="w-4 h-4" />}
          >
            {t('portfolio.pamSimulator')}
          </UnifiedTitle>
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
  );
}
