-- Desglose del ganado en cada liquidación cerrada: costura / servicio de corte / moldes
-- (docs/PLAN_SERVICIO_CORTE.md §2.12). Los meses ya cerrados solo tenían costura: 0 es correcto.

-- AlterTable
ALTER TABLE "Liquidacion" ADD COLUMN     "ganadoMoldes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ganadoServicioCorte" INTEGER NOT NULL DEFAULT 0;

