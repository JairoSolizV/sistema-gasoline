# Plan de Implementación — Sistema de Pagos del Taller (Fase 1)

> **Para agentes:** este plan se ejecuta **rebanada por rebanada**, en orden, con verificación de criterios de aceptación (CA-*) al final de cada una y **confirmación del dueño antes de pasar a la siguiente**. Las casillas `[ ]` se marcan a medida que se avanza.
>
> **Objetivo:** panel web administrativo local que calcula cuánto pagar a cada operario según lo que costuró, y consolida pagos por semana/mes cruzándolos con anticipos. Moneda: Bolivianos (Bs), 2 decimales.
>
> **Arquitectura** (según `docs/ARQUITECTURA_TALLER.md`): monolito modular en **monorepo** (`server` + `client` + `shared`). Backend Express+Prisma+PostgreSQL en capas controller → service → repository, con **núcleo de dominio puro** (`/domain`: funciones de pago/saldo sin Express ni Prisma). API REST **`/api/v1`** con validación Zod y DTOs (nunca modelos Prisma crudos). Frontend React (Vite) **delgado**, organizado por features. Dinero como **enteros en centavos de punta a punta** (BD incluida). Ejecución local con docker-compose.
>
> **Fuente de verdad:** los documentos de `/docs` (`CLAUDE.md` + `ARQUITECTURA_TALLER.md` + modelo de datos + criterios). Ante conflicto código vs. documento, gana el documento.

---

## 1. Alcance de la Fase 1

### Incluido
- **Operarios**: CRUD con baja lógica (`activo=false`), tipo `regular` / `maestro_externo`.
- **Modelos**: catálogo con **versiones** (versionar = copiar; la anterior queda intacta), operaciones con CT, suma de CT visible.
- **Cortes**: creación con modelo+versión, desglose por talla (referencia) y PLUS (**se paga**), snapshot inmutable de operaciones (`CorteOperacion`) **en transacción**, máquina de estados `borrador → abierto → cerrado`.
- **Asignación híbrida**: por grupo completo (botón rápido) o por operación puntual, dividida hasta en **3 operarios**, con **validación de suma exacta** en vivo y diferencial de maestro externo (+0.10 editable por asignación).
- **Anticipos**: registro libre con **advertencia** (no bloqueo) al superar el tope configurable; varios por semana.
- **Liquidación**: consolidado semanal (lunes–sábado) y mensual por operario, agrupado por `fecha_cierre` de cortes **cerrados**; saldo con arrastre; **cierre de mes** a 0 con excepción `arrastra_saldo`, persistido **en transacción**.
- **Rendición de cuentas**: DTO construido en el service con datos de **un solo** operario — sin fuga de terceros ni en la UI ni en el payload.
- **Dashboard** (cortes activos, KPIs del período, alertas) y **Configuración** (tope de anticipo, diferencial, datos del taller).
- **Auth mínima**: JWT con un único admin; middleware `requireAuth` + `requireRole` previsto para Fase 2 (solo se usa `admin`).
- **Seed** con los datos reales de `docs/seed_datos_taller.json`.
- **docker-compose** local (Postgres + server + client) para levantar todo con un comando.

### Explícitamente FUERA (no construir, aunque parezca útil)
- Rol operario / login de operarios / app móvil (Fase 2).
- Importar/exportar cortes desde Excel (Fase 2).
- Gestión de alimentación u otros costos del taller (no afecta pagos — CA-8.4 solo verifica su ausencia).
- Multiusuario / roles complejos (solo queda el *hook* `requireRole`).
- Despliegue en la nube.
- Anti-patrones de ARQUITECTURA §11: Redux, microservicios, colas, CQRS, event-sourcing, cálculos en controllers o componentes React, modelos Prisma crudos al cliente, escrituras multi-fila sin transacción.

---

## 2. Stack y estructura de carpetas

**Stack** (ARQUITECTURA §10):

| Capa | Elección |
|---|---|
| Monorepo | `server` + `client` + `shared` (tipos DTO + esquemas Zod compartidos) |
| Backend | Node.js + Express + TypeScript; módulos con controller/service/repository + dominio puro |
| ORM / BD | Prisma + PostgreSQL; transacciones; integridad en BD (`@@unique`, checks) |
| Dinero | **centavos enteros** en BD, dominio y API (ver §5.11) |
| API | REST `/api/v1` + validación Zod + DTOs; errores con forma estándar |
| Auth | JWT admin único; `requireAuth` + `requireRole` previsto |
| Frontend | React (Vite) + Tailwind + TanStack Query, organizado por features, cliente delgado |
| Formularios | react-hook-form + Zod (esquemas de `shared`) |
| Testing | Vitest (unit en dominio puro) + Supertest (integración de endpoints críticos); casi nada de E2E |
| Ejecución | docker-compose local (Postgres + server + client) |

