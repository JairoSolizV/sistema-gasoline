import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // accesible desde otras máquinas del taller por IP local
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
