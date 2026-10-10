
const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const crypto = require('crypto');
const multer = require('multer');
const {processDrawing} = require('./imageProcessor');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_TTL = 10 * 60 * 1000;

app.use(cors());
app.use(express.json({limit: '10mb'}));
app.use(express.static('public'));

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

// Create a pairing session
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
    console.error('Pairing creation failed:', error);

    res.status(500).json({
      error: 'Could not create pairing session',
    });
  }
});

// Pair the phone with the TV
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

// Get pairing status
app.get('/api/pairing/:code', (req, res) => {
  const session = getValidSession(req.params.code, res);
  if (!session) return;

  res.json({
    code: session.code,
    status: session.status,
    mood: session.mood,
    hasDrawing: Boolean(session.drawing),
    hasCutout: Boolean(session.processedDrawing),
  });
});

// Upload a drawing and generate a transparent character PNG
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
      // Process with the local Python/OpenCV environment.
      const processedBuffer = await processDrawing(req.file.buffer);

      // Recheck the session after asynchronous processing.
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

      // Preserve the original image for the existing TV flow.
      session.drawing = {
        mimeType: req.file.mimetype,
        data: req.file.buffer.toString('base64'),
        uploadedAt: Date.now(),
      };

      // Store the transparent PNG separately.
      session.processedDrawing = {
        mimeType: 'image/png',
        data: processedBuffer.toString('base64'),
        uploadedAt: Date.now(),
      };

      return res.status(201).json({
        ok: true,
        message: 'Drawing received and character extracted',
        mimeType: session.drawing.mimeType,
        hasCutout: true,
      });
    } catch (error) {
      console.error('Character extraction failed:', error.message);

      return res.status(500).json({
        error: 'Could not process the drawing. Please try again.',
      });
    }
  },
);

// Retrieve the original drawing for the TV
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

// Retrieve the transparent character cutout
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

// Save the selected story mood
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


