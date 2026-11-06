/* SWIFT gpi Pulse — çekirdek: veri, yardımcılar, filtreler, gezinme */
'use strict';
const M = window.SWIFT_META;
const DAY0 = new Date(2026, 4, 1); // 1 Mayıs 2026 (TR saati, veri tabanı)
const DATA_END = Math.round((Date.parse(M.dataEnd) - Date.parse(M.base)) / 60000);
const ST = {
  ACCC: {l: 'Tamamlandı (ACCC)', c: '#0e7a3c', d: 'Alıcı banka ödemeyi müşteri hesabına alacaklandırdı.'},
  RJCT: {l: 'Reddedildi (RJCT)', c: '#d03b3b', d: 'Zincirdeki bir banka ödemeyi reddetti.'},
  PEND_BEN: {l: 'Alıcı bankada bekliyor', c: '#fab219', d: 'Ödeme alıcı bankaya ulaştı, alacak kaydı henüz teyit edilmedi (G002/G003/G004).'},
  NONGPI: {l: 'gpi-dışı alıcıya teslim', c: '#8aa39a', d: 'Son gpi bankası ödemeyi gpi üyesi olmayan alıcı bankaya iletti (G001); nihai alacak teyidi gelmez.'},
  ACC_INT: {l: 'Aracı ACCC (alıcı teyidi yok)', c: '#ec835a', d: 'ACCC mesajı alıcı banka değil aracı/muhabir banka tarafından gönderildi.'},
  IN_NET: {l: 'Muhabir ağında', c: '#ec835a', d: 'Ödeme henüz alıcı bankaya ulaşmadı.'},
  NO_TRK: {l: 'Takip mesajı yok', c: '#6f8a80', d: 'Bu UETR için veri penceresinde tracker mesajı yok.'}
};
const CODE = {
  'ACSP/G000': 'Bir sonraki gpi bankasına iletildi', 'ACSP/G001': 'gpi üyesi olmayan bankaya iletildi (takip sınırlı)',
  'ACSP/G002': 'Alacak kaydı beklemede olabilir', 'ACSP/G003': 'Belge / ek bilgi bekleniyor', 'ACSP/G004': 'Fon bekleniyor (kapak ödeme gelmedi)',
  'ACCC': 'Alacak kaydedildi', 'RJCT': 'Reddedildi', 'PDCR': 'Durdur & Geri çağır (gSRP) talebi işlemde', 'WARN': 'Uyarı',
  MS03: 'Belirtilmemiş neden', AC01: 'Hatalı hesap numarası', AC04: 'Kapalı hesap', AC06: 'Bloke hesap', BE01: 'Alıcı adı / hesap uyuşmazlığı',
  RC01: 'Hatalı BIC', RR03: 'Alacaklı adı/adresi eksik (regülasyon)', RR05: 'Regülasyon bilgisi eksik/hatalı', CUST: 'Müşteri talebi',
  FOCR: 'İptal talebi sonrası iade', FF07: 'Geçersiz amaç / format', AM06: 'Tutar çok düşük', G002: 'Alacak kaydı beklemede', G003: 'Belge bekleniyor', G004: 'Fon bekleniyor'
};
const TYPES = M.types, STATES = M.states;
const DOW = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
// --- işlemleri çöz
const TX = window.SWIFT_TX.map((r, i) => {
  const t0 = r[0], st0 = r[1], d = Math.floor(t0 / 1440), h = Math.floor((t0 % 1440) / 60);
  return {i, t0, st0, day: d, sday: Math.floor(st0 / 1440), hour: h, min: t0 % 1440, dow: (4 + d) % 7, ccy: M.ccys[r[2]] || '', amt: r[3], corr: r[4], ben: r[5], ctry: r[6],
    type: r[7], chr: r[8], st: STATES[r[9]],
    totC: r[10], netC: r[11], benC: r[12], totM: r[13], netM: r[14], benM: r[15], totS: r[16], netS: r[17], benS: r[18],
    route: M.routes[r[19]] || '', last: r[20], pend: r[21], rj: r[22],
    fee: r[23], cred: r[24], recall: r[25], ctot: r[26], cnet: r[27], cben: r[28], cfin: r[29], uetr: r[30], ref: r[31], badts: r[32], benbic: r[33],
    vstat: r[34], late: r[35], vd: r[36], split: r[37] || 0, age: r[38] != null ? r[38] : DATA_END - st0};
});
for (const t of TX) t.hops = Math.min(4, t.route ? t.route.split('>').length : 1);
const HOPL = {1: 'Doğrudan (1 banka)', 2: '2 banka', 3: '3 banka', 4: '4+ banka'};
// --- süre bazı: C = takvim süresi (başlangıçtan alacak kaydına geçen tüm süre)
//                S = reel işlem süresi (alıcı bankanın kapalı olduğu gece/hafta sonu/tatil saatleri hariç)
const METRICS = {C: 'İşlem süresi'};
const SET = {m: 'C', out: true, sv: false};
try { const sv = JSON.parse(localStorage.getItem('swiftSet') || '{}'); if (sv.m && METRICS[sv.m]) SET.m = sv.m; if (typeof sv.out === 'boolean') SET.out = sv.out; if (typeof sv.sv === 'boolean') SET.sv = sv.sv; } catch (e) {}
function applyMetric() { const m = SET.m; for (const t of TX) { t.tot = t['tot' + m]; t.net = t['net' + m]; t.benm = t['ben' + m]; } }
applyMetric();
window.SWIFT_TX = null;
const BANK = M.banks.map(b => ({bic: b[0], name: b[1] || b[0], ctry: b[0].slice(4, 6)}));
const BIX = {}; BANK.forEach((b, i) => BIX[b.bic] = i);

