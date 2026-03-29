'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const rateLimit = require('express-rate-limit');

const { parseSTL, parseOBJ, summarizeModel } = require('./src/solidworks');
const { rgbToGray, computeImageStats, buildHistogram } = require('./src/opencv-processor');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Express setup
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter(_req, file, cb) {
    const allowed = ['.stl', '.obj', '.png', '.jpg', '.jpeg', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  },
});

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/status
 * Health-check endpoint.
 */
app.get('/api/status', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /api/solidworks/parse
 * Upload a SolidWorks-exported STL or OBJ file and receive a model summary.
 *
 * multipart/form-data field: "model" (file)
 */
app.post('/api/solidworks/parse', uploadLimiter, upload.single('model'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Use field name "model".' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  let parsed;

  try {
    if (ext === '.stl') {
      parsed = parseSTL(req.file.path);
    } else if (ext === '.obj') {
      parsed = parseOBJ(req.file.path);
    } else {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `Unsupported model format: ${ext}` });
    }
  } catch (err) {
    fs.unlinkSync(req.file.path);
    return res.status(422).json({ error: 'Failed to parse file', details: err.message });
  }

  fs.unlinkSync(req.file.path);
  res.json({ summary: summarizeModel(parsed), raw: parsed });
});

/**
 * POST /api/opencv/analyze
 * Upload a PNG/JPEG image and receive pixel statistics and a histogram.
 *
 * multipart/form-data field: "image" (file)
 * Body (JSON, optional): { width: number, height: number }
 *
 * The image is treated as raw RGBA data when width & height are provided;
 * otherwise a simulated grayscale conversion is performed on a placeholder.
 */
app.post('/api/opencv/analyze', uploadLimiter, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Use field name "image".' });
  }

  // Read raw bytes and simulate grayscale statistics
  const imageBytes = fs.readFileSync(req.file.path);
  fs.unlinkSync(req.file.path);

  // Use raw byte values as a proxy for pixel intensities
  const grayData = Buffer.from(imageBytes);

  const stats = computeImageStats(grayData);
  const histogram = buildHistogram(grayData);

  res.json({ stats, histogram });
});

/**
 * POST /api/opencv/grayscale
 * Convert RGB values to grayscale.
 *
 * JSON body: { r: number, g: number, b: number }
 */
app.post('/api/opencv/grayscale', (req, res) => {
  const { r, g, b } = req.body;

  if ([r, g, b].some(v => typeof v !== 'number' || v < 0 || v > 255)) {
    return res.status(400).json({ error: 'r, g, b must be numbers in the range [0, 255].' });
  }

  const gray = rgbToGray(r, g, b);
  res.json({ r, g, b, gray });
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Kudgey Project server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
