# Servicio de corte interno y roles de operario

> **Estado:** **implementado completo** y verificado el 2026-10-01 (rebanadas 1–6: roles, tarifas, modelos, corte interno, liquidación/rendición/inicio y corte 23).
> Tarifa de respaldo de corte por persona: Bs 0.15. Buscador de baja: no cobra en cortes nuevos (confirmado).
> **Amplía el alcance:** `CONTEXTO_NEGOCIO_TALLER.md` §1.1 dejaba el trazado y el corte físico fuera de
> Fase 1. El dueño decide incluirlos. Al implementar se actualizan ese documento y `CLAUDE.md` (§2 e
> invariantes 5 y 10, ver §8).

---

## 1. Qué resuelve

Hoy el sistema solo paga la **costura**. Antes de coser, el taller hace un servicio de corte interno con
seis procesos que también se pagan, cada uno con su tarifa y su gente:

| # | Proceso | Quién | Cuántos | Cómo se paga (predeterminado) |
|---|---|---|---|---|
| 1 | Búsqueda del modelo | buscador de diseño | 1 (del modelo) | Bs 0.10 × prenda, **en cada corte** del modelo |
| 2 | Moldes / patronaje | creador de moldes | 1 | Bs 200 modelo nuevo · Bs 50 modificación (**una vez**, en Modelos) |
| 3 | Trazado (Audaces) | trazador | 1 | Bs 0.30 × prenda, en cada corte (aunque se reutilice el trazado) |
| 4 | Doblado de tela | dobladores | **exactamente 2** | por hoja/cara Bs 0.15 × prenda · por pares Bs 0.10 × prenda; **mitad y mitad** |
| 5 | Corte de tela | cortadores | 1 a 3 | **tarifa propia de cada cortador** × prenda (ej. 0.25 + 0.15 + 0.10) |
| 6 | Clasificación y codificación | clasificadores | 1 a 2 | **tarifa propia de cada uno** × prenda (ej. 0.10) |

"Prenda" = **cantidad total del corte, PLUS incluido** (la misma base que la costura).

## 2. Decisiones del dueño (respuestas 1–32 y ronda final)

1. **Corte interno o externo.** Cada corte tiene la casilla *Corte interno* (por defecto sí). Un corte
   externo (llega cortado de afuera, poco común) **no paga ninguno** de los procesos, ni la búsqueda.
2. **Tarifas predeterminadas en Configuración**, y al crear el corte se **copian** al corte (snapshot,
   como el CT). Cambiar Configuración después no altera cortes ya creados. En cada corte se editan
   mientras no esté cerrado. Predeterminado **solo general** (no por modelo).
3. **Tarifa personal de cortadores y clasificadores**: vive en la **ficha del operario** (depende de su
   habilidad/velocidad). Al elegirlo en un corte se precarga la suya y se puede editar ahí. Si no tiene,
   se usa el valor de respaldo de Configuración.
4. **Diferencial de maestro externo:** solo costura, no aplica a estos procesos.
5. **Cuándo cobra:** en la **fecha en que se terminó cada proceso** (no al cerrar el corte), porque el
   corte se cierra semanas después cuando termina la costura. La búsqueda usa la fecha del proceso de
   **corte**. Los moldes, la fecha en que se registran. Igual que los anticipos, no se puede registrar ni
   cambiar un proceso con fecha en un mes ya liquidado.
6. **Mismo saldo:** todo entra a la misma liquidación del operario (ganado − anticipos, arrastre).
7. **Cerrar un corte interno exige los procesos completos:** trazado (1), doblado (2), corte (1–3),
   clasificación (1–2) y la búsqueda resuelta (ver 8).
8. **Búsqueda:** el modelo registra **quién lo buscó** o se marca explícitamente **"sin buscador"**
   (modelos que ya existían o que trajo el cliente): entonces no se paga y no bloquea. Mientras no se
   elija ninguna de las dos, un corte interno de ese modelo no se puede cerrar.
9. **Moldes:** al crear un modelo, casilla *"Moldes hechos en el taller"* + quién + fecha → Bs 200. Al
   crear una versión nueva, casilla *"¿Se modificaron los moldes?"* → Bs 50 (si la versión solo cambió
   tarifas, no se paga). **Nada retroactivo** para los 6 modelos existentes.
