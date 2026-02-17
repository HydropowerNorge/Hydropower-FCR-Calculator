import { defineConfig } from 'vite';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

export default defineConfig({
  define: {
    'process.env.CONVEX_URL': JSON.stringify(process.env.CONVEX_URL || ''),
  },
  build: {
    rollupOptions: {
      external: ['exceljs']
    }
  }
});
