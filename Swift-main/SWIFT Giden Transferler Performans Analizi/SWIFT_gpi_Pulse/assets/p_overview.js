/* Genel Bakış · Süreç Analizi · Koridorlar */
'use strict';
function kpi(icon, l, v, s) { return `<div class="card kpi"><div class="kpi-ic">${ic(icon)}</div><div><div class="kpi-l">${l}</div><div class="kpi-v">${v}</div><div class="kpi-s">${s || ''}</div></div></div>`; }
function stageBar(net, ben, lab) {
  const s1 = cssv('--s1'), s2 = cssv('--s2'); const tot = (net || 0) + (ben || 0) || 1;
  const a = Math.max(4, net / tot * 100), b = Math.max(4, 100 - a);
  const L1 = lab ? (a >= 22 ? 'Muhabir ağı ' + lab[0] : a >= 8 ? lab[0] : '') : '', L2 = lab ? (b >= 22 ? 'Alıcı banka ' + lab[1] : b >= 8 ? lab[1] : '') : '';
  return `<div class="stagebar"><div style="width:${a}%;background:${s1}" title="Muhabir ağı">${L1}</div><div style="width:${b}%;background:${s2}" title="Alıcı banka">${L2}</div></div>`;
}
const BUCKETS = [[0, 15, '≤15 dk'], [15, 30, '15–30 dk'], [30, 60, '30–60 dk'], [60, 120, '1–2 sa'], [120, 240, '2–4 sa'], [240, 480, '4–8 sa'], [480, 1440, '8–24 sa'], [1440, 2880, '1–2 gün'], [2880, 4320, '2–3 gün'], [4320, 7200, '3–5 gün'], [7200, 1e9, '5+ gün']];
function histo(vals) { return BUCKETS.map(([a, b]) => vals.filter(x => x != null && x >= a && x < b).length); }

function insights(arr, S) {
  const out = [];
  if (!S.nacc) return '<div class="empty">Seçili filtrede tamamlanan işlem yok.</div>';
  out.push(['⏱', `Tamamlanan ödemelerin <b>${pct(S.le60)}</b>'i ilk 1 saatte, <b>${pct(S.same)}</b>'i aynı gün alıcı hesabına geçti. 2 gün ve üzeri süren ödemelerin payı <b>${pct(S.later)}</b>.`]);
  out.push(['⚖', `Toplam bekleme süresinin <b>${pct(S.shareNet)}</b>'i muhabir ağında, <b>${pct(1 - S.shareNet)}</b>'i alıcı bankada geçiyor. Gecikmenin ana kaynağı ${S.shareNet < .5 ? '<b>alıcı banka</b>' : '<b>muhabir ağı</b>'}.`]);
  const acc = arr.filter(t => t.st === 'ACCC');
  const pre = avg(acc.filter(t => t.hour < 17).map(t => t.tot)), post = avg(acc.filter(t => t.hour >= 17).map(t => t.tot));
  if (pre != null && post != null) out.push(['🕔', `17:00 öncesi gönderilen ödemelerin ortalaması <b>${dur(pre)}</b>, 17:00 sonrası gönderilenlerin <b>${dur(post)}</b>. Kesim saati etkisi belirgin.`]);
  const bc = [...groupBy(acc, t => t.ctry)].filter(([, v]) => v.length >= 30).map(([k, v]) => [k, avg(v.map(t => t.tot)), v.length]).sort((a, b) => b[1] - a[1]);
  if (bc.length > 2) out.push(['🌍', `En yavaş koridor <b>${flagEmoji(bc[0][0])} ${ctryName(bc[0][0])}</b> (ortalama ${dur(bc[0][1])}), en hızlı <b>${flagEmoji(bc.at(-1)[0])} ${ctryName(bc.at(-1)[0])}</b> (ortalama ${dur(bc.at(-1)[1])}).`]);
  if (S.nrj) out.push(['⛔', `<b>${nf(S.nrj)}</b> ödeme reddedildi (${pct(S.rj, 1)}); <b>${nf(S.nopen)}</b> ödeme veri sonunda hâlâ sonuçlanmamış.`]);
  return out.map(([i, t]) => `<div class="ins"><div class="ins-ic">${i}</div><div>${t}</div></div>`).join('');
}

