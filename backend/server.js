const {narrate} = require('./narrate');
const {generateRecipeStory, PARTS} = require('./recipeStory');
const {matchStoryBackgrounds} = require('./backgroundMatcher');
const {writeScenesWithBedrock} = require('./bedrockStory');
const {saveStoryRecord} = require('./awsStore');
const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const crypto = require('crypto');
const multer = require('multer');
const {processDrawing} = require('./imageProcessor');
const fs = require('fs/promises');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 3000;
const SESSION_TTL = 10 * 60 * 1000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const AUDIO_DIR = path.join(PUBLIC_DIR, 'audio');
const VIDEO_DIR = path.join(PUBLIC_DIR, 'videos');

app.use(cors());
app.use(express.json({limit: '10mb'}));
app.use('/audio', express.static(AUDIO_DIR));
app.use('/videos', express.static(VIDEO_DIR));
app.use(express.static(PUBLIC_DIR));
const AUDIO_MAX_AGE_MS = 60 * 60 * 1000;
const AUDIO_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

const PRESERVED_AUDIO_FILES = new Set([
  'sonican-children-piano-loop-gentle-care-351582.mp3',
]);

async function cleanupOldAudioFiles() {
  try {
    const files = await fs.readdir(AUDIO_DIR, {withFileTypes: true});
    const now = Date.now();

    for (const file of files) {
      if (!file.isFile()) continue;
      if (PRESERVED_AUDIO_FILES.has(file.name)) continue;
      if (!/\.(mp3|m4a|aiff|aif|wav)$/i.test(file.name)) continue;

      const filePath = path.join(AUDIO_DIR, file.name);
      const stats = await fs.stat(filePath);

      if (now - stats.mtimeMs > AUDIO_MAX_AGE_MS) {
        await fs.unlink(filePath);
        console.log(`[audio-cleanup] Deleted expired file: ${file.name}`);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[audio-cleanup] Cleanup failed:', error);
    }
  }
}

cleanupOldAudioFiles();
setInterval(cleanupOldAudioFiles, AUDIO_CLEANUP_INTERVAL_MS).unref();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 8 * 1024 * 1024},
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/jpeg', 'image/png'];

    if (!allowed.includes(file.mimetype)) {
      return callback(
        new Error('Only JPEG and PNG images are allowed'),
      );
    }

    callback(null, true);
  },
});

const sessions = new Map();


const LIBRARY_STORY_SETTINGS = [
  'moon_garden',
  'coral_reef',
  'dinosaur_valley',
  'enchanted_forest',
  'winter_village',
  'space_station',
  'toy_city',
  'cloud_kingdom',
  'icecream_valley',
  'fairy_village',
  'amusement_park',
];

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}


function shuffleSettings(settings) {
  const shuffled = [...settings];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function createSession() {
  let code;

  do {
    code = generateCode();
  } while (sessions.has(code));

  const session = {
    code,
    createdAt: Date.now(),
    status: 'waiting',
    drawing: null,
    processedDrawing: null,
    mood: null,
    story: null,
    recentRecipeHashes: [],

   
    worldQueue: shuffleSettings(LIBRARY_STORY_SETTINGS),
    usedWorlds: [],
  };

  sessions.set(code, session);
  return session;
}

function getValidSession(code, res) {
  const session = sessions.get(code);

  if (!session) {
    res.status(404).json({error: 'Pairing code not found'});
    return null;
  }

  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(code);
    res.status(410).json({error: 'Pairing code expired'});
    return null;
  }

  return session;
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'SketchTales TV pairing',
  });
});


app.post('/api/pairing', async (req, res) => {
  try {
    const session = createSession();
    const baseUrl = req.body?.phoneUrl;

    let pairingUrl;

    if (baseUrl) {
      const url = new URL(baseUrl);
      url.searchParams.set('code', session.code);
      pairingUrl = url.toString();
    } else {
      pairingUrl =
        `http://localhost:${PORT}/phone.html?code=${session.code}`;
    }

    const qrCode = await QRCode.toDataURL(pairingUrl);

    res.status(201).json({
      code: session.code,
      pairingUrl,
      qrCode,
      status: session.status,
      expiresInSeconds: 600,
    });
  } catch (error) {
    console.error('Pairing creation failed:', error.message);

    res.status(500).json({
      error: 'Could not create pairing session',
    });
  }
});


app.post('/api/pairing/:code/join', (req, res) => {
  const session = getValidSession(req.params.code, res);
  if (!session) return;

  session.status = 'paired';

  res.json({
    ok: true,
    code: session.code,
    status: session.status,
  });
});


app.get('/api/pairing/:code', (req, res) => {
  const session = getValidSession(req.params.code, res);
  if (!session) return;

  res.json({
    code: session.code,
    status: session.status,
    mood: session.mood,
    hasDrawing: Boolean(session.drawing),
    drawingUploadedAt: session.drawing?.uploadedAt ?? null,
    hasCutout: Boolean(session.processedDrawing),
    hasStory: Boolean(session.story),
  });
});

