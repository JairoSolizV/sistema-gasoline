-- Costos de producción (docs/PLAN_COSTOS.md): insumos, compras, fichas de costo
-- por prenda y margen general de venta. Solo consulta: no toca ningún pago.

-- CreateEnum
CREATE TYPE "CategoriaInsumo" AS ENUM ('tela', 'hilo', 'cierre', 'boton', 'remache', 'cuero', 'etiqueta', 'bolsa', 'logistica', 'otro');

-- CreateEnum
CREATE TYPE "OrigenCompra" AS ENUM ('fabrica', 'mayorista', 'tienda');

-- CreateEnum
CREATE TYPE "MonedaCompra" AS ENUM ('BOB', 'USD');

-- CreateEnum
CREATE TYPE "TipoLineaCosto" AS ENUM ('por_prenda', 'tela_tizado', 'hilo', 'prorrateo', 'precio_prenda');

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "margenVenta" INTEGER NOT NULL DEFAULT 3000;

-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaInsumo" NOT NULL,
    "unidad" TEXT NOT NULL,
    "color" TEXT,
    "codigo" TEXT,
    "titulo" TEXT,
    "anchoCm" INTEGER,
    "marca" TEXT,
    "numeroLlave" TEXT,
    "medidaCm" INTEGER,
    "rendimiento" INTEGER,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraInsumo" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tienda" TEXT NOT NULL,
    "origen" "OrigenCompra" NOT NULL DEFAULT 'tienda',
    "ciudad" TEXT,
    "presentacion" TEXT,
    "cantidad" INTEGER NOT NULL,
    "moneda" "MonedaCompra" NOT NULL DEFAULT 'BOB',
    "montoUsd" INTEGER,
    "tasaCambio" INTEGER,
    "precioTotal" INTEGER NOT NULL,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompraInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FichaCosto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "modeloId" TEXT,
    "manoDeObra" INTEGER,
    "empaque" INTEGER,
    "servicioCorteInterno" BOOLEAN NOT NULL DEFAULT true,
    "margen" INTEGER,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FichaCosto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaCosto" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" "TipoLineaCosto" NOT NULL,
    "concepto" TEXT NOT NULL,
    "insumoId" TEXT,
    "cantidad" INTEGER,
    "largoMm" INTEGER,
    "prendasPorCapa" INTEGER,
    "rendimiento" INTEGER,
    "monto" INTEGER,
    "prendas" INTEGER,
    "precio" INTEGER,

    CONSTRAINT "LineaCosto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompraInsumo_insumoId_fecha_idx" ON "CompraInsumo"("insumoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "FichaCosto_nombre_key" ON "FichaCosto"("nombre");

-- CreateIndex
CREATE INDEX "LineaCosto_fichaId_orden_idx" ON "LineaCosto"("fichaId", "orden");

-- AddForeignKey
ALTER TABLE "CompraInsumo" ADD CONSTRAINT "CompraInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichaCosto" ADD CONSTRAINT "FichaCosto_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "Modelo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaCosto" ADD CONSTRAINT "LineaCosto_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "FichaCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaCosto" ADD CONSTRAINT "LineaCosto_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

