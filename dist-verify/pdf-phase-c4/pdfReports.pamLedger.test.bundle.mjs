// scripts/pdfReports.pamLedger.test.ts
import assert from "node:assert/strict";

// src/utils/transactionTerminology.ts
function canonicalize(raw) {
  return raw.trim().toLowerCase().replace(/\u00e3[\u00a8\u00a9\u00aa]/g, "e").replace(/\u00e3\u00a7/g, "c").replace(/\u00e3[\u00a0\u00a2]/g, "a").replace(/\u00e3[\u00b9\u00bb]/g, "u").replace(/\u00e3\u00b4/g, "o").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9+()\- ]/g, " ").replace(/\s+/g, " ").trim();
}
function getPortfolioOperationLabel(type, currency) {
  const normalized = canonicalize(String(type || ""));
  const safeCurrency = (currency || "").trim() || "USDT";
  if (normalized === "buy") return `Achat ${safeCurrency} (Portefeuille)`;
  if (normalized === "sell") return `Vente ${safeCurrency} au Client`;
  if (normalized === "ajout manuel") return "Ajustement + Portefeuille";
  if (normalized === "retrait manuel") return "Ajustement - Portefeuille";
  return String(type || "Operation Portefeuille");
}
function getClientOperationLabel(type) {
  const normalized = canonicalize(String(type || ""));
  if (normalized.includes("reglement") && normalized.includes("recu")) return "Encaissement Client";
  if (normalized.includes("paiement") && normalized.includes("effect")) return "Decaissement Client";
  if (normalized === "vente usdt") return "Vente USDT au Client";
  if (normalized === "vente eur") return "Vente EUR au Client";
  if (normalized === "achat eur") return "Achat EUR (Portefeuille)";
  if (normalized === "solde initial") return "Solde Initial Client";
  if (normalized === "transfert entrant") return "Transfert Recu (Clients)";
  if (normalized === "transfert sortant") return "Transfert Envoye (Clients)";
  if (normalized === "ajustement solde") return "Correction Solde Client";
  return String(type || "Operation Client");
}