10. **Medio centavo del doblado:** se calcula el total exacto del proceso y el centavo sobrante va al
    **primer doblador anotado**. Ej.: 721 × 0.15 = Bs 108.15 → **54.08 + 54.07** (nunca 108.16).
11. **Costos separados en el corte:** *costo de costura* · *costo del servicio de corte interno* ·
    *costo total del corte*.
12. **Rendición de cuentas separada por tipo de trabajo:** costura, servicio de corte (por proceso) y
    moldes, para que no se mezclen las pagas.
13. **Clasificación/codificación:** por ahora solo se registra quién lo hizo y se le paga (sin
    etiquetas). **Trazado:** solo se registra el largo (ya existe `trazadoCm`).
14. **Bordado, lavado y empaque** son proveedores de servicios: **fuera** por ahora.

## 3. Roles de operario

Siete oficios: **costurero, cortador, doblador, creador de moldes, buscador de diseño, trazador,
clasificador/codificador.**

- Un operario puede tener **varios** roles.
- **Restricción estricta:** en cada selector solo aparecen los operarios activos con ese rol, incluida
  la asignación de costura (solo costureros). La API lo valida igual, no solo la pantalla.
- *Maestro externo* **no es un rol**: sigue siendo el *tipo* que cambia la tarifa de costura.
- **Migración:** los 36 operarios actuales quedan como **costurero**; el dueño ajusta el resto.
- Ficha del operario: roles (chips) + tarifa personal de corte y/o clasificación (visible si tiene el rol).

## 4. Modelo de datos

```
enum RolOperario { costurero cortador doblador moldista buscador trazador clasificador }
enum ProcesoCorte { busqueda trazado doblado corte clasificacion }
enum ModalidadDoblado { hoja pares }
enum TipoMolde { nuevo modificacion }

Operario        + roles RolOperario[] @default([costurero])
                + tarifaCorte Int?           // centavos/prenda, personal
                + tarifaClasificacion Int?

Configuracion   + tarifaBusqueda Int @default(10)
                + tarifaMoldeNuevo Int @default(20000)
                + tarifaMoldeModificacion Int @default(5000)
                + tarifaTrazado Int @default(30)
                + tarifaDobladoHoja Int @default(15)    // total del proceso, se reparte en 2
                + tarifaDobladoPares Int @default(10)
                + tarifaCorteRespaldo Int               // por persona, si no tiene tarifa propia
                + tarifaClasificacionRespaldo Int @default(10)

Modelo          + buscadorId String?  (→ Operario)
                + sinBuscador Boolean @default(false)

PagoMolde       id, modeloVersionId, operarioId, tipo TipoMolde, monto Int, fecha DateTime

Corte           + esInterno Boolean @default(true)
                + tarifaBusqueda Int?, tarifaTrazado Int?, tarifaDoblado Int?   // snapshot
                + modalidadDoblado ModalidadDoblado?
                − cortadorId, − dobladores (los absorbe TrabajoCorte)
                  tela, anchoCm, trazadoCm se quedan como datos del corte;
                  fechaCorte pasa a ser la fecha del proceso "corte".

TrabajoCorte    id, corteId, proceso ProcesoCorte, operarioId, orden Int,
                tarifa Int,      // centavos/prenda que aplica a esa persona (doblado: la del proceso)
                cantidad Int,    // prendas del corte
                total Int,       // centavos, fijado al guardar (inmutable como Asignacion.total)
                fecha DateTime   // cuándo se terminó: define la semana/mes en que se paga
```

Todo dinero en **centavos enteros**; cada `total` se fija una sola vez (CLAUDE.md §7).

## 5. Pantallas

- **Operarios:** chips de roles en alta/edición y en la tabla; tarifas personales; filtro por rol.
- **Configuración:** sección *"Tarifas del servicio de corte"* con los 8 valores.
- **Modelos:** buscador del modelo (o "sin buscador"); al crear modelo o versión, los moldes.
- **Nuevo corte:** casilla *Corte interno* (si está marcada se ven los procesos); la tarjeta *Datos del
  tendido* se convierte en la tarjeta *Servicio de corte interno*.
