import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Label } from '../components/ui/Label';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { NumberInput } from '../components/ui/NumberInput';
import { Tx, ClientDzd } from '../types';
import { MONTHS_FR } from '../constants';

import { BriefcaseIcon } from '../components/icons/BriefcaseIcon';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { FileSpreadsheetIcon } from '../components/icons/FileSpreadsheetIcon';
import { PencilIcon } from '../components/icons/PencilIcon';

type PortfolioPageProps = {
  statsView: 'usdt' | 'clients';
  setStatsView: (view: 'usdt' | 'clients') => void;
  isDark: boolean;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  cardBase: string;
  subtleText: string;
  portfolioStats: any; // Simplified for brevity
  totalPortfolioValue: number;
  suggestedProfitMargin: string;
  parseAndEvaluate: (expr: string) => number;
  usdtReportMonth: number;
  setUsdtReportMonth: (month: number) => void;
  usdtReportYear: number;
  setUsdtReportYear: (year: number) => void;
  reportMonths: (year: number) => string[];
  reportYears: number[];
  monthlyStats: any; // Simplified
  transactions: Tx[];
  selectedHeatmapDay: { day: number; profit: number; } | null;
  setSelectedHeatmapDay: (day: { day: number; profit: number; } | null) => void;
  simMode: 'dzd' | 'eur';
  setSimMode: (mode: 'dzd' | 'eur') => void;
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
  dzdDashboardStats: any; // Simplified
  reportClient: string;
  setReportClient: (id: string) => void;
  clientsDzd: ClientDzd[];
  getClientFullName: (client: ClientDzd) => string;
  reportMonth: number;
  setReportMonth: (month: number) => void;
  reportYear: number;
  setReportYear: (year: number) => void;
  handleExportClientReport: (clientId: string, month: number, year: number) => void;
};

