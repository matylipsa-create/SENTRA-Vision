import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      external: [
        '@tensorflow-models/coco-ssd',
        '@tensorflow/tfjs',
        'tesseract.js',
      ],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
