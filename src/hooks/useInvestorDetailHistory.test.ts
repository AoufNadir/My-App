import assert from 'node:assert/strict';
import {
    applyInvestorDetailQueryPlan,
    buildInvestorDetailQueryPlan,
} from './useInvestorDetailHistory';

type SpyQuery = {
    calls: string[];
    where: (field: string, operator: string, value: string) => SpyQuery;
    orderBy: (field: string, direction: string) => SpyQuery;
    limit: (count: number) => SpyQuery;
};

function createSpyQuery(): SpyQuery {
    const calls: string[] = [];
    const query: SpyQuery = {
        calls,
        where(field, operator, value) {
            calls.push(`where(${field},${operator},${value})`);
            return query;
        },
        orderBy(field, direction) {
            calls.push(`orderBy(${field},${direction})`);
            return query;
        },
        limit(count) {
            calls.push(`limit(${count})`);
            return query;
        },
    };
    return query;
}

// A selected investor's history must be filtered and bounded in Firestore,
// newest-first; it must not use the full shared ledger for the details screen.
const plan = buildInvestorDetailQueryPlan({ investorId: 'investor-42', resultLimit: 100 });
assert.equal(plan.enabled, true);
assert.equal(plan.investorId, 'investor-42');
assert.equal(plan.limit, 100);
assert.match(plan.signature, /investor-42/);

const spy = createSpyQuery();
applyInvestorDetailQueryPlan(spy, plan);
assert.deepEqual(spy.calls, [
    'where(investorId,==,investor-42)',
    'orderBy(timestamp,desc)',
    'limit(100)',
]);

const resized = buildInvestorDetailQueryPlan({ investorId: 'investor-42', resultLimit: 50 });
const otherInvestor = buildInvestorDetailQueryPlan({ investorId: 'investor-43', resultLimit: 100 });
assert.notEqual(resized.signature, plan.signature, 'Changing resultLimit must rebuild the listener plan');
assert.notEqual(otherInvestor.signature, plan.signature, 'Changing investor must rebuild the listener plan');
assert.equal(buildInvestorDetailQueryPlan({ investorId: null, resultLimit: 100 }).enabled, false);

console.log('investor detail Firestore query-plan tests passed');