// --- yardımcılar
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const nf = (x, d = 0) => x == null || isNaN(x) ? '—' : Number(x).toLocaleString('tr-TR', {maximumFractionDigits: d, minimumFractionDigits: d});
const pct = (x, d = 0) => x == null || isNaN(x) ? '—' : '%' + nf(x * 100, d);
function dur(m, short) {
  if (m == null || isNaN(m)) return '—';
  if (m < 60) return nf(m) + ' dk';
  if (m < 1440) return nf(m / 60, 1) + ' sa';
  return nf(m / 1440, 1) + ' gün';
}
function q(arr, p) { // arr sıralı
  if (!arr.length) return null;
  const k = (arr.length - 1) * p, f = Math.floor(k), c = Math.ceil(k);
  return f === c ? arr[f] : arr[f] + (arr[c] - arr[f]) * (k - f);
}
const sorted = a => a.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y);
const med = a => q(sorted(a), .5);
function groupBy(arr, fn) { const m = new Map(); for (const x of arr) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; }
function dayLabel(d) { const x = new Date(DAY0); x.setDate(x.getDate() + d); return x.toLocaleDateString('tr-TR', {day: '2-digit', month: 'short'}); }
function tLabel(t) { // t: dk (TR)
  const x = new Date(DAY0.getTime() + t * 60000);
  return x.toLocaleDateString('tr-TR', {day: '2-digit', month: 'short'}) + ' ' + x.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'});
}
function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function ctryName(cc) { return (M.countries[cc] && M.countries[cc].n) || cc; }
function flagEmoji(cc) { return cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🏳'; }
function flag(cc, lg) {
  if (!cc) return '';
  return `<img class="flag${lg ? ' lg' : ''}" alt="${h(cc)}" src="https://flagcdn.com/w80/${cc.toLowerCase()}.png" onerror="this.outerHTML='<span style=&quot;font-size:${lg ? 30 : 16}px&quot;>${flagEmoji(cc)}</span>'">`;
}
const STOP = new Set(['THE', 'BANK', 'BANKASI', 'OF', 'A.S.', 'AS', 'AG', 'SA', 'S.A.', 'N.A.', 'NA', 'LTD', 'LIMITED', 'PLC', 'CO', 'AND', '-', 'T.A.S.', 'TAS', 'A.Ş.', 'SPA', 'S.P.A.', 'JSC', 'OJSC', 'PJSC', 'INC', 'CORP', 'BANCO', 'BANQUE', 'BANCA', 'DE', 'DI', 'LA', 'ANONIM', 'SIRKETI', 'TURKIYE', 'K.S.C.P.', 'GROUP', 'CORPORATION', 'COMPANY']);
function initials(b) {
  const w = (b.name || '').toUpperCase().replace(/[(),.]/g, ' ').split(/\s+/).filter(x => x && !STOP.has(x) && /^[A-ZÇĞİÖŞÜ]/.test(x));
  if (w.length >= 2) return w[0][0] + w[1][0];
  if (w.length === 1) return w[0].slice(0, 2);
  return b.bic.slice(0, 2);
}
function hue(s) { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) % 360; return x; }
function mono(bi, lg) {
  const b = BANK[bi]; if (!b) return `<span class="mono${lg ? ' lg' : ''}" style="background:#4b6b60">?</span>`;
  const hh = hue(b.bic.slice(0, 4));
  return `<span class="mono${lg ? ' lg' : ''}" title="${h(b.name)}" style="background:linear-gradient(135deg,hsl(${hh},58%,46%),hsl(${(hh + 40) % 360},55%,30%))">${h(initials(b))}</span>`;
}
function bankCell(bi, extra = '') {
  const b = BANK[bi]; if (!b) return '—';
  return `<div class="bank">${mono(bi)}<div style="min-width:0"><div class="nm">${h(b.name)}</div><div class="bic">${flag(b.ctry)} ${h(b.bic)} ${extra}</div></div></div>`;
}
function stChip(s) { return `<span class="st st-${s}">${h(ST[s].l)}</span>`; }
function codeDesc(c) { if (!c) return ''; if (CODE[c]) return CODE[c]; const p = c.split('/'); return (CODE[p[0]] || p[0]) + (p[1] ? ' · ' + (CODE[p[1]] || p[1]) : ''); }
const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  flow: '<path d="M4 6h6l4 6h6M4 18h6l4-6"/><circle cx="20" cy="12" r="1.5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>',
  crystal: '<path d="M12 3l3 6 6 1-4.5 4 1 6L12 17l-5.5 3 1-6L3 10l6-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  spark: '<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  book: '<path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 8h6M8 12h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', check: '<path d="M5 12l5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h6"/>'
};
const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