**Estructura** (ARQUITECTURA §1, §2.3, §7.1):

```
/docs                        # documentos + seed + este plan (no modificar sin avisar)
/Mockup Sistema taller confección   # mockup Claude Design (referencia visual)
/docker-compose.yml          # postgres + server + client
/shared
  /src
    dtos/                    # tipos DTO por módulo
    schemas/                 # esquemas Zod (validación compartida front/back)
    money.ts                 # formateo centavos → "Bs 1 234.56" (presentación)
/server
  /prisma
    schema.prisma            # Anexo B ajustado: montos Int en centavos (ver §6)
    seed.ts                  # carga docs/seed_datos_taller.json
  /src
    /modules                 # operarios, modelos, cortes, anticipos, liquidacion,
                             #   rendicion, configuracion, auth, dashboard
                             #   cada uno: controller.ts, service.ts, repository.ts, routes.ts
    /domain                  # FUNCIONES PURAS (no conocen Express ni Prisma)
      calculo.ts             #   cantidadTotal, tarifaEfectiva, totalAsignacion
      saldo.ts               #   calcularSaldo, calcularCierreMes, semanas del mes
      validaciones.ts        #   validarSumaExacta, máx. 3, puedeCerrarCorte
    /lib
      money.ts               # centavos ↔ Bs, redondeo half-up una sola vez
      prisma.ts              # cliente Prisma
    /middleware
      auth.ts                # requireAuth, requireRole
      validate.ts            # middleware Zod
      errors.ts              # errores centralizados: { data } / { error: { code, message } }
    app.ts
    server.ts                # escucha en 0.0.0.0 (acceso por IP local del taller)
  /tests                     # nombrados por CA (ca-1.1.test.ts, ...)
/client
  /src
    /features                # inicio, operarios, modelos, cortes (incluye asignación),
                             #   anticipos, liquidacion, rendicion, configuracion, auth
    /components              # UI reutilizable (sidebar, tablas, badges, moneda)
    /api                     # cliente HTTP + hooks de TanStack Query
    /lib                     # formateo de dinero para mostrar (usa shared)
    router.tsx
README.md                    # cómo levantar todo en la máquina del taller
```

**Mockup como base visual:** sidebar oscuro (`#111820`) con secciones General/Producción/Sistema, acento azul `#2f6fe0`, tipografía IBM Plex Sans (números tabulares con Plex Mono), badges de estado (verde "Cuadra", rojo "Faltan/Sobran", gris "Sin asignar"), KPIs en tarjetas, alertas en el dashboard. Se replica su estructura de pantallas en React+Tailwind. **Mejoras sobre el mockup** (ver §6): datos reales del seed en vez de los de muestra, cálculo en centavos en vez de floats, y validaciones del lado servidor (el mockup solo valida en UI).

---

## 3. Convenciones de trabajo (todas las rebanadas)

- **La regla de oro** (ARQUITECTURA §2.2): toda la matemática de pago y saldo vive en funciones puras de `/domain`. Controllers sin lógica de negocio; services orquestan; solo repositories tocan Prisma.
- **TDD en el dominio y la API**: primero el test del CA, verlo fallar, implementar, verlo pasar.
- **DTOs siempre**: el service arma lo que sale al cliente; nunca se serializa un modelo Prisma crudo (crítico para CA-7.x).
- **Transacciones**: snapshot del corte y cierre de mes son `prisma.$transaction`; cualquier escritura multi-fila dependiente también.
- **Front delgado**: el cliente muestra y valida UX. Única excepción legítima: la suma en vivo en la pantalla de asignación para el feedback verde/rojo instantáneo — lo que se persiste lo confirma el backend.
- Commits frecuentes, uno por paso con sentido (el repo se inicializa en la Rebanada 1).
- Al terminar cada rebanada: correr **todos** los tests (regresión), marcar casillas de este plan, mostrar resumen y **esperar OK del dueño**.

---

## 4. Rebanadas verticales

### Rebanada 1 — Base: monorepo + esquema Prisma + migración + seed

**Entrega:** monorepo armado (server/client/shared), docker-compose con Postgres, BD migrada con el esquema del Anexo B **ajustado a centavos enteros** (§6), middleware base (errores, validación Zod), seed que carga `docs/seed_datos_taller.json` (operarios, configuración, modelos v1 con sus operaciones) y verificación automática de las sumas de CT. Sin UI todavía (solo `GET /api/v1/health`).

