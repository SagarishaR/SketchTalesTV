const crypto = require('crypto');

const PARTS = {
  settings: [
    { id: 'moon_garden', name: 'Moon Garden', place: 'a moonlit enchanted garden' },
    { id: 'cloud_kingdom', name: 'Cloud Kingdom', place: 'a kingdom floating among soft clouds' },
    { id: 'coral_reef', name: 'Coral Reef', place: 'a colorful underwater coral reef' },
    { id: 'dinosaur_valley', name: 'Dinosaur Valley', place: 'a friendly prehistoric valley' },
    { id: 'space_station', name: 'Space Station', place: 'a colorful station among the stars' },
    { id: 'enchanted_forest', name: 'Enchanted Forest', place: 'a magical forest filled with glowing plants' },
    { id: 'toy_city', name: 'Toy City', place: 'a cheerful city made of giant toys' },
    { id: 'winter_village', name: 'Winter Village', place: 'a cozy village covered in sparkling snow' },
  ],
  quests: [
    { id: 'lost_lantern', name: 'Find the Lost Lantern', goal: 'find a lantern that lights the way home' },
    { id: 'rainbow_map', name: 'Follow the Rainbow Map', goal: 'follow a rainbow map to a hidden treasure' },
    { id: 'missing_song', name: 'Recover the Missing Song', goal: 'help a little bird recover its missing song' },
    { id: 'star_seed', name: 'Plant a Star Seed', goal: 'plant a tiny star seed before moonrise' },
    { id: 'golden_key', name: 'Find the Golden Key', goal: 'find a golden key that opens a mysterious door' },
    { id: 'festival_flower', name: 'Save the Festival Flower', goal: 'find a special flower before the festival begins' },
    { id: 'runaway_cloud', name: 'Guide the Runaway Cloud', goal: 'guide a runaway cloud back to its friends' },
    { id: 'crystal_bell', name: 'Ring the Crystal Bell', goal: 'find and ring a crystal bell to awaken the valley' },
  ],
  friends: [
    { id: 'owl', name: 'Ollie the Owl', description: 'a thoughtful little owl' },
    { id: 'fox', name: 'Pip the Fox', description: 'a cheerful fox with a fluffy tail' },
    { id: 'robot', name: 'Bobo the Robot', description: 'a gentle robot who loves helping' },
    { id: 'dragon', name: 'Mimi the Dragon', description: 'a tiny dragon with sparkling wings' },
    { id: 'turtle', name: 'Tilly the Turtle', description: 'a patient turtle who knows secret paths' },
    { id: 'rabbit', name: 'Clover the Rabbit', description: 'a curious rabbit who hops everywhere' },
    { id: 'whale', name: 'Wally the Whale', description: 'a friendly whale with a musical voice' },
    { id: 'firefly', name: 'Flick the Firefly', description: 'a little firefly who glows in the dark' },
  ],
  obstacles: [
    { id: 'rainy_path', name: 'Rainy Path', problem: 'a sudden rainstorm makes the path slippery' },
    { id: 'mixed_signs', name: 'Mixed-Up Signs', problem: 'the direction signs have become mixed up' },
    { id: 'sleepy_bridge', name: 'Sleepy Bridge', problem: 'a sleepy bridge will not wake up to let anyone cross' },
    { id: 'gentle_wind', name: 'Gentle Wind', problem: 'a playful wind scatters the clues everywhere' },
  ],
  endings: [
    { id: 'garden_party', name: 'A Garden Party', resolution: 'everyone celebrates with a joyful picnic' },
    { id: 'wish_shared', name: 'A Shared Wish', resolution: 'the friends make a kind wish together' },
    { id: 'homecoming', name: 'A Happy Homecoming', resolution: 'everyone returns home feeling safe and proud' },
    { id: 'friendship_festival', name: 'A Friendship Festival', resolution: 'the whole community celebrates their teamwork' },
  ],
};

