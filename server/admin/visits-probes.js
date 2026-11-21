// The probes panel and the coverage line of the visits view (spec 020): what
// the bots tried, from the web ACL sample collector, kept out of visits.js so
// each file stays within the DOM-layer size budget (H-16).
(function () {
  'use strict';

  // Spec 020: how much of the range the collector covered, said plainly.
  function coverageText(cv) {
    if (!cv || cv.hours === 0) return ' · sin horas recolectadas en el rango';
    const s = cv.slices || {};
    let t = ' · ' + cv.hours + (cv.hours === 1 ? ' hora recolectada' : ' horas recolectadas') + ' (hasta ' + cv.lastHour + ' UTC)';
    if (cv.missingHours > 0) t += ' · ' + cv.missingHours + (cv.missingHours === 1 ? ' hora sin datos' : ' horas sin datos');
    if (s.truncated > 0) t += ' · ' + s.truncated + (s.truncated === 1 ? ' tramo truncado' : ' tramos truncados') + ' (más de 5.000 pedidos en 10 minutos)';
    if (s.missing > 0) t += ' · ' + s.missing + (s.missing === 1 ? ' tramo perdido' : ' tramos perdidos');
    if (s.sampled > 0) t += ' · cifras estimadas por muestreo';
    return t;
  }

  // Spec 020: what the bots tried, from the web ACL's samples.
  function render(data, w, h) {
    const el = h.el, makeRow = h.makeRow;
    const section = el('section', 'vz-probes');
    section.appendChild(el('h3', 'vz-col-title', 'Intentos de acceso'));
    section.appendChild(el('div', 'hint', 'Rutas que el sitio no tiene y pedidos bloqueados por el WAF. Las visitas son un máximo: las muestras no traen el código de respuesta, y un bot que se presenta como navegador cuenta como visita salvo que pida una ruta inexistente o lo bloqueen.'));
    const cols = el('div', 'vz-cols');
    const list = function (title, items, isCode, name) {
      const col = el('div', 'vz-col');
      col.appendChild(el('h3', 'vz-col-title', title));
      if (!items.length) {
        col.appendChild(el('div', 'hint', 'Sin intentos en el rango.'));
        return col;
      }
      const top = items.slice(0, 10), max = top[0].visits || 1;
      const l = el('div', 'vz-list');
      top.forEach(i => l.appendChild(makeRow(name ? name(i.key) : i.key, i.visits, max, isCode)));
      col.appendChild(l);
      return col;
    };
    const country = code => code === 'ZZ' ? 'Desconocido' : (w.countries[code] ? w.countries[code].name : code);
    cols.appendChild(list('Rutas', data.probes.paths, true));
    cols.appendChild(list('Regla que actuó', data.probes.rules, true));
    section.appendChild(cols);
    const cols2 = el('div', 'vz-cols');
    cols2.appendChild(list('Países', data.probes.countries, false, country));
    cols2.appendChild(list('Clientes', data.probes.clients, true));
    section.appendChild(cols2);
    return section;
  }

  window.VisitsProbes = { coverageText: coverageText, render: render };
})();
