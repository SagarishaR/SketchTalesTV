'use strict';

/**
 * Bedrock narration writer for SketchTales TV.
 *
 * Flow: the server first builds the 8-scene story skeleton (recipeStory.js) and
 * picks the 8 local background pictures (backgroundMatcher.js). This module
 * then asks Amazon Bedrock to REWRITE each scene's narration so it fits the
 * picture that scene will actually show. Bedrock never picks pictures and never
 * invents the plot: it gets the plan and the picture's landmark list.
 *
 * If Bedrock is off, slow, or returns anything that fails validation, the
 * original local narration is returned untouched (fallback), so the demo never
 * breaks.
 *
 * Env vars:
 *   BEDROCK_MODEL_ID  required to enable (model or inference-profile ID, verify with the CLI)
 *   BEDROCK_REGION    default us-east-1
 *   USE_BEDROCK=off   force the local generator
 *   BEDROCK_TIMEOUT_MS default 20000
 *
 * Self-test with the real service:  node bedrockStory.js
 */

const {BedrockRuntimeClient, ConverseCommand} = require('@aws-sdk/client-bedrock-runtime');
const {loadLibrary} = require('./backgroundMatcher');
const {PARTS} = require('./recipeStory');

const REGION = process.env.BEDROCK_REGION || 'us-east-1';
const TIMEOUT_MS = Number(process.env.BEDROCK_TIMEOUT_MS) || 20000;

const MIN_WORDS = 8;
const MAX_WORDS = 45;
const MAX_ATTEMPTS = 2; // one retry if the first reply is rejected
const MAX_BAD_SCENES = 2; // up to 2 failed scenes keep their local text, more -> whole story local

// Never allowed in narration for young children.
const BANNED_ALWAYS =
  /\b(kill|killed|die|died|dead|death|blood|weapon|gun|sword|monster|scary|terrified|hate|stupid|ugly|fight|angry)\b/i;
// Cannot happen underwater.
const BANNED_OCEAN = /\b(rain|raining|rainy|wind|windy|storm|snow)\b/i;

// Props that most often show up in text without being in the picture.
const PROP_WORDS = new Set([
  'door', 'doors', 'lock', 'locks', 'gate', 'bridge', 'bridges', 'sign', 'signs', 'chest', 'chests',
  'treasure', 'boat', 'boats', 'ship', 'ships', 'shipwreck', 'shell', 'shells', 'bubble', 'bubbles',
  'castle', 'house', 'houses', 'cottage', 'tower', 'fence', 'ladder', 'rope', 'boxes', 'basket',
  'lantern', 'lanterns', 'map', 'bell', 'key', 'keys', 'flower', 'flowers', 'petal', 'petals',
  'pollen', 'driftwood', 'footprints', 'footprint', 'feather', 'feathers', 'nest', 'cave', 'caves',
  'waterfall', 'volcano', 'rainbow', 'balloon', 'balloons', 'table', 'candle', 'candles',
]);

let cachedClient = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = new BedrockRuntimeClient({region: REGION, maxAttempts: 2});
  }
  return cachedClient;
}

function isEnabled() {
  return process.env.USE_BEDROCK !== 'off' && Boolean(process.env.BEDROCK_MODEL_ID);
}

