// Financial audit, READ ONLY. On the owner's computer, from the project folder:
//   1. In the app: Réglages → Sauvegarde des données → Télécharger (a prodigital_backup_….json file).
//   2. npx tsx scripts/financial-audit.ts <path-to-backup.json> [owner capital] [other investors capital]
//      e.g. npx tsx scripts/financial-audit.ts C:\Users\HB\Downloads\prodigital_backup_2026-11-18.json 3420000 1230000
// It prints the report and writes it next to the backup as <backup>.audit.md. It never touches the database.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildFinancialAudit } from '../src/utils/financialAuditReport';

const [file, owner, others] = process.argv.slice(2);
if (!file) {
    console.error('Usage: npx tsx scripts/financial-audit.ts <backup.json> [owner capital] [other investors capital]');
    process.exit(1);
}
const backup = JSON.parse(readFileSync(file, 'utf8'));
const { text } = buildFinancialAudit(backup, { now: Date.now(), declaredOwnerCapital: Number(owner) || undefined, declaredOthersCapital: Number(others) || undefined });
const target = `${file.replace(/\.json$/i, '')}.audit.md`;
writeFileSync(target, text);
console.log(text);
console.log(`\nRapport écrit: ${target}`);
