'use strict';

// Corrects public/scenes/library/index.json after reviewing the contact sheets:
//  - ocean: two picture files had swapped contents (kelp vs crystal cave)
//  - wrong/missing landmarks (so Bedrock no longer writes about things that are not in the picture)
//  - view re-tags so every world has arrive/path/challenge/goal/celebrate pictures
//  - onlyFor tags for the treasure-chest pictures
// Backs up index.json to index.json.bak (first run only). Safe to run again.
//
//   cd backend && node fixLibrary.js && node checkIndex.js

const fs = require('fs');
const path = require('path');

const INDEX = path.join(__dirname, 'public', 'scenes', 'library', 'index.json');
const MOOD = {arrive: 'curious', path: 'exploration', challenge: 'tense', goal: 'hopeful', celebrate: 'joyful'};
const TREASURE_QUESTS = ['rainbow_map', 'golden_key'];

// key = picture id OR current file name. null onlyFor removes the tag.
const FIXES = {
  // ---- ocean (match by id) ----
  'ocean-crystal-cave': {file: 'ocean/ocean-kelp-forest.png', onlyFor: null}, // that file really shows the crystal cave
  'ocean-kelp-forest': {file: 'ocean/ocean-crystal-cave.png'},                // that file really shows the kelp forest
  'ocean-peaceful-reef': {landmarks: ['treasure chest', 'shipwreck', 'colorful coral'], onlyFor: TREASURE_QUESTS},
  'ocean-treasure-discovery': {landmarks: ['treasure chest', 'coins', 'stone pillar'], onlyFor: TREASURE_QUESTS},
  'ocean-reef-path': {landmarks: ['coral path', 'shipwreck', 'reef']},
  'ocean-coral-bridge': {landmarks: ['reef terraces', 'coral rocks', 'distant arches']},

  // ---- dinosaur_valley ----
  'dinosaur-crystal-cavern.png': {view: 'arrive', landmarks: ['waterfall', 'turquoise lake', 'volcano']},
  'dinosaur-intro.png': {view: 'arrive'},

  // ---- enchanted_forest ----
  'forest-entrance.jpeg': {view: 'arrive'},
  'forest-whispering-trail.jpeg': {view: 'arrive'},
  'forest-ancient-tree-bridge.jpeg': {view: 'challenge'},
  'forest-thorny-crossing.jpeg': {view: 'challenge'},
  'forest-enchanted-waterfall.jpeg': {view: 'goal'},
  'forest-peaceful-celebration.jpeg': {view: 'celebrate'},

  // ---- fairy_village ----
  'fairy-village-mushroom-cottage-lane.jpeg': {view: 'path'},
  'fairy-village-lantern-flower-garden.jpeg': {view: 'path'},
  'fairy-village-moonflower-clearing.jpeg': {view: 'celebrate'},

  // ---- cloud_kingdom ----
  'cloud-kingdom-crystal-shrine.png.png': {view: 'goal', landmarks: ['palace stairway', 'hanging banners', 'flowers']},
  'cloud-kingdom-journey-to-royal-castle.png': {view: 'path'},
  'cloud-kingdom-floating-gardens.png.png': {view: 'path'},

  // ---- icecream_valley ----
  'ice-cream-valley-waffle-cone-village.png.png': {view: 'path'},

  // ---- space_station ----
  'space-arrival.png': {view: 'arrive', landmarks: ['big planets', 'rocky landscape', 'crystals']},
  'space-alien-crystal-caves.png': {view: 'path'},
  'space-cosmic-celebration.png': {view: 'celebrate'},
  'space-station.png': {view: 'goal'},

  // ---- toy_city ----
  'toykingdom-arrival.png': {view: 'arrive'},
  'toy-celebration-playground.png': {view: 'celebrate'},
  'toy-rainbow-castle.png': {view: 'goal'},

  // ---- winter_village ----
  'snowy-arrival.jpeg': {view: 'arrive'},
  'frosty-forest-trail.jpeg': {view: 'path'},
  'frozen-waterfall.jpeg': {view: 'challenge'},
  'ice-palace.jpeg': {view: 'goal'},

  // ---- amusement_park ----
  'fantasy-park-rainbow-ferris-wheel.jpeg': {view: 'goal'},
  'fantasy-park-enchanted-carousel.jpeg': {view: 'goal'},
};

const raw = fs.readFileSync(INDEX, 'utf8');
const data = JSON.parse(raw);
const images = Array.isArray(data) ? data : data.images;

const backup = `${INDEX}.bak`;
if (!fs.existsSync(backup)) fs.writeFileSync(backup, raw);

let changed = 0;
for (const [key, fix] of Object.entries(FIXES)) {
  const image = images.find(i => i.id === key || path.basename(i.file || '') === key);
  if (!image) {
    console.error(`Not found in index.json: ${key}`);
    process.exit(1);
  }

  if (fix.file) image.file = fix.file;
  if (fix.landmarks) image.landmarks = fix.landmarks;
  if (fix.view && image.view !== fix.view) {
    image.view = fix.view;
    image.mood = MOOD[fix.view];
  }
  if (fix.onlyFor === null) delete image.onlyFor;
  else if (fix.onlyFor) image.onlyFor = fix.onlyFor;
  changed += 1;
}

fs.writeFileSync(INDEX, JSON.stringify(data, null, 2) + '\n');
console.log(`Updated ${changed} pictures. Backup: ${backup}`);