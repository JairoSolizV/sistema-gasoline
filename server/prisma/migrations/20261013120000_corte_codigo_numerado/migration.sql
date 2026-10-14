-- El código del corte pasa de texto libre opcional a numeración única
-- obligatoria (N° 1, 2, 3…). Cortes existentes:
--  1. los que ya tenían un código numérico lo conservan (si estaba repetido,
--     se lo queda el corte más antiguo);
--  2. el resto se numera después del mayor, en orden de fecha de inicio.
ALTER TABLE "Corte" ADD COLUMN "codigo_num" INTEGER;

WITH convertidos AS (
  -- CASE: el CAST solo se evalúa sobre textos que son números
  SELECT id, "fechaInicio",
         CASE WHEN codigo ~ '^\s*[0-9]{1,9}\s*$' THEN CAST(TRIM(codigo) AS INTEGER) END AS n
  FROM "Corte"
),
numericos AS (
  SELECT id, n, ROW_NUMBER() OVER (PARTITION BY n ORDER BY "fechaInicio", id) AS rn
  FROM convertidos
  WHERE n > 0
)
UPDATE "Corte" c SET "codigo_num" = numericos.n
FROM numericos
WHERE c.id = numericos.id AND numericos.rn = 1;

WITH base AS (SELECT COALESCE(MAX("codigo_num"), 0) AS m FROM "Corte"),
resto AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "fechaInicio", id) AS rn
  FROM "Corte"
  WHERE "codigo_num" IS NULL
)
UPDATE "Corte" c SET "codigo_num" = base.m + resto.rn
FROM base, resto
WHERE c.id = resto.id;

ALTER TABLE "Corte" DROP COLUMN "codigo";
ALTER TABLE "Corte" RENAME COLUMN "codigo_num" TO "codigo";
ALTER TABLE "Corte" ALTER COLUMN "codigo" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Corte_codigo_key" ON "Corte"("codigo");
