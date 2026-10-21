import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AsignarGrupoInput,
  CerrarCorteInput,
  CorteDetalleDTO,
  CorteResumenDTO,
  CrearCorteInput,
  EditarCodigoInput,
  EditarOperacionInput,
  EditarRollosInput,
  EditarServicioInput,
  EditarTendidoInput,
  OperacionInput,
  ProcesoCorte,
  RegistrarProcesoInput,
  ReemplazarAsignacionesInput,
} from '@taller/shared';
import { api } from './client';
import { ordenarPorIds } from './modelos';

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

/** Número que el server asignaría al próximo corte si no se elige uno. */
export function useSiguienteCodigo() {
  return useQuery({
    queryKey: ['cortes', 'siguiente-codigo'],
    queryFn: () => api<{ codigo: number }>('/cortes/siguiente-codigo'),
  });
}

export function useEditarCodigo() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ corteId, input }: { corteId: string; input: EditarCodigoInput }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/codigo`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
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

export function useEditarTendido() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ corteId, input }: { corteId: string; input: EditarTendidoInput }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/tendido`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

/** Servicio de corte interno: marcar interno/externo y registrar o quitar un
 *  proceso (todas sus personas). Devuelven el detalle actualizado. */
export function useEditarServicio() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ corteId, input }: { corteId: string; input: EditarServicioInput }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/servicio`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

export function useRegistrarProceso() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({
      corteId,
      proceso,
      input,
    }: {
      corteId: string;
      proceso: ProcesoCorte;
      input: RegistrarProcesoInput;
    }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/procesos/${proceso}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

export function useQuitarProceso() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ corteId, proceso }: { corteId: string; proceso: ProcesoCorte }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/procesos/${proceso}`, { method: 'DELETE' }),
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

// ── Cambios de último momento a las operaciones del corte (no tocan el modelo;
//    cada uno queda en el historial del corte) ──

export function useReordenarOperacionesCorte() {
  const qc = useQueryClient();
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ corteId, operacionIds }: { corteId: string; operacionIds: string[] }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/operaciones/orden`, {
        method: 'PUT',
        body: JSON.stringify({ operacionIds }),
      }),
    // optimista: la fila queda donde se soltó mientras el server confirma
    onMutate: ({ corteId, operacionIds }) => {
      qc.setQueryData<CorteDetalleDTO>(['corte', corteId], (previo) =>
        previo ? { ...previo, operaciones: ordenarPorIds(previo.operaciones, operacionIds) } : previo,
      );
    },
    onSuccess: aplicar,
    onError: (_e, { corteId }) => qc.invalidateQueries({ queryKey: ['corte', corteId] }),
  });
}

export function useAgregarOperacionCorte() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ corteId, input }: { corteId: string; input: OperacionInput }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/operaciones`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

export function useEditarOperacionCorte() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({
      corteId,
      corteOperacionId,
      cambios,
    }: {
      corteId: string;
      corteOperacionId: string;
      cambios: EditarOperacionInput;
    }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/operaciones/${corteOperacionId}`, {
        method: 'PATCH',
        body: JSON.stringify(cambios),
      }),
    onSuccess: aplicar,
  });
}

export function useQuitarOperacionCorte() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ corteId, corteOperacionId }: { corteId: string; corteOperacionId: string }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/operaciones/${corteOperacionId}`, {
        method: 'DELETE',
      }),
    onSuccess: aplicar,
  });
}

/** Calculadora de tendido: guarda los rollos, el traslape y el retazo mínimo. */
export function useEditarRollos() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ corteId, input }: { corteId: string; input: EditarRollosInput }) =>
      api<CorteDetalleDTO>(`/cortes/${corteId}/rollos`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}
