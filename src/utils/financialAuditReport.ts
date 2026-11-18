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
const day = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const when = (ts: number) => { const d = new Date(ts); return `${day(ts)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

const orphanRowsNote = (clients: number, zero: boolean) => (clients ? ` · ${clients} client(s) supprimé(s), net ${zero ? 'nul' : 'non nul'}` : '');

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
    out();

    // 7. Capital movements, line by line, to match against the owner's own records.
    out(`## 7. Mouvements de capital (à comparer avec vos documents)`);
    const ordered = [...full.derivedInvestors].sort((a, b) => Number(Boolean(b.isManager)) - Number(Boolean(a.isManager)));
    for (const inv of ordered) {
        const txs = investorTxs.filter((t) => t.investorId === inv.id).sort((a, b) => num(a.timestamp) - num(b.timestamp));
        const rec = buildInvestorCapitalReconciliation(inv as Investor, txs, personalExpenses);
        const opening = new Set(rec.deposits.filter((d) => d.classification === 'initial').map((d) => d.id));
        out();
        out(`### ${inv.isManager ? '⭐ ' : ''}${inv.name || inv.id}`);
        out(`| Date | Type | Montant | Compte | Capital affiché après | Note |`);
        out(`|---|---|---|---|---|---|`);
        let running = rec.deposits.some((d) => d.classification === 'initial') ? 0 : rec.openingCapital;
        if (running) out(`| — | Capital initial déclaré (sans opération) | ${fmt(running)} | — | ${fmt(running)} | |`);
        for (const t of txs) {
            const amount = num(t.amount);
            let label: string;
            let delta = 0;
            if (t.type === 'deposit_capital') { label = opening.has(t.id) ? 'Capital initial' : 'Apport de capital'; delta = amount; }
            else if (t.type === 'reinvest_profit') { label = 'Bénéfice réinvesti'; delta = amount; }
            else if (t.type === 'withdraw_capital') {
                const personal = isPersonalExpenseCapitalWithdrawal(t, personalExpenses);
                label = personal ? 'Retrait de capital pour dépense perso (non déduit du capital affiché, déduit du poids)' : 'Retrait de capital';
                delta = personal ? 0 : -amount;
            } else continue;
            running += delta;
            out(`| ${when(num(t.timestamp))} | ${label} | ${fmt(delta || -amount)} | ${t.paymentSource ?? '—'} | ${fmt(running)} | ${String(t.notes ?? '').replace(/\|/g, '/')} |`);
        }
        out(`Total: initial ${fmt(rec.openingCapital)} + apports ${fmt(rec.realCapitalAdditions)} + réinvesti ${fmt(rec.reinvestments)} − retraits ${fmt(rec.realCapitalWithdrawals)} = ${fmt(rec.currentCapital)}.`);
        if (inv.isManager && options.declaredOwnerCapital) out(`Écart avec le capital déclaré (${fmt(options.declaredOwnerCapital)}): ${fmt(options.declaredOwnerCapital - rec.currentCapital)}.`);
    }

    // 8. Integrity checks: rules that must always hold. Each says OK or lists the lines that break it.
    out();
    out(`## 8. Contrôles d'intégrité`);
    const usdtTxs = transactions as unknown as Doc[];
    const treasuryDocs = treasury as unknown as Doc[];
    const clientDocs = clientTxs as unknown as Doc[];
    const clientIds = new Set(rows(backup, 'dzd_clients').map((c) => c.id));
    const usdtIds = new Set(usdtTxs.map((t) => t.id));
    const treasuryIds = new Set(treasuryDocs.map((t) => t.id));
    const clientTxIds = new Set(clientDocs.map((t) => t.id));
    const investorTxIds = new Set(investorTxs.map((t) => t.id));
    // ❌ = a proven break of a rule; ⚠️ = something to follow up or explain, not an error by itself.
    const check = (title: string, problems: string[], okText = 'OK', mark = '❌') => {
        out();
        out(`### ${problems.length ? mark : '✅'} ${title}${problems.length ? ` (${problems.length})` : ''}`);
        if (!problems.length) { out(okText); return; }
        for (const p of problems.slice(0, 15)) out(`- ${p}`);
        if (problems.length > 15) out(`- … et ${problems.length - 15} autres`);
    };
    const tsOf = (d: Doc) => num(d.timestamp);

    // 8.1 Cash: replay every dinar movement in time order; a wallet never goes below zero; no movement ignored.
    const walletOf = (raw: unknown): string | null => {
        if (typeof raw !== 'string' || !raw) return null;
        const n = raw.toLowerCase();
        if (n.includes('caisse')) return 'Caisse';
        if (n.includes('baridi')) return 'BaridiMob';
        if (raw.startsWith('acc_')) return raw;
        return null;
    };
    const balances: Record<string, number> = {};
    const negatives: string[] = [];
    const ignored: string[] = [];
    const negativeSeen = new Set<string>();
    // An expense paid in a currency (USDT, EUR, …) moves no dinar: its stock row carries it.
    const stockRowOf = new Map<string, Doc>();
    for (const t of usdtTxs) for (const f of ['linkedPersonalExpenseTxId', 'linkedProjectExpenseTxId']) if (typeof t[f] === 'string') stockRowOf.set(String(t[f]), t);
    const paidInCurrency: string[] = [];
    const missingStockRow: string[] = [];
    for (const t of [...treasuryDocs].sort((a, b) => tsOf(a) - tsOf(b))) {
        const amount = num(t.amount);
        const type = String(t.type ?? '');
        if (!(amount > 0)) { ignored.push(`${when(tsOf(t))} · ${type} · montant ${String(t.amount)} (id ${t.id})`); continue; }
        const moves: Array<[string, number]> = [];
        if (type === 'Transfer') {
            const legacy = /from\s+(.+?)\s+to\s+(.+)/i.exec(String(t.asset ?? ''));
            const from = walletOf(t.source) ?? (legacy ? walletOf(legacy[1]) : null);
            const to = walletOf(t.destination) ?? (legacy ? walletOf(legacy[2]) : null);
            if (!from || !to || from === to) { ignored.push(`${when(tsOf(t))} · virement sans compte clair (id ${t.id})`); continue; }
            moves.push([from, -amount], [to, amount]);
        } else {
            const factor = type === 'Ajout' || type === 'Adjustment (+)' ? 1 : type === 'Retrait' || type === 'Adjustment (-)' ? -1 : 0;
            const wallet = walletOf(t.source) ?? (t.asset === 'DZD-Caisse' ? 'Caisse' : t.asset === 'DZD-Baridi' ? 'BaridiMob' : null);
            const currencyWallet = typeof t.expenseWallet === 'string' && !walletOf(t.expenseWallet) ? t.expenseWallet : null;
            if (!wallet && (stockRowOf.has(t.id) || currencyWallet)) {
                const stock = stockRowOf.get(t.id);
                if (stock) paidInCurrency.push(`${when(tsOf(t))} · ${r2(num(stock.quantity))} ${String(stock.currency ?? currencyWallet ?? 'USDT')} (${fmt(amount)} DZD) · ${String(t.origin ?? '')} (id ${t.id})`);
                else missingStockRow.push(`${when(tsOf(t))} · ${fmt(amount)} DZD payé en ${currencyWallet} sans ligne de stock (id ${t.id})`);
                continue;
            }
            if (!factor || !wallet) { ignored.push(`${when(tsOf(t))} · ${type} ${fmt(amount)} · compte « ${String(t.source ?? t.asset ?? '')} » non reconnu (id ${t.id})`); continue; }
            moves.push([wallet, factor * amount]);
        }
        for (const [w, delta] of moves) {
            balances[w] = r2((balances[w] || 0) + delta);
            if (balances[w] < -0.5 && !negativeSeen.has(w)) {
                negativeSeen.add(w);
                negatives.push(`${w} passe à ${fmt(balances[w])} le ${when(tsOf(t))} (id ${t.id}) — première fois`);
            }
        }
    }
    out();
    out(`Soldes recalculés: ${Object.entries(balances).map(([w, b]) => `${w} ${fmt(b)}`).join(' · ') || 'aucun'}`);
    check('Trésorerie: aucun compte en dessous de zéro (historique depuis un solde de départ 0)', negatives, 'OK', '⚠️');
    check('Trésorerie: aucun mouvement ignoré par le calcul', ignored);
    check('Dépenses payées en devise: chacune a sa sortie de stock', missingStockRow);
    if (paidInCurrency.length) {
        out();
        out(`Dépenses payées en devise (aucun dinar ne bouge, la sortie est dans le stock) (${paidInCurrency.length}):`);
        for (const p of paidInCurrency) out(`- ${p}`);
    }

    // 8.2 Stock: never negative, every sale costed.
    const below = pamLedger.operationRows.filter((row) => num(row.statsAfter.available) < -0.005)
        .map((row) => ({ row, v: r2(num(row.statsAfter.available)) }));
    const line = ({ row, v }: { row: typeof pamLedger.operationRows[number]; v: number }) => `${row.currency} à ${v} après l'opération du ${when(row.timestamp)} (id ${row.txId})`;
    check('Stock: aucune devise en dessous de zéro', below.filter((b) => b.v <= -0.1).map(line));
    check('Stock: écarts d’arrondi (moins de 0.1 unité)', below.filter((b) => b.v > -0.1).map(line), 'OK', '⚠️');
    const byTx = new Map<string, Set<string>>();
    for (const w of pamLedger.warnings) byTx.set(w.txId, (byTx.get(w.txId) || new Set()).add(w.code));
    // A sale with units not backed by a recorded purchase (pamLedger.purchasedQty). The engine still costs EVERY unit
    // at the average price before the sale (soldCostDzd = average × quantity), so the profit is not inflated; only a
    // sale with no average at all (cost 0) is an error.
    const uncostedRows = [...byTx].filter(([, c]) => c.has('oversell') || c.has('uncosted_quantity_sold') || c.has('missing_buy_total')).map(([id, c]) => {
        const sale = pamLedger.profitByTxId[id];
        if (!sale) return { zeroCost: true, text: `${[...c].join(' + ')} (id ${id})` };
        const units = num(sale.quantityWithoutCostBasis);
        const avg = num(sale.statsBefore.avgBuy);
        return {
            zeroCost: avg <= 0,
            text: `${when(sale.timestamp)} · vente ${r2(num(sale.quantity))} ${sale.currency}, stock avant ${r2(num(sale.statsBefore.available))} · ${r2(units)} ${sale.currency} sans achat enregistré, comptés au prix moyen ${r2(avg)} (≈ ${fmt(units * avg)} DZD) → bénéfice ${fmt(num(sale.derivedProfit))} DZD · ${[...c].join(' + ')} (id ${id})`,
        };
    });
    check('Stock: chaque vente a un coût d’achat (coût nul)', uncostedRows.filter((u) => u.zeroCost).map((u) => u.text));
    check('Stock: unités vendues sans achat enregistré, comptées au prix moyen', uncostedRows.filter((u) => !u.zeroCost).map((u) => u.text), 'OK', '⚠️');
    // Old profits saved inside the operations: the split, the dashboard and the reports recompute them; listed as a count.
    const storedRows = pamLedger.sellProfitRows.filter((r) => byTx.get(r.txId)?.has('stored_mismatch'));
    const storedGap = storedRows.reduce((sum, r) => sum + num(r.storedProfit) - num(r.derivedProfit), 0);
    const biggest = [...storedRows].sort((a, b) => Math.abs(num(b.storedProfit) - num(b.derivedProfit)) - Math.abs(num(a.storedProfit) - num(a.derivedProfit))).slice(0, 5);
    out();
    out(`### ${storedRows.length ? '⚠️' : '✅'} Bénéfices anciens enregistrés ≠ recalculés (${storedRows.length})`);
    out(storedRows.length
        ? `Le partage des bénéfices utilise le bénéfice recalculé (règle 7), pas celui enregistré. Somme des écarts enregistré − recalculé: ${fmt(storedGap)} DZD. Les 5 plus grands:`
        : 'OK');
    for (const r of biggest) out(`- ${when(r.timestamp)} · enregistré ${fmt(num(r.storedProfit))} · recalculé ${fmt(num(r.derivedProfit))} (id ${r.txId})`);
    out();
    out(`Stock recalculé: ${Object.entries(pamLedger.holdings).map(([c, h]) => `${c} ${r2(num(h.available))} (PAM ${r2(num(h.avgBuy))})`).join(' · ')}`);

    // 8.3 Clients: every line belongs to a client; balances.
    const orphanClientRows = clientDocs.filter((t) => !clientIds.has(String(t.clientId))).map((t) => `${when(tsOf(t))} · ${fmt(num(t.montant))} · client ${String(t.clientId)} introuvable (id ${t.id})`);
    const orphanNet = new Map<string, number>();
    for (const t of clientDocs) if (!clientIds.has(String(t.clientId))) orphanNet.set(String(t.clientId), r2((orphanNet.get(String(t.clientId)) || 0) + num(t.montant)));
    const orphanZero = [...orphanNet.values()].every((v) => Math.abs(v) < 0.5);
    check(`Clients: chaque ligne appartient à un client existant${orphanRowsNote(orphanNet.size, orphanZero)}`, orphanClientRows, 'OK', orphanZero ? '⚠️' : '❌');
    let debts = 0, advances = 0;
    const byClient = new Map<string, number>();
    for (const t of clientDocs) if (t.affectsBalance !== false) byClient.set(String(t.clientId), r2((byClient.get(String(t.clientId)) || 0) + num(t.montant)));
    for (const b of byClient.values()) { if (b < 0) debts += b; else advances += b; }
    out();
    out(`Clients: dettes ${fmt(debts)} · avances ${fmt(advances)} · net ${fmt(debts + advances)}.`);

    // 8.4 Links: a link points to a document that exists.
    const anyId = new Set([...usdtIds, ...treasuryIds, ...clientTxIds, ...investorTxIds]);
    const broken: string[] = [];
    const need = (from: string, d: Doc, field: string, pool: Set<string>, poolName: string) => {
        const v = d[field];
        if (typeof v === 'string' && v && !pool.has(v)) broken.push(`${from} ${d.id} · ${field} → ${poolName} ${v} absent`);
    };
    for (const t of usdtTxs) { need('opération', t, 'linkedTreasuryTxId', treasuryIds, 'trésorerie'); need('opération', t, 'linkedClientTxId', clientTxIds, 'ligne client'); need('opération', t, 'linkedClientDzdId', clientIds, 'client'); }
    for (const t of treasuryDocs) { need('trésorerie', t, 'linkedTxId', anyId, 'ligne'); need('trésorerie', t, 'linkedInvestorTxId', investorTxIds, 'mouvement investisseur'); need('trésorerie', t, 'linkedCapitalInvestorTxId', investorTxIds, 'mouvement investisseur'); }
    for (const t of clientDocs) { need('ligne client', t, 'linkedTxId', anyId, 'ligne'); need('ligne client', t, 'linkedTreasuryTxId', treasuryIds, 'trésorerie'); }
    for (const t of investorTxs as unknown as Doc[]) need('mouvement investisseur', t, 'linkedTreasuryTxId', treasuryIds, 'trésorerie');
    check('Liens: aucune ligne ne pointe vers une ligne supprimée', broken);

    // 8.5 Distribution: for every month, the investors' profits add up to the net exactly.
    const distProblems: string[] = [];
    // From the first month with a sale or a project expense.
    const first = Math.min(...pamLedger.sellProfitRows.map((r) => r.timestamp), ...deliveryExpenses.map((e) => num(e.timestamp)).filter((t) => t > 0), now);
    for (let d = new Date(new Date(first).getFullYear(), new Date(first).getMonth(), 1); d.getTime() <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        const from = d.getTime();
        const to = Math.min(now, new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - 1);
        const econ = deriveInvestorEconomics({ ...base, periodStartTs: from, periodEndTs: to } as never);
        const sumInv = econ.derivedInvestors.reduce((s, i) => s + num(i.totalProfit), 0);
        const gap = r2(sumInv - num(econ.totals.netDistributableProfit));
        if (Math.abs(gap) > 0.01) distProblems.push(`${day(from).slice(0, 7)}: investisseurs ${fmt(sumInv)} ≠ net ${fmt(num(econ.totals.netDistributableProfit))} (écart ${gap})`);
    }
    check('Partage: chaque mois, la somme des parts = le net à partager', distProblems);

    // 8.6 Things waiting for a decision.
    const pending = personalExpenses.filter((e) => (e as { advanceState?: unknown }).advanceState === 'pending')
        .map((e) => `${when(num(e.timestamp))} · ${fmt(num(e.amount))} DZD · avance personnelle en attente (comptée comme argent que le gérant doit au projet)`);
    check('Avances personnelles à régler (suivi, pas une erreur)', pending, 'Aucune avance en attente.', '⚠️');
    return { text: lines.join('\n') };
}
