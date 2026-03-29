'use strict';

const {
  rgbToGray,
  applyMeanBlur,
  detectEdges,
  computeImageStats,
  buildHistogram,
} = require('../src/opencv-processor');

// ---------------------------------------------------------------------------
// rgbToGray
// ---------------------------------------------------------------------------
describe('rgbToGray', () => {
  test('black is 0', () => expect(rgbToGray(0, 0, 0)).toBe(0));
  test('white is 255', () => expect(rgbToGray(255, 255, 255)).toBe(255));
  test('pure red', () => expect(rgbToGray(255, 0, 0)).toBe(76));   // round(0.299*255)
  test('pure green', () => expect(rgbToGray(0, 255, 0)).toBe(150)); // round(0.587*255)
  test('pure blue', () => expect(rgbToGray(0, 0, 255)).toBe(29));   // round(0.114*255)
  test('mixed colour', () => {
    const expected = Math.round(0.299 * 100 + 0.587 * 150 + 0.114 * 200);
    expect(rgbToGray(100, 150, 200)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// applyMeanBlur
// ---------------------------------------------------------------------------
describe('applyMeanBlur', () => {
  test('returns a buffer of the correct size', () => {
    const w = 4, h = 4;
    const data = Buffer.alloc(w * h * 4, 128);
    const out = applyMeanBlur(data, w, h);
    expect(out.length).toBe(w * h * 4);
  });

  test('uniform image stays uniform after blur', () => {
    const w = 5, h = 5;
    const data = Buffer.alloc(w * h * 4, 200);
    const out = applyMeanBlur(data, w, h);
    for (let i = 0; i < out.length; i++) {
      expect(out[i]).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// detectEdges
// ---------------------------------------------------------------------------
describe('detectEdges', () => {
  test('uniform image produces no edges', () => {
    const w = 10, h = 10;
    const gray = Buffer.alloc(w * h, 128);
    const edges = detectEdges(gray, w, h);
    expect(edges.every(v => v === 0)).toBe(true);
  });

  test('sharp vertical boundary produces edges', () => {
    const w = 10, h = 10;
    const gray = Buffer.alloc(w * h);
    // left half = 0, right half = 255
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        gray[y * w + x] = x < w / 2 ? 0 : 255;
      }
    }
    const edges = detectEdges(gray, w, h, 50);
    // There must be at least one edge pixel along the boundary
    expect(edges.some(v => v === 255)).toBe(true);
  });

  test('returns a buffer the same size as input', () => {
    const w = 6, h = 6;
    const gray = Buffer.alloc(w * h, 0);
    const edges = detectEdges(gray, w, h);
    expect(edges.length).toBe(w * h);
  });
});

// ---------------------------------------------------------------------------
// computeImageStats
// ---------------------------------------------------------------------------
describe('computeImageStats', () => {
  test('all-zero image', () => {
    const stats = computeImageStats(Buffer.alloc(100, 0));
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
    expect(stats.mean).toBe(0);
    expect(stats.stdDev).toBe(0);
  });

  test('all-255 image', () => {
    const stats = computeImageStats(Buffer.alloc(100, 255));
    expect(stats.min).toBe(255);
    expect(stats.max).toBe(255);
    expect(stats.mean).toBe(255);
    expect(stats.stdDev).toBe(0);
  });

  test('mixed values', () => {
    const data = Buffer.from([0, 100, 200]);
    const stats = computeImageStats(data);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(200);
    expect(stats.mean).toBeCloseTo(100, 2);
  });
});

// ---------------------------------------------------------------------------
// buildHistogram
// ---------------------------------------------------------------------------
describe('buildHistogram', () => {
  test('returns an array of 256 elements', () => {
    const hist = buildHistogram(Buffer.from([0, 128, 255]));
    expect(hist).toHaveLength(256);
  });

  test('counts are correct', () => {
    const data = Buffer.from([0, 0, 128, 255, 128]);
    const hist = buildHistogram(data);
    expect(hist[0]).toBe(2);
    expect(hist[128]).toBe(2);
    expect(hist[255]).toBe(1);
    expect(hist[1]).toBe(0);
  });

  test('sum of histogram equals total pixel count', () => {
    const data = Buffer.from(Array.from({ length: 500 }, (_, i) => i % 256));
    const hist = buildHistogram(data);
    const total = hist.reduce((s, c) => s + c, 0);
    expect(total).toBe(500);
  });
});