function wordCount(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

// Fixed 8-beat arc. The picture, not the old local plan, supplies everything the hero sees.
const BEAT_JOBS = {
  1: 'Meet the hero in this place, using the picture. Say in simple words what the hero wants: {GOAL}.',
  2: 'The hero starts looking for {OBJECT}. Say what the hero sees around.',
  3: 'The hero notices something special about one picture item (it glows, sparkles or makes a soft sound). It may be a first clue.',
  4: 'The hero tries one simple idea with a picture item. It does not work. The hero stays calm and tries again.',
  5: 'The hero stops and thinks. The hero chooses to look carefully instead of rushing.',
  6: 'A better clue points toward a picture item. The hero says: "Now I know where to look!"',
  7: 'The hero finds {OBJECT} near a picture item and cheers: "We did it!"',
  8: 'Happy ending. The hero feels proud and calm. One short lesson about patience or kindness. Mention one picture item.',
};

function questInfo(scenes) {
  const id = (scenes.find(scene => scene.quest) || {}).quest;
  const quest = PARTS.quests.find(item => item.id === id) || {};
  // The scene 1 text holds the goal wording already adapted to the world (e.g. underwater).
  const match = /problem:\s*([^.]+)\./i.exec((scenes[0] && scenes[0].narration) || '');
  const goal = (match && match[1].trim()) || quest.goal || 'finish an important mission';
  const title = String(quest.title || 'the special thing').replace(/^the\s+/i, '').toLowerCase();
  return {id, goal, object: `the ${title}`};
}

function buildPrompt({scenes, hero, place, setting}) {
  const quest = questInfo(scenes);

  const system = [
    'You write short narration for a picture-book show for children aged 3 to 6.',
    'Each scene is shown over a fixed background picture. You are describing that picture.',
    'Rules:',
    '- Very short, simple sentences. Warm, gentle, cheerful. Nothing scary.',
    `- The only character is the hero, named "${hero}". Do not add any other character, animal or person.`,
    '- Everything the hero sees, touches or walks through must come from that scene\'s "pictureShows" list.',
    '  Never name any other object or place. Generic words are fine: a clue, a sparkle, a sound, a glow, the water, the path.',
    `- The hero is looking for ${quest.object}. Name it only as the thing being searched for. Do not describe it as visible unless it is in pictureShows.`,
    '- Do not invent doors, locks, signs, bridges, boats, chests, shells, flowers or any other props that are not in pictureShows.',
    '- Follow each scene\'s "job" and keep the scenes in order.',
    '- Use at least one item from that scene\'s pictureShows list in the text.',
    `- Each scene is ${MIN_WORDS + 8} to ${MAX_WORDS - 15} words.`,
    '- Reply with JSON only. No markdown, no commentary.',
  ].join('\n');

  const payload = {
    world: place,
    heroName: hero,
    lookingFor: quest.object,
    goal: quest.goal,
    scenes: scenes.map(scene => ({
      number: scene.number,
      job: (BEAT_JOBS[scene.number] || scene.title || '')
        .replace(/\{GOAL\}/g, quest.goal)
        .replace(/\{OBJECT\}/g, quest.object),
      pictureShows: scene._landmarks,
    })),
  };

  const user =
    'Write the narration for all scenes.\n' +
    'Return exactly this JSON shape: ' +
    '{"scenes":[{"number":1,"narration":"..."}]}\n\n' +
    JSON.stringify(payload);

  return {system, user, ocean: setting === 'ocean', quest, place, hero};
}

function extractJson(text) {
  const cleaned = String(text).replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in model reply');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function validate(parsed, scenes, prompt, errors = []) {
  if (!parsed || !Array.isArray(parsed.scenes)) throw new Error('missing scenes array');
  if (parsed.scenes.length !== scenes.length) {
    throw new Error(`expected ${scenes.length} scenes, got ${parsed.scenes.length}`);
  }

  const byNumber = new Map();
  for (const item of parsed.scenes) byNumber.set(Number(item && item.number), item);

  return scenes.map(scene => {
    try {
      return validateScene(byNumber.get(scene.number), scene, prompt);
    } catch (error) {
      errors.push(error.message);
      return null;
    }
  });
}

function validateScene(item, scene, prompt) {
  const ocean = Boolean(prompt && prompt.ocean);
  {
    if (!item) throw new Error(`scene ${scene.number} missing`);

    const text = typeof item.narration === 'string' ? item.narration.replace(/\s+/g, ' ').trim() : '';
    const words = wordCount(text);
    if (words < MIN_WORDS || words > MAX_WORDS) {
      throw new Error(`scene ${scene.number}: ${words} words (allowed ${MIN_WORDS}-${MAX_WORDS})`);
    }
    if (BANNED_ALWAYS.test(text)) throw new Error(`scene ${scene.number}: banned word`);
    if (ocean && BANNED_OCEAN.test(text)) throw new Error(`scene ${scene.number}: weather word underwater`);

    // The narration must mention something that is really in this picture. Compare
    // 4-letter word stems so "arches" matches "arch" and "crystals" matches "crystal".
    const lower = text.toLowerCase();
    const stems = scene._landmarks
      .flatMap(l => String(l).toLowerCase().split(/\s+/))
      .filter(w => w.length > 3)
      .map(w => w.slice(0, 4));
    if (!stems.some(stem => lower.includes(stem))) {
      throw new Error(`scene ${scene.number}: narration mentions nothing from this picture (${scene._landmarks.join(', ')})`);
    }

    // Concrete things that must not appear unless the picture (or the quest) really has them.
    const allowed = [
      ...scene._landmarks,
      (prompt.quest && prompt.quest.goal) || '',
      (prompt.quest && prompt.quest.object) || '',
      prompt.place || '',
    ]
      .join(' ')
      .toLowerCase();
    for (const word of text.toLowerCase().match(/[a-z]+/g) || []) {
      if (PROP_WORDS.has(word) && !allowed.includes(word.replace(/(es|s)$/, '').slice(0, 4))) {
        throw new Error(`scene ${scene.number}: mentions "${word}", which is not in this picture`);
      }
    }

    return text;
  }
}

async function callModel(prompt, client) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await client.send(
      new ConverseCommand({
        modelId: process.env.BEDROCK_MODEL_ID,
        system: [{text: prompt.system}],
        messages: [{role: 'user', content: [{text: prompt.user}]}],
        inferenceConfig: {maxTokens: 1500, temperature: 0.7},
      }),
      {abortSignal: controller.signal},
    );

    const blocks = (response.output && response.output.message && response.output.message.content) || [];
    const textBlock = blocks.find(block => typeof block.text === 'string');
    if (!textBlock) throw new Error('model reply had no text block');
    return textBlock.text;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {object} args
 * @param {Array}  args.scenes   scenes AFTER background matching (need backgroundId)
 * @param {string} args.hero     hero name
 * @param {string} args.place    world description from the recipe/place text
 * @param {string} args.setting  library setting ('ocean', 'garden', ...)
 * @param {object} [args.client] injectable client (tests)
 * @returns {{scenes: Array, source: 'bedrock'|'local', model: string|null, reason?: string, ms: number}}
 */
async function writeScenesWithBedrock({scenes, hero, place, setting, client}) {
  const started = Date.now();
  const local = reason => ({scenes, source: 'local', model: null, reason, ms: Date.now() - started});

  if (!client && !isEnabled()) return local('bedrock disabled (no BEDROCK_MODEL_ID or USE_BEDROCK=off)');

  try {
    const library = new Map(loadLibrary().map(image => [image.id, image]));

    const withLandmarks = scenes.map(scene => {
      const image = library.get(scene.backgroundId);
      const landmarks = image && Array.isArray(image.landmarks) ? image.landmarks : [];
      return {...scene, _landmarks: landmarks};
    });

    const missing = withLandmarks.find(scene => scene._landmarks.length === 0);
    if (missing) throw new Error(`scene ${missing.number} has no picture landmarks`);

    const prompt = buildPrompt({scenes: withLandmarks, hero, place, setting});

    let narrations = null;
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !narrations; attempt += 1) {
      try {
        const reply = await callModel(prompt, client || getClient());
        const errors = [];
        const result = validate(extractJson(reply), withLandmarks, prompt, errors);
        if (errors.length > MAX_BAD_SCENES) {
          throw new Error(`${errors.length} scenes failed validation: ${errors[0]}`);
        }
        if (errors.length) {
          console.warn(`[bedrock] ${errors.length} scene(s) kept local text: ${errors.join(' | ')}`);
        }
        narrations = result;
      } catch (error) {
        lastError = error;
        console.warn(`[bedrock] attempt ${attempt}/${MAX_ATTEMPTS} rejected: ${error.message}`);
      }
    }
    if (!narrations) throw lastError;

    const rewritten = scenes.map((scene, index) =>
      narrations[index]
        ? {...scene, narration: narrations[index], localNarration: scene.narration}
        : scene,
    );

    return {
      scenes: rewritten,
      source: 'bedrock',
      model: process.env.BEDROCK_MODEL_ID || 'injected-client',
      ms: Date.now() - started,
    };
  } catch (error) {
    console.warn(`[bedrock] falling back to local narration: ${error.message}`);
    return local(error.message);
  }
}

