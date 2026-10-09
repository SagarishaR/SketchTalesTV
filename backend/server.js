
const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const crypto = require('crypto');
const multer = require('multer');

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
  });
});

// Upload a child's drawing from the phone
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
  (req, res) => {
    const session = sessions.get(req.params.code);

    // Check again in case the session expired during upload.
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

    session.drawing = {
      mimeType: req.file.mimetype,
      data: req.file.buffer.toString('base64'),
      uploadedAt: Date.now(),
    };

    res.status(201).json({
      ok: true,
      message: 'Drawing received',
      mimeType: session.drawing.mimeType,
    });
  },
);

// Retrieve the uploaded drawing for the TV
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
