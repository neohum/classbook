import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'serve-local-books',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/book/')) {
            // Handle CORS preflight
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');

            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
              res.end();
              return;
            }

            // Vite dev server roots at viewer/, so ../book/...
            const decodedUrl = decodeURIComponent(req.url);
            const fileName = decodedUrl.replace('/book/', '');
            const filePath = path.join(process.cwd(), '..', 'book', fileName);

            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/pdf');
              const stream = fs.createReadStream(filePath);
              stream.pipe(res);
              return;
            } else {
              console.error(`[serve-local-books] File not found: ${filePath}`);
            }
          }
          next();
        });
      }
    }
  ],
  server: {
    port: 5173
  }
})
