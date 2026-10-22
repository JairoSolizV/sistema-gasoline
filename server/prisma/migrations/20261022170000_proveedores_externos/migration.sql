-- Proveedores externos (docs/PLAN_CUENTAS_SEPARADAS.md §5): lavandería y bordado
-- de afuera se registran en Operarios con tipo "proveedor_externo" y su precio
-- por prenda predeterminado de cada servicio.

-- AlterEnum
ALTER TYPE "RolOperario" ADD VALUE 'lavanderia';
ALTER TYPE "RolOperario" ADD VALUE 'bordado';

-- AlterEnum
ALTER TYPE "TipoOperario" ADD VALUE 'proveedor_externo';

-- AlterTable
ALTER TABLE "Operario" ADD COLUMN     "tarifaBordado" INTEGER,
ADD COLUMN     "tarifaLavanderia" INTEGER;
