# CLAUDE.md — Sistema de Pagos del Taller de Confección (Fase 1)

> Este archivo es el contexto permanente para el agente. **Léelo completo antes de escribir código** y, sobre todo, lee los documentos de `/docs` referenciados abajo: contienen las reglas de negocio que no puedes inventar.

---

## 0. Antes de empezar: lee estos documentos (en este orden)

Están en `/docs`. Son la fuente de verdad; ante cualquier duda, mandan ellos, no tus suposiciones.

1. `docs/CONTEXTO_NEGOCIO_TALLER.md` — qué es el negocio y todas las reglas.
2. `docs/FLUJO_SISTEMA_TALLER.md` — pantallas, navegación y flujos paso a paso.
3. `docs/MODELO_DATOS_TALLER.md` — entidades, relaciones y esquema Prisma sugerido.
4. `docs/CRITERIOS_ACEPTACION_TALLER.md` — casos numéricos que tu implementación debe pasar.
5. `docs/seed_datos_taller.json` — datos reales del taller (ya validados) para poblar la BD.
6. El mockup de Claude Design — respeta su estructura visual y de pantallas.

Si algo en el código contradice estos documentos, el documento gana.

---

## 1. Qué es esto (en una frase)

Panel web **administrativo** para un taller de confección en Bolivia que calcula cuánto pagar a cada operario según lo que costuró, y consolida esos pagos por semana y mes cruzándolos con anticipos. Moneda: **Bolivianos (Bs)**, siempre **2 decimales**.

---

## 2. Alcance: qué SÍ y qué NO construir

**SÍ (Fase 1):** operarios, modelos con versiones y tarifas, cortes, asignación de trabajo (por grupo o por operación, dividida hasta en 3 operarios), anticipos, consolidado semanal/mensual con saldos y arrastre, cierre de mes, rendición de cuentas filtrada por operario, configuración.

**NO (no lo construyas todavía, aunque parezca útil):**
- Rol operario / login de operarios / app móvil (es Fase 2).
- Importar/exportar cortes desde Excel (Fase 2).
- Gestión de alimentación u otros costos del taller (no afecta pagos).
- Multiusuario/roles complejos. En Fase 1 hay **un solo administrador**.

Si crees que algo fuera de alcance es necesario, **pregunta antes** de construirlo.

---

## 3. Stack

- **Backend:** Node.js + Express + **Prisma** + **PostgreSQL**.
- **Frontend:** React (Vite) + Tailwind CSS + **TanStack Query** (estado de servidor) + React Router.
- **Lenguaje:** **TypeScript** en backend y frontend. Es un sistema de cálculo de dinero; el tipado reduce errores. (Si el mockup vino en JS, migrá los componentes a TS.)
- **Auth Fase 1:** un único admin. JWT simple o sesión básica; no te compliques.
- **Ejecución:** **100% local** por ahora (mismo wifi del taller). No configures despliegue en la nube en esta fase.

Usa versiones estables actuales de cada paquete. Verifica en la documentación oficial si dudas de una API.

---

## 4. Estructura de carpetas sugerida

```
/docs                      # los 5 documentos + seed (NO los modifiques sin avisar)
/server
  /prisma/schema.prisma    # basado en el Anexo B del modelo de datos
  /prisma/seed.ts          # carga docs/seed_datos_taller.json
  /src
    /modules               # una carpeta por dominio: operarios, modelos, cortes, anticipos, liquidacion
    /lib/money.ts          # utilidades de dinero y redondeo (ver sección 6)
    /lib/calculo.ts        # lógica de pago/saldo (el corazón; con tests)
    app.ts / server.ts
  /tests                   # tests que reflejan docs/CRITERIOS_ACEPTACION_TALLER.md
/client
  /src
    /pages                 # una por sección del menú (Inicio, Operarios, Modelos, Cortes, ...)
    /components
    /api                   # hooks de TanStack Query contra el backend
```

---

## 5. Orden de construcción (rebanadas verticales)

No hagas "todo el backend y luego todo el frontend". Construí **una funcionalidad completa de punta a punta** (BD → API → UI → test) y luego la siguiente. Orden sugerido:

1. **Base:** Prisma schema + migración + seed cargando el JSON.
2. **Operarios** (CRUD + baja lógica).
3. **Modelos y versiones** (catálogo, suma de CT, versionar).
4. **Cortes + Asignación** (la pantalla estrella; incluye snapshot y validación de suma exacta). ← lo más importante y riesgoso.
5. **Anticipos.**
6. **Liquidación / Consolidado** (ganado por período, saldo, arrastre, cierre de mes).
7. **Rendición de cuentas** (vista filtrada por operario).
8. **Dashboard + Configuración.**

Al terminar cada rebanada, corré los criterios de aceptación relevantes antes de seguir.

---

## 6. Reglas que NO se pueden violar (invariantes)

Estas son fuente de errores de pago reales. Trátalas como sagradas:

1. **Suma exacta por operación.** La suma de piezas asignadas a una operación **debe ser exactamente** la cantidad del corte. Una operación con suma distinta queda `parcial` y **bloquea el cierre del corte**. (CA-3.2 a CA-3.4)
2. **Snapshot inmutable.** Al crear un corte, **copia** las operaciones y su `ct` a `CorteOperacion`. Editar tarifas de una versión **no** debe alterar cortes ya creados. (CA-1.4)
3. **El PLUS se paga.** `cantidad_total = Σ corte_por_talla + Σ plus_por_talla`. (CA-2.2)
4. **Versionar conserva el original.** Nueva versión = copia; la anterior queda intacta. (CA-1.3)
5. **Ganado solo de cortes cerrados**, agrupados por `fecha_cierre`. Un corte a medias no se paga. (CA-5.2, CA-5.7)
6. **Saldo = saldo_entrada + ganado − anticipos.** Se arrastra semana a semana; el negativo también se arrastra. Cierre de mes deja saldo en 0 salvo la excepción `arrastra_saldo`. (CA-5.3 a CA-6.3)
7. **Maestro externo** = tarifa base + diferencial (0.10 por defecto, editable). El diferencial se guarda en la asignación. (CA-4.1 a CA-4.3)
8. **Privacidad.** La vista/endpoint de un operario devuelve **solo** sus datos; verifica que el payload no filtre a otros. (CA-7.1, CA-7.2)
9. **Máximo 3 operarios por operación.** (CA-3.5)
10. **Baja de operario = lógica** (`activo=false`); nunca borrado físico. (CA-8.2)

---

## 7. Manejo de dinero (importante)

- Nunca sumes montos con floats "a lo bruto". Usa **enteros en centavos** o una librería decimal (ej. `decimal.js`), y redondeá **una sola vez** al fijar cada `total`, con una regla consistente (half-up a 2 decimales).
- Persistí montos como `Decimal(10,2)` (Prisma) y cuidá la conversión Decimal↔número en la frontera con JS.
- La suma de los totales por operario de un corte debe cuadrar con `cantidad × costo_por_prenda` **sin descuadres de centavos**. (CA-8.1)

---

## 8. Testing

- Traducí `docs/CRITERIOS_ACEPTACION_TALLER.md` a tests automatizados, priorizando los grupos 3 (asignación), 5 (saldos) y 6 (cierre).
- Usá `docs/seed_datos_taller.json` como fixture: varios números salen directo de ahí (8.10, 5.97, 7.68, 6.29, 7.18; 372; 234; −256.40).
- Cada rebanada vertical entrega con sus tests en verde.

---

## 9. Cómo levantar (documentar en README a medida que se crea)

Objetivo: que el dueño levante todo en su máquina del taller con pasos mínimos.
- `server`: variables en `.env` (`DATABASE_URL` a un Postgres local), `prisma migrate dev`, `prisma db seed`, `npm run dev`.
- `client`: `npm run dev`, apuntando a la API local.
- Las demás máquinas del taller acceden por la IP local del equipo servidor.
Mantené este apartado actualizado en el `README.md` real.

---

## 10. Estilo de trabajo con el dueño

- El dueño es estudiante de ingeniería de sistemas: podés ser técnico, pero **explicá las decisiones no obvias** (sobre todo las de la sección 6).
- Ante ambigüedad de negocio, **preguntá** en vez de asumir; los documentos de `/docs` cubren casi todo.
- No sobre-construyas. Fase 1 chica, correcta y verificable vale más que una grande a medias.
