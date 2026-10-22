-- Cuentas separadas (docs/PLAN_CUENTAS_SEPARADAS.md §4): el anticipo se carga
-- a una cuenta y la liquidación tiene una fila por operario y cuenta.
-- Los anticipos ya cargados pasan a "operaciones" (todos eran de costureros).
-- Liquidacion.cuenta va SIN default a propósito: al 2026-10-22 no hay meses
-- cerrados; si los hubiera, esta migración falla en vez de asignarlos mal.

-- CreateEnum
CREATE TYPE "Cuenta" AS ENUM ('operaciones', 'empaque', 'servicio_corte', 'moldes', 'sueldo', 'lavanderia', 'bordado');

-- DropIndex
DROP INDEX "Liquidacion_periodoId_operarioId_key";

-- AlterTable
ALTER TABLE "Anticipo" ADD COLUMN     "cuenta" "Cuenta" NOT NULL DEFAULT 'operaciones';

-- AlterTable
ALTER TABLE "Liquidacion" DROP COLUMN "ganadoEmpaque",
DROP COLUMN "ganadoMoldes",
DROP COLUMN "ganadoServicioCorte",
DROP COLUMN "ganadoSueldo",
ADD COLUMN     "cuenta" "Cuenta" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Liquidacion_periodoId_operarioId_cuenta_key" ON "Liquidacion"("periodoId", "operarioId", "cuenta");
