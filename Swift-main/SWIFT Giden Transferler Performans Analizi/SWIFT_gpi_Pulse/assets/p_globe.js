/* 3D Dünya Haritası · Banka Karnesi */
'use strict';
const HUB = {TR: [41.01, 28.98], US: [40.71, -74.0], DE: [50.11, 8.68], GB: [51.5, -0.12], AT: [48.2, 16.37], FR: [48.85, 2.35], IT: [45.46, 9.19], ES: [41.39, 2.17], BE: [50.85, 4.35], CH: [47.37, 8.54], HK: [22.3, 114.17], CN: [31.23, 121.47], AE: [25.2, 55.27], KW: [29.37, 47.98], SA: [24.71, 46.67], JP: [35.68, 139.69], SG: [1.29, 103.85]};
function ll(cc) { if (HUB[cc]) return HUB[cc]; const c = M.countries[cc]; return c ? c.ll : [0, 0]; }
let GSEL = null, GMET = 'med';
page({id: 'globe', sec: 'Analiz', title: 'Dünya Haritası', icon: 'globe', sub: 'Ülke ve banka akışlarını gösteren etkileşimli 3D küre · sürükleyerek döndürün, tıklayarak ülke seçin', render(v) {
  v.innerHTML = `<div class="globe-wrap"><div id="globe"></div>
    <div class="gctl"><div class="tabs" id="gMet">
      <div class="tab" data-m="med">Ortalama süre</div><div class="tab" data-m="vol">İşlem hacmi</div><div class="tab" data-m="ben">Alıcıda bekleme</div><div class="tab" data-m="same">Aynı gün %</div></div>
      <div class="tabs"><div class="tab" id="gRot">⟳ Otomatik dönüş</div><div class="tab" id="gArc">✦ Akış çizgileri</div></div></div>
    <div class="glegend" id="gLeg"></div><div class="gpanel" id="gPanel"></div></div>`;
  const A = FX;
  const byC = new Map([...groupBy(A, t => t.ctry)].map(([k, a]) => [k, {a, s: stats(a)}]));
  const metric = cc => { const x = byC.get(cc); if (!x || (GMET !== 'vol' && x.s.nacc < 5)) return null; const s = x.s;
    return GMET === 'med' ? s.p50 : GMET === 'vol' ? s.n : GMET === 'ben' ? s.ben50 : s.same; };
  const vals = sorted([...byC.keys()].filter(k => byC.get(k).s.n >= 5).map(metric));
  const vmin = vals[0] || 0, vmax = GMET === 'vol' ? (vals.at(-1) || 1) : q(vals, .9) || 1;
  const RAMP = GMET === 'same' ? ['#6e2a0c', '#e8892f', '#f9e08b', '#9be7b8', '#1fae5b'] : GMET === 'vol' ? ['#cfeedd', '#7fd6a5', '#2fb36d', '#0d7a43', '#04461f'] : ['#d9f7e4', '#f9e08b', '#f2a33c', '#d65a1f', '#8a1f0c'];
  const colorOf = val => { if (val == null) return 'rgba(255,255,255,.05)'; let r = GMET === 'vol' ? Math.log(val + 1) / Math.log(vmax + 1) : (val - vmin) / ((vmax - vmin) || 1); r = Math.max(0, Math.min(1, r)); return echarts.color.lerp(r, RAMP); };
  const fmt = val => GMET === 'vol' ? nf(val) + ' işlem' : GMET === 'same' ? pct(val) : dur(val);
  $('#gLeg').innerHTML = `<b>${{med: 'Ortalama işlem süresi', vol: 'İşlem hacmi', ben: 'Ortalama alıcı banka süresi', same: 'Aynı gün tamamlanma'}[GMET]}</b><div class="gramp" style="background:linear-gradient(90deg,${RAMP.join(',')})"></div><div style="display:flex;justify-content:space-between"><span>${fmt(vmin)}</span><span>${fmt(vmax)}${GMET === 'vol' ? '' : '+'}</span></div><div style="margin-top:4px;color:#9fbcb0">Ark rengi: ortalama süre · kalınlık: hacim</div>`;
  $$('#gMet .tab').forEach(t => { t.classList.toggle('on', t.dataset.m === GMET); t.onclick = () => { GMET = t.dataset.m; route(true); }; });
  const NUM2 = {}; Object.entries(M.countries).forEach(([k, c]) => { if (c.num) NUM2[String(+c.num)] = k; });
  const feats = topojson.feature(WORLD_TOPO, WORLD_TOPO.objects.countries).features.filter(f => f.id !== '010');
  feats.forEach(f => f.cc = NUM2[String(+f.id)] || null);
  // arklar: TR -> muhabir ülkesi -> alıcı ülke
  const fl = new Map();
  A.forEach(t => { const cc = BANK[t.corr] ? BANK[t.corr].ctry : 'TR'; const k1 = 'TR|' + cc, k2 = cc + '|' + t.ctry;
    [k1, k2].forEach(k => { if (k.split('|')[0] === k.split('|')[1]) return; if (!fl.has(k)) fl.set(k, []); fl.get(k).push(t); }); });
  const arcsAll = [...fl.entries()].map(([k, a]) => { const [s, e] = k.split('|'); const m = avg(a.filter(t => t.st === 'ACCC').map(t => t.tot)); return {s, e, n: a.length, m}; }).sort((a, b) => b.n - a.n).slice(0, 70);
  const nmax = Math.max(...arcsAll.map(a => a.n), 1), amx = q(sorted(arcsAll.map(a => a.m).filter(x => x != null)), .9) || 1;
  const arcCol = m => echarts.color.lerp(Math.min(1, (m || 0) / amx), ['#7dffb3', '#ffe08a', '#ff9d4d', '#ff4d4d']);
  const el = $('#globe');
  if (typeof Globe === 'undefined') { el.innerHTML = '<div class="empty">3D kütüphane yüklenemedi.</div>'; return; }
  const G = Globe()(el).backgroundColor('rgba(0,0,0,0)').showAtmosphere(true).atmosphereColor('#3ee08f').atmosphereAltitude(.2)
    .width(el.clientWidth).height(el.clientHeight)
    .polygonsData(feats).polygonAltitude(f => f.cc === GSEL ? .06 : (f.cc && byC.get(f.cc) ? .012 : .004))
    .polygonCapColor(f => f.cc === GSEL ? '#e8c26b' : colorOf(f.cc ? metric(f.cc) : null))
    .polygonSideColor(() => 'rgba(20,60,50,.35)').polygonStrokeColor(() => 'rgba(220,255,240,.25)')
    .polygonLabel(f => { if (!f.cc) return ''; const x = byC.get(f.cc); return `<div style="background:rgba(10,32,27,.9);padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.15);color:#eef5f1;font-size:12px">${flagEmoji(f.cc)} <b>${h(ctryName(f.cc))}</b><br>${x ? `${nf(x.s.n)} işlem · ortalama ${dur(x.s.p50)}<br>Muhabir ${dur(x.s.net50)} · Alıcı ${dur(x.s.ben50)}` : 'İşlem yok'}</div>`; })
    .onPolygonClick(f => { if (f.cc) selectCountry(f.cc); })
    .polygonsTransitionDuration(400)
    .arcsData(arcsAll).arcStartLat(a => ll(a.s)[0]).arcStartLng(a => ll(a.s)[1]).arcEndLat(a => ll(a.e)[0]).arcEndLng(a => ll(a.e)[1])
    .arcColor(a => [arcCol(a.m), arcCol(a.m)]).arcStroke(a => .25 + 1.6 * Math.sqrt(a.n / nmax)).arcAltitudeAutoScale(.45)
    .arcDashLength(.4).arcDashGap(.15).arcDashAnimateTime(a => 2200 + (a.m || 0) / amx * 2500)
    .arcLabel(a => `${flagEmoji(a.s)} ${ctryName(a.s)} → ${flagEmoji(a.e)} ${ctryName(a.e)}<br>${nf(a.n)} işlem · ortalama ${dur(a.m)}`)
    .ringsData([{lat: 41.01, lng: 28.98}]).ringColor(() => t => `rgba(62,224,143,${1 - t})`).ringMaxRadius(6).ringPropagationSpeed(2.5).ringRepeatPeriod(900)
    .labelsData([{lat: 41.01, lng: 28.98, t: 'Kuveyt Türk · İstanbul'}, ...['US', 'DE', 'GB', 'AT'].map(c => ({lat: HUB[c][0], lng: HUB[c][1], t: ctryName(c) + ' hub'}))])
    .labelLat(d => d.lat).labelLng(d => d.lng).labelText(d => d.t).labelSize(.9).labelDotRadius(.45).labelColor(() => 'rgba(238,245,241,.9)').labelResolution(2);
  try { const mat = G.globeMaterial(); mat.color.set('#0c3a2f'); if (mat.emissive) mat.emissive.set('#072a21'); mat.shininess = 12; } catch (e) {}
  G.controls().autoRotate = true; G.controls().autoRotateSpeed = .45;
  G.pointOfView({lat: 32, lng: 30, altitude: 2.1}, 0);
  window._globe = G;
  new ResizeObserver(() => G.width(el.clientWidth).height(el.clientHeight)).observe(el);
  $('#gRot').classList.add('on'); $('#gArc').classList.add('on');
  $('#gRot').onclick = e => { const c = G.controls(); c.autoRotate = !c.autoRotate; e.target.classList.toggle('on', c.autoRotate); };
  $('#gArc').onclick = e => { const on = !e.target.classList.contains('on'); e.target.classList.toggle('on', on); G.arcsData(on ? arcsAll : []); };
  function selectCountry(cc) {
    GSEL = cc; G.polygonAltitude(G.polygonAltitude()).polygonCapColor(G.polygonCapColor());
    const c = M.countries[cc]; if (c) G.pointOfView({lat: c.ll[0], lng: c.ll[1], altitude: 1.6}, 1200);
    G.controls().autoRotate = false; $('#gRot').classList.remove('on'); panel();
  }
  function panel() {
    const P = $('#gPanel');
    if (!GSEL || !byC.get(GSEL)) {
      const top = [...byC.entries()].sort((a, b) => b[1].s.n - a[1].s.n).slice(0, 12);
      P.innerHTML = `<div style="font-weight:800;font-size:15px">Küresel görünüm</div><div style="color:#a9c4b8;font-size:12px;margin-top:2px">Bir ülkeye tıklayarak detay görün</div>
        <div class="glist" style="margin-top:10px">${top.map(([k, x]) => `<div class="r" style="cursor:pointer" data-c="${k}"><span>${flag(k)} ${h(ctryName(k))}</span><span>${nf(x.s.n)} · <b>${dur(x.s.p50)}</b></span></div>`).join('')}</div>`;
      $$('[data-c]', P).forEach(r => r.onclick = () => selectCountry(r.dataset.c)); return;
    }
    const x = byC.get(GSEL), s = x.s;
    const bb = [...groupBy(x.a, t => t.ben)].map(([k, a]) => [k, stats(a)]).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
    const cb = [...groupBy(x.a, t => t.corr)].map(([k, a]) => [k, stats(a)]).sort((a, b) => b[1].n - a[1].n).slice(0, 5);
    P.innerHTML = `<div style="display:flex;gap:12px;align-items:center">${flag(GSEL, true)}<div><div style="font-weight:800;font-size:18px">${h(ctryName(GSEL))}</div><div style="color:#a9c4b8;font-size:12px">${h(GSEL)} · ${h(M.countries[GSEL]?.reg || '')}</div></div></div>
      <div class="gstat"><div><b>${nf(s.n)}</b><span>İşlem</span></div><div><b>${dur(s.p50)}</b><span>Ortalama işlem süresi</span></div><div><b>${dur(s.net50)}</b><span>Muhabir ağı</span></div><div><b>${dur(s.ben50)}</b><span>Alıcı banka</span></div><div><b>${pct(s.same)}</b><span>Aynı gün</span></div><div><b>${pct(s.acc)}</b><span>ACCC oranı</span></div></div>
      <div style="font-weight:700;margin:6px 0">Alıcı bankalar</div><div class="glist">${bb.map(([k, z]) => `<div class="r" style="cursor:pointer" data-b="${k}"><span class="bank">${mono(k)}<span class="nm" style="max-width:170px">${h(BANK[k].name)}</span></span><span>${nf(z.n)} · <b>${dur(z.p50)}</b></span></div>`).join('')}</div>
      <div style="font-weight:700;margin:12px 0 6px">Kullanılan muhabirler</div><div class="glist">${cb.map(([k, z]) => `<div class="r"><span class="bank">${mono(k)}<span class="nm" style="max-width:170px">${h(BANK[k]?.name || '')}</span></span><span>${nf(z.n)} · <b>${dur(z.p50)}</b></span></div>`).join('')}</div>
      <div style="display:flex;gap:8px;margin-top:14px"><button class="btn" id="gF">Bu ülkeyi filtrele</button><button class="btn sec" id="gB" style="color:#eef5f1">Küresel</button></div>`;
    $('#gF').onclick = () => setFilter('ctry', GSEL);
    $('#gB').onclick = () => { GSEL = null; G.polygonAltitude(G.polygonAltitude()).polygonCapColor(G.polygonCapColor()); G.pointOfView({lat: 32, lng: 30, altitude: 2.1}, 1000); panel(); };
    $$('[data-b]', P).forEach(r => r.onclick = () => showBank(+r.dataset.b, 'ben'));
  }
  if (F.ctry.size === 1) GSEL = [...F.ctry][0];
  panel();
}});

