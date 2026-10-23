# Surtido por colores para la lavandería

> **Estado:** implementado y verificado el 2026-10-23.
> Sale de la hoja del dueño `ENSENANDO A SURTIR A CLOUD.xlsx`: el mismo corte de 1690 prendas
> surtido en 7, 6, 5 y 4 colores.

---

## 1. Para qué

Después de coser, las prendas de un corte se mandan a la lavandería en varios **colores de lavado**
(VERDE A, ENZIMÁTICO, BLEACH…). Hay que decidir cuántas prendas de cada talla van a cada color y cuántas
docenas salen de cada uno. El sistema hace esa cuenta, la imprime para la lavandería y puede registrar
un envío por color.

**Es solo informativo: no toca ningún pago.** Los envíos que registra son envíos normales de
lavandería (PLAN_CUENTAS_SEPARADAS §5) y se pagan como siempre, al devolver.

## 2. Decisiones del dueño (2026-10-23)

1. **Lo que sobra se reparte parejo, de a 1**, empezando por el primer color. 169 juegos en 5 colores
   → 34, 34, 34, 34, 33: así salen más colores en docenas completas. (En su hoja de 5 colores lo había
   hecho de a 2, 35-35-33-33-33, que deja a todos con media docena suelta.)
2. **El sistema calcula, imprime la hoja y registra un envío a lavandería por color.**
3. **NORMAL / ESPECIAL:** por defecto es ESPECIAL desde la talla 48; en cada corte se puede cambiar.
4. **Colores:** una lista guardada y editable (arranca con los 7 de la hoja). En cada corte se marcan
   los que van y en qué orden.

En la hoja había dos errores, que el sistema no repite: con 5 colores la talla 46 sumaba 165 en vez de
169, y con 6 colores ENZIMÁTICO de ESPECIAL decía 25 cuando el corte da 28.

## 3. El cálculo (`shared/src/surtido.ts`)

Cada grupo (NORMAL y ESPECIAL) se surte aparte:

1. **Juegos:** la proporción mínima entre tallas. 169-338-338-169 = juego 1-2-2-1 (6 prendas, media
   docena) × 169 juegos. ESPECIAL 169 × 4 = juego 1-1-1-1 × 169.
2. Los **juegos se reparten parejo** entre los colores (regla §2.1). Cada color conserva la proporción
   de tallas.
3. **Surtido por docena** = el juego llevado a 12 prendas: 1-2-2-1 → 2-4-4-2; 1-1-1-1 → 3-3-3-3.
4. Si las tallas **no guardan proporción** (juego de más de 12 prendas, ej. 118-121-121-122-119), cada
   talla se reparte parejo y lo que sobra va al color que lleva menos. Sin surtido por docena.
5. El **plus** también se lava: se reparte talla por talla, al color que lleva menos.
6. **Docenas** de cada color = prendas ÷ 12, mostrado como "12 doc + 6".

Todo en prendas enteras: cada talla suma exacto lo del corte.

## 4. Datos

- `ColorLavado` (nombre único, orden, activo). La migración carga los 7 colores de la hoja.
- `Corte.surtidoColores` (nombres en orden; null = sin surtido) y `Corte.tallasEspeciales` (null = desde
  la 48). Se guarda el **nombre**: renombrar o quitar un color de la lista no cambia cortes ya surtidos.
- `EnvioServicio.color`: el color de lavado de un envío que salió del surtido (informativo).

## 5. API

- `GET/POST /colores-lavado`, `PATCH/DELETE /colores-lavado/:id` (devuelven la lista completa).
- `PUT /cortes/:id/surtido` `{ colores, tallasEspeciales }`: no en borrador; colores sin repetir (máx. 12),
  tallas del corte.
- `POST /cortes/:id/surtido/envios` `{ operarioId, precioPrenda?, fechaEnvio }`: un envío de lavandería
  por color con sus prendas, todos o ninguno. Mismas reglas que un envío suelto: proveedor de
  lavandería activo, precio del proveedor si no se indica y sin pasar de las prendas del corte (no se
  puede mandar dos veces).

## 6. Pantalla

En el detalle del corte, arriba de "Servicios externos", la sección **Surtido para lavandería**: elegir
colores (en orden, con ◂ ▸ para moverlos), agregar colores nuevos a la lista, marcar las tallas
ESPECIAL. Mientras se edita, la tabla muestra la **vista previa**. Ya guardado: la tabla por grupo
(filas = tallas, columnas = colores, prendas y docenas abajo), el total por color, **Imprimir hoja**
(solo la hoja, en oficio o medio oficio) y **Registrar envío a lavandería**. El color aparece en cada
envío de Servicios externos.

## 7. Tests

`server/tests/domain-surtido.test.ts` (SUR-1 a SUR-8: los casos de la hoja en 7, 6, 5 y 4 colores,
sumas exactas, plus, tallas sin proporción) y `server/tests/surtido.test.ts` (SUR-A1 a SUR-A7: lista de
colores, guardar, validaciones, envío por color, no mandar dos veces, la costura no cambia).