**CAs que cubre:** CA-1.1, CA-1.2 (sumas de CT: 8.10, 5.97, 7.68, 6.29, 7.18).

- [x] `git init` + `.gitignore` (node_modules, .env, dist) + commit inicial con docs y plan.
- [x] Monorepo con workspaces: `shared/` (tipos + Zod + `money.ts` de presentación), `server/`, `client/` (placeholder; se scaffoldea en R2). `.env.example` con `DATABASE_URL`, `DATABASE_URL_TEST`, `ADMIN_PASSWORD`, `JWT_SECRET`.
- [x] `docker-compose.yml` con el servicio **postgres** (server y client se agregan al compose en R8; en desarrollo corren con `npm run dev`). *En desarrollo se usa el PostgreSQL 18 local ya instalado (5432); el compose expone 5433 para no chocar.*
- [x] `prisma/schema.prisma` según Anexo B con estos **ajustes documentados** (§6): todos los montos como `Int` en **centavos** (`ct`, `diferencial`, `tarifaEfectiva`, `total`, `monto`, `costoManoObraPrenda`, `saldo*`, `pagado`, `topeAnticipoAdvertencia`, `diferencialMaestroExterno`); `Operacion.n String?` y `CorteOperacion.n String?` (el seed trae 3 operaciones con `n: null`). *Ajuste extra: `Modelo.nombre @unique` para el upsert idempotente del seed.*
- [x] `prisma migrate dev` — migración inicial aplicada (`20260703234528_init`).
- [x] `shared/src/money.ts` (re-usada por el server): `aCentavos("8.10"|8.1) → 810` con redondeo **half-up una sola vez** en la frontera de entrada, `formatBs(810) → "8.10"`. Con 9 tests unitarios (incluye negativos −256.40 ↔ −25640 y trampas de float como 1.005).
- [x] Middleware base: `errors.ts` (forma estándar `{ data }` / `{ error: { code, message } }`) y `validate.ts` (Zod contra esquemas de `shared`).
- [x] `prisma/seed.ts`: carga el JSON → `Configuracion` (tope 200000, diferencial 10, en centavos), 13 operarios (regulares, activos), 5 modelos con `ModeloVersion` v1 y sus `Operacion` (orden, grupo, n, equipo, proceso, pieza, ct en centavos). Coerciones: `pieza` numérica → string (caso `pieza: 2`), `n: null` → null. Normalización de `equipo` con mapa explícito (`over/overloc/overlock → overlock`, `rect → recta`, `Plancha → plancha`, `recta+pres` se conserva). `costoManoObraPrenda` = Σ ct en centavos. El seed **valida al final** que las sumas den 810/597/768/629/718 y falla ruidosamente si no.
- [x] Seed **idempotente** (verificado con doble ejecución sobre la BD de desarrollo: la segunda omite y re-valida).
- [x] Test `ca-1.1` y `ca-1.2`: leer de la BD seedeada y verificar suma de CT por modelo = 810, 597, 768, 629, 718 centavos y que `black DOBLE PRET 06` tenga 47 operaciones. *La suite corre contra `DATABASE_URL_TEST` (global-setup migra y seedea solo).*
- [x] `app.ts`/`server.ts` mínimos con `GET /api/v1/health` y el middleware de errores montado (smoke test: HTTP 200).
- [x] Actualizar README (levantar Postgres, migrar, seedear) y marcar casillas.

> Nota: el seed **no** crea cortes. Las cantidades por talla del JSON (372, 234, 174) quedan como fixture de tests y para crear cortes reales desde la UI en la Rebanada 4.

### Rebanada 2 — Operarios (CRUD + baja lógica)

**Entrega:** módulo `operarios` completo (controller/service/repository + DTOs + Zod en `shared`) + scaffold del cliente por features (Vite, Tailwind, TanStack Query, react-hook-form, router, layout con sidebar del mockup) + página "Operarios".

**CAs que cubre:** CA-8.2 (parte: baja = `activo=false` + `fecha_baja`, nunca DELETE; la conservación de histórico se re-verifica en R4/R6).

