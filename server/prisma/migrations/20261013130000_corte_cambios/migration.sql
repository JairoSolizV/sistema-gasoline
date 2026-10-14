-- Historial de modificaciones de último momento a las operaciones de un corte.

-- CreateEnum
CREATE TYPE "TipoCambioCorte" AS ENUM ('reordenar', 'editar', 'agregar', 'quitar');

-- CreateTable
CREATE TABLE "CorteCambio" (
    "id" TEXT NOT NULL,
    "corteId" TEXT NOT NULL,
    "corteOperacionId" TEXT,
    "tipo" "TipoCambioCorte" NOT NULL,
    "grupo" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "detalle" JSONB NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorteCambio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CorteCambio_corteId_fecha_idx" ON "CorteCambio"("corteId", "fecha");

-- AddForeignKey
ALTER TABLE "CorteCambio" ADD CONSTRAINT "CorteCambio_corteId_fkey" FOREIGN KEY ("corteId") REFERENCES "Corte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorteCambio" ADD CONSTRAINT "CorteCambio_corteOperacionId_fkey" FOREIGN KEY ("corteOperacionId") REFERENCES "CorteOperacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
