-- Marca de operación de empaque (docs/PLAN_AYUDANTES.md §2.10): en el modelo, la plantilla,
-- los bloques del catálogo y el snapshot del corte. Todo lo existente queda como costura (false).

-- AlterTable
ALTER TABLE "CorteOperacion" ADD COLUMN     "esEmpaque" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GrupoOperacion" ADD COLUMN     "esEmpaque" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Operacion" ADD COLUMN     "esEmpaque" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PlantillaOperacion" ADD COLUMN     "esEmpaque" BOOLEAN NOT NULL DEFAULT false;

