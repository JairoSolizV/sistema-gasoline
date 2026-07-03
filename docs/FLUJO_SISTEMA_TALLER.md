# Flujo del Sistema y Mapa de Funcionalidades — Panel Administrativo (Fase 1)

> **Propósito de este documento**
> Describe **cómo se navega el sistema, qué pantallas tiene, qué hace cada una y en qué orden ocurren las cosas** (flujos paso a paso). Es el complemento del documento de contexto de negocio (`CONTEXTO_NEGOCIO_TALLER.md`), que define las reglas. Aquí se define la **arquitectura de la aplicación** y **dónde vive cada funcionalidad**.
> **Alcance de esta fase:** solo el **rol administrador** (el dueño del taller). El **rol operario** y la **app móvil** son una fase posterior (ver Sección 10).
> Este documento **no** define tablas ni relaciones de base de datos.

---

## 1. Roles del sistema

- **Administrador (Fase 1 — presente):** el dueño. Ve y controla **todo**: plantel, modelos, cortes, asignaciones, anticipos, liquidaciones y rendición de cuentas.
- **Operario (Fase 2 — futuro):** solo verá **sus propios** cortes/operaciones/pagos, desde una **app móvil** que se conecta al mismo backend. En Fase 1, la vista de "Rendición de cuentas" (Sección 6.7) es la **semilla** de lo que verá el operario.

Toda la Fase 1 asume un **único usuario administrador** autenticado. La gestión de múltiples usuarios/roles se prepara conceptualmente pero se implementa en la Fase 2.

---

## 2. Arquitectura de navegación (menú principal)

El panel administrativo se organiza en un **menú lateral fijo** con estas secciones:

1. **Inicio** (Dashboard)
2. **Operarios** (Plantel)
3. **Modelos** (Catálogo de prendas y tarifas)
4. **Cortes** (Producción y asignación de trabajo) ← módulo central
5. **Anticipos**
6. **Liquidación** (Consolidado semanal y mensual)
7. **Rendición de cuentas** (Vista filtrada por operario)
8. **Configuración**

El orden del menú refleja el flujo natural de trabajo: primero se configuran **operarios** y **modelos**, luego se producen **cortes**, se registran **anticipos**, se **liquida** y finalmente se **rinde cuentas**.

---

## 3. Estados del sistema (máquinas de estado)

Para que los flujos sean coherentes, el sistema maneja estos estados:

**Estado de un Corte:**
- `Borrador` → recién creado, aún se está configurando (modelo, tallas, cantidad).
- `Abierto` → en producción/asignación. Se pueden asignar operaciones a operarios.
- `Cerrado / Liquidado` → tiene fecha de cierre fijada; entra al consolidado. Ya no se edita (salvo corrección explícita).

**Estado de una Operación dentro de un corte:**
- `Sin asignar` → nadie tiene piezas de esta operación.
- `Parcial` → hay asignaciones pero la suma **no cuadra** con la cantidad del corte (inválido, se marca en rojo).
- `Asignada` → la suma de piezas asignadas **es exactamente** la cantidad del corte (válido, verde).

**Estado de un Período (mes):**
- `Abierto` → se está acumulando trabajo y anticipos.
- `Cerrado` → se liquidó; los saldos volvieron a 0 (salvo excepciones de arrastre).

> **Regla dura de coherencia:** un corte **no puede pasar a `Cerrado`** si tiene operaciones en estado `Sin asignar` o `Parcial`. Todas deben estar `Asignada`.

---

## 4. Diagrama de flujo general del negocio

```
[Configurar plantel] ──┐
                       ├──> [Crear/versionar MODELO] ──> [Crear CORTE] ──> [Asignar trabajo] ──> [Cerrar corte]
[Configurar tarifas] ──┘                                                                              │
                                                                                                      ▼
[Registrar ANTICIPOS (sábados + emergencias)] ─────────────────────────────────> [CONSOLIDAR período]
                                                                                                      │
                                                                                                      ▼
                                                                                     [Saldo = Ganado − Anticipos]
                                                                                                      │
                                                                                                      ▼
                                                              [Cierre de mes: liquidar todo, saldo a 0]
                                                                     (excepción: arrastrar saldo a favor)
                                                                                                      │
                                                                                                      ▼
                                                              [RENDICIÓN DE CUENTAS filtrada por operario]
```