- [x] Scaffold `client/` (Vite + React + TS + Tailwind 4 + TanStack Query + react-hook-form + Router) con layout: sidebar fijo (Inicio, Operarios, Modelos, Cortes, Anticipos, Liquidación, Rendición de cuentas, Configuración) según mockup; estructura `/features`. *Proxy `/api` → :3001; `host: true` para acceso por IP local.*
- [x] `shared`: DTO `OperarioDTO` + esquemas Zod de alta/edición (reusados por el form y el middleware).
- [x] API `modules/operarios`: `GET /api/v1/operarios` (filtro activo/todos), `POST /api/v1/operarios`, `GET /api/v1/operarios/:id`, `PATCH /api/v1/operarios/:id` (edición y **baja lógica**: `activo=false` fija `fechaBaja`; reactivar la limpia). **Sin DELETE físico.**
- [x] Tests de integración: alta, edición, baja lógica (el registro sigue existiendo y consultable), reactivación (12 tests; TDD rojo→verde).
- [x] Feature Operarios: tabla (nombre, tipo, estado, fecha ingreso), formulario de alta/edición (react-hook-form + Zod de `shared`), acción de baja con confirmación; inactivos atenuados con filtro. *Verificado en navegador: alta y baja desde la UI contra la API real.*
- [x] Regresión completa (31/31 tests + typecheck) + marcar casillas + resumen al dueño.

### Rebanada 3 — Modelos y versiones

**Entrega:** módulo `modelos`: lista con versiones, detalle con operaciones agrupadas por grupo y **suma de CT siempre visible**, crear modelo con operaciones, editar operaciones de una versión, **crear nueva versión** (duplicado editable).

**CAs que cubre:** CA-1.1, CA-1.2 (suma visible en UI, recalculada al editar), CA-1.3 (versionar conserva el original).

- [ ] `shared`: DTOs de modelo/versión/operación + esquemas Zod.
- [ ] API `modules/modelos`: `GET /api/v1/modelos` (con versiones), `POST /api/v1/modelos` (nombre + operaciones → crea v1), `GET /api/v1/versiones/:id` (detalle con operaciones), `PATCH /api/v1/versiones/:id/operaciones` (alta/edición/borrado de operaciones), `POST /api/v1/modelos/:id/versiones` (copia todas las operaciones de la versión origen → vN+1, la origen queda intacta; transaccional).
- [ ] `costoManoObraPrenda` se recalcula **en el service, en centavos**, en cada mutación de operaciones.
- [ ] Test `ca-1.3`: crear v2 de DOBLE PRET, quitar una operación de CT 0.20 → v2 = 790 centavos y v1 sigue en 810.
- [ ] Tests: crear modelo suma bien; editar CT recalcula; unicidad `(modelo, numero_version)`.
- [ ] Feature Modelos: lista (nombre, versiones, costo/prenda); detalle de versión con operaciones por grupo (orden, N, equipo, proceso, pieza, CT) y suma de CT en cabecera; formularios de operación; botón "Crear nueva versión" con nota.
- [ ] Regresión completa + marcar casillas + resumen al dueño.

### Rebanada 4 — Cortes + Asignación (la pantalla estrella) ⚠️ la más riesgosa

**Entrega:** ciclo completo del corte: crear (borrador) → abrir (snapshot transaccional) → asignar (híbrido, hasta 3 operarios, suma exacta) → cerrar (fecha de cierre). UI del detalle de corte según mockup: grupos plegables, badges "Cuadra/Faltan X/Sobran X", pago por asignación y total por operario en vivo, botón cerrar habilitado solo con todo `asignada`.

**CAs que cubre:** CA-1.4, CA-2.1, CA-2.2, CA-2.3, CA-2.4, CA-3.1, CA-3.2, CA-3.3, CA-3.4, CA-3.5, CA-3.6, CA-4.1, CA-4.2, CA-8.1, CA-8.3 (y CA-8.2 en su parte "operario de baja no asignable pero su histórico intacto").