const PHRASINGS = {
  opening: [
    'One wonderful day, {hero} arrived at {place}.',
    'An unexpected adventure began when {hero} reached {place}.',
    'With curious eyes and a brave heart, {hero} explored {place}.',
  ],
  quest: [
    'There was an important mission: {goal}.',
    'A new challenge appeared. It was time to {goal}.',
    'A mysterious clue revealed the next goal: {goal}.',
  ],
  friend: [
    '{friend} appeared and offered to help.',
    'Luckily, {friend} knew a little about this adventure.',
    'Along came {friend}, ready to be a loyal teammate.',
  ],
  obstacle: [
    'But there was a problem: {problem}.',
    'Suddenly, the journey became tricky because {problem}.',
    'The friends paused when they discovered that {problem}.',
  ],
  ending: [
    'Working together, the friends succeeded, and {resolution}.',
    'Kindness and teamwork saved the day, so {resolution}.',
    'At last, the challenge was solved, and {resolution}.',
  ],
};

function hash(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function makeRandom(seed) {
  let state = parseInt(hash(String(seed)).slice(0, 8), 16) >>> 0;

  return function random() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}

function selectRecipe(seed, exclude = []) {
  const excluded = new Set(exclude);
  let lastRecipe = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const random = makeRandom(`${seed}:${attempt}`);

    const recipe = {
      setting: pick(PARTS.settings, random),
      quest: pick(PARTS.quests, random),
      friend: pick(PARTS.friends, random),
      obstacle: pick(PARTS.obstacles, random),
      ending: pick(PARTS.endings, random),
    };

    recipe.hash = hash([
      recipe.setting.id,
      recipe.quest.id,
      recipe.friend.id,
      recipe.obstacle.id,
      recipe.ending.id,
    ].join('|'));

    lastRecipe = recipe;
    if (!excluded.has(recipe.hash)) return recipe;
  }

  if (lastRecipe && !excluded.has(lastRecipe.hash)) return lastRecipe;

  throw new Error('Could not find a non-excluded recipe after 10 attempts');
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

function generateRecipeStory({
  genre = 'magical',
  characterName = 'little hero',
  seed,
  exclude = [],
} = {}) {
  if (!seed) throw new Error('A seed is required');
  if (!Array.isArray(exclude)) throw new Error('exclude must be an array');

  const recipe = selectRecipe(seed, exclude);
  const random = makeRandom(`${seed}:phrasing`);
  const hero = String(characterName).trim().slice(0, 40) || 'little hero';

  const beats = [
    ['A New Adventure', 'opening', {
      hero,
      place: recipe.setting.place,
    }],
    [recipe.quest.name, 'quest', {
      goal: recipe.quest.goal,
    }],
    ['A Helpful Friend', 'friend', {
      friend: recipe.friend.description,
    }],
    [recipe.obstacle.name, 'obstacle', {
      problem: recipe.obstacle.problem,
    }],
    [recipe.ending.name, 'ending', {
      resolution: recipe.ending.resolution,
    }],
  ];

  const scenes = beats.map(([title, type, values], index) => {
    const narration = fill(pick(PHRASINGS[type], random), values);

    return {
      number: index + 1,
      title,
      narration,
      visualPrompt: `Children's storybook illustration of ${recipe.setting.place}. ${narration} Include ${hero} as the recognizable main character based on the child's uploaded drawing. Keep character appearance consistent, use a ${genre} mood, and avoid text in the image.`,
      motionPrompt: 'Preserve the character’s recognizable shape, colors, and features. Use gentle natural movement and slow cinematic camera motion. No text or subtitles.',
    };
  });

  return {
    title: `${recipe.quest.name} — ${recipe.setting.name}`,
    genre,
    seed: String(seed),
    recipe: {
      setting: recipe.setting.id,
      quest: recipe.quest.id,
      friend: recipe.friend.id,
      obstacle: recipe.obstacle.id,
      ending: recipe.ending.id,
      hash: recipe.hash,
    },
    scenes,
  };
}

module.exports = {
  PARTS,
  generateRecipeStory,
};
