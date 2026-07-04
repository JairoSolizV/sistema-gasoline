import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AsignarGrupoInput,
  CerrarCorteInput,
  CorteDetalleDTO,
  CorteResumenDTO,
  CrearCorteInput,
  ReemplazarAsignacionesInput,
} from '@taller/shared';
import { api } from './client';

export function useCortes(estado?: 'borrador' | 'abierto' | 'cerrado') {
  const query = estado ? `?estado=${estado}` : '';
  return useQuery({
    queryKey: ['cortes', estado ?? 'todos'],
    queryFn: () => api<CorteResumenDTO[]>(`/cortes${query}`),
  });
}

export function useCorte(corteId: string | undefined) {
  return useQuery({
    queryKey: ['corte', corteId],
    queryFn: () => api<CorteDetalleDTO>(`/cortes/${corteId}`),
    enabled: !!corteId,
  });
}

/** Todas las mutaciones devuelven el detalle fresco calculado por el server:
 *  se escribe al caché directo (la UI en vivo es solo feedback, el server manda). */
function usarDetalleActualizado() {
  const qc = useQueryClient();
  return (detalle: CorteDetalleDTO) => {
    qc.setQueryData(['corte', detalle.id], detalle);
    qc.invalidateQueries({ queryKey: ['cortes'] });
  };
}

export function useCrearCorte() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: (input: CrearCorteInput) =>
      api<CorteDetalleDTO>('/cortes', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: aplicar,
  });
}

export function useAbrirCorte() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: (corteId: string) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/abrir`, { method: 'POST' }),
    onSuccess: aplicar,
  });
}

export function useReemplazarAsignaciones() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({
      corteId,
      corteOperacionId,
      input,
    }: {
      corteId: string;
      corteOperacionId: string;
      input: ReemplazarAsignacionesInput;
    }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/operaciones/${corteOperacionId}/asignaciones`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

export function useAsignarGrupo() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ corteId, input }: { corteId: string; input: AsignarGrupoInput }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/asignar-grupo`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

export function useCerrarCorte() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ corteId, input }: { corteId: string; input: CerrarCorteInput }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/cerrar`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}