- [ ] `/domain` (TDD, funciones puras primero): en `calculo.ts` `cantidadTotal(cortePorTalla, plusPorTalla)`, `tarifaEfectiva(ctCentavos, diferencialCentavos)`, `totalAsignacion(cantidad, tarifaCentavos)`; en `validaciones.ts` `validarSumaExacta(asignaciones, cantidadObjetivo) → sin_asignar|parcial|asignada` (con faltante/sobrante), `validarMaximoTres`, `puedeCerrarCorte(operaciones)`.
- [ ] Tests unitarios del dominio: CA-2.1 (372 sin PLUS), CA-2.2 (310+62=372, **el PLUS se paga**), CA-2.3 (372×810=301320 centavos), CA-2.4 (234×629=147186), CA-3.1..3.4 (5580 / 4500+1080 / faltan 22 / sobran 28), CA-4.1, CA-4.2 (tarifa 30 → 3000; 272×20=5440; total operación 8440).
- [ ] `shared`: DTOs de corte/operación/asignación + esquemas Zod (crear corte, asignar).
- [ ] API `modules/cortes`:
  - `POST /api/v1/cortes` (borrador: versión, tallas, corte_por_talla, plus_por_talla; el service calcula `cantidadTotal` con el dominio).
  - `POST /api/v1/cortes/:id/abrir` → **snapshot en `prisma.$transaction`**: copia cada `Operacion` de la versión a `CorteOperacion` con `ct` congelado y `cantidadObjetivo = cantidadTotal`, estado `sin_asignar`.
  - `GET /api/v1/cortes` (filtros estado/modelo/fecha), `GET /api/v1/cortes/:id` (DTO: grupos, operaciones, asignaciones, totales por operario).
  - `PUT /api/v1/cortes/:id/operaciones/:opId/asignaciones` (reemplaza el set de asignaciones de la operación): valida **máx. 3** (CA-3.5), `cantidad > 0`, operario **activo**; calcula y **persiste** `diferencial`, `tarifaEfectiva`, `total` (en el service, con el diferencial de config si es maestro); recalcula `estado`. Todo dentro de transacción.
  - `POST /api/v1/cortes/:id/asignar-grupo` (grupo + operario → todas las operaciones del grupo al 100% — CA-3.6).
  - `POST /api/v1/cortes/:id/cerrar`: **rechaza (409)** si alguna operación no está `asignada` (CA-3.3, CA-3.4, CA-8.3); fija `fechaCierre`; el corte deja de ser editable.
- [ ] Test `ca-1.4` (snapshot inmutable): crear corte con v1 (pinza 0.15), editar la tarifa de la versión a 0.20 → el corte sigue calculando con 0.15.
- [ ] Test `ca-8.1` (cuadre de centavos): con un corte completo asignado, Σ totales por operario = `cantidadTotal × Σ CT` exacto en centavos (aritmética entera lo garantiza; el test lo demuestra con el seed real de DOBLE PRET: 301320 = Bs 3013.20).
- [ ] Test: operario dado de baja no puede recibir asignaciones nuevas, pero sus asignaciones existentes se conservan (CA-8.2).
- [ ] Feature Cortes: lista con filtros y estados; wizard "Nuevo corte" (modelo+versión → tallas/corte/PLUS con total en vivo → confirmar y abrir).
- [ ] Feature Detalle de corte (mockup): cabecera (modelo, versión, cantidad, estado, progreso X/Y asignadas), grupos plegables con badge de estado y "Asignar grupo completo a…", filas de operación con hasta 3 asignaciones (operario, cantidad, toggle maestro con override editable), badge en vivo "Cuadra/Faltan/Sobran" (suma en vivo solo como feedback; el backend confirma), pago por asignación, panel "total por operario" con barras, botón "Cerrar corte" (deshabilitado con motivo si no cuadra).
- [ ] Regresión completa + marcar casillas + resumen al dueño.

### Rebanada 5 — Anticipos

**Entrega:** módulo `anticipos`: registrar (operario, fecha, monto, nota), advertencia de tope (no bloqueo), histórico filtrable, editar/eliminar con confirmación.

**CAs que cubre:** CA-5.5, CA-5.6.

- [ ] `shared`: DTO + Zod de anticipo.
- [ ] API `modules/anticipos`: `GET /api/v1/anticipos` (filtros operario/rango de fechas), `POST`, `PATCH /:id`, `DELETE /:id`. El POST/PATCH responde con `advertenciaTope: true` cuando `monto > topeAnticipoAdvertencia` **pero guarda igual** (CA-5.6).
- [ ] Test `ca-5.5`: dos anticipos en la misma semana (sábado 300 + miércoles 150) → ambos guardados, suma 45000 centavos.
- [ ] Test `ca-5.6`: anticipo 2500 con tope 2000 → guardado + flag de advertencia.
- [ ] Feature Anticipos: formulario rápido (mockup), advertencia visual amarilla al exceder el tope, histórico agrupado por semana con filtro por operario, editar/eliminar con confirmación explicando el impacto en saldos.
- [ ] Regresión completa + marcar casillas + resumen al dueño.

### Rebanada 6 — Liquidación / Consolidado (segunda zona de mayor riesgo)

**Entrega:** vista consolidada mensual con desglose semanal (lunes–sábado, agrupado por `fecha_cierre`), saldo por operario con arrastre, y **cierre de mes** persistido en `Periodo` + `Liquidacion` (transaccional) con la excepción `arrastra_saldo`.

