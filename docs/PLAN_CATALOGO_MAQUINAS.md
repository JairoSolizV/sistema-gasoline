# Plan de Implementación — Módulo Catálogo (Máquina → Proceso → Pieza)

> **Estado:** **aprobado e implementándose.** Las 5 decisiones de la §9 fueron resueltas por el dueño (2026-09-20) y están registradas ahí con su efecto en el plan.
> **Documento nuevo** agregado a `/docs` (no modifica ninguno de los 5 documentos fuente).
> **Ubicación en el plan general:** es una rebanada vertical adicional (la llamamos **Rebanada 9**) posterior a la Fase 1 ya terminada. Se ejecuta con las mismas convenciones de `docs/PLAN_IMPLEMENTACION.md` §3.

---

## 1. Problema y objetivo

Hoy, al crear un modelo, las tres columnas **Máquina / Proceso / Pieza** son `<input type="text">` libres
(`client/src/features/modelos/NuevoModeloPage.tsx` y `OperacionFormModal.tsx`). Eso produce exactamente el
problema que el seed real ya documenta (`docs/seed_datos_taller.json` → `_meta.nota_normalizacion`):
variantes escritas a mano del mismo concepto (`over` / `overloc` / `overlock`, `rect` / `recta`,
`Plancha` / `plancha`), imposibles de agrupar después.

**Objetivo:** dejar de escribir a mano. Un catálogo propio, mantenible desde la UI, con **dependencia
jerárquica estricta en tres niveles** *dentro de cada operación*, y un catálogo de **grupos** que
**envuelve** a esas operaciones sin condicionarlas (decisión §9.3):

```
GRUPO  (TRASEROS, DELANTEROS, ENSAMBLE…)   ← bloque que CONTIENE operaciones
  │
  ├── operación:  Máquina ──▶ Proceso ──▶ Pieza     ← acá sí hay cascada
  │                recta      pinza       trasero
  └── operación:  Máquina ──▶ Proceso ──▶ Pieza
                   codo       urlado      herraje

Máquina  ──1:N──▶  Proceso  ──1:N──▶  Pieza    ← una sola lista, igual para TODOS los grupos
 recta               pinza              trasero
                     despunte           solapa, lateral, presilla…
 overlock            boca               bolsillo
                     cerrado            lateral
```

**El grupo no filtra la jerarquía.** Elegir TRASEROS no achica la lista de máquinas: el grupo dice en
qué bloque del modelo va la operación, no con qué se cose. Por eso el grupo es un catálogo propio
(§3) y en la pantalla de catálogo se muestra **arriba y a lo ancho**, conteniendo al bloque de tres
columnas — nunca como un cuarto nivel al lado de Piezas.

Al cargar una operación, el formulario encadena tres selects:

1. Elijo **máquina** → el select de **proceso** muestra *solo* los procesos de esa máquina.
2. Elijo **proceso** → el select de **pieza** muestra *solo* las piezas de esa máquina+proceso.
3. Cambiar la máquina limpia proceso y pieza; cambiar el proceso limpia la pieza.
4. El **grupo** se elige aparte, sin afectar ni depender de los tres anteriores.

**Tamaño real del catálogo**, derivado de las 201 operaciones del seed con las variantes ya unificadas
(§11 — `server/prisma/normalizacion-equipos.ts`):

| Nivel | Cantidad | Antes de unificar |
|---|---|---|
| Máquinas | **11** | 13 |
| Pares máquina→proceso | **55** (`recta` 24, `overlock` 8, `plana` 7, `atraque` 4; el resto ≤ 3) | 63 |
| Piezas | **96** | 102 |
| Grupos | **8** | 9 |

Es decir: en vez de ver los 47 procesos sueltos del Excel, al elegir `recta` se ven 24, y al elegir
`overlock` se ven 8. Exactamente el comportamiento pedido.

---

## 2. Qué NO cambia (invariantes que este módulo debe respetar)

Esto es lo más importante del plan. El catálogo es **una ayuda de captura**, no una nueva fuente de verdad
del pago.

1. **`Operacion` y `CorteOperacion` siguen guardando los textos `equipo` / `proceso` / `pieza` / `grupo`,
   y no se les agrega ninguna columna.** La migración es **puramente aditiva**: crea 4 tablas nuevas y no
   toca una sola columna existente.
   *Por qué:* `CorteOperacion` es el snapshot inmutable que sostiene CA-1.4 y todo el cálculo de pago
   (CLAUDE.md §6.2). Si la descripción de un corte cerrado dependiera de una fila viva del catálogo,
   renombrar "recta" en 2027 cambiaría lo que dice un corte pagado en 2026. Eso no puede pasar.
