# Costos de producción (insumos, ficha de costo por modelo, costo real del corte y proyección)

> **Estado:** aprobado el 2026-10-22 (respuestas §7). **Etapas 1 y 2 implementadas** y datos del catálogo
> importados; 3 (costo real del corte) y 4 (proyección y stock) pendientes; la 5 (costos fijos) a decidir.
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

### Etapa 5 — Costos fijos del taller (opcional, a decidir)
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
