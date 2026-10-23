import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClienteDTO,
  ClienteInput,
  CobroDTO,
  CobroInput,
  CorteDineroDTO,
  DespachoDTO,
  DespachoInput,
  EditarClienteInput,
  EditarPedidoInput,
  PagoProveedorInput,
  PedidoDTO,
  PedidoInput,
  ProveedorDeudaDTO,
  TableroDTO,
} from '@taller/shared';
import { api } from './client';

// Tablero de dinero (docs/PLAN_TABLERO_DINERO.md). Cada movimiento cambia el
// tablero: por eso cada mutación invalida todo lo de dinero.

export const useTablero = () =>
  useQuery({ queryKey: ['dinero', 'tablero'], queryFn: () => api<TableroDTO>('/dinero/tablero') });
export const useDeposito = () =>
  useQuery({ queryKey: ['dinero', 'deposito'], queryFn: () => api<CorteDineroDTO[]>('/dinero/deposito') });
export const useClientes = () =>
  useQuery({ queryKey: ['dinero', 'clientes'], queryFn: () => api<ClienteDTO[]>('/dinero/clientes') });
export const usePedidos = () =>
  useQuery({ queryKey: ['dinero', 'pedidos'], queryFn: () => api<PedidoDTO[]>('/dinero/pedidos') });
export const useDespachos = () =>
  useQuery({ queryKey: ['dinero', 'despachos'], queryFn: () => api<DespachoDTO[]>('/dinero/despachos') });
export const useCobros = () =>
  useQuery({ queryKey: ['dinero', 'cobros'], queryFn: () => api<CobroDTO[]>('/dinero/cobros') });
export const useProveedores = () =>
  useQuery({ queryKey: ['dinero', 'proveedores'], queryFn: () => api<ProveedorDeudaDTO[]>('/dinero/proveedores') });

export type OperacionDinero =
  | { tipo: 'crearCliente'; input: ClienteInput }
  | { tipo: 'editarCliente'; id: string; input: EditarClienteInput }
  | { tipo: 'quitarCliente'; id: string }
  | { tipo: 'crearPedido'; input: PedidoInput }
  | { tipo: 'editarPedido'; id: string; input: EditarPedidoInput }
  | { tipo: 'quitarPedido'; id: string }
  | { tipo: 'crearDespacho'; input: DespachoInput }
  | { tipo: 'quitarDespacho'; id: string }
  | { tipo: 'crearCobro'; input: CobroInput }
  | { tipo: 'quitarCobro'; id: string }
  | { tipo: 'pagarProveedor'; input: PagoProveedorInput }
  | { tipo: 'quitarPago'; id: string };

const json = (metodo: string, body?: unknown) => ({
  method: metodo,
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

function ejecutar(op: OperacionDinero) {
  switch (op.tipo) {
    case 'crearCliente':
      return api('/dinero/clientes', json('POST', op.input));
    case 'editarCliente':
      return api(`/dinero/clientes/${op.id}`, json('PATCH', op.input));
    case 'quitarCliente':
      return api(`/dinero/clientes/${op.id}`, json('DELETE'));
    case 'crearPedido':
      return api('/dinero/pedidos', json('POST', op.input));
    case 'editarPedido':
      return api(`/dinero/pedidos/${op.id}`, json('PATCH', op.input));
    case 'quitarPedido':
      return api(`/dinero/pedidos/${op.id}`, json('DELETE'));
    case 'crearDespacho':
      return api('/dinero/despachos', json('POST', op.input));
    case 'quitarDespacho':
      return api(`/dinero/despachos/${op.id}`, json('DELETE'));
    case 'crearCobro':
      return api('/dinero/cobros', json('POST', op.input));
    case 'quitarCobro':
      return api(`/dinero/cobros/${op.id}`, json('DELETE'));
    case 'pagarProveedor':
      return api('/dinero/proveedores/pagos', json('POST', op.input));
    case 'quitarPago':
      return api(`/dinero/proveedores/pagos/${op.id}`, json('DELETE'));
  }
}

export function useMutacionDinero() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ejecutar,
    onSuccess: () =>
      Promise.all([qc.invalidateQueries({ queryKey: ['dinero'] }), qc.invalidateQueries({ queryKey: ['caja'] })]),
  });
}