2. **Ningún CT, total, saldo ni liquidación se toca.** Este módulo no entra al dominio
   (`server/src/domain/`). Cero cambios en `calculo.ts` y `saldo.ts`.
3. **Baja lógica, nunca borrado físico** (mismo criterio que operarios, CA-8.2): una máquina/proceso/pieza
   dada de baja desaparece de los selects de alta, pero los modelos que ya la usan siguen mostrándose igual.
4. **Los modelos y cortes existentes siguen funcionando sin migración de datos destructiva.** El backfill
   (§6) solo *crea* filas de catálogo; no modifica ni borra nada.
5. **El CT es siempre manual.** El catálogo **no guarda precios** (decisión §9.1): el dueño escribe el CT en
   cada operación. Coherente con el dato real: hay **8 ternas con CT distinto entre modelos** (p. ej.
   `plana/ensamble/delantero` vale 0.50 en un modelo y 0.70 en otro).

---

## 3. Modelo de datos (Prisma)

**Cuatro tablas nuevas y cero cambios en las tablas existentes.** Ni `Operacion` ni `CorteOperacion` se
tocan: el snapshot se queda como está, con texto puro (§2.1).

```prisma
model Maquina {
  id        String    @id @default(uuid())
  nombre    String    @unique          // normalizado: "recta", "overlock", "plana"
  orden     Int       @default(0)      // orden de aparición en el select
  activo    Boolean   @default(true)   // baja lógica
  createdAt DateTime  @default(now())
  procesos  Proceso[]
}

model Proceso {
  id        String   @id @default(uuid())
  maquina   Maquina  @relation(fields: [maquinaId], references: [id])
  maquinaId String
  nombre    String                     // "pinza", "despunte", "boca"
  orden     Int      @default(0)
  activo    Boolean  @default(true)
  createdAt DateTime @default(now())
  piezas    Pieza[]

  @@unique([maquinaId, nombre])        // "pinza" puede existir en recta y en plana
  @@index([maquinaId, activo])
}

model Pieza {
  id        String   @id @default(uuid())
  proceso   Proceso  @relation(fields: [procesoId], references: [id])
  procesoId String
  nombre    String                     // "trasero", "bolsillo", "pretina"
  orden     Int      @default(0)
  activo    Boolean  @default(true)
  createdAt DateTime @default(now())

  @@unique([procesoId, nombre])
  @@index([procesoId, activo])
}

// Catálogo de GRUPOS: los bloques que envuelven a las operaciones de un modelo.
// No cuelga de Maquina ni nada cuelga de él: elegir un grupo no cambia qué
// máquina/proceso/pieza se puede usar (decisión §9.3).
model Grupo {
  id        String   @id @default(uuid())
  nombre    String   @unique           // MAYÚSCULAS: "TRASEROS", "ENSAMBLE"
  orden     Int      @default(0)
  activo    Boolean  @default(true)
  createdAt DateTime @default(now())
}
```

**Sin foreign keys en `Operacion`.** La versión anterior de este plan proponía tres FK opcionales de
trazabilidad; se descartaron. Al forzar los valores por catálogo (§9.4), el texto guardado ya coincide con el
del catálogo, así que el "¿cuántas operaciones usan esto?" se resuelve por comparación de texto
*case-insensitive*, sin tocar una tabla que sostiene el cálculo de pagos. Menos superficie, cero regresión.

### 3.1 Decisión de diseño: árbol estricto, no muchos-a-muchos

Un proceso pertenece a **una** máquina. Si "despunte" se hace en `recta`, `plana` y `codo`, son **tres filas
distintas** de `Proceso` (y sus piezas cuelgan de cada una). En el seed real hay 13 procesos que aparecen en
más de una máquina.

*Por qué así y no una tabla puente `MaquinaProceso`:*
- Es literalmente lo que se pidió: "de la máquina recta con el proceso de pinza solamente me va a aparecer
  las piezas que se hacen con esa máquina y ese proceso". Con M:N, las piezas tendrían que colgar del **par**
  igual, así que la tabla puente no ahorra nada y sí agrega una capa.
