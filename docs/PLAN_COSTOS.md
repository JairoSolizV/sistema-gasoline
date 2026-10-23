# Costos de producción (insumos, ficha de costo por modelo, costo real del corte y proyección)

> **Estado:** aprobado el 2026-10-22 (respuestas §7). **Etapas 1 a 5 implementadas** (y datos del catálogo
> importados); la 5 (costos fijos) según §7c.
> **Amplía el alcance** (CLAUDE.md §2: hoy "otros costos del taller" está fuera). Al aprobar se
> actualizan `CLAUDE.md` y `CONTEXTO_NEGOCIO_TALLER.md`. **No toca ningún pago**: es un módulo de
> consulta; lee lo que ya existe (CT, servicio de corte, empaque, lavandería/bordado) sin modificarlo.

---

## 1. Qué resuelve

Que el dueño y su esposa sepan **cuánto cuesta producir cada prenda de cada modelo, hoy**, con qué
precio venderla, cuánto costó de verdad cada corte y cuánto material y plata hace falta para el mes.
Hoy esos datos están repartidos entre Taller · Pagos (mano de obra), el catálogo local
(`C:\CATALOGO PRODUCCION`, tela, hilos y avíos por modelo) y la memoria de compras.

## 2. Decisiones del dueño (2026-10-21/22)

1. **Dentro del mismo sistema**, como módulo **Costos**, por etapas.
2. **Compras en dólares:** se usa la **tasa de cambio oficial del día de la compra** (se guarda en
   cada compra).
3. **Hilo:** por **tabla de rendimiento por cono** (prendas que rinde un cono).
4. **Precio de venta = costo + margen.**
5. **Tela:** misma fórmula que el catálogo local: **consumo por prenda = largo del tizado ÷ prendas por
   capa**; costo = precio por metro × consumo; merma = metros recibidos − largo × capas.

## 3. Cálculo (sin descuadres)

- Precios de compra en **centavos enteros** (total pagado) y cantidades enteras; el **precio unitario**
  (ej. Bs 50 por paquete de 144 botones = 0.3472…) se trabaja como **fracción exacta**, sin redondear.
- Cada línea de la ficha (tela, hilo, cierre…) y el total por prenda se redondean **una sola vez**,
  half-up a 2 decimales, desde el valor exacto (CLAUDE.md §7). El total es la suma exacta redondeada,
  no la suma de líneas redondeadas.
- Mano de obra, empaque, servicio de corte y lavandería/bordado se **leen** del sistema (no se copian).

## 4. Etapas (cada una usable sola, con sus tests)

### Etapa 1 — Insumos y compras
- **Insumos** (catálogo): nombre, categoría (tela, hilo, cierre, botón, remache, cuero, etiqueta,
  bolsa, saco/yute, otro), unidad (metro, cono, unidad, paquete…) y detalle según categoría:
  - tela: ancho, color; hilo: título (ej. 20/3), color, código, **rendimiento por cono**;
  - cierre: marca, número de llave, medida (cm); el resto: texto libre.
- **Compras** (historial): fecha, insumo, tienda/proveedor, origen (fábrica · mayorista · tienda; ciudad),
  presentación (unidades por paquete), cantidad, precio pagado, moneda (Bs o $us) y **tasa oficial del
  día** si es en dólares → precio unitario en Bs. **El costo usa el precio de la última compra** (se
  ve también el promedio y la variación).

### Etapa 2 — Ficha de costo por modelo (lo que la esposa necesita al momento)
Por versión de modelo, costo **por prenda**:
| Línea | De dónde sale |
|---|---|
| Tela principal y extras (popelina…) | consumo del último corte del modelo (tizado) o manual × último precio |
| Hilos | precio del cono ÷ prendas que rinde (tabla) |
| Cierres, botones, remaches, cuero, etiquetas, bolsa | cantidad por prenda × precio unitario |
| Mano de obra (costura) | Σ CT de la versión (automático) |
| Empaque | Σ CT de empaque (automático) |
| Servicio de corte | tarifas vigentes de Configuración (automático) |
| Lavandería / bordado | precio del proveedor elegido (o el más barato) |
| Logística | saco/yute, flete, pasajes y viáticos **prorrateados** por prendas del envío |
| **Total por prenda** y **precio de venta** | Σ exacta, redondeada una vez; + margen |