/* ---------- Banka Karnesi ---------- */
let BTAB = 'ben', BMIN = 20;
function rankPct(vals, x, higherBetter) { const n = vals.length; if (!n || x == null) return .5; const below = vals.filter(v => higherBetter ? v < x : v > x).length; return below / Math.max(1, n - 1); }
function scoreBanks(key) {
  const g = [...groupBy(FX, t => t[key])].filter(([k, a]) => k >= 0 && a.length >= BMIN).map(([k, a]) => ({k, s: stats(a), a}));
  const f = key === 'ben' ? [['p50', .35, 0], ['p90', .2, 0], ['same', .2, 1], ['acc', .15, 1], ['rj', .1, 0]] : [['net50', .35, 0], ['net90', .25, 0], ['p50', .15, 0], ['acc', .15, 1], ['rj', .1, 0]];
  const cols = {}; f.forEach(([m]) => cols[m] = g.map(r => r.s[m]).filter(x => x != null));
  g.forEach(r => { r.score = Math.round(100 * f.reduce((s, [m, w, hb]) => s + w * rankPct(cols[m], r.s[m], hb), 0)); r.grade = r.score >= 80 ? 'A' : r.score >= 65 ? 'B' : r.score >= 50 ? 'C' : r.score >= 35 ? 'D' : 'E'; });
  return g.sort((a, b) => b.score - a.score);
}
page({id: 'banks', sec: 'Performans', title: 'Banka Karnesi', icon: 'bank', sub: 'Alıcı ve muhabir bankaların hız, tutarlılık ve başarı skorlaması', render(v) {
  v.innerHTML = `<div class="card"><div class="card-h"><div><div class="tabs" id="bTab"><div class="tab" data-t="ben">Alıcı bankalar</div><div class="tab" data-t="corr">Muhabir bankalar</div></div></div>
    <div style="display:flex;gap:10px;align-items:center"><span class="note">Min. işlem</span><select class="fdate" id="bMin">${[10, 20, 50, 100].map(x => `<option ${x === BMIN ? 'selected' : ''}>${x}</option>`).join('')}</select><input class="search" id="bQ" placeholder="Banka adı / BIC ara…" style="width:240px"></div></div>
    <div class="note" style="margin:10px 0" id="bNote"></div><div class="tbl-wrap" style="max-height:640px" id="bTbl"></div></div>
    <div class="grid g2 mt"><div class="card"><h3>Hız × tutarlılık haritası</h3><div class="sub">Her nokta bir banka · sol-alt = hızlı ve istikrarlı · nokta boyutu = hacim</div><div class="chart tall" id="bScat"></div></div>
    <div class="card"><h3>Not dağılımı</h3><div class="sub">A (en iyi) → E</div><div class="chart tall" id="bGrade"></div></div></div>`;
  $$('#bTab .tab').forEach(t => { t.classList.toggle('on', t.dataset.t === BTAB); t.onclick = () => { BTAB = t.dataset.t; route(true); }; });
  $('#bMin').onchange = e => { BMIN = +e.target.value; route(true); };
  const rows = scoreBanks(BTAB);
  $('#bNote').innerHTML = BTAB === 'ben' ? 'Skor (0–100): ortalama işlem süresi %35 · tutarlılık (%90 sınırı) %20 · aynı gün oranı %20 · ACCC oranı %15 · red oranı %10. Her bileşen bankalar arası yüzdelik sıraya çevrilir.' : 'Skor (0–100): ortalama muhabir ağı süresi %35 · muhabir %90 sınırı %25 · ortalama işlem süresi %15 · ACCC oranı %15 · red oranı %10. Muhabir ağı süresi = çıkış → alıcı bankaya ulaşma.';
  const draw = (qq) => { const ql = (qq || '').toLocaleLowerCase('tr'); const list = rows.filter(r => !ql || BANK[r.k].name.toLocaleLowerCase('tr').includes(ql) || BANK[r.k].bic.toLowerCase().includes(ql));
    $('#bTbl').innerHTML = `<table class="t"><thead><tr><th>#</th><th>Banka</th><th class="num">İşlem</th><th class="num">ACCC</th><th class="num">Ortalama</th><th class="num">%90 sınırı</th><th class="num">${BTAB === 'ben' ? 'Alıcıda bekleme' : 'Muhabir ağı'}</th><th class="num">Aynı gün</th><th class="num">Red</th><th>Skor</th><th>Not</th></tr></thead><tbody>
    ${list.map((r, i) => `<tr class="clk" data-k="${r.k}"><td>${i + 1}</td><td>${bankCell(r.k)}</td><td class="num">${nf(r.s.n)}</td><td class="num">${pct(r.s.acc)}</td><td class="num"><b>${dur(r.s.p50)}</b></td><td class="num">${dur(r.s.p90)}</td><td class="num">${dur(BTAB === 'ben' ? r.s.ben50 : r.s.net50)}</td><td class="num">${pct(r.s.same)}</td><td class="num">${pct(r.s.rj, 1)}</td><td><span class="scorebar"><i style="width:${r.score}%"></i></span>${r.score}</td><td><span class="grade g${r.grade}">${r.grade}</span></td></tr>`).join('')}</tbody></table>`;
    $$('#bTbl tr.clk').forEach(tr => tr.onclick = () => showBank(+tr.dataset.k, BTAB)); };
  draw(''); $('#bQ').oninput = e => draw(e.target.value);
  const xk = BTAB === 'ben' ? 'p50' : 'net50', yk = BTAB === 'ben' ? 'p90' : 'net90';
  const gc = {A: '#0ca30c', B: '#5aa61f', C: '#c98500', D: '#ec835a', E: '#d03b3b'};
  chart($('#bScat'), {grid: {left: 50, right: 20, top: 20, bottom: 40, containLabel: true}, tooltip: {trigger: 'item', formatter: p => `<b>${h(BANK[p.data.k].name)}</b><br>${p.data.n} işlem · not ${p.data.g}<br>Ortalama ${dur(p.value[0])} · %90 sınırı ${dur(p.value[1])}`},
    xAxis: ax({type: 'log', name: 'Ortalama', nameLocation: 'middle', nameGap: 26, axisLabel: {formatter: x => dur(x), color: cssv('--t3')}}), yAxis: ax({type: 'log', name: '%90 sınırı', axisLabel: {formatter: x => dur(x), color: cssv('--t3')}}),
    series: [{type: 'scatter', data: rows.filter(r => r.s[xk] > 0 && r.s[yk] > 0).map(r => ({value: [r.s[xk], r.s[yk]], k: r.k, n: r.s.n, g: r.grade, symbolSize: 8 + Math.sqrt(r.s.n) / 2, itemStyle: {color: gc[r.grade], borderColor: cssv('--surface'), borderWidth: 2, opacity: .9}}))}]});
  const gcnt = ['A', 'B', 'C', 'D', 'E'].map(g => rows.filter(r => r.grade === g).length);
  chart($('#bGrade'), {grid: {left: 40, right: 10, top: 20, bottom: 30, containLabel: true}, tooltip: {trigger: 'axis'}, xAxis: ax({type: 'category', data: ['A', 'B', 'C', 'D', 'E']}), yAxis: ax({type: 'value'}),
    series: [{type: 'bar', barMaxWidth: 40, label: {show: true, position: 'top', color: cssv('--t2')}, data: gcnt.map((n, i) => ({value: n, itemStyle: {color: Object.values(gc)[i], borderRadius: [5, 5, 0, 0]}}))}]});
}});
function showBank(k, key) {
  const a = FX.filter(t => t[key] === k); const s = stats(a); const b = BANK[k];
  const rk = scoreBanks(key).find(r => r.k === k);
  const other = key === 'ben' ? 'corr' : 'ben';
  const og = [...groupBy(a, t => t[other])].map(([x, z]) => [x, stats(z)]).sort((p, q2) => q2[1].n - p[1].n).slice(0, 8);
  const slow = a.filter(t => t.st === 'ACCC').sort((p, q2) => q2.tot - p.tot).slice(0, 8);
  openDrawer(`<div style="display:flex;gap:14px;align-items:center;margin-top:6px">${mono(k, true)}<div><div style="font-size:19px;font-weight:800">${h(b.name)}</div><div class="note">${flag(b.ctry)} ${h(ctryName(b.ctry))} · ${h(b.bic)} · ${key === 'ben' ? 'Alıcı banka' : 'Muhabir banka'}</div></div>${rk ? `<span class="grade g${rk.grade}" style="margin-left:auto;width:44px;height:44px;font-size:20px">${rk.grade}</span>` : ''}</div>
    <div class="kv"><div><span>İşlem</span><b>${nf(s.n)}</b></div><div><span>Ortalama işlem süresi</span><b>${dur(s.p50)}</b></div><div><span>%90 sınırı</span><b>${dur(s.p90)}</b></div>
    <div><span>Muhabir ağı (ortalama)</span><b>${dur(s.net50)}</b></div><div><span>Alıcı banka (ortalama)</span><b>${dur(s.ben50)}</b></div><div><span>Skor</span><b>${rk ? rk.score + ' / 100' : '— (az işlem)'}</b></div>
    <div><span>Aynı gün</span><b>${pct(s.same)}</b></div><div><span>ACCC</span><b>${pct(s.acc)}</b></div><div><span>Red</span><b>${pct(s.rj, 1)}</b></div></div>
    ${stageBar(s.shareNet, 1 - s.shareNet, [pct(s.shareNet), pct(1 - s.shareNet)])}
    <h3 style="margin-top:18px">Günlük ortalama süre</h3><div class="chart sm" id="bk-trend"></div>
    <h3 style="margin-top:14px">${key === 'ben' ? 'Kullanılan muhabirler' : 'Alıcı bankalar'}</h3>
    <table class="t"><tbody>${og.map(([x, z]) => `<tr><td>${bankCell(x)}</td><td class="num">${nf(z.n)}</td><td class="num"><b>${dur(z.p50)}</b></td><td class="num">${pct(z.same)}</td></tr>`).join('')}</tbody></table>
    <h3 style="margin-top:14px">En uzun süren işlemler</h3>
    <table class="t"><tbody>${slow.map(t => `<tr class="clk" data-i="${t.i}"><td>${h(t.ref)}</td><td>${tLabel(t.t0)}</td><td>${t.ccy} ${nf(t.amt, 2)}</td><td class="num"><b>${dur(t.tot)}</b></td></tr>`).join('')}</tbody></table>
    <div style="margin-top:14px;display:flex;gap:8px"><button class="btn" onclick="closeDrawer();setFilter('${key}',${k})">Bu bankayı filtrele</button></div>`);
  $$('#drawerIn tr.clk').forEach(r => r.onclick = () => showTx(+r.dataset.i));
  const dm = groupBy(a.filter(t => t.st === 'ACCC'), t => t.day); const days = [...dm.keys()].sort((x, y) => x - y);
  const c = echarts.init($('#bk-trend')); c.setOption(Object.assign(baseOpt(), {grid: {left: 40, right: 10, top: 10, bottom: 24, containLabel: true}, tooltip: {trigger: 'axis', valueFormatter: x => dur(x)},
    xAxis: ax({type: 'category', data: days.map(dayLabel)}), yAxis: ax({type: 'value', axisLabel: {formatter: x => dur(x), color: cssv('--t3')}}),
    series: [{type: 'line', smooth: .3, symbolSize: 7, data: days.map(d => avg(dm.get(d).map(t => t.tot))), lineStyle: {color: cssv('--s3'), width: 2}, itemStyle: {color: cssv('--s3')}}]}));
}
