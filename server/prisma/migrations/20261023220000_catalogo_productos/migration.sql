-- Catálogo de productos: tallas, colores, descripción y foto de cada ficha de costo.

-- AlterTable
ALTER TABLE "FichaCosto" ADD COLUMN     "colores" TEXT,
ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "tallas" TEXT;

-- CreateTable
CREATE TABLE "FotoFicha" (
    "fichaId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "datos" BYTEA NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotoFicha_pkey" PRIMARY KEY ("fichaId")
);

-- AddForeignKey
ALTER TABLE "FotoFicha" ADD CONSTRAINT "FotoFicha_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "FichaCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

