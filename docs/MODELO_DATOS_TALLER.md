# Modelo de Datos — Sistema de Pagos del Taller (Fase 1)

> **Propósito**
> Define las **entidades, sus campos y sus relaciones** para la Fase 1 (panel administrativo). Es agnóstico de framework, pero pensado para **PostgreSQL** y mapea limpio a **Prisma** (ver Anexo B).
> Complementa a `CONTEXTO_NEGOCIO_TALLER.md` (reglas) y `FLUJO_SISTEMA_TALLER.md` (pantallas). Ante cualquier duda de negocio, esos dos documentos mandan.
> Moneda: **Bolivianos (Bs)**. Todos los montos con **2 decimales**.

---

## 0. Decisiones de modelado clave (leer primero)

1. **Versionado de modelos.** Un `Modelo` es la prenda; una `ModeloVersion` es una configuración concreta de operaciones/tarifas. Optimizar un modelo = crear una **nueva versión** (copia), conservando la anterior. Un `Corte` referencia **siempre una versión**, no el modelo directo.

2. **Snapshot de operaciones dentro del corte (CRÍTICO).** Al crear un corte, las operaciones de la versión se **copian** a `CorteOperacion` (con su `ct` congelado). Motivo: si mañana editas la tarifa de una versión, los **cortes ya creados no deben cambiar** de monto. El histórico de pagos debe ser inmutable. La `Operacion` (plantilla) es solo el molde; `CorteOperacion` es lo que realmente se paga.

3. **La asignación captura su propia tarifa efectiva.** Cada `Asignacion` guarda `tarifa_efectiva` y `total` ya calculados (no solo referencias). Así el pago es auditable aunque cambien catálogos o el diferencial de maestro externo. El +0.10 se guarda como `diferencial` dentro de la asignación.

4. **Cantidad que se paga = corte + plus.** La cantidad objetivo de cada operación del corte es `suma(corte_por_talla) + suma(plus_por_talla)`. El PLUS **sí se paga**.

5. **El saldo se materializa por período.** El arrastre semana a semana se **calcula** (a partir de cortes cerrados y anticipos por fecha), pero el **cierre mensual** se **persiste** en `Liquidacion` con `saldo_entrada` y `saldo_salida`, para que el arrastre entre meses sea explícito y auditable.

6. **La privacidad por operario es una consulta, no una tabla.** La vista del operario = filtrar todo por `operario_id`. No requiere entidad nueva en Fase 1.

---

## 1. Operario

Persona que costura. El plantel cambia con el tiempo (altas/bajas).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid / serial | PK |
| `nombre` | text | ej. RUBEN, CLARIS |
| `tipo` | enum(`regular`,`maestro_externo`) | maestro externo cobra +diferencial por pieza |
| `activo` | boolean | baja lógica; **nunca** se borra físico (rompe histórico) |
| `fecha_ingreso` | date | |
| `fecha_baja` | date? | null si activo |

**Relaciones:** un operario tiene muchas `Asignacion`, muchos `Anticipo`, muchas `Liquidacion`.
**Regla:** dar de baja = `activo=false` + `fecha_baja`. Sigue apareciendo en cortes/liquidaciones pasadas.

---

## 2. Modelo y ModeloVersion

### 2.1 Modelo (la prenda)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `nombre` | text | ej. `black DOBLE PRET 06` |
| `activo` | boolean | |

**Relaciones:** un `Modelo` tiene muchas `ModeloVersion`.

### 2.2 ModeloVersion (configuración de operaciones/tarifas)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `modelo_id` | fk → Modelo | |
| `numero_version` | int | 1, 2, 3… |
| `notas` | text? | ej. "optimizado: se quitó doble despunte" |
| `costo_mano_obra_prenda` | decimal(10,2) | **derivado** = Σ `ct` de sus operaciones (cachear al guardar) |
| `activa` | boolean | permite marcar la versión vigente |
| `created_at` | timestamp | |

**Relaciones:** una `ModeloVersion` tiene muchas `Operacion` y es referenciada por muchos `Corte`.
**Regla de versionado:** "crear versión" = duplicar todas las `Operacion` de la versión origen en una nueva versión, y luego editar/quitar. La versión origen queda intacta.
**Unicidad:** `(modelo_id, numero_version)` único.

---

## 3. Operacion (plantilla dentro de una versión)

