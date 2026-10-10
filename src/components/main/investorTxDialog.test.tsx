import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider, useLanguage } from '../../contexts/LanguageContext';
import { MainInvestorDialogs } from './MainInvestorDialogs';

// V5-1: in the investor withdrawal window, what the investor can take (profit or capital) shows
// before any amount is typed, and a Max button sits in the amount field. Nothing else changes.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
};
type Lang = 'fr' | 'ar';
function WithT({ children }: { children: (t: (key: string) => string) => React.ReactElement }) {
    const { t } = useLanguage();
    return children(t as (key: string) => string);
}
const noop = () => undefined;
const investor = { id: 'i1', name: 'Investisseur Test', isActive: true, capitalInvested: 800_000, availableProfit: 45_250.75, totalProfit: 60_000, withdrawnProfit: 0, sharePercentage: 0.2, entryDate: '2026-01-01', initialCapital: 800_000 };
const render = (lang: Lang, type: string, caisse: number, amount = '') => {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider><WithT>{(t) => <MainInvestorDialogs {...{
        isInvestorModalOpen: false, setIsInvestorModalOpen: noop, editingInvestor: null, investorName: '', setInvestorName: noop, investorInitialCapital: '', setInvestorInitialCapital: noop, investorInitialCapitalSource: 'Caisse', setInvestorInitialCapitalSource: noop, investorNotes: '', setInvestorNotes: noop, isManager: false, setIsManager: noop, handleSaveInvestor: noop, fieldBase: '', derivedInvestors: [investor], selectedInvestorId: 'i1',
        isInvestorTxModalOpen: true, setIsInvestorTxModalOpen: noop, investorTxType: type, investorTxAmount: amount, setInvestorTxAmount: noop,
        investorTxPaymentSource: 'Caisse', setInvestorTxPaymentSource: noop, treasuryStats: { caisse, baridi: 0 },
        investorTxNotes: '', setInvestorTxNotes: noop, handleInvestorTransaction: noop, t, investorToDelete: null, setInvestorToDelete: noop,
        handleDeleteInvestor: noop, investorTxToDelete: null, setInvestorTxToDelete: noop, handleDeleteInvestorTx: noop,
        isReinvestModalOpen: false, setIsReinvestModalOpen: noop, reinvestInput: '', setReinvestInput: noop, handleReinvestProfit: noop, setAlert: noop,
    } as any}/>}</WithT></LanguageProvider>);
};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/[\s  ]+/g, ' ');

for (const lang of ['fr', 'ar'] as const) {
    const profit = render(lang, 'withdraw_profit', 1_000_000);
    assert.match(text(profit), /45 250,75/, `${lang}: the available profit shows before any amount is typed`);
    assert.match(profit, lang === 'fr' ? />MAX</ : />الكل</, `${lang}: a Max button in the amount field`);

    const capital = render(lang, 'withdraw_capital', 1_000_000);
    assert.match(text(capital), /800 000/, `${lang}: the capital shows for a capital withdrawal`);

    // The register holds less than the investor's profit: Max stops at the register, and says so.
    const short = render(lang, 'withdraw_profit', 30_000);
    assert.match(text(short), lang === 'fr' ? /Max limité au solde Caisse/ : /الحد الأقصى محدود برصيد Caisse/, `${lang}: Max explains it stops at the register`);

    // A deposit has no Max.
    const deposit = render(lang, 'deposit_capital', 1_000_000);
    assert.doesNotMatch(deposit, lang === 'fr' ? />MAX</ : />الكل</, `${lang}: no Max on a deposit`);
}

console.log('investor transaction window tests passed');
