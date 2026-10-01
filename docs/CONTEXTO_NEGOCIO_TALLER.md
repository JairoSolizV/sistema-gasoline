# Contexto de Negocio — Sistema de Cálculo de Pagos para Taller de Confección

> **Propósito de este documento**
> Este archivo describe, en detalle y paso a paso, el negocio y las reglas operativas de un taller de confección, con el fin de que cualquier agente de IA (Claude Code, Antigravity u otros) que vaya a construir el sistema entienda el dominio **sin necesidad de explicación adicional**.
> Este documento **NO** define tablas de base de datos ni relaciones. Solo define el **contexto de negocio, el vocabulario del dominio, las entidades conceptuales y las reglas de cálculo**. El modelado de datos es un paso posterior.
> Moneda de todo el sistema: **Bolivianos (Bs)**.

---

## 1. Descripción general del negocio

Es un **taller de confección de prendas** (pantalones, shorts, faldas-short, etc.) ubicado en Bolivia. El taller produce prendas por **lotes**, empleando a **varios operarios** que trabajan en distintas **máquinas de costura**, ejecutando distintos **procesos** sobre distintas **piezas** de cada prenda.

El objetivo de la herramienta a construir (**Fase 1**) es **calcular cuánto se le debe pagar a cada operario** según el trabajo que realmente costuró, y **consolidar** esos pagos por semana y por mes, cruzándolos con los anticipos que cada operario solicita.

### 1.1 Flujo de producción previo a la costura (contexto, NO se calcula)

Antes de costurar, ocurre el proceso de corte de tela:

1. Se **trazan los moldes** de la prenda en computadora.
2. Los moldes se **imprimen en un plotter**.
3. Se colocan encima de **muchos dobleces de tela** (rollos de aproximadamente **6 a 10 metros de largo × 2 metros de ancho**).
4. De ahí se sacan **muchísimos cortes de piezas** (una misma pieza se corta cientos de veces).
5. Esas piezas cortadas pasan a **costura**, que es donde entra el cálculo de pagos.

> ~~Este flujo se documenta solo como contexto. El sistema **no** modela el trazado ni el corte físico de tela; empieza a operar en la etapa de **costura y pago**.~~
> **Actualización 2026-10-01 (decisión del dueño):** el servicio de corte interno —búsqueda del modelo, moldes/patronaje, trazado, doblado de tela, corte y clasificación/codificación de piezas— ahora **sí se modela y se paga**, con roles de operario y tarifas configurables. Reglas completas en `docs/PLAN_SERVICIO_CORTE.md`.

---

## 2. Vocabulario del dominio

El sistema usa un vocabulario específico del rubro. Los agentes deben respetar estos términos tal cual.

### 2.1 Máquinas / Equipos (campo `EQUIPO`)
Ejemplos observados: `recta`, `codo`, `plana`, `plancha`, `over`, `overlock`, `cerradora`, `piquete`, `collareta`, `atracadora` (a veces escrita `atraque`), `pretina`, `tijera`.

> Nota: en los datos reales hay variaciones ortográficas (`over`/`overlock`/`overloc`, `atraque`/`atracadora`, `rect`/`recta`). El sistema debería **normalizar** estos nombres a un catálogo limpio de máquinas.

### 2.2 Procesos (campo `PROCESO`)
Ejemplos: `pinza`, `urlado`, `boca`, `planchado`, `parchado`, `overeado`, `refuerzo`, `despunte`, `herraje 1`, `herraje 2`, `medio`, `pegado`, `presilla`, `pasador`, `corte`, `atraque`, `jota`, `ensamble`, `cerrado`, `cintura`, `safado`, `union`, `asegurado`, `boteado`, `caracol`, etc.

### 2.3 Piezas (campo `PIEZA`)
Ejemplos: `trasero`, `delantero`, `cuerpo`, `vista derecha/izquierda`, `vista cuerpo`, `bolsillo`, `talla`, `aleta`, `contra`, `lateral`, `entrepierna` (`entrep`), `pretina`, `solapa`, `presilla`, `tapa`, `medio`, `reloj`, `herraje`, etc.