app.post(
  '/api/pairing/:code/drawing',
  (req, res, next) => {
    const session = getValidSession(req.params.code, res);
    if (!session) return;

    if (session.status !== 'paired') {
      return res.status(409).json({
        error: 'Pair the phone first',
      });
    }

    next();
  },
  upload.single('drawing'),
  async (req, res) => {
    const session = sessions.get(req.params.code);

    if (!session || Date.now() - session.createdAt > SESSION_TTL) {
      sessions.delete(req.params.code);

      return res.status(410).json({
        error: 'Pairing code expired',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Choose a JPEG or PNG image',
      });
    }

    try {
      const processedBuffer = await processDrawing(req.file.buffer);

      const currentSession = sessions.get(req.params.code);

      if (
        currentSession !== session ||
        Date.now() - session.createdAt > SESSION_TTL
      ) {
        sessions.delete(req.params.code);

        return res.status(410).json({
          error: 'Pairing code expired',
        });
      }

      session.drawing = {
        mimeType: req.file.mimetype,
        data: req.file.buffer.toString('base64'),
        uploadedAt: Date.now(),
      };

      session.processedDrawing = {
        mimeType: 'image/png',
        data: processedBuffer.toString('base64'),
        uploadedAt: Date.now(),
      };

      session.story = null;

      res.status(201).json({
        ok: true,
        message: 'Drawing received and character extracted',
        mimeType: session.drawing.mimeType,
        hasCutout: true,
      });
    } catch (error) {
      console.error('Character extraction failed:', error.message);

      res.status(500).json({
        error: 'Could not process the drawing. Please try again.',
      });
    }
  },
);

app.get('/api/pairing/:code/drawing', (req, res) => {
  const session = getValidSession(req.params.code, res);
  if (!session) return;

  if (!session.drawing) {
    return res.status(404).json({
      error: 'No drawing uploaded yet',
    });
  }

  res.json({
    mimeType: session.drawing.mimeType,
    data: session.drawing.data,
    uploadedAt: session.drawing.uploadedAt,
  });
});


app.get('/api/pairing/:code/cutout', (req, res) => {
  const session = getValidSession(req.params.code, res);
  if (!session) return;

  if (!session.processedDrawing) {
    return res.status(404).json({
      error: 'No processed character available yet',
    });
  }

  res.json({
    mimeType: session.processedDrawing.mimeType,
    data: session.processedDrawing.data,
    uploadedAt: session.processedDrawing.uploadedAt,
  });
});


app.post('/api/pairing/:code/mood', (req, res) => {
  const session = getValidSession(req.params.code, res);
  if (!session) return;

  const allowedMoods = ['magical', 'funny', 'adventure'];

  if (!allowedMoods.includes(req.body?.mood)) {
    return res.status(400).json({
      error: 'Mood must be magical, funny, or adventure',
    });
  }

  session.mood = req.body.mood;

  res.json({
    ok: true,
    mood: session.mood,
  });
});