Sirve para modelos en producción y para modelos futuros (antes de cortar).

### Etapa 3 — Costo real de cada corte
Con lo que **de verdad** pasó en el corte: tela según tizado y su compra, lo pagado en costura,
empaque, servicio de corte y envíos a lavandería/bordado → costo real por prenda y diferencia con la
ficha (ej. "este corte salió Bs 0.40 más caro por la tela").

### Etapa 4 — Proyección del mes y stock
Plan de producción (modelo × prendas) → materiales necesarios, **stock** (compras − consumo de los
cortes), **lo que falta comprar** y **cuánta plata se necesita** (materiales + mano de obra +
servicios).

### Etapa 5 — Costos fijos del taller (implementada, decisiones §7c)
Servicios básicos con historial, pagos a bancos programados con aviso y prorrateo de los fijos por
prenda. Es más administración que costo de producción.

## 5. Pantallas

- Menú nuevo **Costos** con pestañas: Insumos · Compras · Fichas · (luego) Cortes · Proyección.
- En el detalle de un **modelo**: tarjeta "Costo por prenda hoy: Bs X · venta Bs Y".
- Todo imprimible (hoja oficio) como las demás pantallas.

## 6. Acceso de la esposa (no es código)

Instalar **Tailscale** en la PC del taller y en su celular: abre el sistema desde cualquier lado sin
subir nada a internet.

## 7. Preguntas para aprobar

Respuestas del dueño (2026-10-22):

1. **Margen = porcentaje sobre el costo** (uno general editable en Configuración y, opcional, uno
   propio por modelo). Venta = costo × (1 + margen), redondeada una vez.
2. **Rendimiento del hilo según hilo y modelo:** cada hilo tiene un rendimiento base (prendas por
   cono) y cada modelo puede tener el suyo.
3. **Empezar por las etapas 1 y 2 juntas.**
4. **Importar una sola vez** los datos del catálogo local (hilos, avíos, telas y tizados de los
   cortes 25 a 32) y mostrar qué se importó para revisarlo.

5. **Ficha propia, vinculable:** cada ficha tiene su código y nombre (los del catálogo); si se vincula
   a un modelo de Taller · Pagos, mano de obra y empaque salen de los CT de su última versión; si no,
   la mano de obra se escribe a mano. Las 8 del catálogo (25 a 32) se importan **sin vincular**: no
   están cargadas en Taller · Pagos. "CLASICO GSLN BJO RIGIDO" de Taller · Pagos es el modelo **23
   CLASICO GSLN FRONTERA** (no está en el catálogo), **no** el 31.

## 7b. Decisiones de las etapas 3 y 4 (2026-10-22)

1. **Stock = conteo físico + movimientos:** stock de un insumo = último conteo + compras posteriores −
   consumo de los cortes posteriores (según la ficha del modelo). Sin conteo, parte de 0 con todas las
   compras. Se corrige solo cada vez que se cuenta.
2. **Tela real del corte:** el tendido del corte suma **prendas por capa**; tela usada = largo del
   trazado × capas (capas = prendas del corte ÷ prendas por capa, hacia arriba), con el precio de la
   última compra de la tela de la ficha.
3. **Proyección del mes = plan manual + cortes abiertos:** el plan (fichas × prendas) da el material
   necesario, lo que falta comprar según el stock y la plata para producirlo; cada corte abierto suma
   la plata para terminarlo (costura y empaque que se pagan al cerrar + envíos sin devolver).

Diseño:
- **Qué ficha usa un corte:** la vinculada a su modelo (si hay varias, la última actualizada).
- **Costo real del corte:** costura y empaque = lo asignado (con diferencial de maestro) y, en
  operaciones sin asignar, prendas × CT; servicio de corte = lo registrado; lavandería/bordado = sus
  envíos; materiales = líneas de la ficha × prendas, con la tela principal según el tizado real.
  Se compara por prenda con la ficha.
- **Consumo de un corte** (para el stock): se descuenta en su fecha de inicio: por prenda = cantidad
  × prendas; tela = tizado (real si hay prendas por capa); hilo = prendas ÷ rendimiento (conos).

## 7c. Etapa 5 — Costos fijos del taller (decisiones del dueño, 2026-10-22)

