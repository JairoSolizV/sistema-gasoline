-- Cuentas por cobrar: plazo de pago de cada cliente y fecha de cobro de cada
-- despacho (la del despacho + el plazo del cliente, editable).

ALTER TABLE "Cliente" ADD COLUMN     "plazoDias" INTEGER NOT NULL DEFAULT 30;

-- los despachos que ya existen: fecha + 30 días (el plazo por defecto)
ALTER TABLE "Despacho" ADD COLUMN     "vence" DATE;
UPDATE "Despacho" SET "vence" = "fecha" + 30;
ALTER TABLE "Despacho" ALTER COLUMN "vence" SET NOT NULL;
