import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

export default defineConfig({
  root: path.join(__dirname, 'src', 'renderer'),
  define: {
    'import.meta.env.VITE_CONVEX_URL': JSON.stringify(
      process.env.VITE_CONVEX_URL || process.env.CONVEX_URL || ''
    ),
  },
  worker: {
    format: 'es',
  },
  build: {
    outDir: path.join(__dirname, 'dist', 'web'),
    emptyOutDir: true,
  },
});
