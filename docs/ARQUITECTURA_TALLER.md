# Arquitectura — Sistema de Pagos del Taller (Fase 1)

> **Propósito**
> Define las decisiones de arquitectura para front, back, base de datos, API, auth y ejecución, con su **justificación** y la **estructura de carpetas** concreta. Es fuente de verdad para el agente junto con `CLAUDE.md`, el modelo de datos y los criterios de aceptación.
> Todas las decisiones salen de tres hechos del proyecto: (a) es **cálculo de dinero** → la corrección es lo único que importa; (b) es **chico y local** → nada de sobre-ingeniería; (c) en **Fase 2 la app móvil reusa el mismo backend** → la lógica de negocio no puede vivir pegada a Express ni a React.

---

## 0. Principios rectores (leer primero)

1. **La lógica de pago y saldo es un núcleo puro**, independiente de framework y de base de datos. Todo lo demás gira alrededor de proteger ese núcleo.
2. **Simplicidad sobre sofisticación.** Un taller, un admin, poca carga. Monolito modular, no microservicios. Sin colas, sin event-sourcing, sin CQRS.
3. **El servidor es el dueño de los cálculos.** El cliente es delgado; muestra y valida UX, no calcula pagos que se persisten.
4. **Preparado para Fase 2, sin construir Fase 2.** API versionada y auth con roles previstos, pero sin implementar operario/móvil todavía.

---

## 1. Forma general: monolito modular en monorepo

Un solo backend y un solo frontend, en un **monorepo** con tres paquetes:

```
/server    # API + dominio + acceso a datos
/client    # React (panel administrativo)
/shared    # tipos DTO + esquemas de validación Zod compartidos
/docs      # documentos de contexto (este incluido) + seed
```

**Por qué monorepo con `shared`:** cliente y servidor (y mañana la móvil) comparten los mismos tipos de DTO y los mismos esquemas de validación. En una app de dinero, esto evita que front y back discrepen sobre qué es un "total" o qué forma tiene un "corte". Es la única "arquitectura extra" que vale la pena; el resto se mantiene simple.

**Por qué NO microservicios:** no hay escala ni equipos que lo justifiquen. Serían peso muerto y complejidad de despliegue para un sistema que corre en una máquina del taller.

---

## 2. Backend: capas con núcleo de dominio puro

Es la decisión más importante del documento.

### 2.1 Organización por módulos de dominio
Un módulo por área de negocio: `operarios`, `modelos`, `cortes`, `anticipos`, `liquidacion`, `configuracion`. Dentro de cada módulo, **tres capas**:

- **controller** — HTTP puro: recibe request, valida (Zod), llama al service, devuelve DTO. No tiene lógica de negocio.
- **service / dominio** — la lógica de negocio. Aquí viven los cálculos y las reglas.
- **repository** — único lugar que habla con Prisma. El service no usa Prisma directo.

### 2.2 La regla de oro
**Toda la matemática de pago y saldo vive en funciones puras del dominio, que no saben que existen Express ni Prisma.** Reciben datos, devuelven datos. Ejemplos que deben ser funciones puras:

- `calcularTotalAsignacion(cantidad, ct, diferencial)` → total.
- `validarSumaExacta(asignaciones, cantidadObjetivo)` → estado (`sin_asignar`/`parcial`/`asignada`).
- `calcularSaldo(saldoEntrada, ganado, anticipos)` → saldo del período.
- `calcularCierreMes(saldoPeriodo, arrastraSaldo, pagado)` → `{ pagado, saldoSalida }`.

**Por qué:** los 10 invariantes del `CLAUDE.md` son lógica de dominio. Si viven en un controller o en un componente React, no se testean bien y la app móvil de Fase 2 no los puede reusar. En un núcleo puro, se cubren con tests unitarios (los criterios de aceptación) y la Fase 2 los hereda gratis. **No hace falta hexagonal/DDD con toda su ceremonia**; basta con respetar este único seam: dominio puro adentro, framework afuera.