- El filtrado en cascada queda en un `where` de una sola columna, sin joins ni casos raros en la UI.
- Costo: si se renombra "despunte" hay que hacerlo en 3 filas. Con 63 pares en total, es un costo aceptable.
  La pantalla de catálogo lo hace visible y en dos clics.

Si en el futuro el catálogo creciera mucho, migrar a M:N es posible sin tocar `Operacion` (porque las
operaciones guardan texto, §2.1). Es una decisión reversible.

---

## 4. Reglas del catálogo (invariantes propias del módulo)

- **C-1 — Unicidad por rama.** No pueden existir dos procesos con el mismo nombre en la misma máquina, ni dos
  piezas con el mismo nombre en el mismo proceso. Garantizado en BD (`@@unique`) y traducido a error
  `NOMBRE_DUPLICADO` (409), igual que `Modelo.nombre`.
- **C-2 — Normalización al guardar.** Nombres `trim()` + colapso de espacios internos, y después:
  **minúsculas** para máquina/proceso/pieza, **MAYÚSCULAS** para grupo (decisión §9.2). La comparación de
  duplicados se hace sobre el nombre ya normalizado.
- **C-3 — Baja lógica en cascada visual.** Dar de baja una máquina oculta sus procesos y piezas de los selects
  de alta, pero no los modifica en BD. Reactivar la máquina los devuelve tal cual estaban.
- **C-4 — Sin borrado físico si está en uso.** `DELETE` físico solo se permite si ninguna `Operacion` usa ese
  texto; en cualquier otro caso se responde 409 y se ofrece `activo = false`. En la práctica la UI ofrece
  "Desactivar", no "Eliminar".
- **C-5 — El catálogo no reescribe el snapshot pagable.** Ninguna operación del módulo toca
  `CorteOperacion`: un corte ya creado dice siempre lo que decía al abrirse (CA-1.4).
  *Las `Operacion` de los modelos sí se actualizan* cuando se renombra o se une una entrada — ver §11.1.
- **C-6 — La pieza es opcional.** `Operacion.pieza` ya es nullable y hay operaciones reales sin pieza. El
  select de pieza debe permitir "— sin pieza —".

---

## 5. API (`/api/v1/catalogo`)

Módulo nuevo `server/src/modules/catalogo/` con el patrón habitual
(`routes.ts` → `controller.ts` → `service.ts` → `repository.ts`), esquemas Zod y DTOs en `shared/`.

| Método | Ruta | Para qué |
|---|---|---|
| `GET` | `/catalogo/arbol?soloActivos=true` | **El endpoint que usa el formulario.** Devuelve la jerarquía completa + los grupos (en paralelo, no anidados) en una sola llamada. Con 13/63/107 filas pesa pocos KB: se cachea con TanStack Query y la cascada se resuelve en el cliente sin round-trips. |
| `GET` | `/catalogo/arbol?soloActivos=false` | Lo mismo con inactivos y **conteo de uso** por entrada: es lo que consume la pantalla de administración. |
| `POST` | `/catalogo/maquinas` | Alta de máquina. |
| `PATCH` | `/catalogo/maquinas/:id` | Renombrar / activar / desactivar. |
| `DELETE` | `/catalogo/maquinas/:id` | Borrado físico **solo si no está en uso** (C-4). |
| `POST` | `/catalogo/maquinas/:id/procesos` | Alta de proceso dentro de esa máquina. |
| `PATCH` / `DELETE` | `/catalogo/procesos/:id` | Editar / borrar proceso. |
| `POST` | `/catalogo/procesos/:id/piezas` | Alta de pieza dentro de ese proceso. |
| `PATCH` / `DELETE` | `/catalogo/piezas/:id` | Editar / borrar pieza. |
| `POST` | `/catalogo/grupos` | Alta de grupo (van por fuera de la cascada). |
| `POST` | `/catalogo/<nivel>/:id/fusionar` | **Unir** esta entrada con otra de la misma rama (§11). |
| `PATCH` / `DELETE` | `/catalogo/grupos/:id` | Editar / borrar grupo. |

DTO del árbol:

```ts
export interface CatalogoNodoDTO {
  id: string;
  nombre: string;
  activo: boolean;
  usos: number; // operaciones que usan este texto (0 = se puede borrar)
}

export interface CatalogoArbolDTO {
  maquinas: (CatalogoNodoDTO & {
    procesos: (CatalogoNodoDTO & { piezas: CatalogoNodoDTO[] })[];
  })[];
  grupos: CatalogoNodoDTO[];
}
```