// Generate a deterministic five-scene story without external AI APIs.
app.post('/api/pairing/:code/story', (req, res) => {
  const session = getValidSession(req.params.code, res);
  if (!session) return;

  if (!session.drawing || !session.processedDrawing) {
    return res.status(409).json({
      error: 'Upload a drawing before creating a story',
    });
  }

  const genre = req.body?.genre;
  const allowedGenres = ['magical', 'funny', 'space', 'animals'];

  if (!allowedGenres.includes(genre)) {
    return res.status(400).json({
      error: 'Choose magical, funny, space, or animals',
    });
  }

  const hero = 'your little hero';

  const stories = {
    magical: {
      title: 'The Doorway of Dreams',
      scenes: [
        {
          number: 1,
          title: 'A Spark in the Garden',
          narration: `One quiet evening, ${hero} discovered a tiny golden light hiding beneath a leaf.`,
          visualPrompt: 'A moonlit garden with glowing flowers and floating golden sparkles.',
        },
        {
          number: 2,
          title: 'The Secret Path',
          narration: 'The light drifted away, revealing a secret path that had never been there before.',
          visualPrompt: 'A winding enchanted path between oversized flowers and luminous trees.',
        },
        {
          number: 3,
          title: 'The Lost Star',
          narration: 'At the end of the path, a little star was waiting. It had fallen from the night sky and could not find its way home.',
          visualPrompt: 'A tiny friendly star resting beside a sparkling stream under a deep blue sky.',
        },
        {
          number: 4,
          title: 'A Little Bit of Magic',
          narration: `${hero} helped the star climb onto a floating moonbeam. The whole garden began to shimmer.`,
          visualPrompt: 'A glowing moonbeam rising above a magical garden filled with soft golden light.',
        },
        {
          number: 5,
          title: 'The Sky Shines Again',
          narration: 'The star returned to its place in the sky. From that night on, one special star twinkled whenever the little hero looked up.',
          visualPrompt: 'A peaceful starry sky above the garden, with a warm magical glow surrounding the hero.',
        },
      ],
    },

    funny: {
      title: 'The Great Giggle Mix-Up',
      scenes: [
        {
          number: 1,
          title: 'A Very Strange Morning',
          narration: `${hero} woke up to discover that everything in the garden was making silly noises.`,
          visualPrompt: 'A cheerful garden where flowers, bushes, and garden tools look comically surprised.',
        },
        {
          number: 2,
          title: 'The Sneezing Fountain',
          narration: 'The fountain sneezed so hard that it sprayed water in the shape of a giant moustache.',
          visualPrompt: 'A whimsical fountain spraying water into a funny moustache shape.',
        },
        {
          number: 3,
          title: 'The Wiggly Mystery',
          narration: 'A trail of wiggly footprints led to a bush that would not stop giggling.',
          visualPrompt: 'A round leafy bush shaking with laughter, with silly footprints on the path.',
        },
        {
          number: 4,
          title: 'The Surprise Inside',
          narration: `${hero} peeked behind the bush and found a tiny creature tickling the roots with a feather.`,
          visualPrompt: 'A tiny friendly creature holding a feather behind a playful garden bush.',
        },
        {
          number: 5,
          title: 'Everybody Laughs',
          narration: 'Soon the entire garden was laughing together. Even the fountain made one last tiny hiccup.',
          visualPrompt: 'A joyful garden celebration with friendly creatures and little water splashes.',
        },
      ],
    },

    space: {
      title: 'The Little Star Explorer',
      scenes: [
        {
          number: 1,
          title: 'A Rocket of Their Own',
          narration: `${hero} discovered a little rocket parked beside a hill, with a button glowing on its dashboard.`,
          visualPrompt: 'A friendly small rocket parked on a grassy hill beneath a star-filled sky.',
        },
        {
          number: 2,
          title: 'Up Among the Stars',
          narration: 'Whoosh! The rocket carried the little hero past the clouds and into the sparkling universe.',
          visualPrompt: 'A colorful rocket flying past fluffy clouds into a vibrant starry universe.',
        },
        {
          number: 3,
          title: 'The Planet of Rings',
          narration: 'A tiny planet with beautiful rings appeared ahead. Someone there was waving for help.',
          visualPrompt: 'A whimsical pastel planet with rings, floating rocks, and a tiny welcoming alien.',
        },
        {
          number: 4,
          title: 'A Cosmic Delivery',
          narration: `${hero} helped a friendly space creature return a missing moon crystal to its home.`,
          visualPrompt: 'A friendly alien receiving a glowing crystal beside a little space station.',
        },
        {
          number: 5,
          title: 'Home Before Bedtime',
          narration: 'With a pocket full of stardust and a head full of memories, the little explorer flew home beneath the moon.',
          visualPrompt: 'A little rocket returning toward Earth, with a bright moon and twinkling stars.',
        },
      ],
    },

    animals: {
      title: 'The Forest Friendship',
      scenes: [
        {
          number: 1,
          title: 'A Rustle in the Leaves',
          narration: `${hero} wandered into a peaceful forest and heard a tiny squeak from beneath a fern.`,
          visualPrompt: 'A sunny woodland with giant ferns, mushrooms, and a mysterious rustling bush.',
        },
        {
          number: 2,
          title: 'A New Friend',
          narration: 'A little rabbit popped out. It had been looking everywhere for its family.',
          visualPrompt: 'A small friendly rabbit peeking from a fern in a warm, colorful woodland.',
        },
        {
          number: 3,
          title: 'Following the Clues',
          narration: 'Together, they followed soft pawprints past a babbling brook and a sleepy turtle.',
          visualPrompt: 'A woodland trail crossing a gentle stream, with a sleepy turtle and tiny pawprints.',
        },
        {
          number: 4,
          title: 'The Family Clearing',
          narration: `${hero} and the rabbit reached a sunny clearing where a family of rabbits was waiting.`,
          visualPrompt: 'A sunny forest clearing where several friendly rabbits gather near flowers.',
        },
        {
          number: 5,
          title: 'Friends Forever',
          narration: 'The little rabbit was home again. Before leaving, it gave the hero a flower as a reminder of their new friendship.',
          visualPrompt: 'A warm forest farewell with friendly animals, colorful flowers, and golden sunlight.',
        },
      ],
    },
  };

  const story = {
    id: `${session.code}-${Date.now()}`,
    genre,
    title: stories[genre].title,
    heroImageAvailable: Boolean(session.processedDrawing),
    scenes: stories[genre].scenes,
    generatedAt: Date.now(),
    mode: 'mock',
  };

  session.genre = genre;
  session.story = story;

  return res.status(201).json(story);
});

// Return upload and request errors as JSON
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
