'use strict';

const request = require('supertest');
const app = require('../server');
const path = require('path');
const fs = require('fs');
const os = require('os');

function writeTmp(name, content) {
  const p = path.join(os.tmpdir(), name);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

// ---------------------------------------------------------------------------
// GET /api/status
// ---------------------------------------------------------------------------
describe('GET /api/status', () => {
  test('returns 200 with ok status', async () => {
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/opencv/grayscale
// ---------------------------------------------------------------------------
describe('POST /api/opencv/grayscale', () => {
  test('converts white to 255', async () => {
    const res = await request(app)
      .post('/api/opencv/grayscale')
      .send({ r: 255, g: 255, b: 255 });
    expect(res.status).toBe(200);
    expect(res.body.gray).toBe(255);
  });

  test('converts black to 0', async () => {
    const res = await request(app)
      .post('/api/opencv/grayscale')
      .send({ r: 0, g: 0, b: 0 });
    expect(res.status).toBe(200);
    expect(res.body.gray).toBe(0);
  });

  test('returns 400 for out-of-range value', async () => {
    const res = await request(app)
      .post('/api/opencv/grayscale')
      .send({ r: 300, g: 0, b: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('returns 400 for missing values', async () => {
    const res = await request(app)
      .post('/api/opencv/grayscale')
      .send({ r: 10 });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/solidworks/parse – STL
// ---------------------------------------------------------------------------
describe('POST /api/solidworks/parse – STL', () => {
  const stlContent = `solid Part1
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 0 1 0
    endloop
  endfacet
endsolid Part1`;

  let stlPath;
  beforeAll(() => { stlPath = writeTmp('api_test.stl', stlContent); });
  afterAll(() => fs.existsSync(stlPath) && fs.unlinkSync(stlPath));

  test('returns 200 with model summary', async () => {
    const res = await request(app)
      .post('/api/solidworks/parse')
      .attach('model', stlPath, { filename: 'api_test.stl', contentType: 'application/octet-stream' });
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.name).toBe('Part1');
    expect(res.body.summary.faceCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/solidworks/parse – OBJ
// ---------------------------------------------------------------------------
describe('POST /api/solidworks/parse – OBJ', () => {
  const objContent = `# test
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;

  let objPath;
  beforeAll(() => { objPath = writeTmp('api_test.obj', objContent); });
  afterAll(() => fs.existsSync(objPath) && fs.unlinkSync(objPath));

  test('returns 200 with model summary', async () => {
    const res = await request(app)
      .post('/api/solidworks/parse')
      .attach('model', objPath, { filename: 'api_test.obj', contentType: 'application/octet-stream' });
    expect(res.status).toBe(200);
    expect(res.body.summary.vertexCount).toBe(3);
    expect(res.body.summary.faceCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/solidworks/parse – no file
// ---------------------------------------------------------------------------
describe('POST /api/solidworks/parse – no file', () => {
  test('returns 400', async () => {
    const res = await request(app).post('/api/solidworks/parse');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/opencv/analyze
// ---------------------------------------------------------------------------
describe('POST /api/opencv/analyze', () => {
  let imgPath;
  beforeAll(() => {
    // Tiny valid PNG (1×1 red pixel) in base64
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';
    imgPath = writeTmp('test.png', Buffer.from(pngBase64, 'base64'));
  });
  afterAll(() => fs.existsSync(imgPath) && fs.unlinkSync(imgPath));

  test('returns 200 with stats and histogram', async () => {
    const res = await request(app)
      .post('/api/opencv/analyze')
      .attach('image', imgPath, { filename: 'test.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
    expect(res.body.histogram).toHaveLength(256);
  });
});
