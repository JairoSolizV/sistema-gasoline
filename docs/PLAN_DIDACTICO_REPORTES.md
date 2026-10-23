# Sistema más fácil de entender, impresión y reportes

> **Estado:** aprobado el 2026-10-23 (respuestas §2). Pedido del dueño: que su esposa —que conoce todo
> el proceso de producción pero no de sistemas— lo entienda "como para un niño"; impresión en oficio y
> medio oficio; reportes para analizar después. **No toca ningún pago.**

## 1. Partes

1. **Impresión en todas las pantallas** (oficio y medio oficio, vertical u horizontal) y todas las
   tablas con cabecera fija, filas en franjas y columnas ajustadas.
2. **Pasos del corte** (en mesa → costura → lavandería → empaque → depósito) con un botón para avanzar,
   y **"¿Dónde está mi plata?"**: el camino con dibujos y semáforo, cuánto hay invertido en cada paso y
   cuánto falta para terminar (insumos de costura, de empaque, mano de obra, lavandería).
3. **Palabras simples**, un recuadro "¿Para qué sirve?" en cada pantalla y una **guía paso a paso**.
4. **Reportes** imprimibles: ventas y cobros, producción, compras y gastos, ganancia por modelo.

## 2. Decisiones del dueño (2026-10-23)

- El paso de cada corte lo marca una persona con un botón (no se adivina).
- Insumos de **empaque**: bolsas y tags (etiquetas colgantes, cartón); todo lo demás es de **costura**
  (hilos, cierres, botones, remaches, cuero, etiqueta de talla).
- Ayuda con palabras simples, dibujos y semáforo (verde bien, amarillo atención, rojo problema) y una
  página "Cómo se usa".
- Reportes: los cuatro.

## 3. Medidas de impresión

| Tamaño | Ancho × alto |
|---|---|
| Oficio vertical | 21.5 × 33 cm |
| Oficio horizontal | 33 × 21.5 cm |
| Medio oficio vertical | 16.5 × 21.5 cm |
| Medio oficio horizontal | 21.5 × 16.5 cm |

En medio oficio la página se achica (zoom) para que entre igual.

## 4. Bitácora

- **2026-10-23 — Propuesta y respuestas** (§2).
- **2026-10-24 — Implementado.**
  1. **Impresión:** botón "🖨 Imprimir ▾" arriba de cada página (y en las que ya tenían) con los cuatro
     tamaños; pone el `@page` del tamaño elegido solo mientras imprime y, en medio oficio, achica la página
     (72 % vertical, 80 % horizontal). Al papel salen las franjas y colores, no los botones de acción, y un
     encabezado "Taller · área · impreso el …". Recuerda el último tamaño usado. Tablas que faltaban
     (Cortes, Anticipos, Rendición, Proyección, Plantillas, catálogo, cierre de mes, ficha) con franjas;
     Cortes además con cabecera fija y fechas cortas.
  2. **Pasos del corte:** `Corte.paso` + `pasoDesde` (migración `20261024100000_paso_corte`; los cortes
     existentes se ubican según su estado y envíos). Barra con dibujos y botón "Pasó a…" en cada corte,
     columna "¿Dónde está?" en la lista. Pantalla **¿Dónde está mi plata?** (Finanzas): el camino en 8
     pasos (pedidos → mesa → costura → lavandería → empaque → depósito → por cobrar → cobrado) con "ya
     pusiste / falta poner / vale", semáforo por días en el paso y, arriba, cuánto falta para terminar todo
     separado en insumos de costura, de empaque, mano de obra y lavandería.
  3. **Ayuda:** recuadro "💡 ¿Para qué sirve…?" en cada pantalla (se oculta y se vuelve a abrir con "?"),
     página **Cómo se usa** con el camino del trabajo, y palabras más simples (Pagos del mes, Cuenta de cada
     operario, Historial, Contar la plata).
  4. **Reportes** (Finanzas): ventas y cobros, producción, compras y gastos, ganancia por modelo, por rango
     de meses, con barritas y totales. Módulo `server/src/modules/reportes` (solo lectura).
  398 tests en verde (`dinero` y `reportes` nuevos).
