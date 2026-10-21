-- Calculadora de tendido: rollos de tela del corte (cm), traslape de empalme y
-- retazo mínimo útil. Informativo: no afecta pagos.

-- AlterTable
ALTER TABLE "Corte" ADD COLUMN "rollosCm" JSONB,
ADD COLUMN "traslapeCm" INTEGER,
ADD COLUMN "retazoMinimoCm" INTEGER;
