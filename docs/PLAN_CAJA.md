# Caja (efectivo y banco, gastos clasificados, arqueo)

> **Estado:** aprobado el 2026-10-23 (respuestas §2). Amplía el alcance (CLAUDE.md §2), como el
> tablero de dinero. **No toca ningún pago**: lee lo que ya se registra y agrega los movimientos que
> solo existen en la caja (luz, agua, transporte, retiros para la casa…).

## 1. Qué resuelve

El dueño quiere saber cuánta plata tiene en la mano y en el banco, y en qué se le va: compras,
servicios básicos, servicios externos, operarios, banco, la casa.

## 2. Decisiones del dueño (2026-10-23)

1. **Dos cajas:** efectivo y banco/QR. Cada movimiento dice de cuál sale o entra; se puede pasar
   plata de una a otra (transferencia).
2. **Lo que ya se registra entra solo** (sin anotar dos veces):
   - cobros a clientes → ingreso «Cobros a clientes»;
   - compras de insumos **al contado** y pagos a proveedores → egreso «Tela e insumos»;
   - compras de gastos por compras (comida…) → egreso según el grupo del gasto;
   - cuotas pagadas del préstamo → egreso «Banco»;
   - anticipos → egreso «Operarios» (o «Servicios externos» si la cuenta es de un proveedor);
   - lo pagado al cerrar el mes → egreso «Operarios» / «Servicios externos», en la fecha del cierre.
   A mano solo va lo demás (luz, agua, transporte, retiros para la casa, aportes…).
3. **Categorías editables**, arrancando con: Tela e insumos · Servicios básicos · Servicios externos ·
   Operarios · Comida · Transporte · Máquinas · Impuestos · Banco · Retiros para la casa · Otros
   gastos; ingresos: Cobros a clientes · Préstamos o aportes · Otros ingresos. Las que usa el sistema
   solas se pueden renombrar pero no desactivar.
4. **Arqueo cuando quiera:** se cuenta la plata; la diferencia con lo que dice el sistema queda
   anotada como sobrante o faltante.

## 3. Reglas

- Cada caja tiene **fecha de inicio y saldo inicial**: lo anterior no cuenta (el sistema tiene
  anticipos y compras de antes de llevar caja).
- Saldo a una fecha = saldo inicial + ingresos − egresos + ajustes de arqueo, desde el inicio.
- El arqueo guarda lo contado, lo que decía el sistema y la diferencia (foto de ese momento).
- Lo que entra solo se puede pasar de una caja a otra desde la caja (se cambia en su origen).
- Lo pagado al cierre de mes sale del efectivo.

## 4. Datos nuevos

`enum Caja` (efectivo | banco) en Cobro, PagoProveedor, CompraInsumo, CompraGasto, PagoPrestamo y
Anticipo (por defecto efectivo); `CajaInicio`, `CategoriaCaja`, `MovimientoCaja` (ingreso, egreso o
transferencia) y `ArqueoCaja`.

## 5. Bitácora

- **2026-10-23 — Propuesta y respuestas** (§2).
- **2026-10-23 — Implementado.** Migración `20261023160000_caja` (crea las 14 categorías). Módulo
  `server/src/modules/caja` (API `/caja`, `/caja/inicio/:caja`, `/caja/movimientos`, `/caja/origen/:origen/:id`,
  `/caja/arqueos`, `/caja/categorias`): los movimientos automáticos se calculan al vuelo desde su registro
  (no se copian), así nunca quedan desfasados. Pantalla **Caja** (menú Dinero): saldo de cada caja,
  en qué se fue la plata y de dónde entró por categoría, movimientos con cambio de caja, arqueo,
  transferencias y categorías. "¿De qué caja?" en cobros, pagos a proveedores, compras al contado y
  compras de costos fijos (anticipos y cuota del banco: efectivo por defecto, se cambian desde la caja).
  Compras editables (tienda, corte, contado/crédito, caja) para marcar a crédito las ya cargadas.
  Verificado en el navegador con datos de prueba (luego borrados). 390 tests en verde (`tests/caja.test.ts`).