### 2.4 Grupos / Bloques de operaciones (campo `PR` o `GRUPO`)
Cada prenda organiza sus operaciones en **grupos** (bloques lógicos de la confección). Grupos observados:
`TRASEROS`, `DELANTEROS`, `ENSAMBLE`, `CERADO` (cerrado), `ACABADO`, `PRESILLA`, `PARCHE`, `SOLAPA`, `ENCAJONADO`, `EXTRAS`.

> Los grupos son importantes porque la **asignación de trabajo** suele hacerse por grupo completo (ver Sección 6).

---

## 3. Entidades conceptuales del dominio

A continuación se describen las entidades **conceptualmente** (sin esquema de datos). Cada una lista sus atributos y su rol en el negocio.

### 3.1 Operario
La persona que costura. Atributos relevantes:

- **Nombre** (ej. RUBEN, CLARIS, MARIO, ALEX, PABLO, TEO, CARLA, LOREN, ROSA, JOSE, ANDRE, SEBAS, CHEMA…).
- **Tipo de operario**:
  - **Regular**: parte del equipo estable del taller. Cobra la **tarifa base** de cada operación.
  - **Maestro externo / staff de apoyo**: personal experto que se llama **puntualmente** para acelerar la producción. Cobra la tarifa base **+ 0.10 Bs por pieza** (ver Regla 5.6).
- **Estado**: el plantel **cambia con el tiempo** (se contrata gente nueva, algunos se van). El sistema debe permitir **agregar y dar de baja** operarios. Un corte solo involucra a los operarios que efectivamente trabajaron en él.

### 3.2 Modelo (de prenda)
Una definición reutilizable de una prenda. Ejemplos reales: `black DOBLE PRET 06`, `black SHORT 16`, `black SH FALD 20`, `CRUDO SHORT`, `SHORT 2 PRETIN`.

- Un modelo tiene una **lista fija y ordenada de operaciones** (ver 3.3), cada una con su **tarifa por pieza**.
- Las **tarifas dependen del modelo** (la misma operación cuesta distinto en modelos distintos, según la complejidad de la prenda). Ejemplo: `ensamble delantero (plana)` cuesta 0.5 en un modelo, 0.7 en otro (`SH FALD`) y 0.8 en otro (`SHORT 2 PRETIN`).
- Un modelo se **reutiliza según la demanda del cliente** (máximo ~2 veces al mes). Al reutilizarse, **los precios de las operaciones NO cambian**.
- **Versionado por optimización** (decisión de diseño acordada — ver Sección 8): a veces, la **segunda vez** que se produce un modelo, el taller se da cuenta de que puede **ahorrar tiempo y dinero** acortando o eliminando procesos. Cuando esto ocurre, se crea una **nueva versión del modelo** (v1, v2, …), que es una **copia** del modelo con menos/distintas operaciones. Esto conserva el histórico y permite armar la versión nueva rápido, quitando operaciones. **No** es un modelo nuevo desde cero.

### 3.3 Operación
Cada renglón/paso de la confección dentro de un modelo. Atributos:

- **Grupo** (`PR`): a qué bloque pertenece (TRASEROS, DELANTEROS, etc.).
- **N**: número de paso dentro del grupo. Puede tener **sub-pasos** decimales (ej. `7.1`, `7.2`, `8.1`, `3.3`).
- **Equipo** (máquina).
- **Proceso**.
- **Pieza**.
- **CT** = **costo por operación, por pieza** (en Bs). Es lo que se le paga al operario por ejecutar esa operación **una vez** (sobre una pieza). Ejemplo: `pinza / trasero / recta = 0.15 Bs por pieza`.

> **Definición clave de CT**: `CT` es el **costo por operación (por pieza)**. La **suma de todos los CT de un modelo** = **costo de mano de obra por prenda completa**. Ejemplo real: en `black DOBLE PRET 06`, la suma de todos los CT = **8.1 Bs**, que es lo que cuesta (en mano de obra) costurar una prenda completa de ese modelo.

### 3.4 Corte (producción / lote)
Una **producción concreta** de un modelo. En el Excel original, **cada hoja es un corte**. Atributos:

