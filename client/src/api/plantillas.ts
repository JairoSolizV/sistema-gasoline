import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CrearPlantillaInput,
  DuplicarPlantillaInput,
  EditarPlantillaInput,
  EditarPlantillaOperacionInput,
  PlantillaDetalleDTO,
  PlantillaOperacionInput,
  PlantillaResumenDTO,
  ReemplazarOperacionesInput,
} from '@taller/shared';
import { api } from './client';

export function usePlantillas() {
  return useQuery({
    queryKey: ['plantillas'],
    queryFn: () => api<PlantillaResumenDTO[]>('/plantillas'),
  });
}

export function usePlantilla(id: string | undefined) {
  return useQuery({
    queryKey: ['plantilla', id],
    queryFn: () => api<PlantillaDetalleDTO>(`/plantillas/${id}`),
    enabled: !!id,
  });
}

/** Las mutaciones devuelven el detalle completo: se escribe al caché y se
 *  invalida la lista (cambió el conteo de operaciones). */
function usarDetalleActualizado() {
  const qc = useQueryClient();
  return (detalle: PlantillaDetalleDTO) => {
    qc.setQueryData(['plantilla', detalle.id], detalle);
    qc.invalidateQueries({ queryKey: ['plantillas'] });
  };
}

export function useCrearPlantilla() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: (input: CrearPlantillaInput) =>
      api<PlantillaDetalleDTO>('/plantillas', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: aplicar,
  });
}

export function useDuplicarPlantilla() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ id, ...input }: DuplicarPlantillaInput & { id: string }) =>
      api<PlantillaDetalleDTO>(`/plantillas/${id}/duplicar`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

export function useEditarPlantilla() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ id, ...input }: EditarPlantillaInput & { id: string }) =>
      api<PlantillaDetalleDTO>(`/plantillas/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

export function useBorrarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ eliminada: boolean }>(`/plantillas/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plantillas'] }),
  });
}

export function useAgregarOperacionPlantilla() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ id, ...input }: PlantillaOperacionInput & { id: string }) =>
      api<PlantillaDetalleDTO>(`/plantillas/${id}/operaciones`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

/** Guarda la lista completa de operaciones tal como quedó en la pantalla. */
export function useGuardarOperacionesPlantilla() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ id, ...input }: ReemplazarOperacionesInput & { id: string }) =>
      api<PlantillaDetalleDTO>(`/plantillas/${id}/operaciones`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

export function useEditarOperacionPlantilla() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: ({ opId, ...input }: EditarPlantillaOperacionInput & { opId: string }) =>
      api<PlantillaDetalleDTO>(`/plantilla-operaciones/${opId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: aplicar,
  });
}

export function useEliminarOperacionPlantilla() {
  const aplicar = usarDetalleActualizado();
  return useMutation({
    mutationFn: (opId: string) =>
      api<PlantillaDetalleDTO>(`/plantilla-operaciones/${opId}`, { method: 'DELETE' }),
    onSuccess: aplicar,
  });
}