// --- grafik yardımcıları
let CHARTS = [];
function chart(el, opt) {
  const c = echarts.init(el, null, {renderer: 'canvas'});
  c.setOption(Object.assign(baseOpt(), opt));
  CHARTS.push(c); return c;
}
function baseOpt() {
  const t2 = cssv('--t2'), t3 = cssv('--t3'), grid = cssv('--grid'), axis = cssv('--axis');
  return {
    textStyle: {fontFamily: 'inherit', color: t2},
    grid: {left: 50, right: 18, top: 28, bottom: 34, containLabel: true},
    tooltip: {trigger: 'axis', backgroundColor: cssv('--cardS') || '#123', borderColor: cssv('--line'), textStyle: {color: cssv('--t1'), fontSize: 12}, confine: true},
    xAxisDefault: null,
    _ax: {axisLine: {lineStyle: {color: axis}}, axisTick: {show: false}, axisLabel: {color: t3, fontSize: 11}, splitLine: {lineStyle: {color: grid}}}
  };
}
function ax(extra) { const b = baseOpt()._ax; return Object.assign({}, b, extra || {}); }
const SER = () => [cssv('--s1'), cssv('--s2'), cssv('--s3'), cssv('--s4'), cssv('--s5'), cssv('--s6')];
window.addEventListener('resize', () => CHARTS.forEach(c => c.resize()));

