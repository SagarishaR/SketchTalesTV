
'use strict';

const crypto = require('crypto');

const PARTS = {
  settings: [
    { id: 'icecream_valley', name: 'Ice Cream Valley', place: 'a magical valley of ice cream, candy bridges, and chocolate rivers' },
    { id: 'fairy_village', name: 'Fairy Village', place: 'an enchanted village of mushroom cottages, glowing flowers, and tiny fairy doors' },
    { id: 'amusement_park', name: 'Fantasy Amusement Park', place: 'a magical amusement park filled with enchanted rides and colorful carnival streets' },
    { id: 'moon_garden', name: 'Storybook Garden', place: 'a sunny storybook garden' },
    { id: 'cloud_kingdom', name: 'Cloud Kingdom', place: 'a kingdom floating among soft clouds' },
    { id: 'coral_reef', name: 'Coral Reef', place: 'a colorful underwater coral reef' },
    { id: 'dinosaur_valley', name: 'Dinosaur Valley', place: 'a friendly prehistoric valley' },
    { id: 'space_station', name: 'Space Station', place: 'a colorful station among the stars' },
    { id: 'enchanted_forest', name: 'Enchanted Forest', place: 'a magical forest filled with glowing plants' },
    { id: 'toy_city', name: 'Toy City', place: 'a cheerful city made of giant toys' },
    { id: 'winter_village', name: 'Winter Village', place: 'a cozy village covered in sparkling snow' },
  ],

  quests: [
    { id: 'lost_lantern', name: 'Find the Lost Lantern', title: 'the Lost Lantern', goal: 'find a lantern that lights the way home' },
    { id: 'rainbow_map', name: 'Follow the Rainbow Map', title: 'The Rainbow Map', goal: 'follow a rainbow map to a hidden treasure' },
    { id: 'missing_song', name: 'Recover the Missing Song', title: 'The Missing Song', goal: 'help a little bird recover its missing song' },
    { id: 'star_seed', name: 'Plant a Star Seed', title: 'The Star Seed', goal: 'plant a tiny star seed before moonrise' },
    { id: 'golden_key', name: 'Find the Golden Key', title: 'The Golden Key', goal: 'find a golden key that opens a mysterious door' },
    { id: 'festival_flower', name: 'Save the Festival Flower', title: 'The Festival Flower', goal: 'find a special flower before the festival begins' },
    { id: 'runaway_cloud', name: 'Guide the Runaway Cloud', title: 'The Runaway Cloud', goal: 'guide a runaway cloud back to its friends' },
    { id: 'crystal_bell', name: 'Ring the Crystal Bell', title: 'The Crystal Bell', goal: 'find a crystal bell that can awaken the valley' },
  ],

  friends: [
    { id: 'owl', name: 'Ollie the Owl', description: 'Ollie the thoughtful little owl' },
    { id: 'fox', name: 'Pip the Fox', description: 'Pip the cheerful fox with a fluffy tail' },
    { id: 'robot', name: 'Bobo the Robot', description: 'Bobo the gentle robot who loves helping' },
    { id: 'dragon', name: 'Mimi the Dragon', description: 'Mimi the tiny dragon with sparkling wings' },
    { id: 'turtle', name: 'Tilly the Turtle', description: 'Tilly the patient turtle who knows secret paths' },
    { id: 'rabbit', name: 'Clover the Rabbit', description: 'Clover the curious rabbit' },
    { id: 'whale', name: 'Wally the Whale', description: 'Wally the friendly whale with a musical voice' },
    { id: 'firefly', name: 'Flick the Firefly', description: 'Flick the little firefly who glows in the dark' },
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

const GENRES = new Set(['magical', 'funny', 'space', 'animals']);

// Keep stories believable: some friends and problems only make sense in some worlds.
const FRIEND_ONLY_IN = {
  whale: ['coral_reef'],
};

const FRIEND_NOT_IN = {
  owl: ['coral_reef'],
  fox: ['coral_reef'],
  rabbit: ['coral_reef'],
};

const OBSTACLE_NOT_IN = {
  rainy_path: ['coral_reef'],
  gentle_wind: ['coral_reef'],
};

function friendFits(friend, settingId) {
  if (
    FRIEND_ONLY_IN[friend.id] &&
    !FRIEND_ONLY_IN[friend.id].includes(settingId)
  ) {
    return false;
  }

  if ((FRIEND_NOT_IN[friend.id] || []).includes(settingId)) {
    return false;
  }

  return true;
}

function obstacleFits(obstacle, settingId) {
  return !(OBSTACLE_NOT_IN[obstacle.id] || []).includes(settingId);
}

const QUEST_SETTINGS = {
  lost_lantern: [
    'moon_garden',
    'enchanted_forest',
    'winter_village',
    'cloud_kingdom',
    'coral_reef',
    'icecream_valley',
    'fairy_village',
    'amusement_park',
  ],

  rainbow_map: [
    'enchanted_forest',
    'dinosaur_valley',
    'toy_city',
    'moon_garden',
    'coral_reef',
    'icecream_valley',
    'fairy_village',
    'amusement_park',
  ],

  missing_song: [
    'enchanted_forest',
    'cloud_kingdom',
    'dinosaur_valley',
    'winter_village',
    'icecream_valley',
    'fairy_village',
    'amusement_park',
  ],

  star_seed: [
    'moon_garden',
    'enchanted_forest',
    'cloud_kingdom',
    'space_station',
    'icecream_valley',
    'fairy_village',
    'amusement_park',
  ],

  golden_key: [
    'toy_city',
    'winter_village',
    'enchanted_forest',
    'cloud_kingdom',
    'coral_reef',
    'icecream_valley',
    'fairy_village',
    'amusement_park',
  ],

  festival_flower: [
    'moon_garden',
    'enchanted_forest',
    'dinosaur_valley',
    'winter_village',
    'icecream_valley',
    'fairy_village',
    'amusement_park',
  ],

  runaway_cloud: [
    'cloud_kingdom',
    'space_station',
    'moon_garden',
    'icecream_valley',
    'fairy_village',
    'amusement_park',
  ],

  crystal_bell: [
    'enchanted_forest',
    'dinosaur_valley',
    'moon_garden',
    'cloud_kingdom',
    'coral_reef',
    'icecream_valley',
    'fairy_village',
    'amusement_park',
  ],
};

const QUEST_STORIES = {
  lost_lantern: {
    clue1: 'three tiny golden specks on a broad leaf',
    clue2: 'a warm glow reflected in a puddle beside a hollow tree',
    wrong: 'They followed a bright reflection to a shiny pebble, but it gave no light of its own.',
    insight: 'The golden specks looked like tiny drops of wax, and the puddle reflected light from somewhere low and sheltered.',
    choice: 'They could rush along a slippery shortcut or take the longer, safer path without damaging the plants.',
    action: 'They shielded the small glow from the breeze and looked inside the hollow tree.',
    solution: 'the lantern had rolled into the hollow tree and was tucked safely behind a bed of leaves',
    finish: 'They lifted the lantern carefully. Its warm light made the familiar homeward path shine again.',
    lesson: 'careful observation and choosing a safe path',
  },

  rainbow_map: {
    clue1: 'a painted blue curve ending beside a three-pointed stone',
    clue2: 'three colored pebbles arranged in the same order as the map',
    wrong: 'They followed the brightest color first, but it led to flowers and no treasure.',
    insight: 'The map was not showing the brightest route; its colors matched landmarks in a particular order.',
    choice: 'They could guess where the map ended, or match its colors with the landmarks they had seen.',
    action: 'They matched the final color to the three-pointed stone and checked the ground nearby.',
    solution: 'the treasure box rested beneath the three-pointed stone marked on the map',
    finish: 'Inside the box they found bright buttons and a note inviting them to share their discovery.',
    lesson: 'patience, pattern-finding, and checking evidence',
  },

  missing_song: {
    clue1: 'a feather beside a branch that hummed softly in the breeze',
    clue2: 'a familiar three-note rhythm tapped by a tiny woodpecker',
    wrong: 'They asked the bird to sing louder, but the bird grew worried and stayed quiet.',
    insight: 'The song was not truly gone; the bird was nervous, and the breeze was hiding the gentle notes.',
    choice: 'They could keep demanding a song, or make a calm place where the bird felt safe.',
    action: 'They softly tapped the three-note rhythm without demanding that the bird sing.',
    solution: 'the bird remembered its melody when it heard the gentle rhythm that began the song',
    finish: 'The bird sang one note, then another, until its cheerful tune filled the place.',
    lesson: 'kindness, patience, and helping others feel safe',
  },

  star_seed: {
    clue1: 'a silver sparkle caught in the folds of a fallen petal',
    clue2: 'a patch of soft soil that stayed warm but was sheltered from strong wind',
    wrong: 'They chose the brightest patch of ground, but its soil was hard and dry.',
    insight: 'A bright place was not enough; the seed needed soft soil and gentle warmth.',
    choice: 'They could plant it immediately in hard ground, or prepare a sheltered patch together.',
    action: 'They loosened the soil gently, made a small hollow, and protected it with fallen leaves.',
    solution: 'the star seed was planted in soft, sheltered soil where it could begin to grow',
    finish: 'Before moonrise, the seed glimmered like a tiny star and sent one hopeful green shoot above the soil.',
    lesson: 'patience, care, and giving living things what they need',
  },

  golden_key: {
    clue1: 'a narrow scratch in the dust shaped like the curve of a key',
    clue2: 'a tiny golden glint beside a door with the same curved lock',
    wrong: 'They tried a large twig in the lock, but it did not fit, so they stopped instead of forcing it.',
    insight: 'The scratch and the lock had matching curves, so the real key was likely nearby.',
    choice: 'They could push the door harder, or search carefully around the matching marks.',
    action: 'They brushed away loose leaves beside the door and spotted a small golden edge.',
    solution: 'the golden key was hidden under the leaves beside the door it was made to open',
    finish: 'The key turned gently, and the door opened onto a sunny room filled with books and friendly surprises.',
    lesson: 'looking carefully and not forcing a problem',
  },

  festival_flower: {
    clue1: 'a trail of pale pollen leading away from the crowded festival path',
    clue2: 'a sheltered nook with damp soil and sunlight falling through the leaves',
    wrong: 'They searched the busiest flower bed first, but every flower there was still firmly rooted.',
    insight: 'The pollen had blown away from the crowd toward a quiet spot with the right growing conditions.',
    choice: 'They could rush through the flower beds, or follow the faint pollen trail without trampling plants.',
    action: 'They followed the trail slowly and moved only fallen leaves, leaving growing plants undisturbed.',
    solution: 'the special flower was growing in a quiet sheltered nook away from the busy festival path',
    finish: 'They carried the flower in its small pot to the festival and placed it where everyone could admire it.',
    lesson: 'protecting nature and being thoughtful when time is short',
  },

  runaway_cloud: {
    clue1: 'a line of tiny droplets drifting toward the high ridge',
    clue2: 'a soft echo of the cloud’s friends calling from beyond the ridge',
    wrong: 'They tried to push the cloud from behind, but the breeze spun it in a circle.',
    insight: 'The cloud needed a clear route and a familiar sound, not a stronger push.',
    choice: 'They could chase the cloud through the gusts, or guide it toward the ridge where its friends could be heard.',
    action: 'They marked the calmer route with floating ribbons and called to the cloud’s friends.',
    solution: 'the cloud followed the calm air over the ridge toward the familiar voices of its friends',
    finish: 'The runaway cloud joined its family and made a little patch of shade for tired travelers.',
    lesson: 'listening, teamwork, and guiding rather than forcing',
  },

  crystal_bell: {
    clue1: 'a faint ring whenever the breeze passed a cluster of crystal leaves',
    clue2: 'a trail of sparkling dust leading toward a stone ledge shaped like a small arch',
    wrong: 'They rang ordinary bells nearby, but none made the clear note described in the old story.',
    insight: 'The special bell’s sound was connected to the crystal leaves and the sparkling trail.',
    choice: 'They could bang on every object, or follow the sound and handle the crystals gently.',
    action: 'They followed the sparkling trail to the arch-shaped ledge and checked behind it carefully.',
    solution: 'the crystal bell was resting behind the arch-shaped ledge beside the crystal leaves',
    finish: 'One gentle ring spread a lovely note across the place, and its sleepy flowers slowly opened.',
    lesson: 'gentleness, careful listening, and curiosity',
  },
};

// Underwater wording. These overrides avoid land-specific clues in the coral reef.
const SETTING_QUEST_OVERRIDES = {
  coral_reef: {
    lost_lantern: {
      clue1: 'three tiny golden bubbles floating up from behind a tall piece of coral',
      clue2: 'a warm glow shining softly from a sandy hollow beneath a rock arch',
      wrong: 'They followed a bright flash of light to a shiny shell, but it only reflected the sunbeams and gave no light of its own.',
      insight: 'The golden bubbles were drifting up from somewhere low, and the soft glow came from a sheltered place out of the current.',
      choice: 'They could dash through the strong current in the open water, or take the slower path along the seabed and keep the coral safe.',
      action: 'They shielded the small glow from the current and peeked into the sandy hollow beneath the rock arch.',
      solution: 'the lantern had drifted into the sandy hollow and was resting safely beside a clump of seaweed',
      finish: 'They lifted the lantern carefully. Its warm light made the way home across the reef shine again.',
      lesson: 'careful observation and choosing a gentle path',
    },

    rainbow_map: {
      clue1: 'a painted blue wave ending beside a three-pointed rock',
      clue2: 'three coloured shells arranged in the same order as the map',
      wrong: 'They followed the brightest colour first, but it led to a patch of pretty coral and no treasure.',
      insight: 'The map was not showing the brightest route; its colours matched landmarks in a particular order.',
      choice: 'They could guess where the map ended, or match its colours with the landmarks they had seen.',
      action: 'They matched the last colour to the three-pointed rock and checked the sand around it.',
      solution: 'the treasure box rested in the sand beneath the three-pointed rock marked on the map',
      finish: 'Inside the box they found bright shells and a note inviting them to share their discovery.',
      lesson: 'patience, pattern-finding, and checking evidence',
    },

    golden_key: {
      clue1: 'a narrow curve scratched in the sand, shaped like the bend of a key',
      clue2: 'a tiny golden glint beside a round stone door with the same curved lock',
      wrong: 'They tried a long piece of driftwood in the lock, but it did not fit, so they stopped instead of forcing it.',
      insight: 'The scratch and the lock had matching curves, so the real key was likely close by.',
      choice: 'They could push the stone door harder, or search carefully around the matching marks.',
      action: 'They gently fanned the sand beside the door and spotted a small golden edge.',
      solution: 'the golden key was buried in the sand beside the door it was made to open',
      finish: 'The key turned gently, and the door opened onto a glowing room filled with shells and friendly surprises.',
      lesson: 'looking carefully and not forcing a problem',
    },

    crystal_bell: {
      clue1: 'a faint ring whenever the current passed a cluster of crystal coral',
      clue2: 'a trail of sparkling bubbles leading toward a ledge shaped like a small arch',
      wrong: 'They tapped ordinary shells nearby, but none made the clear note described in the old story.',
      insight: 'The special bell’s sound was connected to the crystal coral and the sparkling bubbles.',
      choice: 'They could knock on every rock, or follow the sound and handle the crystals gently.',
      action: 'They followed the sparkling bubbles to the arch-shaped ledge and checked behind it carefully.',
      solution: 'the crystal bell was resting behind the arch-shaped ledge beside the crystal coral',
      finish: 'One gentle ring spread a lovely note across the reef, and its sleepy sea flowers slowly opened.',
      lesson: 'gentleness, careful listening, and curiosity',
    },
  },
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

function selectRecipe(seed, exclude = [], allowedSettings = null, avoidSettings = []) {
  const excluded = new Set(exclude);

  const allowed = Array.isArray(allowedSettings) && allowedSettings.length > 0
    ? new Set(allowedSettings)
    : null;

  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const random = makeRandom(`${seed}:${attempt}`);

    let quest;
    let setting;

    if (allowed) {
      // Select a world first so allowed worlds receive a fair chance.
      const worlds = PARTS.settings.filter(
        candidate =>
          allowed.has(candidate.id) &&
          PARTS.quests.some(q =>
            (QUEST_SETTINGS[q.id] || []).includes(candidate.id),
          ),
      );

      if (worlds.length === 0) {
        throw new Error('No quests are available for the allowed settings');
      }

      // Prefer a different world from the previous story.
      const avoid = new Set(avoidSettings || []);
      const fresh = worlds.filter(candidate => !avoid.has(candidate.id));

      setting = pick(fresh.length > 0 ? fresh : worlds, random);

      quest = pick(
        PARTS.quests.filter(q =>
          (QUEST_SETTINGS[q.id] || []).includes(setting.id),
        ),
        random,
      );
    } else {
      quest = pick(PARTS.quests, random);

      const compatibleSettings = PARTS.settings.filter(candidate =>
        QUEST_SETTINGS[quest.id]?.includes(candidate.id),
      );

      if (compatibleSettings.length === 0) {
        throw new Error(`No compatible settings for quest: ${quest.id}`);
      }

      setting = pick(compatibleSettings, random);
    }

    const friend = pick(
      PARTS.friends.filter(f => friendFits(f, setting.id)),
      random,
    );

    const obstacle = pick(
      PARTS.obstacles.filter(o => obstacleFits(o, setting.id)),
      random,
    );

    const ending = pick(PARTS.endings, random);

    const recipe = { setting, quest, friend, obstacle, ending };

    recipe.hash = hash([
      setting.id,
      quest.id,
      friend.id,
      obstacle.id,
      ending.id,
    ].join('|'));

    if (!excluded.has(recipe.hash)) {
      return recipe;
    }
  }

  throw new Error('Could not find a non-excluded recipe after 5000 attempts');
}

function cleanCharacterName(value) {
  const name = String(value ?? 'Little Hero')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);

  return name || 'Little Hero';
}

function genreFlavor(genre) {
  if (genre === 'funny') {
    return 'A few silly surprises made the adventure cheerful, but careful thinking mattered more than luck.';
  }

  if (genre === 'space') {
    return 'Tiny stars glittered overhead, and the friends used the lights and landmarks to guide their search.';
  }

  if (genre === 'animals') {
    return 'Small animal neighbors shared the place, and the friends took care not to disturb them.';
  }

  return 'A gentle shimmer of magic brightened the path, but careful observation mattered more than magic alone.';
}

function obstacleResolution(id) {
  if (id === 'rainy_path') {
    return 'They waited for the heaviest drops to pass, then crossed the wet ground slowly and helped one another stay steady.';
  }

  if (id === 'mixed_signs') {
    return 'They stopped trusting the confusing signs and checked the landmarks against the clues they had collected.';
  }

  if (id === 'sleepy_bridge') {
    return 'They greeted the bridge politely and crossed one at a time after it lowered safely.';
  }

  return 'They held their notes under a smooth stone and gathered the scattered clues before continuing.';
}

function createScenes(recipe, hero, genre) {
  const plot = {
    ...QUEST_STORIES[recipe.quest.id],
    ...((SETTING_QUEST_OVERRIDES[recipe.setting.id] || {})[
      recipe.quest.id
    ] || {}),
  };

  const place = recipe.setting.place;
  const solution = plot.solution || recipe.quest.goal;
  const finish = plot.finish || recipe.ending.resolution;
  const lesson = plot.lesson || 'being patient and trying again';

  const settingMap = {
    moon_garden: 'garden',
    coral_reef: 'ocean',
    dinosaur_valley: 'dinosaur_valley',
    enchanted_forest: 'enchanted_forest',
    winter_village: 'winter_village',
    space_station: 'space_station',
    toy_city: 'toy_city',
    cloud_kingdom: 'cloud_kingdom',
    icecream_valley: 'icecream_valley',
    fairy_village: 'fairy_village',
    amusement_park: 'amusement_park',
  };

  // Eight connected scenes: mission, clues, mistake, decision, solution, and ending.
  const beats = [
    {
      title: 'A New Adventure',
      view: 'arrive',
      mood: 'curious',
      narration: `${hero} was exploring ${place}. Then ${hero} heard about a problem: ${recipe.quest.goal}. "I can help!" said ${hero}.`,
      composition: 'A wide view of the world as the hero arrives.',
    },

    {
      title: 'The Mission',
      view: 'arrive',
      mood: 'curious',
      narration: `${hero} wanted to solve the problem. The first step was to look for a clue.`,
      composition: 'The hero prepares to begin the search.',
    },

    {
      title: 'The First Clue',
      view: 'path',
      mood: 'exploration',
      narration: `${hero} looked around and found ${plot.clue1}. "This may help us," said ${hero}.`,
      composition: 'The hero notices the first clue.',
    },

    {
      title: 'A Wrong Turn',
      view: 'path',
      mood: 'exploration',
      narration: `${hero} followed the first idea. ${plot.wrong} The clue did not lead to the answer, so ${hero} tried again.`,
      composition: 'The hero discovers that the first guess was wrong.',
    },

    {
      title: 'Think It Through',
      view: 'challenge',
      mood: 'tense',
      narration: `${hero} stopped and thought. ${plot.insight || 'The clues helped the hero think of a better plan.'} ${plot.choice || 'The hero chose to look carefully and stay safe.'} ${hero} decided to follow the clues instead of guessing.`,
      composition: 'The hero studies the clues and chooses a better plan.',
    },

    {
      title: 'The Last Clue',
      view: 'path',
      mood: 'exploration',
      narration: `${hero} followed the clues and found ${plot.clue2}. "Now I know where to look!" said ${hero}.`,
      composition: 'The hero discovers the second clue near a landmark.',
    },

    {
      title: 'The Answer',
      view: 'goal',
      mood: 'hopeful',
      narration: `${plot.action || `${hero} looked carefully in the right place.`} At last, ${solution}. "We did it!" said ${hero}.`,
      composition: 'The hero finds the object or solves the problem.',
    },

    {
      title: 'A Happy Ending',
      view: 'celebrate',
      mood: 'joyful',
      narration: `${finish} ${hero} was happy to help. The adventure taught ${hero} the value of ${lesson}. The end.`,
      composition: 'A warm, happy ending showing the problem is solved.',
    },
  ];

  return beats.map((beat, index) => {
    const narration = beat.narration
      .replace(/\bThey\b/g, hero)
      .replace(/\bthey\b/g, hero)
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,!?])/g, '$1')
      .trim();

    return {
      number: index + 1,
      title: beat.title,
      narration,
      view: beat.view,
      mood: beat.mood,
      librarySetting: settingMap[recipe.setting.id] || recipe.setting.id,

      visualPrompt:
        `Create a child-friendly storybook illustration for scene ${index + 1} of 8. ` +
        `Setting: ${place}. Show exactly one main character: ${hero}, faithfully based on the child's uploaded drawing. ` +
        `Preserve the original silhouette, proportions, colors, and distinctive features. ` +
        `Do not add any other characters. Scene: ${beat.title}. Action: ${narration}. ` +
        `Composition: ${beat.composition}. Clearly show the clue or object mentioned. ` +
        `Keep the world consistent with the setting. Use gentle expressions, soft lighting, and cheerful colors. ` +
        `No text, captions, logos, or watermarks.`,

      motionPrompt:
        'Animate only the child-drawn hero and the environment. Preserve the hero’s original shape, colors, and features. ' +
        'Use gentle movement and slow camera motion. Keep the setting consistent. ' +
        'Do not add other characters. No text or subtitles.',
    };
  });
}

function generateRecipeStory({
  genre = 'magical',
  characterName = 'Little Hero',
  seed,
  exclude = [],
  allowedSettings = null,
  avoidSettings = [],
} = {}) {
  if (seed === undefined || seed === null || String(seed).length === 0) {
    throw new Error('A seed is required');
  }

  if (!GENRES.has(genre)) {
    throw new Error('Choose magical, funny, space, or animals');
  }

  if (!Array.isArray(exclude)) {
    throw new Error('exclude must be an array');
  }

  const recipe = selectRecipe(seed, exclude, allowedSettings, avoidSettings);
  const hero = cleanCharacterName(characterName);

  return {
    title: `${hero} and ${recipe.quest.title}`,
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

    scenes: createScenes(recipe, hero, genre),
  };
}

module.exports = {
  PARTS,
  generateRecipeStory,
};
