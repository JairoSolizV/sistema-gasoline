# Criterios de Aceptación — Fase 1 (Sistema de Pagos del Taller)

> **Propósito**
> Lista de casos verificables "Dado → Cuando → Entonces" con **números concretos** (varios sacados del Excel real). Sirven para que Claude Code **autoverifique** su implementación y para que el dueño **acepte** el entregable. Si un caso no pasa, la Fase 1 no está lista.
> Moneda Bs, **2 decimales**. Datos base en `seed_datos_taller.json`.

---

## Grupo 1 — Modelos y costo de mano de obra

**CA-1.1 — Suma de CT del modelo.**
Dado el modelo `black DOBLE PRET 06` cargado del seed, cuando se muestra su costo de mano de obra por prenda, entonces debe ser **8.10 Bs** (suma de los 47 CT).

**CA-1.2 — Otros modelos (regresión).**
Los costos por prenda deben dar: `black SHORT 16` = **5.97**, `black SH FALD 20` = **7.68**, `CRUDO SHORT` = **6.29**, `SHORT 2 PRETIN` = **7.18**.

**CA-1.3 — Versionado conserva el original.**
Dado `DOBLE PRET 06 v1` (8.10), cuando se crea la **v2** y se elimina una operación de CT 0.20, entonces v2 = **7.90** y **v1 sigue siendo 8.10** (no se altera).

**CA-1.4 — Snapshot inmutable.**
Dado un corte creado con v1 (ct de "pinza/trasero" = 0.15), cuando después se edita esa tarifa a 0.20 en la versión, entonces el corte ya creado **sigue calculando con 0.15** (usa su snapshot en `CorteOperacion`).

---

## Grupo 2 — Cortes y cantidad

**CA-2.1 — Cantidad total sin PLUS.**
Dado `corte_por_talla = [62,62,62,62,62,62]` y PLUS vacío, entonces `cantidad_total` = **372**.

**CA-2.2 — Cantidad total con PLUS (el PLUS se paga).**
Dado `corte_por_talla = [62,62,62,62,62]` (5 tallas = 310) y `plus_por_talla = [62]` (repite una talla), entonces `cantidad_total` = **372** y todas las operaciones se pagan sobre **372**, no sobre 310.

**CA-2.3 — Costo total del corte.**
Dado DOBLE PRET (8.10/prenda) y cantidad 372, entonces el costo total del corte = `372 × 8.10` = **3013.20 Bs**.

**CA-2.4 — CRUDO SHORT (regresión de cantidad).**
Dado `corte_por_talla = [39,39,39,39,39,39]`, entonces cantidad = **234** y costo total = `234 × 6.29` = **1471.86 Bs**.

---

## Grupo 3 — Asignación y validación de suma exacta

**CA-3.1 — Asignación a un solo operario.**
Dada la operación "pinza/trasero" (ct 0.15) de un corte de 372, asignada 100% a RUBEN (372), entonces su total = `372 × 0.15` = **55.80 Bs** y la operación queda **asignada**.

**CA-3.2 — División válida entre 2 (caso central).**
Dado un corte de 372, cuando RUBEN toma 300 y CLARIS 72, entonces `300 + 72 = 372` → operación **asignada**; totales `300×0.15 = 45.00` y `72×0.15 = 10.80`.

**CA-3.3 — Suma incompleta bloquea.**
Dado un corte de 372, cuando se asigna RUBEN 300 y CLARIS 50 (=350), entonces la operación queda **parcial** (falta 22) y el sistema **no permite cerrar el corte**.

**CA-3.4 — Suma excedida bloquea.**
Dado un corte de 372, cuando la suma asignada da 400, entonces **parcial/ inválida** (sobran 28); no se puede cerrar.

**CA-3.5 — Máximo 3 operarios.**
Cuando se intenta agregar un 4º operario a una misma operación, el sistema lo **impide**.

**CA-3.6 — Asignar grupo completo.**
Dado el grupo DELANTEROS, cuando se usa "asignar grupo completo" a RUBEN, entonces **todas** las operaciones del grupo quedan asignadas a RUBEN con cantidad = cantidad del corte, en estado **asignada**.

---

## Grupo 4 — Maestro externo (+0.10)

**CA-4.1 — Diferencial aplicado.**
Dada una operación de ct 0.20 en corte de 372, cuando 100 piezas las hace un **maestro externo**, entonces su `tarifa_efectiva` = `0.20 + 0.10` = **0.30** y su total = `100 × 0.30` = **30.00 Bs**.

**CA-4.2 — Convive con regular en la misma operación.**
Dado lo anterior, si MARIO (regular) hace las otras 272, su total = `272 × 0.20` = **54.40 Bs**. Total operación = **84.40 Bs**.