---

## 5. Flujos principales paso a paso

### 5.1 Flujo A — Configurar un modelo nuevo
1. Ir a **Modelos → Nuevo modelo**.
2. Ingresar el nombre del modelo (ej. `black DOBLE PRET 06`).
3. Agregar las **operaciones** una por una: grupo (`PR`), número de paso (`N`), equipo/máquina, proceso, pieza y **CT** (costo por operación por pieza).
4. A medida que se agregan operaciones, el sistema calcula automáticamente la **suma de CT = costo de mano de obra por prenda** y lo muestra en pantalla.
5. Guardar. El modelo queda disponible como **versión 1 (v1)**.

### 5.2 Flujo B — Optimizar/versionar un modelo
1. Ir a **Modelos → [modelo existente] → Crear nueva versión**.
2. El sistema **duplica** todas las operaciones de la versión actual.
3. El administrador **quita o edita** las operaciones que se optimizaron (para ahorrar tiempo/pago).
4. El nuevo costo de mano de obra por prenda se recalcula solo.
5. Guardar como **vX**. La versión anterior se **conserva** (histórico intacto).
6. Los cortes futuros pueden elegir producir con **v1 o vX**.

### 5.3 Flujo C — Producir un corte (crear → asignar → cerrar)
1. Ir a **Cortes → Nuevo corte** (estado `Borrador`).
2. Elegir **modelo + versión**.
3. Ingresar el **desglose por talla** (TALLA / CORTE / PLUS). El sistema muestra el total por talla y la **cantidad total del corte** (referencia de producción; solo la cantidad total entra al cálculo).
4. Confirmar → el sistema **genera todas las operaciones** del modelo con la **cantidad del corte pre-cargada**, todas en estado `Sin asignar`. El corte pasa a `Abierto`.
5. **Asignar trabajo** (ver Flujo D).
6. Cuando **todas** las operaciones estén `Asignada` (suma exacta), habilitar **Cerrar corte**.
7. Al cerrar, se **fija la fecha de cierre/liquidación**. El corte pasa a `Cerrado` y entra al consolidado del período correspondiente.

### 5.4 Flujo D — Asignar trabajo (híbrido)
Dentro de la pantalla del corte, las operaciones se ven **agrupadas por grupo** (TRASEROS, DELANTEROS, ENSAMBLE, CERADO, ACABADO, PRESILLA, PARCHE…).

**Modo rápido (operario experto):**
1. En un grupo, usar el botón **"Asignar grupo completo a un operario"**.
2. Elegir el operario. Todas las operaciones del grupo quedan asignadas a esa persona con la cantidad total del corte.

**Modo detallado (aprendices / división):**
1. **Abrir** un grupo para ver sus operaciones individuales.
2. En una operación, asignar de **1 a 3 operarios**, cada uno con una **cantidad de piezas**.
3. El sistema valida **en vivo** que la suma de las cantidades sea **exactamente** la cantidad del corte:
   - Suma exacta → operación en verde (`Asignada`).
   - Suma incompleta o excedida → rojo (`Parcial`), con el faltante/sobrante indicado.
4. Si un operario de la asignación es **maestro externo**, marcarlo como tal → se aplica el **+0.10 Bs/pieza** sobre la tarifa base (valor por defecto editable).
5. El sistema muestra, en tiempo real, el **pago por asignación** y el **total acumulado por operario** dentro del corte.

### 5.5 Flujo E — Registrar anticipos
1. Ir a **Anticipos → Registrar anticipo**.
2. Elegir operario, fecha y monto.
3. Si el monto **supera el tope configurado**, el sistema muestra una **advertencia** (no bloquea).
4. Guardar. Puede haber **varios anticipos por semana** para un mismo operario (sábado + emergencias).

### 5.6 Flujo F — Consolidar y liquidar el mes
1. Ir a **Liquidación**, elegir el **mes** (y ver el desglose por semanas / fechas de cierre).
2. El sistema calcula, **por operario**:
   - **Total ganado** = suma de lo ganado en **todos los cortes** cuya fecha de cierre cae en el período.
   - **Anticipos acumulados** del período.
   - **Saldo = Ganado − Anticipos**, con **arrastre semana a semana**.
