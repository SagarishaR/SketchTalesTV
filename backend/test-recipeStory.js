const assert = require('node:assert/strict');
const { PARTS, generateRecipeStory } = require('./recipeStory');

const possibleRecipes =
  PARTS.settings.length *
  PARTS.quests.length *
  PARTS.friends.length *
  PARTS.obstacles.length *
  PARTS.endings.length;

assert.equal(possibleRecipes, 8192);

const base = {
  genre: 'magical',
  characterName: 'Milo',
  seed: 'repeatable-test',
};

const first = generateRecipeStory(base);
const replay = generateRecipeStory(base);

assert.deepEqual(first, replay, 'Same seed must reproduce the same story');
assert.equal(first.scenes.length, 5);
assert.ok(first.recipe.hash);

const hashes = new Set();
const settingCounts = {};
const recentHashes = [];

for (let i = 0; i < 200; i++) {
  const story = generateRecipeStory({
    ...base,
    seed: `sequence-${i}`,
    exclude: recentHashes,
  });

  assert.equal(story.scenes.length, 5);
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

console.log('PASS: 8,192 base recipes');
console.log('PASS: deterministic replay');
console.log('PASS: five scenes per story');
console.log('PASS: recent recipe exclusion');
console.log(`PASS: ${hashes.size} unique recipes across 200 stories`);
console.log('Setting distribution:', settingCounts);
