-- Tarifas predeterminadas del servicio de corte interno (docs/PLAN_SERVICIO_CORTE.md).

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "tarifaBusqueda" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "tarifaClasificacionRespaldo" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "tarifaCorteRespaldo" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "tarifaDobladoHoja" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "tarifaDobladoPares" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "tarifaMoldeModificacion" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "tarifaMoldeNuevo" INTEGER NOT NULL DEFAULT 20000,
ADD COLUMN     "tarifaTrazado" INTEGER NOT NULL DEFAULT 30;