**CA-4.3 — Diferencial editable.**
Cuando el diferencial se cambia a 0.15 en configuración, un nuevo maestro externo sobre ct 0.20 cobra **0.35/pieza** (las asignaciones ya guardadas no cambian).

---

## Grupo 5 — Consolidado, saldos y arrastre

**CA-5.1 — Ganado por operario a través de varios cortes.**
Dado que RUBEN ganó 1246.20 en el corte A y 465.00 en el corte B (ambos cerrados en el mismo mes), entonces su `total_ganado` del período = **1711.20 Bs**.

**CA-5.2 — Solo cuentan cortes cerrados.**
Dado un corte a medias (estado `abierto`) en el mes, su ganado **no** entra en la liquidación del período.

**CA-5.3 — Saldo = ganado − anticipos.**
Dado CHEMA con ganado 243.60 y anticipo 500.00, entonces `saldo_periodo` = `243.60 − 500` = **−256.40 Bs**.

**CA-5.4 — Arrastre de saldo negativo.**
Dado el saldo −256.40 de CHEMA al cerrar el mes, entonces el mes siguiente arranca con `saldo_entrada` = **−256.40** para CHEMA.

**CA-5.5 — Varios anticipos por semana.**
Dado un operario con anticipo el sábado (300) y otro de emergencia el miércoles (150) en la misma semana, entonces sus `total_anticipos` suman **450.00** y ambos aparecen en el histórico.

**CA-5.6 — Advertencia de tope (no bloqueo).**
Dado un anticipo de 2500 con tope 2000, entonces el sistema **advierte** pero **permite guardarlo**.

**CA-5.7 — Agrupación por fecha de cierre, no por semana fija.**
Dado un corte que tomó 15 días y cerró el 20 del mes, entonces su ganado cuenta en el **mes del 20**, sin importar en qué semanas se trabajó.

---

## Grupo 6 — Cierre de mes

**CA-6.1 — Cierre deja saldo en cero (caso normal).**
Dado un operario con `saldo_periodo` = 800.00, cuando se liquida el mes pagándole todo, entonces `pagado` = 800.00 y `saldo_salida` = **0.00**.

**CA-6.2 — Excepción de arrastre a favor.**
Dado TEO con `saldo_periodo` = 800.00 que solo cobra 500 (viaje/ahorro), cuando se marca `arrastra_saldo`, entonces `pagado` = 500.00 y `saldo_salida` = **300.00**, que pasa como `saldo_entrada` del mes siguiente.

**CA-6.3 — Nuevo mes parte limpio (salvo excepción).**
Tras un cierre normal, todos los operarios (sin excepción marcada) arrancan el mes siguiente con `saldo_entrada` = **0.00**.

---

## Grupo 7 — Privacidad (rendición de cuentas)

**CA-7.1 — Vista filtrada por operario.**
Dado el operario CLARIS, cuando se abre su rendición de cuentas, entonces se ven **solo** sus operaciones, piezas, ganado, anticipos y saldo; **ningún** dato de otro operario aparece en la vista ni en la respuesta de datos.

**CA-7.2 — Sin fuga en la API.**
La respuesta del backend para la vista de un operario **no debe incluir** montos ni nombres de otros operarios (verificar el payload, no solo la UI).

---

## Grupo 8 — Reglas transversales

**CA-8.1 — Redondeo a 2 decimales, consistente.**
Todos los totales se muestran y guardan con 2 decimales; la suma de los totales por operario debe cuadrar con el costo total del corte **sin descuadres de centavos** (definir una sola regla de redondeo y aplicarla en cada `total`).

**CA-8.2 — Baja de operario conserva histórico.**
Dado un operario dado de baja, sus cortes y liquidaciones pasadas **siguen intactos y consultables**; solo deja de aparecer para asignaciones nuevas.

**CA-8.3 — No cerrar corte incompleto.**
Un corte con al menos una operación `sin_asignar` o `parcial` **no** puede pasar a `cerrado`.

**CA-8.4 — Alimentación no afecta pagos.**
En Fase 1 no existe descuento de alimentación; el saldo del operario **no** se ve afectado por ningún concepto de comida.

---

## Cómo usar esta lista
- Convertir cada `CA-*` en un test automatizado (unit/integration) donde aplique, sobre todo los grupos 1–6.
- Los grupos 3, 5 y 6 son los de mayor riesgo (validación de suma, saldos, arrastre): priorizar su cobertura.
- Usar `seed_datos_taller.json` como fixture; los números de CA-1.2, CA-2.4, CA-5.3 salen directo de ahí.
