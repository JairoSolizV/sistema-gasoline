# Cuentas separadas por tipo de trabajo (+ lavandería y bordado)

> **Estado:** aprobado el 2026-10-22 (decisiones §2 y respuestas §8). **Completo:** las 4 rebanadas (saldo por
> cuenta, pantallas, proveedores externos y envíos a lavandería/bordado) implementadas y verificadas.
> **Cambia el alcance y la invariante 6** (CLAUDE.md): el saldo deja de ser uno por operario y pasa a
> ser **uno por operario y por cuenta**. Al implementar se actualizan `CLAUDE.md`,
> `CONTEXTO_NEGOCIO_TALLER.md` y `PLAN_SERVICIO_CORTE.md` §2.14 (lavado y bordado entran).

---

## 1. Qué resuelve

Hoy todo lo que gana un operario (costura, empaque, servicio de corte, moldes, sueldo) se suma en un
solo saldo y los anticipos se descuentan de ese total. El dueño los paga **por separado**: el saldo de
operaciones no se mezcla con el del servicio de corte, ni con el de moldes, empaque, sueldo, lavandería o
bordado.

## 2. Decisiones del dueño (2026-10-22)

1. **Siete cuentas** que nunca se mezclan:

   | Cuenta | Qué se gana | Cuándo |
   |---|---|---|
   | **Operaciones** | operaciones de costura del corte | al cerrar el corte (`fechaCierre`) |
   | **Empaque** | operaciones marcadas como empaque | al cerrar el corte |
   | **Servicio de corte** | búsqueda, trazado, doblado, corte, clasificación | fecha de cada trabajo |
   | **Moldes** | moldes nuevos y modificaciones | fecha del pago de moldes |
   | **Sueldo** | sueldo semanal de ayudantes | fecha de asistencia |
   | **Lavandería** | prendas lavadas por un proveedor externo | ver §5 |
   | **Bordado** | prendas bordadas por un proveedor externo | ver §5 |

2. **El anticipo se carga a una cuenta**: al registrarlo se elige de cuál sale, y solo descuenta de esa.
3. **Saldo propio por cuenta, mismo cierre**: cada operario tiene un saldo y un arrastre **por cuenta**
   (un costurero que además corta tiene dos saldos). El **cierre de mes es uno solo** y liquida todas
   las cuentas juntas.
4. **Lavandería y bordado** son **proveedores externos que cobran por prenda** de cada corte.

## 3. Reglas

- `saldo(operario, cuenta) = saldoEntrada(cuenta) + ganado(cuenta) − anticipos(cuenta)`. El arrastre
  (también el negativo) pasa al mes siguiente **dentro de la misma cuenta**.
- Al cerrar el mes, el pago y la excepción "arrastra saldo" se definen **por operario y cuenta**.
- Un saldo negativo de una cuenta **no** se compensa con otra cuenta positiva.
- El dinero sigue en centavos enteros y se redondea una vez (CLAUDE.md §7). Ninguna regla de cálculo
  existente cambia; solo dónde se acumula cada monto.

## 4. Datos

```
enum Cuenta { operaciones empaque servicio_corte moldes sueldo lavanderia bordado }

Anticipo     + cuenta Cuenta          // obligatorio
Liquidacion  + cuenta Cuenta          // una fila por (periodo, operario, cuenta);
                                      // sin ganadoServicioCorte/ganadoMoldes/ganadoEmpaque/ganadoSueldo
                                      // (ya no hace falta desglosar: cada fila es una cuenta)
```

**Migración:** no hay meses cerrados, así que `Liquidacion` se migra vacía. Los **8 anticipos ya
cargados** (todos a costureros, 03/10/2026) pasan a la cuenta **Operaciones**; se podrá cambiar la cuenta
de un anticipo mientras su mes no esté cerrado.

## 5. Lavandería y bordado (proveedores externos)

Confirmado por el dueño (§8):

- **El proveedor se registra en Operarios** con tipo **"Proveedor externo"** y rol **Lavandería** o
  **Bordado** (sin CI ni fecha de nacimiento obligatorios). Así reutiliza anticipos, liquidación,
  saldo con arrastre y rendición, sin una pantalla nueva. En Operarios se puede filtrar por tipo.
- En el **corte**, una sección **Lavandería / Bordado**: proveedor, prendas enviadas, precio por prenda
  (con un precio predeterminado en el proveedor, editable en el corte). Un corte puede tener **varios
  envíos** del mismo servicio (ej. la mitad a cada lavandería), fecha de envío y **fecha de
  devolución**. Total = prendas × precio, redondeado una vez.
- **Se gana en la fecha de devolución** (cuando el trabajo vuelve hecho), como el servicio de corte; un
  envío sin devolver no paga. Nunca en un mes liquidado.

## 6. Pantallas

- **Inicio:** una **fila por cuenta** con *Total a pagar · Anticipos entregados · Saldo pendiente ·
  Cortes activos* del mes. "Cortes activos" = cortes abiertos con trabajo pendiente de esa cuenta
  (Operaciones/Empaque: operaciones sin cuadrar; Servicio de corte: procesos sin registrar;
  Lavandería/Bordado: envíos sin devolver; Sueldo y Moldes: "—"). **Sin fila de total general**, para no
  mezclar.
- **Anticipos:** selector de **cuenta** al registrar (por defecto, la más probable según el rol: ayudante
  → Sueldo, solo cortador → Servicio de corte, el resto → Operaciones); columna Cuenta en el historial.
