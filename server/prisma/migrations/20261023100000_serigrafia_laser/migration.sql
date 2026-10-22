-- Serigrafía y láser: proveedores externos como lavandería y bordado, cada uno
-- con su cuenta de pago y su precio por prenda predeterminado
-- (docs/PLAN_CUENTAS_SEPARADAS.md §5). PostgreSQL 12+ permite varios ADD VALUE.

ALTER TYPE "Cuenta" ADD VALUE 'serigrafia';
ALTER TYPE "Cuenta" ADD VALUE 'laser';

ALTER TYPE "RolOperario" ADD VALUE 'serigrafia';
ALTER TYPE "RolOperario" ADD VALUE 'laser';

ALTER TYPE "ServicioExterno" ADD VALUE 'serigrafia';
ALTER TYPE "ServicioExterno" ADD VALUE 'laser';

ALTER TABLE "Operario" ADD COLUMN     "tarifaLaser" INTEGER,
ADD COLUMN     "tarifaSerigrafia" INTEGER;