- **Modelo** (y versión) que se está produciendo.
- **Cantidad total del corte**: número total de prendas que salen del corte. Se obtiene sumando la cantidad cortada por talla. Ejemplos reales: 372, 234, 174.
- **Desglose por talla** (referencia de producción, **NO entra al cálculo** — ver 5.2 y Regla 7):
  - `TALLA`: las tallas (28, 30, 32, 34, 36, 38, …).
  - `CORTE`: cuántas piezas se cortaron por cada talla (ej. 62 por talla × 6 tallas = 372).
  - `PLUS`: tallas **extra/repetidas** para cuadrar docenas (ver 5.2).
  - `TOTAL`: total por talla.
- **Fecha de cierre / liquidación**: fecha en la que el corte se da por terminado/liquidado. **Es el eje sobre el que se agrupan los pagos** (ver Sección 7). Un corte puede tomar **una, dos o más semanas** (incluso ~15 días); no se fuerza "un corte por semana".
- **Asignaciones**: qué operario(s) hicieron cada operación y en qué cantidad (ver Sección 6).

### 3.5 Anticipo
Dinero que un operario **pide por adelantado**, a cuenta de lo que va ganando. Atributos:

- **Operario**.
- **Fecha**.
- **Monto** (libre, pero con un **tope de referencia** — ver Regla 9.3).
- Contexto: normalmente se piden **los sábados**, pero puede haber **anticipos de emergencia entre semana**. Es decir, **puede haber más de un anticipo por semana** para un mismo operario.

### 3.6 Alimentación (costo del taller — fuera del cálculo de pago)
El taller registra un gasto de **alimentación** por operario (observado: **40 Bs/día** de lunes a viernes, **20 Bs** el sábado; ~960 Bs/mes por persona en un mes tipo).

- **La alimentación es un costo del taller APARTE**. **NO** se descuenta del pago del operario y **NO** afecta su saldo.
- En la Fase 1 queda **fuera del cálculo de pago**. A lo sumo se registra como gasto del taller en una fase posterior.

---

## 4. La planilla original (referencia de la fuente de datos)

Los datos actuales viven en Excel. Cada hoja = un corte. La hoja tiene **dos bloques**:

### 4.1 Bloque izquierdo — Tabla de operaciones y asignación
Columnas (encabezados reales):

`PR` | `N` | `EQUIPO` | `PROCESO` | `PIEZA` | `CT` | `PERSONAL` | `CANTIDAD` | `TOTAL` | `PERSONAL` | `CANTIDAD` | `TOTAL` | `PERSONAL` | `CANTIDAD` | `TOTAL` | `TOTAL GENERAL` | `OBSERVACIONES`

- Hay **tres bloques repetidos** de `PERSONAL / CANTIDAD / TOTAL`. Existen exactamente para poder **partir una misma operación entre hasta 3 operarios** (ej. uno costura 300 piezas de un paso y otro las 50 restantes).
- `TOTAL` (de cada bloque) = `CANTIDAD × CT`.
- `TOTAL GENERAL` = suma de los TOTAL de los (hasta) 3 operarios de esa fila.
- En la cabecera de esta tabla aparece un resumen: `CANTIDAD` del corte, la **suma de CT** (costo de mano de obra por prenda) y el **COSTO TOTAL** del corte (= cantidad × suma de CT). Ejemplo DOBLE PRET: 372 × 8.1 = **3013.2 Bs**.

### 4.2 Bloque derecho — "PLANILLA DE TRABAJOS REALIZADOS, PAGOS Y ANTICIPOS"
Columnas:

`PERSONAL` | `CANTIDAD X PIEZA` | `TOTAL GANADO` | `ANTICIPO` | `SALDO` | `OBSERVACION`

- Consolida, **por operario**, cuántas piezas trabajó y cuánto ganó, cruzándolo con anticipos, para obtener el **SALDO**.
- En el Excel esto arrastra saldos **semana a semana y mes a mes** (ver Sección 7). Ejemplo real: en `SHORT 2 PRETIN`, CHEMA aparece con ganado 243.6, anticipo 500 → **saldo −256.4** (se le adelantó más de lo que ganó en ese corte).

