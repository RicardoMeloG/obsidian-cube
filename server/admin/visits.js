// Visits dashboard (spec 013). Dark-themed analytics view (map, tiles, charts)
// rendered entirely client-side into a container. No external resources.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  let world = null;
  let seq = 0;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function sv(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  async function getWorld() {
    if (world) return world;
    const r = await fetch('/world.json', { credentials: 'same-origin' });
    world = await r.json();
    return world;
  }

  function makeRow(name, visits, max, isCode) {
    const row = el('div', 'vz-row');
    row.appendChild(isCode ? el('code', 'vz-row-name', name) : el('span', 'vz-row-name', name));
    const bw = el('div', 'vz-row-bar-wrap');
    const bar = el('div', 'vz-row-bar');
    bar.style.width = (visits / max * 100) + '%';
    bw.appendChild(bar);
    row.appendChild(bw);
    row.appendChild(el('span', 'vz-row-num', visits.toLocaleString('es-CL')));
    return row;
  }

  function renderMap(container, data, w) {
    const maxV = Math.max(...data.countries.map(c => c.visits), 1);
    const vMap = {};
    data.countries.forEach(c => { vMap[c.key] = c.visits; });
    const cc = data.countries.filter(c => c.key !== 'ZZ').length;

    const wrap = el('div', 'vz-map-wrap');
    const s = sv('svg', { viewBox: w.viewBox, role: 'img', 'aria-label': 'Mapa de visitas por país: ' + cc + ' países' });
    w.other.forEach(d => s.appendChild(sv('path', { d: d, class: 'vz-0' })));
    for (const code in w.countries) {
      const v = vMap[code] || 0;
      const cls = v === 0 ? 'vz-0' : 'vz-' + Math.ceil(5 * v / maxV);
      const p = sv('path', { d: w.countries[code].d, 'data-cc': code, class: cls });
      const t = sv('title');
      t.textContent = w.countries[code].name + ': ' + (v > 0 ? v + ' visitas' : 'sin visitas');
      p.appendChild(t);
      s.appendChild(p);
    }
    wrap.appendChild(s);

    const legend = el('div', 'vz-legend');
    for (let i = 1; i <= 5; i++) {
      const lo = Math.floor((i - 1) * maxV / 5) + 1;
      const hi = i === 5 ? maxV : Math.floor(i * maxV / 5);
      legend.appendChild(el('span', 'vz-sw vz-' + i));
      legend.appendChild(el('span', 'vz-legend-lbl', hi < lo ? '\u2014' : lo + '\u2013' + hi));
    }
    const zz = data.countries.find(c => c.key === 'ZZ');
    if (zz && zz.visits > 0) legend.appendChild(el('span', 'hint', zz.visits + ' visitas sin país identificado'));
    wrap.appendChild(legend);
    container.appendChild(wrap);
  }

  function renderChart(data) {
    const col = el('div', 'vz-col');
    col.appendChild(el('h3', 'vz-col-title', 'Visitas por día'));
    const pd = data.perDay, n = pd.length;
    const maxV = Math.max(...pd.map(d => d.visits), 1);
    const bw = 10, gap = 2, ch = 120, pT = 20, pB = 20, pL = 10, pR = 10;
    const W = pL + n * (bw + gap) - gap + pR, H = pT + ch + pB;
    const s = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%' });
    const baseY = pT + ch;
    s.appendChild(sv('line', { x1: pL, y1: baseY, x2: W - pR, y2: baseY, class: 'vz-baseline' }));
    const ml = sv('text', { x: pL, y: pT - 6, class: 'vz-chart-lbl' });
    ml.textContent = maxV.toLocaleString('es-CL');
    s.appendChild(ml);
    pd.forEach((d, i) => {
      const x = pL + i * (bw + gap);
      const h = Math.max(Math.round(ch * d.visits / maxV), 1);
      const r = sv('rect', { x: x, y: baseY - h, width: bw, height: h, rx: '2', class: 'vz-bar' });
      const t = sv('title');
      t.textContent = d.key + ': ' + d.visits + ' visitas';
      r.appendChild(t);
      s.appendChild(r);
    });
    [0, Math.floor((n - 1) / 2), n - 1].forEach(i => {
      let x, anchor;
      if (i === 0) {
        x = pL;
        anchor = 'start';
      } else if (i === n - 1) {
        x = pL + (n - 1) * (bw + gap) + bw;
        anchor = 'end';
      } else {
        x = pL + i * (bw + gap) + bw / 2;
        anchor = 'middle';
      }
      const t = sv('text', { x: x, y: baseY + 14, 'text-anchor': anchor, class: 'vz-chart-lbl' });
      t.textContent = pd[i].key;
      s.appendChild(t);
    });
    col.appendChild(s);
    return col;
  }

  function renderLists(data, w) {
    const col = el('div', 'vz-col');
    col.appendChild(el('h3', 'vz-col-title', 'Países'));
    const tc = data.countries.slice(0, 10), mc = tc.length ? tc[0].visits : 1;
    const lc = el('div', 'vz-list');
    tc.forEach(c => {
      const nm = c.key === 'ZZ' ? 'Desconocido' : (w.countries[c.key] ? w.countries[c.key].name : c.key);
      lc.appendChild(makeRow(nm, c.visits, mc, false));
    });
    col.appendChild(lc);
    col.appendChild(el('h3', 'vz-col-title', 'Páginas'));
    const tp = data.pages.slice(0, 10), mp = tp.length ? tp[0].visits : 1;
    const lp = el('div', 'vz-list');
    tp.forEach(p => lp.appendChild(makeRow(p.key, p.visits, mp, true)));
    col.appendChild(lp);
    return col;
  }

  function render(container, data, w) {
    const hint = container.querySelector('.vz-hint');
    hint.textContent = 'del ' + data.from + ' al ' + data.to + ' · ' + (data.source === 's3' ? 'CloudFront (S3)' : 'datos de ejemplo');
    const cc = data.countries.filter(c => c.key !== 'ZZ').length;
    const tiles = el('div', 'vz-tiles');
    [['Visitas', data.visits], ['Países', cc], ['Rastreadores', data.crawlers], ['Otras rutas', data.otherPaths]].forEach(function (pair) {
      const t = el('div', 'vz-tile');
      t.appendChild(el('span', 'vz-tile-label', pair[0]));
      t.appendChild(el('span', 'vz-tile-num', pair[1].toLocaleString('es-CL')));
      tiles.appendChild(t);
    });
    container.appendChild(tiles);
    renderMap(container, data, w);
    const cols = el('div', 'vz-cols');
    cols.appendChild(renderChart(data));
    cols.appendChild(renderLists(data, w));
    container.appendChild(cols);
  }

  async function load(container, days) {
    const run = ++seq;
    delete container.dataset.ready;
    container.innerHTML = '';
    const toolbar = el('div', 'toolbar');
    const seg = el('div', 'view-switch');
    [7, 30, 90].forEach(function (d) {
      const btn = el('button', d === days ? 'active' : '', d + ' días');
      btn.addEventListener('click', function () { load(container, d); });
      seg.appendChild(btn);
    });
    toolbar.appendChild(seg);
    toolbar.appendChild(el('span', 'hint vz-hint'));
    container.appendChild(toolbar);
    const errEl = el('div', 'vz-error');
    container.appendChild(errEl);
    try {
      const results = await Promise.all([
        fetch('/api/visits?days=' + days, { credentials: 'same-origin' }),
        getWorld()
      ]);
      if (run !== seq) return;
      const res = results[0], w = results[1];
      if (!res.ok) {
        const body = await res.json().catch(function () { return {}; });
        if (run !== seq) return;
        errEl.textContent = body.message || 'No se pudieron cargar las visitas.';
        return;
      }
      const data = await res.json();
      if (run !== seq) return;
      errEl.textContent = '';
      render(container, data, w);
      container.dataset.ready = 'true';
    } catch (e) {
      if (run !== seq) return;
      errEl.textContent = 'No se pudieron cargar las visitas.';
    }
  }

  window.VisitsView = { mount: function (c) { load(c, 30); } };
})();
