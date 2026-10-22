-- Costos fijos del taller (docs/PLAN_COSTOS.md §7c): gastos fijos con % del taller
-- e historial de montos, compras (comida), préstamos con sus pagos y las prendas
-- por mes con las que se reparten en las fichas. Solo consulta: no toca pagos.

-- CreateEnum
CREATE TYPE "GrupoGastoFijo" AS ENUM ('personal', 'operativos', 'servicios', 'maquinas', 'impuestos', 'otros');

-- CreateEnum
CREATE TYPE "TipoGastoFijo" AS ENUM ('mensual', 'por_compras');

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "prendasMesCostoFijo" INTEGER NOT NULL DEFAULT 1500;

-- CreateTable
CREATE TABLE "GastoFijo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "grupo" "GrupoGastoFijo" NOT NULL,
    "tipo" "TipoGastoFijo" NOT NULL DEFAULT 'mensual',
    "porcentajeTaller" INTEGER NOT NULL DEFAULT 10000,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GastoFijo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoFijoMonto" (
    "id" TEXT NOT NULL,
    "gastoId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "vigenteDesde" DATE NOT NULL,

    CONSTRAINT "GastoFijoMonto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraGasto" (
    "id" TEXT NOT NULL,
    "gastoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" INTEGER NOT NULL,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompraGasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prestamo" (
    "id" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "cuota" INTEGER NOT NULL,
    "diaVencimiento" INTEGER NOT NULL,
    "cuotasRestantes" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prestamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoPrestamo" (
    "id" TEXT NOT NULL,
    "prestamoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" INTEGER NOT NULL,

    CONSTRAINT "PagoPrestamo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GastoFijo_nombre_key" ON "GastoFijo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "GastoFijoMonto_gastoId_vigenteDesde_key" ON "GastoFijoMonto"("gastoId", "vigenteDesde");

-- CreateIndex
CREATE INDEX "CompraGasto_gastoId_fecha_idx" ON "CompraGasto"("gastoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "PagoPrestamo_prestamoId_anio_mes_key" ON "PagoPrestamo"("prestamoId", "anio", "mes");

-- AddForeignKey
ALTER TABLE "GastoFijoMonto" ADD CONSTRAINT "GastoFijoMonto_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "GastoFijo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraGasto" ADD CONSTRAINT "CompraGasto_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "GastoFijo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoPrestamo" ADD CONSTRAINT "PagoPrestamo_prestamoId_fkey" FOREIGN KEY ("prestamoId") REFERENCES "Prestamo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

