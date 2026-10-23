import { z } from 'zod';

// Pasos de un corte en el taller (docs/PLAN_DIDACTICO_REPORTES.md): dónde está
// físicamente. Lo marca una persona con un botón; no toca pagos.

export const PASOS_CORTE = ['mesa', 'costura', 'lavanderia', 'empaque', 'deposito'] as const;
export type PasoCorte = (typeof PASOS_CORTE)[number];

/** Nombre, dibujo y explicación de cada paso, en palabras de todos los días.
 *  `dias`: cuánto es normal que dure; pasado eso, el semáforo se pone amarillo
 *  y al doble, rojo. */
export const INFO_PASO: Record<PasoCorte, { nombre: string; icono: string; que: string; dias: number }> = {
  mesa: { nombre: 'En mesa', icono: '✂️', que: 'Ya está cortado y espera ir a costura', dias: 3 },
  costura: { nombre: 'En costura', icono: '🧵', que: 'Las costureras están armando las prendas', dias: 15 },
  lavanderia: { nombre: 'En lavandería', icono: '🫧', que: 'Las prendas están en la lavandería', dias: 10 },
  empaque: { nombre: 'En empaque', icono: '🛍️', que: 'Se están doblando, etiquetando y embolsando', dias: 5 },
  deposito: { nombre: 'En depósito', icono: '📦', que: 'Terminado, listo para entregar', dias: 30 },
};

/** Semáforo de un paso según los días que lleva. */
export function semaforoPaso(paso: PasoCorte, dias: number): 'ok' | 'atencion' | 'demora' {
  const normal = INFO_PASO[paso].dias;
  return dias > normal * 2 ? 'demora' : dias > normal ? 'atencion' : 'ok';
}

/** Insumos de empaque: bolsas, tags y lo de despacho (saco, yute). Lo demás
 *  (hilos, cierres, botones, remaches, cuero, etiqueta de talla) es de costura. */
export const esInsumoDeEmpaque = (categoria: string, nombre: string) =>
  categoria === 'bolsa' || categoria === 'logistica' || (categoria === 'etiqueta' && /tag/i.test(nombre));

export const cambiarPasoSchema = z.object({ paso: z.enum(PASOS_CORTE) });
export type CambiarPasoInput = z.infer<typeof cambiarPasoSchema>;

/** Para qué se necesita la plata que falta para terminar. */
export interface DesgloseFaltaDTO {
  insumosCostura: number;
  insumosEmpaque: number;
  manoDeObra: number; // costura y empaque
  servicios: number; // lavandería, bordado…
}

export interface CorteEnCaminoDTO {
  corteId: string;
  codigo: number;
  modelo: string;
  prendas: number;
  paso: PasoCorte;
  dias: number; // en este paso
  semaforo: 'ok' | 'atencion' | 'demora';
  invertido: number; // ya está puesto (centavos)
  falta: number; // falta poner para terminar
  desglose: DesgloseFaltaDTO;
  vale: number | null; // Bs, a precio de venta (al último tipo de cambio)
  valeUsd: number | null;
}

export interface PasoCaminoDTO {
  paso: PasoCorte;
  prendas: number;
  invertido: number;
  falta: number;
  vale: number;
  valeUsd: number;
  cortes: CorteEnCaminoDTO[];
}

export interface CaminoDTO {
  tasaCambio: number;
  pedidos: { cantidad: number; prendas: number; necesitas: number; vale: number; valeUsd: number };
  pasos: PasoCaminoDTO[];
  porCobrar: { totalUsd: number; total: number; vencidoUsd: number; clientes: number };
  cobradoMes: number; // Bs
  cobradoMesUsd: number;
  resumen: { invertido: number; falta: number; desglose: DesgloseFaltaDTO };
  avisos: string[];
}
