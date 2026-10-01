# Plantillas de modelo (Rebanada 10)

> **Estado:** implementado y verificado el 2026-09-20. CT de referencia agregado el 2026-09-30 (§2.1).
> Depende del catálogo (`docs/PLAN_CATALOGO_MAQUINAS.md`): una plantilla se carga con los mismos
> selectores en cascada máquina → proceso → pieza.

---

## 1. Para qué

Cargar un modelo nuevo son 30-40 operaciones escritas de a una. Casi todas las prendas del taller salen
de la misma receta, así que una **plantilla** guarda esa lista y el alta de modelo la precarga.

La plantilla es **una ayuda de carga, no un modelo**: no se paga, no se corta y no entra en ningún
cálculo. Solo vuelca filas en el formulario.

## 2. Decisiones del dueño

1. **La plantilla guarda un CT de REFERENCIA por operación, no el CT que se paga.** Trae grupo, máquina,
   proceso, pieza, número de paso y un `ctReferencia` opcional (centavos). Al crear un modelo el CT viene
   **precargado** con esa referencia y se puede cambiar fila por fila, porque la misma operación vale
   distinto según la prenda (ya hay 8 ternas con CT distinto entre modelos — PLAN_CATALOGO §2.5).
   *(Cambio del 2026-09-30: antes la plantilla no guardaba ningún precio.)*
   - El CT que se paga es el que queda escrito en el modelo: cambiar la referencia después **no toca**
     ningún modelo ni corte (el modelo ya es independiente de la plantilla, y el corte congela su CT).
   - Una fila sin referencia llega al alta con el CT vacío y hay que escribirlo (sigue siendo obligatorio
     en el modelo).
2. **La del pantalón clásico es fija:** se puede **editar, no eliminar**. Para una variante se duplica.
3. Se llama **"Pantalón clásico"**.

## 3. De dónde sale la plantilla fija

De la hoja **"CLAS GSLN BJO"** del Excel del taller (`AJUSTE MARIO LUIS MIGUEL.xlsm`): **36 operaciones**
en 6 grupos — TRASEROS (5), DELANTEROS (11), ENSAMBLE (7), CERRADO (4), ACABADO (3), PRESILLA (6).

`server/prisma/plantilla-pantalon-clasico.json` guarda las 36 filas **tal cual vienen del Excel**, con sus
abreviaturas y erratas, para que el dato sea auditable contra la planilla original. El seed las normaliza
con las mismas reglas que los modelos (`normalizacion-equipos.ts`), así que la plantilla cae dentro del
catálogo y la cascada la encuentra:

| En el Excel | Queda como |
|---|---|
| `TRAS`, `DEL`, `ENSA`, `CERR`, `ACAB`, `PRESI` | TRASEROS, DELANTEROS, ENSAMBLE, CERRADO, ACABADO, PRESILLA |
| `pope`, `bolsill`, `delant`, `entrepier` | popelina, bolsillo, delantero, entrepierna |
| `atraqie`, `atrque` | atraque |
| `Herraje`, `over` | herraje, overlock |
| `atraqie / jota / delantero` | `atraque / atraque / jota` (columnas invertidas, PLAN_CATALOGO §11.2) |

El Excel también trae los CT (suman 7.16 Bs por prenda) y las asignaciones a operarios. Las asignaciones
**no se guardan** (son de cada corte). Los CT pueden ir como referencia: cada fila del JSON acepta un campo
opcional `"ct"` en Bs (ej. `0.15`). Si la plantilla ya existe en la BD, el seed solo **completa las
referencias vacías** de las filas que siguen siendo la misma operación (mismo orden y misma terna); nunca
pisa una referencia que el dueño ya editó.

## 4. Cómo funciona

- **`/plantillas`** — lista. Por cada una: *Crear modelo*, *Editar*, *Duplicar* y *Eliminar* (esta última
  no existe para la fija). También se crea una plantilla vacía desde cero.
- **`/plantillas/:id`** — editor: la misma tabla del alta de modelo, con una columna **CT ref. (Bs)**
  opcional y el total de referencia por prenda. Se agregan, quitan y editan filas y se guarda todo junto
  (`PUT /plantillas/:id/operaciones`, transaccional).
- **`/modelos/nuevo`** — un selector *"Partir de una plantilla"* vuelca las operaciones con el **CT
  precargado con la referencia**. Si se cambia un CT, debajo queda `ref. 0.15` (un clic la restaura). Se
  puede llegar directo con `?plantilla=<id>`. **El modelo queda independiente**: cambiar la plantilla
  después no lo toca.
- La lista muestra la referencia por prenda y cuántas operaciones no tienen referencia.
- **Duplicar** copia las operaciones a una plantilla nueva que **nunca hereda la protección**.

## 5. Convivencia con el catálogo

Las operaciones de plantilla son texto, igual que las de los modelos y por el mismo motivo
(PLAN_CATALOGO §2.1). Entonces:

- El **backfill** del catálogo deriva sus entradas de los modelos **y de las plantillas**.
- **Renombrar** o **unir** en el catálogo reescribe las dos tablas, o una plantilla quedaría apuntando a un
  nombre que ya no existe (es el bug que apareció al renombrar `atraque` → `atracadora`).
- El **contador de uso** del catálogo suma las dos, así que no se puede borrar una entrada que solo usa una
  plantilla.

## 6. Tests (`server/tests/plantillas.test.ts`)

| Id | Qué verifica |
|---|---|
| PLA-1 | La fija trae las 36 operaciones del Excel, en 6 grupos y en orden. |
| PLA-2 | Solo guarda CT de referencia (no un `ct`), y cada una de sus 36 ternas existe en el catálogo. |
| PLA-3 | La protegida no se puede eliminar (409 `PLANTILLA_PROTEGIDA`). |
| PLA-4 | Pero sí se puede editar. |
| PLA-5 | Duplicar copia las 36 filas, la copia no es protegida, editarla no toca el original y sí se borra. |
| PLA-6 | Alta propia, agregar/editar operaciones y nombre único (409). |
| PLA-7 | Renombrar en el catálogo arrastra también las plantillas. |
| PLA-8 | Lo que usa una plantilla cuenta como en uso y no se puede borrar del catálogo. |
| PLA-9 | La referencia se guarda en centavos, es opcional y suma exacta (alta, PUT y PATCH). |
| PLA-10 | Rechaza referencias en 0, negativas, con fracción de centavo o como texto (400). |
| PLA-11 | Duplicar copia la referencia; editar la copia no toca el original. |
| PLA-12 | Cambiar la referencia no toca un modelo creado con ella. |
