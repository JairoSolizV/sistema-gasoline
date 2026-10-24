# Requerimiento de insumos de un corte

> **Estado:** implementado y verificado el 2026-10-23.
> Sale de la pestaña **REQUERIMIENTOS** de la hoja del dueño `ENSENANDO A SURTIR A CLOUD.xlsx` y de su
> catálogo de producción (`C:\CATALOGO PRODUCCION`, ya importado a Costos).

---

## 1. Para qué

Antes de producir un corte hay que saber **qué comprar**: cierres según la talla, conos de hilo para
cargar las máquinas, talla tejida y el empaque (bolsas, tags, botones…). El sistema lo calcula por
corte, en **envases completos** (bolsa de 120 cierres, rollo de 500 tallas, paquete de 100 bolsas),
descontando lo que ya hay en inventario, con el monto de la compra.

**Solo consulta:** no registra compras, no toca pagos.

## 2. Decisiones del dueño (2026-10-23)

1. **Envases completos**, redondeando hacia arriba; se informa cuánto sobra.
2. **Hilos: conos fijos por corte**, por máquina (no crecen con las prendas).
3. **Lista fija de máquinas** (la de su hoja), para cualquier modelo. Editable en Configuración.
4. **Color del hilo por corte:** en cada corte se elige el hilo de cada título (20/3, 20/2, 40/2, Over).
   Si no se elige, se usa el de la ficha del modelo.
5. **Talla tejida:** rollos de 500 a **Bs 10**, **un rollo por talla** aunque sobre.
6. **Descontar lo que hay** en inventario: a comprar = necesita − hay.
7. **Regla talla → cierre en la ficha de cada modelo** (como su catálogo); sin regla propia, la de su hoja:
   hasta la 44 → 12 cm, 46–48 → 15 cm, desde la 50 → 18 cm.
8. **Empaque desde la ficha del modelo** (cantidad por prenda de cada avío) y en cada insumo las
   **unidades por envase** y su precio.
9. Se creó la ficha del **COD 23** (CLASICO GSLN BJO RIGIDO) vinculada al modelo, con la talla tejida; la
   tela, los hilos y el empaque los completa el dueño.

## 2b. Hilo por consumo (2026-10-23, segunda vuelta)

La hoja sumó otra forma de calcular los hilos: **yardas por cono** (20/3: 5 200; 20/2 y 40/2: 7 200;
Over: 36 000; 1 yd = 0.9144 m) y **metros por jean** (12 / 24 / 30 / 48 m). Prendas por cono = metros del
cono ÷ metros por jean (20/3: 396). Decisiones:

1. **Conos = el mayor entre la carga de las máquinas y el consumo del corte** (prendas × metros ÷
   metros del cono, hacia arriba). Con 1690 prendas el consumo es 5 / 7 / 8 / 3 y manda la carga
   (14 / 16 / 9 / 5); en un corte grande puede mandar el consumo.
2. **Metros por jean en la ficha de cada modelo** (vacío = los de la hoja) y **yardas en cada insumo de
   hilo**. Cargadas en la base del taller el 2026-10-23.

El dato del costurero (C40 = 1400: "un cono de 20/3 alcanza para 100 prendas") no se usa: el dueño dice
que no tiene lógica, y con 12 m por jean un cono de 5 200 yardas rinde ~396.

**Error en la hoja:** en cierres de 15 cm decía 33.8 bolsas (dividía entre 10, no entre 120): son 2.82 →
3 bolsas. El total de cierres era Bs 2 563.17 (comprando por fracción), no Bs 8 295.08.

## 3. El cálculo (`shared/src/requerimiento.ts`)

| Grupo | Necesita | Detalle |
|---|---|---|
| Cierres | prendas de las tallas de cada medida | medida por talla: regla de la ficha o la general |
| Hilos | el mayor entre la carga de las máquinas y el consumo | hilo elegido en el corte (§2b) |
| Empaque | prendas × cantidad por prenda de la ficha | avíos por prenda que no son cierre ni tela |
| Talla tejida | un envase por talla | insumo marcado "un envase por talla"; no descuenta stock |

Para cada línea: **falta** = necesita − hay (nunca negativo); **envases** = falta ÷ unidades por envase,
hacia arriba; **sobran** = envases × unidades − falta; **monto** = envases × precio del envase.

- **Precio del envase:** el de la última compra × unidades del envase (redondeado una vez); sin compras,
  el **precio de referencia** del insumo.
- **Lo que hay:** el stock de Costos (último conteo + compras − consumo) **más** lo que ese stock ya le
  descontó a este mismo corte (si no, lo pediría dos veces). Sin conteo físico el stock puede estar
  inflado.

## 4. Datos

- `Insumo.unidadesPorEnvase`, `Insumo.precioEnvase` (referencia), `Insumo.porTalla`.
- `FichaCosto.cierresPorTalla` `[{ talla, medidaCm }]` (null = regla general).
- `Configuracion.hilosMaquinas` `[{ maquina, conos: { "20/3", "20/2", "40/2", "Over" } }]` (null = la
  lista de la hoja: 14 / 16 / 9 / 5 conos).
- `Corte.hilosRequerimiento` `{ "20/3": insumoId, … }`.
- `Insumo.yardasPorCono` y `FichaCosto.cmHiloPorPrenda` `{ "20/3": 1200, … }` (centímetros; null = los de
  la hoja).

Cargado en la base del taller el 2026-10-23: cierres 12/15/18 cm en bolsas de 120 a Bs 170/185/200; tags
y cuero paquete de 100 a Bs 50; bolsa paquete de 100 a Bs 31; remache 1000 a Bs 70; botón envase de 1000;
precio de referencia de los hilos (30 / 28 / 10.50 / 55); insumo **Talla tejida** (rollo de 500 a Bs 10,
uno por talla). Respaldo previo: `backups/taller_pagos_antes_requerimiento_2026-10-23.dump`.

## 5. API y pantallas

- `GET /cortes/:id/requerimiento` y `PUT /cortes/:id/requerimiento/hilos` `{ hilos: { "20/3": id | null, … } }`.
- **Corte:** sección *Requerimiento de insumos* (debajo de la calculadora de tendido): hilo de cada
  título, tabla Necesita / Hay / Falta / Comprar / Sobran / Precio / Monto por grupo, avisos y total;
  **Imprimir** sale solo la hoja.
- **Costos → Insumos:** unidades por envase, precio del envase y "un envase por talla".
- **Costos → Ficha:** *Cierre por talla* (con "Cargar 40 a 54 con la regla general").
- **Configuración:** *Hilos por máquina*.

## 6. Tests

`server/tests/domain-requerimiento.test.ts` (REQ-1 a REQ-9, con los números de la hoja; REQ-8 y REQ-9:
consumo por yardas y el mayor entre carga y consumo) y
`server/tests/requerimiento.test.ts` (REQ-A1 a REQ-A5: regla de la ficha, talla tejida, precio de la
compra y stock, no pedir dos veces lo ya descontado, hilo elegido).
