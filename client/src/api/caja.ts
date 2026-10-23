import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ArqueoInput,
  Caja,
  CajaMesDTO,
  CategoriaCajaInput,
  EditarCategoriaCajaInput,
  InicioCajaInput,
  MovimientoCajaInput,
  OrigenCaja,
} from '@taller/shared';
import { api } from './client';

// Caja (docs/PLAN_CAJA.md). Lo que cambia la caja también cambia el tablero.

export const useCaja = (anio: number, mes: number) =>
  useQuery({ queryKey: ['caja', anio, mes], queryFn: () => api<CajaMesDTO>(`/caja?anio=${anio}&mes=${mes}`) });

export type OperacionCaja =
  | { tipo: 'inicio'; caja: Caja; input: InicioCajaInput }
  | { tipo: 'movimiento'; input: MovimientoCajaInput }
  | { tipo: 'quitarMovimiento'; id: string }
  | { tipo: 'cambiarCaja'; origen: OrigenCaja; id: string; caja: Caja }
  | { tipo: 'arqueo'; input: ArqueoInput }
  | { tipo: 'quitarArqueo'; id: string }
  | { tipo: 'crearCategoria'; input: CategoriaCajaInput }
  | { tipo: 'editarCategoria'; id: string; input: EditarCategoriaCajaInput };

const enviar = (ruta: string, method: string, body?: unknown) =>
  api(`/caja${ruta}`, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

function ejecutar(op: OperacionCaja) {
  switch (op.tipo) {
    case 'inicio':
      return enviar(`/inicio/${op.caja}`, 'PUT', op.input);
    case 'movimiento':
      return enviar('/movimientos', 'POST', op.input);
    case 'quitarMovimiento':
      return enviar(`/movimientos/${op.id}`, 'DELETE');
    case 'cambiarCaja':
      return enviar(`/origen/${op.origen}/${op.id}`, 'PATCH', { caja: op.caja });
    case 'arqueo':
      return enviar('/arqueos', 'POST', op.input);
    case 'quitarArqueo':
      return enviar(`/arqueos/${op.id}`, 'DELETE');
    case 'crearCategoria':
      return enviar('/categorias', 'POST', op.input);
    case 'editarCategoria':
      return enviar(`/categorias/${op.id}`, 'PATCH', op.input);
  }
}

export function useMutacionCaja() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ejecutar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caja'] }),
  });
}