// --- filtreler
const F = {from: 0, to: 25, ccy: new Set(), ctry: new Set(), corr: new Set(), ben: new Set(), type: new Set(), hops: new Set()};
let FX = TX;
const maxDay = Math.max(...TX.map(t => t.day));
const isoDay = d => { const x = new Date(DAY0); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const dayOf = iso => Math.round((new Date(iso + 'T00:00:00') - DAY0) / 86400000);
F.to = maxDay;
function applyFilters() {
  FX = TX.filter(t => t.day >= F.from && t.day <= F.to && (!F.ccy.size || F.ccy.has(t.ccy)) && (!F.ctry.size || F.ctry.has(t.ctry)) &&
    (!F.corr.size || F.corr.has(t.corr)) && (!F.ben.size || F.ben.has(t.ben)) && (!F.type.size || F.type.has(t.type)) && (!F.hops.size || F.hops.has(t.hops)) && (!SET.sv || t.vstat === 0));
  $('#countPill').textContent = nf(FX.length) + ' / ' + nf(TX.length) + ' işlem';
  renderSelBadge(); renderFilterBar(); route(true);
}
function optsFor(key) {
  const m = new Map();
  for (const t of TX) { const k = t[key]; if (k === '' || k == null || k < 0 && key !== 'type') continue; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => key === 'hops' ? a[0] - b[0] : b[1] - a[1]);
}
const FDEF = [
  {k: 'ccy', l: 'Döviz', lab: v => v},
  {k: 'ctry', l: 'Ülke', lab: v => flagEmoji(v) + ' ' + ctryName(v)},
  {k: 'ben', l: 'Alıcı Banka', lab: v => BANK[v].name + ' · ' + BANK[v].bic},
  {k: 'corr', l: 'Muhabir', lab: v => BANK[v].name + ' · ' + BANK[v].bic},
  {k: 'type', l: 'İşlem Tipi', lab: v => TYPES[v]},
  {k: 'hops', l: 'Rota Uzunluğu', lab: v => HOPL[v]}
];
const OPTS = {}; FDEF.forEach(d => OPTS[d.k] = optsFor(d.k));
let openSel = null;
function renderFilterBar() {
  const el = $('#filterbar');
  const dd = (d) => {
    const s = F[d.k], act = s.size > 0;
    const lbl = act ? (s.size === 1 ? d.lab([...s][0]).slice(0, 26) : `${d.l} (${s.size})`) : d.l;
    return `<div class="fsel${openSel === d.k ? ' open' : ''}" data-k="${d.k}"><button class="${act ? 'act' : ''}">${h(lbl)} ▾</button>
      <div class="fpop"><input placeholder="Ara…" data-s="${d.k}"><div class="opts"></div><div class="fa"><a data-clr="${d.k}">Temizle</a><a data-cls>Kapat</a></div></div></div>`;
  };
  const dateOpt = (sel) => Array.from({length: maxDay + 1}, (_, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${dayLabel(i)} ${DOW[(4 + i) % 7]}</option>`).join('');
  el.innerHTML = `<span class="fb-l">Filtre</span>
    <input type="date" class="fdate" id="fFrom" min="${isoDay(0)}" max="${isoDay(maxDay)}" value="${isoDay(F.from)}"><span style="color:var(--t3)">→</span><input type="date" class="fdate" id="fTo" min="${isoDay(0)}" max="${isoDay(maxDay)}" value="${isoDay(F.to)}">
    ${FDEF.map(dd).join('')}
    <button class="fbtn ghost" id="fReset">↺ Sıfırla</button>
    <span style="flex:1"></span>

    <span class="fchk"><label class="fbtn" title="İşaretliyken yalnızca valör tarihi gönderim günü olan işlemler gösterilir (ileri valörlüler hariç)"><input type="checkbox" id="fSv" ${SET.sv ? 'checked' : ''} style="accent-color:var(--kt)"> Yalnızca aynı gün valörlü</label>
    <label class="fbtn"><input type="checkbox" id="fOut" ${SET.out ? 'checked' : ''} style="accent-color:var(--kt)"> Uç değerleri hariç tut (P95)</label></span>`;
  $('#fFrom').onchange = e => { F.from = Math.max(0, dayOf(e.target.value)); if (F.from > F.to) F.to = F.from; applyFilters(); };
  $('#fTo').onchange = e => { F.to = Math.min(maxDay, dayOf(e.target.value)); if (F.to < F.from) F.from = F.to; applyFilters(); };
  const saveSet = () => { try { localStorage.setItem('swiftSet', JSON.stringify(SET)); } catch (e) {} };
  $('#fOut').onchange = e => { SET.out = e.target.checked; saveSet(); applyFilters(); };
  $('#fSv').onchange = e => { SET.sv = e.target.checked; saveSet(); applyFilters(); };
  $('#fReset').onclick = () => { F.from = 0; F.to = maxDay; FDEF.forEach(d => F[d.k].clear()); applyFilters(); };
  $$('.fsel', el).forEach(w => {
    const k = w.dataset.k, d = FDEF.find(x => x.k === k);
    const fill = (qq) => {
      const box = $('.opts', w); const ql = (qq || '').toLocaleLowerCase('tr');
      const list = OPTS[k].filter(([v]) => !ql || d.lab(v).toLocaleLowerCase('tr').includes(ql) || String(v).toLowerCase().includes(ql)).slice(0, 200);
      box.innerHTML = list.map(([v, n]) => `<label class="fopt"><input type="checkbox" value="${v}" ${F[k].has(v) ? 'checked' : ''}>${k === 'ctry' ? flag(v) : (k === 'ben' || k === 'corr') ? mono(v) : ''}<span>${h(d.lab(v))}</span><span class="n">${nf(n)}</span></label>`).join('');
      $$('input', box).forEach(cb => cb.onchange = () => { const v = (k === 'ccy' || k === 'ctry') ? cb.value : +cb.value; cb.checked ? F[k].add(v) : F[k].delete(v); openSel = k; applyFilters(); });
    };
    $('button', w).onclick = (e) => { e.stopPropagation(); openSel = openSel === k ? null : k; $$('.fsel', el).forEach(x => x.classList.toggle('open', x.dataset.k === openSel)); if (openSel) { fill(''); $('input[data-s]', w).focus(); } };
    if (openSel === k) fill('');
    $('input[data-s]', w).oninput = e => fill(e.target.value);
    $('input[data-s]', w).onclick = e => e.stopPropagation();
    $('.fpop', w).onclick = e => e.stopPropagation();
    $('[data-clr]', w).onclick = () => { F[k].clear(); applyFilters(); };
    $('[data-cls]', w).onclick = () => { openSel = null; w.classList.remove('open'); };
  });
}
document.addEventListener('click', () => { if (openSel) { openSel = null; $$('.fsel').forEach(x => x.classList.remove('open')); } });
function renderSelBadge() {
  const out = [];
  if (F.ctry.size === 1) { const c = [...F.ctry][0]; out.push(`<div class="sel-chip">${flag(c)} ${h(ctryName(c))}</div>`); }
  if (F.ben.size === 1) { const b = [...F.ben][0]; out.push(`<div class="sel-chip">${mono(b)} ${h(BANK[b].name.slice(0, 32))}</div>`); }
  if (F.corr.size === 1) { const b = [...F.corr][0]; out.push(`<div class="sel-chip">${mono(b)} Muhabir: ${h(BANK[b].name.slice(0, 26))}</div>`); }
  $('#selBadge').innerHTML = out.join('');
}
function setFilter(k, v) { F[k].clear(); F[k].add(v); applyFilters(); }

// --- ortak metrikler
// Uç değer: seçili kümede P95 üstü
function fence(vals) { const v = sorted(vals); return v.length < 20 ? Infinity : q(v, .95); }   // P95
function avg(vals, useOut = SET.out) { const v = vals.filter(x => x != null && !isNaN(x)); if (!v.length) return null; const f = useOut ? fence(v) : Infinity; const w = v.filter(x => x <= f); return w.reduce((a, b) => a + b, 0) / w.length; }
function stats(arr) {
  const accAll = arr.filter(t => t.st === 'ACCC');
  const acc = accAll.filter(t => t.tot != null);   // valörden önce tamamlananlar (süre yok) ortalamalara katılmaz
  const f = SET.out ? fence(acc.map(t => t.tot)) : Infinity;
  const core = acc.filter(t => t.tot <= f);
  const mean = (a, k) => a.length ? a.reduce((s, t) => s + (t[k] || 0), 0) / a.length : null;
  const tot = sorted(acc.map(t => t.tot)), net = sorted(acc.map(t => t.net)), bm = sorted(acc.map(t => t.benm));
  const endDay = t => Math.floor((t.st0 + t.totC) / 1440);
  const same = acc.filter(t => endDay(t) === t.sday).length, next = acc.filter(t => endDay(t) === t.sday + 1).length;
  // Aşama payı yalnızca ayrışması ölçülebilen işlemlerden (net ≠ boş) hesaplanır; ortalama süre bu paya göre muhabir/alıcıya bölünür
  const cs = core.filter(t => t.net != null);
  const sumT = cs.reduce((s, t) => s + (t.tot || 0), 0), sumN = cs.reduce((s, t) => s + Math.min(t.net || 0, t.tot || 0), 0);
  const p50 = mean(core, 'tot'), shN = sumT ? sumN / sumT : null;
  return {
    n: arr.length, nacc: accAll.length, nPreVal: accAll.length - acc.length, nrj: arr.filter(t => t.st === 'RJCT').length, nopen: arr.filter(t => ['PEND_BEN', 'IN_NET', 'ACC_INT'].includes(t.st)).length,
    acc: arr.length ? accAll.length / arr.length : null, rj: arr.length ? arr.filter(t => t.st === 'RJCT').length / arr.length : null,
    // p50/net50/ben50 artık ORTALAMA (uç değer ayarına göre) — sayfalar bu alanları kullanır
    p50, net50: p50 != null && shN != null ? p50 * shN : null, ben50: p50 != null && shN != null ? p50 * (1 - shN) : null, nNoSplit: acc.length - acc.filter(t => t.net != null).length,
    meanAll: mean(acc, 'tot'), fence: f, nOut: acc.length - core.length,
    med: q(tot, .5), p25: q(tot, .25), p75: q(tot, .75), p90: q(tot, .9), net90: q(net, .9), ben90: q(bm, .9),
    le30: acc.length ? tot.filter(x => x <= 30).length / acc.length : null, le60: acc.length ? tot.filter(x => x <= 60).length / acc.length : null,
    le240: acc.length ? tot.filter(x => x <= 240).length / acc.length : null, le1440: acc.length ? tot.filter(x => x <= 1440).length / acc.length : null,
    same: acc.length ? same / acc.length : null, next: acc.length ? next / acc.length : null, later: acc.length ? (acc.length - same - next) / acc.length : null,
    shareNet: shN
  };
}

// --- sayfa yönetimi
const PAGES = [];
function page(p) { PAGES.push(p); }
let current = null;
function route(force) {
  const id = (location.hash.replace('#/', '') || 'overview');
  const p = PAGES.find(x => x.id === id) || PAGES[0];
  if (!force && current === p.id) return;
  current = p.id;
  CHARTS.forEach(c => c.dispose()); CHARTS = [];
  if (window._globe && p.id !== 'globe') { try { window._globe.pauseAnimation(); } catch (e) {} }
  $$('.nav-i').forEach(n => n.classList.toggle('on', n.dataset.id === p.id));
  $('#crumb').textContent = p.title; $('#tbSub').textContent = p.sub || '';
  const v = $('#view'); v.innerHTML = '';
  $('#filterbar').style.display = p.noFilter ? 'none' : '';
  try { p.render(v); } catch (e) { console.error(e); v.innerHTML = `<div class="card empty">Bu sayfa çizilirken hata oluştu: ${h(e.message)}</div>`; }
  $('#main').scrollTop = 0;
}
window.addEventListener('hashchange', () => route());
const ORDER = ['overview','globe','analysis','corridors','banks','alerts','forecast','explorer','ai','quality','log'];
function renderNav() {
  PAGES.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const sec = {};
  PAGES.forEach(p => (sec[p.sec] = sec[p.sec] || []).push(p));
  $('#nav').innerHTML = Object.entries(sec).map(([s, ps]) => `<div class="nav-sec">${h(s)}</div>` + ps.map(p =>
    `<div class="nav-i" data-id="${p.id}"><span class="nav-ic">${ic(p.icon)}</span>${h(p.title)}${p.badge ? `<span class="nav-badge" id="nb-${p.id}"></span>` : ''}</div>`).join('')).join('');
  $$('.nav-i').forEach(n => n.onclick = () => location.hash = '#/' + n.dataset.id);
}
function openDrawer(html) { $('#drawerIn').innerHTML = `<button class="x" onclick="closeDrawer()">✕ Kapat</button>` + html; $('#drawer').classList.add('on'); }
function closeDrawer() { $('#drawer').classList.remove('on'); }
$('#drawer').addEventListener('click', e => { if (e.target.id === 'drawer') closeDrawer(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

// --- tema
const THEMES = [['mid', 'Orta'], ['light', 'Açık']];
function setTheme(t) { document.documentElement.dataset.theme = t; $('#themeName').textContent = THEMES.find(x => x[0] === t)[1]; try { localStorage.setItem('swiftTheme', t); } catch (e) {} route(true); }
$('#themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'mid' : 'light');

function boot() {
  renderNav();
  let t = 'mid'; try { t = localStorage.getItem('swiftTheme') || 'mid'; } catch (e) {}
  document.documentElement.dataset.theme = t; $('#themeName').textContent = THEMES.find(x => x[0] === t)[1];
  $('#sf-window').textContent = `${dayLabel(0)} – ${dayLabel(maxDay)} 2026`;
  $('#sf-gen').textContent = `${nf(TX.length)} UETR · Mayıs–Temmuz ve Ekim 2026`;
  applyFilters();
  if (window.updateAlertBadge) updateAlertBadge();
  const L = $('#loader'); L.style.opacity = 0; setTimeout(() => L.remove(), 400);
}
