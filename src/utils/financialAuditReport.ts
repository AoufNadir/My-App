// Financial audit (owner's request, 2026-11-18). READ ONLY: it reads a backup file (Réglages → Sauvegarde) and
// recomputes, with the app's own engine, what each period earned and how it was split, next to the owner's stated
// rule (30 % management + capital share of 70 %) with the capitals he declares. It writes nothing anywhere.
import { computePamLedger } from './pamLedger';
import { collectDebtWriteOffs } from './debtWriteOffs';
import { deriveInvestorEconomics, getManagerProfitBreakdown, type ManagerFeeHistoryEntry } from '../hooks/useInvestorEconomics';
import { buildInvestorCapitalReconciliation, isPersonalExpenseCapitalWithdrawal } from './managerCapital';
import type { ClientTransactionDzd, Investor, InvestorTransaction, TreasuryTx, Tx } from '../types';

const DAY = 86_400_000;
type Doc = Record<string, unknown> & { id: string };
export type BackupFile = { version?: number; exportedAt?: string; user?: Record<string, unknown> | null; collections: Record<string, Array<{ id: string; data: unknown }>> };
export type AuditOptions = { now: number; declaredOwnerCapital?: number; declaredOthersCapital?: number };

/** {__timestamp: iso} (the backup's dates) become epoch milliseconds, everything else stays as it is. */
function revive(value: unknown): unknown {
    if (value && typeof value === 'object') {
        if (Array.isArray(value)) return value.map(revive);
        const ts = (value as { __timestamp?: unknown }).__timestamp;
        if (typeof ts === 'string') return Date.parse(ts);
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, revive(v)]));
    }
    return value;
}
const rows = (backup: BackupFile, name: string): Doc[] => (backup.collections[name] || []).map((d) => ({ id: d.id, ...(revive(d.data) as Record<string, unknown> || {}) }));
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => (Math.round(v) || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
const day = (ts: number) => new Date(ts).toISOString().slice(0, 10);

export function periodStarts(now: number) {
    const d = new Date(now);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dow = d.getDay();
    const week = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (dow === 0 ? 6 : dow - 1)).getTime(); // the app's week: Monday
    return { today: dayStart, week, month: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
}

export function buildFinancialAudit(backup: BackupFile, options: AuditOptions) {
    const now = options.now;
    const transactions = rows(backup, 'usdt_txs') as unknown as Tx[];
    const treasury = rows(backup, 'treasury_txs') as unknown as TreasuryTx[];
    const clientTxs = rows(backup, 'dzd_client_txs') as unknown as ClientTransactionDzd[];
    const investors = rows(backup, 'investors') as unknown as Investor[];
    const investorTxs = rows(backup, 'investor_transactions') as unknown as InvestorTransaction[];
    const feeHistory: ManagerFeeHistoryEntry[] = rows(backup, 'manager_fee_history')
        .map((h) => ({ id: h.id, percentage: num(h.percentage), effectiveFrom: num(h.effectiveFrom), createdAt: num(h.createdAt) || num(h.effectiveFrom) }))
        .filter((h) => h.effectiveFrom > 0).sort((a, b) => a.effectiveFrom - b.effectiveFrom);
    const feePct = String(backup.user?.managerFeePercentage ?? '30');
    const pamLedger = computePamLedger(transactions);
    const deliveryExpenses = treasury.filter((t) => t.origin === 'delivery_expense');
    const personalExpenses = treasury.filter((t) => t.origin === 'personal_expense');
    const debtWriteOffs = collectDebtWriteOffs(clientTxs);
    const base = { investors, investorTransactions: investorTxs, transactions, managerFeePercentage: feePct, managerFeeHistory: feeHistory.length ? feeHistory : undefined, pamLedger, deliveryExpenses, debtWriteOffs, treasuryTransactions: treasury, personalExpenses };
    const manager = investors.find((i) => i.isManager);
    const lines: string[] = [];
    const out = (s = '') => lines.push(s);

    out(`# Audit financier ProDigital (lecture seule)`);
    out(`Sauvegarde du ${backup.exportedAt ?? '?'} · calculé le ${new Date(now).toISOString().slice(0, 16)} · taux de gestion actuel ${feePct} %${feeHistory.length ? ` · historique: ${feeHistory.map((h) => `${h.percentage}% dès ${day(h.effectiveFrom)}`).join(', ')}` : ''}`);
    out(`Semaine de l'application = semaine calendaire depuis lundi.`);
    out();

    // 1. Capital: declared, displayed, and the weight the split really uses.
    out(`## 1. Capitaux`);
    out(`| Investisseur | Capital initial | Capital affiché | Poids réel du partage | Écart (retraits de capital pour dépenses perso) | Part actuelle |`);
    out(`|---|---|---|---|---|---|`);
    const full = deriveInvestorEconomics(base as never);
    for (const inv of full.derivedInvestors) {
        const txs = investorTxs.filter((t) => t.investorId === inv.id);
        const personalCapitalOut = txs.filter((t) => isPersonalExpenseCapitalWithdrawal(t, personalExpenses)).reduce((s, t) => s + num(t.amount), 0);
        // The split's weight (capitalAtTs in the engine): opening + real top-ups + reinvested − EVERY capital withdrawal.
        const rec = buildInvestorCapitalReconciliation(inv as Investor, txs, personalExpenses);
        const weight = rec.currentCapital - personalCapitalOut;
        out(`| ${inv.isManager ? '⭐ ' : ''}${inv.name || inv.id} | ${fmt(rec.openingCapital)} | ${fmt(rec.currentCapital)} | ${fmt(weight)} | ${fmt(personalCapitalOut)} | ${(num(inv.sharePercentage) * 100).toFixed(2)} % |`);
    }
    if (options.declaredOwnerCapital && options.declaredOthersCapital) {
        const declaredShare = options.declaredOwnerCapital / (options.declaredOwnerCapital + options.declaredOthersCapital);
        const appShare = num(full.derivedInvestors.find((i) => i.isManager)?.sharePercentage);
        out();
        out(`Part du gérant dans les 70 % : déclarée ${(declaredShare * 100).toFixed(2)} % (${fmt(options.declaredOwnerCapital)} / ${fmt(options.declaredOwnerCapital + options.declaredOthersCapital)}), appliquée par l'application ${(appShare * 100).toFixed(2)} %.`);
    }
    out();

    // 2. Each period recomputed from the operations.
    const starts = periodStarts(now);
    const fee = Number(feePct) / 100 || 0.3;
    const declaredShare = options.declaredOwnerCapital && options.declaredOthersCapital ? options.declaredOwnerCapital / (options.declaredOwnerCapital + options.declaredOthersCapital) : null;
    out(`## 2. Périodes (recalculées depuis les opérations)`);
    out(`| Période | Ventes: bénéfices | Ventes: pertes | Frais du projet | Dettes annulées | Net à partager | Part gestion | Gérant comme investisseur | Autres investisseurs | Gérant total (app) | Gérant selon la règle déclarée | Écart |`);
    out(`|---|---|---|---|---|---|---|---|---|---|---|---|`);
    const periodDetails: Record<string, { from: number }> = {};
    for (const [label, from] of [['Aujourd’hui', starts.today], ['Semaine', starts.week], ['Mois', starts.month]] as const) {
        periodDetails[label] = { from };
        const sells = pamLedger.sellProfitRows.filter((s) => s.timestamp >= from && s.timestamp <= now);
        const gains = sells.reduce((s, x) => s + Math.max(0, num(x.derivedProfit)), 0);
        const losses = sells.reduce((s, x) => s + Math.min(0, num(x.derivedProfit)), 0);
        const project = deliveryExpenses.filter((e) => num(e.timestamp) >= from && num(e.timestamp) <= now).reduce((s, e) => s + num((e as { amountDzd?: unknown }).amountDzd ?? e.amount), 0);
        const writeOffs = debtWriteOffs.filter((w) => w.timestamp >= from && w.timestamp <= now).reduce((s, w) => s + w.amountDzd, 0);
        const econ = deriveInvestorEconomics({ ...base, periodStartTs: from, periodEndTs: now } as never);
        const breakdown = getManagerProfitBreakdown(econ, feePct);
        const others = econ.derivedInvestors.filter((i) => !i.isManager).reduce((s, i) => s + num(i.totalProfit), 0);
        const net = num(econ.totals.netDistributableProfit);
        const rule = declaredShare === null ? null : net * fee + net * (1 - fee) * declaredShare;
        out(`| ${label} (dès ${day(from)}) | ${fmt(gains)} | ${fmt(losses)} | ${fmt(project)} | ${fmt(writeOffs)} | ${fmt(net)} | ${fmt(breakdown.ideaShareProfit)} | ${fmt(breakdown.personalCapitalProfit)} | ${fmt(others)} | ${fmt(breakdown.ownerTotalProfit)} | ${rule === null ? '—' : fmt(rule)} | ${rule === null ? '—' : fmt(breakdown.ownerTotalProfit - rule)} |`);
    }
    out();
    out(`« Gérant total » = ce que la carte « Mon profit réel » montre pour les ventes USDT/EUR (sans les services numériques), AVANT les dépenses personnelles.`);
    out();

    // 3. What lowered the month: every deduction before the split, line by line.
    const monthFrom = starts.month;
    out(`## 3. Ce qui a réduit le mois (avant le partage)`);
    const lossSells = pamLedger.sellProfitRows.filter((s) => s.timestamp >= monthFrom && s.timestamp <= now && num(s.derivedProfit) < 0);
    for (const s of lossSells) out(`- Vente à perte ${day(s.timestamp)} · ${fmt(num(s.quantity))} ${s.currency} · ${fmt(num(s.derivedProfit))} DZD (id ${s.txId})`);
    for (const e of deliveryExpenses.filter((x) => num(x.timestamp) >= monthFrom && num(x.timestamp) <= now)) out(`- Frais du projet ${day(num(e.timestamp))} · ${fmt(num((e as { amountDzd?: unknown }).amountDzd ?? e.amount))} DZD · « ${String((e as { notes?: unknown }).notes ?? (e as { payee?: unknown }).payee ?? '')} » (id ${e.id})`);
    for (const w of debtWriteOffs.filter((x) => x.timestamp >= monthFrom && x.timestamp <= now)) out(`- Dette annulée ${day(w.timestamp)} · ${fmt(w.amountDzd)} DZD (client ${w.clientId})`);
    if (!lossSells.length && !deliveryExpenses.some((x) => num(x.timestamp) >= monthFrom)) out(`- Aucune déduction avant le partage ce mois.`);
    out();

    // 4. Personal expenses of the month: never in the profit; how each was funded.
    out(`## 4. Dépenses personnelles du mois (hors bénéfice, déduites du disponible)`);
    for (const e of personalExpenses.filter((x) => num(x.timestamp) >= monthFrom && num(x.timestamp) <= now)) {
        const state = (e as { advanceState?: unknown }).advanceState;
        const fromCapital = investorTxs.filter((t) => t.type === 'withdraw_capital' && t.linkedTreasuryTxId === e.id).reduce((s, t) => s + num(t.amount), 0);
        out(`- ${day(num(e.timestamp))} · ${fmt(num(e.amount))} DZD${state === 'pending' ? ' · avance en attente (pas encore comptée)' : ''}${fromCapital > 0 ? ` · dont ${fmt(fromCapital)} pris sur le capital (réduit le poids du gérant dans les partages suivants)` : ''} · « ${String((e as { notes?: unknown }).notes ?? '')} »`);
    }
    out();

    // 5. Possible double charge: a loss sale and a personal expense of about the same amount within 10 days.
    out(`## 5. Perte payée deux fois ? (vente à perte + dépense personnelle du même montant)`);
    let suspects = 0;
    for (const s of pamLedger.sellProfitRows.filter((x) => num(x.derivedProfit) < 0)) {
        const loss = -num(s.derivedProfit);
        for (const e of personalExpenses) {
            const amt = num(e.amount);
            if (Math.abs(num(e.timestamp) - s.timestamp) <= 10 * DAY && Math.abs(amt - loss) <= Math.max(500, loss * 0.1)) {
                suspects++;
                out(`- Perte ${fmt(-loss)} le ${day(s.timestamp)} (vente ${s.txId}) et dépense personnelle ${fmt(amt)} le ${day(num(e.timestamp))} (id ${e.id}): la perte est déjà partagée par capital ET payée en entier par le gérant.`);
            }
        }
    }
    if (!suspects) out(`- Aucun cas trouvé.`);
    out();

    // 6. Investors: capital, share, month, cumulated, withdrawn, available.
    const monthEcon = deriveInvestorEconomics({ ...base, periodStartTs: monthFrom, periodEndTs: now } as never);
    out(`## 6. Investisseurs`);
    out(`| Investisseur | Capital | Part | Bénéfice du mois | Bénéfice cumulé | Retiré / dépensé | Disponible |`);
    out(`|---|---|---|---|---|---|---|`);
    for (const inv of full.derivedInvestors) {
        const month = num(monthEcon.derivedInvestors.find((m) => m.id === inv.id)?.totalProfit);
        out(`| ${inv.isManager ? '⭐ ' : ''}${inv.name || inv.id} | ${fmt(num(inv.capitalInvested))} | ${(num(inv.sharePercentage) * 100).toFixed(2)} % | ${fmt(month)} | ${fmt(num(inv.totalProfit))} | ${fmt(num(inv.withdrawnProfit))} | ${fmt(num(inv.availableProfit))} |`);
    }
    const sum = full.derivedInvestors.reduce((s, i) => s + num(i.totalProfit), 0);
    out();
    out(`Contrôle: somme des bénéfices des investisseurs ${fmt(sum)} = net à partager ${fmt(num(full.totals.netDistributableProfit))} (écart ${r2(sum - num(full.totals.netDistributableProfit))}).`);
    if (manager) out(`Gérant: ${manager.name || manager.id}.`);
    return { text: lines.join('\n') };
}
