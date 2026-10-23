-- Caja (docs/PLAN_CAJA.md): efectivo y banco, categorías de ingresos y gastos,
-- movimientos a mano y arqueos. Lo ya registrado (cobros, compras, anticipos…)
-- guarda de qué caja salió. No toca ningún pago.

-- CreateEnum
CREATE TYPE "Caja" AS ENUM ('efectivo', 'banco');

-- CreateEnum
CREATE TYPE "TipoCategoriaCaja" AS ENUM ('ingreso', 'egreso');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('ingreso', 'egreso', 'transferencia');

-- AlterTable
ALTER TABLE "Anticipo" ADD COLUMN     "caja" "Caja" NOT NULL DEFAULT 'efectivo';

-- AlterTable
ALTER TABLE "Cobro" ADD COLUMN     "caja" "Caja" NOT NULL DEFAULT 'efectivo';

-- AlterTable
ALTER TABLE "CompraGasto" ADD COLUMN     "caja" "Caja" NOT NULL DEFAULT 'efectivo';

-- AlterTable
ALTER TABLE "CompraInsumo" ADD COLUMN     "caja" "Caja" NOT NULL DEFAULT 'efectivo';

-- AlterTable
ALTER TABLE "PagoPrestamo" ADD COLUMN     "caja" "Caja" NOT NULL DEFAULT 'efectivo';

-- AlterTable
ALTER TABLE "PagoProveedor" ADD COLUMN     "caja" "Caja" NOT NULL DEFAULT 'efectivo';

-- CreateTable
CREATE TABLE "CajaInicio" (
    "caja" "Caja" NOT NULL,
    "desde" DATE NOT NULL,
    "saldoInicial" INTEGER NOT NULL,

    CONSTRAINT "CajaInicio_pkey" PRIMARY KEY ("caja")
);

-- CreateTable
CREATE TABLE "CategoriaCaja" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCategoriaCaja" NOT NULL,
    "clave" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategoriaCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCaja" (
    "id" TEXT NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "caja" "Caja" NOT NULL,
    "cajaDestino" "Caja",
    "fecha" DATE NOT NULL,
    "monto" INTEGER NOT NULL,
    "categoriaId" TEXT,
    "descripcion" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArqueoCaja" (
    "id" TEXT NOT NULL,
    "caja" "Caja" NOT NULL,
    "fecha" DATE NOT NULL,
    "contado" INTEGER NOT NULL,
    "sistema" INTEGER NOT NULL,
    "diferencia" INTEGER NOT NULL,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArqueoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaCaja_nombre_key" ON "CategoriaCaja"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaCaja_clave_key" ON "CategoriaCaja"("clave");

-- CreateIndex
CREATE INDEX "MovimientoCaja_fecha_idx" ON "MovimientoCaja"("fecha");

-- CreateIndex
CREATE INDEX "ArqueoCaja_caja_fecha_idx" ON "ArqueoCaja"("caja", "fecha");

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Categorías iniciales (editables). Las que tienen clave las usa el sistema
-- para los movimientos que entran solos.
INSERT INTO "CategoriaCaja" ("id", "nombre", "tipo", "clave", "orden") VALUES
  (gen_random_uuid()::text, 'Cobros a clientes', 'ingreso', 'cobros', 1),
  (gen_random_uuid()::text, 'Préstamos o aportes', 'ingreso', 'aportes', 2),
  (gen_random_uuid()::text, 'Otros ingresos', 'ingreso', 'otros_ingreso', 3),
  (gen_random_uuid()::text, 'Tela e insumos', 'egreso', 'insumos', 10),
  (gen_random_uuid()::text, 'Servicios básicos', 'egreso', 'servicios_basicos', 11),
  (gen_random_uuid()::text, 'Servicios externos', 'egreso', 'servicios_externos', 12),
  (gen_random_uuid()::text, 'Operarios', 'egreso', 'operarios', 13),
  (gen_random_uuid()::text, 'Comida', 'egreso', 'comida', 14),
  (gen_random_uuid()::text, 'Transporte', 'egreso', 'transporte', 15),
  (gen_random_uuid()::text, 'Máquinas', 'egreso', 'maquinas', 16),
  (gen_random_uuid()::text, 'Impuestos', 'egreso', 'impuestos', 17),
  (gen_random_uuid()::text, 'Banco', 'egreso', 'banco', 18),
  (gen_random_uuid()::text, 'Retiros para la casa', 'egreso', 'retiros', 19),
  (gen_random_uuid()::text, 'Otros gastos', 'egreso', 'otros_egreso', 20);
