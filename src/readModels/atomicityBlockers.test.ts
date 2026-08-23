import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import {
    createLegacyOperationIndexDoc,
    deterministicLinkedId,
    flattenLegacyOperationIndexRows,
    isOperationIndexRequiredError,
    LEGACY_OPERATION_INDEX_COLLECTIONS,
    legacyOperationIndexId,
    OPERATION_INDEX_REQUIRED,
} from './operationIndex';

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), 'utf8');

function sourceSlice(file: string, marker: string, endMarker: string): string {
    const content = source(file);
    const start = content.indexOf(marker);
    assert.ok(start >= 0, `${marker} not found in ${file}`);
    const end = content.indexOf(endMarker, start + marker.length);
    assert.ok(end >= 0, `${endMarker} not found after ${marker} in ${file}`);
    return content.slice(start, end);
}

{
    const id = legacyOperationIndexId('usdt_tx', 'abc/def');
    assert.equal(id, 'legacy:usdt_tx:abc__slash__def');
    assert.equal(deterministicLinkedId('root/1', 'treasury-sell-cash'), 'root__slash__1:treasury-sell-cash');
    assert.equal(LEGACY_OPERATION_INDEX_COLLECTIONS.investor_transactions, 'investor_tx');
    assert.equal(LEGACY_OPERATION_INDEX_COLLECTIONS.treasury_cards, 'treasury_card');
    assert.equal(LEGACY_OPERATION_INDEX_COLLECTIONS.digital_service_txs, 'digital_service_tx');
    assert.equal(legacyOperationIndexId('digital_service_tx', 'svc-1'), 'legacy:digital_service_tx:svc-1');
}

{
    const index = createLegacyOperationIndexDoc({
        transactionId: 'sale-1',
        transactionType: 'usdt_tx',
        updatedAt: 123,
        linkedRows: [
            { collection: 'treasury_txs', id: 't1' },
            { collection: 'treasury_txs', id: 't1' },
            { collection: 'dzd_client_txs', id: 'c1' },
        ],
    });
    assert.equal(index.operationId, 'legacy:usdt_tx:sale-1');
    assert.equal(index.status, 'active');
    assert.equal(Object.prototype.hasOwnProperty.call(index, 'deletedAt'), false);
    assert.deepEqual(flattenLegacyOperationIndexRows(index).map((row) => `${row.collection}/${row.id}`), [
        'dzd_client_txs/c1',
        'treasury_txs/t1',
        'usdt_txs/sale-1',
    ]);
}

{
    const deleted = createLegacyOperationIndexDoc({
        transactionId: 'sale-1',
        transactionType: 'usdt_tx',
        updatedAt: 124,
        deletedAt: 124,
        status: 'deleted',
        linkedRows: [{ collection: 'treasury_txs', id: 't1' }],
    });
    assert.deepEqual(flattenLegacyOperationIndexRows(deleted), [], 'deleted operation index must stop double delete');
    assert.equal(isOperationIndexRequiredError(OPERATION_INDEX_REQUIRED), true);
}

{
    const transactionService = source('src/transactionService.ts');
    assert.match(transactionService, /getReadModelsMode\(\) === 'read'/, 'read mode must block non-indexed legacy edit/delete');
    assert.match(transactionService, /OPERATION_INDEX_REQUIRED/, 'missing operation index must be explicit');
    assert.match(transactionService, /findLinkedTransactionsFromOperationIndex/, 'legacy edit/delete needs indexed linked rows');
    assert.match(transactionService, /deterministicLinkedId\(transactionId, 'treasury-buy-cash'\)/, 'retryable edits need deterministic treasury child ids');
    assert.match(transactionService, /deterministicLinkedId\(transactionId, 'client-sell'\)/, 'retryable edits need deterministic client child ids');
}

{
    const poHandlers = sourceSlice('src/hooks/usePoOrderHandlers.ts', "const completeOrder: PoOrderHandlers['completeOrder']", '// One-time default catalog');
    assert.match(poHandlers, /db\.runTransaction/, 'PO completion must use Firestore transaction');
    assert.match(poHandlers, /transaction\.get\(orderRef\)/, 'PO completion must read the order inside the transaction');
    assert.match(poHandlers, /freshOrder\?\.linkedUsdtTxId/, 'linkedUsdtTxId guard must use the fresh transaction snapshot');
    assert.match(poHandlers, /throw new Error\('ALREADY_COMPLETED'\)/, 'double PO completion must be rejected');
    assert.doesNotMatch(poHandlers, /db\.batch\(\)/, 'PO completion must not use a non-transactional batch');
}

{
    const clientDelete = sourceSlice('src/hooks/useClientHandlers.ts', 'const handleDeleteClient = async', '// Client Tx');
    assert.match(clientDelete, /archiveClient\(clientToDelete\.id\)/, 'Client delete must archive the client doc');
    assert.doesNotMatch(clientDelete, /batch\.delete|\.delete\(/, 'Client delete must not delete financial history');

    const investorDelete = sourceSlice('src/hooks/useInvestorHandlers.ts', 'const handleDeleteInvestor = async', '    return {');
    assert.match(investorDelete, /archived: true/, 'Investor delete must archive the investor doc');
    assert.match(investorDelete, /isActive: false/, 'Investor archive must mark investor inactive');
    assert.doesNotMatch(investorDelete, /batch\.delete|\.delete\(/, 'Investor delete must not delete financial history');

    const assetDelete = sourceSlice('src/hooks/useAssetHandlers.ts', 'const handleDeleteAsset = async', '    const handleCreateAssetTransaction');
    assert.match(assetDelete, /archived: true/, 'Asset delete must archive the asset doc');
    assert.doesNotMatch(assetDelete, /\.delete\(/, 'Asset delete must not delete the asset doc');

    const assetClientDelete = sourceSlice('src/hooks/useAssetHandlers.ts', 'const handleDeleteAssetClient = async', '    const openAssetClientModal');
    assert.match(assetClientDelete, /archived: true/, 'Asset client delete must archive the client doc');
    assert.doesNotMatch(assetClientDelete, /batch\.delete|\.delete\(/, 'Asset client delete must not delete financial history');
}

{
    const mainApp = source('src/MainApp.tsx');
    assert.match(mainApp, /readModelsMode === 'read'[\s\S]*Réinitialisation globale désactivée en mode Read Models/, 'Global Reset must be blocked in read mode');
}

{
    const backfillScript = source('scripts/legacyOperationIndexBackfill.cjs');
    assert.match(backfillScript, /investor_transactions: 'investor_tx'/, 'Backfill must index investor_transactions metadata');
    assert.match(backfillScript, /treasury_cards: 'treasury_card'/, 'Backfill must index treasury_cards metadata');
    assert.match(backfillScript, /digital_service_txs: 'digital_service_tx'/, 'Backfill must index digital_service_txs metadata');
    assert.match(backfillScript, /linkedPortfolioTxIds/, 'Backfill must link digital service portfolio children');
    assert.match(backfillScript, /linkedTreasuryTxIds/, 'Backfill must link digital service treasury children');
    assert.match(backfillScript, /currentDocument = precondition/, 'Real backfill writes must use Firestore preconditions');
}

console.log('atomicityBlockers tests passed');
