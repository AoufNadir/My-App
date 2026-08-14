import type { ClientDzd, ClientTransactionDzd, Investor, InvestorTransaction, Tx, TreasuryTx } from '../types';
import type { PamLedgerResult } from './pamLedger';
import { getClientOperationLabel, getClientTransferDetails, getManualClientNote, getPortfolioOperationLabel } from './transactionTerminology';
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
    surfaceRaised: 'Canvas',
    surfaceMuted: 'ButtonFace',
    ink: 'CanvasText',
    muted: 'GrayText',
    line: 'ButtonBorder',
    lineStrong: 'GrayText',
    brand: 'Highlight',
    brandSoft: 'ButtonFace',
    brandDark: 'Highlight',
    good: 'CanvasText',
    goodBg: 'ButtonFace',
    bad: 'CanvasText',
    badBg: 'ButtonFace',
    warning: 'CanvasText',
    warningBg: 'ButtonFace',
    asset: 'Highlight',
    assetBg: 'ButtonFace',
};
function readReportToken(tokenName: string, fallback: string): string {
    if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
        return fallback;
    }
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
    return value || fallback;
}
function buildReportThemeCss(): string {
    const radiusSm = readReportToken('--radius-sm', '8px');
    const radiusMd = readReportToken('--radius-md', '12px');
    const radiusLg = readReportToken('--radius-lg', '16px');
    const shadowCard = readReportToken('--shadow-card', 'none');
    const spaceCard = readReportToken('--spacing-card', '16px');
    const spaceSection = readReportToken('--spacing-section', '24px');
    return `
          --bg: ${readReportToken('--color-app-bg', REPORT_FALLBACK_COLORS.appBg)};
          --surface: ${readReportToken('--color-surface', REPORT_FALLBACK_COLORS.surface)};
          --surface-raised: ${readReportToken('--color-surface-raised', REPORT_FALLBACK_COLORS.surfaceRaised)};
          --surface-muted: ${readReportToken('--color-surface-muted', REPORT_FALLBACK_COLORS.surfaceMuted)};
          --surface-zebra: color-mix(in srgb, var(--surface-muted) 64%, var(--surface));
          --hover-bg: color-mix(in srgb, var(--brand-soft) 42%, var(--surface));
          --ink: ${readReportToken('--color-neutral-900', REPORT_FALLBACK_COLORS.ink)};
          --muted: ${readReportToken('--color-neutral-500', REPORT_FALLBACK_COLORS.muted)};
          --muted-strong: ${readReportToken('--color-neutral-700', REPORT_FALLBACK_COLORS.ink)};
          --line: ${readReportToken('--color-border', REPORT_FALLBACK_COLORS.line)};
          --line-strong: ${readReportToken('--color-border-strong', REPORT_FALLBACK_COLORS.lineStrong)};
          --brand: ${readReportToken('--color-primary', REPORT_FALLBACK_COLORS.brand)};
          --brand-soft: ${readReportToken('--color-financial-asset-bg', REPORT_FALLBACK_COLORS.brandSoft)};
          --brand-dark: ${readReportToken('--color-primary-dark', REPORT_FALLBACK_COLORS.brandDark)};
          --secondary: ${readReportToken('--color-secondary', REPORT_FALLBACK_COLORS.asset)};
          --secondary-soft: ${readReportToken('--color-info-bg', REPORT_FALLBACK_COLORS.assetBg)};
          --good: ${readReportToken('--color-financial-profit', REPORT_FALLBACK_COLORS.good)};
          --good-bg: ${readReportToken('--color-financial-profit-bg', REPORT_FALLBACK_COLORS.goodBg)};
          --bad: ${readReportToken('--color-financial-loss', REPORT_FALLBACK_COLORS.bad)};
          --bad-bg: ${readReportToken('--color-financial-loss-bg', REPORT_FALLBACK_COLORS.badBg)};
          --warning: ${readReportToken('--color-financial-debt', REPORT_FALLBACK_COLORS.warning)};
          --warning-bg: ${readReportToken('--color-financial-debt-bg', REPORT_FALLBACK_COLORS.warningBg)};
          --radius-sm: ${radiusSm};
          --radius-md: ${radiusMd};
          --radius-lg: ${radiusLg};
          --space-card: ${spaceCard};
          --space-section: ${spaceSection};
          --shadow-card: ${shadowCard};
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
function findClientTransferCounterpart(tx: ClientTransactionDzd, allClientTxs: ClientTransactionDzd[]) {
    if (tx.type !== 'Transfert Sortant' && tx.type !== 'Transfert Entrant')
        return null;
    if (tx.linkedTxId) {
        const linked = allClientTxs.find((candidate) => candidate.id === tx.linkedTxId);
        if (linked)
            return linked;
    }
    const counterpartType = tx.type === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
    const counterpartAmount = -Number(tx.montant || 0);
    return allClientTxs
        .filter((candidate) => candidate.id !== tx.id
        && candidate.clientId !== tx.clientId
        && candidate.type === counterpartType
        && candidate.date === tx.date
        && candidate.time === tx.time
        && Math.abs(Number(candidate.montant || 0) - counterpartAmount) <= 0.01
        && Math.abs(Number(candidate.timestamp || 0) - Number(tx.timestamp || 0)) <= 2000)
        .sort((left, right) => Math.abs(Number(left.timestamp || 0) - Number(tx.timestamp || 0))
        - Math.abs(Number(right.timestamp || 0) - Number(tx.timestamp || 0)))[0] || null;
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
    const logoSrc = typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/logo.png`
        : '/logo.png';
    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.fileName.replace('.pdf', ''))}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    .report-shell-body {
      ${buildReportThemeCss()}
    }

    .report-shell-body * { box-sizing: border-box; }

    body.report-shell-body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: 'Inter', 'Cairo', system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      padding: 18px;
    }

    .report-shell-body {
      background: var(--bg);
      color: var(--ink);
      font-family: 'Inter', 'Cairo', system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.5;
    }

    .report-shell-body .toolbar {
      max-width: 1060px;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: flex-end;
    }

    .report-shell-body .toolbar button {
      min-height: 44px;
      border: 1px solid var(--brand);
      border-radius: var(--radius-md);
      background: var(--brand);
      color: var(--surface);
      font-family: 'Inter', 'Cairo', sans-serif;
      font-weight: 800;
      padding: 0 18px;
      cursor: pointer;
      font-size: 13px;
      box-shadow: var(--shadow-card);
    }

    .report-shell-body .toolbar button:hover {
      background: var(--brand-dark);
    }

    .report-shell-body .report {
      max-width: 1060px;
      margin: 0 auto;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-card);
    }

    .report-shell-body .header {
      padding: 24px;
      border-bottom: 1px solid var(--line);
      background: var(--surface);
    }

    .report-shell-body .brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .report-shell-body .brand-lockup {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .report-shell-body .brand-logo {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      border: 1px solid var(--line);
      background: var(--surface);
      object-fit: cover;
      box-shadow: var(--shadow-card);
      flex: 0 0 auto;
    }

    .report-shell-body .brand-name {
      color: var(--ink);
      font-size: 17px;
      font-weight: 900;
      line-height: 1.1;
    }

    .report-shell-body .brand-subtitle,
    .report-shell-body .meta-label {
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .report-shell-body .report-tag {
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--muted-strong);
      padding: 7px 10px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      white-space: nowrap;
    }

    .report-shell-body .title-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 20px;
      align-items: end;
      margin-top: 24px;
    }

    .report-shell-body .eyebrow {
      margin: 0 0 7px 0;
      color: var(--secondary);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    .report-shell-body .title {
      margin: 0;
      color: var(--ink);
      font-size: 30px;
      font-weight: 900;
      letter-spacing: 0;
      line-height: 1.08;
    }

    .report-shell-body .subtitle {
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
      font-weight: 700;
    }

    .report-shell-body .meta-card {
      min-width: 190px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--surface);
      padding: 12px 14px;
      text-align: right;
      box-shadow: var(--shadow-card);
    }

    .report-shell-body .meta-card strong {
      display: block;
      margin-top: 4px;
      color: var(--ink);
      font-size: 13px;
      font-weight: 900;
    }

    .report-shell-body .body {
      padding: 24px;
    }

    .report-shell-body .section {
      margin-top: var(--space-section);
    }

    .report-shell-body .section:first-child {
      margin-top: 0;
    }

    .report-shell-body .section-title {
      display: flex;
      align-items: center;
      gap: 9px;
      margin: 0 0 14px 0;
      color: var(--ink);
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .report-shell-body .section-title::before {
      content: "";
      width: 4px;
      height: 18px;
      border-radius: var(--radius-sm);
      background: var(--brand);
      flex: 0 0 auto;
    }

    .report-shell-body .cards,
    .report-shell-body .executive-grid,
    .report-shell-body .movement-grid {
      display: grid;
      gap: 12px;
    }

    .report-shell-body .cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .report-shell-body .executive-grid,
    .report-shell-body .movement-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .report-shell-body .card,
    .report-shell-body .executive-card,
    .report-shell-body .movement-card {
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--surface);
      padding: var(--space-card);
      box-shadow: none;
    }

    .report-shell-body .executive-card {
      min-height: 80px;
    }

    /* Colour variants: text accent only – no coloured backgrounds or thick borders */
    .report-shell-body .executive-card.primary { }
    .report-shell-body .executive-card.profit  { }
    .report-shell-body .executive-card.loss    { }

    .report-shell-body .card .label,
    .report-shell-body .executive-card .label,
    .report-shell-body .movement-card .label {
      margin-bottom: 6px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .report-shell-body .card .value,
    .report-shell-body .executive-card .value {
      color: var(--ink);
      font-size: 20px;
      font-weight: 900;
      line-height: 1.2;
    }

    .report-shell-body .movement-card .value {
      color: var(--ink);
      font-size: 14px;
      font-weight: 900;
      line-height: 1.25;
    }

    .report-shell-body .report-kicker {
      margin-bottom: 12px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }

    .report-shell-body .compact-empty,
    .report-shell-body .empty {
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius-md);
      color: var(--muted);
      background: color-mix(in srgb, var(--surface-muted) 80%, var(--surface));
      font-weight: 700;
    }

    .report-shell-body .compact-empty {
      padding: 14px;
    }

    .report-shell-body .empty {
      padding: 24px;
      text-align: center;
    }

    .report-shell-body .compact-note {
      margin-top: 14px;
      color: var(--muted);
      font-size: 12px;
      border-top: 1px solid var(--line);
      padding-top: 10px;
      line-height: 1.5;
    }

    .report-shell-body .table-wrap {
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      overflow-x: auto;
      overflow-y: visible;
      -webkit-overflow-scrolling: touch;
      background: var(--surface);
      box-shadow: var(--shadow-card);
    }

    .report-shell-body table {
      width: 100%;
      border-collapse: collapse;
    }

    .report-shell-body th,
    .report-shell-body td {
      padding: 11px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: middle;
    }

    .report-shell-body th {
      background: var(--surface-muted);
      color: var(--muted-strong);
      font-size: 10.5px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .report-shell-body tr:last-child td {
      border-bottom: none;
    }

    .report-shell-body tbody tr:nth-child(even) {
      background: var(--surface-zebra);
    }

    .report-shell-body tbody tr:hover {
      background: var(--hover-bg);
    }

    .report-shell-body .num {
      text-align: right;
      white-space: nowrap;
      font-family: 'Inter', system-ui, sans-serif;
      font-variant-numeric: tabular-nums;
      font-weight: 800;
    }

    .report-shell-body .num,
    .report-shell-body .good,
    .report-shell-body .bad,
    .report-shell-body .final-total-value {
      direction: ltr;
      unicode-bidi: isolate;
    }

    .report-shell-body .good,
    .report-shell-body .value.good {
      color: var(--good);
      font-weight: 900;
    }

    .report-shell-body .bad,
    .report-shell-body .value.bad {
      color: var(--bad);
      font-weight: 900;
    }

    .report-shell-body .muted {
      color: var(--muted);
      font-weight: 700;
    }

    .report-shell-body .pill {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--muted-strong);
      padding: 3px 9px;
      margin-right: 6px;
      margin-bottom: 6px;
      font-size: 11px;
      font-weight: 800;
    }

    .report-shell-body .pill.profit {
      border-color: var(--good);
      color: var(--good);
      background: var(--good-bg);
    }

    .report-shell-body .pill.loss {
      border-color: var(--bad);
      color: var(--bad);
      background: var(--bad-bg);
    }

    .report-shell-body .pill-row {
      margin-bottom: 10px;
    }

    .report-shell-body .pill-row.loose {
      margin-bottom: 14px;
    }

    .report-shell-body .pill-row.top {
      margin-top: 14px;
    }

    .report-shell-body .pill.small {
      min-height: 20px;
      font-size: 10px;
      padding: 1px 6px;
    }

    .report-shell-body .pill.emphasis {
      min-height: 34px;
      border-color: var(--brand);
      color: var(--brand-dark);
      background: var(--brand-soft);
      font-size: 14px;
      padding: 5px 12px;
    }

    .report-shell-body .muted-note {
      margin-top: 10px;
      line-height: 1.5;
    }

    .report-shell-body .section.compact-offset {
      margin-top: var(--space-section);
    }

    .report-shell-body .final-summary {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 24px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      padding: 16px 18px;
    }

    .report-shell-body .final-total-label {
      color: var(--muted);
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .report-shell-body .final-total-value {
      color: var(--bad);
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 25px;
      font-weight: 900;
    }

    .report-shell-body .signature-box {
      min-width: 220px;
      border-top: 1.5px solid var(--line-strong);
      padding-top: 8px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 900;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .report-shell-body .footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 24px;
      color: var(--muted);
      font-size: 11px;
      border-top: 1px solid var(--line);
      padding-top: 12px;
      line-height: 1.5;
    }

    .report-shell-body .footer strong {
      color: var(--muted-strong);
    }

    .report-shell-body.report-preview-root {
      padding: 0;
    }

    .report-shell-body.report-preview-root .toolbar {
      display: none;
    }

    @media (max-width: 900px) {
      body.report-shell-body {
        padding: 10px;
      }
      .report-shell-body {
        font-size: 12px;
      }
      .report-shell-body .toolbar,
      .report-shell-body .report {
        max-width: 100%;
      }
      .report-shell-body .header,
      .report-shell-body .body {
        padding: 16px;
      }
      .report-shell-body .title-row {
        grid-template-columns: 1fr;
      }
      .report-shell-body .title {
        font-size: 24px;
      }
      .report-shell-body .meta-card {
        min-width: 0;
        text-align: left;
      }
      .report-shell-body .cards,
      .report-shell-body .executive-grid,
      .report-shell-body .movement-grid {
        grid-template-columns: 1fr;
      }
      .report-shell-body th,
      .report-shell-body td {
        font-size: 11px;
        padding: 8px 9px;
      }
      .report-shell-body .table-wrap table {
        min-width: 760px;
      }
      .report-shell-body .footer {
        display: block;
      }
    }

    @page {
      size: ${opts.pageSize || 'A4'};
      margin: 10mm;
    }

    @media print {
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body.report-shell-body {
        background: var(--surface);
        padding: 0;
      }
      .report-shell-body {
        font-size: 11px;
      }
      .report-shell-body .toolbar {
        display: none !important;
      }
      .report-shell-body .report {
        max-width: none;
        border: none;
        border-radius: 0;
        overflow: visible;
        box-shadow: none;
      }
      .report-shell-body .header {
        padding: 0 0 16px 0 !important;
        background: var(--surface) !important;
      }
      .report-shell-body .body {
        padding: 16px 0 0 0 !important;
      }
      .report-shell-body .title {
        font-size: 24px;
      }
      .report-shell-body .report-tag,
      .report-shell-body .meta-card,
      .report-shell-body .card,
      .report-shell-body .executive-card,
      .report-shell-body .movement-card,
      .report-shell-body .table-wrap {
        box-shadow: none;
      }
      .report-shell-body .table-wrap {
        overflow: visible !important;
        border-radius: var(--radius-sm);
      }
      .report-shell-body .table-wrap table {
        width: 100% !important;
        min-width: 0 !important;
        table-layout: fixed;
      }
      .report-shell-body .table-wrap th,
      .report-shell-body .table-wrap td {
        font-size: 9.5px;
        padding: 5px 6px;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      .report-shell-body .table-wrap .num {
        white-space: normal;
      }
      .report-shell-body .executive-grid,
      .report-shell-body .movement-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }
      .report-shell-body .executive-card {
        min-height: 72px;
        padding: 10px 11px;
      }
      .report-shell-body .executive-card .value {
        font-size: 16px;
      }
      .report-shell-body .movement-card .value {
        font-size: 12px;
      }
      .report-shell-body tr,
      .report-shell-body td,
      .report-shell-body th,
      .report-shell-body .card,
      .report-shell-body .executive-card,
      .report-shell-body .movement-card {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  </style>
</head>
<body class="report-shell-body">
  <div class="toolbar">
    <button type="button" onclick="window.print()">Imprimer / PDF</button>
  </div>
  <article class="report">
    <header class="header">
      <div class="brand-row">
        <div class="brand-lockup">
          <img class="brand-logo" src="${escapeHtml(logoSrc)}" alt="Pro Digital" />
          <div>
            <div class="brand-name">Pro Digital</div>
            <div class="brand-subtitle">Finance operations</div>
          </div>
        </div>
        <div class="report-tag">Export officiel</div>
      </div>
      <div class="title-row">
        <div>
          <p class="eyebrow">Rapport financier</p>
          <h1 class="title">${escapeHtml(opts.title)}</h1>
          <div class="subtitle">${escapeHtml(opts.subtitle)}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Généré le</div>
          <strong>${escapeHtml(generatedAt)}</strong>
        </div>
      </div>
    </header>
    <main class="body">
      ${opts.bodyHtml}
      <div class="footer">
        <span><strong>Pro Digital</strong> · Document généré automatiquement.</span>
        <span>Format recommandé: Impression &gt; Save as PDF.</span>
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
      ${hiddenCount > 0 ? `<div class="muted muted-note">${hiddenCount} autre(s) transaction(s) masquée(s) dans cette synthèse.</div>` : ''}
      <div class="muted muted-note">
        Alerte informative uniquement: ces montants ne sont pas retirés du profit réalisé.
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
      ${hiddenTopRows > 0 ? `<div class="muted muted-note">${hiddenTopRows} autre(s) client(s) non affiché(s) dans cette synthèse.</div>` : ''}`
        : '<div class="empty">Aucun classement client disponible sur cette période.</div>';
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
      ${hiddenPortfolioRows > 0 ? `<div class="muted muted-note">${hiddenPortfolioRows} opération(s) supplémentaire(s) masquée(s) pour garder le rapport lisible.</div>` : ''}`
        : '<div class="empty">Aucune transaction portefeuille enregistrée sur cette période.</div>';
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
            const counterpart = findClientTransferCounterpart(row, input.clientTransactions);
            const counterpartName = counterpart ? (clientNameById.get(counterpart.clientId) || 'Client inconnu') : undefined;
            const notes = row.type === 'Transfert Entrant' || row.type === 'Transfert Sortant'
                ? getClientTransferDetails(row, counterpartName)
                : getManualClientNote(row.notes);
            return `
                  <tr>
                    <td>${escapeHtml(formatDateTime(row.timestamp))}</td>
                    <td>${escapeHtml(clientName)}</td>
                    <td>${escapeHtml(label)}</td>
                    <td class="num ${amount >= 0 ? 'good' : 'bad'}">${amount >= 0 ? '+' : ''}${formatNumber(amount)}</td>
                    <td>${escapeHtml(notes || '-')}</td>
                  </tr>`;
        })
            .join('')}
          </tbody>
        </table>
      </div>
      ${hiddenClientMovementRows > 0 ? `<div class="muted muted-note">${hiddenClientMovementRows} mouvement(s) client supplémentaire(s) masquée(s).</div>` : ''}`
        : '<div class="empty">Aucun mouvement client DZD sur cette période.</div>';
    const bodyHtml = `
    <section class="section">
      <h2 class="section-title">Synthèse exécutive</h2>
      <div class="report-kicker">Période: <strong>${escapeHtml(input.monthLabel)} ${input.year}</strong></div>
      <div class="executive-grid">
        <div class="executive-card ${realizedProfit < 0 ? 'loss' : 'profit'}">
          <div class="label">Profit réalisé</div>
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
      <h2 class="section-title">Détails opérations portefeuille (${portfolioPreviewRows.length})</h2>
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
    const clientNameById = new Map<string, string>();
    input.clients.forEach((item) => clientNameById.set(item.id, input.getClientName(item)));
    const clientStatus = closingBalance < -0.005
        ? 'Solde à régler'
        : closingBalance > 0.005
            ? 'Solde en faveur du client'
            : 'Solde équilibré';
    const historyHtml = periodRows.length
        ? `<div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th class="num">Montant</th>
              <th>Détails</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            ${periodRows
            .map((row) => {
            const linked = row.linkedTxId ? txById.get(row.linkedTxId) : undefined;
            let linkedDetails = linked
                ? `${getPortfolioOperationLabel(linked.type, linked.currency)} - ${formatAssetQuantity(linked.quantity)} ${linked.currency} x ${formatNumber(Number(linked.type === 'sell' ? (linked.sell || 0) : (linked.price || 0)))} DZD`
                : '-';
            const counterpart = findClientTransferCounterpart(row, input.clientTransactions);
            if (counterpart) {
                const counterpartName = clientNameById.get(counterpart.clientId) || 'Client inconnu';
                linkedDetails = getClientTransferDetails({ type: row.type, notes: '' }, counterpartName);
            }
            const amount = Number(row.montant || 0);
            const label = getClientOperationLabel(row.type);
            const manualNote = getManualClientNote(row.notes);
            return `
                  <tr>
                    <td>${escapeHtml(formatDateTime(row.timestamp))}</td>
                    <td>${escapeHtml(label)}</td>
                    <td class="num ${amount >= 0 ? 'good' : 'bad'}">${amount >= 0 ? '+' : ''}${formatNumber(amount)} DZD</td>
                    <td>${escapeHtml(linkedDetails)}</td>
                    <td>${escapeHtml(manualNote || '-')}</td>
                  </tr>`;
        })
            .join('')}
          </tbody>
        </table>
      </div>`
        : '<div class="empty">Aucune opération client pour cette période.</div>';
    const clientName = input.getClientName(client);
    const rawFileName = sanitizeFileName(`releve_client_${clientName}_${input.year}_${String(input.month + 1).padStart(2, '0')}`);
    const bodyHtml = `
    <section class="section">
      <h2 class="section-title">Relevé client</h2>
      <div class="report-kicker">Période: <strong>${escapeHtml(input.monthLabel)} ${input.year}</strong></div>
      <div class="pill-row">
        <span class="pill">Client: ${escapeHtml(clientName)}</span>
        ${client.phone ? `<span class="pill">Tel: ${escapeHtml(client.phone)}</span>` : ''}
        ${client.redotpayId ? `<span class="pill">RedotPay: ${escapeHtml(client.redotpayId)}</span>` : ''}
        ${client.binanceEmail ? `<span class="pill">Binance: ${escapeHtml(client.binanceEmail)}</span>` : ''}
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Synthèse du relevé</h2>
      <div class="executive-grid">
        <div class="executive-card">
          <div class="label">Solde ouverture</div>
          <div class="value ${openingBalance >= 0 ? 'good' : 'bad'}">${openingBalance >= 0 ? '+' : ''}${formatNumber(openingBalance)} DZD</div>
        </div>
        <div class="executive-card ${closingBalance < 0 ? 'loss' : 'profit'}">
          <div class="label">Solde clôture</div>
          <div class="value ${closingBalance >= 0 ? 'good' : 'bad'}">${closingBalance >= 0 ? '+' : ''}${formatNumber(closingBalance)} DZD</div>
        </div>
        <div class="executive-card profit">
          <div class="label">Total reçu</div>
          <div class="value good">+${formatNumber(periodCredits)} DZD</div>
        </div>
        <div class="executive-card loss">
          <div class="label">Total payé</div>
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
      <h2 class="section-title">Opérations de la période</h2>
      ${historyHtml}
    </section>
  `;
    return reportShell({
        fileName: `${rawFileName || 'releve_client'}.pdf`,
        title: 'Relevé client',
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
      <h2 class="section-title">Synthèse investisseur</h2>
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

    <section class="section">
      <h2 class="section-title">D&eacute;tail des op&eacute;rations</h2>
      ${orderedTxs.length ? `
      <table class="data-table" style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px;">
        <thead>
          <tr style="background:#f3f4f6;text-align:left;">
            <th style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Date</th>
            <th style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Type</th>
            <th style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">Montant</th>
            <th style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Source</th>
            <th style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${orderedTxs.map((tx, i) => {
            const typeLabel = tx.type === 'deposit_capital' ? 'Dépôt capital'
                : tx.type === 'withdraw_capital' ? 'Retrait capital'
                : tx.type === 'withdraw_profit' ? 'Retrait bénéfice'
                : tx.type === 'reinvest_profit' ? 'Réinvestissement'
                : tx.type;
            const isPositive = tx.type === 'deposit_capital' || tx.type === 'reinvest_profit';
            const color = isPositive ? '#16a34a' : '#dc2626';
            const sign = isPositive ? '+' : '-';
            return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
              <td style="padding:5px 8px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${escapeHtml(tx.date || '')}</td>
              <td style="padding:5px 8px;border-bottom:1px solid #f3f4f6;">${escapeHtml(typeLabel)}</td>
              <td style="padding:5px 8px;border-bottom:1px solid #f3f4f6;text-align:right;color:${color};font-weight:600;">${sign}${formatNumber(tx.amount)} DZD</td>
              <td style="padding:5px 8px;border-bottom:1px solid #f3f4f6;">${escapeHtml((tx as any).paymentSource || '—')}</td>
              <td style="padding:5px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:10px;">${escapeHtml(tx.notes || '')}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#f3f4f6;font-weight:700;">
            <td colspan="2" style="padding:6px 8px;">Total mouvements</td>
            <td style="padding:6px 8px;text-align:right;">${orderedTxs.length} op.</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>` : '<div class="compact-empty">Aucune op&eacute;ration sur cette p&eacute;riode.</div>'}
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

// ─── List export helpers ───────────────────────────────────────────────────

export type ClientListRow = {
    name: string;
    phone?: string;
    email?: string;
    redotpay?: string;
    balance: number;
};

export function buildClientListPdf(rows: ClientListRow[]): ReportPayload {
    const today = new Date().toLocaleDateString(FR_LOCALE, { day: '2-digit', month: 'long', year: 'numeric' });
    const totalDebt = rows.reduce((s, r) => r.balance < 0 ? s + Math.abs(r.balance) : s, 0);
    const totalAdv = rows.reduce((s, r) => r.balance > 0 ? s + r.balance : s, 0);
    const withDebt = rows.filter((r) => r.balance < -0.01).length;
    const withAdv = rows.filter((r) => r.balance > 0.01).length;
    const thead = `<tr><th>#</th><th>Nom complet</th><th>Téléphone</th><th>Email Binance</th><th>Redotpay ID</th><th class="num">Solde DZD</th><th>Statut</th></tr>`;
    const tbody = rows.map((r, i) => {
        const cls = r.balance < -0.01 ? 'bad' : r.balance > 0.01 ? 'good' : 'muted';
        const label = r.balance < -0.01 ? 'Dette' : r.balance > 0.01 ? 'Avance' : 'Nul';
        return `<tr>
          <td class="muted">${i + 1}</td>
          <td><strong>${escapeHtml(r.name)}</strong></td>
          <td class="muted">${escapeHtml(r.phone || '—')}</td>
          <td class="muted">${escapeHtml(r.email || '—')}</td>
          <td class="muted">${escapeHtml(r.redotpay || '—')}</td>
          <td class="num ${cls}">${r.balance !== 0 ? (r.balance > 0 ? '+' : '') + formatNumber(r.balance, 0) : '0'} DZD</td>
          <td><span class="pill ${cls}">${label}</span></td>
        </tr>`;
    }).join('');
    const bodyHtml = `
    <section class="section">
      <h2 class="section-title">Synthèse</h2>
      <div class="executive-grid">
        <div class="executive-card primary"><div class="label">Total clients</div><div class="value">${rows.length}</div></div>
        <div class="executive-card loss"><div class="label">Total dettes</div><div class="value bad">${formatNumber(totalDebt, 0)} DZD</div><div class="muted">${withDebt} client${withDebt > 1 ? 's' : ''}</div></div>
        <div class="executive-card profit"><div class="label">Total avances</div><div class="value good">${formatNumber(totalAdv, 0)} DZD</div><div class="muted">${withAdv} client${withAdv > 1 ? 's' : ''}</div></div>
      </div>
      <div class="pill-row top"><span class="pill">Exporté le ${today}</span><span class="pill">${rows.length} clients</span></div>
    </section>
    <section class="section">
      <h2 class="section-title">Liste des clients</h2>
      <div class="table-wrap"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>
    </section>`;
    return reportShell({ fileName: `clients_${new Date().toISOString().slice(0, 10)}.pdf`, title: 'Liste des Clients', subtitle: `Exporté le ${today} · ${rows.length} clients`, bodyHtml });
}

export type InvestorListRow = {
    name: string;
    isManager: boolean;
    isActive: boolean;
    capitalInvested: number;
    availableProfit: number;
    withdrawnProfit: number;
    totalProfit: number;
    roi: number | null;
    entryDate: string;
};

export function buildInvestorListPdf(rows: InvestorListRow[]): ReportPayload {
    const today = new Date().toLocaleDateString(FR_LOCALE, { day: '2-digit', month: 'long', year: 'numeric' });
    const activeRows = rows.filter(r => r.isActive && !r.isManager);
    const totalCap = activeRows.reduce((s, r) => s + r.capitalInvested, 0);
    const totalAvail = rows.reduce((s, r) => s + r.availableProfit, 0);
    const totalGain = rows.reduce((s, r) => s + r.totalProfit, 0);
    const thead = `<tr><th>#</th><th>Nom</th><th>Rôle</th><th>Statut</th><th class="num">Capital investi</th><th class="num">Profit dispo.</th><th class="num">Total retiré</th><th class="num">Total gagné</th><th class="num">ROI %</th><th>Date entrée</th></tr>`;
    const tbody = rows.map((r, i) => {
        const roiCls = r.roi !== null ? (r.roi > 0 ? 'good' : r.roi < 0 ? 'bad' : '') : '';
        return `<tr>
          <td class="muted">${i + 1}</td>
          <td><strong>${escapeHtml(r.name)}</strong></td>
          <td class="muted">${r.isManager ? 'Gérant' : 'Investisseur'}</td>
          <td><span class="pill ${r.isActive ? 'profit' : ''}">${r.isActive ? 'Actif' : 'Inactif'}</span></td>
          <td class="num">${formatNumber(r.capitalInvested, 0)} DZD</td>
          <td class="num good">${formatNumber(r.availableProfit, 0)} DZD</td>
          <td class="num muted">${formatNumber(r.withdrawnProfit, 0)} DZD</td>
          <td class="num good">${formatNumber(r.totalProfit, 0)} DZD</td>
          <td class="num ${roiCls}">${r.roi !== null ? (r.roi > 0 ? '+' : '') + formatNumber(r.roi, 2) + ' %' : '—'}</td>
          <td class="muted">${escapeHtml(r.entryDate)}</td>
        </tr>`;
    }).join('');
    const bodyHtml = `
    <section class="section">
      <h2 class="section-title">Synthèse</h2>
      <div class="executive-grid">
        <div class="executive-card primary"><div class="label">Capital total (actifs)</div><div class="value">${formatNumber(totalCap, 0)} DZD</div><div class="muted">${activeRows.length} investisseur${activeRows.length > 1 ? 's' : ''}</div></div>
        <div class="executive-card profit"><div class="label">Profits disponibles</div><div class="value good">+${formatNumber(totalAvail, 0)} DZD</div></div>
        <div class="executive-card profit"><div class="label">Total gagné (cumulé)</div><div class="value good">+${formatNumber(totalGain, 0)} DZD</div></div>
      </div>
      <div class="pill-row top"><span class="pill">Exporté le ${today}</span><span class="pill">${rows.length} investisseur${rows.length > 1 ? 's' : ''}</span></div>
    </section>
    <section class="section">
      <h2 class="section-title">Liste des investisseurs</h2>
      <div class="table-wrap"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>
    </section>`;
    return reportShell({ fileName: `investisseurs_${new Date().toISOString().slice(0, 10)}.pdf`, title: 'Liste des Investisseurs', subtitle: `Exporté le ${today} · ${rows.length} investisseurs`, bodyHtml, pageSize: 'A4 landscape' });
}

export type TransactionListRow = {
    date: string;
    time: string;
    category: string;
    type: string;
    currency: string;
    quantity: string;
    price: string;
    totalDzd: string;
    client: string;
    notes: string;
    tags: string;
};

export function buildTransactionListPdf(rows: TransactionListRow[], subtitle: string): ReportPayload {
    const today = new Date().toLocaleDateString(FR_LOCALE, { day: '2-digit', month: 'long', year: 'numeric' });
    const cryptoRows = rows.filter(r => r.category === 'Portefeuille');
    const sellRows = cryptoRows.filter(r => r.type.toLowerCase().includes('vente') || r.type.toLowerCase().includes('sell'));
    const buyRows = cryptoRows.filter(r => r.type.toLowerCase().includes('achat') || r.type.toLowerCase().includes('buy'));
    const thead = `<tr><th>Date</th><th>Heure</th><th>Catégorie</th><th>Type</th><th>Devise</th><th class="num">Quantité</th><th class="num">Prix</th><th class="num">Total DZD</th><th>Client</th><th>Notes</th><th>Tags</th></tr>`;
    const tbody = rows.map(r => `<tr>
      <td class="muted">${escapeHtml(r.date)}</td>
      <td class="muted">${escapeHtml(r.time)}</td>
      <td><span class="pill small">${escapeHtml(r.category)}</span></td>
      <td><strong>${escapeHtml(r.type)}</strong></td>
      <td class="muted">${escapeHtml(r.currency)}</td>
      <td class="num">${escapeHtml(r.quantity)}</td>
      <td class="num">${escapeHtml(r.price)}</td>
      <td class="num"><strong>${escapeHtml(r.totalDzd)}</strong></td>
      <td class="muted">${escapeHtml(r.client)}</td>
      <td class="muted" style="max-width:140px;white-space:normal;font-size:11px">${escapeHtml(r.notes)}</td>
      <td>${r.tags ? r.tags.split(';').map(t => `<span class="pill small">${escapeHtml(t)}</span>`).join('') : ''}</td>
    </tr>`).join('');
    const bodyHtml = `
    <section class="section">
      <h2 class="section-title">Synthèse</h2>
      <div class="executive-grid">
        <div class="executive-card primary"><div class="label">Total opérations</div><div class="value">${rows.length}</div></div>
        <div class="executive-card"><div class="label">Achats portefeuille</div><div class="value good">${buyRows.length}</div></div>
        <div class="executive-card"><div class="label">Ventes portefeuille</div><div class="value bad">${sellRows.length}</div></div>
      </div>
      <div class="pill-row top"><span class="pill">Exporté le ${today}</span><span class="pill">${escapeHtml(subtitle)}</span></div>
    </section>
    <section class="section">
      <h2 class="section-title">Historique des opérations (${rows.length})</h2>
      <div class="table-wrap"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>
    </section>`;
    return reportShell({ fileName: `transactions_${new Date().toISOString().slice(0, 10)}.pdf`, title: 'Historique des Opérations', subtitle: `${subtitle} · ${rows.length} opérations`, bodyHtml, pageSize: 'A4 landscape' });
}

export type TreasuryMovementRow = {
    date: string;
    time: string;
    type: string;
    source: string;
    amount: number;
    notes: string;
    origin?: string;
};

export function buildTreasuryPdf(
    rows: TreasuryMovementRow[],
    balances: { caisse: number; baridi: number },
    periodLabel: string
): ReportPayload {
    const today = new Date().toLocaleDateString(FR_LOCALE, { day: '2-digit', month: 'long', year: 'numeric' });
    const totalIn = rows.reduce((s, r) => r.type === 'Ajout' || r.type === 'Adjustment (+)' ? s + r.amount : s, 0);
    const totalOut = rows.reduce((s, r) => r.type === 'Retrait' || r.type === 'Adjustment (-)' ? s + r.amount : s, 0);
    const netFlow = totalIn - totalOut;
    const thead = `<tr><th>Date</th><th>Heure</th><th>Type</th><th>Source</th><th class="num">Montant DZD</th><th>Notes</th></tr>`;
    const tbody = rows.map(r => {
        const isIn = r.type === 'Ajout' || r.type === 'Adjustment (+)';
        const cls = isIn ? 'good' : r.type === 'Transfer' ? 'muted' : 'bad';
        return `<tr>
          <td class="muted">${escapeHtml(r.date)}</td>
          <td class="muted">${escapeHtml(r.time)}</td>
          <td><span class="pill ${cls}">${escapeHtml(r.type)}</span></td>
          <td class="muted">${escapeHtml(r.source)}</td>
          <td class="num ${cls}">${isIn ? '+' : r.type !== 'Transfer' ? '−' : ''}${formatNumber(r.amount, 0)}</td>
          <td class="muted" style="max-width:200px;white-space:normal;font-size:11px">${escapeHtml(r.notes)}</td>
        </tr>`;
    }).join('');
    const bodyHtml = `
    <section class="section">
      <h2 class="section-title">Soldes actuels</h2>
      <div class="executive-grid">
        <div class="executive-card primary"><div class="label">Caisse</div><div class="value">${formatNumber(balances.caisse, 0)} DZD</div></div>
        <div class="executive-card primary"><div class="label">BaridiMob</div><div class="value">${formatNumber(balances.baridi, 0)} DZD</div></div>
        <div class="executive-card ${netFlow >= 0 ? 'profit' : 'loss'}"><div class="label">Flux net (période)</div><div class="value ${netFlow >= 0 ? 'good' : 'bad'}">${netFlow >= 0 ? '+' : ''}${formatNumber(netFlow, 0)} DZD</div></div>
      </div>
      <div class="movement-grid" style="margin-top:12px">
        <div class="movement-card"><div class="label">Total entrées</div><div class="value good">+${formatNumber(totalIn, 0)} DZD</div></div>
        <div class="movement-card"><div class="label">Total sorties</div><div class="value bad">−${formatNumber(totalOut, 0)} DZD</div></div>
        <div class="movement-card"><div class="label">Mouvements</div><div class="value">${rows.length}</div></div>
      </div>
      <div class="pill-row top"><span class="pill">Exporté le ${today}</span><span class="pill">${periodLabel}</span></div>
    </section>
    <section class="section">
      <h2 class="section-title">Mouvements de trésorerie (${rows.length})</h2>
      <div class="table-wrap"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>
    </section>`;
    return reportShell({ fileName: `tresorerie_${new Date().toISOString().slice(0, 10)}.pdf`, title: 'Rapport de Trésorerie', subtitle: `${periodLabel} · ${rows.length} mouvements`, bodyHtml, pageSize: 'A4 landscape' });
}
