import type { ClientDzd, ClientTransactionDzd, Investor, InvestorTransaction, Tx, TreasuryTx } from '../types';
import type { PamLedgerResult } from './pamLedger';
import { getClientOperationLabel, getPortfolioOperationLabel } from './transactionTerminology';
type PortfolioSnapshot = {
    usdt: {
        available: number;
        avgBuy: number;
        totalProfit: number;
    };
    eur: {
        available: number;
        avgBuy: number;
        totalProfit: number;
    };
};
type ClientNameResolver = (client: ClientDzd) => string;
type ReportPayload = {
    fileName: string;
    html: string;
};
type MonthlyClientRank = {
    clientId: string;
    clientName: string;
    buyVolumeUsdt: number;
    sellVolumeUsdt: number;
    totalVolumeUsdt: number;
    realizedProfit: number;
    txCount: number;
};
type MonthlyReportInput = {
    month: number;
    year: number;
    monthLabel: string;
    transactions: Tx[];
    clientTransactions: ClientTransactionDzd[];
    clients: ClientDzd[];
    getClientName: ClientNameResolver;
    portfolioStats: PortfolioSnapshot;
    pamLedger?: PamLedgerResult;
    profitByTxId?: PamLedgerResult['profitByTxId'];
};
type ClientReportInput = {
    clientId: string;
    month: number;
    year: number;
    monthLabel: string;
    clients: ClientDzd[];
    clientTransactions: ClientTransactionDzd[];
    transactions: Tx[];
    clientBalance: number;
    getClientName: ClientNameResolver;
};
type InvestorReportInput = {
    investor: Investor;
    investorTransactions: InvestorTransaction[];
    reportStartTs?: number | null;
    reportEndTs?: number | null;
};
type PersonalExpensesReportInput = {
    expenses: TreasuryTx[]; // settled or direct (excludes pending advances and returns)
    periodLabel: string; // e.g., "Octobre 2025"
    periodKey: 'day' | 'week' | 'month' | 'year';
    periodStart: number;
    periodEnd: number;
    previousPeriodTotal: number;
    managerProfitAvailable: number;
};
const FR_LOCALE = 'fr-FR';
const REPORT_FALLBACK_COLORS = {
    // System-color fallbacks keep tokens.css as the only app color source.
    appBg: 'Canvas',
    surface: 'Canvas',
    surfaceMuted: 'ButtonFace',
    ink: 'CanvasText',
    muted: 'GrayText',
    line: 'ButtonBorder',
    lineStrong: 'GrayText',
    brand: 'Highlight',
    brandSoft: 'ButtonFace',
    brandDark: 'Highlight',
    good: 'CanvasText',
    bad: 'CanvasText',
    warning: 'CanvasText',
};
function readReportToken(tokenName: string, fallback: string): string {
    if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
        return fallback;
    }
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
    return value || fallback;
}
function buildReportThemeCss(): string {
    return `
      --bg: ${readReportToken('--color-app-bg', REPORT_FALLBACK_COLORS.appBg)};
      --surface: ${readReportToken('--color-surface', REPORT_FALLBACK_COLORS.surface)};
      --surface-muted: ${readReportToken('--color-surface-muted', REPORT_FALLBACK_COLORS.surfaceMuted)};
      --ink: ${readReportToken('--color-neutral-900', REPORT_FALLBACK_COLORS.ink)};
      --muted: ${readReportToken('--color-neutral-600', REPORT_FALLBACK_COLORS.muted)};
      --line: ${readReportToken('--color-border', REPORT_FALLBACK_COLORS.line)};
      --line-strong: ${readReportToken('--color-border-strong', REPORT_FALLBACK_COLORS.lineStrong)};
      --brand: ${readReportToken('--color-primary', REPORT_FALLBACK_COLORS.brand)};
      --brand-soft: ${readReportToken('--color-info-bg', REPORT_FALLBACK_COLORS.brandSoft)};
      --brand-dark: ${readReportToken('--color-primary-dark', REPORT_FALLBACK_COLORS.brandDark)};
      --good: ${readReportToken('--color-financial-profit', REPORT_FALLBACK_COLORS.good)};
      --bad: ${readReportToken('--color-financial-loss', REPORT_FALLBACK_COLORS.bad)};
      --warning: ${readReportToken('--color-warning', REPORT_FALLBACK_COLORS.warning)};
    `;
}
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function formatNumber(value: number, min = 2, max = min): string {
    const safe = Number.isFinite(value) ? value : 0;
    return safe.toLocaleString(FR_LOCALE, {
        minimumFractionDigits: min,
        maximumFractionDigits: max
    });
}
// FIX-10: USDT/EUR quantities show conditional decimals — "100" or "100,50".
function formatAssetQuantity(value: number): string {
    return formatNumber(value, 0, 2);
}
function formatDateTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString(FR_LOCALE, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(FR_LOCALE);
}
function sanitizeFileName(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_\-]/g, '')
        .replace(/_+/g, '_');
}
function formatReportPeriod(startTs?: number | null, endTs?: number | null): string {
    if (startTs != null && endTs != null)
        return `Du ${formatDate(startTs)} au ${formatDate(endTs)}`;
    if (startTs != null)
        return `Depuis le ${formatDate(startTs)}`;
    if (endTs != null)
        return `Jusqu'au ${formatDate(endTs)}`;
    return "Tout l'historique";
}
function dateStamp(timestamp?: number | null): string {
    if (timestamp == null)
        return '';
    const date = new Date(timestamp);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
}
function reportShell(opts: {
    fileName: string;
    title: string;
    subtitle: string;
    bodyHtml: string;
    pageSize?: 'A4' | 'A4 landscape';
}): ReportPayload {
    const generatedAt = new Date().toLocaleString(FR_LOCALE, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.fileName.replace('.pdf', ''))}</title>
  <style>
    :root {
      ${buildReportThemeCss()}
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: "Segoe UI", Tahoma, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.45;
      padding: 20px;
    }
    .report {
      max-width: 980px;
      margin: 0 auto;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
    }
    .toolbar {
      max-width: 980px;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: flex-end;
    }
    .toolbar button {
      border: 0;
      border-radius: 10px;
      background: var(--brand);
      color: var(--surface);
      font-weight: 700;
      padding: 10px 14px;
      cursor: pointer;
      font-size: 13px;
    }
    .toolbar button:active {
      transform: translateY(1px);
    }
    .header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--line);
      background: var(--brand-soft);
    }
    .title {
      margin: 0;
      font-size: 26px;
      line-height: 1.2;
      letter-spacing: 0.2px;
    }
    .subtitle {
      margin-top: 6px;
      color: var(--muted);
      font-size: 14px;
    }
    .meta {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .body {
      padding: 20px 24px 24px;
    }
    .section {
      margin-top: 18px;
    }
    .section:first-child {
      margin-top: 0;
    }
    .section-title {
      margin: 0 0 10px 0;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--brand-dark);
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      background: var(--surface);
    }
    .card .label {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 4px;
    }
    .card .value {
      font-size: 20px;
      font-weight: 700;
      color: var(--ink);
    }
    .report-kicker {
      margin-bottom: 10px;
      color: var(--muted);
      font-size: 12px;
    }
    .executive-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .executive-card {
      border: 1px solid var(--line);
      border-left: 3px solid var(--line-strong);
      border-radius: 10px;
      padding: 10px 12px;
      background: var(--surface);
      min-height: 72px;
    }
    .executive-card.primary {
      border-left-color: var(--brand);
      background: var(--brand-soft);
    }
    .executive-card.profit {
      border-left-color: var(--good);
    }
    .executive-card.loss {
      border-left-color: var(--bad);
    }
    .executive-card .label,
    .movement-card .label {
      font-size: 10px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.55px;
      margin-bottom: 4px;
    }
    .executive-card .value {
      font-size: 18px;
      font-weight: 800;
      color: var(--ink);
      line-height: 1.2;
    }
    .movement-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .movement-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 10px;
      background: var(--surface);
    }
    .movement-card .value {
      font-size: 14px;
      font-weight: 700;
      color: var(--ink);
      line-height: 1.25;
    }
    .compact-empty {
      border: 1px dashed var(--line);
      border-radius: 8px;
      color: var(--muted);
      padding: 10px 12px;
      background: var(--brand-soft);
    }
    .compact-note {
      margin-top: 10px;
      color: var(--muted);
      font-size: 12px;
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }
    .value.good { color: var(--good); }
    .value.bad { color: var(--bad); }
    .table-wrap {
      border: 1px solid var(--line);
      border-radius: 10px;
      overflow-x: auto;
      overflow-y: visible;
      -webkit-overflow-scrolling: touch;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    th {
      background: var(--surface-muted);
      color: var(--ink);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .num { text-align: right; white-space: nowrap; }
    .num,
    .good,
    .bad {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .good { color: var(--good); font-weight: 700; }
    .bad { color: var(--bad); font-weight: 700; }
    .muted { color: var(--muted); }
    .empty {
      border: 1px dashed var(--line);
      border-radius: 10px;
      color: var(--muted);
      padding: 16px;
      text-align: center;
      background: var(--brand-soft);
    }
    .pill {
      display: inline-block;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 11px;
      border: 1px solid var(--line);
      color: var(--muted);
      margin-right: 6px;
      margin-bottom: 6px;
      background: var(--surface);
    }
    .pill-row {
      margin-bottom: 8px;
    }
    .pill-row.loose {
      margin-bottom: 10px;
    }
    .pill-row.top {
      margin-top: 10px;
    }
    .pill.small {
      font-size: 10px;
    }
    .pill.emphasis {
      font-size: 13px;
    }
    .muted-note {
      margin-top: 8px;
    }
    .section.compact-offset {
      margin-top: 16px;
    }
    .final-summary {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 24px;
    }
    .final-total-label {
      font-size: 12px;
      color: var(--muted);
    }
    .final-total-value {
      font-size: 20px;
      font-weight: 700;
      color: var(--bad);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .signature-box {
      min-width: 200px;
      border-top: 1px solid var(--line);
      padding-top: 8px;
      color: var(--muted);
      font-size: 12px;
      text-align: center;
    }
    .footer {
      margin-top: 18px;
      color: var(--muted);
      font-size: 11px;
      border-top: 1px solid var(--line);
      padding-top: 10px;
    }
    @media (max-width: 900px) {
      body {
        padding: 10px;
        font-size: 12px;
      }
      .toolbar,
      .report {
        max-width: 100%;
      }
      .header {
        padding: 14px;
      }
      .title {
        font-size: 22px;
      }
      .body {
        padding: 12px;
      }
      .cards {
        grid-template-columns: 1fr;
      }
      .executive-grid,
      .movement-grid {
        grid-template-columns: 1fr;
      }
      th, td {
        font-size: 11px;
        padding: 6px 7px;
      }
      .table-wrap table {
        min-width: 760px;
      }
    }
    @page {
      size: ${opts.pageSize || 'A4'};
      margin: 12mm;
    }
    @media print {
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        background: var(--surface);
        padding: 0;
        font-size: 12px;
      }
      .report {
        max-width: none;
        border: none;
        border-radius: 0;
        overflow: visible;
      }
      .header {
        background: var(--surface) !important;
        border-bottom: 1px solid var(--line-strong);
      }
      .toolbar {
        display: none !important;
      }
      .table-wrap {
        overflow: visible !important;
      }
      .table-wrap table {
        width: 100% !important;
        min-width: 0 !important;
        table-layout: fixed;
      }
      .table-wrap th,
      .table-wrap td {
        font-size: 10px;
        padding: 5px 6px;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      .table-wrap .num {
        white-space: normal;
      }
      .executive-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }
      .movement-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }
      .executive-card {
        min-height: 64px;
        padding: 8px 9px;
      }
      .executive-card .value {
        font-size: 15px;
      }
      .movement-card .value {
        font-size: 12px;
      }
      tr, td, th {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">Enregistrer PDF</button>
  </div>
  <article class="report">
    <header class="header">
      <h1 class="title">${escapeHtml(opts.title)}</h1>
      <div class="subtitle">${escapeHtml(opts.subtitle)}</div>
      <div class="meta">Genere le ${escapeHtml(generatedAt)}</div>
    </header>
    <main class="body">
      ${opts.bodyHtml}
      <div class="footer">
        Document genere automatiquement par l'application. Format recommande: Impression &gt; Save as PDF.
      </div>
    </main>
  </article>
</body>
</html>`;
    return { fileName: opts.fileName, html };
}
function buildLinkedClientMap(clientTransactions: ClientTransactionDzd[]) {
    const map = new Map<string, {
        clientId: string;
        timestamp: number;
        isSecondary: boolean;
    }>();
    for (const row of clientTransactions) {
        if (!row.linkedTxId || !row.clientId)
            continue;
        const isSecondary = row.linkRole === 'dzd_receiver';
        const existing = map.get(row.linkedTxId);
        if (!existing) {
            map.set(row.linkedTxId, { clientId: row.clientId, timestamp: row.timestamp, isSecondary });
            continue;
        }
        if (existing.isSecondary && !isSecondary) {
            map.set(row.linkedTxId, { clientId: row.clientId, timestamp: row.timestamp, isSecondary });
            continue;
        }
        if (existing.isSecondary === isSecondary && row.timestamp > existing.timestamp) {
            map.set(row.linkedTxId, { clientId: row.clientId, timestamp: row.timestamp, isSecondary });
        }
    }
    return map;
}
function getMonthlyProfitByTxId(input: MonthlyReportInput): PamLedgerResult['profitByTxId'] | undefined {
    return input.profitByTxId || input.pamLedger?.profitByTxId;
}
function getRealizedProfit(tx: Tx, profitByTxId?: PamLedgerResult['profitByTxId']): number {
    if (tx.type !== 'sell')
        return 0;
    const derivedProfit = tx.id ? profitByTxId?.[tx.id]?.derivedProfit : undefined;
    return Number(derivedProfit ?? 0);
}
function buildUncostedQuantityWarningsHtml(rows: PamLedgerResult['sellProfitRows']): string {
    const uncostedRows = rows.filter((row) => row.flags.uncostedQuantitySold && row.quantityWithoutCostBasis > 0);
    if (uncostedRows.length === 0)
        return '';
    const quantityWithoutCostBasis = uncostedRows.reduce((sum, row) => sum + row.quantityWithoutCostBasis, 0);
    const previewRows = uncostedRows.slice(0, 8);
    const hiddenCount = uncostedRows.length - previewRows.length;
    return `
    <section class="section">
      <h2 class="section-title">Alertes Comptables PAM</h2>
      <div class="pill-row loose">
        <span class="pill">uncostedQuantitySold: ${uncostedRows.length}</span>
        <span class="pill">Quantité sans coût: ${formatAssetQuantity(quantityWithoutCostBasis)} ${escapeHtml(uncostedRows[0]?.currency || 'USDT')}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Transaction</th>
              <th>Devise</th>
              <th class="num">Quantité vendue</th>
              <th class="num">Sans cout</th>
              <th class="num">Profit derive</th>
            </tr>
          </thead>
          <tbody>
            ${previewRows
        .map((row) => `
                <tr>
                  <td>${escapeHtml(formatDateTime(row.timestamp))}</td>
                  <td>${escapeHtml(row.txId)}</td>
                  <td>${escapeHtml(row.currency)}</td>
                  <td class="num">${formatAssetQuantity(row.quantity)}</td>
                  <td class="num bad">${formatAssetQuantity(row.quantityWithoutCostBasis)}</td>
                  <td class="num ${row.derivedProfit >= 0 ? 'good' : 'bad'}">${row.derivedProfit >= 0 ? '+' : ''}${formatNumber(row.derivedProfit)} DZD</td>
                </tr>`)
        .join('')}
          </tbody>
        </table>
      </div>
      ${hiddenCount > 0 ? `<div class="muted muted-note">${hiddenCount} autre(s) transaction(s) masquee(s) dans cette synthese.</div>` : ''}
      <div class="muted muted-note">
        Alerte informative uniquement: ces montants ne sont pas retires du profit realise.
      </div>
    </section>
  `;
}
export function buildMonthlyPdfReport(input: MonthlyReportInput): ReportPayload {
    const startTs = new Date(input.year, input.month, 1).getTime();
    const endTs = new Date(input.year, input.month + 1, 0, 23, 59, 59, 999).getTime();
    const periodTxs = input.transactions.filter((tx) => tx.timestamp >= startTs && tx.timestamp <= endTs);
    const profitByTxId = getMonthlyProfitByTxId(input);
    const periodSellProfitRows = input.pamLedger?.sellProfitRows.filter((row) => row.timestamp >= startTs && row.timestamp <= endTs) || [];
    const uncostedWarningsHtml = buildUncostedQuantityWarningsHtml(periodSellProfitRows);
    const globalNetProfit = Number(input.portfolioStats.usdt.totalProfit || 0) + Number(input.portfolioStats.eur.totalProfit || 0);
    let volUsdtBought = 0;
    let volUsdtSold = 0;
    let volEurBought = 0;
    let volEurSold = 0;
    let realizedProfit = 0;
    let buyCount = 0;
    let sellCount = 0;
    for (const tx of periodTxs) {
        if (tx.currency === 'USDT' && tx.type === 'buy') {
            volUsdtBought += tx.quantity;
            buyCount += 1;
        }
        if (tx.currency === 'USDT' && tx.type === 'sell') {
            volUsdtSold += tx.quantity;
        }
        if (tx.currency === 'EUR' && tx.type === 'buy') {
            volEurBought += tx.quantity;
        }
        if (tx.currency === 'EUR' && tx.type === 'sell') {
            volEurSold += tx.quantity;
        }
        if (tx.type === 'sell') {
            realizedProfit += getRealizedProfit(tx, profitByTxId);
            sellCount += 1;
        }
    }
    const clientNameById = new Map<string, string>();
    input.clients.forEach((c) => clientNameById.set(c.id, input.getClientName(c)));
    const linkedClientMap = buildLinkedClientMap(input.clientTransactions);
    const ranksByClient = new Map<string, MonthlyClientRank>();
    for (const tx of periodTxs) {
        if (tx.type !== 'buy' && tx.type !== 'sell')
            continue;
        if (!tx.id)
            continue;
        const linked = linkedClientMap.get(tx.id);
        if (!linked)
            continue;
        if (!ranksByClient.has(linked.clientId)) {
            ranksByClient.set(linked.clientId, {
                clientId: linked.clientId,
                clientName: clientNameById.get(linked.clientId) || 'Client inconnu',
                buyVolumeUsdt: 0,
                sellVolumeUsdt: 0,
                totalVolumeUsdt: 0,
                realizedProfit: 0,
                txCount: 0
            });
        }
        const row = ranksByClient.get(linked.clientId)!;
        if (tx.type === 'buy' && tx.currency === 'USDT')
            row.buyVolumeUsdt += tx.quantity;
        if (tx.type === 'sell') {
            if (tx.currency === 'USDT')
                row.sellVolumeUsdt += tx.quantity;
            row.realizedProfit += getRealizedProfit(tx, profitByTxId);
        }
        row.txCount += 1;
    }
    const rankedRows = Array.from(ranksByClient.values())
        .map((row) => ({ ...row, totalVolumeUsdt: row.buyVolumeUsdt + row.sellVolumeUsdt }))
        .sort((a, b) => {
        if (b.totalVolumeUsdt !== a.totalVolumeUsdt)
            return b.totalVolumeUsdt - a.totalVolumeUsdt;
        if (b.realizedProfit !== a.realizedProfit)
            return b.realizedProfit - a.realizedProfit;
        return a.clientName.localeCompare(b.clientName, 'fr');
    });
    const topRows = rankedRows.slice(0, 10);
    const hiddenTopRows = Math.max(0, rankedRows.length - topRows.length);
    const topProfitableClient = [...rankedRows]
        .filter((row) => row.realizedProfit !== 0)
        .sort((a, b) => {
        if (b.realizedProfit !== a.realizedProfit)
            return b.realizedProfit - a.realizedProfit;
        return b.totalVolumeUsdt - a.totalVolumeUsdt;
    })[0];
    const sortedPeriodTxs = [...periodTxs].sort((a, b) => b.timestamp - a.timestamp);
    const portfolioPreviewRows = sortedPeriodTxs.slice(0, 25);
    const hiddenPortfolioRows = Math.max(0, sortedPeriodTxs.length - portfolioPreviewRows.length);
    const periodClientRows = input.clientTransactions
        .filter((row) => row.timestamp >= startTs && row.timestamp <= endTs)
        .sort((a, b) => b.timestamp - a.timestamp);
    const clientMovementPreviewRows = periodClientRows.slice(0, 25);
    const hiddenClientMovementRows = Math.max(0, periodClientRows.length - clientMovementPreviewRows.length);
    const rankingTable = topRows.length
        ? `<div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Client</th>
              <th class="num">Achats USDT</th>
              <th class="num">Ventes USDT</th>
              <th class="num">Volume</th>
              <th class="num">Profit</th>
              <th class="num">Ops</th>
            </tr>
          </thead>
          <tbody>
            ${topRows
            .map((row, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(row.clientName)}</td>
                  <td class="num">${formatNumber(row.buyVolumeUsdt)}</td>
                  <td class="num">${formatNumber(row.sellVolumeUsdt)}</td>
                  <td class="num"><strong>${formatNumber(row.totalVolumeUsdt)}</strong></td>
                  <td class="num ${row.realizedProfit >= 0 ? 'good' : 'bad'}">${row.realizedProfit >= 0 ? '+' : ''}${formatNumber(row.realizedProfit)} DZD</td>
                  <td class="num">${row.txCount}</td>
                </tr>`)
            .join('')}
          </tbody>
        </table>
      </div>
      ${hiddenTopRows > 0 ? `<div class="muted muted-note">${hiddenTopRows} autre(s) client(s) non affiche(s) dans cette synthese.</div>` : ''}`
        : '<div class="empty">Aucun classement client disponible sur cette periode.</div>';
    const portfolioTxTable = portfolioPreviewRows.length
        ? `<div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Client</th>
              <th class="num">Quantité</th>
              <th class="num">Prix Unit.</th>
              <th class="num">Total</th>
              <th class="num">Profit</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${portfolioPreviewRows
            .map((row) => {
            const linkedClientId = row.id ? linkedClientMap.get(row.id)?.clientId : undefined;
            const clientName = linkedClientId ? (clientNameById.get(linkedClientId) || 'Client inconnu') : 'Non lie';
            const isUsdtSaleSettledInEur = row.type === 'sell' && row.currency === 'USDT' && row.settlementCurrency === 'EUR';
            const typeLabel = isUsdtSaleSettledInEur
                ? 'Vente USDT -> EUR'
                : getPortfolioOperationLabel(row.type, row.currency);
            const unitPrice = row.type === 'sell'
                ? Number(isUsdtSaleSettledInEur ? row.sellPriceEur || 0 : row.sell || 0)
                : Number(row.price || 0);
            const total = Number(typeof row.total === 'number' ? row.total : row.quantity * unitPrice);
            const profit = getRealizedProfit(row, profitByTxId);
            const unitPriceLabel = isUsdtSaleSettledInEur
                ? `${formatNumber(unitPrice)} EUR`
                : formatNumber(unitPrice);
            const notes = isUsdtSaleSettledInEur
                ? `${row.notes || '-'} | ${formatNumber(Number(row.saleValueEur || 0))} EUR x ${formatNumber(Number(row.eurToDzdRateAtSale || 0))} DZD`
                : (row.notes || '-');
            return `
                  <tr>
                    <td>${escapeHtml(formatDateTime(row.timestamp))}</td>
                    <td>${escapeHtml(typeLabel)}</td>
                    <td>${escapeHtml(clientName)}</td>
                    <td class="num">${formatAssetQuantity(row.quantity)}</td>
                    <td class="num">${unitPriceLabel}</td>
                    <td class="num">${formatNumber(total)}</td>
                    <td class="num ${row.type === 'sell' ? (profit >= 0 ? 'good' : 'bad') : ''}">
                      ${row.type === 'sell' ? `${profit >= 0 ? '+' : ''}${formatNumber(profit)}` : '-'}
                    </td>
                    <td>${escapeHtml(notes)}</td>
                  </tr>`;
        })
            .join('')}
          </tbody>
        </table>
      </div>
      ${hiddenPortfolioRows > 0 ? `<div class="muted muted-note">${hiddenPortfolioRows} operation(s) supplementaire(s) masquee(s) pour garder le rapport lisible.</div>` : ''}`
        : '<div class="empty">Aucune transaction portefeuille enregistree sur cette periode.</div>';
    const clientMovementsTable = clientMovementPreviewRows.length
        ? `<div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Type</th>
              <th class="num">Montant</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${clientMovementPreviewRows
            .map((row) => {
            const clientName = clientNameById.get(row.clientId) || 'Client inconnu';
            const amount = Number(row.montant || 0);
            const label = getClientOperationLabel(row.type);
            return `
                  <tr>
                    <td>${escapeHtml(formatDateTime(row.timestamp))}</td>
                    <td>${escapeHtml(clientName)}</td>
                    <td>${escapeHtml(label)}</td>
                    <td class="num ${amount >= 0 ? 'good' : 'bad'}">${amount >= 0 ? '+' : ''}${formatNumber(amount)}</td>
                    <td>${escapeHtml(row.notes || '-')}</td>
                  </tr>`;
        })
            .join('')}
          </tbody>
        </table>
      </div>
      ${hiddenClientMovementRows > 0 ? `<div class="muted muted-note">${hiddenClientMovementRows} mouvement(s) client supplementaire(s) masquee(s).</div>` : ''}`
        : '<div class="empty">Aucun mouvement client DZD sur cette periode.</div>';
    const bodyHtml = `
    <section class="section">
      <h2 class="section-title">Synthese executive</h2>
      <div class="report-kicker">Periode: <strong>${escapeHtml(input.monthLabel)} ${input.year}</strong></div>
      <div class="executive-grid">
        <div class="executive-card ${realizedProfit < 0 ? 'loss' : 'profit'}">
          <div class="label">Profit realise</div>
          <div class="value ${realizedProfit >= 0 ? 'good' : 'bad'}">${realizedProfit >= 0 ? '+' : ''}${formatNumber(realizedProfit)} DZD</div>
        </div>
        <div class="executive-card primary">
          <div class="label">Operations</div>
          <div class="value">${periodTxs.length + periodClientRows.length}</div>
        </div>
        <div class="executive-card">
          <div class="label">Top client profit</div>
          <div class="value">${escapeHtml(topProfitableClient?.clientName || '-')}</div>
        </div>
        <div class="executive-card">
          <div class="label">USDT achete / vendu</div>
          <div class="value">${formatNumber(volUsdtBought)} / ${formatNumber(volUsdtSold)}</div>
        </div>
        <div class="executive-card">
          <div class="label">EUR achete / vendu</div>
          <div class="value">${formatNumber(volEurBought)} / ${formatNumber(volEurSold)}</div>
        </div>
        <div class="executive-card ${globalNetProfit < 0 ? 'loss' : 'profit'}">
          <div class="label">Profit net cumule</div>
          <div class="value ${globalNetProfit >= 0 ? 'good' : 'bad'}">${globalNetProfit >= 0 ? '+' : ''}${formatNumber(globalNetProfit)} DZD</div>
        </div>
      </div>
      <div class="pill-row top">
        <span class="pill">Achats Portefeuille: ${buyCount}</span>
        <span class="pill">Ventes Portefeuille: ${sellCount}</span>
        <span class="pill">Mouvements clients: ${periodClientRows.length}</span>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Etat Portefeuille (Actuel)</h2>
      <div class="cards">
        <div class="card">
          <div class="label">USDT disponible</div>
          <div class="value">${formatNumber(input.portfolioStats.usdt.available)} USDT</div>
          <div class="muted">PAM: ${formatNumber(input.portfolioStats.usdt.avgBuy)} DZD</div>
        </div>
        <div class="card">
          <div class="label">EUR disponible</div>
          <div class="value">${formatNumber(input.portfolioStats.eur.available)} EUR</div>
          <div class="muted">PAM: ${formatNumber(input.portfolioStats.eur.avgBuy)} DZD</div>
        </div>
      </div>
    </section>

    ${uncostedWarningsHtml}

    <section class="section">
      <h2 class="section-title">Top Clients du Mois (${topRows.length})</h2>
      ${rankingTable}
    </section>

    <section class="section">
      <h2 class="section-title">Details operations portefeuille (${portfolioPreviewRows.length})</h2>
      ${portfolioTxTable}
    </section>

    <section class="section">
      <h2 class="section-title">Mouvements clients DZD (${clientMovementPreviewRows.length})</h2>
      ${clientMovementsTable}
    </section>
  `;
    return reportShell({
        fileName: `rapport_mensuel_${input.year}_${String(input.month + 1).padStart(2, '0')}.pdf`,
        title: 'Rapport Mensuel',
        subtitle: `${input.monthLabel} ${input.year}`,
        bodyHtml,
        pageSize: 'A4 landscape'
    });
}
export function buildClientPdfReport(input: ClientReportInput): ReportPayload | null {
    const client = input.clients.find((item) => item.id === input.clientId);
    if (!client)
        return null;
    const allRows = input.clientTransactions
        .filter((tx) => tx.clientId === input.clientId)
        .sort((a, b) => a.timestamp - b.timestamp);
    const startTs = new Date(input.year, input.month, 1).getTime();
    const endTs = new Date(input.year, input.month + 1, 0, 23, 59, 59, 999).getTime();
    const periodRows = allRows
        .filter((tx) => tx.timestamp >= startTs && tx.timestamp <= endTs)
        .sort((a, b) => b.timestamp - a.timestamp);
    const openingBalance = allRows
        .filter((tx) => tx.timestamp < startTs)
        .reduce((sum, tx) => sum + Number(tx.montant || 0), 0);
    const periodNet = periodRows.reduce((sum, tx) => sum + Number(tx.montant || 0), 0);
    const periodCredits = periodRows
        .filter((tx) => Number(tx.montant || 0) > 0)
        .reduce((sum, tx) => sum + Number(tx.montant || 0), 0);
    const periodDebits = periodRows
        .filter((tx) => Number(tx.montant || 0) < 0)
        .reduce((sum, tx) => sum + Math.abs(Number(tx.montant || 0)), 0);
    const closingBalance = openingBalance + periodNet;
    const txById = new Map<string, Tx>();
    input.transactions.forEach((tx) => txById.set(tx.id, tx));
    const clientStatus = closingBalance < -0.005
        ? 'Solde a regler'
        : closingBalance > 0.005
            ? 'Solde en faveur du client'
            : 'Solde equilibre';
    const historyHtml = periodRows.length
        ? `<div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th class="num">Montant</th>
              <th>Details</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            ${periodRows
            .map((row) => {
            const linked = row.linkedTxId ? txById.get(row.linkedTxId) : undefined;
            const linkedDetails = linked
                ? `${getPortfolioOperationLabel(linked.type, linked.currency)} - ${formatAssetQuantity(linked.quantity)} ${linked.currency} x ${formatNumber(Number(linked.type === 'sell' ? (linked.sell || 0) : (linked.price || 0)))} DZD`
                : '-';
            const amount = Number(row.montant || 0);
            const label = getClientOperationLabel(row.type);
            return `
                  <tr>
                    <td>${escapeHtml(formatDateTime(row.timestamp))}</td>
                    <td>${escapeHtml(label)}</td>
                    <td class="num ${amount >= 0 ? 'good' : 'bad'}">${amount >= 0 ? '+' : ''}${formatNumber(amount)} DZD</td>
                    <td>${escapeHtml(linkedDetails)}</td>
                    <td>${escapeHtml(row.notes || '-')}</td>
                  </tr>`;
        })
            .join('')}
          </tbody>
        </table>
      </div>`
        : '<div class="empty">Aucune operation client pour cette periode.</div>';
    const clientName = input.getClientName(client);
    const rawFileName = sanitizeFileName(`releve_client_${clientName}_${input.year}_${String(input.month + 1).padStart(2, '0')}`);
    const bodyHtml = `
    <section class="section">
      <h2 class="section-title">Releve client</h2>
      <div class="report-kicker">Periode: <strong>${escapeHtml(input.monthLabel)} ${input.year}</strong></div>
      <div class="pill-row">
        <span class="pill">Client: ${escapeHtml(clientName)}</span>
        ${client.phone ? `<span class="pill">Tel: ${escapeHtml(client.phone)}</span>` : ''}
        ${client.redotpayId ? `<span class="pill">RedotPay: ${escapeHtml(client.redotpayId)}</span>` : ''}
        ${client.binanceEmail ? `<span class="pill">Binance: ${escapeHtml(client.binanceEmail)}</span>` : ''}
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Synthese du releve</h2>
      <div class="executive-grid">
        <div class="executive-card">
          <div class="label">Solde ouverture</div>
          <div class="value ${openingBalance >= 0 ? 'good' : 'bad'}">${openingBalance >= 0 ? '+' : ''}${formatNumber(openingBalance)} DZD</div>
        </div>
        <div class="executive-card ${closingBalance < 0 ? 'loss' : 'profit'}">
          <div class="label">Solde cloture</div>
          <div class="value ${closingBalance >= 0 ? 'good' : 'bad'}">${closingBalance >= 0 ? '+' : ''}${formatNumber(closingBalance)} DZD</div>
        </div>
        <div class="executive-card profit">
          <div class="label">Total recu</div>
          <div class="value good">+${formatNumber(periodCredits)} DZD</div>
        </div>
        <div class="executive-card loss">
          <div class="label">Total paye</div>
          <div class="value bad">-${formatNumber(periodDebits)} DZD</div>
        </div>
        <div class="executive-card">
          <div class="label">Operations</div>
          <div class="value">${periodRows.length}</div>
        </div>
        <div class="executive-card ${input.clientBalance < 0 ? 'loss' : 'profit'}">
          <div class="label">Solde actuel</div>
          <div class="value ${input.clientBalance >= 0 ? 'good' : 'bad'}">${input.clientBalance >= 0 ? '+' : ''}${formatNumber(input.clientBalance)} DZD</div>
        </div>
      </div>
      <div class="pill-row top">
        <span class="pill">Mouvement net: ${periodNet >= 0 ? '+' : ''}${formatNumber(periodNet)} DZD</span>
        <span class="pill">${clientStatus}</span>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Operations de la periode</h2>
      ${historyHtml}
    </section>
  `;
    return reportShell({
        fileName: `${rawFileName || 'releve_client'}.pdf`,
        title: 'Releve client',
        subtitle: `${clientName} - ${input.monthLabel} ${input.year}`,
        bodyHtml
    });
}
function investorTxTypeLabel(type: InvestorTransaction['type']): string {
    switch (type) {
        case 'deposit_capital':
            return 'Ajout Capital';
        case 'withdraw_capital':
            return 'Retrait Capital';
        case 'profit_distribution':
            return 'Distribution Profit';
        case 'withdraw_profit':
            return 'Retrait Benefices';
        case 'reinvest_profit':
            return 'Reinvestissement';
        default:
            return type;
    }
}
export function buildInvestorPdfReport(input: InvestorReportInput): ReportPayload {
    const periodLabel = formatReportPeriod(input.reportStartTs, input.reportEndTs);
    const periodSuffix = [
        dateStamp(input.reportStartTs),
        dateStamp(input.reportEndTs)
    ].filter(Boolean).join('_');
    const periodTxs = input.investorTransactions.filter((tx) => {
        if (input.reportStartTs != null && tx.timestamp < input.reportStartTs)
            return false;
        if (input.reportEndTs != null && tx.timestamp > input.reportEndTs)
            return false;
        return true;
    });
    const orderedTxs = [...periodTxs].sort((a, b) => b.timestamp - a.timestamp);
    const depositCapital = orderedTxs
        .filter((tx) => tx.type === 'deposit_capital')
        .reduce((sum, tx) => sum + tx.amount, 0);
    const withdrawCapital = orderedTxs
        .filter((tx) => tx.type === 'withdraw_capital')
        .reduce((sum, tx) => sum + tx.amount, 0);
    const reinvestedProfit = orderedTxs
        .filter((tx) => tx.type === 'reinvest_profit')
        .reduce((sum, tx) => sum + tx.amount, 0);
    const withdrawnProfit = orderedTxs
        .filter((tx) => tx.type === 'withdraw_profit')
        .reduce((sum, tx) => sum + tx.amount, 0);
    const investorTotalProfit = Number(input.investor.totalProfit || 0);
    const investorAvailableProfit = Number(input.investor.availableProfit || 0);
    const investorCapital = Number(input.investor.capitalInvested || 0);
    const investorSharePercent = Number(input.investor.sharePercentage || 0) * 100;
    const estimatedValue = investorCapital + investorAvailableProfit;
    const estimatedYield = investorCapital > 0 ? (investorTotalProfit / investorCapital) * 100 : null;
    const netCapitalMovement = depositCapital + reinvestedProfit - withdrawCapital;
    const toneClass = (value: number) => (value > 0 ? 'good' : value < 0 ? 'bad' : '');
    const signedMoney = (value: number) => {
        const sign = value > 0 ? '+' : value < 0 ? '-' : '';
        return `${sign}${formatNumber(Math.abs(value))} DZD`;
    };
    const signedPercent = (value: number) => {
        const sign = value > 0 ? '+' : value < 0 ? '-' : '';
        return `${sign}${formatNumber(Math.abs(value), 2, 2)}%`;
    };
    const movementsHtml = orderedTxs.length
        ? `<div class="movement-grid">
        <div class="movement-card">
          <div class="label">Ajouts capital</div>
          <div class="value good">${formatNumber(depositCapital)} DZD</div>
        </div>
        <div class="movement-card">
          <div class="label">Retraits capital</div>
          <div class="value bad">${formatNumber(withdrawCapital)} DZD</div>
        </div>
        <div class="movement-card">
          <div class="label">Retraits b&eacute;n&eacute;fices</div>
          <div class="value bad">${formatNumber(withdrawnProfit)} DZD</div>
        </div>
        <div class="movement-card">
          <div class="label">R&eacute;investi</div>
          <div class="value good">${formatNumber(reinvestedProfit)} DZD</div>
        </div>
        <div class="movement-card">
          <div class="label">Nombre de mouvements</div>
          <div class="value">${orderedTxs.length}</div>
        </div>
        <div class="movement-card">
          <div class="label">Mouvement net capital</div>
          <div class="value ${toneClass(netCapitalMovement)}">${signedMoney(netCapitalMovement)}</div>
        </div>
      </div>`
        : '<div class="compact-empty">Aucun mouvement sur cette p&eacute;riode</div>';
    const investorName = input.investor.name || 'investisseur';
    const bodyHtml = `
    <section class="section">
      <h2 class="section-title">Synthese investisseur</h2>
      <div class="report-kicker">P&eacute;riode du rapport: <strong>${escapeHtml(periodLabel)}</strong></div>
      <div class="executive-grid">
        <div class="executive-card primary">
          <div class="label">Capital actuel</div>
          <div class="value">${formatNumber(investorCapital)} DZD</div>
        </div>
        <div class="executive-card">
          <div class="label">Part du fonds</div>
          <div class="value">${formatNumber(investorSharePercent, 2, 2)}%</div>
        </div>
        <div class="executive-card ${investorTotalProfit < 0 ? 'loss' : 'profit'}">
          <div class="label">Profit net attribu&eacute;</div>
          <div class="value ${toneClass(investorTotalProfit)}">${signedMoney(investorTotalProfit)}</div>
        </div>
        <div class="executive-card ${investorAvailableProfit < 0 ? 'loss' : 'profit'}">
          <div class="label">B&eacute;n&eacute;fices disponibles</div>
          <div class="value ${toneClass(investorAvailableProfit)}">${signedMoney(investorAvailableProfit)}</div>
        </div>
        <div class="executive-card">
          <div class="label">Valeur estim&eacute;e</div>
          <div class="value">${formatNumber(estimatedValue)} DZD</div>
        </div>
        <div class="executive-card ${estimatedYield != null && estimatedYield < 0 ? 'loss' : 'profit'}">
          <div class="label">Rendement estim&eacute;</div>
          <div class="value ${estimatedYield == null ? '' : toneClass(estimatedYield)}">${estimatedYield == null ? '-' : signedPercent(estimatedYield)}</div>
        </div>
      </div>
      ${input.investor.notes ? `<div class="compact-note"><strong>Notes:</strong> ${escapeHtml(input.investor.notes)}</div>` : ''}
    </section>

    <section class="section">
      <h2 class="section-title">Mouvements de la p&eacute;riode</h2>
      ${movementsHtml}
    </section>
  `;
    return reportShell({
        fileName: `${sanitizeFileName(`rapport_investisseur_${investorName}${periodSuffix ? `_${periodSuffix}` : ''}`) || 'rapport_investisseur'}.pdf`,
        title: 'Rapport Investisseur',
        subtitle: `${investorName} - ${periodLabel}`,
        bodyHtml
    });
}
export function buildPersonalExpensesPdfReport(input: PersonalExpensesReportInput): ReportPayload {
    const { expenses, periodLabel, periodKey, periodStart, periodEnd, previousPeriodTotal, managerProfitAvailable } = input;
    // Compute net amount per tx (handles settled advances using settledAmount)
    const netExpense = (tx: TreasuryTx): number => {
        if (tx.origin === 'personal_expense_return')
            return 0;
        if (tx.advanceState === 'settled')
            return Number(tx.settledAmount || 0);
        return Number(tx.amount || 0);
    };
    const periodExpenses = expenses
        .filter((tx) => tx.timestamp >= periodStart && tx.timestamp <= periodEnd)
        .filter((tx) => tx.advanceState !== 'pending')
        .filter((tx) => tx.origin !== 'personal_expense_return')
        .sort((a, b) => b.timestamp - a.timestamp);
    const total = periodExpenses.reduce((sum, tx) => sum + netExpense(tx), 0);
    const opCount = periodExpenses.length;
    // Daily average
    const daysInPeriod = (() => {
        if (periodKey === 'day')
            return 1;
        if (periodKey === 'week')
            return 7;
        if (periodKey === 'month') {
            const d = new Date(periodStart);
            return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        }
        // year
        const y = new Date(periodStart).getFullYear();
        return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
    })();
    const dailyAvg = daysInPeriod > 0 ? total / daysInPeriod : 0;
    // % du profit consommé
    const profitDenom = managerProfitAvailable + total;
    const profitPct = profitDenom > 0 ? (total / profitDenom) * 100 : 0;
    // vs Previous period
    const vsPrev = previousPeriodTotal > 0
        ? ((total - previousPeriodTotal) / previousPeriodTotal) * 100
        : null;
    // Biggest expense
    const biggest = periodExpenses.reduce<TreasuryTx | null>((max, tx) => {
        if (!max || netExpense(tx) > netExpense(max))
            return tx;
        return max;
    }, null);
    const periodKeyLabel = (() => {
        if (periodKey === 'day')
            return 'Jour';
        if (periodKey === 'week')
            return 'Semaine';
        if (periodKey === 'month')
            return 'Mois';
        return 'Année';
    })();
    const historyHtml = periodExpenses.length
        ? `<div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Heure</th>
              <th>Source</th>
              <th>Note</th>
              <th class="num">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${periodExpenses
            .map((tx) => {
            const amount = netExpense(tx);
            const noteLabel = tx.notes || 'Dépense personnelle';
            const sourceLabel = tx.source || '-';
            const isAdvance = tx.advanceState === 'settled';
            const advanceTag = isAdvance ? ' <span class="pill small">Régularisé</span>' : '';
            return `
                  <tr>
                    <td>${escapeHtml(tx.date || '-')}</td>
                    <td>${escapeHtml(tx.time || '-')}</td>
                    <td>${escapeHtml(sourceLabel)}</td>
                    <td>${escapeHtml(noteLabel)}${advanceTag}</td>
                    <td class="num bad">-${formatNumber(amount)} DZD</td>
                  </tr>`;
        })
            .join('')}
          </tbody>
        </table>
      </div>`
        : '<div class="empty">Aucune dépense pour cette période.</div>';
    const biggestHtml = biggest
        ? `<div class="pill emphasis">
        <strong>${escapeHtml(biggest.date || '')}</strong> · ${escapeHtml(biggest.notes || 'Dépense')} · <strong>${formatNumber(netExpense(biggest))} DZD</strong>
       </div>`
        : '<div class="empty">Aucune dépense.</div>';
    const vsPrevHtml = vsPrev === null
        ? '<span class="pill">Pas de période précédente comparable</span>'
        : `<span class="pill ${vsPrev > 0 ? 'loss' : 'profit'}">
        ${vsPrev > 0 ? '+' : ''}${formatNumber(vsPrev, 1, 1)}% vs période précédente
       </span>`;
    const profitPctTone = profitPct > 80 ? 'bad' : profitPct > 50 ? '' : 'good';
    const fileName = `rapport_depenses_${periodKey}_${new Date(periodStart).toISOString().slice(0, 10)}`;
    const bodyHtml = `
    <section class="section">
      <h2 class="section-title">Rapport de dépenses personnelles</h2>
      <div class="report-kicker">Période: <strong>${escapeHtml(periodLabel)}</strong> · ${periodKeyLabel}</div>
      <div class="pill-row">
        ${vsPrevHtml}
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Résumé</h2>
      <div class="executive-grid">
        <div class="executive-card loss">
          <div class="label">Total dépensé</div>
          <div class="value bad">-${formatNumber(total)} DZD</div>
        </div>
        <div class="executive-card">
          <div class="label">Nombre d'opérations</div>
          <div class="value">${opCount}</div>
        </div>
        <div class="executive-card">
          <div class="label">Moyenne / jour</div>
          <div class="value">${formatNumber(dailyAvg)} DZD</div>
        </div>
        <div class="executive-card ${profitPctTone === 'bad' ? 'loss' : profitPctTone === 'good' ? 'profit' : ''}">
          <div class="label">% du profit consommé</div>
          <div class="value ${profitPctTone}">${formatNumber(profitPct, 1, 1)}%</div>
        </div>
        <div class="executive-card">
          <div class="label">Profit disponible</div>
          <div class="value">${formatNumber(managerProfitAvailable)} DZD</div>
        </div>
        <div class="executive-card ${vsPrev !== null && vsPrev > 0 ? 'loss' : vsPrev !== null && vsPrev < 0 ? 'profit' : ''}">
          <div class="label">Période précédente</div>
          <div class="value">${formatNumber(previousPeriodTotal)} DZD</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Plus grosse dépense</h2>
      ${biggestHtml}
    </section>

    <section class="section">
      <h2 class="section-title">Détail des opérations</h2>
      ${historyHtml}
    </section>

    <section class="section compact-offset">
      <div class="final-summary">
        <div>
          <div class="final-total-label">Total final</div>
          <div class="final-total-value">-${formatNumber(total)} DZD</div>
        </div>
        <div class="signature-box">
          Signature
        </div>
      </div>
    </section>
  `;
    return reportShell({
        fileName: `${sanitizeFileName(fileName) || 'rapport_depenses'}.pdf`,
        title: 'Rapport de dépenses personnelles',
        subtitle: `${periodLabel}`,
        bodyHtml
    });
}
export function openPdfPrintWindow(report: ReportPayload): boolean {
    if (typeof window === 'undefined')
        return false;
    const isMobile = /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent || '') ||
        (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 900px)').matches);
    if (isMobile) {
        try {
            const htmlBlob = new Blob([report.html], { type: 'text/html;charset=utf-8' });
            const htmlUrl = URL.createObjectURL(htmlBlob);
            const mobileWin = window.open(htmlUrl, '_blank');
            if (mobileWin) {
                window.setTimeout(() => URL.revokeObjectURL(htmlUrl), 120000);
                return true;
            }
            URL.revokeObjectURL(htmlUrl);
        }
        catch (error) {
            console.error('Mobile PDF open failed:', error);
        }
    }
    try {
        const win = window.open('', '_blank');
        if (win) {
            win.document.open();
            win.document.write(report.html);
            win.document.close();
            if (isMobile) {
                // Mobile fallback: still no auto-print.
                return true;
            }
            const runPrint = () => {
                win.setTimeout(() => {
                    try {
                        win.focus();
                        win.print();
                    }
                    catch (error) {
                        console.error('PDF print failed:', error);
                    }
                }, 320);
            };
            if (win.document.readyState === 'complete') {
                runPrint();
            }
            else {
                win.addEventListener('load', runPrint, { once: true });
            }
            win.onafterprint = () => {
                try {
                    win.close();
                }
                catch (error) {
                    console.error('PDF window close failed:', error);
                }
            };
            return true;
        }
    }
    catch (error) {
        console.error('Popup print failed:', error);
    }
    try {
        const htmlBlob = new Blob([report.html], { type: 'text/html;charset=utf-8' });
        const htmlUrl = URL.createObjectURL(htmlBlob);
        const fallbackLink = document.createElement('a');
        fallbackLink.href = htmlUrl;
        fallbackLink.target = '_blank';
        fallbackLink.rel = 'noopener';
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        document.body.removeChild(fallbackLink);
        window.setTimeout(() => URL.revokeObjectURL(htmlUrl), 120000);
        return true;
    }
    catch (error) {
        console.error('Iframe fallback failed:', error);
        return false;
    }
}
