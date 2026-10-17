/* UI glue: import, settings, rendering. */
(function (IOM) {
  'use strict';
  const $ = id => document.getElementById(id);
  const M = IOM.Model;
  const STORE = 'iom-stargazing-v1';

  let data = null;       // result of M.fromExport
  let base = null;       // editable stat table
  let state = null;      // editable levels
  let caps = null;       // editable caps
  const edited = new Set();
  let firstLoad = true;
  let lastCatch = null;  // catch mode to restore after leaving offline mode

  // ---- helpers -------------------------------------------------------------------
  const SUFFIX = ['', 'k', 'm', 'b', 't', 'q', 'qi', 'sx', 'sp', 'o'];
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 1000) return n < 10 ? (Math.round(n * 100) / 100).toString() : Math.round(n).toString();
    let i = 0;
    while (n >= 1000 && i < SUFFIX.length - 1) { n /= 1000; i++; }
    return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + SUFFIX[i];
  }
  function fmtTime(h) {
    if (!isFinite(h)) return '∞';
    if (h < 1) return Math.max(1, Math.round(h * 60)) + ' min';
    if (h < 48) return h.toFixed(1) + ' h';
    const d = h / 24;
    return d < 100 ? d.toFixed(1) + ' days' : Math.round(d).toLocaleString('en') + ' days';
  }
  const pct = (x, d) => (x * 100).toFixed(d == null ? 2 : d) + '%';

  function setStatus(msg, cls) { const s = $('import-status'); s.textContent = msg; s.className = 'status ' + (cls || ''); }
  function save() { try { localStorage.setItem(STORE, JSON.stringify({ text: $('json-input').value, opts: readOpts() })); } catch (e) { /* storage unavailable */ } }

  function readOpts() {
    return {
      metric: document.querySelector('input[name=metric]:checked').value,
      floorsPerMin: Math.max(1e-6, parseFloat($('floors').value) || 48),
      floorsPerHour: Math.max(1e-6, parseFloat($('floors').value) || 48) * 60,
      catchMode: lastCatch != null ? lastCatch : $('catch').value,
      offline: $('mode').value === 'offline',
      ctrlF: $('ctrlf').value === 'yes',
    };
  }

  // ---- import --------------------------------------------------------------------
  function importText(text) {
    text = text.trim();
    if (!text) { data = null; render(); return; }
    try {
      data = M.fromExport(M.parseExport(text));
    } catch (e) {
      data = null;
      setStatus('Could not read the data: ' + e.message, 'err');
      render();
      return;
    }
    base = Object.assign({}, data.base);
    state = { lvl: Object.assign({}, data.state.lvl), reg: data.state.reg.slice(), ss: data.state.ss.slice() };
    caps = M.defaultCaps(state);
    $('ctrlf').value = 'yes';
    $('ctrlf-hint').textContent = 'Without following, offline Star gains are 1/5.' +
      (data.ctrlF ? '' : ' Your export shows you do not own the skill (skill tree node 38 is 0).');
    edited.clear();
    const miss = data.missing.length;
    setStatus('Loaded (game ' + data.version + ')' + (miss ? ' — ' + miss + ' stat(s) missing, defaults used; check "Detected data"' : ''), miss ? 'warn' : 'ok');
    buildEditors();
    render();
    // On phones the results are far below the import box: bring them into view the first time data is loaded.
    if (firstLoad && window.matchMedia('(max-width: 700px)').matches) $('settings').scrollIntoView({ behavior: 'smooth' });
    firstLoad = false;
  }

  // ---- editors -------------------------------------------------------------------
  function numInput(value, onChange, step) {
    const i = document.createElement('input');
    i.type = 'number'; i.step = step || 'any'; i.value = +(+value).toPrecision(10);
    i.addEventListener('input', () => { const v = parseFloat(i.value); if (!isNaN(v)) onChange(v, i); });
    return i;
  }

  function buildEditors() {
    const grid = $('stat-grid'); grid.innerHTML = '';
    for (const [key, label] of IOM.STAT_INFO) {
      const l = document.createElement('label');
      l.textContent = label;
      const orig = data.base[key];
      const inp = numInput(base[key], (v, el) => { base[key] = v; el.classList.toggle('edited', v !== orig); render(); });
      if (data.missing.includes(key)) inp.classList.add('edited');
      l.appendChild(inp);
      grid.appendChild(l);
    }
    const tb = $('star-table').tBodies[0]; tb.innerHTML = '';
    for (const s of IOM.STARS) {
      const tr = document.createElement('tr');
      const td0 = document.createElement('td'); td0.textContent = s.name;
      const td1 = document.createElement('td'), td2 = document.createElement('td');
      td1.className = td2.className = 'num';
      const origL = state.lvl[s.name], origC = caps[s.name];
      td1.appendChild(numInput(state.lvl[s.name], (v, el) => { state.lvl[s.name] = Math.max(0, Math.round(v)); el.classList.toggle('edited', state.lvl[s.name] !== origL); render(); }, 1));
      td2.appendChild(numInput(caps[s.name], (v, el) => { caps[s.name] = Math.max(1, Math.round(v)); el.classList.toggle('edited', caps[s.name] !== origC); render(); }, 1));
      tr.append(td0, td1, td2);
      tb.appendChild(tr);
    }
  }

  // ---- rendering -----------------------------------------------------------------
  function render() {
    const has = !!data;
    ['settings', 'results', 'data'].forEach(id => { $(id).hidden = !has; });
    if (!has) return;
    const opts = readOpts();
    const res = M.analyze(base, state, caps, opts);
    const isStars = opts.metric === 'stars';
    // Offline implies auto-catch: show it and lock the selector, restoring the previous choice when back online.
    if (opts.offline && lastCatch == null) { lastCatch = $('catch').value; $('catch').value = 'auto'; }
    else if (!opts.offline && lastCatch != null) { $('catch').value = lastCatch; lastCatch = null; }
    $('catch').disabled = opts.offline;
    $('ctrlf-label').hidden = !opts.offline;

    $('current').innerHTML =
      '<div><b>' + fmt(res.current.stars) + '</b><span>Stars / hour (at ' + opts.floorsPerMin + ' floors/min)</span></div>' +
      '<div><b>' + fmt(res.current.superStars) + '</b><span>Super Stars / hour</span></div>';
    $('gain-head').textContent = isStars ? 'Stars/h gain' : 'Super Stars/h gain';

    const tb = $('result-table').tBodies[0]; tb.innerHTML = '';
    const best = res.rows.length ? res.rows[0].score : 0;
    if (!res.rows.length) {
      tb.innerHTML = '<tr><td colspan="7">No available upgrade improves this stat.</td></tr>';
    }
    res.rows.slice(0, 40).forEach((r, i) => {
      const tr = document.createElement('tr');
      const lv = r.to - r.from > 1 ? r.from + ' → ' + r.to : r.from + ' → ' + r.to;
      const rel = best > 0 ? r.score / best : 0;
      tr.innerHTML =
        '<td class="rank">' + (i + 1) + '</td>' +
        '<td class="name">' + r.label + ' <span class="tag">' + lv + '</span>' + (r.detail ? '<span class="detail">' + r.detail + '</span>' : '') + '</td>' +
        '<td class="num" data-label="Cost">' + fmt(r.cost) + ' ' + r.currency + '</td>' +
        '<td class="num" data-label="Time to collect">' + fmtTime(r.hours) + '</td>' +
        '<td class="num" data-label="' + (isStars ? 'Stars/h gain' : 'Super Stars/h gain') + '">+' + pct(r.gain) + '</td>' +
        '<td class="num" data-label="Gain per hour">+' + pct(r.score) + ' / h</td>' +
        '<td class="num" data-label="vs best">' + Math.round(rel * 100) + '%<span class="bar" style="width:' + Math.round(rel * 60) + 'px"></span></td>';
      tb.appendChild(tr);
    });

    let notes = '';
    if (res.noEffect.length) notes += '<p>No effect on this stat: ' + res.noEffect.join(', ') + '.</p>';
    if (res.unavailable.length) notes += '<ul>' + res.unavailable.map(u => '<li>' + u + '</li>').join('') + '</ul>';
    $('notes-body').innerHTML = notes || 'Nothing.';
    save();
  }

  // ---- wiring --------------------------------------------------------------------
  function init() {
    $('json-input').addEventListener('input', () => importText($('json-input').value));
    $('btn-paste').addEventListener('click', async () => {
      try {
        const t = await navigator.clipboard.readText();
        $('json-input').value = t; importText(t);
      } catch (e) {
        setStatus('Clipboard access was blocked — paste into the box with Ctrl+V instead.', 'warn');
      }
    });
    $('file-input').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { $('json-input').value = r.result; importText(r.result); };
      r.readAsText(f);
      e.target.value = '';
    });
    $('btn-clear').addEventListener('click', () => { $('json-input').value = ''; setStatus(''); importText(''); save(); });
    ['floors', 'catch', 'mode', 'ctrlf'].forEach(id => $(id).addEventListener('input', render));
    document.querySelectorAll('input[name=metric]').forEach(r => r.addEventListener('change', render));

    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (saved) {
        const o = saved.opts || {};
        if (o.metric) document.querySelector('input[name=metric][value=' + o.metric + ']').checked = true;
        if (o.floorsPerMin) $('floors').value = o.floorsPerMin;
        if (o.catchMode) $('catch').value = o.catchMode;
        if (o.offline) $('mode').value = 'offline';
        if (saved.text) { $('json-input').value = saved.text; importText(saved.text); }
      }
    } catch (e) { /* ignore corrupted storage */ }
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.IOM = window.IOM || {});