Cada paso de confección del modelo. Es el **molde**; lo que se paga es su copia en `CorteOperacion`.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `modelo_version_id` | fk → ModeloVersion | |
| `orden` | int | orden de aparición (para ordenar la lista) |
| `grupo` | text | TRASEROS, DELANTEROS, ENSAMBLE, CERADO, ACABADO, PRESILLA, PARCHE… |
| `n` | text | número de paso; puede ser decimal ("7.1", "8.2") → **texto**, no número |
| `equipo` | text | máquina (normalizar variantes: over/overlock, rect/recta) |
| `proceso` | text | pinza, urlado, ensamble, cerrado… |
| `pieza` | text? | trasero, bolsillo, pretina… (a veces vacío) |
| `ct` | decimal(10,2) | costo por operación **por pieza** (Bs) |

**Relaciones:** pertenece a una `ModeloVersion`.
**Nota:** `n` es texto porque hay sub-pasos como `7.1`, `5.2`, `3.3`.

---

## 4. Corte (una producción concreta)

En el Excel, cada hoja era un corte. Referencia una versión y congela su cantidad.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `modelo_version_id` | fk → ModeloVersion | qué versión se produce |
| `codigo` | text? | etiqueta legible opcional |
| `tallas` | jsonb | ej. `[28,30,32,34,36,38]` (referencia) |
| `corte_por_talla` | jsonb | ej. `[62,62,62,62,62,62]` (referencia) |
| `plus_por_talla` | jsonb | tallas repetidas para cuadrar docenas (referencia) |
| `cantidad_total` | int | **= Σ corte_por_talla + Σ plus_por_talla**. Es la base de todo el pago |
| `estado` | enum(`borrador`,`abierto`,`cerrado`) | ver máquina de estados |
| `fecha_inicio` | date | |
| `fecha_cierre` | date? | se fija al cerrar; **eje del consolidado** |

**Relaciones:** un `Corte` tiene muchas `CorteOperacion`.
**Reglas:**
- Al pasar de `borrador` → `abierto`, se generan las `CorteOperacion` (snapshot).
- No puede pasar a `cerrado` si alguna `CorteOperacion` está `sin_asignar` o `parcial`.
- `tallas/corte_por_talla/plus_por_talla` son referencia visual; **solo `cantidad_total` entra al cálculo**.

---

## 5. CorteOperacion (snapshot pagable)

Copia congelada de una `Operacion` dentro de un corte. **Esto es lo que realmente se paga.**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `corte_id` | fk → Corte | |
| `operacion_origen_id` | fk → Operacion? | trazabilidad (puede quedar null si la plantilla se borra) |
| `orden` | int | |
| `grupo` | text | copiado |
| `n` | text | copiado |
| `equipo` | text | copiado |
| `proceso` | text | copiado |
| `pieza` | text? | copiado |
| `ct` | decimal(10,2) | **congelado** al crear el corte |
| `cantidad_objetivo` | int | = `cantidad_total` del corte (lo que debe sumar la asignación) |
| `estado` | enum(`sin_asignar`,`parcial`,`asignada`) | derivado de sus asignaciones |

**Relaciones:** tiene de 0 a 3 `Asignacion`.
**Regla de estado:**
- `sin_asignar`: sin asignaciones.
- `parcial`: Σ cantidades ≠ `cantidad_objetivo`.
- `asignada`: Σ cantidades = `cantidad_objetivo` (exacto).

---

## 6. Asignacion (quién hace cuántas piezas de una operación)

Reparto de una `CorteOperacion` entre operarios. Máximo **3** por operación.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `corte_operacion_id` | fk → CorteOperacion | |
| `operario_id` | fk → Operario | |
| `cantidad` | int | piezas asignadas a este operario |
| `es_maestro_externo` | boolean | si aplica el diferencial |
| `diferencial` | decimal(10,2) | 0.00 normal; 0.10 por defecto si maestro externo (editable) |
| `tarifa_efectiva` | decimal(10,2) | **= `ct` (de la CorteOperacion) + `diferencial`** |
| `total` | decimal(10,2) | **= `cantidad` × `tarifa_efectiva`** (redondeado 2 dec.) |

**Relaciones:** pertenece a una `CorteOperacion` y a un `Operario`.
**Reglas:**
- Máx. 3 asignaciones por `corte_operacion_id`.
- `Σ cantidad` de las asignaciones de una operación **debe ser exactamente** `cantidad_objetivo` para que quede `asignada`.
- `tarifa_efectiva` y `total` se guardan calculados (no solo derivados en runtime) para auditabilidad.

---

## 7. Anticipo

Adelanto de dinero a un operario.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `operario_id` | fk → Operario | |
| `fecha` | date | normalmente sábado; puede haber emergencias entre semana |
| `monto` | decimal(10,2) | libre; si supera el tope → **advertencia**, no bloqueo |
| `nota` | text? | ej. "emergencia" |

**Relaciones:** pertenece a un `Operario`.
**Regla:** puede haber **varios por semana** por operario.

