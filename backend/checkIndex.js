'use strict';
// Prints, for each world, how many pictures it has per view and flags missing files.
const fs = require('fs');
const path = require('path');
const LIB = path.join(__dirname, 'public', 'scenes', 'library');
const data = JSON.parse(fs.readFileSync(path.join(LIB, 'index.json'), 'utf8'));
const images = Array.isArray(data) ? data : data.images;
const VIEWS = ['arrive', 'path', 'challenge', 'goal', 'celebrate'];
let problems = 0;
const worlds = [...new Set(images.map(i => i.setting))].sort();
for (const world of worlds) {
  const items = images.filter(i => i.setting === world);
  const counts = VIEWS.map(v => `${v}:${items.filter(i => i.view === v).length}`).join(' ');
  const missingViews = VIEWS.filter(v => !items.some(i => i.view === v));
  const missingFiles = items.filter(i => !fs.existsSync(path.join(LIB, i.file)));
  const flag = missingViews.length || missingFiles.length ? '  <-- CHECK' : '';
  if (flag) problems += 1;
  console.log(`${world.padEnd(18)} ${String(items.length).padStart(2)} pictures  ${counts}${flag}`);
  missingFiles.forEach(i => console.log(`   missing file: ${i.file}`));
}
console.log(problems ? `\n${problems} world(s) need attention` : '\nAll worlds have every view and every file exists');