Todo detrás de `requireAuth` como el resto de `/api/v1`.

---

## 6. Backfill: de dónde sale el catálogo inicial

**No se arma a mano.** Se deriva de los datos que ya existen, en este orden:

1. **Fuente principal: las operaciones ya cargadas en la BD** (`SELECT DISTINCT equipo, proceso, pieza FROM "Operacion"`),
   aplicando el mismo `MAPA_EQUIPOS` de `server/prisma/seed.ts` (`over`/`overloc` → `overlock`, `rect` → `recta`,
   `Plancha` → `plancha`) más la normalización C-2.
2. **Las listas planas del JSON se descartan** (decisión §9.5). `catalogo_maquinas`, `catalogo_procesos` y
   `catalogo_piezas` son listas **planas y sucias** (17 máquinas con variantes, 47 procesos, 50 piezas) y **no
   contienen la jerarquía**. Todo sale de `modelos[].operaciones`, que es de donde salen los números de la §1.
   Una máquina del Excel que no aparece en ninguna operación no entra al catálogo.
3. **Grupos**: se derivan del mismo `DISTINCT`, en MAYÚSCULAS (C-2).
4. **Sin precios.** El catálogo no guarda CT (§2.5).

Se implementa como **script idempotente y re-ejecutable** (`server/prisma/backfill-catalogo.ts`), invocable con
`npm run catalogo:backfill`, y se integra al `seed.ts` para que una BD nueva nazca con el catálogo ya armado.
El script imprime un resumen (máquinas/procesos/piezas creados, ternas sin match) y **no borra nada**.

---

## 7. Rebanadas de implementación

Orden estricto; cada una entrega BD → API → UI → test en verde antes de pasar a la siguiente.

### 9.1 — Esquema + backfill (sin UI)
- [x] Modelos `Maquina`, `Proceso`, `Pieza`, `Grupo` en `schema.prisma` (sin tocar tablas existentes).
- [x] `prisma migrate dev --name catalogo_maquinas` (migración **aditiva**: ninguna columna existente se
      modifica ni se borra).
- [x] `server/prisma/backfill-catalogo.ts` según §6 + enganche en `seed.ts`.
- [x] Test: correr el backfill dos veces seguidas no duplica filas y produce 13 / 63 / 107.

### 9.2 — API del catálogo
- [x] DTOs (`shared/src/dtos/catalogo.ts`) + esquemas Zod (`shared/src/schemas/catalogo.ts`) + export en `index.ts`.
- [x] Módulo `server/src/modules/catalogo/` con los endpoints de §5.
- [x] Montaje en `server/src/app.ts` (`app.use('/api/v1/catalogo', catalogoRouter)`).
- [x] Tests de integración (Supertest): árbol filtrado por `soloActivos`, duplicado → 409, baja lógica,
      C-4 (no borrar en uso), C-5 (renombrar no toca `Operacion` ni `CorteOperacion`).

### 9.3 — Pantalla de administración del catálogo
- [x] `client/src/api/catalogo.ts` (hooks TanStack Query).
- [x] `client/src/features/catalogo/CatalogoPage.tsx`: **panel de Grupos arriba** (chips, envuelve) y
      debajo la jerarquía en tres columnas tipo *master-detail* (Máquinas | Procesos de la máquina |
      Piezas del proceso), con alta/edición inline, toggle activo y contador de uso
      ("usada en N operaciones").
- [x] Ruta `/catalogo` en `router.tsx` + ítem "Catálogo" en `Layout.tsx` (bajo Modelos).

### 9.4 — Selects encadenados en el alta de modelos ← *el objetivo de todo esto*
- [x] Componente reutilizable `SelectorCatalogo` (combobox) que consume `GET /catalogo/arbol` (una sola query
      cacheada para toda la pantalla).
- [x] Integrarlo en `NuevoModeloPage.tsx` (fila de la tabla) y en `OperacionFormModal.tsx` (alta/edición suelta),
      en los 4 campos: grupo, máquina, proceso, pieza.
- [x] **Escribir = buscar, no inventar** (decisión §9.4): tipear **filtra** la lista del catálogo; el valor
      final siempre sale de una opción del catálogo. El CT se escribe siempre a mano (§2.5).
- [x] Si lo tipeado no existe, el combobox ofrece **`+ Crear "xxx"`** en la rama actual: lo agrega al catálogo
      y lo selecciona, sin salir del formulario ni perder lo cargado. Así "no escribir a mano" no se convierte
      en "no poder cargar el modelo".
