-- Rebanada 4 de ayudantes (docs/PLAN_AYUDANTES.md §4): desglose persistido del
-- ganado al cerrar el mes, con el sueldo de los ayudantes y el empaque aparte.
-- Los meses ya cerrados quedan en 0 (no tenían sueldo ni empaque).

-- AlterTable
ALTER TABLE "Liquidacion" ADD COLUMN     "ganadoEmpaque" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ganadoSueldo" INTEGER NOT NULL DEFAULT 0;
