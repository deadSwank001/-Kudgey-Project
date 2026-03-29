# Kudgey Project

> **Combining JavaScript, SolidWorks, and OpenCV**

A Node.js web application that bridges SolidWorks CAD models with OpenCV-powered image analysis, all written in JavaScript.

---

## Features

| Feature | Description |
|---------|-------------|
| **SolidWorks Model Parser** | Upload STL or OBJ files exported from SolidWorks; get geometry statistics (vertex count, face count, solid name). |
| **OpenCV Image Analysis** | Upload any image to compute pixel statistics (min, max, mean, stdDev) and a 256-bucket intensity histogram on the server. |
| **Client-side Edge Detection** | OpenCV.js runs Canny edge detection directly in the browser — no server round-trip required. |
| **RGB → Grayscale** | Convert any RGB colour to its ITU-R BT.601 grayscale equivalent via a REST endpoint or the web UI. |
| **SolidWorks PDM REST client** | Thin JavaScript client for the SolidWorks PDM Web API (list vaults, search files, download files). |

---

## Project structure

```
kudgey-project/
├── server.js                   # Express server & REST API
├── src/
│   ├── solidworks.js           # STL/OBJ parser + PDM REST client
│   └── opencv-processor.js     # Server-side image-processing helpers
├── public/
│   ├── index.html              # Single-page web UI
│   ├── style.css               # Styles
│   └── app.js                  # Client-side JS (uses OpenCV.js)
├── tests/
│   ├── solidworks.test.js
│   ├── opencv-processor.test.js
│   └── server.test.js
└── package.json
```

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18

### Installation

```bash
npm install
```

### Run the server

```bash
npm start
# → http://localhost:3000
```

For live-reload during development:

```bash
npm run dev
```

### Run tests

```bash
npm test
```

---

## REST API

### `GET /api/status`

Health-check endpoint.

```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z" }
```

---

### `POST /api/solidworks/parse`

Upload a SolidWorks-exported **STL** or **OBJ** file.

- **Content-Type:** `multipart/form-data`
- **Field:** `model` (file)

**Example response**

```json
{
  "summary": { "name": "MyPart", "vertexCount": 1200, "faceCount": 400 },
  "raw": { ... }
}
```

---

### `POST /api/opencv/analyze`

Upload an image to compute pixel statistics.

- **Content-Type:** `multipart/form-data`
- **Field:** `image` (file — PNG / JPEG / BMP)

**Example response**

```json
{
  "stats": { "min": 0, "max": 255, "mean": 127.3, "stdDev": 74.1 },
  "histogram": [0, 2, 5, ...]
}
```

---

### `POST /api/opencv/grayscale`

Convert an RGB colour to grayscale (ITU-R BT.601).

- **Content-Type:** `application/json`
- **Body:** `{ "r": 128, "g": 64, "b": 32 }`

**Example response**

```json
{ "r": 128, "g": 64, "b": 32, "gray": 83 }
```

---

## SolidWorks PDM integration

Set the following environment variables to point the built-in PDM client at your PDM server:

| Variable | Description |
|---|---|
| `SWPDM_BASE_URL` | Base URL of the PDM Web API, e.g. `http://myserver/api/v1` |
| `SWPDM_TOKEN` | Bearer token (omit if auth is not required) |

```js
const { SolidWorksPDMClient } = require('./src/solidworks');
const client = new SolidWorksPDMClient();
const vaults = await client.listVaults();
```

---

## License

MIT