- **Detalle del corte:** una tarjeta por proceso (personas, tarifa de cada una, fecha, subtotal) con
  *Editar* mientras no esté cerrado; tres totales: costura · servicio de corte · total. *Cerrar corte*
  explica qué proceso falta.
- **Liquidación / Rendición / Inicio:** el ganado suma costura + servicio de corte + moldes, con desglose
  por tipo. La rendición muestra cada tipo en su propia sección.

## 6. Reglas que validan la API (y sus tests)

| Regla | Ejemplo / test |
|---|---|
| Doblado: exactamente 2, rol doblador, reparto con centavo al primero | 721 hoja → 54.08 + 54.07; 1000 pares → 50.00 + 50.00 |
| Corte: 1–3 cortadores, cada uno su tarifa | 1000 × (0.25, 0.15, 0.10) → 250.00 + 150.00 + 100.00 = 500.00 |
| Trazado: 1 trazador | 721 × 0.30 = 216.30 |
| Clasificación: 1–2, cada uno su tarifa | 721 × 0.10 = 72.10 |
| Búsqueda: del buscador del modelo, fecha del proceso corte | 721 × 0.10 = 72.10; "sin buscador" → 0 y no bloquea |
| Moldes: 200 nuevo / 50 modificación, una vez | versión nueva sin casilla → no paga |
| Rol obligatorio en cada selector (y costurero en asignaciones) | cortador sin rol → 409 |
| Corte externo: ningún trabajo | intentar cargar uno → 409 |
| Snapshot de tarifas | cambiar Configuración no cambia un corte ya creado |
| Cierre de corte interno exige procesos completos | falta clasificación → no cierra |
| Fecha en mes liquidado bloqueada | igual que anticipos (MES_LIQUIDADO) |
| Ganado por fecha del trabajo, mismo saldo | trabajo del día 10 cuenta en la semana del 10 aunque el corte cierre el 30 |
| Privacidad (CA-7) | la rendición de un operario solo trae SUS trabajos |
| Historial para eliminar | quien tiene trabajos o moldes no se puede eliminar |

## 7. Orden de construcción (rebanadas, cada una con sus tests en verde)

1. **Roles** en operarios + restricción "costurero" en asignaciones + tarifas personales.
2. **Tarifas** en Configuración.
3. **Modelos:** buscador / sin buscador + pagos de moldes.
4. **Corte interno:** snapshot de tarifas, procesos y su gente, reemplazo de cortador/dobladores del
   tendido, costos separados, condición de cierre.
5. **Liquidación, Rendición e Inicio** con el ganado nuevo y su desglose.
6. **Corte 23** (CLASICO, abierto): se marca interno con las tarifas de Configuración; hay que cargarle
   sus procesos antes de poder cerrarlo.

## 8. Cambios a las reglas del sistema (CLAUDE.md §6)

- **Invariante 5** pasa a ser: *el ganado de costura sale solo de cortes cerrados por `fechaCierre`;
  el del servicio de corte y los moldes, por la fecha del trabajo.*
- **Invariante 10:** el historial que impide eliminar un operario incluye trabajos de corte y moldes.
- **§2 Alcance:** el servicio de corte interno pasa a estar dentro.

## 9. Bitácora

- **2026-10-01 — Rebanada 1 (roles).** Enum `RolOperario` + `Operario.roles` (default costurero: los 36
  existentes quedaron así), `tarifaCorte` / `tarifaClasificacion` personales. `GET /operarios?rol=`.
  La API exige el rol: costurero para asignar costura (`OPERARIO_SIN_ROL`, 409), cortador / doblador en
  el tendido actual (que la rebanada 4 reemplaza por procesos pagados). Al editar el tendido solo se
  exige el rol a las personas que se agregan. UI: chips de roles y tarifas en la ficha, columna y filtro
  por rol, selectores filtrados. Migración `20261001120000_operario_roles`.
- **2026-10-01 — Rebanada 2 (tarifas).** 8 columnas en `Configuracion` con los predeterminados del dueño
  (búsqueda 0.10, moldes 200 / 50, trazado 0.30, doblado hoja 0.15 / pares 0.10 totales, respaldo de corte
  0.15 y de clasificación 0.10). `CLAVES_TARIFA_CORTE` en shared es la única lista que usan API y pantalla.
  Configuración tiene la sección "Tarifas del servicio de corte interno". Todavía no se usan: el snapshot
  al corte llega en la rebanada 4. Migración `20261001130000_configuracion_tarifas_corte`.