3. Revisar la planilla consolidada.
4. **Cierre de mes:** acción **"Liquidar mes"** → se paga todo, el saldo vuelve a **0** para todos.
5. **Excepción:** marcar a los operarios que **no cobran todo** (viaje, ahorro, urgencia) → su **saldo a favor se arrastra** al mes siguiente en vez de quedar en 0.
6. Exportar/imprimir la planilla para el pago.

### 5.7 Flujo G — Rendir cuentas a un operario
1. Ir a **Rendición de cuentas**.
2. Elegir un operario.
3. El sistema muestra **únicamente** los cortes, operaciones, piezas, ganado, anticipos y saldo **de ese operario** — sin datos de los demás.
4. Imprimir/compartir esa vista para mostrársela al operario.

---

## 6. Detalle de cada módulo (dónde vive cada funcionalidad)

### 6.1 Inicio (Dashboard)
Panorama del taller en una sola pantalla:
- **Cortes activos** (`Abierto`): modelo, avance de asignación (cuántas operaciones ya están `Asignada`), fecha de inicio.
- **Resumen del período actual**: total a pagar estimado, anticipos entregados, saldos pendientes.
- **Accesos rápidos**: "Nuevo corte", "Registrar anticipo".
- **Alertas** (centro de coherencia del sistema):
  - Cortes con operaciones `Sin asignar` o `Parcial` (no se pueden cerrar).
  - Anticipos que excedieron el tope.
  - Fin de mes cercano con liquidación pendiente.

### 6.2 Operarios (Plantel)
- **Lista** de operarios con estado (activo/inactivo) y tipo (regular / maestro externo).
- **Alta**: nombre, tipo, fecha de ingreso.
- **Editar / Dar de baja**: la baja **no borra** el histórico (los pagos pasados se conservan); solo lo saca de las asignaciones futuras.
- **Ficha del operario**: histórico de cortes en los que trabajó, piezas, ganado y anticipos.

### 6.3 Modelos (Catálogo)
- **Lista** de modelos y sus **versiones**.
- **Crear modelo** / **agregar operaciones** (grupo, N, equipo, proceso, pieza, CT).
- **Editar** tarifas/operaciones.
- **Versionar** (Flujo B): duplicar → optimizar → guardar como nueva versión, conservando la anterior.
- **Detalle**: operaciones ordenadas por grupo y la **suma de CT** (costo de mano de obra por prenda) siempre visible.

### 6.4 Cortes (módulo central)
- **Lista** de cortes con filtros por modelo, fecha y estado (`Borrador` / `Abierto` / `Cerrado`).
- **Nuevo corte** (Flujo C): modelo + versión, desglose por talla, cantidad total.
- **Pantalla del corte** (Flujo D):
  - Operaciones agrupadas por grupo.
  - Botón **"Asignar grupo completo"** (modo rápido).
  - **Abrir grupo** → asignar operación por operación, hasta 3 operarios, con **validación de suma exacta** en vivo.
  - Marca de **maestro externo** (+0.10 editable) por asignación.
  - **Pago por asignación** y **total por operario** en tiempo real.
  - **Cerrar corte** (habilitado solo si todo está `Asignada`) → fija fecha de cierre.
- **Desglose por talla** visible como referencia (no afecta el cálculo).

### 6.5 Anticipos
- **Registrar anticipo** (Flujo E): operario, fecha, monto, con **advertencia** de tope.
- **Histórico** de anticipos filtrable por operario y por semana/mes.
- **Editar / eliminar** anticipos (con confirmación, por el impacto en saldos).

### 6.6 Liquidación (Consolidado)
- **Selector de período** (mes, con desglose por semanas / fechas de cierre).
- **Planilla consolidada por operario**: ganado, anticipos, **saldo** con arrastre.
- **Cierre de mes** (Flujo F): liquidar todo → saldo a 0, con **excepción de arrastre** marcable por operario.
- **Exportar/imprimir** planilla de pago.