module.exports = {writeScenesWithBedrock, isEnabled, _internal: {buildPrompt, extractJson, validate}};

// Self-test against the real service: node bedrockStory.js
if (require.main === module) {
  (async () => {
    const {generateRecipeStory} = require('./recipeStory');
    const {matchStoryBackgrounds} = require('./backgroundMatcher');

    if (!process.env.BEDROCK_MODEL_ID) {
      console.error('Set BEDROCK_MODEL_ID first (see the CLI command in the instructions).');
      process.exit(1);
    }

    const world = process.argv[2] || 'coral_reef'; // e.g. coral_reef, enchanted_forest, moon_garden
    const libraryName = {moon_garden: 'garden', coral_reef: 'ocean'}[world] || world;
    const seed = process.argv[3] || 'selftest';
    const place = (PARTS.settings.find(item => item.id === world) || {}).place || 'a storybook world';
    const base = generateRecipeStory({genre: 'magical', seed, allowedSettings: [world]});
    const views = ['arrive', 'arrive', 'path', 'path', 'challenge', 'challenge', 'goal', 'celebrate'];
    const moods = ['curious', 'curious', 'exploration', 'exploration', 'tense', 'tense', 'hopeful', 'joyful'];
    const matched = matchStoryBackgrounds({
      ...base,
      scenes: base.scenes.map((s, i) => ({...s, librarySetting: libraryName, quest: base.recipe.quest, view: views[i], mood: moods[i]})),
    });
    console.log(`world=${world} quest=${base.recipe.quest}`);

    const result = await writeScenesWithBedrock({
      scenes: matched.scenes,
      hero: 'Little Hero',
      place,
      setting: libraryName,
    });
    const library = new Map(loadLibrary().map(image => [image.id, image]));

    console.log(`source=${result.source} model=${result.model} ms=${result.ms}`);
    if (result.reason) console.log('reason:', result.reason);
    for (const s of result.scenes) {
      const shows = (library.get(s.backgroundId) || {landmarks: []}).landmarks.join(', ');
      console.log(`\n#${s.number} [${s.backgroundId}] shows: ${shows}\n  ${s.narration}`);
    }
    process.exit(result.source === 'bedrock' ? 0 : 2);
  })();
}