1. **Volumen:** producción mínima 1500 prendas/mes (habitual 2000, meta 3000, objetivo 4000 = 1000
   por semana). El **costo fijo que se suma a cada ficha se divide por 1500** (editable en
   Configuración): precio seguro aunque un mes salga poco. Se muestra además el costo fijo por prenda
   con la producción real del mes (prendas de los cortes cerrados) y la tabla 1500 / 2000 / 3000 /
   4000.
2. **Préstamo FIE:** se carga la **cuota completa** (Bs 10,500) como costo (decisión del dueño, para
   recuperarse); se muestra aparte como "recuperación de deuda". Aviso en Inicio antes del vencimiento
   y se marca cada cuota pagada. (Fassil, PSNK: terminados.)
3. **Sueldo de los dueños** = lo que necesita la casa (Bs 14,025, editable); reemplaza a "Adm" y
   "Ventas" del Excel. De ahí sale universidad, colegio y alimentación de la familia.
4. **Gastos compartidos con la casa** (mismo medidor de luz y agua; la comida se compra junta): cada
   concepto tiene un **porcentaje del taller**.
5. **Comida:** se anota **cada compra** (verduras semanales, pan y carne diarios; sin factura) y se
   aplica el porcentaje del taller.

Diseño: concepto de gasto fijo (grupo, monto mensual con historial **o** suma de las compras
anotadas del mes, % del taller); préstamo (cuota, día de vencimiento, cuotas que faltan, pagos);
costo fijo del mes = Σ parte del taller de cada concepto + cuotas; para las fichas se usa el monto
vigente y, en los conceptos por compras, el promedio de los últimos 3 meses con compras. Las fichas
y la proyección suman el costo fijo por prenda. Solo consulta: no toca pagos.

## 8. Bitácora

- **2026-10-22 — Propuesta.** Base: respuestas del 2026-10-21 (tasa oficial del día, tabla de
  rendimiento por cono, precio = costo + margen) y el catálogo local (`catalogo-local.html`, fórmulas de
  `calc()`).
- **2026-10-22 — Etapas 1 y 2 (insumos, compras y fichas).** `shared/costos.ts`: fracciones exactas
  (BigInt) y un solo redondeo por número; compra en $us = monto × tasa redondeado una vez. Tablas
  `Insumo`, `CompraInsumo`, `FichaCosto`, `LineaCosto` y `Configuracion.margenVenta` (30 % por defecto)
  — migración `20261022200000_costos`. API `/costos/insumos|compras|fichas` (la ficha se guarda
  entera: datos + líneas). Ficha vinculada: costura y empaque = Σ CT de la última versión del modelo;
  sin vincular, a mano; servicio de corte = tarifas de Configuración; línea sin precio → ficha
  "incompleta". Pantalla **Costos de producción** (menú propio) con pestañas Fichas · Insumos ·
  Compras y editor de ficha con cálculo en vivo (mismas funciones que la API); margen general en
  Configuración. 364 tests en verde (`domain-costos`, `costos`).
- **2026-10-22 — Importación del catálogo local** (script de un solo uso fuera del repo, leyendo
  `C:\CATALOGO PRODUCCION` montado solo lectura y cargando por la API): 26 insumos, 59 compras y 8
  fichas (25 a 32, sin vincular). Correcciones: botón "1000 por prenda" → 1 (era el envase); bolsa
  "3<" del 27 no se importó; hilos del 32 sin fecha de compra no se importaron; corte 29 sin metros
  recibidos → se usó lo tendido (1045 m); la tela negra del corte 28-1 quedó como insumo aparte;
  cierres repartidos por medida según la curva del corte principal. La tasa del catálogo es 11.85
  (no la oficial). Falta: mano de obra en las 8 fichas y precios de cierres 12 y 15 cm, placa y
  regulador.