### 6.7 Rendición de cuentas (vista filtrada) — semilla del rol operario
- **Selector de operario** → detalle **solo de él** (Flujo G).
- Vista de **solo lectura**, imprimible/compartible.
- Motivo: evitar comparaciones y roces entre operarios; cada uno ve **únicamente lo suyo**.
- **Nota de evolución:** esta misma vista, con autenticación por operario, es la que se expondrá en la **app móvil de la Fase 2**.

### 6.8 Configuración
- **Tope de anticipo** (usado como advertencia).
- **Diferencial de maestro externo** (valor por defecto 0.10, editable).
- **Datos del taller**.
- (Preparado para Fase 2) **Gestión de usuarios y roles**.

---

## 7. Puntos de validación críticos (coherencia)

El sistema debe hacer cumplir estos controles, porque afectan pagos reales:

1. **Suma exacta por operación**: la suma de piezas asignadas = cantidad del corte. Sin esto, no se cierra el corte.
2. **Cierre de corte bloqueado** si quedan operaciones `Sin asignar` o `Parcial`.
3. **Advertencia de tope de anticipo** (no bloqueo).
4. **Precisión monetaria**: Bs con 2 decimales; cuidar acumulación de errores de punto flotante en sumatorias grandes.
5. **Baja de operario** conserva histórico; no debe romper cortes/liquidaciones pasadas.
6. **Arrastre de saldo** correcto entre semanas y entre meses (con la excepción de fin de mes).

---

## 8. Recorrido de usuario de punta a punta (ejemplo narrado)

Para dejar el flujo **coherente y concreto**, este es un ciclo completo típico:

1. El admin da de alta a los operarios del taller (**Operarios**).
2. Carga el modelo `black DOBLE PRET 06` con sus operaciones y tarifas; el sistema muestra 8.1 Bs de mano de obra por prenda (**Modelos**).
3. Llega un pedido: crea un **corte** de ese modelo, ingresa las tallas → cantidad total 372 (**Cortes → Nuevo corte**).
4. Asigna todo el grupo `DELANTEROS` a RUBEN (experto) con el botón rápido; en `TRASEROS/pinza` divide: RUBEN 300 y CLARIS 72 (validación: 300+72=372 ✔) (**Cortes → asignación**).
5. Durante la semana registra anticipos: sábado, varios operarios piden adelanto; a MARIO se le da uno de emergencia el miércoles (**Anticipos**).
6. Termina el corte (2 semanas después) y lo **cierra** con su fecha de liquidación (**Cortes → Cerrar**).
7. A fin de mes va a **Liquidación**, elige el mes: el sistema suma lo ganado por cada operario en todos los cortes del período, resta anticipos y muestra el saldo.
8. **Liquida el mes**: paga todo, saldos a 0. TEO viajó y no cobró todo → marca su saldo a favor para arrastrarlo (**Liquidación**).
9. Le muestra a cada operario **solo su detalle** (**Rendición de cuentas**) y cierra el ciclo.

---

## 9. Stack asumido (para contexto del flujo)

Este documento asume el siguiente stack (coherente con proyectos previos del dueño). No es prescriptivo salvo para dar contexto:

- **Web (Fase 1):** React (frontend) + Node.js/Express (API REST) + PostgreSQL (datos).
- El backend expone una **API REST** que en la Fase 2 será consumida **también** por la app móvil del operario, sin duplicar lógica de servidor.

---

## 10. Anexo — Fase 2 (futuro): rol operario y app móvil

No se implementa ahora, pero el diseño de la Fase 1 debe dejarlo preparado:

- **Rol operario** con autenticación propia.
- **App móvil (React Native + Expo)** que se conecta al **mismo backend/API** de la web.
- El operario podrá **registrar su progreso diario** (qué operaciones/piezas hizo) desde el celular, y eso se sincroniza con la web.
- Consideración **offline-first**: el taller puede tener conectividad irregular; el registro debe funcionar sin internet y sincronizar al reconectar.
- La **vista de Rendición de cuentas** de la Fase 1 es el punto de partida de lo que el operario verá en su app: **solo sus propios datos**.

**Implicación para Fase 1:** construir el backend pensando en API REST reutilizable, mantener la separación de datos por operario (para el filtrado), y evitar meter lógica de negocio solo en el frontend web (que la móvil no podría reutilizar).