---

## 8. Periodo y Liquidacion (consolidado y cierre)

### 8.1 Periodo (mes)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `anio` | int | |
| `mes` | int | 1–12 |
| `estado` | enum(`abierto`,`cerrado`) | |
| `fecha_cierre` | date? | cuando se liquida el mes |

**Unicidad:** `(anio, mes)` único.

### 8.2 Liquidacion (por operario y período)
Materializa el cierre mensual y hace explícito el arrastre entre meses.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `periodo_id` | fk → Periodo | |
| `operario_id` | fk → Operario | |
| `saldo_entrada` | decimal(10,2) | arrastre del mes anterior (0 normalmente; puede ser negativo) |
| `total_ganado` | decimal(10,2) | Σ de `Asignacion.total` en cortes **cerrados** cuya `fecha_cierre` cae en el período |
| `total_anticipos` | decimal(10,2) | Σ de `Anticipo.monto` del operario en el período |
| `saldo_periodo` | decimal(10,2) | **= `saldo_entrada` + `total_ganado` − `total_anticipos`** |
| `pagado` | decimal(10,2) | monto efectivamente liquidado en el cierre |
| `arrastra_saldo` | boolean | true en la excepción (viaje/ahorro/urgencia) |
| `saldo_salida` | decimal(10,2) | 0 si se liquidó todo; si `arrastra_saldo`, = saldo no cobrado (pasa a `saldo_entrada` del siguiente) |

**Relaciones:** una por `(periodo, operario)`. **Unicidad:** `(periodo_id, operario_id)`.
**Reglas:**
- **Ganado por período:** solo cortes en estado `cerrado` con `fecha_cierre` dentro del mes (un corte a medias no se paga aún).
- **Saldo semanal (vista):** se calcula agrupando cortes cerrados y anticipos por fecha (semana lunes–sábado). No requiere tabla; es una consulta de la vista de Liquidación.
- **Cierre de mes:** por defecto `pagado = saldo_periodo` y `saldo_salida = 0`. Excepción `arrastra_saldo=true`: `saldo_salida = saldo_periodo − pagado`, que se copia a `saldo_entrada` del siguiente período.
- **Saldo negativo** (se adelantó de más): se arrastra igual como `saldo_entrada` negativo del siguiente período.

---

## 9. Configuracion (parámetros del taller)

Tabla de una sola fila (o clave-valor).

| Campo | Tipo | Default |
|---|---|---|
| `tope_anticipo_advertencia` | decimal(10,2) | 2000.00 |
| `diferencial_maestro_externo` | decimal(10,2) | 0.10 |
| `redondeo_decimales` | int | 2 |
| `nombre_taller` | text | |

> **Alimentación NO se modela en Fase 1** (es costo del taller aparte; no afecta pagos). Se deja para una fase posterior.

---

## 10. Mapa de relaciones (resumen)

```
Modelo 1──* ModeloVersion 1──* Operacion
                    │
                    * (referenciada por)
                    ▼
                  Corte 1──* CorteOperacion 1──*(máx 3) Asignacion *──1 Operario
                                                                         │
Operario 1──* Anticipo                                                   │
Operario 1──* Liquidacion *──1 Periodo                                   │
                    ▲───────────────────────────────────────────────────┘
                (Liquidacion.total_ganado se calcula desde Asignacion de cortes cerrados)
```

---

## 11. Índices y validaciones sugeridos

