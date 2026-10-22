-- Asistencia diaria de los ayudantes (docs/PLAN_AYUDANTES.md §2-3).

-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('trabajo', 'falta', 'feriado');

-- CreateTable
CREATE TABLE "Asistencia" (
    "id" TEXT NOT NULL,
    "operarioId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" "EstadoAsistencia" NOT NULL,
    "minutosDescontados" INTEGER NOT NULL DEFAULT 0,
    "minutosOperaciones" INTEGER NOT NULL DEFAULT 0,
    "nota" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asistencia_fecha_idx" ON "Asistencia"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Asistencia_operarioId_fecha_key" ON "Asistencia"("operarioId", "fecha");

-- AddForeignKey
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_operarioId_fkey" FOREIGN KEY ("operarioId") REFERENCES "Operario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

