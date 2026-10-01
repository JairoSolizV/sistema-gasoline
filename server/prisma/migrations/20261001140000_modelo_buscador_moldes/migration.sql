-- Buscador del modelo y pago de moldes por versión (docs/PLAN_SERVICIO_CORTE.md §2.8-2.9).
-- Nada retroactivo: los modelos existentes quedan con buscador pendiente y sin moldes.

-- CreateEnum
CREATE TYPE "TipoMolde" AS ENUM ('nuevo', 'modificacion');

-- AlterTable
ALTER TABLE "Modelo" ADD COLUMN     "buscadorId" TEXT,
ADD COLUMN     "sinBuscador" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PagoMolde" (
    "id" TEXT NOT NULL,
    "modeloVersionId" TEXT NOT NULL,
    "operarioId" TEXT NOT NULL,
    "tipo" "TipoMolde" NOT NULL,
    "monto" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoMolde_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PagoMolde_modeloVersionId_key" ON "PagoMolde"("modeloVersionId");

-- CreateIndex
CREATE INDEX "PagoMolde_fecha_idx" ON "PagoMolde"("fecha");

-- AddForeignKey
ALTER TABLE "Modelo" ADD CONSTRAINT "Modelo_buscadorId_fkey" FOREIGN KEY ("buscadorId") REFERENCES "Operario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoMolde" ADD CONSTRAINT "PagoMolde_modeloVersionId_fkey" FOREIGN KEY ("modeloVersionId") REFERENCES "ModeloVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoMolde" ADD CONSTRAINT "PagoMolde_operarioId_fkey" FOREIGN KEY ("operarioId") REFERENCES "Operario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

