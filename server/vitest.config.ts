import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['tests/global-setup.ts'],
    // los tests de integración comparten la BD de test seedeada; sin paralelismo
    // entre archivos para evitar carreras sobre los mismos datos
    fileParallelism: false,
  },
});
