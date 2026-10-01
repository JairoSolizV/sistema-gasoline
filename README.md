# Sistema de Pagos del Taller de Confección (Fase 1)

Panel web administrativo **local** que calcula cuánto pagar a cada operario según lo que costuró, y consolida los pagos por semana y mes cruzándolos con anticipos. Moneda: Bolivianos (Bs), siempre 2 decimales (internamente, **enteros en centavos**).

- Documentos de negocio y reglas: [`/docs`](docs) (fuente de verdad).
- Plan de trabajo por rebanadas: [`docs/PLAN_IMPLEMENTACION.md`](docs/PLAN_IMPLEMENTACION.md).
- Arquitectura: [`docs/ARQUITECTURA_TALLER.md`](docs/ARQUITECTURA_TALLER.md).

## Estructura

```
/shared   tipos DTO + esquemas Zod + formateo de dinero (compartidos front/back)
/server   API Express + Prisma + PostgreSQL (dominio puro en src/domain)
/client   panel React (Vite + Tailwind + TanStack Query)
```

## Requisitos

- Node.js 22+
- PostgreSQL (una instalación local **o** Docker Desktop usando el compose incluido)

## Opción A — Todo con Docker (recomendado para la máquina del taller)

Un solo comando levanta Postgres + API + panel, migra y seedea la base:

```
# definí antes ADMIN_PASSWORD y JWT_SECRET (o se usan valores por defecto de dev)
docker compose up --build
```

- Panel: `http://localhost:8080`
- API: `http://localhost:3001/api/v1`
- Las demás máquinas del taller acceden por la **IP local** del equipo servidor
  (ej. `http://192.168.1.20:8080`).

## Opción B — Desarrollo (Node local)

1. **Base de datos.** Con PostgreSQL local ya instalado no hay que hacer nada.
   Sin Postgres local: `docker compose up -d postgres` (queda en el puerto **5434**).
2. **Variables de entorno.** Copiar `server/.env.example` a `server/.env` y completar
   `DATABASE_URL`, `DATABASE_URL_TEST`, `ADMIN_PASSWORD` y `JWT_SECRET`.
   Crear la BD de test si no existe: `CREATE DATABASE taller_pagos_test;`
3. **Dependencias.** En la raíz: `npm install`.
4. **Migrar y seedear.** En `server/`:
   ```
   npx prisma migrate dev
   npx prisma db seed
   ```
   El seed carga `docs/seed_datos_taller.json` (operarios, configuración y los 5
   modelos reales) y **valida** que las sumas de CT den 8.10 / 5.97 / 7.68 / 6.29 / 7.18 Bs.
   Es idempotente: se puede re-ejecutar sin duplicar datos. Al cargar unifica las variantes con que el
   Excel escribe lo mismo (`server/prisma/normalizacion-equipos.ts`: DELANTERO/DELANTEROS, 3 pinza/pinza,
   entrep./entrep…, columnas invertidas), carga la **plantilla del pantalón clásico** (36 operaciones de la
   hoja "CLAS GSLN BJO" del Excel) y arma el **catálogo**: 11 máquinas, 63 procesos, 109 piezas, 8 grupos.
   Ojo: un número en el nombre de una operación (`corrida 2`, `3 pinzas`) es una segunda pasada o una
   cantidad, no el número de paso — nunca se unifica con la operación simple.

   Si ya tenías modelos cargados de antes del catálogo, podés armarlo aparte con
   `npm run catalogo:backfill` (también idempotente, no modifica ni borra nada).
5. **Levantar la API.** En `server/`: `npm run dev` → `http://localhost:3001/api/v1`.
   Escucha en `0.0.0.0` (acceso por IP local).
6. **Levantar el panel.** En `client/`: `npm run dev` → `http://localhost:5173`
   (proxya `/api` a la API local).

## Acceso

Un único administrador. La contraseña es `ADMIN_PASSWORD` (de `server/.env` o del compose).
El login devuelve un JWT que el panel guarda y envía en cada request; todas las rutas
`/api/v1` (salvo `health` y `auth/login`) exigen ese token.

## Tests

```
cd server
npm test
```

Usa `DATABASE_URL_TEST`: migra y seedea la BD de test automáticamente antes de la suite.
Los tests están nombrados por criterio de aceptación (`ca-1.test.ts`, `domain-*.test.ts`,
`cortes.test.ts`, `liquidacion.test.ts`, `rendicion.test.ts`, …) y cubren los 8 grupos de
`docs/CRITERIOS_ACEPTACION_TALLER.md`.

## Estado (rebanadas) — Fase 1 completa

- [x] **Rebanada 1 — Base**: monorepo, schema Prisma (centavos), migración, seed validado, health.
- [x] **Rebanada 2 — Operarios**: CRUD con baja lógica + panel React (layout del mockup).
- [x] **Rebanada 3 — Modelos y versiones**: catálogo con suma de CT, versionado que conserva el original.
- [x] **Rebanada 4 — Cortes + Asignación**: snapshot inmutable, asignación híbrida con suma exacta, maestro externo, cierre con fecha de liquidación.
- [x] **Rebanada 5 — Anticipos**: registro con advertencia de tope (no bloqueo), histórico por semana.
- [x] **Rebanada 6 — Liquidación**: consolidado mensual con saldo y arrastre, cierre de mes, planilla imprimible.
- [x] **Rebanada 7 — Rendición de cuentas**: vista filtrada por operario sin fuga de terceros, imprimible.
- [x] **Rebanada 8 — Dashboard + Configuración + auth**: KPIs y alertas, config editable, login JWT, docker-compose.
- [x] **Rebanada 9 — Catálogo Máquina → Proceso → Pieza**: catálogo jerárquico (+ grupos, que envuelven
  a las operaciones) que alimenta el alta de modelos con selectores en cascada, en vez de escribir los
  nombres a mano. **Renombrar** y **unir** entradas actualizan los modelos que las usaban, y nunca el
  snapshot de los cortes. Ver `docs/PLAN_CATALOGO_MAQUINAS.md`.
- [x] **Rebanada 10 — Plantillas de modelo**: recetas de operaciones (con CT de referencia editable) para crear un modelo
  sin cargar 36 filas a mano. Viene la del **pantalón clásico**, fija: se edita pero no se borra, y se
  duplica para armar variantes. Ver `docs/PLAN_PLANTILLAS.md`.
