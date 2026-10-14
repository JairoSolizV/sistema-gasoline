# Ayudantes con sueldo semanal, asistencia y operaciones de empaque

> **Estado:** aprobado el 2026-10-01. Rebanada 1 (**rol ayudante + sueldo**) implementada y verificada;
> rebanadas 2–4 pendientes.
> **Amplía el alcance** (CLAUDE.md §2): hasta ahora solo se pagaba por operación. Al implementar se
> actualizan `CLAUDE.md` (alcance e invariantes 5 y 10) y `CONTEXTO_NEGOCIO_TALLER.md`.
> Corrige `PLAN_SERVICIO_CORTE.md` §2.14: el **empaque** no es un proveedor externo; lo hacen
> ayudantes del taller.

---

## 1. Qué resuelve

Los ayudantes cobran un **sueldo fijo semanal** (ej. Bs 400, 500, 600) que se ajusta mes a mes, se
**descuenta por hora** lo no trabajado (faltas, atrasos, salidas) y además ganan **por operaciones**
(empaque o costura) cuando las hacen de noche, en horas extra o en vez de su trabajo de horario. Piden
anticipo cada sábado y se liquidan a fin de mes con todos.

## 2. Decisiones del dueño

1. **Semana laboral: lunes a sábado (6 días).** El sábado es medio día (8–12) pero **se paga completo**.
   Domingo no se trabaja ni se paga.
2. **Valor del día = sueldo semanal ÷ 6.** Ej. 400 ÷ 6 = Bs 66.67.
3. **Valor de la hora = valor del día ÷ 9, siempre** (la jornada de lunes a viernes es 8–12 y 14–19 = 9 h).
   Ej. 66.67 ÷ 9 = Bs 7.41. Faltar el sábado entero descuenta el día completo; llegar tarde el sábado se
   descuenta a ese mismo valor hora.
4. **Atrasos y salidas antes de hora se descuentan por minutos exactos.** Llegó 8:20 → 20 min =
   20/60 de hora (Bs 2.47 con la hora a 7.41).
5. **Feriados se pagan** aunque no se trabaje.
6. **"Se ajusta cada mes"** = las dos cosas: el sueldo semanal puede cambiar (ej. 400 → 450 desde el
   1.º del mes) y el cuadre final (descuentos, anticipos, saldo) se hace al **cierre de mes**.
7. **Anticipo cada sábado** (módulo Anticipos, sin cambios) y **cierre a fin de mes** (Liquidación).
8. **Día mixto por horas:** si en horario normal hace operaciones, se anotan esas horas: **no cobra
   sueldo por ellas** y cobra las operaciones. Un día entero en operaciones = 0 de sueldo ese día.
9. **Horas extra no se pagan por hora**: solo las operaciones que haga en ese tiempo.
10. **Operaciones de empaque por prenda del corte**, como la costura: van en el modelo (deshilachado,
    pegado de botón / remache / cuero, etiquetado, embolsado, surtido, embalado en sacos…), se copian al
    corte y se asignan con suma exacta. **Se muestran separadas de la costura** (costo y pago).
11. **Ayudantes hacen las dos cosas:** pueden recibir operaciones de **costura y de empaque**; los
    costureros también pueden recibir empaque.
12. **Asistencia diaria**: se marca cada día de cada ayudante.

## 3. Cómo se calcula el sueldo (sin descuadres de centavos)

Cada día marcado vale **minutos pagados** de un total de **540** (9 h):

| Día | Minutos pagados |
|---|---|
| Trabajó normal (incluye el sábado de medio día) | 540 |
| Feriado | 540 |
| Faltó | 0 |
| Atraso / salida antes / horas en operaciones | 540 − esos minutos |

`sueldo del mes = Σ (sueldo semanal vigente ese día × minutos pagados) ÷ (6 × 540)`, **redondeado una
sola vez** por operario y mes (half-up, CLAUDE.md §7). Para mostrar cada semana/día ese total se reparte
con el método del mayor resto, así **las semanas suman exactamente el mes** y una semana completa paga
exactamente su sueldo (6 × 66.67 nunca da 400.02).

Ejemplos (sueldo Bs 400):
- Semana completa → **Bs 400.00**.
- Faltó el miércoles → 5 días → **Bs 333.33**.
- Llegó 8:20 el lunes (20 min) → 400 − 400 × 20 / 3240 = **Bs 397.53**.
- El jueves a la tarde (5 h) hizo operaciones → descuenta 5 h de sueldo (**Bs 37.04**) y cobra las
  operaciones aparte.

Un ayudante solo cobra sueldo entre su fecha de ingreso y su fecha de baja. Si el sueldo cambia a mitad de
mes, cada día usa el sueldo vigente ese día.

## 4. Modelo de datos