> Los agentes deben tratar el Excel como la **fuente histórica** a reemplazar/migrar, no como el diseño final.

---

## 5. Reglas de negocio — Modelos, operaciones y cortes

**Regla 5.1 — Moneda.** Todo el sistema opera en **Bolivianos (Bs)**.

**Regla 5.2 — Cantidad del corte y fila PLUS.**
- La **cantidad total del corte** = suma de lo cortado por talla.
- La fila `PLUS` es una **ayuda-memoria** para cuadrar **docenas** (6 tallas × 2 prendas = 12 = una docena). Cuando una talla muy grande (ej. 48) ocupa demasiado espacio en el trazado, a veces **no se incluye** y se hacen solo 5 tallas (ej. del 38 al 46). Para completar la sexta talla y poder surtir docenas, se **repite una talla comercial** (ej. 30, 32, 40 o 42). En `PLUS` se anotan esas cantidades extra de las tallas repetidas.
- **El desglose por talla y el PLUS son solo referencia de producción**; para el **cálculo de pago solo importa la cantidad total del corte** (ver Regla 7).

**Regla 5.3 — Tarifa por modelo.** El `CT` de una operación **depende del modelo**. La misma operación (mismo proceso/pieza/máquina) puede tener distinta tarifa en modelos distintos.

**Regla 5.4 — Reutilización de modelos.** Un modelo se puede reproducir según demanda (máx. ~2 veces/mes). Al reproducirlo **sin cambios**, las tarifas se mantienen idénticas.

**Regla 5.5 — Versionado por optimización.** Si al reproducir un modelo se **optimiza** (se acortan/eliminan procesos para ahorrar), se crea una **nueva versión** del modelo (copia con menos operaciones). Se conserva la versión anterior. Cada corte referencia la **versión** de modelo con la que se produjo.

**Regla 5.6 — Excepción de tarifa: maestro externo / staff de apoyo.**
- La tarifa base de una operación es **igual para todo el equipo regular**, sin importar quién la haga.
- **Excepción**: cuando se llama a **personal externo experto (“maestros”)** para acelerar una operación, se les paga **+0.10 Bs por pieza** sobre la tarifa base de esa operación (porque son más rápidos).
- Implementación acordada (ver Sección 8): este +0.10 es un **override por asignación**, con **valor por defecto 0.10 pero editable**. No debe estar "quemado" en el código.

---

## 6. Reglas de negocio — Asignación de trabajo

**Regla 6.1 — División de una operación (hasta 3 operarios).**
Una operación puede repartirse entre **1 a 3 operarios**. Cada operario recibe una **cantidad** de piezas de esa operación.

**Regla 6.2 — Validación de suma exacta (CRÍTICA).**
La suma de las cantidades asignadas en una operación **debe ser exactamente igual** a la cantidad total del corte. No puede haber piezas **sin asignar** ni **de más**. El sistema debe **validar y bloquear/avisar** si la suma no cuadra.

**Regla 6.3 — Cálculo del pago de una asignación.**
`pago_asignación = cantidad_asignada × tarifa_efectiva`
donde `tarifa_efectiva = CT_base` (operario regular) **o** `CT_base + 0.10` (maestro externo).

**Regla 6.4 — Modalidad de asignación híbrida (OBLIGATORIA en la interfaz).**
El sistema debe soportar **ambas** modalidades:
- **Asignación por grupo completo**: asignar de un solo golpe **todo un grupo** de operaciones (ej. todo `DELANTEROS`) a un operario. Es el modo rápido para **operarios expertos/rápidos**, que abarcan un proceso completo solos. Debe existir un **botón/función** para esto (optimiza el tiempo de registro).
- **Asignación por operación puntual**: **abrir/desglosar** un grupo y asignar operaciones **una por una** a distintas personas. Es el modo usado con **personal nuevo o en capacitación**, a quienes se les reparten operaciones específicas de varios procesos para que agarren velocidad.

En resumen: interfaz con **lógica híbrida** → asignar grupo completo rápido, pero siempre poder **abrir** el grupo y repartir operación por operación (y partir hasta en 3).

---

## 7. Reglas de negocio — Consolidado, saldos y cierre

