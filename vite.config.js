import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/hilo-finanzas/',
  plugins: [react()],
  // Espeja `paths` de tsconfig.json para que el código nuevo importe `@/shared/...`
  // en vez de encadenar `../../..` desde el fondo de una feature.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // `test/` es la suite de regresión pre-refactor (no se toca); `src/` lleva
    // los tests nuevos, colocados junto a la feature que prueban.
    include: ['test/**/*.test.{js,jsx}', 'src/**/*.test.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/test/**', 'src/main.jsx'],
    },
  },
});
