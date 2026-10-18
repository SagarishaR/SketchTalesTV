
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC_DIR = path.join(__dirname, 'public');
const LIBRARY_DIR = path.join(PUBLIC_DIR, 'scenes', 'library');
const INDEX_PATH = path.join(LIBRARY_DIR, 'index.json');

let warnedAboutLibrary = false;

function loadLibrary() {
  try {
    if (!fs.existsSync(INDEX_PATH)) {
      if (!warnedAboutLibrary) {
        console.warn('[backgroundMatcher] Missing library index:', INDEX_PATH);
        warnedAboutLibrary = true;
      }
      return [];
    }

    const parsed = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    const entries = Array.isArray(parsed) ? parsed : parsed.images;

    if (!Array.isArray(entries)) {
      console.warn('[backgroundMatcher] index.json must contain an array of images.');
      return [];
    }

    return entries
      .map((entry) => {
        const relativePath = entry.path || entry.file || entry.url || '';
        const normalizedPath = relativePath
          .replace(/^\/+/, '')
          .replace(/^scenes\/library\//, '');

        const absolutePath = path.resolve(LIBRARY_DIR, normalizedPath);
        const libraryRoot = path.resolve(LIBRARY_DIR) + path.sep;

        // Only allow image files located inside the background library.
        if (!absolutePath.startsWith(libraryRoot)) return null;
        if (!/\.(png|jpe?g|webp)$/i.test(absolutePath)) return null;
        if (!fs.existsSync(absolutePath)) return null;

        return {
          ...entry,
          id: entry.id || path.parse(absolutePath).name,
          absolutePath,
          url: `/scenes/library/${path
            .relative(LIBRARY_DIR, absolutePath)
            .split(path.sep)
            .join('/')}`,
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error('[backgroundMatcher] Could not load image library:', error.message);
    return [];
  }
}

function scoreImage(image, scene) {
  let score = 0;

  if (scene.view && image.view === scene.view) score += 5;
  if (scene.mood && image.mood === scene.mood) score += 1;

  const sceneLandmarks = Array.isArray(scene.landmarks)
    ? scene.landmarks
    : [];

  const imageLandmarks = Array.isArray(image.landmarks)
    ? image.landmarks
    : [];

  const sharedLandmarks = sceneLandmarks.filter((landmark) =>
    imageLandmarks.includes(landmark)
  );

  score += sharedLandmarks.length * 2;

  return score;
}

function stableHash(value) {
  return crypto
    .createHash('sha256')
    .update(String(value))
    .digest('hex');
}

function matchBackground(scene, options = {}) {
  const setting = scene.librarySetting || scene.setting;
  if (!setting) return null;

  const usedIds = options.usedIds || new Set();

  const candidates = loadLibrary().filter((image) => {
    const imageSetting = image.setting || image.environment;
    return imageSetting === setting;
  });

  if (candidates.length === 0) {
    if (!warnedAboutLibrary) {
      console.warn(
        `[backgroundMatcher] No images found for setting "${setting}".`
      );
      warnedAboutLibrary = true;
    }
    return null;
  }

  const scored = candidates.map((image) => ({
    image,
    score: scoreImage(image, scene) - (usedIds.has(image.id) ? 3 : 0),
  }));

  const highestScore = Math.max(...scored.map((item) => item.score));

  const bestCandidates = scored
    .filter((item) => item.score >= highestScore - 1)
    .sort((a, b) => {
      const hashA = stableHash(`${scene.title || ''}:${a.image.id}`);
      const hashB = stableHash(`${scene.title || ''}:${b.image.id}`);
      return hashA.localeCompare(hashB);
    });

  const chosen = bestCandidates[0]?.image;
  if (!chosen) return null;

  return {
    backgroundId: chosen.id,
    backgroundUrl: chosen.url,
    floorY: Number.isFinite(chosen.floorY) ? chosen.floorY : 0.78,
  };
}

function matchStoryBackgrounds(story) {
  if (!story || !Array.isArray(story.scenes)) return story;

  const usedIds = new Set();

  const scenes = story.scenes.map((scene) => {
    const match = matchBackground(scene, { usedIds });

    if (!match) return scene;

    usedIds.add(match.backgroundId);

    return {
      ...scene,
      backgroundId: match.backgroundId,
      backgroundUrl: match.backgroundUrl,
      floorY: match.floorY,
    };
  });

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
