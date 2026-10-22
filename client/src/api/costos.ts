import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CompraDTO,
  CompraInput,
  ConteoDTO,
  ConteoInput,
  CorteCostoDetalleDTO,
  CorteCostoResumenDTO,
  PlanInput,
  ProyeccionDTO,
  EditarInsumoInput,
  FichaCostoDetalleDTO,
  FichaCostoInput,
  FichaCostoResumenDTO,
  InsumoDTO,
  InsumoInput,
} from '@taller/shared';
import { api } from './client';

// Costos de producción (docs/PLAN_COSTOS.md). Una compra cambia el precio de
// insumos y fichas: por eso cada mutación invalida todo lo de costos.

function useInvalidarCostos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['costos'] });
}

export function useInsumos() {
  return useQuery({ queryKey: ['costos', 'insumos'], queryFn: () => api<InsumoDTO[]>('/costos/insumos') });
}

export function useGuardarInsumo() {
  const onSuccess = useInvalidarCostos();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: InsumoInput | EditarInsumoInput }) =>
      id
        ? api<InsumoDTO>(`/costos/insumos/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
        : api<InsumoDTO>('/costos/insumos', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess,
  });
}

export function useEliminarInsumo() {
  const onSuccess = useInvalidarCostos();
  return useMutation({
    mutationFn: (id: string) => api(`/costos/insumos/${id}`, { method: 'DELETE' }),
    onSuccess,
  });
}

export function useCompras(insumoId?: string) {
  return useQuery({
    queryKey: ['costos', 'compras', insumoId ?? 'todas'],
    queryFn: () => api<CompraDTO[]>(`/costos/compras${insumoId ? `?insumoId=${insumoId}` : ''}`),
  });
}

export function useCrearCompra() {
  const onSuccess = useInvalidarCostos();
  return useMutation({
    mutationFn: (input: CompraInput) =>
      api<CompraDTO>('/costos/compras', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess,
  });
}

export function useEliminarCompra() {
  const onSuccess = useInvalidarCostos();
  return useMutation({
    mutationFn: (id: string) => api(`/costos/compras/${id}`, { method: 'DELETE' }),
    onSuccess,
  });
}

export function useFichasCosto() {
  return useQuery({
    queryKey: ['costos', 'fichas'],
    queryFn: () => api<FichaCostoResumenDTO[]>('/costos/fichas'),
  });
}

export function useFichaCosto(id: string | undefined) {
  return useQuery({
    queryKey: ['costos', 'ficha', id],
    queryFn: () => api<FichaCostoDetalleDTO>(`/costos/fichas/${id}`),
    enabled: Boolean(id),
  });
}

export function useGuardarFichaCosto() {
  const onSuccess = useInvalidarCostos();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: FichaCostoInput }) =>
      id
        ? api<FichaCostoDetalleDTO>(`/costos/fichas/${id}`, { method: 'PUT', body: JSON.stringify(input) })
        : api<FichaCostoDetalleDTO>('/costos/fichas', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess,
  });
}

export function useEliminarFichaCosto() {
  const onSuccess = useInvalidarCostos();
  return useMutation({
    mutationFn: (id: string) => api(`/costos/fichas/${id}`, { method: 'DELETE' }),
    onSuccess,
  });
}

// ── Etapas 3 y 4: conteos (stock), costo real de cortes y proyección ──

export function useCrearConteo() {
  const onSuccess = useInvalidarCostos();
  return useMutation({
    mutationFn: (input: ConteoInput) =>
      api<ConteoDTO>('/costos/conteos', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess,
  });
}

export function useCostosCortes() {
  return useQuery({
    queryKey: ['costos', 'cortes'],
    queryFn: () => api<CorteCostoResumenDTO[]>('/costos/cortes'),
  });
}

export function useCostoCorte(corteId: string | null) {
  return useQuery({
    queryKey: ['costos', 'corte', corteId],
    queryFn: () => api<CorteCostoDetalleDTO>(`/costos/cortes/${corteId}`),
    enabled: Boolean(corteId),
  });
}

export function useProyeccion(anio: number, mes: number) {
  return useQuery({
    queryKey: ['costos', 'proyeccion', anio, mes],
    queryFn: () => api<ProyeccionDTO>(`/costos/proyeccion?anio=${anio}&mes=${mes}`),
  });
}

export function useGuardarPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PlanInput) =>
      api<ProyeccionDTO>('/costos/plan', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: (dto) => qc.setQueryData(['costos', 'proyeccion', dto.anio, dto.mes], dto),
  });
}
