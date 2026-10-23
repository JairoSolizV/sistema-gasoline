-- Tablero de dinero (docs/PLAN_TABLERO_DINERO.md): compras a crédito, pagos a
-- proveedores, clientes, pedidos, despachos y cobros. No toca ningún pago.

-- CreateEnum
CREATE TYPE "CondicionCompra" AS ENUM ('contado', 'credito');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('pendiente', 'en_produccion', 'entregado', 'cancelado');

-- AlterTable
ALTER TABLE "CompraInsumo" ADD COLUMN     "condicion" "CondicionCompra" NOT NULL DEFAULT 'contado';

-- CreateTable
CREATE TABLE "PagoProveedor" (
    "id" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" INTEGER NOT NULL,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "celular" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "prendas" INTEGER NOT NULL,
    "precioPrenda" INTEGER NOT NULL,
    "fechaEntrega" DATE,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'pendiente',
    "corteId" TEXT,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Despacho" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Despacho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DespachoLinea" (
    "id" TEXT NOT NULL,
    "despachoId" TEXT NOT NULL,
    "corteId" TEXT,
    "fichaId" TEXT,
    "descripcion" TEXT NOT NULL,
    "prendas" INTEGER NOT NULL,
    "precioPrenda" INTEGER NOT NULL,
    "costoPrenda" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,

    CONSTRAINT "DespachoLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cobro" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" INTEGER NOT NULL,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cobro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PagoProveedor_proveedor_idx" ON "PagoProveedor"("proveedor");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_nombre_key" ON "Cliente"("nombre");

-- CreateIndex
CREATE INDEX "Pedido_estado_idx" ON "Pedido"("estado");

-- CreateIndex
CREATE INDEX "Despacho_fecha_idx" ON "Despacho"("fecha");

-- CreateIndex
CREATE INDEX "Cobro_clienteId_idx" ON "Cobro"("clienteId");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "FichaCosto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_corteId_fkey" FOREIGN KEY ("corteId") REFERENCES "Corte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despacho" ADD CONSTRAINT "Despacho_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DespachoLinea" ADD CONSTRAINT "DespachoLinea_despachoId_fkey" FOREIGN KEY ("despachoId") REFERENCES "Despacho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DespachoLinea" ADD CONSTRAINT "DespachoLinea_corteId_fkey" FOREIGN KEY ("corteId") REFERENCES "Corte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DespachoLinea" ADD CONSTRAINT "DespachoLinea_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "FichaCosto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobro" ADD CONSTRAINT "Cobro_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