- [x] Al editar una operación vieja cuyo texto no está en el catálogo, el combobox **conserva el valor actual**
      y lo muestra marcado como "fuera de catálogo"; no lo borra ni lo pisa (C-5).
- [x] Verificación en navegador: elegir `recta` muestra sus 24 procesos y no los 47 sueltos; elegir `recta`+`pinza` muestra
      solo sus piezas; cambiar de máquina limpia los niveles de abajo.

### 9.5 — Regresión
- [x] Toda la suite existente en verde (`server/tests/`), en particular `modelos.test.ts`, `cortes.test.ts`
      y `ca-1.test.ts`: crear modelo, versionar y snapshot de corte se comportan **exactamente igual**
      que antes. Resultado: **145 tests en verde** (128 previos + 17 del catálogo), typecheck limpio en
      server y client.
- [x] Actualizar `README.md` (comando de backfill) y `docs/PLAN_IMPLEMENTACION.md` §7 (registro de avance).

### Encontrado al probar en el navegador (ya corregido)
- El combobox filtraba **respetando mayúsculas**: buscar "tras" no encontraba `TRASEROS` y ofrecía
  crear un grupo nuevo "TRAS". La búsqueda ahora ignora mayúsculas en los cuatro campos; lo tipeado
  se manda tal cual y el server normaliza según el nivel (C-2).
- Tras elegir una opción el campo quedaba enfocado y cerrado, así que lo siguiente que se tipeaba se
  **pegaba** al valor ya elegido (`1despuntepinza`). Ahora el selector suelta el foco al elegir.

---

## 8. Tests específicos del módulo

| Id | Qué verifica |
|---|---|
| CAT-1 | El árbol de `recta` trae sus procesos y **ninguno** de otra máquina. |
| CAT-2 | Las piezas devueltas para (`recta`,`pinza`) son solo las de ese par. |
| CAT-3 | Alta de proceso duplicado en la misma máquina → 409; el mismo nombre en otra máquina → 201. |
| CAT-4 | Desactivar una máquina la saca de `?soloActivos=true` y no altera ninguna `Operacion`. |
| CAT-5 | Renombrar máquina/proceso/pieza **no** cambia ningún `CorteOperacion` (C-5 + CA-1.4). |
| CAT-6 | Backfill idempotente: dos corridas → mismos conteos, sin duplicados. |
| CAT-7 | Normalización C-2: máquina/proceso/pieza se guardan en minúsculas y los grupos en MAYÚSCULAS. |
| CAT-8 | Crear un modelo con textos libres (sin catálogo) sigue funcionando igual que antes. |
| CAT-9 | Unir dos grupos reescribe las operaciones de los modelos y borra el duplicado, sin tocar los CT. |
| CAT-10 | Unir procesos migra las piezas del origen y descarta las homónimas del destino. |
| CAT-11 | No se unen procesos de máquinas distintas, ni una entrada consigo misma. |
| CAT-12 | Unir **no** modifica ningún `CorteOperacion` ni ninguna `Asignacion` (CA-1.4). |
| CAT-13 | Las repeticiones y cantidades (`despunte 1`, `corrida 2`, `3 pinzas`, `5 pinzas`) siguen separadas de la operación simple (§11.3). |
| CAT-14 | Renombrar máquina/proceso/pieza arrastra las operaciones de los modelos: no quedan huérfanas y el contador de uso se mantiene. |

---

## 9. Decisiones del dueño (2026-09-20) — cerradas

1. **CT sugerido por pieza: NO.** "Yo voy a rellenar los precios siempre." → El catálogo no guarda precios;
   se eliminó `ctSugerido` del modelo, del DTO y del backfill. El campo CT del formulario queda manual.
2. **Normalización:** grupos en **MAYÚSCULAS**, máquina/proceso/pieza en **minúsculas** (C-2).
3. **Grupo es catálogo: SÍ**, con alta propia ("quiero poder crear diferentes grupos").
   **Corrección posterior del dueño:** el grupo **envuelve** a la jerarquía máquina → proceso → pieza;
   no es un cuarto nivel hermano ni la filtra. Se mantiene como catálogo propio (sin FK a nada), y la
   pantalla lo muestra arriba, conteniendo al bloque de las tres columnas.
