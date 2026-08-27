import { getClientOperationLabel, getPortfolioOperationLabel } from './transactionTerminology';
const FR_LOCALE = 'fr-FR';
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function formatNumber(value, min = 2, max = min) {
    const safe = Number.isFinite(value) ? value : 0;
    return safe.toLocaleString(FR_LOCALE, {
        minimumFractionDigits: min,
        maximumFractionDigits: max
    });
}
function formatDateTime(timestamp) {
    return new Date(timestamp).toLocaleString(FR_LOCALE, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString(FR_LOCALE);
}
function sanitizeFileName(raw) {
    return raw
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_\-]/g, '')
        .replace(/_+/g, '_');
}
function reportShell(opts) {
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
      --bg: #f8fafc;
      --surface: #ffffff;
      --ink: #0f172a;
      --muted: #475569;
      --line: #e2e8f0;
      --brand: #0ea5e9;
      --good: #16a34a;
      --bad: #dc2626;
      --violet: #7c3aed;
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
      background: #0ea5e9;
      color: #ffffff;
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
      background:
        radial-gradient(circle at 0 0, rgba(14,165,233,0.16), transparent 48%),
        radial-gradient(circle at 100% 0, rgba(124,58,237,0.12), transparent 40%),
        #f8fbff;
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
      color: #0b4f70;
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
      background: #fff;
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
      background: #f1f5f9;
      color: #0f172a;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .num { text-align: right; white-space: nowrap; }
    .good { color: var(--good); font-weight: 700; }
    .bad { color: var(--bad); font-weight: 700; }
    .muted { color: var(--muted); }
    .empty {
      border: 1px dashed var(--line);
      border-radius: 10px;
      color: var(--muted);
      padding: 16px;
      text-align: center;
      background: #fafcff;
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
      background: #fff;
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
        background: white;
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
        background: #ffffff !important;
        border-bottom: 1px solid #cbd5e1;
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
function buildLinkedClientMap(clientTransactions) {
    const map = new Map();
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
function getMonthlyProfitByTxId(input) {
    return input.profitByTxId || input.pamLedger?.profitByTxId;
}
function getRealizedProfit(tx, profitByTxId) {
    if (tx.type !== 'sell')
        return 0;
    const derivedProfit = tx.id ? profitByTxId?.[tx.id]?.derivedProfit : undefined;
    return Number(derivedProfit ?? tx.profit ?? 0);
}
function buildUncostedQuantityWarningsHtml(rows) {
    const uncostedRows = rows.filter((row) => row.flags.uncostedQuantitySold && row.quantityWithoutCostBasis > 0);
    if (uncostedRows.length === 0)
        return '';
    const quantityWithoutCostBasis = uncostedRows.reduce((sum, row) => sum + row.quantityWithoutCostBasis, 0);
    const previewRows = uncostedRows.slice(0, 8);
    const hiddenCount = uncostedRows.length - previewRows.length;
    return `
    <section class="section">
      <h2 class="section-title">Alertes Comptables PAM</h2>
      <div style="margin-bottom: 10px;">
        <span class="pill">uncostedQuantitySold: ${uncostedRows.length}</span>
        <span class="pill">Quantite sans cout: ${formatNumber(quantityWithoutCostBasis)} ${escapeHtml(uncostedRows[0]?.currency || 'USDT')}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Transaction</th>
              <th>Devise</th>
              <th class="num">Quantite vendue</th>
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
                  <td class="num">${formatNumber(row.quantity)}</td>
                  <td class="num bad">${formatNumber(row.quantityWithoutCostBasis)}</td>
                  <td class="num ${row.derivedProfit >= 0 ? 'good' : 'bad'}">${row.derivedProfit >= 0 ? '+' : ''}${formatNumber(row.derivedProfit)} DZD</td>
                </tr>`)
        .join('')}
          </tbody>
        </table>
      </div>
      ${hiddenCount > 0 ? `<div class="muted" style="margin-top: 8px;">${hiddenCount} autre(s) transaction(s) masquee(s) dans cette synthese.</div>` : ''}
      <div class="muted" style="margin-top: 8px;">
        Alerte informative uniquement: ces montants ne sont pas retires du profit realise.
      </div>
    </section>
  `;
}
export function buildMonthlyPdfReport(input) {
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
    const clientNameById = new Map();
    input.clients.forEach((c) => clientNameById.set(c.id, input.getClientName(c)));
    const linkedClientMap = buildLinkedClientMap(input.clientTransactions);
    const ranksByClient = new Map();
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
        const row = ranksByClient.get(linked.clientId);
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
    const topRows = rankedRows;
    const sortedPeriodTxs = [...periodTxs].sort((a, b) => b.timestamp - a.timestamp);
    const periodClientRows = input.clientTransactions
        .filter((row) => row.timestamp >= startTs && row.timestamp <= endTs)
        .sort((a, b) => b.timestamp - a.timestamp);
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
      </div>`
        : '<div class="empty">Aucun classement client disponible sur cette periode.</div>';
    const portfolioTxTable = sortedPeriodTxs.length
        ? `<div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Client</th>
              <th class="num">Quantite</th>
              <th class="num">Prix Unit.</th>
              <th class="num">Total</th>
              <th class="num">Profit</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${sortedPeriodTxs
            .map((row) => {
            const linkedClientId = row.id ? linkedClientMap.get(row.id)?.clientId : undefined;
            const clientName = linkedClientId ? (clientNameById.get(linkedClientId) || 'Client inconnu') : 'Non lie';
            const typeLabel = getPortfolioOperationLabel(row.type, row.currency);
            const unitPrice = row.type === 'sell'
                ? Number(row.sell || 0)
                : Number(row.price || 0);
            const total = Number(typeof row.total === 'number' ? row.total : row.quantity * unitPrice);
            const profit = getRealizedProfit(row, profitByTxId);
            return `
                  <tr>
                    <td>${escapeHtml(formatDateTime(row.timestamp))}</td>
                    <td>${escapeHtml(typeLabel)}</td>
                    <td>${escapeHtml(clientName)}</td>
                    <td class="num">${formatNumber(row.quantity)}</td>
                    <td class="num">${formatNumber(unitPrice)}</td>
                    <td class="num">${formatNumber(total)}</td>
                    <td class="num ${row.type === 'sell' ? (profit >= 0 ? 'good' : 'bad') : ''}">
                      ${row.type === 'sell' ? `${profit >= 0 ? '+' : ''}${formatNumber(profit)}` : '-'}
                    </td>
                    <td>${escapeHtml(row.notes || '-')}</td>
                  </tr>`;
        })
            .join('')}
          </tbody>
        </table>
      </div>`
        : '<div class="empty">Aucune transaction portefeuille enregistree sur cette periode.</div>';
    const clientMovementsTable = periodClientRows.length
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
            ${periodClientRows
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
      </div>`
        : '<div class="empty">Aucun mouvement client DZD sur cette periode.</div>';
    const bodyHtml = `
    <section class="section">
      <h2 class="section-title">Synthese Mensuelle</h2>
      <div class="cards">
        <div class="card">
          <div class="label">Volume USDT achete</div>
          <div class="value">${formatNumber(volUsdtBought)} USDT</div>
        </div>
        <div class="card">
          <div class="label">Volume USDT vendu</div>
          <div class="value">${formatNumber(volUsdtSold)} USDT</div>
        </div>
        <div class="card">
          <div class="label">Volume EUR achete</div>
          <div class="value">${formatNumber(volEurBought)} EUR</div>
        </div>
        <div class="card">
          <div class="label">Volume EUR vendu</div>
          <div class="value">${formatNumber(volEurSold)} EUR</div>
        </div>
        <div class="card">
          <div class="label">Profit realise</div>
          <div class="value ${realizedProfit >= 0 ? 'good' : 'bad'}">${realizedProfit >= 0 ? '+' : ''}${formatNumber(realizedProfit)} DZD</div>
        </div>
      </div>
      <div style="margin-top: 10px;">
        <span class="pill">Achats Portefeuille: ${buyCount}</span>
        <span class="pill">Ventes Client: ${sellCount}</span>
        <span class="pill">Transactions total: ${periodTxs.length}</span>
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
      <div style="margin-top: 10px;" class="pill">
        Profit net cumule: <strong class="${globalNetProfit >= 0 ? 'good' : 'bad'}">${globalNetProfit >= 0 ? '+' : ''}${formatNumber(globalNetProfit)} DZD</strong>
      </div>
    </section>

    ${uncostedWarningsHtml}

    <section class="section">
      <h2 class="section-title">Top Clients du Mois (${topRows.length})</h2>
      ${rankingTable}
    </section>

    <section class="section">
      <h2 class="section-title">Journal Complet Transactions Portefeuille (Mois)</h2>
      ${portfolioTxTable}
    </section>

    <section class="section">
      <h2 class="section-title">Journal Mouvements Clients DZD (Mois)</h2>
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
export function buildClientPdfReport(input) {
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
    const txById = new Map();
    input.transactions.forEach((tx) => txById.set(tx.id, tx));
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
                ? `${getPortfolioOperationLabel(linked.type, linked.currency)} - ${formatNumber(linked.quantity)} @ ${formatNumber(Number(linked.type === 'sell' ? (linked.sell || 0) : (linked.price || 0)))}`
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
      <h2 class="section-title">Profil Client</h2>
      <div style="margin-bottom: 8px;">
        <span class="pill">Client: ${escapeHtml(clientName)}</span>
        ${client.phone ? `<span class="pill">Tel: ${escapeHtml(client.phone)}</span>` : ''}
        ${client.redotpayId ? `<span class="pill">RedotPay: ${escapeHtml(client.redotpayId)}</span>` : ''}
        ${client.binanceEmail ? `<span class="pill">Binance: ${escapeHtml(client.binanceEmail)}</span>` : ''}
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Synthese du Mois</h2>
      <div class="cards">
        <div class="card">
          <div class="label">Solde ouverture</div>
          <div class="value ${openingBalance >= 0 ? 'good' : 'bad'}">${openingBalance >= 0 ? '+' : ''}${formatNumber(openingBalance)} DZD</div>
        </div>
        <div class="card">
          <div class="label">Solde cloture (mois)</div>
          <div class="value ${closingBalance >= 0 ? 'good' : 'bad'}">${closingBalance >= 0 ? '+' : ''}${formatNumber(closingBalance)} DZD</div>
        </div>
        <div class="card">
          <div class="label">Total encaisse (credits)</div>
          <div class="value good">+${formatNumber(periodCredits)} DZD</div>
        </div>
        <div class="card">
          <div class="label">Total debourse (debits)</div>
          <div class="value bad">-${formatNumber(periodDebits)} DZD</div>
        </div>
      </div>
      <div style="margin-top: 10px;">
        <span class="pill">Operations: ${periodRows.length}</span>
        <span class="pill">Mouvement net: ${periodNet >= 0 ? '+' : ''}${formatNumber(periodNet)} DZD</span>
        <span class="pill">Solde actuel global: ${input.clientBalance >= 0 ? '+' : ''}${formatNumber(input.clientBalance)} DZD</span>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Journal des Operations (Periode)</h2>
      ${historyHtml}
    </section>
  `;
    return reportShell({
        fileName: `${rawFileName || 'releve_client'}.pdf`,
        title: 'Releve Client',
        subtitle: `${clientName} - ${input.monthLabel} ${input.year}`,
        bodyHtml
    });
}
function investorTxTypeLabel(type) {
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
export function buildInvestorPdfReport(input) {
    const orderedTxs = [...input.investorTransactions].sort((a, b) => b.timestamp - a.timestamp);
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
    const historyHtml = orderedTxs.length
        ? `<div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th class="num">Montant</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            ${orderedTxs
            .map((tx) => {
            const positive = tx.type === 'deposit_capital' || tx.type === 'reinvest_profit' || tx.type === 'profit_distribution';
            return `
                  <tr>
                    <td>${escapeHtml(formatDateTime(tx.timestamp))}</td>
                    <td>${escapeHtml(investorTxTypeLabel(tx.type))}</td>
                    <td class="num ${positive ? 'good' : 'bad'}">${positive ? '+' : '-'}${formatNumber(tx.amount)} DZD</td>
                    <td>${escapeHtml(tx.notes || '-')}</td>
                  </tr>`;
        })
            .join('')}
          </tbody>
        </table>
      </div>`
        : '<div class="empty">Aucun mouvement investisseur enregistre.</div>';
    const investorName = input.investor.name || 'investisseur';
    const bodyHtml = `
    <section class="section">
      <h2 class="section-title">Synthese Investisseur</h2>
      <div class="cards">
        <div class="card">
          <div class="label">Capital investi</div>
          <div class="value">${formatNumber(input.investor.capitalInvested)} DZD</div>
        </div>
        <div class="card">
          <div class="label">Part actuelle</div>
          <div class="value">${formatNumber((input.investor.sharePercentage || 0) * 100, 2, 2)}%</div>
        </div>
        <div class="card">
          <div class="label">Profit total attribue</div>
          <div class="value ${investorTotalProfit >= 0 ? 'good' : 'bad'}">${investorTotalProfit >= 0 ? '+' : ''}${formatNumber(investorTotalProfit)} DZD</div>
        </div>
        <div class="card">
          <div class="label">Profit disponible</div>
          <div class="value ${investorAvailableProfit >= 0 ? 'good' : 'bad'}">${investorAvailableProfit >= 0 ? '+' : ''}${formatNumber(investorAvailableProfit)} DZD</div>
        </div>
      </div>
      <div style="margin-top: 10px;">
        <span class="pill">Ajouts capital: ${formatNumber(depositCapital)} DZD</span>
        <span class="pill">Retraits capital: ${formatNumber(withdrawCapital)} DZD</span>
        <span class="pill">Retraits benefices: ${formatNumber(withdrawnProfit)} DZD</span>
        <span class="pill">Reinvesti: ${formatNumber(reinvestedProfit)} DZD</span>
      </div>
      ${input.investor.notes ? `<div style="margin-top: 10px;" class="muted"><strong>Notes:</strong> ${escapeHtml(input.investor.notes)}</div>` : ''}
    </section>

    <section class="section">
      <h2 class="section-title">Journal des Operations</h2>
      ${historyHtml}
    </section>
  `;
    return reportShell({
        fileName: `${sanitizeFileName(`rapport_investisseur_${investorName}`) || 'rapport_investisseur'}.pdf`,
        title: 'Rapport Investisseur',
        subtitle: `${investorName} - Entree le ${formatDate(new Date(input.investor.entryDate).getTime())}`,
        bodyHtml
    });
}
export function openPdfPrintWindow(report) {
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
