-- Rol ayudante y sueldo semanal con historial (docs/PLAN_AYUDANTES.md §2, §4).

-- AlterEnum
ALTER TYPE "RolOperario" ADD VALUE 'ayudante';

-- CreateTable
CREATE TABLE "SueldoAyudante" (
    "id" TEXT NOT NULL,
    "operarioId" TEXT NOT NULL,
    "montoSemanal" INTEGER NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SueldoAyudante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SueldoAyudante_operarioId_vigenteDesde_key" ON "SueldoAyudante"("operarioId", "vigenteDesde");

-- AddForeignKey
ALTER TABLE "SueldoAyudante" ADD CONSTRAINT "SueldoAyudante_operarioId_fkey" FOREIGN KEY ("operarioId") REFERENCES "Operario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

