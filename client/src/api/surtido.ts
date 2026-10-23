import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ColorLavadoDTO,
  CorteDetalleDTO,
  EditarColorLavadoInput,
  EnviarSurtidoInput,
  GuardarSurtidoInput,
} from '@taller/shared';
import { api } from './client';

// Surtido por colores para la lavandería (docs/PLAN_SURTIDO.md).

export function useColoresLavado() {
  return useQuery({
    queryKey: ['colores-lavado'],
    queryFn: () => api<ColorLavadoDTO[]>('/colores-lavado'),
  });
}

/** Las mutaciones de la lista devuelven la lista completa. */
function usarListaActualizada() {
  const qc = useQueryClient();
  return (lista: ColorLavadoDTO[]) => qc.setQueryData(['colores-lavado'], lista);
}

export function useCrearColorLavado() {
  const aplicar = usarListaActualizada();
  return useMutation({
    mutationFn: (nombre: string) =>
      api<ColorLavadoDTO[]>('/colores-lavado', { method: 'POST', body: JSON.stringify({ nombre }) }),
    onSuccess: aplicar,
  });
}

export function useEditarColorLavado() {
  const aplicar = usarListaActualizada();
  return useMutation({
    mutationFn: ({ id, ...cambios }: EditarColorLavadoInput & { id: string }) =>
      api<ColorLavadoDTO[]>(`/colores-lavado/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(cambios),
      }),
    onSuccess: aplicar,
  });
}

export function useBorrarColorLavado() {
  const aplicar = usarListaActualizada();
  return useMutation({
    mutationFn: (id: string) => api<ColorLavadoDTO[]>(`/colores-lavado/${id}`, { method: 'DELETE' }),
    onSuccess: aplicar,
  });
}

/** Las del corte devuelven el detalle fresco (como el resto de cortes). */
function usarDetalleActualizado() {
  const qc = useQueryClient();
  return (detalle: CorteDetalleDTO) => {
    qc.setQueryData(['corte', detalle.id], detalle);
    qc.invalidateQueries({ queryKey: ['cortes'] });
  };
}

export function useGuardarSurtido() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ corteId, input }: { corteId: string; input: GuardarSurtidoInput }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/surtido`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

export function useEnviarSurtido() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ corteId, input }: { corteId: string; input: EnviarSurtidoInput }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/surtido/envios`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}
