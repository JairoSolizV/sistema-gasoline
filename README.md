# Sistema de Pagos del Taller de Confección (Fase 1)

Panel web administrativo **local** que calcula cuánto pagar a cada operario según lo que costuró, y consolida los pagos por semana y mes cruzándolos con anticipos. Moneda: Bolivianos (Bs), siempre 2 decimales (internamente, **enteros en centavos**).

- Documentos de negocio y reglas: [`/docs`](docs) (fuente de verdad).
- Plan de trabajo por rebanadas: [`docs/PLAN_IMPLEMENTACION.md`](docs/PLAN_IMPLEMENTACION.md).
- Arquitectura: [`docs/ARQUITECTURA_TALLER.md`](docs/ARQUITECTURA_TALLER.md).

## Estructura

```
/shared   tipos DTO + esquemas Zod + formateo de dinero (compartidos front/back)
/server   API Express + Prisma + PostgreSQL (dominio puro en src/domain)
/client   panel React (se scaffoldea en la Rebanada 2)
```

## Requisitos

- Node.js 22+
- PostgreSQL (una instalación local **o** Docker Desktop usando el compose incluido)

## Puesta en marcha (desarrollo)

1. **Base de datos.** Con PostgreSQL local ya instalado no hay que hacer nada.
   Sin Postgres local: `docker compose up -d postgres` (queda en el puerto **5433**).
2. **Variables de entorno.** Copiar `server/.env.example` a `server/.env` y completar
   `DATABASE_URL` y `DATABASE_URL_TEST` (con el compose:
   `postgresql://taller:taller@localhost:5433/taller_pagos?schema=public`).
   Crear la BD de test si no existe: `CREATE DATABASE taller_pagos_test;`
3. **Dependencias.** En la raíz: `npm install`.
4. **Migrar y seedear.** En `server/`:
   ```
   npx prisma migrate dev
   npx prisma db seed
   ```
   El seed carga `docs/seed_datos_taller.json` (operarios, configuración y los 5
   modelos reales) y **valida** que las sumas de CT den 8.10 / 5.97 / 7.68 / 6.29 / 7.18 Bs.
   Es idempotente: se puede re-ejecutar sin duplicar datos.
5. **Levantar la API.** En `server/`: `npm run dev` → `http://localhost:3001/api/v1/health`.
   El server escucha en `0.0.0.0`: las demás máquinas del taller acceden por la IP local del equipo servidor.
6. **Levantar el panel.** En `client/`: `npm run dev` → `http://localhost:5173`.
   El panel proxya `/api` hacia la API local, así que basta abrir el navegador.

## Tests

```
cd server
npm test
```

Usa `DATABASE_URL_TEST`: migra y seedea la BD de test automáticamente antes de la suite.
Los tests están nombrados por criterio de aceptación (`ca-1.test.ts` ↔ CA-1.1/CA-1.2 de
`docs/CRITERIOS_ACEPTACION_TALLER.md`).

## Estado (rebanadas)

- [x] **Rebanada 1 — Base**: monorepo, schema Prisma (centavos), migración, seed validado, health.
- [x] **Rebanada 2 — Operarios**: API CRUD con baja lógica + panel React (layout del mockup, tabla y formularios).
- [x] **Rebanada 3 — Modelos y versiones**: catálogo con suma de CT, versionado que conserva el original.
- [x] **Rebanada 4 — Cortes + Asignación**: snapshot inmutable, asignación híbrida con suma exacta, maestro externo, cierre con fecha de liquidación.
- [x] **Rebanada 5 — Anticipos**: registro con advertencia de tope (no bloqueo), histórico por semana, editar/eliminar.
- [x] **Rebanada 6 — Liquidación**: consolidado mensual con saldo y arrastre, cierre de mes persistido con excepción de arrastre, planilla imprimible.
- [ ] Rebanada 7 — Rendición de cuentas
- [ ] Rebanada 8 — Dashboard + Configuración + auth
