import { z } from 'zod';

// C-2 — Normalización al guardar. Un solo lugar para toda la app (server, seed,
// backfill y cliente) para que "Recta ", "RECTA" y "recta" sean la misma fila.
// Decisión del dueño: máquina/proceso/pieza en minúsculas, grupos en MAYÚSCULAS.

function compactar(valor: string): string {
  return valor.trim().replace(/\s+/g, ' ');
}

export function normalizarNombreCatalogo(valor: string): string {
  return compactar(valor).toLocaleLowerCase('es');
}

export function normalizarNombreGrupo(valor: string): string {
  return compactar(valor).toLocaleUpperCase('es');
}

const nombreCatalogo = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(max)
    .transform(normalizarNombreCatalogo);

const nombreGrupo = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(40)
  .transform(normalizarNombreGrupo);

// Los máximos replican los de operacionInputSchema: lo que entra al catálogo
// tiene que poder guardarse después en una Operacion.
export const crearMaquinaSchema = z.object({ nombre: nombreCatalogo(40) });
export const crearProcesoSchema = z.object({ nombre: nombreCatalogo(60) });
export const crearPiezaSchema = z.object({ nombre: nombreCatalogo(60) });
export const crearGrupoSchema = z.object({ nombre: nombreGrupo });

const edicion = <T extends z.ZodTypeAny>(nombre: T) =>
  z
    .object({ nombre, activo: z.boolean(), orden: z.number().int().min(0) })
    .partial()
    .refine((obj) => Object.keys(obj).length > 0, { message: 'Nada que actualizar' });

export const editarMaquinaSchema = edicion(nombreCatalogo(40));
export const editarProcesoSchema = edicion(nombreCatalogo(60));
export const editarPiezaSchema = edicion(nombreCatalogo(60));
export const editarGrupoSchema = edicion(nombreGrupo);

// Fusionar A en B: A desaparece y sus operaciones pasan a decir B.
export const fusionarSchema = z.object({
  destinoId: z.uuid('Destino inválido'),
});

export const listarCatalogoQuerySchema = z.object({
  // El formulario de modelos pide solo activos; la administración pide todo.
  soloActivos: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type FusionarInput = z.infer<typeof fusionarSchema>;
export type CrearNodoCatalogoInput = z.infer<typeof crearMaquinaSchema>;
export type EditarNodoCatalogoInput = z.infer<typeof editarMaquinaSchema>;
