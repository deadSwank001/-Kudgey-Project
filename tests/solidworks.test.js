'use strict';

const { parseSTL, parseOBJ, summarizeModel } = require('../src/solidworks');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ---------------------------------------------------------------------------
// Helpers for writing temp files
// ---------------------------------------------------------------------------
function writeTmp(name, content) {
  const p = path.join(os.tmpdir(), name);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

// ---------------------------------------------------------------------------
// parseSTL
// ---------------------------------------------------------------------------
describe('parseSTL', () => {
  const stlContent = `solid TestSolid
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 0 1 0
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 0 0 0
      vertex 0 1 0
      vertex 0 0 1
    endloop
  endfacet
endsolid TestSolid`;

  let filePath;
  beforeAll(() => { filePath = writeTmp('test.stl', stlContent); });
  afterAll(() => fs.unlinkSync(filePath));

  test('parses solid name', () => {
    const result = parseSTL(filePath);
    expect(result.name).toBe('TestSolid');
  });

  test('returns correct number of facets', () => {
    const result = parseSTL(filePath);
    expect(result.facets).toHaveLength(2);
  });

  test('parses facet normals', () => {
    const result = parseSTL(filePath);
    expect(result.facets[0].normal).toEqual([0, 0, 1]);
    expect(result.facets[1].normal).toEqual([0, 1, 0]);
  });

  test('each facet has 3 vertices', () => {
    const result = parseSTL(filePath);
    for (const facet of result.facets) {
      expect(facet.vertices).toHaveLength(3);
    }
  });

  test('parses vertex coordinates correctly', () => {
    const result = parseSTL(filePath);
    expect(result.facets[0].vertices[0]).toEqual([0, 0, 0]);
    expect(result.facets[0].vertices[1]).toEqual([1, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// parseOBJ
// ---------------------------------------------------------------------------
describe('parseOBJ', () => {
  const objContent = `# OBJ exported from SolidWorks
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.0 1.0 0.0
v 0.0 0.0 1.0
f 1 2 3
f 1 2 4
`;

  let filePath;
  beforeAll(() => { filePath = writeTmp('test.obj', objContent); });
  afterAll(() => fs.unlinkSync(filePath));

  test('parses comments', () => {
    const result = parseOBJ(filePath);
    expect(result.comments).toContain('OBJ exported from SolidWorks');
  });

  test('returns correct vertex count', () => {
    const result = parseOBJ(filePath);
    expect(result.vertices).toHaveLength(4);
  });

  test('returns correct face count', () => {
    const result = parseOBJ(filePath);
    expect(result.faces).toHaveLength(2);
  });

  test('face indices are 0-based', () => {
    const result = parseOBJ(filePath);
    expect(result.faces[0]).toEqual([0, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// summarizeModel
// ---------------------------------------------------------------------------
describe('summarizeModel', () => {
  test('summarises STL result', () => {
    const model = {
      name: 'Part1',
      facets: [
        { normal: [0,0,1], vertices: [[0,0,0],[1,0,0],[0,1,0]] },
        { normal: [0,1,0], vertices: [[0,0,0],[0,1,0],[0,0,1]] },
      ],
    };
    const s = summarizeModel(model);
    expect(s.name).toBe('Part1');
    expect(s.faceCount).toBe(2);
    expect(s.vertexCount).toBe(6); // 2 facets × 3 vertices
  });

  test('summarises OBJ result', () => {
    const model = {
      vertices: [[0,0,0],[1,0,0],[0,1,0]],
      faces: [[0,1,2]],
      comments: [],
    };
    const s = summarizeModel(model);
    expect(s.vertexCount).toBe(3);
    expect(s.faceCount).toBe(1);
  });

  test('handles empty model gracefully', () => {
    const s = summarizeModel({});
    expect(s.name).toBe('Unknown');
    expect(s.vertexCount).toBe(0);
    expect(s.faceCount).toBe(0);
  });
});
