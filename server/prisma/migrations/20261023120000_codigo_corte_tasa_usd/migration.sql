-- Costos (docs/PLAN_COSTOS.md): código del corte para el que se compró cada
-- insumo, y tipo de cambio para mostrar la docena en dólares.

ALTER TABLE "CompraInsumo" ADD COLUMN "codigoCorte" TEXT;

ALTER TABLE "Configuracion" ADD COLUMN "tasaCambioUsd" INTEGER NOT NULL DEFAULT 118500;

-- Las compras importadas del catálogo traen el corte en la nota:
-- "importado del catálogo (modelo 27)", "(corte 28-1.json)".
UPDATE "CompraInsumo"
SET "codigoCorte" = substring("notas" from '(?:modelo|corte) ([0-9]+(?:-[0-9]+)?)')
WHERE "codigoCorte" IS NULL AND "notas" IS NOT NULL;