**CAs que cubre:** CA-5.1, CA-5.2, CA-5.3, CA-5.4, CA-5.7, CA-6.1, CA-6.2, CA-6.3, CA-8.4.

- [ ] `/domain/saldo.ts` (TDD): `ganadoPorPeriodo(asignaciones de cortes cerrados con fechaCierre en el mes)`, `calcularSaldo(saldoEntrada, ganado, anticipos)`, `semanasDelMes(lunes–sábado)`, `calcularCierreMes(saldoPeriodo, arrastraSaldo, pagado) → { pagado, saldoSalida }`.
- [ ] Tests unitarios: CA-5.1 (124620+46500=171120), CA-5.2 (corte `abierto` no cuenta), CA-5.3 (24360−50000=−25640), CA-5.7 (corte de 15 días cuenta en el mes del cierre), CA-6.1 (pagado 80000 → salida 0), CA-6.2 (cobra 50000 de 80000 con arrastre → salida 30000), CA-8.4 (ningún concepto de alimentación afecta el saldo — no existe en el modelo).
- [ ] API `modules/liquidacion`: `GET /api/v1/liquidacion?anio&mes` (consolidado calculado en vivo: por operario ganado/anticipos/saldo_entrada/saldo, con desglose por semana; incluye operarios con `saldoEntrada ≠ 0` aunque no hayan trabajado), `POST /api/v1/liquidacion/cerrar-mes` (crea `Periodo` cerrado + una `Liquidacion` por operario; recibe excepciones `{operarioId, pagado, arrastraSaldo}`; **`prisma.$transaction`**; rechaza si el mes ya está cerrado).
- [ ] Tests de integración: CA-5.4 (saldo −256.40 al cerrar → `saldoEntrada` −25640 del mes siguiente), CA-6.3 (cierre normal → todos arrancan en 0), doble cierre rechazado.
- [ ] Feature Liquidación (mockup): selector de mes, tarjetas de semanas con cierres, planilla por operario (ganado, anticipos, saldo coloreado, saldo entrada si ≠0), acción "Liquidar mes" con modal para marcar excepciones de arrastre por operario, vista imprimible (CSS print) de la planilla.
- [ ] Regresión completa + marcar casillas + resumen al dueño.

### Rebanada 7 — Rendición de cuentas (privacidad)

**Entrega:** módulo `rendicion`: DTO de solo lectura con el detalle de **un** operario (sus cortes, operaciones, piezas, ganado, anticipos y saldo), construido en el service — sin ningún dato de terceros en el payload. Imprimible.

**CAs que cubre:** CA-7.1, CA-7.2.

- [ ] API `modules/rendicion`: `GET /api/v1/rendicion/:operarioId?anio&mes` → DTO `{ operario, cortes: [{corte, operaciones propias con cantidad/tarifa/total}], anticipos, totalGanado, saldo }`. Reutiliza el dominio de liquidación filtrando por `operarioId`; el DTO se **construye** (ARQUITECTURA §5.3), no se filtra en el cliente.
- [ ] Test `ca-7.2` (anti-fuga): con datos de varios operarios en la BD, la respuesta serializada **no contiene** nombres ni montos de otros operarios (aserción sobre el JSON completo, no solo la forma).
- [ ] Test `ca-7.1`: la vista de CLARIS contiene exactamente sus asignaciones y anticipos.
- [ ] Feature Rendición: selector de operario + período, detalle de solo lectura, botón imprimir (CSS print). Esta vista es la semilla del rol operario de Fase 2 — sin lógica en el cliente.
- [ ] Regresión completa + marcar casillas + resumen al dueño.

### Rebanada 8 — Dashboard + Configuración + auth (cierre de fase)

**Entrega:** página Inicio con KPIs, cortes activos y alertas; página Configuración editable; login del admin con JWT (`requireAuth` + `requireRole` previsto); docker-compose completo; README final.

**CAs que cubre:** CA-4.3 (diferencial editable desde Configuración; asignaciones ya guardadas no cambian), refuerzo de CA-5.6 (tope editable).

