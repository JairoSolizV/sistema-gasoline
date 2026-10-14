-- Tiempo estimado (segundos por prenda) en el catálogo: proceso y, opcional,
-- pieza (manda la pieza). Se congela en cada operación del corte al abrirlo.
-- Solo para estimar la duración del corte; no afecta pagos.

-- AlterTable
ALTER TABLE "Proceso" ADD COLUMN "tiempoSeg" INTEGER;

-- AlterTable
ALTER TABLE "Pieza" ADD COLUMN "tiempoSeg" INTEGER;

-- AlterTable
ALTER TABLE "CorteOperacion" ADD COLUMN "tiempoSeg" INTEGER;
