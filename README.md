# solaris-coast

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/willybilly981/solaris-coast/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/willybilly981/solaris-coast/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLARIS COAST is an original 3D open-world crime game set in Bahia Solaris, a sun-soaked coastal metropolis at golden hour. You play Mateo Vance, working with your hacker sister Elena against the Obsidian Syndicate while the Solaris Coast Metro Police (SCMPD) and the CONDOR-1 air unit hunt you.

- Four districts on a 560 x 560 map: Mirador Beachfront (art-deco hotels, palms, animated ocean), Crown Financial District (glass towers, neon, an elevated highway), Harbor Caldera (gantry cranes, containers, armored truck depot) and Palma Heights (hillside villas, neon strip, crew garage, safehouse).
- Six vehicles with drift, handbrake and nitro driving, five weapons, carjacking and drive-by shooting.
- A five-star heat system: patrol cars, interceptors, roadblocks and tactical units, the CONDOR-1 helicopter with a searchlight, and a Bastion APC blockade.
- Eight story missions with radio dialogue, plus a street race, stunt jumps, garage upgrades, three save slots and per-district respect.
- Procedural textures and audio (three radio stations); no assets are downloaded. three.js 0.187.0 (MIT) is vendored as `game/vendor/three.module.min.js` (bundled and minified from three.js 0.187.0, MIT) and loaded through an import map, so the game runs offline.

Controls: WASD move or drive, Shift sprint or nitro, F enter, hijack or exit, Space handbrake or fire on foot, mouse aim and fire (click the game to look), arrow keys camera, Q or 1-5 weapon wheel, R radio, E garage or safehouse, M map, Esc pause. Query parameters `?seed=N` and `?shot=cover|combat|harbor|title` fix the world and stage the screenshot scenes.

## Run it

```sh
node serve.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=bq63kypk&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
