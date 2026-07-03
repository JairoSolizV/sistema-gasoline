import { describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';

describe('GET /api/v1/health', () => {
  test('responde { data: { status: "ok" } }', async () => {
    const res = await request(crearApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
  });

  test('ruta inexistente responde error con forma estándar', async () => {
    const res = await request(crearApp()).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_ENCONTRADO');
    expect(typeof res.body.error.message).toBe('string');
  });
});