- [ ] API `modules/configuracion`: `GET/PATCH /api/v1/configuracion` (tope, diferencial, nombre del taller; montos en centavos).
- [ ] Test `ca-4.3`: cambiar diferencial a 15 centavos → nueva asignación de maestro sobre ct 20 cobra 35/pieza; las asignaciones previas conservan su `tarifaEfectiva` guardada.
- [ ] API `modules/dashboard`: `GET /api/v1/dashboard` → KPIs del mes en curso (total a pagar estimado, anticipos entregados, saldo pendiente, cortes activos), cortes abiertos con progreso, alertas (operaciones sin asignar/parciales, anticipos sobre tope, fin de mes cercano sin liquidar).
- [ ] Auth (ARQUITECTURA §6): `POST /api/v1/auth/login` (password de `.env` → JWT), `middleware/auth.ts` con `requireAuth` aplicado a todo `/api/v1` (salvo login/health) y `requireRole('admin')` disponible para Fase 2; feature Login con token en el cliente.
- [ ] Feature Inicio según mockup (KPIs, cortes activos con barra de progreso, alertas con severidad) y feature Configuración con validaciones.
- [ ] docker-compose completo (postgres + server + client) — levantar todo con un comando.
- [ ] README final: `.env`, `docker compose up`, o modo desarrollo (migrar, seedear, `npm run dev`), acceso desde otras máquinas por IP local.
- [ ] **Regresión total de los 8 grupos de CA** + marcar casillas + resumen final al dueño.

---

## 5. Riesgos e invariantes (y cómo se respetan)

Los 10 invariantes de CLAUDE.md §6 + manejo de dinero. Cada uno con su mecanismo de cumplimiento:

1. **Suma exacta por operación** (CA-3.2–3.4): `validarSumaExacta` vive en `/domain` y se ejecuta **en el service** en cada mutación de asignaciones; `cerrar` rechaza con 409 si algo no cuadra. La UI solo refleja (su suma en vivo es feedback, no fuente de verdad).
2. **Snapshot inmutable** (CA-1.4): `abrir` copia operaciones + `ct` a `CorteOperacion` en una transacción; ningún endpoint de modelos toca `CorteOperacion`. Test de regresión dedicado.
3. **El PLUS se paga** (CA-2.2): `cantidadTotal = Σ corte + Σ plus` se calcula solo en `/domain/calculo.ts`; ninguna otra ruta del código la deriva.
4. **Versionar conserva el original** (CA-1.3): "nueva versión" solo **crea** filas; nunca muta la versión origen. Test compara v1 antes/después.
5. **Ganado solo de cortes cerrados** (CA-5.2, CA-5.7): la consulta del repository de liquidación filtra `estado='cerrado' AND fechaCierre en período`; no existe otro camino al "ganado".
6. **Saldo = saldo_entrada + ganado − anticipos** (CA-5.3–6.3): fórmula única en `/domain/saldo.ts`; el cierre de mes persiste `Liquidacion` en transacción y el `saldoSalida` es la **única** fuente del `saldoEntrada` siguiente (negativo incluido).
7. **Maestro externo = base + diferencial editable** (CA-4.1–4.3): el diferencial se **copia del config a la asignación** al crearla; jamás se lee del config al recalcular pagos históricos.
8. **Privacidad** (CA-7.1, CA-7.2): el DTO de rendición se **construye** en el service desde consultas filtradas por `operarioId` (nunca un modelo Prisma crudo); test anti-fuga sobre el JSON serializado.
9. **Máx. 3 operarios por operación** (CA-3.5): `validarMaximoTres` en el service dentro de la transacción (409) + la UI no permite agregar el 4º.
10. **Baja lógica** (CA-8.2): no existe endpoint DELETE de operarios; la baja solo escribe `activo=false` + `fechaBaja`.

**11. Manejo de dinero (CLAUDE.md §7 + ARQUITECTURA §3.1, §4):**
- Montos como **`Int` en centavos en la BD, el dominio y la API** (elección única y consistente, la recomendada por ARQUITECTURA §3.1). Como los CT/diferenciales son de 2 decimales y las cantidades enteras, todo el cálculo de Fase 1 (`cantidad × tarifa`, sumas, restas de saldo) es **aritmética entera exacta**: no hay error de redondeo posible y CA-8.1 queda garantizado estructuralmente.
- El redondeo half-up de `lib/money.ts` se aplica **una sola vez**, al convertir input externo a centavos (formularios, JSON del seed). Nada de aritmética de dinero suelta fuera de `money.ts`/`domain`.
- El cliente solo **formatea** (`shared/money.ts`: 301320 → "3 013.20"); nunca calcula montos que se persisten.

**Riesgos operativos:**
- **Rebanada 4 es la más grande**: se mitiga haciendo primero el dominio puro con TDD (CA-2.x, CA-3.x, CA-4.x) y recién después service/API/UI.
- **Cierre de mes irreversible**: transaccional, con confirmación en UI; si el dueño pide reabrir un mes, se pregunta antes de construir nada (fuera de alcance actual).
- **Datos sucios del seed**: resuelto en §6 (n nulos, pieza numérica, ortografía de máquinas) — el seed valida las sumas al terminar y falla ruidosamente si no cuadran.

