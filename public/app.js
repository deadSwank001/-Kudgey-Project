/* global cv */
'use strict';

// ---------------------------------------------------------------------------
// OpenCV.js readiness
// ---------------------------------------------------------------------------
let cvReady = false;

function onOpenCvReady() {
  cvReady = true;
  document.getElementById('cv-edges-btn').disabled = !imageLoaded;
  console.log('OpenCV.js is ready.');
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let swFile = null;
let cvFile = null;
let imageLoaded = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function showResult(id, data, isError = false) {
  const el = document.getElementById(id);
  el.classList.remove('hidden', 'error');
  if (isError) el.classList.add('error');
  el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

async function postFile(url, fieldName, file) {
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(url, { method: 'POST', body: form });
  return res.json();
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// SolidWorks panel
// ---------------------------------------------------------------------------
const swFileInput  = document.getElementById('sw-file');
const swParseBtn   = document.getElementById('sw-parse-btn');
const swFileLabel  = document.querySelector('#sw-panel .file-label');

swFileInput.addEventListener('change', () => {
  swFile = swFileInput.files[0] || null;
  swFileLabel.textContent = swFile ? swFile.name : 'Choose STL / OBJ file';
  swParseBtn.disabled = !swFile;
});

swParseBtn.addEventListener('click', async () => {
  if (!swFile) return;
  swParseBtn.disabled = true;
  swParseBtn.textContent = 'Parsing…';
  try {
    const data = await postFile('/api/solidworks/parse', 'model', swFile);
    showResult('sw-result', data, !!data.error);
  } catch (err) {
    showResult('sw-result', `Network error: ${err.message}`, true);
  } finally {
    swParseBtn.disabled = false;
    swParseBtn.textContent = 'Parse Model';
  }
});

// ---------------------------------------------------------------------------
// OpenCV panel – file loading
// ---------------------------------------------------------------------------
const cvFileInput   = document.getElementById('cv-file');
const cvAnalyzeBtn  = document.getElementById('cv-analyze-btn');
const cvEdgesBtn    = document.getElementById('cv-edges-btn');
const cvFileLabel   = document.querySelector('#cv-panel .file-label');
const origCanvas    = document.getElementById('original-canvas');
const edgesCanvas   = document.getElementById('edges-canvas');

cvFileInput.addEventListener('change', () => {
  cvFile = cvFileInput.files[0] || null;
  cvFileLabel.textContent = cvFile ? cvFile.name : 'Choose image (PNG / JPEG)';

  if (!cvFile) {
    imageLoaded = false;
    cvAnalyzeBtn.disabled = true;
    cvEdgesBtn.disabled = true;
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      origCanvas.width  = img.width;
      origCanvas.height = img.height;
      origCanvas.getContext('2d').drawImage(img, 0, 0);
      imageLoaded = true;
      cvAnalyzeBtn.disabled = false;
      cvEdgesBtn.disabled = !cvReady;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(cvFile);
});

// ---------------------------------------------------------------------------
// Server-side analysis
// ---------------------------------------------------------------------------
cvAnalyzeBtn.addEventListener('click', async () => {
  if (!cvFile) return;
  cvAnalyzeBtn.disabled = true;
  cvAnalyzeBtn.textContent = 'Analyzing…';
  try {
    const data = await postFile('/api/opencv/analyze', 'image', cvFile);
    if (data.error) {
      showResult('cv-result', data.error, true);
    } else {
      const summary = {
        stats: data.stats,
        'histogram (first 16 buckets)': data.histogram.slice(0, 16),
      };
      showResult('cv-result', summary);
    }
  } catch (err) {
    showResult('cv-result', `Network error: ${err.message}`, true);
  } finally {
    cvAnalyzeBtn.disabled = false;
    cvAnalyzeBtn.textContent = 'Analyze on Server';
  }
});

// ---------------------------------------------------------------------------
// Client-side edge detection via OpenCV.js
// ---------------------------------------------------------------------------
cvEdgesBtn.addEventListener('click', () => {
  if (!cvReady || !imageLoaded) return;

  try {
    const src  = cv.imread(origCanvas);
    const gray = new cv.Mat();
    const edges = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.Canny(gray, edges, 50, 150);

    edgesCanvas.width  = origCanvas.width;
    edgesCanvas.height = origCanvas.height;
    cv.imshow(edgesCanvas, edges);

    src.delete();
    gray.delete();
    edges.delete();

    showResult('cv-result', 'Edge detection complete (Canny, thresholds 50/150). See canvas above.');
  } catch (err) {
    showResult('cv-result', `OpenCV error: ${err.message}`, true);
  }
});

// ---------------------------------------------------------------------------
// Grayscale converter
// ---------------------------------------------------------------------------
document.getElementById('gray-btn').addEventListener('click', async () => {
  const r = parseInt(document.getElementById('r-val').value, 10);
  const g = parseInt(document.getElementById('g-val').value, 10);
  const b = parseInt(document.getElementById('b-val').value, 10);

  try {
    const data = await postJSON('/api/opencv/grayscale', { r, g, b });
    if (data.error) {
      showResult('gray-result', data.error, true);
    } else {
      showResult('gray-result', `RGB(${data.r}, ${data.g}, ${data.b})  →  Gray: ${data.gray}`);
    }
  } catch (err) {
    showResult('gray-result', `Network error: ${err.message}`, true);
  }
});