4. **Escribir a mano = solo para buscar más rápido.** El tipeo **filtra** el catálogo; no se guardan valores
   libres. Para que eso no bloquee la carga, el combobox ofrece `+ Crear "xxx"` en la rama actual: se agrega
   al catálogo en el momento y queda seleccionado. Cualquier valor que se guarde en una operación existe en
   el catálogo — que era el punto de todo esto.
5. **Entradas sueltas del Excel: se descartan** en el backfill.

---

## 10. Fuera de alcance de este módulo

- Precios/tarifas por máquina-operario, rendimiento por máquina, mantenimiento de máquinas, cantidad de
  máquinas físicas del taller. Esto es un **catálogo de nomenclatura**, no un inventario de activos.
- Reescribir modelos o cortes históricos para "limpiarlos" con el catálogo nuevo (viola §2.1 y CA-1.4).
- Importación masiva del catálogo desde Excel (sigue siendo Fase 2, CLAUDE.md §2).
- Cualquier cambio en el cálculo de pagos, saldos o liquidación.

---

## 11. Unificación de duplicados (2026-09-20)

El Excel escribe el mismo concepto de varias formas, así que el catálogo derivado nació con duplicados
(`DELANTERO` y `DELANTEROS`, `3 pinza` y `pinza`, `entrep` y `entrep.`…). Se agregó la operación de
**unir** y se limpió el catálogo con el dueño.

### 11.1 Qué hacen "unir" y "renombrar" (y qué no)

`POST /catalogo/<nivel>/:id/fusionar { destinoId }` — la entrada de origen desaparece y todo lo que la
usaba pasa a decir el nombre de la de destino. `PATCH /catalogo/<nivel>/:id { nombre }` — la entrada
cambia de nombre y las operaciones que lo usaban se actualizan.

- **Las dos reescriben `Operacion`** (las operaciones de los modelos), en transacción. Son las únicas dos
  del módulo que lo hacen: sin eso, las operaciones quedarían apuntando a un nombre que ya no existe en
  el catálogo.
- **Nunca toca `CorteOperacion`.** Un corte ya creado sigue diciendo lo que decía el día que se abrió
  (CA-1.4). Ningún CT, total, saldo ni liquidación cambia — verificado en CAT-12.
- Solo une dentro de la misma rama: procesos de la misma máquina, piezas del mismo proceso. Unir máquinas
  arrastra sus procesos (los homónimos se fusionan entre sí, el resto se muda).
- Está en la pantalla de catálogo, botón **unir** en cada entrada.

**Renombrar no es unir.** Renombrar sirve para corregir el nombre de **una** entrada; unir es para dos
entradas que son lo mismo y hay que dejar una sola. Las limpiezas de §11.2 (`CERADO → CERRADO`,
`bol → bolsillo`, `del → delantero`) se hicieron creando el nombre bueno y uniendo el viejo, porque el
destino ya existía o convenía dejar el histórico en una sola fila.

**Un bug que costó encontrar:** en la primera versión, renombrar cambiaba *solo* el catálogo. El dueño
renombró la máquina `atraque` a `atracadora` desde la pantalla y sus 26 operaciones quedaron diciendo
`atraque`: desaparecieron de la cascada y todos los contadores de uso cayeron a 0. Por eso renombrar
ahora arrastra las operaciones, igual que unir. Lo cubre el test **CAT-14**.

### 11.2 Lo que se unió

Sin preguntar (solo diferían por plural o puntuación):

| Nivel | Se unió | Quedó |
|---|---|---|
| Grupo | `DELANTERO` (8 usos) | `DELANTEROS` |
| Proceso (recta) | `asegurar` | `asegurado` |
| Pieza | `entrep.` (overlock/cerrado), `aletacierre` (recta/colocado), `del` (cerradora/medio, cerradora/herraje 1 y 2) | `entrepierna`, `aleta cierre`, `delantero` |

Decidido por el dueño:

| Nivel | Se unió | Quedó | Motivo |
|---|---|---|---|
| Máquina | `recta+pres`, `asegurado` | `recta` | no eran máquinas: una es recta con la presilladora anotada al lado, la otra un proceso en la columna equivocada |
| Proceso (recta) | `pretina aseg`, `aleta/ciere` | `pretina`, `aleta` | |
| Grupo | `CERADO` (22 usos) | `CERRADO` | error de tipeo del Excel |
| Pieza | `bol` (recta/presilla), `del` (plana/despunte) | `bolsillo`, `delantero` | abreviaturas |
| Proceso (atraque) | `solo` | `atraque` | el "SOLO" del Excel era un atraque suelto en la entrepierna |
| Proceso (plancha) | `bol latera` | `planchado` **+ pieza `bol latera`** | era una pieza escrita en la columna de proceso |
| Pieza (atraque) | `entrep`, `y entrep`, `entrepi` | `entrepierna` | tres formas de escribir lo mismo |
| Pieza (overlock/cerrado) | `entrep`, `entrep.` | `entrepierna` | mismo criterio: el nombre completo en todo el catálogo |
| Proceso (atraque) | `jota` (con piezas `delantero` y `2`) | `atraque` **+ pieza `jota`** | columnas invertidas: en la atracadora la operación es atracar y la jota es la pieza |

Dos casos no se resolvieron con una fusión, porque había que cambiar **proceso y pieza a la vez** y unir
solo toca un nivel: `plancha / bol latera` → `planchado` + pieza `bol latera`, y las 7 filas de
`atraque / jota` → `atraque` + pieza `jota`. En ambos se corrigieron las operaciones con `PATCH` y recién
después se limpió el catálogo. Las 7 de la jota eran la misma operación en los 5 modelos (grupo PRESILLA,
paso 7, CT 0.06), escrita con dos piezas distintas (`delantero` y `2`) por descuido; esas dos desaparecen
como pieza.

**Se dejó como estaba**, por decisión del dueño: `solap1` / `solap2` / `solap1-shor` / `solap2-shor` son
solapas distintas con precio propio; `despunte 2 solapa` (recta) y `herraje 1` / `herraje 2` (cerradora)
son operaciones distintas; `recta / pega despunte` es una operación propia (pegar y despuntar la pretina
se cobra junto); `2corrida` conserva su nombre.

### 11.3 Los números del nombre NO son números de paso

En la primera pasada se unificaron `1despunte`, `3 pinza`, `5 pinza`, `despunte 1` y `despunte 2` con la
operación simple, suponiendo que el número era el paso. **Estaba mal y se revirtió.** El dueño lo explicó:
un número en el nombre significa una **segunda pasada** (un refuerzo, pero no se llama así) o una
**cantidad** — nunca el paso, que ya tiene su propia columna `N`.

El dato lo confirma: el número del nombre no coincide con `N`, y cada variante tiene su propio CT.

| Excel | `N` (paso) | pieza | CT | qué es |
|---|---|---|---|---|
| `1despunte` | 6 | bolsillo | 0.25 | primer despunte |
| `2corrida` | 7 | bolsillo | 0.25 | segunda corrida, sobre la misma pieza |
| `despunte 1` | 8 | del | 0.10 | primer despunte |
| `despunte 2` | 9 | del | 0.10 | segundo despunte |
| `3 pinza` | 1 | solapa | 0.15 | **3 pinzas** |
| `5 pinza` | 1 | solapa | 0.25 | **5 pinzas** — más caro porque son más |

**Regla:** una operación cuyo nombre lleva número nunca se une con la versión sin número. Se le da
formato parejo (el número al final: `despunte 1`, `corrida 2`) y las cantidades quedan en plural
(`3 pinzas`, `5 pinzas`), pero siguen siendo entradas propias con su CT. Lo mismo vale para las piezas
(`pretina2`, `solap1` / `solap2`) y para `herraje 1` / `herraje 2`. Lo cubre el test **CAT-13**.

### 11.4 Que no vuelva a ensuciarse

Las equivalencias quedaron en `server/prisma/normalizacion-equipos.ts` y las aplica el **seed** al cargar
el Excel, así que una BD nueva nace limpia: **11 máquinas, 55 procesos, 96 piezas, 8 grupos** (antes
13/63/102/9). Verificado: el catálogo de un seed nuevo es **idéntico** al de la BD del taller después de
las uniones. Las sumas de CT por modelo no cambian y el seed lo sigue validando.

Las claves de esos mapas van normalizadas (minúsculas / MAYÚSCULAS para grupo) y el seed guarda los
textos ya normalizados, porque el Excel escribe "SOLO", "ENTREPI" o "Plancha" sin criterio: así una sola
entrada del mapa cubre todas las variantes de caja.

El **backfill no unifica nada**: deriva el catálogo tal cual dicen las operaciones de la BD. Si unificara,
dejaría huérfanas las operaciones que todavía dicen el nombre viejo.
