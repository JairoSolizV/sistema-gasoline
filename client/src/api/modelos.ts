import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CrearModeloInput,
  CrearVersionInput,
  EditarBuscadorInput,
  EditarOperacionInput,
  ModeloDTO,
  ModeloVersionDetalleDTO,
  MoldeInput,
  OperacionInput,
} from '@taller/shared';
import { api } from './client';

export function useModelos() {
  return useQuery({
    queryKey: ['modelos'],
    queryFn: () => api<ModeloDTO[]>('/modelos'),
  });
}

export function useVersion(versionId: string | undefined) {
  return useQuery({
    queryKey: ['version', versionId],
    queryFn: () => api<ModeloVersionDetalleDTO>(`/versiones/${versionId}`),
    enabled: !!versionId,
  });
}

/** Las mutaciones de operaciones devuelven el detalle actualizado de la versión:
 *  se escribe directo al caché y se invalida la lista (costo/conteo cambiaron). */
function usarDetalleActualizado() {
  const qc = useQueryClient();
  return (detalle: ModeloVersionDetalleDTO) => {
    qc.setQueryData(['version', detalle.id], detalle);
    qc.invalidateQueries({ queryKey: ['modelos'] });
  };
}

export function useCrearModelo() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: (input: CrearModeloInput) =>
      api<ModeloVersionDetalleDTO>('/modelos', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: aplicar,
  });
}

export function useCrearVersion() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ modeloId, ...input }: CrearVersionInput & { modeloId: string }) =>
      api<ModeloVersionDetalleDTO>(`/modelos/${modeloId}/versiones`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

/** Buscador del modelo: asignar, "sin buscador" o pendiente (ambos vacíos). */
export function useEditarBuscador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ modeloId, ...input }: EditarBuscadorInput & { modeloId: string }) =>
      api<ModeloDTO>(`/modelos/${modeloId}/buscador`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modelos'] });
      qc.invalidateQueries({ queryKey: ['version'] }); // el detalle muestra el buscador
    },
  });
}

/** Moldes de una versión: registrar o corregir (PUT) y quitar (DELETE). */
export function useGuardarMolde() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ versionId, input }: { versionId: string; input: MoldeInput }) =>
      api<ModeloVersionDetalleDTO>(`/versiones/${versionId}/molde`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

export function useEliminarMolde() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: (versionId: string) =>
      api<ModeloVersionDetalleDTO>(`/versiones/${versionId}/molde`, { method: 'DELETE' }),
    onSuccess: aplicar,
  });
}

export function useAgregarOperacion() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ versionId, input }: { versionId: string; input: OperacionInput }) =>
      api<ModeloVersionDetalleDTO>(`/versiones/${versionId}/operaciones`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

export function useEditarOperacionModelo() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ operacionId, cambios }: { operacionId: string; cambios: EditarOperacionInput }) =>
      api<ModeloVersionDetalleDTO>(`/operaciones/${operacionId}`, {
        method: 'PATCH',
        body: JSON.stringify(cambios),
      }),
    onSuccess: aplicar,
  });
}

export function useEliminarOperacionModelo() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ operacionId }: { operacionId: string }) =>
      api<ModeloVersionDetalleDTO>(`/operaciones/${operacionId}`, { method: 'DELETE' }),
    onSuccess: aplicar,
  });
}
