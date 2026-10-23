import { z } from 'zod';

// Reportes para analizar después (docs/PLAN_DIDACTICO_REPORTES.md). Solo
// lectura. Rango de meses 'aaaa-mm' (ambos incluidos). Dinero en centavos.

const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes inválido (aaaa-mm)');
export const rangoReporteSchema = z
  .object({ desde: mes, hasta: mes })
  .refine((r) => r.desde <= r.hasta, { message: '"Desde" tiene que ser antes que "hasta"' });
export type RangoReporte = z.infer<typeof rangoReporteSchema>;

/** Ganancia sobre lo vendido, en centésimas de % (2550 = 25.5 %). */
export const calcularMargen = (ganancia: number, venta: number) => (venta ? Math.round((ganancia * 10_000) / venta) : 0);

export interface VentasReporteDTO {
  // vendido/cobrado en Bs a la tasa de cada movimiento; *Usd en dólares
  meses: {
    mes: string;
    prendas: number;
    vendidoUsd: number;
    vendido: number;
    costo: number;
    ganancia: number;
    cobradoUsd: number;
    cobrado: number;
  }[];
  clientes: { id: string; nombre: string; prendas: number; vendidoUsd: number; cobradoUsd: number; debeHoyUsd: number }[];
  modelos: { modelo: string; prendas: number; vendidoUsd: number }[];
}

export interface ProduccionReporteDTO {
  meses: { mes: string; cortesIniciados: number; cortesCerrados: number; prendasTerminadas: number; costura: number }[];
  cortes: {
    id: string;
    codigo: number;
    modelo: string;
    prendas: number;
    inicio: string;
    cierre: string | null;
    dias: number | null; // de inicio a cierre
    costoPorPrenda: number;
    costura: number; // mano de obra de costura y empaque
  }[];
  modelos: { modelo: string; cortes: number; prendas: number }[];
}

export interface ComprasReporteDTO {
  meses: { mes: string; tela: number; insumosCostura: number; insumosEmpaque: number; otrosGastos: number; total: number }[];
  proveedores: { proveedor: string; total: number; aCredito: number; compras: number }[];
  categorias: { categoria: string; monto: number }[]; // gastos de la caja por categoría (todo el rango)
}

export interface GananciaModeloDTO {
  vendidos: {
    modelo: string;
    prendas: number;
    vendidoUsd: number;
    vendido: number; // Bs
    costo: number;
    ganancia: number;
    porPrenda: number; // ganancia por prenda (Bs)
    margen: number; // centésimas de % sobre lo vendido
  }[];
  // hoy, por prenda en Bs; y la docena en $us
  fichas: {
    id: string;
    nombre: string;
    costo: number;
    precio: number;
    ganancia: number;
    margen: number;
    docenaUsd: number;
    docenaFija: boolean; // el precio de la docena en $us está fijado en la ficha
  }[];
}
