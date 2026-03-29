/**
 * OpenCV image-processing module (server-side helpers).
 *
 * These utilities operate on image metadata and pixel data using
 * pure JavaScript so that the module can run without native bindings.
 * For full OpenCV acceleration, replace the stubs below with calls to
 * the `@u4/opencv4nodejs` package (optional peer dependency).
 */

'use strict';

// ---------------------------------------------------------------------------
// Color / pixel helpers
// ---------------------------------------------------------------------------

/**
 * Convert an RGB triple to a grayscale intensity value using the
 * standard luminosity formula (ITU-R BT.601).
 *
 * @param {number} r - Red channel [0–255].
 * @param {number} g - Green channel [0–255].
 * @param {number} b - Blue channel [0–255].
 * @returns {number} Grayscale intensity [0–255].
 */
function rgbToGray(r, g, b) {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

/**
 * Apply a simple 3×3 mean-blur kernel to a flat RGBA pixel buffer.
 *
 * This is a pure-JS reference implementation.  When
 * `@u4/opencv4nodejs` is available it can be swapped for a native blur.
 *
 * @param {Uint8ClampedArray|Buffer} data - Flat RGBA pixel data (width × height × 4 bytes).
 * @param {number} width  - Image width in pixels.
 * @param {number} height - Image height in pixels.
 * @returns {Buffer} Blurred RGBA pixel data.
 */
function applyMeanBlur(data, width, height) {
  const out = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const idx = (ny * width + nx) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          a += data[idx + 3];
          count++;
        }
      }

      const outIdx = (y * width + x) * 4;
      out[outIdx]     = Math.round(r / count);
      out[outIdx + 1] = Math.round(g / count);
      out[outIdx + 2] = Math.round(b / count);
      out[outIdx + 3] = Math.round(a / count);
    }
  }

  return out;
}

/**
 * Detect edges using a simple Sobel operator on a grayscale image.
 *
 * @param {Uint8ClampedArray|Buffer} grayData - Single-channel (grayscale) pixel data.
 * @param {number} width  - Image width in pixels.
 * @param {number} height - Image height in pixels.
 * @param {number} [threshold=50] - Gradient magnitude threshold.
 * @returns {Buffer} Binary edge map (0 or 255 per pixel), single-channel.
 */
function detectEdges(grayData, width, height, threshold = 50) {
  const out = Buffer.alloc(width * height, 0);

  const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const ky = [-1, -2, -1,  0,  0,  0,  1,  2,  1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;

      for (let ky_i = 0; ky_i < 3; ky_i++) {
        for (let kx_i = 0; kx_i < 3; kx_i++) {
          const px = grayData[(y + ky_i - 1) * width + (x + kx_i - 1)];
          gx += px * kx[ky_i * 3 + kx_i];
          gy += px * ky[ky_i * 3 + kx_i];
        }
      }

      const mag = Math.sqrt(gx * gx + gy * gy);
      out[y * width + x] = mag >= threshold ? 255 : 0;
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Image metadata helpers
// ---------------------------------------------------------------------------

/**
 * Compute basic statistics for a flat grayscale pixel buffer.
 *
 * @param {Uint8ClampedArray|Buffer} grayData - Single-channel pixel data.
 * @returns {{ min: number, max: number, mean: number, stdDev: number }}
 */
function computeImageStats(grayData) {
  let min = 255, max = 0, sum = 0;

  for (let i = 0; i < grayData.length; i++) {
    const v = grayData[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }

  const mean = sum / grayData.length;
  let variance = 0;

  for (let i = 0; i < grayData.length; i++) {
    const diff = grayData[i] - mean;
    variance += diff * diff;
  }

  return {
    min,
    max,
    mean: parseFloat(mean.toFixed(4)),
    stdDev: parseFloat(Math.sqrt(variance / grayData.length).toFixed(4)),
  };
}

/**
 * Build a 256-bucket intensity histogram for a grayscale image.
 *
 * @param {Uint8ClampedArray|Buffer} grayData - Single-channel pixel data.
 * @returns {number[]} Array of 256 counts.
 */
function buildHistogram(grayData) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < grayData.length; i++) {
    hist[grayData[i]]++;
  }
  return hist;
}

module.exports = { rgbToGray, applyMeanBlur, detectEdges, computeImageStats, buildHistogram };
