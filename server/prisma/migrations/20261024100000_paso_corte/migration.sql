-- Paso de cada corte (docs/PLAN_DIDACTICO_REPORTES.md): dónde está físicamente
-- (en mesa, costura, lavandería, empaque o depósito). Informativo, no toca pagos.

CREATE TYPE "PasoCorte" AS ENUM ('mesa', 'costura', 'lavanderia', 'empaque', 'deposito');

ALTER TABLE "Corte" ADD COLUMN     "paso" "PasoCorte" NOT NULL DEFAULT 'mesa',
ADD COLUMN     "pasoDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- los cortes que ya existen: abiertos → costura; cerrados con prendas en un
-- servicio sin devolver → lavandería; los demás cerrados → depósito
UPDATE "Corte" SET "paso" = 'costura', "pasoDesde" = "fechaInicio" WHERE "estado" = 'abierto';
UPDATE "Corte" c SET "paso" = 'deposito', "pasoDesde" = COALESCE(c."fechaCierre", c."fechaInicio") WHERE c."estado" = 'cerrado';
UPDATE "Corte" c SET "paso" = 'lavanderia'
WHERE c."estado" = 'cerrado'
  AND EXISTS (SELECT 1 FROM "EnvioServicio" e WHERE e."corteId" = c."id" AND e."fechaDevolucion" IS NULL);