app.post('/api/pairing/:code/story', async (req, res) => {
  const session = getValidSession(req.params.code, res);
  if (!session) return;

  if (!session.drawing || !session.processedDrawing) {
    return res.status(409).json({
      error: 'Upload a drawing before creating a story',
    });
  }

  const requestedGenre = req.body?.genre || session.mood;
  const genre = requestedGenre === 'adventure'
    ? 'animals'
    : requestedGenre;

  const characterName =
    typeof req.body?.characterName === 'string' &&
    req.body.characterName.trim()
      ? req.body.characterName.trim().slice(0, 60)
      : 'Little Hero';

  const allowedGenres = ['magical', 'funny', 'space', 'animals'];

  if (!allowedGenres.includes(genre)) {
    return res.status(400).json({
      error: 'Choose magical, funny, space, or animals',
    });
  }

  try {
    const exclude = Array.isArray(req.body?.exclude)
      ? req.body.exclude.filter(
          hash => typeof hash === 'string' && /^[a-f0-9]{40}$/.test(hash),
        ).slice(-200)
      : [];

    
    if (!Array.isArray(session.worldQueue) || session.worldQueue.length === 0) {
      session.worldQueue = shuffleSettings(LIBRARY_STORY_SETTINGS);
      session.usedWorlds = [];
    }

    const nextWorld = session.worldQueue[0];

    const generatedBase = generateRecipeStory({
      genre,
      characterName,
      allowedSettings: [nextWorld],
      avoidSettings: [],
      seed: `${session.code}:${nextWorld}:${(session.usedWorlds || []).length}`,
      exclude: [...new Set([
        ...(session.recentRecipeHashes || []),
        ...exclude,
      ])],
    });

   
    session.worldQueue.shift();
    session.usedWorlds = [
      ...(session.usedWorlds || []),
      generatedBase.recipe.setting,
    ];

    session.recentRecipeHashes = [
      ...(session.recentRecipeHashes || []),
      generatedBase.recipe.hash,
    ].slice(-200);

    session.lastSetting = generatedBase.recipe.setting;

    console.log(
      `[story] world=${generatedBase.recipe.setting} ` +
      `worldsUsed=${session.usedWorlds.length}/${LIBRARY_STORY_SETTINGS.length} ` +
      `quest=${generatedBase.recipe.quest} friend=${generatedBase.recipe.friend}`,
    );

   
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

  
    const sceneViews = [
      'arrive',
      'arrive',
      'path',
      'path',
      'challenge',
      'challenge',
      'goal',
      'celebrate',
    ];

    const sceneMoods = [
      'curious',
      'curious',
      'exploration',
      'exploration',
      'tense',
      'tense',
      'hopeful',
      'joyful',
    ];

    const storyForMatching = {
      ...generatedBase,
      scenes: generatedBase.scenes.map((scene, index) => ({
        ...scene,
        librarySetting: settingMap[generatedBase.recipe.setting] || null,
        view: sceneViews[index] || scene.view,
        mood: sceneMoods[index] || 'curious',
      })),
    };

    const generated = matchStoryBackgrounds(storyForMatching);

   
    const bedrock = await writeScenesWithBedrock({
      scenes: generated.scenes,
      hero: characterName,
      place:
        (PARTS.settings.find(item => item.id === generatedBase.recipe.setting) || {}).place ||
        'a storybook world',
      setting: settingMap[generatedBase.recipe.setting] || '',
    });

    console.log(
      `[narration] source=${bedrock.source} ms=${bedrock.ms}` +
      (bedrock.reason ? ` reason="${bedrock.reason}"` : ''),
    );

    const scenesWithGroundedNarration = bedrock.scenes;

    console.log(
      '[backgrounds]',
      generated.scenes.map(scene => ({
        number: scene.number,
        setting: scene.librarySetting,
        backgroundUrl: scene.backgroundUrl || null,
      })),
    );

    const scenes = await Promise.all(
      scenesWithGroundedNarration.map(async scene => {
        let audioUrl = null;

        try {
          audioUrl = await narrate(
            scene.narration,
            `${session.code}-scene-${scene.number}.aiff`,
          );
        } catch (error) {
          console.error(
            `Narration failed for scene ${scene.number}:`,
            error.message,
          );
        }

        return {...scene, audioUrl, videoUrl: null};
      }),
    );

    const story = {
      id: `${session.code}-${Date.now()}`,
      genre,
      title: generated.title,
      recipe: generated.recipe,
      seed: generated.seed,
      heroImageAvailable: Boolean(session.processedDrawing),
      scenes,
      generatedAt: Date.now(),
      mode: bedrock.source === 'bedrock' ? 'bedrock' : 'local',
      narrationSource: bedrock.source,
    };

    session.genre = genre;
    session.story = story;

    
    saveStoryRecord(story, {
      narrationSource: bedrock.source,
      model: bedrock.model,
      bedrockMs: bedrock.ms,
    });

    res.status(201).json(story);
  } catch (error) {
    console.error('Story generation failed:', error.message);

    res.status(500).json({
      error: 'Could not generate the story',
      detail: error.message,
    });
  }
});


app.post('/api/pairing/:code/gesture', express.json(), (req, res) => {
  const session = getValidSession(req.params.code, res);
  if (!session) return;

  if (!session.story) {
    return res.status(409).json({
      error: 'Gestures are available when the story is ready',
    });
  }

  const allowedGestures = [
    'open_palm',
    'swipe_left',
    'swipe_right',
    'thumbs_up',
  ];

  const {gesture} = req.body || {};

  if (!allowedGestures.includes(gesture)) {
    return res.status(400).json({error: 'Invalid gesture'});
  }

  session.lastGesture = {
    gesture,
    timestamp: Date.now(),
  };

  console.log(`Gesture received for ${session.code}: ${gesture}`);
  res.json({ok: true});
});


app.get('/api/pairing/:code/gesture', (req, res) => {
  const session = getValidSession(req.params.code, res);
  if (!session) return;

  const gesture = session.lastGesture || null;
  session.lastGesture = null;

  res.json({gesture});
});


app.use((error, _req, res, _next) => {
  console.error('Request error:', error.message);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'Image must be 8 MB or smaller',
      });
    }

    return res.status(400).json({
      error: 'Image upload failed. Please try again.',
    });
  }

  if (error.message === 'Only JPEG and PNG images are allowed') {
    return res.status(400).json({
      error: error.message,
    });
  }

  res.status(500).json({
    error: 'An unexpected error occurred',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SketchTales pairing API listening on port ${PORT}`);
});