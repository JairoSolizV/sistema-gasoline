-- Requerimiento: hilo por consumo (docs/PLAN_REQUERIMIENTO.md §2b). Yardas del
-- cono en el insumo y centímetros de cada hilo por prenda en la ficha.
ALTER TABLE "Insumo" ADD COLUMN "yardasPorCono" INTEGER;
ALTER TABLE "FichaCosto" ADD COLUMN "cmHiloPorPrenda" JSONB;