- Índices: `Corte(estado, fecha_cierre)`, `Asignacion(operario_id)`, `Anticipo(operario_id, fecha)`, `CorteOperacion(corte_id, estado)`.
- Únicos: `ModeloVersion(modelo_id, numero_version)`, `Periodo(anio, mes)`, `Liquidacion(periodo_id, operario_id)`.
- Check: `Asignacion.cantidad > 0`; máx. 3 asignaciones por `corte_operacion_id` (validar en servicio + índice/constraint).
- Todos los `decimal` con escala 2. Redondear en cada `total` (banker's o half-up, definir uno y ser consistente — ver criterios de aceptación).

---

## Anexo A — Sobre la privacidad por operario
La "Rendición de cuentas" y la futura app del operario se resuelven filtrando por `operario_id` en:
`Asignacion` (sus operaciones y totales) → `CorteOperacion` → `Corte`; más sus `Anticipo` y su `Liquidacion`. Nunca se exponen datos de otros operarios. En Fase 2, el login del operario simplemente fija ese `operario_id`.

---

## Anexo B — Esquema Prisma sugerido (implementación)

> Sugerencia concreta para PostgreSQL. El agente puede ajustarla, pero refleja el modelo de arriba.

```prisma
enum TipoOperario { regular maestro_externo }
enum EstadoCorte { borrador abierto cerrado }
enum EstadoCorteOp { sin_asignar parcial asignada }
enum EstadoPeriodo { abierto cerrado }

model Operario {
  id            String   @id @default(uuid())
  nombre        String
  tipo          TipoOperario @default(regular)
  activo        Boolean  @default(true)
  fechaIngreso  DateTime @default(now())
  fechaBaja     DateTime?
  asignaciones  Asignacion[]
  anticipos     Anticipo[]
  liquidaciones Liquidacion[]
}

model Modelo {
  id        String @id @default(uuid())
  nombre    String
  activo    Boolean @default(true)
  versiones ModeloVersion[]
}

model ModeloVersion {
  id                   String @id @default(uuid())
  modelo               Modelo @relation(fields: [modeloId], references: [id])
  modeloId             String
  numeroVersion        Int
  notas                String?
  costoManoObraPrenda  Decimal @db.Decimal(10,2) @default(0)
  activa               Boolean @default(true)
  createdAt            DateTime @default(now())
  operaciones          Operacion[]
  cortes               Corte[]
  @@unique([modeloId, numeroVersion])
}

model Operacion {
  id               String @id @default(uuid())
  version          ModeloVersion @relation(fields: [modeloVersionId], references: [id])
  modeloVersionId  String
  orden            Int
  grupo            String
  n                String
  equipo           String
  proceso          String
  pieza            String?
  ct               Decimal @db.Decimal(10,2)
}

model Corte {
  id               String @id @default(uuid())
  version          ModeloVersion @relation(fields: [modeloVersionId], references: [id])
  modeloVersionId  String
  codigo           String?
  tallas           Json
  cortePorTalla    Json
  plusPorTalla     Json
  cantidadTotal    Int
  estado           EstadoCorte @default(borrador)
  fechaInicio      DateTime @default(now())
  fechaCierre      DateTime?
  operaciones      CorteOperacion[]
  @@index([estado, fechaCierre])
}

model CorteOperacion {
  id                String @id @default(uuid())
  corte             Corte @relation(fields: [corteId], references: [id])
  corteId           String
  operacionOrigenId String?
  orden             Int
  grupo             String
  n                 String
  equipo            String
  proceso           String
  pieza             String?
  ct                Decimal @db.Decimal(10,2)
  cantidadObjetivo  Int
  estado            EstadoCorteOp @default(sin_asignar)
  asignaciones      Asignacion[]
  @@index([corteId, estado])
}

model Asignacion {
  id                String @id @default(uuid())
  corteOperacion    CorteOperacion @relation(fields: [corteOperacionId], references: [id])
  corteOperacionId  String
  operario          Operario @relation(fields: [operarioId], references: [id])
  operarioId        String
  cantidad          Int
  esMaestroExterno  Boolean @default(false)
  diferencial       Decimal @db.Decimal(10,2) @default(0)
  tarifaEfectiva    Decimal @db.Decimal(10,2)
  total             Decimal @db.Decimal(10,2)
  @@index([operarioId])
}

model Anticipo {
  id         String @id @default(uuid())
  operario   Operario @relation(fields: [operarioId], references: [id])
  operarioId String
  fecha      DateTime
  monto      Decimal @db.Decimal(10,2)
  nota       String?
  @@index([operarioId, fecha])
}

model Periodo {
  id            String @id @default(uuid())
  anio          Int
  mes           Int
  estado        EstadoPeriodo @default(abierto)
  fechaCierre   DateTime?
  liquidaciones Liquidacion[]
  @@unique([anio, mes])
}

model Liquidacion {
  id             String @id @default(uuid())
  periodo        Periodo @relation(fields: [periodoId], references: [id])
  periodoId      String
  operario       Operario @relation(fields: [operarioId], references: [id])
  operarioId     String
  saldoEntrada   Decimal @db.Decimal(10,2) @default(0)
  totalGanado    Decimal @db.Decimal(10,2) @default(0)
  totalAnticipos Decimal @db.Decimal(10,2) @default(0)
  saldoPeriodo   Decimal @db.Decimal(10,2) @default(0)
  pagado         Decimal @db.Decimal(10,2) @default(0)
  arrastraSaldo  Boolean @default(false)
  saldoSalida    Decimal @db.Decimal(10,2) @default(0)
  @@unique([periodoId, operarioId])
}

model Configuracion {
  id                        Int @id @default(1)
  topeAnticipoAdvertencia   Decimal @db.Decimal(10,2) @default(2000)
  diferencialMaestroExterno Decimal @db.Decimal(10,2) @default(0.10)
  redondeoDecimales         Int @default(2)
  nombreTaller              String?
}
```
