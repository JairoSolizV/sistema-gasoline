-- CreateEnum
CREATE TYPE "TipoOperario" AS ENUM ('regular', 'maestro_externo');

-- CreateEnum
CREATE TYPE "EstadoCorte" AS ENUM ('borrador', 'abierto', 'cerrado');

-- CreateEnum
CREATE TYPE "EstadoCorteOp" AS ENUM ('sin_asignar', 'parcial', 'asignada');

-- CreateEnum
CREATE TYPE "EstadoPeriodo" AS ENUM ('abierto', 'cerrado');

-- CreateTable
CREATE TABLE "Operario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoOperario" NOT NULL DEFAULT 'regular',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaBaja" TIMESTAMP(3),

    CONSTRAINT "Operario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modelo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Modelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloVersion" (
    "id" TEXT NOT NULL,
    "modeloId" TEXT NOT NULL,
    "numeroVersion" INTEGER NOT NULL,
    "notas" TEXT,
    "costoManoObraPrenda" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModeloVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operacion" (
    "id" TEXT NOT NULL,
    "modeloVersionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "grupo" TEXT NOT NULL,
    "n" TEXT,
    "equipo" TEXT NOT NULL,
    "proceso" TEXT NOT NULL,
    "pieza" TEXT,
    "ct" INTEGER NOT NULL,

    CONSTRAINT "Operacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Corte" (
    "id" TEXT NOT NULL,
    "modeloVersionId" TEXT NOT NULL,
    "codigo" TEXT,
    "tallas" JSONB NOT NULL,
    "cortePorTalla" JSONB NOT NULL,
    "plusPorTalla" JSONB NOT NULL,
    "cantidadTotal" INTEGER NOT NULL,
    "estado" "EstadoCorte" NOT NULL DEFAULT 'borrador',
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),

    CONSTRAINT "Corte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorteOperacion" (
    "id" TEXT NOT NULL,
    "corteId" TEXT NOT NULL,
    "operacionOrigenId" TEXT,
    "orden" INTEGER NOT NULL,
    "grupo" TEXT NOT NULL,
    "n" TEXT,
    "equipo" TEXT NOT NULL,
    "proceso" TEXT NOT NULL,
    "pieza" TEXT,
    "ct" INTEGER NOT NULL,
    "cantidadObjetivo" INTEGER NOT NULL,
    "estado" "EstadoCorteOp" NOT NULL DEFAULT 'sin_asignar',

    CONSTRAINT "CorteOperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asignacion" (
    "id" TEXT NOT NULL,
    "corteOperacionId" TEXT NOT NULL,
    "operarioId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "esMaestroExterno" BOOLEAN NOT NULL DEFAULT false,
    "diferencial" INTEGER NOT NULL DEFAULT 0,
    "tarifaEfectiva" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,

    CONSTRAINT "Asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anticipo" (
    "id" TEXT NOT NULL,
    "operarioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" INTEGER NOT NULL,
    "nota" TEXT,

    CONSTRAINT "Anticipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Periodo" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "estado" "EstadoPeriodo" NOT NULL DEFAULT 'abierto',
    "fechaCierre" TIMESTAMP(3),

    CONSTRAINT "Periodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liquidacion" (
    "id" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "operarioId" TEXT NOT NULL,
    "saldoEntrada" INTEGER NOT NULL DEFAULT 0,
    "totalGanado" INTEGER NOT NULL DEFAULT 0,
    "totalAnticipos" INTEGER NOT NULL DEFAULT 0,
    "saldoPeriodo" INTEGER NOT NULL DEFAULT 0,
    "pagado" INTEGER NOT NULL DEFAULT 0,
    "arrastraSaldo" BOOLEAN NOT NULL DEFAULT false,
    "saldoSalida" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "topeAnticipoAdvertencia" INTEGER NOT NULL DEFAULT 200000,
    "diferencialMaestroExterno" INTEGER NOT NULL DEFAULT 10,
    "redondeoDecimales" INTEGER NOT NULL DEFAULT 2,
    "nombreTaller" TEXT,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Modelo_nombre_key" ON "Modelo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloVersion_modeloId_numeroVersion_key" ON "ModeloVersion"("modeloId", "numeroVersion");

-- CreateIndex
CREATE INDEX "Corte_estado_fechaCierre_idx" ON "Corte"("estado", "fechaCierre");

-- CreateIndex
CREATE INDEX "CorteOperacion_corteId_estado_idx" ON "CorteOperacion"("corteId", "estado");

-- CreateIndex
CREATE INDEX "Asignacion_operarioId_idx" ON "Asignacion"("operarioId");

-- CreateIndex
CREATE INDEX "Anticipo_operarioId_fecha_idx" ON "Anticipo"("operarioId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Periodo_anio_mes_key" ON "Periodo"("anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "Liquidacion_periodoId_operarioId_key" ON "Liquidacion"("periodoId", "operarioId");

-- AddForeignKey
ALTER TABLE "ModeloVersion" ADD CONSTRAINT "ModeloVersion_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "Modelo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacion" ADD CONSTRAINT "Operacion_modeloVersionId_fkey" FOREIGN KEY ("modeloVersionId") REFERENCES "ModeloVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Corte" ADD CONSTRAINT "Corte_modeloVersionId_fkey" FOREIGN KEY ("modeloVersionId") REFERENCES "ModeloVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorteOperacion" ADD CONSTRAINT "CorteOperacion_corteId_fkey" FOREIGN KEY ("corteId") REFERENCES "Corte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorteOperacion" ADD CONSTRAINT "CorteOperacion_operacionOrigenId_fkey" FOREIGN KEY ("operacionOrigenId") REFERENCES "Operacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_corteOperacionId_fkey" FOREIGN KEY ("corteOperacionId") REFERENCES "CorteOperacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_operarioId_fkey" FOREIGN KEY ("operarioId") REFERENCES "Operario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_operarioId_fkey" FOREIGN KEY ("operarioId") REFERENCES "Operario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacion" ADD CONSTRAINT "Liquidacion_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "Periodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacion" ADD CONSTRAINT "Liquidacion_operarioId_fkey" FOREIGN KEY ("operarioId") REFERENCES "Operario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
