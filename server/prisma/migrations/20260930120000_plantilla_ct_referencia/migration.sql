-- CT de referencia (centavos) en las operaciones de plantilla: solo sugiere el
-- precio al crear un modelo; no afecta ningún modelo ni corte existente.
ALTER TABLE "PlantillaOperacion" ADD COLUMN "ctReferencia" INTEGER;