// src/utils/pdfReports.ts
var FR_LOCALE = "fr-FR";
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function reportShell(opts) {
  const generatedAt = (/* @__PURE__ */ new Date()).toLocaleString(FR_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.fileName.replace(".pdf", ""))}</title>
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
      size: ${opts.pageSize || "A4"};
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
  const map = /* @__PURE__ */ new Map();
  for (const row of clientTransactions) {
    if (!row.linkedTxId || !row.clientId) continue;
    const isSecondary = row.linkRole === "dzd_receiver";
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
function getRealizedProfit(tx2, profitByTxId) {
  if (tx2.type !== "sell") return 0;
  const derivedProfit = tx2.id ? profitByTxId?.[tx2.id]?.derivedProfit : void 0;
  return Number(derivedProfit ?? tx2.profit ?? 0);
}
function buildUncostedQuantityWarningsHtml(rows) {
  const uncostedRows = rows.filter((row) => row.flags.uncostedQuantitySold && row.quantityWithoutCostBasis > 0);
  if (uncostedRows.length === 0) return "";
  const quantityWithoutCostBasis = uncostedRows.reduce((sum, row) => sum + row.quantityWithoutCostBasis, 0);
  const previewRows = uncostedRows.slice(0, 8);
  const hiddenCount = uncostedRows.length - previewRows.length;
  return `
    <section class="section">
      <h2 class="section-title">Alertes Comptables PAM</h2>
      <div style="margin-bottom: 10px;">
        <span class="pill">uncostedQuantitySold: ${uncostedRows.length}</span>
        <span class="pill">Quantite sans cout: ${formatNumber(quantityWithoutCostBasis)} ${escapeHtml(uncostedRows[0]?.currency || "USDT")}</span>
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
            ${previewRows.map(
    (row) => `
                <tr>
                  <td>${escapeHtml(formatDateTime(row.timestamp))}</td>
                  <td>${escapeHtml(row.txId)}</td>
                  <td>${escapeHtml(row.currency)}</td>
                  <td class="num">${formatNumber(row.quantity)}</td>
                  <td class="num bad">${formatNumber(row.quantityWithoutCostBasis)}</td>
                  <td class="num ${row.derivedProfit >= 0 ? "good" : "bad"}">${row.derivedProfit >= 0 ? "+" : ""}${formatNumber(row.derivedProfit)} DZD</td>
                </tr>`
  ).join("")}
          </tbody>
        </table>
      </div>
      ${hiddenCount > 0 ? `<div class="muted" style="margin-top: 8px;">${hiddenCount} autre(s) transaction(s) masquee(s) dans cette synthese.</div>` : ""}
      <div class="muted" style="margin-top: 8px;">
        Alerte informative uniquement: ces montants ne sont pas retires du profit realise.
      </div>
    </section>
  `;
}
function buildMonthlyPdfReport(input) {
  const startTs = new Date(input.year, input.month, 1).getTime();
  const endTs = new Date(input.year, input.month + 1, 0, 23, 59, 59, 999).getTime();
  const periodTxs = input.transactions.filter((tx2) => tx2.timestamp >= startTs && tx2.timestamp <= endTs);
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
  for (const tx2 of periodTxs) {
    if (tx2.currency === "USDT" && tx2.type === "buy") {
      volUsdtBought += tx2.quantity;
      buyCount += 1;
    }
    if (tx2.currency === "USDT" && tx2.type === "sell") {
      volUsdtSold += tx2.quantity;
    }
    if (tx2.currency === "EUR" && tx2.type === "buy") {
      volEurBought += tx2.quantity;
    }
    if (tx2.currency === "EUR" && tx2.type === "sell") {
      volEurSold += tx2.quantity;
    }
    if (tx2.type === "sell") {
      realizedProfit += getRealizedProfit(tx2, profitByTxId);
      sellCount += 1;
    }
  }
  const clientNameById = /* @__PURE__ */ new Map();
  input.clients.forEach((c) => clientNameById.set(c.id, input.getClientName(c)));
  const linkedClientMap = buildLinkedClientMap(input.clientTransactions);
  const ranksByClient = /* @__PURE__ */ new Map();
  for (const tx2 of periodTxs) {
    if (tx2.type !== "buy" && tx2.type !== "sell") continue;
    if (!tx2.id) continue;
    const linked = linkedClientMap.get(tx2.id);
    if (!linked) continue;
    if (!ranksByClient.has(linked.clientId)) {
      ranksByClient.set(linked.clientId, {
        clientId: linked.clientId,
        clientName: clientNameById.get(linked.clientId) || "Client inconnu",
        buyVolumeUsdt: 0,
        sellVolumeUsdt: 0,
        totalVolumeUsdt: 0,
        realizedProfit: 0,
        txCount: 0
      });
    }
    const row = ranksByClient.get(linked.clientId);
    if (tx2.type === "buy" && tx2.currency === "USDT") row.buyVolumeUsdt += tx2.quantity;
    if (tx2.type === "sell") {
      if (tx2.currency === "USDT") row.sellVolumeUsdt += tx2.quantity;
      row.realizedProfit += getRealizedProfit(tx2, profitByTxId);
    }
    row.txCount += 1;
  }
  const rankedRows = Array.from(ranksByClient.values()).map((row) => ({ ...row, totalVolumeUsdt: row.buyVolumeUsdt + row.sellVolumeUsdt })).sort((a, b) => {
    if (b.totalVolumeUsdt !== a.totalVolumeUsdt) return b.totalVolumeUsdt - a.totalVolumeUsdt;
    if (b.realizedProfit !== a.realizedProfit) return b.realizedProfit - a.realizedProfit;
    return a.clientName.localeCompare(b.clientName, "fr");
  });
  const topRows = rankedRows;
  const sortedPeriodTxs = [...periodTxs].sort((a, b) => b.timestamp - a.timestamp);
  const periodClientRows = input.clientTransactions.filter((row) => row.timestamp >= startTs && row.timestamp <= endTs).sort((a, b) => b.timestamp - a.timestamp);
  const rankingTable = topRows.length ? `<div class="table-wrap">
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
            ${topRows.map(
    (row, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(row.clientName)}</td>
                  <td class="num">${formatNumber(row.buyVolumeUsdt)}</td>
                  <td class="num">${formatNumber(row.sellVolumeUsdt)}</td>
                  <td class="num"><strong>${formatNumber(row.totalVolumeUsdt)}</strong></td>
                  <td class="num ${row.realizedProfit >= 0 ? "good" : "bad"}">${row.realizedProfit >= 0 ? "+" : ""}${formatNumber(row.realizedProfit)} DZD</td>
                  <td class="num">${row.txCount}</td>
                </tr>`
  ).join("")}
          </tbody>
        </table>
      </div>` : '<div class="empty">Aucun classement client disponible sur cette periode.</div>';
  const portfolioTxTable = sortedPeriodTxs.length ? `<div class="table-wrap">
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
            ${sortedPeriodTxs.map((row) => {
    const linkedClientId = row.id ? linkedClientMap.get(row.id)?.clientId : void 0;
    const clientName = linkedClientId ? clientNameById.get(linkedClientId) || "Client inconnu" : "Non lie";
    const typeLabel = getPortfolioOperationLabel(row.type, row.currency);
    const unitPrice = row.type === "sell" ? Number(row.sell || 0) : Number(row.price || 0);
    const total = Number(typeof row.total === "number" ? row.total : row.quantity * unitPrice);
    const profit = getRealizedProfit(row, profitByTxId);
    return `
                  <tr>
                    <td>${escapeHtml(formatDateTime(row.timestamp))}</td>
                    <td>${escapeHtml(typeLabel)}</td>
                    <td>${escapeHtml(clientName)}</td>
                    <td class="num">${formatNumber(row.quantity)}</td>
                    <td class="num">${formatNumber(unitPrice)}</td>
                    <td class="num">${formatNumber(total)}</td>
                    <td class="num ${row.type === "sell" ? profit >= 0 ? "good" : "bad" : ""}">
                      ${row.type === "sell" ? `${profit >= 0 ? "+" : ""}${formatNumber(profit)}` : "-"}
                    </td>
                    <td>${escapeHtml(row.notes || "-")}</td>
                  </tr>`;
  }).join("")}
          </tbody>
        </table>
      </div>` : '<div class="empty">Aucune transaction portefeuille enregistree sur cette periode.</div>';
  const clientMovementsTable = periodClientRows.length ? `<div class="table-wrap">
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
            ${periodClientRows.map((row) => {
    const clientName = clientNameById.get(row.clientId) || "Client inconnu";
    const amount = Number(row.montant || 0);
    const label = getClientOperationLabel(row.type);
    return `
                  <tr>
                    <td>${escapeHtml(formatDateTime(row.timestamp))}</td>
                    <td>${escapeHtml(clientName)}</td>
                    <td>${escapeHtml(label)}</td>
                    <td class="num ${amount >= 0 ? "good" : "bad"}">${amount >= 0 ? "+" : ""}${formatNumber(amount)}</td>
                    <td>${escapeHtml(row.notes || "-")}</td>
                  </tr>`;
  }).join("")}
          </tbody>
        </table>
      </div>` : '<div class="empty">Aucun mouvement client DZD sur cette periode.</div>';
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
          <div class="value ${realizedProfit >= 0 ? "good" : "bad"}">${realizedProfit >= 0 ? "+" : ""}${formatNumber(realizedProfit)} DZD</div>
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
        Profit net cumule: <strong class="${globalNetProfit >= 0 ? "good" : "bad"}">${globalNetProfit >= 0 ? "+" : ""}${formatNumber(globalNetProfit)} DZD</strong>
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
    fileName: `rapport_mensuel_${input.year}_${String(input.month + 1).padStart(2, "0")}.pdf`,
    title: "Rapport Mensuel",
    subtitle: `${input.monthLabel} ${input.year}`,
    bodyHtml,
    pageSize: "A4 landscape"
  });
}

// src/utils/pamLedger.ts
var DEFAULT_TOLERANCE_DZD = 1;
var DEFAULT_ZERO_EPSILON = 5e-3;
var DEFAULT_CONVERSION_WINDOW_MS = 6e4;
var CURRENCIES = ["USDT", "EUR"];
function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}
function normalizeZero(value, zeroEpsilon) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return Object.is(safe, -0) || Math.abs(safe) < zeroEpsilon ? 0 : round2(safe);
}
function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function isFinitePositive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}
function createWorkingStats() {
  return { purchasedQty: 0, costBasis: 0, totalProfit: 0, available: 0 };
}
function toLedgerStats(stats, zeroEpsilon) {
  const purchasedQty = normalizeZero(stats.purchasedQty, zeroEpsilon);
  const costBasis = purchasedQty === 0 ? 0 : normalizeZero(stats.costBasis, zeroEpsilon);
  const avgBuy = purchasedQty > 0 ? costBasis / purchasedQty : 0;
  return {
    purchasedQty,
    costBasis,
    avgBuy: normalizeZero(avgBuy, zeroEpsilon),
    totalProfit: normalizeZero(stats.totalProfit, zeroEpsilon),
    available: normalizeZero(stats.available, zeroEpsilon)
  };
}
function normalizeCurrency(currency) {
  return currency === "EUR" ? "EUR" : "USDT";
}
function getTxId(tx2, index) {
  return tx2.id || `(row-${index + 1})`;
}
function getTxQuantity(tx2) {
  return round2(Math.abs(asNumber(tx2.quantity, 0)));
}
function sortTransactions(transactions) {
  return transactions.map((tx2, index) => ({ ...tx2, currency: normalizeCurrency(tx2.currency), __ledgerIndex: index })).sort((a, b) => {
    const timestampDiff = asNumber(a.timestamp, 0) - asNumber(b.timestamp, 0);
    if (timestampDiff !== 0) return timestampDiff;
    return a.__ledgerIndex - b.__ledgerIndex;
  });
}
function createFlags() {
  return {
    storedMismatch: false,
    oversell: false,
    manualTotalPresent: false,
    quantityOnlyAdjustment: false,
    uncostedQuantitySold: false,
    legacyFallback: false,
    eurConversionRelated: false
  };
}
function makeWarning(txId, currency, code, severity, message) {
  return { txId, currency, code, severity, message };
}
function hasConversionNote(tx2) {
  return String(tx2.notes || "").toLowerCase().includes("achat de");
}
function findEurConversionRelatedTxIds(transactions, conversionWindowMs) {
  const relatedIds = /* @__PURE__ */ new Set();
  const eurWithdrawals = transactions.filter((tx2) => normalizeCurrency(tx2.currency) === "EUR" && tx2.type === "Retrait Manuel" && (hasConversionNote(tx2) || Boolean(tx2.linkedTxId)));
  const usdtBuys = transactions.filter((tx2) => normalizeCurrency(tx2.currency) === "USDT" && tx2.type === "buy");
  for (const withdrawal of eurWithdrawals) {
    const withdrawalId = getTxId(withdrawal, withdrawal.__ledgerIndex);
    const linkedBuy = usdtBuys.find((buy) => {
      const buyId = getTxId(buy, buy.__ledgerIndex);
      const linked = withdrawal.linkedTxId === buyId || buy.linkedTxId === withdrawalId;
      const nearInTime = Math.abs(asNumber(buy.timestamp) - asNumber(withdrawal.timestamp)) <= conversionWindowMs;
      return linked || nearInTime;
    });
    if (linkedBuy) {
      relatedIds.add(withdrawalId);
      relatedIds.add(getTxId(linkedBuy, linkedBuy.__ledgerIndex));
    }
  }
  return relatedIds;
}
function buildPortfolioStats(statsByCurrency, zeroEpsilon) {
  const usdt = toLedgerStats(statsByCurrency.USDT, zeroEpsilon);
  const eur = toLedgerStats(statsByCurrency.EUR, zeroEpsilon);
  return { usdt, eur };
}
function computePamLedger(transactions, options = {}) {
  const toleranceDzd = options.toleranceDzd ?? DEFAULT_TOLERANCE_DZD;
  const zeroEpsilon = options.zeroEpsilon ?? DEFAULT_ZERO_EPSILON;
  const conversionWindowMs = options.conversionWindowMs ?? DEFAULT_CONVERSION_WINDOW_MS;
  const orderedTransactions = sortTransactions(transactions);
  const eurConversionRelatedIds = findEurConversionRelatedTxIds(orderedTransactions, conversionWindowMs);
  const statsByCurrency = {
    USDT: createWorkingStats(),
    EUR: createWorkingStats()
  };
  const operationRows = [];
  const sellProfitRows = [];
  const profitByTxId = {};
  const warnings = [];
  const seenEurConversionBuy = { USDT: false, EUR: false };
  for (const tx2 of orderedTransactions) {
    const txId = getTxId(tx2, tx2.__ledgerIndex);
    const currency = normalizeCurrency(tx2.currency);
    const stats = statsByCurrency[currency];
    const quantity = getTxQuantity(tx2);
    if (quantity <= 0) continue;
    const flags = createFlags();
    const rowWarnings = [];
    const statsBefore = toLedgerStats(stats, zeroEpsilon);
    let quantityChange = 0;
    let costBasisChange = 0;
    let sellRowData = null;
    if (eurConversionRelatedIds.has(txId) || tx2.type === "sell" && seenEurConversionBuy[currency]) {
      flags.eurConversionRelated = true;
      rowWarnings.push(makeWarning(
        txId,
        currency,
        "eur_conversion_related",
        "info",
        "Transaction is linked to, or follows, an observed EUR -> USDT conversion in the ledger history."
      ));
    }
    if (tx2.type === "Ajout Manuel" && !isFinitePositive(tx2.total)) {
      flags.quantityOnlyAdjustment = true;
      rowWarnings.push(makeWarning(
        txId,
        currency,
        "quantity_only_adjustment",
        "info",
        "Manual stock adjustment changes quantity without adding cost basis."
      ));
    }
    if (tx2.type === "sell") {
      const avgBefore = statsBefore.purchasedQty > 0 ? statsBefore.costBasis / statsBefore.purchasedQty : 0;
      const sellPrice = asNumber(tx2.sell, 0);
      const formulaSellTotal = quantity * sellPrice;
      const txTotal = asNumber(tx2.total, 0);
      flags.manualTotalPresent = isFinitePositive(tx2.total) && Math.abs(txTotal - formulaSellTotal) > toleranceDzd;
      const sellTotal = flags.manualTotalPresent ? txTotal : formulaSellTotal;
      const effectiveSellPrice = quantity > 0 ? sellTotal / quantity : sellPrice;
      const quantityWithoutCostBasis = Math.max(0, quantity - statsBefore.purchasedQty);
      flags.oversell = quantity > statsBefore.available + zeroEpsilon;
      flags.uncostedQuantitySold = quantityWithoutCostBasis > zeroEpsilon;
      flags.legacyFallback = statsBefore.purchasedQty <= zeroEpsilon || !isFinitePositive(effectiveSellPrice);
      const derivedProfit2 = flags.legacyFallback && !isFinitePositive(effectiveSellPrice) ? 0 : round2((effectiveSellPrice - avgBefore) * quantity);
      const hasStoredProfit = Number.isFinite(Number(tx2.profit));
      const storedProfit2 = hasStoredProfit ? round2(asNumber(tx2.profit)) : null;
      const difference = storedProfit2 === null ? null : round2(storedProfit2 - derivedProfit2);
      flags.storedMismatch = difference !== null && Math.abs(difference) > toleranceDzd;
      if (flags.manualTotalPresent) {
        rowWarnings.push(makeWarning(
          txId,
          currency,
          "manual_total_present",
          "info",
          "Sell total differs from quantity x sell price and is used as sale revenue."
        ));
      }
      if (flags.oversell) {
        rowWarnings.push(makeWarning(
          txId,
          currency,
          "oversell",
          "high",
          "Sell quantity exceeds available historical stock before the transaction."
        ));
      }
      if (flags.uncostedQuantitySold) {
        rowWarnings.push(makeWarning(
          txId,
          currency,
          "uncosted_quantity_sold",
          flags.oversell ? "high" : "warning",
          "Sell quantity includes units without historical cost basis, usually from quantity-only manual stock adjustments or stock gaps."
        ));
      }
      if (flags.legacyFallback) {
        rowWarnings.push(makeWarning(
          txId,
          currency,
          "legacy_fallback",
          "warning",
          "Historical PAM has missing cost basis or invalid sell revenue before this sell."
        ));
      }
      if (flags.storedMismatch) {
        rowWarnings.push(makeWarning(
          txId,
          currency,
          "stored_mismatch",
          Math.abs(difference || 0) > 1e3 ? "high" : "warning",
          "Stored tx.profit differs from historical derived PAM profit."
        ));
      }
      sellRowData = {
        sellPrice: round2(sellPrice),
        sellTotal: round2(sellTotal),
        historicalAvgBuy: round2(avgBefore),
        costedQuantityBeforeSell: statsBefore.purchasedQty,
        quantityWithoutCostBasis: round2(quantityWithoutCostBasis),
        storedProfit: storedProfit2,
        hasStoredProfit,
        derivedProfit: derivedProfit2,
        difference
      };
      stats.totalProfit = round2(stats.totalProfit + derivedProfit2);
    }
    if (tx2.type === "buy" || tx2.type === "Ajout Manuel") {
      stats.available = round2(stats.available + quantity);
      quantityChange = quantity;
    } else {
      stats.available = round2(stats.available - quantity);
      quantityChange = -quantity;
    }
    if (tx2.type === "Ajout Manuel" && isFinitePositive(tx2.total)) {
      const total = round2(asNumber(tx2.total));
      stats.purchasedQty = round2(stats.purchasedQty + quantity);
      stats.costBasis = round2(stats.costBasis + total);
      costBasisChange = total;
    } else if (tx2.type === "buy") {
      const total = round2(asNumber(tx2.total, 0));
      stats.purchasedQty = round2(stats.purchasedQty + quantity);
      stats.costBasis = round2(stats.costBasis + total);
      costBasisChange = total;
      if (!isFinitePositive(tx2.total)) {
        rowWarnings.push(makeWarning(
          txId,
          currency,
          "missing_buy_total",
          "warning",
          "Buy transaction does not add a positive cost basis."
        ));
      }
    } else if (tx2.type === "sell" || tx2.type === "Retrait Manuel") {
      const avgBuy = statsBefore.purchasedQty > 0 ? statsBefore.costBasis / statsBefore.purchasedQty : 0;
      const removedQty = Math.min(quantity, statsBefore.purchasedQty);
      const removedCost = round2(removedQty * avgBuy);
      stats.purchasedQty = round2(stats.purchasedQty - removedQty);
      stats.costBasis = round2(stats.costBasis - removedCost);
      costBasisChange = -removedCost;
      if (stats.purchasedQty < 1e-5) {
        stats.purchasedQty = 0;
        stats.costBasis = 0;
      }
    }
    if (Math.abs(stats.available) < zeroEpsilon) {
      stats.available = 0;
      stats.purchasedQty = 0;
      stats.costBasis = 0;
    }
    const statsAfter = toLedgerStats(stats, zeroEpsilon);
    const operationRow = {
      txId,
      tx: tx2,
      index: tx2.__ledgerIndex,
      type: tx2.type,
      currency,
      date: tx2.date,
      time: tx2.time,
      timestamp: asNumber(tx2.timestamp, 0),
      quantity,
      quantityChange: round2(quantityChange),
      costBasisChange: round2(costBasisChange),
      statsBefore,
      statsAfter,
      flags,
      warnings: rowWarnings
    };
    operationRows.push(operationRow);
    warnings.push(...rowWarnings);
    if (sellRowData) {
      const sellProfitRow = {
        ...operationRow,
        ...sellRowData,
        type: "sell"
      };
      sellProfitRows.push(sellProfitRow);
      profitByTxId[txId] = sellProfitRow;
    }
    if (eurConversionRelatedIds.has(txId) && tx2.type === "buy" && currency === "USDT") {
      seenEurConversionBuy.USDT = true;
    }
  }
  for (const currency of CURRENCIES) {
    const stats = statsByCurrency[currency];
    stats.available = normalizeZero(stats.available, zeroEpsilon);
    if (stats.available === 0) {
      stats.purchasedQty = 0;
      stats.costBasis = 0;
    }
    stats.purchasedQty = normalizeZero(stats.purchasedQty, zeroEpsilon);
    stats.costBasis = stats.purchasedQty === 0 ? 0 : normalizeZero(stats.costBasis, zeroEpsilon);
    stats.totalProfit = normalizeZero(stats.totalProfit, zeroEpsilon);
  }
  const byCurrency = CURRENCIES.reduce((acc, currency) => {
    const rows = sellProfitRows.filter((row) => row.currency === currency);
    const derivedProfit2 = round2(rows.reduce((sum, row) => sum + row.derivedProfit, 0));
    const storedProfit2 = round2(rows.reduce((sum, row) => sum + (row.storedProfit || 0), 0));
    acc[currency] = {
      derivedProfit: derivedProfit2,
      storedProfit: storedProfit2,
      difference: round2(storedProfit2 - derivedProfit2)
    };
    return acc;
  }, {});
  const derivedProfit = round2(CURRENCIES.reduce((sum, currency) => sum + byCurrency[currency].derivedProfit, 0));
  const storedProfit = round2(CURRENCIES.reduce((sum, currency) => sum + byCurrency[currency].storedProfit, 0));
  return {
    portfolioStats: buildPortfolioStats(statsByCurrency, zeroEpsilon),
    operationRows,
    sellProfitRows,
    profitByTxId,
    totals: {
      derivedProfit,
      storedProfit,
      difference: round2(storedProfit - derivedProfit),
      byCurrency
    },
    warnings
  };
}

// scripts/pdfReports.pamLedger.test.ts
function tx(input) {
  return {
    date: "01/01/2026",
    time: "10:00",
    currency: "USDT",
    ...input
  };
}
function clientTx(input) {
  return {
    date: "01/01/2026",
    time: "10:00",
    ...input
  };
}
function formatNumber2(value) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
var clients = [
  { id: "client-a", fullName: "Client A" }
];
test("monthly PDF uses derived PAM profit for realized profit, client ranking, and transaction table", () => {
  const targetTimestamp = new Date(2026, 0, 24, 20, 43).getTime();
  const transactions = [
    tx({
      id: "jGd0-opening-cost",
      timestamp: new Date(2026, 0, 24, 19, 0).getTime(),
      date: "24/01/2026",
      time: "19:00",
      type: "buy",
      quantity: 1e3,
      price: 248.651,
      total: 248651
    }),
    tx({
      id: "jGd0Hug9GvHZ3pxrSrDR",
      timestamp: targetTimestamp,
      date: "24/01/2026",
      time: "20:43",
      type: "sell",
      quantity: 1e3,
      sell: 249.5,
      profit: 2944.0575946601084,
      notes: "target-jGd0-report-check"
    })
  ];
  const clientTransactions = [
    clientTx({
      id: "client-link-jGd0",
      clientId: "client-a",
      timestamp: targetTimestamp,
      date: "24/01/2026",
      time: "20:43",
      type: "Vente USDT",
      montant: -249500,
      linkedTxId: "jGd0Hug9GvHZ3pxrSrDR"
    })
  ];
  const ledger = computePamLedger(transactions);
  const targetRow = ledger.profitByTxId.jGd0Hug9GvHZ3pxrSrDR;
  assert.equal(targetRow.storedProfit, 2944.06);
  assert.equal(targetRow.derivedProfit, 849);
  const report = buildMonthlyPdfReport({
    month: 0,
    year: 2026,
    monthLabel: "Janvier",
    transactions,
    clientTransactions,
    clients,
    getClientName: (client) => client.fullName,
    portfolioStats: ledger.portfolioStats,
    pamLedger: ledger
  });
  const derivedProfitText = formatNumber2(849);
  const storedProfitText = formatNumber2(2944.06);
  assert.ok(report.html.includes(`+${derivedProfitText} DZD`), "monthly realized profit should use derived PAM profit");
  assert.ok(!report.html.includes(storedProfitText), "stored tx.profit snapshot should not be rendered in the monthly PDF");
  const clientIndex = report.html.indexOf("Client A");
  assert.notEqual(clientIndex, -1);
  const clientSegment = report.html.slice(clientIndex, clientIndex + 700);
  assert.ok(clientSegment.includes(`+${derivedProfitText} DZD`), "client ranking should use derived PAM profit");
  const txIndex = report.html.indexOf("target-jGd0-report-check");
  assert.notEqual(txIndex, -1);
  const txSegment = report.html.slice(Math.max(0, txIndex - 700), txIndex + 300);
  assert.ok(txSegment.includes(`+${derivedProfitText}`), "transaction table should use derived PAM profit");
  assert.ok(!txSegment.includes(storedProfitText), "transaction row should not show stored tx.profit snapshot");
});
test("monthly PDF renders uncostedQuantitySold warnings without subtracting them from profit", () => {
  const sellTimestamp = new Date(2026, 1, 3, 12, 0).getTime();
  const transactions = [
    tx({
      id: "buy-costed-stock",
      timestamp: new Date(2026, 1, 1, 10, 0).getTime(),
      date: "01/02/2026",
      time: "10:00",
      type: "buy",
      quantity: 100,
      price: 100,
      total: 1e4
    }),
    tx({
      id: "qty-only-adjustment",
      timestamp: new Date(2026, 1, 2, 10, 0).getTime(),
      date: "02/02/2026",
      time: "10:00",
      type: "Ajout Manuel",
      quantity: 10,
      price: 0
    }),
    tx({
      id: "sell-uncosted",
      timestamp: sellTimestamp,
      date: "03/02/2026",
      time: "12:00",
      type: "sell",
      quantity: 105,
      sell: 110,
      profit: 1050,
      notes: "uncosted-report-check"
    })
  ];
  const ledger = computePamLedger(transactions);
  const sellRow = ledger.profitByTxId["sell-uncosted"];
  assert.equal(sellRow.derivedProfit, 1050);
  assert.equal(sellRow.quantityWithoutCostBasis, 5);
  assert.equal(sellRow.flags.uncostedQuantitySold, true);
  const report = buildMonthlyPdfReport({
    month: 1,
    year: 2026,
    monthLabel: "Fevrier",
    transactions,
    clientTransactions: [],
    clients: [],
    getClientName: (client) => client.fullName,
    portfolioStats: ledger.portfolioStats,
    pamLedger: ledger
  });
  assert.ok(report.html.includes("Alertes Comptables PAM"));
  assert.ok(report.html.includes("uncostedQuantitySold: 1"));
  assert.ok(report.html.includes("sell-uncosted"));
  assert.ok(report.html.includes(formatNumber2(5)));
  assert.ok(report.html.includes(`+${formatNumber2(1050)} DZD`), "uncosted warning must not remove realized profit");
});
