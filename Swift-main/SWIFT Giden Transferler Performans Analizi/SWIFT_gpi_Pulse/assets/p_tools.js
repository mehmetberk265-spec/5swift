/* Tahminleme · Uyarılar · İşlem Gezgini · Veri Kalitesi · AI Asistan · Proje Günlüğü */
'use strict';
/* ---------- Tahminleme ---------- */
const FC = {ccy: 'USD', ctry: 'TR', ben: -1, corr: -1, dt: null, amt: 10000};
function estimate(p) {
  const pool = TX.filter(t => t.st === 'ACCC' || t.st === 'RJCT');
  const bnd = x => x < 12 ? 0 : x < 15 ? 1 : x < 17 ? 2 : 3; const pb = bnd(p.hour), band = t => bnd(t.hour) === pb;
  const L = [
    ['Alıcı banka + muhabir + saat dilimi', t => t.ben === p.ben && t.corr === p.corr && band(t), p.ben >= 0 && p.corr >= 0, 15],
    ['Alıcı banka + saat dilimi', t => t.ben === p.ben && band(t), p.ben >= 0, 15],
    ['Alıcı banka', t => t.ben === p.ben, p.ben >= 0, 10],
    ['Ülke + döviz + muhabir + saat dilimi', t => t.ctry === p.ctry && t.ccy === p.ccy && t.corr === p.corr && band(t), p.corr >= 0, 25],
    ['Ülke + döviz + saat dilimi', t => t.ctry === p.ctry && t.ccy === p.ccy && band(t), true, 25],
    ['Ülke + döviz', t => t.ctry === p.ctry && t.ccy === p.ccy, true, 25],
    ['Ülke', t => t.ctry === p.ctry, true, 20],
    ['Döviz', t => t.ccy === p.ccy, true, 20],
    ['Tüm işlemler', () => true, true, 1]];
  for (const [name, fn, ok, minN] of L) {
    if (!ok) continue;
    const seg = pool.filter(fn); const acc = seg.filter(t => t.st === 'ACCC' && t.totC != null);
    if (acc.length >= minN) {
      const d = sorted(acc.map(t => t.totC));
      const sendDay = Math.floor(p.t / 1440);
      const same = acc.filter(t => Math.floor((p.t + t.totC) / 1440) === sendDay).length / acc.length;
      const sp = acc.filter(t => t.netC != null), sT = sp.reduce((s, t) => s + t.totC, 0), sN = sp.reduce((s, t) => s + Math.min(t.netC, t.totC), 0), sh = sT ? sN / sT : 0, p50 = avg(d);
      return {level: name, n: acc.length, nAll: seg.length, rj: seg.filter(t => t.st === 'RJCT').length / seg.length, p50, p80: q(d, .8), p90: q(d, .9), d, same,
        net: p50 * sh, ben: p50 * (1 - sh), conf: acc.length >= 100 ? 'Yüksek' : acc.length >= 30 ? 'Orta' : 'Düşük'};
    }
  }
}
function absTime(base, m) { const x = new Date(base.getTime() + m * 60000); return x.toLocaleString('tr-TR', {weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'}); }
page({id: 'forecast', sec: 'Araçlar', title: 'Tahminleme', icon: 'crystal', noFilter: true, sub: 'Yeni bir ödemenin alıcı hesabına geçiş süresini geçmiş benzer işlemlerden tahmin edin', render(v) {
  if (!FC.dt) { const d = new Date(); d.setMinutes(0, 0, 0); if (d.getHours() < 9 || d.getHours() > 17) d.setHours(11); const z = n => String(n).padStart(2, '0'); FC.dt = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:00`; }
  const ccys = OPTS.ccy.map(x => x[0]), ctrs = OPTS.ctry.map(x => x[0]).sort((a, b) => ctryName(a).localeCompare(ctryName(b), 'tr'));
  v.innerHTML = `<div class="grid g12"><div class="card"><h3>Ödeme bilgileri</h3><div class="sub">Müşteri temsilcisi / operasyon için</div>
    <div class="form">
      <label>Döviz<select id="fcC">${ccys.map(c => `<option ${c === FC.ccy ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label>Alıcı ülke<select id="fcK">${ctrs.map(c => `<option value="${c}" ${c === FC.ctry ? 'selected' : ''}>${flagEmoji(c)} ${h(ctryName(c))}</option>`).join('')}</select></label>
      <label style="grid-column:1/3">Alıcı banka (opsiyonel)<select id="fcB"></select></label>
      <label style="grid-column:1/3">Muhabir banka (opsiyonel)<select id="fcR"><option value="-1">— Otomatik / bilinmiyor —</option>${OPTS.corr.slice(0, 40).map(([k]) => `<option value="${k}" ${k === FC.corr ? 'selected' : ''}>${h(BANK[k].name)} · ${BANK[k].bic}</option>`).join('')}</select></label>
      <label>Gönderim zamanı<input type="datetime-local" id="fcT" value="${FC.dt}"></label>
      <label>Tutar<input type="number" id="fcA" value="${FC.amt}"></label>
    </div><div style="margin-top:14px;display:flex;gap:8px"><button class="btn" id="fcGo">Tahmin et</button></div>
    <div class="note" style="margin-top:12px">Yöntem: hiyerarşik benzer-işlem tahmini. Önce en özel segment (alıcı banka + muhabir + gönderim saat dilimi: 12 öncesi / 12–15 / 15–17 / 17 sonrası) denenir; yeterli örnek yoksa ülke + döviz gibi daha genel segmentlere inilir. Sonuçlar ampirik yüzdeliklerdir.</div></div>
    <div class="card" id="fcOut"></div></div>
    <div class="grid g2 mt"><div class="card"><h3>Süreyi en çok ne etkiliyor?</h3><div class="sub">Gradient Boosting modelinin permütasyon önemi · R² (log) ${M.model.r2} · 24 saat sınıflama doğruluğu %${Math.round(M.model.acc24 * 100)}</div><div class="chart" id="fcImp"></div></div>
    <div class="card"><h3>Gönderim saati senaryosu</h3><div class="sub">Aynı ödeme farklı saatlerde gönderilseydi (ortalama / %90 sınırı)</div><div id="fcScn"></div></div></div>`;
  const fillB = () => { const list = OPTS.ben.filter(([k]) => BANK[k].ctry === $('#fcK').value || TX.some(t => t.ben === k && t.ctry === $('#fcK').value)).slice(0, 80);
    $('#fcB').innerHTML = `<option value="-1">— Herhangi bir banka —</option>` + list.map(([k, n]) => `<option value="${k}" ${k === FC.ben ? 'selected' : ''}>${h(BANK[k].name)} · ${BANK[k].bic} (${n})</option>`).join(''); };
  fillB(); $('#fcK').onchange = () => { FC.ben = -1; fillB(); };
  const go = () => {
    FC.ccy = $('#fcC').value; FC.ctry = $('#fcK').value; FC.ben = +$('#fcB').value; FC.corr = +$('#fcR').value; FC.dt = $('#fcT').value; FC.amt = +$('#fcA').value;
    const base = new Date(FC.dt); const p = {ccy: FC.ccy, ctry: FC.ctry, ben: FC.ben, corr: FC.corr, hour: base.getHours(), t: base.getHours() * 60 + base.getMinutes()};
    const r = estimate(p); if (!r) { $('#fcOut').innerHTML = '<div class="empty">Tahmin için veri yok.</div>'; return; }
    const wk = base.getDay() === 0 || base.getDay() === 6;
    const end90 = new Date(base.getTime() + r.p90 * 60000);
    const bankTxt = FC.ben >= 0 ? BANK[FC.ben].name : ctryName(FC.ctry) + ' alıcı bankası';
    $('#fcOut').innerHTML = `<div class="card-h"><div><h3>Tahmin · ${flag(FC.ctry)} ${h(ctryName(FC.ctry))} · ${h(FC.ccy)}</h3><div class="sub">Segment: <b>${h(r.level)}</b> · ${nf(r.n)} benzer tamamlanmış işlem · güven: <b>${r.conf}</b></div></div>${FC.ben >= 0 ? mono(FC.ben, true) : ''}</div>
      <div class="pred-big"><div><span>Ortalama süre</span><b>${dur(r.p50)}</b><span>${absTime(base, r.p50)}</span></div><div><span>%80 olasılıkla</span><b>${dur(r.p80)}</b><span>${absTime(base, r.p80)}</span></div><div><span>%90 olasılıkla</span><b>${dur(r.p90)}</b><span>${absTime(base, r.p90)}</span></div></div>
      <div class="kv"><div><span>Aynı gün geçiş olasılığı</span><b>${pct(r.same)}</b></div><div><span>Muhabir ağı / Alıcı banka</span><b>${dur(r.net)} / ${dur(r.ben)}</b></div><div><span>Segmentte red oranı</span><b>${pct(r.rj, 1)}</b></div></div>
      ${wk ? '<div class="finding">⚠ Seçilen gönderim zamanı hafta sonu. Muhabir ve alıcı bankaların çoğu hafta sonu işlem yapmaz; süre ilk iş gününe kayabilir.</div>' : ''}
      ${p.hour >= 17 ? '<div class="finding">⚠ 17:00 sonrası gönderimlerde ortalama süre belirgin şekilde uzuyor (kesim saati etkisi).</div>' : ''}
      <div class="kpi-l" style="margin:10px 0 6px">Müşteriye önerilen bilgilendirme metni</div>
      <div class="msgbox">Sayın müşterimiz, ${h(FC.ccy)} ${nf(FC.amt, 2)} tutarındaki ödemeniz Kuveyt Türk'ten gönderilmiştir. Benzer ödemelerin geçmiş performansına göre ödemenizin <b>%80 olasılıkla ${absTime(base, r.p80)}</b> itibarıyla, <b>%90 olasılıkla ${end90.toLocaleString('tr-TR', {weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'})}</b>'a kadar ${h(bankTxt)} nezdindeki alıcı hesabına geçmesi beklenmektedir. Ödemenizi SWIFT gpi UETR numarası ile uçtan uca takip edebilirsiniz.</div>
      <div class="chart sm" id="fcHist" style="margin-top:12px"></div>`;
    const hv = histo(r.d);
    chart($('#fcHist'), {grid: {left: 30, right: 10, top: 16, bottom: 24, containLabel: true}, tooltip: {trigger: 'axis'}, xAxis: ax({type: 'category', data: BUCKETS.map(b => b[2]), axisLabel: {rotate: 35, fontSize: 10, color: cssv('--t3')}}), yAxis: ax({type: 'value'}),
      series: [{type: 'bar', name: 'Benzer işlem', barMaxWidth: 22, data: hv.map((n, i) => ({value: n, itemStyle: {color: BUCKETS[i][1] <= r.p50 ? cssv('--s3') : BUCKETS[i][0] <= r.p90 ? cssv('--s4') : cssv('--s2'), borderRadius: [4, 4, 0, 0]}}))}]});
    const hrs = [9, 11, 13, 15, 16, 17, 18];
    $('#fcScn').innerHTML = `<table class="t"><thead><tr><th>Gönderim</th><th class="num">Ortalama</th><th class="num">%90 sınırı</th><th class="num">Aynı gün</th><th>Segment</th></tr></thead><tbody>${hrs.map(hr => { const z = estimate(Object.assign({}, p, {hour: hr, t: hr * 60})); return `<tr${hr === p.hour ? ' style="background:rgba(62,224,143,.1)"' : ''}><td><b>${hr}:00</b></td><td class="num">${dur(z.p50)}</td><td class="num">${dur(z.p90)}</td><td class="num">${pct(z.same)}</td><td class="note">${h(z.level)} (${z.n})</td></tr>`; }).join('')}</tbody></table>`;
  };
  $('#fcGo').onclick = go; go();
  const im = Object.entries(M.model.imp).sort((a, b) => a[1] - b[1]);
  const lab = {ctry: 'Alıcı ülke', hour: 'Gönderim saati', ben: 'Alıcı banka', lamt: 'Tutar', dow: 'Haftanın günü', instd: 'Muhabir banka', ccy: 'Döviz', type: 'İşlem tipi', chrgbr: 'Masraf tipi', vd_fwd: 'İleri valör'};
  chart($('#fcImp'), {grid: {left: 10, right: 40, top: 10, bottom: 10, containLabel: true}, tooltip: {trigger: 'item', formatter: p => `${p.name}: %${(p.value * 100).toFixed(1)}`},
    xAxis: ax({type: 'value', show: false}), yAxis: ax({type: 'category', data: im.map(x => lab[x[0]] || x[0])}),
    series: [{type: 'bar', barMaxWidth: 16, label: {show: true, position: 'right', color: cssv('--t2'), formatter: p => '%' + (p.value * 100).toFixed(1)}, data: im.map(x => ({value: x[1], itemStyle: {color: cssv('--s1'), borderRadius: [0, 4, 4, 0]}}))}]});
}});

/* ---------- Uyarılar ---------- */
let ATAB = 'all';
function computeAlerts(arr) {
  const out = [];
  const cm = new Map([...groupBy(TX.filter(t => t.st === 'ACCC'), t => t.ctry)].map(([k, a]) => { const d = sorted(a.map(t => t.tot)); return [k, {m: avg(d, true), p95: q(d, .95), n: d.length}]; }));
  for (const t of arr) {
    if (['PEND_BEN', 'IN_NET', 'ACC_INT'].includes(t.st) && t.age > 1440) out.push({sev: 'k', rule: 'Sonuçlanmamış > 24 saat', t, val: t.age, txt: `${ST[t.st].l}${t.pend ? ' · ' + t.pend.split(',').map(codeDesc).join(', ') : ''} · son durum ${t.last}`});
    else if (t.st === 'RJCT') out.push({sev: 'y', rule: 'Reddedilen ödeme', t, val: t.tot, txt: `${t.rj} · ${codeDesc(t.rj)}`});
    else if (t.st === 'ACCC') { const c = cm.get(t.ctry); if (c && c.n >= 20 && t.tot > 240 && t.tot > Math.max(3 * c.m, c.p95)) out.push({sev: 'o', rule: 'Olağan dışı uzun süre', t, val: t.tot, txt: `Ülke ortalaması ${dur(c.m)} · bu işlem ${nf(t.tot / c.m, 1)} kat · ${t.benm > t.net ? 'gecikme alıcı bankada' : 'gecikme muhabir ağında'}`}); }
    if (t.recall) out.push({sev: 'b', rule: 'İptal / geri çağırma (gSRP)', t, val: null, txt: 'camt.056 / MT196 / PDCR kaydı mevcut'});
    if (t.st === 'ACC_INT' && t.age <= 1440) out.push({sev: 'b', rule: 'Alıcı teyidi olmayan ACCC', t, val: null, txt: 'ACCC aracı bankadan geldi'});
  }
  return out;
}
function bankDegradation() {
  const res = []; const cut = maxDay - 6;
  for (const key of ['ben', 'corr']) for (const [k, a] of groupBy(FX.filter(t => t.st === 'ACCC'), t => t[key])) {
    const r = a.filter(t => t.day >= cut), o = a.filter(t => t.day < cut);
    if (r.length >= 10 && o.length >= 20) { const mr = avg(r.map(t => key === 'ben' ? t.benm : t.net)), mo = avg(o.map(t => key === 'ben' ? t.benm : t.net)); if (mr > 1.5 * mo && mr - mo > 60) res.push({k, key, mr, mo, n: r.length}); }
  }
  return res.sort((a, b) => (b.mr - b.mo) - (a.mr - a.mo));
}
window.updateAlertBadge = () => { const n = computeAlerts(TX).filter(a => a.sev === 'k').length; const b = $('#nb-alerts'); if (b) b.textContent = n; };
page({id: 'alerts', sec: 'Performans', title: 'Uyarılar', icon: 'bell', badge: true, sub: 'Olağan dışı süreler, takılı ve reddedilen ödemeler, banka bazlı performans bozulmaları', render(v) {
  const al = computeAlerts(FX); const deg = bankDegradation();
  const SV = {k: ['Kritik', 'sev-k'], y: ['Yüksek', 'sev-y'], o: ['Orta', 'sev-o'], b: ['Bilgi', 'sev-b']};
  const cnt = s => al.filter(a => a.sev === s).length;
  v.innerHTML = `<div class="grid g4">${Object.entries(SV).map(([s, [l]]) => `<div class="card kpi" style="cursor:pointer" data-s="${s}"><div class="kpi-ic" style="background:${{k: '#d03b3b', y: '#c4620f', o: '#a57800', b: '#4b6b60'}[s]}">${ic('bell')}</div><div><div class="kpi-l">${l}</div><div class="kpi-v">${nf(cnt(s))}</div><div class="kpi-s">${{k: '24 saati aşan sonuçlanmamış', y: 'Reddedilen ödemeler', o: 'Ülke normunun 3 katı üstü', b: 'İptal talebi, aracı ACCC'}[s]}</div></div></div>`).join('')}</div>
  <div class="card mt"><h3>Performansı bozulan bankalar</h3><div class="sub">Son 7 günün ortalaması önceki döneme göre %50+ ve 60 dk+ arttı (alıcı bankalar: bekleme süresi · muhabirler: ağ süresi)</div>
    ${deg.length ? `<table class="t"><thead><tr><th>Banka</th><th>Rol</th><th class="num">Önceki ortalama</th><th class="num">Son 7 gün</th><th class="num">Değişim</th><th class="num">İşlem (son 7 gün)</th></tr></thead><tbody>${deg.slice(0, 10).map(d => `<tr class="clk" data-b="${d.k}" data-r="${d.key}"><td>${bankCell(d.k)}</td><td>${d.key === 'ben' ? 'Alıcı' : 'Muhabir'}</td><td class="num">${dur(d.mo)}</td><td class="num"><b class="delta-up">${dur(d.mr)}</b></td><td class="num delta-up">▲ ${nf(d.mr / Math.max(1, d.mo), 1)}x</td><td class="num">${d.n}</td></tr>`).join('')}</tbody></table>` : '<div class="note">Seçili filtrede belirgin bozulma yok.</div>'}</div>
  <div class="card mt"><div class="card-h"><div><h3>Uyarı listesi</h3><div class="sub">Satıra tıklayarak işlemin zaman çizelgesini açın</div></div>
    <div class="tabs" id="aTab"><div class="tab" data-t="all">Tümü (${al.length})</div>${Object.entries(SV).map(([s, [l]]) => `<div class="tab" data-t="${s}">${l} (${cnt(s)})</div>`).join('')}</div></div>
    <div class="tbl-wrap" style="max-height:620px;margin-top:10px" id="aTbl"></div></div>`;
  const draw = () => { $$('#aTab .tab').forEach(t => t.classList.toggle('on', t.dataset.t === ATAB));
    const list = al.filter(a => ATAB === 'all' || a.sev === ATAB).sort((a, b) => 'kyob'.indexOf(a.sev) - 'kyob'.indexOf(b.sev) || (b.val || 0) - (a.val || 0)).slice(0, 400);
    $('#aTbl').innerHTML = `<table class="t"><thead><tr><th>Seviye</th><th>Kural</th><th>Referans</th><th>Gönderim</th><th>Alıcı banka</th><th>Tutar</th><th class="num">Süre / yaş</th><th>Durum</th><th>Açıklama</th></tr></thead><tbody>${list.map(a => `<tr class="clk" data-i="${a.t.i}"><td><span class="sev ${SV[a.sev][1]}">${SV[a.sev][0]}</span></td><td>${h(a.rule)}</td><td>${h(a.t.ref)}</td><td>${tLabel(a.t.t0)}</td><td>${bankCell(a.t.ben)}</td><td>${a.t.ccy} ${nf(a.t.amt, 2)}</td><td class="num"><b>${dur(a.val)}</b></td><td>${stChip(a.t.st)}</td><td class="note" style="white-space:normal;min-width:220px">${h(a.txt)}</td></tr>`).join('')}</tbody></table>${al.length > 400 ? '<div class="note" style="padding:8px">İlk 400 uyarı gösteriliyor; filtreleri daraltın.</div>' : ''}`;
    $$('#aTbl tr.clk').forEach(r => r.onclick = () => showTx(+r.dataset.i)); };
  $$('#aTab .tab').forEach(t => t.onclick = () => { ATAB = t.dataset.t; draw(); });
  $$('.kpi[data-s]').forEach(k => k.onclick = () => { ATAB = k.dataset.s; draw(); });
  $$('tr[data-b]').forEach(r => r.onclick = () => showBank(+r.dataset.b, r.dataset.r));
  draw();
}});

/* ---------- İşlem Gezgini ---------- */
let XQ = '', XST = '', XPG = 0, XSORT = ['t0', -1];
page({id: 'explorer', sec: 'Araçlar', title: 'İşlem Gezgini', icon: 'search', sub: 'UETR, referans veya banka ile işlem arayın; zaman çizelgesini inceleyin', render(v) {
  v.innerHTML = `<div class="card"><div class="card-h"><input class="search" id="xQ" placeholder="UETR, ExchangeReference, BIC veya banka adı…" value="${h(XQ)}">
    <div class="xk" id="xK"></div><select class="fdate" id="xS"><option value="">Tüm durumlar</option>${STATES.map(s => `<option value="${s}" ${s === XST ? 'selected' : ''}>${ST[s].l}</option>`).join('')}</select></div>
    <div class="tbl-wrap" style="max-height:none;margin-top:12px" id="xT"></div><div class="pager" id="xP"></div></div>`;
  const draw = () => {
    const ql = XQ.trim().toLocaleLowerCase('tr');
    let list = FX.filter(t => (!XST || t.st === XST) && (!ql || t.uetr.includes(ql) || String(t.ref).includes(ql) || (BANK[t.ben] && (BANK[t.ben].name.toLocaleLowerCase('tr').includes(ql) || BANK[t.ben].bic.toLowerCase().includes(ql))) || (BANK[t.corr] && BANK[t.corr].bic.toLowerCase().includes(ql))));
    const [k, d] = XSORT; list = list.slice().sort((a, b) => ((a[k] ?? -1e12) - (b[k] ?? -1e12)) * d);
    const pages = Math.max(1, Math.ceil(list.length / 50)); XPG = Math.min(XPG, pages - 1);
    const S = stats(list);
    $('#xK').innerHTML = `<div title="Listelenen işlemlerden tamamlananların ortalaması${SET.out ? ' · P95 (uç değerler hariç)' : ''}"><span>Ortalama süre</span><b>${dur(S.p50)}</b></div><div><span>Muhabir ağı</span><b style="color:var(--s1)">${dur(S.net50)}</b></div><div><span>Alıcı banka</span><b style="color:var(--s2)">${dur(S.ben50)}</b></div>`;
    const th = (key, l, cls = '') => `<th class="${cls}" data-k="${key}">${l}${XSORT[0] === key ? (XSORT[1] > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    $('#xT').innerHTML = `<table class="t"><thead><tr>${th('t0', 'Gönderim')}<th>Referans</th><th>Muhabir</th><th>Alıcı banka</th>${th('amt', 'Tutar', 'num')}${th('net', 'Muhabir ağı', 'num')}${th('benm', 'Alıcı banka', 'num')}${th('tot', 'Toplam', 'num')}<th>Durum</th></tr></thead><tbody>
      ${list.slice(XPG * 50, XPG * 50 + 50).map(t => `<tr class="clk" data-i="${t.i}"><td>${tLabel(t.t0)}</td><td><b>${h(t.ref)}</b><div class="note">${h(t.uetr.slice(0, 13))}…</div></td><td>${bankCell(t.corr)}</td><td>${bankCell(t.ben)}</td><td class="num">${t.ccy} ${nf(t.amt, 2)}</td><td class="num"${nsT(t)}>${dur(t.net)}</td><td class="num"${nsT(t)}>${dur(t.benm)}</td><td class="num"><b>${dur(t.tot)}</b></td><td>${stChip(t.st)}</td></tr>`).join('')}</tbody></table>`;
    $('#xP').innerHTML = `${nf(list.length)} işlem · sayfa ${XPG + 1}/${pages} <button class="fbtn" id="xPr">‹</button><button class="fbtn" id="xNx">›</button>`;
    $('#xPr').onclick = () => { XPG = Math.max(0, XPG - 1); draw(); }; $('#xNx').onclick = () => { XPG = Math.min(pages - 1, XPG + 1); draw(); };
    $$('#xT tr.clk').forEach(r => r.onclick = () => showTx(+r.dataset.i));
    $$('#xT th[data-k]').forEach(c => c.onclick = () => { XSORT = [c.dataset.k, XSORT[0] === c.dataset.k ? -XSORT[1] : -1]; draw(); });
  };
  $('#xQ').oninput = e => { XQ = e.target.value; XPG = 0; draw(); }; $('#xS').onchange = e => { XST = e.target.value; XPG = 0; draw(); };
  draw();
}});
function nsT(t) { return t.tot != null && t.net == null ? ' title="Aşama ayrışması ölçülemedi: alıcı bankanın sonuç bildirimi muhabir bildirimlerinden önce zaman damgalı"' : ''; }
function splitNote(t) {
  if (t.tot == null) return '';
  const nt = x => `<div class="note" style="margin-top:8px">${x}</div>`;
  if (t.split === 1) return `<div class="finding"><b class="h">Aşama ayrışması ölçülemedi</b>Alıcı bankanın sonuç bildirimi, muhabir bankaların bildirimlerinden önce zaman damgalı (zaman damgası tutarsızlığı). Toplam süre geçerlidir; muhabir / alıcı banka süresi gösterilmez.</div>`;
  if (t.split === 2 && t.benm != null && t.benm < 1) return nt('Alıcı banka süresi 0: son muhabir ödemeyi iletti ve alıcı banka aynı dakika içinde alacak kaydı yaptı (mesaj zamanlarına göre gerçek değer).');
  if (t.split === 2) return nt('Alıcıya ulaşma: alıcı banka rotada ilk kez sonuç mesajıyla göründüğü için son muhabirin bildirimi esas alındı.');
  if (t.net != null && t.net < 1 && t.vstat === 1) return nt('Muhabir ağı 0: ödeme valör gününden önce alıcı bankaya ulaşmıştı.');
  if (t.net != null && t.net < 1 && t.hops === 1) return nt('Muhabir ağı 0: ödeme ara muhabir olmadan doğrudan alıcı bankaya gönderildi; alıcı banka ara bildirim (ACSP) göndermeden alacak kaydı yaptı.');
  return '';
}
function showTx(i) {
  const t = TX[i]; const ev = (window.SWIFT_EV && window.SWIFT_EV[i]) || [];
  const col = c => c.startsWith('ACCC') ? '#0ca30c' : c.startsWith('RJCT') ? '#d03b3b' : /G00[234]/.test(c) ? '#fab219' : c.startsWith('PDCR') ? '#9085e9' : '#3987e5';
  const route = (t.route || '').split('>').filter(Boolean);
  openDrawer(`<div style="margin-top:4px"><div class="note">ExchangeReference</div><div style="font-size:20px;font-weight:800">${h(t.ref)} ${stChip(t.st)}</div><div class="note">UETR ${h(t.uetr)} · ${TYPES[t.type]} · ${h(t.chr)}</div></div>
    <div class="kv"><div><span>Gönderim (pacs çıkışı)</span><b>${tLabel(t.t0)}</b></div><div><span>Operasyonel başlangıç</span><b>${tLabel(t.st0)}</b><span>${t.vstat === 1 ? 'İleri valör: başlangıç = valör günü 00:00' : t.vstat === 2 ? 'Valör gününden önce tamamlandı → süre ortalamalara katılmaz' : 'Valör = gönderim günü'}</span></div><div><span>Alıcı bankaya ulaşma</span><b>${t.netC != null ? tLabel(t.st0 + t.netC) : '—'}</b></div><div><span>Sonuç</span><b>${t.totC != null ? tLabel(t.st0 + t.totC) : (() => { const e = ev.find(x => x[1] === 'ACCC') || ev.find(x => x[1].startsWith('RJCT')); return e && ['ACCC', 'RJCT'].includes(t.st) ? tLabel(e[0]) : '—'; })()}</b>${t.late ? '<span>Veri penceresi sonrası (CSV SonMesajTarihi)</span>' : ''}</div>
    <div><span>Muhabir ağı</span><b>${dur(t.net)}</b></div><div><span>Alıcı banka</span><b>${dur(t.benm)}</b></div><div><span>İşlem süresi</span><b>${dur(t.tot)}</b></div>
    <div><span>Tutar</span><b>${t.ccy} ${nf(t.amt, 2)}</b></div><div><span>Alacaklanan tutar</span><b>${t.cred != null ? nf(t.cred, 2) : '—'}</b></div><div><span>Aracı kesinti (71F)</span><b>${t.fee ? nf(t.fee, 2) : '—'}</b></div></div>
    ${t.tot != null && t.net != null ? stageBar(t.net, t.benm, [dur(t.net), dur(t.benm)]) : ''}${splitNote(t)}
    <div class="finding o"><b class="h">CSV'deki mevcut hesaplama ile karşılaştırma</b>Mevcut: toplam ${dur(t.ctot)} · muhabir ${dur(t.cnet)} · alıcı ${dur(t.cben)} · final ${h(t.cfin)}<br>Düzeltilmiş: toplam ${dur(t.tot)} · muhabir ${dur(t.net)} · alıcı ${dur(t.benm)} · durum ${h(ST[t.st].l)}</div>
    <h3 style="margin-top:16px">Rota</h3><div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span class="tag">🇹🇷 KTEFTRIS</span>${route.map(b => `→ <span class="tag" title="${h(BANK[BIX[b]]?.name || '')}">${flagEmoji(b.slice(4, 6))} ${h(b)}</span>`).join(' ')}</div>
    <h3 style="margin-top:16px">gpi zaman çizelgesi</h3>
    <div class="tl"><div class="tl-i" style="--c:#00a650"><div class="tl-t">${tLabel(t.t0)}</div><div class="tl-b">Kuveyt Türk ödemeyi gönderdi</div><div class="tl-d">${bankCell(t.corr)}</div></div>
    ${ev.map(e => `<div class="tl-i" style="--c:${col(e[1])}"><div class="tl-t">${tLabel(e[0])}${e[5] !== 'ok' ? ` · <span style="color:var(--warn)">zaman damgası: ${h(e[5])}</span>` : ''}${e[6] != null && e[6] > 30 ? ` · KT'ye ${dur(e[6])} gecikmeyle ulaştı` : ''}</div>
      <div class="tl-b">${h(e[1])} · ${h(codeDesc(e[1]))}</div><div class="tl-d">${e[2] >= 0 ? 'Bildiren: ' + h(BANK[e[2]].name || BANK[e[2]].bic) + ' (' + BANK[e[2]].bic + ')' : ''}${e[3] >= 0 ? ' → ' + h(BANK[e[3]].name || BANK[e[3]].bic) + ' (' + BANK[e[3]].bic + ')' : ''}${e[4] ? ' · kesinti ' + nf(e[4], 2) : ''}</div></div>`).join('')}</div>
    ${!window.SWIFT_EV ? '<div class="note">Olay verisi yükleniyor…</div>' : ''}`);
}

/* ---------- Veri Kalitesi & Metodoloji ---------- */
page({id: 'quality', sec: 'Proje', title: 'Veri Kalitesi & Metodoloji', icon: 'shield', noFilter: true, sub: 'Hesaplama kuralları, zaman damgası kontrolleri, valör ve uç değer yaklaşımı', render(v) {
  const d = M.dq; const A = TX.filter(t => t.st === 'ACCC' && t.ctot != null && t.ctot >= 0);
  const vs = d.vstat || {};
  v.innerHTML = `<div class="grid g4">
    ${kpi('route', 'Veri: Mayıs–Temmuz ve Ekim 2026', nf(d.txn) + ' işlem', `${nf(d.msgs_unique)} benzersiz mesaj · ${nf(d.dup_rows)} mükerrer satır`)}
    ${kpi('clock', 'İleri valörlü işlem', nf((vs['1'] || 0) + (vs['2'] || 0)), `${nf(vs['2'] || 0)} tanesi valörden önce sonuçlandı → çıkış zamanı kullanıldı`)}
    ${kpi('check', 'Revize SP ile uyum', pct(1 - d.csv_accc_not_ben / Math.max(1, d.txn), 1), `${nf(d.csv_accc_not_ben)} işlemde final kodu farklı`)}
    ${kpi('shield', 'Hatalı :79: zaman damgası', nf((d.tsq['ileri-tarihli'] || 0) + (d.tsq['tarih-düzeltildi'] || 0) + (d.tsq['sadece-tarih'] || 0) + (d.tsq['tutarsız'] || 0)), `toplam ${nf(Object.values(d.tsq).reduce((a, b) => a + b, 0))} tracker mesajından`)}</div>
  <div class="grid g21 mt"><div class="card"><h3>Hesaplama kuralları</h3><div class="sub">Platformdaki tüm süreler bu kurallarla hesaplanır</div>
    <div class="finding o"><b class="h">1 · Olay zamanı = tracker mesajındaki :79: zaman damgası</b>Her tracker mesajında <code>:79://YYAAGGssdd±SSDD</code> satırı olayın gerçek zamanını ve saat dilimini taşır (ör. <code>2605041301-0400</code> = 4 May 13:01 New York = 20:01 TR). Tüm zamanlar TR saatine çevrilir. Damga kullanılamadığında yedek olarak tracker'ın mesajı oluşturduğu zaman (:20: alanı, UTC; olaydan ortalama ~1 dk sonra) kullanılır; bu da yoksa SystemDate. Başlangıç zamanı pacs.008 <code>CreDtTm</code> alanıdır (saniye hassasiyetinde); SP'deki BizdenCikisTarihi dakikaya yuvarlı SystemDate olduğu için iki kaynak arasında 1 dakikaya kadar fark normaldir.</div>
    <div class="finding"><b class="h">2 · Kullanılamayan :79: damgaları (otomatik ayıklanır)</b>Bazı bankalar :79: alanına olay zamanı yerine farklı bir değer yazıyor. <b>${nf((d.tsq['ileri-tarihli'] || 0) + (d.tsq['tarih-düzeltildi'] || 0))}</b> mesajda damga, mesajın bize ulaştığı andan <u>sonrasını</u> gösteriyor (yerel saati +0000 diye göndermek veya valör/kredi tarihini yazmak). En sık: ${Object.entries(d.fut_rep || {}).map(([k, n]) => `${k} (${nf(n)})`).join(', ')}. <b>${nf(d.tsq['sadece-tarih'] || 0)}</b> mesajda yalnızca tarih (00:00), <b>${nf(d.tsq['tutarsız'] || 0)}</b> mesajda gönderimden önceye ya da 40 günden eskiye düşen damga var. Bu mesajların tamamında olay zamanı olarak SWIFT'in mesajı oluşturduğu an (tracker :20: alanı, UTC) kullanıldı (örnek: 102690092 — SABB ACCC damgası 11 May 22:35, SWIFT kaydı 10 May 22:59). <b>Sisteminizle karşılaştırırken görülen küçük farkların ana kaynağı bu ayıklamadır.</b></div>
    <div class="finding o"><b class="h">3 · Operasyonel başlangıç (valör)</b>Valör tarihi pacs.008 <code>IntrBkSttlmDt</code> alanından okunur (CSV'deki ValueDate ile %100 aynı). Valör gönderim gününden ileriyse başlangıç = valör günü 00:00 (TR); <b>${nf(vs['1'] || 0)}</b> işlem bu şekilde hesaplandı. Alıcı bankanın ACCC'si valör gününden <u>önce</u> gelen <b>${nf(vs['2'] || 0)}</b> işlem "valörden önce tamamlandı" olarak işaretlenir: tamamlanma oranında sayılır, ancak süreleri (negatif ya da çıkıştan ölçülünce yanıltıcı derecede uzun olacağı için) ortalamalara ve dağılımlara katılmaz. SP çıktınızdaki ${nf(d.csv_neg_tot)} negatif AnaIslemSuresi'nin ~%80'i ise <u>sonuçlanmamış</u> işlemlerden (SonMesajTarihi = son mesaj) geliyor; AnaIslemSuresi yalnızca ACCC/RJCT ile sonuçlanan işlemler için hesaplanmalı.</div>
    <div class="finding o"><b class="h">4 · ACCC'yi kim gönderdi?</b>ACCC yalnızca bildiren BIC'in ilk 4 hanesi alıcı banka (CdtrAgt) ile eşleşiyorsa final sayılır; alıcıya ulaşma için 6 hane eşleşmesi kullanılır. Revize SP'niz ile platform arasında yalnızca ${nf(d.csv_accc_not_ben)} işlemde fark kaldı (${Object.entries(d.csv_accc_not_ben_br).map(([k, n]) => `${ST[k].l}: ${nf(n)}`).join(' · ')}). RJCT farkları: alıcı ACCC'sinden önce gelen RJCT'yi platform "Reddedildi" sayıyor.</div>
    <div class="finding o"><b class="h">5 · Ortalama ve uç değerler</b>Süreler sağa çok çarpık: işlemlerin çoğu birkaç saatte biterken az sayıda işlem haftalar sürüyor ve basit ortalamayı katlıyor. Bu yüzden raporlanan ortalama <b>uç değerler hariç ortalamadır</b>: seçili kümede süresi P95 eşiğini aşan işlemler ortalamaya katılmaz (P95 ortalama). Filtre çubuğundaki "Uç değerleri hariç tut" kutusu ile kapatılabilir.</div>
    <div class="finding o"><b class="h">6 · Süre tanımı</b><b>İşlem süresi</b>: operasyonel başlangıçtan alıcı hesabına alacak kaydına kadar geçen tüm süre. Muhabir ağı + alıcı banka = toplam. <b>Alıcıya ulaşma:</b> alıcı bankanın rotada ilk görüldüğü an. Doğrudan alıcı bankaya gönderilen ödemelerde (ara muhabir yok) alıcı bankanın ilk ACSP bildirimi esas alınır (iletim + kabul süresi). ACSP göndermeden doğrudan alacak kaydı yapılmışsa muhabir ağı 0'dır. Alıcı banka rotada ilk kez kendi sonuç mesajıyla görünüyorsa son muhabirin bildirimi (aynı dakika dahil) esas alınır (${nf(d.reach_fix)} işlem); aynı dakikadaysa alıcı banka süresi gerçekten 0'dır. <b>0 dk değerleri mesaj zamanlarına göre gerçek değerlerdir</b> (dakika hassasiyetinde): doğrudan gönderim, aynı dakikada iletim + alacak kaydı veya valörden önce alıcıya ulaşma. Yalnızca alıcının sonuç bildirimi muhabir bildirimlerinden önce zaman damgalı olan ${nf(d.nosplit)} işlemde aşama ayrışması <b>ölçülemedi</b> olarak gösterilir; muhabir / alıcı banka ortalamaları aşama payı ölçülebilen işlemlerden hesaplanıp ortalama süreye uygulanır.</div>
    <div class="finding"><b class="h">7 · Veri penceresi</b>Veri iki dönemden oluşur: <b>1 Mayıs – 29 Temmuz</b> ve <b>1 – 30 Ekim 2026</b> (Ağustos–Eylül verisi yok). Mesaj geçmişi eksik kalacağı için her dönemin son iki günü ve sonrası başlangıçlı işlemler (28 Temmuz ve sonrası, 29 Ekim ve sonrası) analize dahil edilmez. FI transferleri (pacs.009) kapsam dışıdır; işlem tipleri Direct Payment ve Cover (COV). Dönem sonundan sonra tamamlanan ${nf(d.late_csv)} işlemin bitişi SP'nizin SonMesajTarihi alanından alındı (SystemDate bazlı, −3 dk). Reference kolonu Excel'den geçtiği için hâlâ bilimsel gösterimde (${nf(d.sci_ref)} satır); analizde ExchangeReference kullanılıyor.</div>
  </div>
  <div class="card"><h3>Hesaplama yöntemine göre ortalama</h3><div class="sub">Tamamlanmış (ACCC) işlemler</div><div class="chart" id="qCmp"></div>
    <div class="note">Tamamlanmış (ACCC) işlemlerde ortalama işlem süresi: mevcut SP yöntemi (SystemDate) ve platformun işlem süresi (tüm işlemler / uç değerler hariç) (tüm işlemler / P95). Yeşil çubuk raporlanan değerdir.</div>
    <h3 style="margin-top:16px">Mesajın bize ulaşma gecikmesi</h3><div class="sub">:79: olay zamanı → KT SystemDate (ortanca)</div><div class="chart sm" id="qLag"></div></div></div>`;
  chart($('#qCmp'), {grid: {left: 40, right: 10, top: 16, bottom: 30, containLabel: true}, tooltip: {trigger: 'axis', valueFormatter: x => dur(x)},
    xAxis: ax({type: 'category', data: ['Mevcut SP\n(SysDate)', 'İşlem süresi\ntüm işlemler', 'İşlem süresi\nP95'], axisLabel: {color: cssv('--t2'), fontSize: 10, interval: 0, lineHeight: 13}}), yAxis: ax({type: 'value', axisLabel: {formatter: x => dur(x), color: cssv('--t3')}}),
    series: [{type: 'bar', barMaxWidth: 46, label: {show: true, position: 'top', color: cssv('--t1'), formatter: p => dur(p.value)}, data: [d.mean_csv, d.mean_cal, avg(TX.filter(t => t.st === 'ACCC').map(t => t.totC), true)].map((x, i) => ({value: x, itemStyle: {color: i === 2 ? '#0e7a3c' : i === 0 ? cssv('--s4') : cssv('--s1'), borderRadius: [5, 5, 0, 0]}}))}]});
  chart($('#qLag'), {grid: {left: 40, right: 10, top: 10, bottom: 24, containLabel: true}, tooltip: {trigger: 'axis', valueFormatter: x => dur(x)},
    xAxis: ax({type: 'category', data: ['Hafta içi', 'Cumartesi', 'Pazar']}), yAxis: ax({type: 'log', min: 1, axisLabel: {formatter: x => dur(x), color: cssv('--t3')}}),
    series: [{type: 'bar', barMaxWidth: 40, data: [d.lag_wd, d.lag_sat, d.lag_sun].map((x, i) => ({value: x, itemStyle: {color: i ? '#ec835a' : '#0e7a3c', borderRadius: [4, 4, 0, 0]}}))}]});
}});

/* ---------- AI Asistan ---------- */
const CHAT = [];
function aiContext() {
  const S = stats(FX);
  const top = (key, lab, n = 8) => [...groupBy(FX, t => t[key])].map(([k, a]) => [k, stats(a)]).filter(x => x[1].n >= 20).sort((a, b) => b[1].n - a[1].n).slice(0, n).map(([k, s]) => ({ad: lab(k), islem: s.n, ortalama_dk: Math.round(s.p50 || 0), muhabir_dk: Math.round(s.net50 || 0), alici_dk: Math.round(s.ben50 || 0), ayni_gun: +(s.same || 0).toFixed(3), red: +(s.rj || 0).toFixed(3)}));
  return {filtre: {tarih: `${dayLabel(F.from)}–${dayLabel(F.to)} 2026`, doviz: [...F.ccy], ulke: [...F.ctry], alici_banka: [...F.ben].map(b => BANK[b].name), muhabir: [...F.corr].map(b => BANK[b].name)},
    genel: {islem: S.n, accc_orani: +(S.acc || 0).toFixed(3), red_orani: +(S.rj || 0).toFixed(3), acik: S.nopen, ortalama_dk: Math.round(S.p50 || 0), p90_dk: Math.round(S.p90 || 0), muhabir_ortalama_dk: Math.round(S.net50 || 0), alici_ortalama_dk: Math.round(S.ben50 || 0), sure_payi_muhabir: +(S.shareNet || 0).toFixed(3), ayni_gun: +(S.same || 0).toFixed(3), ertesi_gun: +(S.next || 0).toFixed(3), iki_gun_ustu: +(S.later || 0).toFixed(3), le_1saat: +(S.le60 || 0).toFixed(3)},
    ulkeler: top('ctry', ctryName), dovizler: top('ccy', x => x), alici_bankalar: top('ben', k => BANK[k].name), muhabirler: top('corr', k => BANK[k].name),
    model_onemi: M.model.imp, notlar: 'Süreler gpi :79: olay zamanından, operasyonel başlangıçtan (valör) itibaren hesaplanmıştır. Süre bazı: ' + METRICS[SET.m] + (SET.out ? ', uç değerler hariç ortalama.' : ', tüm işlemler dahil ortalama.')};
}
async function api(path, body) {
  const r = await fetch(path, {method: body ? 'POST' : 'GET', headers: {'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined});
  if (!r.ok) throw new Error((await r.text()).slice(0, 300) || r.status);
  return r;
}
page({id: 'ai', sec: 'Araçlar', title: 'AI Asistan', icon: 'spark', sub: 'Azure OpenAI (gpt-5.1) ile filtrelenmiş veri üzerinde soru-cevap · yalnızca toplulaştırılmış banka/ülke istatistikleri gönderilir', render(v) {
  v.innerHTML = `<div class="grid g31"><div class="card chat"><div class="qp">${['Bu filtre için yönetici özeti yaz', 'Gecikme en çok hangi aşamada ve neden?', 'Müşteri iletişiminde hangi süre taahhüdünü verebiliriz?', 'Hangi muhabir bankalar daha hızlı, öneri ver', 'Operasyonel iyileştirme için 5 aksiyon öner'].map(x => `<span>${x}</span>`).join('')}</div>
    <div class="chat-log" id="cLog"></div><div class="chat-in"><textarea id="cIn" placeholder="Sorunuzu yazın… (Enter gönderir)"></textarea><button class="btn" id="cGo">Gönder</button></div></div>
    <div class="card"><h3>Bağlantı durumu</h3><div class="sub">Yerel sunucu üzerinden Azure</div><div id="cStat" class="note">Kontrol ediliyor…</div>
      <button class="btn sec" id="cTest" style="margin-top:10px;width:100%">Bağlantıyı test et</button>
      <h3 style="margin-top:18px">Sesli yönetici özeti</h3><div class="sub">Azure Speech (tr-TR) ile son yanıtı seslendir</div><button class="btn sec" id="cTts" style="width:100%">🔊 Son yanıtı seslendir</button><audio id="cAudio" controls style="width:100%;margin-top:8px;display:none"></audio>
      <h3 style="margin-top:18px">Gönderilen bağlam</h3><div class="note">Müşteri adı, IBAN, tutar detayı gibi işlem seviyesinde veri gönderilmez; yalnızca filtrelenmiş toplulaştırılmış istatistikler.</div></div></div>`;
  const log = $('#cLog');
  const paint = () => { log.innerHTML = CHAT.length ? CHAT.map(m => `<div class="msg ${m.role === 'user' ? 'u' : 'a'}">${h(m.content)}</div>`).join('') : `<div class="msg a">Merhaba! Seçili filtrelerdeki SWIFT gpi performans verileri hakkında soru sorabilirsiniz. Örneğin: "Çin'e giden USD ödemeler neden uzun sürüyor?"</div>`; log.scrollTop = 1e9; };
  paint();
  const send = async (text) => {
    if (!text.trim()) return; CHAT.push({role: 'user', content: text}); paint();
    const wait = document.createElement('div'); wait.className = 'msg a'; wait.textContent = 'Düşünüyor…'; log.appendChild(wait);
    try { const r = await api('/api/chat', {messages: CHAT.slice(-10), context: aiContext()}); const j = await r.json(); CHAT.push({role: 'assistant', content: j.reply}); }
    catch (e) { CHAT.push({role: 'assistant', content: 'AI servisine ulaşılamadı: ' + e.message + '\n\nPlatformu "start" betiği ile (http://127.0.0.1:8765) açtığınızdan ve config.json içinde anahtarların tanımlı olduğundan emin olun.'}); }
    paint();
  };
  $('#cGo').onclick = () => { send($('#cIn').value); $('#cIn').value = ''; };
  $('#cIn').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#cGo').click(); } };
  $$('.qp span').forEach(s => s.onclick = () => send(s.textContent));
  const chk = async () => { try { const j = await (await api('/api/health')).json(); $('#cStat').innerHTML = `Sunucu: <b style="color:var(--mint)">çalışıyor</b><br>GPT anahtarı: ${j.chat ? '✓ tanımlı' : '✗ yok'} · Speech: ${j.tts ? '✓ tanımlı' : '✗ yok'}`; }
    catch (e) { $('#cStat').innerHTML = location.protocol === 'file:' ? 'Sayfa dosya olarak açılmış. AI özellikleri için <b>start.command</b> (Mac) veya <b>start.bat</b> (Windows) ile açın.' : 'Sunucuya ulaşılamadı.'; } };
  chk();
  $('#cTest').onclick = async () => { $('#cStat').textContent = 'Test ediliyor…'; try { const j = await (await api('/api/test')).json(); $('#cStat').innerHTML = `GPT: <b>${h(j.chat)}</b><br>Speech: <b>${h(j.tts)}</b>`; } catch (e) { $('#cStat').textContent = 'Hata: ' + e.message; } };
  $('#cTts').onclick = async () => { const last = [...CHAT].reverse().find(m => m.role === 'assistant'); if (!last) return;
    try { const r = await api('/api/tts', {text: last.content.slice(0, 2500)}); const b = await r.blob(); const a = $('#cAudio'); a.src = URL.createObjectURL(b); a.style.display = ''; a.play(); } catch (e) { alertNote('Seslendirme başarısız: ' + e.message); } };
}});
function alertNote(t) { const d = document.createElement('div'); d.className = 'tip'; d.style.cssText = 'display:block;left:50%;top:20px;transform:translateX(-50%)'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 4000); }

/* ---------- Proje Günlüğü ---------- */
page({id: 'log', sec: 'Proje', title: 'Proje Günlüğü', icon: 'book', noFilter: true, sub: 'Yapılan çalışmalar, açık sorular ve yol haritası', render(v) {
  v.innerHTML = `<div class="grid g2"><div class="card"><h3>Sürüm geçmişi</h3>
    <div class="log-i"><div class="d">v1.4 · 6 Kasım 2026</div><ul>
    <li>Ekim 2026 verisi eklendi (ekim.csv · 68.912 mesaj · 19.330 işlem). Toplam 88.009 işlem.</li></ul></div>
    <div class="log-i"><div class="d">v1.3 · 3 Kasım 2026</div><ul>
    <li>Alıcı banka grubunun başka bir birimine yapılan iletim (örn. BMPBDEF2 alıcısı için BMPBBEBB) artık alıcıya ulaşma sayılıyor; alıcı grubunun kendi ACCC'si muhabir bildirimi sayılmıyor (1.113 işlem düzeldi, örn. 112640431).</li></ul></div>
    <div class="log-i"><div class="d">v1.2 · 3 Kasım 2026</div><ul>
    <li>0 dk süreler mesaj zamanlarına göre gerçek değer olarak gösteriliyor (doğrudan gönderim, aynı dakikada iletim + ACCC, valörden önce ulaşma).</li>
    <li>"Ölçülemedi" yalnızca zaman damgası tutarsız 218 tamamlanmış işlemde.</li></ul></div>
    <div class="log-i"><div class="d">v1.1 · 3 Kasım 2026</div><ul>
    <li>İşlem Gezgini'ne ortalama süre / muhabir / alıcı banka kutusu.</li>
    <li>Genel filtreye Rota Uzunluğu ve "Yalnızca aynı gün valörlü" seçenekleri.</li>
    <li>İşlem tipleri: Direct Payment ve Cover (COV); FI transferleri çıkarıldı.</li>
    <li>0 dk aşama süreleri düzeltildi (doğrudan ödemelerde alıcının ilk ACSP'si; ara bildirim yoksa "ölçülemedi").</li>
    <li>28 Temmuz ve sonrası başlangıçlı işlemler kapsam dışı. TCZBTR2A adı düzeltildi.</li></ul></div>
    <div class="log-i"><div class="d">v0.9 · 26 Ekim 2026</div><ul>
    <li>Uç değer kuralı: P95 ortalama (seçili kümede P95 eşiğini aşan işlemler hariç).</li></ul></div>
    <div class="log-i"><div class="d">v0.7 · 26 Ekim 2026</div><ul>
    <li>Uç değer kuralı sabitlendi; ortalama tüm filtrelerde aynı kuralla hesaplanıyor.</li>
    <li>Tek süre tanımı: İşlem süresi. Doğrudan alıcıya gönderilen ödemelerde muhabir ağı süresi 0.</li>
    <li>:79: hatalıysa SWIFT kayıt zamanı (:20:) kullanılıyor; valörden önce tamamlananlar ortalamaya katılmıyor.</li></ul></div>
    <div class="log-i"><div class="d">v0.4 · 26 Ekim 2026</div><ul>
    <li>Süre tanımı sadeleştirildi.</li>
    <li>Dış rapor/kurum referansları kaldırıldı; Genel Bakış'ta "Süre nasıl ölçülüyor?" kartı.</li>
    <li>Koridorlar sayfası: ülke seçimli sade görünüm (muhabir bazında süre grafiği + muhabir × döviz tablosu).</li></ul></div>
    <div class="log-i"><div class="d">v0.3 · 26 Ekim 2026 · 3 aylık veri</div><ul>
    <li>Mayıs–Temmuz 2026 verisi (267 bin mesaj, 70.909 işlem) yüklendi.</li>
    <li>Tüm süreler medyan yerine ortalama; uç değerler Tukey kuralı ile ayıklanıyor (kapatılabilir).</li>
    <li>Süre bazı seçimi ve uç değer ayıklama eklendi.</li>
    <li>Operasyonel başlangıç (valör) desteği; valörden önce sonuçlanan işlemlerde çıkış zamanı kullanılıyor.</li>
    <li>:79: damga kontrolü genişletildi (ileri tarihli damgalar ayıklanıyor). Grafiklerde koyu yeşil.</li></ul></div>
    <div class="log-i"><div class="d">v0.2 · 22 Ekim 2026</div><ul><li>Revize SP (ACCC'yi gönderen banka kontrolü), GitHub hazırlığı, start.command iyileştirmesi.</li></ul></div>
    <div class="log-i"><div class="d">v0.1 · 14 Ekim 2026 · İlk prototip</div><ul>
    <li>Book1.csv (82.658 satır, 122 MB) mesaj seviyesinde ayrıştırıldı; 21.545 UETR için işlem tablosu üretildi.</li>
    <li>pacs.008/009 XML ve MT199/299 tracker içerikleri parse edildi: :79: olay zamanı, durum/neden kodu, bildiren & iletilen banka, 71F kesintileri.</li>
    <li>Düzeltilmiş metrikler: alıcı banka teyitli ilk ACCC, gpi olay zamanı, 6/4 haneli BIC eşleşmesi, zaman damgası kalite kontrolü.</li>
    <li>Platform: Genel Bakış, 3D Dünya, Süreç Analizi, Koridorlar, Banka Karnesi, Uyarılar, Tahminleme, İşlem Gezgini, Veri Kalitesi, AI Asistan.</li>
    <li>Yerel sunucu (server.py) ile Azure GPT-5.1 ve Speech proxy'si; API anahtarları tarayıcıya gönderilmez.</li></ul></div></div>
    <div class="card"><h3>Açık sorular / teyit gerekenler</h3><ul style="line-height:1.7;color:var(--t2)">
    <li>CSV Excel'den geçmiş (Reference bilimsel gösterimde). Doğrudan SQL export'u alınabilir mi?</li>
    <li>Hafta sonu tracker mesajları neden pazartesi 00:xx'te işleniyor? (KT SWIFT arayüz/servis planı)</li>
    <li>Mayıs öncesi gönderilen işlemlerin mesajları da alınabilir mi? (Daha uzun pencere = daha güvenilir tahmin)</li>
    <li>Müşteri segmenti / kanal / şube bilgisi eklenebilir mi? (Algı analizi için)</li>
    <li>Kurumsal ağda flagcdn.com erişimi yoksa bayraklar emoji olarak gösterilir.</li></ul>
    <h3 style="margin-top:16px">Yol haritası</h3><ul style="line-height:1.7;color:var(--t2)">
    <li>Otomatik veri yenileme: CSV yerine doğrudan SQL bağlantısı + günlük pipeline.</li>
    <li>SLA tanımları ve banka bazlı hedefler; haftalık yönetim raporu (PDF) üretimi.</li>
    <li>Kuyruktaki işlemler için canlı uyarı (e-posta / Teams).</li>
    <li>Tatil takvimi (TR/US/hedef ülke) ve iş saati bazlı süre metriği.</li>
    <li>Muhabir seçimi önerisi: aynı ülke/döviz için alternatif muhabirlerin karşılaştırmalı skoru.</li></ul></div></div>`;
}});
boot();
