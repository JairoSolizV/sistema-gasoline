-- Envíos a lavandería y bordado externos (docs/PLAN_CUENTAS_SEPARADAS.md §5):
-- prendas de un corte que se mandan a un proveedor; se pagan por prenda y se
-- ganan en la fecha de devolución, cada servicio en su propia cuenta.

-- CreateEnum
CREATE TYPE "ServicioExterno" AS ENUM ('lavanderia', 'bordado');

-- CreateTable
CREATE TABLE "EnvioServicio" (
    "id" TEXT NOT NULL,
    "corteId" TEXT NOT NULL,
    "servicio" "ServicioExterno" NOT NULL,
    "operarioId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioPrenda" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "fechaEnvio" DATE NOT NULL,
    "fechaDevolucion" DATE,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvioServicio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnvioServicio_corteId_idx" ON "EnvioServicio"("corteId");

-- CreateIndex
CREATE INDEX "EnvioServicio_fechaDevolucion_idx" ON "EnvioServicio"("fechaDevolucion");

-- AddForeignKey
ALTER TABLE "EnvioServicio" ADD CONSTRAINT "EnvioServicio_corteId_fkey" FOREIGN KEY ("corteId") REFERENCES "Corte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvioServicio" ADD CONSTRAINT "EnvioServicio_operarioId_fkey" FOREIGN KEY ("operarioId") REFERENCES "Operario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

