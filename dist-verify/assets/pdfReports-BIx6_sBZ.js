import{g as z,a as _}from"./transactionTerminology-CK8LtPmo.js";const P="fr-FR";function r(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function s(t,o=2,i=o){return(Number.isFinite(t)?t:0).toLocaleString(P,{minimumFractionDigits:o,maximumFractionDigits:i})}function T(t){return new Date(t).toLocaleString(P,{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}function Z(t){return new Date(t).toLocaleDateString(P)}function L(t){return t.toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_\-]/g,"").replace(/_+/g,"_")}function C(t){const o=new Date().toLocaleString(P,{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}),i=`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${r(t.fileName.replace(".pdf",""))}</title>
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
      size: ${t.pageSize||"A4"};
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
      <h1 class="title">${r(t.title)}</h1>
      <div class="subtitle">${r(t.subtitle)}</div>
      <div class="meta">Genere le ${r(o)}</div>
    </header>
    <main class="body">
      ${t.bodyHtml}
      <div class="footer">
        Document genere automatiquement par l'application. Format recommande: Impression &gt; Save as PDF.
      </div>
    </main>
  </article>
</body>
</html>`;return{fileName:t.fileName,html:i}}function V(t){const o=new Map;for(const i of t){if(!i.linkedTxId||!i.clientId)continue;const n=i.linkRole==="dzd_receiver",d=o.get(i.linkedTxId);if(!d){o.set(i.linkedTxId,{clientId:i.clientId,timestamp:i.timestamp,isSecondary:n});continue}if(d.isSecondary&&!n){o.set(i.linkedTxId,{clientId:i.clientId,timestamp:i.timestamp,isSecondary:n});continue}d.isSecondary===n&&i.timestamp>d.timestamp&&o.set(i.linkedTxId,{clientId:i.clientId,timestamp:i.timestamp,isSecondary:n})}return o}function E(t){const o=new Date(t.year,t.month,1).getTime(),i=new Date(t.year,t.month+1,0,23,59,59,999).getTime(),n=t.transactions.filter(e=>e.timestamp>=o&&e.timestamp<=i);let d=0,u=0,b=0,v=0,h=0,l=0;for(const e of n)e.currency==="USDT"&&e.type==="buy"&&(d+=e.quantity,h+=1),e.currency==="USDT"&&e.type==="sell"&&(u+=e.quantity,v+=Number(e.profit||0),l+=1),e.currency==="EUR"&&e.type==="buy"&&(b+=e.quantity);const p=new Map;t.clients.forEach(e=>p.set(e.id,t.getClientName(e)));const y=V(t.clientTransactions),g=new Map;for(const e of n){if(e.currency!=="USDT"||e.type!=="buy"&&e.type!=="sell"||!e.id)continue;const c=y.get(e.id);if(!c)continue;g.has(c.clientId)||g.set(c.clientId,{clientId:c.clientId,clientName:p.get(c.clientId)||"Client inconnu",buyVolumeUsdt:0,sellVolumeUsdt:0,totalVolumeUsdt:0,realizedProfit:0,txCount:0});const f=g.get(c.clientId);e.type==="buy"&&(f.buyVolumeUsdt+=e.quantity),e.type==="sell"&&(f.sellVolumeUsdt+=e.quantity,f.realizedProfit+=Number(e.profit||0)),f.txCount+=1}const $=Array.from(g.values()).map(e=>({...e,totalVolumeUsdt:e.buyVolumeUsdt+e.sellVolumeUsdt})).sort((e,c)=>c.totalVolumeUsdt!==e.totalVolumeUsdt?c.totalVolumeUsdt-e.totalVolumeUsdt:c.realizedProfit!==e.realizedProfit?c.realizedProfit-e.realizedProfit:e.clientName.localeCompare(c.clientName,"fr")),w=[...n].sort((e,c)=>c.timestamp-e.timestamp),a=t.clientTransactions.filter(e=>e.timestamp>=o&&e.timestamp<=i).sort((e,c)=>c.timestamp-e.timestamp),m=$.length?`<div class="table-wrap">
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
            ${$.map((e,c)=>`
                <tr>
                  <td>${c+1}</td>
                  <td>${r(e.clientName)}</td>
                  <td class="num">${s(e.buyVolumeUsdt)}</td>
                  <td class="num">${s(e.sellVolumeUsdt)}</td>
                  <td class="num"><strong>${s(e.totalVolumeUsdt)}</strong></td>
                  <td class="num ${e.realizedProfit>=0?"good":"bad"}">${e.realizedProfit>=0?"+":""}${s(e.realizedProfit)} DZD</td>
                  <td class="num">${e.txCount}</td>
                </tr>`).join("")}
          </tbody>
        </table>
      </div>`:'<div class="empty">Aucun classement client disponible sur cette periode.</div>',k=w.length?`<div class="table-wrap">
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
            ${w.map(e=>{var R;const c=e.id?(R=y.get(e.id))==null?void 0:R.clientId:void 0,f=c?p.get(c)||"Client inconnu":"Non lie",N=z(e.type,e.currency),I=e.type==="sell"?Number(e.sell||0):Number(e.price||0),M=Number(typeof e.total=="number"?e.total:e.quantity*I),S=Number(e.profit||0);return`
                  <tr>
                    <td>${r(T(e.timestamp))}</td>
                    <td>${r(N)}</td>
                    <td>${r(f)}</td>
                    <td class="num">${s(e.quantity)}</td>
                    <td class="num">${s(I)}</td>
                    <td class="num">${s(M)}</td>
                    <td class="num ${e.type==="sell"?S>=0?"good":"bad":""}">
                      ${e.type==="sell"?`${S>=0?"+":""}${s(S)}`:"-"}
                    </td>
                    <td>${r(e.notes||"-")}</td>
                  </tr>`}).join("")}
          </tbody>
        </table>
      </div>`:'<div class="empty">Aucune transaction portefeuille enregistree sur cette periode.</div>',x=a.length?`<div class="table-wrap">
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
            ${a.map(e=>{const c=p.get(e.clientId)||"Client inconnu",f=Number(e.montant||0),N=_(e.type);return`
                  <tr>
                    <td>${r(T(e.timestamp))}</td>
                    <td>${r(c)}</td>
                    <td>${r(N)}</td>
                    <td class="num ${f>=0?"good":"bad"}">${f>=0?"+":""}${s(f)}</td>
                    <td>${r(e.notes||"-")}</td>
                  </tr>`}).join("")}
          </tbody>
        </table>
      </div>`:'<div class="empty">Aucun mouvement client DZD sur cette periode.</div>',U=`
    <section class="section">
      <h2 class="section-title">Synthese Mensuelle</h2>
      <div class="cards">
        <div class="card">
          <div class="label">Volume USDT achete</div>
          <div class="value">${s(d)} USDT</div>
        </div>
        <div class="card">
          <div class="label">Volume USDT vendu</div>
          <div class="value">${s(u)} USDT</div>
        </div>
        <div class="card">
          <div class="label">Volume EUR achete</div>
          <div class="value">${s(b)} EUR</div>
        </div>
        <div class="card">
          <div class="label">Profit realise</div>
          <div class="value ${v>=0?"good":"bad"}">${v>=0?"+":""}${s(v)} DZD</div>
        </div>
      </div>
      <div style="margin-top: 10px;">
        <span class="pill">Achats Portefeuille: ${h}</span>
        <span class="pill">Ventes Client: ${l}</span>
        <span class="pill">Transactions total: ${n.length}</span>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Etat Portefeuille (Actuel)</h2>
      <div class="cards">
        <div class="card">
          <div class="label">USDT disponible</div>
          <div class="value">${s(t.portfolioStats.usdt.available)} USDT</div>
          <div class="muted">PAM: ${s(t.portfolioStats.usdt.avgBuy)} DZD</div>
        </div>
        <div class="card">
          <div class="label">EUR disponible</div>
          <div class="value">${s(t.portfolioStats.eur.available)} EUR</div>
          <div class="muted">PAM: ${s(t.portfolioStats.eur.avgBuy)} DZD</div>
        </div>
      </div>
      <div style="margin-top: 10px;" class="pill">
        Profit net cumule: <strong class="${t.portfolioStats.usdt.totalProfit>=0?"good":"bad"}">${t.portfolioStats.usdt.totalProfit>=0?"+":""}${s(t.portfolioStats.usdt.totalProfit)} DZD</strong>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Top Clients du Mois (${$.length})</h2>
      ${m}
    </section>

    <section class="section">
      <h2 class="section-title">Journal Complet Transactions Portefeuille (Mois)</h2>
      ${k}
    </section>

    <section class="section">
      <h2 class="section-title">Journal Mouvements Clients DZD (Mois)</h2>
      ${x}
    </section>
  `;return C({fileName:`rapport_mensuel_${t.year}_${String(t.month+1).padStart(2,"0")}.pdf`,title:"Rapport Mensuel",subtitle:`${t.monthLabel} ${t.year}`,bodyHtml:U,pageSize:"A4 landscape"})}function j(t){const o=t.clients.find(a=>a.id===t.clientId);if(!o)return null;const i=t.clientTransactions.filter(a=>a.clientId===t.clientId).sort((a,m)=>a.timestamp-m.timestamp),n=new Date(t.year,t.month,1).getTime(),d=new Date(t.year,t.month+1,0,23,59,59,999).getTime(),u=i.filter(a=>a.timestamp>=n&&a.timestamp<=d).sort((a,m)=>m.timestamp-a.timestamp),b=i.filter(a=>a.timestamp<n).reduce((a,m)=>a+Number(m.montant||0),0),v=u.reduce((a,m)=>a+Number(m.montant||0),0),h=u.filter(a=>Number(a.montant||0)>0).reduce((a,m)=>a+Number(m.montant||0),0),l=u.filter(a=>Number(a.montant||0)<0).reduce((a,m)=>a+Math.abs(Number(m.montant||0)),0),p=b+v,y=new Map;t.transactions.forEach(a=>y.set(a.id,a));const g=u.length?`<div class="table-wrap">
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
            ${u.map(a=>{const m=a.linkedTxId?y.get(a.linkedTxId):void 0,k=m?`${z(m.type,m.currency)} - ${s(m.quantity)} @ ${s(Number(m.type==="sell"?m.sell||0:m.price||0))}`:"-",x=Number(a.montant||0),U=_(a.type);return`
                  <tr>
                    <td>${r(T(a.timestamp))}</td>
                    <td>${r(U)}</td>
                    <td class="num ${x>=0?"good":"bad"}">${x>=0?"+":""}${s(x)} DZD</td>
                    <td>${r(k)}</td>
                    <td>${r(a.notes||"-")}</td>
                  </tr>`}).join("")}
          </tbody>
        </table>
      </div>`:'<div class="empty">Aucune operation client pour cette periode.</div>',D=t.getClientName(o),$=L(`releve_client_${D}_${t.year}_${String(t.month+1).padStart(2,"0")}`),w=`
    <section class="section">
      <h2 class="section-title">Profil Client</h2>
      <div style="margin-bottom: 8px;">
        <span class="pill">Client: ${r(D)}</span>
        ${o.phone?`<span class="pill">Tel: ${r(o.phone)}</span>`:""}
        ${o.redotpayId?`<span class="pill">RedotPay: ${r(o.redotpayId)}</span>`:""}
        ${o.binanceEmail?`<span class="pill">Binance: ${r(o.binanceEmail)}</span>`:""}
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Synthese du Mois</h2>
      <div class="cards">
        <div class="card">
          <div class="label">Solde ouverture</div>
          <div class="value ${b>=0?"good":"bad"}">${b>=0?"+":""}${s(b)} DZD</div>
        </div>
        <div class="card">
          <div class="label">Solde cloture (mois)</div>
          <div class="value ${p>=0?"good":"bad"}">${p>=0?"+":""}${s(p)} DZD</div>
        </div>
        <div class="card">
          <div class="label">Total encaisse (credits)</div>
          <div class="value good">+${s(h)} DZD</div>
        </div>
        <div class="card">
          <div class="label">Total debourse (debits)</div>
          <div class="value bad">-${s(l)} DZD</div>
        </div>
      </div>
      <div style="margin-top: 10px;">
        <span class="pill">Operations: ${u.length}</span>
        <span class="pill">Mouvement net: ${v>=0?"+":""}${s(v)} DZD</span>
        <span class="pill">Solde actuel global: ${t.clientBalance>=0?"+":""}${s(t.clientBalance)} DZD</span>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Journal des Operations (Periode)</h2>
      ${g}
    </section>
  `;return C({fileName:`${$||"releve_client"}.pdf`,title:"Releve Client",subtitle:`${D} - ${t.monthLabel} ${t.year}`,bodyHtml:w})}function A(t){switch(t){case"deposit_capital":return"Ajout Capital";case"withdraw_capital":return"Retrait Capital";case"profit_distribution":return"Distribution Profit";case"withdraw_profit":return"Retrait Benefices";case"reinvest_profit":return"Reinvestissement";default:return t}}function F(t){const o=[...t.investorTransactions].sort((l,p)=>p.timestamp-l.timestamp),i=o.filter(l=>l.type==="deposit_capital").reduce((l,p)=>l+p.amount,0),n=o.filter(l=>l.type==="withdraw_capital").reduce((l,p)=>l+p.amount,0),d=o.filter(l=>l.type==="reinvest_profit").reduce((l,p)=>l+p.amount,0),u=o.filter(l=>l.type==="withdraw_profit").reduce((l,p)=>l+p.amount,0),b=o.length?`<div class="table-wrap">
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
            ${o.map(l=>{const p=l.type==="deposit_capital"||l.type==="reinvest_profit"||l.type==="profit_distribution";return`
                  <tr>
                    <td>${r(T(l.timestamp))}</td>
                    <td>${r(A(l.type))}</td>
                    <td class="num ${p?"good":"bad"}">${p?"+":"-"}${s(l.amount)} DZD</td>
                    <td>${r(l.notes||"-")}</td>
                  </tr>`}).join("")}
          </tbody>
        </table>
      </div>`:'<div class="empty">Aucun mouvement investisseur enregistre.</div>',v=t.investor.name||"investisseur",h=`
    <section class="section">
      <h2 class="section-title">Synthese Investisseur</h2>
      <div class="cards">
        <div class="card">
          <div class="label">Capital investi</div>
          <div class="value">${s(t.investor.capitalInvested)} DZD</div>
        </div>
        <div class="card">
          <div class="label">Part actuelle</div>
          <div class="value">${s((t.investor.sharePercentage||0)*100,2,2)}%</div>
        </div>
        <div class="card">
          <div class="label">Profit total attribue</div>
          <div class="value good">+${s(t.investor.totalProfit||0)} DZD</div>
        </div>
        <div class="card">
          <div class="label">Profit disponible</div>
          <div class="value ${(t.investor.availableProfit||0)>=0?"good":"bad"}">${(t.investor.availableProfit||0)>=0?"+":""}${s(t.investor.availableProfit||0)} DZD</div>
        </div>
      </div>
      <div style="margin-top: 10px;">
        <span class="pill">Ajouts capital: ${s(i)} DZD</span>
        <span class="pill">Retraits capital: ${s(n)} DZD</span>
        <span class="pill">Retraits benefices: ${s(u)} DZD</span>
        <span class="pill">Reinvesti: ${s(d)} DZD</span>
      </div>
      ${t.investor.notes?`<div style="margin-top: 10px;" class="muted"><strong>Notes:</strong> ${r(t.investor.notes)}</div>`:""}
    </section>

    <section class="section">
      <h2 class="section-title">Journal des Operations</h2>
      ${b}
    </section>
  `;return C({fileName:`${L(`rapport_investisseur_${v}`)||"rapport_investisseur"}.pdf`,title:"Rapport Investisseur",subtitle:`${v} - Entree le ${Z(new Date(t.investor.entryDate).getTime())}`,bodyHtml:h})}function O(t){if(typeof window>"u")return!1;const o=/android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent||"")||typeof window.matchMedia=="function"&&window.matchMedia("(max-width: 900px)").matches;if(o)try{const i=new Blob([t.html],{type:"text/html;charset=utf-8"}),n=URL.createObjectURL(i);if(window.open(n,"_blank"))return window.setTimeout(()=>URL.revokeObjectURL(n),12e4),!0;URL.revokeObjectURL(n)}catch(i){console.error("Mobile PDF open failed:",i)}try{const i=window.open("","_blank");if(i){if(i.document.open(),i.document.write(t.html),i.document.close(),o)return!0;const n=()=>{i.setTimeout(()=>{try{i.focus(),i.print()}catch(d){console.error("PDF print failed:",d)}},320)};return i.document.readyState==="complete"?n():i.addEventListener("load",n,{once:!0}),i.onafterprint=()=>{try{i.close()}catch(d){console.error("PDF window close failed:",d)}},!0}}catch(i){console.error("Popup print failed:",i)}try{const i=new Blob([t.html],{type:"text/html;charset=utf-8"}),n=URL.createObjectURL(i),d=document.createElement("a");return d.href=n,d.target="_blank",d.rel="noopener",document.body.appendChild(d),d.click(),document.body.removeChild(d),window.setTimeout(()=>URL.revokeObjectURL(n),12e4),!0}catch(i){return console.error("Iframe fallback failed:",i),!1}}export{j as buildClientPdfReport,F as buildInvestorPdfReport,E as buildMonthlyPdfReport,O as openPdfPrintWindow};
