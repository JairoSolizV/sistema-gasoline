-- Bloque reutilizable por grupo: las operaciones estándar de ACABADO, TRASEROS…
-- que se agregan de una vez a un modelo.

-- CreateTable
CREATE TABLE "GrupoOperacion" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "n" TEXT,
    "equipo" TEXT NOT NULL,
    "proceso" TEXT NOT NULL,
    "pieza" TEXT,
    "ctReferencia" INTEGER,

    CONSTRAINT "GrupoOperacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GrupoOperacion_grupoId_orden_idx" ON "GrupoOperacion"("grupoId", "orden");

-- AddForeignKey
ALTER TABLE "GrupoOperacion" ADD CONSTRAINT "GrupoOperacion_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
