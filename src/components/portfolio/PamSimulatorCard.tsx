import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { MoneyField } from '../ui/MoneyField';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { SectionHeading } from '../ui/SectionHeading';
import { Tabs, type Tab } from '../ui/Tabs';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatNumber } from '../../pages/shared/pageFormat';

type PamSimulatorMode = 'dzd' | 'eur' | 'sell_dzd' | 'sell_eur';

type SimSellResult = {
    profit: number;
    isProfitable: boolean;
    saleValueDzd: number;
    saleValueEur?: number;
    soldCostDzd: number;
    effectiveSellPriceDzd: number;
    profitMarginPercent: number;
} | null;

type PamSimulatorCardProps = {
    portfolioStats: any;
    smartTargetUsdt?: number;
    parseAndEvaluate: (expr: string) => number;
};

const parsePositive = (parseAndEvaluate: (expr: string) => number, value: string) => {
    const parsed = parseAndEvaluate(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export function PamSimulatorCard({ portfolioStats, smartTargetUsdt = 0, parseAndEvaluate }: PamSimulatorCardProps) {
    const { t } = useLanguage();
    const [simMode, setSimMode] = useState<PamSimulatorMode>('dzd');
    const [simBuyQty, setSimBuyQty] = useState('');
    const [simBuyPrice, setSimBuyPrice] = useState('');
    const [simEurQty, setSimEurQty] = useState('');
    const [simEurDzdPrice, setSimEurDzdPrice] = useState('');
    const [simEurUsdtRate, setSimEurUsdtRate] = useState('');
    const [simSellUsdtQty, setSimSellUsdtQty] = useState('');
    const [simSellDzdPrice, setSimSellDzdPrice] = useState('');
    const [simSellEurPrice, setSimSellEurPrice] = useState('');
    const [simSellEurToDzdRate, setSimSellEurToDzdRate] = useState('');

    const currentPam = Number(portfolioStats.usdt?.avgBuy || 0);
    const availableUsdt = Math.max(0, Number(portfolioStats.usdt?.available || 0));
    const purchasedQty = Math.max(0, Number(portfolioStats.usdt?.purchasedQty || portfolioStats.usdt?.available || 0));
    const costBasis = Math.max(0, Number(portfolioStats.usdt?.costBasis || (purchasedQty * currentPam) || 0));
    const suggestedDzdSellPrice = smartTargetUsdt > 0 ? smartTargetUsdt : currentPam;

    const newPamFromDzdSimulator = useMemo(() => {
        const qty = parsePositive(parseAndEvaluate, simBuyQty);
        const price = parsePositive(parseAndEvaluate, simBuyPrice);
        if (qty <= 0 || price <= 0)
            return null;
        const totalCost = costBasis + (qty * price);
        const totalQty = purchasedQty + qty;
        return totalQty <= 0 ? 0 : totalCost / totalQty;
    }, [costBasis, parseAndEvaluate, purchasedQty, simBuyPrice, simBuyQty]);

    const newPamFromEurSimulator = useMemo(() => {
        const eurQty = parsePositive(parseAndEvaluate, simEurQty);
        const eurPriceDzd = parsePositive(parseAndEvaluate, simEurDzdPrice);
        const rate = parsePositive(parseAndEvaluate, simEurUsdtRate);
        if (eurQty <= 0 || eurPriceDzd <= 0 || rate <= 0)
            return null;
        const newUsdtQty = eurQty / rate;
        const totalCost = costBasis + (newUsdtQty * eurPriceDzd * rate);
        const totalQty = purchasedQty + newUsdtQty;
        return totalQty <= 0 ? 0 : totalCost / totalQty;
    }, [costBasis, parseAndEvaluate, purchasedQty, simEurDzdPrice, simEurQty, simEurUsdtRate]);

    const defaultEurToDzdRate = () => {
        const enteredRate = parsePositive(parseAndEvaluate, simSellEurToDzdRate);
        const pamEur = Number(portfolioStats.eur?.avgBuy || 0);
        return pamEur > 0 ? pamEur : enteredRate;
    };

    const presetSellQuantity = () => {
        if (availableUsdt > 0) {
            setSimSellUsdtQty(availableUsdt.toString());
        }
    };

    const handleModeChange = (next: string) => {
        const mode = next as PamSimulatorMode;
        setSimMode(mode);

        if (mode === 'eur') {
            const eurAvailable = Number(portfolioStats.eur?.available || 0);
            if (eurAvailable > 0)
                setSimEurQty(Math.round(eurAvailable).toString());
            if (Number(portfolioStats.eur?.avgBuy || 0) > 0)
                setSimEurDzdPrice(Math.round(Number(portfolioStats.eur.avgBuy)).toString());
        }

        if (mode === 'sell_dzd') {
            presetSellQuantity();
            if (suggestedDzdSellPrice > 0)
                setSimSellDzdPrice(suggestedDzdSellPrice.toFixed(2));
        }

        if (mode === 'sell_eur') {
            presetSellQuantity();
            const eurToDzdRate = defaultEurToDzdRate();
            if (eurToDzdRate > 0)
                setSimSellEurToDzdRate(eurToDzdRate.toFixed(2));
            if (suggestedDzdSellPrice > 0 && eurToDzdRate > 0)
                setSimSellEurPrice((suggestedDzdSellPrice / eurToDzdRate).toFixed(4));
        }
    };

    const breakEvenDzdPrice = currentPam;
    const quickQty = parsePositive(parseAndEvaluate, simSellUsdtQty) || availableUsdt;
    const quickProfit = quickQty * (suggestedDzdSellPrice - breakEvenDzdPrice);
    const quickMarginPercent = breakEvenDzdPrice > 0
        ? ((suggestedDzdSellPrice - breakEvenDzdPrice) / breakEvenDzdPrice) * 100
        : 0;

    const useAllStock = () => {
        handleModeChange('sell_dzd');
        setSimSellUsdtQty(availableUsdt > 0 ? availableUsdt.toFixed(2) : '');
    };

    const useSuggestedPrice = () => {
        handleModeChange('sell_dzd');
        if (suggestedDzdSellPrice > 0)
            setSimSellDzdPrice(suggestedDzdSellPrice.toFixed(2));
    };

    const resetSimulator = () => {
        setSimMode('dzd');
        setSimBuyQty('');
        setSimBuyPrice('');
        setSimEurQty('');
        setSimEurDzdPrice('');
        setSimEurUsdtRate('');
        setSimSellUsdtQty('');
        setSimSellDzdPrice('');
        setSimSellEurPrice('');
        setSimSellEurToDzdRate('');
    };

    const simSellResult = useMemo<SimSellResult>(() => {
        if (simMode !== 'sell_dzd' && simMode !== 'sell_eur')
            return null;

        const qty = parsePositive(parseAndEvaluate, simSellUsdtQty);
        if (qty <= 0)
            return null;

        let saleValueDzd = 0;
        let saleValueEur: number | undefined;
        let effectiveSellPriceDzd = 0;

        if (simMode === 'sell_dzd') {
            const price = parsePositive(parseAndEvaluate, simSellDzdPrice);
            if (price <= 0)
                return null;
            effectiveSellPriceDzd = price;
            saleValueDzd = qty * price;
        }
        else {
            const priceEur = parsePositive(parseAndEvaluate, simSellEurPrice);
            const eurToDzdRate = parsePositive(parseAndEvaluate, simSellEurToDzdRate);
            if (priceEur <= 0 || eurToDzdRate <= 0)
                return null;
            saleValueEur = qty * priceEur;
            saleValueDzd = saleValueEur * eurToDzdRate;
            effectiveSellPriceDzd = priceEur * eurToDzdRate;
        }

        const soldCostDzd = qty * currentPam;
        const profit = saleValueDzd - soldCostDzd;
        const profitMarginPercent = soldCostDzd > 0 ? (profit / soldCostDzd) * 100 : 0;

        return {
            profit,
            isProfitable: profit >= 0,
            saleValueDzd,
            saleValueEur,
            soldCostDzd,
            effectiveSellPriceDzd,
            profitMarginPercent,
        };
    }, [currentPam, parseAndEvaluate, simMode, simSellDzdPrice, simSellEurPrice, simSellEurToDzdRate, simSellUsdtQty]);

    const tabs: Tab[] = [
        { id: 'dzd', label: t('portfolio.buyWithDzd') as string },
        { id: 'eur', label: t('portfolio.buyWithEur') as string },
        { id: 'sell_dzd', label: t('portfolio.sellUsdtVsDzd') as string },
        { id: 'sell_eur', label: t('portfolio.sellUsdtVsEur') as string },
    ];

    return (
        <Card>
            <CardHeader className="p-4 pb-3">
                <SectionHeading icon={<RefreshCwIcon className="h-4 w-4" />}>
                    {t('portfolio.pamPriceSimulator')}
                </SectionHeading>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0">
                <div className="space-y-3 rounded-xl border border-border bg-surface-muted p-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <QuickMetric
                            label={t('portfolio.currentPam')}
                            value={<CurrencyAmount value={breakEvenDzdPrice} currency="DZD" semantic="plain" size="sm" decimals={2} />}
                        />
                        <QuickMetric
                            label={t('portfolio.suggestedSellPrice')}
                            value={<CurrencyAmount value={suggestedDzdSellPrice} currency="DZD" semantic="plain" size="sm" decimals={2} />}
                        />
                        <QuickMetric
                            label={t('portfolio.breakEvenPrice')}
                            value={<CurrencyAmount value={breakEvenDzdPrice} currency="DZD" semantic="plain" size="sm" decimals={2} />}
                        />
                        <QuickMetric
                            label={t('portfolio.estimatedProfit')}
                            value={<CurrencyAmount value={quickProfit} currency="DZD" semantic="auto" showSign size="sm" decimals={0} />}
                        />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className={`text-xs font-bold ${quickProfit >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`} dir="ltr">
                            {quickMarginPercent >= 0 ? '+' : ''}{formatNumber(quickMarginPercent, { min: 2, max: 2 })}%
                        </span>
                        <div className="grid grid-cols-3 gap-2 sm:w-auto">
                            <Button type="button" variant="outline" size="sm" onClick={useAllStock} className="min-w-0 rounded-lg px-1.5 text-xs leading-tight">
                                {t('portfolio.useAllStock')}
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={useSuggestedPrice} className="min-w-0 rounded-lg px-1.5 text-xs leading-tight">
                                {t('portfolio.useSuggestedPrice')}
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={resetSimulator} className="min-w-0 rounded-lg px-1.5 text-xs leading-tight">
                                {t('portfolio.resetSimulator')}
                            </Button>
                        </div>
                    </div>
                </div>

                <Tabs tabs={tabs} activeTab={simMode} onChange={handleModeChange} variant="pills" />

                {simMode === 'dzd' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                            <MoneyField label={t('portfolio.qtyUsdt') as string} value={simBuyQty} onChange={setSimBuyQty} currency="USDT" placeholder="1000" />
                            <MoneyField label={t('portfolio.buyPrice') as string} value={simBuyPrice} onChange={setSimBuyPrice} currency="DZD" placeholder="240.50" />
                        </div>
                        {newPamFromDzdSimulator !== null && (
                            <ResultBox>
                                <ResultLine label={t('portfolio.newPam')} value={<CurrencyAmount value={newPamFromDzdSimulator} currency="DZD" semantic="neutral" size="lg" decimals={2}/>} />
                                <ResultLine label={t('portfolio.suggestedSellPrice')} value={<CurrencyAmount value={newPamFromDzdSimulator + Math.max(0, suggestedDzdSellPrice - currentPam)} currency="DZD" semantic="plain" size="sm" decimals={2}/>} />
                            </ResultBox>
                        )}
                    </div>
                )}

                {simMode === 'eur' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <MoneyField label={t('portfolio.qtyEurToSpend') as string} value={simEurQty} onChange={setSimEurQty} currency="EUR" placeholder="1000" />
                            <MoneyField label={t('portfolio.buyPriceEur') as string} value={simEurDzdPrice} onChange={setSimEurDzdPrice} currency="DZD" placeholder="242.00" />
                            <MoneyField label={t('portfolio.rateEurUsdt') as string} value={simEurUsdtRate} onChange={setSimEurUsdtRate} placeholder="1.08" />
                        </div>
                        {newPamFromEurSimulator !== null && (
                            <ResultBox>
                                <ResultLine label={t('portfolio.newPam')} value={<CurrencyAmount value={newPamFromEurSimulator} currency="DZD" semantic="neutral" size="lg" decimals={2}/>} />
                            </ResultBox>
                        )}
                    </div>
                )}

                {simMode === 'sell_dzd' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                            <MoneyField label={t('portfolio.qtyUsdt') as string} value={simSellUsdtQty} onChange={setSimSellUsdtQty} currency="USDT" placeholder="1000" onMax={() => setSimSellUsdtQty(availableUsdt.toFixed(2))} maxDisabled={availableUsdt <= 0} />
                            <MoneyField label={t('portfolio.sellingPriceDzd') as string} value={simSellDzdPrice} onChange={setSimSellDzdPrice} currency="DZD" placeholder="242.00" />
                        </div>

                        <ResultBox>
                            <ResultLine label={t('portfolio.currentPam')} value={<CurrencyAmount value={currentPam} currency="DZD" semantic="plain" size="md" decimals={2}/>} />
                            {simSellResult && (
                                <ResultGrid>
                                    <ResultItem label={t('portfolio.saleValueDzd')} value={<CurrencyAmount value={simSellResult.saleValueDzd} currency="DZD" semantic="plain" size="sm" decimals={2}/>} />
                                    <ResultItem label={t('portfolio.soldCost')} value={<CurrencyAmount value={simSellResult.soldCostDzd} currency="DZD" semantic="plain" size="sm" decimals={2}/>} />
                                    <ResultItem label={t('portfolio.marginPercent')} value={<PercentValue value={simSellResult.profitMarginPercent} profitable={simSellResult.isProfitable} />} />
                                </ResultGrid>
                            )}
                        </ResultBox>

                        {simSellResult && (
                            <ProfitPreview
                                result={simSellResult}
                                profitableLabel={t('portfolio.profitableSale')}
                                lossLabel={t('portfolio.unprofitableSale')}
                            />
                        )}
                    </div>
                )}

                {simMode === 'sell_eur' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <MoneyField label={t('portfolio.qtyUsdt') as string} value={simSellUsdtQty} onChange={setSimSellUsdtQty} currency="USDT" placeholder="1000" onMax={() => setSimSellUsdtQty(availableUsdt.toFixed(2))} maxDisabled={availableUsdt <= 0} />
                            <MoneyField label={t('portfolio.sellingPriceEur') as string} value={simSellEurPrice} onChange={setSimSellEurPrice} currency="EUR" placeholder="0.8650" />
                            <MoneyField label={t('portfolio.rateEurDzd') as string} value={simSellEurToDzdRate} onChange={setSimSellEurToDzdRate} currency="DZD" placeholder="250.00" />
                        </div>

                        <ResultBox>
                            <ResultLine label={t('portfolio.currentPam')} value={<CurrencyAmount value={currentPam} currency="DZD" semantic="plain" size="md" decimals={2}/>} />
                            {simSellResult && (
                                <ResultGrid>
                                    <ResultItem label={t('portfolio.saleValueEur')} value={<CurrencyAmount value={simSellResult.saleValueEur || 0} currency="EUR" semantic="plain" size="sm" decimals={2}/>} />
                                    <ResultItem label={t('portfolio.saleValueDzd')} value={<CurrencyAmount value={simSellResult.saleValueDzd} currency="DZD" semantic="plain" size="sm" decimals={2}/>} />
                                    <ResultItem label={t('portfolio.equivalentPriceDzd')} value={<CurrencyAmount value={simSellResult.effectiveSellPriceDzd} currency="DZD" semantic="plain" size="sm" decimals={2}/>} />
                                    <ResultItem label={t('portfolio.soldCost')} value={<CurrencyAmount value={simSellResult.soldCostDzd} currency="DZD" semantic="plain" size="sm" decimals={2}/>} />
                                    <ResultItem label={t('portfolio.marginPercent')} value={<PercentValue value={simSellResult.profitMarginPercent} profitable={simSellResult.isProfitable} />} />
                                </ResultGrid>
                            )}
                        </ResultBox>

                        {simSellResult && (
                            <ProfitPreview
                                result={simSellResult}
                                profitableLabel={t('portfolio.profitableSale')}
                                lossLabel={t('portfolio.unprofitableSale')}
                            />
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function QuickMetric({ label, value }: { label: ReactNode; value: ReactNode }) {
    return (
        <div className="rounded-lg bg-surface px-3 py-2">
            <p className="text-[11px] font-bold uppercase text-neutral-500">{label}</p>
            <div className="mt-1 font-semibold">{value}</div>
        </div>
    );
}

function ResultBox({ children }: { children: ReactNode }) {
    return (
        <div className="space-y-2 rounded-lg bg-surface-muted p-3">
            {children}
        </div>
    );
}

function ResultLine({ label, value }: { label: ReactNode; value: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-neutral-500">{label}</span>
            <span className="font-semibold">{value}</span>
        </div>
    );
}

function ResultGrid({ children }: { children: ReactNode }) {
    return (
        <div className="grid grid-cols-1 gap-2 border-t border-border pt-2 sm:grid-cols-3">
            {children}
        </div>
    );
}

function ResultItem({ label, value }: { label: ReactNode; value: ReactNode }) {
    return (
        <div className="flex justify-between gap-3 sm:block">
            <span className="text-xs text-neutral-500">{label}</span>
            <span className="font-semibold">{value}</span>
        </div>
    );
}

function PercentValue({ value, profitable }: { value: number; profitable: boolean }) {
    return (
        <span className={`text-sm font-semibold tabular-nums ${profitable ? 'text-financial-profit' : 'text-financial-loss'}`} dir="ltr">
            {value >= 0 ? '+' : ''}{formatNumber(value, { min: 2, max: 2 })}%
        </span>
    );
}

function ProfitPreview({ result, profitableLabel, lossLabel }: { result: NonNullable<SimSellResult>; profitableLabel: ReactNode; lossLabel: ReactNode }) {
    return (
        <div className={`rounded-lg p-3 text-center ${result.isProfitable ? 'bg-success-bg' : 'bg-danger-bg'}`}>
            <p className={`mb-1 text-xs font-semibold ${result.isProfitable ? 'text-success' : 'text-danger'}`}>
                {result.isProfitable ? profitableLabel : lossLabel}
            </p>
            <CurrencyAmount value={result.profit} currency="DZD" semantic="auto" showSign size="xl" decimals={2}/>
        </div>
    );
}
