-- CreateTable
CREATE TABLE "Plantilla" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "notas" TEXT,
    "protegida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plantilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantillaOperacion" (
    "id" TEXT NOT NULL,
    "plantillaId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "grupo" TEXT NOT NULL,
    "n" TEXT,
    "equipo" TEXT NOT NULL,
    "proceso" TEXT NOT NULL,
    "pieza" TEXT,

    CONSTRAINT "PlantillaOperacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plantilla_nombre_key" ON "Plantilla"("nombre");

-- CreateIndex
CREATE INDEX "PlantillaOperacion_plantillaId_orden_idx" ON "PlantillaOperacion"("plantillaId", "orden");

-- AddForeignKey
ALTER TABLE "PlantillaOperacion" ADD CONSTRAINT "PlantillaOperacion_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "Plantilla"("id") ON DELETE CASCADE ON UPDATE CASCADE;
