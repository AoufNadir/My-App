import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InvestorsDetailsCard } from './InvestorsDetailsCard';
import { computeCapitalSnapshot } from '../../utils/capitalSnapshot';

// "Valeur nette du projet" includes the manager's pending personal advances, so its rows
// must show them too, or they do not add up to the total above them.
{
    const capitalSnapshot = computeCapitalSnapshot({
        caisseBalance: 1050000,
        baridiBalance: 0,
        portfolioValue: 250000,
        totalDettes: 200000,
        totalAvances: 30000,
        managerPendingAdvances: 50000,
    });
    assert.equal(capitalSnapshot.totalCapital, 1520000);
    const stats = { totalCapital: 0, totalProfitDistributed: 0, totalAvailable: 0, managerFee: 0, totalWithdrawn: 0 };
    const html = renderToStaticMarkup(<InvestorsDetailsCard stats={stats} capitalSnapshot={capitalSnapshot} managerFeePercentage="30" onOpenCommissionEditor={() => {}}/>);
    const text = html.replace(/<[^>]+>/g, '|').replace(/\s+/g, ' ');
    assert.match(text, /Avance personnelle à régulariser\|+[^|]*50 000/);

    const rows = [capitalSnapshot.cashTotal, capitalSnapshot.stockValue, capitalSnapshot.netClientPosition, capitalSnapshot.treasuryCardsTotal, capitalSnapshot.servicesCapitalImpact, capitalSnapshot.managerPendingAdvances];
    assert.equal(rows.reduce((sum, value) => sum + value, 0), capitalSnapshot.totalCapital);
}

// A debt written off is shown next to the project expenses, and the net profit row
// appears even when there are no project expenses.
{
    const stats = { totalCapital: 0, totalProfitDistributed: 0, totalAvailable: 0, managerFee: 0, totalWithdrawn: 0, totalDeliveryExpenses: 0, totalDebtWriteOffs: 100000, netDistributableProfit: -95000 };
    const html = renderToStaticMarkup(<InvestorsDetailsCard stats={stats} managerFeePercentage="30" onOpenCommissionEditor={() => {}}/>);
    const text = html.replace(/<[^>]+>/g, '|').replace(/\s+/g, ' ');
    assert.match(text, /Dettes clients effacées\|+[^|]*100 000/);
    assert.match(text, /Profit net cumulé du projet/);
    assert.doesNotMatch(text, /Frais du projet/);
    assert.doesNotMatch(text, /Profit attribué cumulé/);
}

console.log('InvestorsDetailsCard tests passed');