### 2.3 Estructura del server
```
/server
  /prisma
    schema.prisma          # Anexo B del modelo de datos
    seed.ts                # carga docs/seed_datos_taller.json
  /src
    /modules
      /operarios           # controller.ts, service.ts, repository.ts, routes.ts
      /modelos
      /cortes
      /anticipos
      /liquidacion
      /configuracion
    /domain                # FUNCIONES PURAS: calculo de pago, saldo, validaciones
      calculo.ts
      saldo.ts
      validaciones.ts
    /lib
      money.ts             # centavos <-> Bs, redondeo (sección 4)
      prisma.ts            # cliente Prisma
    /middleware
      auth.ts              # requireAuth, requireRole (sección 6)
      validate.ts          # middleware Zod
      errors.ts            # manejo de errores centralizado
    app.ts
    server.ts
  /tests                   # reflejan docs/CRITERIOS_ACEPTACION_TALLER.md
```

---

## 3. Base de datos: PostgreSQL + Prisma

Prisma para esquema y migraciones (ya definido en el Anexo B del modelo de datos). Tres decisiones de arquitectura de datos:

### 3.1 Dinero como enteros en centavos
Guardar montos como **`Int` en centavos**, no como flotantes. Es la forma más segura en un stack JS de no arrastrar errores de centavo. Se formatea a Bs solo en la capa de presentación (`money.ts`).
> Alternativa válida: `Decimal(10,2)` de Prisma + `decimal.js`. **Elegí UNA y sé consistente en todo el sistema.** Recomendado: centavos enteros por simplicidad. (Si se usa esta vía, ajustar los tipos del Anexo B de `Decimal` a `Int` en centavos y documentarlo.)

### 3.2 Transacciones para operaciones multi-fila
Toda operación que escribe varias filas dependientes debe ser **atómica** (`prisma.$transaction`). Críticas:
- **Crear un corte** → hace el *snapshot* de todas sus `CorteOperacion` de una sola vez.
- **Cerrar el mes** → genera las `Liquidacion` de todos los operarios y calcula arrastres.
Un fallo a medias sin transacción deja datos de pago inconsistentes.

### 3.3 Integridad empujada a la BD
Los invariantes que se puedan expresar en el esquema, van en el esquema: los `@@unique` del modelo de datos, checks de `cantidad > 0`. Los que no (máximo 3 asignaciones por operación, suma exacta), se validan en el **service dentro de la transacción**. La BD es la última línea de defensa contra bugs de la app.

---

## 4. Manejo de dinero (transversal)

- Un solo módulo `lib/money.ts` centraliza conversión y redondeo. Nada de aritmética de dinero suelta por el código.
- Redondear **una sola vez** al fijar cada `total`, con regla consistente (half-up a 2 decimales / o trabajar en centavos enteros y no redondear nunca a mitad de camino).
- **Invariante de cuadre:** la suma de los totales por operario de un corte debe igualar `cantidad × costo_por_prenda` sin descuadres de centavos (CA-8.1).

---

## 5. API: REST versionada con validación y DTOs

REST orientado a recursos, con prefijo **`/api/v1`** desde el día uno (la móvil de Fase 2 consumirá esto; no romperla después). Tres piezas:

### 5.1 Validación en la entrada (Zod)
Middleware que valida body/params/query contra esquemas de `shared` antes de llegar al service. Request inválido → 400 con forma de error estándar.

### 5.2 Manejo de errores centralizado
Un middleware de errores que siempre devuelve la misma forma: `{ data }` en éxito, `{ error: { code, message } }` en fallo. Nada de rutas improvisando respuestas.

### 5.3 DTOs, nunca modelos Prisma crudos
El service arma el DTO que sale al cliente. Esto es **crítico para la privacidad del operario**: la rendición de cuentas se garantiza filtrando y construyendo el DTO en el service, no confiando en que el front oculte campos. El endpoint del operario debe *construir* una respuesta que contiene **solo sus datos** (CA-7.1, CA-7.2).

### 5.4 Rutas principales (esbozo)
```
/api/v1/operarios            GET POST | /:id GET PATCH  (baja lógica)
/api/v1/modelos              GET POST | /:id/versiones POST
/api/v1/cortes               GET POST | /:id GET | /:id/cerrar POST
/api/v1/cortes/:id/asignaciones   POST PATCH DELETE
/api/v1/anticipos            GET POST
/api/v1/liquidacion          GET (por período) | /cerrar-mes POST
/api/v1/rendicion/:operarioId     GET   (DTO filtrado)
/api/v1/configuracion        GET PATCH
```

