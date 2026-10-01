-- AlterTable
ALTER TABLE "Operario" ADD COLUMN     "celular" TEXT,
ADD COLUMN     "ci" TEXT,
ADD COLUMN     "fechaNacimiento" TIMESTAMP(3),
ADD COLUMN     "fechaSalida" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Operario_ci_key" ON "Operario"("ci");