**Regla 7.1 — Para el pago solo importa la cantidad, no la talla.** El pago se calcula por **pieza** (tarifa × cantidad). La talla es irrelevante para el pago (se muestra solo como referencia de producción).

**Regla 7.2 — Agrupación por fecha de cierre/liquidación del corte.**
Lo ganado se agrupa por la **fecha de cierre/liquidación del corte**, no por una semana fija. Esto da flexibilidad para cruzar los anticipos con el saldo del corte **sin importar si el corte tomó 1, 2 o más semanas**, o si se cierran **dos cortes en una misma semana**.

**Regla 7.3 — Consolidado por operario a través de varios cortes.**
El sistema debe **sumar todo lo que un operario ganó en los distintos cortes** a lo largo del período, para obtener su **total ganado**.

**Regla 7.4 — Anticipos.**
- Se registran como **operario + fecha + monto**.
- Normalmente uno **cada sábado**, pero puede haber **anticipos de emergencia entre semana** → **varios anticipos por semana** por operario.
- El monto es **libre** pero con un **tope de referencia** (no se pide, por ejemplo, 2000 Bs de golpe).
- Implementación acordada (Sección 8): el tope es **configurable y funciona como advertencia** (avisa si se pasa), **no** como bloqueo.

**Regla 7.5 — Cálculo del saldo.**
`saldo = total_ganado_acumulado − anticipos_acumulados`
El saldo se **arrastra semana a semana** dentro del mes (lo del primer corte/sábado se cruza con el segundo, y así sucesivamente durante las ~4 semanas del mes).

**Regla 7.6 — Cierre de mes.**
Regla general: **a fin de mes se liquida el pago completo** a todos los operarios, dejando el **saldo en 0** para empezar limpio el mes siguiente.

**Regla 7.7 — Excepción de arrastre entre meses.**
Casos puntuales (el operario viaja, tiene una urgencia, o quiere **ahorrar** y no cobra todo): solo en esos casos queda un **saldo a favor** que **se arrastra al mes siguiente**. El sistema debe permitir este arrastre como excepción, no como norma.

**Regla 7.8 — Alimentación aparte.**
La alimentación (40/día, 20 sábado) es un **costo del taller separado** y **NO** afecta el saldo ni el pago del operario. Fuera del cálculo en Fase 1.

---

## 8. Decisiones de diseño acordadas

Estas tres decisiones ya fueron **acordadas explícitamente** con el dueño del negocio y deben respetarse:

1. **Optimización de modelo = versión.** Cuando se acorta un modelo en una reproducción, se trata como una **copia versionada** (v1, v2, …), no como un modelo nuevo desde cero. Conserva histórico de tarifas y permite armar la versión nueva rápido quitando operaciones.
2. **+0.10 del maestro externo = override editable.** El diferencial de +0.10 Bs/pieza para maestros externos es un **override por asignación**, con **valor por defecto 0.10 pero editable**, por si algún día cambia. No debe estar fijo en el código.
3. **Tope de anticipo = advertencia configurable.** El tope de anticipo es **configurable** y actúa como **advertencia** (avisa si se excede), **no** como bloqueo, ya que el monto exacto no es una regla rígida.

---

## 9. Rendición de cuentas y privacidad (requisito nuevo)

**Regla 9.1 — Filtrado por operario.**
Cuando el cálculo está terminado y toca **rendir cuentas** a cada operario, el sistema debe poder **filtrar la vista** para que **cada operario solo vea los cortes y operaciones que él mismo hizo**.

**Regla 9.2 — Motivo de negocio.**
Esto evita **comparaciones y roces** entre operarios (que uno vea que otro gana más, o que gana más "haciendo solo esa operación", etc.). Cada operario debe ver **únicamente su propio detalle**: sus cortes, sus operaciones, sus piezas, su total ganado, sus anticipos y su saldo — **sin ver los de los demás**.

**Implicación para el diseño:** debe existir una **vista/rol de "operario"** restringida a sus propios datos, separada de la vista completa del administrador/dueño (que sí ve todo el taller).

---

## 10. Ejemplos numéricos (para verificar la lógica)

