'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC_DIR = path.join(__dirname, 'public');
const LIBRARY_DIR = path.join(PUBLIC_DIR, 'scenes', 'library');
const INDEX_PATH = path.join(LIBRARY_DIR, 'index.json');

let warnedAboutLibrary = false;
const warnedFiles = new Set();
const warnedSettings = new Set();

function normalizePath(value) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^scenes\/library\//, '');
}

function loadLibrary() {
  try {
    if (!fs.existsSync(INDEX_PATH)) {
      if (!warnedAboutLibrary) {
        console.warn(
          '[backgroundMatcher] Missing library index:',
          INDEX_PATH,
        );
        warnedAboutLibrary = true;
      }

      return [];
    }

    const parsed = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    const entries = Array.isArray(parsed)
      ? parsed
      : parsed.images;

    if (!Array.isArray(entries)) {
      console.error(
        '[backgroundMatcher] index.json must contain an array of images.',
      );
      return [];
    }

    const libraryRoot = path.resolve(LIBRARY_DIR);
    const validEntries = [];

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;

      const relativePath = normalizePath(
        entry.path || entry.file || entry.url || '',
      );

      if (!relativePath) continue;

      const absolutePath = path.resolve(LIBRARY_DIR, relativePath);

      // Prevent paths from escaping the library directory.
      if (
        absolutePath !== libraryRoot &&
        !absolutePath.startsWith(libraryRoot + path.sep)
      ) {
        console.warn(
          '[backgroundMatcher] Ignoring unsafe image path:',
          relativePath,
        );
        continue;
      }

      if (!/\.(png|jpe?g|webp)$/i.test(absolutePath)) {
        continue;
      }

      if (!fs.existsSync(absolutePath)) {
        if (!warnedFiles.has(absolutePath)) {
          console.warn(
            '[backgroundMatcher] Missing background file:',
            relativePath,
          );
          warnedFiles.add(absolutePath);
        }

        continue;
      }

      let stat;

      try {
        stat = fs.statSync(absolutePath);
      } catch {
        continue;
      }

      if (!stat.isFile()) continue;

      const id =
        entry.id ||
        path.parse(absolutePath).name;

      validEntries.push({
        ...entry,
        id,
        setting: entry.setting || entry.environment || '',
        view: entry.view || '',
        mood: entry.mood || '',
        landmarks: Array.isArray(entry.landmarks)
          ? entry.landmarks
          : [],
        absolutePath,
        url:
          '/scenes/library/' +
          path.relative(LIBRARY_DIR, absolutePath)
            .split(path.sep)
            .join('/'),
      });
    }

    return validEntries;
  } catch (error) {
    console.error(
      '[backgroundMatcher] Could not load image library:',
      error.message,
    );

    return [];
  }
}

function stableHash(value) {
  return crypto
    .createHash('sha256')
    .update(String(value))
    .digest('hex');
}

function scoreImage(image, scene) {
  let score = 0;

  const sceneSetting = scene.librarySetting || scene.setting;
  const imageSetting = image.setting || image.environment;

  // A background from another world must never be selected.
  if (imageSetting !== sceneSetting) {
    return Number.NEGATIVE_INFINITY;
  }

  // Match the scene's camera/view type.
  if (scene.view && image.view === scene.view) {
    score += 10;
  } else if (scene.view && image.view) {
    score -= 3;
  }

  // Match the scene's mood.
  if (scene.mood && image.mood === scene.mood) {
    score += 3;
  }

  // Prefer backgrounds containing relevant story landmarks.
  const sceneLandmarks = Array.isArray(scene.landmarks)
    ? scene.landmarks
    : [];

  const imageLandmarks = Array.isArray(image.landmarks)
    ? image.landmarks
    : [];

  const imageLandmarkSet = new Set(imageLandmarks);

  for (const landmark of sceneLandmarks) {
    if (imageLandmarkSet.has(landmark)) {
      score += 4;
    }
  }

  // If the scene has a specific requested background ID, prefer it.
  if (
    scene.backgroundId &&
    image.id === scene.backgroundId
  ) {
    score += 20;
  }

  return score;
}

