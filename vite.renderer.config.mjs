import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(__dirname, 'src', 'renderer'),
  build: {
    // Must be absolute — the Forge Vite plugin sets a relative outDir that
    // would otherwise resolve against the custom root (src/renderer) instead
    // of the project root, causing the renderer build to land in the wrong
    // directory and be missing from the packaged asar.
    outDir: path.join(__dirname, '.vite', 'renderer', 'main_window'),
  }
});
