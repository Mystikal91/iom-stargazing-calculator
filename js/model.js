/* Calculation engine: no DOM access, so it can be tested from Node. */
(function (IOM) {
  'use strict';

  const STAR_NAMES = IOM.STARS.map(s => s.name);

  // ---- Costs ---------------------------------------------------------------
  const costCache = {};
  function starCost(name, level) {
    let tbl = costCache[name];
    if (!tbl) {
      const c = IOM.STARS.find(s => s.name === name).cost;
      tbl = costCache[name] = [null, null];
      let v = 0, g = c.g;
      for (let L = 2; L <= c.max; L++) {
        if (c.sc) for (const k in c.sc) if (+k === L - 1) g = c.sc[k];
        if (c.ov && c.ov[L] != null) v = c.ov[L];
        else v = L === 2 ? c.base : v * g;
        tbl[L] = c.floor ? Math.floor(v) : Math.round(v);
      }
    }
    return tbl[level] == null ? null : tbl[level];
  }

  function ssUpgradeCost(idx, level) {
    const u = IOM.SS_UPGRADES[idx], c = u.cost;
    if (level < 1 || level > u.max) return 0;
    if (c.ov && c.ov[level] != null) return c.ov[level];
    const n = level - 1;
    return Math.round(c.type === 'formula' ? c.base * Math.pow(c.g + n * 0.01, n) : c.base * Math.pow(c.g, n));
  }

  // ---- Stargazing bonus bookkeeping -------------------------------------------
  // state = { lvl: {Aries: 3, ...}, reg: [16 numbers], ss: [22 numbers] }
  function sources() {
    const list = [];
    IOM.STARS.forEach(s => s.perks.forEach(p => list.push({ stat: p.stat, per: p.per, grp: p.grp || 'main', level: st => st.lvl[s.name] || 0 })));
    IOM.REG_UPGRADES.forEach((u, i) => (u.effects || []).forEach(p => list.push({ stat: p.stat, per: p.per, grp: p.grp || 'main', level: st => st.reg[i] || 0 })));
    Object.keys(IOM.SS_UPGRADES).forEach(i => (IOM.SS_UPGRADES[i].effects || []).forEach(p => list.push({ stat: p.stat, per: p.per, grp: p.grp || 'main', level: st => st.ss[i] || 0 })));
    return list;
  }
  const SOURCES = sources();

  // Stargazing contribution to `stat`: sum for 'add' stats, product of (1 + group sum) for 'mult' stats.
  function stargazingPart(stat, st) {
    const kind = IOM.STAT_KIND[stat];
    if (kind === 'add') {
      let s = 0;
      for (const x of SOURCES) if (x.stat === stat) s += x.per * x.level(st);
      return s;
    }
    const groups = {};
    for (const x of SOURCES) if (x.stat === stat) groups[x.grp] = (groups[x.grp] || 0) + x.per * x.level(st);
    let f = 1;
    for (const g in groups) f *= 1 + groups[g];
    return f;
  }

  // Value of `stat` when the player's state changes from st0 (matches the export) to st1.
  function statAt(base, stat, st0, st1) {
    const a = stargazingPart(stat, st0), b = stargazingPart(stat, st1);
    return IOM.STAT_KIND[stat] === 'add' ? base[stat] + (b - a) : base[stat] * (b / a);
  }

  // ---- Income ----------------------------------------------------------------
  const clamp01 = x => Math.max(0, Math.min(1, x));

  function tierValue(S, p) {
    const pn = clamp01(S[p + 'supernova_chance'] / 100), Mn = S[p + 'supernova_multi'];
    const pg = clamp01(S[p + 'supergiant_chance'] / 100), Mg = S[p + 'supergiant_multi'];
    const pr = clamp01(S[p + 'radiant_chance'] / 100), Mr = S[p + 'radiant_multi'];
    const ng = (1 - pn) * (1 - pg) + pn * (1 - pg) * Mn + (1 - pn) * pg * Mg + pn * pg * Mn * Mg * S.novagiant_combo_multi;
    return ng * ((1 - pr) + pr * Mr) * S.all_star_multi;
  }

  /** Expected Stars/hour and Super Stars/hour for the effective stats S. */
  function income(S, opts) {
    const pSpawn = Math.min(1, S.star_spawn_rate / 50);
    const d = clamp01(S.star_double_spawn_chance / 100), t = clamp01(S.star_triple_spawn_chance / 100);
    const starsPerSpawn = (1 + d) * (1 + 2 * t); // independent rolls: x2 and x3 multiply (both = 6)
    const offline = !!opts.offline; // offline: nothing is tapped, so only auto-catch counts, then x0.85
    const catchP = offline || opts.catchMode === 'auto' ? clamp01(S.star_auto_catch_chance / 100) : 1;
    const penalty = offline ? IOM.OFFLINE_PENALTY * (opts.ctrlF === false ? IOM.NO_FOLLOW_PENALTY : 1) : 1;
    const pSuper = Math.min(1, S.super_star_spawn_multi / 100);
    const t3 = clamp01(S.super_star_triple_chance / 100), t10 = clamp01(S.super_star_10x_chance / 100);
    const superPerSpawn = (1 + 2 * t3) * (1 + 9 * t10); // assumed independent like Double/Triple Star
    const F = opts.floorsPerHour * S.game_speed_multi; // floor clears/h: base rate x game speed
    return {
      stars: penalty * F * pSpawn * starsPerSpawn * catchP * tierValue(S, 'star_'),
      superStars: penalty * F * pSpawn * pSuper * superPerSpawn * catchP * tierValue(S, 'super_star_'),
    };
  }

  function effectiveStats(base, st0, st1) {
    const S = Object.assign({}, base);
    for (const stat in IOM.STAT_KIND) if (base[stat] != null) S[stat] = statAt(base, stat, st0, st1);
    return S;
  }

  // ---- Import ------------------------------------------------------------------
  function parseExport(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) {
      // The game may copy extra text around the JSON: try the outermost braces.
      const a = text.indexOf('{'), b = text.lastIndexOf('}');
      if (a < 0 || b <= a) throw new Error('Not valid JSON');
      obj = JSON.parse(text.slice(a, b + 1));
    }
    if (!obj || typeof obj.stats !== 'object') throw new Error('No "stats" object found in the JSON');
    return obj;
  }

  /** Builds the base stat table (export values, falling back to defaults) and the player's state. */
  function fromExport(obj) {
    const s = obj.stats, missing = [], base = {};
    for (const [key, , def] of IOM.STAT_INFO) {
      if (typeof s[key] === 'number') base[key] = s[key]; else { base[key] = def; missing.push(key); }
    }
    const lvl = {};
    const arr = s.stars_star_level_array || [];
    STAR_NAMES.forEach((n, i) => { lvl[n] = arr[i] || 0; });
    return {
      base, missing,
      state: {
        lvl,
        reg: (s.stars_regular_upgrades_array || []).slice(0, 16),
        ss: (s.stars_super_star_upgrades_array || []).slice(0, 22),
      },
      ctrlF: (s.skill_tree_nodes_array || [])[IOM.CTRL_F_NODE] === 1,
      version: obj.version || '?',
    };
  }

  function defaultCaps(state) {
    const caps = {};
    const star = state.ss[5] || 0, agc = state.ss[6] || 0, vao = state.ss[7] || 0;
    for (const s of IOM.STARS) {
      let c = s.base + star;
      if (IOM.CAP_GROUPS.agc.includes(s.name)) c += 2 * agc;
      if (IOM.CAP_GROUPS.vao.includes(s.name)) c += vao;
      caps[s.name] = Math.min(c, s.cost.max);
    }
    return caps;
  }

  // ---- Star unlock order -----------------------------------------------------
  function unlockOrderLength() { return IOM.FIXED_START.length + IOM.RANDOM_GROUP.length + IOM.FIXED_END.length; }

  /** Stars that the k-th Telescope level can make available (a single one outside the random 4th-11th range). */
  function unlockCandidates(k, state) {
    const a = IOM.FIXED_START.length, b = a + IOM.RANDOM_GROUP.length;
    if (k <= a) return [IOM.FIXED_START[k - 1]].filter(n => !state.lvl[n]);
    if (k <= b) return IOM.RANDOM_GROUP.filter(n => !state.lvl[n]);
    return [IOM.FIXED_END[k - b - 1]].filter(n => n && !state.lvl[n]);
  }

  // ---- Super Star unlock chain -------------------------------------------------
  /**
   * Purchases needed to bring Super Star upgrade `i` to `target`, given the current levels `ss`.
   * Returns [{idx, from, to, cost}] (prerequisites first) or null if impossible.
   */
  function ssPlan(i, target, ss) {
    const lv = ss.slice(), out = [];
    function buy(j, to) {
      const u = IOM.SS_UPGRADES[j];
      if (to > u.max) return false;
      if ((lv[j] || 0) === 0 && j > 0 && !need(j - 1, u.unlock)) return false;
      const from = lv[j] || 0;
      let cost = 0;
      for (let l = from + 1; l <= to; l++) cost += ssUpgradeCost(j, l);
      out.push({ idx: j, from, to, cost });
      lv[j] = to;
      return true;
    }
    function need(j, level) { return (lv[j] || 0) >= level ? true : buy(j, level); }
    return buy(i, target) ? out : null;
  }

  // ---- Candidate upgrades ---------------------------------------------------
  /**
   * opts: { metric: 'stars'|'superStars', floorsPerHour, catchMode, offline, ctrlF }
   * Returns the current income and the list of candidates ranked by gain per hour of saving.
   */
  function analyze(base, state, caps, opts) {
    const S0 = effectiveStats(base, state, state);
    const cur = income(S0, opts);
    const tele = state.reg[0] || 0;
    const rows = [], unavailable = [];
    const metricOf = inc => inc[opts.metric];
    const m0 = metricOf(cur);

    // `c.apply` mutates a copy of the state; `c.variants` (optional) is a list of such functions whose
    // gains are averaged (used when the outcome is random, e.g. which Star the Telescope unlocks).
    function consider(c) {
      const outcomes = c.variants || [c.apply];
      let gain = 0;
      for (const apply of outcomes) {
        const st1 = { lvl: Object.assign({}, state.lvl), reg: state.reg.slice(), ss: state.ss.slice() };
        apply(st1);
        const inc1 = income(effectiveStats(base, state, st1), opts);
        gain += m0 > 0 ? metricOf(inc1) / m0 - 1 : 0;
      }
      gain /= outcomes.length;
      const rate = c.currency === 'Super Star' ? cur.superStars : cur.stars;
      const hours = rate > 0 ? c.cost / rate : Infinity;
      rows.push({ label: c.label, currency: c.currency, cost: c.cost, hours, gain,
                  score: hours > 0 && isFinite(hours) ? gain / hours : 0,
                  from: c.from, to: c.to, kind: c.kind, detail: c.detail });
    }

    // Star levels
    for (const s of IOM.STARS) {
      const L = state.lvl[s.name] || 0;
      if (L < 1) continue;
      const cap = Math.min(caps[s.name] || s.base, s.cost.max);
      const to = Math.min(cap, L + 1);
      if (to <= L) { unavailable.push(s.name + ': at level cap (' + cap + ')'); continue; }
      let cost = 0;
      for (let l = L + 1; l <= to; l++) cost += starCost(s.name, l);
      consider({ label: s.name, kind: 'star', currency: s.name, cost, from: L, to,
                 apply: st => { st.lvl[s.name] = to; } });
    }

    // Super Star priced upgrades. The first level of an upgrade needs N levels of the previous one in the list,
    // recursively, so the cost (and the benefit) of that whole unlock chain is included.
    IOM.SS_UPGRADES.forEach((u, i) => {
      if (u.cap || !u.effects) return;
      const L = state.ss[i] || 0;
      if (L >= u.max) { unavailable.push(u.name + ': maxed'); return; }
      const plan = ssPlan(i, L + 1, state.ss);
      if (!plan) { unavailable.push(u.name + ': unlock chain impossible'); return; }
      const needTele = Math.max.apply(null, plan.map(p => IOM.SS_UPGRADES[p.idx].tele));
      if (tele < needTele) { unavailable.push(u.name + ': needs Telescope ' + needTele + ' (you have ' + tele + ')'); return; }
      const cost = plan.reduce((t, p) => t + p.cost, 0);
      const pre = plan.filter(p => p.idx !== i);
      consider({ label: u.name, kind: 'ss', currency: 'Super Star', cost, from: L, to: L + 1,
                 detail: pre.length ? 'includes unlocking: ' + pre.map(p => IOM.SS_UPGRADES[p.idx].name + ' ' + p.from + '→' + p.to).join(', ') : '',
                 apply: st => { plan.forEach(p => { st.ss[p.idx] = p.to; }); } });
    });

    // Telescope upgrades: only the levels paid in Super Stars can be compared.
    IOM.REG_UPGRADES.forEach((u, i) => {
      if (u.unlocksStar) { telescopeUpgrade(u, i); return; }
      if (!u.effects || !u.effects.length) return;
      const L = state.reg[i] || 0;
      if (L >= u.max) { unavailable.push(u.name + ': maxed'); return; }
      if (tele < u.tele) { unavailable.push(u.name + ': needs Telescope ' + u.tele + ' (you have ' + tele + ')'); return; }
      const c = u.ssCost[L + 1];
      if (c == null) { unavailable.push(u.name + ' ' + L + '→' + (L + 1) + ': paid in veins, not comparable'); return; }
      consider({ label: u.name, kind: 'tele', currency: 'Super Star', cost: c, from: L, to: L + 1,
                 apply: st => { st.reg[i] = L + 1; } });
    });

    // Upgrade Telescope: level k makes the k-th Star available, which then starts at level 1.
    function telescopeUpgrade(u, i) {
      const L = state.reg[i] || 0, k = L + 1;
      if (L >= u.max) { unavailable.push(u.name + ': maxed'); return; }
      if (k > unlockOrderLength()) { unavailable.push(u.name + ' ' + L + '→' + k + ': no Star left to unlock'); return; }
      const c = u.ssCost[k];
      if (c == null) { unavailable.push(u.name + ' ' + L + '→' + k + ': paid in veins, not comparable'); return; }
      const names = unlockCandidates(k, state);
      if (!names.length) { unavailable.push(u.name + ' ' + L + '→' + k + ': every possible Star is already unlocked'); return; }
      consider({ label: u.name, kind: 'tele', currency: 'Super Star', cost: c, from: L, to: k,
                 detail: names.length === 1 ? 'unlocks ' + names[0] : 'unlocks one of ' + names.join(' / ') + ' (random, average)',
                 variants: names.map(n => st => { st.reg[i] = k; st.lvl[n] = 1; }) });
    }

    const useful = rows.filter(r => r.gain > 1e-12 && isFinite(r.hours)).sort((a, b) => b.score - a.score);
    const useless = rows.filter(r => !(r.gain > 1e-12)).map(r => r.label);
    return { current: cur, rows: useful, noEffect: useless, unavailable };
  }

  IOM.Model = { starCost, ssUpgradeCost, parseExport, fromExport, defaultCaps, analyze, income, effectiveStats, stargazingPart };
})(window.IOM = window.IOM || {});
