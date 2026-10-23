-- Surtido por colores para la lavandería (docs/PLAN_SURTIDO.md). Informativo:
-- no toca pagos.
ALTER TABLE "Corte" ADD COLUMN "surtidoColores" JSONB;
ALTER TABLE "Corte" ADD COLUMN "tallasEspeciales" JSONB;
ALTER TABLE "EnvioServicio" ADD COLUMN "color" TEXT;

CREATE TABLE "ColorLavado" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ColorLavado_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ColorLavado_nombre_key" ON "ColorLavado"("nombre");

-- los colores de la hoja del dueño
INSERT INTO "ColorLavado" ("id", "nombre", "orden") VALUES
  (gen_random_uuid()::text, 'VERDE A', 1),
  (gen_random_uuid()::text, 'ENZIMÁTICO', 2),
  (gen_random_uuid()::text, 'BLEACH', 3),
  (gen_random_uuid()::text, 'MAÍS', 4),
  (gen_random_uuid()::text, 'TABACO', 5),
  (gen_random_uuid()::text, 'STONE 4GL', 6),
  (gen_random_uuid()::text, 'MARENGO', 7);
