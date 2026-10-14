import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  },
  optimizeDeps: {
    entries: ['index.html']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('pdfjs-dist') || id.includes('jspdf') || id.includes('html2canvas')) {
              return 'pdf-engine';
            }
            if (id.includes('@supabase')) {
              return 'supabase-client';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
          }
        }
      }
    }
  }
});