---

## 6. Conflictos encontrados en el contexto y resolución coherente

| # | Hallazgo | Resolución |
|---|----------|------------|
| 1 | El mockup no está en `docs/mockup` sino en `Mockup Sistema taller confección/` (`Panel Taller.dc.html`). | Se usa ese archivo como referencia visual. |
| 2 | Anexo B define `Operacion.n String` (no nulo), pero el seed trae 3 operaciones con `n: null` (SH FALD 20 y SHORT 2 PRETIN). | `n String?` en `Operacion` y `CorteOperacion`. |
| 3 | El seed trae `pieza: 2` (número) en una operación de SHORT 2 PRETIN. | El seed coerciona a string (`"2"`). |
| 4 | Variantes ortográficas de máquinas (`over/overloc/overlock`, `rect/recta`, `Plancha/plancha`); el contexto §2.1 pide normalizar. | Mapa de normalización explícito en el seed (solo `equipo`; procesos/piezas se conservan tal cual para no inventar semántica). No afecta ningún CT. |
| 5 | El mockup calcula dinero con floats (`Math.round(n*100)/100`). | Se reemplaza por centavos enteros; el mockup manda en lo visual, no en el cálculo. |
| 6 | Los datos del mockup (23 operaciones de DOBLE PRET) son de muestra y no coinciden con el seed real (47). | Manda el seed; la UI carga datos reales. |
| 7 | El seed incluye tallas/cantidades de los cortes históricos pero no asignaciones ni fechas. | El seed solo crea catálogos (operarios, config, modelos); no inventa cortes. Las cantidades quedan como fixtures de tests. |
| 8 | `Liquidacion` del mes puede necesitar filas de operarios sin trabajo pero con arrastre pendiente. | El consolidado incluye a todo operario con `saldoEntrada ≠ 0` o movimiento en el mes. |
| 9 | Anexo B usa `Decimal(10,2)` para montos; ARQUITECTURA §3.1 recomienda `Int` en centavos y autoriza explícitamente ajustar el Anexo B. | **`Int` en centavos** en todo el sistema (BD, dominio, API); el ajuste queda documentado aquí y en el schema. |
| 10 | CLAUDE.md §4 sugiere `client/src/pages` y `server/src/lib/calculo.ts`; ARQUITECTURA (posterior y específica) define `client/src/features` y `server/src/domain/` con capas controller/service/repository. | Manda ARQUITECTURA: `/features` en el cliente y `/domain` (calculo/saldo/validaciones) en el server. `lib/money.ts` se mantiene (coinciden). |
| 11 | CLAUDE.md y el modelo de datos esbozan rutas sin versión (`/api/...`); ARQUITECTURA §5 exige `/api/v1` desde el día uno. | Todas las rutas bajo **`/api/v1`**, siguiendo el esbozo de ARQUITECTURA §5.4 (extendido donde hace falta: `abrir`, `asignar-grupo`, `rendicion` por período). |
| 12 | CLAUDE.md deja auth como "JWT simple o sesión básica"; ARQUITECTURA §6 la concreta: JWT + `requireAuth` + `requireRole` previsto. | JWT con `requireAuth`/`requireRole` (solo `admin` en Fase 1), implementado en R8; montado como middleware global de `/api/v1`, así no hay retrofit por ruta. |

---

## 7. Registro de avance

- [x] Rebanada 1 — Base (monorepo + schema + migración + seed) · verificada CA-1.1, CA-1.2 · OK del dueño ✓
- [x] Rebanada 2 — Operarios · verificada CA-8.2 (parte) · OK del dueño ✓
- [ ] Rebanada 3 — Modelos y versiones · verificadas CA-1.1–1.3 · OK del dueño
- [ ] Rebanada 4 — Cortes + Asignación · verificadas CA-1.4, CA-2.x, CA-3.x, CA-4.1–4.2, CA-8.1, CA-8.3 · OK del dueño
- [ ] Rebanada 5 — Anticipos · verificadas CA-5.5, CA-5.6 · OK del dueño
- [ ] Rebanada 6 — Liquidación · verificadas CA-5.1–5.4, CA-5.7, CA-6.x, CA-8.4 · OK del dueño
- [ ] Rebanada 7 — Rendición de cuentas · verificadas CA-7.1, CA-7.2 · OK del dueño
- [ ] Rebanada 8 — Dashboard + Configuración + auth + compose · verificada CA-4.3 + regresión total · OK del dueño → **Fase 1 lista**
