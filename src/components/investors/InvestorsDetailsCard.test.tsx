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

console.log('InvestorsDetailsCard tests passed');