page({id: 'overview', sec: 'Analiz', title: 'Genel Bakış', icon: 'home', sub: 'Ödeme işlem süresi, aşama dağılımı ve sonuç durumu', render(v) {
  const S = stats(FX);
  v.innerHTML = `
  <div class="grid g4">
    ${kpi('route', 'Toplam İşlem (UETR)', nf(S.n), `${nf(S.nacc)} tamamlandı · ${nf(S.nrj)} red`)}
    ${kpi('check', 'Tamamlanma Oranı (ACCC)', pct(S.acc, 1), 'Alıcı banka teyitli alacak kaydı')}
    ${kpi('flow', 'Ortalama Muhabir Ağı Süresi', dur(S.net50), 'İşlemlerin %90\'ı ≤ ' + dur(S.net90))}
    ${kpi('bank', 'Ortalama Alıcı Banka Süresi', dur(S.ben50), 'İşlemlerin %90\'ı ≤ ' + dur(S.ben90))}
  </div>
  <div class="hero mt">
    <div class="card hero-main">
      <div class="hero-t">Ortalama süre · operasyonel başlangıç (çıkış / valör) → alıcı hesabına alacak</div>
      <div class="hero-big">${dur(S.p50)}</div>
      <div class="hero-txt">${h(METRICS[SET.m])} · ${SET.out ? `P95 ortalama (uç değerler hariç) · hariç tutulan: ${nf(S.nOut)} işlem (%${nf(S.nOut / Math.max(1, S.nacc) * 100, 1)}).` : 'Tüm tamamlanan işlemler dahil ortalama.'}<br>Tüm işlemler dahil ortalama: <b>${dur(S.meanAll)}</b> · İşlemlerin %90'ı <b>${dur(S.p90)}</b> içinde tamamlandı.</div>
      <div style="margin-top:14px" class="kpi-l">Toplam zamanın nerede harcandığı</div>
      ${stageBar(S.shareNet, 1 - S.shareNet, [pct(S.shareNet), pct(1 - S.shareNet)])}
      <div class="legend"><span><i style="background:var(--s1)"></i>Muhabir ağı = çıkış → alıcı bankaya ulaşma</span><span><i style="background:var(--s2)"></i>Alıcı banka = ulaşma → alacak kaydı</span></div>
    </div>
    <div class="card"><h3>Ne kadar sürede ulaşıyor?</h3><div class="sub">Tamamlanan (ACCC) ödemeler</div>
      <div class="buckets">
        <div class="bk"><div class="bk-v">${pct(S.le30)}</div><div class="bk-l">≤ 30 dakika</div></div>
        <div class="bk"><div class="bk-v">${pct(S.le60)}</div><div class="bk-l">≤ 1 saat</div></div>
        <div class="bk"><div class="bk-v">${pct(S.le240)}</div><div class="bk-l">≤ 4 saat</div></div>
        <div class="bk" style="border-color:rgba(62,224,143,.4)"><div class="bk-v">${pct(S.same)}</div><div class="bk-l">Aynı gün</div></div>
        <div class="bk"><div class="bk-v">${pct(S.next)}</div><div class="bk-l">Ertesi gün</div></div>
        <div class="bk"><div class="bk-v">${pct(S.later)}</div><div class="bk-l">2+ gün sonra</div></div>
      </div></div>
  </div>
  <div class="card mt" id="methodCmp"></div>
  <div class="grid g21 mt">
    <div class="card"><h3>Günlük işlem hacmi ve sonuç durumu</h3><div class="sub">Gönderim gününe göre</div><div class="chart" id="c-daily"></div></div>
    <div class="card"><h3>Öne çıkan bulgular</h3><div class="sub">Seçili filtreye göre otomatik</div>${insights(FX, S)}</div>
  </div>
  <div class="grid g3 mt">
    <div class="card"><h3>Günlük ortalama süre</h3><div class="sub">ACCC ödemeler, işlem süresi</div><div class="chart sm" id="c-dmed"></div></div>
    <div class="card"><h3>Süre dağılımı</h3><div class="sub">Tamamlanan ödemeler</div><div class="chart sm" id="c-hist"></div></div>
    <div class="card"><h3>Sonuç durumu</h3><div class="sub">Tüm işlemler</div><div class="chart sm" id="c-state"></div></div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><h3>En hızlı ülkeler</h3><div class="sub">Ortalama işlem süresi · min. 30 işlem</div><div id="t-fast"></div></div>
    <div class="card"><h3>En yavaş ülkeler</h3><div class="sub">Ortalama işlem süresi · min. 30 işlem</div><div id="t-slow"></div></div>
  </div>`;
  const days = Array.from({length: F.to - F.from + 1}, (_, i) => F.from + i);
  const bySt = ['ACCC', 'NONGPI', 'PEND_BEN', 'IN_NET', 'ACC_INT', 'RJCT', 'NO_TRK'];
  const dm = groupBy(FX, t => t.day);
  chart($('#c-daily'), {tooltip: {trigger: 'axis'}, legend: {top: 0, textStyle: {color: cssv('--t2'), fontSize: 11}, itemWidth: 10, itemHeight: 10},
    grid: {left: 40, right: 10, top: 44, bottom: 24, containLabel: true},
    xAxis: ax({type: 'category', data: days.map(d => dayLabel(d) + ' ' + DOW[(4 + d) % 7])}), yAxis: ax({type: 'value'}),
    series: bySt.map(s => ({name: ST[s].l, type: 'bar', stack: 'a', barMaxWidth: 26, itemStyle: {color: ST[s].c, borderColor: cssv('--surface'), borderWidth: 1}, data: days.map(d => (dm.get(d) || []).filter(t => t.st === s).length)}))});
  chart($('#c-dmed'), {grid: {left: 40, right: 10, top: 16, bottom: 24, containLabel: true}, tooltip: {trigger: 'axis', valueFormatter: v => dur(v)},
    xAxis: ax({type: 'category', data: days.map(dayLabel)}), yAxis: ax({type: 'value', axisLabel: {formatter: v => dur(v), color: cssv('--t3')}}),
    series: [{type: 'line', name: 'Ortalama', smooth: .3, symbolSize: 5, connectNulls: true, lineStyle: {width: 2, color: cssv('--s3')}, itemStyle: {color: cssv('--s3')}, areaStyle: {color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{offset: 0, color: 'rgba(62,224,143,.3)'}, {offset: 1, color: 'rgba(62,224,143,0)'}])},
      data: days.map(d => avg((dm.get(d) || []).filter(t => t.st === 'ACCC').map(t => t.tot)))}]});
  const hv = histo(FX.filter(t => t.st === 'ACCC').map(t => t.tot));
  chart($('#c-hist'), {grid: {left: 30, right: 10, top: 16, bottom: 24, containLabel: true}, tooltip: {trigger: 'axis'},
    xAxis: ax({type: 'category', data: BUCKETS.map(b => b[2]), axisLabel: {rotate: 40, fontSize: 10, color: cssv('--t3')}}), yAxis: ax({type: 'value'}),
    series: [{type: 'bar', name: 'İşlem', data: hv, barMaxWidth: 22, itemStyle: {color: cssv('--s1'), borderRadius: [4, 4, 0, 0]}}]});
  const sc = bySt.map(s => [s, FX.filter(t => t.st === s).length]).filter(x => x[1]).sort((a, b) => a[1] - b[1]);
  chart($('#c-state'), {grid: {left: 10, right: 50, top: 6, bottom: 6, containLabel: true}, tooltip: {trigger: 'item'},
    xAxis: ax({type: 'value', show: false}), yAxis: ax({type: 'category', data: sc.map(x => ST[x[0]].l), axisLabel: {fontSize: 11, color: cssv('--t2')}}),
    series: [{type: 'bar', barMaxWidth: 16, label: {show: true, position: 'right', color: cssv('--t2'), formatter: p => nf(p.value) + ' · ' + pct(p.value / FX.length)}, data: sc.map(x => ({value: x[1], itemStyle: {color: ST[x[0]].c, borderRadius: [0, 4, 4, 0]}}))}]});
  const cs = [...groupBy(FX.filter(t => t.st === 'ACCC'), t => t.ctry)].filter(([, a]) => a.length >= 30).map(([k, a]) => ({k, n: a.length, m: avg(a.map(t => t.tot)), s: stats(a)})).sort((a, b) => a.m - b.m);
  const row = c => `<tr class="clk" data-c="${c.k}"><td><div class="bank">${flag(c.k)} ${h(ctryName(c.k))}</div></td><td class="num">${nf(c.n)}</td><td class="num"><b>${dur(c.m)}</b></td><td class="num">${pct(c.s.same)}</td><td style="width:140px">${stageBar(c.s.net50, c.s.ben50).replace('stagebar', 'stagebar" style="height:12px;margin:0')}</td></tr>`;
  const tb = list => `<div class="tbl-wrap"><table class="t"><thead><tr><th>Ülke</th><th class="num">İşlem</th><th class="num">Ortalama</th><th class="num">Aynı gün</th><th>Muhabir / Alıcı</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>`;
  $('#t-fast').innerHTML = tb(cs.slice(0, 6)); $('#t-slow').innerHTML = tb(cs.slice(-6).reverse());
  $$('#t-fast tr.clk,#t-slow tr.clk').forEach(r => r.onclick = () => setFilter('ctry', r.dataset.c));
  methodCard();
}});