- **2026-10-01 — Rebanada 3 (modelos).** `Modelo.buscadorId` / `sinBuscador` (ninguno = pendiente) y
  `PagoMolde` (uno por versión; v1 = nuevo, otras = modificación; monto de Configuración editable;
  no se copia al versionar). API: `PATCH /modelos/:id/buscador`, `PUT|DELETE /versiones/:id/molde`, y
  `buscadorId` / `sinBuscador` / `molde` opcionales al crear modelo o versión. Rol exigido (buscador,
  creador de moldes) solo a quien se agrega; fecha en mes liquidado bloqueada (también para corregir o
  quitar un pago ya hecho). Buscador o moldes cuentan como historial del operario. Validación de roles
  movida a `operarios/habilitados.ts` (la usan cortes y modelos). UI: tarjeta "Diseño" en el detalle
  de versión, sección en Nuevo modelo, casilla en Nueva versión, columna "Búsqueda" en el listado.
  Los moldes **todavía no entran a la liquidación** (rebanada 5). Migración
  `20261001140000_modelo_buscador_moldes` (incidente: el SQL generado traía por error la salida de
  `prisma validate`; falló solo en la BD de test, se limpió y se marcó `--rolled-back` allí).
- **2026-10-01 — Rebanada 4 (corte interno).** `Corte.esInterno` + snapshot de las 6 tarifas por prenda
  al crearlo + `modalidadDoblado`; `TrabajoCorte` (una fila por persona y proceso, `total` fijado,
  `fecha` = cuándo se terminó). Se eliminan `cortadorId`, `_CorteDobladores` y `fechaCorte` del tendido
  (quedan tela / ancho / trazado). API: `PUT|DELETE /cortes/:id/procesos/:proceso` (reemplaza el set
  completo del proceso) y `PATCH /cortes/:id/servicio` (interno ↔ externo). Reglas en
  `shared/servicioCorte.ts` (personas por proceso, rol, tarifa por persona, `repartirDoblado`) y
  `cortes/servicio.ts`. Búsqueda automática al registrar el corte si el modelo tiene buscador activo;
  **buscador de baja no cobra en cortes nuevos ni bloquea** (sugerencia aceptada por omisión). Cierre de
  un corte interno exige el servicio completo (`SERVICIO_INCOMPLETO`). Detalle del corte: tres costos
  (costura · servicio · total) y una tarjeta por proceso con vista previa del pago. Migración
  `20261001150000_servicio_corte_interno`: cortes cerrados → externos, abiertos → internos con las
  tarifas de Configuración. **Datos que se perdieron del corte 23** (respaldo en
  `server/backups/taller_pagos_antes_servicio_corte_20261001.sql`): cortador RONALD, doblador IGNACIO,
  fecha de corte 16/07/2026 — no se convirtieron en pagos; se registran en los procesos.
  Los trabajos **todavía no entran a la liquidación** (rebanada 5).
- **2026-10-01 — Rebanada 5 (liquidación, rendición, inicio).** Ganado = costura (cortes cerrados por
  `fechaCierre`) + servicio de corte (`TrabajoCorte.fecha`) + moldes (`PagoMolde.fecha`), con desglose
  por operario, por semana y en totales. Al cerrar el mes se persisten `Liquidacion.ganadoServicioCorte`
  y `ganadoMoldes` (costura = totalGanado − ambos), así los meses cerrados también muestran el
  desglose. El orden de cierre de meses cuenta trabajos y moldes como movimientos. Rendición: secciones
  separadas Costura / Servicio de corte / Moldes; el doblador ve solo su mitad (sin nombre ni parte del
  compañero). Planilla de liquidación con columnas Costura · Servicio de corte · Moldes · Ganado. Inicio:
  "Total a pagar" ya incluye todo. Migración `20261001160000_liquidacion_desglose_ganado`. Tests:
  `liquidacion-servicio.test.ts` (mes completo de marzo 2031 con los números del dueño).
- **Rebanada 6 (corte 23)** quedó resuelta en la migración de la rebanada 4: interno con las tarifas de
  Configuración; falta que el dueño registre sus procesos.