---

## 6. Autenticación y autorización

- **Fase 1:** JWT con un **único admin**. Middleware `requireAuth`.
- **Preparado para roles:** existe `requireRole(...)` aunque hoy solo se use `admin`. En Fase 2 entra `operario` con acceso restringido a lo suyo, y no habrá que refactorizar la base de auth.
- **Local:** al correr en la red del taller, mantené la auth simple; no montes OAuth ni proveedores externos en esta fase.

---

## 7. Frontend: cliente delgado por features

### 7.1 Estructura por features
Una carpeta por sección del menú, no por tipo de archivo.
```
/client/src
  /features
    /inicio
    /operarios
    /modelos
    /cortes            # incluye la pantalla de asignación (la más compleja)
    /anticipos
    /liquidacion
    /rendicion
    /configuracion
  /components           # UI reutilizable
  /api                  # hooks de TanStack Query
  /lib                  # formateo de dinero para mostrar (usa shared)
  router.tsx
```

### 7.2 Estado
- **TanStack Query** como única fuente de verdad del estado de servidor (cachea, revalida, sincroniza).
- Estado local de UI con `useState`/`useReducer`. **Nada de Redux**, es innecesario acá.
- Formularios con **react-hook-form + Zod**, reusando esquemas de `shared`.

### 7.3 El front es delgado (regla dura)
El servidor calcula; el cliente muestra. **Nunca dupliques la lógica de saldo o pago en React.** Única excepción legítima: en la **pantalla de asignación** se calcula la suma en vivo mientras el usuario teclea, para el feedback verde/rojo instantáneo — pero el cálculo que se persiste y vale lo confirma el backend.

---

## 8. Testing: pirámide apoyada en el dominio puro

- **Muchos unit tests** sobre las funciones puras de `/domain` → aquí viven los criterios de aceptación de cálculo (sumas de CT, división, saldo, arrastre, cierre). Baratos y rápidos porque no tocan Express ni Postgres.
- **Integración** sobre los endpoints críticos: crear corte con snapshot, cerrar mes, rendición filtrada.
- **Casi nada de E2E** en Fase 1.
- Fixture: `docs/seed_datos_taller.json` (de ahí salen 8.10, 5.97, 7.68, 6.29, 7.18; 372; 234; −256.40).

---

## 9. Ejecución local: docker-compose

Como corre local en el taller, un **`docker-compose`** con Postgres + server + client permite levantar todo con un comando y un entorno reproducible.
```
/docker-compose.yml    # postgres + server + client
```
Objetivo: que el dueño "instale" la app en la máquina del taller sin pelear con instalaciones manuales de Postgres. Las demás máquinas acceden por la IP local del equipo servidor.
> No configures despliegue en la nube en esta fase (ver decisión de hosting: local hasta validar).

---

## 10. Resumen de stack (para citar rápido)

| Capa | Elección | Nota |
|---|---|---|
| Monorepo | server + client + shared | tipos y Zod compartidos |
| Backend | Node.js + Express + TypeScript | módulos + dominio puro |
| ORM / BD | Prisma + PostgreSQL | transacciones; integridad en BD |
| Dinero | centavos enteros (o Decimal+decimal.js) | elegir uno, ser consistente |
| API | REST `/api/v1` + Zod + DTOs | versionada para Fase 2 |
| Auth | JWT admin único + `requireRole` previsto | roles listos para Fase 2 |
| Frontend | React (Vite) + Tailwind + TanStack Query | por features, cliente delgado |
| Formularios | react-hook-form + Zod | esquemas de `shared` |
| Testing | Vitest/Jest, foco en dominio puro | fixtures del seed |
| Ejecución | docker-compose local | sin nube en Fase 1 |

---

## 11. Qué NO hacer (anti-patrones para este proyecto)

- Poner cálculos de pago/saldo en controllers o en componentes React.
- Devolver modelos Prisma crudos al cliente (riesgo de fuga de datos entre operarios).
- Sumar dinero con floats sin control de redondeo.
- Introducir Redux, microservicios, colas o CQRS.
- Construir rol operario, app móvil, import/export Excel o alimentación (fuera de alcance Fase 1).
- Escribir varias filas dependientes (snapshot de corte, cierre de mes) fuera de una transacción.
