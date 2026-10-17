# IOM Stargazing Calculator

A small static web tool for **Idle Obelisk Miner** that tells you which Star (or Telescope / Super Star upgrade) is the best
next purchase to improve your **Stars/hour** or **Super Stars/hour**.

Live page: <https://mystikal91.github.io/iom-stargazing-calculator/>

## How to use

1. In game, open **Stats → Export Stats to JSON** (the JSON is copied to the clipboard).
2. Paste it into the box (or use *Paste from clipboard* / *Load .json file*).
3. Choose the stat you want to improve and the play mode (online, or offline with or without the Ctrl+F skill).
4. Buy the top upgrade, re-export your stats (or edit the levels in *Detected data*) and check again.

Nothing is uploaded: everything runs in your browser. The last pasted export and your settings are kept in `localStorage`.

## How the ranking works

Every candidate is scored by **relative gain of the chosen stat ÷ hours needed to collect its cost**.
Each Star has its own currency, so costs are converted to hours using your Stars/hour; Super Star costs use your Super Stars/hour.
Because every Star is collected at the same rate, the ranking does not depend on your floors/minute (that only scales the displayed times).

Candidates: Star levels, Super Star upgrades that affect Stars (Supergiant, Novagiant, Radiant chance) and Telescope upgrades whose
level is paid in Super Stars. Telescope levels paid in veins cannot be compared and are listed as not ranked.

### Model

- Floor clear → Star spawns with chance `1/50 × Star Spawn Rate`; each spawn also gives a Super Star with chance `1/100 × Super Star Spawn Rate`.
- Double and Triple Star are independent rolls that multiply (`(1 + double) × (1 + 2 × triple)`).
- Supernova / Supergiant / Radiant are independent; the Novagiant Combo applies when both Supernova and Supergiant hit.
- Stargazing bonuses are additive with each other and multiply the rest of the stat; the Stargazing part is rebuilt from your levels, so a
  change is applied as `value × new_stargazing / old_stargazing` on top of the exported value.
- Offline: auto-catch only, ×0.85, and ×0.2 more without the Ctrl+F 'Stars' skill (`skill_tree_nodes_array[38]`).

Known simplifications: Super Star Triple/10x are assumed to work like Double/Triple Star; offline gains assume all 5 floors of your Star are
unlocked; Cosmic Candy and temporary buffs are not modelled; level caps only include the base cap and Super Star cap upgrades
(edit the cap in *Detected data* for other sources).

## Project layout

```
index.html        page
css/style.css     styles (responsive, cards on phones)
js/data.js        wiki data: Star costs, perks, upgrades, stat definitions
js/model.js       calculation engine (no DOM)
js/app.js         UI
```

No build step and no dependencies. To run locally, open `index.html`, or serve the folder (`python -m http.server`).

## Updating the data

Star costs follow the wiki's `CostTable` parameters (base, scaling, per-level overrides), transcribed in `js/data.js`.
Data comes from the [Stargazing](https://shminer.miraheze.org/wiki/Stargazing) and [Stats](https://shminer.miraheze.org/wiki/Stats#Stars)
wiki pages (game v2.2.30). When the game changes, update the corresponding entries in `data.js`.

## Publishing on GitHub Pages

Repository **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/ (root)`**.

---

Unofficial fan project, not affiliated with the game's developers.