```
enum RolOperario   + ayudante
enum EstadoAsistencia { trabajo  falta  feriado }

SueldoAyudante   id, operarioId, montoSemanal Int (centavos), vigenteDesde Date
                 // historial: el vigente para un día es el último con vigenteDesde ≤ ese día

Asistencia       id, operarioId, fecha Date (@@unique operarioId+fecha),
                 estado EstadoAsistencia,
                 minutosDescontados Int  // atrasos y salidas antes de hora
                 minutosOperaciones Int  // horas de horario dedicadas a operaciones
                 nota String?

Operacion / CorteOperacion / PlantillaOperacion   + esEmpaque Boolean @default(false)

Liquidacion      + ganadoEmpaque Int, + ganadoSueldo Int   // desglose persistido al cerrar
```

## 5. Reglas que valida la API (y sus tests)

| Regla | Ejemplo / test |
|---|---|
| Sueldo exacto por semana completa | 6 días × 400 → 400.00, no 400.02 |
| Falta / atraso / horas en operaciones | 333.33 · 397.53 · −37.04 (§3) |
| Feriado pagado | feriado + 5 días = 400.00 |
| Cambio de sueldo a mitad de mes | días antes a 400, días después a 450 |
| Minutos válidos | descontados + operaciones ≤ 540; falta/feriado con 0 minutos |
| Solo días de lunes a sábado, dentro de ingreso/baja, rol ayudante | domingo → 400 |
| Asistencia en mes liquidado bloqueada | MES_LIQUIDADO, igual que anticipos |
| **Cierre de mes exige la asistencia completa** de cada ayudante (todos sus lunes–sábado del mes) | falta marcar el 14 → no cierra y dice qué días |
| Empaque separado de costura | el corte muestra costo de costura y de empaque; la liquidación, columnas separadas |
| Costura y empaque se asignan a costureros o ayudantes | ayudante en costura → OK |
| Privacidad (CA-7) | la rendición del ayudante solo trae su sueldo, días y operaciones |

## 6. Pantallas

- **Operarios:** rol **Ayudante**; en su ficha, el **sueldo semanal** con su historial ("desde
  01/10/2026: Bs 400").
- **Asistencia** (menú nuevo): grilla semanal **ayudantes × lunes–sábado**. Cada celda: ✓ trabajó / F
  faltó / Fer feriado, y minutos de atraso y de operaciones. Botón **"Marcar todos presentes"** para el
  día, y el sueldo de la semana calculado en vivo para cada ayudante.
- **Modelos / Plantillas:** casilla **"Empaque"** por operación (o para todo un grupo, ej. EMPAQUE).
- **Corte:** las operaciones de empaque se asignan igual; costos **Costura · Empaque · Servicio de
  corte · Total**.
- **Liquidación:** columnas **Sueldo · Costura · Empaque · Servicio de corte · Moldes · Ganado**.
- **Rendición:** sección **Sueldo** (días trabajados, faltas, minutos descontados, monto) y sección
  **Empaque**, separadas.

## 7. Cuándo se gana cada cosa

- **Sueldo:** en el **día trabajado** (por fecha de asistencia).
- **Costura y empaque:** como hoy, al **cerrar el corte** (`fechaCierre`). Ojo: el ayudante que hizo
  empaque en horario deja de cobrar esas horas de sueldo **ese día**, pero cobra las operaciones cuando
  se cierra el corte (puede ser otra semana).
- **Servicio de corte y moldes:** sin cambios (fecha del trabajo).

## 8. Orden de construcción (rebanadas, cada una con sus tests)

1. **Rol ayudante + sueldo semanal** (ficha e historial).
2. **Asistencia diaria** + cálculo del sueldo (dominio puro con los ejemplos de §3).
3. **Empaque:** marca en operaciones (modelo, plantilla, snapshot del corte) y costos separados.
4. **Liquidación, rendición e inicio** con Sueldo y Empaque; cierre exige asistencia completa.

## 9. Bitácora

- **2026-10-01 — Rebanada 1 (rol ayudante + sueldo).** Rol `ayudante` y `SueldoAyudante` (historial
  por `vigenteDesde`, fechas `@db.Date` sin hora; se borra en cascada con el operario porque no es
  historial de pagos). Alta de ayudante exige sueldo semanal (rige desde su ingreso).
  `POST /operarios/:id/sueldos` (misma fecha = reemplaza) y `DELETE /operarios/:id/sueldos/:id`
  (nunca el único; nada desde un mes liquidado). DTO con `sueldos` y `sueldoVigente` (hoy en hora de
  Bolivia, `lib/hoy.ts`). `ROLES_COSTURA` = costurero o ayudante: los ayudantes ya reciben costura.
  UI: campo de sueldo en el alta, historial con sueldos "programados" en la ficha, chip
  "Ayudante · 400.00/sem". Migración `20261001170000_ayudante_sueldo`. 241 tests en verde.