page({id: 'analysis', sec: 'Analiz', title: 'Süreç Analizi', icon: 'chart', sub: 'Süre hangi aşamada harcanıyor? Ülke, döviz, saat ve rota kırılımları', render(v) {
  const A = FX.filter(t => t.st === 'ACCC');
  v.innerHTML = `
  <div class="grid g2">
    <div class="card"><h3>Aşama ayrıştırması · ülke bazında</h3><div class="sub">Ortalama muhabir ağı ve alıcı banka süreleri · en yüksek hacimli 15 ülke</div><div class="chart tall" id="a-stage"></div></div>
    <div class="card"><h3>Gönderim saati etkisi (kesim saati)</h3><div class="sub">Gönderim saatine göre ortalama işlem süresi</div><div class="chart" id="a-hour"></div>
      <div class="note" id="a-hournote"></div></div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><h3>Saat × gün ısı haritası</h3><div class="sub">Ortalama işlem süresi (koyu = daha uzun) · hücre başına min. 10 işlem</div><div class="chart" id="a-heat"></div></div>
    <div class="card"><h3>Döviz bazında aşama süreleri</h3><div class="sub">Ortalama · min. 20 işlem</div><div class="chart" id="a-ccy"></div></div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><h3>Rota uzunluğu</h3><div class="sub">Zincirdeki banka sayısına göre ortalama süre</div><div class="chart sm" id="a-hops"></div></div>
    <div class="card"><h3>Uzun işlemlerde gecikme kaynağı</h3><div class="sub">4 saati aşan ACCC ödemelerde baskın aşama</div><div class="chart sm" id="a-dom"></div></div>
  </div>
  <div class="card mt"><h3>İşlem tipi</h3><div class="sub">Direct Payment ve Cover (COV)</div><div id="a-type"></div></div>`;
  const s1 = cssv('--s1'), s2 = cssv('--s2');
  const top = [...groupBy(A, t => t.ctry)].sort((a, b) => b[1].length - a[1].length).slice(0, 15).map(([k, a]) => { const s = stats(a); return {k, net: s.net50, ben: s.ben50, tot: s.p50, n: a.length}; }).sort((a, b) => a.tot - b.tot);
  chart($('#a-stage'), {legend: {top: 0, textStyle: {color: cssv('--t2')}}, grid: {left: 10, right: 20, top: 30, bottom: 10, containLabel: true},
    tooltip: {trigger: 'axis', axisPointer: {type: 'shadow'}, formatter: p => { const r = top[p[0].dataIndex]; return `${flagEmoji(r.k)} <b>${ctryName(r.k)}</b> (${nf(r.n)} işlem)<br>Muhabir ağı: ${dur(r.net)}<br>Alıcı banka: ${dur(r.ben)}<br>Ortalama işlem süresi: <b>${dur(r.tot)}</b>`; }},
    xAxis: ax({type: 'value', axisLabel: {formatter: x => dur(x), color: cssv('--t3')}}), yAxis: ax({type: 'category', data: top.map(r => flagEmoji(r.k) + ' ' + ctryName(r.k))}),
    series: [{name: 'Muhabir ağı', type: 'bar', stack: 's', data: top.map(r => r.net), itemStyle: {color: s1, borderColor: cssv('--surface'), borderWidth: 1}, barMaxWidth: 16},
      {name: 'Alıcı banka', type: 'bar', stack: 's', data: top.map(r => r.ben), itemStyle: {color: s2, borderRadius: [0, 4, 4, 0], borderColor: cssv('--surface'), borderWidth: 1}, barMaxWidth: 16}]});
  const hrs = Array.from({length: 14}, (_, i) => i + 7);
  const hg = groupBy(A, t => t.hour);
  const hm = hrs.map(x => avg((hg.get(x) || []).map(t => t.tot))), hn = hrs.map(x => (hg.get(x) || []).length);
  chart($('#a-hour'), {grid: {left: 40, right: 10, top: 16, bottom: 24, containLabel: true}, tooltip: {trigger: 'axis', formatter: p => `${p[0].name}:00 – ${hn[p[0].dataIndex]} işlem<br>Ortalama: <b>${dur(p[0].value)}</b>`},
    xAxis: ax({type: 'category', data: hrs.map(x => String(x).padStart(2, '0'))}), yAxis: ax({type: 'value', axisLabel: {formatter: x => dur(x), color: cssv('--t3')}}),
    series: [{type: 'bar', barMaxWidth: 24, data: hm.map((m, i) => ({value: m, itemStyle: {color: hrs[i] >= 17 ? s2 : s1, borderRadius: [4, 4, 0, 0], opacity: hn[i] < 20 ? .45 : 1}}))}]});
  const pre = avg(A.filter(t => t.hour < 17).map(t => t.tot)), post = avg(A.filter(t => t.hour >= 17).map(t => t.tot));
  $('#a-hournote').innerHTML = `17:00 öncesi ortalama <b>${dur(pre)}</b> · 17:00 ve sonrası <b>${dur(post)}</b>. Turuncu çubuklar kesim saati sonrası gönderimleri gösterir; soluk çubuklar 20'den az işleme dayanır.`;
  const cells = [];
  for (let d = 0; d < 5; d++) for (const hr of hrs) { const a = A.filter(t => t.dow === d && t.hour === hr); if (a.length >= 10) cells.push([hrs.indexOf(hr), d, Math.round(avg(a.map(t => t.tot))), a.length]); }
  const vmax = Math.max(60, q(sorted(cells.map(c => c[2])), .9) || 60);
  chart($('#a-heat'), {grid: {left: 40, right: 20, top: 10, bottom: 50, containLabel: true}, tooltip: {trigger: 'item', formatter: p => `${DOW[p.value[1]]} ${hrs[p.value[0]]}:00<br>Ortalama: <b>${dur(p.value[2])}</b><br>${p.value[3]} işlem`},
    xAxis: ax({type: 'category', data: hrs.map(x => x + ':00'), splitArea: {show: false}}), yAxis: ax({type: 'category', data: DOW.slice(0, 5), inverse: true}),
    visualMap: {dimension: 2, min: 0, max: vmax, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 160, textStyle: {color: cssv('--t3')}, formatter: x => dur(x), inRange: {color: ['#fff3d6', '#f9c86b', '#e8892f', '#b4501a', '#6e2a0c']}, outOfRange: {color: '#5a2008'}},
    series: [{type: 'heatmap', data: cells, itemStyle: {borderColor: cssv('--surface'), borderWidth: 2, borderRadius: 4}}]});
  const cg = [...groupBy(A, t => t.ccy)].filter(([, a]) => a.length >= 20).map(([k, a]) => { const s = stats(a); return {k, n: a.length, net: s.net50, ben: s.ben50}; }).sort((a, b) => b.n - a.n).slice(0, 10);
  chart($('#a-ccy'), {legend: {top: 0, textStyle: {color: cssv('--t2')}}, grid: {left: 40, right: 10, top: 34, bottom: 24, containLabel: true}, tooltip: {trigger: 'axis', valueFormatter: x => dur(x)},
    xAxis: ax({type: 'category', data: cg.map(c => c.k + `\n${nf(c.n)}`), axisLabel: {interval: 0, color: cssv('--t3'), fontSize: 10.5}}), yAxis: ax({type: 'log', min: 1, axisLabel: {formatter: x => dur(x), color: cssv('--t3')}}),
    series: [{name: 'Muhabir ağı', type: 'bar', data: cg.map(c => Math.max(1, c.net)), itemStyle: {color: s1, borderRadius: [4, 4, 0, 0]}, barMaxWidth: 16},
      {name: 'Alıcı banka', type: 'bar', data: cg.map(c => Math.max(1, c.ben)), itemStyle: {color: s2, borderRadius: [4, 4, 0, 0]}, barMaxWidth: 16}]});
  const hp = groupBy(A, t => t.hops);
  const hk = [1, 2, 3, 4];
  chart($('#a-hops'), {grid: {left: 40, right: 10, top: 16, bottom: 24, containLabel: true}, tooltip: {trigger: 'axis', formatter: p => `${p[0].name}: <b>${dur(p[0].value)}</b> (${nf((hp.get(hk[p[0].dataIndex]) || []).length)} işlem)`},
    xAxis: ax({type: 'category', data: ['Doğrudan', '2 banka', '3 banka', '4+ banka']}), yAxis: ax({type: 'value', axisLabel: {formatter: x => dur(x), color: cssv('--t3')}}),
    series: [{type: 'bar', barMaxWidth: 30, itemStyle: {color: cssv('--s3'), borderRadius: [4, 4, 0, 0]}, data: hk.map(k => avg((hp.get(k) || []).map(t => t.tot)))}]});
  const L = A.filter(t => t.tot > 240 && t.net != null); const domB = L.filter(t => t.benm > t.net).length;
  chart($('#a-dom'), {tooltip: {trigger: 'item', formatter: p => `${p.name}: ${nf(p.value)} işlem (${p.percent}%)`}, legend: {bottom: 0, textStyle: {color: cssv('--t2')}},
    series: [{type: 'pie', radius: ['48%', '72%'], center: ['50%', '45%'], itemStyle: {borderColor: cssv('--surface'), borderWidth: 2, borderRadius: 6}, label: {color: cssv('--t1'), formatter: '{d}%'},
      data: [{name: 'Alıcı banka', value: domB, itemStyle: {color: s2}}, {name: 'Muhabir ağı', value: L.length - domB, itemStyle: {color: s1}}]}]});
  const tbl = (key, lab) => { const g = [...groupBy(FX, key)].map(([k, a]) => [k, stats(a)]).sort((a, b) => b[1].n - a[1].n);
    return `<table class="t"><thead><tr><th></th><th class="num">İşlem</th><th class="num">ACCC</th><th class="num">Ortalama</th><th class="num">Muhabir</th><th class="num">Alıcı</th><th class="num">Aynı gün</th></tr></thead><tbody>${g.map(([k, s]) => `<tr><td><b>${h(lab(k))}</b></td><td class="num">${nf(s.n)}</td><td class="num">${pct(s.acc)}</td><td class="num">${dur(s.p50)}</td><td class="num">${dur(s.net50)}</td><td class="num">${dur(s.ben50)}</td><td class="num">${pct(s.same)}</td></tr>`).join('')}</tbody></table>`; };
  $('#a-type').innerHTML = tbl(t => t.type, k => TYPES[k]);
}});

