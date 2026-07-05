// Rebanada 8 — auth. Se prueba con la app en modo authObligatoria:true
// (el resto de tests corren sin auth). Verifica login y protección de rutas.
import { describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';

const app = crearApp({ authObligatoria: true });
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin-taller';

describe('POST /api/v1/auth/login', () => {
  test('con la contraseña correcta devuelve un token', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ password: PASSWORD });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.rol).toBe('admin');
  });

  test('con la contraseña incorrecta responde 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ password: 'incorrecta' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('CREDENCIALES');
  });
});

describe('rutas protegidas', () => {
  test('sin token → 401', async () => {
    const res = await request(app).get('/api/v1/operarios');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_AUTORIZADO');
  });

  test('con token válido → 200', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ password: PASSWORD });
    const res = await request(app)
      .get('/api/v1/operarios')
      .set('Authorization', `Bearer ${login.body.data.token}`);
    expect(res.status).toBe(200);
  });

  test('con token basura → 401', async () => {
    const res = await request(app)
      .get('/api/v1/operarios')
      .set('Authorization', 'Bearer no-es-un-token');
    expect(res.status).toBe(401);
  });

  test('health y login quedan públicos aun con auth activa', async () => {
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
    const login = await request(app).post('/api/v1/auth/login').send({ password: PASSWORD });
    expect(login.status).toBe(200);
  });
});
