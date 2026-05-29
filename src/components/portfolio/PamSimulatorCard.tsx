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

export type PamSimulatorMode = 'dzd' | 'eur' | 'sell_dzd' | 'sell_eur';

type SimSellResult = {
    profit: number;
    isProfitable: boolean;
    saleValueDzd: number;
    saleValueEur?: number;
    soldCostDzd: number;
    effectiveSellPriceDzd: number;
    profitMarginPercent: number;
} | null;

export type PamSimulatorCardProps = {
    portfolioStats: any;
    suggestedProfitMargin: string;
    suggestedSellingPrice?: string;
    suggestedUsdtEurSellPrice?: string;
    parseAndEvaluate: (expr: string) => number;
    simMode: PamSimulatorMode;
    setSimMode: (mode: PamSimulatorMode) => void;
    simBuyQty: string;
    setSimBuyQty: (val: string) => void;
    simBuyPrice: string;
    setSimBuyPrice: (val: string) => void;
    newPamFromDzdSimulator: number | null;
    simEurQty: string;
    setSimEurQty: (val: string) => void;
    simEurDzdPrice: string;
    setSimEurDzdPrice: (val: string) => void;
    simEurUsdtRate: string;
    setSimEurUsdtRate: (val: string) => void;
    newPamFromEurSimulator: number | null;
    simSellUsdtQty?: string;
    setSimSellUsdtQty?: (val: string) => void;
    simSellDzdPrice?: string;
    setSimSellDzdPrice?: (val: string) => void;
    simSellEurPrice?: string;
    setSimSellEurPrice?: (val: string) => void;
    simSellEurToDzdRate?: string;
    setSimSellEurToDzdRate?: (val: string) => void;
    variant?: 'full' | 'compact';
    defaultExpanded?: boolean;
    showQuickDecision?: boolean;
};

