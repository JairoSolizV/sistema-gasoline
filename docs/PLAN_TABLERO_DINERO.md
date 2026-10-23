# Tablero de dinero (pedidos, despachos, cobranzas y deudas)

> **Estado:** aprobado el 2026-10-23 (respuestas §2). **Amplía el alcance** (CLAUDE.md §2). Como el
> módulo Costos, **no toca ningún pago**: lee cortes, liquidación, compras y costos fijos, y agrega
> lo que faltaba (clientes, pedidos, despachos, cobros, compras a crédito y pagos a proveedores).

---

## 1. Qué resuelve

El dueño no ve dónde está su plata. Trabaja con la tela a crédito de la proveedora (la señora
Nancy), le debe también a la lavandería, paga al contado lo demás y da anticipos semanales a los
operarios (400–700 Bs). Quiere ver **en plata** cada etapa del producto para saber que todo está
invertido y que no gasta de más:

- **En puerta:** pedidos de clientes que todavía no se cortaron.
- **En producción:** cortes abiertos; cuánto falta pagar para terminarlos.
- **En servicios externos:** cortes cerrados con prendas en lavandería, bordado, serigrafía o láser.
- **Listo para despachar:** prendas terminadas en depósito.
- **Por cobrar:** lo despachado que los clientes todavía no pagaron.
- **Insumos en depósito** y **anticipos adelantados** a operarios (plata ya entregada por trabajo
  que todavía no se ganó).
- **Deudas:** proveedores (tela a crédito), servicios externos y operarios. El préstamo del banco se
  muestra **aparte** (es deuda de largo plazo, no de la producción).
- **Resultado del mes:** lo vendido menos su costo, menos los costos fijos, y aparte la cuota del
  banco, para ver cuánto de la ganancia se lleva el banco.

## 2. Decisiones del dueño (2026-10-23)

1. **Cobranzas:** despacho por cliente (cliente, corte o ficha, prendas, precio) y cobros por
   cliente, aunque sean parciales. Por cobrar = despachos − cobros.
2. **Deudas a proveedores:** cada compra de insumos es **al contado o a crédito**; los pagos a la
   proveedora se anotan aparte. Deuda = compras a crédito − pagos. La deuda con lavandería y demás
   servicios sale de su cuenta en Liquidación (saldo pendiente).
3. **Valor:** costo y venta lado a lado (la diferencia es la ganancia en camino).
4. **En puerta:** pedidos de clientes (cliente, ficha de costo, prendas, precio, fecha de entrega).

## 3. Reglas de cálculo

- Dinero en centavos, un solo redondeo por número informado (como Costos).
- **Costo de un corte** = costo real del corte (`costos/produccion.ts`: materiales de la ficha,
  tela real, costura y empaque asignados + lo que falta a su CT, servicio de corte, envíos). **Sin**
  costos fijos: esos se restan una sola vez en el resultado del mes.
- **Precio de venta de un corte** = el del pedido vinculado; si no hay, el de su ficha.
- **Etapa de un corte:** abierto → en producción; cerrado con envíos sin devolver → en servicios
  externos; cerrado sin envíos pendientes → listo para despachar (prendas − despachadas).
- **Falta pagar para terminar** = costura y empaque que se pagan al cerrar + envíos sin devolver.
- **Despacho:** cada línea es de un corte (descuenta del depósito) o de una ficha (prendas que no
  pasaron por el sistema). Guarda su **costo por prenda** al despachar (foto, como el snapshot de
  los cortes), para que el resultado de meses pasados no cambie.
- **Anticipos adelantados** = saldos negativos de las cuentas de los operarios en el mes.
- **Proveedor:** el nombre de la tienda de la compra, normalizado (mayúsculas, sin espacios de más).

## 4. Datos nuevos

`CompraInsumo.condicion` (contado | credito), `PagoProveedor`, `Cliente`, `Pedido`, `Despacho` +
`DespachoLinea` (con `costoPrenda`), `Cobro`.

## 5. Pantallas

- **Tablero** (menú Dinero): tarjetas por etapa con costo, venta y ganancia en camino; lo que tenés
  vs lo que debés; resultado del mes; préstamo aparte.
- **Ventas** (menú Dinero): pestañas Pedidos · Despachos · Cobros · Clientes.
- **Costos → Compras:** al contado o a crédito. **Costos → Proveedores:** deuda y pagos.

## 6. Bitácora

- **2026-10-23 — Propuesta y respuestas** (§2).
- **2026-10-23 — Implementado.** Migración `20261023140000_tablero_dinero`. Módulo
  `server/src/modules/dinero` (API `/dinero/tablero|deposito|clientes|pedidos|despachos|cobros|proveedores`)
  que reutiliza el costo real de los cortes, el stock de insumos, la liquidación del mes y los costos
  fijos. Pantallas: **Tablero de dinero** y **Ventas y cobros** (menú Dinero); en Costos, compras al
  contado o a crédito y pestaña **Deudas a proveedores**. Un corte sin ficha vinculada no tiene precio:
  no entra en la ganancia (no es una pérdida) y se avisa; también se avisa del stock sin conteo físico.
  Verificado con los datos reales (COD 23 en depósito, anticipos adelantados 3 550, saldo de servicio de
  corte 721). 384 tests en verde (`tests/dinero.test.ts` nuevo).
- **2026-10-23 — Inventario, cuentas por pagar y despacho en docenas.** Pantalla **Inventario** (área
  Compras): materia prima (telas) e insumos con su valor en Bs (stock × precio de la última compra) y
  **kárdex** por material (compras, consumo de cada corte, conteos), y **producto terminado** por modelo
  en docenas. **Cuentas por pagar**: compras a crédito con fecha de vencimiento (30 días por defecto; los
  pagos cancelan primero las más viejas), saldos de servicios externos y operarios del mes y la cuota del
  banco, ordenado por vencimiento (vencido · esta semana · total). Despachos en docenas surtidas + sueltas,
  con talla y color opcional por línea. Migraciones `20261023180000_despacho_detalle` y
  `20261023200000_compra_vence`.
- **2026-10-23 — Cuentas por cobrar.** Cada cliente tiene un plazo de pago (30 días por defecto, 0 = al
  contado) y cada despacho su fecha de cobro (fecha + plazo, editable). Pantalla **Cuentas por cobrar**
  (área Ventas): despachos sin terminar de pagar por fecha de cobro (los cobros cancelan primero los más
  viejos), vencido · esta semana · total, resumen por cliente con su celular, **Cobrar** abre el cobro con
  el cliente elegido, y aviso de clientes que pagaron de más. Migración `20261023240000_cuentas_por_cobrar`
  (los despachos existentes: fecha + 30). 393 tests en verde.
