
'use strict';

const assert = require('node:assert/strict');
const { PARTS, generateRecipeStory } = require('./recipeStory');

const compatibleSettingCounts = {
  lost_lantern: 4,
  rainbow_map: 4,
  missing_song: 4,
  star_seed: 4,
  golden_key: 4,
  festival_flower: 4,
  runaway_cloud: 3,
  crystal_bell: 4,
};

const compatibleSettingCount = Object.values(
  compatibleSettingCounts,
).reduce((total, count) => total + count, 0);

const possibleRecipes =
  compatibleSettingCount *
  PARTS.friends.length *
  PARTS.obstacles.length *
  PARTS.endings.length;

assert.equal(possibleRecipes, 3968);

const base = {
  genre: 'magical',
  characterName: 'Milo',
  seed: 'repeatable-test',
};

const first = generateRecipeStory(base);
const replay = generateRecipeStory(base);

assert.deepEqual(first, replay, 'Same seed must reproduce the same story');
assert.equal(first.scenes.length, 8, 'Each story must contain eight scenes');
assert.match(first.recipe.hash, /^[a-f0-9]{40}$/, 'Recipe hash must be SHA-1 format');

const expectedTitles = [
  'A Curious Beginning',
  'The Problem and the Promise',
  'The First Clue',
  'A Guess Goes Wrong',
  'A Choice That Matters',
  'The Clues Fit Together',
  'The Final Challenge',
  'A Happy Resolution',
];

assert.deepEqual(
  first.scenes.map(scene => scene.title),
  expectedTitles,
  'Scenes must follow the eight-beat story structure',
);

for (const [index, scene] of first.scenes.entries()) {
  assert.equal(scene.number, index + 1, 'Scene numbers must be sequential');
  assert.ok(scene.narration.trim().length > 0, 'Narration must not be empty');
  assert.ok(scene.visualPrompt.trim().length > 0, 'Visual prompt must not be empty');
  assert.ok(scene.motionPrompt.trim().length > 0, 'Motion prompt must not be empty');
}

const hashes = new Set();
const settingCounts = {};
const recentHashes = [];

for (let i = 0; i < 200; i++) {
  const story = generateRecipeStory({
    ...base,
    seed: `sequence-${i}`,
    exclude: recentHashes,
  });

  assert.equal(story.scenes.length, 8);
  assert.ok(!hashes.has(story.recipe.hash), 'Duplicate recipe found');

  hashes.add(story.recipe.hash);
  recentHashes.push(story.recipe.hash);

  const setting = story.recipe.setting;
  settingCounts[setting] = (settingCounts[setting] || 0) + 1;
}

const excludedStory = generateRecipeStory({
  ...base,
  exclude: [first.recipe.hash],
});

assert.notEqual(excludedStory.recipe.hash, first.recipe.hash);

console.log('PASS: 3,968 compatible recipes');
console.log('PASS: deterministic replay');
console.log('PASS: eight scenes and correct scene order');
console.log('PASS: narration and visual prompts exist for every scene');
console.log('PASS: recent recipe exclusion');
console.log(`PASS: ${hashes.size} unique recipes across 200 stories`);
console.log('Setting distribution:', settingCounts);