export function PamSimulatorCard({
    portfolioStats,
    suggestedProfitMargin,
    suggestedSellingPrice,
    suggestedUsdtEurSellPrice,
    parseAndEvaluate,
    simMode,
    setSimMode,
    simBuyQty,
    setSimBuyQty,
    simBuyPrice,
    setSimBuyPrice,
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
    simSellEurPrice,
    setSimSellEurPrice,
    simSellEurToDzdRate,
    setSimSellEurToDzdRate,
    variant = 'full',
    defaultExpanded,
    showQuickDecision = false,
}: PamSimulatorCardProps) {
    const { t } = useLanguage();
    const isCompact = variant === 'compact';
    const [expanded, setExpanded] = useState(defaultExpanded ?? !isCompact);

    const resolveSuggestedDzdSellPrice = () => {
        const configuredPrice = suggestedSellingPrice && parseFloat(suggestedSellingPrice) > 0
            ? parseFloat(suggestedSellingPrice)
            : 0;
        return configuredPrice || (portfolioStats.usdt.avgBuy + parseAndEvaluate(suggestedProfitMargin));
    };

    const resolveDefaultSellEurToDzdRate = () => {
        const enteredRate = simSellEurToDzdRate ? parseAndEvaluate(simSellEurToDzdRate) : 0;
        const pamEur = Number(portfolioStats.eur?.avgBuy || 0);
        return pamEur > 0 ? pamEur : enteredRate;
    };

    const resolveSuggestedUsdtEurSellPrice = () => {
        const configuredPrice = suggestedUsdtEurSellPrice && parseFloat(suggestedUsdtEurSellPrice) > 0
            ? parseFloat(suggestedUsdtEurSellPrice)
            : 0;
        return configuredPrice;
    };

    const presetSellQuantity = () => {
        if (portfolioStats.usdt.available > 0 && setSimSellUsdtQty) {
            setSimSellUsdtQty(portfolioStats.usdt.available.toString());
        }
    };

    const handleModeChange = (next: string) => {
        const mode = next as PamSimulatorMode;
        setSimMode(mode);

        if (mode === 'eur') {
            if (portfolioStats.eur.available > 0) {
                setSimEurQty(Math.round(portfolioStats.eur.available).toString());
            }
            if (portfolioStats.eur.avgBuy > 0) {
                setSimEurDzdPrice(Math.round(portfolioStats.eur.avgBuy).toString());
            }
        }

        if (mode === 'sell_dzd') {
            presetSellQuantity();
            const priceToSet = resolveSuggestedDzdSellPrice();
            if (priceToSet > 0 && setSimSellDzdPrice) {
                setSimSellDzdPrice(priceToSet.toFixed(2));
            }
        }

        if (mode === 'sell_eur') {
            presetSellQuantity();
            const eurToDzdRate = resolveDefaultSellEurToDzdRate();
            if (eurToDzdRate > 0 && setSimSellEurToDzdRate) {
                setSimSellEurToDzdRate(eurToDzdRate.toFixed(2));
            }
            const suggestedUsdtEurPrice = resolveSuggestedUsdtEurSellPrice();
            const suggestedDzdPrice = resolveSuggestedDzdSellPrice();
            if (setSimSellEurPrice) {
                if (suggestedUsdtEurPrice > 0) {
                    setSimSellEurPrice(suggestedUsdtEurPrice.toFixed(4));
                } else if (suggestedDzdPrice > 0 && eurToDzdRate > 0) {
                    setSimSellEurPrice((suggestedDzdPrice / eurToDzdRate).toFixed(4));
                }
            }
        }
    };

    const suggestedDzdSellPrice = resolveSuggestedDzdSellPrice();
    const breakEvenDzdPrice = Number(portfolioStats.usdt?.avgBuy || 0);
    const availableUsdt = Math.max(0, Number(portfolioStats.usdt?.available || 0));
    const enteredQuickQty = simSellUsdtQty ? parseAndEvaluate(simSellUsdtQty) : 0;
    const quickQty = Number.isFinite(enteredQuickQty) && enteredQuickQty > 0 ? enteredQuickQty : availableUsdt;
    const quickProfit = quickQty * (suggestedDzdSellPrice - breakEvenDzdPrice);
    const quickMarginPercent = breakEvenDzdPrice > 0
        ? ((suggestedDzdSellPrice - breakEvenDzdPrice) / breakEvenDzdPrice) * 100
        : 0;
    const shouldShowQuickDecision = showQuickDecision || isCompact;

    const useAllStock = () => {
        handleModeChange('sell_dzd');
        if (setSimSellUsdtQty) {
            setSimSellUsdtQty(availableUsdt > 0 ? availableUsdt.toFixed(2) : '');
        }
        setExpanded(true);
    };

    const useSuggestedPrice = () => {
        handleModeChange('sell_dzd');
        if (setSimSellDzdPrice && suggestedDzdSellPrice > 0) {
            setSimSellDzdPrice(suggestedDzdSellPrice.toFixed(2));
        }
        setExpanded(true);
    };

    const resetSimulator = () => {
        setSimMode('dzd');
        setSimBuyQty('');
        setSimBuyPrice('');
        setSimEurQty('');
        setSimEurDzdPrice('');
        setSimEurUsdtRate('');
        setSimSellUsdtQty?.('');
        setSimSellDzdPrice?.('');
        setSimSellEurPrice?.('');
        setSimSellEurToDzdRate?.('');
        setExpanded(true);
    };

    const simSellResult = useMemo<SimSellResult>(() => {
        if ((simMode !== 'sell_dzd' && simMode !== 'sell_eur') || !simSellUsdtQty || !parseAndEvaluate) {
            return null;
        }

        const qty = parseAndEvaluate(simSellUsdtQty);
        if (!Number.isFinite(qty) || qty <= 0) {
            return null;
        }

        let saleValueDzd = 0;
        let saleValueEur: number | undefined;
        let effectiveSellPriceDzd = 0;

        if (simMode === 'sell_dzd') {
            if (!simSellDzdPrice) {
                return null;
            }
            const price = parseAndEvaluate(simSellDzdPrice);
            if (!Number.isFinite(price) || price <= 0) {
                return null;
            }
            effectiveSellPriceDzd = price;
            saleValueDzd = qty * price;
        } else {
            if (!simSellEurPrice || !simSellEurToDzdRate) {
                return null;
            }
            const priceEur = parseAndEvaluate(simSellEurPrice);
            const eurToDzdRate = parseAndEvaluate(simSellEurToDzdRate);
            if (!Number.isFinite(priceEur) || priceEur <= 0 || !Number.isFinite(eurToDzdRate) || eurToDzdRate <= 0) {
                return null;
            }
            saleValueEur = qty * priceEur;
            saleValueDzd = saleValueEur * eurToDzdRate;
            effectiveSellPriceDzd = priceEur * eurToDzdRate;
        }

        const soldCostDzd = qty * Number(portfolioStats.usdt.avgBuy || 0);
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
    }, [
        simMode,
        simSellUsdtQty,
        simSellDzdPrice,
        simSellEurPrice,
        simSellEurToDzdRate,
        portfolioStats.usdt.avgBuy,
        parseAndEvaluate,
    ]);

    const tabs: Tab[] = [
        { id: 'dzd', label: t('portfolio.buyWithDzd') as string },
        { id: 'eur', label: t('portfolio.buyWithEur') as string },
        { id: 'sell_dzd', label: t('portfolio.sellUsdtVsDzd') as string },
        { id: 'sell_eur', label: t('portfolio.sellUsdtVsEur') as string },
    ];

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-3">
                <SectionHeading icon={<RefreshCwIcon className="h-4 w-4" />}>
                    {t('portfolio.pamPriceSimulator')}
                </SectionHeading>
                {isCompact && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((value) => !value)} className="shrink-0 rounded-lg px-3">
                        {expanded ? t('common.hide') : t('common.show')}
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0">
                {shouldShowQuickDecision && (
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
                        <div className="space-y-2">
                            <span className={`text-xs font-bold ${quickProfit >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`} dir="ltr">
                                {quickMarginPercent >= 0 ? '+' : ''}{formatNumber(quickMarginPercent, { min: 2, max: 2 })}%
                            </span>
                            <div className="grid grid-cols-3 gap-2">
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
                )}

                {(!isCompact || expanded) && (<>
                <Tabs tabs={tabs} activeTab={simMode} onChange={handleModeChange} variant="pills" />

                {simMode === 'dzd' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                            <MoneyField label={t('portfolio.qtyUsdt')} value={simBuyQty} onChange={setSimBuyQty} currency="USDT" placeholder="1000" />
                            <MoneyField label={t('portfolio.buyPrice')} value={simBuyPrice} onChange={setSimBuyPrice} currency="DZD" placeholder="240.50" />
                        </div>
                        {newPamFromDzdSimulator !== null && (
                            <ResultBox>
                                <ResultLine label={t('portfolio.newPam')} value={<CurrencyAmount value={newPamFromDzdSimulator} currency="DZD" semantic="neutral" size="lg" decimals={2}/>} />
                                <ResultLine label={t('portfolio.suggestedSellPrice')} value={<CurrencyAmount value={newPamFromDzdSimulator + parseAndEvaluate(suggestedProfitMargin)} currency="DZD" semantic="plain" size="sm" decimals={2}/>} />
                            </ResultBox>
                        )}
                    </div>
                )}

                {simMode === 'eur' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <MoneyField label={t('portfolio.qtyEurToSpend')} value={simEurQty} onChange={setSimEurQty} currency="EUR" placeholder="1000" />
                            <MoneyField label={t('portfolio.buyPriceEur')} value={simEurDzdPrice} onChange={setSimEurDzdPrice} currency="DZD" placeholder="242.00" />
                            <MoneyField label={t('portfolio.rateEurUsdt')} value={simEurUsdtRate} onChange={setSimEurUsdtRate} placeholder="1.08" />
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
                        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                            <MoneyField label={t('portfolio.qtyUsdt')} value={simSellUsdtQty || ''} onChange={(value) => setSimSellUsdtQty?.(value)} currency="USDT" placeholder="1000" />
                            <MoneyField label={t('portfolio.sellingPriceDzd')} value={simSellDzdPrice || ''} onChange={(value) => setSimSellDzdPrice?.(value)} currency="DZD" placeholder="242.00" />
                        </div>

                        <ResultBox>
                            <ResultLine label={t('portfolio.currentPam')} value={<CurrencyAmount value={portfolioStats.usdt.avgBuy} currency="DZD" semantic="plain" size="md" decimals={2}/>} />
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
                            <MoneyField label={t('portfolio.qtyUsdt')} value={simSellUsdtQty || ''} onChange={(value) => setSimSellUsdtQty?.(value)} currency="USDT" placeholder="1000" />
                            <MoneyField label={t('portfolio.sellingPriceEur')} value={simSellEurPrice || ''} onChange={(value) => setSimSellEurPrice?.(value)} currency="EUR" placeholder="0.8650" />
                            <MoneyField label={t('portfolio.rateEurDzd')} value={simSellEurToDzdRate || ''} onChange={(value) => setSimSellEurToDzdRate?.(value)} currency="DZD" placeholder="250.00" />
                        </div>

                        <ResultBox>
                            <ResultLine label={t('portfolio.currentPam')} value={<CurrencyAmount value={portfolioStats.usdt.avgBuy} currency="DZD" semantic="plain" size="md" decimals={2}/>} />
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
                </>)}
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
