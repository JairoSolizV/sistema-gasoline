-- Costos etapas 3 y 4 (docs/PLAN_COSTOS.md §7b): prendas por capa del corte
-- (tela real), conteos físicos de insumos (stock) y plan de producción del mes.

-- AlterTable
ALTER TABLE "Corte" ADD COLUMN     "prendasPorCapa" INTEGER;

-- CreateTable
CREATE TABLE "ConteoInsumo" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConteoInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanProduccion" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "fichaId" TEXT NOT NULL,
    "prendas" INTEGER NOT NULL,

    CONSTRAINT "PlanProduccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConteoInsumo_insumoId_fecha_idx" ON "ConteoInsumo"("insumoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "PlanProduccion_anio_mes_fichaId_key" ON "PlanProduccion"("anio", "mes", "fichaId");

-- AddForeignKey
ALTER TABLE "ConteoInsumo" ADD CONSTRAINT "ConteoInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanProduccion" ADD CONSTRAINT "PlanProduccion_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "FichaCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

