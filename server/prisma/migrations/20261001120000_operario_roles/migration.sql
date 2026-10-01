-- Roles de operario (docs/PLAN_SERVICIO_CORTE.md §3). El DEFAULT deja a todos
-- los operarios existentes como costurero; el dueño ajusta el resto.

-- CreateEnum
CREATE TYPE "RolOperario" AS ENUM ('costurero', 'cortador', 'doblador', 'moldista', 'buscador', 'trazador', 'clasificador');

-- AlterTable
ALTER TABLE "Operario" ADD COLUMN     "roles" "RolOperario"[] DEFAULT ARRAY['costurero']::"RolOperario"[],
ADD COLUMN     "tarifaClasificacion" INTEGER,
ADD COLUMN     "tarifaCorte" INTEGER;

