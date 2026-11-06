/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgWasm = path.resolve(here, '../node_modules/@mediapipe/tasks-vision/wasm');
const publicWasm = path.resolve(here, '../public/mediapipe/tasks-vision/wasm');
const publicModelsDir = path.resolve(here, '../public/mediapipe/models');
const modelFilePath = path.join(publicModelsDir, 'face_landmarker.task');

const OFFICIAL_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

if (!fs.existsSync(pkgWasm)) {
  console.warn('[MediaPipe] package not installed; run npm install before starting the web app.');
  process.exit(0);
}

fs.rmSync(publicWasm, { recursive: true, force: true });
fs.mkdirSync(publicWasm, { recursive: true });
fs.cpSync(pkgWasm, publicWasm, { recursive: true });
console.log('[MediaPipe] bundled Tasks Vision WASM assets.');

fs.mkdirSync(publicModelsDir, { recursive: true });

async function ensureModelAsset() {
  let needDownload = true;
  if (fs.existsSync(modelFilePath)) {
    const stats = fs.statSync(modelFilePath);
    if (stats.size > 1000000) {
      needDownload = false;
      console.log(`[MediaPipe] face_landmarker.task model present (${(stats.size / (1024 * 1024)).toFixed(2)} MB).`);
    }
  }

  if (needDownload) {
    console.log(`[MediaPipe] Downloading face_landmarker.task model asset...`);
    try {
      const res = await fetch(OFFICIAL_MODEL_URL);
      if (!res.ok) {
        throw new Error(`HTTP status ${res.status}: ${res.statusText}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(modelFilePath, buffer);
      console.log(`[MediaPipe] Downloaded and saved face_landmarker.task (${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`);
    } catch (err) {
      console.warn('[MediaPipe] Failed to download face_landmarker model (can be downloaded later):', err.message);
      // Do not hard fail development server if offline or network issue
    }
  }
}

await ensureModelAsset();