let KSEL = null, KBEN = -1;
page({id: 'corridors', sec: 'Analiz', title: 'Koridorlar', icon: 'flow', sub: 'Bir ülke seçin: o ülkeye hangi muhabirlerle, ne kadar sürede gönderim yapıyoruz?', render(v) {
  const cAll = [...groupBy(FX, t => t.ctry)].sort((a, b) => b[1].length - a[1].length);
  if (F.ctry.size === 1) KSEL = [...F.ctry][0];
  if (!KSEL || !cAll.some(x => x[0] === KSEL)) KSEL = cAll.length ? cAll[0][0] : null;
  const bAll = KSEL ? [...groupBy(FX.filter(t => t.ctry === KSEL), t => t.ben)].sort((a, b) => b[1].length - a[1].length) : [];
  if (F.ben.size === 1 && bAll.some(x => x[0] === [...F.ben][0])) KBEN = [...F.ben][0];
  if (!bAll.some(x => x[0] === KBEN)) KBEN = -1;
  v.innerHTML = `<div class="card"><div class="card-h"><div><h3>Ülke koridoru</h3><div class="sub">Önce alıcı ülkeyi, isterseniz ardından alıcı bankayı seçin · listeler işlem sayısına göre sıralıdır</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><select class="fdate" id="kSel" style="min-width:260px" title="Alıcı ülke">${cAll.map(([k, a]) => `<option value="${k}" ${k === KSEL ? 'selected' : ''}>${flagEmoji(k)} ${h(ctryName(k))} (${nf(a.length)} işlem)</option>`).join('')}</select>
      <select class="fdate" id="kBen" style="min-width:300px;max-width:420px" title="Alıcı banka"><option value="-1">Tüm alıcı bankalar (${nf(bAll.length)})</option>${bAll.map(([k, a]) => `<option value="${k}" ${k === KBEN ? 'selected' : ''}>${h(BANK[k].name)} · ${BANK[k].bic} (${nf(a.length)})</option>`).join('')}</select></div></div>
    <div id="kHead" style="margin-top:12px"></div>
    <div class="grid g2 mt"><div><div class="kpi-l" style="margin-bottom:6px">Muhabir bankalara göre ortalama süre</div><div class="chart" style="height:340px" id="kCorr"></div></div>
      <div><div class="kpi-l" style="margin-bottom:6px">Muhabir × döviz detayı</div><div id="kTbl"></div></div></div>
    <div class="grid g2 mt"><div><div class="kpi-l" style="margin-bottom:6px">Alıcı bankalara göre ortalama süre <span class="note">(en yoğun 10 banka · satıra tıklayarak seçin)</span></div><div class="chart" style="height:340px" id="kBenC"></div></div>
      <div><div class="kpi-l" style="margin-bottom:6px">Alıcı banka detayı</div><div id="kBenT"></div></div></div></div>
  <div class="grid g2 mt"><div class="card"><h3>🚀 En hızlı koridorlar</h3><div class="sub">Muhabir × döviz × ülke · en az 15 işlem · ortalama süreye göre</div><div id="k-fast"></div></div>
  <div class="card"><h3>🐢 En yavaş koridorlar</h3><div class="sub">Muhabir × döviz × ülke · en az 15 işlem · ortalama süreye göre</div><div id="k-slow"></div></div></div>`;
  $('#kSel').onchange = e => { KSEL = e.target.value; KBEN = -1; route(true); };
  $('#kBen').onchange = e => { KBEN = +e.target.value; route(true); };
  if (KSEL) {
    const aC = FX.filter(t => t.ctry === KSEL), a = KBEN >= 0 ? aC.filter(t => t.ben === KBEN) : aC, s = stats(a);
    $('#kHead').innerHTML = `<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">${KBEN >= 0 ? mono(KBEN, true) : flag(KSEL, true)}<div><div style="font-size:18px;font-weight:800">${KBEN >= 0 ? h(BANK[KBEN].name) : h(ctryName(KSEL))}</div>${KBEN >= 0 ? `<div class="note">${flag(KSEL)} ${h(ctryName(KSEL))} · ${h(BANK[KBEN].bic)}</div>` : ''}<div class="note">${nf(s.n)} işlem · ACCC ${pct(s.acc)}</div></div>
      <div class="kv" style="flex:1;margin:0;grid-template-columns:repeat(4,1fr)"><div><span>Ortalama işlem süresi</span><b>${dur(s.p50)}</b></div><div><span>Muhabir ağı</span><b>${dur(s.net50)}</b></div><div><span>Alıcı banka</span><b>${dur(s.ben50)}</b></div><div><span>Aynı gün</span><b>${pct(s.same)}</b></div></div></div>`;
    const cg = [...groupBy(a, t => t.corr)].map(([k, z]) => ({k, s: stats(z)})).filter(r => r.s.p50 != null && r.s.n >= 3).sort((x, y) => y.s.n - x.s.n).slice(0, 10).reverse();
    chart($('#kCorr'), {legend: {top: 0, textStyle: {color: cssv('--t2')}}, grid: {left: 10, right: 70, top: 30, bottom: 10, containLabel: true},
      tooltip: {trigger: 'axis', axisPointer: {type: 'shadow'}, formatter: p => { const r = cg[p[0].dataIndex]; return `<b>${h(BANK[r.k].name)}</b><br>${nf(r.s.n)} işlem<br>Muhabir ağı: ${dur(r.s.net50)}<br>Alıcı banka: ${dur(r.s.ben50)}<br>Ortalama: <b>${dur(r.s.p50)}</b> · Aynı gün ${pct(r.s.same)}`; }},
      xAxis: ax({type: 'value', axisLabel: {formatter: x => dur(x), color: cssv('--t3')}}), yAxis: ax({type: 'category', data: cg.map(r => (BANK[r.k].name || BANK[r.k].bic).replace(/\s*[-,(].*$/, '').slice(0, 28)), axisLabel: {color: cssv('--t2'), fontSize: 11}}),
      series: [{name: 'Muhabir ağı', type: 'bar', stack: 's', data: cg.map(r => Math.round(r.s.net50)), itemStyle: {color: cssv('--s1'), borderColor: cssv('--surface'), borderWidth: 1}, barMaxWidth: 18},
        {name: 'Alıcı banka', type: 'bar', stack: 's', data: cg.map(r => Math.round(r.s.ben50)), itemStyle: {color: cssv('--s2'), borderRadius: [0, 4, 4, 0], borderColor: cssv('--surface'), borderWidth: 1}, barMaxWidth: 18,
          label: {show: true, position: 'right', color: cssv('--t3'), fontSize: 10.5, formatter: p => nf(cg[p.dataIndex].s.n) + ' işlem'}}]});
    const ct = [...groupBy(a, t => t.corr + '|' + t.ccy)].map(([k, z]) => { const [c, y] = k.split('|'); return {c: +c, y, s: stats(z)}; }).filter(r => r.s.n >= 3).sort((x, y) => y.s.n - x.s.n).slice(0, 12);
    $('#kTbl').innerHTML = `<div class="tbl-wrap" style="max-height:340px"><table class="t"><thead><tr><th>Muhabir</th><th>Döviz</th><th class="num">İşlem</th><th class="num">Ortalama</th><th class="num">Aynı gün</th></tr></thead><tbody>${ct.map(r => `<tr><td>${bankCell(r.c)}</td><td><b>${r.y}</b></td><td class="num">${nf(r.s.n)}</td><td class="num"><b>${dur(r.s.p50)}</b></td><td class="num">${pct(r.s.same)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  if (KSEL) {
    const aC = FX.filter(t => t.ctry === KSEL);
    const bg = [...groupBy(aC, t => t.ben)].map(([k, z]) => ({k, s: stats(z)})).filter(r => r.s.p50 != null && r.s.n >= 3).sort((x, y) => y.s.n - x.s.n);
    const top = bg.slice(0, 10).reverse();
    const bc = chart($('#kBenC'), {legend: {top: 0, textStyle: {color: cssv('--t2')}}, grid: {left: 10, right: 70, top: 30, bottom: 10, containLabel: true},
      tooltip: {trigger: 'axis', axisPointer: {type: 'shadow'}, formatter: p => { const r = top[p[0].dataIndex]; return `<b>${h(BANK[r.k].name)}</b><br>${nf(r.s.n)} işlem<br>Muhabir ağı: ${dur(r.s.net50)}<br>Alıcı banka: ${dur(r.s.ben50)}<br>Ortalama: <b>${dur(r.s.p50)}</b> · Aynı gün ${pct(r.s.same)}`; }},
      xAxis: ax({type: 'value', axisLabel: {formatter: x => dur(x), color: cssv('--t3')}}), yAxis: ax({type: 'category', data: top.map(r => (BANK[r.k].name || BANK[r.k].bic).replace(/\s*[-,(].*$/, '').slice(0, 28)), axisLabel: {color: cssv('--t2'), fontSize: 11}}),
      series: [{name: 'Muhabir ağı', type: 'bar', stack: 's', data: top.map(r => ({value: Math.round(r.s.net50), itemStyle: {opacity: KBEN < 0 || r.k === KBEN ? 1 : .35}})), itemStyle: {color: cssv('--s1'), borderColor: cssv('--surface'), borderWidth: 1}, barMaxWidth: 18},
        {name: 'Alıcı banka', type: 'bar', stack: 's', data: top.map(r => ({value: Math.round(r.s.ben50), itemStyle: {opacity: KBEN < 0 || r.k === KBEN ? 1 : .35}})), itemStyle: {color: cssv('--s2'), borderRadius: [0, 4, 4, 0], borderColor: cssv('--surface'), borderWidth: 1}, barMaxWidth: 18,
          label: {show: true, position: 'right', color: cssv('--t3'), fontSize: 10.5, formatter: p => nf(top[p.dataIndex].s.n) + ' işlem'}}]});
    bc.on('click', p => { KBEN = top[p.dataIndex].k; route(true); });
    $('#kBenT').innerHTML = `<div class="tbl-wrap" style="max-height:340px"><table class="t"><thead><tr><th>Alıcı banka</th><th class="num">İşlem</th><th class="num">Ortalama</th><th class="num">Alıcıda</th><th class="num">Aynı gün</th></tr></thead><tbody>${bg.slice(0, 30).map(r => `<tr class="clk" data-b="${r.k}"${r.k === KBEN ? ' style="background:rgba(62,224,143,.12)"' : ''}><td>${bankCell(r.k)}</td><td class="num">${nf(r.s.n)}</td><td class="num"><b>${dur(r.s.p50)}</b></td><td class="num">${dur(r.s.ben50)}</td><td class="num">${pct(r.s.same)}</td></tr>`).join('')}</tbody></table></div>`;
    $$('#kBenT tr.clk').forEach(r => r.onclick = () => { KBEN = +r.dataset.b; route(true); });
  }
  const cr = [...groupBy(FX, t => t.corr + '|' + t.ccy + '|' + t.ctry)].filter(([, a]) => a.length >= 15).map(([k, a]) => { const [c, y, ct] = k.split('|'); return {c: +c, y, ct, s: stats(a)}; }).filter(r => r.s.p50 != null).sort((a, b) => a.s.p50 - b.s.p50);
  const tb = list => `<div class="tbl-wrap"><table class="t"><thead><tr><th>Muhabir</th><th>Döviz</th><th>Ülke</th><th class="num">İşlem</th><th class="num">Ortalama</th><th class="num">Aynı gün</th></tr></thead><tbody>${list.map(r => `<tr class="clk" data-c="${r.ct}"><td>${bankCell(r.c)}</td><td><b>${r.y}</b></td><td>${flag(r.ct)} ${h(ctryName(r.ct))}</td><td class="num">${nf(r.s.n)}</td><td class="num"><b>${dur(r.s.p50)}</b></td><td class="num">${pct(r.s.same)}</td></tr>`).join('')}</tbody></table></div>`;
  $('#k-fast').innerHTML = tb(cr.slice(0, 12)); $('#k-slow').innerHTML = tb(cr.slice(-12).reverse());
  $$('#k-fast tr.clk,#k-slow tr.clk').forEach(r => r.onclick = () => { KSEL = r.dataset.c; KBEN = -1; route(true); });
}});

function methodCard() {
  const A = FX.filter(t => t.st === 'ACCC' && t.tot != null);
  const lim = fence(A.map(t => t.tot)), out = A.filter(t => t.tot > lim);
  const pend = out.filter(t => t.pend).length, rec = out.filter(t => t.recall).length;
  $('#methodCmp').innerHTML = `<div class="card-h"><div><h3>Ortalama nasıl hesaplanıyor?</h3><div class="sub">İşlem süresi: operasyonel başlangıçtan (çıkış ya da valör günü) alıcı hesabına alacak kaydına kadar geçen süre · seçili filtredeki ${nf(A.length)} tamamlanmış işlem</div></div></div>
   <div class="grid g3" style="margin-top:6px"><div class="bk"><div class="bk-v">${dur(avg(A.map(t => t.tot), false))}</div><div class="bk-l">Ortalama · tüm işlemler</div></div>
   <div class="bk" style="border-color:rgba(62,224,143,.4)"><div class="bk-v">${dur(avg(A.map(t => t.tot), true))}</div><div class="bk-l">P95 ortalama · uç değerler hariç · raporlanan değer</div></div>
   <div class="bk"><div class="bk-v">${nf(out.length)} <span style="font-size:14px">(%${nf(out.length / Math.max(1, A.length) * 100, 1)})</span></div><div class="bk-l">Uç değer · ayrı izlenir (Uyarılar sayfası)</div></div></div>
   <div class="note" style="margin-top:10px">Uç değer: seçili kümede süresi P95 eşiğinin üzerindeki işlemler (alıcı bankada belge/uyum incelemesi, uzun bekleme, tatil dönemleri). Sayıca az olsalar da basit ortalamayı birkaç kat büyüttükleri için raporlanan ortalamaya katılmazlar. Filtre çubuğundaki kutu ile dahil edilebilir.</div>`;
}
