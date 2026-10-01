import { z } from 'zod';

export const tipoOperarioSchema = z.enum(['regular', 'maestro_externo']);

// Oficios (docs/PLAN_SERVICIO_CORTE.md §3). Un operario puede tener varios; en
// cada selector solo aparecen los que tienen el rol que hace falta.
export const ROLES_OPERARIO = [
  'costurero',
  'cortador',
  'doblador',
  'moldista',
  'buscador',
  'trazador',
  'clasificador',
] as const;
export const rolOperarioSchema = z.enum(ROLES_OPERARIO);

const rolesSchema = z
  .array(rolOperarioSchema)
  .min(1, 'Elegí al menos un rol')
  .transform((rs) => ROLES_OPERARIO.filter((r) => rs.includes(r))); // sin repetidos, orden fijo

// Tarifa personal por prenda (centavos); null = usar el respaldo de Configuración.
const tarifaPersonalSchema = z
  .number()
  .int()
  .min(1, 'La tarifa debe ser mayor a 0')
  .max(100000)
  .nullable();

// Cédula boliviana: número + opcional complemento/extensión ("6543210 LP",
// "6543210-1B"). Se normaliza a mayúsculas y espacios simples para que la
// unicidad no dependa de cómo se tipeó.
export const ciSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, ' ').toUpperCase())
  .pipe(
    z
      .string()
      .min(1, 'La cédula de identidad es obligatoria')
      .max(20, 'Cédula demasiado larga')
      .regex(/^\d{4,}[0-9A-Z \-]*$/, 'Cédula inválida: empieza con el número (ej. 6543210 LP)'),
  );

// Celular: se guarda solo con dígitos (y "+" inicial si viene con código de país).
export const celularSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(
    z
      .string()
      .min(1, 'El número de celular es obligatorio')
      .regex(/^\+?\d{7,15}$/, 'Número de celular inválido (ej. 71234567)'),
  );

const noFutura = (d: Date) => d.getTime() <= Date.now();

export const crearOperarioSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
    tipo: tipoOperarioSchema.default('regular'),
    roles: rolesSchema.default(['costurero']),
    tarifaCorte: tarifaPersonalSchema.optional(),
    tarifaClasificacion: tarifaPersonalSchema.optional(),
    ci: ciSchema,
    celular: celularSchema,
    fechaNacimiento: z.coerce
      .date({ error: 'La fecha de nacimiento es obligatoria' })
      .refine(noFutura, 'La fecha de nacimiento no puede ser futura'),
    fechaIngreso: z.coerce.date({ error: 'La fecha de ingreso es obligatoria' }),
    // salida prevista/pactada: opcional e informativa (no da de baja)
    fechaSalida: z.coerce.date().nullable().optional(),
  })
  .refine((o) => !o.fechaSalida || o.fechaSalida >= o.fechaIngreso, {
    path: ['fechaSalida'],
    message: 'La fecha de salida no puede ser anterior a la de ingreso',
  });

// PATCH: edición parcial. `activo` es la baja/reactivación lógica (el server
// fija o limpia fechaBaja). Los datos personales admiten null para operarios
// del roster original que aún no los tienen. La coherencia ingreso/salida se
// valida en el service contra los valores ya guardados.
export const editarOperarioSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre no puede quedar vacío').max(60),
    tipo: tipoOperarioSchema,
    activo: z.boolean(),
    roles: rolesSchema,
    tarifaCorte: tarifaPersonalSchema,
    tarifaClasificacion: tarifaPersonalSchema,
    ci: ciSchema.nullable(),
    celular: celularSchema.nullable(),
    fechaNacimiento: z.coerce
      .date()
      .refine(noFutura, 'La fecha de nacimiento no puede ser futura')
      .nullable(),
    fechaIngreso: z.coerce.date(),
    fechaSalida: z.coerce.date().nullable(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: 'Nada que actualizar' });

export const listarOperariosQuerySchema = z.object({
  estado: z.enum(['activos', 'todos']).default('activos'),
  rol: rolOperarioSchema.optional(), // solo los que tienen ese rol
});

export type CrearOperarioInput = z.infer<typeof crearOperarioSchema>;
export type EditarOperarioInput = z.infer<typeof editarOperarioSchema>;
