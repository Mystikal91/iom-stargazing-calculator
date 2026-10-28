/* Static game data, transcribed from https://shminer.miraheze.org/wiki/Stargazing (game v2.2.51)
 * and https://shminer.miraheze.org/wiki/Stats#Stars.
 *
 * Star costs follow the wiki's {{CostTable}} template:
 *   cost(L) = ov[L]                       if an override exists for level L
 *           = cost(L-1) * g(L)            otherwise (cost(2) = base)
 * where g(L) is the latest scaling `sc[k]` with k < L (default `g`).
 * `lvl` of a star is 1 as soon as it is unlocked, so the first upgrade is level 2.
 */
(function (IOM) {
  'use strict';

  // Offline progress is computed like online, then multiplied by this (the wiki's "Offline Penalty").
  IOM.OFFLINE_PENALTY = 0.85;
  // Offline without the Ctrl+F 'Stars' skill (skill_tree_nodes_array[38]) the Star is not followed: gains are x1/5.
  IOM.NO_FOLLOW_PENALTY = 0.2;
  IOM.CTRL_F_NODE = 38;

  // ---- Stars -------------------------------------------------------------
  // Order matches `stars_star_level_array` in the exported JSON.
  // perks: only perks that affect Star / Super Star income are listed.
  //   kind 'add'  -> percentage points added to a chance stat
  //   kind 'mult' -> fraction added to the Stargazing multiplier of a multiplier stat
  IOM.STARS = [
    { name: 'Aries',       base: 20, cost: { base: 150,    g: 1.25, max: 28 }, perks: [] },
    { name: 'Taurus',      base: 20, cost: { base: 150,    g: 1.25, max: 22 },
      perks: [{ stat: 'star_auto_catch_chance', per: 2, kind: 'add' }] },
    { name: 'Gemini',      base: 20, cost: { base: 150,    g: 1.25, max: 54, ov: { 29: 352e9, 35: 30e12 }, sc: { 35: 1.3 } },
      perks: [{ stat: 'star_spawn_rate', per: 0.02, kind: 'mult' }] },
    { name: 'Cancer',      base: 20, cost: { base: 300,    g: 1.25, max: 48 }, perks: [] },
    { name: 'Leo',         base: 3,  cost: { base: 10000,  g: 3,    max: 5 },
      perks: [{ stat: 'super_star_triple_chance', per: 4, kind: 'add' }] },
    { name: 'Virgo',       base: 25, cost: { base: 300,    g: 1.25, max: 45, ov: { 31: 500e12 }, sc: { 31: 1.3 } },
      perks: [{ stat: 'super_star_spawn_multi', per: 0.01, kind: 'mult' }] },
    { name: 'Libra',       base: 20, cost: { base: 300,    g: 1.25, max: 22 }, perks: [] },
    { name: 'Scorpio',     base: 50, cost: { base: 150,    g: 1.15, max: 127, ov: { 53: 3.48e9, 109: 36.8e12, 114: 84.3e12 }, sc: { 53: 1.18 } },
      perks: [{ stat: 'all_star_multi', per: 0.005, kind: 'mult', grp: 'scorpio' }] },
    { name: 'Sagittarius', base: 15, cost: { base: 500,    g: 1.25, max: 17 },
      perks: [{ stat: 'star_triple_spawn_chance', per: 1, kind: 'add' }] },
    { name: 'Capricorn',   base: 20, cost: { base: 300,    g: 1.25, max: 73, ov: { 24: 136e6, 34: 59.9e9, 44: 313e9, 46: 436e9, 47: 515e9 }, sc: { 34: 1.18 } }, perks: [] },
    { name: 'Aquarius',    base: 10, cost: { base: 3000,   g: 1.4,  max: 25 }, perks: [] },
    { name: 'Pisces',      base: 2,  cost: { base: 100000, g: 1.69, max: 4 }, perks: [] },
    { name: 'Ophiuchus',   base: 2,  cost: { base: 125000, g: 1.8,  max: 19, ov: { 9: 715e6 }, sc: { 9: 1.25 } }, perks: [] },
    { name: 'Orion',       base: 20, cost: { base: 125000, g: 1.27, max: 43, ov: { 39: 82.6e9 }, sc: { 39: 1.3 } }, perks: [] },
    // Hercules: the wiki table stops at 55 but the cap can reach 65; levels 56+ extrapolated with the same ratio.
    { name: 'Hercules',    base: 20, cost: { base: 175000, g: 1.29, max: 65, ov: { 36: 374357984197 }, sc: { 36: 1.3 }, estimatedFrom: 56 },
      perks: [{ stat: 'star_supernova_chance', per: 0.15, kind: 'add' }] },
    { name: 'Draco',       base: 20, cost: { base: 250000, g: 1.3,  max: 40, ov: { 26: 66.2e9, 31: 25e12 } }, perks: [] },
    { name: 'Cetus',       base: 20, cost: { base: 1025000, g: 1.3, max: 32, ov: { 23: 2.48e9 } }, perks: [] },
    { name: 'Phoenix',     base: 18, cost: { base: 2025000, g: 1.3, max: 20 }, perks: [] },
    { name: 'Eridanus',    base: 20, cost: { base: 500e9,  g: 1.3,  max: 40, ov: { 23: 247e12 } }, perks: [] },
    { name: 'Lynx',        base: 48, cost: { base: 10e12,  g: 1.25, max: 50 },
      perks: [{ stat: 'star_radiant_multi', per: 0.01, kind: 'mult' }] },
    { name: 'Vulpecula',   base: 38, cost: { base: 16e12,  g: 1.25, max: 40 }, perks: [] },
    { name: 'Corvus',      base: 48, cost: { base: 65e12,  g: 1.25, max: 50, floor: true }, perks: [] },
    { name: 'Hydra',       base: 48, cost: { base: 125e12, g: 1.25, max: 50, floor: true }, perks: [] },
  ];

  // Order in which Stars become available: the star unlocked by the k-th Telescope level is UNLOCK_ORDER[k-1].
  // Aries, Taurus, Gemini come first; the 4th-11th are a random permutation of RANDOM_GROUP; the rest is fixed.
  IOM.FIXED_START = ['Aries', 'Taurus', 'Gemini'];
  IOM.RANDOM_GROUP = ['Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius'];
  IOM.FIXED_END = ['Pisces', 'Ophiuchus', 'Orion', 'Hercules', 'Draco', 'Cetus', 'Phoenix', 'Eridanus', 'Lynx', 'Vulpecula', 'Corvus', 'Hydra'];

  // Extra cap granted by Super Star "cap" upgrades.
  IOM.CAP_GROUPS = {
    agc: ['Aries', 'Gemini', 'Cancer'],      // +2 per level
    vao: ['Virgo', 'Aquarius', 'Ophiuchus'], // +1 per level
  };

  // ---- Telescope ("regular") upgrades ----------------------------------------
  // Order matches `stars_regular_upgrades_array`. Only the first 5 can be paid in Super Stars at some levels;
  // all other levels are paid in veins, which this tool cannot compare.
  // ssCost: level -> Super Star cost (levels not listed are paid in veins).
  IOM.REG_UPGRADES = [
    // Each level makes the next Star available (it then starts at level 1 once unlocked with gems).
    // Only levels 5, 9 and 12 are paid in Super Stars (10 / 100 / 500); the others use veins.
    { name: 'Upgrade Telescope', max: 23, unlocksStar: true, ssCost: { 5: 10, 9: 100, 12: 500 } },
    { name: 'Auto-catch Stars',      max: 15, tele: 0,  ssCost: { 5: 10, 10: 25, 15: 50 },
      effects: [{ stat: 'star_auto_catch_chance', per: 3, kind: 'add' }] }, // was +4% before v2.2.51 (the rest moved to an Obelisk-level bonus, already in the export)
    { name: 'Star Spawn Rate',       max: 20, tele: 0,  ssCost: { 5: 10, 10: 25, 15: 50 },
      effects: [{ stat: 'star_spawn_rate', per: 0.05, kind: 'mult' }] },
    { name: 'Double Star Chance',    max: 20, tele: 0,  ssCost: { 5: 10, 10: 25, 15: 50 },
      effects: [{ stat: 'star_double_spawn_chance', per: 5, kind: 'add' }] },
    { name: 'Super Star Spawn Rate', max: 25, tele: 0,  ssCost: { 5: 10, 10: 25, 15: 50 },
      effects: [{ stat: 'super_star_spawn_multi', per: 0.02, kind: 'mult' }] },
    { name: 'Star Supernova Chance', max: 25, tele: 10, ssCost: { 5: 50, 10: 125, 15: 250 },
      effects: [{ stat: 'star_supernova_chance', per: 0.5, kind: 'add' }] },
    { name: 'Super Star 10x Chance', max: 25, tele: 12, ssCost: {},
      effects: [{ stat: 'super_star_10x_chance', per: 0.2, kind: 'add' }] },
    { name: 'Star Supergiant Chance', max: 25, tele: 14, ssCost: {},
      effects: [{ stat: 'star_supergiant_chance', per: 0.2, kind: 'add' }] },
    { name: 'Capper Upper',          max: 5,  tele: 17, ssCost: {}, effects: [] },
    { name: 'Super Star Supergiant Chance', max: 20, tele: 18, ssCost: {},
      effects: [{ stat: 'super_star_supergiant_chance', per: 0.15, kind: 'add' }] },
    { name: 'All Star Multiplier',   max: 30, tele: 18, ssCost: {},
      effects: [{ stat: 'all_star_multi', per: 0.01, kind: 'mult', grp: 'upgrade' }] },
    { name: 'Super Star Radiant Chance', max: 25, tele: 19, ssCost: {},
      effects: [{ stat: 'super_star_radiant_chance', per: 0.15, kind: 'add' }] },
    { name: 'Star Radiant Multi',    max: 25, tele: 20, ssCost: {},
      effects: [{ stat: 'star_radiant_multi', per: 0.01, kind: 'mult' }] },
    { name: 'Novagiant Combo Multi', max: 30, tele: 21, ssCost: {},
      effects: [{ stat: 'novagiant_combo_multi', per: 0.015, kind: 'mult' }] },
    { name: 'Super Star Radiant Multi', max: 30, tele: 22, ssCost: {},
      effects: [{ stat: 'super_star_radiant_multi', per: 0.015, kind: 'mult' }] },
    { name: 'All Supergiant Multi',  max: 30, tele: 23, ssCost: {},
      effects: [{ stat: 'star_supergiant_multi', per: 0.0125, kind: 'mult' },
                { stat: 'super_star_supergiant_multi', per: 0.0125, kind: 'mult' }] },
  ];

  // ---- Super Star upgrades ---------------------------------------------------
  // Order matches `stars_super_star_upgrades_array` (22 entries) and the wiki table.
  //   unlock: levels needed in the PREVIOUS upgrade of this list before the first level of this one can be bought
  //   tele:   Telescope level required
  //   cost:   'exp' -> base * g^(L-1);  'formula' -> base * (g + (L-1)*0.01)^(L-1)  (rounded), ov = per-level overrides
  //   cap:    only changes Star level caps (no direct income effect)
  IOM.SS_UPGRADES = [
    { name: 'Rainbow Vein Chance',        max: 10, tele: 0,  unlock: 0,  cost: { type: 'exp', base: 15, g: 1.3 } },
    { name: 'Double Contract Points',     max: 10, tele: 0,  unlock: 5,  cost: { type: 'exp', base: 20, g: 1.3 } },
    { name: 'Experience Gain',            max: 10, tele: 0,  unlock: 5,  cost: { type: 'exp', base: 25, g: 1.3 } },
    { name: 'Item Duration',              max: 10, tele: 0,  unlock: 5,  cost: { type: 'exp', base: 30, g: 1.3 } },
    { name: 'Game Speed +2%',             max: 10, tele: 0,  unlock: 5,  cost: { type: 'exp', base: 150, g: 1.3 },
      effects: [{ stat: 'game_speed_multi', per: 0.02, kind: 'mult' }] },
    { name: 'Star Level Caps +1',         max: 2,  tele: 0,  unlock: 5,  cost: { type: 'exp', base: 1500, g: 4.6 }, cap: true },
    { name: 'Aries, Gemini, Cancer Cap +2', max: 3, tele: 0, unlock: 2,  cost: { type: 'exp', base: 2000, g: 1.75 }, cap: true },
    { name: 'Virgo, Aquarius, Ophiuchus Cap +1', max: 3, tele: 0, unlock: 3, cost: { type: 'exp', base: 3500, g: 1.75, ov: { 3: 9750 } }, cap: true },
    { name: 'Supergiant Star Multiplier +10%', max: 20, tele: 14, unlock: 3, cost: { type: 'exp', base: 3000, g: 1.3 },
      effects: [{ stat: 'star_supergiant_multi', per: 0.10, kind: 'mult' }] },
    { name: 'Golden Ore Multiplier',      max: 15, tele: 17, unlock: 15, cost: { type: 'exp', base: 50000, g: 1.25 } },
    { name: 'Banked Freebies & Lootbugs', max: 5,  tele: 17, unlock: 5,  cost: { type: 'exp', base: 100000, g: 1.3 } },
    { name: 'Elixir & Void Grade Cap',    max: 5,  tele: 17, unlock: 5,  cost: { type: 'exp', base: 175000, g: 1.3 } },
    { name: 'Unlock the Black Hole',      max: 1,  tele: 18, unlock: 5,  cost: { type: 'exp', base: 2500000, g: 1 } },
    { name: 'Lootbug Loot Multiplier',    max: 20, tele: 18, unlock: 1,  cost: { type: 'exp', base: 875000, g: 1.35 } },
    { name: 'Novagiant Combo Multiplier +2%', max: 15, tele: 18, unlock: 5, cost: { type: 'exp', base: 1150000, g: 1.35 },
      effects: [{ stat: 'novagiant_combo_multi', per: 0.02, kind: 'mult' }] },
    { name: 'Fish Income Multiplier',     max: 15, tele: 18, unlock: 5,  cost: { type: 'exp', base: 1350000, g: 1.35 } },
    { name: 'Galactic Floor Chance',      max: 20, tele: 19, unlock: 5,  cost: { type: 'formula', base: 2750000, g: 1.3 } },
    { name: 'Golden Ore Chance',          max: 20, tele: 19, unlock: 5,  cost: { type: 'formula', base: 3500000, g: 1.3 } },
    { name: 'Star Radiant Chance +0.1%',  max: 20, tele: 19, unlock: 5,  cost: { type: 'formula', base: 4750000, g: 1.3 },
      effects: [{ stat: 'star_radiant_chance', per: 0.1, kind: 'add' }] },
    // unlock level of the next one is "???" on the wiki; 5 assumed like its neighbours.
    { name: 'Galactic Portal Multi',      max: 20, tele: 20, unlock: 5,  cost: { type: 'formula', base: 425000000, g: 1.3 } },
    { name: 'Arcanist Mana Regen',        max: 20, tele: 21, unlock: 5,  cost: { type: 'formula', base: 875000000, g: 1.3 } },
    { name: 'Unlock Spell: Blue Giant',   max: 1,  tele: 21, unlock: 5,  cost: { type: 'formula', base: 10000000000, g: 1 } },
  ];

  // ---- Stats -------------------------------------------------------------------
  // kind 'add'  : chance in percent, bonuses from every menu add up
  // kind 'mult' : multiplier, Stargazing bonuses are additive with each other (inside a group) and
  //               multiply the value from other menus. Stats not in this list are not modelled.
  IOM.STAT_KIND = {
    game_speed_multi: 'mult', star_spawn_rate: 'mult', super_star_spawn_multi: 'mult', all_star_multi: 'mult', novagiant_combo_multi: 'mult',
    star_radiant_multi: 'mult', super_star_radiant_multi: 'mult',
    star_supergiant_multi: 'mult', super_star_supergiant_multi: 'mult',
    star_auto_catch_chance: 'add', star_double_spawn_chance: 'add', star_triple_spawn_chance: 'add',
    super_star_triple_chance: 'add', super_star_10x_chance: 'add',
    star_supernova_chance: 'add', super_star_supernova_chance: 'add',
    star_supergiant_chance: 'add', super_star_supergiant_chance: 'add',
    star_radiant_chance: 'add', super_star_radiant_chance: 'add',
    star_supernova_multi: 'mult', super_star_supernova_multi: 'mult',
  };

  // Stats read from the export, with a label and a default used when the key is missing.
  IOM.STAT_INFO = [
    ['game_speed_multi', 'Game Speed Multiplier', 1],
    ['star_spawn_rate', 'Star Spawn Rate Multiplier', 1],
    ['star_auto_catch_chance', 'Star Auto-Catch Chance (%)', 0],
    ['star_double_spawn_chance', 'Star Double Spawn Chance (%)', 0],
    ['star_triple_spawn_chance', 'Star Triple Spawn Chance (%)', 0],
    ['star_supernova_chance', 'Star Supernova Chance (%)', 0],
    ['star_supernova_multi', 'Star Supernova Multi', 10],
    ['star_supergiant_chance', 'Star Supergiant Chance (%)', 0],
    ['star_supergiant_multi', 'Star Supergiant Multi', 3],
    ['star_radiant_chance', 'Star Radiant Chance (%)', 0],
    ['star_radiant_multi', 'Star Radiant Multi', 10],
    ['super_star_spawn_multi', 'Super Star Spawn Rate Multiplier', 1],
    ['super_star_triple_chance', 'Super Star Triple Chance (%)', 0],
    ['super_star_10x_chance', 'Super Star 10x Spawn Chance (%)', 0],
    ['super_star_supernova_chance', 'Super Star Supernova Chance (%)', 0],
    ['super_star_supernova_multi', 'Super Star Supernova Multi', 10],
    ['super_star_supergiant_chance', 'Super Star Supergiant Chance (%)', 0],
    ['super_star_supergiant_multi', 'Super Star Supergiant Multi', 3],
    ['super_star_radiant_chance', 'Super Star Radiant Chance (%)', 0],
    ['super_star_radiant_multi', 'Super Star Radiant Multi', 10],
    ['all_star_multi', 'All Star Multiplier', 1],
    ['novagiant_combo_multi', 'Novagiant Combo Multiplier', 1],
  ];
})(window.IOM = window.IOM || {});
