'use strict';

// Moves where the hero's feet stand on the background pictures (floorY: 0 = top, 1 = bottom of the screen).
// Bigger number = hero stands lower. The default was 0.78.
//
//   node setFloor.js 0.86              all pictures
//   node setFloor.js ocean 0.88        every picture of one world (index.json "setting")
//   node setFloor.js ocean-arrival 0.9 one picture (its id)
//   node setFloor.js show              print current values
//
// Backs up index.json to index.json.floor.bak on the first run. The server re-reads index.json
// for every story, so just generate a NEW story to see the change (no restart needed).

const fs = require('fs');
const path = require('path');

const INDEX = path.join(__dirname, 'public', 'scenes', 'library', 'index.json');
const raw = fs.readFileSync(INDEX, 'utf8');
const data = JSON.parse(raw);
const images = Array.isArray(data) ? data : data.images;
const args = process.argv.slice(2);

if (args[0] === 'show' || args.length === 0) {
  const byWorld = {};
  for (const image of images) (byWorld[image.setting] = byWorld[image.setting] || []).push(image.floorY ?? 0.78);
  for (const [world, values] of Object.entries(byWorld)) console.log(world.padEnd(18), [...new Set(values)].join(', '));
  process.exit(0);
}

const value = Number(args[args.length - 1]);
if (!Number.isFinite(value) || value < 0.6 || value > 0.95) {
  console.error('The last argument must be a number between 0.60 and 0.95, for example 0.86');
  process.exit(1);
}

const target = args.length > 1 ? args[0] : null;
const chosen = images.filter(i => !target || i.setting === target || i.id === target);
if (chosen.length === 0) {
  console.error(`No world or picture named "${target}". Worlds: ${[...new Set(images.map(i => i.setting))].join(', ')}`);
  process.exit(1);
}

const backup = `${INDEX}.floor.bak`;
if (!fs.existsSync(backup)) fs.writeFileSync(backup, raw);

for (const image of chosen) image.floorY = value;
fs.writeFileSync(INDEX, JSON.stringify(data, null, 2) + '\n');
console.log(`floorY = ${value} for ${chosen.length} picture(s). Backup: ${backup}`);