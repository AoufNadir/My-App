import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    createIndexDoc,
    indexId,
} = require('../../scripts/legacyOperationIndexBackfill.cjs') as {
    createIndexDoc: (rootNode: any, componentRows: string[], updatedAt: number, runId: string) => any;
    indexId: (transactionType: string, transactionId: string) => string;
};

const scriptPath = join(process.cwd(), 'scripts', 'legacyOperationIndexBackfill.cjs');
const tempRoot = join(tmpdir(), `prodigital-backfill-${Date.now()}`);
mkdirSync(tempRoot, { recursive: true });

function writeFixture(name: string, fixture: unknown): string {
    const file = join(tempRoot, `${name}.json`);
    writeFileSync(file, JSON.stringify(fixture, null, 2), 'utf8');
    return file;
}

function runBackfill(args: string[]) {
    const output = execFileSync(process.execPath, [scriptPath, ...args], {
        cwd: process.cwd(),
        encoding: 'utf8',
    });
    return JSON.parse(output);
}

function baseCollections(extra: Record<string, any[]> = {}) {
    return {
        usdt_txs: [
            {
                id: 'sale-1',
                type: 'sell',
                linkedTreasuryTxId: 'cash-1',
                timestamp: 1,
            },
        ],
        treasury_txs: [
            {
                id: 'cash-1',
                type: 'Ajout',
                linkedTxId: 'sale-1',
                timestamp: 1,
            },
        ],
        dzd_client_txs: [],
        actifTransactions: [],
        investor_transactions: [],
        treasury_cards: [],
        digital_service_txs: [],
        legacy_operation_index: [],
        legacy_operation_index_checkpoints: [],
        ...extra,
    };
}

function fixture(collections: Record<string, any[]>) {
    return {
        users: [
            {
                id: 'user-1',
                collections,
            },
        ],
    };
}

try {
    {
        const fixturePath = writeFixture('dry-run', fixture(baseCollections()));
        const report = runBackfill(['--dry-run', '--run-id=test-run', '--chunk-size=1', `--fixture=${fixturePath}`]);
        assert.equal(report.readyForApply, true);
        assert.equal(report.totals.usersRead, 1);
        assert.equal(report.totals.legacyOperationsCandidate, 2);
        assert.equal(report.totals.expectedIndexesToCreate, 2);
        assert.equal(report.totals.unsupported, 0);
        assert.equal(report.totals.mismatches, 0);
        assert.equal(report.totals.missingLinkedTargets, 0);
        assert.equal(report.plan.totalItems, 2);
    }

    {
        const fixturePath = writeFixture('apply', fixture(baseCollections()));
        const report = runBackfill(['--apply', '--run-id=test-run', '--chunk-size=1', `--fixture=${fixturePath}`]);
        assert.equal(report.readyForApply, true);
        assert.equal(report.totals.created, 2);
        assert.equal(report.totals.checkpointsWritten, 2);
        assert.equal(report.fixtureApply.noFirestoreWrites, true);
        assert.equal(report.fixtureApply.createdIndexes.length, 2);
    }

    {
        const first = createIndexDoc(
            { collection: 'usdt_txs', type: 'usdt_tx', doc: { id: 'sale-1' }, key: 'usdt_txs/sale-1' },
            ['usdt_txs/sale-1', 'treasury_txs/cash-1'],
            1,
            'existing-run',
        );
        const second = createIndexDoc(
            { collection: 'treasury_txs', type: 'treasury_tx', doc: { id: 'cash-1' }, key: 'treasury_txs/cash-1' },
            ['usdt_txs/sale-1', 'treasury_txs/cash-1'],
            1,
            'existing-run',
        );
        const collections = baseCollections({
            legacy_operation_index: [
                { id: indexId('usdt_tx', 'sale-1'), ...first },
                { id: indexId('treasury_tx', 'cash-1'), ...second },
            ],
        });
        const fixturePath = writeFixture('idempotent', fixture(collections));
        const report = runBackfill(['--dry-run', '--run-id=test-run', `--fixture=${fixturePath}`]);
        assert.equal(report.readyForApply, true);
        assert.equal(report.totals.expectedIndexesToCreate, 0);
        assert.equal(report.totals.skipped, 2);
        assert.equal(report.plan.totalItems, 0);
    }

    {
        const checkpoint = {
            id: 'backfill_latest',
            runId: 'resume-run',
            processed: 1,
            created: 1,
            batchNumber: 1,
            lastIndexId: indexId('treasury_tx', 'cash-1'),
        };
        const fixturePath = writeFixture('resume', fixture(baseCollections({
            legacy_operation_index_checkpoints: [checkpoint],
        })));
        const report = runBackfill(['--apply', '--resume', '--run-id=resume-run', '--chunk-size=1', `--fixture=${fixturePath}`]);
        assert.equal(report.readyForApply, true);
        assert.equal(report.totals.skippedByCheckpoint, 1);
        assert.equal(report.totals.created, 1);
        assert.equal(report.plan.totalItems, 1);
        assert.equal(report.totals.lastCheckpoint.lastIndexId, indexId('usdt_tx', 'sale-1'));
    }

    {
        const badIndex = {
            id: indexId('usdt_tx', 'sale-1'),
            operationId: indexId('usdt_tx', 'sale-1'),
            status: 'active',
            root: { collection: 'usdt_txs', id: 'sale-1', role: 'root', transactionType: 'usdt_tx' },
            linkedRows: [],
            payloadHash: 'different',
        };
        const fixturePath = writeFixture('mismatch', fixture(baseCollections({
            legacy_operation_index: [badIndex],
        })));
        const report = runBackfill(['--dry-run', '--run-id=test-run', `--fixture=${fixturePath}`]);
        assert.equal(report.readyForApply, false);
        assert.equal(report.totals.mismatches, 1);
    }

    {
        const outputPath = join(tempRoot, 'report.json');
        const fixturePath = writeFixture('out', fixture(baseCollections()));
        const report = runBackfill(['--dry-run', '--run-id=test-run', `--fixture=${fixturePath}`, `--out=${outputPath}`]);
        assert.equal(existsSync(outputPath), true);
        const persisted = JSON.parse(readFileSync(outputPath, 'utf8'));
        assert.equal(persisted.plan.totalItems, report.plan.totalItems);
    }
} finally {
    rmSync(tempRoot, { recursive: true, force: true });
}

console.log('legacy operation index backfill tests passed');