- **Liquidación:** **una planilla por cuenta** (pestañas), cada una con Operario · Saldo entrada ·
  Ganado · Anticipos · Saldo (y Pagado · Saldo salida al cerrar). Solo aparecen las cuentas con
  movimiento. El modal de cierre pide las excepciones por cuenta.
- **Rendición:** un bloque por cuenta, cada uno con **su propio** saldo entrada, ganado, anticipos y
  saldo, y el detalle de siempre (cortes, procesos, moldes, días de sueldo, envíos).
- **Operarios:** tipo "Proveedor externo", roles Lavandería y Bordado.

## 7. Orden de construcción (rebanadas, cada una con sus tests)

1. **Cuenta en anticipos y saldo por cuenta:** enum, migración, cálculo por (operario, cuenta),
   liquidación/cierre/arrastre por cuenta, rendición e inicio por cuenta. *(Es el cambio central; las 5
   cuentas que ya existen.)*
2. **Pantallas:** Inicio por filas, Anticipos con cuenta, Liquidación en pestañas, Rendición por bloques.
3. **Proveedores externos:** tipo y roles nuevos en Operarios.
4. **Lavandería y bordado en el corte:** envíos, devolución, ganado en sus cuentas.

## 8. Respuestas del dueño (2026-10-22)

1. Proveedores de lavandería/bordado: **en Operarios**, tipo "Proveedor externo".
2. Se ganan **al devolver** las prendas (fecha de devolución).
3. Precio por prenda **del proveedor**, copiado al envío y **editable** en el corte.
4. Un corte puede tener **varios envíos** del mismo servicio, a distintos proveedores.

## 9. Bitácora

- **2026-10-22 — Propuesta.** Decisiones 1–4 del dueño (anticipo por cuenta, saldo propio con un solo
  cierre, lavandería/bordado externos por prenda). Antes de empezar se commiteó la rebanada 4 de
  ayudantes y el encabezado fijo de Operarios (`19a67e4`).
- **2026-10-22 — Rebanadas 1 y 2 (saldo por cuenta y pantallas).** `enum Cuenta` (7 cuentas);
  `Anticipo.cuenta` (default `operaciones`: los 8 anticipos ya cargados quedaron ahí y se pueden
  cambiar con Editar mientras el mes esté abierto); `Liquidacion` con una fila por (periodo, operario,
  cuenta) y sin las columnas de desglose (migración `20261022150000_cuentas_separadas`, sin default
  en `cuenta` a propósito: con meses cerrados fallaría en vez de asignarlos mal). Consolidado,
  rendición e inicio devuelven **listas por cuenta**; ya no existe ningún total que sume cuentas. Cada
  cuenta muestra solo a los operarios con ganado, anticipos o arrastre en ella (CA-5.2 sigue: un corte
  abierto no da fila). Cierre con excepciones por (operario, cuenta). **Pantallas:** Inicio con una
  fila por cuenta (clic → su pestaña); Anticipos con selector de cuenta (propuesta por rol), chip y
  subtotales por cuenta; Liquidación con una pestaña por cuenta (`?cuenta=`) y modal de cierre
  agrupado por cuenta; Rendición con un bloque de saldo por cuenta. Verificado con los datos reales:
  antes el inicio mostraba un solo saldo −2829.00 (721.00 de servicio de corte − 3550.00 de anticipos
  mezclados); ahora Operaciones −3550.00 y Servicio de corte 721.00 por separado. 336 tests en verde
  (`tests/cuentas.test.ts` nuevo).
- **2026-10-22 — Rebanadas 3 y 4 (proveedores externos y envíos).** Tipo `proveedor_externo` y roles
  `lavanderia`/`bordado` (coherentes en las dos direcciones: el proveedor solo tiene esos roles y esos
  roles son solo de proveedores; validado en el alta y, en la edición, contra lo guardado), con
  `tarifaLavanderia`/`tarifaBordado` (precio por prenda predeterminado) y sin CI ni nacimiento
  obligatorios. `EnvioServicio` (corte, servicio, proveedor, prendas, precio, total = prendas × precio
  en enteros, fecha de envío y de devolución `@db.Date`): `POST/PATCH/DELETE /cortes/:id/envios`.
  Reglas: corte abierto o cerrado (no borrador); proveedor activo y con el rol; las prendas de un
  servicio no pasan las del corte (varios envíos y proveedores); sin precio usa el de la ficha
  (`SIN_PRECIO` si no tiene); devolución ≥ envío y fuera de un mes liquidado; un envío devuelto en un
  mes cerrado queda `bloqueado`. Se gana en la fecha de devolución en la cuenta de su servicio; cuenta
  para el orden de cierres y como historial del proveedor. El corte suma Lavandería / bordado a su
  costo total; el inicio cuenta como "cortes activos" los que tienen envíos sin devolver; la
  rendición del proveedor lista sus envíos devueltos. Migraciones `20261022170000_proveedores_externos`
  y `20261022180000_envios_servicio_externo`. Verificado en navegador con un proveedor de prueba sobre
  el COD 23: 721 × 1.50 = 1081.50, total del corte 6950.44, "1 corte activo" sin devolver y, al
  devolver, fila en Lavandería sin tocar Operaciones. 348 tests en verde (`tests/envios.test.ts` nuevo).
