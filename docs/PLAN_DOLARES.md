# Dólares y bolivianos (ventas en $us, tela de Nancy en $us, caja de dólares)

> **Estado:** implementado el 2026-10-23 (respuestas §2). No toca ningún pago de operarios.

## 1. Cómo trabaja el taller

- La **tela principal** se compra **a crédito y en dólares** (la señora Nancy): se le debe y se le paga
  en $us.
- **Todo lo demás** se compra y se paga **en Bs**: tela 2, insumos de costura y empaque, servicios
  externos, sueldos, costos fijos, servicios básicos.
- Se **vende en dólares**: el precio de la docena es en $us y casi siempre se cobra en $us (a veces en Bs).
- De cada cobro, entre el 50 y el 80 % va directo a Nancy en $us; el resto se **cambia a Bs** al tipo de
  cambio del día para pagar lo demás.

## 2. Decisiones del dueño (2026-10-23)

1. **Precio fijo de la docena en $us** en cada producto (ficha). El sistema muestra al lado cuánto es en
   Bs y cuánto deja sobre el costo. Sin precio fijo, se calcula como antes (costo + margen).
2. **Tipo de cambio del día de cada movimiento**: cada despacho, cobro, pago en $us y cambio de dólares
   guarda el suyo; el sistema propone el último usado (`Configuracion.tasaCambioUsd` pasa a ser "el último
   tipo de cambio").
3. **Caja de dólares**: entran los cobros en $us y salen los pagos a Nancy; "Cambiar dólares a Bs" pasa
   plata a efectivo o banco al tipo de cambio de ese día.
4. **Cobros casi siempre en $us, a veces en Bs**: cada cobro dice en qué moneda.

## 3. Reglas

- Dinero en centavos de su moneda; la tasa en diezmilésimos (6.96 = 69 600). Cada conversión redondea
  una vez, half-up.
- **Despacho**: precio de la docena en $us por línea; total $us = prendas × precio docena ÷ 12
  (redondeado una vez). Guarda la tasa del día; su equivalente en Bs (para la ganancia) = total $us × tasa.
- **Cuentas por cobrar en $us**: un cobro en Bs descuenta su equivalente en $us a la tasa del cobro.
- **Deuda con proveedores por moneda**: las compras a crédito en $us y los pagos en $us se cuentan en $us;
  las de Bs, en Bs.
- **Caja de dólares**: su saldo está en $us; cambiar dólares es una salida en $us y una entrada en Bs.
- Los costos (fichas, cortes, costos fijos) siguen en Bs.

## 4. Bitácora

- **2026-10-23 — Propuesta y respuestas** (§2).
- **2026-10-23 — Implementado.**
  - Migraciones `20261024120000_caja_dolares` (enum `Caja` + `dolares`, aparte porque un valor nuevo de enum
    no se puede usar en la misma transacción) y `20261024120100_dolares`.
  - **Ficha**: `precioDocenaUsd` opcional. Con él, el precio por prenda en Bs = docena × último tipo de
    cambio ÷ 12 (un redondeo) y el margen no se usa; sin él, costo + margen como antes.
  - **Pedido y despacho** en $us por docena. Cada línea guarda `totalUsd` (prendas × docena ÷ 12) y `totalBs`
    (= totalUsd × tasa del despacho); la ganancia del mes usa `totalBs`.
  - **Cobro**: moneda, monto en su moneda, tasa y sus dos equivalentes (`usd`, `bs`) calculados una vez. En
    $us entra a la caja de dólares. Las cuentas por cobrar van en $us (`usd`).
  - **Proveedores**: una deuda por proveedor **y moneda**; los pagos en $us cancelan las compras en $us (FIFO).
    Cuentas por pagar y tablero muestran lo de $us también en Bs al último tipo de cambio.
  - **Caja de dólares**: saldo en $us. Una compra al contado en $us sale de ella. "Cambiar dólares" es una
    transferencia con `montoDestino` y `tasaCambio`. En el resumen por categoría todo va en Bs (`montoBs`).
    Lo que solo existe en $us no se pasa a una caja en Bs (y al revés); cobros y compras en $us, sí.
  - **Último tipo de cambio**: `Configuracion.tasaCambioUsd` se actualiza al guardar un despacho, cobro o
    cambio de dólares con su tasa; los formularios lo proponen.
  - Tests: `dinero.test.ts` (precio fijo, despacho y cobros en las dos monedas, deuda por moneda),
    `caja.test.ts` (caja de dólares y cambio), `reportes.test.ts`. 400 en verde.
