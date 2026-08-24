#!/usr/bin/env node
/**
 * Verify Global Accounting V2 Cutover status by importing the real closure
 * gate and exercising it with the PRODUCTION env value.
 * Glue-only: reuses src/accounting/closure.ts verbatim.
 */
'use strict';
const args = process.argv.slice(2);
const closureAt = args.find((a) => a.startsWith('--closure-at='))?.slice('--closure-at='.length);
const mode = args.find((a) => a.startsWith('--mode='))?.slice('--mode='.length) || 'check';

(async () => {
  const closure = await import('../src/accounting/closure.ts');
  const status = closure.getAccountingV2Status(closureAt);
  const report = {
    closureAt,
    status,
    isActive: status.mode === 'active' && status.closureAt !== null,
    v2WriteEnabled: (() => {
      try {
        closure.assertAccountingV2WriteEnabled(status);
        return true;
      } catch {
        return false;
      }
    })(),
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.isActive ? 0 : 2);
})();