export function PortfolioPage(props: PortfolioPageProps) {
  const {
    isDark, setIsSettingsModalOpen, cardBase, subtleText,
    portfolioStats, totalPortfolioValue, suggestedProfitMargin, parseAndEvaluate,
    usdtReportMonth, setUsdtReportMonth, usdtReportYear, setUsdtReportYear, reportMonths,
    reportYears, monthlyStats, transactions, selectedHeatmapDay, setSelectedHeatmapDay, simMode, setSimMode, simBuyQty,
    setSimBuyQty, simBuyPrice, setSimBuyPrice, fieldBase, newPamFromDzdSimulator,
    simEurQty, setSimEurQty, simEurDzdPrice, setSimEurDzdPrice, simEurUsdtRate, setSimEurUsdtRate,
    newPamFromEurSimulator, handleExportUsdtReport
  } = props;

  // Redesigned StatCard to match Treasury style
  const StatCard = ({ title, value, currency, icon, colorClass, cardBase, subtleText, action }: { title: string, value: string, currency?: string, icon?: React.ReactNode, colorClass: string, cardBase: string, subtleText: string, action?: React.ReactNode }) => (
    <div className={`p-5 rounded-2xl shadow-sm border transition-all ${isDark ? 'bg-[#1E293B] border-[#334155]' : 'bg-white border-slate-200'}`}>
      <div className={`flex items-center justify-between text-sm font-medium mb-2 ${subtleText}`}>
        <span>{title}</span>
        {icon || action}
      </div>
      <div className="mt-1 text-3xl font-bold">
        <span className={colorClass}>{value}</span>
        {currency && <span className={`ml-2 text-lg font-normal ${subtleText}`}>{currency}</span>}
      </div>
    </div>
  );

  const netMargin = useMemo(() => {
    if (totalPortfolioValue === 0) return 0;
    return (portfolioStats.usdt.totalProfit / totalPortfolioValue) * 100;
  }, [totalPortfolioValue, portfolioStats.usdt.totalProfit]);

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
    const endDate = new Date(usdtReportYear, usdtReportMonth + 1, 0);

    transactions.forEach(tx => {
      if (tx.type === 'sell' && tx.currency === 'USDT' && tx.timestamp >= startDate.getTime() && tx.timestamp <= endDate.getTime()) {
        const day = new Date(tx.timestamp).getDate();
        const currentProfit = salesByDay.get(day) || 0;
        salesByDay.set(day, currentProfit + (tx.profit || 0));
      }
    });

    return salesByDay;
  }, [transactions, usdtReportMonth, usdtReportYear]);

  const ProfitHeatmap = () => {
    const firstDayOfMonth = new Date(usdtReportYear, usdtReportMonth, 1).getDay(); // 0 = Sunday
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
          {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(day => <div key={day}>{day}</div>)}
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
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><BriefcaseIcon className="w-5 h-5" /> État Actuel du Portefeuille</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard cardBase={cardBase} subtleText={subtleText} title="Bénéfice/Perte Net" value={portfolioStats.usdt.totalProfit.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} currency="DZD" colorClass={portfolioStats.usdt.totalProfit >= 0 ? "text-green-400" : "text-red-400"} />
            <StatCard cardBase={cardBase} subtleText={subtleText} title="Solde Actuel EUR" value={portfolioStats.eur.available.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} currency="EUR" colorClass="text-amber-400" />
            <StatCard cardBase={cardBase} subtleText={subtleText} title="PAM EUR" value={portfolioStats.eur.avgBuy.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} currency="DZD" colorClass="text-gray-300" />
            <StatCard cardBase={cardBase} subtleText={subtleText} title="Solde Actuel USDT" value={portfolioStats.usdt.available.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} currency="USDT" colorClass="text-sky-400" />
            <StatCard cardBase={cardBase} subtleText={subtleText} title="PAM USDT" value={portfolioStats.usdt.avgBuy.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} currency="DZD" colorClass="text-gray-300" />
            <StatCard
              cardBase={cardBase}
              subtleText={subtleText}
              title="Prix Vente Suggéré"
              value={(portfolioStats.usdt.avgBuy * (1 + parseAndEvaluate(suggestedProfitMargin) / 100)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              currency="DZD"
              colorClass="text-yellow-400"
              action={
                <button
                  onClick={() => setIsSettingsModalOpen(true)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 transition-colors ${isDark ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-slate-100 text-gray-600 hover:bg-slate-200'}`}
                >
                  Marge: {suggestedProfitMargin}% <PencilIcon className="w-3 h-3" />
                </button>
              }
            />
          </div>
        </Card>

        <Card className={`${cardBase} p-4 sm:p-6`}>
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><TrendingUpIcon className="w-5 h-5" /> Analyse & Rapports</h2>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Mois</Label><Select value={usdtReportMonth} onChange={e => setUsdtReportMonth(Number(e.target.value))} className={fieldBase}>{reportMonths(usdtReportYear).map((m, i) => <option key={m} value={i}>{m}</option>)}</Select></div>
              <div><Label>Année</Label><Select value={usdtReportYear} onChange={e => setUsdtReportYear(Number(e.target.value))} className={fieldBase}>{reportYears.map(y => <option key={y} value={y}>{y}</option>)}</Select></div>
            </div>

            <div className="space-y-4">
              <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <Label className={subtleText}>Volume Acheté (Période)</Label>
                <p className="text-xl font-bold text-sky-400">{calculatedStats.volUsdtBought.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USDT</p>
              </div>
              <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <Label className={subtleText}>Volume Vendu (Période)</Label>
                <p className="text-xl font-bold text-sky-400">{calculatedStats.volUsdtSold.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USDT</p>
              </div>
              <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <Label className={subtleText}>Volume Acheté (Période)</Label>
                <p className="text-xl font-bold text-amber-400">{calculatedStats.volEurBought.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR</p>
              </div>
              <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <Label className={subtleText}>Bénéfice Réalisé (Période)</Label>
                <p className={`text-2xl font-bold ${calculatedStats.realizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {calculatedStats.realizedProfit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Heatmap des Bénéfices</h3>
              <ProfitHeatmap />
              {selectedHeatmapDay && (
                <p className={`text-center text-sm mt-2 p-2 rounded-md ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                  Bénéfice du {selectedHeatmapDay.day}/{usdtReportMonth + 1}/{usdtReportYear}: <span className="font-bold">{selectedHeatmapDay.profit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
                </p>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Simulateur de PAM (USDT)</h3>
              <div className="p-3 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                <div className="flex items-center gap-2 mb-4 p-1 rounded-full border" style={{ borderColor: isDark ? '#334155' : '#CBD5E1' }}>
                  <button onClick={() => setSimMode('dzd')} className={`flex-1 py-1 text-sm rounded-full font-semibold transition-colors ${simMode === 'dzd' ? 'bg-teal-500 text-white' : ''}`}>Achat avec DZD</button>
                  <button
                    onClick={() => {
                      setSimMode('eur');
                      if (portfolioStats.eur.available > 0) {
                        setSimEurQty(portfolioStats.eur.available.toString());
                      }
                      if (portfolioStats.eur.avgBuy > 0) {
                        setSimEurDzdPrice(portfolioStats.eur.avgBuy.toFixed(2));
                      }
                    }}
                    className={`flex-1 py-1 text-sm rounded-full font-semibold transition-colors ${simMode === 'eur' ? 'bg-teal-500 text-white' : ''}`}
                  >
                    Achat avec EUR
                  </button>
                </div>

                {simMode === 'dzd' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Quantité USDT</Label><NumberInput value={simBuyQty} onChange={e => setSimBuyQty(e.target.value)} className={fieldBase} placeholder="1000" /></div>
                      <div><Label>Prix Achat</Label><NumberInput value={simBuyPrice} onChange={e => setSimBuyPrice(e.target.value)} className={fieldBase} placeholder="240.50" /></div>
                    </div>
                    {newPamFromDzdSimulator !== null && (
                      <div className="text-center p-2 rounded-lg bg-teal-500/10 text-teal-300">
                        <p>Nouveau PAM: <span className="font-bold">{newPamFromDzdSimulator.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD</span></p>
                        <p className="text-xs">Prix de Vente Suggéré: <span className="font-bold">{(newPamFromDzdSimulator * (1 + parseAndEvaluate(suggestedProfitMargin) / 100)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD</span></p>
                      </div>
                    )}
                  </div>
                )}
                {simMode === 'eur' && (
                  <div className="space-y-3">
                    <div><Label>Quantité EUR à dépenser</Label><NumberInput value={simEurQty} onChange={e => setSimEurQty(e.target.value)} className={fieldBase} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Prix Achat EUR</Label><NumberInput value={simEurDzdPrice} onChange={e => setSimEurDzdPrice(e.target.value)} className={fieldBase} /></div>
                      <div><Label>Taux EUR/USDT</Label><NumberInput value={simEurUsdtRate} onChange={e => setSimEurUsdtRate(e.target.value)} className={fieldBase} /></div>
                    </div>
                    {newPamFromEurSimulator !== null && (
                      <div className="text-center p-2 rounded-lg bg-teal-500/10 text-teal-300">
                        <p>Nouveau PAM: <span className="font-bold">{newPamFromEurSimulator.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD</span></p>
                        <p className="text-xs">Prix de Vente Suggéré: <span className="font-bold">{(newPamFromEurSimulator * (1 + parseAndEvaluate(suggestedProfitMargin) / 100)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD</span></p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <Button onClick={handleExportUsdtReport} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
              <FileSpreadsheetIcon className="w-5 h-5" /> Exporter le Rapport (PDF)
            </Button>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}