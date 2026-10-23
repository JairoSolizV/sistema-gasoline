// Caja (docs/PLAN_CAJA.md). Dinero en centavos.
import type { Caja, OrigenCaja } from '../schemas/caja.js';

export interface CategoriaCajaDTO {
  id: string;
  nombre: string;
  tipo: 'ingreso' | 'egreso';
  clave: string | null; // la usa el sistema: no se desactiva
  activo: boolean;
}

/** Un renglón de la caja: anotado a mano, ajuste de arqueo, o algo que entró
 *  solo desde otra pantalla (origen). */
export interface MovimientoCajaDTO {
  id: string; // único en la lista
  origen: OrigenCaja | 'manual' | 'transferencia' | 'liquidacion' | 'arqueo';
  origenId: string; // id del registro de origen (para borrar o cambiar de caja)
  caja: Caja;
  fecha: string;
  tipo: 'ingreso' | 'egreso';
  categoria: { id: string; nombre: string } | null;
  descripcion: string;
  monto: number; // siempre positivo, en la moneda de la caja; el tipo dice si suma o resta
  montoBs: number; // su equivalente en Bs (para sumar por categoría; en Bs, igual a monto)
}

export interface ResumenCajaDTO {
  caja: Caja;
  configurada: boolean;
  desde: string | null;
  saldoInicial: number; // el configurado al empezar a llevar la caja
  saldoInicioMes: number; // saldo al empezar el mes (o el inicial, si empezó en el mes)
  ingresos: number;
  egresos: number;
  ajustes: number; // diferencias de arqueo del mes
  saldoFinal: number; // hasta fin de mes (o hasta hoy, si es el mes en curso)
  ultimoArqueo: { fecha: string; contado: number; diferencia: number } | null;
}

export interface CajaMesDTO {
  anio: number;
  mes: number;
  cajas: ResumenCajaDTO[];
  porCategoria: { categoria: { id: string; nombre: string }; tipo: 'ingreso' | 'egreso'; monto: number }[];
  movimientos: MovimientoCajaDTO[]; // del mes, más reciente primero
  categorias: CategoriaCajaDTO[];
}
