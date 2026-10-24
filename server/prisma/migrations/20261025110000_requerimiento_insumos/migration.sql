-- Requerimiento de insumos de un corte (docs/PLAN_REQUERIMIENTO.md). Solo
-- consulta: no toca pagos ni registra compras.
ALTER TABLE "Insumo" ADD COLUMN "unidadesPorEnvase" INTEGER;
ALTER TABLE "Insumo" ADD COLUMN "precioEnvase" INTEGER;
ALTER TABLE "Insumo" ADD COLUMN "porTalla" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FichaCosto" ADD COLUMN "cierresPorTalla" JSONB;
ALTER TABLE "Configuracion" ADD COLUMN "hilosMaquinas" JSONB;
ALTER TABLE "Corte" ADD COLUMN "hilosRequerimiento" JSONB;
