const {narrate} = require('./narrate');
const {generateRecipeStory} = require('./recipeStory');
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

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
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

// Create a pairing session.
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

// Pair the phone with the TV.
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

// Get pairing status.
app.get('/api/pairing/:code', (req, res) => {
  const session = getValidSession(req.params.code, res);
  if (!session) return;

  res.json({
    code: session.code,
    status: session.status,
    mood: session.mood,
    hasDrawing: Boolean(session.drawing),
    hasCutout: Boolean(session.processedDrawing),
    hasStory: Boolean(session.story),
  });
});

// Upload a drawing and generate a transparent character PNG.
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

      // A new drawing invalidates any previous story.
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

// Retrieve the original drawing.
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

// Retrieve the transparent character cutout.
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

// Save the selected story mood.
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

// Generate a five-scene local story without calling Bedrock.
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
      : 'little hero';

  const allowedGenres = ['magical', 'funny', 'space', 'animals'];

  if (!allowedGenres.includes(genre)) {
    return res.status(400).json({
      error: 'Choose magical, funny, space, or animals',
    });
  }

  try {
    const exclude = Array.isArray(req.body?.exclude)
      ? req.body.exclude.filter(
          (hash) => typeof hash === 'string' && /^[a-f0-9]{40}$/.test(hash)
        ).slice(-200)
      : [];

    const generated = generateRecipeStory({
      genre,
      characterName,
      seed: session.code,
      exclude: [...new Set([
        ...(session.recentRecipeHashes || []),
        ...exclude,
      ])],
    });

    session.recentRecipeHashes = [
      ...(session.recentRecipeHashes || []),
      generated.recipe.hash,
    ].slice(-200);

    const scenes = await Promise.all(
      generated.scenes.map(async (scene) => {
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
      mode: 'local',
    };

    session.genre = genre;
    session.story = story;

    res.status(201).json(story);
  } catch (error) {
    console.error('Story generation failed:', error.message);

    res.status(500).json({
      error: 'Could not generate the story',
      detail: error.message,
    });
  }
});

// Receive gesture commands from the paired phone.
app.post('/api/pairing/:code/gesture', express.json(), (req, res) => {
  const session = getValidSession(req.params.code, res);
  if (!session) return;

  if (!session.story) {
    return res.status(409).json({
      error: 'Gestures are available when the story is ready',
    });
  }

  const allowedGestures = ['open_palm', 'swipe_left', 'swipe_right', 'thumbs_up'];
  const { gesture } = req.body || {};

  if (!allowedGestures.includes(gesture)) {
    return res.status(400).json({ error: 'Invalid gesture' });
  }

  session.lastGesture = {
    gesture,
    timestamp: Date.now(),
  };

  console.log(`Gesture received for ${session.code}: ${gesture}`);
  res.json({ ok: true });
});

// Let the TV check for a new gesture.
app.get('/api/pairing/:code/gesture', (req, res) => {
  const session = getValidSession(req.params.code, res);
  if (!session) return;

  const gesture = session.lastGesture || null;
  session.lastGesture = null;

  res.json({ gesture });
});

// Return upload and request errors as JSON.
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
    error: 'An unexpected server error occurred',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SketchTales pairing API listening on port ${PORT}`);
});