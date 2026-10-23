-- Dólares y bolivianos (docs/PLAN_DOLARES.md): precio de la docena en $us,
-- despachos y cobros en $us con el tipo de cambio del día, pagos a proveedores
-- en $us o Bs y cambio de dólares entre cajas. Las columnas obligatorias nuevas
-- se crean con 0 y después se les quita el valor por defecto.

ALTER TABLE "Cobro" ADD COLUMN     "moneda" "MonedaCompra" NOT NULL DEFAULT 'USD',
ADD COLUMN     "tasaCambio" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "usd" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bs" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "caja" SET DEFAULT 'dolares';
ALTER TABLE "Cobro" ALTER COLUMN "tasaCambio" DROP DEFAULT, ALTER COLUMN "usd" DROP DEFAULT, ALTER COLUMN "bs" DROP DEFAULT;

ALTER TABLE "Despacho" ADD COLUMN     "tasaCambio" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Despacho" ALTER COLUMN "tasaCambio" DROP DEFAULT;

ALTER TABLE "DespachoLinea" DROP COLUMN "precioPrenda",
DROP COLUMN "total",
ADD COLUMN     "precioDocenaUsd" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalUsd" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalBs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DespachoLinea" ALTER COLUMN "precioDocenaUsd" DROP DEFAULT, ALTER COLUMN "totalUsd" DROP DEFAULT, ALTER COLUMN "totalBs" DROP DEFAULT;

ALTER TABLE "FichaCosto" ADD COLUMN     "precioDocenaUsd" INTEGER;

ALTER TABLE "MovimientoCaja" ADD COLUMN     "montoDestino" INTEGER,
ADD COLUMN     "tasaCambio" INTEGER;

ALTER TABLE "PagoProveedor" ADD COLUMN     "moneda" "MonedaCompra" NOT NULL DEFAULT 'BOB';

ALTER TABLE "Pedido" DROP COLUMN "precioPrenda",
ADD COLUMN     "precioDocenaUsd" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Pedido" ALTER COLUMN "precioDocenaUsd" DROP DEFAULT;