function matchBackground(scene, options = {}) {
  if (!scene || typeof scene !== 'object') {
    return null;
  }

  const setting = scene.librarySetting || scene.setting;

  if (!setting) {
    console.warn(
      '[backgroundMatcher] Scene has no librarySetting or setting:',
      scene.title || scene.number || '(untitled scene)',
    );

    return null;
  }

  const usedIds = options.usedIds || new Set();
  const salt = options.salt || '';

  const candidates = loadLibrary().filter((image) => {
    const imageSetting = image.setting || image.environment;
    if (imageSetting !== setting) return false;

    // Pictures tagged onlyFor are used only in stories with one of those quests
    // (e.g. a treasure chest picture only for treasure-style quests).
    if (Array.isArray(image.onlyFor) && image.onlyFor.length > 0) {
      return image.onlyFor.includes(scene.quest);
    }

    return true;
  });

  if (candidates.length === 0) {
    if (!warnedSettings.has(setting)) {
      console.warn(
        `[backgroundMatcher] No usable background images for "${setting}". ` +
        `Check index.json and the actual image files in ${LIBRARY_DIR}.`,
      );

      warnedSettings.add(setting);
    }

    return null;
  }

  const scored = candidates.map((image) => {
    let score = scoreImage(image, scene);

    // Prefer an unused image when possible.
    if (usedIds.has(image.id)) {
      score -= 100;
    }

    return { image, score };
  });

  const unused = scored.filter(
    item => !usedIds.has(item.image.id),
  );

  // Exhaust unused backgrounds before reusing one.
  const pool = unused.length > 0 ? unused : scored;

  const highestScore = Math.max(
    ...pool.map(item => item.score),
  );

  const bestCandidates = pool
    .filter(item => item.score === highestScore)
    .sort((a, b) => {
      const hashA = stableHash(
        `${salt}:${scene.number || scene.title || ''}:${a.image.id}`,
      );

      const hashB = stableHash(
        `${salt}:${scene.number || scene.title || ''}:${b.image.id}`,
      );

      return hashA.localeCompare(hashB);
    });

  const chosen = bestCandidates[0]?.image;

  if (!chosen) return null;

  return {
    backgroundId: chosen.id,
    backgroundUrl: chosen.url,
    backgroundLandmarks: [...chosen.landmarks],
    backgroundView: chosen.view,
    backgroundMood: chosen.mood,
    floorY: Number.isFinite(chosen.floorY)
      ? chosen.floorY
      : 0.78,
  };
}

function matchStoryBackgrounds(story) {
  if (!story || !Array.isArray(story.scenes)) {
    return story;
  }

  const usedIds = new Set();

  const salt =
    (story.recipe && story.recipe.hash) ||
    story.seed ||
    story.title ||
    '';

  const scenes = story.scenes.map((scene, index) => {
    const match = matchBackground(scene, {
      usedIds,
      salt: `${salt}:${index}`,
    });

    if (!match) {
      console.warn(
        `[backgroundMatcher] No background assigned to scene ${index + 1}: ` +
        `${scene.title || '(untitled)'}; setting=${scene.librarySetting || scene.setting || 'missing'}`,
      );

      return {
        ...scene,
        backgroundId: null,
        backgroundUrl: null,
      };
    }

    usedIds.add(match.backgroundId);

    return {
      ...scene,
      backgroundId: match.backgroundId,
      backgroundUrl: match.backgroundUrl,
      floorY: match.floorY,
    };
  });

  const matchedCount = scenes.filter(
    scene => Boolean(scene.backgroundUrl),
  ).length;

  console.log(
    `[backgroundMatcher] Matched ${matchedCount}/${scenes.length} story backgrounds.`,
  );

  return {
    ...story,
    scenes,
  };
}

module.exports = {
  loadLibrary,
  matchBackground,
  matchStoryBackgrounds,
};