-- Servicio de corte interno (docs/PLAN_SERVICIO_CORTE.md §4): procesos pagados por
-- corte (TrabajoCorte) y snapshot de tarifas en el corte. Reemplaza al cortador /
-- dobladores / fechaCorte informativos del tendido: esos datos NO se convierten en
-- pagos (el doblado ahora exige 2 personas y modalidad); se vuelven a registrar en
-- los procesos. Tela, ancho y largo de trazado se conservan.

-- CreateEnum
CREATE TYPE "ProcesoCorte" AS ENUM ('busqueda', 'trazado', 'doblado', 'corte', 'clasificacion');

-- CreateEnum
CREATE TYPE "ModalidadDoblado" AS ENUM ('hoja', 'pares');

-- DropForeignKey
ALTER TABLE "Corte" DROP CONSTRAINT "Corte_cortadorId_fkey";

-- DropForeignKey
ALTER TABLE "_CorteDobladores" DROP CONSTRAINT "_CorteDobladores_A_fkey";

-- DropForeignKey
ALTER TABLE "_CorteDobladores" DROP CONSTRAINT "_CorteDobladores_B_fkey";

-- AlterTable
ALTER TABLE "Corte" DROP COLUMN "cortadorId",
DROP COLUMN "fechaCorte",
ADD COLUMN     "esInterno" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "modalidadDoblado" "ModalidadDoblado",
ADD COLUMN     "tarifaBusqueda" INTEGER,
ADD COLUMN     "tarifaClasificacionRespaldo" INTEGER,
ADD COLUMN     "tarifaCorteRespaldo" INTEGER,
ADD COLUMN     "tarifaDobladoHoja" INTEGER,
ADD COLUMN     "tarifaDobladoPares" INTEGER,
ADD COLUMN     "tarifaTrazado" INTEGER;

-- DropTable
DROP TABLE "_CorteDobladores";

-- CreateTable
CREATE TABLE "TrabajoCorte" (
    "id" TEXT NOT NULL,
    "corteId" TEXT NOT NULL,
    "proceso" "ProcesoCorte" NOT NULL,
    "operarioId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "tarifa" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrabajoCorte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrabajoCorte_fecha_idx" ON "TrabajoCorte"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "TrabajoCorte_corteId_proceso_operarioId_key" ON "TrabajoCorte"("corteId", "proceso", "operarioId");

-- AddForeignKey
ALTER TABLE "TrabajoCorte" ADD CONSTRAINT "TrabajoCorte_corteId_fkey" FOREIGN KEY ("corteId") REFERENCES "Corte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrabajoCorte" ADD CONSTRAINT "TrabajoCorte_operarioId_fkey" FOREIGN KEY ("operarioId") REFERENCES "Operario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Datos existentes: un corte ya cerrado queda como externo (su pago ya está hecho
-- y no se le pueden agregar procesos); los abiertos o en borrador son internos y
-- toman las tarifas actuales de Configuración.
UPDATE "Corte" SET "esInterno" = false WHERE "estado" = 'cerrado';

UPDATE "Corte" AS c
SET "tarifaBusqueda"              = cfg."tarifaBusqueda",
    "tarifaTrazado"               = cfg."tarifaTrazado",
    "tarifaDobladoHoja"           = cfg."tarifaDobladoHoja",
    "tarifaDobladoPares"          = cfg."tarifaDobladoPares",
    "tarifaCorteRespaldo"         = cfg."tarifaCorteRespaldo",
    "tarifaClasificacionRespaldo" = cfg."tarifaClasificacionRespaldo"
FROM "Configuracion" AS cfg
WHERE cfg."id" = 1 AND c."esInterno" = true;
