/**
 * SolidWorks integration module.
 *
 * Provides utilities for parsing exported SolidWorks files (STL/OBJ)
 * and communicating with the SolidWorks PDM REST API.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ---------------------------------------------------------------------------
// File parsers
// ---------------------------------------------------------------------------

/**
 * Parse an ASCII STL file exported from SolidWorks.
 *
 * @param {string} filePath - Absolute path to the .stl file.
 * @returns {{ name: string, facets: Array<{ normal: number[], vertices: number[][] }> }}
 */
function parseSTL(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).map(l => l.trim());

  const result = { name: '', facets: [] };
  let currentFacet = null;

  for (const line of lines) {
    if (line.startsWith('solid ')) {
      result.name = line.slice(6).trim();
    } else if (line.startsWith('facet normal ')) {
      const parts = line.split(/\s+/);
      currentFacet = {
        normal: [parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4])],
        vertices: [],
      };
    } else if (line.startsWith('vertex ')) {
      const parts = line.split(/\s+/);
      if (currentFacet) {
        currentFacet.vertices.push([
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3]),
        ]);
      }
    } else if (line === 'endfacet' && currentFacet) {
      result.facets.push(currentFacet);
      currentFacet = null;
    }
  }

  return result;
}

/**
 * Parse a Wavefront OBJ file exported from SolidWorks.
 *
 * @param {string} filePath - Absolute path to the .obj file.
 * @returns {{ vertices: number[][], faces: number[][], comments: string[] }}
 */
function parseOBJ(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  const result = { vertices: [], faces: [], comments: [] };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('# ')) {
      result.comments.push(line.slice(2));
    } else if (line.startsWith('v ')) {
      const parts = line.split(/\s+/);
      result.vertices.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (line.startsWith('f ')) {
      const parts = line.split(/\s+/).slice(1);
      // Support "f 1 2 3", "f 1/2 3/4 5/6", and "f 1//2 3//4 5//6" formats
      result.faces.push(parts.map(p => parseInt(p.split('/')[0], 10) - 1));
    }
  }

  return result;
}

/**
 * Return a summary of a parsed SolidWorks model.
 *
 * @param {{ name?: string, facets?: any[], vertices?: any[], faces?: any[] }} model
 * @returns {{ vertexCount: number, faceCount: number, name: string }}
 */
function summarizeModel(model) {
  return {
    name: model.name || 'Unknown',
    vertexCount: model.vertices ? model.vertices.length : (model.facets ? model.facets.length * 3 : 0),
    faceCount: model.faces ? model.faces.length : (model.facets ? model.facets.length : 0),
  };
}

// ---------------------------------------------------------------------------
// SolidWorks PDM REST API client
// ---------------------------------------------------------------------------

/**
 * Minimal client for the SolidWorks PDM Web API.
 *
 * Configuration is read from environment variables:
 *   SWPDM_BASE_URL   – Base URL of the PDM Web API (e.g. http://server/api/v1)
 *   SWPDM_TOKEN      – Bearer token (optional; omit if authentication is not required)
 */
class SolidWorksPDMClient {
  constructor({ baseUrl, token } = {}) {
    this.baseUrl = baseUrl || process.env.SWPDM_BASE_URL || '';
    this.token = token || process.env.SWPDM_TOKEN || '';
  }

  _headers() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  /**
   * List vaults available on the PDM server.
   * @returns {Promise<any[]>}
   */
  async listVaults() {
    const { data } = await axios.get(`${this.baseUrl}/vaults`, { headers: this._headers() });
    return data;
  }

  /**
   * Search for files in a vault.
   * @param {string} vault - Vault name.
   * @param {string} query - Search query string.
   * @returns {Promise<any[]>}
   */
  async searchFiles(vault, query) {
    const { data } = await axios.get(`${this.baseUrl}/vaults/${encodeURIComponent(vault)}/files`, {
      headers: this._headers(),
      params: { search: query },
    });
    return data;
  }

  /**
   * Download a file from the PDM vault.
   * @param {string} vault - Vault name.
   * @param {number} fileId - File ID.
   * @param {string} destPath - Local path to write the downloaded file.
   * @returns {Promise<void>}
   */
  async downloadFile(vault, fileId, destPath) {
    const response = await axios.get(
      `${this.baseUrl}/vaults/${encodeURIComponent(vault)}/files/${fileId}/content`,
      { headers: this._headers(), responseType: 'arraybuffer' }
    );
    fs.writeFileSync(destPath, Buffer.from(response.data));
  }
}

module.exports = { parseSTL, parseOBJ, summarizeModel, SolidWorksPDMClient };