> Números tomados/derivados de los datos reales, para que un agente valide su implementación.

### Ejemplo A — Costo de mano de obra por prenda y por corte
- Modelo `black DOBLE PRET 06`, corte de **372 prendas**.
- Suma de todos los `CT` del modelo = **8.1 Bs** (costo de mano de obra por prenda).
- Costo total del corte = `372 × 8.1` = **3013.2 Bs**.

### Ejemplo B — Una operación asignada a un solo operario
- Operación: `TRASEROS / pinza / trasero / recta`, `CT = 0.15`, cantidad del corte = 372.
- Asignada 100% a RUBEN → `372 × 0.15` = **55.8 Bs** para RUBEN por esa operación.

### Ejemplo C — División de una operación entre 2 operarios (caso central del negocio)
- Misma operación (`CT = 0.15`), corte de **350** piezas.
- RUBEN costura **300** → `300 × 0.15` = **45 Bs**.
- CLARIS costura las **50** restantes → `50 × 0.15` = **7.5 Bs**.
- Validación: `300 + 50 = 350` = cantidad del corte ✔ (Regla 6.2).

### Ejemplo D — Maestro externo (+0.10)
- Operación con `CT_base = 0.20`, corte de 372, dividida:
  - MARIO (regular) hace 272 → `272 × 0.20` = **54.4 Bs**.
  - Un maestro externo hace 100 → tarifa efectiva `0.20 + 0.10 = 0.30` → `100 × 0.30` = **30 Bs**.

### Ejemplo E — Saldo con anticipo (arrastre)
- CHEMA gana **243.6 Bs** en el corte de la semana.
- Pidió un anticipo de **500 Bs** ese sábado.
- Saldo = `243.6 − 500` = **−256.4 Bs** → se arrastra a la semana siguiente (adelantado de más).

---

## 11. Alcance de la Fase 1 (qué SÍ y qué NO)

### Incluido en Fase 1
- **Catálogo de modelos** con sus operaciones y tarifas por pieza, **versionable**.
- **Registro de cortes** (modelo/versión + cantidad total + desglose por talla como referencia + fecha de cierre).
- **Asignación híbrida** (por grupo completo o por operación puntual), con **división de hasta 3 operarios** por operación y **validación de suma exacta**.
- **Excepción de tarifa** para maestros externos (+0.10 editable).
- **Cálculo de pago** por operario y por corte.
- **Consolidado semanal y mensual** por operario (agrupado por fecha de cierre), cruzando **anticipos** (con tope como advertencia), calculando **saldo**, con **arrastre** y **cierre de mes a 0** (y excepción de arrastre entre meses).
- **Plantel administrable** (alta/baja de operarios; regular vs. maestro externo).
- **Vista filtrada por operario** para rendición de cuentas (Sección 9).

### Fuera de Fase 1 (contexto, no se implementa ahora)
- ~~Trazado de moldes y corte físico de tela (Sección 1.1).~~ Incorporado el 2026-10-01 como servicio de corte interno (`docs/PLAN_SERVICIO_CORTE.md`).
- **Alimentación** y otros costos del taller (se registran, si acaso, en una fase posterior; **no** afectan el pago).
- Modelado de tablas / base de datos / relaciones (**paso posterior**, aún no solicitado).

---

## 12. Notas para el agente que construya el sistema

- **Respetar el vocabulario del dominio** (Sección 2) en la interfaz; el dueño y los operarios piensan en esos términos.
- **Normalizar** las variaciones ortográficas de máquinas/procesos/piezas provenientes del Excel.
- La **regla de suma exacta** (6.2) y el **manejo correcto del saldo/arrastre** (Sección 7) son el corazón del sistema: cualquier error ahí afecta pagos reales de personas.
- La **cantidad del corte** es el único dato de producción que entra al cálculo; las **tallas y el PLUS** son solo visualización de referencia.
- Preferir precisión monetaria adecuada (Bs con 2 decimales; cuidado con acumulación de errores de punto flotante en sumatorias grandes).
- La **privacidad por operario** (Sección 9) es un requisito, no un extra: separar la vista de administrador de la vista de operario.