- **2026-10-22 — Etapas 3 y 4 (costo real, stock y proyección).** Decisiones §7b. `Corte.prendasPorCapa`
  (en el tendido, opcional), `ConteoInsumo` y `PlanProduccion` — migración
  `20261022220000_costos_stock_proyeccion`. `shared/costos.ts`: consumo de cada línea para N prendas
  (milésimas exactas) y tela real = trazado × capas (hacia arriba). `costos/produccion.ts`: stock por
  insumo (último conteo + compras − consumo de cortes posteriores; lo del mismo día del conteo ya está
  incluido), costo real del corte por rubro frente a su ficha (la vinculada al modelo, la última
  actualizada; costura y empaque = lo asignado + lo que falta a su CT; los avíos se toman de la ficha;
  lavandería/bordado reales = envíos) y proyección (plan → material necesario, faltante según stock al
  precio de la última compra, plata para producir; cortes abiertos → costura y empaque al cerrar +
  envíos sin devolver). API `/costos/conteos`, `/costos/cortes[/:id]`, `/costos/proyeccion`,
  `PUT /costos/plan`. Pantalla: pestañas **Costo real de cortes** (fila → detalle por rubro) y
  **Proyección del mes**; columna **Stock** y botón **Contar** en Insumos; "Por capa" en el tendido del
  corte. Verificado con los datos reales: COD 23 cuesta Bs 8.24 por prenda (costura 5220.04 con el
  diferencial de maestro + servicio 721.00); plan de prueba 31 × 1000 → producir Bs 11 300.00 (luego
  borrado). Ojo: hasta el primer conteo, el stock suma todo lo comprado para los cortes 25–32 (no están
  en Taller · Pagos, su consumo no se descuenta). 369 tests en verde (`costos-produccion` nuevo).
- **2026-10-22 — Etapa 5 (costos fijos del taller).** Decisiones §7c. Tablas `GastoFijo` (mensual con
  historial de montos `GastoFijoMonto`, o por compras `CompraGasto`; % del taller), `Prestamo` y
  `PagoPrestamo`, y `Configuracion.prendasMesCostoFijo` (1500) — migración `20261022240000_costos_fijos`.
  `costos/fijos.ts`: gastos del mes (parte del taller), deuda = cuota completa, presupuesto para las fichas
  (montos vigentes hoy; comida = promedio de los 3 meses anteriores con compras, o el mes actual si no hay
  historia) ÷ prendas de referencia, tabla 1500/2000/3000/4000 y aviso en Inicio de cuotas por vencer o
  vencidas hasta marcarlas pagadas. Las fichas suman la línea **Costos fijos del taller** (también la
  proyección). Pantalla: pestaña **Costos fijos** (mes, gastos por grupo, compras de comida, préstamos).
  Verificado en el navegador con datos de prueba (luego borrados): 14 025 + 85 % de 1250 + 60 % de 450 +
  10 500 = Bs 25 857.50 → Bs 17.24 por prenda en las fichas. 375 tests en verde (`costos-fijos` nuevo).
- **2026-10-23 — Docena en dólares, código de corte de las compras y tablas.** Pedido del dueño.
  `Configuracion.tasaCambioUsd` (11.85 por defecto, editable en Configuración; solo para mostrar) y
  `CompraInsumo.codigoCorte` (texto, ej. "28-1") — migración `20261023120000_codigo_corte_tasa_usd`, que
  llena el código de las 59 compras importadas desde su nota. Fichas: costo y venta por docena en $us
  (`docenaEnDolares`: × 12 ÷ tasa, un solo redondeo). Insumos: columna "Comprado para" (códigos de sus
  compras, el más reciente primero). Compras: columna y campo "Para el corte". Todas las tablas de
  Costos y la planilla de Liquidación con ancho ajustado, cabecera fija y filas en franjas
  (`components/tabla.ts`); en Liquidación la primera columna de los servicios externos dice "Empresa".
  377 tests en verde.
- **2026-10-23 — Menú por áreas y catálogo de productos.** El menú se ordena en áreas con color
  (Producción azul, Personal turquesa, Compras ámbar, Ventas violeta, Costos coral, Finanzas verde,
  Sistema gris) y cada página muestra una franja con el color de su área; los botones siguen en azul y
  verde/rojo quedan para plata a favor o en contra. Las pestañas de Costos se reparten: Compras y
  Deudas a proveedores → **Compras**; Insumos → **Inventario**; Costos fijos → **Finanzas**. "Catálogo"
  pasa a llamarse **Catálogo de operaciones**. **Catálogo de productos** sobre las fichas: foto
  (guardada en la base, achicada a ≤1000 px por el panel), tallas, colores, descripción y precio por
  docena en Bs y $us; "mostrar costos" apagado para mostrarlo o imprimirlo al cliente. Migración
  `20261023220000_catalogo_productos`. 392 tests en verde.
